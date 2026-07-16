/**
 * ParticleSystem
 * Motor de partículas reutilizable para efectos visuales (impactos,
 * explosiones, estelas) en juegos de Canvas 2D.
 *
 * Internamente usa un pool de objetos pre-asignados para evitar
 * presión de GC: las partículas se reusan, y las muertas se
 * compactan con swap-remove en cada update.
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
  /**
   * @param {number} gravity       Aceleración vertical (px/s²)
   * @param {number} [maxParticles=300]  Capacidad máxima del pool
   */
  constructor(gravity = 150, maxParticles = 300) {
    this._gravity = gravity;
    this._rng = new SeededRandom();
    this._maxParticles = maxParticles;
    this._activeCount = 0;

    // Pre-asignar pool de objetos reutilizables
    this._pool = new Array(maxParticles);
    for (let i = 0; i < maxParticles; i++) {
      this._pool[i] = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, radius: 0, color: '' };
    }
  }

  /**
   * Devuelve una copia de las partículas activas (para lectura).
   * Compatibilidad con código legacy que itera `this.particles`.
   * @returns {Array<{x:number,y:number,vx:number,vy:number,life:number,maxLife:number,radius:number,color:string}>}
   */
  get particles() {
    return this._pool.slice(0, this._activeCount);
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
      if (this._activeCount >= this._maxParticles) break;

      const angle = this._rng.next() * Math.PI * 2;
      const spd = speed * (speedMin + this._rng.next() * (speedMax - speedMin));
      const life = lifeMin + this._rng.next() * (lifeMax - lifeMin);

      // Reutilizar slot del pool en lugar de crear un nuevo objeto
      const p = this._pool[this._activeCount];
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd + vyOffset;
      p.life = life;
      p.maxLife = life;
      p.radius = radiusMin + this._rng.next() * (radiusMax - radiusMin);
      p.color = color;

      this._activeCount++;
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

  /**
   * Avanza todas las partículas un frame y compacta las muertas
   * con swap-remove (O(1) por muerte, sin asignación de arrays).
   */
  update(dt) {
    for (let i = this._activeCount - 1; i >= 0; i--) {
      const p = this._pool[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += this._gravity * dt;
      p.life -= dt;

      if (p.life <= 0) {
        // Swap-remove: mover la última activa a esta posición
        this._activeCount--;
        const last = this._pool[this._activeCount];
        this._pool[i] = last;
        this._pool[this._activeCount] = p;
      }
    }
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
    for (let i = 0; i < this._activeCount; i++) {
      const p = this._pool[i];
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
    }
    ctx.restore();
  }

  /** Elimina todas las partículas (útil al reiniciar) — O(1). */
  clear() {
    this._activeCount = 0;
  }

  /** ¿No quedan partículas activas? */
  get isEmpty() {
    return this._activeCount === 0;
  }
}
