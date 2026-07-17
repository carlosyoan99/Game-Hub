/**
 * Golden Axe — Constantes, datos de personajes y enemigos
 *
 * Extraído de GoldenAxe.js para reducir el monolito.
 */

export const CHAR_DEFS = [
  {
    id: 'warrior', name: 'Gilius',
    color: '#6b3a8e', skinColor: '#d4a574',
    hp: 120, speed: 140, jumpVel: -380,
    attackDamage: 12, attackRange: 40,
    specialDamage: 20, specialRange: 50,
    magicBase: 30, magicCost: 8,
    desc: 'HP alto, daño fuerte',
  },
  {
    id: 'amazon', name: 'Tyris',
    color: '#c84848', skinColor: '#e8c898',
    hp: 90, speed: 180, jumpVel: -420,
    attackDamage: 8, attackRange: 35,
    specialDamage: 15, specialRange: 60,
    magicBase: 40, magicCost: 6,
    desc: 'Rápida, magia potente',
  },
  {
    id: 'dwarf', name: 'Ax',
    color: '#4a7a4a', skinColor: '#c48c5c',
    hp: 140, speed: 110, jumpVel: -350,
    attackDamage: 15, attackRange: 35,
    specialDamage: 25, specialRange: 45,
    magicBase: 20, magicCost: 10,
    desc: 'Tanque, daño brutal',
  },
  {
    id: 'wizard', name: 'Zyn',
    color: '#3a4a8e', skinColor: '#d4c8a0',
    hp: 70, speed: 130, jumpVel: -380,
    attackDamage: 6, attackRange: 30,
    specialDamage: 18, specialRange: 80,
    magicBase: 60, magicCost: 4,
    desc: 'Magia potente, proyectiles',
  },
  {
    id: 'barbarian', name: 'Krom',
    color: '#8e5a2a', skinColor: '#c8905c',
    hp: 130, speed: 155, jumpVel: -400,
    attackDamage: 18, attackRange: 32,
    specialDamage: 28, specialRange: 42,
    magicBase: 15, magicCost: 12,
    desc: 'Frenesí berserker a baja HP',
  },
];

export const GRAVITY = 1200;
export const MAX_FALL = 800;
export const ATTACK_DURATION = 0.25;
export const SPECIAL_DURATION = 0.4;
export const HITSTUN_DURATION = 0.3;
export const COMBO_WINDOW = 1.5;
export const MAX_COMBO = 5;

export const STAGE_LENGTHS = [3600, 4200, 4800, 5400, 6000];
export const SCROLL_SPEEDS = [60, 70, 80, 90, 100];
export const BOSS_SCROLL_X = [3000, 3600, 4000, 4500, 5000];

export const ENEMY_TYPES = {
  skeleton: { hp: 15, speed: 60, damage: 6, score: 100, color: '#c8b89a', width: 24, height: 30 },
  knight:   { hp: 30, speed: 40, damage: 10, score: 200, color: '#7c6a8e', width: 28, height: 34 },
  golem:    { hp: 60, speed: 25, damage: 15, score: 400, color: '#6a5a4a', width: 34, height: 36 },
  archer:   { hp: 18, speed: 55, damage: 8, score: 250, color: '#4a7a3a', width: 24, height: 32, ranged: true },
  assassin: { hp: 12, speed: 120, damage: 14, score: 300, color: '#3a3a4a', width: 22, height: 30 },
};

export const BOSS_PATTERNS = ['spread', 'charge', 'spiral', 'necromancy', 'inferno'];
export const BOSS_COLORS = ['#3a2a6b', '#6b2a4a', '#4a6b2a', '#2a4a6b', '#6b2a2a'];
export const BOSS_NAMES = ['Demon Knight', 'Dark Knight', 'Forest Giant', 'Necromancer', 'Fire Dragon'];
export const BOSS_HEIGHTS = [50, 50, 50, 55, 65];
export const BOSS_WIDTHS = [60, 60, 60, 55, 80];

export const MAX_STAGES = STAGE_LENGTHS.length;
