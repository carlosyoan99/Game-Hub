/**
 * AspectRatioManager
 * Gestiona la proporción de aspecto del canvas, el offscreen canvas interno
 * (siempre 900×540), y el escalado visible. Soporta 4:3, 5:3 y 16:9.
 *
 * Los juegos dibujan siempre sobre un offscreen canvas de 900×540.
 * El AspectRatioManager calcula las dimensiones visibles según la
 * proporción seleccionada y escala el offscreen canvas al destino,
 * añadiendo barras glow donde sea necesario.
 *
 * Uso:
 *   import { AspectRatioManager } from './AspectRatioManager.js';
 *
 *   const arm = new AspectRatioManager();
 *   arm.setRatio('4:3');
 *   const dims = arm.getVisibleDimensions(viewportW, viewportH);
 *   arm.resizeOffscreen(900, 540);
 *   // ... game.render(arm.offscreenCtx) ...
 *   arm.drawToCanvas(destCtx, offscreenCtx, dims);
 *   arm.setGlowColors({ top, bottom, left, right });
 */

// Proporciones soportadas: ratio → { label, internalW, internalH }
const RATIOS = {
  '4:3':  { label: '4:3',  internalW: 900, internalH: 675 },
  '5:3':  { label: '5:3',  internalW: 900, internalH: 540 },
  '16:9': { label: '16:9', internalW: 960, internalH: 540 },
};

// Resolución interna de dibujo (todos los juegos dibujan a esta resolución)
const INTERNAL_W = 900;
const INTERNAL_H = 540;

export class AspectRatioManager {
  constructor(ratioKey = '5:3') {
    /** @type {'4:3'|'5:3'|'16:9'} */
    this._ratioKey = RATIOS[ratioKey] ? ratioKey : '5:3';

    /** Offscreen canvas interno — los juegos dibujan aquí */
    this.offscreenCanvas = null;
    this.offscreenCtx = null;

    /** Dimensiones calculadas del viewport visible */
    this.visibleW = 900;
    this.visibleH = 540;

    /** Offset de las barras (izquierda, superior) */
    this.barLeft = 0;
    this.barTop = 0;
    this.barRight = 0;
    this.barBottom = 0;

    // Inicializar offscreen canvas
    this._ensureOffscreen();
  }

  /** @returns {'4:3'|'5:3'|'16:9'} */
  get ratioKey() { return this._ratioKey; }

  /**
   * Cambia la proporción de aspecto. NO reinicia el juego — solo
   * recalcula las dimensiones visibles.
   * @param {'4:3'|'5:3'|'16:9'} key
   */
  setRatio(key) {
    if (!RATIOS[key]) return;
    this._ratioKey = key;
  }

  /** Devuelve el objeto de la proporción actual. */
  get currentRatio() {
    return RATIOS[this._ratioKey];
  }

  /**
   * Calcula las dimensiones visibles para un viewport dado.
   * Escala la proporción actual para que quepa dentro del viewport.
   *
   * @param {number} viewportW  - Ancho disponible en píxeles
   * @param {number} viewportH  - Alto disponible en píxeles
   * @returns {{ width: number, height: number }}
   */
  getVisibleDimensions(viewportW, viewportH) {
    const ratio = this.currentRatio;
    const targetRatio = ratio.internalW / ratio.internalH;

    let w = viewportW;
    let h = Math.round(w / targetRatio);

    if (h > viewportH) {
      h = viewportH;
      w = Math.round(h * targetRatio);
    }

    this.visibleW = w;
    this.visibleH = h;
    return { width: w, height: h };
  }

  /**
   * Devuelve las dimensiones de las barras glow para la proporción actual.
   * @returns {{ left: number, top: number, right: number, bottom: number }}
   */
  getBars(viewportW, viewportH) {
    const dims = this.getVisibleDimensions(viewportW, viewportH);
    this.barLeft = Math.max(0, Math.floor((viewportW - dims.width) / 2));
    this.barTop = Math.max(0, Math.floor((viewportH - dims.height) / 2));
    this.barRight = Math.max(0, viewportW - dims.width - this.barLeft);
    this.barBottom = Math.max(0, viewportH - dims.height - this.barTop);
    return {
      left: this.barLeft,
      top: this.barTop,
      right: this.barRight,
      bottom: this.barBottom,
    };
  }

  /**
   * Dibuja el offscreen canvas escalado al canvas visible.
   *
   * @param {CanvasRenderingContext2D} destCtx - Contexto del canvas visible
   * @param {CanvasRenderingContext2D} srcCtx  - Contexto del offscreen canvas
   * @param {{ width: number, height: number }} dims - Dimensiones visibles
   */
  drawToCanvas(destCtx, srcCtx, dims) {
    if (!dims) dims = { width: this.visibleW, height: this.visibleH };

    // Limpiar canvas visible
    destCtx.fillStyle = '#000000';
    destCtx.fillRect(0, 0, destCtx.canvas.width, destCtx.canvas.height);

    // Dibujar offscreen escalado centrado
    const offsetX = Math.max(0, Math.floor((destCtx.canvas.width - dims.width) / 2));
    const offsetY = Math.max(0, Math.floor((destCtx.canvas.height - dims.height) / 2));

    // imageSmoothingEnabled = false para pixel-art nítido
    destCtx.imageSmoothingEnabled = false;
    destCtx.drawImage(
      srcCtx.canvas,
      offsetX, offsetY, dims.width, dims.height
    );
  }

  /**
   * Asegura que el offscreen canvas existe con las dimensiones internas.
   */
  _ensureOffscreen() {
    const needsCreate = !this.offscreenCanvas ||
      this.offscreenCanvas.width !== INTERNAL_W ||
      this.offscreenCanvas.height !== INTERNAL_H;

    if (needsCreate) {
      // Intentar OffscreenCanvas API (Chrome/Edge) con fallback a canvas oculto
      if (typeof OffscreenCanvas !== 'undefined') {
        this.offscreenCanvas = new OffscreenCanvas(INTERNAL_W, INTERNAL_H);
      } else {
        const canvas = document.createElement('canvas');
        canvas.width = INTERNAL_W;
        canvas.height = INTERNAL_H;
        canvas.style.display = 'none';
        this.offscreenCanvas = canvas;
      }
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    }
  }

  /**
   * Redimensiona el offscreen canvas (se llama si cambia la resolución interna).
   * @param {number} w
   * @param {number} h
   */
  resizeOffscreen(w = INTERNAL_W, h = INTERNAL_H) {
    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = w;
      this.offscreenCanvas.height = h;
    }
  }

  /**
   * Libera recursos.
   */
  destroy() {
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
  }
}
