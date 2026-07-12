/**
 * Asteroids — Constantes de configuración y balance
 */
export const MAX_WAVE = 10;
export const SHIP_RADIUS = 12;
export const SHIP_TURN_SPEED = Math.PI * 1.6; // rad/s
export const SHIP_THRUST = 220; // px/s^2
export const SHIP_FRICTION = 0.6; // amortiguación exponencial por segundo
export const SHIP_MAX_SPEED = 340;
export const RESPAWN_INVULNERABILITY = 2; // segundos

export const BULLET_SPEED = 480;
export const BULLET_LIFETIME = 0.9;
export const FIRE_COOLDOWN = 0.25;

export const ASTEROID_SPECS = {
  large: { radius: 38, speed: 45, splitsInto: 'medium', splitCount: 2, score: 20 },
  medium: { radius: 22, speed: 75, splitsInto: 'small', splitCount: 2, score: 50 },
  small: { radius: 12, speed: 120, splitsInto: null, splitCount: 0, score: 100 },
};

/**
 * Genera un contorno irregular (0.7-1.2x el radio por vértice)
 * para que los asteroides no sean círculos perfectos.
 */
export function generateAsteroidShape(rng = null) {
  const shape = [];
  const rand = rng || { next: () => Math.random() };
  for (let i = 0; i < (rng ? 8 + rng.nextInt(0, 4) : 10); i++) {
    shape.push(0.7 + rand.next() * 0.5);
  }
  return shape;
}
