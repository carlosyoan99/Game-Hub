import { GameBase } from '../../engine/GameBase.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ── Constantes ──────────────────────────────────────────────────────────

const PLAYER_SPEED = 260;
const SHIP_RADIUS = 12;
const BULLET_SPEED = 380;
const BULLET_WIDTH = 3;
const BULLET_HEIGHT = 10;
const FIRE_COOLDOWN = 0.35;
const ENEMY_BULLET_SPEED = 200;

const FORMATION_COLS = 8;
const FORMATION_ROWS = 5;
const FORMATION_H_SPACING = 44;
const FORMATION_V_SPACING = 34;
const FORMATION_START_Y = 40;
const GRID_LEFT = 210;

const ENEMY_TYPES = {
  BEE:     { hp: 1, score: 50, radius: 14 },
  SCORPION: { hp: 1, score: 80, radius: 15 },
  GALAGA:  { hp: 2, score: 150, radius: 16 },
  BOSS:    { hp: 3, score: 300, radius: 18 },
};

const COLORS = {
  bg: '#0b0f14',
  player: '#45d66c',
  dualPlayer: '#66e68a',
  enemy: ['#ff4d4d', '#ff6b4a', '#9b59b6', '#ffb454', '#45d66c'],
  bullet: '#f0e6b3',
  enemyBullet: '#ff6b4a',
  hud: '#9aa7b2',

  boss: '#e74c3c',
};

export class Galaga extends GameBase {
  _defaultBindings() {
    const parent = super._defaultBindings ? super._defaultBindings() : {};
    return {
      ...parent,
      // hereda moveLeft, moveRight, action, action2, pause, back
    };
  }

  init(engine) {
    super.init(engine, 'galaga');
    this.highscore = this.storage.get('highscore', 0);

    this.particles = new ParticleSystem(80);
    this.startTime = Date.now();

    this._restart();
  }

  _restart() {
    this.player = {
      x: this.width / 2,
      y: this.height - 36,
      alive: true,
      respawnTimer: 0,
      dual: false, // ¿tiene nave gemela?
      captured: false, // ¿está capturada por un tractor beam?
    };

    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.fireCooldown = 0;
    this.status = 'playing';
    this.formationTimer = 0;
    this.attackTimer = 0;
    this.diveTimer = 0;
    this.diveCount = 0;
    this.divesPerWave = 3;
    this.bonusActive = false;
    this.bonusTimer = 0;
    this.tractorBeamActive = false;
    this.tractorTarget = null;
    this.tractorProgress = 0;

    this._spawnFormation();
  }

  _spawnFormation() {
    this.enemies = [];
    this.diveCount = 0;
    this.divesPerWave = 3 + Math.floor(this.wave / 2);
    this.tractorBeamActive = false;
    this.tractorTarget = null;

    for (let row = 0; row < FORMATION_ROWS; row++) {
      for (let col = 0; col < FORMATION_COLS; col++) {
        let type;
        if (row === 0) type = ENEMY_TYPES.BOSS;
        else if (row <= 1) type = ENEMY_TYPES.GALAGA;
        else if (row <= 2) type = ENEMY_TYPES.SCORPION;
        else type = ENEMY_TYPES.BEE;

        this.enemies.push({
          x: GRID_LEFT + col * FORMATION_H_SPACING,
          y: FORMATION_START_Y + row * FORMATION_V_SPACING,
          startX: GRID_LEFT + col * FORMATION_H_SPACING,
          startY: FORMATION_START_Y + row * FORMATION_V_SPACING,
          row,
          col,
          type,
          hp: type.hp,  // copia, no referencia
          alive: true,
          angle: 0,
          wobble: this.rng.next() * Math.PI * 2,
          width: type.radius * 2,
          height: type.radius * 2,
        });
      }
    }
  }

  _startDive() {
    const liveEnemies = this.enemies.filter((e) => e.alive);
    if (liveEnemies.length === 0) return;

    // Elegir un enemigo de las filas superiores para que ataque en picada
    const divers = liveEnemies.filter((e) => e.row <= 2);
    if (divers.length === 0) return;

    const diver = divers[this.rng.nextInt(0, divers.length - 1)];
    this.attackTimer = 4 + this.rng.next() * 2;

    // Trayectoria de picada: el enemigo se separa de la formacion
    diver.diving = true;
    diver.diveAngle = Math.PI / 2; // hacia abajo
    diver.diveSpeed = 80 + this.wave * 5 + this.rng.next() * 30;
    diver.diveShootTimer = 0.5 + this.rng.next() * 0.5;

    // Ocasionalmente: tractor beam (si el jugador está vivo y no tiene dual)
    if (this.rng.next() < 0.3 && this.player.alive && !this.player.dual && !this.tractorBeamActive) {
      diver.hasTractor = true;
      this.tractorBeamActive = true;
      this.tractorTarget = diver;
      this.tractorProgress = 0;
    } else {
      diver.hasTractor = false;
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────

  update(dt) {
    if (this.status === 'wave-transition') {
      this.waveTransitionTimer -= dt;
      if (this.waveTransitionTimer <= 0 || this.input.mouse.clickedThisFrame || this.input.wasActionPressed('action')) {
        this._startNextWave();
      }
      this.particles.update(dt);

      return;
    }

    if (this.status === 'game-over') {
      if (this.input.wasActionPressed('action') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }

      return;
    }

    this._updatePlayer(dt);
    this._updateBullets(dt);
    this._updateEnemyBullets(dt);
    this._updateFormation(dt);
    this._updateDivers(dt);
    this._updateTractorBeam(dt);
    this._updateBonus(dt);
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
        this.player.captured = false;
      }
      return;
    }

    if (this.player.captured) return; // no se mueve mientras está capturada

    if (this.input.isActionDown('moveLeft')) {
      this.player.x -= PLAYER_SPEED * dt;
    }
    if (this.input.isActionDown('moveRight')) {
      this.player.x += PLAYER_SPEED * dt;
    }
    this.player.x = Math.max(SHIP_RADIUS, Math.min(this.width - SHIP_RADIUS, this.player.x));

    this.fireCooldown -= dt;
    if ((this.input.isActionDown('action') || this.input.mouse.down) && this.fireCooldown <= 0) {
      this._fireBullet();
      this.fireCooldown = FIRE_COOLDOWN;
    }
  }

  _fireBullet() {
    AudioManager.sfx({ type: 'galaga_shoot', volume: 0.2 });
    this.bullets.push({
      x: this.player.x,
      y: this.player.y - SHIP_RADIUS - 4,
      width: BULLET_WIDTH,
      height: BULLET_HEIGHT,
      vy: -BULLET_SPEED,
      alive: true,
    });

    // Dual ship: dispara dos balas
    if (this.player.dual) {
      this.bullets.push({
        x: this.player.x - 10,
        y: this.player.y - SHIP_RADIUS - 2,
        width: BULLET_WIDTH,
        height: BULLET_HEIGHT,
        vy: -BULLET_SPEED,
        alive: true,
      });
      this.bullets.push({
        x: this.player.x + 10,
        y: this.player.y - SHIP_RADIUS - 2,
        width: BULLET_WIDTH,
        height: BULLET_HEIGHT,
        vy: -BULLET_SPEED,
        alive: true,
      });
    }
  }

  _updateBullets(dt) {
    for (const b of this.bullets) {
      b.y += b.vy * dt;
      if (b.y + b.height < 0) b.alive = false;
    }
    this.bullets = this.bullets.filter((b) => b.alive);
  }

  _updateEnemyBullets(dt) {
    for (const b of this.enemyBullets) {
      b.y += b.vy * dt;
      if (b.y > this.height + 10) b.alive = false;
    }
    this.enemyBullets = this.enemyBullets.filter((b) => b.alive);
  }

  _updateFormation(dt) {
    // Saltar si hay un enemigo en picada o bonus activo
    if (this.enemies.some(e => e.diving) || this.bonusActive) return;

    // Movimiento de la formacion (wobble suave de izquierda a derecha)
    this.formationTimer += dt;
    const waveX = Math.sin(this.formationTimer * 0.5) * 30;

    for (const enemy of this.enemies) {
      if (!enemy.alive || enemy.diving) continue;
      enemy.x = enemy.startX + waveX + Math.sin(enemy.wobble + this.formationTimer * 0.8) * 3;
      enemy.y = enemy.startY + Math.sin(enemy.wobble * 1.3 + this.formationTimer * 0.6) * 2;
      enemy.wobble += dt * 0.2;
    }

    // Iniciar picadas periódicamente
    this.diveTimer += dt;
    if (this.diveTimer > 2.5 && this.diveCount < this.divesPerWave) {
      this.diveTimer = 0;
      this._startDive();
    }

    // Bonus stage: cuando quedan pocos enemigos
    const liveEnemies = this.enemies.filter((e) => e.alive && !e.diving);
    if (liveEnemies.length <= 3 && this.diveCount >= this.divesPerWave && !this.bonusActive) {
      this._startBonusStage();
    }
  }

  _updateDivers(dt) {
    for (const enemy of this.enemies) {
      if (!enemy.alive || !enemy.diving) continue;

      // Mover en picada
      enemy.x += Math.cos(enemy.diveAngle) * enemy.diveSpeed * dt;
      enemy.y += Math.sin(enemy.diveAngle) * enemy.diveSpeed * dt;

      // Disparar durante la picada
      enemy.diveShootTimer -= dt;
      if (enemy.diveShootTimer <= 0) {
        enemy.diveShootTimer = 1.0 + this.rng.next() * 1.5;
        this.enemyBullets.push({
          x: enemy.x,
          y: enemy.y + enemy.type.radius,
          width: 4,
          height: 8,
          vy: ENEMY_BULLET_SPEED,
          alive: true,
        });
        AudioManager.sfx({ type: 'galaga_shoot', volume: 0.1 });
      }

      // Si salió de la pantalla, volver a la formación
      if (enemy.y > this.height + 30) {
        enemy.diving = false;
        enemy.hasTractor = false;
        enemy.x = enemy.startX;
        enemy.y = enemy.startY;

        this.diveCount++;
        if (this.tractorTarget === enemy) {
          this.tractorBeamActive = false;
          this.tractorTarget = null;
        }
      }

      // Si el enemigo llega a la altura del jugador y no tiene tractor, sube
      if (enemy.y > this.height * 0.7 && !enemy.hasTractor) {
        enemy.diveAngle = -Math.PI / 3; // remontar
        enemy.diveSpeed *= 0.8;
      }
    }
  }

  _updateTractorBeam(dt) {
    if (!this.tractorBeamActive || !this.tractorTarget || !this.player.alive || this.player.dual) return;

    const target = this.tractorTarget;
    if (!target.alive || !target.diving) {
      this.tractorBeamActive = false;
      this.tractorTarget = null;
      return;
    }

    // Tractor beam atrae al jugador hacia el enemigo
    if (target.y > this.height * 0.4 && this.player.captured) {
      // El jugador ya está capturado, sube con el enemigo
      this.player.x = target.x;
      this.player.y = target.y + 20;
    } else if (target.y > this.height * 0.4 && Math.abs(this.player.x - target.x) < 30) {
      // Capturar jugador
      this.player.captured = true;
      AudioManager.sfx({ type: 'powerup', volume: 0.3 });
    }
  }

  _startBonusStage() {
    this.bonusActive = true;
    this.bonusTimer = 5;

    // Enemigos bonus vuelan en patrones
    const liveEnemies = this.enemies.filter((e) => e.alive && !e.diving);
    for (let i = 0; i < liveEnemies.length; i++) {
      const e = liveEnemies[i];
      e.bonusPhase = i / liveEnemies.length;
      e.bonusSpeed = 100 + this.rng.next() * 50;
      e.bonusAngle = (i / liveEnemies.length) * Math.PI * 2;
    }
  }

  _updateBonus(dt) {
    if (!this.bonusActive) return;

    this.bonusTimer -= dt;
    const liveEnemies = this.enemies.filter((e) => e.alive);

    for (const e of liveEnemies) {
      if (e.diving) continue;
      e.bonusAngle += dt * 1.5;
      e.x = this.width / 2 + Math.cos(e.bonusAngle + e.bonusPhase * Math.PI * 2) * 200;
      e.y = 100 + Math.sin(e.bonusAngle * 0.7 + e.bonusPhase * Math.PI * 2) * 60;
    }

    if (this.bonusTimer <= 0 || liveEnemies.length === 0) {
      this.bonusActive = false;
      // Reponer formacion o pasar a siguiente oleada
      if (liveEnemies.length === 0) {
        this._nextWave();
      } else {
        // Volver a posiciones de formacion
        for (const e of liveEnemies) {
          e.x = e.startX;
          e.y = e.startY;
        }
      }
    }
  }

  _checkCollisions() {
    // Balas del jugador vs enemigos
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        const r = enemy.type.radius;
        if (Math.abs(dx) < bullet.width / 2 + r && Math.abs(dy) < bullet.height / 2 + r) {
          bullet.alive = false;
          enemy.hp -= 1;
          this.particles.burst(enemy.x, enemy.y, COLORS.enemy[enemy.row % COLORS.enemy.length], 5, 50);

          if (enemy.hp <= 0) {
            enemy.alive = false;
            this.score += enemy.type.score;
            AudioManager.sfx({ type: 'hit', volume: 0.3 });
            HapticManager.vibrate('hit');
            this.particles.burst(enemy.x, enemy.y, COLORS.enemy[enemy.row % COLORS.enemy.length], 10, 80);

            // Si tenía tractor beam y capturó al jugador, liberar
            if (enemy.hasTractor && this.player.captured) {
              this.player.captured = false;
              this.player.dual = true; // Nave gemela!
              this.tractorBeamActive = false;
              this.tractorTarget = null;
              AudioManager.sfx({ type: 'powerup', volume: 0.5 });
              this.particles.burst(this.player.x, this.player.y, COLORS.dualPlayer, 15, 100);
            }
          } else {
            AudioManager.sfx({ type: 'select', volume: 0.15 });
          }
          break;
        }
      }
    }

    // Enemigo vs jugador
    if (this.player.alive && !this.player.captured) {
      for (const enemy of this.enemies) {
        if (!enemy.alive || !enemy.diving) continue;
        const dx = this.player.x - enemy.x;
        const dy = this.player.y - enemy.y;
        if (Math.abs(dx) < SHIP_RADIUS + enemy.type.radius && Math.abs(dy) < SHIP_RADIUS + enemy.type.radius) {
          this._playerHit();
          break;
        }
      }
    }

    // Balas enemigas vs jugador
    if (this.player.alive && !this.player.captured) {
      for (const b of this.enemyBullets) {
        if (!b.alive) continue;
        const dx = this.player.x - b.x;
        const dy = this.player.y - b.y;
        if (Math.abs(dx) < SHIP_RADIUS + b.width / 2 && Math.abs(dy) < SHIP_RADIUS + b.height / 2) {
          b.alive = false;
          this._playerHit();
          break;
        }
      }
    }

    // Limpiar
    this.bullets = this.bullets.filter((b) => b.alive);
    this.enemyBullets = this.enemyBullets.filter((b) => b.alive);

    // Comprobar si la oleada terminó (todos muertos en formacion)
    if (!this.bonusActive) {
      const liveInFormation = this.enemies.filter((e) => e.alive && !e.diving);
      const allDead = this.enemies.every((e) => !e.alive);
      if (allDead || (liveInFormation.length === 0 && this.diveCount >= this.divesPerWave)) {
        this._nextWave();
      }
    }
  }

  _nextWave() {
    this.wave += 1;
    AudioManager.sfx({ type: 'powerup', volume: 0.5 });
    this.waveTransitionTimer = 5; // auto-avance en 5 segundos
    this.status = 'wave-transition';
  }

  _startNextWave() {
    this.status = 'playing';
    this._spawnFormation();
    this.diveTimer = 0;
    this.waveTransitionTimer = 0;
  }

  _playerHit() {
    if (!this.player.alive) return;
    this.player.alive = false;
    this.player.dual = false;
    this.player.captured = false;
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

  _endGame() {
    this.status = 'game-over';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('galaga', this.score, false, duration);
    if (this.score > 0) ProgressionManager.checkAchievement('galaga', 'first-hit');
    if (this.wave >= 10) ProgressionManager.checkAchievement('galaga', 'galaga-wave-10');
    if (this.score >= 50000) ProgressionManager.checkAchievement('galaga', 'galaga-master');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    // Estrellas de fondo
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    for (let i = 0; i < 30; i++) {
      const sx = (i * 137.5 + 50) % this.width;
      const sy = (i * 97.3 + 20) % this.height;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }

    this._renderEnemies(ctx);
    this._renderTractorBeam(ctx);
    this._renderBullets(ctx);
    this._renderEnemyBullets(ctx);
    this._renderPlayer(ctx);
    this.particles.render(ctx);      this.renderHUD(ctx);

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

  _renderPlayer(ctx) {
    if (!this.player.alive) return;
    const px = this.player.x;
    const py = this.player.y;
    const color = this.player.dual ? COLORS.dualPlayer : COLORS.player;

    ctx.fillStyle = color;
    // Nave principal
    ctx.beginPath();
    ctx.moveTo(px, py - SHIP_RADIUS);
    ctx.lineTo(px - SHIP_RADIUS * 0.7, py + SHIP_RADIUS * 0.4);
    ctx.lineTo(px - SHIP_RADIUS * 0.3, py + SHIP_RADIUS * 0.2);
    ctx.lineTo(px, py + SHIP_RADIUS * 0.3);
    ctx.lineTo(px + SHIP_RADIUS * 0.3, py + SHIP_RADIUS * 0.2);
    ctx.lineTo(px + SHIP_RADIUS * 0.7, py + SHIP_RADIUS * 0.4);
    ctx.closePath();
    ctx.fill();

    // Ala
    ctx.fillStyle = '#2a9d52';
    ctx.fillRect(px - SHIP_RADIUS * 0.5, py - 2, SHIP_RADIUS * 1.0, 4);

    if (this.player.dual) {
      // Nave gemela (pequeña, al lado)
      ctx.fillStyle = COLORS.dualPlayer;
      ctx.beginPath();
      ctx.arc(px + 16, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px - 16, py, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _renderEnemies(ctx) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const r = enemy.type.radius;
      const color = COLORS.enemy[enemy.row % COLORS.enemy.length];

      ctx.save();
      ctx.translate(enemy.x, enemy.y);

      // Cuerpo
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.8, -r * 0.3);
      ctx.lineTo(r, r * 0.2);
      ctx.lineTo(r * 0.7, r * 0.6);
      ctx.lineTo(r * 0.3, r);
      ctx.lineTo(0, r * 0.7);
      ctx.lineTo(-r * 0.3, r);
      ctx.lineTo(-r * 0.7, r * 0.6);
      ctx.lineTo(-r, r * 0.2);
      ctx.lineTo(-r * 0.8, -r * 0.3);
      ctx.closePath();
      ctx.fill();

      // Ojos
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 0.3, -r * 0.2, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r * 0.3, -r * 0.2, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Antenas (solo bosses)
      if (enemy.type === ENEMY_TYPES.BOSS) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, -r);
        ctx.lineTo(-r * 0.6, -r * 1.5);
        ctx.moveTo(r * 0.4, -r);
        ctx.lineTo(r * 0.6, -r * 1.5);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  _renderTractorBeam(ctx) {
    if (!this.tractorBeamActive || !this.tractorTarget || !this.player.alive) return;

    const target = this.tractorTarget;
    if (target.alive && target.diving && this.player.captured) {
      ctx.strokeStyle = 'rgba(255, 180, 84, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(target.x, target.y + target.type.radius);
      ctx.lineTo(this.player.x, this.player.y - SHIP_RADIUS);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  _renderBullets(ctx) {
    ctx.fillStyle = COLORS.bullet;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      ctx.fillRect(b.x - b.width / 2, b.y - b.height, b.width, b.height);
    }
  }

  _renderEnemyBullets(ctx) {
    ctx.fillStyle = COLORS.enemyBullet;
    for (const b of this.enemyBullets) {
      if (!b.alive) continue;
      ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
    }
  }

  renderHUD(ctx) {
    const leftExtras = [];
    if (this.player.dual) {
      leftExtras.push('✦ ' + t('game.power'));
    }
    super.renderHUD(ctx, { extraLeft: leftExtras });
  }

}

