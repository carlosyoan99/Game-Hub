import { InputManager } from '../../engine/InputManager.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { Vector2 } from '../../engine/Vector2.js';
import { circleIntersects } from '../../engine/CollisionUtils.js';

const SHIP_RADIUS = 12;
const SHIP_TURN_SPEED = Math.PI * 1.6; // rad/s
const SHIP_THRUST = 220; // px/s^2
const SHIP_FRICTION = 0.6; // amortiguación exponencial por segundo
const SHIP_MAX_SPEED = 340;
const RESPAWN_INVULNERABILITY = 2; // segundos

const BULLET_SPEED = 480;
const BULLET_LIFETIME = 0.9;
const FIRE_COOLDOWN = 0.25;

const ASTEROID_SPECS = {
  large: { radius: 38, speed: 45, splitsInto: 'medium', splitCount: 2, score: 20 },
  medium: { radius: 22, speed: 75, splitsInto: 'small', splitCount: 2, score: 50 },
  small: { radius: 12, speed: 120, splitsInto: null, splitCount: 0, score: 100 },
};

/**
 * Asteroids
 * Primer juego del hub con física de "nave espacial" real: en vez de
 * mover directamente x/y (como Breakout/Pong), aquí se acumula velocidad
 * (this.ship.vx/vy) a partir de un empuje orientado por ángulo, con
 * fricción exponencial para que se sienta a la deriva, no como un coche.
 * También es el primer uso de Vector2 en el hub (Vector2.fromAngle para
 * el vector de empuje y el de disparo) y de wraparound de pantalla.
 */
export class Asteroids {
  init(engine) {
    this.engine = engine;
    this.canvas = engine.canvas;
    this.input = new InputManager();
    this.input.attach(this.canvas);
    this.storage = new StorageManager('asteroids');

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.highscore = this.storage.get('highscore', 0);

    this._restart();
  }

  handleResize(width, height) {
    this.width = width;
    this.height = height;
  }

  _restart() {
    this.ship = {
      x: this.width / 2,
      y: this.height / 2,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2, // apuntando "hacia arriba" al iniciar
      radius: SHIP_RADIUS,
      thrusting: false,
      invulnerable: RESPAWN_INVULNERABILITY,
    };
    this.bullets = [];
    this.asteroids = [];
    this.score = 0;
    this.lives = 3;
    this.wave = 1;
    this.fireCooldown = 0;
    this.status = 'playing';
    this._spawnWave();
  }

  _spawnWave() {
    const count = 2 + this.wave;
    for (let i = 0; i < count; i++) {
      let x;
      let y;
      // Evita que un asteroide aparezca encima de la nave recién reaparecida.
      do {
        x = Math.random() * this.width;
        y = Math.random() * this.height;
      } while (Math.hypot(x - this.ship.x, y - this.ship.y) < 150);
      this._spawnAsteroid('large', x, y);
    }
  }

  _spawnAsteroid(size, x, y) {
    const spec = ASTEROID_SPECS[size];
    const angle = Math.random() * Math.PI * 2;
    const speed = spec.speed * (0.6 + Math.random() * 0.8);
    this.asteroids.push({
      x,
      y,
      size,
      radius: spec.radius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 2,
      shape: generateAsteroidShape(),
    });
  }

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }
      this.input.endFrame();
      return;
    }

    this._updateShip(dt);
    this._updateBullets(dt);
    this._updateAsteroids(dt);
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

    // Fricción exponencial: independiente del framerate, a diferencia de
    // un simple "vx *= 0.98" que dependería de cuántos frames pasen.
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

  /** Envuelve un objeto con x/y/radius a través de los bordes del canvas. */
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
          pendingSplits.push(asteroid);
          break;
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.asteroids = this.asteroids.filter((a) => !a.dead);
    // Los fragmentos se generan aquí, ya fuera del bucle que recorría
    // this.asteroids: empujarlos dentro del propio bucle (como hacía
    // antes) los exponía a balas posteriores del mismo frame.
    for (const asteroid of pendingSplits) this._splitAsteroid(asteroid);

    if (this.ship.invulnerable <= 0) {
      for (const asteroid of this.asteroids) {
        if (circleIntersects(this.ship, asteroid)) {
          this._loseLife();
          break;
        }
      }
    }

    if (this.asteroids.length === 0 && this.status === 'playing') {
      this.wave += 1;
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

    ctx.fillStyle = '#9aa7b2';
    ctx.font = '14px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(`Puntos: ${this.score}`, 10, 10);
    ctx.fillText(`Vidas: ${this.lives}`, this.width - 90, 10);
    ctx.fillText(`Oleada: ${this.wave}`, this.width / 2 - 40, 10);
    ctx.fillText(`Récord: ${this.highscore}`, this.width / 2 - 40, 28);

    if (this.status !== 'playing') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GAME OVER', this.width / 2, this.height / 2 - 20);
      ctx.font = '16px monospace';
      ctx.fillText('Click o Espacio para reiniciar', this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
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

  destroy() {
    this.input.detach();
  }
}

/** Genera un contorno irregular (0.7-1.2x el radio por vértice) para que no sean círculos perfectos. */
function generateAsteroidShape(vertexCount = 10) {
  const shape = [];
  for (let i = 0; i < vertexCount; i++) {
    shape.push(0.7 + Math.random() * 0.5);
  }
  return shape;
}
