/**
 * Crush the Castle — Constantes de configuración y balance
 */
export const GRAVITY = 400;
export const BLOCK_SIZE = 28;
export const BLOCK_GAP = 1;
export const PROJECTILE_RADIUS = 6;

// Opciones de partículas para escombros del castillo
export const DEBRIS_OPTS = { vyOffset: -50, lifeMin: 0.5, lifeMax: 0.8, radiusMin: 1, radiusMax: 3, speedMin: 0.3, speedMax: 0.7 };

export const COLORS = {
  bg: '#0b0f14',
  panel: '#11161d',
  ink: '#e7edf3',
  inkDim: '#7c8894',
  line: '#1e2731',
  marquee: '#ffb454',
  ground: '#1a2a1a',
  stone: '#5a5a6a',
  wood: '#6b4a2e',
  soldier: '#c0392b',
};

/**
 * Tipo de bloques con su resistencia (golpes necesarios para destruirlos).
 */
export const BLOCK_TYPES = {
  wood: { hp: 2, color: '#6b4a2e', stroke: '#4a3520' },
  stone: { hp: 4, color: '#5a5a6a', stroke: '#3a3a4a' },
  reinforced: { hp: 8, color: '#4a5a6a', stroke: '#2a3a4a' },
  explosive: { hp: 1, color: '#c84848', stroke: '#8a2a2a' },
};
