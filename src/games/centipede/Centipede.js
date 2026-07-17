import { GameBase } from '../../engine/GameBase.js';
import { aabbIntersects } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, renderBossHealthBar } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ── Constantes ──────────────────────────────────────────────────────────

const PLAYER_SIZE = 14;
const PLAYER_SPEED = 260;
const SEGMENT_RADIUS = 10;
const SEGMENT_SPACING = 18;
const MUSHROOM_SIZE = 12;
const BULLET_SPEED = 400;
const BULLET_SIZE = 3;
const FIRE_COOLDOWN = 0.2;

const INITIAL_SEGMENTS = 12;
const SPIDER_SIZE = 14;
const BOSS_WAVE_INTERVAL = 5; // Jefe cada 5 oleadas
const BOSS_QUEEN_RADIUS = 22;
const BOSS_QUEEN_HP = 12;
const BOSS_BULLET_SPEED = 180;
const BOSS_FIRE_COOLDOWN = 1.8;

const COLORS = {
  bg: '#0b0f14',
  player: '#45d66c',
  segment: ['#ff4d4d', '#ff6b4a', '#ffb454'],
  mushroom: '#4a7cbf',
  mushroomDim: '#2d4f7a',
  bullet: '#f0e6b3',
  spider: '#9b59b6',
  hud: '#9aa7b2',
};

export class Centipede extends GameBase {
  init(engine) {
    super.init(engine, 'centipede');
    this.highscore = this.storage.get('highscore', 0);

    this.particles = new ParticleSystem(80);

    this._restart();
  }

  _defaultBindings() {
    return {
      moveLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      fire:      ['Space', 'GamepadA'],
      restart:   ['Space', 'GamepadStart', 'GamepadA'],
    };
  }

  _restart() {
    this.player = {
      x: this.width / 2,
      y: this.height - 30,
      alive: true,
      respawnTimer: 0,
    };

    this.bullets = [];
    this.mushrooms = [];
    this.centipede = [];
    this.spiders = [];
    this.boss = null;
    this.bossBullets = [];
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.fireCooldown = 0;
    this.status = 'playing';
    this.moveTimer = 0;
    this.moveInterval = 0.15;
    this.spiderTimer = 3;
    this.waveTransitionTimer = 0;

    this._initMushrooms();
    this._spawnCentipede();
  }

  _initMushrooms() {
    this.mushrooms = [];
    const count = 20 + this.wave * 5;
    for (let i = 0; i < count; i++) {
      this._placeMushroom();
    }
  }

  _placeMushroom() {
    const mx = this.rng.nextInt(20, this.width - 20);
    const my = this.rng.nextInt(40, Math.floor(this.height * 0.6) + 40);
    // No colocar encima de otro hongo
    for (const m of this.mushrooms) {
      if (Math.abs(m.x - mx) < MUSHROOM_SIZE && Math.abs(m.y - my) < MUSHROOM_SIZE) return;
    }
    this.mushrooms.push({ x: mx, y: my, size: MUSHROOM_SIZE, hp: 3 });
  }

  _spawnCentipede() {
    this.centipede = [];
    const segments = INITIAL_SEGMENTS + (this.wave - 1) * 3;
    const startX = this.rng.next() * (this.width - 80) + 40;
    const startY = 20;

    for (let i = 0; i < segments; i++) {
      this.centipede.push({
        x: startX - i * SEGMENT_SPACING,
        y: startY,
        dir: 1, // 1 = derecha, -1 = izquierda
        prevX: startX - i * SEGMENT_SPACING,
        prevY: startY,
        alive: true,
        index: i,
      });
    }

    this.moveInterval = Math.max(0.06, 0.15 - this.wave * 0.01);
  }

  // ── Boss Queen Centipede ──────────────────────────────────────────────

  _spawnBoss() {
    this.boss = {
      x: this.width / 2,
      y: 25,
      radius: BOSS_QUEEN_RADIUS,
      hp: BOSS_QUEEN_HP + this.wave,
      maxHp: BOSS_QUEEN_HP + this.wave,
      dir: 1,
      speed: 100 + this.wave * 5,
      fireTimer: BOSS_FIRE_COOLDOWN,
    };
    this.bossBullets = [];
    this.status = 'boss-fight';
    // Eliminar arañas durante boss fight
    this.spiders = [];
  }

  _updateBoss(dt) {
    if (!this.boss) return;

    // Movimiento horizontal
    this.boss.x += this.boss.speed * this.boss.dir * dt;
    if (this.boss.x < this.boss.radius + 10) { this.boss.x = this.boss.radius + 10; this.boss.dir = 1; }
    if (this.boss.x > this.width - this.boss.radius - 10) { this.boss.x = this.width - this.boss.radius - 10; this.boss.dir = -1; }

    // Disparar cada cierto tiempo
    this.boss.fireTimer -= dt;
    if (this.boss.fireTimer <= 0) {
      this.boss.fireTimer = Math.max(0.8, BOSS_FIRE_COOLDOWN - this.wave * 0.05);
      // Disparar 3 balas en abanico
      for (let i = -1; i <= 1; i++) {
        const angle = Math.PI / 2 + i * 0.25;
        this.bossBullets.push({
          x: this.boss.x,
          y: this.boss.y + this.boss.radius,
          radius: 4,
          vx: Math.cos(angle) * BOSS_BULLET_SPEED,
          vy: Math.sin(angle) * BOSS_BULLET_SPEED,
          alive: true,
        });
      }
      AudioManager.sfx({ type: 'centipede_shoot', volume: 0.3 });
    }

    // Mover balas del jefe
    for (const bullet of this.bossBullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.y > this.height + 30 || bullet.y < -30 || bullet.x < -30 || bullet.x > this.width + 30) {
        bullet.alive = false;
      }
    }
    this.bossBullets = this.bossBullets.filter(b => b.alive);

    // Bala del jefe vs jugador
    for (const bullet of this.bossBullets) {
      const dx = this.player.x - bullet.x;
      const dy = this.player.y - bullet.y;
      if (Math.abs(dx) < PLAYER_SIZE + bullet.radius && Math.abs(dy) < PLAYER_SIZE + bullet.radius) {
        this._playerHit();
        return;
      }
    }

    // Bala del jugador vs jefe
    for (const bullet of this.bullets) {
      const dx = bullet.x - this.boss.x;
      const dy = bullet.y - this.boss.y;
      if (Math.abs(dx) < bullet.width / 2 + this.boss.radius && Math.abs(dy) < bullet.height / 2 + this.boss.radius) {
        bullet.alive = false;
        this.boss.hp--;
        this.score += 20;
        this.particles.burst(this.boss.x + (this.rng.next() - 0.5) * 30, this.boss.y + (this.rng.next() - 0.5) * 30, '#ff6b4a', 5, 60);
        AudioManager.sfx({ type: 'centipede_hit', volume: 0.25 });
        HapticManager.vibrate('hit');

        if (this.boss.hp <= 0) {
          this._defeatBoss();
        }
        break;
      }
    }
  }

  _defeatBoss() {
    this.score += 200;
    AudioManager.sfx({ type: 'powerup', volume: 0.6 });
    HapticManager.vibrate('powerup');
    this.particles.burst(this.boss.x, this.boss.y, '#ff6b4a', 25, 200);
    this.particles.burst(this.boss.x, this.boss.y, '#ffd700', 15, 150);
    ProgressionManager.checkAchievement('centipede', 'queen-slayer');
    ProgressionManager.addXp(75, 'boss-defeated');
    this.boss = null;
    this.bossBullets = [];
    this.wave++;
    this.waveTransitionTimer = 3;
    this.status = 'wave-transition';
  }

  _spawnSpider() {
    if (this.status === 'boss-fight') return;
    const side = this.rng.nextInt(0, 3);
    let x, y, vx, vy;
    const speed = 60 + this.wave * 8;
    if (side === 0) { x = 0; y = this.rng.next() * this.height * 0.6; vx = speed; vy = (this.rng.next() - 0.5) * speed; }
    else if (side === 1) { x = this.width; y = this.rng.next() * this.height * 0.6; vx = -speed; vy = (this.rng.next() - 0.5) * speed; }
    else if (side === 2) { x = this.rng.next() * this.width; y = 0; vx = (this.rng.next() - 0.5) * speed; vy = speed; }
    else { x = this.rng.next() * this.width; y = this.height * 0.6; vx = (this.rng.next() - 0.5) * speed; vy = -speed; }

    this.spiders.push({ x, y, vx, vy, radius: SPIDER_SIZE, alive: true, hp: 2 + Math.floor(this.wave / 3) });
  }

  // ── Update ─────────────────────────────────────────────────────────────

  update(dt) {
    if (this.status === 'wave-transition') {
      this.waveTransitionTimer -= dt;
      this.particles.update(dt);
      if (this.waveTransitionTimer <= 0 || this.input.mouse.clickedThisFrame || this.input.wasActionPressed('action')) {
        this._startNextWave();
      }

      return;
    }

    if (this.status === 'boss-fight') {
      this._updateBoss(dt);
      this._updatePlayer(dt);
      this._updateBullets(dt);
      this.particles.update(dt);
      this.input.endFrame();
      return;
    }

    if (this.status === 'game-over') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame || this.input.wasPressed('GamepadA') || this.input.wasPressed('GamepadStart')) {
        this._restart();
      }

      return;
    }

    this._updatePlayer(dt);
    this._updateBullets(dt);
    this._updateCentipede(dt);
    this._updateSpiders(dt);
    this._checkCollisions();
    this.particles.update(dt);

    this.input.endFrame();
  }

  _updatePlayer(dt) {
    if (!this.player.alive) {
      this.player.respawnTimer -= dt;
      if (this.player.respawnTimer <= 0 && this.lives > 0) {
        this.player.alive = true;
        this.player.x = this.width / 2;
        this.player.respawnTimer = 0;
      }
      return;
    }

    if (this.input.isActionDown('moveLeft')) {
      this.player.x -= PLAYER_SPEED * dt;
    }
    if (this.input.isActionDown('moveRight')) {
      this.player.x += PLAYER_SPEED * dt;
    }
    this.player.x = Math.max(PLAYER_SIZE, Math.min(this.width - PLAYER_SIZE, this.player.x));

    this.fireCooldown -= dt;
    if ((this.input.isActionDown('action') || this.input.mouse.down) && this.fireCooldown <= 0) {
      this._fireBullet();
      this.fireCooldown = FIRE_COOLDOWN;
    }
  }

  _fireBullet() {
    AudioManager.sfx({ type: 'centipede_shoot', volume: 0.2 });
    this.bullets.push({
      x: this.player.x,
      y: this.player.y - PLAYER_SIZE - 2,
      width: BULLET_SIZE,
      height: BULLET_SIZE * 3,
      vy: -BULLET_SPEED,
      alive: true,
    });
  }

  _updateBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.y += bullet.vy * dt;
      if (bullet.y + bullet.height < 0) bullet.alive = false;
    }
    this.bullets = this.bullets.filter((b) => b.alive);
  }

  _updateCentipede(dt) {
    const live = this.centipede.filter((s) => s.alive);
    if (live.length === 0) return;

    this.moveTimer += dt;

    if (this.moveTimer >= this.moveInterval) {
      this.moveTimer = 0;

      // Mover la cabeza primero
      const head = live.find((s) => s.index === 0);
      if (!head) return;

      // Guardar posiciones anteriores
      for (const seg of live) {
        seg.prevX = seg.x;
        seg.prevY = seg.y;
      }

      // Mover cabeza
      let newX = head.x + head.dir * SEGMENT_SPACING;
      let newY = head.y;
      let changedDir = false;

      // Choca con borde horizontal
      if (newX < 10 || newX > this.width - 10) {
        head.dir *= -1;
        newY = head.y + SEGMENT_SPACING;
        newX = head.x + head.dir * SEGMENT_SPACING;
        changedDir = true;
      }

      // Choca con hongo
      for (const mush of this.mushrooms) {
        const dx = newX - mush.x;
        const dy = newY - mush.y;
        if (Math.abs(dx) < SEGMENT_RADIUS + mush.size / 2 && Math.abs(dy) < SEGMENT_RADIUS + mush.size / 2) {
          head.dir *= -1;
          newY = head.y + SEGMENT_SPACING;
          newX = head.x + head.dir * SEGMENT_SPACING;
          changedDir = true;
          break;
        }
      }

      // Si el centipede llega demasiado abajo, game over
      if (newY > this.height - 50) {
        this._endGame();
        return;
      }

      head.x = newX;
      head.y = newY;

      // Mover el resto del cuerpo (cada segmento sigue al anterior)
      for (let i = 1; i < this.centipede.length; i++) {
        const seg = this.centipede[i];
        if (!seg.alive) continue;
        const prev = this.centipede[i - 1];
        if (!prev.alive) continue;
        seg.x = prev.prevX;
        seg.y = prev.prevY;
      }
    }
  }

  _updateSpiders(dt) {
    for (const spider of this.spiders) {
      if (!spider.alive) continue;
      spider.x += spider.vx * dt;
      spider.y += spider.vy * dt;

      // Rebote en bordes
      if (spider.x < 0 || spider.x > this.width) { spider.vx *= -1; }
      if (spider.y < 0 || spider.y > this.height * 0.7) { spider.vy *= -1; }
      spider.x = Math.max(0, Math.min(this.width, spider.x));
      spider.y = Math.max(0, Math.min(this.height * 0.7, spider.y));

      // Si la araña come un hongo, lo destruye
      for (const mush of this.mushrooms) {
        const dx = spider.x - mush.x;
        const dy = spider.y - mush.y;
        if (Math.abs(dx) < spider.radius + mush.size / 2 && Math.abs(dy) < spider.radius + mush.size / 2) {
          mush.hp = 0;
          break;
        }
      }
    }
    this.spiders = this.spiders.filter((s) => s.alive);

    // Generar nueva araña periódicamente (solo si no estamos en boss fight)
    this.spiderTimer -= dt;
    if (this.spiderTimer <= 0 && this.status !== 'boss-fight') {
      this.spiderTimer = 4 - Math.min(this.wave * 0.2, 2);
      this._spawnSpider();
    }
  }

  _checkCollisions() {
    // Balas vs centipede
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;
      for (const seg of this.centipede) {
        if (!seg.alive) continue;
        const dx = bullet.x - seg.x;
        const dy = bullet.y - seg.y;
        if (Math.abs(dx) < bullet.width / 2 + SEGMENT_RADIUS && Math.abs(dy) < bullet.height / 2 + SEGMENT_RADIUS) {
          bullet.alive = false;
          seg.alive = false;
          this.score += 10;
          AudioManager.sfx({ type: 'centipede_hit', volume: 0.2 });
          HapticManager.vibrate('hit');
          this.particles.burst(seg.x, seg.y, COLORS.segment[seg.index % 3], 6, 50);

          // Crear hongo donde murió el segmento
          this.mushrooms.push({ x: seg.x, y: seg.y, size: MUSHROOM_SIZE, hp: 3 });

          break;
        }
      }
    }

    // Balas vs arañas
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;
      for (const spider of this.spiders) {
        if (!spider.alive) continue;
        const dx = bullet.x - spider.x;
        const dy = bullet.y - spider.y;
        if (Math.abs(dx) < bullet.width / 2 + spider.radius && Math.abs(dy) < bullet.height / 2 + spider.radius) {
          bullet.alive = false;
          spider.hp -= 1;
          this.particles.burst(spider.x, spider.y, COLORS.spider, 6, 60);
          if (spider.hp <= 0) {
            spider.alive = false;
            this.score += 50;
            AudioManager.sfx({ type: 'explosion', volume: 0.3 });
            HapticManager.vibrate('explosion');
            this.particles.burst(spider.x, spider.y, COLORS.spider, 12, 100);
          } else {
            AudioManager.sfx({ type: 'centipede_hit', volume: 0.2 });
          }
          break;
        }
      }
    }

    // Balas vs hongos (eliminar hongos)
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;
      for (const mush of this.mushrooms) {
        if (mush.hp <= 0) continue;
        const dx = bullet.x - mush.x;
        const dy = bullet.y - mush.y;
        if (Math.abs(dx) < bullet.width / 2 + mush.size / 2 && Math.abs(dy) < bullet.height / 2 + mush.size / 2) {
          bullet.alive = false;
          mush.hp -= 1;
          if (mush.hp <= 0) {
            this.score += 5;
            this.particles.burst(mush.x, mush.y, COLORS.mushroom, 4, 40);
          }
          break;
        }
      }
    }

    // Centipede vs jugador (colisión)
    if (this.player.alive) {
      for (const seg of this.centipede) {
        if (!seg.alive) continue;
        const dx = this.player.x - seg.x;
        const dy = this.player.y - seg.y;
        if (Math.abs(dx) < PLAYER_SIZE + SEGMENT_RADIUS && Math.abs(dy) < PLAYER_SIZE + SEGMENT_RADIUS) {
          this._playerHit();
          break;
        }
      }

      // Araña vs jugador
      if (this.player.alive) {
        for (const spider of this.spiders) {
          if (!spider.alive) continue;
          const dx = this.player.x - spider.x;
          const dy = this.player.y - spider.y;
          if (Math.abs(dx) < PLAYER_SIZE + spider.radius && Math.abs(dy) < PLAYER_SIZE + spider.radius) {
            this._playerHit();
            break;
          }
        }
      }
    }

    // Limpiar
    this.bullets = this.bullets.filter((b) => b.alive);
    this.mushrooms = this.mushrooms.filter((m) => m.hp > 0);

    // Comprobar si la oleada está completa
    const liveSegments = this.centipede.filter((s) => s.alive);
    if (liveSegments.length === 0 && this.status === 'playing') {
      this.wave += 1;

      // ¿Oleada de jefe?
      if (this.wave % BOSS_WAVE_INTERVAL === 0) {
        AudioManager.sfx({ type: 'powerup', volume: 0.5 });
        this._spawnBoss();
      } else {
        AudioManager.sfx({ type: 'powerup', volume: 0.5 });
        this.waveTransitionTimer = 5;
        this.status = 'wave-transition';
      }
    }
  }

  _playerHit() {
    if (!this.player.alive) return;
    this.player.alive = false;
    this.lives -= 1;
    AudioManager.sfx({ type: 'explosion', volume: 0.5 });
    HapticManager.vibrate('explosion');
    this.particles.burst(this.player.x, this.player.y, COLORS.player, 20, 120);

    if (this.lives <= 0) {
      this._endGame();
    } else {
      this.player.respawnTimer = 1.5;
    }
  }

  _startNextWave() {
    this.status = 'playing';
    this._spawnCentipede();
    this._initMushrooms();
    this.waveTransitionTimer = 0;
  }

  _endGame() {
    this.status = 'game-over';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    // ── Progression ──
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('centipede', this.score, false, duration);
    if (this.wave >= 3) ProgressionManager.checkAchievement('centipede', 'wave-3');
    if (this.wave >= 10) ProgressionManager.checkAchievement('centipede', 'wave-10');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  _renderBoss(ctx) {
    if (!this.boss) return;
    const r = this.boss.radius;
    const pulse = Math.sin(Date.now() * 0.006) * 0.1 + 0.9;

    ctx.save();
    ctx.translate(this.boss.x, this.boss.y);
    ctx.scale(pulse, pulse);

    // Cuerpo grande
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    // Corona
    ctx.fillStyle = '#ffd700';
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.fillRect(
        Math.cos(angle) * r - 3,
        Math.sin(angle) * r - 6,
        6, 10
      );
    }

    // Ojos grandes y rojos
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.2, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.35, -r * 0.2, r * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff0000';
    const lookDir = this.boss.dir;
    ctx.beginPath();
    ctx.arc(-r * 0.35 + lookDir * 2, -r * 0.2, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.35 + lookDir * 2, -r * 0.2, r * 0.12, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  _renderBossBullets(ctx) {
    ctx.fillStyle = '#ff6b4a';
    for (const b of this.bossBullets) {
      if (!b.alive) continue;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      // Rastro
      ctx.fillStyle = 'rgba(255, 107, 74, 0.3)';
      ctx.beginPath();
      ctx.arc(b.x - b.vx * 0.03, b.y - b.vy * 0.03, b.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff6b4a';
    }
  }

  render(ctx) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    this._renderMushrooms(ctx);
    this._renderCentipede(ctx);
    this._renderSpiders(ctx);
    this._renderBullets(ctx);
    this._renderPlayer(ctx);
    this._renderBoss(ctx);
    this._renderBossBullets(ctx);
    this.particles.render(ctx);      this.renderHUD(ctx);

    if (this.status === 'boss-fight') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ff6b4a';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('centipede.bossWave'), this.width / 2, this.height / 2 - 30);
      if (this.boss) {
        renderBossHealthBar(ctx, {
          x: this.width / 2 - 100,
          y: this.height / 2 + 5,
          width: 200,
          height: 12,
          hp: this.boss.hp,
          maxHp: this.boss.maxHp,
          label: t('centipede.boss'),
        });
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    if (this.status === 'wave-transition') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffb454';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('game.wave', { n: this.wave }), this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#e7edf3';
      ctx.font = '14px monospace';
      ctx.fillText(t('game.continue') + ` (${Math.ceil(this.waveTransitionTimer)}s)`, this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    if (this.status === 'game-over') {
      renderOverlay(ctx, { width: this.width, height: this.height, score: this.score });
    }
  }

  _renderCentipede(ctx) {
    for (const seg of this.centipede) {
      if (!seg.alive) continue;

      const color = COLORS.segment[seg.index % 3];
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, SEGMENT_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Borde más oscuro
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Ojos en la cabeza
      if (seg.index === 0) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(seg.x - 3, seg.y - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(seg.x + 3, seg.y - 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(seg.x - 3 + seg.dir * 1, seg.y - 3, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(seg.x + 3 + seg.dir * 1, seg.y - 3, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _renderMushrooms(ctx) {
    for (const mush of this.mushrooms) {
      if (mush.hp <= 0) continue;
      const alpha = mush.hp / 3;
      ctx.fillStyle = COLORS.mushroom;
      ctx.globalAlpha = 0.4 + alpha * 0.6;
      ctx.fillRect(mush.x - mush.size / 2, mush.y - mush.size / 2, mush.size, mush.size);
      ctx.strokeStyle = COLORS.mushroomDim;
      ctx.lineWidth = 1;
      ctx.strokeRect(mush.x - mush.size / 2, mush.y - mush.size / 2, mush.size, mush.size);
      ctx.globalAlpha = 1;
    }
  }

  _renderSpiders(ctx) {
    for (const spider of this.spiders) {
      if (!spider.alive) continue;
      const r = spider.radius;

      ctx.fillStyle = COLORS.spider;
      // Cuerpo
      ctx.beginPath();
      ctx.arc(spider.x, spider.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Patas (4 a cada lado)
      ctx.strokeStyle = COLORS.spider;
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i += 2) {
        for (let j = 1; j <= 2; j++) {
          ctx.beginPath();
          ctx.moveTo(spider.x + i * r * 0.4, spider.y);
          ctx.lineTo(spider.x + i * r * (0.8 + j * 0.3), spider.y + j * r * 0.6 * (i > 0 ? 1 : -1));
          ctx.stroke();
        }
      }

      // Ojos
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(spider.x - 3, spider.y - 2, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(spider.x + 3, spider.y - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _renderPlayer(ctx) {
    if (!this.player.alive) return;

    const px = this.player.x;
    const py = this.player.y;
    const r = PLAYER_SIZE;

    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(px, py - r);
    ctx.lineTo(px - r * 0.8, py + r * 0.5);
    ctx.lineTo(px, py + r * 0.2);
    ctx.lineTo(px + r * 0.8, py + r * 0.5);
    ctx.closePath();
    ctx.fill();

    // Cañón
    ctx.fillStyle = '#2a9d52';
    ctx.fillRect(px - 2, py - r - 6, 4, 8);
  }

  _renderBullets(ctx) {
    ctx.fillStyle = COLORS.bullet;
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;
      ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height, bullet.width, bullet.height);
    }
  }  renderHUD(ctx) {
    super.renderHUD(ctx);
  }

}

