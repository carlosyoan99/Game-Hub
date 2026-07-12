/**
 * HapticManager
 * Gestor de vibración háptica para juegos Canvas 2D basado en la Vibration
 * API (navigator.vibrate). Diseñado para complementar AudioManager.sfx():
 * cada preset de vibración tiene el mismo nombre que su equivalente de audio.
 *
 * Soporta:
 *   - Patrones de vibración predefinidos (jump, coin, hit, shoot, explosion,
 *     select, powerup)
 *   - Patrones personalizados (duración única o secuencia de pulsos)
 *   - Activación/desactivación persistida en localStorage
 *   - Detección de disponibilidad de la API
 *
 * Singleton: una instancia global compartida por todos los juegos.
 * La vibración solo funciona en navegadores/dispositivos que soporten
 * la Vibration API (Android/Chrome móvil; no disponible en iOS Safari ni
 * escritorio sin gamepad háptico).
 *
 * Uso básico:
 *   import { HapticManager } from '../../engine/HapticManager.js';
 *
 *   // Presets de vibración (complementan AudioManager.sfx()):
 *   HapticManager.vibrate('jump');
 *   HapticManager.vibrate('coin');
 *   HapticManager.vibrate('hit');
 *   HapticManager.vibrate('shoot');
 *   HapticManager.vibrate('explosion');
 *   HapticManager.vibrate('select');
 *   HapticManager.vibrate('powerup');
 *
 *   // Patrón personalizado:
 *   HapticManager.vibrate(100);                  // 100ms seguidos
 *   HapticManager.vibrate([100, 50, 100]);        // pulso-pausa-pulso
 *
 *   // Activar/desactivar:
 *   HapticManager.enabled = false;
 *   HapticManager.enabled = true;
 *
 *   // Consultar disponibilidad:
 *   if (HapticManager.supported) { ... }
 */

const STORAGE_KEY = 'gamehub:haptic:enabled';

/** Array vacío para detener la vibración en curso. */
const STOP = [0];

/**
 * Patrones de vibración predefinidos.
 * Cada entrada es un array [vibrarMs, pausaMs, vibrarMs, ...]
 * adaptado al nombre del SFX correspondiente en AudioManager.
 */
const PATTERNS = {
  jump: [30, 20, 15],           // Dos pulsos rápidos ascendentes
  coin: [20, 30, 40],           // Dos pulsos que crecen
  hit: [60],                     // Pulso único fuerte
  shoot: [15, 10, 15],          // Dos pulsos muy rápidos
  explosion: [80, 30, 60, 30, 40], // Ráfaga que decrece
  select: [20],                  // Pulso ultracorto
  powerup: [30, 20, 40, 20, 60], // Ráfaga que crece
};

class HapticManagerImpl {
  constructor() {
    /** @type {boolean} ¿La API navigator.vibrate está disponible? */
    this._supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

    /** @type {boolean} Activado/desactivado (persistido). */
    this._enabled = true;

    this._loadEnabled();
  }

  /** ¿La Vibration API está disponible en este navegador? */
  get supported() {
    return this._supported;
  }

  /** ¿La vibración está activada? */
  get enabled() {
    return this._enabled;
  }

  set enabled(value) {
    this._enabled = !!value;
    this._saveEnabled();
  }

  /**
   * Ejecuta una vibración.
   *
   * Seguro de llamar en cualquier momento — los guards internos
   * verifican que la Vibration API esté disponible (`_supported`)
   * y que el usuario tenga la vibración activada (`_enabled`).
   * Si no se cumplen las condiciones, la llamada es un no-op.
   * El acceso a navigator.vibrate() está envuelto en try/catch.
   *
   * Los juegos pueden llamar a este método directamente sin
   * precondition checks adicionales.
   *
   * @param {string|number|number[]} pattern
   *   - String: nombre del preset ('jump', 'coin', 'hit', 'shoot',
   *     'explosion', 'select', 'powerup')
   *   - Number: duración única en milisegundos
   *   - number[]: secuencia [vibrar, pausa, vibrar, ...] en ms
   */
  vibrate(pattern) {
    if (!this._supported || !this._enabled) return;

    let resolved;

    if (typeof pattern === 'string') {
      resolved = PATTERNS[pattern];
      if (!resolved) {
        console.warn(`HapticManager: patrón desconocido "${pattern}"`);
        return;
      }
    } else if (typeof pattern === 'number') {
      resolved = [pattern];
    } else if (Array.isArray(pattern)) {
      resolved = pattern;
    } else {
      return;
    }

    try {
      navigator.vibrate(resolved);
    } catch {
      // navegador bloqueó la vibración (silencio)
    }
  }

  /** Detiene cualquier vibración en curso. */
  stop() {
    if (!this._supported) return;
    try {
      navigator.vibrate(STOP);
    } catch { /* ignorar */ }
  }

  // ------------------------------------------------------------------
  //  Persistencia
  // ------------------------------------------------------------------

  _saveEnabled() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._enabled));
    } catch { /* ignorar */ }
  }

  _loadEnabled() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        this._enabled = raw === 'true';
      }
    } catch { /* ignorar */ }
  }
}

// Singleton compartido por todos los juegos.
export const HapticManager = new HapticManagerImpl();
