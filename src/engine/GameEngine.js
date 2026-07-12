import { InputManager } from './InputManager.js';

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

    this._rafId = null;
    this._loop = this._loop.bind(this);
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
  }

  _loop(timestamp) {
    if (!this.running) return;

    const dt = Math.min((timestamp - this.lastTime) / 1000, this.maxDt);
    this.lastTime = timestamp;

    if (this.currentGame) {
      this.currentGame.update(dt);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.currentGame.render(this.ctx);
    }

    this._rafId = requestAnimationFrame(this._loop);
  }
}
