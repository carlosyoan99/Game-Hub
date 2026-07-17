/**
 * Metroid-like — Renderizado de sprites y escenarios
 *
 * Extraído de MetroidLike.js. Contiene todas las funciones
 * de dibujo: fondo, tilemap, enemigos, items, HUD, minimapa, jefes.
 */

import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext, renderBossHealthBar } from '../../engine/GameUI.js';
import { TILE, T, COLS, ROWS, ROOM_W, ROOM_H, ABILITY } from './constants.js';
import { ROOMS, getRoomBgColors, TILE_COLORS } from './tilemap-data.js';

/**
 * Renderiza el fondo de la sala con gradiente
 */
export function renderBackground(ctx, roomId, bossPresent, miniBossPresent, boss2Present) {
  const bgColors = getRoomBgColors(roomId, bossPresent, miniBossPresent, boss2Present);
  const grad = ctx.createLinearGradient ? ctx.createLinearGradient(0, 0, 0, ROOM_H) : null;
  if (grad) {
    grad.addColorStop(0, bgColors[0]);
    grad.addColorStop(0.5, bgColors[1]);
    grad.addColorStop(2, bgColors[2]);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bgColors[0];
  }
  ctx.fillRect(0, 0, ROOM_W, ROOM_H);
}

/**
 * Renderiza el tilemap con variantes visuales (grietas, pinchos, hielo, puertas)
 */
export function renderTilemap(ctx, tilemap, camera) {
  const vp = { x: camera.x, y: camera.y, width: camera.width, height: camera.height };
  tilemap.render(ctx, vp, TILE_COLORS);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const tile = tilemap.tileAt(col, row);
      const x = col * TILE;
      const y = row * TILE;

      if (tile === T.CRACKED) {
        ctx.fillStyle = '#5a3a3a';
        ctx.fillRect(x + 4, y + 4, 4, 4);
        ctx.fillRect(x + 20, y + 20, 8, 4);
      } else if (tile === T.SPIKES) {
        ctx.fillStyle = '#8a2a2a';
        for (let s = 0; s < 4; s++) {
          ctx.beginPath();
          ctx.moveTo(x + s * 8, y + TILE);
          ctx.lineTo(x + s * 8 + 4, y + TILE - 8);
          ctx.lineTo(x + s * 8 + 8, y + TILE);
          ctx.fill();
        }
      } else if (tile === T.ICE) {
        ctx.fillStyle = '#5a9a9a';
        ctx.fillRect(x + 4, y + 4, TILE - 8, 2);
        ctx.fillRect(x + 8, y + 12, TILE - 16, 2);
      } else if (tile === T.MISSILE_DOOR) {
        ctx.fillStyle = '#6a4a8a';
        ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
        ctx.fillStyle = '#8a6aaa';
        ctx.fillRect(x + TILE / 2 - 3, y + TILE / 2 - 3, 6, 6);
      } else if (tile === T.SPEED_BLOCK) {
        const pulse = Math.sin(Date.now() * 0.005 + col + row) > 0;
        ctx.fillStyle = pulse ? '#3a5a5a' : '#2a4a4a';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = '#4a7a7a';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      }
    }
  }
}

/**
 * Renderiza indicadores de puertas (▲▼▶◀)
 */
export function renderDoors(ctx, camera, width, height, doors, missileDoors, hasBoss) {
  const doorColor = hasBoss ? '#ff4d4d' : '#4a9eff';
  ctx.fillStyle = doorColor;
  ctx.font = '20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (doors.N) ctx.fillText('\u25B2', camera.x + width / 2, camera.y + 14);
  if (doors.S) ctx.fillText('\u25BC', camera.x + width / 2, camera.y + height - 14);
  if (doors.E) ctx.fillText('\u25B6', camera.x + width - 14, camera.y + height / 2);
  if (doors.W) ctx.fillText('\u25C0', camera.x + 14, camera.y + height / 2);

  ctx.fillStyle = '#6a4a8a';
  ctx.font = '14px monospace';
  if (missileDoors.N && doors.N) ctx.fillText('\u25C6', camera.x + width / 2, camera.y + 26);
  if (missileDoors.S && doors.S) ctx.fillText('\u25C6', camera.x + width / 2, camera.y + height - 26);
  if (missileDoors.E && doors.E) ctx.fillText('\u25C6', camera.x + width - 26, camera.y + height / 2);
  if (missileDoors.W && doors.W) ctx.fillText('\u25C6', camera.x + 26, camera.y + height / 2);
}

/**
 * Renderiza enemigos según su tipo
 */
export function renderEnemies(ctx, enemies) {
  for (const e of enemies) {
    if (!e.alive) continue;
    // Body
    ctx.fillStyle = e.color;
    ctx.fillRect(e.x, e.y, e.w, e.h);
    // Eyes
    ctx.fillStyle = '#fff';
    const eyeSize = 4;
    ctx.fillRect(e.x + 4, e.y + 4, eyeSize, eyeSize);
    ctx.fillRect(e.x + e.w - 8, e.y + 4, eyeSize, eyeSize);
    // Type-specific details
    if (e.type === 'reo') {
      ctx.fillStyle = '#6b2a6b';
      ctx.fillRect(e.x + 2, e.y + e.h - 6, e.w - 4, 4);
    } else if (e.type === 'zebbo') {
      ctx.fillStyle = '#3a6a2a';
      ctx.fillRect(e.x + e.w / 2 - 3, e.y - 4, 6, 4);
    }
  }
}

/**
 * Renderiza items coleccionables
 */
export function renderItems(ctx, items) {
  for (const item of items) {
    if (item.collected) continue;
    const pulse = Math.sin(Date.now() * 0.006 + item.x) * 4;
    ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.005 + item.x) * 0.4;
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(item.x + 4, item.y + 4 + pulse, TILE - 8, TILE - 8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.icon || '?', item.x + TILE / 2, item.y + TILE / 2 + pulse);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

/**
 * Renderiza los misiles del jugador
 */
export function renderBullets(ctx, bullets) {
  for (const b of bullets) {
    if (b.life <= 0) continue;
    ctx.fillStyle = '#ff6b4a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb454';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renderiza balas de jefe
 */
export function renderBossBullets(ctx, bullets) {
  if (!bullets) return;
  for (const b of bullets) {
    if (!b.alive) continue;
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff4d4d60';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renderiza el jugador
 */
export function renderPlayer(ctx, player, screwEffectTimer) {
  if (player.morphed) {
    ctx.fillStyle = '#4a7aaa';
    ctx.beginPath();
    ctx.arc(player.x + 9, player.y + 7, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6a9acc';
    ctx.beginPath();
    ctx.arc(player.x + 8, player.y + 6, 3, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Body
  ctx.fillStyle = '#4a7aaa';
  ctx.fillRect(player.x, player.y, player.width, player.height);
  // Helmet
  ctx.fillStyle = '#5a8abb';
  ctx.fillRect(player.x + 2, player.y - 2, player.width - 4, 8);

  // Visor
  const visorColor = player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0
    ? '#ff4d4d' : '#4ad9ff';
  ctx.fillStyle = visorColor;
  ctx.fillRect(player.x + (player.facing > 0 ? 10 : 4), player.y + 4, 8, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(player.x + (player.facing > 0 ? 11 : 5), player.y + 5, 3, 2);

  // Arm cannon
  ctx.fillStyle = '#3a6a9a';
  ctx.fillRect(player.facing > 0 ? player.x + player.width : player.x - 4, player.y + 10, 6, 6);

  // Boots
  ctx.fillStyle = '#3a3a5a';
  ctx.fillRect(player.x + 2, player.y + player.height - 4, 5, 4);
  ctx.fillRect(player.x + 11, player.y + player.height - 4, 5, 4);

  // Screw attack effect
  if (screwEffectTimer > 0) {
    ctx.strokeStyle = `rgba(74, 158, 255, ${0.3 + Math.sin(Date.now() * 0.01) * 0.2})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x + 9, player.y + 14, 16, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Renderiza el HUD del juego
 */
export function renderHUD(ctx, width, height, state) {
  setupHUDContext(ctx);

  // HP
  const hpPct = state.hp / state.maxHp;
  ctx.fillStyle = hpPct > 0.5 ? '#3a9a5a' : hpPct > 0.25 ? '#ffb454' : '#e74c3c';
  ctx.fillRect(10, 10, 100 * hpPct, 8);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, 100, 8);
  ctx.fillStyle = '#e7edf3';
  ctx.font = '9px monospace';
  ctx.fillText(`${state.hp}/${state.maxHp}`, 14, 17);

  // Missiles
  if (state.abilities & ABILITY.MISSILES) {
    ctx.fillStyle = '#ff6b4a';
    ctx.fillText(`M:${state.missileCount}`, 120, 17);
  }

  // Bombs
  if (state.abilities & ABILITY.BOMBS) {
    ctx.fillStyle = '#6b8a4a';
    ctx.fillText(`B:${state.bombCount}`, 190, 17);
  }

  // Score
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffd700';
  ctx.fillText(`${state.score}`, width - 10, 17);
  ctx.textAlign = 'left';

  // Minimap
  renderMinimap(ctx, width, height, state);
}

/**
 * Renderiza el minimapa en la esquina superior derecha
 */
export function renderMinimap(ctx, width, height, state) {
  const mapW = 100;
  const mapH = 120;
  const mapX = width - mapW - 10;
  const mapY = 30;
  const cellW = mapW / 5;
  const cellH = mapH / 6;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(mapX, mapY, mapW, mapH);
  ctx.strokeStyle = '#3a4a5a';
  ctx.lineWidth = 1;
  ctx.strokeRect(mapX, mapY, mapW, mapH);

  // Room grid
  for (const room of ROOMS) {
    if (!state.explored[ROOMS.indexOf(room)]) continue;
    const rx = mapX + room.gridX * cellW;
    const ry = mapY + room.gridY * cellH;
    ctx.fillStyle = '#2a3a4a';
    ctx.fillRect(rx + 1, ry + 1, cellW - 2, cellH - 2);
    ctx.strokeStyle = '#4a6a8a';
    ctx.strokeRect(rx + 1, ry + 1, cellW - 2, cellH - 2);

    // Room connections
    ctx.strokeStyle = '#3a5a7a';
    ctx.lineWidth = 2;
    if (room.N >= 0 && state.explored[room.N]) {
      ctx.beginPath();
      ctx.moveTo(rx + cellW / 2, ry + cellH);
      ctx.lineTo(rx + cellW / 2, ry);
      ctx.stroke();
    }
    if (room.S >= 0 && state.explored[room.S]) {
      ctx.beginPath();
      ctx.moveTo(rx + cellW / 2, ry);
      ctx.lineTo(rx + cellW / 2, ry + cellH);
      ctx.stroke();
    }
    if (room.E >= 0 && state.explored[room.E]) {
      ctx.beginPath();
      ctx.moveTo(rx, ry + cellH / 2);
      ctx.lineTo(rx + cellW, ry + cellH / 2);
      ctx.stroke();
    }
    if (room.W >= 0 && state.explored[room.W]) {
      ctx.beginPath();
      ctx.moveTo(rx + cellW, ry + cellH / 2);
      ctx.lineTo(rx, ry + cellH / 2);
      ctx.stroke();
    }
  }

  // Current room highlight
  const curRoom = ROOMS[state.roomId];
  if (curRoom) {
    const crx = mapX + curRoom.gridX * cellW;
    const cry = mapY + curRoom.gridY * cellH;
    ctx.fillStyle = 'rgba(74, 158, 255, 0.3)';
    ctx.fillRect(crx + 1, cry + 1, cellW - 2, cellH - 2);
    ctx.strokeStyle = '#4a9eff';
    ctx.lineWidth = 2;
    ctx.strokeRect(crx, cry, cellW, cellH);

    // Player dot
    ctx.fillStyle = '#4ad9ff';
    ctx.beginPath();
    ctx.arc(crx + cellW / 2, cry + cellH / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Renderiza popups de habilidad/item
 */
export function renderPopups(ctx, width, height, abilityPopup, abilityPopupTimer, itemPopup, itemPopupTimer) {
  if (abilityPopup && abilityPopupTimer > 0) {
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    const alpha = Math.min(1, abilityPopupTimer);
    ctx.globalAlpha = alpha;
    ctx.fillText(abilityPopup, width / 2, height / 2 - 20);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
  if (itemPopup && itemPopupTimer > 0) {
    ctx.fillStyle = '#3a9a5a';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    const alpha = Math.min(1, itemPopupTimer);
    ctx.globalAlpha = alpha;
    ctx.fillText(itemPopup, width / 2, height / 2);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }
}

/**
 * Renderiza la bomba colocada
 */
export function renderBomb(ctx, bombPlaced) {
  if (!bombPlaced) return;
  const flash = Math.floor(bombPlaced.timer * 10) % 2 === 0;
  ctx.fillStyle = flash ? '#ff4d4d' : '#ffb454';
  ctx.beginPath();
  ctx.arc(bombPlaced.x + 8, bombPlaced.y + 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(bombPlaced.x + 5, bombPlaced.y + 5, 6, 6);
}

/**
 * Renderiza el jefe 1: Giant Beetle
 */
export function renderBoss(ctx, boss) {
  if (!boss || !boss.alive) return;
  // Body
  ctx.fillStyle = '#4a3a6b';
  ctx.fillRect(boss.x, boss.y, boss.width, boss.height);
  // Shell pattern
  ctx.fillStyle = '#3a2a5a';
  ctx.fillRect(boss.x + 10, boss.y + 10, 60, 40);
  ctx.fillStyle = '#5a4a8b';
  ctx.fillRect(boss.x + 15, boss.y + 20, 20, 10);
  ctx.fillRect(boss.x + 45, boss.y + 20, 20, 10);
  // Eyes
  ctx.fillStyle = '#ff6b4a';
  ctx.beginPath();
  ctx.arc(boss.x + 20, boss.y + 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(boss.x + 60, boss.y + 8, 6, 0, Math.PI * 2);
  ctx.fill();
  renderBossHealthBar(ctx, {
    x: boss.x,
    y: boss.y - 10,
    width: boss.width,
    height: 5,
    hp: boss.hp,
    maxHp: boss.maxHp,
    label: t('metroid.boss'),
  });
}

/**
 * Renderiza el Mini-Boss: Kraid
 */
export function renderMiniBoss(ctx, miniBoss) {
  if (!miniBoss || !miniBoss.alive) return;
  // Body
  ctx.fillStyle = '#4a6a2a';
  ctx.fillRect(miniBoss.x, miniBoss.y, miniBoss.width, miniBoss.height);
  // Arm
  ctx.fillStyle = '#5a7a3a';
  ctx.fillRect(miniBoss.x - 20, miniBoss.y + 20, 22, 15);
  ctx.fillRect(miniBoss.x + miniBoss.width, miniBoss.y + miniBoss.height - 30, 22, 15);
  // Eyes
  ctx.fillStyle = '#ff4d4d';
  ctx.beginPath();
  ctx.arc(miniBoss.x + 35, miniBoss.y + 18, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(miniBoss.x + 65, miniBoss.y + 18, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(miniBoss.x + 35, miniBoss.y + 18, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(miniBoss.x + 65, miniBoss.y + 18, 3, 0, Math.PI * 2);
  ctx.fill();
  // Mouth
  ctx.fillStyle = '#3a1a1a';
  ctx.fillRect(miniBoss.x + 30, miniBoss.y + 50, 40, 10);
  renderBossHealthBar(ctx, {
    x: miniBoss.x,
    y: miniBoss.y - 10,
    width: miniBoss.width,
    height: 5,
    hp: miniBoss.hp,
    maxHp: miniBoss.maxHp,
    label: t('metroid.miniBoss'),
  });
}

/**
 * Renderiza el jefe 2: Ridley (final boss)
 */
export function renderBoss2(ctx, boss2) {
  if (!boss2 || !boss2.alive) return;
  const isEnraged = boss2.phase === 3;
  // Body
  ctx.fillStyle = isEnraged ? '#6b1a1a' : '#4a2a3a';
  ctx.fillRect(boss2.x, boss2.y, boss2.width, boss2.height);
  // Wings
  const wingFlap = Math.sin(Date.now() * 0.006) * 15;
  ctx.fillStyle = isEnraged ? '#5a1a1a' : '#3a2a2a';
  ctx.beginPath();
  ctx.moveTo(boss2.x + 10, boss2.y + 10);
  ctx.lineTo(boss2.x - 20 + wingFlap, boss2.y - 5);
  ctx.lineTo(boss2.x - 10, boss2.y + 30);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(boss2.x + boss2.width - 10, boss2.y + 10);
  ctx.lineTo(boss2.x + boss2.width + 20 - wingFlap, boss2.y - 5);
  ctx.lineTo(boss2.x + boss2.width + 10, boss2.y + 30);
  ctx.fill();
  // Head
  ctx.fillStyle = isEnraged ? '#8a2a1a' : '#5a3a4a';
  ctx.beginPath();
  ctx.arc(boss2.x + boss2.width / 2, boss2.y + 15, 18, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = isEnraged ? '#ff4d4d' : '#ffd700';
  ctx.fillRect(boss2.x + 35, boss2.y + 10, 6, 4);
  ctx.fillRect(boss2.x + 55, boss2.y + 10, 6, 4);
  // Mouth
  ctx.fillStyle = isEnraged ? '#ff4d4d' : '#3a1a1a';
  ctx.fillRect(boss2.x + 35, boss2.y + 30, 26, 6);
  ctx.fillStyle = '#fff';
  for (let t = 0; t < 4; t++) {
    ctx.fillRect(boss2.x + 36 + t * 7, boss2.y + 30, 3, 4);
  }
  renderBossHealthBar(ctx, {
    x: boss2.x,
    y: boss2.y - 10,
    width: boss2.width,
    height: 5,
    hp: boss2.hp,
    maxHp: boss2.maxHp,
    label: t('metroid.finalBoss'),
  });
}
