/**
 * InputManager
 * Abstrae teclado + ratón (y un mínimo de touch) para que los juegos no
 * toquen addEventListener directamente. Una instancia por partida activa;
 * se hace attach() al cargar el juego y detach() al destruirlo.
 */
export class InputManager {
  constructor() {
    this.keys = new Set();
    this.keysJustPressed = new Set();
    // -1,-1 como sentinel de "el ratón aún no se ha movido dentro del
    // canvas": 0,0 es una posición válida y no debe confundirse con eso
    // (los juegos que usan mouse.x/y como control comprueban >= 0).
    this.mouse = { x: -1, y: -1, down: false, clickedThisFrame: false };

    this._canvas = null;

    this._onKeyDown = (e) => {
      if (!this.keys.has(e.code)) this.keysJustPressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);

    this._onMouseMove = (e) => {
      const rect = this._canvas.getBoundingClientRect();
      const scaleX = this._canvas.width / rect.width;
      const scaleY = this._canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * scaleX;
      this.mouse.y = (e.clientY - rect.top) * scaleY;
    };
    this._onMouseDown = () => {
      this.mouse.down = true;
      this.mouse.clickedThisFrame = true;
    };
    this._onMouseUp = () => (this.mouse.down = false);

    // Touch mínimo: mapea el primer toque a las coordenadas del ratón.
    this._onTouchMove = (e) => {
      if (e.touches.length === 0) return;
      this._onMouseMove(e.touches[0]);
      e.preventDefault();
    };
    this._onTouchStart = (e) => {
      if (e.touches.length === 0) return;
      this._onMouseMove(e.touches[0]);
      this._onMouseDown();
      e.preventDefault();
    };
    this._onTouchEnd = () => this._onMouseUp();
  }

  attach(canvas) {
    this._canvas = canvas;
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this._onTouchEnd);
  }

  detach() {
    const canvas = this._canvas;
    if (!canvas) return;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    canvas.removeEventListener('mousemove', this._onMouseMove);
    canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    canvas.removeEventListener('touchstart', this._onTouchStart);
    canvas.removeEventListener('touchmove', this._onTouchMove);
    canvas.removeEventListener('touchend', this._onTouchEnd);
    this._canvas = null;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  wasPressed(code) {
    return this.keysJustPressed.has(code);
  }

  /** Llamar al final de cada frame (lo hace el juego, no el engine, a propósito). */
  endFrame() {
    this.keysJustPressed.clear();
    this.mouse.clickedThisFrame = false;
  }
}
