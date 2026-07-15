/**
 * Bejeweled-like (Match-3 Puzzle)
 * Nivel 3 — Puzzle de intercambio de gemas con cascadas
 *
 * Mecánica: grid 8×8, intercambia gemas adyacentes para
 * hacer match-3+, cascadas por gravedad, gemas especiales
 * (rayadas + bomba), multiplicador de cascada.
 */
import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { clamp, pointInRect } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ─── Configuración ──────────────────────────────────────────────────

const GRID_COLS = 8;
const GRID_ROWS = 8;
const GEM_SIZE = 54;
const GEM_GAP = 4;

const GEM_TYPES = [
  { id: 0, color: '#e74c3c', glow: '#ff6b6b', name: 'rojo' },
  { id: 1, color: '#4a9eff', glow: '#7cb8ff', name: 'azul' },
  { id: 2, color: '#3a9a5a', glow: '#5cc87a', name: 'verde' },
  { id: 3, color: '#ffb454', glow: '#ffd080', name: 'amarillo' },
  { id: 4, color: '#c848d8', glow: '#dc78e8', name: 'morado' },
  { id: 5, color: '#ff8c6b', glow: '#ffa88c', name: 'naranja' },
];

const MODE_CONFIGS = {
  classic: { initialMoves: 20, targetScore: 2000, desc: 'bejeweled.classic' },
  timeattack: { initialMoves: -1, targetScore: 3000, timeLimit: 90, desc: 'bejeweled.timeattack' },
  endless: { initialMoves: -1, targetScore: -1, desc: 'bejeweled.endless' },
};

const SWAP_DURATION = 0.15;
const FALL_DURATION = 0.1;

// ─── Clase principal ────────────────────────────────────────────────

export class Bejeweled extends GameBase {
  init(engine) {
    super.init(engine, 'bejeweled');
    this.highscore = this.storage.get('highscore', 0);
    this.startTime = Date.now();
    this.phase = 'select'; // 'select' | 'playing' | 'animating' | 'won' | 'lost'
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

    // Animation state
    this.animQueue = [];
    this.animTimer = 0;
    this.cascadeTimer = 0;

    // Swap selection
    this.selectedGem = null;
    this.swapAnim = null;

    // Particles
    this.particles = [];

    // Generate initial board (no matches)
    this._generateBoard();

    // Board offset (centered)
    const totalW = GRID_COLS * (GEM_SIZE + GEM_GAP) - GEM_GAP;
    const totalH = GRID_ROWS * (GEM_SIZE + GEM_GAP) - GEM_GAP;
    this.boardX = (this.width - totalW) / 2;
    this.boardY = 60;

    // Timer
    if (this.modeKey === 'timeattack') {
      this.gameTimer = setInterval(() => {
        this.timeRemaining--;
        if (this.timeRemaining <= 0) {
          this._endGame(this.score >= this.targetScore);
        }
      }, 1000);
    }
  }

  _generateBoard() {
    this.grid = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      this.grid[row] = [];
      for (let col = 0; col < GRID_COLS; col++) {
        let type;
        do {
          type = Math.floor(Math.random() * GEM_TYPES.length);
        } while (this._wouldMatch(row, col, type));
        this.grid[row][col] = { type, special: null };
      }
    }
  }

  _wouldMatch(row, col, type) {
    // Check horizontal
    if (col >= 2 &&
      this.grid[row][col - 1]?.type === type &&
      this.grid[row][col - 2]?.type === type) return true;
    // Check vertical
    if (row >= 2 &&
      this.grid[row - 1]?.[col]?.type === type &&
      this.grid[row - 2]?.[col]?.type === type) return true;
    return false;
  }

  _getGemPos(col, row) {
    return {
      x: this.boardX + col * (GEM_SIZE + GEM_GAP),
      y: this.boardY + row * (GEM_SIZE + GEM_GAP),
    };
  }

  _getGridFromPos(x, y) {
    const col = Math.floor((x - this.boardX) / (GEM_SIZE + GEM_GAP));
    const row = Math.floor((y - this.boardY) / (GEM_SIZE + GEM_GAP));
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
    return { col, row };
  }

  // ── Update ────────────────────────────────────────────────────────

  update(dt) {
    if (this.phase === 'select') {
      this._updateSelect(dt);
      return;
    }
    if (this.handleRestartInput()) return;

    if (this.paused) return;

    // Handle swap animation
    if (this.swapAnim) {
      this.swapAnim.t += dt / SWAP_DURATION;
      if (this.swapAnim.t >= 1) {
        this.swapAnim = null;
        this._afterSwap();
      }
      return;
    }

    // Cascade chain timer (replaces setTimeout for frame-safe timing)
    if (this.cascadeTimer > 0) {
      this.cascadeTimer -= dt;
      if (this.cascadeTimer <= 0) {
        this.cascadeTimer = 0;
        this._processMatches();
      }
      return;
    }

    // Message timer
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.messageText = null;
    }

    // Input handling
    if (this.input.mouse.clickedThisFrame) {
      const pos = this._getGridFromPos(this.input.mouse.x, this.input.mouse.y);
      if (pos) {
        this._onGemClick(pos.col, pos.row);
      }
    }

    // Keyboard controls
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

    // Initialize cursor on first click
    if (this.cursorCol === undefined) {
      this.cursorCol = 3;
      this.cursorRow = 3;
    }

    // Particles
    this._updateParticles(dt);

    // Time attack timer check
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
      // Check if clicked on a mode card
      const modeKeys = ['classic', 'timeattack', 'endless'];
      for (let i = 0; i < modeKeys.length; i++) {
        const cardBounds = this._getModeCardBounds(i);
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

      // Same gem - deselect
      if (col === selCol && row === selRow) {
        this.selectedGem = null;
        AudioManager.sfx({ type: 'select', volume: 0.1 });
        return;
      }

      // Must be adjacent (not diagonal)
      if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
        this._trySwap(selCol, selRow, col, row);
      } else {
        // Select new gem instead
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
    // Start swap animation
    this.swapAnim = {
      col1, row1, col2, row2,
      gem1: { ...this.grid[row1][col1] },
      gem2: { ...this.grid[row2][col2] },
      t: 0,
    };
    this.selectedGem = null;
    this.animating = true;

    // Perform the swap in grid
    [this.grid[row1][col1], this.grid[row2][col2]] = [this.grid[row2][col2], this.grid[row1][col1]];

    AudioManager.sfx({ type: 'select', volume: 0.2 });
  }

  _afterSwap() {
    // Check for matches
    if (!this._hasMatches()) {
      // Swap back (invalid move)
      const s = this.swapAnim;
      [this.grid[s.row1][s.col1], this.grid[s.row2][s.col2]] = [this.grid[s.row2][s.col2], this.grid[s.row1][s.col1]];
      this.animating = false;
      AudioManager.sfx({ type: 'hit', volume: 0.2 });
      return;
    }

    // Valid move - decrement moves
    if (this.moves > 0) this.moves--;
    this.combo = 0;

    // Process matches
    this._processMatches();
  }

  _hasMatches() {
    return this._findMatches().length > 0;
  }

  _findMatches() {
    const matched = new Set();

    // Horizontal matches
    for (let row = 0; row < GRID_ROWS; row++) {
      let runStart = 0;
      for (let col = 1; col <= GRID_COLS; col++) {
        if (col < GRID_COLS && this.grid[row][col]?.type === this.grid[row][runStart]?.type) continue;
        const runLen = col - runStart;
        if (runLen >= 3) {
          for (let c = runStart; c < col; c++) {
            matched.add(`${c},${row}`);
          }
        }
        runStart = col;
      }
    }

    // Vertical matches
    for (let col = 0; col < GRID_COLS; col++) {
      let runStart = 0;
      for (let row = 1; row <= GRID_ROWS; row++) {
        if (row < GRID_ROWS && this.grid[row][col]?.type === this.grid[runStart][col]?.type) continue;
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

  _processMatches() {
    const matches = this._findMatches();
    if (matches.length === 0) {
      this.animating = false;
      this._checkEndConditions();
      return;
    }

    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    // Categorize matches for special gems
    const matchedRows = new Set();
    const matchedCols = new Set();
    const matchGroups = this._groupMatches(matches);

    for (const group of matchGroups) {
      const len = group.length;
      const type = this.grid[group[0].row][group[0].col]?.type;

      // Determine special gem
      let special = null;
      if (len >= 5) {
        special = 'bomb'; // Color bomb
        this._showMessage(t('bejeweled.match5'));
      } else if (len === 4) {
        special = 'striped'; // Striped gem
        this._showMessage(t('bejeweled.match4'));
      } else {
        this._showMessage(t('bejeweled.match3'));
      }

      // Score
      const baseScore = len * 10;
      const cascadeMult = Math.min(this.combo, 8);
      this.score += baseScore * cascadeMult;
      this.totalGemsCleared += len;

      // Spawn particles
      for (const g of group) {
        const pos = this._getGemPos(g.col, g.row);
        this._spawnParticles(pos.x + GEM_SIZE / 2, pos.y + GEM_SIZE / 2, GEM_TYPES[type].color, 6);
      }

      // Replace matched gems (keep center one for special)
      for (let i = 0; i < group.length; i++) {
        const g = group[i];
        // First matched gem in group gets the special if applicable
        if (i === 0 && special) {
          this.grid[g.row][g.col] = { type, special };
        } else {
          this.grid[g.row][g.col] = null;
        }
      }
    }

    AudioManager.sfx({ type: 'powerup', volume: 0.25 });
    HapticManager.vibrate('hit');

    // Apply gravity and check for cascades
    this._applyGravity();
  }

  _groupMatches(matches) {
    const visited = new Set();
    const groups = [];

    for (const m of matches) {
      const key = `${m.col},${m.row}`;
      if (visited.has(key)) continue;

      const group = [m];
      visited.add(key);
      const type = this.grid[m.row][m.col]?.type;

      // Expand to connected same-type matches
      const stack = [m];
      while (stack.length > 0) {
        const curr = stack.pop();
        for (const n of matches) {
          const nKey = `${n.col},${n.row}`;
          if (visited.has(nKey)) continue;
          if (this.grid[n.row][n.col]?.type !== type) continue;
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

  _applyGravity() {
    // Gems fall down to fill empty spaces
    let moved = false;
    for (let col = 0; col < GRID_COLS; col++) {
      let writeRow = GRID_ROWS - 1;
      for (let row = GRID_ROWS - 1; row >= 0; row--) {
        if (this.grid[row][col] !== null) {
          if (row !== writeRow) {
            this.grid[writeRow][col] = this.grid[row][col];
            this.grid[row][col] = null;
            moved = true;
          }
          writeRow--;
        }
      }
      // Fill empty spots at top with new gems
      for (let row = writeRow; row >= 0; row--) {
        this.grid[row][col] = {
          type: Math.floor(Math.random() * GEM_TYPES.length),
          special: null,
        };
        moved = true;
      }
    }

    if (moved) {
      // Schedule cascade check via dt-based timer instead of setTimeout
      this.cascadeTimer = 0.08;
    } else {
      this._checkEndConditions();
    }
  }

  _checkEndConditions() {
    if (this.phase !== 'playing') return;

    // Check if board has valid moves
    if (!this._hasValidMoves()) {
      // Shuffle board
      this._shuffleBoard();
      this._showMessage('¡Revolviendo!');
      return;
    }

    // Classic mode: out of moves
    if (this.moves === 0 && this.score >= this.targetScore) {
      this._endGame(true);
    } else if (this.moves === 0) {
      this._endGame(false);
    }

    // Endless mode: no end condition
  }

  _hasValidMoves() {
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        // Try swap right
        if (col + 1 < GRID_COLS) {
          [this.grid[row][col], this.grid[row][col + 1]] = [this.grid[row][col + 1], this.grid[row][col]];
          if (this._hasMatches()) {
            [this.grid[row][col], this.grid[row][col + 1]] = [this.grid[row][col + 1], this.grid[row][col]];
            return true;
          }
          [this.grid[row][col], this.grid[row][col + 1]] = [this.grid[row][col + 1], this.grid[row][col]];
        }
        // Try swap down
        if (row + 1 < GRID_ROWS) {
          [this.grid[row][col], this.grid[row + 1][col]] = [this.grid[row + 1][col], this.grid[row][col]];
          if (this._hasMatches()) {
            [this.grid[row][col], this.grid[row + 1][col]] = [this.grid[row + 1][col], this.grid[row][col]];
            return true;
          }
          [this.grid[row][col], this.grid[row + 1][col]] = [this.grid[row + 1][col], this.grid[row][col]];
        }
      }
    }
    return false;
  }

  _shuffleBoard() {
    // Simple shuffle - just regenerate
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        this.grid[row][col] = {
          type: Math.floor(Math.random() * GEM_TYPES.length),
          special: null,
        };
      }
    }
    // Ensure no initial matches
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        while (this._wouldMatch(row, col, this.grid[row][col].type)) {
          this.grid[row][col].type = Math.floor(Math.random() * GEM_TYPES.length);
        }
      }
    }
  }

  _showMessage(text) {
    this.messageText = text;
    this.messageTimer = 1.2;
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

  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 150,
        vy: -Math.random() * 150 - 30,
        life: 0.3 + Math.random() * 0.3,
        color,
        size: 3 + Math.random() * 4,
      });
    }
  }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  _getModeCardBounds(idx) {
    const cards = ['classic', 'timeattack', 'endless'];
    const cardW = 200;
    const cardH = 200;
    const gap = 30;
    const totalW = cards.length * cardW + (cards.length - 1) * gap;
    const startX = (this.width - totalW) / 2;
    return {
      x: startX + idx * (cardW + gap),
      y: 100,
      width: cardW,
      height: cardH,
    };
  }

  // ── Render ────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.phase === 'select') {
      this._renderSelect(ctx);
      return;
    }

    // Board background
    const totalW = GRID_COLS * (GEM_SIZE + GEM_GAP) - GEM_GAP;
    const totalH = GRID_ROWS * (GEM_SIZE + GEM_GAP) - GEM_GAP;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(this.boardX - 4, this.boardY - 4, totalW + 8, totalH + 8);

    // Render gems
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const gem = this.grid[row]?.[col];
        if (!gem) continue;

        const pos = this._getGemPos(col, row);
        let drawX = pos.x;
        let drawY = pos.y;

        // Swap animation offset
        if (this.swapAnim) {
          const s = this.swapAnim;
          const t = s.t;
          if (col === s.col1 && row === s.row1) {
            drawX += (this._getGemPos(s.col2, s.row2).x - pos.x) * t;
            drawY += (this._getGemPos(s.col2, s.row2).y - pos.y) * t;
          } else if (col === s.col2 && row === s.row2) {
            drawX += (this._getGemPos(s.col1, s.row1).x - pos.x) * t;
            drawY += (this._getGemPos(s.col1, s.row1).y - pos.y) * t;
          }
        }

        this._drawGem(ctx, gem, drawX, drawY, GEM_SIZE);
      }
    }

    // Selection highlight
    if (this.selectedGem) {
      const pos = this._getGemPos(this.selectedGem.col, this.selectedGem.row);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.strokeRect(pos.x, pos.y, GEM_SIZE, GEM_SIZE);
      // Glow
      ctx.fillStyle = 'rgba(255, 215, 0, 0.1)';
      ctx.fillRect(pos.x, pos.y, GEM_SIZE, GEM_SIZE);
    }

    // Cursor highlight (keyboard)
    if (this.cursorCol !== undefined) {
      const pos2 = this._getGemPos(this.cursorCol, this.cursorRow);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(pos2.x, pos2.y, GEM_SIZE, GEM_SIZE);
      ctx.setLineDash([]);
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.4);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Message text
    if (this.messageTimer > 0 && this.messageText) {
      ctx.fillStyle = '#ffd700';
      ctx.globalAlpha = Math.min(1, this.messageTimer * 2);
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.messageText, this.width / 2, this.boardY + totalH + 30);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
    }

    // HUD
    this._renderHUD(ctx);

    // Paused overlay
    if (this.paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('game.paused'), this.width / 2, this.height / 2);
    }

    // Game over / victory
    if (this.phase === 'won' || this.phase === 'lost') {
      renderOverlay(ctx, {
        width: this.width, height: this.height,
        title: this.phase === 'won' ? t('bejeweled.victory') : t('bejeweled.gameOver'),
        score: this.score,
        subtitle: `${t('bejeweled.gems', { n: this.totalGemsCleared })} | ${t('bejeweled.multiplier', { n: this.maxCombo })}`,
        actionText: t('game.restart'),
      });
    }
  }

  _drawGem(ctx, gem, x, y, size) {
    const def = GEM_TYPES[gem.type];
    const margin = 3;

    // Gem body (rounded square with inner glow)
    ctx.fillStyle = def.color;
    const r = 8;
    ctx.beginPath();
    ctx.moveTo(x + margin + r, y + margin);
    ctx.lineTo(x + size - margin - r, y + margin);
    ctx.quadraticCurveTo(x + size - margin, y + margin, x + size - margin, y + margin + r);
    ctx.lineTo(x + size - margin, y + size - margin - r);
    ctx.quadraticCurveTo(x + size - margin, y + size - margin, x + size - margin - r, y + size - margin);
    ctx.lineTo(x + margin + r, y + size - margin);
    ctx.quadraticCurveTo(x + margin, y + size - margin, x + margin, y + size - margin - r);
    ctx.lineTo(x + margin, y + margin + r);
    ctx.quadraticCurveTo(x + margin, y + margin, x + margin + r, y + margin);
    ctx.closePath();
    ctx.fill();

    // Inner shine
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(x + margin + 4, y + margin + 4, size - margin * 2 - 8, 8);

    // Small highlight
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(x + size / 2 - 6, y + size / 2 - 6, 6, 0, Math.PI * 2);
    ctx.fill();

    // Special gem indicators
    if (gem.special === 'striped') {
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 3;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + margin + 2, y + margin + 2, size - margin * 2 - 4, size - margin * 2 - 4);
      ctx.setLineDash([]);
      // Star in center
      ctx.fillStyle = '#ffd700';
      this._drawStar(ctx, x + size / 2, y + size / 2, 5, 8, 4);
    } else if (gem.special === 'bomb') {
      // Bomb has a dark center
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.arc(x + size / 2, y + size / 2, size / 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', x + size / 2, y + size / 2 + 2);
    }
  }

  _drawStar(ctx, cx, cy, points, outerR, innerR) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const px = cx + Math.cos(angle) * r;
      const py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  _renderSelect(ctx) {
    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('bejeweled.select'), this.width / 2, 40);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    const modeKeys = ['classic', 'timeattack', 'endless'];
    const cards = [
      { key: 'classic', label: t('bejeweled.classic'), icon: '🎯', color: '#3a9a5a', desc: '20 movimientos, objetivo 2000pts' },
      { key: 'timeattack', label: t('bejeweled.timeattack'), icon: '⏱', color: '#ffb454', desc: '90 segundos, objetivo 3000pts' },
      { key: 'endless', label: t('bejeweled.endless'), icon: '♾', color: '#4a9eff', desc: 'Sin límites, juega por diversión' },
    ];

    const cardW = 200;
    const cardH = 220;
    const gap = 30;
    const totalW = cards.length * cardW + (cards.length - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const startY = 90;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const x = startX + i * (cardW + gap);
      const y = startY;
      const isSelected = i === this.selectedMode;

      // Card
      ctx.fillStyle = isSelected ? '#1a1a2a' : '#11161d';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = isSelected ? card.color : '#2a3a4a';
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(x, y, cardW, cardH);

      if (isSelected) {
        ctx.fillStyle = `${card.color}15`;
        ctx.fillRect(x + 2, y + 2, cardW - 4, cardH - 4);
      }

      // Icon
      ctx.font = '48px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(card.icon, x + cardW / 2, y + 60);

      // Mode name
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(card.label, x + cardW / 2, y + 120);

      // Description
      ctx.fillStyle = '#9aa7b2';
      ctx.font = '11px monospace';
      ctx.fillText(card.desc, x + cardW / 2, y + 155);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Blink
    if (Math.floor(this.selectBlink * 4) % 2 === 0) {
      const selX = startX + this.selectedMode * (cardW + gap);
      ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
      ctx.fillRect(selX, startY, cardW, cardH);
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 1;
      ctx.strokeRect(selX, startY, cardW, cardH);
    }

    // Instructions
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('← → para elegir  |  Espacio/Enter para empezar', this.width / 2, this.height - 30);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderHUD(ctx) {
    setupHUDContext(ctx);

    // Score (top center)
    ctx.textAlign = 'center';
    ctx.fillText(t('bejeweled.score', { n: this.score }), this.width / 2, 10);

    // Moves or time
    ctx.textAlign = 'left';
    if (this.moves > 0) {
      ctx.fillText(t('bejeweled.moves', { n: this.moves }), 10, 10);
    }
    if (this.modeKey === 'timeattack') {
      ctx.textAlign = 'right';
      ctx.fillText(t('bejeweled.time', { n: this.timeRemaining }), this.width - 10, 10);
    }

    // Target score
    if (this.targetScore > 0) {
      ctx.textAlign = 'right';
      ctx.fillText(t('bejeweled.target', { n: this.targetScore }), this.width - 10, 28);
    }

    // Cascade multiplier
    if (this.combo > 1) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(t('bejeweled.multiplier', { n: Math.min(this.combo, 8) }), this.width / 2, 32);
    }

    // Gems cleared
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '10px monospace';
    ctx.fillText(t('bejeweled.gems', { n: this.totalGemsCleared }), 10, 28);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Highscore
    if (this.highscore > 0) {
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.fillText(t('game.record', { n: this.highscore }), 10, this.height - 10);
    }
  }
}
