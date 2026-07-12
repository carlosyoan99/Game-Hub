import { aabbIntersects } from './CollisionUtils.js';

/**
 * Tilemap
 * Representa un nivel de plataformas como cuadrícula de enteros
 * (0 = vacío, cualquier otro valor = sólido por defecto). Resuelve
 * colisiones por eje separado (X primero, luego Y) contra un AABB —
 * es la técnica clásica para que las esquinas de las baldosas no
 * "enganchen" al personaje y para poder distinguir suelo/techo/pared
 * a partir de qué eje detuvo el movimiento.
 */
export class Tilemap {
  constructor({ data, tileSize, solidTiles = null }) {
    this.data = data; // data[row][col] = id de baldosa
    this.tileSize = tileSize;
    this.rows = data.length;
    this.cols = data[0]?.length ?? 0;
    this.isSolidTile = solidTiles ? (id) => solidTiles.has(id) : (id) => id !== 0;
  }

  get pixelWidth() {
    return this.cols * this.tileSize;
  }

  get pixelHeight() {
    return this.rows * this.tileSize;
  }

  tileAt(col, row) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return 0;
    return this.data[row][col];
  }

  /**
   * Mueve `entity` (objeto con x,y,width,height) según vx/vy y resuelve
   * colisiones contra las baldosas sólidas. Devuelve qué lados tocaron
   * algo, para que el juego decida (aterrizar, cortar velocidad, etc).
   */
  resolveAABB(entity, vx, vy, dt) {
    const result = { onGround: false, onCeiling: false, onWall: false };

    entity.x += vx * dt;
    this._resolveAxis(entity, 'x', vx, result);

    entity.y += vy * dt;
    this._resolveAxis(entity, 'y', vy, result);

    return result;
  }

  _resolveAxis(entity, axis, velocity, result) {
    if (velocity === 0) return;

    const left = Math.floor(entity.x / this.tileSize);
    const right = Math.floor((entity.x + entity.width) / this.tileSize);
    const top = Math.floor(entity.y / this.tileSize);
    const bottom = Math.floor((entity.y + entity.height) / this.tileSize);

    // Se recoge la corrección MÁS RESTRICTIVA de todas las baldosas
    // sólidas tocadas, no la última recorrida por el bucle: si el AABB
    // barre varias columnas/filas sólidas en un mismo frame (dt alto,
    // movimiento rápido), sobrescribir con la última encontrada podría
    // "teletransportar" la entidad a través de la fila en vez de
    // detenerla en la primera baldosa que realmente bloquea el paso.
    let bestCorrection = null;
    // Reusar el mismo objeto para evitar presión de GC.
    const tileRect = { x: 0, y: 0, width: this.tileSize, height: this.tileSize };

    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (!this.isSolidTile(this.tileAt(col, row))) continue;

        tileRect.x = col * this.tileSize;
        tileRect.y = row * this.tileSize;
        if (!aabbIntersects(entity, tileRect)) continue;

        if (axis === 'x') {
          const candidate = velocity > 0 ? tileRect.x - entity.width : tileRect.x + this.tileSize;
          bestCorrection = bestCorrection === null ? candidate : pickMoreRestrictive(bestCorrection, candidate, velocity);
          result.onWall = true;
        } else {
          const candidate = velocity > 0 ? tileRect.y - entity.height : tileRect.y + this.tileSize;
          bestCorrection = bestCorrection === null ? candidate : pickMoreRestrictive(bestCorrection, candidate, velocity);
          if (velocity > 0) result.onGround = true;
          else result.onCeiling = true;
        }
      }
    }

    if (bestCorrection !== null) {
      if (axis === 'x') entity.x = bestCorrection;
      else entity.y = bestCorrection;
    }
  }

  /** Dibuja solo las baldosas visibles dentro del viewport (coords de mundo). */
  render(ctx, viewport, tileColors = {}) {
    const startCol = Math.max(0, Math.floor(viewport.x / this.tileSize));
    const endCol = Math.min(this.cols - 1, Math.floor((viewport.x + viewport.width) / this.tileSize));
    const startRow = Math.max(0, Math.floor(viewport.y / this.tileSize));
    const endRow = Math.min(this.rows - 1, Math.floor((viewport.y + viewport.height) / this.tileSize));

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const tile = this.tileAt(col, row);
        if (tile === 0) continue;
        ctx.fillStyle = tileColors[tile] ?? '#3a4552';
        ctx.fillRect(col * this.tileSize, row * this.tileSize, this.tileSize, this.tileSize);
      }
    }
  }

  /**
   * Construye la matriz de datos desde "arte ASCII": un array de strings
   * donde cada carácter es una baldosa, más una leyenda carácter -> id.
   * Mucho más legible para diseñar niveles a mano que un array de
   * números. Devuelve `data`, no un Tilemap — así el juego decide si
   * quiere postprocesar caracteres especiales (metas, spawns, enemigos)
   * antes de construir el Tilemap final.
   */
  static parseAscii(rows, legend) {
    return rows.map((row) => [...row].map((ch) => legend[ch] ?? 0));
  }
}

/**
 * Entre dos posiciones corregidas candidatas, devuelve la más restrictiva:
 * con velocidad positiva (moviéndose hacia +x/+y) la más pequeña detiene
 * antes; con velocidad negativa, la más grande detiene antes.
 */
function pickMoreRestrictive(a, b, velocity) {
  return velocity > 0 ? Math.min(a, b) : Math.max(a, b);
}
