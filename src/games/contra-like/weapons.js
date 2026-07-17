/**
 * Contra-like — Armas y creación de proyectiles
 *
 * Extraído de ContraLike.js. Contiene las definiciones de armas,
 * la lista de armas para ciclar, y la fábrica de balas.
 */
export const MOVE_SPEED = 180;
export const JUMP_VEL = -400;

export const WEAPONS = {
  DEFAULT: { name: 'DEFAULT', fireRate: 0.2, damage: 1, spread: 0, speed: 500, color: '#f0e6b3' },
  SPREAD:  { name: 'SPREAD',  fireRate: 0.25, damage: 1, spread: 3, speed: 450, color: '#ff6b4a' },
  MACHINE: { name: 'MACHINE', fireRate: 0.08, damage: 1, spread: 0, speed: 550, color: '#4a9eff' },
  LASER:   { name: 'LASER',   fireRate: 0.15, damage: 2, spread: 0, speed: 700, color: '#ff4d4d' },
  FIRE:    { name: 'FIRE',    fireRate: 0.3,  damage: 3, spread: 1, speed: 400, color: '#ffb454' },
};

export const WEAPON_LIST = ['DEFAULT', 'SPREAD', 'MACHINE', 'LASER', 'FIRE'];
export const DROP_WEAPONS = ['SPREAD', 'MACHINE', 'LASER', 'FIRE'];

/**
 * Crea una o varias balas según el arma del jugador
 */
export function createBullets(player, weaponName, facing) {
  const w = WEAPONS[weaponName];
  if (!w) return [];

  const bx = player.x + (facing > 0 ? player.width : 0);
  const by = player.y + 12;
  const bullets = [];

  if (w.spread > 0) {
    for (let i = 0; i <= w.spread; i++) {
      const angle = (i / w.spread - 0.5) * 0.4;
      bullets.push({
        x: bx, y: by,
        vx: Math.cos(angle) * w.speed * facing,
        vy: Math.sin(angle) * w.speed,
        damage: w.damage, radius: 3,
        color: w.color, life: 1.5, alive: true,
      });
    }
  } else {
    bullets.push({
      x: bx, y: by,
      vx: w.speed * facing,
      vy: 0,
      damage: w.damage, radius: 3,
      color: w.color, life: 1.5, alive: true,
    });
  }

  return bullets;
}
