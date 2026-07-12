/**
 * Bloons TD — Constantes de configuración y balance
 */
export const COLORS = {
  bg: '#0b0f14',
  panel: '#11161d',
  ink: '#e7edf3',
  inkDim: '#7c8894',
  line: '#1e2731',
  marquee: '#ffb454',
};

// Path waypoints (the bloon road) — fracciones (0-1) para escalar con resolución
export const RELATIVE_WAYPOINTS = [
  { x: 0, y: 0.37 },
  { x: 0.167, y: 0.37 },
  { x: 0.167, y: 0.185 },
  { x: 0.389, y: 0.185 },
  { x: 0.389, y: 0.556 },
  { x: 0.611, y: 0.556 },
  { x: 0.611, y: 0.278 },
  { x: 0.778, y: 0.278 },
  { x: 0.778, y: 0.648 },
  { x: 1.0, y: 0.648 },
];

export const MAX_WAVE = 15;

// Tower types
export const TOWER_TYPES = {
  dart: {
    nameKey: 'bloons.towerDart',
    cost: 50,
    range: 100,
    fireRate: 0.4,
    damage: 1,
    color: '#4a9eff',
    projectileColor: '#6ab0ff',
    projSpeed: 500,
  },
  cannon: {
    nameKey: 'bloons.towerCannon',
    cost: 100,
    range: 120,
    fireRate: 0.8,
    damage: 3,
    color: '#e74c3c',
    projectileColor: '#ff6b4a',
    projSpeed: 400,
    splash: 30,
  },
  sniper: {
    nameKey: 'bloons.towerSniper',
    cost: 200,
    range: 400,
    fireRate: 1.4,
    damage: 5,
    color: '#2ecc71',
    projectileColor: '#5aee9a',
    projSpeed: 1000,
  },
};

export const TOWER_KEYS = ['dart', 'cannon', 'sniper'];

// Bloon types (increasing difficulty)
export const BLOON_TYPES = {
  red: { speed: 50, hp: 1, color: '#e74c3c', points: 1, radius: 10 },
  blue: { speed: 60, hp: 1, color: '#3498db', points: 2, radius: 10 },
  green: { speed: 70, hp: 2, color: '#2ecc71', points: 3, radius: 11 },
  yellow: { speed: 90, hp: 2, color: '#f1c40f', points: 4, radius: 11 },
  pink: { speed: 110, hp: 3, color: '#e91e63', points: 5, radius: 12 },
  black: { speed: 80, hp: 4, color: '#2c3e50', points: 8, radius: 13 },
  white: { speed: 100, hp: 5, color: '#ecf0f1', points: 10, radius: 13 },
  lead: { speed: 40, hp: 8, color: '#7f8c8d', points: 15, radius: 14 },
  purple: { speed: 120, hp: 3, color: '#9b59b6', points: 7, radius: 12 },
  zebra: { speed: 95, hp: 6, color: '#34495e', points: 12, radius: 13 },
  ceramic: { speed: 70, hp: 10, color: '#d35400', points: 20, radius: 15 },
};

export const BLOON_ORDER = ['red', 'blue', 'green', 'yellow', 'pink', 'black', 'white', 'lead', 'purple', 'zebra', 'ceramic'];
