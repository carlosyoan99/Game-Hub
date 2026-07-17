/**
 * Golden Axe — Sistema de combate y colisiones
 *
 * Extraído de GoldenAxe.js. Funciones para manejar
 * daño, magia, colisiones y muerte de entidades.
 */

import { aabbIntersects } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { spawnParticles } from '../../engine/ParticleSystem.js';
import { COMBO_WINDOW, MAX_COMBO, HITSTUN_DURATION } from './constants.js';
import { createPowerup, createComboParticle } from './entities.js';

const _rn = (rng) => rng ? rng.next() : Math.random();

/**
 * Ejecuta el ataque mágico de área alrededor del jugador
 * Modifica player, enemies, boss, particles in-place.
 * Devuelve { bossDefeated }
 */
export function doMagic(player, enemies, boss, particles) {
  const def = player.def;
  player.magic -= def.magicCost;
  const dmg = def.magicBase + Math.floor(player.magic * 0.5);
  player.magic = 0;

  const aoeBox = {
    x: player.x - 60, y: player.y - 30,
    width: player.width + 120, height: player.height + 60,
  };

  spawnParticles(particles, player.x + player.width / 2, player.y + 10, '#4a9eff', 20, { speed: 250, vyOffset: -30 });
  AudioManager.sfx({ type: 'explosion', volume: 0.5 });
  HapticManager.vibrate('explosion');

  let bossDefeated = false;

  // Damage all enemies in range
  for (const e of enemies) {
    if (!e.alive) continue;
    const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
    if (aabbIntersects(aoeBox, eBox)) {
      e.hp -= dmg;
      spawnParticlesAt(e, particles, '#4a9eff', 10);
      if (e.hp <= 0) {
        e.alive = false;
      }
    }
  }

  // Damage boss
  if (boss && boss.alive) {
    const bBox = { x: boss.x, y: boss.y, width: boss.width, height: boss.height };
    if (aabbIntersects(aoeBox, bBox)) {
      boss.hp -= Math.floor(dmg * 0.5);
      spawnParticlesAt(boss, particles, '#4a9eff', 15);
      if (boss.hp <= 0) {
        boss.alive = false;
        bossDefeated = true;
      }
    }
  }

  return { bossDefeated };
}

function spawnParticlesAt(entity, particles, color, count) {
  spawnParticles(particles, entity.x + entity.width / 2, entity.y + 10, color, count, { speed: 250, vyOffset: -30 });
}

/**
 * Revisa todas las colisiones entre entidades
 * Modifica el estado de player, enemies, boss, arrows, bossBullets, powerups, particles, comboParticles
 * Devuelve { scoreAdd, bossDefeated }
 */
export function checkCollisions(player, enemies, boss, arrows, bossBullets, powerups, particles, comboParticles, projectiles, rng) {
  if (player.dead || player.invincible > 0) {
    return { scoreAdd: 0, bossDefeated: false };
  }

  let scoreAdd = 0;
  let bossDefeated = false;
  const pBox = { x: player.x, y: player.y, width: player.width, height: player.height };

  // Player attack vs enemies
  if (player.attacking || player.specialing) {
    const atkRange = player.specialing ? player.def.specialRange : player.def.attackRange;
    let atkDmg = player.specialing ? player.def.specialDamage : player.def.attackDamage;
    if (player.berserkActive) atkDmg = Math.floor(atkDmg * 1.5);

    const atkBox = {
      x: player.facing > 0 ? player.x + player.width : player.x - atkRange,
      y: player.y,
      width: atkRange,
      height: player.height,
    };

    for (const e of enemies) {
      if (!e.alive) continue;
      const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
      if (aabbIntersects(atkBox, eBox)) {
        e.hp -= atkDmg;
        e.vx = player.facing * 200;
        spawnParticles(particles, e.x + e.width / 2, e.y + e.height / 2, '#ffb454', 6, { speed: 250 });
        HapticManager.vibrate('hit');

        player.comboTimer = COMBO_WINDOW;
        player.combo = Math.min(player.combo + 1, MAX_COMBO);
        if (player.combo >= 2) {
          comboParticles.push(createComboParticle(player.x, player.y - 20, `${player.combo}x!`));
        }

        if (e.hp <= 0) {
          e.alive = false;
          scoreAdd += e.score;
          spawnParticles(particles, e.x + e.width / 2, e.y + e.height / 2, '#ff6b4a', 12, { speed: 250 });
          // Drop chance
          if (_rn(rng) < 0.15) {
            const type = _rn(rng) < 0.6 ? 'potion' : 'hp';
            powerups.push(createPowerup(e.x, e.y, type));
          }
        }
        break;
      }
    }

    // Player attack vs boss
    if (boss && boss.alive && aabbIntersects(atkBox, boss)) {
      boss.hp -= atkDmg;
      spawnParticles(particles, boss.x + boss.width / 2, boss.y + 10, '#ffb454', 8, { speed: 250 });
      HapticManager.vibrate('hit');
      if (boss.hp <= 0) {
        boss.alive = false;
        bossDefeated = true;
      }
    }
  }

  // Enemies vs player
  if (player.hitstunTimer <= 0) {
    for (const e of enemies) {
      if (!e.alive || e.attackCooldown > 0) continue;
      const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
      if (aabbIntersects(pBox, eBox)) {
        playerHit(player, e.damage, particles);
        e.attackCooldown = 1.0;
        break;
      }
    }

    // Boss vs player
    if (boss && boss.alive && aabbIntersects(pBox, boss)) {
      playerHit(player, 12, particles);
    }
  }

  // Arrows vs player
  for (const a of arrows) {
    if (!a.alive) continue;
    const aBox = { x: a.x - 3, y: a.y - 3, width: 6, height: 6 };
    if (aabbIntersects(pBox, aBox)) {
      a.alive = false;
      playerHit(player, a.damage, particles);
      break;
    }
  }

  // Boss bullets vs player
  for (const b of bossBullets) {
    if (!b.alive) continue;
    const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
    if (aabbIntersects(pBox, bBox)) {
      b.alive = false;
      playerHit(player, 8, particles);
      break;
    }
  }

  // Player vs powerups
  for (const pu of powerups) {
    if (!pu.active) continue;
    const puBox = { x: pu.x, y: pu.y, width: pu.width, height: pu.height };
    if (aabbIntersects(pBox, puBox)) {
      pu.active = false;
      if (pu.type === 'potion') {
        player.magic = Math.min(player.maxMagic, player.magic + 20);
        AudioManager.sfx({ type: 'powerup', volume: 0.3 });
        spawnParticles(particles, pu.x + 8, pu.y + 8, '#4a9eff', 8, { speed: 250 });
      } else if (pu.type === 'hp') {
        player.hp = Math.min(player.maxHp, player.hp + 25);
        AudioManager.sfx({ type: 'powerup', volume: 0.3 });
        spawnParticles(particles, pu.x + 8, pu.y + 8, '#3a9a5a', 8, { speed: 250 });
      }
    }
  }

  return { scoreAdd, bossDefeated };
}

/**
 * Aplica daño al jugador, incluyendo invencibilidad y knockback
 */
function playerHit(player, damage, particles) {
  if (player.invincible > 0 || player.dead) return;
  player.hp -= damage;
  player.hitstunTimer = HITSTUN_DURATION;
  player.invincible = 1.0;
  player.combo = 0;
  AudioManager.sfx({ type: 'hit', volume: 0.3 });
  HapticManager.vibrate('hit');
  spawnParticles(particles, player.x + player.width / 2, player.y + 10, '#ff4d4d', 6, { speed: 250 });
}

/**
 * Maneja la muerte del jugador
 * Devuelve true si el jugador se queda sin vidas
 */
export function handlePlayerDeath(player, particles) {
  player.dead = true;
  player.lives--;
  player.respawnTimer = 2;
  AudioManager.sfx({ type: 'explosion', volume: 0.4 });
  HapticManager.vibrate('explosion');
  spawnParticles(particles, player.x + player.width / 2, player.y + 10, '#ff6b4a', 15, { speed: 250 });
  return player.lives <= 0;
}
