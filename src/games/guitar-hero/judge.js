/**
 * Guitar Hero — Sistema de juicio, timing y puntuación
 *
 * Extraído de GuitarHero.js. Maneja las ventanas de timing,
 * cálculo de puntuación, combo multiplicador y HP.
 */

export const HIT_WINDOW_GOOD = 0.15;
export const HIT_WINDOW_PERFECT = 0.05;
export const MAX_MISS_DISTANCE = 0.25;

export const SCORE_PERFECT = 300;
export const SCORE_GOOD = 100;

export const COMBO_MULTIPLIERS = [
  { threshold: 0,  mult: 1 },
  { threshold: 10, mult: 2 },
  { threshold: 20, mult: 3 },
  { threshold: 35, mult: 4 },
  { threshold: 50, mult: 5 },
];

export const HP_DECAY_RATE = 2;
export const HP_HIT_GAIN = 8;
export const HP_PERFECT_GAIN = 12;
export const HP_MISS_LOSS = 15;
export const MAX_HP = 100;

/**
 * Encuentra la mejor nota para un carril (la más cercana a la zona de golpe)
 */
export function findBestNote(activeNotes, lane, songTime) {
  let best = null;
  let bestDist = Infinity;
  for (const n of activeNotes) {
    if (n.hit || n.missed) continue;
    if (n.lane !== lane) continue;
    const dist = Math.abs(songTime - n.targetTime);
    if (dist < bestDist && dist < MAX_MISS_DISTANCE) {
      bestDist = dist;
      best = n;
    }
  }
  return best;
}

/**
 * Determina el resultado del golpe (perfect/good/miss)
 */
export function judgeHit(dist) {
  if (dist < HIT_WINDOW_PERFECT) return 'perfect';
  if (dist < HIT_WINDOW_GOOD) return 'good';
  return 'miss';
}

/**
 * Calcula el multiplicador de combo
 */
export function getComboMultiplier(combo, starPowerActive) {
  const starMult = starPowerActive ? 2 : 1;
  for (let i = COMBO_MULTIPLIERS.length - 1; i >= 0; i--) {
    if (combo >= COMBO_MULTIPLIERS[i].threshold) {
      return COMBO_MULTIPLIERS[i].mult * starMult;
    }
  }
  return 1;
}

/**
 * Calcula el score para un tipo de golpe
 */
export function getScoreForHit(type, multiplier) {
  return (type === 'perfect' ? SCORE_PERFECT : SCORE_GOOD) * multiplier;
}

/**
 * Calcula la ganancia/pérdida de HP
 */
export function getHpChange(type) {
  if (type === 'perfect') return HP_PERFECT_GAIN;
  if (type === 'good') return HP_HIT_GAIN;
  if (type === 'miss') return -HP_MISS_LOSS;
  return -HP_DECAY_RATE;
}

/**
 * Texto y color para el tipo de juicio
 */
export function getJudgmentDisplay(type) {
  switch (type) {
    case 'perfect': return { text: 'guitarhero.perfect', color: '#ffd700' };
    case 'good':    return { text: 'guitarhero.good',    color: '#3a9a5a' };
    case 'miss':    return { text: 'guitarhero.miss',    color: '#e74c3c' };
    default:        return { text: '',                   color: '#fff' };
  }
}
