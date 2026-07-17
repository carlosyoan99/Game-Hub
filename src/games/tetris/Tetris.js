import { GameBase } from '../../engine/GameBase.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ── Constantes ──────────────────────────────────────────────────────────

const COLS = 10;
const ROWS = 20;
const CELL = 24;
const GRID_X = 80;
const GRID_Y = 30;

const PIECE_SIZE = 4;
const FALL_INTERVAL_BASE = 0.8;

// Tetromino shapes: [rotationState][row][col]
const SHAPES = {
  I: [
    [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
    [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
  ],
  O: [
    [[0,0,0,0],[0,1,1,0],[0,1,1,0],[0,0,0,0]],
    [[0,0,0,0],[0,1,1,0],[0,1,1,0],[0,0,0,0]],
    [[0,0,0,0],[0,1,1,0],[0,1,1,0],[0,0,0,0]],
    [[0,0,0,0],[0,1,1,0],[0,1,1,0],[0,0,0,0]],
  ],
  T: [
    [[0,0,0,0],[0,1,0,0],[1,1,1,0],[0,0,0,0]],
    [[0,0,0,0],[0,1,0,0],[0,1,1,0],[0,1,0,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,0],[0,1,0,0]],
    [[0,0,0,0],[0,1,0,0],[1,1,0,0],[0,1,0,0]],
  ],
  S: [
    [[0,0,0,0],[0,1,1,0],[1,1,0,0],[0,0,0,0]],
    [[0,0,0,0],[0,1,0,0],[0,1,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,0,0,0],[0,1,1,0],[1,1,0,0]],
    [[0,0,0,0],[1,0,0,0],[1,1,0,0],[0,1,0,0]],
  ],
  Z: [
    [[0,0,0,0],[1,1,0,0],[0,1,1,0],[0,0,0,0]],
    [[0,0,0,0],[0,0,1,0],[0,1,1,0],[0,1,0,0]],
    [[0,0,0,0],[0,0,0,0],[0,1,1,0],[1,1,0,0]],
    [[0,0,0,0],[0,1,0,0],[1,1,0,0],[1,0,0,0]],
  ],
  J: [
    [[0,0,0,0],[1,0,0,0],[1,1,1,0],[0,0,0,0]],
    [[0,0,0,0],[0,1,1,0],[0,1,0,0],[0,1,0,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,0],[0,0,1,0]],
    [[0,0,0,0],[0,1,0,0],[0,1,0,0],[1,1,0,0]],
  ],
  L: [
    [[0,0,0,0],[0,0,1,0],[1,1,1,0],[0,0,0,0]],
    [[0,0,0,0],[0,1,0,0],[0,1,0,0],[0,1,1,0]],
    [[0,0,0,0],[0,0,0,0],[1,1,1,0],[1,0,0,0]],
    [[0,0,0,0],[1,1,0,0],[0,1,0,0],[0,1,0,0]],
  ],
};

const PIECE_NAMES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const PIECE_COLORS = {
  I: '#45d66c', O: '#ffb454', T: '#9b59b6',
  S: '#2ecc71', Z: '#e74c3c', J: '#3498db', L: '#f39c12',
};
const LINE_SCORES = [0, 100, 300, 500, 800];

const COLORS = {
  bg: '#0b0f14',
  grid: '#1a1f26',
  ghost: 'rgba(255,255,255,0.1)',
  hud: '#9aa7b2',

  previewBg: '#11151a',
};

export class Tetris extends GameBase {
  init(engine) {
    super.init(engine, 'tetris');
    this.highscore = this.storage.get('highscore', 0);

    this.particles = new ParticleSystem(100);
    this.startTime = Date.now();

    this._restart();
  }

  _defaultBindings() {
    return {
      moveLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      rotate:    ['ArrowUp', 'KeyW', 'GamepadUp', 'GamepadRStickUp'],
      hardDrop:  ['Space', 'GamepadA', 'GamepadB'],
      softDrop:  ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      pause:     ['KeyP', 'Escape'],
      restart:   ['Space', 'GamepadStart', 'GamepadA'],
    };
  }

  _restart() {
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.fallTimer = 0;
    this.fallInterval = FALL_INTERVAL_BASE;
    this.softDropping = false;
    this.status = 'playing';
    this.paused = false;
    this.lockTimer = 0;
    this.lockDelay = 0.1;
    this.bag = [];
    this.nextPiece = null;

    this._fillBag();
    this._spawnPiece();
    this._updateGhost();
  }

  _fillBag() {
    // 7-bag randomizer
    const pieces = [...PIECE_NAMES];
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = this.rng.nextInt(0, i);
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    this.bag = pieces;
  }

  _getNextFromBag() {
    if (this.bag.length === 0) this._fillBag();
    return this.bag.pop();
  }

  _spawnPiece() {
    const name = this.nextPiece || this._getNextFromBag();
    this.nextPiece = this._getNextFromBag();

    this.piece = {
      name,
      shape: 0, // rotation state
      x: Math.floor((COLS - PIECE_SIZE) / 2),
      y: 0,
    };

    // Comprobar game over
    if (this._collides(this.piece.x, this.piece.y, this._getShape())) {
      this._endGame();
    }

    this._updateGhost();
    this.lockTimer = 0;
    this.softDropping = false;
  }

  _getShape() {
    return SHAPES[this.piece.name][this.piece.shape];
  }

  _getGhostY() {
    let gy = this.piece.y;
    while (!this._collides(this.piece.x, gy + 1, this._getShape())) gy++;
    return gy;
  }

  _updateGhost() {
    this.ghostY = this._getGhostY();
  }

  _collides(x, y, shape) {
    for (let r = 0; r < PIECE_SIZE; r++) {
      for (let c = 0; c < PIECE_SIZE; c++) {
        if (!shape[r][c]) continue;
        const gx = x + c;
        const gy = y + r;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy < 0) continue;
        if (this.grid[gy][gx]) return true;
      }
    }
    return false;
  }

  _lockPiece() {
    const shape = this._getShape();
    for (let r = 0; r < PIECE_SIZE; r++) {
      for (let c = 0; c < PIECE_SIZE; c++) {
        if (!shape[r][c]) continue;
        const gx = this.piece.x + c;
        const gy = this.piece.y + r;
        if (gy >= 0 && gy < ROWS && gx >= 0 && gx < COLS) {
          this.grid[gy][gx] = this.piece.name;
        }
      }
    }

    AudioManager.sfx({ type: 'tetris_drop', volume: 0.25 });
    HapticManager.vibrate('hit');

    // Comprobar líneas completas
    this._checkLines();

    // Siguiente pieza
    this._spawnPiece();
  }

  _checkLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.grid[r].every((c) => c !== 0)) {
        this.grid.splice(r, 1);
        this.grid.unshift(Array(COLS).fill(0));
        cleared++;
        r++; // re-check this row
      }
    }

    if (cleared > 0) {
      this.score += (LINE_SCORES[cleared] || 800) * this.level;
      this.lines += cleared;
      this.level = Math.floor(this.lines / 10) + 1;
      this.fallInterval = Math.max(0.08, FALL_INTERVAL_BASE - (this.level - 1) * 0.06);
      AudioManager.sfx({ type: 'tetris_clear', volume: 0.3 + cleared * 0.1 });
      HapticManager.vibrate('powerup');

      // Partículas en cada línea
      for (let i = 0; i < cleared; i++) {
        this.particles.burst(this.width / 2, GRID_Y + (ROWS - 1 - i) * CELL, '#f0e6b3', 15, 100);
      }
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.wasActionPressed('restart') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }

      return;
    }

    // Toggle pausa
    if (this.input.wasActionPressed('pause')) {
      this.paused = !this.paused;
      if (this.paused) AudioManager.sfx({ type: 'select', volume: 0.2 });
    }

    if (this.paused) {

      return;
    }

    // Input horizontal
    if (this.input.wasActionPressed('moveLeft')) {
      if (!this._collides(this.piece.x - 1, this.piece.y, this._getShape())) {
        this.piece.x--;
        this._updateGhost();
        AudioManager.sfx({ type: 'select', volume: 0.1 });
      }
    }
    if (this.input.wasActionPressed('moveRight')) {
      if (!this._collides(this.piece.x + 1, this.piece.y, this._getShape())) {
        this.piece.x++;
        this._updateGhost();
        AudioManager.sfx({ type: 'select', volume: 0.1 });
      }
    }

    // Rotación
    if (this.input.wasActionPressed('rotate')) {
      const newShape = (this.piece.shape + 1) % 4;
      if (!this._collides(this.piece.x, this.piece.y, SHAPES[this.piece.name][newShape])) {
        this.piece.shape = newShape;
        this._updateGhost();
        AudioManager.sfx({ type: 'select', volume: 0.15 });
      } else {
        // Wall kick: intentar desplazar
        for (const dx of [-1, 1, -2, 2]) {
          if (!this._collides(this.piece.x + dx, this.piece.y, SHAPES[this.piece.name][newShape])) {
            this.piece.x += dx;
            this.piece.shape = newShape;
            this._updateGhost();
            AudioManager.sfx({ type: 'select', volume: 0.15 });
            break;
          }
        }
      }
    }

    // Hard drop
    if (this.input.wasActionPressed('hardDrop')) {
      this.score += (this.ghostY - this.piece.y) * 2;
      this.piece.y = this.ghostY;
      this._lockPiece();

      return;
    }

    // Soft drop
    this.softDropping = this.input.isActionDown('softDrop');

    // Caída
    const interval = this.softDropping ? this.fallInterval * 0.05 : this.fallInterval;
    this.fallTimer += dt;

    if (this.fallTimer >= interval) {
      this.fallTimer = 0;
      if (!this._collides(this.piece.x, this.piece.y + 1, this._getShape())) {
        this.piece.y++;
        this._updateGhost();
      }
    }

    // Lock delay — verifica CADA frame (no solo en ticks de caída)
    if (this._collides(this.piece.x, this.piece.y + 1, this._getShape())) {
      this.lockTimer += dt;
      if (this.lockTimer >= this.lockDelay) {
        this._lockPiece();
      }
    } else {
      this.lockTimer = 0;
    }

    this.input.endFrame();
  }

  _endGame() {
    this.status = 'game-over';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('tetris', this.score, false, duration);
    if (this.linesCleared >= 1) ProgressionManager.checkAchievement('tetris', 'first-line');
    if (this.linesCleared >= 50) ProgressionManager.checkAchievement('tetris', 'line-clear-50');
    if (this.linesCleared >= 100) ProgressionManager.checkAchievement('tetris', 'tetris-master');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    this._renderGrid(ctx);
    this._renderGhost(ctx);
    this._renderPiece(ctx);
    this._renderPreview(ctx);
    this.particles.render(ctx);      this.renderHUD(ctx, { extraRight: [`${this.lines} LINES`] });

    if (this.paused) {
      this.renderPauseOverlay(ctx);
    } else if (this.status !== 'playing') {
      renderOverlay(ctx, { width: this.width, height: this.height, score: this.score });
    }
  }

  _renderGrid(ctx) {
    // Fondo del grid
    ctx.fillStyle = COLORS.grid;
    ctx.fillRect(GRID_X, GRID_Y, COLS * CELL, ROWS * CELL);

    // Líneas de grid
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 0.5;
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(GRID_X, GRID_Y + r * CELL);
      ctx.lineTo(GRID_X + COLS * CELL, GRID_Y + r * CELL);
      ctx.stroke();
    }
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(GRID_X + c * CELL, GRID_Y);
      ctx.lineTo(GRID_X + c * CELL, GRID_Y + ROWS * CELL);
      ctx.stroke();
    }

    // Piezas colocadas
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!this.grid[r][c]) continue;
        ctx.fillStyle = PIECE_COLORS[this.grid[r][c]] || '#888';
        const x = GRID_X + c * CELL;
        const y = GRID_Y + r * CELL;
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        // Brillo
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x + 1, y + 1, CELL - 2, 3);
      }
    }
  }

  _renderPiece(ctx) {
    if (!this.piece) return;
    const shape = this._getShape();
    const color = PIECE_COLORS[this.piece.name];

    for (let r = 0; r < PIECE_SIZE; r++) {
      for (let c = 0; c < PIECE_SIZE; c++) {
        if (!shape[r][c]) continue;
        const x = GRID_X + (this.piece.x + c) * CELL;
        const y = GRID_Y + (this.piece.y + r) * CELL;
        ctx.fillStyle = color;
        ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x + 1, y + 1, CELL - 2, 3);
      }
    }
  }

  _renderGhost(ctx) {
    if (!this.piece) return;
    const shape = this._getShape();

    for (let r = 0; r < PIECE_SIZE; r++) {
      for (let c = 0; c < PIECE_SIZE; c++) {
        if (!shape[r][c]) continue;
        const x = GRID_X + (this.piece.x + c) * CELL;
        const y = GRID_Y + (this.ghostY + r) * CELL;
        ctx.strokeStyle = COLORS.ghost;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
      }
    }
  }

  _renderPreview(ctx) {
    const previewX = GRID_X + COLS * CELL + 30;
    const previewY = GRID_Y + 40;
    const previewCell = 18;

    ctx.fillStyle = COLORS.previewBg;
    ctx.fillRect(previewX - 5, previewY - 25, 90, 100);

    ctx.fillStyle = COLORS.hud;
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('NEXT', previewX, previewY - 10);

    if (!this.nextPiece) return;
    const color = PIECE_COLORS[this.nextPiece];
    const shape = SHAPES[this.nextPiece][0];

    for (let r = 0; r < PIECE_SIZE; r++) {
      for (let c = 0; c < PIECE_SIZE; c++) {
        if (!shape[r][c]) continue;
        ctx.fillStyle = color;
        ctx.fillRect(previewX + c * previewCell + 3, previewY + r * previewCell + 5, previewCell - 2, previewCell - 2);
      }
    }
  }



}

