/**
 * Metroid-like — Fábricas de entidades
 *
 * Extraído de MetroidLike.js. Funciones factory para crear
 * el jugador, enemigos, jefes, items y proyectiles.
 */

import { TILE, ROWS, COLS, ROOM_W, ROOM_H, ENEMY_TYPES, ABILITY } from './constants.js';

/**
 * Crea el estado inicial del jugador
 */
export function createPlayer(room, abilities) {
  return {
    x: ROOM_W / 2 - 10,
    y: ROOM_H - TILE * 3 - 30,
    width: 18, height: 28,
    vx: 0, vy: 0,
    onGround: false, facing: 1,
    morphed: false,
    invincible: 0,
    alive: true,
    screwActive: false,
  };
}

/**
 * Crea un enemigo según su tipo desde las marcas del ASCII
 */
export function spawnEnemy(ch, x, y) {
  const base = ENEMY_TYPES[ch];
  if (!base) return null;
  const enemy = { x, y, ...base, alive: true, type: ch, vx: 0, vy: 0, onGround: false, timer: 0 };

  switch (ch) {
    case 'zoomer':
      enemy.vx = 40 * ((enemy.rng || Math).random() > 0.5 ? 1 : -1);
      break;
    case 'rinka':
      enemy.vx = 30;
      enemy.vy = 20;
      break;
    case 'reo':
      enemy.vx = 0;
      enemy.vy = 0;
      break;
    case 'zebbo':
      enemy.timer = 2;
      break;
  }
  return enemy;
}

/**
 * Crea un item coleccionable desde la marca ASCII
 */
export function createItem(ch, x, y, type, label, icon) {
  return { x, y, type, collected: false, icon, label };
}

/**
 * Crea el jefe 1: Giant Beetle
 */
export function spawnBoss() {
  return {
    x: ROOM_W / 2 - 40, y: 40,
    width: 80, height: 60,
    hp: 50, maxHp: 50,
    alive: true,
    dir: 1,
    speed: 80,
    fireTimer: 2,
    phase: 1,
  };
}

/**
 * Crea el Mini-Boss: Kraid
 */
export function spawnMiniBoss() {
  return {
    x: ROOM_W / 2 - 50, y: 30,
    width: 100, height: 80,
    hp: 80, maxHp: 80,
    alive: true,
    dir: 1,
    fireTimer: 1.5,
    spikeTimer: 3,
    armRaised: false,
  };
}

/**
 * Crea el jefe 2: Ridley (final boss)
 */
export function spawnBoss2() {
  return {
    x: ROOM_W / 2 - 45, y: 30,
    width: 90, height: 70,
    hp: 120, maxHp: 120,
    alive: true,
    phase: 1,
    swoopTimer: 2,
    fireTimer: 1,
    swooping: false,
    swoopTarget: { x: 0, y: 0 },
    speed: 150,
  };
}

/**
 * Crea un proyectil (misil o bala de jefe)
 */
export function createBullet(x, y, vx, vy, radius, damage, life, isMissile = true) {
  return { x, y, vx, vy, radius, damage, life, isMissile };
}

/**
 * Crea una bala de jefe
 */
export function createBossBullet(x, y, vx, vy, radius, damage) {
  return { x, y, vx, vy, radius, alive: true, damage };
}
