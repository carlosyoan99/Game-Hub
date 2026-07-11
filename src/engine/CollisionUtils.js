/**
 * CollisionUtils
 * Funciones puras de detección de colisiones. Se usan tanto en Nivel 1
 * (Pong/Breakout/Asteroids) como en niveles posteriores (plataformas,
 * torres). Todo recibe/devuelve objetos planos, sin clases, para que
 * sean fáciles de testear.
 */

/** rect = {x, y, width, height} (x,y = esquina superior izquierda) */
export function aabbIntersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/** circle = {x, y, radius} (x,y = centro) */
export function circleIntersects(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distSq = dx * dx + dy * dy;
  const radiusSum = a.radius + b.radius;
  return distSq <= radiusSum * radiusSum;
}

/** Colisión círculo contra rectángulo (útil para pelota vs. paleta/ladrillo). */
export function circleIntersectsAABB(circle, rect) {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

/** Punto dentro de un rectángulo (útil para clicks en UI/menús de juego). */
export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
