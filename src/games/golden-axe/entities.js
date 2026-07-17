/**
 * Golden Axe — Fábricas de entidades
 *
 * Funciones factory para crear objetos de estado del juego
 * (player, enemies, projectiles, powerups, etc.)
 */

import { CHAR_DEFS } from './constants.js';

/**
 * Crea el estado inicial del jugador basado en el personaje seleccionado
 */
export function createPlayer(charIdx, height) {
  const def = CHAR_DEFS[charIdx];
  return {
    x: 40, y: height - 100,
    width: 24, height: 40,
    vx: 0, vy: 0,
    onGround: false, facing: 1,
    def,
    charIdx,
    hp: def.hp, maxHp: def.hp,
    magic: def.magicBase, maxMagic: 100,
    lives: 3,
    attacking: false,
    attackTimer: 0,
    specialing: false,
    specialTimer: 0,
    hitstunTimer: 0,
    invincible: 0,
    combo: 0,
    comboTimer: 0,
    berserkActive: false,
    items: { potions: 0 },
    dead: false,
    respawnTimer: 0,
  };
}

/**
 * Crea un enemigo a partir de la cola de spawn
 */
export function createEnemy(entry, eType, scrollX, width, height) {
  const spawnX = entry.fromLeft ? scrollX - 30 : scrollX + width + 30;
  return {
    x: spawnX,
    y: height - 60 - eType.height,
    width: eType.width,
    height: eType.height,
    vx: entry.fromLeft ? eType.speed : -eType.speed,
    vy: 0,
    hp: eType.hp,
    maxHp: eType.hp,
    damage: eType.damage,
    score: eType.score,
    alive: true,
    type: entry.type,
    color: eType.color,
    onGround: true,
    attackCooldown: 0,
    aiTimer: 0,
  };
}

/**
 * Crea un proyectil (fireball del mago)
 */
export function createProjectile(x, y, vx, vy, damage, color, life, width = 12, height = 8) {
  return { x, y, vx, vy, width, height, damage, alive: true, life, color };
}

/**
 * Crea una flecha de enemigo arquero
 */
export function createArrow(x, y, vx, vy, damage = 6) {
  return { x, y, vx, vy, damage, alive: true, life: 3 };
}

/**
 * Crea una bala de jefe
 */
export function createBossBullet(x, y, vx, vy, radius, color, homing = false) {
  return { x, y, vx, vy, radius, alive: true, color, homing };
}

/**
 * Crea un powerup (poción de magia o vida)
 */
export function createPowerup(x, y, type) {
  const color = type === 'potion' ? '#4a9eff' : '#3a9a5a';
  return {
    x, y,
    width: 16, height: 16,
    vy: -100,
    type,
    active: true,
    color,
  };
}

/**
 * Crea una partícula de texto para el combo
 */
export function createComboParticle(x, y, text, color = '#ffd700') {
  return { x, y, text, life: 0.8, color };
}

/**
 * Crea el jefe para una etapa
 */
export function createBoss(stage, bossX, height) {
  const bossHP = 30 + stage * 15;
  return {
    x: bossX + 100,
    y: height - 120,
    width: (50 + stage * 8) || 60,
    height: 50,
    hp: bossHP, maxHp: bossHP,
    alive: true, dir: -1, speed: 50 + stage * 5,
    fireTimer: 2, pattern: 'spread',
    name: 'Boss',
    color: '#3a2a6b',
    enraged: false,
  };
}
