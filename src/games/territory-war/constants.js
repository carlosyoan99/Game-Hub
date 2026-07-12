/**
 * Territory War — Constantes de configuración y balance
 */
export const COLORS = {
  bg: '#0b0f14',
  panel: '#11161d',
  ink: '#e7edf3',
  inkDim: '#7c8894',
  line: '#1e2731',
  marquee: '#ffb454',
  playerColor: '#4a9eff',
  enemyColor: '#e74c3c',
  neutralZone: '#2a3a2a',
  playerZone: 'rgba(74, 158, 255, 0.15)',
  enemyZone: 'rgba(231, 76, 60, 0.15)',
};

export const TERRAIN_COLS = 11;
export const TERRAIN_ROWS = 7;

export const UNIT_TYPES = {
  infantry: { nameKey: 'territory.unitInfantry', hp: 50, maxHp: 50, damage: 15, range: 1, moveRange: 2, cost: 100, symbol: '⚔' },
  archer: { nameKey: 'territory.unitArcher', hp: 35, maxHp: 35, damage: 12, range: 3, moveRange: 1, cost: 150, symbol: '🏹' },
  cavalry: { nameKey: 'territory.unitCavalry', hp: 60, maxHp: 60, damage: 20, range: 1, moveRange: 4, cost: 200, symbol: '🐴' },
  healer: { nameKey: 'territory.unitHealer', hp: 30, maxHp: 30, damage: 5, range: 2, moveRange: 2, cost: 120, symbol: '💚', heals: true },
  tank: { nameKey: 'territory.unitTank', hp: 100, maxHp: 100, damage: 10, range: 1, moveRange: 1, cost: 180, symbol: '🛡' },
};
