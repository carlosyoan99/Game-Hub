import { GameBase } from '../../engine/GameBase.js';
import { aabbIntersects } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ── Constantes de juego ──────────────────────────────────────────────────

const PLAYER_SPEED = 280;
const PLAYER_Y_OFFSET = 40;
const SHIP_RADIUS = 14;
const BULLET_SPEED = 420;
const BULLET_WIDTH = 3;
const BULLET_HEIGHT = 12;
const FIRE_COOLDOWN = 0.4;
const ALIEN_BULLET_SPEED = 180;
const ALIEN_BULLET_WIDTH = 4;
const ALIEN_BULLET_HEIGHT = 8;

const ALIEN_COLS = 11;
const ALIEN_ROWS = 5;
const ALIEN_H_SPACING = 48;
const ALIEN_V_SPACING = 36;
const ALIEN_START_Y = 50;
const ALIEN_H_MARGIN = 40;

const SHIELD_COUNT = 4;
const SHIELD_WIDTH = 60;
const SHIELD_HEIGHT = 36;
const SHIELD_BLOCK_SIZE = 6;
const SHIELD_Y = 420;

const MYSTERY_SHIP_Y = 30;
const MYSTERY_SPEED = 120;

const WAVE_BASE_SPEED = 36;
const WAVE_SPEED_PER_LEVEL = 8;
const WAVE_DESCENT_AMOUNT = 16;

// ── Puntuaciones ─────────────────────────────────────────────────────────

const ALIEN_SCORES = [30, 20, 20, 10, 10]; // por fila (0 = top)
const MYSTERY_SCORES = [50, 100, 150, 200, 300];

// ── Colores ──────────────────────────────────────────────────────────────

const BG_COLOR = '#0b0f14';
const PLAYER_COLOR = '#45d66c';
const ALIEN_COLORS = ['#ff4d4d', '#ff6b4a', '#ffb454', '#9ae86c', '#45d66c'];
const SHIELD_NORMAL = '#4a7cbf';
const SHIELD_DAMAGED = '#2d4f7a';
const MYSTERY_COLOR = '#ff6b9d';
const BULLET_COLOR = '#f0e6b3';
const ALIEN_BULLET_COLOR = '#ff4d4d';

// ── Clase principal ──────────────────────────────────────────────────────

export class SpaceInvaders extends GameBase {
  init(engine) {
    super.init(engine, 'space-invaders');
    this.highscore = this.storage.get('highscore', 0);

    this.particles = new ParticleSystem(80);
    this.startTime = Date.now();

    this._restart();
  }

  // ── Inicialización ─────────────────────────────────────────────────────

  _defaultBindings() {
    const parent = super._defaultBindings ? super._defaultBindings() : {};
    return {
      ...parent,
      // hereda moveLeft, moveRight, action, action2, pause, back
    };
  }

  _restart() {
    this.player = {
      x: this.width / 2,
      y: this.height - PLAYER_Y_OFFSET,
      alive: true,
      respawnTimer: 0,
    };

    this.bullets = [];
    this.alienBullets = [];
    this.aliens = [];
    this.shields = [];
    this.mysteryShip = null;
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.fireCooldown = 0;
    this.alienDir = 1; // 1 = derecha, -1 = izquierda
    this.alienSpeed = WAVE_BASE_SPEED;
    this.alienMoveTimer = 0;
    this.alienMoveInterval = 0.8;
    this.shooterAliens = 0;
    this.shooterTimer = 2;
    this.status = 'playing';

    this._spawnWave();
    this._initShields();
  }

  _spawnWave() {
    this.aliens = [];
    this.alienDir = 1;
    this.alienSpeed = WAVE_BASE_SPEED + (this.wave - 1) * WAVE_SPEED_PER_LEVEL;
    this.shooterAliens = Math.min(this.wave - 1, 4);
    this.alienMoveInterval = Math.max(0.3, 1.0 - (this.wave - 1) * 0.08);

    const gridWidth = (ALIEN_COLS - 1) * ALIEN_H_SPACING;
    const startX = (this.width - gridWidth) / 2;

    for (let row = 0; row < ALIEN_ROWS; row++) {
      for (let col = 0; col < ALIEN_COLS; col++) {
        this.aliens.push({
          x: startX + col * ALIEN_H_SPACING,
          y: ALIEN_START_Y + row * ALIEN_V_SPACING,
          row,
          col,
          alive: true,
          width: 32,
          height: 24,
          animFrame: 0,
          animTimer: 0,
          isShooter: false,
        });
      }
    }

    // Asignar aliens que disparan (los de las columnas centrales, filas inferiores)
    this._assignShooters();
  }

  _assignShooters() {
    const liveAliens = this.aliens.filter((a) => a.alive);
    if (liveAliens.length === 0) return;

    // Los shooters son aliens de las filas inferiores
    const bottomAliens = liveAliens
      .filter((a) => a.row >= ALIEN_ROWS - 2)
      .sort((a, b) => b.row - a.row);

    for (let i = 0; i < Math.min(this.shooterAliens, bottomAliens.length); i++) {
      bottomAliens[i].isShooter = true;
    }
  }

  _initShields() {
    this.shields = [];
    const totalWidth = SHIELD_COUNT * (SHIELD_WIDTH + 24);
    const startX = (this.width - totalWidth) / 2 + SHIELD_WIDTH / 2;

    for (let i = 0; i < SHIELD_COUNT; i++) {
      const sx = startX + i * (SHIELD_WIDTH + 24);
      const blocks = [];
      for (let by = 0; by < SHIELD_HEIGHT; by += SHIELD_BLOCK_SIZE) {
        for (let bx = 0; bx < SHIELD_WIDTH; bx += SHIELD_BLOCK_SIZE) {
          // Dejar un hueco en el centro inferior (como en el original)
          const cx = bx + SHIELD_BLOCK_SIZE / 2;
          const cy = by + SHIELD_BLOCK_SIZE / 2;
          if (cx > SHIELD_WIDTH * 0.35 && cx < SHIELD_WIDTH * 0.65 && cy > SHIELD_HEIGHT * 0.5) continue;
          blocks.push({
            x: sx + bx,
            y: SHIELD_Y + by,
            width: SHIELD_BLOCK_SIZE,
            height: SHIELD_BLOCK_SIZE,
            alive: true,
          });
        }
      }
      this.shields.push({ x: sx, y: SHIELD_Y, blocks });
    }
  }

  // ── Update ─────────────────────────────────────────────────────────────

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasActionPressed('action') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }

      return;
    }

    this._updatePlayer(dt);
    this._updateAliens(dt);
    this._updateBullets(dt);
    this._updateAlienBullets(dt);
    this._updateMysteryShip(dt);
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
    this.player.x = Math.max(SHIP_RADIUS, Math.min(this.width - SHIP_RADIUS, this.player.x));

    this.fireCooldown -= dt;
    if ((this.input.isActionDown('action') || this.input.mouse.down) && this.fireCooldown <= 0 && this.player.alive) {
      this._fireBullet();
      this.fireCooldown = FIRE_COOLDOWN;
    }
  }

  _fireBullet() {
    AudioManager.sfx({ type: 'space_invaders_shoot', volume: 0.25 });
    this.bullets.push({
      x: this.player.x,
      y: this.player.y - SHIP_RADIUS - 4,          width: BULLET_WIDTH,
          height: BULLET_HEIGHT,
          vy: -BULLET_SPEED,
          alive: true,
    });
  }

  _updateAliens(dt) {
    const liveAliens = this.aliens.filter((a) => a.alive);
    if (liveAliens.length === 0) return;

    // Calcular el intervalo de movimiento basado en cuántos aliens quedan
    // Mientras menos quedan, más rápido se mueven
    const aliveRatio = liveAliens.length / (ALIEN_ROWS * ALIEN_COLS);
    const moveInterval = this.alienMoveInterval * (0.3 + aliveRatio * 0.7);

    // Animación de aliens (alternar frames)
    for (const alien of liveAliens) {
      alien.animTimer += dt;
      if (alien.animTimer > moveInterval * 0.5) {
        alien.animFrame = alien.animFrame === 0 ? 1 : 0;
        alien.animTimer = 0;
      }
    }

    this.alienMoveTimer += dt;

    if (this.alienMoveTimer >= moveInterval) {
      this.alienMoveTimer = 0;

      // Comprobar si algún alien ha llegado al borde
      let hitEdge = false;
      for (const alien of liveAliens) {
        if (this.alienDir === 1 && alien.x + alien.width / 2 >= this.width - ALIEN_H_MARGIN) {
          hitEdge = true;
          break;
        }
        if (this.alienDir === -1 && alien.x - alien.width / 2 <= ALIEN_H_MARGIN) {
          hitEdge = true;
          break;
        }
      }

      if (hitEdge) {
        this.alienDir *= -1;
        for (const alien of liveAliens) {
          alien.y += WAVE_DESCENT_AMOUNT;
        }
        // Comprobar si los aliens llegaron muy abajo (game over)
        for (const alien of liveAliens) {
          if (alien.y + alien.height / 2 >= this.player.y - SHIP_RADIUS) {
            this._endGame();
            return;
          }
        }
      } else {
        const dx = this.alienSpeed * dt * 60 * this.alienDir;
        for (const alien of liveAliens) {
          alien.x += dx;
        }
      }
    }

    // Disparos de aliens
    this.shooterTimer -= dt;
    if (this.shooterTimer <= 0) {
      this.shooterTimer = 1.5 + this.rng.next() * 2.5 - Math.min(this.wave * 0.1, 1.0);

      const shooters = liveAliens.filter((a) => a.isShooter);
      if (shooters.length > 0) {
        const shooter = shooters[this.rng.nextInt(0, shooters.length - 1)];
        this.alienBullets.push({
          x: shooter.x,
          y: shooter.y + shooter.height / 2,
          width: ALIEN_BULLET_WIDTH,
          height: ALIEN_BULLET_HEIGHT,
          vy: ALIEN_BULLET_SPEED,
          alive: true,
        });
        AudioManager.sfx({ type: 'space_invaders_shoot', volume: 0.12 });
      }
    }

    // Re-asignar shooters periódicamente (cuando mueren los actuales)
    if (liveAliens.filter((a) => a.isShooter).length === 0 && this.shooterAliens > 0) {
      this._assignShooters();
    }
  }

  _updateBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.y += bullet.vy * dt;
      if (bullet.y + bullet.height < 0) bullet.alive = false;
    }
    this.bullets = this.bullets.filter((b) => b.alive);
  }

  _updateAlienBullets(dt) {
    for (const bullet of this.alienBullets) {
      bullet.y += bullet.vy * dt;
      if (bullet.y - bullet.height > this.height) bullet.alive = false;
    }
    this.alienBullets = this.alienBullets.filter((b) => b.alive);
  }

  _updateMysteryShip(dt) {
    if (this.mysteryShip) {
      this.mysteryShip.x += this.mysteryShip.vx * dt;

      // Sale por el borde
      if (this.mysteryShip.x < -40 || this.mysteryShip.x > this.width + 40) {
        this.mysteryShip = null;
      }
    } else {
      // Aparición aleatoria (5% de probabilidad por segundo cuando hay pocos aliens)
      const liveAliens = this.aliens.filter((a) => a.alive).length;
      const totalAliens = ALIEN_ROWS * ALIEN_COLS;
      const spawnChance = liveAliens < totalAliens * 0.5 ? 0.02 : 0.005;
      if (this.rng.next() < spawnChance * dt * 60) {
        const fromRight = this.rng.next() < 0.5;
        this.mysteryShip = {
          x: fromRight ? this.width + 20 : -20,
          y: MYSTERY_SHIP_Y,
          vx: fromRight ? -MYSTERY_SPEED : MYSTERY_SPEED,
          width: 32,
          height: 20,
          alive: true,
        };
      }
    }
  }

  // ── Colisiones ─────────────────────────────────────────────────────────

  _checkCollisions() {
    // Balas del jugador vs aliens
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;
      for (const alien of this.aliens) {
        if (!alien.alive) continue;
        if (aabbIntersects(bullet, alien)) {
          bullet.alive = false;
          alien.alive = false;
          alien.isShooter = false;
          const score = ALIEN_SCORES[alien.row] || 10;
          this.score += score;
          AudioManager.sfx({ type: 'space_invaders_explosion', volume: 0.25 });
          HapticManager.vibrate('hit');
          this.particles.burst(alien.x, alien.y, ALIEN_COLORS[alien.row], 8, 60);
          break;
        }
      }
    }

    // Balas del jugador vs mystery ship
    if (this.mysteryShip) {
      for (const bullet of this.bullets) {
        if (!bullet.alive) continue;
        if (aabbIntersects(bullet, this.mysteryShip)) {
          bullet.alive = false;
          const mysteryScore = MYSTERY_SCORES[this.rng.nextInt(0, MYSTERY_SCORES.length - 1)];
          this.score += mysteryScore;
          this.mysteryShip = null;
          AudioManager.sfx({ type: 'powerup', volume: 0.35 });
          HapticManager.vibrate('powerup');
          break;
        }
      }
    }

    // Balas del jugador vs shields
    this._bulletVsShields(this.bullets);

    // Balas de aliens vs shields
    this._bulletVsShields(this.alienBullets);

    // Balas de aliens vs jugador
    if (this.player.alive) {
      for (const bullet of this.alienBullets) {
        if (!bullet.alive) continue;
        if (aabbIntersects(bullet, { x: this.player.x - SHIP_RADIUS, y: this.player.y - SHIP_RADIUS, width: SHIP_RADIUS * 2, height: SHIP_RADIUS * 2 })) {
          bullet.alive = false;
          this._playerHit();
          break;
        }
      }

      // Alien choca contra el jugador
      for (const alien of this.aliens) {
        if (!alien.alive) continue;
        if (alien.y + alien.height / 2 >= this.player.y - SHIP_RADIUS) {
          this._playerHit();
          break;
        }
      }
    }

    // Limpiar
    this.bullets = this.bullets.filter((b) => b.alive);
    this.alienBullets = this.alienBullets.filter((b) => b.alive);
    this.aliens = this.aliens.filter((a) => a.alive);

    // Comprobar si la oleada está completa
    if (this.aliens.length === 0 && this.status === 'playing') {
      this.wave += 1;
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      this._spawnWave();
      this._repairShields();
    }
  }

  _bulletVsShields(bullets) {
    for (const bullet of bullets) {
      if (!bullet.alive) continue;
      for (const shield of this.shields) {
        for (const block of shield.blocks) {
          if (!block.alive) continue;
          if (aabbIntersects(bullet, block)) {
            bullet.alive = false;
            block.alive = false;
            break;
          }
        }
        if (!bullet.alive) break;
      }
    }
  }

  _playerHit() {
    if (!this.player.alive) return;
    this.player.alive = false;
    this.lives -= 1;
    AudioManager.sfx({ type: 'explosion', volume: 0.5 });
    HapticManager.vibrate('explosion');
    this.particles.burst(this.player.x, this.player.y, PLAYER_COLOR, 20, 120);

    if (this.lives <= 0) {
      this._endGame();
    } else {
      this.player.respawnTimer = 1.5;
    }
  }

  _repairShields() {
    // Reparar parcialmente los escudos entre oleadas
    for (const shield of this.shields) {
      for (const block of shield.blocks) {
        // Revivir algunos bloques destruidos (50%)
        if (!block.alive && this.rng.next() < 0.5) {
          block.alive = true;
        }
      }
    }
  }

  _endGame() {
    this.status = 'game-over';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('space-invaders', this.score, false, duration);
    if (this.score > 0) ProgressionManager.checkAchievement('space-invaders', 'first-blood');
    if (this.wave >= 5) ProgressionManager.checkAchievement('space-invaders', 'wave-5');
    if (this.score >= 10000) ProgressionManager.checkAchievement('space-invaders', 'invader-legend');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, this.width, this.height);

    this._renderShields(ctx);
    this._renderAliens(ctx);
    this._renderMysteryShip(ctx);
    this._renderBullets(ctx);
    this._renderAlienBullets(ctx);
    this._renderPlayer(ctx);
    this.particles.render(ctx);      this.renderHUD(ctx);

    if (this.status !== 'playing') {
      renderOverlay(ctx, { width: this.width, height: this.height, score: this.score });
    }
  }

  _renderPlayer(ctx) {
    if (!this.player.alive) return;

    const px = this.player.x;
    const py = this.player.y;
    const r = SHIP_RADIUS;

    ctx.save();
    ctx.translate(px, py);

    // Cuerpo de la nave (triángulo invertido)
    ctx.fillStyle = PLAYER_COLOR;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(-r * 0.8, r * 0.6);
    ctx.lineTo(-r * 0.3, r * 0.3);
    ctx.lineTo(0, r * 0.5);
    ctx.lineTo(r * 0.3, r * 0.3);
    ctx.lineTo(r * 0.8, r * 0.6);
    ctx.closePath();
    ctx.fill();

    // Línea interior (cockpit)
    ctx.strokeStyle = '#2a9d52';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.3);
    ctx.lineTo(-r * 0.3, r * 0.1);
    ctx.lineTo(0, r * 0.2);
    ctx.lineTo(r * 0.3, r * 0.1);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }

  _renderAliens(ctx) {
    const frameOffset = this.aliens.length > 0 && this.aliens[0].animFrame === 0 ? 0 : 3;

    for (const alien of this.aliens) {
      if (!alien.alive) continue;
      const halfW = alien.width / 2;
      const halfH = alien.height / 2;
      const color = ALIEN_COLORS[alien.row];

      ctx.save();
      ctx.translate(alien.x, alien.y);

      // Diferentes formas según la fila
      ctx.fillStyle = color;
      if (alien.row === 0 || alien.row === 1) {
        // Forma de calamar (top rows)
        ctx.beginPath();
        ctx.moveTo(0, -halfH + frameOffset);
        ctx.lineTo(halfW * 0.5, -halfH * 0.3 + frameOffset);
        ctx.lineTo(halfW, -halfH * 0.6 + frameOffset);
        ctx.lineTo(halfW * 0.8, -halfH * 0.1 + frameOffset);
        ctx.lineTo(halfW, halfH * 0.2 - frameOffset);
        ctx.lineTo(halfW * 0.6, halfH * 0.5 - frameOffset);
        ctx.lineTo(halfW * 0.3, halfH * 0.2 - frameOffset);
        ctx.lineTo(0, halfH * 0.6 - frameOffset);
        ctx.lineTo(-halfW * 0.3, halfH * 0.2 - frameOffset);
        ctx.lineTo(-halfW * 0.6, halfH * 0.5 - frameOffset);
        ctx.lineTo(-halfW, halfH * 0.2 - frameOffset);
        ctx.lineTo(-halfW * 0.8, -halfH * 0.1 + frameOffset);
        ctx.lineTo(-halfW, -halfH * 0.6 + frameOffset);
        ctx.lineTo(-halfW * 0.5, -halfH * 0.3 + frameOffset);
        ctx.closePath();
        ctx.fill();

        // Ojos
        ctx.fillStyle = '#fff';
        ctx.fillRect(-halfW * 0.35, -halfH * 0.4, 5, 5);
        ctx.fillRect(halfW * 0.35 - 5, -halfH * 0.4, 5, 5);

      } else if (alien.row === 2 || alien.row === 3) {
        // Forma de cangrejo (middle rows)
        ctx.beginPath();
        ctx.moveTo(0, -halfH + frameOffset);
        ctx.lineTo(halfW * 0.4, -halfH + frameOffset);
        ctx.lineTo(halfW * 0.7, -halfH * 0.5 + frameOffset);
        ctx.lineTo(halfW, -halfH * 0.3 + frameOffset);
        ctx.lineTo(halfW * 0.8, 0);
        ctx.lineTo(halfW, halfH * 0.3 - frameOffset);
        ctx.lineTo(halfW * 0.6, halfH * 0.5 - frameOffset);
        ctx.lineTo(halfW * 0.3, halfH * 0.2 - frameOffset);
        ctx.lineTo(0, halfH * 0.5 - frameOffset);
        ctx.lineTo(-halfW * 0.3, halfH * 0.2 - frameOffset);
        ctx.lineTo(-halfW * 0.6, halfH * 0.5 - frameOffset);
        ctx.lineTo(-halfW, halfH * 0.3 - frameOffset);
        ctx.lineTo(-halfW * 0.8, 0);
        ctx.lineTo(-halfW, -halfH * 0.3 + frameOffset);
        ctx.lineTo(-halfW * 0.7, -halfH * 0.5 + frameOffset);
        ctx.lineTo(-halfW * 0.4, -halfH + frameOffset);
        ctx.closePath();
        ctx.fill();

        // Ojos grandes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-halfW * 0.25, -halfH * 0.3, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(halfW * 0.25, -halfH * 0.3, 5, 0, Math.PI * 2);
        ctx.fill();

      } else {
        // Forma de jellyfish (bottom row)
        ctx.beginPath();
        ctx.moveTo(0, -halfH + frameOffset);
        ctx.lineTo(halfW * 0.4, -halfH + frameOffset);
        ctx.lineTo(halfW * 0.7, -halfH * 0.3 + frameOffset);
        ctx.lineTo(halfW, -halfH * 0.2 + frameOffset);
        ctx.lineTo(halfW * 0.8, 0);
        ctx.lineTo(halfW, halfH * 0.2 - frameOffset);
        ctx.lineTo(halfW * 0.6, halfH * 0.5 - frameOffset);
        ctx.lineTo(0, halfH * 0.3 - frameOffset);
        ctx.lineTo(-halfW * 0.6, halfH * 0.5 - frameOffset);
        ctx.lineTo(-halfW, halfH * 0.2 - frameOffset);
        ctx.lineTo(-halfW * 0.8, 0);
        ctx.lineTo(-halfW, -halfH * 0.2 + frameOffset);
        ctx.lineTo(-halfW * 0.7, -halfH * 0.3 + frameOffset);
        ctx.lineTo(-halfW * 0.4, -halfH + frameOffset);
        ctx.closePath();
        ctx.fill();

        // Ojos
        ctx.fillStyle = '#fff';
        ctx.fillRect(-halfW * 0.3, -halfH * 0.5, 5, 6);
        ctx.fillRect(halfW * 0.3 - 5, -halfH * 0.5, 5, 6);
      }

      // Indicador de shooter (destello rojo)
      if (alien.isShooter) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, halfW * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  _renderShields(ctx) {
    for (const shield of this.shields) {
      for (const block of shield.blocks) {
        if (!block.alive) continue;
        ctx.fillStyle = SHIELD_NORMAL;
        ctx.fillRect(block.x, block.y, block.width, block.height);
        ctx.strokeStyle = SHIELD_DAMAGED;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(block.x, block.y, block.width, block.height);
      }
    }
  }

  _renderMysteryShip(ctx) {
    if (!this.mysteryShip) return;
    const ms = this.mysteryShip;

    ctx.save();
    ctx.translate(ms.x, ms.y);

    ctx.fillStyle = MYSTERY_COLOR;
    ctx.beginPath();
    ctx.moveTo(-ms.width / 2, -ms.height / 2);
    ctx.lineTo(-ms.width * 0.3, -ms.height / 2);
    ctx.lineTo(-ms.width * 0.1, -ms.height * 0.3);
    ctx.lineTo(ms.width * 0.1, -ms.height * 0.3);
    ctx.lineTo(ms.width * 0.3, -ms.height / 2);
    ctx.lineTo(ms.width / 2, -ms.height / 2);
    ctx.lineTo(ms.width / 2, -ms.height * 0.1);
    ctx.lineTo(ms.width * 0.3, 0);
    ctx.lineTo(ms.width * 0.4, ms.height * 0.3);
    ctx.lineTo(ms.width * 0.2, ms.height / 2);
    ctx.lineTo(-ms.width * 0.2, ms.height / 2);
    ctx.lineTo(-ms.width * 0.4, ms.height * 0.3);
    ctx.lineTo(-ms.width * 0.3, 0);
    ctx.lineTo(-ms.width / 2, -ms.height * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _renderBullets(ctx) {
    ctx.fillStyle = BULLET_COLOR;
    for (const bullet of this.bullets) {
      if (!bullet.alive) continue;
      ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height, bullet.width, bullet.height);
    }
  }

  _renderAlienBullets(ctx) {
    ctx.fillStyle = ALIEN_BULLET_COLOR;
    for (const bullet of this.alienBullets) {
      if (!bullet.alive) continue;
      ctx.fillRect(bullet.x - bullet.width / 2, bullet.y - bullet.height / 2, bullet.width, bullet.height);
    }
  }

  renderHUD(ctx) {
    super.renderHUD(ctx);
  }

} // ── Destrucción heredada de GameBase ──
