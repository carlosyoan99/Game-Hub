/**
 * Golden Axe — Generación de niveles y oleadas
 *
 * Extraído de GoldenAxe.js para reducir el monolito.
 */

import { STAGE_LENGTHS, SCROLL_SPEEDS, BOSS_SCROLL_X,
         BOSS_PATTERNS, BOSS_COLORS, BOSS_NAMES, BOSS_HEIGHTS, BOSS_WIDTHS, MAX_STAGES, ENEMY_TYPES } from './constants.js';

const _rn = (rng) => rng ? rng.next() : Math.random();

/**
 * Inicializa la configuración de una etapa
 */
export function initStageConfig(stage) {
  const idx = stage - 1;
  return {
    scrollSpeed: SCROLL_SPEEDS[idx] || 60,
    stageLength: STAGE_LENGTHS[idx] || 3600,
    bossX: BOSS_SCROLL_X[idx] || 3000,
    maxEnemies: 10,
  };
}

/**
 * Genera la cola de enemigos para una etapa
 */
export function generateEnemyWave(stage, rng) {
  const wave = [];
  const counts = {
    skeleton: 6 + stage * 2,
    knight: 2 + Math.floor(stage * 1.5),
    golem: stage >= 2 ? 1 + Math.floor(stage * 0.8) : 0,
    archer: stage >= 3 ? 2 + Math.floor((stage - 2) * 2) : 0,
    assassin: stage >= 4 ? 2 + (stage - 3) * 2 : 0,
  };
  for (let i = 0; i < counts.skeleton; i++) {
    wave.push({ type: 'skeleton', fromLeft: i % 3 === 0, delay: i * 0.7 });
  }
  for (let i = 0; i < counts.knight; i++) {
    wave.push({ type: 'knight', fromLeft: i % 2 === 0, delay: 4 + i * 1.2 });
  }
  for (let i = 0; i < counts.golem; i++) {
    wave.push({ type: 'golem', fromLeft: false, delay: 10 + i * 2 });
  }
  for (let i = 0; i < counts.archer; i++) {
    wave.push({ type: 'archer', fromLeft: i % 2 === 0, delay: 6 + i * 2 });
  }
  for (let i = 0; i < counts.assassin; i++) {
    wave.push({ type: 'assassin', fromLeft: i % 2 === 0, delay: 8 + i * 1.5 });
  }
  // Shuffle
  for (let i = wave.length - 1; i > 0; i--) {
    const j = Math.floor(_rn(rng) * (i + 1));
    [wave[i], wave[j]] = [wave[j], wave[i]];
  }
  return wave;
}

/**
 * Crea los minions iniciales para el jefe (etapa 4 = necromancer)
 */
export function createBossMinions(stage, bossX, height) {
  if (stage !== 4) return [];
  const minions = [];
  for (let i = 0; i < 3; i++) {
    minions.push({
      x: bossX + 50 + i * 40, y: height - 90,
      width: 20, height: 28,
      vx: 0, vy: 0, hp: 8, maxHp: 8,
      damage: 5, score: 50, alive: true,
      type: 'skeleton', color: '#8a7a6a',
      onGround: true, attackCooldown: 0, aiTimer: 0,
    });
  }
  return minions;
}

export { MAX_STAGES };
