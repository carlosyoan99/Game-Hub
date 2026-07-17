/**
 * Guitar Hero — Renderizado, efectos visuales y partículas
 *
 * Extraído de GuitarHero.js. Contiene todas las funciones
 * de dibujo: selección, highway, notas, HUD, efectos de fondo.
 */

import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { LANE_COUNT, LANE_NAMES, LANE_COLORS, NOTE_HEIGHT, HIT_ZONE_Y_RATIO, SONG_DEFS, getLaneX } from './notes.js';
import { MAX_HP, getComboMultiplier } from './judge.js';

const _rn = rng => rng ? rng.next() : Math.random();

// ─── Efectos de partículas ─────────────────────────────────────────


export function spawnHitExplosion(particles, stars, x, y, color, type, rng) {
  if (type === 'perfect') {
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 80 + _rn(rng) * 120;
      particles.push({
        x, y, radius: 2 + _rn(rng) * 3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + _rn(rng) * 0.4,
        color: i % 3 === 0 ? '#ffd700' : color,
      });
    }
    for (let i = 0; i < 6; i++) {
      stars.push({
        x, y,
        vx: (_rn(rng) - 0.5) * 60,
        vy: -_rn(rng) * 100 - 40,
        life: 0.6 + _rn(rng) * 0.3,
        size: 4 + _rn(rng) * 4,
        rotation: _rn(rng) * Math.PI * 2,
        rotSpeed: (_rn(rng) - 0.5) * 8,
      });
    }
  } else if (type === 'good') {
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const speed = 50 + _rn(rng) * 80;
      particles.push({
        x, y, radius: 2 + _rn(rng) * 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.3 + _rn(rng) * 0.3,
        color,
      });
    }
  } else if (type === 'miss') {
    for (let i = 0; i < 15; i++) {
      const angle = _rn(rng) * Math.PI * 2;
      const speed = 60 + _rn(rng) * 140;
      particles.push({
        x, y, radius: 2 + _rn(rng) * 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 0.2 + _rn(rng) * 0.3,
        color: _rn(rng) > 0.5 ? '#ff4d4d' : '#ff6b4a',
      });
    }
  }
}

export function spawnNoteStreak(streakParticles, lane, y, width, rng) {
  const lx = getLaneX(lane, width);
  const color = LANE_COLORS[lane];
  for (let i = 0; i < 3; i++) {
    streakParticles.push({
      x: lx + (_rn(rng) - 0.5) * 20,
      y: y + NOTE_HEIGHT,
      vx: (_rn(rng) - 0.5) * 20,
      vy: 80 + _rn(rng) * 60,
      life: 0.2 + _rn(rng) * 0.2,
      color,
      alpha: 0.2,
    });
  }
}

// ─── Actualización de partículas ───────────────────────────────────

export function updateStars(stars, dt) {
  for (const s of stars) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 200 * dt;
    s.rotation += s.rotSpeed * dt;
    s.life -= dt;
  }
  return stars.filter(s => s.life > 0);
}

export function updateStreaks(streaks, dt) {
  for (const s of streaks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
  }
  return streaks.filter(s => s.life > 0);
}

// ─── Render ────────────────────────────────────────────────────────

export function renderBackgroundEffects(ctx, width, height, equalizer, beatFlash) {
  const eqX = 4;
  const eqY = height * 0.3;
  const eqW = 6;
  const eqMaxH = height * 0.4;
  const hue = 200 + Math.sin(Date.now() * 0.001) * 30;

  for (let i = 0; i < 4; i++) {
    const h = Math.max(4, (equalizer[i] || 10) / 40 * eqMaxH);
    ctx.fillStyle = `hsl(${hue + i * 20}, 70%, ${50 + beatFlash * 20}%)`;
    ctx.fillRect(eqX + i * (eqW + 2), eqY + eqMaxH - h, eqW, h);
  }

  const eqX2 = width - 4 - eqW * 4 - 3 * 2;
  for (let i = 0; i < 4; i++) {
    const h = Math.max(4, (equalizer[i + 4] || 10) / 40 * eqMaxH);
    ctx.fillStyle = `hsl(${hue + 60 + i * 20}, 70%, ${50 + beatFlash * 20}%)`;
    ctx.fillRect(eqX2 + i * (eqW + 2), eqY + eqMaxH - h, eqW, h);
  }

  const sweepTime = Date.now() * 0.0003;
  for (let i = 0; i < 3; i++) {
    const sweepX = (Math.sin(sweepTime + i * 2.1) * 0.4 + 0.5) * width;
    const alpha = 0.04 + Math.sin(sweepTime * 0.7 + i) * 0.02;
    const lightHues = [0, 220, 280];
    ctx.fillStyle = `hsl(${lightHues[i]}, 80%, 60%)`;
    ctx.globalAlpha = Math.max(0, alpha + beatFlash * 0.05);
    ctx.beginPath();
    ctx.moveTo(sweepX - 80, 0);
    ctx.lineTo(sweepX + 80, 0);
    ctx.lineTo(sweepX + 40, height);
    ctx.lineTo(sweepX - 40, height);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const audY = height - 55;
  const audH = 50;
  const audColors = ['#1a1a2a', '#1a1a1a', '#22223a', '#1a1a2a', '#2a1a2a'];
  for (let col = 0; col < Math.ceil(width / 16); col++) {
    const ax = col * 16;
    const colorIdx = (col + Math.floor(Date.now() * 0.0005)) % audColors.length;
    ctx.fillStyle = audColors[colorIdx];
    ctx.beginPath();
    ctx.arc(ax + 8, audY + 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(ax + 2, audY + 15, 12, audH - 15);
    if (col % 3 === 0) ctx.fillRect(ax - 4, audY + 2, 6, 10);
    else if (col % 3 === 1) ctx.fillRect(ax + 14, audY + 2, 6, 10);
  }

  if (beatFlash > 0) {
    ctx.fillStyle = `rgba(255, 255, 255, ${beatFlash * 0.03})`;
    ctx.fillRect(0, 0, width, height);
  }
}

export function renderHighway(ctx, width, height, hitZoneY, starPowerActive) {
  const laneW = width / (LANE_COUNT + 1);

  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const lx = getLaneX(lane, width) - laneW / 3;
    const lw = laneW * 2 / 3;
    ctx.fillStyle = lane % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
    ctx.fillRect(lx, 0, lw, height);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lx, 0);
    ctx.lineTo(lx, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lx + lw, 0);
    ctx.lineTo(lx + lw, height);
    ctx.stroke();
  }

  // Hit zone
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, hitZoneY - 40, width, 80);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, hitZoneY);
  ctx.lineTo(width, hitZoneY);
  ctx.stroke();

  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const lx = getLaneX(lane, width);
    ctx.fillStyle = LANE_COLORS[lane];
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.moveTo(lx, hitZoneY - 8);
    ctx.lineTo(lx + 6, hitZoneY);
    ctx.lineTo(lx, hitZoneY + 8);
    ctx.lineTo(lx - 6, hitZoneY);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  if (starPowerActive) {
    const alpha = 0.1 + Math.sin(Date.now() * 0.01) * 0.05;
    ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
    ctx.fillRect(0, 0, width, height);
  }
}

export function renderNotes(ctx, activeNotes, laneW, width) {
  for (const n of activeNotes) {
    if (n.hit || n.missed) continue;
    const lx = getLaneX(n.lane, width);
    const lw = laneW * 0.4;
    const ny = n.y;
    const radius = 4;

    ctx.fillStyle = LANE_COLORS[n.lane];
    ctx.beginPath();
    ctx.moveTo(lx - lw / 2 + radius, ny);
    ctx.lineTo(lx + lw / 2 - radius, ny);
    ctx.quadraticCurveTo(lx + lw / 2, ny, lx + lw / 2, ny + radius);
    ctx.lineTo(lx + lw / 2, ny + NOTE_HEIGHT - radius);
    ctx.quadraticCurveTo(lx + lw / 2, ny + NOTE_HEIGHT, lx + lw / 2 - radius, ny + NOTE_HEIGHT);
    ctx.lineTo(lx - lw / 2 + radius, ny + NOTE_HEIGHT);
    ctx.quadraticCurveTo(lx - lw / 2, ny + NOTE_HEIGHT, lx - lw / 2, ny + NOTE_HEIGHT - radius);
    ctx.lineTo(lx - lw / 2, ny + radius);
    ctx.quadraticCurveTo(lx - lw / 2, ny, lx - lw / 2 + radius, ny);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(lx - lw / 2 + 3, ny + 3, lw - 6, 5);

    if (n.chord) {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.strokeRect(lx - lw / 2 - 2, ny - 2, lw + 4, NOTE_HEIGHT + 4);
    }
  }
}

export function renderParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.4);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius || 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function renderStars(ctx, stars) {
  for (const s of stars) {
    ctx.save();
    if (ctx.rotate) {
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rotation);
    }
    ctx.globalAlpha = Math.max(0, s.life / 0.6);
    ctx.fillStyle = '#ffd700';
    const size = s.size;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.3, -size * 0.3);
    ctx.lineTo(size, 0);
    ctx.lineTo(size * 0.3, size * 0.3);
    ctx.lineTo(0, size);
    ctx.lineTo(-size * 0.3, size * 0.3);
    ctx.lineTo(-size, 0);
    ctx.lineTo(-size * 0.3, -size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

export function renderStreaks(ctx, streaks) {
  for (const s of streaks) {
    ctx.globalAlpha = Math.max(0, s.life / 0.2) * 0.3;
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

export function renderHUD(ctx, state) {
  const { width, height } = state;
  const hitZoneY = height * HIT_ZONE_Y_RATIO;

  setupHUDContext(ctx);
  ctx.fillText(t('guitarhero.score', { n: state.score }), 10, 10);

  if (state.combo >= 5) {
    const mult = getComboMultiplier(state.combo, state.starPowerActive);
    ctx.fillStyle = state.starPowerActive ? '#ffd700' : '#ffb454';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(t('guitarhero.score2x', { n: mult }), 10, 30);
    ctx.font = '14px monospace';
    ctx.fillStyle = '#9aa7b2';
    ctx.fillText(`${state.combo} notes`, 10, 48);
  }

  const hpBarW = 150, hpBarH = 12, hpY = 10, hpX = width - hpBarW - 10;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(hpX, hpY, hpBarW, hpBarH);
  const hpPct = state.hp / MAX_HP;
  ctx.fillStyle = state.isPractice ? '#38b8e8' : (hpPct > 0.5 ? '#3a9a5a' : hpPct > 0.25 ? '#ffb454' : '#e74c3c');
  ctx.fillRect(hpX + 1, hpY + 1, (hpBarW - 2) * hpPct, hpBarH - 2);
  ctx.fillStyle = '#9aa7b2';
  ctx.font = '9px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(state.isPractice ? t('guitarhero.practice') : t('guitarhero.hp'), hpX + hpBarW, hpY - 2);

  const spBarW = 100, spBarH = 6, spY = 28;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(hpX, spY, spBarW, spBarH);
  ctx.fillStyle = state.starPowerActive ? '#ffd700' : '#c848d8';
  ctx.fillRect(hpX + 1, spY + 1, (spBarW - 2) * (state.starPower / 100), spBarH - 2);
  if (state.starPowerActive) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(t('guitarhero.starpower'), hpX + spBarW, spY + spBarH + 4);
  }

  const progW = width - 40, progX = 20, progY = height - 12;
  const progress = Math.min(1, state.songTime / state.song.length);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(progX, progY, progW, 4);
  ctx.fillStyle = state.starPowerActive ? '#ffd700' : (state.isPractice ? '#38b8e8' : '#4a9eff');
  ctx.fillRect(progX + 1, progY + 1, (progW - 2) * progress, 2);

  ctx.fillStyle = '#7c8894';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  const speedLabel = state.isPractice ? ` @ ${Math.round(state.practiceSpeed * 100)}%` : '';
  ctx.fillText(`${state.song.name} | ${state.song.bpm} BPM${speedLabel}`, width / 2, 10);

  if (state.isPractice) {
    ctx.fillStyle = '#38b8e8';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t('guitarhero.practice'), width / 2, 22);
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = '14px monospace';
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const lx = getLaneX(lane, width);
    ctx.fillStyle = LANE_COLORS[lane];
    ctx.globalAlpha = 0.6;
    ctx.fillText(LANE_NAMES[lane], lx, hitZoneY - 12);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  if (state.highscore > 0) {
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(t('game.record', { n: state.highscore }), 10, height - 24);
  }
}

/**
 * Renderizado completo del juego: compone todas las sub-funciones
 */
export function renderGame(ctx, state) {
  const { width, height } = state;
  const hitZoneY = height * HIT_ZONE_Y_RATIO;
  const laneW = width / (LANE_COUNT + 1);

  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(0, 0, width, height);

  renderBackgroundEffects(ctx, width, height, state.equalizer, state.beatFlash);
  renderHighway(ctx, width, height, hitZoneY, state.starPowerActive);
  renderNotes(ctx, state.activeNotes, laneW, width);
  renderParticles(ctx, state.particles);
  renderStars(ctx, state.stars);
  renderStreaks(ctx, state.streakParticles);

  // Hit zone glow
  if (state.starPowerActive) {
    ctx.fillStyle = `rgba(255, 215, 0, ${0.05 + Math.sin(Date.now() * 0.01) * 0.03})`;
    ctx.fillRect(0, hitZoneY - 5, width, 10);
  }

  // Judgment text
  if (state.judgmentTimer > 0 && state.judgmentText) {
    const alpha = Math.min(1, state.judgmentTimer * 3);
    ctx.fillStyle = state.judgmentText.color;
    ctx.globalAlpha = alpha;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state.judgmentText.text, width / 2, height * HIT_ZONE_Y_RATIO - 60);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;
  }

  renderHUD(ctx, state);

  // Paused overlay
  if (state.paused) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('game.paused'), width / 2, height / 2);
    ctx.textAlign = 'left';
  }

  // Game over / victory / practice result
  if (state.phase === 'won' || state.phase === 'lost' || state.phase === 'prac-result') {
    const isPractice = state.isPractice;
    if (state.phase === 'prac-result' || state.phase === 'won') {
      const accuracy = state.totalNotes > 0 ? Math.round((state.notesHit / state.totalNotes) * 100) : 0;
      renderOverlay(ctx, {
        width, height,
        title: isPractice ? t('guitarhero.practiceComplete') : t('guitarhero.victory'),
        subtitle: `${t('guitarhero.score', { n: state.score })} | ${t('guitarhero.accuracy', { n: accuracy })} | ${t('guitarhero.notesHit', { n: state.notesHit, m: state.totalNotes, p: accuracy })}`,
        actionText: t('game.restart'),
      });
    } else {
      renderOverlay(ctx, {
        width, height,
        title: t('guitarhero.gameOver'),
        score: state.score,
        actionText: t('guitarhero.tryAgain'),
      });
    }
  }
}

export function renderSelect(ctx, width, height, selectedSong, selectBlink, practiceSpeed) {
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('guitarhero.select'), width / 2, 40);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  const allCards = [];
  for (const def of SONG_DEFS) allCards.push({ type: 'song', def, isPractice: false });
  allCards.push({ type: 'practice', isPractice: true });

  const cardW = 144, cardH = 220, gap = 10;
  const totalCards = allCards.length;
  const totalW = totalCards * cardW + (totalCards - 1) * gap;
  const startX = Math.max(10, (width - totalW) / 2);
  const startY = 90;

  for (let i = 0; i < totalCards; i++) {
    const x = startX + i * (cardW + gap);
    const y = startY;
    const isSelected = i === selectedSong;
    const card = allCards[i];

    ctx.fillStyle = isSelected ? '#1a1a2a' : '#11161d';
    ctx.fillRect(x, y, cardW, cardH);
    const borderColor = isSelected
      ? (card.isPractice ? '#38b8e8' : card.def?.color || '#2a3a4a')
      : '#2a3a4a';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.strokeRect(x, y, cardW, cardH);

    if (isSelected) {
      ctx.fillStyle = `${borderColor}15`;
      ctx.fillRect(x + 2, y + 2, cardW - 4, cardH - 4);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (card.isPractice) {
      ctx.fillStyle = '#38b8e8';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(t('guitarhero.practice'), x + cardW / 2, y + 30);
      ctx.strokeStyle = '#38b8e8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + cardW / 2, y + 75, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#38b8e8';
      ctx.font = '28px monospace';
      ctx.fillText('▶', x + cardW / 2 + 2, y + 75);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${Math.round(practiceSpeed * 100)}%`, x + cardW / 2, y + 115);
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '10px monospace';
      ctx.fillText('↑↓ speed', x + cardW / 2, y + 135);
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.fillText(t('guitarhero.practicedesc'), x + cardW / 2, y + 160);
      ctx.font = '11px monospace';
      ctx.fillStyle = '#38b8e8';
      ctx.fillText(t('guitarhero.nohp'), x + cardW / 2, y + 180);
    } else {
      const def = card.def;
      ctx.fillStyle = def.color;
      ctx.fillRect(x + cardW / 2 - 24, y + 25, 48, 70);
      ctx.fillStyle = '#1a1a1a';
      for (let f = 0; f < 4; f++) ctx.fillRect(x + cardW / 2 - 22, y + 30 + f * 14, 44, 2);
      ctx.strokeStyle = '#7c8894';
      ctx.lineWidth = 1;
      for (let s = 0; s < 5; s++) {
        ctx.beginPath();
        ctx.moveTo(x + cardW / 2 - 20 + s * 10, y + 27);
        ctx.lineTo(x + cardW / 2 - 20 + s * 10, y + 93);
        ctx.stroke();
      }
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(def.name, x + cardW / 2, y + 115);
      ctx.fillStyle = def.color;
      ctx.font = '10px monospace';
      ctx.fillText(def.style, x + cardW / 2, y + 132);
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '10px monospace';
      ctx.fillText(`${def.bpm} BPM`, x + cardW / 2, y + 148);
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.fillText(t(`guitarhero.${['easy', 'medium', 'hard'][def.difficulty]}`), x + cardW / 2, y + 163);
      ctx.font = '9px monospace';
      ctx.fillStyle = '#5a6a7a';
      ctx.fillText(`~${Math.floor(def.length * def.bpm / 60 * def.density)} notes`, x + cardW / 2, y + 178);
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.6;
      ctx.font = '14px monospace';
      ctx.fillText(def.desc, x + cardW / 2, y + 200);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  if (Math.floor(selectBlink * 4) % 2 === 0) {
    const selX = startX + selectedSong * (cardW + gap);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.06)';
    ctx.fillRect(selX, startY, cardW, cardH);
    const blinkColor = selectedSong >= SONG_DEFS.length ? '#38b8e8' : '#ffd700';
    ctx.strokeStyle = blinkColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(selX, startY, cardW, cardH);
  }

  ctx.fillStyle = '#9aa7b2';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('← → para elegir  |  Espacio/Enter para empezar', width / 2, height - 30);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
