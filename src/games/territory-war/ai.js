/**
 * Territory War — Inteligencia artificial del enemigo
 */
import { AudioManager } from '../../engine/AudioManager.js';
import { UNIT_TYPES, TERRAIN_COLS, TERRAIN_ROWS } from './constants.js';

/**
 * La IA compra unidades en los puntos de aparición disponibles
 */
export function aiBuyUnits(state) {
  const spawnPoints = getSpawnPoints(state, 2);
  if (spawnPoints.length === 0) return;

  const affordableUnits = ['infantry', 'archer', 'cavalry'].filter(
    (t) => UNIT_TYPES[t].cost <= state.enemyResources
  );

  if (affordableUnits.length === 0) return;

  const buyCount = Math.min(1 + state.rng.nextInt(0, 1), affordableUnits.length, spawnPoints.length);
  for (let i = 0; i < buyCount; i++) {
    const type = affordableUnits[state.rng.nextInt(0, affordableUnits.length - 1)];
    const cost = UNIT_TYPES[type].cost;
    if (state.enemyResources >= cost && spawnPoints.length > 0) {
      const sp = spawnPoints.shift();
      if (sp) {
        state._addUnit(type, 2, sp.col, sp.row);
        state.enemyResources -= cost;
      }
    }
  }
}

/**
 * La IA ejecuta una acción con su primera unidad disponible
 */
export function aiDoAction(state) {
  const units = getActionableUnits(state, 2);
  if (units.length === 0) {
    state._endTurn();
    return;
  }

  const unit = units[0];

  const attacks = getValidAttacks(state, unit);
  if (attacks.length > 0) {
    const target = attacks.reduce((nearest, t) => {
      const d1 = Math.abs(t.col - unit.col) + Math.abs(t.row - unit.row);
      const d2 = Math.abs(nearest.col - unit.col) + Math.abs(nearest.row - unit.row);
      return d1 < d2 ? t : nearest;
    });

    if (target) {
      state.animating = true;
      state.animationProgress = 0;
      state.animUnit = unit;
      state.animTarget = target;
      state.phase = 'attacking';
      AudioManager.sfx({ type: 'territory_attack', volume: 0.2 });
      return;
    }
  }

  if (unit.type === 'healer') {
    const ally = state.units.find(u => u.owner === 2 && u.hp > 0 && u.hp < u.maxHp &&
      Math.abs(u.col - unit.col) + Math.abs(u.row - unit.row) <= 2);
    if (ally) {
      ally.hp = Math.min(ally.maxHp, ally.hp + 10);
      unit.hasAttacked = true;
      state.particles.burst(state._tileToPixel(ally.col, ally.row).x, state._tileToPixel(ally.col, ally.row).y, '#3a9a5a', 6, 60);
      if (checkAllActionsDone(state)) { state._endTurn(); }
      else { state.aiTimer = 0.3 + state.rng.next() * 0.3; }
      return;
    }
  }

  if (!unit.hasMoved) {
    const moves = getValidMoves(state, unit);
    if (moves.length > 0) {
      const sorted = moves.sort((a, b) => a.col - b.col);
      const bestMove = sorted[0];
      if (bestMove) {
        unit.col = bestMove.col;
        unit.row = bestMove.row;
        unit.hasMoved = true;
        captureTerritory(state, bestMove.col, bestMove.row, 2);
      }
    }
  }

  unit.hasAttacked = true;
  if (checkAllActionsDone(state)) { state._endTurn(); }
  else { state.aiTimer = 0.3 + state.rng.next() * 0.3; }
}

/**
 * Obtiene puntos de aparición para un propietario
 */
export function getSpawnPoints(state, owner) {
  const points = [];
  for (let row = 0; row < TERRAIN_ROWS; row++) {
    for (let col = 0; col < TERRAIN_COLS; col++) {
      if (state.territory[row][col].isSpawn && state.territory[row][col].owner === owner) {
        const occupied = state.units.some((u) => u.col === col && u.row === row && u.hp > 0);
        if (!occupied) points.push({ col, row });
      }
    }
  }
  return points;
}

/**
 * Obtiene unidades accionables para un propietario
 */
export function getActionableUnits(state, owner) {
  return state.units.filter(
    (u) => u.owner === owner && u.hp > 0 && (!u.hasMoved || !u.hasAttacked)
  );
}

/**
 * Obtiene movimientos válidos para una unidad
 */
export function getValidMoves(state, unit) {
  if (unit.hasMoved) return [];
  const moves = [];
  for (let dr = -unit.moveRange; dr <= unit.moveRange; dr++) {
    for (let dc = -unit.moveRange; dc <= unit.moveRange; dc++) {
      if (dr === 0 && dc === 0) continue;
      const dist = Math.abs(dr) + Math.abs(dc);
      if (dist > unit.moveRange) continue;

      const nr = unit.row + dr;
      const nc = unit.col + dc;
      if (nr < 0 || nr >= TERRAIN_ROWS || nc < 0 || nc >= TERRAIN_COLS) continue;

      const occupied = state.units.some((u) => u.col === nc && u.row === nr && u.hp > 0);
      if (occupied) continue;

      moves.push({ col: nc, row: nr });
    }
  }
  return moves;
}

/**
 * Obtiene ataques válidos para una unidad
 */
export function getValidAttacks(state, unit) {
  if (unit.hasAttacked) return [];
  const targets = [];
  for (const other of state.units) {
    if (other.owner === unit.owner || other.hp <= 0) continue;
    const dist = Math.abs(other.col - unit.col) + Math.abs(other.row - unit.row);
    if (dist <= unit.range) targets.push(other);
  }
  return targets;
}

/**
 * Captura territorio alrededor de una posición
 */
export function captureTerritory(state, col, row, owner) {
  const directions = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dc, dr] of directions) {
    const nc = col + dc;
    const nr = row + dr;
    if (nc >= 0 && nc < TERRAIN_COLS && nr >= 0 && nr < TERRAIN_ROWS) {
      if (state.territory[nr][nc].owner !== owner) {
        state.territory[nr][nc].owner = owner;
        state.particles.burst(
          state._tileToPixel(nc, nr).x,
          state._tileToPixel(nc, nr).y,
          owner === 1 ? '#4a9eff' : '#e74c3c', 5, 60
        );
      }
    }
  }
}

/**
 * Comprueba si todas las unidades del turno actual han actuado
 */
export function checkAllActionsDone(state) {
  const actionable = getActionableUnits(state, state.turn);
  return actionable.length === 0;
}
