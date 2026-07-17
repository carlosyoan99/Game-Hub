/**
 * Henry Stickmin — Renderizado: stickman, texto, escenas y finales
 */
import { t } from '../../engine/i18n.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { SCENES } from './constants.js';

/**
 * Renderiza el stickman según su pose
 */
function renderStickman(ctx, pose, x, y) {
  const size = 30;

  ctx.fillStyle = '#e7edf3';
  ctx.beginPath();
  ctx.arc(x, y - size * 0.6, size * 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0b0f14';
  switch (pose) {
    case 'thinking':
      ctx.fillRect(x - 8, y - size * 0.65, 2, 2);
      ctx.fillRect(x + 6, y - size * 0.65, 2, 2);
      ctx.strokeStyle = '#e7edf3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.25, y - size * 0.3);
      ctx.lineTo(x + size * 0.4, y);
      ctx.stroke();
      break;
    case 'dancing':
      ctx.fillRect(x - 8, y - size * 0.7, 2, 3);
      ctx.fillRect(x + 6, y - size * 0.7, 2, 3);
      ctx.strokeStyle = '#e7edf3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + size * 0.3, y - size * 0.2);
      ctx.lineTo(x + size * 0.6, y - size * 0.7);
      ctx.moveTo(x - size * 0.3, y - size * 0.2);
      ctx.lineTo(x - size * 0.6, y - size * 0.7);
      ctx.stroke();
      break;
    case 'running':
    case 'driving':
      ctx.fillRect(x - 7, y - size * 0.65, 3, 2);
      ctx.fillRect(x + 5, y - size * 0.65, 3, 2);
      ctx.fillRect(x - 8, y - size * 0.65, 2, 2);
      ctx.fillRect(x + 6, y - size * 0.65, 2, 2);
      break;
    case 'flying':
    case 'tripping':
      ctx.beginPath();
      ctx.arc(x - 6, y - size * 0.65, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 6, y - size * 0.65, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'ko':
    case 'injured':
      ctx.strokeStyle = '#0b0f14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 10, y - size * 0.72);
      ctx.lineTo(x - 4, y - size * 0.58);
      ctx.moveTo(x - 4, y - size * 0.72);
      ctx.lineTo(x - 10, y - size * 0.58);
      ctx.moveTo(x + 4, y - size * 0.72);
      ctx.lineTo(x + 10, y - size * 0.58);
      ctx.moveTo(x + 10, y - size * 0.72);
      ctx.lineTo(x + 4, y - size * 0.58);
      ctx.stroke();
      break;
    case 'facepalm':
      ctx.fillStyle = '#0b0f14';
      ctx.fillRect(x - 6, y - size * 0.65, 2, 2);
      ctx.fillRect(x + 4, y - size * 0.65, 2, 2);
      ctx.strokeStyle = '#e7edf3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y - size * 0.5, size * 0.3, 0, Math.PI, false);
      ctx.stroke();
      break;
    default:
      ctx.fillRect(x - 6, y - size * 0.65, 2, 2);
      ctx.fillRect(x + 4, y - size * 0.65, 2, 2);
      break;
  }

  ctx.strokeStyle = '#e7edf3';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.4);
  ctx.lineTo(x, y + size * 0.2);
  ctx.stroke();

  ctx.beginPath();
  switch (pose) {
    case 'running':
    case 'driving':
      ctx.moveTo(x, y + size * 0.2);
      ctx.lineTo(x - size * 0.25, y + size * 0.6);
      ctx.moveTo(x, y + size * 0.2);
      ctx.lineTo(x + size * 0.3, y + size * 0.5);
      break;
    case 'dancing':
      ctx.moveTo(x, y + size * 0.2);
      ctx.lineTo(x - size * 0.3, y + size * 0.7);
      ctx.moveTo(x, y + size * 0.2);
      ctx.lineTo(x + size * 0.3, y + size * 0.5);
      break;
    case 'flying':
      ctx.moveTo(x, y + size * 0.2);
      ctx.lineTo(x - size * 0.4, y + size * 0.4);
      ctx.moveTo(x, y + size * 0.2);
      ctx.lineTo(x + size * 0.4, y + size * 0.4);
      break;
    default:
      ctx.moveTo(x, y + size * 0.2);
      ctx.lineTo(x - size * 0.2, y + size * 0.6);
      ctx.moveTo(x, y + size * 0.2);
      ctx.lineTo(x + size * 0.2, y + size * 0.6);
      break;
  }
  ctx.stroke();

  ctx.beginPath();
  switch (pose) {
    case 'crawling':
      ctx.moveTo(x - size * 0.3, y + size * 0.1);
      ctx.lineTo(x + size * 0.5, y - size * 0.4);
      ctx.moveTo(x + size * 0.3, y + size * 0.1);
      ctx.lineTo(x - size * 0.5, y + size * 0.4);
      break;
    case 'holding_tool':
      ctx.moveTo(x - size * 0.2, y - size * 0.3);
      ctx.lineTo(x + size * 0.7, y - size * 0.2);
      ctx.moveTo(x + size * 0.7, y - size * 0.2);
      ctx.lineTo(x + size * 0.8, y - size * 0.5);
      ctx.moveTo(x + size * 0.8, y - size * 0.5);
      ctx.lineTo(x + size * 0.6, y - size * 0.6);
      break;
    case 'reaching':
      ctx.moveTo(x, y - size * 0.2);
      ctx.lineTo(x + size * 0.6, y - size * 0.6);
      ctx.moveTo(x, y - size * 0.2);
      ctx.lineTo(x - size * 0.3, y - size * 0.3);
      break;
    default:
      ctx.moveTo(x - size * 0.3, y - size * 0.1);
      ctx.lineTo(x + size * 0.3, y + size * 0.1);
      ctx.moveTo(x + size * 0.3, y - size * 0.1);
      ctx.lineTo(x - size * 0.3, y + size * 0.1);
      break;
  }
  ctx.stroke();

  ctx.fillStyle = '#2a3a5a';
  switch (pose) {
    case 'nervous':
      ctx.save();
      ctx.translate(x - 5, y - size * 0.8);
      ctx.rotate(0.15);
      ctx.fillRect(-10, -4, 20, 4);
      ctx.fillRect(-6, -8, 12, 6);
      ctx.restore();
      break;
    case 'sweating':
      ctx.fillRect(x - 8, y - size * 0.82, 16, 4);
      ctx.fillRect(x - 5, y - size * 0.88, 10, 6);
      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(x + 15, y - size * 0.75, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'walking_away':
      ctx.fillRect(x - 8, y - size * 0.82, 16, 4);
      ctx.fillRect(x - 5, y - size * 0.9, 10, 8);
      ctx.strokeStyle = '#0b0f14';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 12, y - size * 0.62);
      ctx.lineTo(x + 12, y - size * 0.62);
      ctx.stroke();
      ctx.fillRect(x - 10, y - size * 0.7, 8, 5);
      ctx.fillRect(x + 2, y - size * 0.7, 8, 5);
      break;
    default:
      ctx.fillRect(x - 8, y - size * 0.82, 16, 4);
      ctx.fillRect(x - 5, y - size * 0.88, 10, 6);
      break;
  }

  ctx.fillStyle = '#7c8894';
  ctx.font = '9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('▼ Henry Stickmin', x, y + 15 + 4);
  ctx.textAlign = 'left';
}

/**
 * Dibuja texto envuelto en un ancho máximo
 */
function drawWrappedText(ctx, text, cx, cy, maxWidth) {
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);

  const lineH = 14;
  const startY = cy - ((lines.length - 1) * lineH) / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, startY + i * lineH);
  }
}

/**
 * Renderiza el texto de la escena con efecto máquina de escribir
 */
function renderSceneText(ctx, state, _scene) {
  const textY = 300;
  const textX = 30;
  const maxW = state.width - 60;
  const lineH = 20;

  const fullText = state.textLines.join('\n');
  const visibleText = fullText.slice(0, state.typeChars);

  const chars = visibleText.length;
  let charsUsed = 0;
  let lineIdx = 0;

  ctx.fillStyle = '#c8d6e5';
  ctx.font = '13px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  for (const line of state.textLines) {
    if (charsUsed >= chars) break;
    const lineChars = Math.min(line.length, chars - charsUsed);
    const partialLine = line.slice(0, lineChars);
    ctx.fillText(partialLine, textX, textY + lineIdx * lineH, maxW);
    charsUsed += line.length + 1;
    lineIdx++;
  }

  if (state.phase === 'text' && state.typeChars < fullText.length) {
    const cursorX = textX + ctx.measureText(visibleText.split('\n').pop() || '').width;
    const cursorY = textY + (lineIdx - 1) * lineH;
    const blink = Math.sin(Date.now() * 0.006) > 0;
    if (blink) {
      ctx.fillStyle = '#ffb454';
      ctx.fillRect(cursorX + 2, cursorY, 2, 15);
    }
  }

  if (state.phase === 'text' && state.typeChars < fullText.length) {
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(t('henry.clickToSkip'), state.width - 24, state.height - 100);
    ctx.textAlign = 'left';
  }

  if (state.phase === 'text' && state.typeChars >= fullText.length) {
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(t('henry.clickToContinue'), state.width - 24, state.height - 100);
    ctx.textAlign = 'left';
  }
}

/**
 * Renderiza la pantalla final con estadísticas
 */
function renderEndScreen(ctx, state) {
  const isSuccess = state.endingDisplay?.type === 'success';
  const title = isSuccess ? t('henry.success') : t('henry.fail');
  renderOverlay(ctx, {
    width: state.width, height: state.height,
    title,
    actionText: t('game.restart'),
  });

  ctx.fillStyle = '#9aa7b2';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const midY = state.height / 2 + 55;
  ctx.fillText(t('henry.endingsFound', { n: state.currentEndings.length }), state.width / 2, midY);
  ctx.fillText(t('henry.totalEndings', { n: state.totalEndingsFound }), state.width / 2, midY + 20);
  if (state.bestEndings !== null) {
    ctx.fillText(t('henry.bestSession', { n: state.bestEndings }), state.width / 2, midY + 40);
  }
  ctx.fillStyle = '#7c8894';
  ctx.font = '11px monospace';
  ctx.fillText(t('henry.keepTrying'), state.width / 2, midY + 60);
  ctx.textAlign = 'left';
}

/**
 * Renderizado completo del juego
 */
export function renderGame(ctx, state) {
  ctx.fillStyle = '#0f1722';
  ctx.fillRect(0, 0, state.width, state.height);

  ctx.strokeStyle = '#2a3a5a';
  ctx.lineWidth = 3;
  ctx.strokeRect(8, 8, state.width - 16, state.height - 16);
  ctx.strokeStyle = '#1e2a42';
  ctx.lineWidth = 1;
  ctx.strokeRect(12, 12, state.width - 24, state.height - 24);

  if (state.phase === 'end_screen') {
    renderEndScreen(ctx, state);
    return;
  }

  const scene = SCENES[state.sceneId];
  if (!scene) return;

  ctx.fillStyle = '#ffb454';
  ctx.font = 'bold 20px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(scene.title, 24, 20);

  ctx.font = '36px monospace';
  ctx.fillStyle = '#e7edf3';
  ctx.textAlign = 'center';
  ctx.fillText(scene.emoji, state.width / 2, 60);

  const vignetteY = 110;
  const vignetteH = Math.min(180, state.height * 0.35);
  ctx.fillStyle = '#111a28';
  ctx.fillRect(24, vignetteY, state.width - 48, vignetteH);
  ctx.strokeStyle = '#1e2a42';
  ctx.lineWidth = 1;
  ctx.strokeRect(24, vignetteY, state.width - 48, vignetteH);

  renderStickman(ctx, scene.stickmanPose, state.width / 2, vignetteY + vignetteH / 2);

  if (state.phase === 'text' || state.phase === 'choices') {
    renderSceneText(ctx, state, scene);
  }

  if (state.phase === 'choices') {
    const buttons = state._layoutButtons();
    for (const btn of buttons) {
      ctx.fillStyle = '#141e30';
      ctx.strokeStyle = '#2a3a5a';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

      ctx.fillStyle = '#e7edf3';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      drawWrappedText(ctx, btn.choice.label, btn.x + btn.width / 2, btn.y + btn.height / 2 - 4, btn.width - 10);
      ctx.textAlign = 'left';
    }
  }

  if (state.phase === 'ending' && state.endingDisplay) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, state.width, state.height);

    const isSuccess = state.endingDisplay.type === 'success';
    ctx.fillStyle = isSuccess ? '#3a7d5c' : '#8a3a3a';
    ctx.fillRect(state.width / 2 - 180, state.height / 2 - 70, 360, 140);

    ctx.strokeStyle = isSuccess ? '#5a9d7c' : '#aa5a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(state.width / 2 - 180, state.height / 2 - 70, 360, 140);

    ctx.fillStyle = '#e7edf3';
    ctx.font = `bold ${isSuccess ? '22' : '20'}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isSuccess ? t('henry.success') : t('henry.fail'),
      state.width / 2, state.height / 2 - 45);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#b0c4d8';
    ctx.fillText(state.endingDisplay.text, state.width / 2, state.height / 2 + 5);

    ctx.font = '11px monospace';
    ctx.fillStyle = '#7c8894';
    ctx.fillText(t('game.continue'), state.width / 2, state.height / 2 + 50);
    ctx.textAlign = 'left';
  }
}
