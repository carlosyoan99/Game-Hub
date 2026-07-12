/**
 * ParticleSystem
 * Motor de partículas reutilizable para efectos visuales (impactos,
 * explosiones, estelas) en juegos de Canvas 2D.
 *
 * Uso básico:
 *   this.particles = new ParticleSystem(150);
 *   this.particles.emit(x, y, '#ffb454', 12, 80, { vyOffset: -30 });
 *   this.particles.update(dt);
 *   this.particles.render(ctx);
 *   this.particles.clear();
 */

import { SettingsManager } from './SettingsManager.js';
import { SeededRandom } from './SeededRandom.js';

export class ParticleSystem {
  constructor(gravity = 150) {
    this.particles = [];
    this._gravity = gravity;
    this._rng = new SeededRandom();
  }

  /**
   * Emite una explosión de partículas en (x, y).
   * @param {number} x     Centro X
   * @param {number} y     Centro Y
   * @param {string} color Color CSS
   * @param {number} count Cantidad de partículas
   * @param {number} speed Velocidad base (px/s)
   * @param {object} [options]  Ajustes finos
   * @param {number} [options.vyOffset=0]    Empuje vertical inicial (negativo = hacia arriba)
   * @param {number} [options.lifeMin=0.3]   Vida mínima (segundos)
   * @param {number} [options.lifeMax=0.6]   Vida máxima (segundos)
   * @param {number} [options.radiusMin=1]   Radio mínimo
   * @param {number} [options.radiusMax=2]   Radio máximo
   * @param {number} [options.speedMin=0.2]  Fracción mínima de speed
   * @param {number} [options.speedMax=0.8]  Fracción máxima de speed
   */
  emit(x, y, color, count, speed, options = {}) {
    const {
      vyOffset = 0,
      lifeMin = 0.3,
      lifeMax = 0.6,
      radiusMin = 1,
      radiusMax = 2,
      speedMin = 0.2,
      speedMax = 0.8,
    } = options;

    for (let i = 0; i < count; i++) {
      const angle = this._rng.nextFloat() * Math.PI * 2;
      const spd = speed * (speedMin + this._rng.nextFloat() * (speedMax - speedMin));
      const life = lifeMin + this._rng.nextFloat() * (lifeMax - lifeMin);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd + vyOffset,
        life,
        maxLife: life,
        radius: radiusMin + this._rng.nextFloat() * (radiusMax - radiusMin),
        color,
      });
    }
  }

  /**
   * Método abreviado para emitir una explosión de partículas.
   * Es un wrapper de emit() con defaults orientados a efectos
   * de impacto/explosión: vyOffset=-30, life 0.3-0.5.
   *
   * Uso desde los juegos:
   *   this.particles.burst(x, y, '#ffb454', 12, 80);
   *   this.particles.burst(x, y, '#e74c3c', 8, 100, { vyOffset: -50 });
   *
   * @param {number} x
   * @param {number} y
   * @param {string} color
   * @param {number} count
   * @param {number} speed
   * @param {object} [overrides]  Opciones que sobreescriben los defaults
   */
  burst(x, y, color, count, speed, overrides = {}) {
    this.emit(x, y, color, count, speed, {
      vyOffset: -30,
      lifeMin: 0.3,
      lifeMax: 0.5,
      ...overrides,
    });
  }

  /** Avanza todas las partículas un frame. */
  update(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += this._gravity * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  /**
   * Dibuja todas las partículas (desvanece por vida restante).
   * Si reducedMotion está activo, no dibuja nada.
   * Guard: SettingsManager.reducedMotion — el gameplay esencial no se
   * afecta, solo lo decorativo (partículas).
   */
  render(ctx) {
    if (SettingsManager.reducedMotion) return;
    ctx.save();
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.restore();
  }

  /** Elimina todas las partículas (útil al reiniciar). */
  clear() {
    this.particles = [];
  }

  /** ¿No quedan partículas activas? */
  get isEmpty() {
    return this.particles.length === 0;
  }
}
