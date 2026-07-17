/**
 * Metroid-like (Exploración no lineal) — Refactorizado
 *
 * Versión modular: constants, tilemap-data, entities, powerups, ai, render.
 * Este archivo orquesta el juego importando desde los submódulos.
 *
 * Mecánica: 12 salas interconectadas, 7 power-ups, 3 jefes,
 * 5 tipos de enemigos, minimapa y progresión no lineal.
 */
import { GameBase } from '../../engine/GameBase.js';
import { Tilemap } from '../../engine/Tilemap.js';
import { Camera } from '../../engine/Camera.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { aabbIntersects, clamp } from '../../engine/CollisionUtils.js';
import { ParticleSystem } from '../../engine/ParticleSystem.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';
import {
  TILE, T, COLS, ROWS, ROOM_W, ROOM_H, SOLID,
  GRAVITY, MAX_FALL, WALK_SPEED, RUN_SPEED,
  JUMP_VEL, HIGH_JUMP_VEL, SPACE_JUMP_VEL, COYOTE, ABILITY, LEGEND,
} from './constants.js';
import { ROOMS } from './tilemap-data.js';
import {
  createPlayer, spawnEnemy, spawnBoss, spawnMiniBoss, spawnBoss2,
} from './entities.js';
import { collectItem, takeDamage, updateBomb, updatePopups } from './powerups.js';
import {
  updateEnemies, updateBullets, updateBossBullets,
  updateBoss, updateMiniBoss, updateBoss2, checkBossBulletsCollision,
} from './ai.js';
import {
  renderBackground, renderTilemap, renderDoors, renderEnemies,
  renderItems, renderBullets, renderBossBullets, renderPlayer,
  renderHUD, renderPopups, renderBomb,
  renderBoss, renderMiniBoss, renderBoss2,
} from './render.js';

export class MetroidLike extends GameBase {

  init(engine) {
    super.init(engine, 'metroid-like');
    this.highscore = this.storage.get('highscore', 0);
    this.startTime = Date.now();
    this.abilities = 0;
    this.hp = 50;
    this.maxHp = 50;
    this.missileCount = 0;
    this.maxMissiles = 0;
    this.bombCount = 0;
    this.bossDefeated = this.storage.get('bossDefeated', false);
    this.miniBossDefeated = this.storage.get('miniBossDefeated', false);
    this.particles = new ParticleSystem(100);
    this.explored = { 0: true };
    this._loadRoom(0);
  }

  _defaultBindings() {
    return {
      moveLeft:  ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      jump:      ['Space', 'ArrowUp', 'KeyW', 'GamepadA'],
      run:       ['ShiftLeft', 'ShiftRight', 'GamepadX'],
      shoot:     ['KeyJ', 'GamepadB'],
      bomb:      ['KeyK', 'GamepadY'],
      morph:     ['ArrowDown', 'KeyS', 'GamepadDown', 'GamepadLStickDown'],
      restart:   ['Space', 'GamepadStart', 'GamepadA'],
      map:       ['KeyM', 'GamepadBack'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
    if (this.camera) this.camera.resize(width, height);
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  emitParticles(x, y, color, count) {
    this.particles.emitBurst(x, y, color, count);
  }

  showAbilityPopup(key) {
    this.abilityPopup = t(key);
    this.abilityPopupTimer = 2;
  }

  showItemPopup(text) {
    this.itemPopup = text;
    this.itemPopupTimer = text.includes('HP') ? 1.5 : 2;
  }

  // ─── Carga de salas ──────────────────────────────────────────────

  _loadRoom(roomId) {
    this.roomId = roomId;
    this.explored[roomId] = true;
    const room = ROOMS[roomId];
    const data = Tilemap.parseAscii(room.rows, LEGEND);
    this.tilemap = new Tilemap({ data, tileSize: TILE, solidTiles: SOLID });

    this.enemies = [];
    this.items = [];
    this.doors = { N: false, S: false, E: false, W: false };
    this.missileDoors = { N: false, S: false, E: false, W: false };
    this.bossPresent = false;
    this.miniBossPresent = false;
    this.boss2Present = false;

    for (let row = 0; row < room.rows.length; row++) {
      for (let col = 0; col < room.rows[row].length; col++) {
        const ch = room.rows[row][col];
        const x = col * TILE;
        const y = row * TILE;
        if (ch === 'm') this.enemies.push(spawnEnemy('zoomer', x, y));
        else if (ch === 'r') this.enemies.push(spawnEnemy('rinka', x, y));
        else if (ch === 'e') this.enemies.push(spawnEnemy('reo', x, y));
        else if (ch === 'f') this.enemies.push(spawnEnemy('zebbo', x, y));
        else if (ch === 'B') { this.bossPresent = true; this.boss = spawnBoss(); }
        else if (ch === 'k') { this.miniBossPresent = true; this.miniBoss = spawnMiniBoss(); }
        else {
          const itemMap = {
            'M': 'missile', 'b': 'bomb', 'p': 'morph', 'j': 'spacejump',
            'h': 'hp', 's': 'speedboost', 'a': 'screwattack', 'i': 'highjump',
            'E': 'energytank',
          };
          const iconMap = {
            'M': 'M', 'b': 'B', 'p': 'O', 'j': 'J', 'h': '+', 's': 'S',
            'a': 'A', 'i': 'H', 'E': 'E',
          };
          const labelMap = {
            'M': 'metroid.missile', 'b': 'metroid.bomb', 'p': 'metroid.morphBall',
            'j': 'metroid.spaceJump', 'h': 'HP+10', 's': 'metroid.speedBoost',
            'a': 'metroid.screwAttack', 'i': 'metroid.highJump', 'E': 'metroid.energyTank',
          };
          const type = itemMap[ch];
          if (type) {
            this.items.push({
              x, y, type, collected: false,
              icon: iconMap[ch], label: labelMap[ch].startsWith('metroid.') ? t(labelMap[ch]) : labelMap[ch],
            });
          }
        }
      }
    }

    if (room.N >= 0) this.doors.N = true;
    if (room.S >= 0) this.doors.S = true;
    if (room.E >= 0) this.doors.E = true;
    if (room.W >= 0) this.doors.W = true;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (this.tilemap.tileAt(col, row) === T.MISSILE_DOOR) {
          if (col === 0) this.missileDoors.W = true;
          if (col === COLS - 1) this.missileDoors.E = true;
          if (row === 0) this.missileDoors.N = true;
          if (row === ROWS - 1) this.missileDoors.S = true;
        }
      }
    }

    this.camera = new Camera(this.width, this.height);
    this.player = createPlayer();
    this.coyoteTimer = 0;
    this.bullets = [];
    this.bossBullets = [];
    this.abilityPopup = null;
    this.abilityPopupTimer = 0;
    this.itemPopup = null;
    this.itemPopupTimer = 0;
    this.showMap = false;
    this.speedTimer = 0;
    this.bombPlaced = null;
    this.bombTimer = 0;
    this.fadeTransition = 0;
    this.transitionTarget = null;
    this.enterDir = '';
    this.score = 0;
    this.phase = 'playing';
    this.screwEffectTimer = 0;
  }

  // ─── Update ──────────────────────────────────────────────────────

  update(dt) {
    if (this.phase === 'won' || this.phase === 'lost') {
      if (this.handleRestartInput()) return;
      return;
    }

    if (this.transitionTarget !== null) {
      this.fadeTransition += dt * 3;
      if (this.fadeTransition >= 1) {
        this._loadRoom(this.transitionTarget);
        this.transitionTarget = null;
        this.fadeTransition = 0;
        const room = ROOMS[this.roomId];
        if (this.enterDir === 'N') this.player.y = 20;
        else if (this.enterDir === 'S') this.player.y = ROOM_H - TILE * 2 - 30;
        else if (this.enterDir === 'E') this.player.x = ROOM_W - TILE * 2 - 20;
        else if (this.enterDir === 'W') this.player.x = 20;
      }
      return;
    }

    this._updatePlayer(dt);
    this._updateAIModules(dt);
    this._updateBombAndPopups(dt);
    this._resolveCombat(dt);
    this._updateCamera();
    this._checkRoomTransition();
    this.particles.update(dt);
    if (this.screwEffectTimer > 0) this.screwEffectTimer -= dt;
  }

  _updatePlayer(dt) {
    const p = this.player;
    if (p.invincible > 0) p.invincible -= dt;

    const left = this.input.isActionDown('moveLeft');
    const right = this.input.isActionDown('moveRight');
    const running = this.input.isActionDown('run');
    const hasSpeed = !!(this.abilities & ABILITY.SPEED_BOOST);
    const speed = (running && hasSpeed) ? RUN_SPEED : WALK_SPEED;

    const morphDown = this.input.isActionDown('morph');
    if (morphDown && p.onGround && (this.abilities & ABILITY.MORPH_BALL)) {
      p.morphed = true; p.height = 14;
    } else if (!morphDown) {
      p.morphed = false; p.height = 28;
    }

    if (left && !right) { p.vx = -speed; p.facing = -1; }
    else if (right && !left) { p.vx = speed; p.facing = 1; }
    else p.vx *= 0.8;
    if (p.morphed) p.vx *= 0.7;

    // Ice / Spikes
    const feetCol = Math.floor((p.x + p.width / 2) / TILE);
    const feetRow = Math.floor((p.y + p.height + 2) / TILE);
    const onIce = this.tilemap.tileAt(feetCol, feetRow) === T.ICE;
    if (onIce && p.onGround && !left && !right) p.vx *= 0.96;

    const spikeCol = Math.floor((p.x + p.width / 2) / TILE);
    const spikeRow = Math.floor((p.y + p.height) / TILE);
    if (this.tilemap.tileAt(spikeCol, spikeRow) === T.SPIKES && p.onGround) {
      if (takeDamage(this, 1)) this._endGame(false);
    }

    p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);

    const canJump = p.onGround || this.coyoteTimer > 0;
    const canSpaceJump = (this.abilities & ABILITY.SPACE_JUMP) && !p.onGround && p.vy > 0;
    if (this.input.wasActionPressed('jump')) {
      const jumpVel = (this.abilities & ABILITY.HIGH_JUMP) ? HIGH_JUMP_VEL : JUMP_VEL;
      if (canJump) {
        p.vy = jumpVel; this.coyoteTimer = 0;
        AudioManager.sfx({ type: 'platformer_jump', volume: 0.2 });
      } else if (canSpaceJump) {
        p.vy = SPACE_JUMP_VEL;
        AudioManager.sfx({ type: 'platformer_jump', volume: 0.15 });
      }
    }

    if (this.input.wasActionPressed('shoot') && (this.abilities & ABILITY.MISSILES) && this.missileCount > 0) {
      this.bullets.push({
        x: p.x + (p.facing > 0 ? p.width : 0), y: p.y + 10,
        vx: p.facing * 350, vy: 0, radius: 4, damage: 10, life: 1.5, isMissile: true,
      });
      this.missileCount--;
      AudioManager.sfx({ type: 'shoot', volume: 0.3 });
    }

    if (this.input.wasActionPressed('bomb') && (this.abilities & ABILITY.BOMBS) && this.bombCount > 0 && !this.bombPlaced) {
      this.bombPlaced = { x: p.x + 4, y: p.y + (p.morphed ? 2 : p.height - 10), timer: 1.5 };
      this.bombCount--;
      AudioManager.sfx({ type: 'select', volume: 0.2 });
    }

    const result = this.tilemap.resolveAABB(p, p.vx, p.vy, dt);
    if (result.onGround || result.onCeiling) p.vy = 0;
    p.onGround = result.onGround;
    this.coyoteTimer = result.onGround ? COYOTE : Math.max(0, this.coyoteTimer - dt);

    p.x = clamp(p.x, 0, ROOM_W - p.width);
    p.y = clamp(p.y, 0, ROOM_H - p.height);

    if (p.y > ROOM_H + 50) { if (takeDamage(this, 999)) this._endGame(false); }
  }

  _updateAIModules(dt) {
    const { newBullets } = updateEnemies(this.enemies, this.player, dt);
    if (newBullets) this.bossBullets.push(...newBullets);
    this.enemies = this.enemies.filter(e => e.alive);

    const bulletResult = updateBullets(this.bullets, this.tilemap, T, this.particles, dt);
    this.bullets = bulletResult.bullets;
    this.score += bulletResult.scoreAdd;

    this.bossBullets = updateBossBullets(this.bossBullets, dt);

    updateBoss(this.boss, this.player, this.bossBullets, dt, (dmg) => takeDamage(this, dmg));
    updateMiniBoss(this.miniBoss, this.player, this.bossBullets, dt, (dmg) => takeDamage(this, dmg));
    updateBoss2(this.boss2, this.player, this.bossBullets, dt, (dmg) => takeDamage(this, dmg));

    checkBossBulletsCollision(this.bossBullets, this.player, (dmg) => {
      if (takeDamage(this, dmg)) this._endGame(false);
    });
  }

  _updateBombAndPopups(dt) {
    updateBomb(this, dt);
    updatePopups(this, dt);
  }

  _resolveCombat(dt) {
    if (this.player.invincible > 0) return;
    const pBox = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };
    const screwAttack = !!(this.abilities & ABILITY.SCREW_ATTACK);

    // Bullets vs enemies
    for (const b of this.bullets) {
      if (!b.isMissile) continue;
      const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (aabbIntersects(bBox, { x: e.x, y: e.y, width: e.width, height: e.height })) {
          b.life = 0; e.hp -= b.damage;
          this.emitParticles(e.x + e.width / 2, e.y + e.height / 2, '#ffb454', 4);
          if (e.hp <= 0) { e.alive = false; this.emitParticles(e.x + e.width / 2, e.y + e.height / 2, '#ff6b4a', 10); this.score += 50; }
          break;
        }
      }
    }

    // Enemies vs player
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (!aabbIntersects(pBox, { x: e.x, y: e.y, width: e.width, height: e.height })) continue;
      if (screwAttack && this.player.vy < 0) {
        e.alive = false; this.player.vy = -300;
        this.emitParticles(e.x + e.width / 2, e.y + e.height / 2, '#4a9eff', 8);
        this.score += 100; this.screwEffectTimer = 0.3;
        continue;
      }
      if (this.player.vy > 0 && this.player.y + this.player.height - e.y < 16 && (e.type === 'zoomer' || e.type === 'zebbo')) {
        e.alive = false; this.player.vy = -250;
        this.emitParticles(e.x + e.width / 2, e.y + e.height / 2, '#ff6b4a', 6);
        this.score += 100;
      } else {
        if (takeDamage(this, e.damage || 1)) this._endGame(false);
      }
      break;
    }

    // Items collection
    for (const item of this.items) {
      if (item.collected) continue;
      if (aabbIntersects(pBox, { x: item.x, y: item.y, width: TILE, height: TILE })) {
        item.collected = true;
        collectItem(item, this);
      }
    }

    // Bosses collision + bullets
    this._resolveBossCombat(this.boss, 'bossPresent');
    this._resolveBossCombat(this.miniBoss, 'miniBossPresent');
    this._resolveBossCombat(this.boss2, 'boss2Present');
  }

  _resolveBossCombat(boss, flag) {
    if (!this[flag] || !boss || !boss.alive) return;
    const pBox = { x: this.player.x, y: this.player.y, width: this.player.width, height: this.player.height };
    if (aabbIntersects(pBox, boss) && this.player.invincible <= 0) {
      if (takeDamage(this, 1)) this._endGame(false);
    }
    for (const b of this.bullets) {
      if (!b.isMissile) continue;
      const bBox = { x: b.x - b.radius, y: b.y - b.radius, width: b.radius * 2, height: b.radius * 2 };
      if (aabbIntersects(bBox, boss)) {
        b.life = 0;
        boss.hp -= b.damage;
        this.emitParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, '#ffb454', 6);
        if (boss.hp <= 0) {
          boss.alive = false;
          this.emitParticles(boss.x + boss.width / 2, boss.y + boss.height / 2, '#ffd700', 30);
          AudioManager.sfx({ type: 'powerup', volume: 0.6 });
          HapticManager.vibrate('powerup');
          this.score += 2000;
          this._onBossDefeated(boss);
        }
      }
    }
  }

  _onBossDefeated(boss) {
    if (boss === this.boss || boss === this.boss2) {
      this.bossDefeated = true;
      this.storage.set('bossDefeated', true);
      this._endGame(true);
    } else if (boss === this.miniBoss) {
      this.miniBossDefeated = true;
      this.storage.set('miniBossDefeated', true);
      this.showAbilityPopup('metroid.miniBossDefeated');
      this.score += 1000;
      this.items.push({ x: boss.x + 20, y: boss.y + 30, type: 'energytank', collected: false, icon: 'E', label: t('metroid.energyTank') });
      this.items.push({ x: boss.x + 60, y: boss.y + 30, type: 'bomb', collected: false, icon: 'B', label: t('metroid.bomb') });
    }
  }

  _updateCamera() {
    this.camera.x = clamp(this.player.x - this.width * 0.35, 0, Math.max(0, ROOM_W - this.width));
    this.camera.y = 0;
  }

  // ─── Room Transitions ────────────────────────────────────────────

  _checkRoomTransition() {
    if (this.transitionTarget !== null) return;
    const room = ROOMS[this.roomId];
    const hasMissiles = !!(this.abilities & ABILITY.MISSILES);
    const margin = 8;

    const tryTransition = (dir, cond, doorField, edge) => {
      if (!cond) return false;
      const md = this.missileDoors[doorField];
      if (md && !hasMissiles) {
        if (doorField === 'N') this.player.y = 5;
        else if (doorField === 'S') this.player.y = ROOM_H - 10;
        else if (doorField === 'E') this.player.x = ROOM_W - 10;
        else this.player.x = 5;
        this.showAbilityPopup('metroid.needMissiles');
        return true;
      }
      const target = room[dir];
      if (target >= 0) { this.transitionTarget = target; this.enterDir = this._oppositeDir(dir); return true; }
      return false;
    };

    if (this.doors.N && this.player.y < -margin && this.player.x > COLS * TILE * 0.2 && this.player.x < COLS * TILE * 0.8) {
      tryTransition('N', true, 'N') || this._clampPlayer();
    } else if (this.doors.S && this.player.y > ROOM_H - margin) {
      tryTransition('S', true, 'S') || this._clampPlayer();
    } else if (this.doors.E && this.player.x > ROOM_W - margin) {
      tryTransition('E', true, 'E') || this._clampPlayer();
    } else if (this.doors.W && this.player.x < -margin) {
      tryTransition('W', true, 'W') || this._clampPlayer();
    } else {
      this._clampPlayer();
    }
  }

  _oppositeDir(dir) {
    return { N: 'S', S: 'N', E: 'W', W: 'E' }[dir] || '';
  }

  _clampPlayer() {
    this.player.x = clamp(this.player.x, 0, ROOM_W - this.player.width);
    this.player.y = clamp(this.player.y, 0, ROOM_H - this.player.height);
  }

  _endGame(won) {
    this.phase = won ? 'won' : 'lost';
    const score = this.score + this.hp * 10 + this.missileCount * 5 + this.bombCount * 3;
    if (score > this.highscore) {
      this.highscore = score;
      this.storage.set('highscore', this.highscore);
    }
    const duration = (Date.now() - this.startTime) / 1000;
    ProgressionManager.recordGamePlay('metroid-like', score, won, duration);
    if (won) ProgressionManager.checkAchievement('metroid-like', 'boss-slayer');
    if (this.abilities & ABILITY.SPACE_JUMP) ProgressionManager.checkAchievement('metroid-like', 'explorer');
    if (this.abilities & ABILITY.BOMBS) ProgressionManager.checkAchievement('metroid-like', 'demolition');
    if (this.abilities & ABILITY.SCREW_ATTACK) ProgressionManager.checkAchievement('metroid-like', 'screw-attack');
  }

  // ─── Render ──────────────────────────────────────────────────────

  render(ctx) {
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, this.width, this.height);

    if (this.transitionTarget !== null) {
      ctx.fillStyle = '#000';
      ctx.globalAlpha = this.fadeTransition;
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.globalAlpha = 1;
      return;
    }

    ctx.save();
    this.camera.apply(ctx);

    renderBackground(ctx, this.roomId, this.bossPresent, this.miniBossPresent, this.boss2Present);
    renderTilemap(ctx, this.tilemap, this.camera);
    renderEnemies(ctx, this.enemies);
    renderItems(ctx, this.items);
    renderBomb(ctx, this.bombPlaced);
    renderPlayer(ctx, this.player, this.screwEffectTimer);
    renderBullets(ctx, this.bullets);
    renderBossBullets(ctx, this.bossBullets);
    if (this.bossPresent) renderBoss(ctx, this.boss);
    if (this.miniBossPresent) renderMiniBoss(ctx, this.miniBoss);
    if (this.boss2Present) renderBoss2(ctx, this.boss2);

    ctx.restore();

    renderDoors(ctx, this.camera, this.width, this.height, this.doors, this.missileDoors,
      this.bossPresent || this.boss2Present);
    renderHUD(ctx, this.width, this.height, this);
    renderPopups(ctx, this.width, this.height, this.abilityPopup, this.abilityPopupTimer,
      this.itemPopup, this.itemPopupTimer);

    if (this.phase === 'won' || this.phase === 'lost') {
      renderOverlay(ctx, {
        width: this.width, height: this.height,
        title: this.phase === 'won' ? t('metroid.victory') : t('metroid.gameOver'),
        score: this.score + this.hp * 10 + this.missileCount * 5 + this.bombCount * 3,
      });
    }
  }
}
