/**
 * Metroid-like — IA de enemigos y jefes
 *
 * Extraído de MetroidLike.js. Maneja el comportamiento de
 * 5 tipos de enemigos, 3 jefes y sus proyectiles.
 */

import { GRAVITY, ROOM_W, ROOM_H } from './constants.js';
import { createBossBullet } from './entities.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';

/**
 * Actualiza todos los enemigos según su tipo
 */
export function updateEnemies(enemies, player, dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    switch (e.type) {
      case 'zoomer':
        e.x += e.vx * dt;
        if (e.x < 0 || e.x > ROOM_W - e.width) e.vx *= -1;
        break;
      case 'rinka':
        e.timer += dt;
        e.x += Math.cos(e.timer * 1.5) * e.vx * dt;
        e.y += Math.sin(e.timer * 2) * e.vy * dt;
        if (e.x < 20 || e.x > ROOM_W - 20) e.vx *= -1;
        if (e.y < 20 || e.y > ROOM_H - 20) e.vy *= -1;
        break;
      case 'reo':
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          const chaseSpeed = 60;
          e.x += (dx / dist) * chaseSpeed * dt;
          e.y += (dy / dist) * chaseSpeed * dt;
        }
        break;
      case 'zebbo':
        e.timer -= dt;
        if (e.timer <= 0) {
          e.timer = 3;
          return { newBullets: [{ x: e.x + e.width / 2, y: e.y + e.height, vx: (player.x - e.x) * 0.3, vy: 100, radius: 4, alive: true, damage: 1 }] };
        }
        break;
    }
  }
  return { newBullets: [] };
}

/**
 * Actualiza los misiles del jugador (colisiones con tiles)
 */
export function updateBullets(bullets, tilemap, T, particles, dt) {
  let scoreAdd = 0;
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.life -= dt;
    const col = Math.floor((b.x + b.radius) / 32);
    const row = Math.floor((b.y + b.radius) / 32);
    const tile = tilemap.tileAt(col, row);
    if (tilemap.isSolidTile(tile)) {
      if (tile === T.MISSILE_DOOR) {
        tilemap.data[row][col] = T.EMPTY;
        particles.emitBurst(col * 32 + 16, row * 32 + 16, '#6a4a8a', 12);
        AudioManager.sfx({ type: 'explosion', volume: 0.3 });
        b.life = 0;
        scoreAdd += 10;
      } else {
        b.life = 0;
      }
    }
  }
  const filtered = bullets.filter(b => b.life > 0 && b.x > -50 && b.x < ROOM_W + 50);
  return { bullets: filtered, scoreAdd };
}

/**
 * Actualiza las balas de jefe
 */
export function updateBossBullets(bullets, dt) {
  if (!bullets) return [];
  for (const b of bullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > ROOM_H + 20 || b.x < -50 || b.x > ROOM_W + 50) b.alive = false;
  }
  return bullets.filter(b => b.alive);
}

/**
 * Actualiza el jefe 1: Giant Beetle
 * Patrón: se mueve lateralmente, dispara 3 proyectiles hacia abajo
 */
export function updateBoss(boss, player, bossBullets, dt, takeDamageFn) {
  if (!boss || !boss.alive) return { bossDefeated: false };
  boss.x += boss.speed * boss.dir * dt;
  if (boss.x < 40 || boss.x > ROOM_W - 40 - boss.width) boss.dir *= -1;
  boss.y += Math.sin(Date.now() * 0.004) * 40 * dt;
  boss.fireTimer -= dt;
  if (boss.fireTimer <= 0) {
    boss.fireTimer = Math.max(0.5, 1.5 - boss.hp / boss.maxHp);
    for (let i = 0; i < 3; i++) {
      bossBullets.push(createBossBullet(
        boss.x + boss.width / 2 + (i - 1) * 20,
        boss.y + boss.height,
        (i - 1) * 60, 120, 5, 1,
      ));
    }
  }
  return { bossDefeated: false };
}

/**
 * Actualiza el Mini-Boss: Kraid
 * Patrón: dispara clavos, fase 2 = pinchos de suelo
 */
export function updateMiniBoss(miniBoss, player, bossBullets, dt, takeDamageFn) {
  if (!miniBoss || !miniBoss.alive) return { bossDefeated: false };
  miniBoss.y = 30 + Math.sin(Date.now() * 0.003) * 20;
  miniBoss.fireTimer -= dt;
  if (miniBoss.fireTimer <= 0) {
    miniBoss.fireTimer = miniBoss.hp < miniBoss.maxHp * 0.4 ? 0.8 : 1.5;
    const count = miniBoss.hp < miniBoss.maxHp * 0.4 ? 5 : 3;
    for (let i = 0; i < count; i++) {
      bossBullets.push(createBossBullet(
        miniBoss.x + 20 + i * 15,
        miniBoss.y + miniBoss.height,
        (i - 2) * 40, 150 + i * 20, 4, 1,
      ));
    }
  }
  if (miniBoss.hp < miniBoss.maxHp * 0.6) {
    miniBoss.spikeTimer -= dt;
    if (miniBoss.spikeTimer <= 0) {
      miniBoss.spikeTimer = 2;
      for (let i = 0; i < 3; i++) {
        bossBullets.push(createBossBullet(
          100 + Math.random() * (ROOM_W - 200), ROOM_H - 40,
          0, -200, 5, 1,
        ));
      }
    }
  }
  return { bossDefeated: false };
}

/**
 * Actualiza el jefe 2: Ridley (final boss)
 * Patrón: vuelo + embestidas + aliento de fuego, 3 fases
 */
export function updateBoss2(boss2, player, bossBullets, dt, takeDamageFn) {
  if (!boss2 || !boss2.alive) return { bossDefeated: false };
  const hpPct = boss2.hp / boss2.maxHp;
  boss2.phase = hpPct < 0.3 ? 3 : hpPct < 0.6 ? 2 : 1;

  if (boss2.swooping) {
    const dx = boss2.swoopTarget.x - boss2.x;
    const dy = boss2.swoopTarget.y - boss2.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 30) {
      boss2.swooping = false;
      boss2.swoopTimer = 1 + Math.random() * 0.5;
    } else {
      const swoopSpeed = boss2.speed * (boss2.phase === 3 ? 2 : 1.5);
      boss2.x += (dx / dist) * swoopSpeed * dt;
      boss2.y += (dy / dist) * swoopSpeed * dt;
    }
  } else {
    boss2.y = 30 + Math.sin(Date.now() * 0.002) * 25;
    boss2.x += Math.sin(Date.now() * 0.003) * 30 * dt;
    boss2.swoopTimer -= dt;
    if (boss2.swoopTimer <= 0) {
      boss2.swooping = true;
      boss2.swoopTarget = { x: player.x + player.width / 2, y: player.y + 20 };
    }
    boss2.fireTimer -= dt;
    if (boss2.fireTimer <= 0) {
      boss2.fireTimer = boss2.phase === 3 ? 0.3 : boss2.phase === 2 ? 0.6 : 1;
      const count = boss2.phase === 3 ? 5 : 3;
      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * 0.15;
        bossBullets.push(createBossBullet(
          boss2.x + boss2.width / 2, boss2.y + boss2.height,
          Math.sin(spread) * 180 + (player.x - boss2.x) * 0.15,
          100 + Math.cos(spread) * 80, 5, 2,
        ));
      }
    }
    boss2.x = Math.max(30, Math.min(ROOM_W - boss2.width - 30, boss2.x));
  }
  return { bossDefeated: false };
}

/**
 * Verifica colisiones de balas de jefe contra el jugador
 */
export function checkBossBulletsCollision(bossBullets, player, takeDamageFn) {
  for (const b of bossBullets) {
    if (!b.alive) continue;
    const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
    const pBox = { x: player.x, y: player.y, width: player.width, height: player.height };
    if (aabbHit(bBox, pBox)) {
      b.alive = false;
      takeDamageFn(b.damage || 1);
    }
  }
}

function aabbHit(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}
