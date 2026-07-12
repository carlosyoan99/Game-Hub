import { renderOverlay, setupHUDContext, clearHUDContext } from '../../engine/GameUI.js';
import { GameBase } from '../../engine/GameBase.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { Vector2 } from '../../engine/Vector2.js';
import { circleIntersects } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { SeededRandom } from '../../engine/SeededRandom.js';
import { t } from '../../engine/i18n.js';
import { MAX_WAVE, SHIP_RADIUS, SHIP_TURN_SPEED, SHIP_THRUST, SHIP_FRICTION, SHIP_MAX_SPEED, RESPAWN_INVULNERABILITY, BULLET_SPEED, BULLET_LIFETIME, FIRE_COOLDOWN, ASTEROID_SPECS, generateAsteroidShape } from './constants.js';

/**
 * Asteroids — expandido con oleadas progresivas
 * Oleadas 1-2: solo asteroides.
 * Oleadas 3-4: asteroides + enemigos que persiguen.
 * Oleadas 5+: asteroides + enemigos que disparan.
 */
export class Asteroids extends GameBase {
  init(engine) {
    super.init(engine, 'asteroids');
    this.highscore = this.storage.get('highscore', 0);

    this._restart();
  }

  _restart() {
    this.rng = new SeededRandom();
    this.seedCode = SeededRandom.encode(this.rng.seed);
    this.ship = {
      x: this.width / 2,
      y: this.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      radius: SHIP_RADIUS,
      thrusting: false,
      invulnerable: RESPAWN_INVULNERABILITY,
    };
    this.bullets = [];
    this.asteroids = [];
    this.enemies = [];
    this.enemyBullets = [];
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.fireCooldown = 0;
    this.particles = new ParticleSystem(80);
    this.status = 'playing';
    this._spawnWave();
  }

  _spawnWave() {
    const count = 2 + this.wave + Math.floor(this.wave / 2);
    for (let i = 0; i < count; i++) {
      let x;
      let y;
      do {
        x = this.rng.next() * this.width;
        y = this.rng.next() * this.height;
      } while (Math.hypot(x - this.ship.x, y - this.ship.y) < 150);
      this._spawnAsteroid('large', x, y);
    }

    if (this.wave >= 3) {
      const enemyCount = 1 + Math.floor((this.wave - 3) / 2);
      for (let i = 0; i < enemyCount; i++) {
        this._spawnEnemy();
      }
    }
  }

  _spawnEnemy() {
    const side = this.rng.nextInt(0, 3);
    let x, y;
    if (side === 0) { x = -20; y = this.rng.next() * this.height; }
    else if (side === 1) { x = this.width + 20; y = this.rng.next() * this.height; }
    else if (side === 2) { x = this.rng.next() * this.width; y = -20; }
    else { x = this.rng.next() * this.width; y = this.height + 20; }

    this.enemies.push({
      x, y,
      radius: 14,
      angle: Math.atan2(this.ship.y - y, this.ship.x - x),
      turnSpeed: 2.5 + this.rng.next(),
      speed: 50 + this.rng.next() * 30 + this.wave * 3,
      fireTimer: 2 + this.rng.next(),
      fireCooldown: 1.5 - Math.min(this.wave * 0.1, 0.8),
      hp: 2 + Math.floor((this.wave - 3) / 2),
      alive: true,
      shape: generateAsteroidShape(this.rng),
    });
  }

  _spawnAsteroid(size, x, y) {
    const spec = ASTEROID_SPECS[size];
    const angle = this.rng.next() * Math.PI * 2;
    const speed = spec.speed * (0.6 + this.rng.next() * 0.8);
    this.asteroids.push({
      x, y, size,
      radius: spec.radius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: this.rng.next() * Math.PI * 2,
      rotationSpeed: (this.rng.next() - 0.5) * 2,
      shape: generateAsteroidShape(this.rng),
    });
  }

  update(dt) {
    if (this.handleRestartInput()) return;

    this._updateShip(dt);
    this._updateBullets(dt);
    this._updateAsteroids(dt);
    this._updateEnemies(dt);
    this._checkCollisions();

    this.input.endFrame();
  }

  _updateShip(dt) {
    if (this.input.isDown('ArrowLeft') || this.input.isDown('KeyA')) {
      this.ship.angle -= SHIP_TURN_SPEED * dt;
    }
    if (this.input.isDown('ArrowRight') || this.input.isDown('KeyD')) {
      this.ship.angle += SHIP_TURN_SPEED * dt;
    }

    this.ship.thrusting = this.input.isDown('ArrowUp') || this.input.isDown('KeyW');
    if (this.ship.thrusting) {
      const thrust = Vector2.fromAngle(this.ship.angle, SHIP_THRUST * dt);
      this.ship.vx += thrust.x;
      this.ship.vy += thrust.y;
    }

    const damping = Math.exp(-SHIP_FRICTION * dt);
    this.ship.vx *= damping;
    this.ship.vy *= damping;

    const speed = Math.hypot(this.ship.vx, this.ship.vy);
    if (speed > SHIP_MAX_SPEED) {
      const scale = SHIP_MAX_SPEED / speed;
      this.ship.vx *= scale;
      this.ship.vy *= scale;
    }

    this.ship.x += this.ship.vx * dt;
    this.ship.y += this.ship.vy * dt;
    this._wrap(this.ship);

    if (this.ship.invulnerable > 0) this.ship.invulnerable -= dt;
    this.fireCooldown -= dt;
    if ((this.input.isDown('Space') || this.input.mouse.down) && this.fireCooldown <= 0) {
      this._fireBullet();
      this.fireCooldown = FIRE_COOLDOWN;
    }
  }

  _fireBullet() {
    const dir = Vector2.fromAngle(this.ship.angle, 1);
    AudioManager.sfx({ type: 'asteroids_shoot', volume: 0.2 });
    this.bullets.push({
      x: this.ship.x + dir.x * SHIP_RADIUS,
      y: this.ship.y + dir.y * SHIP_RADIUS,
      vx: dir.x * BULLET_SPEED + this.ship.vx,
      vy: dir.y * BULLET_SPEED + this.ship.vy,
      life: BULLET_LIFETIME,
      radius: 2,
    });
  }

  _updateBullets(dt) {
    for (const bullet of this.bullets) {
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < 0 || bullet.x > this.width || bullet.y < 0 || bullet.y > this.height) {
        bullet.dead = true;
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  _updateAsteroids(dt) {
    for (const asteroid of this.asteroids) {
      asteroid.x += asteroid.vx * dt;
      asteroid.y += asteroid.vy * dt;
      asteroid.rotation += asteroid.rotationSpeed * dt;
      this._wrap(asteroid);
    }
  }

  _updateEnemies(dt) {
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      const targetAngle = Math.atan2(this.ship.y - enemy.y, this.ship.x - enemy.x);
      let diff = targetAngle - enemy.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      enemy.angle += Math.sign(diff) * Math.min(Math.abs(diff), enemy.turnSpeed * dt);

      enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
      enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
      this._wrap(enemy);

      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemy.fireTimer = enemy.fireCooldown;
        this.enemyBullets.push({
          x: enemy.x + Math.cos(enemy.angle) * 16,
          y: enemy.y + Math.sin(enemy.angle) * 16,
          vx: Math.cos(enemy.angle) * 220,
          vy: Math.sin(enemy.angle) * 220,
          radius: 3,
          alive: true,
        });
        AudioManager.sfx({ type: 'asteroids_shoot', volume: 0.15 });
      }
    }
    for (const b of this.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20 || b.x > this.width + 20 || b.y < -20 || b.y > this.height + 20) b.alive = false;
    }
    this.enemyBullets = this.enemyBullets.filter((b) => b.alive);
  }

  _wrap(obj) {
    const r = obj.radius ?? 0;
    if (obj.x < -r) obj.x = this.width + r;
    else if (obj.x > this.width + r) obj.x = -r;
    if (obj.y < -r) obj.y = this.height + r;
    else if (obj.y > this.height + r) obj.y = -r;
  }

  _checkCollisions() {
    const pendingSplits = [];

    for (const bullet of this.bullets) {
      if (bullet.dead) continue;
      for (const asteroid of this.asteroids) {
        if (asteroid.dead) continue;
        if (circleIntersects(bullet, asteroid)) {
          bullet.dead = true;
          asteroid.dead = true;
          this.score += ASTEROID_SPECS[asteroid.size].score;
          AudioManager.sfx({ type: 'hit', volume: 0.3 });
          HapticManager.vibrate('hit');
          pendingSplits.push(asteroid);
          break;
        }
      }
      if (!bullet.dead) {
        for (const enemy of this.enemies) {
          if (!enemy.alive) continue;
          if (circleIntersects(bullet, enemy)) {
            bullet.dead = true;
            enemy.hp--;
            this.particles.burst(enemy.x, enemy.y, '#ff6b4a', 6, 80, { vyOffset: -30 });
            if (enemy.hp <= 0) {
              enemy.alive = false;
              this.score += 50 + this.wave * 10;
              AudioManager.sfx({ type: 'asteroids_explosion', volume: 0.4 });
              HapticManager.vibrate('explosion');
              this.particles.burst(enemy.x, enemy.y, '#ffb454', 15, 150, { vyOffset: -40 });
            } else {
              AudioManager.sfx({ type: 'hit', volume: 0.25 });
            }
            break;
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.asteroids = this.asteroids.filter((a) => !a.dead);
    this.enemies = this.enemies.filter((e) => e.alive);
    for (const asteroid of pendingSplits) this._splitAsteroid(asteroid);

    if (this.ship.invulnerable <= 0) {
      for (const b of this.enemyBullets) {
        if (b.alive && circleIntersects(b, this.ship)) {
          b.alive = false;
          this._loseLife();
          break;
        }
      }
      if (this.status === 'playing') {
        for (const enemy of this.enemies) {
          if (enemy.alive && circleIntersects(this.ship, enemy)) {
            this._loseLife();
            break;
          }
        }
      }
      if (this.status === 'playing') {
        for (const asteroid of this.asteroids) {
          if (circleIntersects(this.ship, asteroid)) {
            this._loseLife();
            break;
          }
        }
      }
    }

    if (this.asteroids.length === 0 && this.enemies.filter((e) => e.alive).length === 0 && this.status === 'playing') {
      this.wave += 1;
      if (this.wave > MAX_WAVE) {
        this.status = 'won';
        if (this.score > this.highscore) {
          this.highscore = this.score;
          this.storage.set('highscore', this.highscore);
        }
        AudioManager.sfx({ type: 'powerup', volume: 0.6 });
        HapticManager.vibrate('powerup');
        return;
      }
      this._spawnWave();
    }
  }

  _splitAsteroid(asteroid) {
    const spec = ASTEROID_SPECS[asteroid.size];
    if (!spec.splitsInto) return;
    for (let i = 0; i < spec.splitCount; i++) {
      this._spawnAsteroid(spec.splitsInto, asteroid.x, asteroid.y);
    }
  }

  _loseLife() {
    this.lives -= 1;
    AudioManager.sfx({ type: 'explosion', volume: 0.5 });
    HapticManager.vibrate('explosion');
    if (this.lives <= 0) {
      this._endGame();
      return;
    }
    this.ship.x = this.width / 2;
    this.ship.y = this.height / 2;
    this.ship.vx = 0;
    this.ship.vy = 0;
    this.ship.invulnerable = RESPAWN_INVULNERABILITY;
  }

  _endGame() {
    this.status = 'lost';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
  }

  render(ctx) {
    ctx.fillStyle = '#0b0f14';
    ctx.fillRect(0, 0, this.width, this.height);

    for (const asteroid of this.asteroids) {
      this._renderAsteroid(ctx, asteroid);
    }

    ctx.fillStyle = '#ffb454';
    for (const bullet of this.bullets) {
      ctx.beginPath();
      ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    this._renderShip(ctx);

    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      this._renderEnemy(ctx, enemy);
    }

    ctx.fillStyle = '#ff6b4a';
    for (const b of this.enemyBullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    setupHUDContext(ctx);
    ctx.fillText(t('asteroids.score', { n: this.score }), 10, 10);
    ctx.fillText(t('asteroids.lives', { n: this.lives }), this.width - 90, 10);
    ctx.fillText(t('asteroids.wave', { n: this.wave }), this.width / 2 - 40, 10);
    ctx.fillText(t('asteroids.record', { n: this.highscore }), this.width / 2 - 40, 28);


    if (this.status === 'won') {
      renderOverlay(ctx, { width: this.width, height: this.height, title: t('game.victory'), score: this.score });
    } else if (this.status === 'lost') {
      renderOverlay(ctx, { width: this.width, height: this.height });
    }
  }

  _renderShip(ctx) {
    const blinking = this.ship.invulnerable > 0 && Math.floor(this.ship.invulnerable * 10) % 2 === 0;
    ctx.save();
    ctx.translate(this.ship.x, this.ship.y);
    ctx.rotate(this.ship.angle);
    if (blinking) ctx.globalAlpha = 0.3;

    ctx.strokeStyle = '#e7edf3';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(SHIP_RADIUS, 0);
    ctx.lineTo(-SHIP_RADIUS * 0.7, SHIP_RADIUS * 0.7);
    ctx.lineTo(-SHIP_RADIUS * 0.3, 0);
    ctx.lineTo(-SHIP_RADIUS * 0.7, -SHIP_RADIUS * 0.7);
    ctx.closePath();
    ctx.stroke();

    if (this.ship.thrusting) {
      ctx.strokeStyle = '#ffb454';
      ctx.beginPath();
      ctx.moveTo(-SHIP_RADIUS * 0.3, 0);
      ctx.lineTo(-SHIP_RADIUS * 1.3, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  _renderEnemy(ctx, enemy) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle);
    ctx.strokeStyle = '#ff6b4a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(enemy.radius, 0);
    ctx.lineTo(-enemy.radius * 0.6, enemy.radius * 0.6);
    ctx.lineTo(-enemy.radius * 0.3, 0);
    ctx.lineTo(-enemy.radius * 0.6, -enemy.radius * 0.6);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 107, 74, 0.3)';
    ctx.beginPath();
    ctx.arc(enemy.radius * 0.3, 0, enemy.radius * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _renderAsteroid(ctx, asteroid) {
    ctx.save();
    ctx.translate(asteroid.x, asteroid.y);
    ctx.rotate(asteroid.rotation);
    ctx.strokeStyle = '#9aa7b2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const n = asteroid.shape.length;
    for (let i = 0; i <= n; i++) {
      const idx = i % n;
      const vertexAngle = (idx / n) * Math.PI * 2;
      const r = asteroid.radius * asteroid.shape[idx];
      const px = Math.cos(vertexAngle) * r;
      const py = Math.sin(vertexAngle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

}
