/**
 * Space Harrier — Renderizado (proyección pseudo-3D, escenario, enemigos, HUD)
 */
import { clamp } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { GROUND_OFFSET, HORIZON_Y, Z_NEAR, Z_FAR } from './constants.js';

/**
 * Convierte coordenadas Z (profundidad) en factor de escala y posición Y
 */
export function projectZ(z) {
  const tVal = clamp((z - Z_NEAR) / (Z_FAR - Z_NEAR), 0, 1);
  const scale = 0.15 + (1 - tVal) * 0.85;
  const y = HORIZON_Y + (GROUND_OFFSET - HORIZON_Y) * (1 - tVal);
  return { scale, y, t: tVal };
}

/**
 * Renderiza el cielo con degradado
 */
function renderSky(ctx, width, stageConfig) {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
  skyGrad.addColorStop(0, stageConfig.skyTop);
  skyGrad.addColorStop(1, stageConfig.skyBottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, HORIZON_Y);
}

/**
 * Renderiza nubes decorativas
 */
function renderClouds(ctx, width, groundOffset) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  for (let i = 0; i < 4; i++) {
    const cx = (width * 0.2 + i * width * 0.25 + groundOffset * 0.5) % (width + 80) - 40;
    const cy = 30 + i * 30 + Math.sin(groundOffset * 0.01 + i) * 10;
    ctx.beginPath();
    ctx.arc(cx, cy, 30 + i * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 25, cy - 5, 22 + i * 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renderiza el suelo con efecto pseudo-3D (perspectiva grid)
 */
function renderGround(ctx, width, groundOffset, stageConfig) {
  const stripCount = 20;
  const stripHeight = (GROUND_OFFSET - HORIZON_Y) / stripCount;

  for (let i = 0; i < stripCount; i++) {
    const tVal = i / stripCount;
    const y1 = HORIZON_Y + i * stripHeight;
    const x1 = (width / 2) * (1 - tVal);
    const w1 = width * tVal;

    const stripIdx = Math.floor(i + groundOffset / 4) % 2;
    ctx.fillStyle = stripIdx === 0 ? stageConfig.groundColor1 : stageConfig.groundColor2;
    ctx.fillRect(x1, y1, w1, stripHeight);

    ctx.strokeStyle = stripIdx === 0 ? stageConfig.groundColor2 : stageConfig.groundColor1;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 + w1, y1);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const tx = (i / 11) * 2 - 1;
    const xTop = width / 2 + tx * 20;
    const xBot = width / 2 + tx * width * 0.5;
    ctx.beginPath();
    ctx.moveTo(xTop, HORIZON_Y);
    ctx.lineTo(xBot, GROUND_OFFSET);
    ctx.stroke();
  }
}

/**
 * Renderiza enemigos ordenados por Z (painter's algorithm)
 */
function renderEnemies(ctx, enemies, width) {
  const sorted = [...enemies].sort((a, b) => b.z - a.z);
  for (const e of sorted) {
    if (!e.alive) continue;
    const proj = projectZ(e.z);
    const scale = proj.scale;
    const sw = e.width * scale;
    const sh = e.height * scale;
    const sx = e.worldX * scale + (width / 2 - width / 2 * scale) - sw / 2;
    const sy = proj.y - sh;

    ctx.fillStyle = e.color;
    if (e.type === 'bomber') {
      ctx.beginPath();
      ctx.arc(sx + sw / 2, sy + sh / 2, Math.max(sw, sh) / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5a2a5a';
      ctx.beginPath();
      ctx.arc(sx + sw / 2, sy + sh / 2, Math.max(sw, sh) / 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'turret') {
      ctx.fillRect(sx + 2, sy + sh * 0.3, sw - 4, sh * 0.5);
      ctx.fillRect(sx + sw * 0.2, sy, sw * 0.6, sh * 0.4);
      ctx.fillStyle = '#3a4a2a';
      ctx.fillRect(sx + sw * 0.3, sy + sh * 0.15, sw * 0.4, 3);
    } else {
      ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = '#ffd700';
      const eyeSize = Math.max(2, 4 * scale);
      ctx.fillRect(sx + sw * 0.2, sy + sh * 0.2, eyeSize, eyeSize);
      ctx.fillRect(sx + sw * 0.6, sy + sh * 0.2, eyeSize, eyeSize);
    }
  }
}

/**
 * Renderiza power-ups
 */
function renderPowerups(ctx, powerups, width) {
  for (const pu of powerups) {
    if (!pu.active) continue;
    const proj = projectZ(pu.z);
    const scale = proj.scale * 10;
    const sy = proj.y - scale;
    const sx = pu.x * scale + (width / 2 - width / 2 * scale);
    const pulse = Math.sin(Date.now() * 0.008 + pu.x) * 3;
    ctx.fillStyle = '#4a9eff';
    ctx.beginPath();
    ctx.arc(sx, sy + pulse, Math.max(scale, 6), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = `${Math.max(8, Math.floor(10 * scale))}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', sx, sy + pulse + 1);
  }
}

/**
 * Renderiza el jefe
 */
function renderBoss(ctx, boss, bossBullets, bossZBob, _width) {
  if (!boss || !boss.alive) return;

  const proj = projectZ(boss.z);
  const scale = proj.scale;
  const screenY = proj.y + (bossZBob || 0) * scale;
  const sw = boss.width * scale;
  const sh = boss.height * scale;
  const sx = boss.worldX - sw / 2;
  const hpPct = boss.hp / boss.maxHp;
  const isEnraged = hpPct < 0.3;

  ctx.fillStyle = isEnraged ? '#ff4d4d' : '#8b3a8b';
  ctx.fillRect(sx, screenY - sh, sw, sh);

  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(sx + sw * 0.3, screenY - sh * 0.4, sw * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + sw * 0.7, screenY - sh * 0.4, sw * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(sx + sw * 0.3, screenY - sh * 0.4, sw * 0.04, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx + sw * 0.7, screenY - sh * 0.4, sw * 0.04, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6b2a6b';
  ctx.fillRect(sx - sw * 0.3, screenY - sh * 0.6, sw * 0.3, sh * 0.3);
  ctx.fillRect(sx + sw, screenY - sh * 0.6, sw * 0.3, sh * 0.3);

  const barW = 60;
  const barH = 4;
  const barX = boss.worldX - barW / 2;
  const barY = screenY - sh - 8;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : '#ff6b4a';
  ctx.fillRect(barX + 1, barY + 1, (barW - 2) * hpPct, barH - 2);

  for (const b of bossBullets) {
    if (!b.alive) continue;
    const bp = projectZ(b.z);
    const bs = bp.scale * 8;
    const bsy = bp.y;
    const bsx = b.x;
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(bsx, bsy, bs, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renderiza las balas enemigas proyectadas
 */
function renderEnemyBullets(ctx, enemyBullets, width) {
  for (const b of enemyBullets) {
    const bp = projectZ(b.z);
    const bs = Math.max(2, bp.scale * 8);
    const bsy = bp.y;
    const bx = b.x * bp.scale + (width / 2 - width / 2 * bp.scale);
    ctx.fillStyle = '#ff6b4a';
    ctx.beginPath();
    ctx.arc(bx, bsy, bs, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renderiza las balas del jugador
 */
function renderPlayerBullets(ctx, bullets) {
  for (const b of bullets) {
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = b.color + '60';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renderiza el jugador
 */
function renderPlayer(ctx, player) {
  const shouldDraw = !(player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0);
  if (!shouldDraw) return;

  const px = player.x, py = player.y;
  if (player.charged) {
    ctx.fillStyle = `rgba(255, 215, 0, ${0.3 + Math.sin(Date.now() * 0.015) * 0.2})`;
    ctx.beginPath();
    ctx.arc(px + 12, py + 16, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(px + 2, py + 2, 20, 22);
  ctx.fillStyle = '#d4a574';
  ctx.beginPath();
  ctx.arc(px + 12, py + 6, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a9eff';
  ctx.fillRect(px + 6, py + 20, 12, 10);
  ctx.fillStyle = '#ff6b4a';
  ctx.fillRect(px + 8, py + 30, 8, 6 + Math.random() * 4);
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(px + 10, py + 32, 4, 4 + Math.random() * 3);
  ctx.fillStyle = '#000';
  ctx.fillRect(px + 8, py + 4, 3, 3);
  ctx.fillRect(px + 14, py + 4, 3, 3);
}

/**
 * Renderiza partículas
 */
function renderParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.7);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

/**
 * Renderiza el HUD completo
 */
function renderHUD(ctx, state) {
  setupHUDContext(ctx);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(t('harrier.score', { n: state.score }), 10, 16);
  ctx.fillStyle = '#e7edf3';
  ctx.font = '12px monospace';
  ctx.fillText(t('harrier.lives', { n: state.player.lives }), 10, 34);
  ctx.fillText(t('harrier.power', { n: state.player.power }), 10, 50);
  ctx.fillStyle = '#9aa7b2';
  ctx.font = '12px monospace';
  ctx.fillText(t('harrier.stage', { n: state.currentStage }), state.width / 2 - 30, 12);

  const pwrW = 80;
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(10, 56, pwrW, 5);
  ctx.fillStyle = state.player.power >= state.player.maxPower ? '#ffd700' : '#4a9eff';
  ctx.fillRect(11, 57, (pwrW - 2) * (state.player.power / state.player.maxPower), 3);

  if (state.player.chargeTimer > 0) {
    const chargePct = Math.min(1, state.player.chargeTimer / 1.5);
    ctx.fillStyle = state.player.charged ? '#ffd700' : '#ff6b4a';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      state.player.charged ? t('harrier.charge') + '! READY' : t('harrier.charge'),
      state.width / 2, state.height - 20
    );
    ctx.fillRect(state.width / 2 - 40, state.height - 16, 80, 4);
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(state.width / 2 - 39, state.height - 15, 78, 2);
    ctx.fillStyle = state.player.charged ? '#ffd700' : '#ff6b4a';
    ctx.fillRect(state.width / 2 - 39, state.height - 15, 78 * chargePct, 2);
    ctx.textAlign = 'left';
  }

  const progW = state.width * 0.4;
  const progX = (state.width - progW) / 2;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(progX, 58, progW, 5);
  ctx.fillStyle = state.stageProgress > 0.85 ? '#ff6b4a' : '#4a9eff';
  ctx.fillRect(progX + 1, 59, (progW - 2) * state.stageProgress, 3);

  if (state.boss && state.boss.alive) {
    ctx.fillStyle = '#ff4d4d';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(t('harrier.boss'), state.width / 2, 74);
    ctx.textAlign = 'left';
  }

  if (state.highscore > 0) {
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.fillText(t('game.record', { n: state.highscore }), state.width / 2 - 30, 74);
  }
}

/**
 * Renderiza overlays (intro, stage clear, game over)
 */
function renderOverlays(ctx, state) {
  if (state.phase === 'intro') {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, state.width, state.height);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('harrier.stage', { n: state.currentStage }), state.width / 2, state.height / 2 - 30);
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(t('harrier.go'), state.width / 2, state.height / 2 + 20);
    ctx.textAlign = 'left';
  }

  if (state.phase === 'stage_clear') {
    renderOverlay(ctx, {
      width: state.width, height: state.height,
      title: t('harrier.stageClear'),
      subtitle: `${t('harrier.score', { n: state.stageScore })}`,
      actionText: t('game.continue'),
    });
  }

  if (state.phase === 'won' || state.phase === 'lost') {
    renderOverlay(ctx, {
      width: state.width, height: state.height,
      title: state.phase === 'won' ? t('game.victory') : t('harrier.gameOver'),
      score: state.score,
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

  renderSky(ctx, state.width, state.stageConfig);
  renderClouds(ctx, state.width, state.groundOffset);
  renderGround(ctx, state.width, state.groundOffset, state.stageConfig);
  renderEnemies(ctx, state.enemies, state.width);
  renderPowerups(ctx, state.powerups, state.width);
  renderBoss(ctx, state.boss, state.bossBullets, state.bossZBob, state.width);
  renderEnemyBullets(ctx, state.enemyBullets, state.width);

  renderPlayerBullets(ctx, state.bullets);
  renderPlayer(ctx, state.player);
  renderParticles(ctx, state.particles);
  renderHUD(ctx, state);
  renderOverlays(ctx, state);
}
