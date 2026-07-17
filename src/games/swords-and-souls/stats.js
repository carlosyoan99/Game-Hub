/**
 * Swords and Souls — Sistema de atributos, nivel y experiencia
 *
 * Extraído de SwordsAndSouls.js. Maneja cálculos de stats,
 * subida de nivel y asignación de puntos.
 */

import { BASE_HP, HP_PER_LEVEL } from './constants.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';

/**
 * Calcula el ataque total (fuerza + arma + bonos)
 */
export function getAttack(player) {
  return player.str + player.weapon.strBonus + player.atkBonus + player.allStatsBonus;
}

/**
 * Calcula la arquería total
 */
export function getArchery(player) {
  return player.arch + player.weapon.archBonus + player.allStatsBonus;
}

/**
 * Calcula la defensa total (resistencia + armadura + bonos)
 */
export function getDefense(player) {
  return player.end + player.armor.defBonus + player.allStatsBonus;
}

/**
 * Calcula la velocidad total
 */
export function getSpeed(player) {
  return player.agi + player.allStatsBonus;
}

/**
 * Añade experiencia y maneja subidas de nivel
 */
export function addXp(player, amount, callbacks) {
  player.xp += amount;
  let leveledUp = false;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.xpToNext = Math.floor(player.xpToNext * 1.4) + 5;
    player.maxHp = BASE_HP + (player.level - 1) * HP_PER_LEVEL;
    player.hp = player.maxHp;
    player.statPoints += 3;
    leveledUp = true;
    AudioManager.sfx({ type: 'powerup', volume: 0.5 });
    HapticManager.vibrate('powerup');
    if (callbacks && callbacks.onLevelUp) {
      callbacks.onLevelUp(player.level);
    }
  }
  return leveledUp;
}

/**
 * Asigna un punto de stat a una estadística
 */
export function assignStat(player, stat) {
  if (player.statPoints <= 0) return false;
  player[stat]++;
  player.statPoints--;
  player.maxHp = BASE_HP + (player.level - 1) * HP_PER_LEVEL;
  const labels = { str: 'Fuerza', agi: 'Agilidad', end: 'Resistencia', arch: 'Arquería' };
  return labels[stat] || stat;
}

/**
 * Descansa y recupera HP
 */
export function rest(player) {
  const heal = Math.floor(player.maxHp * 0.4);
  player.hp = Math.min(player.maxHp, player.hp + heal);
  return heal;
}

/**
 * Crea un enemigo escalado para una oleada
 */
export function getEnemyForWave(wave, enemies) {
  const idx = Math.min(wave, enemies.length - 1);
  const base = enemies[idx];
  const scale = 1 + wave * 0.15;
  return {
    name: base.name,
    emoji: base.emoji,
    hp: Math.floor(base.hp * scale),
    maxHp: Math.floor(base.hp * scale),
    str: Math.floor(base.str * scale),
    def: Math.floor(base.def * scale),
    arch: Math.floor(base.arch * scale),
    xpReward: Math.floor(base.xpReward * scale),
    goldReward: Math.floor(base.goldReward * scale),
    lastAction: 'none',
  };
}
