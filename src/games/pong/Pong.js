import { GameBase } from '../../engine/GameBase.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { circleIntersectsAABB, clamp, pointInRect } from '../../engine/CollisionUtils.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { SeededRandom } from '../../engine/SeededRandom.js';

const PADDLE_WIDTH = 12;
const PADDLE_HEIGHT = 80;
const PADDLE_MARGIN = 24;
const BALL_RADIUS = 7;
const WIN_SCORE = 5;

/** Configuración por dificultad: velocidad de IA y velocidad base de bola. */
const DIFFICULTIES = [
  { id: 'easy', aiSpeed: 260, ballSpeed: 320, aiPredict: false, deadZone: 8 },
  { id: 'normal', aiSpeed: 340, ballSpeed: 360, aiPredict: true, deadZone: 5 },
  { id: 'hard', aiSpeed: 430, ballSpeed: 410, aiPredict: true, deadZone: 2 },
];

/**
 * Pong con selector de dificultad al iniciar.
 * Se mantiene victoria a los 5 puntos, sin niveles.
 */
export class Pong extends GameBase {
  init(engine) {
    super.init(engine, 'pong');
    this.highscore = this.storage.get('highscore', 0);

    this.phase = 'select-difficulty'; // 'select-difficulty' | 'playing' | 'won' | 'lost'
    this.selectedDifficulty = -1;
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    if (this.player) {
      this.player.y = clamp(this.player.y, 0, this.height - this.player.height);
    }
    if (this.ai) {
      this.ai.y = clamp(this.ai.y, 0, this.height - this.ai.height);
    }
  }

  _getDifficulty() {
    if (this.selectedDifficulty < 0) return DIFFICULTIES[0];
    return DIFFICULTIES[this.selectedDifficulty];
  }

  _startGame(difficultyIndex) {
    this.selectedDifficulty = difficultyIndex;
    this.phase = 'playing';
    this.rng = new SeededRandom();
    this.player = {
      x: PADDLE_MARGIN,
      y: this.height / 2 - PADDLE_HEIGHT / 2,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
    };
    this.ai = {
      x: this.width - PADDLE_MARGIN - PADDLE_WIDTH,
      y: this.height / 2 - PADDLE_HEIGHT / 2,
      width: PADDLE_WIDTH,
      height: PADDLE_HEIGHT,
    };
    this.playerScore = 0;
    this.aiScore = 0;
    this.status = 'playing';
    this._serve(1);
  }

  _serve(direction) {
    const angle = (this.rng.next() - 0.5) * (Math.PI / 6);
    const diff = this._getDifficulty();
    this.ball = {
      x: this.width / 2,
      y: this.height / 2,
      radius: BALL_RADIUS,
      vx: Math.cos(angle) * diff.ballSpeed * direction,
      vy: Math.sin(angle) * diff.ballSpeed,
    };
  }

  update(dt) {
    if (this.phase === 'select-difficulty') {
      if (this.input.mouse.clickedThisFrame) {
        const buttons = this._getDifficultyButtons();
        for (let i = 0; i < buttons.length; i++) {
          if (pointInRect(this.input.mouse.x, this.input.mouse.y, buttons[i])) {
            AudioManager.sfx({ type: 'select', volume: 0.25 });
            this._startGame(i);
            break;
          }
        }
      }
      this.input.endFrame();
      return;
    }

    if (this.handleRestartInput()) return;

    this._movePlayer(dt);
    this._moveAI(dt);
    this._moveBall(dt);
    this._checkScoring();

    this.input.endFrame();
  }

  _movePlayer(dt) {
    if (this.input.isDown('ArrowUp') || this.input.isDown('KeyW')) {
      this.player.y -= 360 * dt;
    }
    if (this.input.isDown('ArrowDown') || this.input.isDown('KeyS')) {
      this.player.y += 360 * dt;
    }
    if (this.input.mouse.y >= 0) {
      this.player.y = this.input.mouse.y - this.player.height / 2;
    }
    this.player.y = clamp(this.player.y, 0, this.height - this.player.height);
  }

  _moveAI(dt) {
    const diff = this._getDifficulty();
    const paddleCenter = this.ai.y + this.ai.height / 2;
    let targetY = this.ball.y;
    if (diff.aiPredict && this.ball.vx > 0) {
      targetY = this._predictAim();
    }
    const diffY = targetY - paddleCenter;
    if (Math.abs(diffY) > diff.deadZone) {
      this.ai.y += Math.sign(diffY) * Math.min(diff.aiSpeed * dt, Math.abs(diffY));
    }
    this.ai.y = clamp(this.ai.y, 0, this.height - this.ai.height);
  }

  _predictAim() {
    let y = this.ball.y;
    let vy = this.ball.vy;
    const steps = Math.floor(Math.abs(this.width - this.ball.x) / Math.abs(this.ball.vx));
    for (let i = 0; i < Math.min(steps, 60); i++) {
      y += vy * 0.016;
      if (y < BALL_RADIUS || y > this.height - BALL_RADIUS) vy *= -1;
    }
    return y;
  }

  _moveBall(dt) {
    this.ball.x += this.ball.vx * dt;
    this.ball.y += this.ball.vy * dt;

    if (this.ball.y - this.ball.radius < 0) {
      this.ball.y = this.ball.radius;
      this.ball.vy *= -1;
    } else if (this.ball.y + this.ball.radius > this.height) {
      this.ball.y = this.height - this.ball.radius;
      this.ball.vy *= -1;
    }

    if (this.ball.vx < 0 && circleIntersectsAABB(this.ball, this.player)) {
      this._bounce(this.player, 1);
    } else if (this.ball.vx > 0 && circleIntersectsAABB(this.ball, this.ai)) {
      this._bounce(this.ai, -1);
    }
  }

  _bounce(paddle, direction) {
    const hitPos = (this.ball.y - paddle.y) / paddle.height;
    const angle = (hitPos - 0.5) * (Math.PI / 3);
    const diff = this._getDifficulty();
    const speed = diff.ballSpeed * 1.02;
    this.ball.vx = Math.cos(angle) * speed * direction;
    this.ball.vy = Math.sin(angle) * speed;
    this.ball.x = direction === 1 ? paddle.x + paddle.width + this.ball.radius : paddle.x - this.ball.radius;
    AudioManager.sfx({ type: 'pong_hit', volume: 0.25 });
    HapticManager.vibrate('select');
  }

  _checkScoring() {
    if (this.ball.x + this.ball.radius < 0) {
      this.aiScore += 1;
      AudioManager.sfx({ type: 'pong_hit', volume: 0.5 });
      HapticManager.vibrate('hit');
      this._afterPoint();
    } else if (this.ball.x - this.ball.radius > this.width) {
      this.playerScore += 1;
      AudioManager.sfx({ type: 'pong_score', volume: 0.35 });
      HapticManager.vibrate('coin');
      this._afterPoint();
    }
  }

  _afterPoint() {
    if (this.playerScore >= WIN_SCORE || this.aiScore >= WIN_SCORE) {
      if (this.playerScore > this.aiScore) {
        this.status = 'won';
        AudioManager.sfx({ type: 'powerup', volume: 0.5 });
        HapticManager.vibrate('powerup');
      } else {
        this.status = 'lost';
        AudioManager.sfx({ type: 'pong_hit', volume: 0.6 });
        HapticManager.vibrate('hit');
      }
      if (this.status === 'won') {
        const streak = this.storage.get('bestStreak', 0) + 1;
        this.storage.set('bestStreak', streak);
      }
    } else {
      this._serve(this.playerScore > this.aiScore ? 1 : -1);
    }
  }

  _restart() {
    this.phase = 'select-difficulty';
    this.selectedDifficulty = -1;
  }

  _getDifficultyButtons() {
    const count = DIFFICULTIES.length;
    const btnW = 160;
    const btnH = 50;
    const gap = 16;
    const totalW = count * btnW + (count - 1) * gap;
    const startX = (this.width - totalW) / 2;
    const y = this.height / 2 + 10;
    return DIFFICULTIES.map((_, i) => ({
      x: startX + i * (btnW + gap),
      y,
      width: btnW,
      height: btnH,
    }));
  }

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.phase === 'select-difficulty') {
      this._renderDifficultySelect(ctx);
      return;
    }

    const diff = this._getDifficulty();

    // Línea central
    ctx.strokeStyle = '#1e2731';
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    ctx.moveTo(this.width / 2, 0);
    ctx.lineTo(this.width / 2, this.height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#e7edf3';
    ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
    ctx.fillRect(this.ai.x, this.ai.y, this.ai.width, this.ai.height);

    ctx.beginPath();
    ctx.arc(this.ball.x, this.ball.y, this.ball.radius, 0, Math.PI * 2);
    ctx.fill();

    // Marcador
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7c8894';
    ctx.fillText(String(this.playerScore), this.width / 2 - 60, 40);
    ctx.fillText(String(this.aiScore), this.width / 2 + 60, 40);

    // Info de dificultad
    ctx.font = '12px monospace';
    ctx.fillStyle = '#9aa7b2';
    ctx.fillText(t('pong.difficulty') + ': ' + t(diff.id === 'easy' ? 'level.easy' : diff.id === 'normal' ? 'level.medium' : 'level.hard'), this.width / 2, 10);
    ctx.fillText(t('pong.target', { n: WIN_SCORE }), this.width / 2, 26);

    ctx.textAlign = 'left';

    if (this.status === 'won' || this.status === 'lost') {
      const title = this.status === 'won' ? t('pong.gameComplete') : t('pong.lost');
      renderOverlay(ctx, { width: this.width, height: this.height, title });
    }
  }

  _renderDifficultySelect(ctx) {
    ctx.fillStyle = '#e7edf3';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('pong.selectDifficulty'), this.width / 2, this.height / 2 - 60);

    ctx.font = '14px monospace';
    ctx.fillStyle = '#7c8894';
    ctx.fillText(t('pong.firstTo', { n: WIN_SCORE }), this.width / 2, this.height / 2 - 25);

    const buttons = this._getDifficultyButtons();
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      ctx.fillStyle = '#11161d';
      ctx.strokeStyle = '#1e2731';
      ctx.fillRect(btn.x, btn.y, btn.width, btn.height);
      ctx.strokeRect(btn.x, btn.y, btn.width, btn.height);

      ctx.fillStyle = '#e7edf3';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = DIFFICULTIES[i].id === 'easy' ? t('level.easy') : DIFFICULTIES[i].id === 'normal' ? t('level.medium') : t('level.hard');
      ctx.fillText(label, btn.x + btn.width / 2, btn.y + btn.height / 2);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

}
