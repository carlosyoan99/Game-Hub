/**
 * InputManager
 * Abstrae teclado + ratón + gamepad + touch para que los juegos no
 * toquen addEventListener directamente. Una instancia por partida activa;
 * se hace attach() al cargar el juego y detach() al destruirlo.
 *
 * ─── Gamepad ────────────────────────────────────────────────────────
 * El engine llama a this.input.poll() al inicio de cada frame. El
 * estado del gamepad se refleja en teclas virtuales 'Gamepad*' que
 * funcionan con isDown() / wasPressed() como cualquier otra tecla:
 *
 *   GamepadA          — Botón A   (cara sur)
 *   GamepadB          — Botón B   (cara este)
 *   GamepadX          — Botón X   (cara oeste)
 *   GamepadY          — Botón Y   (cara norte)
 *   GamepadL1         — Hombro izquierdo
 *   GamepadR1         — Hombro derecho
 *   GamepadL2         — Gatillo izquierdo (digital, umbral 0.5)
 *   GamepadR2         — Gatillo derecho   (digital, umbral 0.5)
 *   GamepadSelect     — Botón Select/Back
 *   GamepadStart      — Botón Start
 *   GamepadL3         — Click stick izquierdo
 *   GamepadR3         — Click stick derecho
 *   GamepadUp         — D-pad arriba
 *   GamepadDown       — D-pad abajo
 *   GamepadLeft       — D-pad izquierda
 *   GamepadRight      — D-pad derecha
 *   GamepadHome       — Botón Home/Guide
 *   GamepadLStickUp   — Stick izq. arriba      (umbral 0.5)
 *   GamepadLStickDown — Stick izq. abajo       (umbral 0.5)
 *   GamepadLStickLeft — Stick izq. izquierda   (umbral 0.5)
 *   GamepadLStickRight— Stick izq. derecha     (umbral 0.5)
 *   GamepadRStickUp   — Stick der. arriba      (umbral 0.5)
 *   GamepadRStickDown — Stick der. abajo       (umbral 0.5)
 *   GamepadRStickLeft — Stick der. izquierda   (umbral 0.5)
 *   GamepadRStickRight— Stick der. derecha     (umbral 0.5)
 *
 * Valores analógicos raw + deadzone suave via this.input.gamepad:
 *   this.input.gamepad.leftStick   // { x, y } con deadzone radial 0.15
 *   this.input.gamepad.rightStick  // { x, y } con deadzone radial 0.15
 *   this.input.gamepad.leftTrigger  // 0..1
 *   this.input.gamepad.rightTrigger // 0..1
 *
 * ─── Action mapping ─────────────────────────────────────────────────
 *   this.input.bind('jump', 'Space', 'KeyW', 'GamepadA');
 *   this.input.isActionDown('jump');
 *   this.input.wasActionPressed('jump');
 *
 * ─── endFrame / poll ────────────────────────────────────────────────
 * endFrame() lo llama el engine después de render().
 * poll()    lo llama el engine antes de update()   (para gamepad).
 */

// ── Nombres de tecla virtual para cada botón del gamepad
//    (Standard Mapping de la Web Gamepad API)
const GAMEPAD_KEY_NAMES = [
  'GamepadA',       //  0
  'GamepadB',       //  1
  'GamepadX',       //  2
  'GamepadY',       //  3
  'GamepadL1',      //  4
  'GamepadR1',      //  5
  'GamepadL2',      //  6  (digital threshold)
  'GamepadR2',      //  7  (digital threshold)
  'GamepadSelect',  //  8
  'GamepadStart',   //  9
  'GamepadL3',      // 10
  'GamepadR3',      // 11
  'GamepadUp',      // 12
  'GamepadDown',    // 13
  'GamepadLeft',    // 14
  'GamepadRight',   // 15
  'GamepadHome',    // 16
];

// Umbral para considerar un gatillo como "presionado" digitalmente
const TRIGGER_THRESHOLD = 0.5;
// Umbral para considerar el stick analógico en una dirección
const STICK_DIGITAL_THRESHOLD = 0.5;
// Deadzone radial para sticks analógicos
const STICK_DEADZONE = 0.15;

/**
 * Aplica deadzone radial a un par de valores analógicos y re-escala
 * el resultado para que 0 = muerto y 1 = borde del círculo.
 */
function applyRadialDeadzone(x, y, threshold) {
  const mag = Math.sqrt(x * x + y * y);
  if (mag < threshold) return { x: 0, y: 0 };
  // Re-escalar: (mag - threshold) / (1 - threshold)  →  rango [0, 1]
  const scale = (mag - threshold) / (1 - threshold);
  const nx = x / mag;
  const ny = y / mag;
  return { x: nx * scale, y: ny * scale };
}

export class InputManager {
  constructor() {
    // ── Estado de teclas ──────────────────────────────────────────
    this.keys = new Set();
    this.keysJustPressed = new Set();
    this.mouse = {
      x: -1, y: -1,
      down: false,
      /** Botón del último mousedown: 0=izquierdo, 1=medio, 2=derecho */
      button: 0,
      clickedThisFrame: false,
      /** Acumulador de scroll vertical (wheel), se resetea cada frame */
      wheel: 0,
    };

    /** @type {Object<string, Set<string>>} Mapa acción → teclas */
    this._actions = {};

    // ── Estado del gamepad ────────────────────────────────────────
    this.gamepad = {
      connected: false,
      index: -1,
      id: '',
      mapping: '',
      /** Valores analógicos raw de los ejes (aplica deadzone suave) */
      leftStick: { x: 0, y: 0 },
      rightStick: { x: 0, y: 0 },
      leftTrigger: 0,
      rightTrigger: 0,
      /** Códigos de los botones digitales activos este frame */
      buttons: [],
    };

    /** @type {Map<number, Set<number>>} Botones que estaban presionados
     *  el frame anterior, por índice de gamepad. */
    this._prevGamepadButtons = new Map();

    this._canvas = null;

    // ── Handlers de teclado ───────────────────────────────────────
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      if (!this.keys.has(e.code)) this.keysJustPressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);

    // ── Handlers de ratón ─────────────────────────────────────────
    this._onMouseMove = (e) => {
      const rect = this._canvas.getBoundingClientRect();
      const scaleX = this._canvas.width / rect.width;
      const scaleY = this._canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    };
    this._onMouseDown = (e) => {
      this.mouse.down = true;
      this.mouse.button = e.button;
      this.mouse.clickedThisFrame = true;
    };
    this._onMouseUp = () => {
      this.mouse.down = false;
      this.mouse.button = 0;
    };

    // ── Handlers de rueda ────────────────────────────────────────
    this._onWheel = (e) => {
      // Acumular delta para que los juegos puedan leer el scroll total
      // del frame incluso si reciben varios eventos wheel seguidos.
      if (e.deltaY !== 0) {
        this.mouse.wheel += Math.sign(e.deltaY);
      }
      e.preventDefault();
    };

    // ── Handlers de touch ─────────────────────────────────────────
    this._onTouchMove = (e) => {
      if (e.touches.length === 0) return;
      this._onMouseMove(e.touches[0]);
      e.preventDefault();
    };
    this._onTouchStart = (e) => {
      if (e.touches.length === 0) return;
      this._onMouseMove(e.touches[0]);
      this._onMouseDown();
      e.preventDefault();
    };
    this._onTouchEnd = () => this._onMouseUp();

    // ── Handlers de gamepad ───────────────────────────────────────
    this._onGamepadConnected = (e) => {
      const gp = e.gamepad;
      this.gamepad.connected = true;
      this.gamepad.index = gp.index;
      this.gamepad.id = gp.id;
      this.gamepad.mapping = gp.mapping || '';

      if (!this._prevGamepadButtons.has(gp.index)) {
        this._prevGamepadButtons.set(gp.index, new Set());
      }
    };

    this._onGamepadDisconnected = (e) => {
      // Limpiar las teclas virtuales de este gamepad
      const idx = e.gamepad.index;
      this._prevGamepadButtons.delete(idx);

      // Si era el gamepad activo, resetear el estado
      if (this.gamepad.index === idx) {
        this._clearGamepadKeys();
        this.gamepad.connected = false;
        this.gamepad.index = -1;
        this.gamepad.id = '';
        this.gamepad.mapping = '';
        this.gamepad.leftStick = { x: 0, y: 0 };
        this.gamepad.rightStick = { x: 0, y: 0 };
        this.gamepad.leftTrigger = 0;
        this.gamepad.rightTrigger = 0;
        this.gamepad.buttons = [];
      }
    };

    // ── Blur: limpieza general ────────────────────────────────────
    this._onBlur = () => {
      this.keys.clear();
      this.keysJustPressed.clear();
      this.mouse.down = false;
      this.mouse.clickedThisFrame = false;
      this.mouse.wheel = 0;
      // Gamepad: reiniciar detección de bordes (prevSet) para que al
      // recuperar el foco se detecten los botones aún presionados.
      if (this.gamepad.connected) {
        this._prevGamepadButtons.set(this.gamepad.index, new Set());
      }
    };

    // ── Context menu: prevención ──────────────────────────────────
    this._onContextMenu = (e) => e.preventDefault();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ciclo de vida
  // ═══════════════════════════════════════════════════════════════════

  attach(canvas) {
    this._canvas = canvas;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('wheel', this._onWheel, { passive: false });
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('contextmenu', this._onContextMenu);
    window.addEventListener('gamepadconnected', this._onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this._onGamepadDisconnected);
  }

  detach() {
    const canvas = this._canvas;
    if (!canvas) return;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    canvas.removeEventListener('mousemove', this._onMouseMove);
    canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    canvas.removeEventListener('wheel', this._onWheel);
    canvas.removeEventListener('touchstart', this._onTouchStart);
    canvas.removeEventListener('touchmove', this._onTouchMove);
    canvas.removeEventListener('touchend', this._onTouchEnd);
    window.removeEventListener('blur', this._onBlur);
    canvas.removeEventListener('contextmenu', this._onContextMenu);
    window.removeEventListener('gamepadconnected', this._onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this._onGamepadDisconnected);
    this._canvas = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Polling (llamado por el engine al inicio de cada frame)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Lee el estado actual del gamepad (navigator.getGamepads()) y
   * actualiza las teclas virtuales y el objeto this.gamepad.
   * Lo llama el engine al inicio de cada frame, antes de update().
   */
  poll() {
    this._pollGamepads();
  }

  _pollGamepads() {
    let gamepads;
    try {
      gamepads = navigator.getGamepads();
    } catch {
      return; // API no disponible
    }
    if (!gamepads) return;

    // Recopilar qué teclas virtuales de gamepad están activas este frame
    const currentVirtualKeys = new Set();

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;

      // Actualizar estado público del primer gamepad conectado
      if (!this.gamepad.connected) {
        this.gamepad.connected = true;
        this.gamepad.index = gp.index;
        this.gamepad.id = gp.id;
        this.gamepad.mapping = gp.mapping || '';
      }

      if (gp.index !== this.gamepad.index) continue; // solo el activo

      // ── Botones digitales ───────────────────────────────────────
      for (let b = 0; b < gp.buttons.length && b < GAMEPAD_KEY_NAMES.length; b++) {
        const pressed = gp.buttons[b].pressed || gp.buttons[b].value > 0.5;
        if (pressed) {
          currentVirtualKeys.add(GAMEPAD_KEY_NAMES[b]);
        }
      }

      // ── Ejes analógicos → direcciones digitales ─────────────────
      const axes = gp.axes;
      if (axes.length >= 2) {
        // Stick izquierdo
        const lx = axes[0] || 0;
        const ly = axes[1] || 0;
        const deadL = applyRadialDeadzone(lx, ly, STICK_DEADZONE);
        this.gamepad.leftStick.x = deadL.x;
        this.gamepad.leftStick.y = deadL.y;

        if (deadL.y < -STICK_DIGITAL_THRESHOLD) currentVirtualKeys.add('GamepadLStickUp');
        if (deadL.y >  STICK_DIGITAL_THRESHOLD) currentVirtualKeys.add('GamepadLStickDown');
        if (deadL.x < -STICK_DIGITAL_THRESHOLD) currentVirtualKeys.add('GamepadLStickLeft');
        if (deadL.x >  STICK_DIGITAL_THRESHOLD) currentVirtualKeys.add('GamepadLStickRight');
      }

      if (axes.length >= 4) {
        // Stick derecho
        const rx = axes[2] || 0;
        const ry = axes[3] || 0;
        const deadR = applyRadialDeadzone(rx, ry, STICK_DEADZONE);
        this.gamepad.rightStick.x = deadR.x;
        this.gamepad.rightStick.y = deadR.y;

        if (deadR.y < -STICK_DIGITAL_THRESHOLD) currentVirtualKeys.add('GamepadRStickUp');
        if (deadR.y >  STICK_DIGITAL_THRESHOLD) currentVirtualKeys.add('GamepadRStickDown');
        if (deadR.x < -STICK_DIGITAL_THRESHOLD) currentVirtualKeys.add('GamepadRStickLeft');
        if (deadR.x >  STICK_DIGITAL_THRESHOLD) currentVirtualKeys.add('GamepadRStickRight');
      }

      // Gatillos analógicos (si no se leyeron como botones)
      if (axes.length >= 6) {
        this.gamepad.leftTrigger = axes[4] || 0;
        if (this.gamepad.leftTrigger > TRIGGER_THRESHOLD) currentVirtualKeys.add('GamepadL2');
        this.gamepad.rightTrigger = axes[5] || 0;
        if (this.gamepad.rightTrigger > TRIGGER_THRESHOLD) currentVirtualKeys.add('GamepadR2');
      }

      // ── Botones activos (público) ──────────────────────────────
      this.gamepad.buttons = [...currentVirtualKeys];

      break; // solo procesamos el primer gamepad activo
    }

    // ── Sincronizar con keys / keysJustPressed ────────────────────
    const prevSet = this._prevGamepadButtons.get(this.gamepad.index) || new Set();

    // Teclas que se soltaron este frame → quitar de keys
    for (const key of prevSet) {
      if (!currentVirtualKeys.has(key)) {
        this.keys.delete(key);
      }
    }

    // Teclas que se presionaron este frame → añadir
    for (const key of currentVirtualKeys) {
      if (!prevSet.has(key)) {
        if (!this.keys.has(key)) this.keysJustPressed.add(key);
        this.keys.add(key);
      }
    }

    // Actualizar prev set para el próximo frame
    this._prevGamepadButtons.set(this.gamepad.index, new Set(currentVirtualKeys));
  }

  /** Limpia teclas virtuales de gamepad de keys/keysJustPressed. */
  _clearGamepadKeys() {
    const gamepadPrefix = 'Gamepad';
    for (const key of this.keys) {
      if (key.startsWith(gamepadPrefix)) this.keys.delete(key);
    }
    for (const key of this.keysJustPressed) {
      if (key.startsWith(gamepadPrefix)) this.keysJustPressed.delete(key);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Consulta directa de teclas
  // ═══════════════════════════════════════════════════════════════════

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.keysJustPressed.has(code);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Action mapping
  // ═══════════════════════════════════════════════════════════════════

  bind(actionName, ...keys) {
    if (!this._actions[actionName]) {
      this._actions[actionName] = new Set();
    }
    for (const key of keys) {
      this._actions[actionName].add(key);
    }
  }

  unbind(actionName, ...keys) {
    const action = this._actions[actionName];
    if (!action) return;
    for (const key of keys) {
      action.delete(key);
    }
    if (action.size === 0) {
      delete this._actions[actionName];
    }
  }

  isActionDown(actionName) {
    const action = this._actions[actionName];
    if (!action) return false;
    for (const key of action) {
      if (this.keys.has(key)) return true;
    }
    return false;
  }

  wasActionPressed(actionName) {
    const action = this._actions[actionName];
    if (!action) return false;
    for (const key of action) {
      if (this.keysJustPressed.has(key)) return true;
    }
    return false;
  }

  /**
   * Devuelve las teclas asociadas a una acción (o null si no existe).
   * @param {string} actionName
   * @returns {string[]|null}
   */
  getBoundKeys(actionName) {
    const action = this._actions[actionName];
    if (!action) return null;
    return [...action];
  }

  /**
   * Elimina TODAS las acciones registradas. Útil al aplicar bindings.
   */
  clearActions() {
    this._actions = {};
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Utilidades
  // ═══════════════════════════════════════════════════════════════════

  resetKeys() {
    this.keys.clear();
    this.keysJustPressed.clear();
  }

  /**
   * Limpia el estado transitorio del frame.
   * Lo llama el engine automáticamente después de render().
   * Los juegos no deben llamarlo directamente.
   */
  endFrame() {
    this.keysJustPressed.clear();
    this.mouse.clickedThisFrame = false;
    this.mouse.wheel = 0;
  }
}
