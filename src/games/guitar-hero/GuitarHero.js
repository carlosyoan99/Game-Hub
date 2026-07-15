/**
 * Guitar Hero-like (Ritmo)
 * Nivel 4 — Juego de ritmo con notas que caen y combo
 *
 * Mecánica: 5 carriles (A S D F Espacio), notas que caen,
 * zona de golpe en la parte inferior, combo multiplicador,
 * canciones procedurales, modo práctica.
 */
import { GameBase } from '../../engine/GameBase.js';
import { AudioManager } from '../../engine/AudioManager.js';
import { HapticManager } from '../../engine/HapticManager.js';
import { clamp } from '../../engine/CollisionUtils.js';
import { t } from '../../engine/i18n.js';
import { renderOverlay, setupHUDContext } from '../../engine/GameUI.js';
import { ProgressionManager } from '../../engine/ProgressionManager.js';

// ─── Configuración ──────────────────────────────────────────────────

const LANE_COUNT = 5;
const LANE_KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'Space'];
const LANE_NAMES = ['A', 'S', 'D', 'F', '␣'];
const LANE_COLORS = ['#e74c3c', '#4a9eff', '#3a9a5a', '#ffb454', '#c848d8'];
const HIT_ZONE_Y_RATIO = 0.85;
const NOTE_SPEED = 250; // px per second
const NOTE_HEIGHT = 24;
const HIT_WINDOW_GOOD = 0.15; // seconds
const HIT_WINDOW_PERFECT = 0.05; // seconds
const MAX_MISS_DISTANCE = 0.25; // seconds past hit zone = auto miss

const SCORE_PERFECT = 300;
const SCORE_GOOD = 100;

const COMBO_MULTIPLIERS = [
  { threshold: 0, mult: 1 },
  { threshold: 10, mult: 2 },
  { threshold: 20, mult: 3 },
  { threshold: 35, mult: 4 },
  { threshold: 50, mult: 5 },
];

const HP_DECAY_RATE = 2; // per second
const HP_HIT_GAIN = 8;
const HP_PERFECT_GAIN = 12;
const HP_MISS_LOSS = 15;
const MAX_HP = 100;

// ─── Definiciones de canciones ──────────────────────────────────────

const SONG_DEFS = [
  {
    id: 'easy-rider',
    name: 'Easy Rider',
    labelKey: 'guitarhero.easy',
    difficulty: 0,
    bpm: 100,
    length: 30,
    density: 0.30,
    useChords: false,
    useFast: false,
    color: '#3a9a5a',
    desc: '♪♪♫',
    style: 'Rock',
  },
  {
    id: 'midnight-road',
    name: 'Midnight Road',
    labelKey: 'guitarhero.medium',
    difficulty: 1,
    bpm: 120,
    length: 35,
    density: 0.45,
    useChords: true,
    useFast: false,
    color: '#ffb454',
    desc: '♪♪♪♫',
    style: 'Blues',
  },
  {
    id: 'inferno-blaze',
    name: 'Inferno Blaze',
    labelKey: 'guitarhero.hard',
    difficulty: 2,
    bpm: 140,
    length: 40,
    density: 0.60,
    useChords: true,
    useFast: true,
    color: '#e74c3c',
    desc: '♪♪♪♪♫',
    style: 'Metal',
  },
  {
    id: 'neon-nights',
    name: 'Neon Nights',
    labelKey: 'guitarhero.neon',
    difficulty: 0,
    bpm: 110,
    length: 32,
    density: 0.35,
    useChords: false,
    useFast: false,
    color: '#38b8e8',
    desc: '♫♪♪♫',
    style: 'Funk',
  },
  {
    id: 'ocean-waves',
    name: 'Ocean Waves',
    labelKey: 'guitarhero.ocean',
    difficulty: 0,
    bpm: 80,
    length: 28,
    density: 0.25,
    useChords: false,
    useFast: false,
    color: '#48a848',
    desc: '♪ ♪ ♪ ♫',
    style: 'Ballad',
  },
  {
    id: 'pixel-storm',
    name: 'Pixel Storm',
    labelKey: 'guitarhero.pixel',
    difficulty: 1,
    bpm: 130,
    length: 36,
    density: 0.50,
    useChords: true,
    useFast: true,
    color: '#c848d8',
    desc: '♪♪♪♫♪♪',
    style: 'Chiptune',
  },
  {
    id: 'thunder-strike',
    name: 'Thunder Strike',
    labelKey: 'guitarhero.thunder',
    difficulty: 2,
    bpm: 160,
    length: 38,
    density: 0.65,
    useChords: true,
    useFast: true,
    color: '#ff4d4d',
    desc: '♪♪♪♪♫♪♪',
    style: 'Thrash',
  },
];

// ─── Generación procedural de canciones ────────────────────────────

function generateSongFromDef(def) {
  const { bpm, length, density, useChords, useFast } = def;
  const beatsPerSecond = bpm / 60;
  const totalBeats = Math.floor(length * beatsPerSecond);
  const notes = [];

  let lastBeat = -2;
  for (let beat = 0; beat < totalBeats; beat++) {
    if (Math.random() > density) continue;
    if (beat - lastBeat < 0.5) continue;

    // Single note or chord
    if (useChords && Math.random() < 0.2 + def.difficulty * 0.05) {
      const lane1 = Math.floor(Math.random() * LANE_COUNT);
      let lane2;
      do { lane2 = Math.floor(Math.random() * LANE_COUNT); } while (lane2 === lane1);
      notes.push({ lane: lane1, beat, chord: false });
      notes.push({ lane: lane2, beat, chord: true });
      lastBeat = beat;
    } else {
      const lane = Math.floor(Math.random() * LANE_COUNT);
      notes.push({ lane, beat, chord: false });
      lastBeat = beat;
    }

    if (useFast && Math.random() < 0.15 && beat + 0.5 < totalBeats) {
      const lane2 = Math.floor(Math.random() * LANE_COUNT);
      notes.push({ lane: lane2, beat: beat + 0.5, chord: false });
    }
  }

  notes.sort((a, b) => a.beat - b.beat);

  return {
    ...def,
    notes,
    totalNotes: notes.length,
  };
}

// ─── Clase principal ────────────────────────────────────────────────

export class GuitarHero extends GameBase {
  init(engine) {
    super.init(engine, 'guitar-hero');
    this.highscore = this.storage.get('highscore', 0);
    this.startTime = Date.now();
    this.phase = 'select';
    this.selectedSong = 0;
    this.practiceMode = false;
    this.practiceSpeed = 0.75;
    this.notesHit = 0;
    this.totalNotes = 0;
    this._startSelect();
  }

  _defaultBindings() {
    return {
      lane0: ['KeyA', 'GamepadLeft'],
      lane1: ['KeyS', 'GamepadDown'],
      lane2: ['KeyD', 'GamepadUp'],
      lane3: ['KeyF', 'GamepadX'],
      lane4: ['Space', 'GamepadA'],
      pause: ['KeyP', 'Escape', 'GamepadStart'],
      select: ['Space', 'Enter', 'GamepadA'],
      next:   ['Space', 'Enter', 'GamepadA'],
      restart:['Space', 'GamepadStart', 'GamepadA'],
      left:   ['ArrowLeft', 'KeyA', 'GamepadLeft'],
      right:  ['ArrowRight', 'KeyD', 'GamepadRight'],
      up:     ['ArrowUp', 'KeyW', 'GamepadUp'],
      down:   ['ArrowDown', 'KeyS', 'GamepadDown'],
    };
  }

  handleResize(width, height) {
    super.handleResize(width, height);
  }

  _startSelect() {
    this.phase = 'select';
    this.selectBlink = 0;
    this.practiceMode = false;
    this.practiceSpeed = 0.75;
    this.selectedSong = 0;
  }

  _startGame() {
    const def = SONG_DEFS[this.selectedSong] || SONG_DEFS[0];
    this.song = generateSongFromDef(def);
    this.isPractice = this.practiceMode;
    this.speedMult = this.isPractice ? this.practiceSpeed : 1.0;
    this.totalNotes = this.song.totalNotes;
    this.notesHit = 0;
    this.perfectCount = 0;
    this.goodCount = 0;
    this.missCount = 0;
    this.maxCombo = 0;
    this.score = 0;
    this.combo = 0;
    this.hp = MAX_HP;
    this.noteIndex = 0;
    this.songTime = -2;
    this.activeNotes = [];
    this.particles = [];
    this.stars = [];
    this.streakParticles = [];
    this.hitEffects = [];
    this.concertLights = [];
    this.beatTimer = 0;
    this.beatFlash = 0;
    this.equalizer = Array.from({ length: 12 }, () => Math.random() * 20 + 10);
    this.judgmentText = null;
    this.judgmentTimer = 0;
    this.starPower = 0;
    this.starPowerActive = false;
    this.starPowerTimer = 0;
    this.paused = false;
    this.status = 'playing';
    this.phase = 'intro';
    this.songStartTime = Date.now();
  }

  // ── Update ────────────────────────────────────────────────────────

  update(dt) {
    if (this.phase === 'select') {
      this._updateSelect(dt);
      return;
    }

    if (this.handleRestartInput()) return;

    if (this.paused) {
      if (this.input.wasActionPressed('pause') || this.input.wasPressed('KeyP')) {
        this.paused = false;
      }
      return;
    }

    if (this.phase === 'intro') {
      this.songTime += dt;
      if (this.songTime >= 0) {
        this.phase = 'playing';
        this.songStartTime = Date.now();
      }
      return;
    }

    // Playing — apply speed multiplier for practice
    const effectiveDt = this.speedMult ? dt * this.speedMult : dt;
    this.songTime += effectiveDt;

    // Star power timer
    if (this.starPowerActive) {
      this.starPowerTimer -= effectiveDt;
      if (this.starPowerTimer <= 0) {
        this.starPowerActive = false;
      }
    }

    // Spawn new notes
    while (this.noteIndex < this.song.notes.length) {
      const note = this.song.notes[this.noteIndex];
      const noteTime = note.beat / (this.song.bpm / 60);
      if (noteTime > this.songTime + 1.5) break;

      this.activeNotes.push({
        lane: note.lane,
        targetTime: noteTime,
        y: 0,
        hit: false,
        missed: false,
        missEffectSpawned: false,
        chord: note.chord || false,
      });
      this.noteIndex++;
    }

    // Update active note Y positions
    for (const n of this.activeNotes) {
      if (n.hit || n.missed) continue;
      const scrollTime = (this.height * 0.85) / NOTE_SPEED;
      const hitY = this.height * HIT_ZONE_Y_RATIO;
      const noteTime = n.targetTime;
      const spawnY = -NOTE_HEIGHT;
      n.y = spawnY + ((this.songTime - (noteTime - scrollTime)) / scrollTime) * (hitY - spawnY);

      if (this.songTime > n.targetTime + MAX_MISS_DISTANCE) {
        n.missed = true;
        this._onMiss();
      }
    }

    this.activeNotes = this.activeNotes.filter(n => !n.missed || this.songTime - n.targetTime < 0.5);

    // Input handling
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      if (this.input.wasActionPressed(`lane${lane}`)) {
        this._hitLane(lane);
      }
    }

    if (this.input.wasActionPressed('pause') || this.input.wasPressed('KeyP')) {
      this.paused = true;
    }

    // HP decay (disabled in practice mode)
    if (!this.isPractice) {
      this.hp -= HP_DECAY_RATE * effectiveDt;
    }
    this.hp = clamp(this.hp, 0, MAX_HP);

    // Star power accumulation
    if (!this.starPowerActive) {
      this.starPower = Math.min(100, this.starPower + 0.5 * effectiveDt);
    }

    if (this.input.wasActionPressed('lane4') && this.combo >= 5 && this.starPower >= 50) {
      this._activateStarPower();
    }

    // Beat sync
    this.beatTimer += effectiveDt;
    const beatInterval = 60 / this.song.bpm;
    if (this.beatTimer >= beatInterval) {
      this.beatTimer -= beatInterval;
      this.beatFlash = 1;
      for (let i = 0; i < this.equalizer.length; i++) {
        this.equalizer[i] = Math.random() * 30 + 15;
      }
    }
    this.beatFlash = Math.max(0, this.beatFlash - effectiveDt * 3);

    // Update particles
    this._updateParticles(effectiveDt);
    this._updateStars(effectiveDt);
    this._updateStreaks(effectiveDt);

    if (this.judgmentTimer > 0) {
      this.judgmentTimer -= effectiveDt;
      if (this.judgmentTimer <= 0) this.judgmentText = null;
    }

    // Check win/lose: in practice mode, transition to result state
    if (!this.isPractice && this.hp <= 0) {
      this._endGame(false);
    } else if (this.songTime > this.song.length) {
      if (this.isPractice) {
        this.phase = 'prac-result';
        this.status = 'playing';
      } else {
        this._endGame(true);
      }
    }

    // Handle restart in practice result state
    if (this.phase === 'prac-result') {
      if (this.input.wasActionPressed('select') || this.input.mouse.clickedThisFrame || this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
        this._restart();
      }
      return;
    }
  }

  _updateSelect(dt) {
    this.selectBlink += dt;

    // Total cards: 7 songs + 1 practice card = 8 cards
    const totalCards = SONG_DEFS.length + 1;
    const cardW = 144;
    const gap = 10;
    const totalW = totalCards * cardW + (totalCards - 1) * gap;
    const startX = Math.max(10, (this.width - totalW) / 2);

    if (this.input.wasActionPressed('left') || this.input.wasPressed('ArrowLeft') || this.input.wasActionPressed('lane0')) {
      this.selectedSong = (this.selectedSong - 1 + totalCards) % totalCards;
      AudioManager.sfx({ type: 'select', volume: 0.2 });
    }
    if (this.input.wasActionPressed('right') || this.input.wasPressed('ArrowRight') || this.input.wasActionPressed('lane2')) {
      this.selectedSong = (this.selectedSong + 1) % totalCards;
      AudioManager.sfx({ type: 'select', volume: 0.2 });
    }

    // Practice mode speed toggle with up/down when practice card selected
    if (this.selectedSong === SONG_DEFS.length) {
      if (this.input.wasPressed('ArrowUp') || this.input.wasActionPressed('up') || this.input.wasPressed('KeyW')) {
        this.practiceSpeed = this.practiceSpeed >= 1.0 ? 0.5 : this.practiceSpeed + 0.25;
        AudioManager.sfx({ type: 'select', volume: 0.15 });
      }
      if (this.input.wasPressed('ArrowDown') || this.input.wasActionPressed('down') || this.input.wasPressed('KeyS')) {
        this.practiceSpeed = this.practiceSpeed <= 0.5 ? 1.0 : this.practiceSpeed - 0.25;
        AudioManager.sfx({ type: 'select', volume: 0.15 });
      }
    }

    // Click detection for cards
    if (this.input.mouse.clickedThisFrame) {
      const startY = 90;
      const cardH = 220;
      for (let i = 0; i < totalCards; i++) {
        const x = startX + i * (cardW + gap);
        const mx = this.input.mouse.x;
        const my = this.input.mouse.y;
        if (mx >= x && mx <= x + cardW && my >= startY && my <= startY + cardH) {
          this.selectedSong = i;
          this._startGameFromSelect();
          return;
        }
      }
    }

    if (this.input.wasActionPressed('select') || this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
      this._startGameFromSelect();
    }
  }

  _startGameFromSelect() {
    this.practiceMode = this.selectedSong >= SONG_DEFS.length;
    AudioManager.sfx({ type: 'powerup', volume: 0.3 });
    this._startGame();
  }

  _hitLane(lane) {
    let best = null;
    let bestDist = Infinity;
    for (const n of this.activeNotes) {
      if (n.hit || n.missed) continue;
      if (n.lane !== lane) continue;
      const dist = Math.abs(this.songTime - n.targetTime);
      if (dist < bestDist && dist < MAX_MISS_DISTANCE) {
        bestDist = dist;
        best = n;
      }
    }

    if (!best) return;

    best.hit = true;
    this.notesHit++;
    const hx = this._getLaneX(lane);
    const hy = this.height * HIT_ZONE_Y_RATIO;

    if (bestDist < HIT_WINDOW_PERFECT) {
      this.score += SCORE_PERFECT * this._getComboMultiplier();
      this.combo++;
      this.hp = Math.min(MAX_HP, this.hp + HP_PERFECT_GAIN);
      this.perfectCount++;
      this.judgmentText = { text: t('guitarhero.perfect'), color: '#ffd700', timer: 0.5 };
      this.judgmentTimer = 0.5;
      this._spawnHitExplosion(hx, hy, LANE_COLORS[lane], 'perfect');
      this._spawnNoteStreak(lane, best.y);
      HapticManager.vibrate('powerup');
    } else if (bestDist < HIT_WINDOW_GOOD) {
      this.score += SCORE_GOOD * this._getComboMultiplier();
      this.combo++;
      this.hp = Math.min(MAX_HP, this.hp + HP_HIT_GAIN);
      this.goodCount++;
      this.judgmentText = { text: t('guitarhero.good'), color: '#3a9a5a', timer: 0.4 };
      this.judgmentTimer = 0.4;
      this._spawnHitExplosion(hx, hy, LANE_COLORS[lane], 'good');
      this._spawnNoteStreak(lane, best.y);
      HapticManager.vibrate('hit');
    }

    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    if (this.combo > 0 && this.combo % 30 === 0 && !this.starPowerActive) {
      this.starPower = Math.min(100, this.starPower + 10);
    }
  }

  _onMiss() {
    this.combo = 0;
    this.missCount++;
    if (!this.isPractice) {
      this.hp = Math.max(0, this.hp - HP_MISS_LOSS);
    }
    this.judgmentText = { text: t('guitarhero.miss'), color: '#e74c3c', timer: 0.3 };
    this.judgmentTimer = 0.3;
    AudioManager.sfx({ type: 'hit', volume: 0.2 });
    for (const n of this.activeNotes) {
      if (n.missed && !n.missEffectSpawned) {
        n.missEffectSpawned = true;
        this._spawnHitExplosion(this._getLaneX(n.lane), this.height * HIT_ZONE_Y_RATIO, '#ff4d4d', 'miss');
        break;
      }
    }
  }

  _activateStarPower() {
    this.starPowerActive = true;
    this.starPowerTimer = 5;
    this.starPower = Math.max(0, this.starPower - 50);
    AudioManager.sfx({ type: 'powerup', volume: 0.5 });
    HapticManager.vibrate('explosion');
  }

  _getComboMultiplier() {
    const starMult = this.starPowerActive ? 2 : 1;
    for (let i = COMBO_MULTIPLIERS.length - 1; i >= 0; i--) {
      if (this.combo >= COMBO_MULTIPLIERS[i].threshold) {
        return COMBO_MULTIPLIERS[i].mult * starMult;
      }
    }
    return 1;
  }

  _getLaneX(lane) {
    const laneW = this.width / (LANE_COUNT + 1);
    return laneW * (lane + 1);
  }

  // ── Partículas ────────────────────────────────────────────────────

  _spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 200;
      this.particles.push({
        x, y, radius: 2 + Math.random() * 3,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 80,
        life: 0.3 + Math.random() * 0.4,
        color,
      });
    }
  }

  _spawnHitExplosion(x, y, color, type) {
    if (type === 'perfect') {
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const speed = 80 + Math.random() * 120;
        this.particles.push({
          x, y, radius: 2 + Math.random() * 3,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.4 + Math.random() * 0.4,
          color: i % 3 === 0 ? '#ffd700' : color,
        });
      }
      for (let i = 0; i < 6; i++) {
        this.stars.push({
          x, y,
          vx: (Math.random() - 0.5) * 60,
          vy: -Math.random() * 100 - 40,
          life: 0.6 + Math.random() * 0.3,
          size: 4 + Math.random() * 4,
          rotation: Math.random() * Math.PI * 2,
          rotSpeed: (Math.random() - 0.5) * 8,
        });
      }
    } else if (type === 'good') {
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * Math.PI * 2;
        const speed = 50 + Math.random() * 80;
        this.particles.push({
          x, y, radius: 2 + Math.random() * 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 0.3 + Math.random() * 0.3,
          color,
        });
      }
    } else if (type === 'miss') {
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 140;
        this.particles.push({
          x, y, radius: 2 + Math.random() * 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 30,
          life: 0.2 + Math.random() * 0.3,
          color: Math.random() > 0.5 ? '#ff4d4d' : '#ff6b4a',
        });
      }
    }
  }

  _spawnNoteStreak(lane, y) {
    const lx = this._getLaneX(lane);
    const color = LANE_COLORS[lane];
    for (let i = 0; i < 3; i++) {
      this.streakParticles.push({
        x: lx + (Math.random() - 0.5) * 20,
        y: y + NOTE_HEIGHT,
        vx: (Math.random() - 0.5) * 20,
        vy: 80 + Math.random() * 60,
        life: 0.2 + Math.random() * 0.2,
        color,
        alpha: 0.2,
      });
    }
  }

  _updateParticles(dt) {
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  _updateStars(dt) {
    for (const s of this.stars) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 200 * dt;
      s.rotation += s.rotSpeed * dt;
      s.life -= dt;
    }
    this.stars = this.stars.filter(s => s.life > 0);
  }

  _updateStreaks(dt) {
    for (const s of this.streakParticles) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
    }
    this.streakParticles = this.streakParticles.filter(s => s.life > 0);
  }

  _renderBackgroundEffects(ctx) {
    const eqX = 4;
    const eqY = this.height * 0.3;
    const eqW = 6;
    const eqMaxH = this.height * 0.4;
    const hue = 200 + Math.sin(Date.now() * 0.001) * 30;
    for (let i = 0; i < 4; i++) {
      const h = Math.max(4, this.equalizer[i] / 40 * eqMaxH);
      ctx.fillStyle = `hsl(${hue + i * 20}, 70%, ${50 + this.beatFlash * 20}%)`;
      ctx.fillRect(eqX + i * (eqW + 2), eqY + eqMaxH - h, eqW, h);
    }

    const eqX2 = this.width - 4 - eqW * 4 - 3 * 2;
    for (let i = 0; i < 4; i++) {
      const h = Math.max(4, this.equalizer[i + 4] / 40 * eqMaxH);
      ctx.fillStyle = `hsl(${hue + 60 + i * 20}, 70%, ${50 + this.beatFlash * 20}%)`;
      ctx.fillRect(eqX2 + i * (eqW + 2), eqY + eqMaxH - h, eqW, h);
    }

    // Spotlights
    const sweepTime = Date.now() * 0.0003;
    for (let i = 0; i < 3; i++) {
      const sweepX = (Math.sin(sweepTime + i * 2.1) * 0.4 + 0.5) * this.width;
      const alpha = 0.04 + Math.sin(sweepTime * 0.7 + i) * 0.02;
      const lightHues = [0, 220, 280];
      ctx.fillStyle = `hsl(${lightHues[i]}, 80%, 60%)`;
      ctx.globalAlpha = Math.max(0, alpha + this.beatFlash * 0.05);
      ctx.beginPath();
      ctx.moveTo(sweepX - 80, 0);
      ctx.lineTo(sweepX + 80, 0);
      ctx.lineTo(sweepX + 40, this.height);
      ctx.lineTo(sweepX - 40, this.height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Audience
    const audY = this.height - 55;
    const audH = 50;
    const audColors = ['#1a1a2a', '#1a1a1a', '#22223a', '#1a1a2a', '#2a1a2a'];
    for (let col = 0; col < Math.ceil(this.width / 16); col++) {
      const ax = col * 16;
      const colorIdx = (col + Math.floor(Date.now() * 0.0005)) % audColors.length;
      ctx.fillStyle = audColors[colorIdx];
      ctx.beginPath();
      ctx.arc(ax + 8, audY + 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(ax + 2, audY + 15, 12, audH - 15);
      if (col % 3 === 0) {
        ctx.fillRect(ax - 4, audY + 2, 6, 10);
      } else if (col % 3 === 1) {
        ctx.fillRect(ax + 14, audY + 2, 6, 10);
      }
    }

    if (this.beatFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${this.beatFlash * 0.03})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }
  }

  _restart() {
    this._startSelect();
    this.score = 0;
    this.notesHit = 0;
    this.totalNotes = 0;
    this.status = 'playing';
  }

  _endGame(won) {
    const isPractice = this.isPractice;
    this.phase = won ? 'won' : 'lost';
    this.status = this.isPractice ? 'playing' : (won ? 'won' : 'lost');

    // In practice mode, just show result overlay but don't end the game
    if (isPractice) {
      return;
    }

    const accuracy = this.totalNotes > 0 ? Math.floor((this.perfectCount + this.goodCount) / this.totalNotes * 100) : 0;

    if (this.score > this.highscore) {
      this.highscore = this.score;
      this.storage.set('highscore', this.highscore);
    }

    const duration = (Date.now() - this.songStartTime) / 1000;
    ProgressionManager.recordGamePlay('guitar-hero', this.score, won, duration);

    if (won) {
      ProgressionManager.checkAchievement('guitar-hero', 'first-song');
      if (this.song.difficulty >= 2) ProgressionManager.checkAchievement('guitar-hero', 'rock-legend');
      if (accuracy >= 90) ProgressionManager.checkAchievement('guitar-hero', 'precision-player');
    }
    if (this.maxCombo >= 50) ProgressionManager.checkAchievement('guitar-hero', 'combo-king');
  }

  // ── Render ────────────────────────────────────────────────────────

  render(ctx) {
    if (this.phase === 'select') {
      this._renderSelect(ctx);
      return;
    }

    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#0a0a1a');
    grad.addColorStop(0.3, '#1a0a2a');
    grad.addColorStop(0.6, '#2a0a1a');
    grad.addColorStop(1, '#0a0a0a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Intro countdown
    if (this.phase === 'intro') {
      const count = Math.ceil(Math.abs(this.songTime));
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 72px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(count > 0 ? String(count) : t('guitarhero.starpower'), this.width / 2, this.height / 2);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.song.name, this.width / 2, this.height / 2 - 80);
      ctx.font = '16px monospace';
      ctx.fillStyle = '#9aa7b2';
      const styleText = `${this.song.style} | ${this.song.bpm} BPM | ${this.song.totalNotes} notes`;
      ctx.fillText(styleText, this.width / 2, this.height / 2 - 50);
      if (this.isPractice) {
        ctx.fillStyle = '#38b8e8';
        ctx.fillText(t('guitarhero.practice'), this.width / 2, this.height / 2 - 20);
      }
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      return;
    }

    // Paused
    if (this.paused) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(0, 0, this.width, this.height);
      ctx.fillStyle = '#e7edf3';
      ctx.font = 'bold 36px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('game.paused'), this.width / 2, this.height / 2);
      ctx.font = '16px monospace';
      ctx.fillText('P / ESC', this.width / 2, this.height / 2 + 40);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      return;
    }

    const laneW = this.width / (LANE_COUNT + 1);
    const hitZoneY = this.height * HIT_ZONE_Y_RATIO;

    this._renderBackgroundEffects(ctx);

    // Highway background
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const lx = this._getLaneX(lane) - laneW / 3;
      const lw = laneW * 2 / 3;
      ctx.fillStyle = lane % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)';
      ctx.fillRect(lx, 0, lw, this.height);
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      ctx.lineTo(lx, this.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(lx + lw, 0);
      ctx.lineTo(lx + lw, this.height);
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, hitZoneY - 40, this.width, 80);

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, hitZoneY);
    ctx.lineTo(this.width, hitZoneY);
    ctx.stroke();

    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const lx = this._getLaneX(lane);
      ctx.fillStyle = LANE_COLORS[lane];
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(lx, hitZoneY - 8);
      ctx.lineTo(lx + 6, hitZoneY);
      ctx.lineTo(lx, hitZoneY + 8);
      ctx.lineTo(lx - 6, hitZoneY);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Notes
    for (const n of this.activeNotes) {
      if (n.hit || n.missed) continue;
      const lx = this._getLaneX(n.lane);
      const lw = laneW * 0.4;
      const ny = n.y;

      ctx.fillStyle = LANE_COLORS[n.lane];
      const radius = 4;
      ctx.beginPath();
      ctx.moveTo(lx - lw / 2 + radius, ny);
      ctx.lineTo(lx + lw / 2 - radius, ny);
      ctx.quadraticCurveTo(lx + lw / 2, ny, lx + lw / 2, ny + radius);
      ctx.lineTo(lx + lw / 2, ny + NOTE_HEIGHT - radius);
      ctx.quadraticCurveTo(lx + lw / 2, ny + NOTE_HEIGHT, lx + lw / 2 - radius, ny + NOTE_HEIGHT);
      ctx.lineTo(lx - lw / 2 + radius, ny + NOTE_HEIGHT);
      ctx.quadraticCurveTo(lx - lw / 2, ny + NOTE_HEIGHT, lx - lw / 2, ny + NOTE_HEIGHT - radius);
      ctx.lineTo(lx - lw / 2, ny + radius);
      ctx.quadraticCurveTo(lx - lw / 2, ny, lx - lw / 2 + radius, ny);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(lx - lw / 2 + 3, ny + 3, lw - 6, 5);

      if (n.chord) {
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 2;
        ctx.strokeRect(lx - lw / 2 - 2, ny - 2, lw + 4, NOTE_HEIGHT + 4);
      }
    }

    // Streaks
    for (const s of this.streakParticles) {
      ctx.globalAlpha = Math.max(0, s.life / 0.2) * 0.3;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    // Stars
    for (const s of this.stars) {
      ctx.save();
      if (ctx.rotate) {
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rotation);
      }
      ctx.globalAlpha = Math.max(0, s.life / 0.6);
      ctx.fillStyle = '#ffd700';
      const size = s.size;
      const sx = ctx.rotate ? 0 : s.x;
      const sy = ctx.rotate ? 0 : s.y;
      ctx.beginPath();
      ctx.moveTo(sx, sy - size);
      ctx.lineTo(sx + size * 0.3, sy - size * 0.3);
      ctx.lineTo(sx + size, sy);
      ctx.lineTo(sx + size * 0.3, sy + size * 0.3);
      ctx.lineTo(sx, sy + size);
      ctx.lineTo(sx - size * 0.3, sy + size * 0.3);
      ctx.lineTo(sx - size, sy);
      ctx.lineTo(sx - size * 0.3, sy - size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.4);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius || 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Judgment text
    if (this.judgmentText && this.judgmentTimer > 0) {
      ctx.fillStyle = this.judgmentText.color;
      ctx.globalAlpha = Math.min(1, this.judgmentTimer * 3);
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.judgmentText.text, this.width / 2, hitZoneY + 50);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
    }

    if (this.starPowerActive) {
      const alpha = 0.1 + Math.sin(Date.now() * 0.01) * 0.05;
      ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    this._renderHUD(ctx);

    // Result overlay for non-practice games
    if (this.phase === 'won' || this.phase === 'lost') {
      const accuracy = this.totalNotes > 0 ? Math.floor((this.perfectCount + this.goodCount) / this.totalNotes * 100) : 0;
      const title = this.phase === 'won' ? t('guitarhero.victory') : t('guitarhero.gameOver');
      renderOverlay(ctx, {
        width: this.width, height: this.height,
        title,
        score: this.score,
        subtitle: `${t('guitarhero.notesHit', { n: this.notesHit, m: this.totalNotes, p: accuracy })}`,
        actionText: t('game.restart'),
      });
    }

    // Practice result overlay (when song ends)
    if (this.phase === 'prac-result') {
      const accuracy = this.totalNotes > 0 ? Math.floor((this.perfectCount + this.goodCount) / this.totalNotes * 100) : 0;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, this.width, this.height);

      ctx.fillStyle = '#38b8e8';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(t('guitarhero.practicedone'), this.width / 2, this.height / 2 - 60);

      ctx.fillStyle = '#e7edf3';
      ctx.font = '16px monospace';
      ctx.fillText(t('guitarhero.notesHit', { n: this.notesHit, m: this.totalNotes, p: accuracy }), this.width / 2, this.height / 2 - 20);

      ctx.fillStyle = '#ffd700';
      ctx.font = '20px monospace';
      ctx.fillText(t('guitarhero.score', { n: this.score }), this.width / 2, this.height / 2 + 15);

      ctx.fillStyle = '#9aa7b2';
      ctx.font = '12px monospace';
      ctx.fillText(t('game.restart'), this.width / 2, this.height / 2 + 55);
    }
  }

  _renderSelect(ctx) {
    ctx.fillStyle = '#0a0f1a';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('guitarhero.select'), this.width / 2, 40);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Build cards: 7 song cards + 1 practice card
    const allCards = [];
    for (const def of SONG_DEFS) {
      allCards.push({ type: 'song', def, isPractice: false });
    }
    allCards.push({ type: 'practice', isPractice: true });

    const cardW = 144;
    const cardH = 220;
    const gap = 10;
    const totalCards = allCards.length;
    const totalW = totalCards * cardW + (totalCards - 1) * gap;
    const startX = Math.max(10, (this.width - totalW) / 2);
    const startY = 90;

    for (let i = 0; i < totalCards; i++) {
      const x = startX + i * (cardW + gap);
      const y = startY;
      const isSelected = i === this.selectedSong;
      const card = allCards[i];

      // Card background
      ctx.fillStyle = isSelected ? '#1a1a2a' : '#11161d';
      ctx.fillRect(x, y, cardW, cardH);
      const borderColor = isSelected
        ? (card.isPractice ? '#38b8e8' : card.def.color)
        : '#2a3a4a';
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(x, y, cardW, cardH);

      if (isSelected) {
        ctx.fillStyle = `${borderColor}15`;
        ctx.fillRect(x + 2, y + 2, cardW - 4, cardH - 4);
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (card.isPractice) {
        // Practice card
        ctx.fillStyle = '#38b8e8';
        ctx.font = 'bold 13px monospace';
        ctx.fillText(t('guitarhero.practice'), x + cardW / 2, y + 30);

        ctx.strokeStyle = '#38b8e8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + cardW / 2, y + 75, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#38b8e8';
        ctx.font = '28px monospace';
        ctx.fillText('▶', x + cardW / 2 + 2, y + 75);

        // Speed indicator
        ctx.fillStyle = '#e7edf3';
        ctx.font = 'bold 14px monospace';
        const speedPct = Math.round(this.practiceSpeed * 100);
        ctx.fillText(`${speedPct}%`, x + cardW / 2, y + 115);

        // Speed control hint
        ctx.fillStyle = '#9aa7b2';
        ctx.font = '10px monospace';
        const speedLabel = `↑↓ ${speedPct === 50 ? '0.5x' : speedPct === 75 ? '0.75x' : speedPct === 100 ? '1x' : ''}`;
        ctx.fillText(speedLabel, x + cardW / 2, y + 135);

        // Description
        ctx.fillStyle = '#7c8894';
        ctx.font = '10px monospace';
        ctx.fillText(t('guitarhero.practicedesc'), x + cardW / 2, y + 160);
        ctx.font = '11px monospace';
        ctx.fillStyle = '#38b8e8';
        ctx.fillText(t('guitarhero.nohp'), x + cardW / 2, y + 180);

        // Selection blink indicator
        if (isSelected && Math.floor(this.selectBlink * 3) % 2 === 0) {
          ctx.fillStyle = 'rgba(56, 184, 232, 0.1)';
          ctx.fillRect(x + 2, y + 2, cardW - 4, cardH - 4);
        }
      } else {
        // Song card
        const def = card.def;

        // Fret board
        ctx.fillStyle = def.color;
        ctx.fillRect(x + cardW / 2 - 24, y + 25, 48, 70);
        ctx.fillStyle = '#1a1a1a';
        for (let f = 0; f < 4; f++) {
          ctx.fillRect(x + cardW / 2 - 22, y + 30 + f * 14, 44, 2);
        }
        ctx.strokeStyle = '#7c8894';
        ctx.lineWidth = 1;
        for (let s = 0; s < 5; s++) {
          ctx.beginPath();
          ctx.moveTo(x + cardW / 2 - 20 + s * 10, y + 27);
          ctx.lineTo(x + cardW / 2 - 20 + s * 10, y + 93);
          ctx.stroke();
        }

        // Song name
        ctx.fillStyle = '#e7edf3';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(def.name, x + cardW / 2, y + 115);

        // Style label
        ctx.fillStyle = def.color;
        ctx.font = '10px monospace';
        ctx.fillText(def.style, x + cardW / 2, y + 132);

        // BPM
        ctx.fillStyle = '#9aa7b2';
        ctx.font = '10px monospace';
        ctx.fillText(`${def.bpm} BPM`, x + cardW / 2, y + 148);

        // Difficulty
        ctx.fillStyle = '#7c8894';
        ctx.font = '10px monospace';
        const diffLabel = t(`guitarhero.${['easy', 'medium', 'hard'][def.difficulty]}`);
        ctx.fillText(diffLabel, x + cardW / 2, y + 163);

        // Note count
        ctx.font = '9px monospace';
        ctx.fillStyle = '#5a6a7a';
        ctx.fillText(`~${Math.floor(def.length * def.bpm / 60 * def.density)} notes`, x + cardW / 2, y + 178);

        // Pattern preview
        ctx.fillStyle = def.color;
        ctx.globalAlpha = 0.6;
        ctx.font = '14px monospace';
        ctx.fillText(def.desc, x + cardW / 2, y + 200);
        ctx.globalAlpha = 1;
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }

    // Selection blink on selected card
    if (Math.floor(this.selectBlink * 4) % 2 === 0) {
      const selX = startX + this.selectedSong * (cardW + gap);
      ctx.fillStyle = 'rgba(255, 215, 0, 0.06)';
      ctx.fillRect(selX, startY, cardW, cardH);
      const blinkColor = this.selectedSong >= SONG_DEFS.length ? '#38b8e8' : '#ffd700';
      ctx.strokeStyle = blinkColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(selX, startY, cardW, cardH);
    }

    // Instructions
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('← → para elegir  |  Espacio/Enter para empezar', this.width / 2, this.height - 30);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  _renderHUD(ctx) {
    setupHUDContext(ctx);

    ctx.fillText(t('guitarhero.score', { n: this.score }), 10, 10);

    if (this.combo >= 5) {
      const mult = this._getComboMultiplier();
      ctx.fillStyle = this.starPowerActive ? '#ffd700' : '#ffb454';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(t('guitarhero.score2x', { n: mult }), 10, 30);
      ctx.font = '14px monospace';
      ctx.fillStyle = '#9aa7b2';
      ctx.fillText(`${this.combo} notes`, 10, 48);
    }

    // HP bar (show dimmed in practice)
    const hpBarW = 150;
    const hpBarH = 12;
    const hpY = 10;
    const hpX = this.width - hpBarW - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(hpX, hpY, hpBarW, hpBarH);
    const hpPct = this.hp / MAX_HP;
    ctx.fillStyle = this.isPractice ? '#38b8e8' : (hpPct > 0.5 ? '#3a9a5a' : hpPct > 0.25 ? '#ffb454' : '#e74c3c');
    ctx.fillRect(hpX + 1, hpY + 1, (hpBarW - 2) * hpPct, hpBarH - 2);
    ctx.fillStyle = '#9aa7b2';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(this.isPractice ? t('guitarhero.practice') : t('guitarhero.hp'), hpX + hpBarW, hpY - 2);

    // Star Power bar
    const spBarW = 100;
    const spBarH = 6;
    const spY = 28;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(hpX, spY, spBarW, spBarH);
    ctx.fillStyle = this.starPowerActive ? '#ffd700' : '#c848d8';
    ctx.fillRect(hpX + 1, spY + 1, (spBarW - 2) * (this.starPower / 100), spBarH - 2);

    if (this.starPowerActive) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(t('guitarhero.starpower'), hpX + spBarW, spY + spBarH + 4);
    }

    // Song progress
    const progW = this.width - 40;
    const progX = 20;
    const progY = this.height - 12;
    const progress = Math.min(1, this.songTime / this.song.length);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(progX, progY, progW, 4);
    ctx.fillStyle = this.starPowerActive ? '#ffd700' : (this.isPractice ? '#38b8e8' : '#4a9eff');
    ctx.fillRect(progX + 1, progY + 1, (progW - 2) * progress, 2);

    // Song name
    ctx.fillStyle = '#7c8894';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    const speedLabel = this.isPractice ? ` @ ${Math.round(this.practiceSpeed * 100)}%` : '';
    ctx.fillText(`${this.song.name} | ${this.song.bpm} BPM${speedLabel}`, this.width / 2, 10);

    // Practice badge
    if (this.isPractice) {
      ctx.fillStyle = '#38b8e8';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t('guitarhero.practice'), this.width / 2, 22);
    }

    // Lane key labels
    const hzY = this.height * HIT_ZONE_Y_RATIO;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '14px monospace';
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const lx = this._getLaneX(lane);
      ctx.fillStyle = LANE_COLORS[lane];
      ctx.globalAlpha = 0.6;
      ctx.fillText(LANE_NAMES[lane], lx, hzY - 12);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    if (this.highscore > 0) {
      ctx.fillStyle = '#7c8894';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(t('game.record', { n: this.highscore }), 10, this.height - 24);
    }
  }
}
