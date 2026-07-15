/**
 * SettingsManager
 * Singleton central de configuración del hub. Gestiona tema (oscuro/claro),
 * reducción de animaciones, idioma (ES/EN), volumen (maestro, SFX, música)
 * y vibración. Persiste todo en localStorage bajo `gamehub:settings:*`.
 *
 * Se integra con AudioManager y HapticManager del motor para reflejar
 * los cambios de volumen y vibración en caliente.
 *
 * ─── Ciclo de vida y guards ─────────────────────────────────────────
 *
 * AudioManager y HapticManager son singletons que persisten toda la
 * vida de la página. AudioManager.destroy() existe pero puede dejar
 * los nodos gain en null. Por eso SettingsManager NO accede directamente
 * a propiedades internas, sino que delega en los setters públicos de
 * AudioManager (que ya tienen guard interno: "if (this._masterGain)").
 *
 * Si AudioManager ha sido destruido:
 *   - Los getters devuelven el último valor almacenado (seguro).
 *   - Los setters persisten el nuevo valor en memoria y localStorage,
 *     pero silencian el cambio en los gain nodes (que son null).
 *   - Al recrear el AudioContext (resume()), los volúmenes guardados
 *     se aplican automáticamente.
 *
 * HapticManager no tiene método destroy() — solo stop() para la
 * vibración en curso. Su flag enabled es persistido en localStorage
 * y seguro de leer/escribir en cualquier momento.
 *
 * ─── Uso básico ────────────────────────────────────────────────────
 *
 *   import { SettingsManager } from '../../engine/SettingsManager.js';
 *
 *   // Leer valores
 *   SettingsManager.theme;        // 'dark' | 'light'
 *   SettingsManager.language;     // 'es' | 'en'
 *   SettingsManager.reducedMotion; // true | false
 *
 *   // Escribir valores (persisten automáticamente)
 *   SettingsManager.theme = 'light';
 *   SettingsManager.language = 'en';
 *   SettingsManager.reducedMotion = true;
 *
 *   // Suscribirse a cambios
 *   SettingsManager.onChange('theme', (value) => { ... });
 *   SettingsManager.onAnyChange((key, value) => { ... });
 */

import { AudioManager } from './AudioManager.js';
import { HapticManager } from './HapticManager.js';

const STORAGE_PREFIX = 'gamehub:settings:';
const BIND_PREFIX = 'gamehub:binds:';

/** Valores por defecto del sistema. */
const DEFAULTS = {
  theme: 'dark',
  reducedMotion: false,
  language: 'es',
  aspectRatio: '5:3',
  crtEffect: true,
};

class SettingsManagerImpl {
  constructor() {
    /** @type {Object<string, *>} Mapa interno de settings. */
    this._data = { ...DEFAULTS };

    /** @type {Map<string, Set<Function>>} Listeners por clave. */
    this._listeners = new Map();

    /** @type {Set<Function>} Listeners globales (cualquier cambio). */
    this._anyListeners = new Set();

    /** @type {Map<string, Set<Function>>} Listeners de bindings. */
    this._bindingListeners = new Map();

    this._load();
  }

  // ------------------------------------------------------------------
  //  Getters / Setters con persistencia automática
  // ------------------------------------------------------------------

  /** @returns {'dark'|'light'} */
  get theme() { return this._data.theme; }
  set theme(v) { this._set('theme', v === 'light' ? 'light' : 'dark'); }

  /** @returns {boolean} */
  get reducedMotion() { return this._data.reducedMotion; }
  set reducedMotion(v) { this._set('reducedMotion', !!v); }

  /** @returns {'es'|'en'} */
  get language() { return this._data.language; }
  set language(v) { this._set('language', v === 'en' ? 'en' : 'es'); }

  /**
   * Volumen maestro (0-1). Delegado a AudioManager.
   * Guard: AudioManager.setMasterVolume() ya protege contra
   * _masterGain === null tras destroy(). El valor siempre se persiste.
   */
  get masterVolume() { return AudioManager.masterVolume; }
  set masterVolume(v) { AudioManager.masterVolume = v; }

  /**
   * Volumen SFX (0-1). Delegado a AudioManager.
   * Guard: mismo patrón que masterVolume — setSfxVolume() es seguro
   * incluso tras destroy() porque el setter verifica _sfxGain antes
   * de acceder.
   */
  get sfxVolume() { return AudioManager.sfxVolume; }
  set sfxVolume(v) { AudioManager.sfxVolume = v; }

  /**
   * Volumen música (0-1). Delegado a AudioManager.
   * Guard: mismo patrón — setMusicVolume() chequea _musicGain.
   */
  get musicVolume() { return AudioManager.musicVolume; }
  set musicVolume(v) { AudioManager.musicVolume = v; }

  /**
   * Vibración activada. Delegado a HapticManager.
   * Guard: HapticManager no tiene destroy() — solo stop().
   * El setter de enabled persiste en localStorage y es seguro.
   */
  get hapticEnabled() { return HapticManager.enabled; }
  set hapticEnabled(v) { HapticManager.enabled = v; }

  // ------------------------------------------------------------------
  //  Listeners
  // ------------------------------------------------------------------

  /**
   * Se suscribe a cambios en una clave específica.
   * @param {string} key  'theme' | 'reducedMotion' | 'language'
   * @param {Function} fn  Callback que recibe (newValue, oldValue)
   * @returns {Function} Función para desuscribirse.
   */
  onChange(key, fn) {
    if (!this._listeners.has(key)) this._listeners.set(key, new Set());
    this._listeners.get(key).add(fn);
    return () => this._listeners.get(key)?.delete(fn);
  }

  /**
   * Se suscribe a cualquier cambio de settings.
   * @param {Function} fn  Callback que recibe (key, newValue, oldValue)
   * @returns {Function} Función para desuscribirse.
   */
  onAnyChange(fn) {
    this._anyListeners.add(fn);
    return () => this._anyListeners.delete(fn);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Key Bindings — persistencia y aplicación
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Carga las bindings personalizadas para un juego.
   * @param {string} gameKey - Identificador del juego ("pac-man", "tetris", etc.)
   * @returns {Object<string, string[]>} Mapa acción → [tecla1, tecla2, ...]
   */
  _loadBindings(gameKey) {
    try {
      const raw = localStorage.getItem(BIND_PREFIX + gameKey);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch { /* ignorar */ }
    return {};
  }

  /**
   * Persiste las bindings personalizadas de un juego.
   * @param {string} gameKey
   * @param {Object<string, string[]>} bindings
   */
  _saveBindings(gameKey, bindings) {
    try {
      localStorage.setItem(BIND_PREFIX + gameKey, JSON.stringify(bindings));
    } catch { /* localStorage no disponible o lleno */ }
  }

  /**
   * Devuelve las teclas personalizadas para una acción, o null si no
   * han sido rebindeadas.
   * @param {string} gameKey
   * @param {string} action
   * @returns {string[]|null}
   */
  getBinding(gameKey, action) {
    const bindings = this._loadBindings(gameKey);
    return bindings[action] || null;
  }

  /**
   * Establece (o elimina) una binding personalizada.
   * Dispara el listener de cambio si existe.
   * @param {string} gameKey
   * @param {string} action
   * @param {string[]} [keys] - Array de códigos. Si es null/[], se resetea.
   */
  setBinding(gameKey, action, keys) {
    const bindings = this._loadBindings(gameKey);
    if (keys && keys.length > 0) {
      bindings[action] = [...new Set(keys)]; // deduplicar
    } else {
      delete bindings[action];
    }
    this._saveBindings(gameKey, bindings);

    // Notificar listeners de binding (mapa separado para evitar colisiones)
    const actions = this._bindingListeners.get(gameKey);
    const specific = actions?.get(action);
    if (specific) {
      for (const fn of specific) {
        try { fn(bindings[action] || null); } catch { /* silencio */ }
      }
    }
  }

  /**
   * Resetea una acción a su valor por defecto.
   * @param {string} gameKey
   * @param {string} action
   */
  resetBinding(gameKey, action) {
    this.setBinding(gameKey, action, null);
  }

  /**
   * Resetea TODAS las bindings de un juego a sus valores por defecto.
   * @param {string} gameKey
   */
  resetAllBindings(gameKey) {
    try {
      localStorage.removeItem(BIND_PREFIX + gameKey);
    } catch { /* ignorar */ }
  }

  /**
   * Devuelve las teclas efectivas para una acción (custom o default).
   * @param {string} gameKey
   * @param {string} action
   * @param {string[]} defaultKeys
   * @returns {string[]}
   */
  getEffectiveKeys(gameKey, action, defaultKeys) {
    const custom = this.getBinding(gameKey, action);
    return custom || defaultKeys;
  }

  /**
   * Devuelve un mapa completo acción → teclas, mergeando defaults con
   * personalizaciones. Útil para la UI de rebinding.
   * @param {string} gameKey
   * @param {Object<string, string[]>} defaultMap
   * @returns {Object<string, string[]>}
   */
  getAllBindings(gameKey, defaultMap) {
    const custom = this._loadBindings(gameKey);
    const merged = {};
    for (const [action, defaults] of Object.entries(defaultMap)) {
      merged[action] = custom[action] || defaults;
    }
    // Añadir acciones que solo existen en custom (por si acaso)
    for (const [action, keys] of Object.entries(custom)) {
      if (!(action in merged)) {
        merged[action] = keys;
      }
    }
    return merged;
  }

  /**
   * Aplica las bindings personalizadas de un juego al InputManager.
   * Llama a input.clearActions() y luego a input.bind() para cada
   * acción con las teclas efectivas (custom o default).
   *
   * @param {import('./InputManager.js').InputManager} input
   * @param {string} gameKey
   * @param {Object<string, string[]>} defaultMap - Mapa acción → [tecla1, ...]
   */
  applyBindings(input, gameKey, defaultMap) {
    input.clearActions();
    for (const [action, defaultKeys] of Object.entries(defaultMap)) {
      const keys = this.getEffectiveKeys(gameKey, action, defaultKeys);
      input.bind(action, ...keys);
    }
  }

  /**
   * Inicia el modo de escucha para rebinding: intercepta la siguiente
   * tecla/gamepad presionado y lo reporta vía callback. NO detacha el
   * InputManager — solo añade un listener temporal en window.
   *
   * @param {import('./InputManager.js').InputManager} input
   * @param {Function} onBind - Callback que recibe (code).
   * @returns {Function} cancel
   */
  listenForBind(input, onBind) {
    let cancelled = false;

    const onKeyDown = (e) => {
      if (e.repeat || cancelled) return;
      if (['Escape', 'MetaLeft', 'MetaRight', 'ControlLeft', 'ControlRight',
          'AltLeft', 'AltRight', 'ShiftLeft', 'ShiftRight', 'CapsLock', 'Tab'].includes(e.code)) {
        return;
      }
      e.preventDefault();
      cancelled = true;
      if (pollId) clearInterval(pollId);
      window.removeEventListener('keydown', onKeyDown);
      onBind(e.code);
    };

    // Detectar el siguiente botón de gamepad que se presione.
    // Hacemos polling para no interferir con el InputManager activo.
    let pollId = null;
    let prevState = null; // snapshot del frame anterior para detectar transiciones
    const POLL_INTERVAL = 100; // ms
    const GAMEPAD_NAMES = ['GamepadA', 'GamepadB', 'GamepadX', 'GamepadY',
      'GamepadL1', 'GamepadR1', 'GamepadL2', 'GamepadR2',
      'GamepadSelect', 'GamepadStart', 'GamepadL3', 'GamepadR3',
      'GamepadUp', 'GamepadDown', 'GamepadLeft', 'GamepadRight', 'GamepadHome'];

    const onGamepad = () => {
      if (cancelled) return;
      try {
        const gamepads = navigator.getGamepads();
        if (!gamepads) return;
        for (const gp of gamepads) {
          if (!gp) continue;

          // Primer frame: solo capturar estado inicial (evita rebind
          // accidental si el jugador ya tenía un botón presionado).
          if (prevState === null) {
            prevState = new Array(gp.buttons.length).fill(false);
            for (let b = 0; b < gp.buttons.length; b++) {
              prevState[b] = gp.buttons[b].pressed || gp.buttons[b].value > 0.5;
            }
            return;
          }

          for (let b = 0; b < gp.buttons.length && b < GAMEPAD_NAMES.length; b++) {
            const pressed = gp.buttons[b].pressed || gp.buttons[b].value > 0.5;
            // Solo detectar transición false → true (evita rebotes)
            if (pressed && !prevState[b]) {
              if (pollId) clearInterval(pollId);
              window.removeEventListener('keydown', onKeyDown);
              cancelled = true;
              onBind(GAMEPAD_NAMES[b]);
              return;
            }
            prevState[b] = pressed;
          }
        }
      } catch { /* ignorar */ }
    };

    window.addEventListener('keydown', onKeyDown);
    pollId = setInterval(onGamepad, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (pollId) clearInterval(pollId);
      window.removeEventListener('keydown', onKeyDown);
    };
  }

  /**
   * Se suscribe a cambios en una binding específica.
   * @param {string} gameKey
   * @param {string} action
   * @param {Function} fn - Callback que recibe (newKeysArray|null)
   * @returns {Function} unsubscribe
   */
  onBindingChange(gameKey, action, fn) {
    if (!this._bindingListeners.has(gameKey)) this._bindingListeners.set(gameKey, new Map());
    const actions = this._bindingListeners.get(gameKey);
    if (!actions.has(action)) actions.set(action, new Set());
    actions.get(action).add(fn);
    return () => actions.get(action)?.delete(fn);
  }

  // ------------------------------------------------------------------
  //  Internos
  // ------------------------------------------------------------------

  /**
   * Establece un valor, lo persiste y notifica a los listeners.
   * @param {string} key
   * @param {*} value
   */
  _set(key, value) {
    const old = this._data[key];
    if (old === value) return;
    this._data[key] = value;
    this._save(key);

    // Notificar listeners específicos
    const specific = this._listeners.get(key);
    if (specific) {
      for (const fn of specific) {
        try { fn(value, old); } catch { /* silencio */ }
      }
    }

    // Notificar listeners globales
    for (const fn of this._anyListeners) {
      try { fn(key, value, old); } catch { /* silencio */ }
    }
  }

  /** Persiste una clave concreta en localStorage. */
  _save(key) {
    try {
      localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(this._data[key]));
    } catch { /* localStorage no disponible o lleno */ }
  }

  /** Carga todas las settings desde localStorage. */
  _load() {
    try {
      for (const key of Object.keys(DEFAULTS)) {
        const raw = localStorage.getItem(STORAGE_PREFIX + key);
        if (raw !== null) {
          const parsed = JSON.parse(raw);
          // Validar tipo según el default
          if (typeof parsed === typeof DEFAULTS[key]) {
            this._data[key] = parsed;
          }
        }
      }
    } catch { /* ignorar */ }
  }

  /** Resetea todas las settings a sus valores por defecto. */
  reset() {
    for (const key of Object.keys(DEFAULTS)) {
      this._set(key, DEFAULTS[key]);
    }
    // Guards: los setters de AudioManager tienen null-checks internos
    // en los gain nodes. Después de destroy() solo persisten el valor
    // sin propagar al gain (que es null).
    AudioManager.setMasterVolume(0.8);
    AudioManager.setSfxVolume(1.0);
    AudioManager.setMusicVolume(0.5);
    HapticManager.enabled = true;
  }

  /**
   * Devuelve una copia plana de todas las settings actuales.
   * Útil para depuración o para inicializar componentes.
   */
  getAll() {
    return { ...this._data };
  }
}

// Singleton compartido por todo el hub y los juegos.
export const SettingsManager = new SettingsManagerImpl();
