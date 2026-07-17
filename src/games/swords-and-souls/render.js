/**
 * Swords and Souls — Renderizado completo
 *
 * Extraído de SwordsAndSouls.js. Contiene todas las funciones
 * de dibujo: hub, entrenamiento, combate, tienda y HUD.
 */

import { t } from '../../engine/i18n.js';
import { SCENES, SCENE_NAME_KEYS, SCENE_SUBTITLE_KEYS, EQUIPMENT, ENEMIES } from './constants.js';
import { getSparButton } from './training.js';

/**
 * Renderiza el fondo con gradiente y cuadrícula sutil
 */
export function renderBackground(ctx, width, height) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, '#0d1b2a');
  grad.addColorStop(0.5, '#1b2838');
  grad.addColorStop(1, '#0f1a1a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
  for (let y = 0; y < height; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
}

/**
 * Renderiza el overlay de mensaje
 */
export function renderMessage(ctx, width, height, message, messageTimer) {
  if (!message) return;
  const alpha = Math.min(1, messageTimer);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(width / 2 - 160, height - 50, 320, 36);
  ctx.fillStyle = `rgba(231, 237, 243, ${alpha})`;
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, width / 2, height - 32);
  ctx.textAlign = 'left';
}

/**
 * Renderiza el hub principal
 */
export function renderHub(ctx, state) {
  const { width, height, player, currentScene } = state;

  // Header
  ctx.fillStyle = '#e7edf3';
  ctx.font = 'bold 20px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(t(SCENE_NAME_KEYS[currentScene]), 15, 12);

  ctx.fillStyle = '#7c8894';
  ctx.font = '11px monospace';
  ctx.fillText(t(SCENE_SUBTITLE_KEYS[currentScene]), 15, 36);

  // Stats bar (top right)
  ctx.fillStyle = '#9aa7b2';
  ctx.font = '12px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`Nv.${player.level}  ❤️${player.hp}/${player.maxHp}  💰${player.gold}`, width - 15, 12);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#7c8894';
  ctx.fillText(`XP ${player.xp}/${player.xpToNext}  💪${player.str}  💨${player.agi}  🛡️${player.end}  🏹${player.arch}`, width - 15, 30);
  ctx.textAlign = 'left';

  // Separator
  ctx.strokeStyle = '#1e2731';
  ctx.beginPath();
  ctx.moveTo(10, 56);
  ctx.lineTo(width - 10, 56);
  ctx.stroke();

  // Content per scene
  if (currentScene === 'training') renderTrainingOptions(ctx, state);
  else if (currentScene === 'arena') renderArenaOptions(ctx, state);
  // Home content is handled inline below (equipment, rest, stats)

  // Stat points assignment
  if (player.statPoints > 0) {
    const btns = getStatButtons(state);
    ctx.fillStyle = '#ffb454';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(t('swords.statsAvailable', { n: player.statPoints }), width * 0.55, 64);
    for (const btn of btns) {
      ctx.fillStyle = '#11161d';
      ctx.strokeStyle = '#2a3a4a';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '10px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x + 6, btn.y + btn.height / 2);
    }
  }

  // Rest button for home
  if (currentScene === 'home' && player.hp < player.maxHp) {
    const restBtn = getRestButton(state);
    if (restBtn) {
      ctx.fillStyle = '#1a2a1a';
      ctx.strokeStyle = '#3a5a3a';
      ctx.fillRect(restBtn.x, restBtn.y, restBtn.width, restBtn.height);
      ctx.strokeRect(restBtn.x, restBtn.y, restBtn.width, restBtn.height);
      ctx.fillStyle = '#7cbd7c';
      ctx.font = '11px monospace';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      ctx.fillText(t('swords.rest'), restBtn.x + restBtn.width / 2, restBtn.y + restBtn.height / 2);
      ctx.textAlign = 'left';
    }
  }

  // Equipment display (home)
  if (currentScene === 'home') {
    renderHomeEquipment(ctx, state);
  }

  // Scene nav buttons
  const buttons = getSceneButtons(state);
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    const isCurrent = SCENES[i] === currentScene;
    ctx.fillStyle = isCurrent ? '#1e2a38' : '#11161d';
    ctx.strokeStyle = isCurrent ? '#4a7abb' : '#1e2731';
    ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
    ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
    ctx.fillStyle = isCurrent ? '#b0c4e0' : '#9aa7b2';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t(SCENE_NAME_KEYS[SCENES[i]]), btn.x + btn.width / 2, btn.y + btn.height / 2);
  }
  ctx.textAlign = 'left';
}

function renderHomeEquipment(ctx, state) {
  const p = state.player;
  ctx.fillStyle = '#7c8894';
  ctx.font = '10px monospace';
  ctx.fillText(`🗡️ ${p.weapon.name} (ATQ +${p.weapon.strBonus + p.weapon.archBonus})`, 15, 70);
  ctx.fillText(`🛡️ ${p.armor.name} (DEF +${p.armor.defBonus})`, 15, 84);
  ctx.fillText(`🧪 Pociones: ${p.potions} | Grandes: ${p.bigPotions}`, 15, 98);
  if (p.atkBonus > 0) ctx.fillText(`⚔️ Bono ataque: +${p.atkBonus}`, 15, 112);
  if (p.allStatsBonus > 0) ctx.fillText(`📖 Bono stats: +${p.allStatsBonus}`, 15, 126);
  ctx.fillStyle = '#7c8894';
  ctx.font = '10px monospace';
  ctx.fillText(t('swords.bestWave', { n: state.bestWave }), 15, state.height - 95);
  ctx.fillText(t('swords.totalGold', { n: state.totalGold }), 15, state.height - 81);
}

export function renderTrainingOptions(ctx, state) {
  const options = [
    { id: 'train-archery', labelKey: 'swords.trainingArchery', descKey: 'swords.trainingDescArch', clicks: '5-8' },
    { id: 'train-spar', labelKey: 'swords.trainingSpar', descKey: 'swords.trainingDescSpar', clicks: '8-12' },
    { id: 'train-endurance', labelKey: 'swords.trainingEndurance', descKey: 'swords.trainingDescEnd', clicks: '6-10' },
  ];

  const btnH = 52;
  const btnW = state.width * 0.84;
  const startX = state.width * 0.08;
  const startY = 70;
  const gap = 8;

  for (let i = 0; i < options.length; i++) {
    const y = startY + i * (btnH + gap);
    ctx.fillStyle = '#11161d';
    ctx.strokeStyle = '#1e2731';
    ctx.fillRect(startX, y, btnW, btnH);
    ctx.strokeRect(startX, y, btnW, btnH);
    ctx.fillStyle = '#e7edf3';
    ctx.font = '13px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(t(options[i].labelKey), startX + 10, y + 6);
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.fillText(t(options[i].descKey), startX + 10, y + 24);
    ctx.fillText(options[i].clicks, startX + btnW - 80, y + 6);
  }
}

export function renderArenaOptions(ctx, state) {
  const canFight = state.player.hp > 0;
  ctx.fillStyle = '#7c8894';
  ctx.font = '12px monospace';
  ctx.fillText(t('swords.currentWave', { n: state.wave + 1 }), 15, 70);
  ctx.fillText(t('swords.winStreak', { n: state.winStreak }), 15, 88);

  if (state.wave < ENEMIES.length) {
    const nextEnemy = state._getEnemyForWave();
    ctx.fillStyle = '#e7edf3';
    ctx.font = '14px monospace';
    ctx.fillText(t('swords.nextEnemy', { emoji: nextEnemy.emoji, name: nextEnemy.name }), 15, 112);
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.fillText(`HP: ${nextEnemy.hp}  ATQ: ${nextEnemy.str}  DEF: ${nextEnemy.def}`, 15, 130);
    ctx.fillText(t('swords.enemyReward', { xp: nextEnemy.xpReward, gold: nextEnemy.goldReward }), 15, 144);

    const fightBtn = { x: state.width / 2 - 80, y: 170, width: 160, height: 36 };
    ctx.fillStyle = canFight ? '#2a1a1a' : '#11161d';
    ctx.strokeStyle = canFight ? '#8a3a3a' : '#1e2731';
    ctx.fillRect(fightBtn.x, fightBtn.y, fightBtn.width, fightBtn.height);
    ctx.strokeRect(fightBtn.x, fightBtn.y, fightBtn.width, fightBtn.height);
    ctx.fillStyle = canFight ? '#e74c3c' : '#4a5058';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(canFight ? t('swords.fight') : t('swords.injured'), fightBtn.x + fightBtn.width / 2, fightBtn.y + fightBtn.height / 2);
    ctx.textAlign = 'left';
  } else {
    ctx.fillStyle = '#ffb454';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(t('swords.allDefeated'), 15, 112);
  }
}

/**
 * Renderiza la pantalla de entrenamiento activo
 */
export function renderTraining(ctx, state) {
  renderBackButton(ctx, state);

  const labelKeys = {
    'train-archery': 'swords.trainingArchery',
    'train-spar': 'swords.trainingSpar',
    'train-endurance': 'swords.trainingEndurance',
  };

  ctx.fillStyle = '#e7edf3';
  ctx.font = 'bold 16px monospace';
  ctx.textBaseline = 'top';
  ctx.fillText(t(labelKeys[state.subScene]), 15, 12);

  ctx.fillStyle = '#7c8894';
  ctx.font = '11px monospace';
  ctx.fillText(t('swords.progress', { n: state.trainClicks, max: state.trainMax }), 15, 38);

  // Progress bar
  const pct = state.trainClicks / state.trainMax;
  const barW = state.width - 30;
  const barH = 8;
  ctx.fillStyle = '#1e2731';
  ctx.fillRect(15, 56, barW, barH);
  ctx.fillStyle = '#ffb454';
  ctx.fillRect(15, 56, barW * pct, barH);

  if (state.trainPhase === 'done') {
    ctx.fillStyle = '#3a7d5c';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t('swords.trainingComplete'), state.width / 2, state.height / 2 - 20);
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '12px monospace';
    ctx.fillText(t('swords.clickToContinue'), state.width / 2, state.height / 2 + 10);
    ctx.textAlign = 'left';
    return;
  }

  switch (state.subScene) {
    case 'train-archery':
      if (state.trainTarget) {
        const t = state.trainTarget;
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#e74c3c';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius * 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.fillStyle = '#9aa7b2';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('¡Haz clic en el blanco!', state.width / 2, state.height - 30);
        ctx.textAlign = 'left';
      }
      break;

    case 'train-spar': {
      const sparBtn = getSparButton(state);
      ctx.fillStyle = '#1a1a2a';
      ctx.strokeStyle = '#3a3a5a';
      ctx.fillRect(sparBtn.x, sparBtn.y, sparBtn.width, sparBtn.height);
      ctx.strokeRect(sparBtn.x, sparBtn.y, sparBtn.width, sparBtn.height);
      ctx.fillStyle = '#9aa7b2';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎯', sparBtn.x + sparBtn.width / 2, sparBtn.y + sparBtn.height / 2);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('¡Haz clic rápido en el saco!', state.width / 2, state.height - 30);
      ctx.textAlign = 'left';
      break;
    }

    case 'train-endurance':
      ctx.fillStyle = '#9aa7b2';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t('swords.trainingClickRhythm'), state.width / 2, state.height * 0.4);
      ctx.font = '11px monospace';
      ctx.fillText(t('swords.trainingClickFast'), state.width / 2, state.height * 0.45);
      ctx.textAlign = 'left';
      break;
  }
}

/**
 * Renderiza la pantalla de combate
 */
export function renderCombat(ctx, state) {
  renderBackButton(ctx, state);
  ctx.textBaseline = 'alphabetic';

  // Enemy display (right half)
  if (state.enemy) {
    const e = state.enemy;
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(`${e.emoji} ${e.name}`, state.width * 0.55, 12);

    const eHpW = state.width * 0.35;
    const eHpX = state.width * 0.55;
    ctx.fillStyle = '#333';
    ctx.fillRect(eHpX, 36, eHpW, 12);
    const eHpPct = e.hp / e.maxHp;
    ctx.fillStyle = eHpPct > 0.5 ? '#e74c3c' : eHpPct > 0.25 ? '#ffb454' : '#8a3a3a';
    ctx.fillRect(eHpX, 36, eHpW * eHpPct, 12);
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '9px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${e.hp}/${e.maxHp}`, eHpX + eHpW / 2 - 20, 42);
    ctx.textBaseline = 'alphabetic';
  }

  // Player display
  const p = state.player;
  ctx.fillStyle = '#4a9eff';
  ctx.font = 'bold 18px monospace';
  ctx.fillText('🧑 Tú', 15, 12);

  const pHpW = state.width * 0.35;
  ctx.fillStyle = '#333';
  ctx.fillRect(15, 36, pHpW, 12);
  const pHpPct = p.hp / p.maxHp;
  ctx.fillStyle = pHpPct > 0.5 ? '#3a9a5a' : pHpPct > 0.25 ? '#ffb454' : '#e74c3c';
  ctx.fillRect(15, 36, pHpW * pHpPct, 12);
  ctx.fillStyle = '#9aa7b2';
  ctx.font = '9px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${p.hp}/${p.maxHp}`, 15 + pHpW / 2 - 20, 42);
  ctx.textBaseline = 'alphabetic';

  // Divider
  ctx.strokeStyle = '#1e2731';
  ctx.beginPath();
  ctx.moveTo(state.width / 2, 8);
  ctx.lineTo(state.width / 2, 56);
  ctx.stroke();

  // Combat log
  ctx.fillStyle = '#7c8894';
  ctx.font = '10px monospace';
  ctx.textBaseline = 'top';
  const logLines = state.combatLog.slice(-5);
  for (let i = 0; i < logLines.length; i++) {
    ctx.fillText(logLines[i], 15, 62 + i * 16);
  }

  // Combat buttons
  if (state.combatPhase === 'player-choice') {
    const btns = getCombatButtons(state);
    for (const btn of btns) {
      const disabled = (btn.action === 'heal' && p.potions <= 0);
      ctx.fillStyle = disabled ? '#0d1117' : '#11161d';
      ctx.strokeStyle = disabled ? '#1a1f26' : '#1e2731';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);
      ctx.fillStyle = disabled ? '#4a5058' : '#e7edf3';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2);
    }
    ctx.textAlign = 'left';
  } else if (state.combatPhase === 'ai-thinking' || state.combatPhase === 'animating') {
    ctx.fillStyle = '#ffb454';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.combatTurn === 'enemy' ? t('swords.enemyTurn') : t('swords.combatLogPlaceholder'), state.width / 2, state.height - 30);
    ctx.textAlign = 'left';
  }
}

/**
 * Renderiza la tienda
 */
export function renderShop(ctx, state) {
  renderBackButton(ctx, state);

  ctx.fillStyle = '#e7edf3';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(t('swords.shop'), 15, 12);

  const categories = ['weapons', 'armor', 'items'];
  const catLabels = ['🗡️ Armas', '🛡️ Armaduras', '🧪 Objetos'];

  if (!state.shopCategory) {
    // Category buttons
    const catBtns = getCategoryButtons(state);
    for (let i = 0; i < catBtns.length; i++) {
      ctx.fillStyle = '#11161d';
      ctx.strokeStyle = '#1e2731';
      ctx.fillRect(catBtns[i].x, catBtns[i].y, catBtns[i].width, catBtns[i].height);
      ctx.strokeRect(catBtns[i].x, catBtns[i].y, catBtns[i].width, catBtns[i].height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = '13px monospace';
      ctx.textBaseline = 'middle';
      ctx.fillText(catLabels[i], catBtns[i].x + 10, catBtns[i].y + catBtns[i].height / 2);
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '10px monospace';
      ctx.fillText(`(${EQUIPMENT[categories[i]].length} items)`, catBtns[i].x + 120, catBtns[i].y + catBtns[i].height / 2);
    }
  } else {
    // Back to categories button
    const backCat = { x: 10, y: 60, width: 130, height: 22 };
    ctx.fillStyle = '#11161d';
    ctx.strokeStyle = '#1e2731';
    ctx.fillRect(backCat.x, backCat.y, backCat.width, backCat.height);
    ctx.strokeRect(backCat.x, backCat.y, backCat.width, backCat.height);
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '9px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText('← CATEGORÍAS', backCat.x + 8, backCat.y + backCat.height / 2);

    // Items
    const items = EQUIPMENT[state.shopCategory];
    const itemBtns = getShopItemButtons(state, items);
    for (let i = 0; i < itemBtns.length; i++) {
      const item = items[i];
      const owned = isItemOwned(state.player, state.shopCategory, item);
      const canAfford = state.player.gold >= item.cost;

      ctx.fillStyle = owned ? '#1a2a1a' : canAfford ? '#11161d' : '#0d1117';
      ctx.strokeStyle = owned ? '#3a5a3a' : '#1e2731';
      ctx.fillRect(itemBtns[i].x, itemBtns[i].y, itemBtns[i].width, itemBtns[i].height);
      ctx.strokeRect(itemBtns[i].x, itemBtns[i].y, itemBtns[i].width, itemBtns[i].height);

      ctx.fillStyle = '#e7edf3';
      ctx.font = '11px monospace';
      ctx.textBaseline = 'top';
      ctx.fillText(`${item.icon || '?'} ${item.name}`, itemBtns[i].x + 8, itemBtns[i].y + 6);

      if (state.shopCategory === 'weapons') {
        ctx.fillStyle = '#7c8894';
        ctx.font = '9px monospace';
        ctx.fillText(`ATQ+${item.strBonus} ARQ+${item.archBonus}`, itemBtns[i].x + 8, itemBtns[i].y + 22);
      } else if (state.shopCategory === 'armor') {
        ctx.fillStyle = '#7c8894';
        ctx.font = '9px monospace';
        ctx.fillText(`DEF+${item.defBonus}`, itemBtns[i].x + 8, itemBtns[i].y + 22);
      } else if (item.desc) {
        ctx.fillStyle = '#7c8894';
        ctx.font = '9px monospace';
        ctx.fillText(item.desc, itemBtns[i].x + 8, itemBtns[i].y + 22);
      }

      // Price / Owned tag
      ctx.textAlign = 'right';
      ctx.font = 'bold 10px monospace';
      if (owned) {
        ctx.fillStyle = '#3a9a5a';
        ctx.fillText('✓ EQUIPADO', itemBtns[i].x + itemBtns[i].width - 8, itemBtns[i].y + 8);
      } else if (canAfford) {
        ctx.fillStyle = '#ffd700';
        ctx.fillText(`💰${item.cost}`, itemBtns[i].x + itemBtns[i].width - 8, itemBtns[i].y + 8);
      } else {
        ctx.fillStyle = '#e74c3c';
        ctx.fillText(`💰${item.cost}`, itemBtns[i].x + itemBtns[i].width - 8, itemBtns[i].y + 8);
      }
      ctx.textAlign = 'left';
    }
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function renderBackButton(ctx, _state) {
  const backBtn = { x: 10, y: 8, width: 80, height: 24 };
  ctx.fillStyle = '#11161d';
  ctx.strokeStyle = '#1e2731';
  ctx.fillRect(backBtn.x, backBtn.y, backBtn.width, backBtn.height);
  ctx.strokeRect(backBtn.x, backBtn.y, backBtn.width, backBtn.height);
  ctx.fillStyle = '#9aa7b2';
  ctx.font = '10px monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('← VOLVER', backBtn.x + 6, backBtn.y + backBtn.height / 2);
}

export function getSceneButtons(state) {
  const count = SCENES.length;
  const btnW = Math.min(160, (state.width - 60) / count);
  const btnH = 40;
  const totalW = count * btnW + (count - 1) * 10;
  const startX = (state.width - totalW) / 2;
  const y = state.height - 60;
  return SCENES.map((_, i) => ({
    x: startX + i * (btnW + 10), y,
    width: btnW, height: btnH,
  }));
}

export function getStatButtons(state) {
  const stats = ['str', 'agi', 'end', 'arch'];
  const labels = ['💪', '💨', '🛡️', '🏹'];
  const startX = state.width * 0.55;
  const startY = 80;
  return stats.map((s, i) => ({
    x: startX, y: startY + i * 26, width: 140, height: 22,
    stat: s, label: `${labels[i]} ${s.toUpperCase()}`,
  }));
}

export function getRestButton(state) {
  if (state.currentScene !== 'home') return null;
  return { x: state.width * 0.55, y: 190, width: 140, height: 28 };
}

function getCombatButtons(state) {
  const btnW = Math.min(130, (state.width - 50) / 4);
  const btnH = 36;
  const gap = 6;
  const totalW = 4 * btnW + 3 * gap;
  const startX = (state.width - totalW) / 2;
  const y = state.height - 50;

  return [
    { action: 'attack', label: t('swords.combatAttack'), x: startX, y, width: btnW, height: btnH },
    { action: 'archery', label: t('swords.combatArchery'), x: startX + 1 * (btnW + gap), y, width: btnW, height: btnH },
    { action: 'defend', label: t('swords.combatDefend'), x: startX + 2 * (btnW + gap), y, width: btnW, height: btnH },
    { action: 'heal', label: t('swords.combatHeal', { n: state.player.potions }), x: startX + 3 * (btnW + gap), y, width: btnW, height: btnH },
  ];
}

function getCategoryButtons(state) {
  const btnH = 40;
  const btnW = state.width * 0.84;
  const startX = state.width * 0.08;
  const startY = 70;
  const gap = 8;
  return ['weapons', 'armor', 'items'].map((_, i) => ({
    x: startX, y: startY + i * (btnH + gap),
    width: btnW, height: btnH,
  }));
}

function getShopItemButtons(state, items) {
  if (!items) return [];
  return items.map((_, i) => ({
    x: 10, y: 90 + i * 44,
    width: state.width - 20, height: 40,
  }));
}

function isItemOwned(player, category, item) {
  if (category === 'weapons') return player.weapon.id === item.id;
  if (category === 'armor') return player.armor.id === item.id;
  return false;
}
