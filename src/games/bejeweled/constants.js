/**
 * Bejeweled — Constantes de configuración
 */
export const GRID_COLS = 8;
export const GRID_ROWS = 8;
export const GEM_SIZE = 54;
export const GEM_GAP = 4;

export const GEM_TYPES = [
  { id: 0, color: '#e74c3c', glow: '#ff6b6b', name: 'rojo' },
  { id: 1, color: '#4a9eff', glow: '#7cb8ff', name: 'azul' },
  { id: 2, color: '#3a9a5a', glow: '#5cc87a', name: 'verde' },
  { id: 3, color: '#ffb454', glow: '#ffd080', name: 'amarillo' },
  { id: 4, color: '#c848d8', glow: '#dc78e8', name: 'morado' },
  { id: 5, color: '#ff8c6b', glow: '#ffa88c', name: 'naranja' },
];

export const MODE_CONFIGS = {
  classic: { initialMoves: 20, targetScore: 2000, desc: 'bejeweled.classic' },
  timeattack: { initialMoves: -1, targetScore: 3000, timeLimit: 90, desc: 'bejeweled.timeattack' },
  endless: { initialMoves: -1, targetScore: -1, desc: 'bejeweled.endless' },
};

export const SWAP_DURATION = 0.15;
export const FALL_DURATION = 0.1;
