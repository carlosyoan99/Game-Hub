/**
 * Swords and Souls — Sistema de combate por turnos con IA adaptativa
 *
 * Extraído de SwordsAndSouls.js. Maneja el combate contra la IA,
 * acciones del jugador, y la lógica de victoria/derrota.
 */

import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { getAttack, getArchery, getDefense, getEnemyForWave } from './stats.js';
import { ENEMIES } from './constants.js';

/**
 * Inicia un combate
 */
export function startCombat(state) {
  if (state.player.hp <= 0) {
    return { error: '😵 No puedes combatir así. Descansa primero.' };
  }

  state.wave++;
  state.enemy = getEnemyForWave(state.wave - 1, ENEMIES);
  state.combatLog = [`¡${state.enemy.name} aparece!`];
  state.combatTurn = 'player';
  state.combatPhase = 'player-choice';
  state.playerDefending = false;
  state.subScene = 'combat';
  return { error: null };
}

/**
 * Actualiza el combate (animaciones, turno de la IA)
 */
export function updateCombat(state, dt) {
  if (state.combatPhase === 'animating') {
    state.combatTimer -= dt;
    if (state.combatTimer <= 0) {
      if (state.combatTurn === 'enemy') {
        executeEnemyTurn(state);
      } else {
        state.combatTurn = 'enemy';
        state.combatPhase = 'ai-thinking';
        state.combatTimer = 0.6;
      }
    }
    return;
  }

  if (state.combatPhase === 'ai-thinking') {
    state.combatTimer -= dt;
    if (state.combatTimer <= 0) {
      state.combatPhase = 'animating';
      state.combatTimer = 0.5;
    }
    return;
  }
}

/**
 * Ejecuta la acción del jugador
 */
export function doPlayerAction(state, action, rng) {
  if (!rng) rng = new SeededRandom();
  const player = state.player;
  const enemy = state.enemy;
  let msg = '';

  switch (action) {
    case 'attack': {
      const atk = getAttack(player) + rng.nextInt(0, 3);
      const def = enemy.def;
      const dmg = Math.max(1, atk - def + rng.nextInt(0, 2));
      enemy.hp -= dmg;
      msg = `⚔️ ¡${dmg} de daño!`;
      AudioManager.sfx({ type: 'swords_hit', volume: 0.35, playbackRate: 0.9 });
      HapticManager.vibrate('hit');
      if (state.onParticles) state.onParticles(state.width * 0.7, state.height * 0.35, '#ff6b4a', 10, { vyOffset: -30 });
      enemy.lastAction = 'player-attack';
      break;
    }
    case 'archery': {
      const atk = getArchery(player) + rng.nextInt(0, 2);
      const def = Math.floor(enemy.def * 0.5);
      const dmg = Math.max(1, atk - def + rng.nextInt(0, 2));
      enemy.hp -= dmg;
      msg = `🏹 ¡${dmg} de daño preciso!`;
      AudioManager.sfx({ type: 'swords_attack', volume: 0.35 });
      HapticManager.vibrate('shoot');
      if (state.onParticles) state.onParticles(state.width * 0.7, state.height * 0.35, '#4a9eff', 8, { vyOffset: -40 });
      enemy.lastAction = 'player-archery';
      break;
    }
    case 'defend': {
      state.playerDefending = true;
      msg = '🛡️ Te preparas para defender';
      enemy.lastAction = 'player-defend';
      break;
    }
    case 'heal': {
      if (player.potions > 0) {
        const heal = 30;
        player.hp = Math.min(player.maxHp, player.hp + heal);
        player.potions--;
        msg = `💚 +${heal} HP (quedan ${player.potions})`;
        AudioManager.sfx({ type: 'powerup', volume: 0.3, playbackRate: 0.6 });
        HapticManager.vibrate('powerup');
        if (state.onParticles) state.onParticles(state.width * 0.3, state.height * 0.4, '#3a9a5a', 8, { vyOffset: -20 });
      } else {
        return { msg: '❌ No tienes pociones', skip: true };
      }
      break;
    }
    case 'heal_big': {
      if (player.bigPotions > 0) {
        const heal = 60;
        player.hp = Math.min(player.maxHp, player.hp + heal);
        player.bigPotions--;
        msg = `💚💚 +${heal} HP (quedan ${player.bigPotions})`;
        AudioManager.sfx({ type: 'powerup', volume: 0.35, playbackRate: 0.5 });
        HapticManager.vibrate('powerup');
        if (state.onParticles) state.onParticles(state.width * 0.3, state.height * 0.4, '#3a9a5a', 12, { vyOffset: -20 });
      } else {
        return { msg: '❌ No tienes pociones grandes', skip: true };
      }
      break;
    }
  }

  if (msg) state.combatLog.push(msg);

  // Check enemy death
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    winCombat(state);
    return { enemyDefeated: true };
  }

  state.combatPhase = 'animating';
  state.combatTimer = 0.5;
  return { enemyDefeated: false };
}

/**
 * Turno del enemigo con IA adaptativa
 */
function executeEnemyTurn(state) {
  const enemy = state.enemy;
  const player = state.player;
  const rng = new SeededRandom();
  let msg = '';

  const actions = ['attack', 'attack', 'attack'];
  const hpPct = enemy.hp / enemy.maxHp;

  if (hpPct > 0.5) {
    if (enemy.lastAction === 'player-defend' && enemy.arch > 0) {
      actions.push('archery', 'archery');
    }
  }
  if (hpPct < 0.3) {
    actions.push('desperate', 'desperate');
  }
  if (enemy.lastAction === 'player-attack' || enemy.lastAction === 'player-archery') {
    actions.push('defend');
  }

  const choice = actions[rng.nextInt(0, actions.length - 1)];

  switch (choice) {
    case 'attack': {
      const atk = enemy.str + rng.nextInt(0, 2);
      const def = state.playerDefending ? getDefense(player) * 1.5 : getDefense(player);
      const dmg = Math.max(1, atk - Math.floor(def) + rng.nextInt(0, 1));
      player.hp -= dmg;
      msg = `💥 ${enemy.name} ataca: ¡${dmg} de daño!`;
      AudioManager.sfx({ type: 'swords_hit', volume: 0.4 });
      HapticManager.vibrate('hit');
      if (state.onParticles) state.onParticles(state.width * 0.3, state.height * 0.4, '#e74c3c', 8, { vyOffset: -25 });
      break;
    }
    case 'archery': {
      const atk = enemy.arch + rng.nextInt(0, 1);
      const dmg = Math.max(1, atk + rng.nextInt(0, 1));
      player.hp -= dmg;
      msg = `🏹 ${enemy.name} dispara: ¡${dmg} de daño!`;
      AudioManager.sfx({ type: 'swords_attack', volume: 0.3 });
      HapticManager.vibrate('shoot');
      if (state.onParticles) state.onParticles(state.width * 0.3, state.height * 0.4, '#e74c3c', 6, { vyOffset: -30 });
      break;
    }
    case 'defend': {
      msg = `🛡️ ${enemy.name} se defiende`;
      enemy.def += 3;
      break;
    }
    case 'desperate': {
      const atk = enemy.str * 1.5 + rng.nextInt(0, 4);
      const dmg = Math.max(1, atk - getDefense(player));
      player.hp -= dmg;
      msg = `🔥 ${enemy.name} ataque desesperado: ¡${dmg} de daño!`;
      AudioManager.sfx({ type: 'explosion', volume: 0.45 });
      HapticManager.vibrate('explosion');
      if (state.onParticles) state.onParticles(state.width * 0.3, state.height * 0.4, '#ffb454', 15, { vyOffset: -40 });
      break;
    }
  }

  if (choice !== 'defend' && enemy.def > getEnemyForWave(state.wave - 1, ENEMIES).def) {
    enemy.def = Math.max(enemy.def - 1, getEnemyForWave(state.wave - 1, ENEMIES).def);
  }

  state.playerDefending = false;
  state.combatLog.push(msg);

  if (player.hp <= 0) {
    player.hp = 0;
    loseCombat(state);
    return;
  }

  state.combatTurn = 'player';
  state.combatPhase = 'player-choice';
}

/**
 * Maneja la victoria en combate
 */
export function winCombat(state) {
  const enemy = state.enemy;
  AudioManager.sfx({ type: 'powerup', volume: 0.5 });
  HapticManager.vibrate('powerup');
  state.player.gold += enemy.goldReward;
  state.winStreak++;

  if (state.onCombatWin) state.onCombatWin(enemy);

  const heal = Math.floor(state.player.maxHp * 0.15);
  state.player.hp = Math.min(state.player.maxHp, state.player.hp + heal);

  state.subScene = null;
  if (state.onShowMessage) state.onShowMessage(`🏆 ${enemy.name} derrotado! +${enemy.xpReward}XP`);
}

/**
 * Maneja la derrota en combate
 */
export function loseCombat(state) {
  state.combatLog.push('💀 Has caído...');
  state.winStreak = 0;
  state.subScene = null;
  AudioManager.sfx({ type: 'explosion', volume: 0.5 });
  HapticManager.vibrate('explosion');
  state.player.hp = Math.floor(state.player.maxHp * 0.3);
  if (state.onShowMessage) state.onShowMessage('💀 Derrotado. Los héroes se levantan de nuevo.');
}

/**
 * Huye del combate
 */
export function fleeCombat(state) {
  state.wave = Math.max(0, state.wave - 1);
  state.enemy = null;
  state.combatPhase = 'idle';
  state.subScene = null;
  if (state.onShowMessage) state.onShowMessage('🏃 Has huido del combate');
}
