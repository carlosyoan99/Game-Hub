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

/** Valores por defecto del sistema. */
const DEFAULTS = {
  theme: 'dark',
  reducedMotion: false,
  language: 'es',
};

class SettingsManagerImpl {
  constructor() {
    /** @type {Object<string, *>} Mapa interno de settings. */
    this._data = { ...DEFAULTS };

    /** @type {Map<string, Set<Function>>} Listeners por clave. */
    this._listeners = new Map();

    /** @type {Set<Function>} Listeners globales (cualquier cambio). */
    this._anyListeners = new Set();

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
