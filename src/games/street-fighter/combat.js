/**
 * Street Fighter — Sistema de combate
 *
 * Extraído de StreetFighter.js. Contiene el sistema de colisiones,
 * gestión de proyectiles, rounds, KO, y efectos de golpe.
 */
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { aabbIntersects } from '../../engine/CollisionUtils.js';

// ─── Estados del luchador ──────────────────────────────────────────

export const STATE = {
  IDLE: 0, WALK_FWD: 1, WALK_BACK: 2, CROUCH: 3, JUMP: 4,
  PUNCH: 5, KICK: 6, SPECIAL: 7, SUPER: 8, HIT: 9, BLOCK: 10, KO: 11, WIN: 12,
};

export const JUMP_GRAVITY = 900;
export const MAX_ROUNDS = 3;
export const ROUND_TIME = 60; // segundos por round

/**
 * Devuelve el ataque de un luchador por tipo
 */
export function getAttack(fighter, type) {
  return fighter.def.attacks[type];
}

/**
 * Realiza un ataque: cambia estado, timer, efectos
 */
export function doAttack(fighter, type, game) {
  const atk = getAttack(fighter, type);
  if (!atk) return;
  const stateMap = { punch: STATE.PUNCH, kick: STATE.KICK, special: STATE.SPECIAL, super: STATE.SUPER };
  fighter.state = stateMap[type];
  fighter.frameTimer = (atk.startup + atk.active + atk.recovery) / 60;
  fighter.currentAttack = { ...atk, type };
  fighter.vx = 0;
  AudioManager.sfx({ type: 'hit', volume: 0.2 });

  // Spawn projectile for special attacks (Ryu=0, Dhalsim=3, Guile=5)
  if (type === 'special' && (fighter.charIdx === 0 || fighter.charIdx === 3 || fighter.charIdx === 5)) {
    game.projectiles.push({
      x: fighter.x + fighter.width / 2 + fighter.facing * 30,
      y: fighter.y + 24,
      vx: fighter.facing * 400,
      vy: 0,
      life: 1.5,
      damage: atk.damage,
    });
  }

  // Super spawns a fast projectile for all characters
  if (type === 'super') {
    game.projectiles.push({
      x: fighter.x + fighter.width / 2 + fighter.facing * 30,
      y: fighter.y + 24,
      vx: fighter.facing * 600,
      vy: 0,
      life: 2.0,
      damage: atk.damage,
    });
  }
}

/**
 * Actualiza proyectiles: movimiento y límites
 */
export function updateProjectiles(projectiles, dt, width) {
  for (const p of projectiles) {
    p.x += p.vx * dt;
    p.life -= dt;
  }
  return projectiles.filter(p => p.life > 0 && p.x > -50 && p.x < width + 50);
}

/**
 * Comprueba colisiones entre ataques/luchadores y proyectiles
 */
export function checkCollisions(game) {
  const fighters = [game.p1, game.p2];

  for (let fi = 0; fi < fighters.length; fi++) {
    const attacker = fighters[fi];
    if (attacker.hp <= 0 || attacker.state === STATE.KO || attacker.state === STATE.WIN) continue;
    if (!attacker.currentAttack || attacker.frameTimer <= 0) continue;

    const opponent = fighters[1 - fi];
    if (opponent.hp <= 0 || opponent.state === STATE.KO || opponent.state === STATE.WIN) continue;
    if (opponent.invincible > 0) continue;

    const atk = attacker.currentAttack;
    const atkDuration = (atk.startup + atk.active + atk.recovery) / 60;
    const elapsed = atkDuration - attacker.frameTimer;
    const activeStart = atk.startup / 60;
    const activeEnd = (atk.startup + atk.active) / 60;

    // Only check during active frames
    if (elapsed < activeStart || elapsed > activeEnd) continue;

    // Hitbox
    const hitbox = {
      x: attacker.x + (attacker.facing > 0 ? attacker.width : -atk.range),
      y: attacker.y + 10,
      width: atk.range,
      height: attacker.height - 20,
    };
    const defBox = { x: opponent.x, y: opponent.y, width: opponent.width, height: opponent.height };

    if (!aabbIntersects(hitbox, defBox)) continue;

    // Check if opponent is blocking (holding away from attacker)
    const holdingBack = (opponent.vx !== 0 && (
      (attacker.x < opponent.x && opponent.vx > 0) ||
      (attacker.x > opponent.x && opponent.vx < 0)
    ));
    const blocking = opponent.state === STATE.BLOCK || holdingBack;
    const isProjectile = atk.type === 'special' && (attacker.charIdx === 0 || attacker.charIdx === 3 || attacker.charIdx === 5);

    if (blocking && !isProjectile) {
      // Blocked
      const chipDmg = Math.floor(atk.damage * 0.15);
      opponent.hp -= chipDmg;
      opponent.blockstunTimer = atk.hitstun / 60;
      HapticManager.vibrate('hit');
      spawnHitEffect(game, opponent.x + opponent.width / 2, opponent.y + 20, true);
    } else {
      // Hit
      opponent.hp -= atk.damage;
      opponent.hitstunTimer = atk.hitstun / 60;
      opponent.vx = attacker.facing * 300;
      attacker.superMeter = Math.min(attacker.superMax, attacker.superMeter + 5);
      AudioManager.sfx({ type: 'hit', volume: 0.4 });
      HapticManager.vibrate('hit');
      spawnHitEffect(game, opponent.x + opponent.width / 2, opponent.y + 20, false);

      // Super flash
      if (atk.type === 'super') {
        AudioManager.sfx({ type: 'explosion', volume: 0.5 });
        spawnHitEffect(game, opponent.x + opponent.width / 2, opponent.y, false);
      }

      if (opponent.hp <= 0) {
        opponent.hp = 0;
        ko(game, opponent);
        return;
      }
    }
    attacker.currentAttack = null;
  }

  // Special projectiles (hadouken)
  for (const p of game.projectiles) {
    for (const f of fighters) {
      if (f.hp <= 0 || f.invincible > 0) continue;
      const fBox = { x: f.x, y: f.y, width: f.width, height: f.height };
      const pBox = { x: p.x - 8, y: p.y - 8, width: 16, height: 16 };
      if (aabbIntersects(pBox, fBox)) {
        p.life = 0;
        f.hp -= p.damage;
        f.hitstunTimer = 0.3;
        AudioManager.sfx({ type: 'hit', volume: 0.3 });
        spawnHitEffect(game, p.x, p.y, false);
        if (f.hp <= 0) { f.hp = 0; ko(game, f); return; }
      }
    }
  }
}

/**
 * Crea efecto de partículas de golpe
 */
export function spawnHitEffect(game, x, y, blocked) {
  game.hitEffects = game.hitEffects || [];
  for (let i = 0; i < 6; i++) {
    game.hitEffects.push({
      x, y,
      vx: (Math.random() - 0.5) * 200,
      vy: -Math.random() * 200,
      life: 0.3 + Math.random() * 0.3,
      color: blocked ? '#4a9eff' : '#ffd700',
    });
  }
}

/**
 * Maneja un K.O.: actualiza estado, wins, timer
 */
export function ko(game, loser) {
  loser.state = STATE.KO;
  const winner = loser.player === 1 ? game.p2 : game.p1;
  if (winner.player === 1) game.p1Wins++;
  else game.p2Wins++;
  game.koTimer = 2;
  game.roundState = 'ko';
  AudioManager.sfx({ type: 'explosion', volume: 0.5 });
  HapticManager.vibrate('explosion');
}

/**
 * Maneja time-up: el que tenga más HP gana
 */
export function timeUp(game) {
  if (game.p1.hp > game.p2.hp) { game.p1Wins++; ko(game, game.p2); }
  else if (game.p2.hp > game.p1.hp) { game.p2Wins++; ko(game, game.p1); }
  else { game.p1Wins++; game.p2Wins++; ko(game, game.p1); }
  game.roundState = 'ko';
  game.koTimer = 2;
}

/**
 * Finaliza el round actual
 */
export function endRound(game) {
  game.roundState = 'round_end';
  if (game.p1Wins >= 2) {
    return 'p1';
  } else if (game.p2Wins >= 2) {
    return 'p2';
  }
  return null;
}

/**
 * Prepara el siguiente round
 */
export function nextRound(game) {
  game.round++;
  game.roundTimer = ROUND_TIME;
  game.roundState = 'intro';
  game.introTimer = 2;
  resetPositions(game);
  // Restore partial HP
  game.p1.hp = Math.max(game.p1.hp, Math.floor(game.p1.maxHp * 0.3));
  game.p2.hp = Math.max(game.p2.hp, Math.floor(game.p2.maxHp * 0.3));
  game.p1.superMeter = Math.min(game.p1.superMax, game.p1.superMeter + 15);
  game.p2.superMeter = Math.min(game.p2.superMax, game.p2.superMeter + 15);
  game.projectiles = [];
  game.hitEffects = [];
}

/**
 * Separa a los luchadores si se solapan
 */
export function pushApart(p1, p2) {
  const dx = p1.x - p2.x;
  const overlap = Math.abs(dx) - (p1.width + p2.width) / 2;
  if (overlap < 0) {
    const push = overlap / 2;
    p1.x -= push;
    p2.x += push;
  }
}

/**
 * Reinicia posiciones iniciales
 */
export function resetPositions(game) {
  game.p1.x = 100;
  game.p1.y = game.height - 120;
  game.p1.vx = 0; game.p1.vy = 0;
  game.p2.x = game.width - 100;
  game.p2.y = game.height - 120;
  game.p2.vx = 0; game.p2.vy = 0;
  game.p1.state = STATE.IDLE;
  game.p2.state = STATE.IDLE;
  game.p1.onGround = true;
  game.p2.onGround = true;
  game.p1.hitstunTimer = 0;
  game.p2.hitstunTimer = 0;
}
