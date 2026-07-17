/**
 * Street Fighter — Sistema de input y IA
 *
 * Extraído de StreetFighter.js. Contiene el manejo de input
 * del jugador y la IA del oponente.
 */
import { STATE, JUMP_GRAVITY, doAttack } from './combat.js';
import { clamp } from '../../engine/CollisionUtils.js';

/**
 * Actualiza el input de un luchador controlado por humano
 */
export function updateInput(fighter, dt, game) {
  const prefix = fighter.player === 1 ? 'p1' : 'p2';
  if (fighter.hitstunTimer > 0) { fighter.state = STATE.HIT; return; }
  if (fighter.blockstunTimer > 0) { fighter.state = STATE.BLOCK; fighter.vx = 0; return; }

  // Don't process input during attack animations
  if (fighter.state === STATE.PUNCH || fighter.state === STATE.KICK ||
      fighter.state === STATE.SPECIAL || fighter.state === STATE.SUPER) {
    fighter.frameTimer -= dt;
    if (fighter.frameTimer <= 0) {
      fighter.state = STATE.IDLE;
      fighter.vx = 0;
    }
    return;
  }

  const left = game.input.isActionDown(`${prefix}left`);
  const right = game.input.isActionDown(`${prefix}right`);
  const down = game.input.isActionDown(`${prefix}down`);
  const up = game.input.isActionDown(`${prefix}up`);

  // Movement
  if (down && fighter.onGround) {
    fighter.state = STATE.CROUCH;
    fighter.vx = 0;
  } else if (left) {
    fighter.state = STATE.WALK_BACK;
    fighter.vx = -fighter.def.speed;
    fighter.facing = -1;
  } else if (right) {
    fighter.state = STATE.WALK_FWD;
    fighter.vx = fighter.def.speed;
    fighter.facing = 1;
  } else if (up && fighter.onGround) {
    fighter.state = STATE.JUMP;
    fighter.vy = fighter.def.jumpVel;
    fighter.onGround = false;
  } else {
    fighter.state = STATE.IDLE;
    fighter.vx = 0;
  }

  // Attacks
  if (game.input.wasActionPressed(`${prefix}punch`)) {
    doAttack(fighter, 'punch', game);
  } else if (game.input.wasActionPressed(`${prefix}kick`)) {
    doAttack(fighter, 'kick', game);
  } else if (game.input.wasActionPressed(`${prefix}special`)) {
    doAttack(fighter, 'special', game);
  } else if (game.input.wasActionPressed(`${prefix}super`) && fighter.superMeter >= fighter.superMax) {
    doAttack(fighter, 'super', game);
    fighter.superMeter = 0;
    game.superFlash = 0.3;
  }
}

/**
 * Actualiza la IA de un luchador
 */
export function updateAI(fighter, dt, game) {
  if (fighter.hitstunTimer > 0) { fighter.state = STATE.HIT; return; }
  if (fighter.blockstunTimer > 0) { fighter.state = STATE.BLOCK; fighter.vx = 0; return; }
  if (fighter.state === STATE.PUNCH || fighter.state === STATE.KICK ||
      fighter.state === STATE.SPECIAL || fighter.state === STATE.SUPER) {
    fighter.frameTimer -= dt;
    if (fighter.frameTimer <= 0) { fighter.state = STATE.IDLE; fighter.vx = 0; }
    return;
  }

  const opponent = fighter.player === 1 ? game.p2 : game.p1;
  const dx = opponent.x - fighter.x;
  const dist = Math.abs(dx);
  const aggro = 0.5 + game.difficulty * 0.25;
  const reaction = 0.3 - game.difficulty * 0.08;

  fighter.aiTimer = fighter.aiTimer || 0;
  fighter.aiTimer -= dt;
  if (fighter.aiTimer > 0) return;
  fighter.aiTimer = reaction + Math.random() * 0.2;

  // AI decision
  if (dist < 60 && Math.random() < aggro * 0.4) {
    doAttack(fighter, Math.random() < 0.5 ? 'punch' : 'kick', game);
  } else if (dist < 100 && Math.random() < aggro * 0.15 && fighter.superMeter >= fighter.superMax) {
    doAttack(fighter, 'super', game);
    fighter.superMeter = 0;
    game.superFlash = 0.3;
  } else if (dist < 120 && Math.random() < aggro * 0.1) {
    doAttack(fighter, 'special', game);
  } else if (dist > 100 && Math.random() < 0.5) {
    fighter.state = STATE.WALK_FWD;
    fighter.vx = fighter.def.speed * (dx > 0 ? 1 : -1);
    fighter.facing = dx > 0 ? 1 : -1;
  } else if (dist > 40 && Math.random() < 0.3) {
    fighter.state = STATE.WALK_BACK;
    fighter.vx = -fighter.def.speed * (dx > 0 ? 1 : -1);
  } else {
    fighter.state = STATE.IDLE;
    fighter.vx = 0;
  }
}

/**
 * Aplica física a un luchador
 */
export function applyFighterPhysics(fighter, dt, game) {
  if (!fighter.onGround) {
    fighter.vy += JUMP_GRAVITY * dt;
    fighter.y += fighter.vy * dt;
    if (fighter.y >= game.height - 120) {
      fighter.y = game.height - 120;
      fighter.vy = 0;
      fighter.onGround = true;
    }
  }

  fighter.x += fighter.vx * dt;
  fighter.x = clamp(fighter.x, 20, game.width - 20 - fighter.width);

  // Hitstun / blockstun
  if (fighter.hitstunTimer > 0) fighter.hitstunTimer -= dt;
  if (fighter.blockstunTimer > 0) fighter.blockstunTimer -= dt;
  if (fighter.invincible > 0) fighter.invincible -= dt;

  // Super meter gain
  fighter.superMeter = Math.min(fighter.superMax, fighter.superMeter + 0.3 * dt);
}
