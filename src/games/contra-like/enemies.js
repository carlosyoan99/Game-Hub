/**
 * Contra-like — Enemigos, jefes y partículas
 *
 * Extraído de ContraLike.js. Contiene las fábricas de enemigos,
 * su IA, sistema de jefes, power-ups y partículas.
 */
import { TILE, GRAVITY, MAX_FALL, BOSS_SCROLL_X } from './levels.js';
import { spawnParticles } from '../../engine/ParticleSystem.js';

/**
 * Crea un enemigo según su tipo
 */
export function createEnemy(type, atX, wy) {
  switch (type) {
    case 'soldier':
      return {
        x: atX, y: wy,
        width: 22, height: 26,
        vx: -60 - Math.random() * 30,
        vy: 0,
        hp: 2, maxHp: 2,
        alive: true, type: 'soldier',
        fireTimer: 1 + Math.random(),
        onGround: false,
        color: '#6b8e3a',
      };
    case 'runner':
      return {
        x: atX, y: wy,
        width: 20, height: 24,
        vx: -120 - Math.random() * 40,
        vy: 0,
        hp: 1, maxHp: 1,
        alive: true, type: 'runner',
        fireTimer: 0,
        onGround: false,
        color: '#c84848',
      };
    case 'turret':
      return {
        x: atX, y: wy - 24,
        width: 24, height: 24,
        vx: 0, vy: 0,
        hp: 4, maxHp: 4,
        alive: true, type: 'turret',
        fireTimer: 1.5,
        onGround: true,
        color: '#7c5c7c',
      };
    default:
      return null;
  }
}

/**
 * Actualiza un enemigo: gravedad, movimiento, disparo
 * Devuelve un array de nuevas balas enemigas
 */
export function updateEnemy(enemy, dt, player, tilemap, scrollX, width) {
  if (!enemy.alive) return [];

  // Gravity
  enemy.vy = Math.min(enemy.vy + GRAVITY * dt, MAX_FALL);
  enemy.x += enemy.vx * dt;
  tilemap.resolveAABB(enemy, enemy.vx, 0, dt);
  enemy.y += enemy.vy * dt;
  const yResult = tilemap.resolveAABB(enemy, 0, enemy.vy, dt);
  if (yResult.onGround || yResult.onCeiling) enemy.vy = 0;
  enemy.onGround = yResult.onGround;

  // Clamp to playable area
  if (enemy.x < scrollX - 60 || enemy.x > scrollX + width + 60) {
    enemy.alive = false;
    return [];
  }

  // Turret or soldier shooting
  const newBullets = [];
  if (enemy.type === 'turret' || enemy.type === 'soldier') {
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0) {
      enemy.fireTimer = enemy.type === 'turret' ? 1.5 : 1 + Math.random() * 1.5;
      newBullets.push({
        x: enemy.x + enemy.width / 2,
        y: enemy.y + enemy.height / 2,
        vx: (player.x - enemy.x) / Math.abs(player.x - enemy.x || 1) * 150,
        vy: 80,
        radius: 3,
        alive: true,
        color: '#ff4d4d',
      });
    }
  }

  return newBullets;
}

/**
 * Crea el jefe para el nivel actual
 */
export function createBoss(stageConfig) {
  return {
    x: BOSS_SCROLL_X + 200, y: TILE * 10,
    width: 60, height: 48,
    hp: stageConfig.hp, maxHp: stageConfig.hp,
    alive: true,
    type: stageConfig.type,
    pattern: stageConfig.pattern,
    dir: -1,
    speed: 60,
    fireTimer: 1.5,
    phase: 1,
  };
}

/**
 * Actualiza el jefe: movimiento y patrones de ataque
 * Devuelve un array de nuevas balas del jefe
 */
export function updateBoss(boss, dt, player) {
  if (!boss || !boss.alive) return [];

  // Movement pattern
  boss.x += boss.speed * boss.dir * dt;
  if (boss.x < BOSS_SCROLL_X + 100) { boss.dir = 1; }
  if (boss.x > BOSS_SCROLL_X + 400) { boss.dir = -1; }

  // Y movement
  boss.y += Math.sin(Date.now() * 0.003) * 30 * dt;

  // Boss attacks
  boss.fireTimer -= dt;
  const newBullets = [];
  if (boss.fireTimer <= 0) {
    boss.fireTimer = boss.hp < boss.maxHp / 2 ? 0.8 : 1.2;

    switch (boss.pattern) {
      case 'spread':
        for (let i = 0; i < 5; i++) {
          const angle = -Math.PI / 2 + (i - 2) * 0.35;
          newBullets.push({
            x: boss.x + boss.width / 2,
            y: boss.y + boss.height,
            vx: Math.cos(angle) * 180,
            vy: Math.sin(angle) * 180,
            radius: 4, alive: true, color: '#ff4d4d',
          });
        }
        break;
      case 'targeted':
        for (let i = 0; i < 3; i++) {
          const dx = player.x - boss.x;
          const dy = player.y - boss.y;
          const dist = Math.hypot(dx, dy) || 1;
          newBullets.push({
            x: boss.x + boss.width / 2 + (i - 1) * 10,
            y: boss.y + boss.height,
            vx: (dx / dist) * 200 + (i - 1) * 30,
            vy: (dy / dist) * 200,
            radius: 4, alive: true, color: '#ff6b4a',
          });
        }
        break;
      case 'spiral':
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2 + Date.now() * 0.005;
          newBullets.push({
            x: boss.x + boss.width / 2,
            y: boss.y + boss.height / 2,
            vx: Math.cos(angle) * 150,
            vy: Math.sin(angle) * 150,
            radius: 4, alive: true, color: '#ffb454',
          });
        }
        break;
    }
  }

  return newBullets;
}

/**
 * Actualiza las balas del jefe: movimiento y límites
 */
export function updateBossBullets(bossBullets, dt, tilemap, scrollX, width) {
  for (const b of bossBullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > tilemap.pixelHeight + 20 || b.x < scrollX - 20 || b.x > scrollX + width + 20) {
      b.alive = false;
    }
  }
  return bossBullets.filter(b => b.alive);
}

/**
 * Crea un power-up de arma
 */
export function createPowerup(x, y) {
  const weapons = ['SPREAD', 'MACHINE', 'LASER', 'FIRE'];
  return {
    x, y,
    width: 16, height: 16,
    vy: -100,
    weapon: weapons[Math.floor(Math.random() * weapons.length)],
    active: true,
    color: '#ffd700',
  };
}

/**
 * Actualiza los power-ups: gravedad, colisión con tiles
 */
export function updatePowerups(powerups, dt, tilemap) {
  for (const pu of powerups) {
    if (!pu.active) continue;
    pu.y += pu.vy * dt;
    pu.vy += 400 * dt;
    const col = Math.floor((pu.x + pu.width / 2) / TILE);
    const row = Math.floor((pu.y + pu.height) / TILE);
    if (tilemap.isSolidTile(tilemap.tileAt(col, row))) {
      pu.vy = 0;
    }
    if (pu.y > tilemap.pixelHeight) pu.active = false;
  }
  return powerups.filter(p => p.active);
}


