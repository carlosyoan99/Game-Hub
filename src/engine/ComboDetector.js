/**
 * ComboDetector
 * Sistema de detección de combos/secuencias de teclas para juegos de pelea.
 *
 * Permite definir movimientos especiales estilo Street Fighter:
 *   ↓↘→ + A  → fireball
 *   →↓↘ + B  → dragon punch
 *   ↓↙← + X  → hurricane kick
 *
 * Uso:
 *   import { ComboDetector } from '../../engine/ComboDetector.js';
 *
 *   const detector = new ComboDetector({
 *     bufferSize: 20,
 *     timingWindow: 0.4,    // segundos para completar el combo
 *   });
 *
 *   // Definir movimientos
 *   detector.addCombo('fireball',  ['Down', 'DownRight', 'Right', 'A'], 0.3);
 *   detector.addCombo('dragon',    ['Right', 'Down', 'DownRight', 'B'], 0.35);
 *
 *   // Cada frame: pasar las teclas presionadas este frame
 *   detector.processInput(keysPressedThisFrame, dt);
 *
 *   // Consultar si se ejecutó un combo este frame
 *   if (detector.wasComboPerformed('fireball')) { launchFireball(); }
 */

// ─── Hitbox utilities ─────────────────────────────────────────────────

/**
 * Crea un rectángulo de hitbox.
 * @param {number} x - Centro X
 * @param {number} y - Centro Y
 * @param {number} w - Ancho
 * @param {number} h - Alto
 * @param {number} [damage=0] - Daño
 * @param {number} [knockbackX=0] - Empuje horizontal
 * @param {number} [knockbackY=0] - Empuje vertical
 * @returns {{ x: number, y: number, w: number, h: number, damage: number, knockbackX: number, knockbackY: number }}
 */
export function createHitbox(x, y, w, h, damage = 0, knockbackX = 0, knockbackY = 0) {
  return { x, y, w, h, damage, knockbackX, knockbackY };
}

/**
 * Comprueba si dos hitboxes (AABB) intersectan.
 * @param {{ x: number, y: number, w: number, h: number }} a
 * @param {{ x: number, y: number, w: number, h: number }} b
 * @returns {boolean}
 */
export function hitboxIntersects(a, b) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
    Math.abs(a.y - b.y) < (a.h + b.h) / 2
  );
}

// ─── Fighter State Machine ───────────────────────────────────────────

/**
 * Estados comunes para un personaje de fighting game.
 */
export const FIGHTER_STATE = {
  IDLE:       'idle',
  WALK_FWD:   'walk_fwd',
  WALK_BACK:  'walk_back',
  CROUCH:     'crouch',
  JUMP:       'jump',
  ATTACK:     'attack',     // período activo del golpe
  RECOVERY:   'recovery',   // después del golpe
  HIT:        'hit',        // recibiendo daño
  BLOCK:      'block',      // bloqueando
  KNOCKDOWN:  'knockdown',  // derribado
  SPECIAL:    'special',    // movimiento especial
  SUPER:      'super',      // super move
  VICTORY:    'victory',
  DEFEATED:   'defeated',
};

// ─── Frame Data ───────────────────────────────────────────────────────

/**
 * Crea datos de frame para un ataque.
 * @param {number} startup  - Frames antes de que el golpe sea activo
 * @param {number} active   - Frames que el hitbox está activo
 * @param {number} recovery - Frames de recuperación después del golpe
 * @param {number} damage   - Daño del golpe
 * @param {number} knockbackX - Empuje horizontal
 * @param {number} knockbackY - Empuje vertical
 * @param {number} [hitStun=10] - Frames que el oponente queda aturdido
 * @param {number} [blockStun=5] - Frames que el oponente queda aturdido al bloquear
 * @returns {object}
 */
export function createFrameData({ startup, active, recovery, damage, knockbackX, knockbackY, hitStun = 10, blockStun = 5 }) {
  return { startup, active, recovery, damage, knockbackX, knockbackY, hitStun, blockStun };
}

// ─── Combo Detector ────────────────────────────────────────────────────

/**
 * @typedef {Object} ComboDef
 * @property {string} name - Nombre del movimiento
 * @property {string[]} sequence - Secuencia de teclas (ej. ['Down', 'DownRight', 'Right', 'A'])
 * @property {number} timing - Ventana de tiempo en segundos para completar la secuencia
 */

export class ComboDetector {
  /**
   * @param {object} [opts]
   * @param {number} [opts.bufferSize=30] - Número máximo de inputs en el buffer
   * @param {number} [opts.timingWindow=0.4] - Ventana de tiempo por defecto (s)
   */
  constructor(opts = {}) {
    this.bufferSize = opts.bufferSize || 30;
    this.defaultTiming = opts.timingWindow || 0.4;

    /** @type {ComboDef[]} */
    this._combos = [];

    /** Buffer circular de inputs recientes */
    this._inputBuffer = [];

    /** Set de combos realizados este frame */
    this._performedThisFrame = new Set();

  }

  /**
   * Añade un combo/movimiento especial.
   * @param {string} name - Nombre único del movimiento
   * @param {string[]} sequence - Secuencia de teclas (códigos, ej. 'ArrowDown' o 'KeyA')
   * @param {number} [timing] - Ventana de tiempo en segundos (default: 0.4)
   */
  addCombo(name, sequence, timing) {
    this._combos.push({
      name,
      sequence: sequence.map(s => s.toLowerCase()),
      timing: timing || this.defaultTiming,
    });
  }

  /**
   * Procesa una lista de teclas presionadas este frame.
   * 
   * El llamador debe pasar las teclas que se presionaron este frame:
   * ```js
   * const pressed = this.keysPressedThisFrame; // trackeado manualmente
   * this.combo.processInput(pressed, dt);
   * if (this.combo.wasComboPerformed('fireball')) { ... }
   * ```
   * @param {string[]} justPressedKeys - Array de códigos presionados este frame
   * @param {number} dt - Delta time (para envejecer el buffer)
   */
  processInput(justPressedKeys, dt) {
    this._performedThisFrame.clear();

    // Envejecer entradas existentes (restar dt al timer de cada una)
    for (let i = this._inputBuffer.length - 1; i >= 0; i--) {
      this._inputBuffer[i].timer -= dt;
      if (this._inputBuffer[i].timer <= 0) {
        this._inputBuffer.splice(i, 1);
      }
    }

    // Añadir teclas presionadas este frame al buffer
    for (const key of justPressedKeys) {
      this._inputBuffer.push({
        key: key.toLowerCase(),
        timer: this.defaultTiming,
      });
    }

    // Limitar tamaño del buffer
    if (this._inputBuffer.length > this.bufferSize) {
      this._inputBuffer.splice(0, this._inputBuffer.length - this.bufferSize);
    }

    // Detectar combos
    this._detectCombos();
  }

  /**
   * Busca coincidencias de combos en el buffer de inputs.
   */
  _detectCombos() {
    for (const combo of this._combos) {
      if (this._matchSequence(combo.sequence)) {
        this._performedThisFrame.add(combo.name);
      }
    }
  }

  /**
   * Busca la secuencia en el buffer (desde el final hacia atrás).
   * @param {string[]} sequence
   * @returns {boolean}
   */
  _matchSequence(sequence) {
    if (sequence.length === 0 || this._inputBuffer.length < sequence.length) return false;

    // Empezar desde el final del buffer y buscar hacia atrás
    let seqIdx = sequence.length - 1;
    let bufIdx = this._inputBuffer.length - 1;

    while (seqIdx >= 0 && bufIdx >= 0) {
      const bufKey = this._inputBuffer[bufIdx].key;
      const seqKey = sequence[seqIdx];

      if (bufKey === seqKey) {
        seqIdx--;
        bufIdx--;
      } else {
        bufIdx--;
      }
    }

    return seqIdx < 0; // todos los elementos de la secuencia fueron encontrados
  }

  /**
   * ¿Se realizó un combo específico este frame?
   * @param {string} name
   * @returns {boolean}
   */
  wasComboPerformed(name) {
    return this._performedThisFrame.has(name);
  }

  /**
   * Limpia el buffer de inputs.
   */
  reset() {
    this._inputBuffer = [];
    this._performedThisFrame.clear();
  }
}
