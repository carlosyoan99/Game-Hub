/**
 * Metroid-like — Power-ups, items y daño
 *
 * Extraído de MetroidLike.js. Maneja la recolección de items,
 * bombas, daño al jugador y popups de notificación.
 */

import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { TILE, T, ROWS, COLS, ROOM_W, ABILITY } from './constants.js';

/**
 * Recolecta un item y aplica sus efectos al estado del juego
 */
export function collectItem(item, state) {
  AudioManager.sfx({ type: 'powerup', volume: 0.4 });
  HapticManager.vibrate('powerup');
  state.emitParticles(item.x + TILE / 2, item.y + TILE / 2, '#ffd700', 8);

  switch (item.type) {
    case 'morph':
      state.abilities |= ABILITY.MORPH_BALL;
      state.showAbilityPopup('metroid.morphBall');
      state.score += 500;
      break;
    case 'missile':
      state.abilities |= ABILITY.MISSILES;
      state.maxMissiles += 5;
      state.missileCount = Math.max(state.missileCount, state.maxMissiles);
      state.showAbilityPopup('metroid.missile');
      state.score += 500;
      break;
    case 'bomb':
      state.abilities |= ABILITY.BOMBS;
      state.bombCount += 3;
      state.showAbilityPopup('metroid.bomb');
      state.score += 500;
      break;
    case 'spacejump':
      state.abilities |= ABILITY.SPACE_JUMP;
      state.showAbilityPopup('metroid.spaceJump');
      state.score += 500;
      break;
    case 'speedboost':
      state.abilities |= ABILITY.SPEED_BOOST;
      state.showAbilityPopup('metroid.speedBoost');
      state.score += 500;
      break;
    case 'screwattack':
      state.abilities |= ABILITY.SCREW_ATTACK;
      state.showAbilityPopup('metroid.screwAttack');
      state.score += 500;
      break;
    case 'highjump':
      state.abilities |= ABILITY.HIGH_JUMP;
      state.showAbilityPopup('metroid.highJump');
      state.score += 500;
      break;
    case 'energytank':
      state.maxHp = Math.min(state.maxHp + 50, 200);
      state.hp = Math.min(state.hp + 50, state.maxHp);
      state.showItemPopup('E-TANK: HP+50');
      state.score += 1000;
      break;
    case 'hp':
      state.hp = Math.min(state.hp + 10, state.maxHp);
      state.showItemPopup('HP +10');
      state.score += 200;
      break;
  }
}

/**
 * Aplica daño al jugador con invencibilidad y knockback
 */
export function takeDamage(state, amount) {
  if (state.player.invincible > 0) return;
  state.hp -= amount;
  state.player.invincible = 1.5;
  state.player.vx *= -3;
  state.player.vy = -200;
  state.emitParticles(state.player.x + 9, state.player.y + 14, '#ff4d4d', 6);
  AudioManager.sfx({ type: 'hit', volume: 0.3 });
  HapticManager.vibrate('hit');
  return state.hp <= 0; // true = game over
}

/**
 * Actualiza la bomba colocada (tick, explosión, daño a tiles/enemigos/bosses)
 */
export function updateBomb(state, dt) {
  if (!state.bombPlaced) return;
  state.bombPlaced.timer -= dt;
  if (state.bombPlaced.timer > 0) return;

  const bx = state.bombPlaced.x;
  const by = state.bombPlaced.y;
  state.emitParticles(bx + 8, by + 8, '#ff6b4a', 20);
  AudioManager.sfx({ type: 'explosion', volume: 0.5 });
  HapticManager.vibrate('explosion');

  const radius = TILE * 2;
  // Destroy cracked tiles
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      if (state.tilemap.tileAt(col, row) !== T.CRACKED) continue;
      if (Math.abs(col * TILE - bx) < radius && Math.abs(row * TILE - by) < radius) {
        state.tilemap.data[row][col] = T.EMPTY;
        state.emitParticles(col * TILE + TILE / 2, row * TILE + TILE / 2, '#7c5c3a', 8);
      }
    }
  }

  // Damage enemies
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (Math.abs(e.x + e.width / 2 - bx - 8) < radius && Math.abs(e.y + e.height / 2 - by - 8) < radius) {
      e.alive = false;
      state.emitParticles(e.x + e.width / 2, e.y + e.height / 2, '#ff6b4a', 8);
    }
  }

  // Damage bosses
  if (state.bossPresent && state.boss) state.boss.hp -= 15;
  if (state.miniBossPresent && state.miniBoss) state.miniBoss.hp -= 20;
  if (state.boss2Present && state.boss2) state.boss2.hp -= 10;

  state.bombPlaced = null;
}

/**
 * Actualiza los popups de habilidad/item
 */
export function updatePopups(state, dt) {
  if (state.abilityPopupTimer > 0) {
    state.abilityPopupTimer -= dt;
    if (state.abilityPopupTimer <= 0) state.abilityPopup = null;
  }
  if (state.itemPopupTimer > 0) {
    state.itemPopupTimer -= dt;
    if (state.itemPopupTimer <= 0) state.itemPopup = null;
  }
}
