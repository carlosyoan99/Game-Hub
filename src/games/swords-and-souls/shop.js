/**
 * Swords and Souls — Tienda y equipamiento
 *
 * Extraído de SwordsAndSouls.js. Maneja la tienda,
 * compra de armas, armaduras y objetos.
 */

import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { EQUIPMENT } from './constants.js';

/**
 * Compra un item de la tienda
 * Devuelve un mensaje de resultado o error
 */
export function buyItem(player, category, index) {
  const items = EQUIPMENT[category];
  if (!items || !items[index]) {
    return { error: '❌ Item no encontrado' };
  }
  const item = items[index];

  if (player.gold < item.cost) {
    return { error: `❌ No tienes suficiente oro (${item.cost})` };
  }

  player.gold -= item.cost;

  switch (category) {
    case 'weapons':
      player.weapon = item;
      AudioManager.sfx({ type: 'swords_train', volume: 0.4 });
      HapticManager.vibrate('select');
      return { msg: `🗡️ ${item.name} equipada!` };

    case 'armor':
      player.armor = item;
      AudioManager.sfx({ type: 'swords_train', volume: 0.4 });
      HapticManager.vibrate('select');
      return { msg: `🛡️ ${item.name} equipada!` };

    case 'items':
      if (item.id === 'potion_hp') {
        player.potions++;
        AudioManager.sfx({ type: 'swords_buy', volume: 0.3 });
        return { msg: `🧪 ${item.name} adquirida! (${player.potions})` };
      } else if (item.id === 'potion_big') {
        player.bigPotions++;
        AudioManager.sfx({ type: 'swords_buy', volume: 0.3 });
        return { msg: `🧪 ${item.name} adquirida! (${player.bigPotions})` };
      } else if (item.id === 'sharpening_stone') {
        player.atkBonus += 2;
        AudioManager.sfx({ type: 'powerup', volume: 0.4 });
        HapticManager.vibrate('powerup');
        return { msg: '⚔️ ¡Ataque permanente +2!' };
      } else if (item.id === 'tome') {
        player.allStatsBonus++;
        AudioManager.sfx({ type: 'powerup', volume: 0.4 });
        HapticManager.vibrate('powerup');
        return { msg: '📖 ¡Todas las stats +1!' };
      }
      return { error: '❌ Objeto desconocido' };
  }
  return { error: '❌ Categoría desconocida' };
}

/**
 * Verifica si el jugador ya posee un item
 */
export function isItemOwned(player, category, item) {
  if (category === 'weapons') return player.weapon.id === item.id;
  if (category === 'armor') return player.armor.id === item.id;
  return false;
}
