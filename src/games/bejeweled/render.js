/**
 * Bejeweled — Renderizado de gemas, tablero, selección y HUD
 */
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { GRID_COLS, GRID_ROWS, GEM_SIZE, GEM_GAP, GEM_TYPES } from './constants.js';
import { getGemPos } from './board.js';

/**
 * Dibuja una gema individual
 */
function drawGem(ctx, gem, x, y, size) {
  const def = GEM_TYPES[gem.type];
  const margin = 3;

  ctx.fillStyle = def.color;
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(x + margin + r, y + margin);
  ctx.lineTo(x + size - margin - r, y + margin);
  ctx.quadraticCurveTo(x + size - margin, y + margin, x + size - margin, y + margin + r);
  ctx.lineTo(x + size - margin, y + size - margin - r);
  ctx.quadraticCurveTo(x + size - margin, y + size - margin, x + size - margin - r, y + size - margin);
  ctx.lineTo(x + margin + r, y + size - margin);
  ctx.quadraticCurveTo(x + margin, y + size - margin, x + margin, y + size - margin - r);
  ctx.lineTo(x + margin, y + margin + r);
  ctx.quadraticCurveTo(x + margin, y + margin, x + margin + r, y + margin);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + margin + 4, y + margin + 4, size - margin * 2 - 8, 8);

  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(x + size / 2 - 6, y + size / 2 - 6, 6, 0, Math.PI * 2);
  ctx.fill();

  if (gem.special === 'striped') {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(x + margin + 2, y + margin + 2, size - margin * 2 - 4, size - margin * 2 - 4);
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd700';
    drawStar(ctx, x + size / 2, y + size / 2, 5, 8, 4);
  } else if (gem.special === 'bomb') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', x + size / 2, y + size / 2 + 2);
  }
}

/**
 * Dibuja una estrella
 */
function drawStar(ctx, cx, cy, points, outerR, innerR) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Renderiza la pantalla de selección de modo
 */
function renderSelect(ctx, state) {
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('bejeweled.select'), state.width / 2, 40);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const cards = [
    { key: 'classic', label: t('bejeweled.classic'), icon: '🎯', color: '#3a9a5a', desc: '20 movimientos, objetivo 2000pts' },
    { key: 'timeattack', label: t('bejeweled.timeattack'), icon: '⏱', color: '#ffb454', desc: '90 segundos, objetivo 3000pts' },
    { key: 'endless', label: t('bejeweled.endless'), icon: '♾', color: '#4a9eff', desc: 'Sin límites, juega por diversión' },
  ];

  const cardW = 200;
  const cardH = 220;
  const gap = 30;
  const totalW = cards.length * cardW + (cards.length - 1) * gap;
  const startX = (state.width - totalW) / 2;
  const startY = 90;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const x = startX + i * (cardW + gap);
    const y = startY;
    const isSelected = i === state.selectedMode;

    ctx.fillStyle = isSelected ? '#1a1a2a' : '#11161d';
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = isSelected ? card.color : '#2a3a4a';
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.strokeRect(x, y, cardW, cardH);

    if (isSelected) {
      ctx.fillStyle = `${card.color}15`;
      ctx.fillRect(x + 2, y + 2, cardW - 4, cardH - 4);
    }

    ctx.font = '48px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(card.icon, x + cardW / 2, y + 60);

    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(card.label, x + cardW / 2, y + 120);

    ctx.fillStyle = '#9aa7b2';
    ctx.font = '11px monospace';
    ctx.fillText(card.desc, x + cardW / 2, y + 155);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  if (Math.floor(state.selectBlink * 4) % 2 === 0) {
    const selX = startX + state.selectedMode * (cardW + gap);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
    ctx.fillRect(selX, startY, cardW, cardH);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 1;
    ctx.strokeRect(selX, startY, cardW, cardH);
  }

  ctx.fillStyle = '#9aa7b2';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('← → para elegir  |  Espacio/Enter para empezar', state.width / 2, state.height - 30);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Renderiza el HUD
 */
function renderHUD(ctx, state) {
  setupHUDContext(ctx);

  ctx.textAlign = 'center';
  ctx.fillText(t('bejeweled.score', { n: state.score }), state.width / 2, 10);

  ctx.textAlign = 'left';
  if (state.moves > 0) {
    ctx.fillText(t('bejeweled.moves', { n: state.moves }), 10, 10);
  }
  if (state.modeKey === 'timeattack') {
    ctx.textAlign = 'right';
    ctx.fillText(t('bejeweled.time', { n: state.timeRemaining }), state.width - 10, 10);
  }

  if (state.targetScore > 0) {
    ctx.textAlign = 'right';
    ctx.fillText(t('bejeweled.target', { n: state.targetScore }), state.width - 10, 28);
  }

  if (state.combo > 1) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(t('bejeweled.multiplier', { n: Math.min(state.combo, 8) }), state.width / 2, 32);
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#9aa7b2';
  ctx.font = '10px monospace';
  ctx.fillText(t('bejeweled.gems', { n: state.totalGemsCleared }), 10, 28);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  if (state.highscore > 0) {
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.fillText(t('game.record', { n: state.highscore }), 10, state.height - 10);
  }
}

/**
 * Renderiza el estado de juego
 */
function renderPlaying(ctx, state) {
  const totalW = GRID_COLS * (GEM_SIZE + GEM_GAP) - GEM_GAP;
  const totalH = GRID_ROWS * (GEM_SIZE + GEM_GAP) - GEM_GAP;

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(state.boardX - 4, state.boardY - 4, totalW + 8, totalH + 8);

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const gem = state.grid[row]?.[col];
      if (!gem) continue;

      const pos = getGemPos(state, col, row);
      let drawX = pos.x;
      let drawY = pos.y;

      if (state.swapAnim) {
        const s = state.swapAnim;
        const tVal = s.t;
        if (col === s.col1 && row === s.row1) {
          drawX += (getGemPos(state, s.col2, s.row2).x - pos.x) * tVal;
          drawY += (getGemPos(state, s.col2, s.row2).y - pos.y) * tVal;
        } else if (col === s.col2 && row === s.row2) {
          drawX += (getGemPos(state, s.col1, s.row1).x - pos.x) * tVal;
          drawY += (getGemPos(state, s.col1, s.row1).y - pos.y) * tVal;
        }
      }

      drawGem(ctx, gem, drawX, drawY, GEM_SIZE);
    }
  }

  if (state.selectedGem) {
    const pos = getGemPos(state, state.selectedGem.col, state.selectedGem.row);
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 3;
    ctx.strokeRect(pos.x, pos.y, GEM_SIZE, GEM_SIZE);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.fillRect(pos.x, pos.y, GEM_SIZE, GEM_SIZE);
  }

  if (state.cursorCol !== undefined) {
    const pos2 = getGemPos(state, state.cursorCol, state.cursorRow);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(pos2.x, pos2.y, GEM_SIZE, GEM_SIZE);
    ctx.setLineDash([]);
  }

  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.4);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  if (state.messageTimer > 0 && state.messageText) {
    ctx.fillStyle = '#ffd700';
    ctx.globalAlpha = Math.min(1, state.messageTimer * 2);
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.messageText, state.width / 2, state.boardY + totalH + 30);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }

  renderHUD(ctx, state);

  if (state.paused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('game.paused'), state.width / 2, state.height / 2);
  }

  if (state.phase === 'won' || state.phase === 'lost') {
    renderOverlay(ctx, {
      width: state.width, height: state.height,
      title: state.phase === 'won' ? t('bejeweled.victory') : t('bejeweled.gameOver'),
      score: state.score,
      subtitle: `${t('bejeweled.gems', { n: state.totalGemsCleared })} | ${t('bejeweled.multiplier', { n: state.maxCombo })}`,
      actionText: t('game.restart'),
    });
  }
}

/**
 * Renderizado completo del juego
 */
export function renderGame(ctx, state) {
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(0, 0, state.width, state.height);

  if (state.phase === 'select') {
    renderSelect(ctx, state);
    return;
  }

  renderPlaying(ctx, state);
}
