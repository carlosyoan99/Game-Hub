/**
 * Golden Axe — Comportamiento de enemigos y jefes
 *
 * Extraído de GoldenAxe.js. Funciones que manejan la IA
 * de enemigos, arqueros, proyectiles y jefes.
 */

import { ENEMY_TYPES, GRAVITY, MAX_FALL } from './constants.js';
import { createArrow, createBossBullet, createEnemy } from './entities.js';
import { AudioManager } from '../../engine/AudioManager.js';

/**
 * Actualiza un enemigo individual (IA básica de aproximación)
 */
export function updateEnemyAI(e, player, dt, height) {
  if (!e.alive) return;

  e.aiTimer -= dt;
  if (e.aiTimer <= 0) {
    e.aiTimer = 0.3 + Math.random() * 0.4;
    const dx = player.x - e.x;
    if (!player.dead) {
      e.vx = dx > 0 ? ENEMY_TYPES[e.type].speed : -ENEMY_TYPES[e.type].speed;
    }
  }

  if (!e.onGround) {
    e.vy += GRAVITY * dt;
    e.vy = Math.min(e.vy, MAX_FALL);
  }
  e.x += e.vx * dt;
  e.y = height - 60 - e.height;

  if (e.attackCooldown > 0) e.attackCooldown -= dt;
}

/**
 * Actualiza el comportamiento del arquero (disparo + retirada)
 * Devuelve flechas creadas en este frame
 */
export function updateArcherBehavior(e, player, dt, arrows) {
  if (e.type !== 'archer' || !e.alive || player.dead) return;
  const dx = player.x + player.width / 2 - e.x;
  const dist = Math.abs(dx);

  if (dist < 80) {
    e.vx = dx > 0 ? -ENEMY_TYPES.archer.speed * 0.7 : ENEMY_TYPES.archer.speed * 0.7;
  }

  if (e.attackCooldown <= 0 && dist > 50 && dist < 350) {
    const dy = (player.y + 16) - (e.y + 8);
    const norm = Math.sqrt(dx * dx + dy * dy);
    arrows.push(createArrow(
      e.x + (dx > 0 ? e.width : 0),
      e.y + 8,
      (dx / norm) * 200,
      (dy / norm) * 200,
      6,
    ));
    e.attackCooldown = 1.2 + Math.random() * 0.5;
    AudioManager.sfx({ type: 'shoot', volume: 0.15 });
  }
}

/**
 * Actualiza todas las flechas enemigas
 */
export function updateArrows(arrows, dt) {
  for (const a of arrows) {
    if (!a.alive) continue;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.life -= dt;
    if (a.life <= 0) a.alive = false;
  }
  return arrows.filter(a => a.alive);
}

/**
 * Actualiza todos los proyectiles del mago
 * Devuelve { proyectiles, scoreAdd, bossDefeated }
 */
export function updateProjectiles(projectiles, enemies, boss, dt, callbacks) {
  if (!projectiles) return { projectiles: [], scoreAdd: 0, bossDefeated: false };
  let scoreAdd = 0;
  let bossDefeated = false;

  for (const p of projectiles) {
    if (!p.alive) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }

    // Hit enemies
    for (const e of enemies) {
      if (!e.alive) continue;
      if (aabbHit(p, e)) {
        p.alive = false;
        e.hp -= p.damage;
        callbacks.onProjectileHitEnemy(e, p);
        if (e.hp <= 0) {
          e.alive = false;
          callbacks.onEnemyKilled(e);
          scoreAdd += e.score;
        }
        break;
      }
    }
    // Hit boss
    if (boss && boss.alive && aabbHit(p, boss)) {
      p.alive = false;
      boss.hp -= Math.floor(p.damage * 0.7);
      callbacks.onProjectileHitBoss(p);
      if (boss.hp <= 0) {
        boss.alive = false;
        bossDefeated = true;
      }
    }
  }
  return { projectiles: projectiles.filter(p => p.alive), scoreAdd, bossDefeated };
}

function aabbHit(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Actualiza la IA del jefe según su patrón
 * Devuelve { bossBullets, minions, bossDefeated }
 */
export function updateBoss(boss, player, dt, scrollX, width, height, bossX) {
  if (!boss || !boss.alive) {
    return { bossBullets: [], minions: [] };
  }

  const hpPct = boss.hp / boss.maxHp;
  boss.enraged = hpPct < 0.35;
  const bullets = [];
  const minions = [];

  // Movement
  if (boss.pattern === 'inferno') {
    boss.x += boss.speed * boss.dir * dt * 0.6;
    boss.y = height - 140 + Math.sin(Date.now() * 0.003) * 30;
  } else if (boss.pattern === 'necromancy') {
    boss.x += boss.speed * boss.dir * dt * 0.8;
  } else {
    boss.x += boss.speed * boss.dir * dt;
    boss.y += Math.sin(Date.now() * 0.004) * 40 * dt;
  }
  if (boss.x < bossX - 50) boss.dir = 1;
  if (boss.x > bossX + 200) boss.dir = -1;

  // Attack patterns
  boss.fireTimer -= dt;
  if (boss.fireTimer <= 0) {
    const speedMult = boss.enraged ? 0.7 : 1.0;
    boss.fireTimer = Math.max(0.5, (1.5 - hpPct) * speedMult);

    if (boss.pattern === 'charge') {
      boss.vx = boss.dir * boss.speed * 3;
    } else if (boss.pattern === 'spiral') {
      for (let i = 0; i < 5; i++) {
        const angle = Math.PI / 2 + (i - 2) * 0.35;
        bullets.push(createBossBullet(
          boss.x + boss.width / 2, boss.y + boss.height,
          Math.cos(angle) * (100 + boss.enraged * 40),
          Math.sin(angle) * (100 + boss.enraged * 40),
          5, boss.enraged ? '#ff4d4d' : '#ffb454',
        ));
      }
    } else if (boss.pattern === 'necromancy') {
      for (let i = 0; i < 2; i++) {
        const angle = Math.PI / 2 + (i - 0.5) * 0.8;
        bullets.push(createBossBullet(
          boss.x + boss.width / 2, boss.y + boss.height,
          Math.cos(angle) * 100, Math.sin(angle) * 100,
          6, '#4a9eff', true,
        ));
      }
      if (boss.enraged && Math.random() < 0.4) {
        minions.push(createEnemy(
          { type: 'skeleton', fromLeft: false, delay: 0 },
          ENEMY_TYPES.skeleton, bossX, width, height
        ));
      }
    } else if (boss.pattern === 'inferno') {
      const spread = boss.enraged ? 5 : 3;
      for (let i = 0; i < spread; i++) {
        const angle = Math.PI / 2 + (i - (spread - 1) / 2) * 0.25;
        bullets.push(createBossBullet(
          boss.x + boss.width / 2, boss.y + boss.height,
          Math.cos(angle) * (140 + boss.enraged * 50),
          Math.sin(angle) * (140 + boss.enraged * 50),
          7, '#ff6b4a',
        ));
      }
      if (boss.enraged) {
        for (let i = 0; i < 3; i++) {
          bullets.push(createBossBullet(
            boss.x + Math.random() * boss.width, height - 55,
            (Math.random() - 0.5) * 80, -30, 6, '#ff4d4d',
          ));
        }
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const angle = Math.PI / 2 + (i - 1) * 0.4;
        bullets.push(createBossBullet(
          boss.x + boss.width / 2, boss.y + boss.height,
          Math.cos(angle) * 120, Math.sin(angle) * 120,
          5, '#ff4d4d',
        ));
      }
    }
    AudioManager.sfx({ type: 'shoot', volume: 0.3 });
  }

  return { bossBullets: bullets, minions };
}

/**
 * Actualiza las balas del jefe (movimiento + homing)
 */
export function updateBossBullets(bullets, player, dt, scrollX, width, height) {
  for (const b of bullets) {
    if (!b.alive) continue;
    if (b.homing && !player.dead) {
      const dx = player.x + player.width / 2 - b.x;
      const dy = player.y + 20 - b.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 0) {
        b.vx += (dx / len) * 60 * dt;
        b.vy += (dy / len) * 60 * dt;
        const spd = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (spd > 150) { b.vx = (b.vx / spd) * 150; b.vy = (b.vy / spd) * 150; }
      }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > height + 20 || b.x < scrollX - 20 || b.x > scrollX + width + 20) {
      b.alive = false;
    }
  }
  return bullets.filter(b => b.alive);
}
