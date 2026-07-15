import { GameBase } from '../../engine/GameBase.js';
import { Tilemap } from '../../engine/Tilemap.js';
import { Camera } from '../../engine/Camera.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { aabbIntersects, clamp } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

const TILE = 32;
const GRAVITY = 1400;
const MAX_FALL = 900;
const WALK_SPEED = 200;
const RUN_SPEED = 340;
const JUMP_VEL = -520;
const COYOTE = 0.08;
const JUMP_CUT = 0.45;

const POWER = { SMALL: 0, BIG: 1, FIRE: 2, STAR: 3 };

// Solid tiles: only ground (#). Bricks (B) and question blocks (?) are handled manually.
const SOLID_TILES = new Set([1]);
const TILE_LEGEND = { '#': 1, 'B': 2, '?': 3, 'P': 4 };

const LEVELS = [
  // ── World 1: Tutorial ───────────────────────────────────────────────
  {
    rows: [
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '............C.......................................',
      '....?......?#......................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '....g..............g..................g.......K....G',
      '###########....###########....###########....#######',
      '###########....###########....###########....#######',
      '###########....###########....###########....#######',
    ],
  },
  // ── World 2: Fire flower + more obstacles ───────────────────────────
  {
    rows: [
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '.........................C..........................',
      '.......................?#??.........................',
      '.........?.........................................',
      '..................................................',
      '.......BBB.............................F.............',
      '..................................................',
      '..C...........C...................C.............C..G',
      '..?................................?..................',
      '..................................................',
      '..................................................',
      '..g...............g........g...........K......K.....',
      '########....#######....########....#######....######',
      '########....#######....########....#######....######',
      '########....#######....########....#######....######',
    ],
  },
  // ── World 3: Castle ─────────────────────────────────────────────────
  {
    rows: [
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '..................................................',
      '........C.....CC.....C.....CC.....C.....CC.........G',
      '.......?#?...?F?....?#?...?#??....?#....?#..........',
      '..................................................',
      '.....BBB.....BBB.....BBB.....BBB.....BBB....BBB...',
      '..................................................',
      '..................................................',
      '..................................................',
      '...............C..........C..........C............',
      '..............?#.........?#.........?.............',
      '..................................................',
      '.g...K...g...K...g...K...g...K...g...K...g...K....',
      '########....#######....########....#######....####',
      '########....#######....########....#######....####',
      '########....#######....########....#######....####',
    ],
  },
];

const MAX_LEVEL = LEVELS.length;

export class MarioLike extends GameBase {
  init(engine) {
    super.init(engine, 'mario-like');
    this.highscore = this.storage.get('highscore', 0);
    this.currentLevel = this.storage.get('savedLevel', 1);
    this._loadLevel();
  }

  _defaultBindings() {
    return {
      moveLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      jump:      ['Space', 'ArrowUp', 'KeyW', 'GamepadA'],
      run:       ['ShiftLeft', 'ShiftRight', 'GamepadX'],
      restart:   ['Space', 'GamepadStart', 'GamepadA'],
      next:      ['Space', 'GamepadA', 'GamepadStart'],
      fire:      ['Space', 'GamepadB', 'GamepadR1'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    this.camera.resize(width, height);
  }

  _loadLevel() {
    const idx = Math.min(this.currentLevel - 1, LEVELS.length - 1);
    const lv = LEVELS[idx];
    const data = Tilemap.parseAscii(lv.rows, TILE_LEGEND);
    // Only ground (#) is solid. Bricks/Question blocks handled manually.
    this.tilemap = new Tilemap({ data, tileSize: TILE, solidTiles: SOLID_TILES });
    this.camera = new Camera(this.width, this.height);

    this.goalRect = null;
    this.enemies = [];
    this.coins = [];
    this.powerups = [];
    this.fireballs = [];
    this.particles = [];
    this.blocks = []; // bricks + question blocks (handled manually)

    for (let row = 0; row < lv.rows.length; row++) {
      for (let col = 0; col < lv.rows[row].length; col++) {
        const ch = lv.rows[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (ch === 'G') this.goalRect = { x, y, width: TILE, height: TILE * 2 };
        else if (ch === 'g') this.enemies.push({ x, y, width: 28, height: 28, vx: -50, vy: 0, alive: true, type: 'goomba', squished: false, squishTimer: 0, onGround: false });
        else if (ch === 'K') this.enemies.push({ x, y, width: 28, height: 32, vx: -40, vy: 0, alive: true, type: 'koopa', shell: false, shellVx: 0, onGround: false });
        else if (ch === 'C') this.coins.push({ x, y, width: 16, height: 16, collected: false });
        else if (ch === 'M') this.powerups.push({ x, y, width: 28, height: 28, vx: 60, vy: 0, type: 'mushroom', active: true });
        else if (ch === 'F') this.powerups.push({ x, y, width: 28, height: 28, vx: 0, vy: 0, type: 'flower', active: true });
        else if (ch === '?') this.blocks.push({ x, y, width: TILE, height: TILE, type: 'question', hit: false, contents: row > 6 ? 'mushroom' : 'coin' });
        else if (ch === 'B') this.blocks.push({ x, y, width: TILE, height: TILE, type: 'brick', hit: false });
      }
    }

    this.spawnPoint = { x: TILE * 2, y: TILE * 12 };
    this._restart();
  }

  _restart() {
    this.player = {
      x: this.spawnPoint.x, y: this.spawnPoint.y,
      width: 20, height: 28,
      vx: 0, vy: 0,
      onGround: false, facing: 1,
      jumpCut: false,
      power: POWER.SMALL,
      invincible: 0, starTimer: 0,
    };
    this.coyoteTimer = 0;
    this.lives = 3;
    this.score = 0;
    this.coinCount = 0;
    this.elapsed = 0;
    this.status = 'playing';
    this.phase = 'playing';
    this.startTime = Date.now();

    for (const coin of this.coins) coin.collected = false;
    for (const b of this.blocks) b.hit = false;
    for (const pu of this.powerups) pu.active = true;
    this.fireballs = [];
  }

  // ── Update ────────────────────────────────────────────────────────────

  update(dt) {
    if (this.phase === 'level-complete') {
      if (this.input.wasActionPressed('next') || this.input.mouse.clickedThisFrame) this._nextLevel();
      return;
    }
    if (this.handleRestartInput()) return;

    this.elapsed += dt;
    this._updatePlayer(dt);
    this._updateEnemies(dt);
    this._updatePowerups(dt);
    this._updateFireballs(dt);
    this._updateParticles(dt);
    this._checkCollisions(dt);
    this._updateCamera();
  }

  _updatePlayer(dt) {
    const left = this.input.isActionDown('moveLeft');
    const right = this.input.isActionDown('moveRight');
    const running = this.input.isActionDown('run');
    const speed = running ? RUN_SPEED : WALK_SPEED;

    if (left && !right) { this.player.vx = -speed; this.player.facing = -1; }
    else if (right && !left) { this.player.vx = speed; this.player.facing = 1; }
    else this.player.vx = 0;

    this.player.vy = Math.min(this.player.vy + GRAVITY * dt, MAX_FALL);

    if (this.input.wasActionPressed('jump') && (this.player.onGround || this.coyoteTimer > 0)) {
      this.player.vy = JUMP_VEL;
      this.coyoteTimer = 0;
      this.player.jumpCut = false;
      AudioManager.sfx({ type: 'platformer_jump', volume: 0.25 });
    }

    if (!this.input.isActionDown('jump') && this.player.vy < 0 && !this.player.jumpCut) {
      this.player.vy *= JUMP_CUT;
      this.player.jumpCut = true;
    }

    // Fire flower shooting
    if (this.player.power >= POWER.FIRE && this.input.wasActionPressed('fire')) {
      this._shootFireball();
    }

    // Star invincibility
    if (this.player.starTimer > 0) this.player.starTimer -= dt;

    const result = this.tilemap.resolveAABB(this.player, this.player.vx, this.player.vy, dt);
    if (result.onGround || result.onCeiling) this.player.vy = 0;
    this.player.onGround = result.onGround;
    this.player.invincible = Math.max(0, this.player.invincible - dt);

    this.coyoteTimer = result.onGround ? COYOTE : Math.max(0, this.coyoteTimer - dt);
    this.player.x = clamp(this.player.x, 0, this.tilemap.pixelWidth - this.player.width);
    this.player.height = this.player.power >= POWER.BIG ? 32 : 28;

    // Block collision from below (head bump) — check AFTER tilemap resolves
    this._checkBlockHeadBump();

    if (this.player.y > this.tilemap.pixelHeight + 50) this._loseLife();
  }

  /** Detect player head bumping blocks from below. */
  _checkBlockHeadBump() {
    const pTop = this.player.y;
    for (const block of this.blocks) {
      if (block.hit) continue;
      // Player must be moving upward and head within 4px of block bottom
      if (this.player.vy >= 0) continue;
      const headY = pTop;
      const blockBottom = block.y + block.height;
      if (headY > blockBottom || headY + 8 < blockBottom) continue;
      if (this.player.x + this.player.width < block.x || this.player.x > block.x + block.width) continue;

      this._hitBlock(block);
      return; // Only hit one block per frame
    }
  }

  _hitBlock(block) {
    block.hit = true;
    this.player.vy = 80; // Bounce down

    if (block.type === 'question') {
      if (block.contents === 'coin') {
        this.coinCount++;
        this.score += 200;
        this._spawnParticles(block.x + TILE / 2, block.y, '#ffd700', 6);
        AudioManager.sfx({ type: 'coin', volume: 0.3 });
      } else {
        this._spawnPowerup(block.x, block.y - TILE, 'mushroom');
        AudioManager.sfx({ type: 'powerup', volume: 0.4 });
      }
    } else if (block.type === 'brick' && this.player.power >= POWER.BIG) {
      this._spawnParticles(block.x + TILE / 2, block.y + TILE / 2, '#c87820', 8);
      this.score += 50;
      AudioManager.sfx({ type: 'break', volume: 0.3 });
      block.y = -999; // Destroy
    }
  }

  _updateEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) {
        if (e.squished) e.squishTimer -= dt;
        continue;
      }

      // Gravity for enemies
      e.vy = Math.min(e.vy + GRAVITY * dt, MAX_FALL);

      if (e.type === 'goomba') {
        const prevX = e.x;
        e.x += e.vx * dt;
        const result = this.tilemap.resolveAABB(e, e.vx, 0, dt); // X collision only by manual check
        // Simpler: reverse if blocked by tile or at level edge
        if (Math.abs(e.x - prevX) < 1) { e.vx *= -1; e.x = prevX; }

        e.y += e.vy * dt;
        const yResult = this.tilemap.resolveAABB(e, 0, e.vy, dt);
        if (yResult.onGround || yResult.onCeiling) e.vy = 0;
        e.onGround = yResult.onGround;

      } else if (e.type === 'koopa') {
        if (e.shell) {
          e.x += e.shellVx * dt;
          const prevX = e.x;
          const result = this.tilemap.resolveAABB(e, e.shellVx, 0, dt);
          if (Math.abs(e.x - prevX) < 1) { e.shellVx *= -1; }
          e.y += e.vy * dt;
          const yResult = this.tilemap.resolveAABB(e, 0, e.vy, dt);
          if (yResult.onGround || yResult.onCeiling) e.vy = 0;
        } else {
          const prevX = e.x;
          e.x += e.vx * dt;
          const xResult = this.tilemap.resolveAABB(e, e.vx, 0, dt);
          if (Math.abs(e.x - prevX) < 1) { e.vx *= -1; }

          e.y += e.vy * dt;
          const yResult = this.tilemap.resolveAABB(e, 0, e.vy, dt);
          if (yResult.onGround || yResult.onCeiling) e.vy = 0;
        }
      }
    }
    this.enemies = this.enemies.filter(e => e.alive || e.squished);
  }

  _updatePowerups(dt) {
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      if (pu.type === 'mushroom') {
        pu.vy = Math.min(pu.vy + 600 * dt, 400);
        this.tilemap.resolveAABB(pu, pu.vx, pu.vy, dt);
      }
    }
  }

  _shootFireball() {
    const dir = this.player.facing;
    this.fireballs.push({
      x: this.player.x + (dir > 0 ? this.player.width : 0),
      y: this.player.y + 10,
      vx: dir * 400,
      vy: -50,
      radius: 5,
      life: 1.5,
      bounce: 0,
    });
    AudioManager.sfx({ type: 'shoot', volume: 0.2 });
  }

  _updateFireballs(dt) {
    for (const fb of this.fireballs) {
      fb.x += fb.vx * dt;
      fb.vy += 400 * dt;
      fb.y += fb.vy * dt;
      fb.life -= dt;

      // Bounce on ground
      const tileCol = Math.floor((fb.x + fb.radius) / TILE);
      const tileRow = Math.floor((fb.y + fb.radius) / TILE);
      if (this.tilemap.isSolidTile(this.tilemap.tileAt(tileCol, tileRow))) {
        fb.vy = -200;
        fb.bounce++;
        if (fb.bounce > 3) fb.life = 0;
      }

      // Kill enemies hit by fireball
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = fb.x - (e.x + e.width / 2);
        const dy = fb.y - (e.y + e.height / 2);
        if (Math.abs(dx) < fb.radius + e.width / 2 && Math.abs(dy) < fb.radius + e.height / 2) {
          this._killEnemy(e);
          fb.life = 0;
          break;
        }
      }
    }
    this.fireballs = this.fireballs.filter(fb => fb.life > 0);
  }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 600 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  _updateCamera() {
    if (this.tilemap.pixelWidth > this.width) {
      this.camera.x = clamp(this.player.x - this.width * 0.3, 0, this.tilemap.pixelWidth - this.width);
    } else {
      this.camera.x = 0;
    }
    this.camera.y = 0;
  }

  // ── Collisions ────────────────────────────────────────────────────────

  _checkCollisions(dt) {
    if (this.player.invincible > 0) return;

    // Player vs goal
    if (this.goalRect && aabbIntersects(this.player, this.goalRect)) {
      this._win();
      return;
    }

    // Player vs floating coins
    for (const coin of this.coins) {
      if (coin.collected) continue;
      const coinBox = { x: coin.x, y: coin.y, width: coin.width, height: coin.height };
      if (aabbIntersects(this.player, coinBox)) {
        coin.collected = true;
        this.coinCount++;
        this.score += 100;
        this._spawnParticles(coin.x + 8, coin.y + 8, '#ffd700', 4);
        AudioManager.sfx({ type: 'coin', volume: 0.3 });
      }
    }

    // Player vs enemies
    const pBox = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const eBox = { x: e.x, y: e.y, width: e.width, height: e.height };
      if (!aabbIntersects(pBox, eBox)) continue;

      // Star invincibility kills enemies
      if (this.player.starTimer > 0) { this._killEnemy(e); continue; }

      // Stomp (player falling onto enemy)
      if (this.player.vy > 0 && this.player.y + this.player.height - e.y < 16) {
        if (e.type === 'koopa' && !e.shell) {
          e.shell = true; e.shellVx = 0; e.height = 26;
        } else if (e.shell && e.shellVx === 0) {
          e.shellVx = this.player.x < e.x ? 300 : -300;
        } else {
          this._killEnemy(e);
        }
        this.player.vy = -300;
        this.score += 100;
        AudioManager.sfx({ type: 'stomp', volume: 0.3 });
        HapticManager.vibrate('hit');
        continue;
      }

      // Shell hitting player
      if (e.shell && e.shellVx !== 0) { this._playerHit(); break; }
      this._playerHit();
      break;
    }

    // Player vs powerups
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      const puBox = { x: pu.x, y: pu.y, width: pu.width, height: pu.height };
      if (!aabbIntersects(pBox, puBox)) continue;
      pu.active = false;
      this._spawnParticles(pu.x + 14, pu.y + 14, '#ffb454', 6);
      if (pu.type === 'mushroom') {
        if (this.player.power === POWER.SMALL) this.player.power = POWER.BIG;
        else this.score += 1000;
      } else {
        this.player.power = POWER.FIRE;
      }
      this.score += 500;
      this.player.invincible = 0.5;
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      HapticManager.vibrate('powerup');
    }
  }

  _killEnemy(e) {
    e.alive = false;
    e.squished = true;
    e.squishTimer = 0.5;
    this._spawnParticles(e.x + 14, e.y + 14, '#ff6b4a', 5);
    this.score += 100;
  }

  _spawnPowerup(x, y, type) {
    this.powerups.push({ x, y, width: 28, height: 28, vx: 60, vy: -200, type, active: true });
  }

  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 150,
        vy: -Math.random() * 200 - 50,
        life: 0.4 + Math.random() * 0.3,
        color,
      });
    }
  }

  _playerHit() {
    if (this.player.invincible > 0 || this.player.starTimer > 0) return;
    if (this.player.power > POWER.SMALL) {
      this.player.power--;
      this.player.invincible = 1.5;
      AudioManager.sfx({ type: 'hit', volume: 0.4 });
      HapticManager.vibrate('hit');
    } else {
      this._loseLife();
    }
  }

  _loseLife() {
    this.lives--;
    AudioManager.sfx({ type: 'explosion', volume: 0.4 });
    HapticManager.vibrate('explosion');
    if (this.lives <= 0) this._endGame(false);
    else {
      this.player.x = this.spawnPoint.x;
      this.player.y = this.spawnPoint.y;
      this.player.vx = 0; this.player.vy = 0;
      this.player.power = POWER.SMALL;
    }
  }

  _win() {
    this.score += 1000;
    if (this.currentLevel >= MAX_LEVEL) this._endGame(true);
    else {
      this.phase = 'level-complete';
      AudioManager.sfx({ type: 'powerup', volume: 0.5 });
      HapticManager.vibrate('powerup');
    }
  }

  _nextLevel() {
    this.currentLevel++;
    this.storage.set('savedLevel', this.currentLevel);
    this._loadLevel();
  }

  _endGame(won) {
    this.status = won ? 'won' : 'lost';
    this.phase = won ? 'won' : 'lost';
    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('mario-like', this.score, won, duration);
    ProgressionManager.checkAchievement('mario-like', won ? 'castle-clear' : 'world-clear');
    AudioManager.sfx({ type: won ? 'powerup' : 'explosion', volume: 0.5 });
  }

  // ── Render ────────────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    this.camera.apply(ctx);

    const vp = { x: this.camera.x, y: this.camera.y, width: this.camera.width, height: this.camera.height };
    this.tilemap.render(ctx, vp, { 1: '#c87820' });

    // Render blocks (bricks + question blocks)
    for (const block of this.blocks) {
      if (block.y < -100) continue;
      if (block.type === 'question') {
        ctx.fillStyle = block.hit ? '#7c5c20' : '#f0b040';
        ctx.fillRect(block.x, block.y, TILE, TILE);
        if (!block.hit) {
          ctx.fillStyle = '#ffd700';
          ctx.font = '20px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', block.x + TILE / 2, block.y + TILE / 2 + 2);
        }
      } else {
        ctx.fillStyle = block.hit ? '#7c5c20' : '#c87820';
        ctx.fillRect(block.x, block.y, TILE, TILE);
        ctx.strokeStyle = '#a06018';
        ctx.lineWidth = 1;
        ctx.strokeRect(block.x, block.y, TILE, TILE);
      }
    }

    // Goal flag
    if (this.goalRect) {
      ctx.fillStyle = '#48a848';
      ctx.fillRect(this.goalRect.x, this.goalRect.y, this.goalRect.width, this.goalRect.height);
      ctx.fillStyle = '#ffd700';
      ctx.font = '24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('🏁', this.goalRect.x + TILE / 2, this.goalRect.y + TILE / 2 + 8);
    }

    // Coins (floating)
    for (const coin of this.coins) {
      if (coin.collected) continue;
      const pulse = Math.sin(Date.now() * 0.005 + coin.x) * 2;
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(coin.x + 8, coin.y + 8 + pulse, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8a0';
      ctx.beginPath();
      ctx.arc(coin.x + 6, coin.y + 6 + pulse, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Powerups
    for (const pu of this.powerups) {
      if (!pu.active) continue;
      ctx.fillStyle = pu.type === 'mushroom' ? '#c84848' : '#ff6b4a';
      ctx.beginPath();
      ctx.arc(pu.x + 14, pu.y + 14, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pu.type === 'mushroom' ? '🍄' : '🔥', pu.x + 14, pu.y + 15);
    }

    // Fireballs
    for (const fb of this.fireballs) {
      ctx.fillStyle = '#ff6b4a';
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, fb.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(fb.x - 2, fb.y - 2, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) {
        if (e.squished && e.squishTimer > 0) {
          ctx.fillStyle = '#c84848';
          ctx.fillRect(e.x, e.y + e.height - 8, e.width, 8);
        }
        continue;
      }
      if (e.type === 'goomba') {
        ctx.fillStyle = '#c87820';
        ctx.beginPath();
        ctx.arc(e.x + e.width / 2, e.y + e.height / 2, e.width / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(e.x + 8, e.y + 10, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(e.x + e.width - 8, e.y + 10, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'koopa') {
        if (e.shell) {
          ctx.fillStyle = '#48a848';
          ctx.beginPath();
          ctx.arc(e.x + e.width / 2, e.y + e.height / 2, e.width / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#48a848';
          ctx.fillRect(e.x, e.y, e.width, e.height * 0.6);
          ctx.fillStyle = '#f0b040';
          ctx.fillRect(e.x, e.y + e.height * 0.6, e.width, e.height * 0.4);
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(e.x + 8, e.y + 8, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(e.x + e.width - 8, e.y + 8, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.7);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    }
    ctx.globalAlpha = 1;

    // Player (with invincibility blink — skip body only, not entire render)
    const shouldDrawPlayer = !(this.player.invincible > 0 && Math.floor(this.player.invincible * 10) % 2 === 0);
    if (shouldDrawPlayer) {
      const px = this.player.x, py = this.player.y, pw = this.player.width, ph = this.player.height;
      const isStar = this.player.starTimer > 0;
      const bodyColor = isStar
        ? ['#ffd700', '#ff6b4a', '#48a848'][Math.floor(Date.now() / 200) % 3]
        : this.player.power >= POWER.FIRE ? '#ff6b4a'
        : this.player.power >= POWER.BIG ? '#c84848' : '#e7edf3';

      ctx.fillStyle = bodyColor;
      ctx.fillRect(px + 2, py + 2, pw - 4, ph - 8);
      ctx.beginPath();
      ctx.arc(px + pw / 2, py + 6, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c84848';
      ctx.fillRect(px + 1, py - 2, pw - 2, 6);
      ctx.fillStyle = '#3858c8';
      ctx.fillRect(px + 1, py + ph - 8, pw - 2, 8);
      ctx.fillStyle = '#000';
      ctx.fillRect(px + pw / 2 + this.player.facing * 3 - 2, py + 4, 3, 4);
    }

    ctx.restore();

    // ── HUD (screen coordinates) ─────────────────────────────────────────
    setupHUDContext(ctx);
    ctx.fillText(t('mario.score', { n: this.score }), 10, 10);
    ctx.fillText(t('mario.coins', { n: this.coinCount }), 10, 28);
    ctx.fillText(t('mario.world', { n: this.currentLevel }), this.width / 2 - 40, 10);
    ctx.fillText(t('mario.lives', { n: this.lives }), this.width - 100, 10);
    ctx.fillText(t('game.record', { n: this.highscore }), this.width / 2 - 40, 28);

    if (this.player.power >= POWER.FIRE) {
      ctx.fillStyle = '#ff6b4a';
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('🔥 FIRE', this.width - 10, 28);
      ctx.textAlign = 'left';
    } else if (this.player.power >= POWER.BIG) {
      ctx.fillStyle = '#48a848';
      ctx.font = '12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('🍄 BIG', this.width - 10, 28);
      ctx.textAlign = 'left';
    }

    // ── Overlays ─────────────────────────────────────────────────────────
    if (this.phase === 'level-complete') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('game.levelComplete'), this.width / 2, this.height / 2 - 20);
      ctx.fillStyle = '#e7edf3';
      ctx.font = '16px monospace';
      ctx.fillText(t('game.continue'), this.width / 2, this.height / 2 + 15);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    if (this.phase === 'won' || this.phase === 'lost') {
      renderOverlay(ctx, { width: this.width, height: this.height, score: this.score });
    }
  }

}
