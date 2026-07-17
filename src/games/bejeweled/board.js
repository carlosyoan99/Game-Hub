/**
 * Bejeweled — Lógica del tablero: generación, emparejamientos, gravedad, mezcla
 */
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { spawnParticles } from '../../engine/ParticleSystem.js';
import { t } from '../../engine/i18n.js';
import { GRID_COLS, GRID_ROWS, GEM_TYPES, GEM_SIZE, GEM_GAP } from './constants.js';

const _rn = (rng) => rng ? rng.next() : Math.random();

/**
 * Genera un tablero sin emparejamientos iniciales
 */
export function generateBoard(grid, rng) {
  for (let row = 0; row < GRID_ROWS; row++) {
    grid[row] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      let type;
      do {
        type = Math.floor(_rn(rng) * GEM_TYPES.length);
      } while (wouldMatch(grid, row, col, type));
      grid[row][col] = { type, special: null };
    }
  }
}

/**
 * Comprueba si colocar un tipo en (row, col) crearía un match
 */
export function wouldMatch(grid, row, col, type) {
  if (col >= 2 &&
    grid[row][col - 1]?.type === type &&
    grid[row][col - 2]?.type === type) return true;
  if (row >= 2 &&
    grid[row - 1]?.[col]?.type === type &&
    grid[row - 2]?.[col]?.type === type) return true;
  return false;
}

/**
 * Encuentra todos los emparejamientos en el tablero
 */
export function findMatches(grid) {
  const matched = new Set();

  for (let row = 0; row < GRID_ROWS; row++) {
    let runStart = 0;
    for (let col = 1; col <= GRID_COLS; col++) {
      if (col < GRID_COLS && grid[row][col]?.type === grid[row][runStart]?.type) continue;
      const runLen = col - runStart;
      if (runLen >= 3) {
        for (let c = runStart; c < col; c++) {
          matched.add(`${c},${row}`);
        }
      }
      runStart = col;
    }
  }

  for (let col = 0; col < GRID_COLS; col++) {
    let runStart = 0;
    for (let row = 1; row <= GRID_ROWS; row++) {
      if (row < GRID_ROWS && grid[row][col]?.type === grid[runStart][col]?.type) continue;
      const runLen = row - runStart;
      if (runLen >= 3) {
        for (let r = runStart; r < row; r++) {
          matched.add(`${col},${r}`);
        }
      }
      runStart = row;
    }
  }

  return [...matched].map(k => {
    const [c, r] = k.split(',').map(Number);
    return { col: c, row: r };
  });
}

/**
 * Comprueba si hay algún emparejamiento en el tablero
 */
export function hasMatches(grid) {
  return findMatches(grid).length > 0;
}

/**
 * Agrupa emparejamientos conectados del mismo tipo
 */
export function groupMatches(grid, matches) {
  const visited = new Set();
  const groups = [];

  for (const m of matches) {
    const key = `${m.col},${m.row}`;
    if (visited.has(key)) continue;

    const group = [m];
    visited.add(key);
    const type = grid[m.row][m.col]?.type;

    const stack = [m];
    while (stack.length > 0) {
      const curr = stack.pop();
      for (const n of matches) {
        const nKey = `${n.col},${n.row}`;
        if (visited.has(nKey)) continue;
        if (grid[n.row][n.col]?.type !== type) continue;
        const dx = Math.abs(n.col - curr.col);
        const dy = Math.abs(n.row - curr.row);
        if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
          visited.add(nKey);
          group.push(n);
          stack.push(n);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

/**
 * Procesa los emparejamientos: puntúa, crea gemas especiales, aplica gravedad
 */
export function processMatches(state) {
  const matches = findMatches(state.grid);
  if (matches.length === 0) {
    state.animating = false;
    checkEndConditions(state);
    return;
  }

  state.combo++;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;

  const matchGroups = groupMatches(state.grid, matches);

  for (const group of matchGroups) {
    const len = group.length;
    const type = state.grid[group[0].row][group[0].col]?.type;

    let special = null;
    if (len >= 5) {
      special = 'bomb';
      showMessage(state, t('bejeweled.match5'));
    } else if (len === 4) {
      special = 'striped';
      showMessage(state, t('bejeweled.match4'));
    } else {
      showMessage(state, t('bejeweled.match3'));
    }

    const baseScore = len * 10;
    const cascadeMult = Math.min(state.combo, 8);
    state.score += baseScore * cascadeMult;
    state.totalGemsCleared += len;

    for (const g of group) {
      const pos = getGemPos(state, g.col, g.row);
      spawnParticles(state.particles, pos.x + GEM_SIZE / 2, pos.y + GEM_SIZE / 2, GEM_TYPES[type].color, 6);
    }

    for (let i = 0; i < group.length; i++) {
      const g = group[i];
      if (i === 0 && special) {
        state.grid[g.row][g.col] = { type, special };
      } else {
        state.grid[g.row][g.col] = null;
      }
    }
  }

  AudioManager.sfx({ type: 'powerup', volume: 0.25 });
  HapticManager.vibrate('hit');

  applyGravity(state);
}

/**
 * Aplica gravedad: las gemas caen para llenar espacios vacíos
 */
export function applyGravity(state) {
  const rng = state.rng;
  let moved = false;
  for (let col = 0; col < GRID_COLS; col++) {
    let writeRow = GRID_ROWS - 1;
    for (let row = GRID_ROWS - 1; row >= 0; row--) {
      if (state.grid[row][col] !== null) {
        if (row !== writeRow) {
          state.grid[writeRow][col] = state.grid[row][col];
          state.grid[row][col] = null;
          moved = true;
        }
        writeRow--;
      }
    }
    for (let row = writeRow; row >= 0; row--) {
      state.grid[row][col] = {
        type: Math.floor(_rn(rng) * GEM_TYPES.length),
        special: null,
      };
      moved = true;
    }
  }

  if (moved) {
    state.cascadeTimer = 0.08;
  } else {
    checkEndConditions(state);
  }
}

/**
 * Comprueba condiciones de fin de juego
 */
export function checkEndConditions(state) {
  if (state.phase !== 'playing') return;

  if (!hasValidMoves(state.grid)) {
    shuffleBoard(state.grid);
    showMessage(state, '¡Revolviendo!');
    return;
  }

  if (state.moves === 0 && state.score >= state.targetScore) {
    state._endGame(true);
  } else if (state.moves === 0) {
    state._endGame(false);
  }
}

/**
 * Comprueba si hay movimientos válidos en el tablero
 */
export function hasValidMoves(grid) {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (col + 1 < GRID_COLS) {
        [grid[row][col], grid[row][col + 1]] = [grid[row][col + 1], grid[row][col]];
        if (hasMatches(grid)) {
          [grid[row][col], grid[row][col + 1]] = [grid[row][col + 1], grid[row][col]];
          return true;
        }
        [grid[row][col], grid[row][col + 1]] = [grid[row][col + 1], grid[row][col]];
      }
      if (row + 1 < GRID_ROWS) {
        [grid[row][col], grid[row + 1][col]] = [grid[row + 1][col], grid[row][col]];
        if (hasMatches(grid)) {
          [grid[row][col], grid[row + 1][col]] = [grid[row + 1][col], grid[row][col]];
          return true;
        }
        [grid[row][col], grid[row + 1][col]] = [grid[row + 1][col], grid[row][col]];
      }
    }
  }
  return false;
}

/**
 * Mezcla el tablero (regenera sin matches iniciales)
 */
export function shuffleBoard(grid, rng) {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      grid[row][col] = {
        type: Math.floor(_rn(rng) * GEM_TYPES.length),
        special: null,
      };
    }
  }
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      while (wouldMatch(grid, row, col, grid[row][col].type)) {
        grid[row][col].type = Math.floor(_rn(rng) * GEM_TYPES.length);
      }
    }
  }
}

/**
 * Obtiene la posición (x, y) de una gema en el grid
 */
export function getGemPos(state, col, row) {
  return {
    x: state.boardX + col * (GEM_SIZE + GEM_GAP),
    y: state.boardY + row * (GEM_SIZE + GEM_GAP),
  };
}

/**
 * Obtiene el grid (col, row) desde coordenadas de pantalla
 */
export function getGridFromPos(state, x, y) {
  const col = Math.floor((x - state.boardX) / (GEM_SIZE + GEM_GAP));
  const row = Math.floor((y - state.boardY) / (GEM_SIZE + GEM_GAP));
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return { col, row };
}

/**
 * Muestra un mensaje temporal en pantalla
 */
export function showMessage(state, text) {
  state.messageText = text;
  state.messageTimer = 1.2;
}

/**
 * Obtiene los bounds de una tarjeta de modo en la pantalla de selección
 */
export function getModeCardBounds(state, idx) {
  const cards = ['classic', 'timeattack', 'endless'];
  const cardW = 200;
  const cardH = 200;
  const gap = 30;
  const totalW = cards.length * cardW + (cards.length - 1) * gap;
  const startX = (state.width - totalW) / 2;
  return {
    x: startX + idx * (cardW + gap),
    y: 100,
    width: cardW,
    height: cardH,
  };
}
