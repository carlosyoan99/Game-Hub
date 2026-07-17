/**
 * Bejeweled-like (Match-3 Puzzle)
 *
 * Mecánica: grid 8×8, intercambia gemas adyacentes para
 * hacer match-3+, cascadas por gravedad, gemas especiales
 * (rayadas + bomba), multiplicador de cascada.
 *
 * Módulos:
 *   constants.js — Configuración del grid, tipos de gemas, modos
 *   board.js     — Lógica del tablero: matches, gravedad, mezcla
 *   render.js    — Renderizado de gemas, HUD y pantallas
 */
import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { pointInRect } from '../../engine/CollisionUtils.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

import { GRID_COLS, GRID_ROWS, GEM_SIZE, GEM_GAP, MODE_CONFIGS, SWAP_DURATION } from './constants.js';
import { updateParticles } from '../../engine/ParticleSystem.js';

import {
  generateBoard, hasMatches, processMatches,
  getGridFromPos, getModeCardBounds,
} from './board.js';
import { renderGame } from './render.js';

export class Bejeweled extends GameBase {
  init(engine) {
    super.init(engine, 'bejeweled');
    this.highscore = this.storage.get('highscore', 0);
    this.startTime = Date.now();
    this.phase = 'select';
    this.selectedMode = 0;
    this.totalGemsCleared = 0;
    this._startSelect();
  }

  _defaultBindings() {
    return {
      select: ['Space', 'Enter', 'GamepadA'],
      left:   ['ArrowLeft', 'KeyA', 'GamepadLeft'],
      right:  ['ArrowRight', 'KeyD', 'GamepadRight'],
      up:     ['ArrowUp', 'KeyW', 'GamepadUp'],
      down:   ['ArrowDown', 'KeyS', 'GamepadDown'],
      confirm: ['Space', 'Enter', 'GamepadA'],
    };
  }

  _startSelect() {
    this.phase = 'select';
    this.selectBlink = 0;
  }

  _startGame(modeIdx) {
    const modeKeys = ['classic', 'timeattack', 'endless'];
    this.modeKey = modeKeys[modeIdx] || 'classic';
    this.modeConfig = MODE_CONFIGS[this.modeKey];

    this.grid = [];
    this.score = 0;
    this.moves = this.modeConfig.initialMoves;
    this.targetScore = this.modeConfig.targetScore;
    this.timeLimit = this.modeConfig.timeLimit || 0;
    this.timeRemaining = this.timeLimit;
    this.combo = 0;
    this.maxCombo = 0;
    this.totalGemsCleared = 0;
    this.animating = false;
    this.paused = false;
    this.status = 'playing';
    this.phase = 'playing';

    this.animQueue = [];
    this.animTimer = 0;
    this.cascadeTimer = 0;

    this.selectedGem = null;
    this.swapAnim = null;

    this.particles = [];

    generateBoard(this.grid, this.rng);

    const totalW = GRID_COLS * (GEM_SIZE + GEM_GAP) - GEM_GAP;
    this.boardX = (this.width - totalW) / 2;
    this.boardY = 60;

    if (this.modeKey === 'timeattack') {
      this.gameTimer = setInterval(() => {
        this.timeRemaining--;
        if (this.timeRemaining <= 0) {
          this._endGame(this.score >= this.targetScore);
        }
      }, 1000);
    }
  }

  update(dt) {
    if (this.phase === 'select') {
      this._updateSelect(dt);
      return;
    }
    if (this.handleRestartInput()) return;

    if (this.paused) return;

    if (this.swapAnim) {
      this.swapAnim.t += dt / SWAP_DURATION;
      if (this.swapAnim.t >= 1) {
        this.swapAnim = null;
        this._afterSwap();
      }
      return;
    }

    if (this.cascadeTimer > 0) {
      this.cascadeTimer -= dt;
      if (this.cascadeTimer <= 0) {
        this.cascadeTimer = 0;
        processMatches(this);
      }
      return;
    }

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.messageText = null;
    }

    if (this.input.mouse.clickedThisFrame) {
      const pos = getGridFromPos(this, this.input.mouse.x, this.input.mouse.y);
      if (pos) {
        this._onGemClick(pos.col, pos.row);
      }
    }

    if (this.input.wasActionPressed('left') && this.cursorCol !== undefined) {
      this.cursorCol = Math.max(0, this.cursorCol - 1);
    }
    if (this.input.wasActionPressed('right') && this.cursorCol !== undefined) {
      this.cursorCol = Math.min(GRID_COLS - 1, this.cursorCol + 1);
    }
    if (this.input.wasActionPressed('up') && this.cursorRow !== undefined) {
      this.cursorRow = Math.max(0, this.cursorRow - 1);
    }
    if (this.input.wasActionPressed('down') && this.cursorRow !== undefined) {
      this.cursorRow = Math.min(GRID_ROWS - 1, this.cursorRow + 1);
    }
    if (this.input.wasActionPressed('confirm') && this.cursorCol !== undefined && this.cursorRow !== undefined) {
      this._onGemClick(this.cursorCol, this.cursorRow);
    }

    if (this.cursorCol === undefined) {
      this.cursorCol = 3;
      this.cursorRow = 3;
    }

    this.particles = updateParticles(this.particles, dt, 300);

    if (this.modeKey === 'timeattack' && this.timeRemaining <= 0) {
      this._endGame(this.score >= this.targetScore);
    }
  }

  _updateSelect(dt) {
    this.selectBlink += dt;

    if (this.input.wasActionPressed('left') || this.input.wasActionPressed('up')) {
      this.selectedMode = (this.selectedMode - 1 + 3) % 3;
      AudioManager.sfx({ type: 'select', volume: 0.2 });
    }
    if (this.input.wasActionPressed('right') || this.input.wasActionPressed('down')) {
      this.selectedMode = (this.selectedMode + 1) % 3;
      AudioManager.sfx({ type: 'select', volume: 0.2 });
    }
    if (this.input.wasActionPressed('select') || this.input.mouse.clickedThisFrame) {
      const modeKeys = ['classic', 'timeattack', 'endless'];
      for (let i = 0; i < modeKeys.length; i++) {
        const cardBounds = getModeCardBounds(this, i);
        if (pointInRect(this.input.mouse.x, this.input.mouse.y, cardBounds)) {
          this.selectedMode = i;
        }
      }
      AudioManager.sfx({ type: 'powerup', volume: 0.3 });
      this._startGame(this.selectedMode);
    }
  }

  _onGemClick(col, row) {
    if (this.animating || this.phase !== 'playing') return;

    if (this.selectedGem) {
      const { col: selCol, row: selRow } = this.selectedGem;
      const dx = Math.abs(col - selCol);
      const dy = Math.abs(row - selRow);

      if (col === selCol && row === selRow) {
        this.selectedGem = null;
        AudioManager.sfx({ type: 'select', volume: 0.1 });
        return;
      }

      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        this._trySwap(selCol, selRow, col, row);
      } else {
        this.selectedGem = { col, row };
        AudioManager.sfx({ type: 'select', volume: 0.15 });
      }
    } else {
      this.selectedGem = { col, row };
      this.cursorCol = col;
      this.cursorRow = row;
      AudioManager.sfx({ type: 'select', volume: 0.15 });
    }
  }

  _trySwap(col1, row1, col2, row2) {
    this.swapAnim = {
      col1, row1, col2, row2,
      gem1: { ...this.grid[row1][col1] },
      gem2: { ...this.grid[row2][col2] },
      t: 0,
    };
    this.selectedGem = null;
    this.animating = true;

    [this.grid[row1][col1], this.grid[row2][col2]] = [this.grid[row2][col2], this.grid[row1][col1]];

    AudioManager.sfx({ type: 'select', volume: 0.2 });
  }

  _afterSwap() {
    if (!hasMatches(this.grid)) {
      const s = this.swapAnim;
      [this.grid[s.row1][s.col1], this.grid[s.row2][s.col2]] = [this.grid[s.row2][s.col2], this.grid[s.row1][s.col1]];
      this.animating = false;
      AudioManager.sfx({ type: 'hit', volume: 0.2 });
      return;
    }

    if (this.moves > 0) this.moves--;
    this.combo = 0;

    processMatches(this);
  }

  _endGame(won) {
    if (this.gameTimer) clearInterval(this.gameTimer);
    this.phase = won ? 'won' : 'lost';
    this.status = won ? 'won' : 'lost';

    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }

    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('bejeweled', this.score, won, duration);

    if (won) ProgressionManager.checkAchievement('bejeweled', 'first-clear');
    if (this.maxCombo >= 5) ProgressionManager.checkAchievement('bejeweled', 'cascade-master');
    if (this.totalGemsCleared >= 100) ProgressionManager.checkAchievement('bejeweled', 'gem-hoarder');
    if (this.modeKey === 'timeattack' && won) ProgressionManager.checkAchievement('bejeweled', 'speed-demon');
  }

  _restart() {
    if (this.gameTimer) clearInterval(this.gameTimer);
    this._startSelect();
    this.score = 0;
    this.totalGemsCleared = 0;
    this.status = 'playing';
  }

  render(ctx) {
    renderGame(ctx, this);
  }
}
