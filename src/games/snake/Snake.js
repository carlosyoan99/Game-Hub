import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

const COLS = 28;
const BASE_INTERVAL = 0.13;
const MIN_INTERVAL = 0.05;
const SPEED_INCREASE_PER_FOOD = 0.002;

const POWERUP_TYPES = ['shield', 'magnet', 'slow'];
const POWERUP_COLORS = { shield: '#5dade2', magnet: '#f5b041', slow: '#58d68d' };
const POWERUP_DURATION = 6; // segundos

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/**
 * Snake con power-ups, tableros temáticos y modo jefe.
 */
export class Snake extends GameBase {
  init(engine) {
    super.init(engine, 'snake');
    this.highscore = this.storage.get('highscore', 0);

    this.cols = COLS;
    this.rows = Math.max(10, Math.floor((this.height / this.width) * COLS));

    this.startTime = Date.now();
    this._restart();
  }

  _defaultBindings() {
    return {
      up:    ['ArrowUp', 'KeyW', 'GamepadUp', 'GamepadLStickUp'],
      down:  ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      left:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      right: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      restart: ['Space', 'GamepadStart', 'GamepadA'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this.rows = Math.max(10, Math.floor((this.height / this.width) * this.cols));
  }

  _getSpeedLevel() {
    return 1 + Math.floor(this.score / 5);
  }

  _getMoveInterval() {
    const interval = BASE_INTERVAL - this.score * SPEED_INCREASE_PER_FOOD;
    return Math.max(MIN_INTERVAL, interval);
  }

  /** Obtener tema del tablero según velocidad. */
  _getBoardTheme() {
    const level = this._getSpeedLevel();
    if (level <= 3) return { bg: '#0b0f14', grid: '#11161d', accent: '#1a2332' };
    if (level <= 6) return { bg: '#0d1117', grid: '#161b22', accent: '#1c2333' };
    if (level <= 10) return { bg: '#100b14', grid: '#1a1220', accent: '#2a1833' };
    return { bg: '#140b0b', grid: '#221212', accent: '#331a1a' };
  }

  _restart() {
    this.rng = new SeededRandom();
    this.startTime = Date.now();
    const startX = Math.floor(this.cols / 2);
    const startY = Math.floor(this.rows / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    this.direction = { ...DIRECTIONS.right };
    this.pendingDirection = { ...DIRECTIONS.right };
    this.score = 0;
    this.status = 'playing';
    this.moveTimer = 0;
    this.bossFruit = null;
    this.bossMode = false;
    this.powerups = []; // power-ups en el tablero
    this.activePowerups = {}; // { type: remainingSeconds }
    this.magnetRange = 0;
    this.slowTimer = 0;
    this._spawnFood();
  }

  _spawnFood() {
    let cell;
    let attempts = 0;
    do {
      cell = {
        x: this.rng.nextInt(0, this.cols),
        y: this.rng.nextInt(0, this.rows),
      };
      attempts++;
    } while (
      attempts < 100 &&
      this.snake.some((s) => s.x === cell.x && s.y === cell.y)
    );
    this.food = cell;
  }

  _spawnPowerup() {
    let cell;
    let attempts = 0;
    do {
      cell = {
        x: this.rng.nextInt(1, this.cols - 2),
        y: this.rng.nextInt(1, this.rows - 2),
      };
      attempts++;
    } while (
      attempts < 100 &&
      (this.snake.some((s) => s.x === cell.x && s.y === cell.y) ||
       (this.food && cell.x === this.food.x && cell.y === this.food.y) ||
       (this.bossFruit && cell.x === this.bossFruit.x && cell.y === this.bossFruit.y))
    );
    const type = POWERUP_TYPES[this.rng.nextInt(0, POWERUP_TYPES.length)];
    this.powerups.push({
      x: cell.x,
      y: cell.y,
      type,
      timer: 8, // desaparece tras 8s
    });
  }

  _handleDirectionInput() {
    if (this.input.wasActionPressed('up') && this.direction.y === 0) {
      this.pendingDirection = { ...DIRECTIONS.up };
    } else if (this.input.wasActionPressed('down') && this.direction.y === 0) {
      this.pendingDirection = { ...DIRECTIONS.down };
    } else if (this.input.wasActionPressed('left') && this.direction.x === 0) {
      this.pendingDirection = { ...DIRECTIONS.left };
    } else if (this.input.wasActionPressed('right') && this.direction.x === 0) {
      this.pendingDirection = { ...DIRECTIONS.right };
    }
  }

  update(dt) {
    if (this.handleRestartInput()) return;

    if (this.status === 'boss-won') {
      if (this.input.wasActionPressed('restart') || this.input.mouse.clickedThisFrame) this._restart();
      return;
    }

    this._handleDirectionInput();

    // Actualizar timers de power-ups activos
    this._updateActivePowerups(dt);

    this.moveTimer += dt;
    const interval = this.slowTimer > 0 ? this._getMoveInterval() * 1.5 : this._getMoveInterval();
    if (this.moveTimer >= interval) {
      this.moveTimer -= interval;
      this._step();
    }

    // Spawn periodic power-ups
    if (!this.bossMode && this.powerups.length < 2 && this.rng.next() < 0.003) {
      this._spawnPowerup();
    }

    // Actualizar timers de power-ups en tablero
    for (const p of this.powerups) {
      p.timer -= dt;
    }
    this.powerups = this.powerups.filter(p => p.timer > 0);

    // Slow timer
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
    }
  }

  _updateActivePowerups(dt) {
    for (const type of Object.keys(this.activePowerups)) {
      this.activePowerups[type] -= dt;
      if (this.activePowerups[type] <= 0) {
        delete this.activePowerups[type];
        if (type === 'shield') {
          // Shield expired without use
        }
      }
    }
  }

  _step() {
    this.direction = this.pendingDirection;
    const head = this.snake[0];
    const newHead = { x: head.x + this.direction.x, y: head.y + this.direction.y };

    // Colisión con bordes
    if (newHead.x < 0 || newHead.x >= this.cols || newHead.y < 0 || newHead.y >= this.rows) {
      if (this.activePowerups['shield']) {
        // Escudo absorbe el golpe, rebota
        delete this.activePowerups['shield'];
        newHead.x = Math.max(0, Math.min(this.cols - 1, newHead.x));
        newHead.y = Math.max(0, Math.min(this.rows - 1, newHead.y));
        AudioManager.sfx({ type: 'powerup', volume: 0.3 });
        HapticManager.vibrate('coin');
        this.pendingDirection = { ...this.direction }; // keep direction
        // Don't die, just stay in bounds
        return;
      } else {
        this._endGame();
        return;
      }
    }

    // Colisión con sí misma
    if (this.snake.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      if (this.activePowerups['shield']) {
        delete this.activePowerups['shield'];
        AudioManager.sfx({ type: 'powerup', volume: 0.3 });
        HapticManager.vibrate('coin');
        return; // skip this step, don't move
      } else {
        this._endGame();
        return;
      }
    }

    this.snake.unshift(newHead);

    // ── Power-up collection ──
    const collected = this.powerups.find(p => p.x === newHead.x && p.y === newHead.y);
    if (collected) {
      this.activePowerups[collected.type] = POWERUP_DURATION;
      this.powerups = this.powerups.filter(p => p !== collected);
      AudioManager.sfx({ type: 'powerup', volume: 0.35 });
      HapticManager.vibrate('coin');
      if (collected.type === 'slow') this.slowTimer = POWERUP_DURATION;
    }

    // ── Magnet effect: attract food ──
    if (this.activePowerups['magnet'] && !this.bossFruit) {
      const dist = Math.abs(this.food.x - newHead.x) + Math.abs(this.food.y - newHead.y);
      if (dist <= 4) {
        // Atraer comida hacia la cabeza
        const dx = Math.sign(this.food.x - newHead.x);
        const dy = Math.sign(this.food.y - newHead.y);
        if (this.rng.next() < 0.3) {
          const newFx = this.food.x - dx;
          const newFy = this.food.y - dy;
          if (newFx >= 0 && newFx < this.cols && newFy >= 0 && newFy < this.rows &&
              !this.snake.some(s => s.x === newFx && s.y === newFy)) {
            this.food.x = newFx;
            this.food.y = newFy;
          }
        }
      }
    }

    // ── Boss fruit collision ──
    if (this.bossFruit && newHead.x === this.bossFruit.x && newHead.y === this.bossFruit.y) {
      this.score += 50;
      this.bossFruit = null;
      this.bossMode = false;
      this.status = 'boss-won';
      AudioManager.sfx({ type: 'powerup', volume: 0.6 });
      HapticManager.vibrate('powerup');
      ProgressionManager.checkAchievement('snake', 'snake-boss');
      if (this.score > this.highscore) {
        this.highscore = this.score;
        this.storage.set('highscore', this.highscore);
      }
      return;
    }

    // ── Normal food collision ──
    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.score += 1;
      AudioManager.sfx({ type: 'snake_eat', volume: 0.35 });
      HapticManager.vibrate('coin');

      // Activar boss mode al alcanzar score 20
      if (this.score >= 20 && !this.bossMode) {
        this.bossMode = true;
        this._spawnBossFruit();
      } else {
        this._spawnFood();
      }
    } else {
      this.snake.pop();
    }

    // ── Mover boss fruit cada step ──
    if (this.bossFruit) {
      this._moveBossFruit();
    }
  }

  _spawnBossFruit() {
    let cell;
    let attempts = 0;
    do {
      cell = {
        x: this.rng.nextInt(1, this.cols - 2),
        y: this.rng.nextInt(1, this.rows - 2),
      };
      attempts++;
    } while (
      attempts < 100 &&
      this.snake.some((s) => s.x === cell.x && s.y === cell.y)
    );
    this.bossFruit = cell;
    this.food = { x: -10, y: -10 };
  }

  _moveBossFruit() {
    if (!this.bossFruit) return;
    const head = this.snake[0];
    const dirs = [
      { x: 0, y: -1 }, { x: 0, y: 1 },
      { x: -1, y: 0 }, { x: 1, y: 0 },
    ];
    let bestDir = null;
    let bestDist = -1;
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = this.rng.nextInt(0, i);
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const d of dirs) {
      const nx = this.bossFruit.x + d.x;
      const ny = this.bossFruit.y + d.y;
      if (nx < 0 || nx >= this.cols || ny < 0 || ny >= this.rows) continue;
      if (this.snake.some(s => s.x === nx && s.y === ny)) continue;
      const dist = Math.hypot(nx - head.x, ny - head.y);
      if (dist > bestDist) {
        bestDist = dist;
        bestDir = d;
      }
    }
    if (bestDir) {
      this.bossFruit.x += bestDir.x;
      this.bossFruit.y += bestDir.y;
    }
  }

  _endGame() {
    this.status = 'lost';
    AudioManager.sfx({ type: 'snake_die', volume: 0.5 });
    HapticManager.vibrate('explosion');
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('snake', this.score, false, duration);
    if (this.score >= 10) ProgressionManager.checkAchievement('snake', 'small-snake');
    if (this.score >= 50) ProgressionManager.checkAchievement('snake', 'big-snake');
    if (this.score >= 100) ProgressionManager.checkAchievement('snake', 'immortal');
  }

  render(ctx) {
    const cellSize = this.width / this.cols;
    const theme = this._getBoardTheme();

    // Fondo temático
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    // Grid decorativo
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 0.5;
    for (let x = 0; x <= this.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, this.height);
      ctx.stroke();
    }
    for (let y = 0; y <= this.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(this.width, y * cellSize);
      ctx.stroke();
    }

    // Celdas decorativas aleatorias por tema
    ctx.fillStyle = theme.accent;
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 7 + 3) % this.cols) * cellSize;
      const cy = ((i * 11 + 5) % this.rows) * cellSize;
      ctx.fillRect(cx, cy, cellSize, cellSize);
    }

    // Comida normal
    ctx.fillStyle = '#ffb454';
    ctx.beginPath();
    ctx.arc(this.food.x * cellSize + cellSize / 2, this.food.y * cellSize + cellSize / 2, cellSize / 2 - 1, 0, Math.PI * 2);
    ctx.fill();

    // Power-ups en tablero
    for (const p of this.powerups) {
      const px = p.x * cellSize + cellSize / 2;
      const py = p.y * cellSize + cellSize / 2;
      const pulse = Math.sin(Date.now() * 0.006 + p.timer) * 0.1 + 0.9;
      ctx.save();
      if (ctx.scale) ctx.translate(px, py);
      if (ctx.scale) ctx.scale(pulse, pulse);
      ctx.fillStyle = POWERUP_COLORS[p.type] || '#aaa';
      const r = (cellSize / 2 - 1) * (ctx.scale ? 1 : 0.9);
      const drawX = ctx.scale ? 0 : px;
      const drawY = ctx.scale ? 0 : py;
      if (p.type === 'shield') {
        ctx.beginPath();
        ctx.moveTo(drawX, drawY - r);
        ctx.lineTo(drawX + r, drawY);
        ctx.lineTo(drawX, drawY + r);
        ctx.lineTo(drawX - r, drawY);
        ctx.closePath();
        ctx.fill();
      } else if (p.type === 'magnet') {
        ctx.fillRect(drawX - r * 0.7, drawY - r * 0.7, r * 1.4, r * 1.4);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('M', drawX, drawY);
      } else if (p.type === 'slow') {
        ctx.beginPath();
        ctx.moveTo(drawX, drawY - r * 0.7);
        ctx.lineTo(drawX + r, drawY + r * 0.7);
        ctx.lineTo(drawX - r, drawY + r * 0.7);
        ctx.closePath();
        ctx.fill();
      }
      if (ctx.scale) ctx.restore(); else ctx.restore();
    }

    // Serpiente
    this.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#e7edf3' : '#9aa7b2';
      // Cabeza brilla si hay escudo activo
      if (i === 0 && this.activePowerups['shield']) {
        ctx.fillStyle = '#5dade2';
      }
      ctx.fillRect(seg.x * cellSize + 1, seg.y * cellSize + 1, cellSize - 2, cellSize - 2);
      // Ojos en la cabeza
      if (i === 0) {
        ctx.fillStyle = '#000';
        const eyeSize = Math.max(1, cellSize * 0.12);
        ctx.fillRect(seg.x * cellSize + cellSize * 0.25, seg.y * cellSize + cellSize * 0.25, eyeSize, eyeSize);
        ctx.fillRect(seg.x * cellSize + cellSize * 0.65, seg.y * cellSize + cellSize * 0.25, eyeSize, eyeSize);
      }
    });

    // Boss fruit
    if (this.bossFruit) {
      const bx = this.bossFruit.x * cellSize + cellSize / 2;
      const by = this.bossFruit.y * cellSize + cellSize / 2;
      const pulse = Math.sin(Date.now() * 0.008) * 0.15 + 1;
      ctx.save();
      if (ctx.scale) ctx.translate(bx, by);
      if (ctx.scale) ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(ctx.scale ? 0 : bx, ctx.scale ? 0 : by, cellSize / 2 - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8a0';
      ctx.beginPath();
      ctx.arc(ctx.scale ? -2 : bx - 2, ctx.scale ? -2 : by - 2, 3, 0, Math.PI * 2);
      ctx.fill();
      if (ctx.scale) ctx.restore(); else ctx.restore();
    }

    // ── Indicadores de power-ups activos ──
    const activeKeys = Object.keys(this.activePowerups);
    if (activeKeys.length > 0) {
      const indicatorY = 52;
      ctx.font = '10px monospace';
      activeKeys.forEach((type, i) => {
        const ix = 10 + i * 85;
        ctx.fillStyle = POWERUP_COLORS[type] || '#aaa';
        ctx.fillRect(ix, indicatorY, 14, 10);
        ctx.fillStyle = '#e7edf3';
        ctx.textAlign = 'left';
        ctx.fillText(type.toUpperCase(), ix + 18, indicatorY + 9);
      });
    }

    // HUD
    setupHUDContext(ctx);
    ctx.fillText(t('snake.score', { n: this.score }), 10, 10);
    ctx.fillText(t('snake.speed', { n: this._getSpeedLevel() }), 10, 28);
    ctx.fillText(t('snake.length', { n: this.snake.length }), 10, 46);

    if (this.bossMode) {
      ctx.fillStyle = '#ffd700';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t('snake.bossFruit'), this.width / 2, 10);
      ctx.textAlign = 'left';
    }

    ctx.fillText(t('game.record', { n: this.highscore }), this.width / 2 - 50, 10);

    if (this.status === 'lost') {
      renderOverlay(ctx, { width: this.width, height: this.height });
    }

    if (this.status === 'boss-won') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('snake.bossEaten'), this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#e7edf3';
      ctx.font = '16px monospace';
      ctx.fillText(t('game.score', { n: this.score }), this.width / 2, this.height / 2 + 15);
      ctx.fillText(t('game.continue'), this.width / 2, this.height / 2 + 45);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

}
