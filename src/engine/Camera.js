import { clamp } from './CollisionUtils.js';

/**
 * Camera
 * Cámara 2D de scroll: centra al objetivo (normalmente el jugador) en el
 * viewport, con clamp para no mostrar fuera de los límites del mundo.
 * No dibuja nada por sí misma: el juego hace ctx.save() / camera.apply(ctx)
 * / dibuja en coordenadas de mundo / ctx.restore().
 */
export class Camera {
  constructor(viewWidth, viewHeight) {
    this.x = 0;
    this.y = 0;
    this.width = viewWidth;
    this.height = viewHeight;
  }

  resize(viewWidth, viewHeight) {
    this.width = viewWidth;
    this.height = viewHeight;
  }

  follow(target, worldWidth, worldHeight) {
    const desiredX = target.x + (target.width ?? 0) / 2 - this.width / 2;
    const desiredY = target.y + (target.height ?? 0) / 2 - this.height / 2;

    this.x = clamp(desiredX, 0, Math.max(0, worldWidth - this.width));
    this.y = clamp(desiredY, 0, Math.max(0, worldHeight - this.height));
  }

  /** Traslada el contexto para que dibujar en coords de mundo caiga en el sitio correcto. */
  apply(ctx) {
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
  }
}
