/**
 * Golden Axe — Renderizado de sprites y escenarios
 *
 * Extraído de GoldenAxe.js. Contiene todas las funciones
 * de dibujo: fondo, personajes, enemigos, HUD y menús.
 */

import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { CHAR_DEFS } from './constants.js';

/**
 * Renderiza el fondo parallax (montañas, colinas, suelo)
 */
export function renderBackground(ctx, width, height, scrollX) {
  const bgOffset = scrollX * 0.2;
  ctx.fillStyle = '#2a1a3a';
  ctx.fillRect(0, 0, width, height);

  // Mountains (far)
  ctx.fillStyle = '#3a2a4a';
  for (let i = 0; i < 6; i++) {
    const mx = i * 160 - (bgOffset % 160);
    ctx.beginPath();
    ctx.moveTo(mx, height - 100);
    ctx.lineTo(mx + 80, height - 200);
    ctx.lineTo(mx + 160, height - 100);
    ctx.fill();
  }

  // Hills (mid)
  ctx.fillStyle = '#4a3a2a';
  const midOffset = scrollX * 0.4;
  for (let i = 0; i < 5; i++) {
    const hx = i * 200 - (midOffset % 200);
    ctx.beginPath();
    ctx.moveTo(hx, height - 60);
    ctx.quadraticCurveTo(hx + 100, height - 140, hx + 200, height - 60);
    ctx.fill();
  }

  // Ground
  ctx.fillStyle = '#5a4a3a';
  ctx.fillRect(0, height - 60, width, 60);
  ctx.strokeStyle = '#6a5a4a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, height - 60);
  ctx.lineTo(width, height - 60);
  ctx.stroke();

  // Ground detail
  ctx.fillStyle = '#4a3a2a';
  const gOffset = scrollX % 32;
  for (let x = -gOffset; x < width; x += 32) {
    ctx.fillRect(x, height - 4, 16, 4);
  }
}

/**
 * Renderiza todos los enemigos con sus detalles visuales
 */
export function renderEnemies(ctx, enemies, playerX) {
  for (const e of enemies) {
    if (!e.alive) continue;
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x, e.y, e.width, e.height);

    ctx.fillStyle = darkenColor(e.color, 0.7);
    ctx.fillRect(e.x + 2, e.y + 4, e.width - 4, 6);
    ctx.fillRect(e.x + 2, e.y + e.height - 8, e.width - 4, 4);

    ctx.fillStyle = playerX < e.x ? '#ff6b4a' : '#4a9eff';
    ctx.fillRect(e.x + 4, e.y + 8, 4, 4);
    ctx.fillRect(e.x + e.width - 8, e.y + 8, 4, 4);

    if (e.type === 'knight') {
      ctx.fillStyle = '#4a3a5a';
      const shieldX = playerX < e.x ? e.x : e.x + e.width - 10;
      ctx.fillRect(shieldX, e.y + 8, 10, 16);
    }

    if (e.hp < e.maxHp) {
      const hpW = e.width;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x, e.y - 4, hpW, 3);
      ctx.fillStyle = '#ff6b4a';
      ctx.fillRect(e.x + 1, e.y - 3, (hpW - 2) * (e.hp / e.maxHp), 2);
    }
  }
}

/**
 * Renderiza el jugador según su clase
 */
export function renderPlayer(ctx, player) {
  const p = player;
  const def = p.def;
  const cx = p.x + p.width / 2;
  const isWizard = def.id === 'wizard';
  const isBarbarian = def.id === 'barbarian';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse ? ctx.ellipse(cx, p.y + p.height, 14, 4, 0, 0, Math.PI * 2) : ctx.arc(cx, p.y + p.height, 14, 0, Math.PI * 2);
  ctx.fill();

  if (isWizard) {
    // Cape/robe
    ctx.fillStyle = '#2a2a5a';
    ctx.beginPath();
    ctx.moveTo(cx - 12, p.y + 12);
    ctx.lineTo(cx - 16, p.y + 38);
    ctx.lineTo(cx + 16, p.y + 38);
    ctx.lineTo(cx + 12, p.y + 12);
    ctx.fill();

    ctx.fillStyle = def.color;
    ctx.fillRect(cx - 8, p.y + 10, 16, 22);

    ctx.fillStyle = def.skinColor;
    ctx.beginPath();
    ctx.arc(cx, p.y + 8, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2a2a5a';
    ctx.beginPath();
    ctx.moveTo(cx - 8, p.y + 2);
    ctx.lineTo(cx, p.y - 8);
    ctx.lineTo(cx + 8, p.y + 2);
    ctx.fill();

    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(cx + p.facing * 2, p.y + 6, 3, 3);

    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(cx - 7, p.y + 32, 6, 10);
    ctx.fillRect(cx + 1, p.y + 32, 6, 10);

    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(cx + p.facing * 10, p.y + 8, 4, 30);
    ctx.fillStyle = p.magic >= 50 ? '#ffd700' : '#4a9eff';
    ctx.beginPath();
    ctx.arc(cx + p.facing * 12, p.y + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    if (p.magic >= 30) {
      ctx.strokeStyle = `rgba(74, 158, 255, ${0.2 + Math.sin(Date.now() * 0.006) * 0.15})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + p.facing * 12, p.y + 6, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (isBarbarian) {
    // Berserker aura
    if (p.berserkActive) {
      ctx.fillStyle = `rgba(255, 50, 20, ${0.15 + Math.sin(Date.now() * 0.01) * 0.08})`;
      ctx.fillRect(p.x - 6, p.y - 4, p.width + 12, p.height + 8);
    }

    ctx.fillStyle = def.skinColor;
    ctx.beginPath();
    ctx.arc(cx, p.y + 8, 10, 0, Math.PI * 2);
    ctx.fill();

    // Wild hair
    ctx.fillStyle = '#3a2a1a';
    const hairWave = Math.sin(Date.now() * 0.008) * 2;
    ctx.beginPath();
    ctx.moveTo(cx - 10 + hairWave, p.y + 4);
    ctx.lineTo(cx, p.y - 6);
    ctx.lineTo(cx + 10 + hairWave, p.y + 4);
    ctx.fill();

    // Torso (larger)
    ctx.fillStyle = '#6a3a1a';
    ctx.fillRect(cx - 11, p.y + 10, 22, 24);

    // Fur shoulder
    ctx.fillStyle = '#5a4a2a';
    ctx.fillRect(cx - 14, p.y + 10, 28, 6);

    // Eyes (red when berserk)
    ctx.fillStyle = p.berserkActive ? '#ff2d2d' : '#e7edf3';
    ctx.fillRect(cx + p.facing * 3 - 3, p.y + 5, 3, 3);
    ctx.fillRect(cx + p.facing * 3 + 2, p.y + 5, 3, 3);

    ctx.fillStyle = '#3a2a2a';
    ctx.fillRect(cx - 8, p.y + 34, 7, 10);
    ctx.fillRect(cx + 2, p.y + 34, 7, 10);

    // Axe
    if (p.attacking || p.specialing) {
      const swingAngle = Math.sin(p.attackTimer * 12) * 0.8;
      ctx.save();
      ctx.translate(cx + p.facing * 12, p.y + 14);
      if (ctx.rotate) ctx.rotate(swingAngle * p.facing);
      ctx.fillStyle = '#7c8894';
      ctx.fillRect(-2, -2, 20, 5);
      ctx.fillRect(16, -6, 4, 14);
      ctx.restore();
    } else {
      ctx.fillStyle = '#7c8894';
      ctx.fillRect(cx + p.facing * 10, p.y + 12, 18, 5);
      ctx.fillRect(cx + p.facing * 26, p.y + 8, 4, 12);
    }

    // Berserk eyes glow
    if (p.berserkActive) {
      ctx.fillStyle = `rgba(255, 50, 20, ${0.3 + Math.sin(Date.now() * 0.01) * 0.2})`;
      ctx.beginPath();
      ctx.arc(cx + p.facing * 3, p.y + 7, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Original characters (warrior, amazon, dwarf)
    // Torso
    ctx.fillStyle = def.color;
    ctx.fillRect(cx - 8, p.y + 10, 16, 22);

    // Head
    ctx.fillStyle = def.skinColor;
    ctx.beginPath();
    ctx.arc(cx, p.y + 8, 9, 0, Math.PI * 2);
    ctx.fill();

    // Headgear
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(cx, p.y + 8, 9, Math.PI, 0, true);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#e7edf3';
    ctx.fillRect(cx + p.facing * 2, p.y + 6, 4, 3);

    // Legs
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(cx - 7, p.y + 32, 6, 10);
    ctx.fillRect(cx + 1, p.y + 32, 6, 10);

    // Weapon arm
    if (p.attacking || p.specialing) {
      ctx.fillStyle = '#7c8894';
      const armX = p.facing > 0 ? cx + 8 : cx - 14;
      ctx.fillRect(armX, p.y + 12, 8, 14);
    }
  }
}

/**
 * Renderiza proyectiles (fireballs del mago)
 */
export function renderProjectiles(ctx, projectiles) {
  if (!projectiles) return;
  for (const p of projectiles) {
    if (!p.alive) continue;
    // Glow
    ctx.fillStyle = p.color + '40';
    ctx.beginPath();
    ctx.arc(p.x + p.width / 2, p.y + p.height / 2, Math.max(p.width, p.height), 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.width, p.height);
    // Core
    ctx.fillStyle = '#fff';
    ctx.fillRect(p.x + 2, p.y + 2, 4, 4);
  }
}

/**
 * Renderiza flechas enemigas
 */
export function renderArrows(ctx, arrows) {
  for (const a of arrows) {
    if (!a.alive) continue;
    ctx.save();
    ctx.translate(a.x, a.y);
    const angle = Math.atan2(a.vy, a.vx);
    if (ctx.rotate) ctx.rotate(angle);
    ctx.fillStyle = '#6a4a2a';
    ctx.fillRect(-6, -1, 12, 2);
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(2, -3);
    ctx.lineTo(2, 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Renderiza balas del jefe
 */
export function renderBossBullets(ctx, bullets) {
  for (const b of bullets) {
    if (!b.alive) continue;
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
 * Renderiza powerups (pociones)
 */
export function renderPowerups(ctx, powerups) {
  for (const pu of powerups) {
    if (!pu.active) continue;
    const pulse = Math.sin(Date.now() * 0.006) * 3;
    ctx.fillStyle = pu.color;
    ctx.beginPath();
    ctx.arc(pu.x + 8, pu.y + 8 + pulse, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pu.type === 'potion' ? 'M' : '\u2665', pu.x + 8, pu.y + 8 + pulse + 1);
  }
}

/**
 * Renderiza partículas
 */
export function renderParticles(ctx, particles) {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / 0.4);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}

/**
 * Renderiza el jefe según su patrón
 */
export function renderBoss(ctx, boss) {
  if (!boss || !boss.alive) return;
  const b = boss;
  const hpPct = b.hp / b.maxHp;
  const isEnraged = hpPct < 0.4;

  if (b.pattern === 'necromancy') {
    // Dark aura
    ctx.fillStyle = `rgba(74, 130, 255, ${0.1 + Math.sin(Date.now() * 0.004) * 0.05})`;
    ctx.fillRect(b.x - 10, b.y - 10, b.width + 20, b.height + 20);

    const cloakWave = Math.sin(Date.now() * 0.005) * 5;
    ctx.fillStyle = '#1a1a3a';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + b.width, b.y);
    ctx.lineTo(b.x + b.width + cloakWave, b.y + b.height);
    ctx.lineTo(b.x - cloakWave, b.y + b.height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isEnraged ? '#3a1a1a' : '#2a2a4a';
    ctx.fillRect(b.x + 8, b.y + 18, b.width - 16, b.height - 18);

    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath();
    ctx.arc(b.x + b.width / 2, b.y + 14, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isEnraged ? '#ff4d4d' : '#4a9eff';
    const eyeGlow = 8 + Math.sin(Date.now() * 0.006) * 3;
    ctx.beginPath();
    ctx.arc(b.x + b.width / 2 - 5, b.y + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x + b.width / 2 + 5, b.y + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isEnraged ? '#ff4d4d60' : '#4a9eff60';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x + b.width / 2 - 5, b.y + 12, eyeGlow, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x + b.width / 2 + 5, b.y + 12, eyeGlow, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#3a2a2a';
    ctx.fillRect(b.x + b.width / 2 - 6, b.y + 20, 12, 5);
    ctx.fillStyle = '#e8e0d0';
    for (let t = 0; t < 4; t++) {
      ctx.fillRect(b.x + b.width / 2 - 5 + t * 3, b.y + 20, 2, 3);
    }

    const orbAngle = Date.now() * 0.003;
    for (let i = 0; i < 3; i++) {
      const oa = orbAngle + i * Math.PI * 2 / 3;
      const ox = b.x + b.width / 2 + Math.cos(oa) * 28;
      const oy = b.y + b.height / 2 + Math.sin(oa) * 15;
      ctx.fillStyle = isEnraged ? '#ff6b4a' : '#4a9eff';
      ctx.beginPath();
      ctx.arc(ox, oy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isEnraged ? '#ff4d4d40' : '#4a9eff40';
      ctx.beginPath();
      ctx.arc(ox, oy, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (b.pattern === 'inferno') {
    ctx.fillStyle = `rgba(255, 80, 20, ${0.15 + Math.sin(Date.now() * 0.005) * 0.08})`;
    ctx.fillRect(b.x - 15, b.y - 10, b.width + 30, b.height + 20);

    ctx.fillStyle = isEnraged ? '#8b1a1a' : '#6b2a1a';
    ctx.fillRect(b.x, b.y + 16, b.width, b.height - 16);

    ctx.fillStyle = isEnraged ? '#5a1a0a' : '#4a2a1a';
    for (let s = 0; s < 6; s++) {
      ctx.fillRect(b.x + 6 + s * 12, b.y + 22 + (s % 2) * 6, 10, 8);
    }

    const wingFlap = Math.sin(Date.now() * 0.004) * 12;
    ctx.fillStyle = isEnraged ? '#5a1a1a' : '#3a2a1a';
    ctx.beginPath();
    ctx.moveTo(b.x + 5, b.y + 20);
    ctx.lineTo(b.x - 25 + wingFlap, b.y + 10);
    ctx.lineTo(b.x - 15, b.y + 35);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(b.x + b.width - 5, b.y + 20);
    ctx.lineTo(b.x + b.width + 25 - wingFlap, b.y + 10);
    ctx.lineTo(b.x + b.width + 15, b.y + 35);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = isEnraged ? '#9a2a1a' : '#7a3a1a';
    ctx.beginPath();
    ctx.arc(b.x + b.width / 2, b.y + 14, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillRect(b.x + b.width / 2 - 8, b.y + 18, 16, 10);

    ctx.fillStyle = isEnraged ? '#ff4d4d' : '#ffd700';
    ctx.fillRect(b.x + b.width / 2 - 8, b.y + 10, 6, 3);
    ctx.fillRect(b.x + b.width / 2 + 2, b.y + 10, 6, 3);
    ctx.fillStyle = '#000';
    ctx.fillRect(b.x + b.width / 2 - 6, b.y + 10, 2, 3);
    ctx.fillRect(b.x + b.width / 2 + 4, b.y + 10, 2, 3);

    const fireGlow = Math.sin(Date.now() * 0.01) * 3;
    ctx.fillStyle = '#ff6b4a';
    ctx.beginPath();
    ctx.arc(b.x + b.width / 2 - 3, b.y + 24, 2 + fireGlow, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x + b.width / 2 + 3, b.y + 24, 2 + fireGlow, 0, Math.PI * 2);
    ctx.fill();

    if (isEnraged) {
      const maneFlame = Math.sin(Date.now() * 0.008) * 5;
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.moveTo(b.x + b.width / 2 - 16, b.y + 8);
      ctx.lineTo(b.x + b.width / 2 - 12 + maneFlame, b.y - 8);
      ctx.lineTo(b.x + b.width / 2 - 3, b.y + 2);
      ctx.lineTo(b.x + b.width / 2 + 3, b.y + 2);
      ctx.lineTo(b.x + b.width / 2 + 12 - maneFlame, b.y - 8);
      ctx.lineTo(b.x + b.width / 2 + 16, b.y + 8);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = isEnraged ? '#8b2a2a' : '#3a2a6b';
    ctx.fillRect(b.x, b.y, b.width, b.height);

    ctx.fillStyle = '#2a1a4a';
    ctx.fillRect(b.x + 8, b.y + 6, b.width - 16, 8);
    ctx.fillRect(b.x + 5, b.y + b.height - 12, b.width - 10, 6);

    ctx.fillStyle = isEnraged ? '#ff4d4d' : '#ffd700';
    ctx.beginPath();
    ctx.arc(b.x + 16, b.y + 14, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x + b.width - 16, b.y + 14, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(b.x + 16, b.y + 14, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(b.x + b.width - 16, b.y + 14, 3, 0, Math.PI * 2);
    ctx.fill();

    if (isEnraged) {
      ctx.fillStyle = '#ff4d4d';
      ctx.fillRect(b.x + 16, b.y + 30, 28, 8);
      ctx.fillStyle = '#fff';
      for (let t = 0; t < 4; t++) {
        ctx.fillRect(b.x + 18 + t * 7, b.y + 30, 4, 4);
      }
    }

    ctx.fillStyle = '#4a3a7b';
    const armSwing = Math.sin(Date.now() * 0.005) * 10;
    ctx.fillRect(b.x - 10 + armSwing, b.y + 18, 12, 22);
    ctx.fillRect(b.x + b.width - 2 - armSwing, b.y + 18, 12, 22);
  }

  // HP bar
  const barW = b.width;
  const barH = 6;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(b.x, b.y - 12, barW, barH);
  ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : hpPct > 0.25 ? '#ffb454' : '#ff4d4d';
  ctx.fillRect(b.x + 1, b.y - 11, (barW - 2) * hpPct, barH - 2);

  ctx.fillStyle = '#e7edf3';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(b.name, b.x + b.width / 2, b.y - 14);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Renderiza el HUD (health, magic, score, stage, combo)
 */
export function renderHUD(ctx, width, height, player, score, highscore, currentStage, boss, stageLength, scrollX, bossX, comboParticles) {
  setupHUDContext(ctx);

  ctx.fillText(t('goldenaxe.score', { n: score }), 10, 10);

  const hpPct = player.hp / player.maxHp;
  const hpBarW = 150;
  const hpBarH = 10;
  const hpY = 30;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(10, hpY, hpBarW, hpBarH);
  ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : hpPct > 0.25 ? '#ffb454' : '#e74c3c';
  ctx.fillRect(11, hpY + 1, (hpBarW - 2) * hpPct, hpBarH - 2);
  ctx.fillStyle = '#e7edf3';
  ctx.font = '10px monospace';
  ctx.fillText(`${player.hp}/${player.maxHp}`, 14, hpY + 1);
  ctx.font = '14px monospace';

  const mpPct = player.magic / player.maxMagic;
  const mpBarW = 100;
  const mpBarH = 8;
  const mpY = 44;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(10, mpY, mpBarW, mpBarH);
  ctx.fillStyle = mpPct > 0 ? '#4a9eff' : '#2a2a3a';
  ctx.fillRect(11, mpY + 1, (mpBarW - 2) * mpPct, mpBarH - 2);
  ctx.fillStyle = '#9aa7b2';
  ctx.font = '9px monospace';
  ctx.fillText(`MP:${player.magic}`, 12, mpY + 1);
  ctx.font = '14px monospace';

  ctx.fillText(CHAR_DEFS[player.charIdx].name, 10, 56);

  ctx.textAlign = 'right';
  ctx.fillText(t('goldenaxe.lives', { n: player.lives }), width - 10, 10);

  ctx.textAlign = 'center';
  ctx.fillText(t('goldenaxe.stage', { n: currentStage }), width / 2, 10);

  const progW = width - 40;
  const progX = 20;
  const progY = height - 14;
  const progress = Math.min(1, scrollX / (bossX || stageLength));
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(progX, progY, progW, 4);
  ctx.fillStyle = progress >= 1 ? '#ffd700' : '#4a9eff';
  ctx.fillRect(progX + 1, progY + 1, (progW - 2) * progress, 2);

  if (player.combo >= 2) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${player.combo}x COMBO!`, width / 2, height - 45);
    ctx.font = '14px monospace';
  }

  if (boss && boss.alive) {
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('J:ATK  K:SPECIAL  L:MAGIC  SPACE:JUMP', width - 10, height - 30);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Renderiza la pantalla de selección de personaje
 */
export function renderSelect(ctx, width, height, selectedChar, selectBlink) {
  ctx.fillStyle = '#0a0f1a';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('goldenaxe.select'), width / 2, 24);

  const cardW = 146;
  const cardH = 220;
  const gap = 12;
  const totalW = CHAR_DEFS.length * cardW + (CHAR_DEFS.length - 1) * gap;
  const startX = (width - totalW) / 2;
  const startY = 55;

  for (let i = 0; i < CHAR_DEFS.length; i++) {
    const ch = CHAR_DEFS[i];
    const x = startX + i * (cardW + gap);
    const y = startY;
    const isSelected = i === selectedChar;

    ctx.fillStyle = isSelected ? '#1a1a2a' : '#11161d';
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeStyle = isSelected ? '#ffd700' : '#2a3a4a';
    ctx.lineWidth = isSelected ? 3 : 1;
    ctx.strokeRect(x, y, cardW, cardH);

    ctx.fillStyle = ch.skinColor;
    ctx.beginPath();
    ctx.arc(x + cardW / 2, y + 50, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = ch.color;
    ctx.fillRect(x + cardW / 2 - 16, y + 68, 32, 40);

    ctx.fillStyle = '#3a2a2a';
    ctx.fillRect(x + cardW / 2 - 14, y + 108, 12, 28);
    ctx.fillRect(x + cardW / 2 + 2, y + 108, 12, 28);

    if (ch.id === 'warrior') {
      ctx.fillStyle = '#7c8894';
      ctx.fillRect(x + cardW / 2 + 14, y + 68, 18, 5);
      ctx.fillRect(x + cardW / 2 + 28, y + 62, 4, 12);
    } else if (ch.id === 'amazon') {
      ctx.fillStyle = '#7c8894';
      ctx.fillRect(x + cardW / 2 - 22, y + 72, 24, 4);
      ctx.fillRect(x + cardW / 2 - 26, y + 66, 4, 12);
    } else if (ch.id === 'dwarf') {
      ctx.fillStyle = '#7c8894';
      ctx.fillRect(x + cardW / 2 - 18, y + 64, 36, 8);
      ctx.fillRect(x + cardW / 2 - 3, y + 56, 6, 16);
    } else if (ch.id === 'wizard') {
      ctx.fillStyle = '#8a6a3a';
      ctx.fillRect(x + cardW / 2 + 12, y + 55, 4, 50);
      ctx.fillStyle = '#4a9eff';
      ctx.beginPath();
      ctx.arc(x + cardW / 2 + 14, y + 56, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a2a5a';
      ctx.fillRect(x + cardW / 2 - 18, y + 68, 36, 35);
      ctx.fillStyle = ch.color;
      ctx.fillRect(x + cardW / 2 - 14, y + 68, 28, 30);
    } else if (ch.id === 'barbarian') {
      ctx.fillStyle = '#7c8894';
      ctx.fillRect(x + cardW / 2 + 10, y + 60, 22, 6);
      ctx.fillRect(x + cardW / 2 + 28, y + 52, 6, 20);
      ctx.fillStyle = '#6a4a2a';
      ctx.fillRect(x + cardW / 2 - 20, y + 66, 40, 8);
    }

    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ch.name, x + cardW / 2, y + 156);

    ctx.fillStyle = '#9aa7b2';
    ctx.font = '10px monospace';
    ctx.fillText(`HP:${ch.hp} DMG:${ch.attackDamage} SPD:${ch.speed}`, x + cardW / 2, y + 175);
    ctx.fillText(ch.desc, x + cardW / 2, y + 192);

    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(x + cardW / 2 - 30, y + 200, 60, 5);
    ctx.fillStyle = '#4a9eff';
    ctx.fillRect(x + cardW / 2 - 29, y + 201, 58 * (ch.magicBase / 100), 3);

    ctx.textAlign = 'left';
  }

  if (Math.floor(selectBlink * 4) % 2 === 0) {
    const selX = startX + selectedChar * (cardW + gap);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
    ctx.fillRect(selX, startY, cardW, cardH);
  }

  ctx.fillStyle = '#9aa7b2';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A/D o \u2190 \u2192 para elegir  |  Espacio/Enter para empezar', width / 2, height - 30);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Renderiza overlay de nivel completado
 */
export function renderLevelComplete(ctx, width, height) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('game.levelComplete'), width / 2, height / 2 - 20);
  ctx.font = '16px monospace';
  ctx.fillText(t('goldenaxe.continue'), width / 2, height / 2 + 20);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

/**
 * Renderiza overlay de fin de juego
 */
export function renderGameOver(ctx, width, height, won, score) {
  renderOverlay(ctx, {
    width, height,
    title: won ? t('goldenaxe.victory') : t('goldenaxe.gameOver'),
    score,
  });
}

/**
 * Renderiza el nombre del jefe en HUD
 */
export function renderBossWarning(ctx, width, boss) {
  if (!boss || !boss.alive) return;
  ctx.fillStyle = '#ff4d4d';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const bossLabel = boss.name ? `\u2694 ${boss.name} \u2694` : t('goldenaxe.boss');
  ctx.fillText(bossLabel, width / 2, 60);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

// ── Util ─────────────────────────────────────────────────────────────

/**
 * Oscurece un color hex por un factor (0-1)
 */
export function darkenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgb(${Math.floor(r * factor)},${Math.floor(g * factor)},${Math.floor(b * factor)})`;
}
