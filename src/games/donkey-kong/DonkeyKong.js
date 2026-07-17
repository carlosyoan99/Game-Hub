import { GameBase } from '../../engine/GameBase.js';
import { aabbIntersects } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ── Constantes ──────────────────────────────────────────────────────────

const PLAYER_W = 16;
const PLAYER_H = 20;
const PLAYER_SPEED = 130;
const JUMP_VELOCITY = -260;
const GRAVITY = 700;
const BARREL_SPEED = 100;
const LADDER_SPEED = 80;

const COLORS = {
  bg: '#0b0f14',
  platform: '#4a3520',
  platformTop: '#6b4c2a',
  ladder: '#c89b3c',
  player: '#e74c3c',
  playerOveralls: '#3498db',
  barrel: '#8B4513',
  barrelFire: '#ff6b4a',
  dk: '#2d7a4a',
  pauline: '#ffb8bf',
  hud: '#9aa7b2',
  rivet: '#888',

};

export class DonkeyKong extends GameBase {
  init(engine) {
    super.init(engine, 'donkey-kong');
    this.highscore = this.storage.get('highscore', 0);

    this.particles = new ParticleSystem(60);
    this.startTime = Date.now();

    this._restart();
  }

  _defaultBindings() {
    const parent = super._defaultBindings ? super._defaultBindings() : {};
    return {
      ...parent,
      jump: ['Space', 'ArrowUp', 'KeyW', 'GamepadA', 'GamepadUp', 'GamepadLStickUp'],
    };
  }

  _restart() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.status = 'playing';
    this.screen = 0; // 0=25m, 1=50m, 2=75m, 3=100m
    this.screens = [this._buildScreen25m, this._buildScreen50m, this._buildScreen75m, this._buildScreen100m];
    this.showTutorial = true;
    this.tutorialAlpha = 1;
    this.tutorialTimer = 4;

    this._initLevel();
  }

  _initLevel() {
    this.platforms = [];
    this.ladders = [];
    this.barrels = [];
    this.fireballs = [];
    this.rivets = [];
    this.player = { x: 60, y: 400, vx: 0, vy: 0, onGround: false, w: PLAYER_W, h: PLAYER_H, facing: 1 };
    this.dk = { x: this.width / 2, y: 60 };
    this.pauline = { x: this.width / 2 + 40, y: 50 };
    this.barrelTimer = 0;
    this.barrelInterval = 2.0;
    this.won = false;

    // Construir pantalla actual
    this.screens[this.screen].call(this);
  }

  // ── 25m: Rampas + escaleras, barriles ruedan por rampas ───────────────

  _buildScreen25m() {
    this.platforms = [
      { x: 0, y: 440, w: this.width, h: 100 },  // Suelo
      { x: 0, y: 370, w: 200, h: 16 },           // Plataforma 1 izq
      { x: 250, y: 370, w: 200, h: 16 },          // Plataforma 1 der
      { x: 100, y: 300, w: 200, h: 16 },          // Plataforma 2
      { x: 350, y: 300, w: 200, h: 16 },          // Plataforma 3
      { x: 180, y: 230, w: 200, h: 16 },          // Plataforma 4
      { x: 0, y: 160, w: 120, h: 16 },            // Plataforma 5 izq
      { x: 250, y: 160, w: 200, h: 16 },          // Plataforma 5 der
      { x: 100, y: 100, w: 300, h: 16 },          // Plataforma cima
    ];

    this.ladders = [
      { x: 170, y: 370, h: 70 },   // Suelo -> plataforma 1 der
      { x: 280, y: 300, h: 70 },   // Plat 1 der -> plat 3
      { x: 130, y: 230, h: 70 },   // Plat 2 -> plat 4
      { x: 210, y: 160, h: 70 },   // Plat 4 -> plat 5 der
      { x: 120, y: 100, h: 60 },   // Plat 5 izq -> cima
    ];
  }

  // ── 50m: Cintas transportadoras ───────────────────────────────────────

  _buildScreen50m() {
    this.platforms = [
      { x: 0, y: 440, w: this.width, h: 100 },
      { x: 0, y: 370, w: 180, h: 16, conveyer: -40 },
      { x: 230, y: 370, w: 180, h: 16, conveyer: 40 },
      { x: 450, y: 370, w: 200, h: 16, conveyer: -40 },
      { x: 80, y: 300, w: 180, h: 16, conveyer: 40 },
      { x: 310, y: 300, w: 180, h: 16 },
      { x: 150, y: 230, w: 200, h: 16, conveyer: -40 },
      { x: 400, y: 230, w: 200, h: 16, conveyer: 40 },
      { x: 100, y: 100, w: 300, h: 16 },
    ];

    this.ladders = [
      { x: 150, y: 370, h: 70 },
      { x: 350, y: 370, h: 70 },
      { x: 520, y: 370, h: 70 },
      { x: 220, y: 300, h: 70 },
      { x: 400, y: 300, h: 70 },
      { x: 280, y: 230, h: 70 },
      { x: 480, y: 230, h: 70 },
      { x: 200, y: 100, h: 130 },
    ];
  }

  // ── 75m: Ascensores móviles ───────────────────────────────────────────

  _buildScreen75m() {
    this.platforms = [
      { x: 0, y: 440, w: this.width, h: 100 },
      { x: 50, y: 370, w: 120, h: 16 },
      { x: 250, y: 370, w: 120, h: 16 },
      { x: 450, y: 370, w: 120, h: 16 },
      { x: 650, y: 370, w: 120, h: 16 },
      { x: 100, y: 100, w: 300, h: 16 },
    ];

    // Ascensores móviles
    this.lifts = [
      { x: 200, y: 320, w: 80, h: 12, vy: -30, minY: 150, maxY: 350 },
      { x: 400, y: 280, w: 80, h: 12, vy: 30, minY: 150, maxY: 350 },
      { x: 600, y: 240, w: 80, h: 12, vy: -25, minY: 130, maxY: 350 },
    ];

    this.ladders = [
      { x: 80, y: 370, h: 70 },
      { x: 280, y: 370, h: 70 },
      { x: 480, y: 370, h: 70 },
      { x: 680, y: 370, h: 70 },
      { x: 200, y: 100, h: 130 },
    ];
  }

  // ── 100m: Remaches ────────────────────────────────────────────────────

  _buildScreen100m() {
    this.platforms = [
      { x: 0, y: 440, w: this.width, h: 100 },
      { x: 0, y: 370, w: 100, h: 16 },
      { x: 150, y: 370, w: 60, h: 16 },
      { x: 260, y: 370, w: 60, h: 16 },
      { x: 370, y: 370, w: 60, h: 16 },
      { x: 480, y: 370, w: 60, h: 16 },
      { x: 590, y: 370, w: 60, h: 16 },
      { x: 700, y: 370, w: 60, h: 16 },
      { x: 100, y: 100, w: 300, h: 16 },
    ];

    // Remaches (pueden ser destruidos)
    this.rivets = [];
    for (let i = 0; i < this.platforms.length - 1; i++) {
      const p = this.platforms[i + 1];
      this.rivets.push({ x: p.x + p.w / 2 - 6, y: p.y - 4, w: 12, h: 8, alive: true });
    }

    this.ladders = [
      { x: 50, y: 370, h: 70 },
      { x: 170, y: 370, h: 70 },
      { x: 280, y: 370, h: 70 },
      { x: 390, y: 370, h: 70 },
      { x: 500, y: 370, h: 70 },
      { x: 610, y: 370, h: 70 },
      { x: 200, y: 100, h: 130 },
    ];
  }

  // ── Update ─────────────────────────────────────────────────────────────

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasActionPressed('action') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }

      return;
    }

    // Tutorial timer (usamos dt real)
    if (this.showTutorial) {
      this.tutorialTimer -= dt;
      if (this.tutorialTimer <= 0) {
        this.tutorialAlpha = Math.max(0, this.tutorialAlpha - dt * 2);
        if (this.tutorialAlpha <= 0) this.showTutorial = false;
      }
    }

    this._updatePlayer(dt);
    this._updateBarrels(dt);
    this._updateLifts(dt);
    this._checkCollisions();
    this.particles.update(dt);

    // Generar barriles
    this.barrelTimer -= dt;
    if (this.barrelTimer <= 0) {
      this.barrelTimer = Math.max(0.6, this.barrelInterval - this.level * 0.1);
      this.barrels.push({
        x: this.dk.x - 10,
        y: this.dk.y + 20,
        vx: Math.random() < 0.5 ? -BARREL_SPEED : BARREL_SPEED,
        vy: 0,
        w: 18,
        h: 18,
        onGround: false,
        alive: true,
      });
      AudioManager.sfx({ type: 'hit', volume: 0.2 });
    }

    this.input.endFrame();
  }

  _updatePlayer(dt) {
    const p = this.player;

    // Input horizontal
    p.vx = 0;
    if (this.input.isActionDown('moveLeft')) {
      p.vx = -PLAYER_SPEED;
      p.facing = -1;
    }
    if (this.input.isActionDown('moveRight')) {
      p.vx = PLAYER_SPEED;
      p.facing = 1;
    }

    // Subir/bajar escaleras
    let onLadder = false;
    for (const ladder of this.ladders) {
      const lx = ladder.x;
      const ly = ladder.y;
      if (p.x + p.w / 2 > lx - 10 && p.x - p.w / 2 < lx + 10 && p.y + p.h > ly && p.y < ly + ladder.h) {
        onLadder = true;
        if (this.input.isActionDown('moveUp')) {
          p.vy = -LADDER_SPEED;
          p.onGround = false;
        } else if (this.input.isActionDown('moveDown')) {
          p.vy = LADDER_SPEED;
          p.onGround = false;
        } else {
          p.vy = 0;
        }
        break;
      }
    }

    if (!onLadder) {
      // Salto
      if (p.onGround && this.input.wasActionPressed('jump')) {
        p.vy = JUMP_VELOCITY;
        p.onGround = false;
        AudioManager.sfx({ type: 'dk_jump', volume: 0.3 });
      }

      // Gravedad
      if (!p.onGround) p.vy += GRAVITY * dt;
    }

    // Mover
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Colisión con plataformas
    p.onGround = false;
    for (const plat of this.platforms) {
      // Encima de la plataforma
      if (p.vy >= 0 && p.x + p.w > plat.x && p.x < plat.x + plat.w) {
        const prevBottom = p.y + p.h;
        p.y = Math.min(p.y, plat.y - p.h);
        if (prevBottom > plat.y && prevBottom - p.vy * dt <= plat.y + 4) {
          p.onGround = true;
          p.vy = 0;

          // Cinta transportadora
          if (plat.conveyer) {
            p.x += plat.conveyer * dt;
          }
        }
      }
    }

    // Límites
    p.x = Math.max(0, Math.min(this.width - p.w, p.x));
    if (p.y > this.height + 50) {
      this._playerDeath();
    }
  }

  _updateBarrels(dt) {
    for (const b of this.barrels) {
      if (!b.alive) continue;

      // Gravedad
      b.vy += GRAVITY * 0.6 * dt;

      // Colisión con plataformas
      b.onGround = false;
      for (const plat of this.platforms) {
        if (b.x + b.w > plat.x && b.x < plat.x + plat.w && b.vy >= 0) {
          const prevBottom = b.y + b.h;
          b.y = Math.min(b.y, plat.y - b.h);
          if (prevBottom > plat.y && prevBottom - b.vy * dt <= plat.y + 4) {
            b.onGround = true;
            b.vy = 0;
            // Los barriles siguen las rampas
            if (plat.conveyer) {
              b.vx += plat.conveyer * 0.5;
            }
            break;
          }
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.y > this.height + 50) b.alive = false;
    }
    this.barrels = this.barrels.filter((b) => b.alive);
  }

  _updateLifts(dt) {
    if (!this.lifts) return;
    for (const lift of this.lifts) {
      lift.y += lift.vy * dt;
      if (lift.y < lift.minY || lift.y > lift.maxY) lift.vy *= -1;

      // Si el jugador está sobre el ascensor, se mueve con él
      const p = this.player;
      if (p.x + p.w > lift.x && p.x < lift.x + lift.w && p.onGround) {
        const onTop = Math.abs(p.y + p.h - lift.y) < 8;
        if (onTop) p.y = lift.y - p.h;
      }
    }
  }

  _checkCollisions() {
    const p = this.player;
    const pRect = { x: p.x, y: p.y, width: p.w, height: p.h };

    // Barriles vs jugador
    for (const b of this.barrels) {
      if (!b.alive) continue;
      const bRect = { x: b.x, y: b.y, width: b.w, height: b.h };
      if (aabbIntersects(pRect, bRect)) {
        this._playerDeath();
        return;
      }
    }

    // Remaches (solo screen 100m)
    if (this.screen === 3) {
      for (const rivet of this.rivets) {
        if (!rivet.alive) continue;
        const rRect = { x: rivet.x, y: rivet.y, width: rivet.w, height: rivet.h };
        if (aabbIntersects(pRect, rRect)) {
          rivet.alive = false;
          this.score += 50;
          this.particles.burst(rivet.x + rivet.w / 2, rivet.y + rivet.h / 2, COLORS.rivet, 8, 50);
          AudioManager.sfx({ type: 'select', volume: 0.2 });
        }
      }

      // Victoria (todos los remaches destruidos)
      if (this.rivets.every((r) => !r.alive)) {
        this.won = true;
      }
    }

    // Llegar a Pauline
    if (this.screen < 3 && p.y < 80 && p.x > 50 && p.x < this.width - 50) {
      this.won = true;
    }

    // Victoria
    if (this.won) {
      this.won = false;
      if (this.screen < 3) {
        this.screen++;
        AudioManager.sfx({ type: 'coin', volume: 0.4 });
        this.score += 100;
        this._initLevel(); // crea un nuevo player y reinicia barriles
      } else {
        this.level++;
        this.score += 500;
        this.screen = 0;
        AudioManager.sfx({ type: 'powerup', volume: 0.5 });
        this._initLevel();
      }
    }
  }

  _playerDeath() {
    this.lives -= 1;
    AudioManager.sfx({ type: 'explosion', volume: 0.5 });
    HapticManager.vibrate('explosion');
    this.particles.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, COLORS.player, 15, 100);

    if (this.lives <= 0) {
      this._endGame();
    } else {
      this.player.x = 60;
      this.player.y = 400;
      this.player.vy = 0;
      this.player.vx = 0;
      this.barrels = [];
    }
  }

  _endGame() {
    this.status = 'game-over';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('donkey-kong', this.score, false, duration);
    if (this.level >= 1) ProgressionManager.checkAchievement('donkey-kong', 'first-platform');
    if (this.level >= 5) ProgressionManager.checkAchievement('donkey-kong', 'barrel-dodger');
    if (this.level >= 8) ProgressionManager.checkAchievement('donkey-kong', 'kong-conqueror');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    this._renderPlatforms(ctx);
    this._renderLadders(ctx);
    this._renderRivets(ctx);
    this._renderBarrels(ctx);
    this._renderLifts(ctx);
    this._renderDK(ctx);
    this._renderPauline(ctx);
    this._renderPlayer(ctx);
    this.particles.render(ctx);

    // Tutorial (el timer se actualiza en update() con dt real)
    if (this.showTutorial && this.tutorialAlpha > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.55 * this.tutorialAlpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = `rgba(255, 255, 255, ${this.tutorialAlpha})`;
      ctx.font = '15px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const lines = [
        '🦍 DONKEY KONG',
        '',
        '← → Mover a Mario',
        '↑ / W / ESPACIO  Saltar',
        'Escaleras: ↑ / ↓ para subir/bajar',
        '',
        '¡Evita los barriles y llega hasta Pauline!',
        '',
        'Hay 4 pantallas diferentes (25m, 50m, 75m, 100m)',
      ];
      const lineH = 24;
      const startY = this.height / 2 - (lines.length * lineH) / 2;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], this.width / 2, startY + i * lineH);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    const screenNames = ['25m', '50m', '75m', '100m'];
    this.renderHUD(ctx, { extraCenter: [screenNames[this.screen]] });

    if (this.status !== 'playing') {
      renderOverlay(ctx, { width: this.width, height: this.height, score: this.score });
    }
  }

  _renderPlatforms(ctx) {
    for (const plat of this.platforms) {
      ctx.fillStyle = COLORS.platform;
      ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
      ctx.fillStyle = COLORS.platformTop;
      ctx.fillRect(plat.x, plat.y, plat.w, 3);
    }
  }

  _renderLadders(ctx) {
    for (const ladder of this.ladders) {
      ctx.strokeStyle = COLORS.ladder;
      ctx.lineWidth = 3;
      // Laterales
      ctx.beginPath();
      ctx.moveTo(ladder.x - 5, ladder.y);
      ctx.lineTo(ladder.x - 5, ladder.y + ladder.h);
      ctx.moveTo(ladder.x + 5, ladder.y);
      ctx.lineTo(ladder.x + 5, ladder.y + ladder.h);
      ctx.stroke();
      // Travesaños
      ctx.lineWidth = 2;
      for (let i = 0; i < ladder.h; i += 14) {
        ctx.beginPath();
        ctx.moveTo(ladder.x - 5, ladder.y + i);
        ctx.lineTo(ladder.x + 5, ladder.y + i);
        ctx.stroke();
      }
    }
  }

  _renderRivets(ctx) {
    if (!this.rivets) return;
    for (const rivet of this.rivets) {
      if (!rivet.alive) continue;
      ctx.fillStyle = COLORS.rivet;
      ctx.fillRect(rivet.x, rivet.y, rivet.w, rivet.h);
    }
  }

  _renderBarrels(ctx) {
    for (const b of this.barrels) {
      if (!b.alive) continue;
      ctx.fillStyle = COLORS.barrel;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, Math.PI * 2);
      ctx.fill();
      // Aros del barril
      ctx.strokeStyle = COLORS.barrelFire;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _renderLifts(ctx) {
    if (!this.lifts) return;
    for (const lift of this.lifts) {
      ctx.fillStyle = COLORS.platform;
      ctx.fillRect(lift.x, lift.y, lift.w, lift.h);
      ctx.fillStyle = COLORS.platformTop;
      ctx.fillRect(lift.x, lift.y, lift.w, 3);
    }
  }

  _renderDK(ctx) {
    // Donkey Kong (simplificado)
    ctx.fillStyle = COLORS.dk;
    ctx.fillRect(this.dk.x - 25, this.dk.y, 50, 40);
    // Cabeza
    ctx.beginPath();
    ctx.arc(this.dk.x, this.dk.y - 5, 18, 0, Math.PI * 2);
    ctx.fill();
    // Ojos
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(this.dk.x - 6, this.dk.y - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.dk.x + 6, this.dk.y - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(this.dk.x - 6, this.dk.y - 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(this.dk.x + 6, this.dk.y - 8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  _renderPauline(ctx) {
    ctx.fillStyle = COLORS.pauline;
    ctx.beginPath();
    ctx.arc(this.pauline.x, this.pauline.y, 10, 0, Math.PI * 2);
    ctx.fill();
    // Vestido
    ctx.fillRect(this.pauline.x - 6, this.pauline.y + 6, 12, 14);
  }

  _renderPlayer(ctx) {
    const p = this.player;

    // Cuerpo (overalls)
    ctx.fillStyle = COLORS.playerOveralls;
    ctx.fillRect(p.x, p.y + p.h * 0.4, p.w, p.h * 0.6);

    // Camiseta
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(p.x, p.y, p.w, p.h * 0.5);

    // Cabeza
    ctx.fillStyle = '#f5cba7';
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2, p.y - 4, 8, 0, Math.PI * 2);
    ctx.fill();

    // Gorra
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x + p.w / 2 + p.facing * 2, p.y - 8, 8, Math.PI, 0, false);
    ctx.fill();
  }

  renderHUD(ctx) {
    const screenNames = ['25m', '50m', '75m', '100m'];
    super.renderHUD(ctx, { extraCenter: [screenNames[this.screen]] });
  }

}


