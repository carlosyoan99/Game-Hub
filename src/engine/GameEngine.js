import { InputManager } from './InputManager.js';
import { renderGamepadIndicator, createToastManager } from './GameUI.js';
import { t } from './i18n.js';
import { AspectRatioManager } from './AspectRatioManager.js';
import { CRTEffects } from './CRTEffects.js';
import { SettingsManager } from './SettingsManager.js';

/**
 * GameEngine
 * Bucle de juego genérico basado en requestAnimationFrame con delta time
 * en segundos y clamp para evitar "spiral of death" tras pausas largas
 * (cambio de pestaña, debugger, etc).
 *
 * Cada juego es una clase que implementa la "Game Interface":
 *   init(engine)        -> setup inicial, se llama una vez al cargar
 *   update(dt)           -> lógica, dt en segundos
 *   render(ctx)           -> dibujo sobre el contexto 2D
 *   handleResize(w, h)   -> opcional, se llama al redimensionar el canvas
 *   destroy()             -> opcional, limpieza de listeners/estado
 *
 * InputManager:
 *   El engine crea y gestiona un InputManager compartido. Los juegos
 *   acceden a él via this.engine.input — no deben crear el suyo propio.
 *   El attach se hace al cargar el juego y el detach al descargarlo.
 */
export class GameEngine {
  constructor(canvas, { maxDt = 0.25 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.running = false;
    this.lastTime = 0;
    this.maxDt = maxDt;
    this.currentGame = null;
    this.input = new InputManager();
    this.input.attach(this.canvas);

    // ── Aspect Ratio + CRT effects ────────────────────────────────
    this.aspectRatio = new AspectRatioManager(SettingsManager.aspectRatio);
    this.crtEffects = new CRTEffects();
    this._prevCrtEnabled = SettingsManager.crtEffect;

    // ── Toast notifications ────────────────────────────────────────
    this._toasts = createToastManager();

    // Mostrar toast al conectar/desconectar gamepad
    this._onToastGamepadConnected = (e) => {
      const name = e.gamepad.id.replace(/\s*\d+$/, '').trim() || t('gamepad.tooltip');
      this._toasts.addToast(t('gamepad.connected', { name }));
    };
    this._onToastGamepadDisconnected = () => {
      this._toasts.addToast(t('gamepad.disconnected'));
    };
    window.addEventListener('gamepadconnected', this._onToastGamepadConnected);
    window.addEventListener('gamepaddisconnected', this._onToastGamepadDisconnected);

    this._rafId = null;
    this._loop = this._loop.bind(this);
  }

  /** Libera recursos: remueve listeners de toast y detiene el loop. */
  destroy() {
    this.unloadGame();
    window.removeEventListener('gamepadconnected', this._onToastGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this._onToastGamepadDisconnected);
    this._onToastGamepadConnected = null;
    this._onToastGamepadDisconnected = null;
  }

  /** Carga un juego que implemente la Game Interface y arranca el loop. */
  loadGame(gameInstance) {
    this.stop();
    this.currentGame?.destroy?.();

    this.currentGame = gameInstance;
    this.currentGame.init(this);
    this.start();
  }

  unloadGame() {
    this.stop();
    this.currentGame?.destroy?.();
    this.currentGame = null;
    // InputManager se mantiene vivo y attached para el siguiente juego
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this._rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    this.running = false;
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.currentGame?.handleResize?.(width, height);

    // Recalcular dimensiones según proporción
    this.aspectRatio.getVisibleDimensions(width, height);
    this.aspectRatio.getBars(width, height);
  }

  /**
   * Establece la proporción de aspecto y redimensiona.
   * @param {'4:3'|'5:3'|'16:9'} key
   */
  setAspectRatio(key) {
    this.aspectRatio.setRatio(key);
    if (this.canvas) {
      this.resize(this.canvas.width, this.canvas.height);
    }
  }

  _loop(timestamp) {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, this.maxDt);
    this.lastTime = timestamp;

    if (this.currentGame) {
      // Refrescar estado del gamepad (navigator.getGamepads()) antes de update().
      this.input.poll();

      // ── 1. Renderizar juego al offscreen canvas interno ──────────
      const offCtx = this.aspectRatio.offscreenCtx;
      offCtx.clearRect(0, 0, this.aspectRatio.offscreenCanvas.width, this.aspectRatio.offscreenCanvas.height);
      this.currentGame.update(dt);
      this.currentGame.render(offCtx);

      // ── 2. Escalar offscreen → canvas visible ────────────────────
      const dims = { width: this.aspectRatio.visibleW, height: this.aspectRatio.visibleH };
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Fondo negro sólido
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      this.aspectRatio.drawToCanvas(this.ctx, offCtx, dims);

      // ── 3. Glow dinámico en barras CRT ───────────────────────────
      const reducedMotion = SettingsManager.reducedMotion;
      const crtEnabled = SettingsManager.crtEffect;
      // Sincronizar estado de muestreo si cambió
      if (crtEnabled !== this._prevCrtEnabled) {
        this.crtEffects.setSamplingDisabled(!crtEnabled);
        this._prevCrtEnabled = crtEnabled;
      }
      if (crtEnabled) {
        this.crtEffects.update(dt, offCtx, this.aspectRatio, reducedMotion);
        this.crtEffects.renderGlow(this.ctx, this.aspectRatio);
      }

      // ── 4. Gamepad indicator (sobre el canvas escalado, en coords visibles) ──
      renderGamepadIndicator(this.ctx, this.input, this.canvas.width,
        this.input.mouse.x, this.input.mouse.y);

      // ── 5. Toast notifications ───────────────────────────────────
      this._toasts.updateToasts(dt);
      this._toasts.renderToasts(this.ctx, this.canvas.width, this.canvas.height);

      // ── 6. Fin del frame ─────────────────────────────────────────
      this.input.endFrame();
    }

    this._rafId = requestAnimationFrame(this._loop);
  }
}
