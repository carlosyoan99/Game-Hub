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
export class ParticleSystem {
  constructor(gravity = 150) {
    this.particles = [];
    this._gravity = gravity;
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
      const angle = Math.random() * Math.PI * 2;
      const spd = speed * (speedMin + Math.random() * (speedMax - speedMin));
      const life = lifeMin + Math.random() * (lifeMax - lifeMin);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd + vyOffset,
        life,
        maxLife: life,
        radius: radiusMin + Math.random() * (radiusMax - radiusMin),
        color,
      });
    }
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

  /** Dibuja todas las partículas (desvanece por vida restante). */
  render(ctx) {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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
