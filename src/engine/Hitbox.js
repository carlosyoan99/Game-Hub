/**
 * Hitbox
 * Sistema de hitboxes reutilizable para detección de colisiones entre
 * entidades de juego (jugadores, enemigos, jefes, proyectiles).
 *
 * Cada hitbox define un rectángulo de colisión con offset relativo a la
 * entidad, daño, y etiquetas para identificar el tipo de golpe.
 *
 * Uso:
 *   import { Hitbox } from '../../engine/Hitbox.js';
 *
 *   // Crear hitbox de puñetazo (activo solo durante 3 frames)
 *   const punch = new Hitbox({ width: 20, height: 10, offsetX: 15, offsetY: 5,
 *     damage: 10, tags: ['punch', 'medium'] });
 *
 *   // Verificar si dos hitboxes chocan (dadas las posiciones de sus entidades)
 *   if (punch.intersects(otherHitbox, this.x, this.y, enemy.x, enemy.y)) {
 *     enemy.hp -= punch.damage;
 *   }
 *
 *   // Renderizar hitbox para debug
 *   hitbox.render(ctx, entity.x, entity.y, 'red');
 */

import { aabbIntersects } from './CollisionUtils.js';

/**
 * @typedef {Object} HitboxConfig
 * @property {number}  width        - Ancho del hitbox
 * @property {number}  height       - Alto del hitbox
 * @property {number}  [offsetX=0]  - Desplazamiento X relativo a la entidad
 * @property {number}  [offsetY=0]  - Desplazamiento Y relativo a la entidad
 * @property {number}  [damage=1]   - Daño que inflige
 * @property {string[]} [tags=[]]   - Etiquetas (ej: ['punch', 'heavy', 'projectile'])
 * @property {boolean} [active=false] - Si el hitbox está activo este frame
 */

export class Hitbox {
  /**
   * @param {HitboxConfig} config
   */
  constructor({ width, height, offsetX = 0, offsetY = 0, damage = 1, tags = [], active = false }) {
    /** Ancho del hitbox en píxeles */
    this.width = width;
    /** Alto del hitbox en píxeles */
    this.height = height;
    /** Desplazamiento X desde la posición de la entidad */
    this.offsetX = offsetX;
    /** Desplazamiento Y desde la posición de la entidad */
    this.offsetY = offsetY;
    /** Daño que inflige al impactar */
    this.damage = damage;
    /** Etiquetas para identificar el tipo de golpe */
    this.tags = tags;
    /** Si está activo este frame (para animaciones de ataque) */
    this.active = active;
  }

  /**
   * Devuelve los límites del hitbox en coordenadas de mundo,
   * dada la posición de la entidad.
   * @param {number} entityX - Posición X de la entidad
   * @param {number} entityY - Posición Y de la entidad
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  getBounds(entityX, entityY) {
    return {
      x: entityX + this.offsetX,
      y: entityY + this.offsetY,
      width: this.width,
      height: this.height,
    };
  }

  /**
   * Verifica si este hitbox intersecta con otro, dadas las posiciones
   * de ambas entidades.
   * @param {Hitbox} other - El otro hitbox
   * @param {number} myX - Posición X de mi entidad
   * @param {number} myY - Posición Y de mi entidad
   * @param {number} otherX - Posición X de la otra entidad
   * @param {number} otherY - Posición Y de la otra entidad
   * @returns {boolean}
   */
  intersects(other, myX, myY, otherX, otherY) {
    return aabbIntersects(this.getBounds(myX, myY), other.getBounds(otherX, otherY));
  }

  /**
   * Verifica si este hitbox intersecta con un rectángulo absoluto.
   * @param {{ x: number, y: number, width: number, height: number }} rect
   * @param {number} entityX - Posición X de mi entidad
   * @param {number} entityY - Posición Y de mi entidad
   * @returns {boolean}
   */
  intersectsRect(rect, entityX, entityY) {
    return aabbIntersects(this.getBounds(entityX, entityY), rect);
  }

  /**
   * Verifica si el hitbox contiene un punto.
   * @param {number} px - Coordenada X del punto
   * @param {number} py - Coordenada Y del punto
   * @param {number} entityX - Posición X de la entidad
   * @param {number} entityY - Posición Y de la entidad
   * @returns {boolean}
   */
  containsPoint(px, py, entityX, entityY) {
    const bounds = this.getBounds(entityX, entityY);
    return px >= bounds.x && px <= bounds.x + bounds.width &&
           py >= bounds.y && py <= bounds.y + bounds.height;
  }

  /**
   * Renderiza el hitbox para debug visual.
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} entityX - Posición X de la entidad
   * @param {number} entityY - Posición Y de la entidad
   * @param {string} [color='rgba(255, 0, 0, 0.3)'] - Color del hitbox
   */
  renderDebug(ctx, entityX, entityY, color = 'rgba(255, 0, 0, 0.3)') {
    const bounds = this.getBounds(entityX, entityY);

    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.restore();
  }

  /**
   * Clona el hitbox (útil para tener múltiples instancias con misma configuración).
   * @returns {Hitbox}
   */
  clone() {
    return new Hitbox({
      width: this.width,
      height: this.height,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      damage: this.damage,
      tags: [...this.tags],
      active: this.active,
    });
  }
}

/**
 * Crea múltiples hitboxes a partir de un array de configuraciones.
 * @param {HitboxConfig[]} configs
 * @returns {Hitbox[]}
 */
export function createHitboxes(configs) {
  return configs.map(c => new Hitbox(c));
}

/**
 * Verifica colisiones entre dos listas de hitboxes.
 * Devuelve los pares (miHitbox, otroHitbox) que colisionan con sus
 * respectivas posiciones de entidad.
 *
 * @param {Hitbox[]} myHitboxes - Mis hitboxes
 * @param {number} myX - Mi posición X
 * @param {number} myY - Mi posición Y
 * @param {Hitbox[]} otherHitboxes - Los hitboxes del otro
 * @param {number} otherX - Posición X del otro
 * @param {number} otherY - Posición Y del otro
 * @returns {Array<{ mine: Hitbox, theirs: Hitbox }>} Pares que colisionan
 */
export function checkHitboxCollisions(myHitboxes, myX, myY, otherHitboxes, otherX, otherY) {
  const results = [];
  for (const mine of myHitboxes) {
    if (!mine.active) continue;
    for (const theirs of otherHitboxes) {
      if (!theirs.active) continue;
      if (mine.intersects(theirs, myX, myY, otherX, otherY)) {
        results.push({ mine, theirs });
      }
    }
  }
  return results;
}

/**
 * Verifica colisiones entre una lista de hitboxes y un rectángulo simple.
 * @param {Hitbox[]} hitboxes
 * @param {number} entityX - Posición X de la entidad
 * @param {number} entityY - Posición Y de la entidad
 * @param {{ x: number, y: number, width: number, height: number }} rect
 * @returns {Hitbox[]} Hitboxes que colisionan
 */
export function checkHitboxesVsRect(hitboxes, entityX, entityY, rect) {
  return hitboxes.filter(h => h.active && h.intersectsRect(rect, entityX, entityY));
}
