/**
 * Space Harrier — Enemigos, jefe, proyectiles, partículas y colisiones
 */
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { spawnParticles } from '../../engine/ParticleSystem.js';
import { ENEMY_TYPES, PLAYER_MARGIN, Z_FAR, Z_NEAR, BULLET_SPEED, STAGES_COUNT } from './constants.js';
import { projectZ } from './render.js';

const _rn = rng => rng ? rng.next() : Math.random();

/**
 * Crea un enemigo en una posición Z dada
 */
export function spawnEnemy(state, z) {
  const rng = state.rng;
  const types = Object.keys(ENEMY_TYPES);
  const typeKey = types[Math.floor(_rn(rng) * types.length)];
  const type = ENEMY_TYPES[typeKey];
  const x = PLAYER_MARGIN + _rn(rng) * (state.width - PLAYER_MARGIN * 2);
  const xMove = (_rn(rng) - 0.5) * 60;

  return {
    x, z,
    worldX: x,
    vx: xMove,
    vz: -type.speedZ,
    width: type.w, height: type.h,
    hp: type.hp, maxHp: type.hp,
    damage: type.damage,
    score: type.score,
    color: type.color,
    type: typeKey,
    alive: true,
    fireTimer: typeKey === 'turret' ? 2 + _rn(rng) : 0,
    scale: 1,
  };
}

/**
 * Actualiza todos los enemigos: movimiento, disparo, límites
 */
export function updateEnemies(enemies, dt, enemyBullets) {
  for (const e of enemies) {
    if (!e.alive) continue;

    e.z += e.vz * dt;
    e.worldX += e.vx * dt;

    if (e.z < Z_NEAR) {
      e.alive = false;
      continue;
    }
    if (e.z > Z_FAR + 100) {
      e.alive = false;
      continue;
    }

    if (e.type === 'turret' && e.z < Z_FAR * 0.5) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = 1.5 + _rn();
        enemyBullets.push({
          x: e.worldX, z: e.z,
          vx: 0, vz: -200,
          radius: 4,
          alive: true,
        });
      }
    }
  }
}

/**
 * Dispara una bala del jugador
 */
export function fireBullet(state, player, bullets) {
  const bx = player.x + player.width / 2;
  const by = player.y;
  AudioManager.sfx({ type: 'shoot', volume: 0.1 });

  const count = 1 + Math.floor(player.power / 2);
  for (let i = 0; i < count; i++) {
    const spread = (i - (count - 1) / 2) * 0.08;
    bullets.push({
      x: bx, y: by,
      vx: Math.sin(spread) * BULLET_SPEED * 0.3,
      vy: -BULLET_SPEED * Math.cos(spread),
      radius: 3,
      damage: 1 + Math.floor(player.power / 3),
      life: 2,
      color: player.power >= 4 ? '#ff6b4a' : player.power >= 2 ? '#4a9eff' : '#ffd700',
    });
  }
}

/**
 * Ataque de carga: daña enemigos en columna frontal
 */
export function fireChargeAttack(state, player, enemies, particles) {
  AudioManager.sfx({ type: 'explosion', volume: 0.4 });

  for (const e of enemies) {
    if (!e.alive) continue;
    const proj = projectZ(e.z);
    const sx = e.worldX * proj.scale + (state.width / 2 - state.width / 2 * proj.scale);
    if (Math.abs(sx - (player.x + player.width / 2)) < 80) {
      e.hp -= 5;
      spawnParticles(particles, sx, proj.y, '#ffd700', 6);
      if (e.hp <= 0) {
        e.alive = false;
        state.score += e.score * 2;
        state.stageScore += e.score * 2;
        spawnParticles(particles, sx, proj.y, '#ff6b4a', 10);
      }
    }
  }
}

/**
 * Actualiza balas del jugador
 */
export function updateBullets(bullets, dt) {
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  return bullets.filter(b => b.life > 0 && b.y > -20);
}

/**
 * Actualiza balas enemigas (3D)
 */
export function updateEnemyBullets(bullets, dt) {
  for (const b of bullets) {
    b.z += b.vz * dt;
  }
  return bullets.filter(b => b.z >= Z_NEAR && b.z <= Z_FAR);
}

/**
 * Actualiza power-ups
 */
export function updatePowerups(powerups, dt) {
  for (const pu of powerups) {
    if (!pu.active) continue;
    pu.z += pu.vz * dt;
    pu.y += Math.sin(Date.now() * 0.006 + pu.x) * 20 * dt;
  }
  return powerups.filter(p => p.active && p.z >= Z_NEAR);
}

/**
 * Crea el jefe del nivel
 */
export function createBoss(state) {
  return {
    z: Z_FAR * 0.6,
    worldX: state.width / 2,
    stateWidth: state.width,
    hp: state.stageConfig.bossHp,
    maxHp: state.stageConfig.bossHp,
    alive: true,
    dir: 1,
    speed: 60,
    fireTimer: 1.5,
    width: 64, height: 48,
  };
}

/**
 * Actualiza el jefe: movimiento, patrón de disparo
 */
export function updateBoss(boss, dt, bossBullets) {
  if (!boss || !boss.alive) return [];

  boss.worldX += boss.speed * boss.dir * dt;
  if (boss.worldX < 60 || boss.worldX > boss.stateWidth - 60) boss.dir *= -1;

  const bobY = Math.sin(Date.now() * 0.003) * 20;

  boss.fireTimer -= dt;
  if (boss.fireTimer <= 0) {
    boss.fireTimer = boss.hp < boss.maxHp / 2 ? 0.8 : 1.2;
    const count = boss.hp < boss.maxHp / 2 ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const angle = Math.PI - Math.PI * 0.3 + (i / (count - 1)) * Math.PI * 0.6;
      bossBullets.push({
        x: boss.worldX, z: boss.z,
        vx: Math.cos(angle) * 150,
        vz: Math.sin(angle) * -150,
        radius: 5,
        alive: true,
      });
    }
    AudioManager.sfx({ type: 'shoot', volume: 0.3 });
  }

  for (const b of bossBullets) {
    b.z += b.vz * dt;
    b.x += b.vx * dt;
    if (b.z < Z_NEAR || b.z > Z_FAR || b.x < -50 || b.x > boss.stateWidth + 50) b.alive = false;
  }
  return bobY;
}

/**
 * Comprueba todas las colisiones
 */
export function checkCollisions(state) {
  const { player, enemies, bullets, enemyBullets, boss, bossBullets, powerups, particles, width } = state;
  const pProj = { x: player.x, y: player.y, width: player.width, height: player.height };

  for (const b of bullets) {
    const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };

    for (const e of enemies) {
      if (!e.alive) continue;
      const proj = projectZ(e.z);
      const scale = proj.scale;
      const sw = e.width * scale;
      const sh = e.height * scale;
      const sx = e.worldX * scale + (width / 2 - width / 2 * scale) - sw / 2;
      const sy = proj.y - sh;
      const eBox = { x: sx, y: sy, width: sw, height: sh };

      if (bBox.x < eBox.x + eBox.width && bBox.x + bBox.width > eBox.x &&
          bBox.y < eBox.y + eBox.height && bBox.y + bBox.height > eBox.y) {
        b.life = 0;
        e.hp -= b.damage;
        spawnParticles(particles, sx + sw / 2, sy + sh / 2, '#ffb454', 4);
        if (e.hp <= 0) {
          e.alive = false;
          state.score += e.score;
          state.stageScore += e.score;
          spawnParticles(particles, sx + sw / 2, sy + sh / 2, '#ff6b4a', 8);
          if (_rn(state.rng) < 0.15) {
            powerups.push({
              x: e.worldX, z: e.z,
              vz: -50,
              type: 'power',
              active: true,
              scale: 1,
            });
          }
        }
        break;
      }
    }

    if (boss && boss.alive) {
      const bp = projectZ(boss.z);
      const bsw = boss.width * bp.scale;
      const bsh = boss.height * bp.scale;
      const bsx = boss.worldX - bsw / 2;
      const bsy = bp.y - bsh;
      const bBox2 = { x: bsx, y: bsy, width: bsw, height: bsh };
      if (bBox.x < bBox2.x + bBox2.width && bBox.x + bBox.width > bBox2.x &&
          bBox.y < bBox2.y + bBox2.height && bBox.y + bBox.height > bBox2.y) {
        b.life = 0;
        boss.hp -= b.damage;
        spawnParticles(particles, bsx + bsw / 2, bsy + bsh / 2, '#ffb454', 6);
        if (boss.hp <= 0) {
          boss.alive = false;
          state.bossDefeatedThisStage = true;
          state.score += 2000;
          state.stageScore += 2000;
          spawnParticles(particles, bsx + bsw / 2, bsy + bsh / 2, '#ffd700', 30);
          AudioManager.sfx({ type: 'explosion', volume: 0.6 });
          HapticManager.vibrate('explosion');
          if (state.currentStage >= STAGES_COUNT) {
            state._endGame(true);
          } else {
            state._clearStage();
          }
        }
      }
    }
  }

  if (player.invincible <= 0) {
    for (const b of enemyBullets) {
      const bp = projectZ(b.z);
      const bs = bp.scale * 10;
      const bsy = bp.y;
      const bx = b.x * bp.scale + (width / 2 - width / 2 * bp.scale);
      const bBox = { x: bx - bs, y: bsy - bs, width: bs * 2, height: bs * 2 };
      if (bBox.x < pProj.x + pProj.width && bBox.x + bBox.width > pProj.x &&
          bBox.y < pProj.y + pProj.height && bBox.y + bBox.height > pProj.y) {
        b.alive = false;
        playerHit(state);
        break;
      }
    }

    for (const b of bossBullets) {
      if (!b.alive) continue;
      const bp = projectZ(b.z);
      const bs = bp.scale * 10;
      const bsy = bp.y;
      const bx = b.x;
      const bBox = { x: bx - bs, y: bsy - bs, width: bs * 2, height: bs * 2 };
      if (bBox.x < pProj.x + pProj.width && bBox.x + bBox.width > pProj.x &&
          bBox.y < pProj.y + pProj.height && bBox.y + bBox.height > pProj.y) {
        b.alive = false;
        playerHit(state);
        break;
      }
    }

    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.z < Z_NEAR + 60) {
        playerHit(state);
        e.alive = false;
        break;
      }
    }

    if (boss && boss.alive && boss.z < Z_NEAR + 80) {
      playerHit(state);
    }
  }

  for (const pu of powerups) {
    if (!pu.active) continue;
    if (pu.z < Z_NEAR + 30) {
      pu.active = false;
      player.power = Math.min(player.power + 1, player.maxPower);
      spawnParticles(particles, player.x + player.width / 2, player.y, '#4a9eff', 8);
      AudioManager.sfx({ type: 'powerup', volume: 0.4 });
      HapticManager.vibrate('powerup');
    }
  }
}

/**
 * Daña al jugador
 */
export function playerHit(state) {
  const { player, particles } = state;
  if (player.invincible > 0) return;
  player.lives--;
  player.invincible = 2;
  player.power = Math.max(0, player.power - 1);
  spawnParticles(particles, player.x + player.width / 2, player.y + player.height / 2, '#ff4d4d', 10);
  AudioManager.sfx({ type: 'hit', volume: 0.4 });
  HapticManager.vibrate('hit');
  if (player.lives <= 0) state._endGame(false);
}


