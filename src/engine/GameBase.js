/**
 * GameBase
 * Clase base para todos los juegos del GameHub Engine.
 *
 * Unifica el boilerplate común:
 *   - init(): this.engine, this.canvas, this.input, this.width, this.height
 *   - destroy(): vacío (el engine gestiona el ciclo de vida)
 *   - _handleRestartInput(): patrón won/lost → restart con Space/click
 *
 * Uso:
 *   import { GameBase } from '../../engine/GameBase.js';
 *
 *   export class MiJuego extends GameBase {
 *     init(engine) {
 *       super.init(engine, 'mi-juego');
 *       // setup específico del juego...
 *     }
 *   }
 */
import { StorageManager } from './StorageManager.js';
import { renderDefaultHUD, renderPauseOverlay } from './GameUI.js';

export class GameBase {
  /**
   * Inicializa referencias comunes del juego.
   * Llama a super.init(engine, storageKey) desde el init() de la subclase.
   * @param {object} engine  - Instancia de GameEngine.
   * @param {string} [storageKey]  - Clave opcional para StorageManager.
   */
  init(engine, storageKey) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = engine.input;
    this.width = this.canvas.width;
    this.height = this.canvas.height;

    if (storageKey) {
      this.storage = new StorageManager(storageKey);
    }
  }

  /**
   * Libera recursos. Vacío por defecto porque el engine gestiona
   * InputManager, AudioManager, etc. a nivel global.
   * Las subclases pueden sobrescribirlo si necesitan limpieza extra.
   */
  /**
   * Actualiza las dimensiones del canvas al redimensionar la ventana.
   * Las subclases con lógica adicional deben sobrescribirlo y llamar
   * a super.handleResize(width, height) al inicio.
   *
   * @param {number} width   - Nueva anchura del canvas
   * @param {number} height  - Nueva altura del canvas
   */
  handleResize(width, height) {
    this.width = width;
    this.height = height;
  }

  /**
   * Libera recursos. Vacío por defecto porque el engine gestiona
   * InputManager, AudioManager, etc. a nivel global.
   * Las subclases pueden sobrescribirlo si necesitan limpieza extra.
   */
  destroy() {
  }

  /**
   * Renderiza el HUD estándar del juego.
   * Delega en renderDefaultHUD de GameUI con this como estado.
   * Las subclases pueden sobrescribirlo o llamar super.renderHUD(ctx, opts).
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} [opts]  - Opciones para renderDefaultHUD
   */
  renderHUD(ctx, opts = {}) {
    renderDefaultHUD(ctx, this, opts);
  }

  /**
   * Renderiza el overlay de pausa.
   * Delega en renderPauseOverlay de GameUI.
   * Las subclases pueden sobrescribirlo o llamar
   * super.renderPauseOverlay(ctx, opts) para personalizar.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} [opts]  - Opciones para renderPauseOverlay
   */
  renderPauseOverlay(ctx, opts = {}) {
    renderPauseOverlay(ctx, { width: this.width, height: this.height, ...opts });
  }

  /**
   * Maneja la entrada de reinicio cuando el juego terminó (won/lost).
   * Patrón común: si el status es 'won' o 'lost', espera Space o click
   * para llamar a this._restart().
   *
   * @param {string[]} [endStatuses]  - Statuses considerados "finales".
   *   Por defecto ['won', 'lost'].
   * @returns {boolean}  true si se manejó (y se consumió el frame).
   */
  handleRestartInput(endStatuses = ['won', 'lost']) {
    if (endStatuses.includes(this.status) || endStatuses.includes(this.phase)) {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }
      this.input.endFrame();
      return true;
    }
    return false;
  }
}
