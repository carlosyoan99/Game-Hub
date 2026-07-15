import { GameBase } from '../../engine/GameBase.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { clamp } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { ScreenShake } from '../../engine/ScreenShake.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay } from '../../engine/GameUI.js';

// ── Constantes ──────────────────────────────────────────────────────────

const MISSILE_SPEED_BASE = 120;
const MISSILE_SPEED_VAR = 60;
const INTERCEPTOR_SPEED = 300;
const EXPLOSION_RADIUS = 48;
const EXPLOSION_DURATION = 0.6;
const INTERCEPTOR_LIMIT = 20;
const WAVE_MISSILE_BASE = 6;
const WAVE_MISSILE_ADD = 3;

const CITY_POSITIONS = [
  80, 180, 280, 380, 480, 580, 680,
];
const CITY_WIDTH = 40;
const CITY_HEIGHT = 28;

const BASE_POSITIONS = [180, 380, 580];
const BASE_SIZE = 20;

const COLORS = {
  bg: '#0b0f14',
  ground: '#1a1f26',
  city: '#45d66c',
  cityDestroyed: '#2d3a3a',
  base: '#4a7cbf',
  missile: '#ff6b4a',
  interceptor: '#f0e6b3',
  explosion: '#ffb454',
  hud: '#9aa7b2',

  crosshair: '#fff',
};

export class MissileCommand extends GameBase {
  init(engine) {
    super.init(engine, 'missile-command');
    this.highscore = this.storage.get('highscore', 0);

    this.particles = new ParticleSystem(40);

    this.shake = new ScreenShake();
    this._restart();
  }

  _defaultBindings() {
    return {
      fire: ['Space', 'GamepadA', 'GamepadR2'],
      restart: ['Space', 'GamepadStart', 'GamepadA'],
    };
  }

  _restart() {
    this.cities = CITY_POSITIONS.map((x) => ({
      x, y: this.height - 50,
      width: CITY_WIDTH,
      height: CITY_HEIGHT,
      alive: true,
    }));

    this.bases = BASE_POSITIONS.map((x) => ({
      x, y: this.height - 30,
      size: BASE_SIZE,
      ammo: INTERCEPTOR_LIMIT,
    }));

    this.incomingMissiles = [];
    this.interceptors = [];
    this.explosions = [];
    this.score = 0;
    this.wave = 1;
    this.waveActive = false;
    this.missilesLaunched = 0;
    this.missilesPerWave = WAVE_MISSILE_BASE;
    this.launchTimer = 0;
    this.launchInterval = 1.2;
    this.status = 'playing';
    this.mousePos = { x: this.width / 2, y: this.height / 2 };

    this._startWave();
  }

  _startWave() {
    this.waveActive = true;
    this.missilesPerWave = WAVE_MISSILE_BASE + (this.wave - 1) * WAVE_MISSILE_ADD;
    this.missilesLaunched = 0;
    this.launchInterval = Math.max(0.4, 1.2 - this.wave * 0.06);
    this.launchTimer = 0;

    // Recargar bases
    for (const base of this.bases) {
      base.ammo = Math.min(INTERCEPTOR_LIMIT, base.ammo + 5 + this.wave * 2);
    }
  }

  _launchIncomingMissile() {
    const startX = Math.random() * (this.width - 60) + 30;
    const startY = 10;

    // Elegir ciudad objetivo viva
    const liveCities = this.cities.filter((c) => c.alive);
    if (liveCities.length === 0) return;

    const target = liveCities[Math.floor(Math.random() * liveCities.length)];
    const speed = MISSILE_SPEED_BASE + Math.random() * MISSILE_SPEED_VAR + this.wave * 5;

    const dx = target.x - startX;
    const dy = target.y - startY;
    const dist = Math.hypot(dx, dy);
    const vx = (dx / dist) * speed;
    const vy = (dy / dist) * speed;

    this.incomingMissiles.push({
      x: startX,
      y: startY,
      vx,
      vy,
      targetX: target.x,
      targetY: target.y,
      alive: true,
      trail: [],
    });

    this.missilesLaunched++;
  }

  // ── Update ─────────────────────────────────────────────────────────────

  update(dt) {
    // Actualizar posición del ratón
    if (this.input.mouse.x >= 0 && this.input.mouse.y >= 0) {
      this.mousePos.x = this.input.mouse.x;
      this.mousePos.y = this.input.mouse.y;
    }

    if (this.status !== 'playing') {
      if (this.input.wasActionPressed('restart') || this.input.mouse.clickedThisFrame) {
        this._restart();
      }

      return;
    }

    this.shake.update(dt);
    this._updateIncomingMissiles(dt);
    this._updateInterceptors(dt);
    this._updateExplosions(dt);
    this._checkCollisions();
    this.particles.update(dt);

    // Disparar interceptor: click o gamepad (action mapping)
    if (this.input.mouse.clickedThisFrame || this.input.wasActionPressed('fire')) {
      this._fireInterceptor();
    }

    // Lanzar misiles entrantes
    if (this.waveActive && this.missilesLaunched < this.missilesPerWave) {
      this.launchTimer -= dt;
      if (this.launchTimer <= 0) {
        this.launchTimer = this.launchInterval;
        this._launchIncomingMissile();
      }
    }

    // Comprobar si la oleada terminó
    if (this.missilesLaunched >= this.missilesPerWave && this.incomingMissiles.length === 0) {
      const liveCities = this.cities.filter((c) => c.alive).length;
      if (liveCities === 0) {
        this._endGame();
      } else if (this.waveActive) {
        this.waveActive = false;
        this.wave += 1;
        AudioManager.sfx({ type: 'powerup', volume: 0.4 });
        this._startWave();
      }
    }

    this.input.endFrame();
  }

  _fireInterceptor() {
    // Encontrar base más cercana con munición
    let bestBase = null;
    let bestDist = Infinity;
    for (const base of this.bases) {
      if (base.ammo <= 0) continue;
      const dx = this.mousePos.x - base.x;
      const dy = this.mousePos.y - base.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        bestBase = base;
      }
    }

    if (!bestBase) {
      AudioManager.sfx({ type: 'select', volume: 0.15 });
      return;
    }

    bestBase.ammo -= 1;
    AudioManager.sfx({ type: 'missile_launch', volume: 0.2 });

    const dx = this.mousePos.x - bestBase.x;
    const dy = this.mousePos.y - bestBase.y;
    const dist = Math.hypot(dx, dy);
    const speed = INTERCEPTOR_SPEED + Math.random() * 40;

    this.interceptors.push({
      x: bestBase.x,
      y: bestBase.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
      targetX: this.mousePos.x,
      targetY: this.mousePos.y,
      alive: true,
      trail: [],
    });
  }

  _updateIncomingMissiles(dt) {
    for (const m of this.incomingMissiles) {
      if (!m.alive) continue;
      m.x += m.vx * dt;
      m.y += m.vy * dt;

      // Guardar trail (limitado a 10 puntos)
      m.trail.push({ x: m.x, y: m.y });
      if (m.trail.length > 10) m.trail.shift();

      // Llegó al objetivo
      if (m.y >= m.targetY - 5) {
        m.alive = false;
        // Destruir ciudad objetivo
        for (const city of this.cities) {
          if (city.alive && Math.abs(city.x - m.targetX) < CITY_WIDTH / 2) {
            city.alive = false;
            AudioManager.sfx({ type: 'missile_explosion', volume: 0.4 });
            HapticManager.vibrate('explosion');
            this.shake.trigger(6, 0.25);
            this.particles.burst(city.x, city.y, COLORS.city, 15, 100);
            break;
          }
        }
      }
    }
    this.incomingMissiles = this.incomingMissiles.filter((m) => m.alive);
  }

  _updateInterceptors(dt) {
    for (const i of this.interceptors) {
      if (!i.alive) continue;
      i.x += i.vx * dt;
      i.y += i.vy * dt;

      // Guardar trail
      i.trail.push({ x: i.x, y: i.y });
      if (i.trail.length > 8) i.trail.shift();

      // Llegó al objetivo: explota
      const dx = i.x - i.targetX;
      const dy = i.y - i.targetY;
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        i.alive = false;
        AudioManager.sfx({ type: 'missile_explosion', volume: 0.35 });
        this.explosions.push({
          x: i.x,
          y: i.y,
          radius: EXPLOSION_RADIUS,
          maxRadius: EXPLOSION_RADIUS,
          timer: EXPLOSION_DURATION,
          duration: EXPLOSION_DURATION,
        });
        this.particles.burst(i.x, i.y, COLORS.explosion, 10, 80);
      }

      // Fuera de pantalla
      if (i.x < -20 || i.x > this.width + 20 || i.y < -20 || i.y > this.height + 20) {
        i.alive = false;
      }
    }
    this.interceptors = this.interceptors.filter((i) => i.alive);
  }

  _updateExplosions(dt) {
    for (const ex of this.explosions) {
      ex.timer -= dt;
      ex.radius = ex.maxRadius * (1 - ex.timer / ex.duration);
    }
    this.explosions = this.explosions.filter((ex) => ex.timer > 0);
  }

  _checkCollisions() {
    // Explosiones de interceptores vs misiles entrantes
    for (const ex of this.explosions) {
      for (const m of this.incomingMissiles) {
        if (!m.alive) continue;
        const dx = ex.x - m.x;
        const dy = ex.y - m.y;
        if (Math.hypot(dx, dy) < ex.radius) {
          m.alive = false;
          this.score += 25;
          AudioManager.sfx({ type: 'hit', volume: 0.15 });
          this.shake.trigger(3, 0.1);
          this.particles.burst(m.x, m.y, COLORS.missile, 5, 50);
        }
      }
    }

    this.incomingMissiles = this.incomingMissiles.filter((m) => m.alive);
  }

  _endGame() {
    this.status = 'game-over';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  render(ctx) {
    ctx.save();
    this.shake.apply(ctx);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    // Línea del suelo
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, this.height - 60, this.width, 60);

    this._renderCities(ctx);
    this._renderBases(ctx);
    this._renderTrails(ctx);
    this._renderMissiles(ctx);
    this._renderInterceptors(ctx);
    this._renderExplosions(ctx);
    this.particles.render(ctx);
    this._renderCrosshair(ctx);      this.renderHUD(ctx);

    if (this.status !== 'playing') {
      renderOverlay(ctx, { width: this.width, height: this.height, score: this.score });
    }

    ctx.restore();
  }

  _renderCities(ctx) {
    for (const city of this.cities) {
      ctx.fillStyle = city.alive ? COLORS.city : COLORS.cityDestroyed;
      const hw = city.width / 2;
      const hh = city.height / 2;
      // Edificio con forma de ciudad
      ctx.fillRect(city.x - hw, city.y - hh, city.width, city.height);
      // Techo puntiagudo
      ctx.beginPath();
      ctx.moveTo(city.x - hw, city.y - hh);
      ctx.lineTo(city.x, city.y - hh - 8);
      ctx.lineTo(city.x + hw, city.y - hh);
      ctx.closePath();
      ctx.fill();
      // Ventanas
      if (city.alive) {
        ctx.fillStyle = '#f0e6b3';
        ctx.fillRect(city.x - 6, city.y - 6, 4, 4);
        ctx.fillRect(city.x + 2, city.y - 6, 4, 4);
        ctx.fillRect(city.x - 6, city.y + 4, 4, 4);
        ctx.fillRect(city.x + 2, city.y + 4, 4, 4);
      }
    }
  }

  _renderBases(ctx) {
    for (const base of this.bases) {
      ctx.fillStyle = base.ammo > 0 ? COLORS.base : '#2d3a3a';
      ctx.fillRect(base.x - base.size / 2, base.y - base.size / 2, base.size, base.size);
      // Indicador de munición
      ctx.fillStyle = COLORS.hud;
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(base.ammo, base.x, base.y + 3);
    }
  }

  _renderTrails(ctx) {
    for (const m of this.incomingMissiles) {
      if (!m.alive) continue;
      ctx.strokeStyle = 'rgba(255, 107, 74, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < m.trail.length; i++) {
        const alpha = i / m.trail.length;
        ctx.globalAlpha = alpha * 0.5;
        if (i === 0) ctx.moveTo(m.trail[i].x, m.trail[i].y);
        else ctx.lineTo(m.trail[i].x, m.trail[i].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const i of this.interceptors) {
      if (!i.alive) continue;
      ctx.strokeStyle = 'rgba(240, 230, 179, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let j = 0; j < i.trail.length; j++) {
        const alpha = j / i.trail.length;
        ctx.globalAlpha = alpha * 0.7;
        if (j === 0) ctx.moveTo(i.trail[j].x, i.trail[j].y);
        else ctx.lineTo(i.trail[j].x, i.trail[j].y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  _renderMissiles(ctx) {
    for (const m of this.incomingMissiles) {
      if (!m.alive) continue;
      ctx.fillStyle = COLORS.missile;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
      ctx.fill();
      // Cabeza del misil (punta)
      const angle = Math.atan2(m.vy, m.vx);
      ctx.beginPath();
      ctx.moveTo(m.x + Math.cos(angle) * 6, m.y + Math.sin(angle) * 6);
      ctx.lineTo(m.x + Math.cos(angle + 2.4) * 3, m.y + Math.sin(angle + 2.4) * 3);
      ctx.lineTo(m.x + Math.cos(angle - 2.4) * 3, m.y + Math.sin(angle - 2.4) * 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  _renderInterceptors(ctx) {
    for (const i of this.interceptors) {
      if (!i.alive) continue;
      ctx.fillStyle = COLORS.interceptor;
      ctx.beginPath();
      ctx.arc(i.x, i.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _renderExplosions(ctx) {
    for (const ex of this.explosions) {
      const alpha = ex.timer / ex.duration;
      const radius = ex.maxRadius * (1 - alpha * 0.3);
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 180, 84, ${alpha * 0.4})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 180, 84, ${alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  _renderCrosshair(ctx) {
    const mx = this.mousePos.x;
    const my = this.mousePos.y;
    ctx.strokeStyle = COLORS.crosshair;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(mx - 10, my);
    ctx.lineTo(mx + 10, my);
    ctx.moveTo(mx, my - 10);
    ctx.lineTo(mx, my + 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(mx, my, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }  renderHUD(ctx) {
    const liveCities = this.cities.filter((c) => c.alive).length;
    super.renderHUD(ctx, { showLives: false, extraRight: [t('game.lives', { n: liveCities })] });
  }

}

