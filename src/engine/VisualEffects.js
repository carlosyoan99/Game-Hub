/**
 * VisualEffects
 * Colección de efectos visuales reutilizables: hit-stop (freeze frames),
 * transiciones entre niveles, overlay de scanlines CRT, y animaciones
 * de UI (score pop, fade, slide).
 *
 * Uso:
 *   import { HitStop, Transition, scanlinesOverlay, animateScore } from './VisualEffects.js';
 *
 *   // Hit-stop: congelar 3 frames al golpear
 *   this.hitStop = new HitStop();
 *   this.hitStop.trigger(3);  // 3 frames de pausa
 *   if (this.hitStop.active) return;  // saltar update()
 *
 *   // Transición fade-out/in entre niveles
 *   this.transition = new Transition();
 *   this.transition.fadeOut(0.3, () => { this.transition.fadeIn(0.3); });
 *
 *   // Scanlines overlay
 *   ctx.save();
 *   scanlinesOverlay(ctx, width, height, 0.08);
 *   ctx.restore();
 *
 *   // Score pop animation
 *   const pop = createScorePop(x, y, '+100');
 *   pop.update(dt);
 *   pop.render(ctx);
 */

import { SettingsManager } from './SettingsManager.js';
import { ScreenShake } from './ScreenShake.js';

// ═════════════════════════════════════════════════════════════════════════
//  Hit-Stop (Freeze Frames)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Gestiona el hit-stop: congela el juego temporalmente al conectar
 * un golpe, para dar sensación de impacto.
 *
 * Uso en update():
 *   this.hitStop.update(dt);
 *   if (this.hitStop.active) return; // Saltar lógica del juego
 */
export class HitStop {
  constructor() {
    this._frames = 0;
    this._accumulator = 0;
    this._baseDt = 1 / 60;  // ~16.67ms por frame
  }

  /**
   * Activa el hit-stop por una cantidad de frames.
   * @param {number} frames - Número de frames a congelar (ej. 3)
   */
  trigger(frames) {
    this._frames = Math.max(this._frames, frames);
    this._accumulator = 0;
  }

  /**
   * Actualiza el hit-stop. Si está activo, consume el dt sin
   * decrementar el contador de frames hasta acumular un frame completo.
   * @param {number} dt
   */
  update(dt) {
    if (this._frames > 0) {
      this._accumulator += dt;
      while (this._accumulator >= this._baseDt && this._frames > 0) {
        this._accumulator -= this._baseDt;
        this._frames--;
      }
    }
  }

  /** @returns {boolean} - true si el juego debe congelarse */
  get active() {
    return this._frames > 0;
  }

  reset() {
    this._frames = 0;
    this._accumulator = 0;
  }
}

// ═════════════════════════════════════════════════════════════════════════
//  Transiciones
// ═════════════════════════════════════════════════════════════════════════

/**
 * Gestiona transiciones fade-in/fade-out entre niveles o escenas.
 *
 * Uso:
 *   this.transition = new Transition();
 *
 *   // Iniciar fade-out, luego callback, luego fade-in:
 *   this.transition.fadeOut(0.3, () => {
 *     this._loadNextLevel();
 *     this.transition.fadeIn(0.3);
 *   });
 *
 *   // Render:
 *   this.transition.render(ctx, width, height);
 */
export class Transition {
  constructor() {
    this._alpha = 0;       // opacidad actual (0 = transparente)
    this._target = 0;      // opacidad destino
    this._speed = 0;       // velocidad de cambio por segundo
    this._callback = null; // callback al completar
    this._active = false;
    this._color = '#000';
  }

  /**
   * Inicia un fade-out (pantalla se vuelve negra).
   * @param {number} duration - Duración en segundos
   * @param {Function} [onComplete] - Callback al llegar a opaco
   * @param {string} [color] - Color del fade
   */
  fadeOut(duration = 0.3, onComplete, color = '#000') {
    this._target = 1;
    this._speed = duration > 0 ? 1 / duration : 10;
    this._callback = onComplete || null;
    this._active = true;
    this._color = color;
  }

  /**
   * Inicia un fade-in (pantalla se vuelve transparente).
   * @param {number} duration - Duración en segundos
   * @param {Function} [onComplete] - Callback al completar
   * @param {string} [color] - Color del fade
   */
  fadeIn(duration = 0.3, onComplete, color = '#000') {
    this._target = 0;
    this._speed = duration > 0 ? 1 / duration : 10;
    this._callback = onComplete || null;
    this._active = true;
    this._color = color;
  }

  /**
   * Actualiza la transición.
   * @param {number} dt
   */
  update(dt) {
    if (!this._active) return;

    if (this._alpha < this._target) {
      this._alpha = Math.min(this._target, this._alpha + this._speed * dt);
      if (this._alpha >= this._target && this._callback && this._target === 1) {
        const cb = this._callback;
        this._callback = null;
        cb();
      }
    } else if (this._alpha > this._target) {
      this._alpha = Math.max(this._target, this._alpha - this._speed * dt);
      if (this._alpha <= this._target) {
        this._active = false;
        if (this._callback) {
          const cb = this._callback;
          this._callback = null;
          cb();
        }
      }
    }
  }

  /**
   * Renderiza el overlay de transición.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width
   * @param {number} height
   */
  render(ctx, width, height) {
    if (this._alpha <= 0) return;
    ctx.fillStyle = this._hexToRgba(this._color, this._alpha);
    ctx.fillRect(0, 0, width, height);
  }

  /** @returns {boolean} */
  get active() { return this._active || this._alpha > 0; }

  _hexToRgba(hex, alpha) {
    // Expandir shorthand: #fff → #ffffff
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r},${g},${b},${alpha})`;
  }
}

// ═════════════════════════════════════════════════════════════════════════
//  Scanlines CRT
// ═════════════════════════════════════════════════════════════════════════

/**
 * Renderiza un overlay de scanlines (líneas CRT) sobre el canvas.
 * Respeta reducedMotion.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width
 * @param {number} height
 * @param {number} [opacity=0.06] - Opacidad de las líneas (0-1)
 */
export function scanlinesOverlay(ctx, width, height, opacity = 0.06) {
  if (SettingsManager.reducedMotion) return;
  ctx.save();
  ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
  // Dibujar líneas horizontales cada 2 píxeles
  for (let y = 0; y < height; y += 3) {
    ctx.fillRect(0, y, width, 1);
  }
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════════════════
//  Score Pop (animación de puntuación que sube y se desvanece)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Crea una animación de texto que sube y se desvanece.
 * Útil para mostrar "+100" al destruir enemigos.
 *
 * @param {number} x
 * @param {number} y
 * @param {string} text - Texto a mostrar (ej. "+100", "COMBO x3")
 * @param {string} [color='#ffb454']
 * @param {number} [duration=0.8] - Duración en segundos
 * @param {number} [rise=30] - Distancia que sube en píxeles
 * @returns {{ update: Function, render: Function, done: boolean }}
 */
export function createScorePop(x, y, text, color = '#ffb454', duration = 0.8, rise = 30) {
  let timer = duration;
  const startY = y;

  return {
    get done() { return timer <= 0; },

    /** @param {number} dt */
    update(dt) {
      timer -= dt;
    },

    /** @param {CanvasRenderingContext2D} ctx */
    render(ctx) {
      if (timer <= 0) return;
      const progress = 1 - timer / duration;
      const alpha = 1 - progress;
      const currentY = startY - progress * rise;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, currentY);
      ctx.restore();
    },
  };
}

// ═════════════════════════════════════════════════════════════════════════
//  Power-up Flash (destello al recoger un power-up)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Crea un efecto de destello al recoger un power-up.
 *
 * @param {number} duration - Duración en segundos
 * @param {string} color - Color del destello
 * @returns {{ trigger: Function, update: Function, render: Function, active: boolean }}
 */
export function createPowerupFlash(duration = 0.3, color = '#ffb454') {
  let timer = 0;
  const maxDuration = duration;

  return {
    get active() { return timer > 0; },

    trigger() {
      timer = maxDuration;
    },

    /** @param {number} dt */
    update(dt) {
      if (timer > 0) timer -= dt;
    },

    /** @param {CanvasRenderingContext2D} ctx */
    /** @param {number} x - Centro X */
    /** @param {number} y - Centro Y */
    /** @param {number} [radius=40] - Radio del destello */
    render(ctx, x, y, radius = 40) {
      if (timer <= 0) return;
      const progress = 1 - timer / maxDuration;
      const alpha = 1 - progress;
      const r = radius * (1 + progress * 0.5);

      ctx.save();
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgba(255,255,255,${alpha * 0.6})`);
      grad.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.2})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  };
}
