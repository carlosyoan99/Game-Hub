/**
 * ScreenShake
 * Efecto de screen shake reutilizable para Canvas 2D.
 * Se aplica como un desplazamiento acumulativo en ctx antes de renderizar
 * y decae exponencialmente.
 *
 * Uso:
 *   import { ScreenShake } from '../../engine/ScreenShake.js';
 *
 *   // En init():
 *   this.shake = new ScreenShake();
 *
 *   // En update(), cuando ocurre un impacto:
 *   this.shake.trigger(8, 0.3);  // intensidad 8px, duración 0.3s
 *
 *   // En render(), al inicio:
 *   this.shake.apply(ctx);
 *   // ... dibujar todo ...
 *   ctx.restore();  // si usaste ctx.save() antes
 */

export class ScreenShake {
  constructor() {
    this._intensity = 0;   // px restantes de desplazamiento
    this._decay = 0;       // factor de decaimiento por segundo
    this._x = 0;           // desplazamiento actual X
    this._y = 0;           // desplazamiento actual Y
  }

  /**
   * Inicia un temblor.
   * @param {number} intensity - Intensidad máxima en píxeles (ej. 8)
   * @param {number} duration  - Duración en segundos (ej. 0.3)
   */
  trigger(intensity, duration) {
    this._intensity = intensity;
    // Calcular decaimiento: llegar a ~0 al final de la duración
    // Usamos 0.05 como "casi cero"
    this._decay = duration > 0 ? -Math.log(0.05) / duration : 20;
  }

  /**
   * Actualiza el temblor. Llamar cada frame en update().
   * @param {number} dt - Delta time en segundos
   */
  update(dt) {
    if (this._intensity <= 0.5) {
      this._intensity = 0;
      this._x = 0;
      this._y = 0;
      return;
    }

    // Decaimiento exponencial
    this._intensity *= Math.exp(-this._decay * dt);

    // Desplazamiento aleatorio dentro del círculo de intensidad
    const angle = Math.random() * Math.PI * 2;
    this._x = Math.cos(angle) * this._intensity;
    this._y = Math.sin(angle) * this._intensity;
  }

  /**
   * Aplica el desplazamiento del temblor al contexto.
   * IMPORTANTE: llamar ctx.save() antes y ctx.restore() después.
   * @param {CanvasRenderingContext2D} ctx
   */
  apply(ctx) {
    if (this._intensity > 0.5) {
      ctx.translate(Math.round(this._x), Math.round(this._y));
    }
  }

  /**
   * ¿Está temblando actualmente?
   * @returns {boolean}
   */
  get isShaking() {
    return this._intensity > 0.5;
  }
}
