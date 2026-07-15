/**
 * ProgressionManager
 * Sistema completo de progresión de jugador: perfil, XP, niveles, logros
 * y desbloqueables. Todo persistido en localStorage.
 *
 * Uso:
 *   import { ProgressionManager } from './ProgressionManager.js';
 *
 *   // Al iniciar partida
 *   ProgressionManager.recordGamePlay('breakout', score, won, duration);
 *
 *   // Al ocurrir un hito
 *   ProgressionManager.checkAchievement('breakout', 'first-blood');
 *
 *   // Consultar perfil
 *   ProgressionManager.xp;
 *   ProgressionManager.level;
 *   ProgressionManager.totalGamesPlayed;
 *
 * Singleton — misma instancia en todo el hub y juegos.
 */

const STORAGE_KEY = 'gamehub:progression';

// ─── Niveles y XP ──────────────────────────────────────────────────────

const LEVELS = [
  { level: 1,  xpRequired: 0,     title: 'progression.level1' },
  { level: 2,  xpRequired: 200,   title: 'progression.level2' },
  { level: 3,  xpRequired: 500,   title: 'progression.level3' },
  { level: 4,  xpRequired: 1000,  title: 'progression.level4' },
  { level: 5,  xpRequired: 2000,  title: 'progression.level5' },
  { level: 6,  xpRequired: 3500,  title: 'progression.level6' },
  { level: 7,  xpRequired: 5500,  title: 'progression.level7' },
  { level: 8,  xpRequired: 7500,  title: 'progression.level8' },
  { level: 9,  xpRequired: 10000, title: 'progression.level9' },
  { level: 10, xpRequired: 13000, title: 'progression.level10' },
];

const MAX_LEVEL = LEVELS[LEVELS.length - 1].level;
const XP_PER_LEVEL_AFTER_MAX = 3000;

// ─── Acciones que dan XP ───────────────────────────────────────────────

const XP_REWARDS = {
  play:         10,   // Jugar una partida
  win:          50,   // Ganar/completar un juego
  achievement:  100,  // Desbloquear logro
  daily:        30,   // Jugar 3 juegos diferentes en un día
  newBestScore: 25,   // Superar récord personal
  beatBoss:     75,   // Vencer a un jefe final
};

// ─── Definiciones de items desbloqueables ──────────────────────────────

/**
 * Items que se pueden desbloquear: skins, power-ups, modos, etc.
 * Cada item tiene un id único, una clave i18n, un icono,
 * y opcionalmente un achievementId que lo desbloquea automáticamente.
 */
const UNLOCKABLE_ITEMS = [
  // ── Skins ────────────────────────────────────────────────────────
  { id: 'skin-asteroids-gold',   name: 'prog.unlock.skinAsteroidsGold',   icon: 'star',    achId: 'wave-10' },
  { id: 'skin-pacman-blue',      name: 'prog.unlock.skinPacmanBlue',      icon: 'star',    achId: null,     xpRequired: 500 },
  { id: 'skin-ship-neon',        name: 'prog.unlock.skinShipNeon',       icon: 'star',    achId: null,     xpRequired: 1000 },

  // ── Power-ups iniciales ──────────────────────────────────────────
  { id: 'powerup-wide-paddle',   name: 'prog.unlock.widePaddle',          icon: 'bolt',    achId: 'brick-breaker', xpRequired: 0 },
  { id: 'powerup-extra-life',    name: 'prog.unlock.extraLife',          icon: 'heart',   achId: 'immortal',      xpRequired: 0 },

  // ── Modos extra ──────────────────────────────────────────────────
  { id: 'mode-speedrun',         name: 'prog.unlock.modeSpeedrun',        icon: 'clock',   achId: 'unbeatable',    xpRequired: 0 },
  { id: 'mode-endless',          name: 'prog.unlock.modeEndless',         icon: 'refresh', achId: null,             xpRequired: 2000 },
  { id: 'mode-hardcore',         name: 'prog.unlock.modeHardcore',        icon: 'skull',   achId: 'wave-10',       xpRequired: 0 },

  // ── Cosméticos ───────────────────────────────────────────────────
  { id: 'cosmetic-scanlines',    name: 'prog.unlock.scanlines',           icon: 'gear',    achId: null,             xpRequired: 300 },
  { id: 'cosmetic-retro-border', name: 'prog.unlock.retroBorder',         icon: 'gear',    achId: null,             xpRequired: 1500 },
];

// ─── Definiciones de logros por juego ──────────────────────────────────

const ACHIEVEMENT_DEFS = {
  breakout: [
    { id: 'first-step',   name: 'prog.breakout.firstStep',   desc: 'prog.breakout.firstStep.desc',   icon: 'star' },
    { id: 'brick-breaker',name: 'prog.breakout.brickBreaker',desc: 'prog.breakout.brickBreaker.desc', icon: 'star' },
    { id: 'impossible',   name: 'prog.breakout.impossible',   desc: 'prog.breakout.impossible.desc',   icon: 'trophy' },
    { id: 'flawless',     name: 'prog.breakout.flawless',     desc: 'prog.breakout.flawless.desc',     icon: 'crown' },
  ],
  snake: [
    { id: 'small-snake',  name: 'prog.snake.small',     desc: 'prog.snake.small.desc',   icon: 'star' },
    { id: 'big-snake',    name: 'prog.snake.big',       desc: 'prog.snake.big.desc',     icon: 'trophy' },
    { id: 'immortal',     name: 'prog.snake.immortal',  desc: 'prog.snake.immortal.desc', icon: 'crown' },
  ],
  pong: [
    { id: 'first-point',  name: 'prog.pong.firstPoint',  desc: 'prog.pong.firstPoint.desc',  icon: 'star' },
    { id: 'win-streak-3', name: 'prog.pong.streak3',     desc: 'prog.pong.streak3.desc',     icon: 'trophy' },
    { id: 'unbeatable',   name: 'prog.pong.unbeatable',  desc: 'prog.pong.unbeatable.desc',  icon: 'crown' },
  ],
  'flappy-bird': [
    { id: 'first-flight', name: 'prog.flappy.firstFlight', desc: 'prog.flappy.firstFlight.desc', icon: 'star' },
    { id: 'pipe-master',  name: 'prog.flappy.pipeMaster',  desc: 'prog.flappy.pipeMaster.desc',  icon: 'trophy' },
    { id: 'bird-legend',  name: 'prog.flappy.legend',      desc: 'prog.flappy.legend.desc',      icon: 'crown' },
  ],
  asteroids: [
    { id: 'first-blast',  name: 'prog.asteroids.firstBlast', desc: 'prog.asteroids.firstBlast.desc', icon: 'star' },
    { id: 'wave-5',       name: 'prog.asteroids.wave5',      desc: 'prog.asteroids.wave5.desc',     icon: 'trophy' },
    { id: 'wave-10',      name: 'prog.asteroids.wave10',     desc: 'prog.asteroids.wave10.desc',    icon: 'crown' },
  ],
  snake: [
    { id: 'small-snake',  name: 'prog.snake.small',     desc: 'prog.snake.small.desc',   icon: 'star' },
    { id: 'big-snake',    name: 'prog.snake.big',       desc: 'prog.snake.big.desc',     icon: 'trophy' },
    { id: 'immortal',     name: 'prog.snake.immortal',  desc: 'prog.snake.immortal.desc', icon: 'crown' },
    { id: 'snake-boss',   name: 'prog.snake.boss',      desc: 'prog.snake.boss.desc',    icon: 'crown' },
  ],
  pong: [
    { id: 'first-point',  name: 'prog.pong.firstPoint',  desc: 'prog.pong.firstPoint.desc',  icon: 'star' },
    { id: 'win-streak-3', name: 'prog.pong.streak3',     desc: 'prog.pong.streak3.desc',     icon: 'trophy' },
    { id: 'unbeatable',   name: 'prog.pong.unbeatable',  desc: 'prog.pong.unbeatable.desc',  icon: 'crown' },
    { id: 'boss-victory', name: 'prog.pong.boss',        desc: 'prog.pong.boss.desc',       icon: 'crown' },
  ],
  'flappy-bird': [
    { id: 'first-flight', name: 'prog.flappy.firstFlight', desc: 'prog.flappy.firstFlight.desc', icon: 'star' },
    { id: 'pipe-master',  name: 'prog.flappy.pipeMaster',  desc: 'prog.flappy.pipeMaster.desc',  icon: 'trophy' },
    { id: 'bird-legend',  name: 'prog.flappy.legend',      desc: 'prog.flappy.legend.desc',      icon: 'crown' },
    { id: 'flappy-boss',  name: 'prog.flappy.boss',        desc: 'prog.flappy.boss.desc',       icon: 'crown' },
  ],
  centipede: [
    { id: 'wave-3',       name: 'prog.centipede.wave3',      desc: 'prog.centipede.wave3.desc',    icon: 'star' },
    { id: 'wave-10',      name: 'prog.centipede.wave10',     desc: 'prog.centipede.wave10.desc',   icon: 'trophy' },
    { id: 'queen-slayer', name: 'prog.centipede.queen',      desc: 'prog.centipede.queen.desc',    icon: 'crown' },
  ],
  'mario-like': [
    { id: 'world-clear',  name: 'prog.mario.worldClear',     desc: 'prog.mario.worldClear.desc',   icon: 'star' },
    { id: 'castle-clear', name: 'prog.mario.castleClear',    desc: 'prog.mario.castleClear.desc',  icon: 'crown' },
  ],
  'space-invaders': [
    { id: 'first-blood',     name: 'prog.spaceinvaders.firstBlood',  desc: 'prog.spaceinvaders.firstBlood.desc',  icon: 'star' },
    { id: 'wave-5',          name: 'prog.spaceinvaders.wave5',       desc: 'prog.spaceinvaders.wave5.desc',       icon: 'trophy' },
    { id: 'invader-legend',  name: 'prog.spaceinvaders.legend',      desc: 'prog.spaceinvaders.legend.desc',      icon: 'crown' },
  ],
  galaga: [
    { id: 'first-hit',       name: 'prog.galaga.firstHit',    desc: 'prog.galaga.firstHit.desc',    icon: 'star' },
    { id: 'galaga-wave-10',  name: 'prog.galaga.wave10',      desc: 'prog.galaga.wave10.desc',      icon: 'trophy' },
    { id: 'galaga-master',   name: 'prog.galaga.master',      desc: 'prog.galaga.master.desc',      icon: 'crown' },
  ],
  frogger: [
    { id: 'first-cross',     name: 'prog.frogger.firstCross',   desc: 'prog.frogger.firstCross.desc',  icon: 'star' },
    { id: 'river-king',      name: 'prog.frogger.riverKing',    desc: 'prog.frogger.riverKing.desc',   icon: 'trophy' },
    { id: 'frog-legend',     name: 'prog.frogger.legend',       desc: 'prog.frogger.legend.desc',      icon: 'crown' },
  ],
  tetris: [
    { id: 'first-line',      name: 'prog.tetris.firstLine',    desc: 'prog.tetris.firstLine.desc',  icon: 'star' },
    { id: 'line-clear-50',   name: 'prog.tetris.lines50',      desc: 'prog.tetris.lines50.desc',    icon: 'trophy' },
    { id: 'tetris-master',   name: 'prog.tetris.master',       desc: 'prog.tetris.master.desc',     icon: 'crown' },
  ],
  'pac-man': [
    { id: 'first-dot',       name: 'prog.pacman.firstDot',     desc: 'prog.pacman.firstDot.desc',   icon: 'star' },
    { id: 'ghost-hunter',    name: 'prog.pacman.ghostHunter',  desc: 'prog.pacman.ghostHunter.desc',icon: 'trophy' },
    { id: 'pac-legend',      name: 'prog.pacman.legend',       desc: 'prog.pacman.legend.desc',     icon: 'crown' },
  ],
  'donkey-kong': [
    { id: 'first-platform',  name: 'prog.donkeykong.firstPlatform',  desc: 'prog.donkeykong.firstPlatform.desc', icon: 'star' },
    { id: 'barrel-dodger',   name: 'prog.donkeykong.barrelDodger',   desc: 'prog.donkeykong.barrelDodger.desc',  icon: 'trophy' },
    { id: 'kong-conqueror',  name: 'prog.donkeykong.conqueror',      desc: 'prog.donkeykong.conqueror.desc',     icon: 'crown' },
  ],
  'missile-command': [
    { id: 'first-save',      name: 'prog.missile.firstSave',   desc: 'prog.missile.firstSave.desc',  icon: 'star' },
    { id: 'missile-master',  name: 'prog.missile.master',      desc: 'prog.missile.master.desc',     icon: 'trophy' },
    { id: 'last-defense',    name: 'prog.missile.lastDefense', desc: 'prog.missile.lastDefense.desc',icon: 'crown' },
  ],
  platformer: [
    { id: 'first-level',     name: 'prog.platformer.firstLevel',   desc: 'prog.platformer.firstLevel.desc',   icon: 'star' },
    { id: 'platform-pro',    name: 'prog.platformer.pro',          desc: 'prog.platformer.pro.desc',          icon: 'trophy' },
    { id: 'speed-runner',    name: 'prog.platformer.speedRunner',  desc: 'prog.platformer.speedRunner.desc',  icon: 'crown' },
  ],
  'fancy-pants': [
    { id: 'fancy-first',     name: 'prog.fancy.firstLevel',    desc: 'prog.fancy.firstLevel.desc',   icon: 'star' },
    { id: 'fancy-runner',    name: 'prog.fancy.runner',        desc: 'prog.fancy.runner.desc',       icon: 'trophy' },
    { id: 'wall-jump-master',name: 'prog.fancy.wallJump',      desc: 'prog.fancy.wallJump.desc',     icon: 'crown' },
  ],
  'coop-platformer': [
    { id: 'coop-first',      name: 'prog.coop.firstLevel',     desc: 'prog.coop.firstLevel.desc',    icon: 'star' },
    { id: 'coop-pro',        name: 'prog.coop.pro',            desc: 'prog.coop.pro.desc',           icon: 'trophy' },
    { id: 'fire-water',      name: 'prog.coop.masters',        desc: 'prog.coop.masters.desc',      icon: 'crown' },
  ],
  'trick-quiz': [
    { id: 'first-win',       name: 'prog.quiz.firstWin',       desc: 'prog.quiz.firstWin.desc',     icon: 'star' },
    { id: 'trickster',       name: 'prog.quiz.trickster',      desc: 'prog.quiz.trickster.desc',    icon: 'trophy' },
    { id: 'quiz-master',     name: 'prog.quiz.master',         desc: 'prog.quiz.master.desc',       icon: 'crown' },
  ],
  'papa-pizzeria': [
    { id: 'first-pizza',     name: 'prog.papa.firstPizza',     desc: 'prog.papa.firstPizza.desc',   icon: 'star' },
    { id: 'pizza-chef',      name: 'prog.papa.chef',           desc: 'prog.papa.chef.desc',         icon: 'trophy' },
    { id: 'pizza-legend',    name: 'prog.papa.legend',         desc: 'prog.papa.legend.desc',       icon: 'crown' },
  ],
  'stick-rpg': [
    { id: 'first-day',       name: 'prog.stickrpg.firstDay',   desc: 'prog.stickrpg.firstDay.desc', icon: 'star' },
    { id: 'stick-rich',      name: 'prog.stickrpg.rich',       desc: 'prog.stickrpg.rich.desc',     icon: 'trophy' },
    { id: 'rpg-legend',      name: 'prog.stickrpg.legend',     desc: 'prog.stickrpg.legend.desc',   icon: 'crown' },
  ],
  'crush-the-castle': [
    { id: 'castle-first',    name: 'prog.crush.firstCastle',   desc: 'prog.crush.firstCastle.desc', icon: 'star' },
    { id: 'castle-crusher',  name: 'prog.crush.crusher',       desc: 'prog.crush.crusher.desc',     icon: 'trophy' },
    { id: 'demolition-expert',name: 'prog.crush.expert',       desc: 'prog.crush.expert.desc',     icon: 'crown' },
  ],
  bowman: [
    { id: 'first-shot',      name: 'prog.bowman.firstShot',    desc: 'prog.bowman.firstShot.desc',  icon: 'star' },
    { id: 'sharpshooter',    name: 'prog.bowman.sharpshooter', desc: 'prog.bowman.sharpshooter.desc',icon: 'trophy' },
    { id: 'bowman-legend',   name: 'prog.bowman.legend',       desc: 'prog.bowman.legend.desc',     icon: 'crown' },
  ],
  'bloons-td': [
    { id: 'first-bloon',     name: 'prog.bloons.firstBloon',   desc: 'prog.bloons.firstBloon.desc', icon: 'star' },
    { id: 'bloon-slayer',    name: 'prog.bloons.slayer',       desc: 'prog.bloons.slayer.desc',     icon: 'trophy' },
    { id: 'td-master',       name: 'prog.bloons.master',       desc: 'prog.bloons.master.desc',     icon: 'crown' },
  ],
  'territory-war': [
    { id: 'first-victory',   name: 'prog.territory.firstVictory',   desc: 'prog.territory.firstVictory.desc',icon: 'star' },
    { id: 'war-veteran',     name: 'prog.territory.veteran',        desc: 'prog.territory.veteran.desc',     icon: 'trophy' },
    { id: 'territory-legend',name: 'prog.territory.legend',          desc: 'prog.territory.legend.desc',      icon: 'crown' },
  ],
  'swords-and-souls': [
    { id: 'first-wave',      name: 'prog.swords.firstWave',    desc: 'prog.swords.firstWave.desc',   icon: 'star' },
    { id: 'swords-wave-10',  name: 'prog.swords.wave10',       desc: 'prog.swords.wave10.desc',      icon: 'trophy' },
    { id: 'swords-legend',   name: 'prog.swords.legend',       desc: 'prog.swords.legend.desc',      icon: 'crown' },
  ],
  'outrun-like': [
    { id: 'first-race',      name: 'prog.outrun-like.first-race',     desc: 'prog.outrun-like.first-race.desc',    icon: 'star' },
    { id: 'road-warrior',    name: 'prog.outrun-like.road-warrior',   desc: 'prog.outrun-like.road-warrior.desc',   icon: 'crown' },
    { id: 'arcade-king',     name: 'prog.outrun-like.arcade-king',    desc: 'prog.outrun-like.arcade-king.desc',    icon: 'trophy' },
    { id: 'near-miss-pro',   name: 'prog.outrun-like.near-miss-pro',  desc: 'prog.outrun-like.near-miss-pro.desc',  icon: 'star' },
    { id: 'speed-demon',     name: 'prog.outrun-like.speed-demon',    desc: 'prog.outrun-like.speed-demon.desc',    icon: 'crown' },
  ],
  'contra-like': [
    { id: 'first-stage',    name: 'prog.contra-like.first-stage',   desc: 'prog.contra-like.first-stage.desc',  icon: 'star' },
    { id: 'game-cleared',   name: 'prog.contra-like.game-cleared',  desc: 'prog.contra-like.game-cleared.desc', icon: 'crown' },
    { id: 'contra-master',  name: 'prog.contra-like.contra-master', desc: 'prog.contra-like.contra-master.desc',icon: 'trophy' },
  ],
  'space-harrier': [
    { id: 'first-clear',   name: 'prog.space-harrier.first-clear',  desc: 'prog.space-harrier.first-clear.desc', icon: 'star' },
    { id: 'harrier-ace',   name: 'prog.space-harrier.harrier-ace',  desc: 'prog.space-harrier.harrier-ace.desc', icon: 'crown' },
    { id: 'sky-warrior',   name: 'prog.space-harrier.sky-warrior',  desc: 'prog.space-harrier.sky-warrior.desc', icon: 'trophy' },
    { id: 'perfect-run',   name: 'prog.space-harrier.perfect-run',  desc: 'prog.space-harrier.perfect-run.desc', icon: 'crown' },
  ],
  'metroid-like': [
    { id: 'boss-slayer',   name: 'prog.metroid-like.boss-slayer',   desc: 'prog.metroid-like.boss-slayer.desc',  icon: 'crown' },
    { id: 'explorer',      name: 'prog.metroid-like.explorer',      desc: 'prog.metroid-like.explorer.desc',     icon: 'star' },
    { id: 'demolition',    name: 'prog.metroid-like.demolition',    desc: 'prog.metroid-like.demolition.desc',   icon: 'trophy' },
  ],
  'street-fighter': [
    { id: 'first-victory',     name: 'prog.street-fighter.firstVictory',   desc: 'prog.street-fighter.firstVictory.desc',  icon: 'star' },
    { id: 'fighting-legend',   name: 'prog.street-fighter.fightingLegend', desc: 'prog.street-fighter.fightingLegend.desc', icon: 'crown' },
    { id: 'round-fighter',     name: 'prog.street-fighter.roundFighter',   desc: 'prog.street-fighter.roundFighter.desc',   icon: 'trophy' },
  ],
  'henry-stickmin': [
    { id: 'first-ending',       name: 'prog.henry.firstEnding',      desc: 'prog.henry.firstEnding.desc',    icon: 'star' },
    { id: 'ending-collector',   name: 'prog.henry.collector',        desc: 'prog.henry.collector.desc',      icon: 'trophy' },
    { id: 'henry-completionist',name: 'prog.henry.completionist',    desc: 'prog.henry.completionist.desc',  icon: 'crown' },
  ],
  'golden-axe': [
    { id: 'first-blood',     name: 'prog.golden-axe.first-blood',    desc: 'prog.golden-axe.first-blood.desc',    icon: 'star' },
    { id: 'stage-master',    name: 'prog.golden-axe.stage-master',   desc: 'prog.golden-axe.stage-master.desc',   icon: 'trophy' },
    { id: 'game-cleared',    name: 'prog.golden-axe.game-cleared',   desc: 'prog.golden-axe.game-cleared.desc',   icon: 'crown' },
    { id: 'no-continue',     name: 'prog.golden-axe.no-continue',    desc: 'prog.golden-axe.no-continue.desc',    icon: 'crown' },
  ],
  'guitar-hero': [
    { id: 'first-song',        name: 'prog.guitar-hero.first-song',       desc: 'prog.guitar-hero.first-song.desc',       icon: 'star' },
    { id: 'rock-legend',       name: 'prog.guitar-hero.rock-legend',      desc: 'prog.guitar-hero.rock-legend.desc',      icon: 'trophy' },
    { id: 'precision-player',  name: 'prog.guitar-hero.precision-player', desc: 'prog.guitar-hero.precision-player.desc',  icon: 'crown' },
    { id: 'combo-king',        name: 'prog.guitar-hero.combo-king',       desc: 'prog.guitar-hero.combo-king.desc',       icon: 'crown' },
  ],
  'bejeweled': [
    { id: 'first-clear',     name: 'prog.bejeweled.first-clear',     desc: 'prog.bejeweled.first-clear.desc',     icon: 'star' },
    { id: 'cascade-master',  name: 'prog.bejeweled.cascade-master',  desc: 'prog.bejeweled.cascade-master.desc',   icon: 'trophy' },
    { id: 'gem-hoarder',     name: 'prog.bejeweled.gem-hoarder',     desc: 'prog.bejeweled.gem-hoarder.desc',     icon: 'crown' },
    { id: 'speed-demon',     name: 'prog.bejeweled.speed-demon',     desc: 'prog.bejeweled.speed-demon.desc',     icon: 'crown' },
  ],
  'lemonade-stand': [
    { id: 'first-profit',      name: 'prog.lemonade-stand.first-profit',      desc: 'prog.lemonade-stand.first-profit.desc',      icon: 'star' },
    { id: 'lemonade-tycoon',   name: 'prog.lemonade-stand.lemonade-tycoon',   desc: 'prog.lemonade-stand.lemonade-tycoon.desc',   icon: 'trophy' },
    { id: 'master-chef',       name: 'prog.lemonade-stand.master-chef',       desc: 'prog.lemonade-stand.master-chef.desc',       icon: 'crown' },
    { id: 'mass-production',   name: 'prog.lemonade-stand.mass-production',   desc: 'prog.lemonade-stand.mass-production.desc',   icon: 'crown' },
  ],
};

// ─── Clase Singleton ───────────────────────────────────────────────────

class ProgressionManagerImpl {
  constructor() {
    this._data = this._load();
  }

  // ═════════════════════════════════════════════════════════════════════
  //  Persistencia
  // ═════════════════════════════════════════════════════════════════════

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // Convertir array de juegos de hoy a Set (JSON no soporta Sets)
          if (Array.isArray(parsed.gamesPlayedToday)) {
            parsed.gamesPlayedToday = new Set(parsed.gamesPlayedToday);
          }
          return parsed;
        }
      }
    } catch { /* ignorar */ }
    return this._defaults();
  }

  _save() {
    const toStore = { ...this._data };
    // Convertir Set a array para que JSON.stringify funcione
    toStore.gamesPlayedToday = Array.from(this._data.gamesPlayedToday || []);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
    } catch { /* localStorage no disponible */ }
  }

  _defaults() {
    return {
      playerName: 'Jugador',
      xp: 0,
      achievements: {},       // gameId → { achievementId: timestamp }
      gameStats: {},          // gameId → { plays, wins, bestScore, totalTime, bestStreak }
      unlockedItems: [],      // [itemId, ...]
      lastPlayedDate: '',     // YYYY-MM-DD para daily bonus
      gamesPlayedToday: [],   // array vacío (se convierte a Set en _load)
      totalGamesPlayed: 0,
      totalPlayTime: 0,       // segundos acumulados
    };
  }

  reset() {
    this._data = this._defaults();
    this._save();
  }

  // ═════════════════════════════════════════════════════════════════════
  //  Perfil
  // ═════════════════════════════════════════════════════════════════════

  get playerName() { return this._data.playerName; }
  set playerName(v) {
    this._data.playerName = String(v).trim() || 'Jugador';
    this._save();
  }

  get xp() { return this._data.xp; }

  get level() {
    let lv = 1;
    for (const l of LEVELS) {
      if (this._data.xp >= l.xpRequired) lv = l.level;
    }
    return lv;
  }

  get levelTitle() {
    const lv = this.level;
    const def = LEVELS.find(l => l.level === lv) || LEVELS[LEVELS.length - 1];
    return def.title;
  }

  get xpForNextLevel() {
    const lv = this.level;
    const next = LEVELS.find(l => l.level === lv + 1);
    if (!next) return Infinity;
    return next.xpRequired;
  }

  get xpProgress() {
    const lv = this.level;
    const current = LEVELS.find(l => l.level === lv) || LEVELS[LEVELS.length - 1];
    const next = LEVELS.find(l => l.level === lv + 1);
    if (!next) return 1;
    return (this._data.xp - current.xpRequired) / (next.xpRequired - current.xpRequired);
  }

  get totalGamesPlayed() { return this._data.totalGamesPlayed; }
  get totalPlayTime() { return this._data.totalPlayTime; }

  /**
   * Añade XP al jugador. Si sube de nivel, el progreso se guarda.
   * @param {number} amount - XP a añadir
   * @param {string} [reason] - Opcional, para depuración
   */
  addXp(amount, reason) {
    this._data.xp += amount;
    this._save();
  }

  // ═════════════════════════════════════════════════════════════════════
  //  Estadísticas por juego
  // ═════════════════════════════════════════════════════════════════════

  getGameStats(gameId) {
    if (!this._data.gameStats[gameId]) {
      this._data.gameStats[gameId] = { plays: 0, wins: 0, bestScore: 0, totalTime: 0, bestStreak: 0 };
    }
    return this._data.gameStats[gameId];
  }

  /**
   * Registra una partida jugada. Actualiza stats, XP, y bonus diario.
   * @param {string} gameId
   * @param {number} score - Puntuación obtenida
   * @param {boolean} won - Si el jugador ganó/completó el juego
   * @param {number} duration - Duración en segundos
   */
  recordGamePlay(gameId, score, won, duration) {
    const stats = this.getGameStats(gameId);
    stats.plays++;
    stats.totalTime += duration;
    this._data.totalGamesPlayed++;
    this._data.totalPlayTime += duration;

    // Mejor puntuación
    let isNewBest = false;
    if (score > stats.bestScore) {
      stats.bestScore = score;
      isNewBest = true;
      if (score > 0) this.addXp(XP_REWARDS.newBestScore, `${gameId}:newBest`);
    }

    // Victoria
    if (won) {
      stats.wins++;
      this.addXp(XP_REWARDS.win, `${gameId}:win`);
    }

    // XP por jugar
    this.addXp(XP_REWARDS.play, `${gameId}:play`);

    // Bonus diario: jugar 3 juegos diferentes
    this._updateDailyBonus(gameId);

    this._save();
  }

  /**
   * Lleva el contador de juegos distintos jugados hoy.
   * Si son al menos 3, da bonus diario una vez.
   */
  _updateDailyBonus(gameId) {
    const today = new Date().toISOString().slice(0, 10);
    if (this._data.lastPlayedDate !== today) {
      this._data.lastPlayedDate = today;
      this._data.gamesPlayedToday = new Set([gameId]);
    } else {
      this._data.gamesPlayedToday.add(gameId);
    }

    if (this._data.gamesPlayedToday.size >= 3) {
      this.addXp(XP_REWARDS.daily, 'daily:3games');
      // Para no dar el bonus múltiples veces, lo marcamos
      this._data.gamesPlayedToday = new Set([gameId, '__daily_claimed__']);
    }
  }

  // ═════════════════════════════════════════════════════════════════════
  //  Logros
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Devuelve los IDs de todos los juegos que tienen logros definidos.
   * @returns {string[]}
   */
  getGamesWithAch() {
    return Object.keys(ACHIEVEMENT_DEFS);
  }

  /**
   * Devuelve las definiciones de logros para un juego.
   * @param {string} gameId
   * @returns {Array<{id: string, name: string, desc: string, icon: string}>}
   */
  getAchievementDefs(gameId) {
    return ACHIEVEMENT_DEFS[gameId] || [];
  }

  /**
   * Devuelve los logros con estado de desbloqueo para un juego.
   * @param {string} gameId
   * @returns {Array<{id: string, name: string, desc: string, icon: string, unlocked: boolean, unlockedAt: number|null}>}
   */
  getAchievements(gameId) {
    const defs = this.getAchievementDefs(gameId);
    const unlocked = this._data.achievements[gameId] || {};
    return defs.map(a => ({
      ...a,
      unlocked: !!unlocked[a.id],
      unlockedAt: unlocked[a.id] || null,
    }));
  }

  /**
   * Comprueba si un logro específico está desbloqueado.
   * @param {string} gameId
   * @param {string} achievementId
   * @returns {boolean}
   */
  isAchievementUnlocked(gameId, achievementId) {
    return !!(this._data.achievements[gameId]?.[achievementId]);
  }

  /**
   * Intenta desbloquear un logro. Si ya estaba desbloqueado, no hace nada.
   * @param {string} gameId
   * @param {string} achievementId
   * @returns {boolean} - true si se desbloqueó ahora
   */
  checkAchievement(gameId, achievementId) {
    const defs = this.getAchievementDefs(gameId);
    const def = defs.find(a => a.id === achievementId);
    if (!def) return false;

    if (!this._data.achievements[gameId]) {
      this._data.achievements[gameId] = {};
    }

    if (this._data.achievements[gameId][achievementId]) {
      return false; // ya desbloqueado
    }

    this._data.achievements[gameId][achievementId] = Date.now();
    this.addXp(XP_REWARDS.achievement, `${gameId}:ach:${achievementId}`);

    // Desbloquear items vinculados a este logro
    for (const item of UNLOCKABLE_ITEMS) {
      if (item.achId === achievementId) {
        this.unlockItem(item.id);
      }
    }

    this._save();
    return true;
  }

  /**
   * Devuelve la cuenta total de logros desbloqueados.
   * @returns {number}
   */
  get totalAchievements() {
    let count = 0;
    for (const gameId of Object.keys(this._data.achievements)) {
      count += Object.keys(this._data.achievements[gameId]).length;
    }
    return count;
  }

  /**
   * Devuelve la cuenta total de logros disponibles.
   * @returns {number}
   */
  get totalAchievable() {
    let count = 0;
    for (const gameId of Object.keys(ACHIEVEMENT_DEFS)) {
      count += ACHIEVEMENT_DEFS[gameId].length;
    }
    return count;
  }

  // ═════════════════════════════════════════════════════════════════════
  //  Desbloqueables
  // ═════════════════════════════════════════════════════════════════════

  /**
   * Verifica si un item está desbloqueado.
   * @param {string} itemId
   * @returns {boolean}
   */
  isUnlocked(itemId) {
    return this._data.unlockedItems.includes(itemId);
  }

  /**
   * Desbloquea un item.
   * @param {string} itemId
   */
  unlockItem(itemId) {
    if (!this._data.unlockedItems.includes(itemId)) {
      this._data.unlockedItems.push(itemId);
      this._save();
    }
  }

  /**
   * Devuelve todos los items desbloqueados.
   * @returns {string[]}
   */
  get unlockedItems() {
    return [...this._data.unlockedItems];
  }
}

// Singleton
export const ProgressionManager = new ProgressionManagerImpl();
