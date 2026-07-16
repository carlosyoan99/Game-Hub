/**
 * CRTEffects
 * Efectos CRT visuales: muestreo dinámico de bordes para glow en barras,
 * y helpers para gestionar la visibilidad del overlay (scanlines, viñeta).
 *
 * Los scanlines y la viñeta se manejan por CSS/SVG en el DOM (index.html).
 * Este módulo solo se encarga del glow dinámico que se renderiza
 * sobre el canvas en cada frame.
 *
 * Uso:
 *   import { CRTEffects } from './CRTEffects.js';
 *
 *   const crt = new CRTEffects();
 *   // En el loop del engine:
 *   crt.update(dt, offscreenCtx, arm, destCtx);
 *   // Llama a crt.renderGlow(destCtx, arm) después de drawImage
 */

// Intervalo de muestreo en segundos (~4 fps)
const SAMPLE_INTERVAL = 0.25;

export class CRTEffects {
  constructor() {
    /** Timer acumulado para el próximo muestreo */
    this._sampleTimer = 0;

    /** Últimos colores muestreados por borde */
    this._sampled = { top: null, bottom: null, left: null, right: null };

    /** Colores actuales (con transición suave) */
    this._current = { top: null, bottom: null, left: null, right: null };

    /** Transición de colores — se interpolan suavemente */
    this._transitionProgress = 1; // 1 = ya completada
    this._transitionDuration = 0.3; // segundos

    /** Si el muestreo está desactivado (reducedMotion o fallback) */
    this._samplingDisabled = false;
  }

  /**
   * Actualiza el timer de muestreo y, si toca, muestrea los bordes.
   * Llama desde el update loop del engine.
   *
   * @param {number} dt - Delta time en segundos
   * @param {CanvasRenderingContext2D} offscreenCtx - Contexto del juego (900×540)
   * @param {import('./AspectRatioManager.js').AspectRatioManager} arm
   * @param {boolean} [reducedMotion] - Si true, usa glow estático
   */
  update(dt, offscreenCtx, arm, reducedMotion = false) {
    if (reducedMotion || this._samplingDisabled) {
      // Glow estático: colores oscuros por defecto
      this._setStaticGlow();
      return;
    }

    this._sampleTimer += dt;
    if (this._sampleTimer >= SAMPLE_INTERVAL) {
      this._sampleTimer = 0;
      this._sampleEdges(offscreenCtx);
    }

    // Transición suave entre muestras
    if (this._transitionProgress < 1) {
      this._transitionProgress = Math.min(1, this._transitionProgress + dt / this._transitionDuration);
      this._interpolateGlow();
    }
  }

  /**
   * Renderiza el glow en las barras alrededor del canvas.
   * Se llama DESPUÉS de arm.drawToCanvas().
   *
   * @param {CanvasRenderingContext2D} ctx - Contexto del canvas visible
   * @param {import('./AspectRatioManager.js').AspectRatioManager} arm
   */
  renderGlow(ctx, arm) {
    const bars = {
      left: arm.barLeft,
      top: arm.barTop,
      right: arm.barRight,
      bottom: arm.barBottom,
    };

    // Si no hay barras, no hay glow que dibujar (proporción 5:3)
    if (bars.left === 0 && bars.top === 0 && bars.right === 0 && bars.bottom === 0) return;

    const cw = ctx.canvas.width;
    const ch = ctx.canvas.height;

    // Renderizar glow en cada barra usando los colores actuales
    if (bars.top > 0 && this._current.top) {
      this._renderBarGradient(ctx, 0, 0, cw, bars.top, this._current.top, 'vertical', false);
    }
    if (bars.bottom > 0 && this._current.bottom) {
      this._renderBarGradient(ctx, 0, ch - bars.bottom, cw, bars.bottom, this._current.bottom, 'vertical', true);
    }
    if (bars.left > 0 && this._current.left) {
      this._renderBarGradient(ctx, 0, 0, bars.left, ch, this._current.left, 'horizontal', false);
    }
    if (bars.right > 0 && this._current.right) {
      this._renderBarGradient(ctx, cw - bars.right, 0, bars.right, ch, this._current.right, 'horizontal', true);
    }
  }

  /**
   * Activa/desactiva el muestreo dinámico.
   * @param {boolean} disabled
   */
  setSamplingDisabled(disabled) {
    this._samplingDisabled = disabled;
    if (disabled) this._setStaticGlow();
  }

  /**
   * Renderiza un gradiente en una barra usando un color base.
   */
  _renderBarGradient(ctx, x, y, w, h, color, dir, reverse) {
    if (w <= 0 || h <= 0 || !color) return;

    ctx.save();

    if (dir === 'vertical') {
      // Barra superior o inferior: gradiente vertical
      const gradient = ctx.createLinearGradient(0, y, 0, y + h);
      if (reverse) {
        // Barra inferior: color → transparente hacia abajo
        gradient.addColorStop(0, this._colorWithAlpha(color, 0));
        gradient.addColorStop(1, this._colorWithAlpha(color, 0.6));
      } else {
        // Barra superior: transparente → color hacia abajo
        gradient.addColorStop(0, this._colorWithAlpha(color, 0.6));
        gradient.addColorStop(1, this._colorWithAlpha(color, 0));
      }
      ctx.fillStyle = gradient;
    } else {
      // Barra izquierda o derecha: gradiente horizontal
      const gradient = ctx.createLinearGradient(x, 0, x + w, 0);
      if (reverse) {
        // Barra derecha: color → transparente hacia la derecha
        gradient.addColorStop(0, this._colorWithAlpha(color, 0));
        gradient.addColorStop(1, this._colorWithAlpha(color, 0.6));
      } else {
        // Barra izquierda: transparente → color hacia la derecha
        gradient.addColorStop(0, this._colorWithAlpha(color, 0.6));
        gradient.addColorStop(1, this._colorWithAlpha(color, 0));
      }
      ctx.fillStyle = gradient;
    }

    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  /**
   * Muestrea los píxeles del borde del offscreen canvas y calcula
   * el color promedio de cada borde.
   *
   * @param {CanvasRenderingContext2D} ctx
   */
  _sampleEdges(ctx) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;

    try {
      // Muestrear 1px de cada borde para minimizar lecturas de getImageData
      const stripSize = 1;

      // Borde superior
      const topData = ctx.getImageData(0, 0, w, stripSize).data;
      this._sampled.top = this._averageColor(topData, w * stripSize);

      // Borde inferior
      const bottomData = ctx.getImageData(0, h - stripSize, w, stripSize).data;
      this._sampled.bottom = this._averageColor(bottomData, w * stripSize);

      // Borde izquierdo
      const leftData = ctx.getImageData(0, 0, stripSize, h).data;
      this._sampled.left = this._averageColor(leftData, stripSize * h);

      // Borde derecho
      const rightData = ctx.getImageData(w - stripSize, 0, stripSize, h).data;
      this._sampled.right = this._averageColor(rightData, stripSize * h);

      // Iniciar transición
      this._transitionProgress = 0;
    } catch {
      // Si getImageData falla (CORS, etc.), usar glow estático
      this._setStaticGlow();
      this._samplingDisabled = true;
    }
  }

  /**
   * Calcula el color promedio de un array RGBA.
   * Ignora píxeles completamente transparentes.
   *
   * @param {Uint8ClampedArray} data - Array RGBA plano
   * @param {number} pixelCount - Número de píxeles
   * @returns {string|null} Color CSS 'rgb(r, g, b)' o null si todos transparentes
   */
  _averageColor(data, pixelCount) {
    let r = 0, g = 0, b = 0, count = 0;

    for (let i = 0; i < pixelCount; i++) {
      const alpha = data[i * 4 + 3];
      if (alpha < 10) continue; // ignorar casi-transparentes

      r += data[i * 4];
      g += data[i * 4 + 1];
      b += data[i * 4 + 2];
      count++;
    }

    if (count === 0) return null;

    return `rgb(${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)})`;
  }

  /**
   * Interpola entre los colores muestreados y los actuales.
   */
  _interpolateGlow() {
    const t = this._transitionProgress;
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      if (this._sampled[edge] && this._current[edge]) {
        this._current[edge] = this._lerpColor(this._current[edge], this._sampled[edge], t);
      } else if (this._sampled[edge]) {
        this._current[edge] = this._sampled[edge];
      }
    }
  }

  /**
   * Interpola linealmente entre dos colores CSS rgb().
   */
  _lerpColor(from, to, t) {
    const fromRgb = this._parseRgb(from);
    const toRgb = this._parseRgb(to);
    if (!fromRgb || !toRgb) return to;

    const r = Math.round(fromRgb.r + (toRgb.r - fromRgb.r) * t);
    const g = Math.round(fromRgb.g + (toRgb.g - fromRgb.g) * t);
    const b = Math.round(fromRgb.b + (toRgb.b - fromRgb.b) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Parsea un color CSS 'rgb(r, g, b)' a { r, g, b }.
   * @param {string} color
   * @returns {{ r: number, g: number, b: number }|null}
   */
  _parseRgb(color) {
    if (!color) return null;
    const match = color.match(/rgb\((\d+), (\d+), (\d+)\)/);
    if (!match) return null;
    return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
  }

  /**
   * Convierte un color CSS a rgba con alpha.
   * @param {string} color - 'rgb(r, g, b)'
   * @param {number} alpha - 0..1
   * @returns {string}
   */
  _colorWithAlpha(color, alpha) {
    const rgb = this._parseRgb(color);
    if (!rgb) return `rgba(0, 0, 0, ${alpha})`;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  /**
   * Establece glow estático (colores oscuros) para cuando el muestreo
   * está desactivado.
   */
  _setStaticGlow() {
    const dark = 'rgb(10, 14, 26)';
    for (const edge of ['top', 'bottom', 'left', 'right']) {
      this._current[edge] = dark;
      this._sampled[edge] = dark;
    }
    this._transitionProgress = 1;
  }
}
