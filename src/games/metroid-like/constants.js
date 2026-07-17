/**
 * Metroid-like — Constantes del juego
 *
 * Extraído de MetroidLike.js para reducir el monolito.
 */

export const TILE = 32;
export const COLS = 20;
export const ROWS = 15;
export const ROOM_W = COLS * TILE;  // 640
export const ROOM_H = ROWS * TILE;  // 480
export const GRAVITY = 1000;
export const MAX_FALL = 700;
export const WALK_SPEED = 150;
export const RUN_SPEED = 280;
export const JUMP_VEL = -460;
export const HIGH_JUMP_VEL = -560;
export const SPACE_JUMP_VEL = -380;
export const COYOTE = 0.06;

// Power-up flags
export const ABILITY = {
  MORPH_BALL:  1 << 0,
  MISSILES:    1 << 1,
  BOMBS:       1 << 2,
  SPEED_BOOST: 1 << 3,
  SPACE_JUMP:  1 << 4,
  SCREW_ATTACK: 1 << 5,
  HIGH_JUMP:   1 << 6,
};

// Tile types
export const T = {
  EMPTY: 0, GROUND: 1, PLATFORM: 2, CRACKED: 3, SPEED_BLOCK: 4,
  SPIKES: 5, ICE: 6, MISSILE_DOOR: 7,
};

export const SOLID = new Set([T.GROUND, T.PLATFORM, T.CRACKED, T.SPEED_BLOCK, T.ICE, T.MISSILE_DOOR]);
export const HAZARD = new Set([T.SPIKES]);

export const LEGEND = {
  '#': T.GROUND, '=': T.PLATFORM, 'X': T.CRACKED, 'S': T.SPEED_BLOCK,
  '^': T.SPIKES, '~': T.ICE, 'D': T.MISSILE_DOOR,
  'm': -1, 'M': -2, 'b': -3, 'p': -4, 'j': -5, 'h': -6, 'B': -7,
  'k': -8, 'r': -9, 's': -10, 'a': -11, 'e': -12, 'f': -13,
  'i': -14, 'E': -15,
};

export const ENEMY_TYPES = {
  zoomer: { hp: 3, damage: 1, speed: 40, color: '#c84848', w: 20, h: 16 },
  skree:  { hp: 2, damage: 1, speed: 0, dropSpeed: 120, color: '#6b5a9a', w: 22, h: 22 },
  rinka:  { hp: 4, damage: 1, speed: 35, color: '#ff6b4a', w: 18, h: 18 },
  reo:    { hp: 2, damage: 1, speed: 50, color: '#8e44ad', w: 20, h: 16 },
  zebbo:  { hp: 3, damage: 1, speed: 20, color: '#5a8a4a', w: 22, h: 20 },
};
