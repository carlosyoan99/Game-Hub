/**
 * SeededRandom
 * Generador de números pseudoaleatorios con semilla (PRNG) basado en el
 * algoritmo Mulberry32. Produce secuencias deterministas: a igual semilla,
 * igual secuencia de números.
 *
 * Ideal para contenido procedimental en juegos donde se necesita que
 * el mismo nivel/juego sea reproducible compartiendo el código de semilla.
 *
 * Uso básico:
 *   import { SeededRandom } from '../../engine/SeededRandom.js';
 *
 *   // Crear generador con una semilla numérica
 *   const rng = new SeededRandom(42);
 *   rng.next();        // 0.5288...
 *   rng.nextInt(1, 6); // dado de 6 caras → 4
 *
 *   // Código de semilla legible para compartir
 *   const code = SeededRandom.encode(42);   // "16"
 *   const seed  = SeededRandom.decode(code); // 42
 *
 *   // Crear generador a partir de nivel + dificultad
 *   const levelRng = SeededRandom.fromLevel(3, 2);
 *
 *   // Utilidades para arrays
 *   rng.pick(['a', 'b', 'c']);  // elemento aleatorio
 *   rng.shuffle([1, 2, 3, 4]);  // mezcla Fisher-Yates in-place
 */

// Caracteres para encoding legible (base36 mayúsculas)
const BASE36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export class SeededRandom {
  /**
   * @param {number} seed  Semilla entera (0–2147483647). Si se pasa 0
   *   o un valor no entero, se genera una automáticamente.
   */
  constructor(seed) {
    if (typeof seed !== 'number' || !Number.isInteger(seed) || seed <= 0) {
      seed = (Date.now() ^ (Math.random() * 0x7fffffff)) >>> 0;
      if (seed === 0) seed = 1; // 0 rompe Mulberry32
    }
    /** Semilla original (para referencia). */
    this.seed = seed >>> 0;
    /** Estado interno del PRNG. */
    this._state = this.seed;
  }

  /**
   * Genera un float pseudoaleatorio en [0, 1).
   * Implementación Mulberry32 de Tommy Ettinger.
   * @returns {number}  Valor entre 0 (inclusive) y 1 (exclusive).
   */
  next() {
    let t = (this._state += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Genera un entero pseudoaleatorio en [min, max] (ambos inclusive).
   * @param {number} min  Valor mínimo (entero).
   * @param {number} max  Valor máximo (entero).
   * @returns {number}
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Genera un float pseudoaleatorio en [min, max).
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }

  /**
   * Elige un elemento aleatorio del array.
   * @template T
   * @param {T[]} arr
   * @returns {T|undefined}  undefined si el array está vacío.
   */
  pick(arr) {
    if (arr.length === 0) return undefined;
    return arr[this.nextInt(0, arr.length - 1)];
  }

  /**
   * Baraja (shuffle) el array in-place usando Fisher-Yates.
   * @template T
   * @param {T[]} arr
   * @returns {T[]}  El mismo array (modificado in-place).
   */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Crea un SeededRandom a partir de nivel y dificultad,
   * generando una semilla determinista combinando ambos valores.
   *
   * Útil para juegos con niveles: mismo nivel + misma dificultad
   * = mismo contenido generado.
   *
   * @param {number} level       Nivel (1-based).
   * @param {number} difficulty  Dificultad (1-based, default 1).
   * @returns {SeededRandom}
   */
  static fromLevel(level, difficulty = 1) {
    const seed = ((level * 7919) ^ (difficulty * 104729)) >>> 0;
    return new SeededRandom(seed || 1);
  }

  /**
   * Convierte una semilla numérica en un código corto legible
   * (4-6 caracteres alfanuméricos, estilo `A7K2`).
   *
   * El encoding es base36 con mayúsculas.
   *
   * @param {number} seed  Semilla entera positiva.
   * @returns {string}     Código de 1-6 caracteres (ej. "16", "1A", "A7K2").
   */
  static encode(seed) {
    if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0) return '0';
    if (seed === 0) return '0';
    let result = '';
    let n = seed;
    while (n > 0) {
      result = BASE36[n % 36] + result;
      n = Math.floor(n / 36);
    }
    return result;
  }

  /**
   * Convierte un código de semilla (generado con encode()) de vuelta
   * a número. Acepta mayúsculas y minúsculas.
   *
   * @param {string} str  Código de semilla (ej. "A7K2", "16").
   * @returns {number}    Semilla numérica, o 0 si el código es inválido.
   */
  static decode(str) {
    if (typeof str !== 'string' || str.length === 0) return 0;
    return parseInt(str.toUpperCase(), 36) || 0;
  }
}
