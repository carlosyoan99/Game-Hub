import { GameBase } from '../../engine/GameBase.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { circleIntersectsAABB } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

const GRAVITY = 900;
const FLAP_IMPULSE = -320;
const BIRD_RADIUS = 12;
const BIRD_X_RATIO = 0.3;
const PIPE_WIDTH = 60;
const BASE_PIPE_SPEED = 180;
const BASE_PIPE_INTERVAL = 1.4;
const SPEED_INCREASE_PER_POINT = 6;
const GAP_DECREASE_PER_POINT = 1.5;
const MIN_GAP = 60;

const BOSS_SCORE_THRESHOLD = 15;
const BOSS_WIN_SCORE = 25;

// Power-up types
const POWERUP_TYPES = ['shield', 'slowTime', 'magnetBird'];
const POWERUP_COLORS = { shield: '#5dade2', slowTime: '#58d68d', magnetBird: '#f5b041' };

// Visual themes based on score
const THEMES = [
  { sky: '#0b0f14', ground: '#1a1f2e', pipe: '#3a7d5c', pipeRim: '#2a5c4a' },
  { sky: '#141018', ground: '#221a2e', pipe: '#5c3a7d', pipeRim: '#4a2a5c' },
  { sky: '#181410', ground: '#2e221a', pipe: '#7d5c3a', pipeRim: '#5c4a2a' },
  { sky: '#101814', ground: '#1a2e22', pipe: '#3a7d6a', pipeRim: '#2a5c4a' },
  { sky: '#141010', ground: '#2e1a1a', pipe: '#7d3a3a', pipeRim: '#5c2a2a' },
];

/** Power-up rápido flotando en la pantalla */
class FloatingPowerup {
  constructor(x, y, type, rng) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.radius = 10;
    this.alive = true;
    this.angle = rng.next() * Math.PI * 2;
    this.speed = 30 + rng.next() * 20;
    this.oscilation = rng.next() * Math.PI * 2;
  }

  update(dt) {
    this.oscilation += dt * 1.5;
    this.angle += dt * 0.5;
    this.x -= this.speed * dt;
    this.y += Math.sin(this.oscilation) * 15 * dt;
  }
}

/**
 * Flappy Bird expandido con:
 * - Modo contrarreloj (sobrevive 30s)
 * - Power-ups (escudo, ralentizar, imán)
 * - Obstáculos variables (ancho, velocidad)
 * - Temas visuales según puntuación
 * - Modo jefe (boss mode)
 */
export class FlappyBird extends GameBase {
  init(engine) {
    super.init(engine, 'flappy-bird');
    this.highscore = this.storage.get('highscore', 0);
    this._computePipeMetrics();
    this._restart();
  }

  _defaultBindings() {
    return {
      flap:    ['Space', 'ArrowUp', 'KeyW', 'GamepadA', 'GamepadB', 'GamepadUp', 'GamepadStart'],
      restart: ['Space', 'GamepadStart', 'GamepadA'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this._computePipeMetrics();
  }

  _computePipeMetrics() {
    this.basePipeGap = Math.min(160, Math.max(80, this.height * 0.42));
    this.pipeMargin = Math.min(60, this.height * 0.15);
  }

  _getPipeSpeed() {
    return BASE_PIPE_SPEED + this.score * SPEED_INCREASE_PER_POINT;
  }

  _getPipeGap() {
    return Math.max(MIN_GAP, this.basePipeGap - this.score * GAP_DECREASE_PER_POINT);
  }

  _getPipeInterval() {
    return Math.max(0.8, BASE_PIPE_INTERVAL - this.score * 0.02);
  }

  _getTheme() {
    return THEMES[Math.min(Math.floor(this.score / 5), THEMES.length - 1)];
  }

  _restart() {
    this.rng = new SeededRandom();
    this.bird = {
      x: this.width * BIRD_X_RATIO,
      y: this.height / 2,
      vy: 0,
      radius: BIRD_RADIUS,
    };
    this.pipes = [];
    this.spawnTimer = 0;
    this.score = 0;
    this.status = 'playing';
    this.startTime = Date.now();
    this.bossMode = false;
    this.bossPipesPassed = 0;
    this.powerups = {};
    this.floatingPowerups = [];
    this.powerupSpawnTimer = 0;
    this.slowTimeTimer = 0;
    this.magnetTimer = 0;
    this.phase = 'select-mode';
    this.selectedMode = 0; // 0 = classic, 1 = time trial
    this.timeTrialTimer = 30;
  }

  update(dt) {
    if (this.phase === 'select-mode') {
      if (this.input.wasPressed('Space') || this.input.wasActionPressed('flap') || this.input.mouse.clickedThisFrame) {
        this.selectedMode = 1;
        AudioManager.sfx({ type: 'select', volume: 0.25 });
        this.phase = 'playing';
      }
      if (this.input.wasPressed('ArrowRight') || this.input.wasActionPressed('right')) {
        this.selectedMode = 1;
      }
      if (this.input.wasPressed('ArrowLeft') || this.input.wasActionPressed('left')) {
        this.selectedMode = 0;
      }
      if (this.input.wasPressed('ArrowUp') || this.input.wasActionPressed('up')) {
        this.selectedMode = this.selectedMode === 0 ? 1 : 0;
      }
      if (this.input.wasPressed('ArrowDown') || this.input.wasActionPressed('down')) {
        this.selectedMode = this.selectedMode === 0 ? 1 : 0;
      }
      return;
    }

    const mouseClick = this.input.mouse.clickedThisFrame;

    if (this.status === 'lost' || this.status === 'won') {
      if (this.input.wasPressed('Space') || this.input.wasActionPressed('restart') || this.input.wasActionPressed('flap') || mouseClick) this._restart();
      return;
    }

    if (this.input.wasPressed('Space') || this.input.wasActionPressed('flap') || mouseClick) {
      this.bird.vy = FLAP_IMPULSE;
      AudioManager.sfx({ type: 'flappy_flap', volume: 0.3 });
    }

    // Slow time power-up
    const timeScale = this.slowTimeTimer > 0 ? 0.5 : 1;
    const adjustedDt = dt * timeScale;

    this.bird.vy += GRAVITY * adjustedDt;
    this.bird.y += this.bird.vy * adjustedDt;

    // Magnet: atraer pájaro hacia el gap más cercano
    if (this.magnetTimer > 0) {
      this._applyMagnet(adjustedDt);
    }

    this._updatePipes(adjustedDt);
    this._checkCollisions();

    // Power-up spawning
    this.powerupSpawnTimer -= adjustedDt;
    if (this.powerupSpawnTimer <= 0 && this.floatingPowerups.length < 2) {
      this.powerupSpawnTimer = 3 + this.rng.next() * 4;
      this._spawnFloatingPowerup();
    }

    // Update floating power-ups
    this._updateFloatingPowerups(adjustedDt);

    // Update power-up timers
    if (this.slowTimeTimer > 0) {
      this.slowTimeTimer -= dt;
      if (this.slowTimeTimer <= 0) {
        delete this.powerups['slowTime'];
      }
    }
    if (this.magnetTimer > 0) {
      this.magnetTimer -= dt;
      if (this.magnetTimer <= 0) {
        delete this.powerups['magnetBird'];
      }
    }

    // Time trial mode
    if (this.selectedMode === 1 && this.status === 'playing') {
      this.timeTrialTimer -= dt;
      if (this.timeTrialTimer <= 0) {
        // Sobrevivió el tiempo
        this.status = 'won';
        AudioManager.sfx({ type: 'powerup', volume: 0.6 });
        HapticManager.vibrate('powerup');
        const duration = (Date.now() - this.startTime) / 1000;
        ProgressionManager.recordGamePlay('flappy-bird', this.score, true, duration);
        ProgressionManager.checkAchievement('flappy-bird', 'flappy-boss');
        ProgressionManager.addXp(50, 'time-trial-won');
        return;
      }
    }

    this.input.endFrame();
  }

  _applyMagnet(dt) {
    // Atraer pájaro hacia el centro del gap de la siguiente tubería
    const nextPipe = this.pipes.find(p => p.x + PIPE_WIDTH > this.bird.x);
    if (nextPipe) {
      const targetY = nextPipe.gapCenter;
      const diff = targetY - this.bird.y;
      const force = diff * 1.5;
      this.bird.vy += force * dt;
    }
  }

  _spawnFloatingPowerup() {
    const type = POWERUP_TYPES[this.rng.nextInt(0, POWERUP_TYPES.length)];
    const x = this.width + 20;
    const y = this.pipeMargin + this.rng.next() * (this.height - this.pipeMargin * 2);
    this.floatingPowerups.push(new FloatingPowerup(x, y, type, this.rng));
  }

  _updateFloatingPowerups(dt) {
    for (const fp of this.floatingPowerups) {
      fp.update(dt);
      // Check collision with bird
      if (fp.alive) {
        const dx = this.bird.x - fp.x;
        const dy = this.bird.y - fp.y;
        const dist = Math.hypot(dx, dy);
        if (dist < this.bird.radius + fp.radius) {
          fp.alive = false;
          this._collectPowerup(fp.type);
        }
      }
    }
    this.floatingPowerups = this.floatingPowerups.filter(fp => fp.alive && fp.x > -50);
  }

  _collectPowerup(type) {
    AudioManager.sfx({ type: 'powerup', volume: 0.35 });
    HapticManager.vibrate('coin');
    switch (type) {
      case 'shield':
        this.powerups['shield'] = true;
        break;
      case 'slowTime':
        this.slowTimeTimer = 6;
        this.powerups['slowTime'] = true;
        break;
      case 'magnetBird':
        this.magnetTimer = 5;
        this.powerups['magnetBird'] = true;
        break;
    }
  }

  _updatePipes(dt) {
    const speed = this._getPipeSpeed();

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this._getPipeInterval();
      this._spawnPipe();
    }

    for (const pipe of this.pipes) {
      pipe.x -= speed * dt;

      // Oscilación vertical en boss mode
      if (pipe.boss) {
        pipe.oscTimer += dt;
        const oscSpeed = 1.2 + this.score * 0.05;
        const oscAmp = 30 + this.score * 2;
        pipe.gapCenter = pipe.baseGapCenter + Math.sin(pipe.oscTimer * oscSpeed) * oscAmp;
      }

      // Moving pipes in time trial mode
      if (pipe.moving) {
        pipe.gapCenter += pipe.moveSpeed * dt;
        if (pipe.gapCenter < this.pipeMargin + pipe.gap / 2 ||
            pipe.gapCenter > this.height - this.pipeMargin - pipe.gap / 2) {
          pipe.moveSpeed *= -1;
        }
      }

      if (!pipe.passed && pipe.x + PIPE_WIDTH < this.bird.x) {
        pipe.passed = true;
        this.score += 1;
        AudioManager.sfx({ type: 'flappy_score', volume: 0.3 });
        HapticManager.vibrate('coin');

        if (this.score >= BOSS_SCORE_THRESHOLD && !this.bossMode) {
          this._startBossMode();
        }

        if (this.bossMode && this.score >= BOSS_WIN_SCORE) {
          this.status = 'won';
          AudioManager.sfx({ type: 'powerup', volume: 0.6 });
          HapticManager.vibrate('powerup');
          ProgressionManager.checkAchievement('flappy-bird', 'flappy-boss');
          const duration = (Date.now() - this.startTime) / 1000;
          ProgressionManager.recordGamePlay('flappy-bird', this.score, true, duration);
          ProgressionManager.addXp(75, 'boss-defeated');
          return;
        }

        if (this.score > this.highscore) {
          this.highscore = this.score;
          this.storage.set('highscore', this.highscore);
        }
      }
    }

    this.pipes = this.pipes.filter((pipe) => pipe.x + PIPE_WIDTH > 0);
  }

  _startBossMode() {
    this.bossMode = true;
    this.bossPipesPassed = 0;
    AudioManager.sfx({ type: 'powerup', volume: 0.5 });
    HapticManager.vibrate('powerup');
  }

  _spawnPipe() {
    const margin = this.pipeMargin;
    const gap = this.bossMode
      ? Math.max(50, this._getPipeGap() * 0.7)
      : this._getPipeGap();
    const availableRange = Math.max(0, this.height - margin * 2 - gap);
    const gapCenter = margin + this.rng.next() * availableRange + gap / 2;

    // Variable pipe width
    const varWidth = this.selectedMode === 1 || this.score > 10
      ? PIPE_WIDTH * (0.6 + this.rng.next() * 0.8)
      : PIPE_WIDTH;

    if (this.bossMode && this.rng.next() < 0.7) {
      this.pipes.push({
        x: this.width,
        gapCenter,
        baseGapCenter: gapCenter,
        width: varWidth,
        gap,
        passed: false,
        boss: true,
        oscTimer: this.rng.next() * Math.PI * 2,
        moving: false,
      });
    } else if (this.selectedMode === 1 && this.rng.next() < 0.4) {
      // Moving pipes in time trial
      this.pipes.push({
        x: this.width,
        gapCenter,
        baseGapCenter: gapCenter,
        width: varWidth,
        gap,
        passed: false,
        boss: false,
        moving: true,
        moveSpeed: (this.rng.next() > 0.5 ? 1 : -1) * (30 + this.rng.next() * 40),
      });
    } else {
      this.pipes.push({
        x: this.width,
        gapCenter,
        baseGapCenter: gapCenter,
        width: varWidth,
        gap,
        passed: false,
        boss: false,
        moving: false,
      });
    }
  }

  _checkCollisions() {
    if (this.powerups['shield'] && (this.bird.y - this.bird.radius < 0 || this.bird.y + this.bird.radius > this.height)) {
      // Shield saves from wall collision - bounce back
      delete this.powerups['shield'];
      this.bird.y = Math.max(this.bird.radius, Math.min(this.height - this.bird.radius, this.bird.y));
      this.bird.vy *= -0.5;
      AudioManager.sfx({ type: 'powerup', volume: 0.3 });
      return;
    }

    if (this.bird.y - this.bird.radius < 0 || this.bird.y + this.bird.radius > this.height) {
      this._endGame();
      return;
    }

    for (const pipe of this.pipes) {
      const gap = pipe.gap;
      const pw = pipe.width || PIPE_WIDTH;
      const topRect = { x: pipe.x, y: 0, width: pw, height: pipe.gapCenter - gap / 2 };
      const bottomY = pipe.gapCenter + gap / 2;
      const bottomRect = { x: pipe.x, y: bottomY, width: pw, height: this.height - bottomY };

      if (circleIntersectsAABB(this.bird, topRect) || circleIntersectsAABB(this.bird, bottomRect)) {
        if (this.powerups['shield']) {
          delete this.powerups['shield'];
          AudioManager.sfx({ type: 'powerup', volume: 0.3 });
          // Push bird away from collision
          this.bird.x = pipe.x - this.bird.radius - 5;
          return;
        }
        this._endGame();
        return;
      }
    }
  }

  _endGame() {
    this.status = 'lost';
    AudioManager.sfx({ type: 'explosion', volume: 0.4 });
    HapticManager.vibrate('explosion');
    const duration = (Date.now() - this.startTime) / 1000;
    this.bossMode = false;
    ProgressionManager.recordGamePlay('flappy-bird', this.score, false, duration);
    if (this.score >= 1) ProgressionManager.checkAchievement('flappy-bird', 'first-flight');
    if (this.score >= 20) ProgressionManager.checkAchievement('flappy-bird', 'pipe-master');
    if (this.score >= 50) ProgressionManager.checkAchievement('flappy-bird', 'bird-legend');
  }

  render(ctx) {
    const theme = this._getTheme();

    // Fondo temático
    ctx.fillStyle = theme.sky;
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.phase === 'select-mode') {
      this._renderModeSelect(ctx);
      return;
    }

    // Línea de suelo decorativa
    ctx.fillStyle = theme.ground;
    ctx.fillRect(0, this.height - 4, this.width, 4);

    // Tuberías
    for (const pipe of this.pipes) {
      const gap = pipe.gap;
      const pw = pipe.width || PIPE_WIDTH;
      const topHeight = pipe.gapCenter - gap / 2;
      const bottomY = pipe.gapCenter + gap / 2;

      if (pipe.boss) {
        ctx.fillStyle = '#c84848';
        ctx.fillRect(pipe.x, 0, pw, topHeight);
        ctx.fillRect(pipe.x, bottomY, pw, this.height - bottomY);
        ctx.fillStyle = '#a03030';
        ctx.fillRect(pipe.x - 3, topHeight - 20, pw + 6, 20);
        ctx.fillRect(pipe.x - 3, bottomY, pw + 6, 20);
      } else {
        ctx.fillStyle = pipe.moving ? '#8e44ad' : theme.pipe;
        ctx.fillRect(pipe.x, 0, pw, topHeight);
        ctx.fillRect(pipe.x, bottomY, pw, this.height - bottomY);
        ctx.fillStyle = pipe.moving ? '#6c3483' : theme.pipeRim;
        ctx.fillRect(pipe.x - 3, topHeight - 20, pw + 6, 20);
        ctx.fillRect(pipe.x - 3, bottomY, pw + 6, 20);
      }
    }

    // Power-ups flotantes
    for (const fp of this.floatingPowerups) {
      if (!fp.alive) continue;
      const pulse = 0.8 + Math.sin(fp.oscilation) * 0.2;
      ctx.save();
      if (ctx.scale) ctx.translate(fp.x, fp.y);
      if (ctx.scale) ctx.scale(pulse, pulse);
      ctx.fillStyle = POWERUP_COLORS[fp.type] || '#aaa';
      ctx.beginPath();
      ctx.arc(ctx.scale ? 0 : fp.x, ctx.scale ? 0 : fp.y, fp.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = fp.type === 'shield' ? 'S' : fp.type === 'slowTime' ? 'T' : 'M';
      ctx.fillText(label, ctx.scale ? 0 : fp.x, ctx.scale ? 0 : fp.y);
      if (ctx.scale) ctx.restore(); else ctx.restore();
    }

    // Pájaro
    const hue = 200 + Math.min(this.score * 5, 160);
    ctx.save();
    ctx.translate(this.bird.x, this.bird.y);
    ctx.rotate(clampTiltAngle(this.bird.vy));
    // Shield glow
    if (this.powerups['shield']) {
      ctx.shadowColor = '#5dade2';
      ctx.shadowBlur = 15;
    } else if (this.powerups['slowTime']) {
      ctx.shadowColor = '#58d68d';
      ctx.shadowBlur = 12;
    } else if (this.powerups['magnetBird']) {
      ctx.shadowColor = '#f5b041';
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;
    ctx.beginPath();
    ctx.arc(0, 0, this.bird.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Indicadores de power-ups activos
    const activePups = Object.keys(this.powerups);
    if (activePups.length > 0) {
      ctx.font = '10px monospace';
      activePups.forEach((type, i) => {
        const ix = 10 + i * 70;
        const iy = this.height - 20;
        ctx.fillStyle = POWERUP_COLORS[type] || '#aaa';
        ctx.fillRect(ix, iy, 14, 10);
        ctx.fillStyle = '#e7edf3';
        ctx.textAlign = 'left';
        ctx.fillText(type.toUpperCase(), ix + 18, iy + 9);
      });
    }

    // Boss mode indicator
    if (this.bossMode && this.status === 'playing') {
      ctx.fillStyle = '#ff6b4a';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t('flappy.bossMode') + ` ${this.score}/${BOSS_WIN_SCORE}`, this.width / 2, 14);
      ctx.textAlign = 'left';
    }

    // Time trial mode indicator
    if (this.selectedMode === 1 && this.status === 'playing') {
      const timeLeft = Math.max(0, Math.ceil(this.timeTrialTimer));
      ctx.fillStyle = '#f5b041';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`⏱ ${timeLeft}s`, this.width - 10, 10);
      ctx.textAlign = 'left';
    }

    // HUD
    setupHUDContext(ctx);
    ctx.fillText(t('flappy.score', { n: this.score }), 10, 10);
    ctx.fillText(t('flappy.best', { n: this.highscore }), 10, 28);

    if (this.status === 'lost') {
      renderOverlay(ctx, { width: this.width, height: this.height, score: this.score });
    }

    if (this.status === 'won') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ff6b4a';
      ctx.font = 'bold 22px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('flappy.bossDefeated'), this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#e7edf3';
      ctx.font = '16px monospace';
      ctx.fillText(t('game.score', { n: this.score }), this.width / 2, this.height / 2 + 15);
      ctx.fillText(t('game.continue'), this.width / 2, this.height / 2 + 45);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  _renderModeSelect(ctx) {
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('flappy.selectMode'), this.width / 2, this.height / 2 - 50);

    ctx.font = '16px monospace';
    ctx.fillStyle = this.selectedMode === 0 ? '#e7edf3' : '#7c8894';
    ctx.fillText(t('flappy.classic'), this.width / 2 - 100, this.height / 2 + 10);
    ctx.fillStyle = this.selectedMode === 1 ? '#f5b041' : '#7c8894';
    ctx.fillText(t('flappy.timeTrial'), this.width / 2 + 100, this.height / 2 + 10);

    ctx.font = '12px monospace';
    ctx.fillStyle = '#7c8894';
    if (this.selectedMode === 0) {
      ctx.fillText(t('flappy.classicDesc'), this.width / 2, this.height / 2 + 40);
    } else {
      ctx.fillText(t('flappy.timeTrialDesc'), this.width / 2, this.height / 2 + 40);
    }

    ctx.font = '14px monospace';
    ctx.fillStyle = '#9aa7b2';
    ctx.fillText(t('flappy.start'), this.width / 2, this.height / 2 + 70);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

}

function clampTiltAngle(vy) {
  const maxAngle = Math.PI / 4;
  return Math.max(-maxAngle, Math.min(maxAngle, vy / 500));
}
