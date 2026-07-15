import { GameBase } from '../../engine/GameBase.js';
import { StorageManager } from '../../engine/StorageManager.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ── Constantes ──────────────────────────────────────────────────────────

const TILE = 24;
const COLS = 21;
const ROWS = 21;
const MAP_X = 130;
const MAP_Y = 20;

const PLAYER_RADIUS = 10;
const PLAYER_SPEED = 120;
const GHOST_RADIUS = 10;
const GHOST_SPEED = 80;
const FRIGHTENED_SPEED = 50;
const FRIGHTENED_DURATION = 6;

// Maze: 0=vacio, 1=punto, 2=poder, 3=pared, 4=puerta fantasma, 5=casa fantasma
const MAZE_DATA = [
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3],
  [3,1,1,1,1,1,1,1,1,1,3,1,1,1,1,1,1,1,1,1,3],
  [3,1,3,3,3,1,3,3,3,1,3,1,3,3,3,1,3,3,3,1,3],
  [3,2,3,3,3,1,3,3,3,1,3,1,3,3,3,1,3,3,3,2,3],
  [3,1,3,3,3,1,3,3,3,1,3,1,3,3,3,1,3,3,3,1,3],
  [3,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3],
  [3,1,3,3,3,1,3,1,3,3,3,3,3,1,3,1,3,3,3,1,3],
  [3,1,3,3,3,1,3,1,3,3,3,3,3,1,3,1,3,3,3,1,3],
  [3,1,1,1,1,1,3,1,1,1,3,1,1,1,3,1,1,1,1,1,3],
  [3,3,3,3,3,1,3,3,3,0,3,0,3,3,3,1,3,3,3,3,3],
  [3,1,1,1,1,1,3,0,0,0,0,0,0,0,3,1,1,1,1,1,3],
  [3,3,3,3,3,1,3,0,3,3,5,3,3,0,3,1,3,3,3,3,3],
  [3,1,1,1,1,1,3,0,3,0,0,0,3,0,3,1,1,1,1,1,3],
  [3,1,3,3,3,1,3,0,3,0,0,0,3,0,3,1,3,3,3,1,3],
  [3,1,3,3,3,1,3,0,3,0,0,0,3,0,3,1,3,3,3,1,3],
  [3,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3],
  [3,1,3,3,3,1,3,3,3,3,3,3,3,3,3,1,3,3,3,1,3],
  [3,1,3,3,3,1,3,3,3,3,3,3,3,3,3,1,3,3,3,1,3],
  [3,2,1,1,3,1,1,1,1,1,1,1,1,1,1,1,3,1,1,2,3],
  [3,3,3,1,3,1,3,1,3,3,3,3,3,1,3,1,3,1,3,3,3],
  [3,3,3,1,1,1,3,1,1,1,3,1,1,1,3,1,1,1,3,3,3],
];

const COLORS = {
  bg: '#0a0a12',
  wall: '#1a1a3a',
  wallBorder: '#2a2a5a',
  dot: '#f0a0b0',
  powerPellet: '#ffb454',
  player: '#ffe600',
  ghost: { red: '#ff0000', pink: '#ffb8bf', cyan: '#00ffff', orange: '#ffb852' },
  frightened: '#2121de',
  eaten: '#fff',
  hud: '#9aa7b2',

};

const GHOST_NAMES = ['blinky', 'pinky', 'inky', 'clyde'];
const GHOST_COLORS = ['red', 'pink', 'cyan', 'orange'];

export class PacMan extends GameBase {
  init(engine) {
    super.init(engine, 'pac-man');
    this.highscore = this.storage.get('highscore', 0);

    this.particles = new ParticleSystem(60);
    this.startTime = Date.now();

    this._restart();
  }

  _restart() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.status = 'playing';
    this.frightenedTimer = 0;
    this.dotsTotal = 0;
    this.dotsEaten = 0;

    // Maze — spawn en (10, 18): limpiamos el punto de la posición inicial
    this.maze = MAZE_DATA.map((row) => [...row]);
    this.maze[18][10] = 0;
    this.dotsTotal = this.maze.flat().filter((v) => v === 1 || v === 2).length;
    this.player = { x: 10 * TILE + TILE / 2, y: 18 * TILE + TILE / 2, dir: 0, nextDir: 0, mouth: 0, speed: PLAYER_SPEED };
    // 0=right, 1=down, 2=left, 3=up
    this.dirVectors = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];

    // Ghosts
    this.ghosts = [];
    const ghostSpawns = [
      { x: 9, y: 9 },  // Blinky (rojo) - fuera de la casa
      { x: 10, y: 12 }, // Pinky (rosa) - en casa
      { x: 9, y: 12 },  // Inky (cyan) - en casa
      { x: 11, y: 12 }, // Clyde (naranja) - en casa
    ];

    for (let i = 0; i < 4; i++) {
      this.ghosts.push({
        x: ghostSpawns[i].x * TILE + TILE / 2,
        y: ghostSpawns[i].y * TILE + TILE / 2,
        startX: ghostSpawns[i].x * TILE + TILE / 2,
        startY: ghostSpawns[i].y * TILE + TILE / 2,
        dir: 0,
        color: GHOST_COLORS[i],
        name: GHOST_NAMES[i],
        frightened: false,
        eaten: false,
        inHouse: i > 0,
        houseTimer: i * 2 + 1,
        speed: GHOST_SPEED,
        scatterTarget: [
          { x: 0, y: 0 },
          { x: COLS * TILE, y: 0 },
          { x: COLS * TILE, y: ROWS * TILE },
          { x: 0, y: ROWS * TILE },
        ][i],
        mode: 'scatter', // 'scatter' | 'chase' | 'frightened'
        modeTimer: 7 - i,
      });
    }

    this.modeSwitchTimer = 7;
    this.modeIndex = 0;
  }

  _tileX(px) { return Math.floor(px / TILE); }
  _tileY(py) { return Math.floor(py / TILE); }
  _centerX(tx) { return tx * TILE + TILE / 2; }
  _centerY(ty) { return ty * TILE + TILE / 2; }

  _isWalkable(tx, ty) {
    if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return false;
    const cell = this.maze[ty][tx];
    return cell !== 3;
  }

  _isInHouse(tx, ty) {
    return this.maze[ty] && this.maze[ty][tx] === 5;
  }

  // ── Update ─────────────────────────────────────────────────────────────

  update(dt) {
    if (this.status !== 'playing') {
      if (this.input.wasPressed('Space') || this.input.mouse.clickedThisFrame || this.input.wasPressed('GamepadA') || this.input.wasPressed('GamepadStart')) {
        this._restart();
      }

      return;
    }

    this._updatePlayer(dt);
    this._updateGhosts(dt);
    this._checkDots();
    this._checkCollisions();
    this.particles.update(dt);

    // Frightened timer
    if (this.frightenedTimer > 0) {
      this.frightenedTimer -= dt;
      if (this.frightenedTimer <= 0) {
        for (const g of this.ghosts) {
          g.frightened = false;
          g.mode = 'chase';
          g.speed = GHOST_SPEED;
        }
      }
    }

    // Mode switching (scatter/chase)
    this.modeSwitchTimer -= dt;
    if (this.modeSwitchTimer <= 0) {
      this.modeIndex++;
      const intervals = [7, 20, 7, 20, 5, 20, 5, 1000];
      this.modeSwitchTimer = intervals[this.modeIndex % intervals.length];
      const newMode = this.modeIndex % 2 === 0 ? 'scatter' : 'chase';
      for (const g of this.ghosts) {
        if (!g.frightened && !g.eaten) g.mode = newMode;
      }
    }

    this.input.endFrame();
  }

  _updatePlayer(dt) {
    const p = this.player;

    // Input
    if (this.input.isDown('ArrowRight') || this.input.isDown('KeyD') || this.input.isDown('GamepadRight') || this.input.isDown('GamepadLStickRight')) p.nextDir = 0;
    else if (this.input.isDown('ArrowDown') || this.input.isDown('KeyS') || this.input.isDown('GamepadDown') || this.input.isDown('GamepadLStickDown')) p.nextDir = 1;
    else if (this.input.isDown('ArrowLeft') || this.input.isDown('KeyA') || this.input.isDown('GamepadLeft') || this.input.isDown('GamepadLStickLeft')) p.nextDir = 2;
    else if (this.input.isDown('ArrowUp') || this.input.isDown('KeyW') || this.input.isDown('GamepadUp') || this.input.isDown('GamepadLStickUp')) p.nextDir = 3;

    // Intentar cambiar dirección
    const nd = this.dirVectors[p.nextDir];
    const ntx = this._tileX(p.x + nd.x * 6);
    const nty = this._tileY(p.y + nd.y * 6);
    if (this._isWalkable(ntx, nty) && !this._isInHouse(ntx, nty)) {
      p.dir = p.nextDir;
    }

    // Mover
    const d = this.dirVectors[p.dir];
    const ntx2 = this._tileX(p.x + d.x * (PLAYER_RADIUS + 1));
    const nty2 = this._tileY(p.y + d.y * (PLAYER_RADIUS + 1));
    if (this._isWalkable(ntx2, nty2) && !this._isInHouse(ntx2, nty2)) {
      p.x += d.x * p.speed * dt;
      p.y += d.y * p.speed * dt;
    }

    // Wrap-around (túnel en fila 11)
    if (p.x < 0) p.x = COLS * TILE - 1;
    if (p.x >= COLS * TILE) p.x = 1;

    // Animación boca
    p.mouth += dt * 8;
  }

  _updateGhosts(dt) {
    for (const g of this.ghosts) {
      // Salida de la casa
      if (g.inHouse) {
        g.houseTimer -= dt;
        if (g.houseTimer <= 0) {
          g.inHouse = false;
          g.x = this._centerX(10);
          g.y = this._centerY(10); // fila 10: celda vacía (0), no pared
        }
        continue;
      }

      if (g.eaten) {
        // Volver a la casa
        const hx = this._centerX(10);
        const hy = this._centerY(12);
        const dx = hx - g.x;
        const dy = hy - g.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 4) {
          g.eaten = false;
          g.frightened = false;
          g.mode = 'chase';
          g.speed = GHOST_SPEED;
          g.x = g.startX;
          g.y = g.startY;
          g.inHouse = true;
          g.houseTimer = 1;
        } else {
          g.x += (dx / dist) * GHOST_SPEED * 3 * dt;
          g.y += (dy / dist) * GHOST_SPEED * 3 * dt;
        }
        continue;
      }

      // Elegir dirección (IA)
      const speed = g.frightened ? FRIGHTENED_SPEED : g.speed;
      const atIntersection = this._atIntersection(g);
      if (atIntersection) g.dir = this._ghostAI(g);

      // Mover
      const d = this.dirVectors[g.dir];
      const ntx = this._tileX(g.x + d.x * (GHOST_RADIUS + 1));
      const nty = this._tileY(g.y + d.y * (GHOST_RADIUS + 1));
      if (this._isWalkable(ntx, nty)) {
        g.x += d.x * speed * dt;
        g.y += d.y * speed * dt;
      } else {
        g.dir = (g.dir + 2) % 4; // rebotar
      }

      // Wrap-around
      if (g.x < -TILE / 2) g.x = COLS * TILE + TILE / 2;
      if (g.x > COLS * TILE + TILE / 2) g.x = -TILE / 2;
    }
  }

  _atIntersection(g) {
    const tx = this._tileX(g.x);
    const ty = this._tileY(g.y);
    const cx = this._centerX(tx);
    const cy = this._centerY(ty);
    return Math.abs(g.x - cx) < 3 && Math.abs(g.y - cy) < 3;
  }

  _ghostAI(g) {
    const p = this.player;
    let target;

    if (g.frightened) {
      // Huir aleatoriamente
      return Math.floor(Math.random() * 4);
    }

    if (g.eaten) {
      target = { x: this._centerX(10), y: this._centerY(12) };
    } else if (g.mode === 'scatter') {
      target = g.scatterTarget;
    } else {
      // Chase mode - AI específica por fantasma
      switch (g.name) {
        case 'blinky': // Persigue directamente
          target = { x: p.x, y: p.y };
          break;
        case 'pinky': // Apunta 4 tiles delante del jugador
          const pd = this.dirVectors[p.dir];
          target = { x: p.x + pd.x * 4 * TILE, y: p.y + pd.y * 4 * TILE };
          break;
        case 'inky': // Usa la posicion de Blinky para calcular
          const blinky = this.ghosts[0];
          const aheadX = p.x + this.dirVectors[p.dir].x * 2 * TILE;
          const aheadY = p.y + this.dirVectors[p.dir].y * 2 * TILE;
          target = { x: aheadX + (aheadX - blinky.x), y: aheadY + (aheadY - blinky.y) };
          break;
        case 'clyde': // Persigue cuando está lejos, huye cuando está cerca
          const dist = Math.hypot(g.x - p.x, g.y - p.y);
          if (dist > 8 * TILE) target = { x: p.x, y: p.y };
          else target = g.scatterTarget;
          break;
        default: target = { x: p.x, y: p.y };
      }
    }

    if (!target) target = { x: p.x, y: p.y };

    // Elegir la dirección que más se acerque al target
    let bestDir = g.dir;
    let bestDist = Infinity;
    const reverse = (g.dir + 2) % 4; // no puede revertir

    for (let d = 0; d < 4; d++) {
      if (d === reverse) continue;
      const dv = this.dirVectors[d];
      const ntx = this._tileX(g.x + dv.x * (GHOST_RADIUS + 1));
      const nty = this._tileY(g.y + dv.y * (GHOST_RADIUS + 1));
      if (!this._isWalkable(ntx, nty)) continue;
      const nx = g.x + dv.x * 10;
      const ny = g.y + dv.y * 10;
      const dist = Math.hypot(nx - target.x, ny - target.y);
      if (dist < bestDist) { bestDist = dist; bestDir = d; }
    }

    return bestDir;
  }

  _checkDots() {
    const tx = this._tileX(this.player.x);
    const ty = this._tileY(this.player.y);
    const cell = this.maze[ty] && this.maze[ty][tx];
    if (cell === 1) {
      this.maze[ty][tx] = 0;
      this.score += 10;
      this.dotsEaten++;
      AudioManager.sfx({ type: 'select', volume: 0.1 });
    } else if (cell === 2) {
      this.maze[ty][tx] = 0;
      this.score += 50;
      this.dotsEaten++;
      this._activateFrightened();
      AudioManager.sfx({ type: 'powerup', volume: 0.35 });
      HapticManager.vibrate('powerup');
    }

    // Nivel completado
    if (this.dotsEaten >= this.dotsTotal) {
      this.level++;
      AudioManager.sfx({ type: 'pacman_chomp', volume: 0.5 });
      this.maze = MAZE_DATA.map((row) => [...row]);
      this.dotsTotal = this.maze.flat().filter((v) => v === 1 || v === 2).length;
      this.dotsEaten = 0;
      this._resetPositions();
    }
  }

  _activateFrightened() {
    this.frightenedTimer = FRIGHTENED_DURATION;
    for (const g of this.ghosts) {
      if (!g.eaten) {
        g.frightened = true;
        g.mode = 'frightened';
        g.speed = FRIGHTENED_SPEED;
        // Invertir dirección
        g.dir = (g.dir + 2) % 4;
      }
    }
  }

  _checkCollisions() {
    for (const g of this.ghosts) {
      if (g.inHouse || g.eaten) continue;
      const dx = this.player.x - g.x;
      const dy = this.player.y - g.y;
      if (Math.abs(dx) < PLAYER_RADIUS + GHOST_RADIUS && Math.abs(dy) < PLAYER_RADIUS + GHOST_RADIUS) {
        if (g.frightened) {
          // Comer fantasma
          g.eaten = true;
          const points = 200 * (this.ghosts.filter((gh) => gh.eaten).length + 1);
          this.score += points;
          AudioManager.sfx({ type: 'pacman_chomp', volume: 0.4 });
          HapticManager.vibrate('powerup');
          this.particles.burst(g.x, g.y, COLORS.frightened, 10, 80);
        } else {
          // Morir
          this._playerDeath();
          return;
        }
      }
    }
  }

  _playerDeath() {
    this.lives -= 1;
    AudioManager.sfx({ type: 'pacman_death', volume: 0.5 });
    HapticManager.vibrate('explosion');
    if (this.lives <= 0) {
      this._endGame();
    } else {
      this._resetPositions();
    }
  }

  _resetPositions() {
    // Limpiar el punto en la posición de spawn (evita comerlo automáticamente)
    this.maze[18][10] = 0;
    this.dotsTotal = this.maze.flat().filter((v) => v === 1 || v === 2).length;
    this.player.x = this._centerX(10);
    this.player.y = this._centerY(18);
    this.player.dir = 0;
    this.player.nextDir = 0;
    for (const g of this.ghosts) {
      g.x = g.startX;
      g.y = g.startY;
      g.dir = 0;
      g.frightened = false;
      g.eaten = false;
      g.inHouse = g.name !== 'blinky';
      g.houseTimer = (GHOST_NAMES.indexOf(g.name)) * 2 + 1;
      g.mode = 'scatter';
      g.speed = GHOST_SPEED;
    }
    this.frightenedTimer = 0;
    this.modeSwitchTimer = 7;
    this.modeIndex = 0;
  }

  _endGame() {
    this.status = 'game-over';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('pac-man', this.score, false, duration);
    if (this.score > 0) ProgressionManager.checkAchievement('pac-man', 'first-dot');
    if (this.ghostsEaten > 0) ProgressionManager.checkAchievement('pac-man', 'ghost-hunter');
    if (this.score >= 10000) ProgressionManager.checkAchievement('pac-man', 'pac-legend');
  }

  // ── Render ─────────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.width, this.height);

    this._renderMaze(ctx);
    this._renderDots(ctx);
    this._renderGhosts(ctx);
    this._renderPlayer(ctx);
    this.particles.render(ctx);      this.renderHUD(ctx);

    if (this.status !== 'playing') {
      renderOverlay(ctx, { width: this.width, height: this.height, score: this.score });
    }
  }

  _renderMaze(ctx) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.maze[r][c];
        if (cell !== 3 && cell !== 4 && cell !== 5) continue;
        const x = MAP_X + c * TILE;
        const y = MAP_Y + r * TILE;

        ctx.fillStyle = cell === 5 ? '#111' : COLORS.wall;
        ctx.fillRect(x, y, TILE, TILE);

        // Bordes de pared
        if (cell === 3) {
          ctx.strokeStyle = COLORS.wallBorder;
          ctx.lineWidth = 2;
          if (r === 0 || this.maze[r - 1][c] !== 3) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + TILE, y); ctx.stroke(); }
          if (r === ROWS - 1 || this.maze[r + 1][c] !== 3) { ctx.beginPath(); ctx.moveTo(x, y + TILE); ctx.lineTo(x + TILE, y + TILE); ctx.stroke(); }
          if (c === 0 || this.maze[r][c - 1] !== 3) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + TILE); ctx.stroke(); }
          if (c === COLS - 1 || this.maze[r][c + 1] !== 3) { ctx.beginPath(); ctx.moveTo(x + TILE, y); ctx.lineTo(x + TILE, y + TILE); ctx.stroke(); }
        }
      }
    }
  }

  _renderDots(ctx) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.maze[r][c];
        const x = MAP_X + c * TILE + TILE / 2;
        const y = MAP_Y + r * TILE + TILE / 2;
        if (cell === 1) {
          ctx.fillStyle = COLORS.dot;
          ctx.beginPath();
          ctx.arc(x, y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (cell === 2) {
          ctx.fillStyle = COLORS.powerPellet;
          ctx.beginPath();
          ctx.arc(x, y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  _renderPlayer(ctx) {
    const p = this.player;
    const angle = p.dir * Math.PI / 2;
    const mouthAngle = 0.2 + Math.sin(p.mouth) * 0.25;

    ctx.save();
    ctx.translate(MAP_X + p.x, MAP_Y + p.y);
    ctx.rotate(angle);

    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, PLAYER_RADIUS, mouthAngle, Math.PI * 2 - mouthAngle);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _renderGhosts(ctx) {
    for (const g of this.ghosts) {
      if (g.inHouse) continue;
      const x = MAP_X + g.x;
      const y = MAP_Y + g.y;

      ctx.save();
      ctx.translate(x, y);

      let color;
      if (g.eaten) color = COLORS.eaten;
      else if (g.frightened) color = this.frightenedTimer < 2 && Math.floor(this.frightenedTimer * 4) % 2 === 0 ? '#fff' : COLORS.frightened;
      else color = COLORS.ghost[g.color] || '#ff0000';

      if (g.eaten) {
        // Solo ojos
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-3, -2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(3, -2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-3 + 1, -2, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(3 + 1, -2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Cuerpo de fantasma
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, -2, GHOST_RADIUS, Math.PI, 0, false);
        ctx.lineTo(GHOST_RADIUS, GHOST_RADIUS - 2);
        for (let i = 0; i < 3; i++) {
          ctx.quadraticCurveTo(
            GHOST_RADIUS * (0.6 - i * 0.3),
            GHOST_RADIUS + 4,
            GHOST_RADIUS * (0.3 - i * 0.3),
            GHOST_RADIUS - 2
          );
        }
        ctx.closePath();
        ctx.fill();

        // Ojos
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-3, -3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(3, -3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = g.frightened ? '#ff0000' : '#000';
        const look = this.dirVectors[g.dir];
        ctx.beginPath();
        ctx.arc(-3 + look.x * 1.5, -3 + look.y * 1.5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(3 + look.x * 1.5, -3 + look.y * 1.5, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  renderHUD(ctx) {
    super.renderHUD(ctx);
  }

}


