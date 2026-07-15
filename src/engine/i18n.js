/**
 * i18n.js
 * Sistema de traducción ES/EN para el hub y todos los juegos.
 *
 * Uso en JS:
 *   import { t } from '../../engine/i18n.js';
 *   ctx.fillText(t('breakout.score', { n: 42 }), 10, 28);
 *
 * Uso en HTML (data-i18n):
 *   <span data-i18n="menu.eyebrow">Selecciona un juego</span>
 *   Llamar a applyI18n() tras cada cambio de idioma o al cargar la página.
 *
 * Fallback: si una clave no existe en EN, se usa ES.
 *          si una clave no existe en ningún lado, se muestra la clave.
 */

import { SettingsManager } from './SettingsManager.js';

// ══════════════════════════════════════════════════════════════════════════
//  Traducciones
// ══════════════════════════════════════════════════════════════════════════

/** @type {Object<string, {es: string, en: string}>} */
const TRANSLATIONS = {

  // ── Hub: menú ────────────────────────────────────────────────────────

  'menu.eyebrow':            { es: 'Selecciona un juego',             en: 'Select a game' },
  'menu.searchPlaceholder':  { es: 'Buscar juegos...',              en: 'Search games...' },
  'menu.empty':              { es: 'No se encontraron juegos',        en: 'No games found' },
  'menu.level':              { es: 'Nivel',                           en: 'Level' },
  'menu.back':               { es: '← Menú',                          en: '← Menu' },

  // ── Hub: settings ────────────────────────────────────────────────────

  'settings.title':          { es: 'CONFIGURACIÓN',                   en: 'SETTINGS' },
  'settings.appearance':     { es: 'APARIENCIA',                      en: 'APPEARANCE' },
  'settings.theme':          { es: 'Tema',                            en: 'Theme' },
  'settings.language':       { es: 'Idioma',                          en: 'Language' },
  'settings.reducedMotion':  { es: 'Animaciones',                     en: 'Animations' },
  'settings.audio':          { es: 'AUDIO',                           en: 'AUDIO' },
  'settings.masterVol':      { es: 'Vol. maestro',                    en: 'Master Vol.' },
  'settings.sfxVol':         { es: 'Vol. SFX',                        en: 'SFX Vol.' },
  'settings.musicVol':       { es: 'Vol. música',                     en: 'Music Vol.' },
  'settings.haptics':        { es: 'HÁPTICO',                         en: 'HAPTICS' },
  'settings.vibration':      { es: 'Vibración',                       en: 'Vibration' },
  'settings.close':          { es: 'Cerrar',                          en: 'Close' },
  'settings.aspectRatio':   { es: 'Proporción',                      en: 'Aspect Ratio' },
  'settings.crtEffect':     { es: 'Efecto CRT',                      en: 'CRT Effect' },

  // ── Niveles (dificultad) ─────────────────────────────────────────────

  'level.easy':              { es: 'Fácil',                           en: 'Easy' },
  'level.medium':            { es: 'Medio',                           en: 'Medium' },
  'level.hard':              { es: 'Difícil',                         en: 'Hard' },
  'level.expert':            { es: 'Experto',                         en: 'Expert' },
  'level.impossible':        { es: 'Imposible',                       en: 'Impossible' },

  // ── Estados de juego (compartidos) ───────────────────────────────────

  'game.levelComplete':      { es: '¡NIVEL COMPLETADO!',              en: 'LEVEL COMPLETE!' },
  'game.continue':           { es: 'Click o Espacio para continuar',  en: 'Click or Space to continue' },
  'game.restart':            { es: 'Click o Espacio para reiniciar',  en: 'Click or Space to restart' },
  'game.gameOver':           { es: 'GAME OVER',                       en: 'GAME OVER' },
  'game.score':              { es: 'Puntos: {n}',                     en: 'Score: {n}' },
  'game.record':             { es: 'Récord: {n}',                     en: 'Record: {n}' },
  'game.victory':            { es: '¡VICTORIA!',                      en: 'VICTORY!' },
  'game.defeat':             { es: 'DERROTA',                         en: 'DEFEAT' },
  'game.power':              { es: 'POTENCIA',                        en: 'POWER' },
  'game.wave':               { es: 'Oleada: {n}',                     en: 'Wave: {n}' },
  'game.round':              { es: 'Ronda: {n}',                      en: 'Round: {n}' },
  'game.turn':               { es: 'Turno: {n}',                      en: 'Turn: {n}' },
  'game.wind':               { es: 'VIENTO',                          en: 'WIND' },
  'game.lives':              { es: 'Vidas: {n}',                       en: 'Lives: {n}' },
  'game.paused':             { es: 'PAUSA',                            en: 'PAUSED' },

  // ── Gamepad ───────────────────────────────────────────────────────────

  'gamepad.connected':       { es: '🎮 Gamepad conectado: {name}',     en: '🎮 Gamepad connected: {name}' },
  'gamepad.disconnected':    { es: '🎮 Gamepad desconectado',           en: '🎮 Gamepad disconnected' },
  'gamepad.tooltip':         { es: 'Gamepad conectado',                en: 'Gamepad connected' },

  // ── Fullscreen ───────────────────────────────────────────────────────

  'fullscreen.enter':        { es: '⛶ Pantalla completa',              en: '⛶ Fullscreen' },
  'fullscreen.exit':         { es: '⛶ Salir fullscreen',               en: '⛶ Exit fullscreen' },

  // ── Progresión ───────────────────────────────────────────────────────

  'progression.profile':         { es: 'PERFIL',                          en: 'PROFILE' },
  'progression.level':           { es: 'Nivel {n}',                       en: 'Level {n}' },
  'progression.xp':              { es: 'XP: {n}/{m}',                     en: 'XP: {n}/{m}' },
  'progression.stats':           { es: 'ESTADÍSTICAS',                    en: 'STATISTICS' },
  'progression.achievements':    { es: 'LOGROS',                          en: 'ACHIEVEMENTS' },
  'progression.unlockables':     { es: 'DESBLOQUEABLES',                  en: 'UNLOCKABLES' },
  'progression.totalPlayed':     { es: 'Partidas: {n}',                   en: 'Games played: {n}' },
  'progression.totalTime':       { es: 'Tiempo: {n}s',                    en: 'Time: {n}s' },
  'progression.totalAch':        { es: 'Logros: {n}/{m}',                 en: 'Achievements: {n}/{m}' },
  'progression.bestScore':       { es: 'Mejor: {n}',                      en: 'Best: {n}' },
  'progression.wins':            { es: 'Victorias: {n}',                  en: 'Wins: {n}' },
  'progression.plays':           { es: 'Jugado: {n} veces',               en: 'Played: {n} times' },
  'progression.locked':          { es: '🔒 Bloqueado',                    en: '🔒 Locked' },
  'progression.unlocked':        { es: '✅ Desbloqueado',                  en: '✅ Unlocked' },
  'progression.reset':           { es: 'Resetear progreso',               en: 'Reset progress' },
  'progression.resetConfirm':    { es: '¿Resetear todo el progreso?',     en: 'Reset all progress?' },
  'progression.newAchievement':  { es: '🏆 ¡Logro: {name}!',              en: '🏆 Achievement: {name}!' },
  'progression.dailyBonus':      { es: '🔥 Bonus diario: +30 XP',         en: '🔥 Daily bonus: +30 XP' },
  'progression.highscores':      { es: 'RÉCORDS',                          en: 'HIGH SCORES' },
  'progression.hsEmpty':         { es: 'Juega algunas partidas para ver tus récords.', en: 'Play some games to see your high scores.' },

  // Niveles
  'progression.level1':  { es: 'Novato',           en: 'Novice' },
  'progression.level2':  { es: 'Aprendiz',         en: 'Learner' },
  'progression.level3':  { es: 'Jugador',          en: 'Player' },
  'progression.level4':  { es: 'Veterano',         en: 'Veteran' },
  'progression.level5':  { es: 'Experto',          en: 'Expert' },
  'progression.level6':  { es: 'Maestro',          en: 'Master' },
  'progression.level7':  { es: 'Leyenda',          en: 'Legend' },
  'progression.level8':  { es: 'Leyenda II',       en: 'Legend II' },
  'progression.level9':  { es: 'Leyenda III',      en: 'Legend III' },
  'progression.level10': { es: '⭐ Leyenda Suprema', en: '⭐ Supreme Legend' },

  // ── Logros por juego ─────────────────────────────────────────────────

  'prog.breakout.firstStep':        { es: 'Primer paso',                  en: 'First step' },
  'prog.breakout.firstStep.desc':   { es: 'Completa el nivel 1',          en: 'Complete level 1' },
  'prog.breakout.brickBreaker':     { es: 'Rompe-ladrillos',              en: 'Brick breaker' },
  'prog.breakout.brickBreaker.desc':{ es: 'Completa los 5 niveles',       en: 'Complete all 5 levels' },
  'prog.breakout.impossible':       { es: 'Imposible',                    en: 'Impossible' },
  'prog.breakout.impossible.desc':  { es: 'Completa el nivel 5',          en: 'Complete level 5' },
  'prog.breakout.flawless':         { es: 'Imparable',                    en: 'Flawless' },
  'prog.breakout.flawless.desc':    { es: 'Completa un nivel sin perder vida', en: 'Complete a level without dying' },

  'prog.snake.small':               { es: 'Serpiente pequeña',            en: 'Small snake' },
  'prog.snake.small.desc':          { es: 'Alcanza 10 puntos',           en: 'Reach 10 points' },
  'prog.snake.big':                 { es: 'Serpiente grande',             en: 'Big snake' },
  'prog.snake.big.desc':            { es: 'Alcanza 50 puntos',           en: 'Reach 50 points' },
  'prog.snake.immortal':            { es: 'Inmortal',                     en: 'Immortal' },
  'prog.snake.immortal.desc':       { es: 'Alcanza 100 puntos',          en: 'Reach 100 points' },

  'prog.pong.firstPoint':           { es: 'Primer punto',                 en: 'First point' },
  'prog.pong.firstPoint.desc':      { es: 'Gana tu primer punto',         en: 'Win your first point' },
  'prog.pong.streak3':              { es: 'Racha de 3',                   en: 'Streak of 3' },
  'prog.pong.streak3.desc':         { es: 'Gana 3 partidas seguidas',     en: 'Win 3 games in a row' },
  'prog.pong.unbeatable':           { es: 'Imbatible',                    en: 'Unbeatable' },
  'prog.pong.unbeatable.desc':      { es: 'Gana en dificultad Difícil',   en: 'Win on Hard difficulty' },

  'prog.flappy.firstFlight':        { es: 'Primer vuelo',                 en: 'First flight' },
  'prog.flappy.firstFlight.desc':   { es: 'Supera 1 tubería',            en: 'Pass 1 pipe' },
  'prog.flappy.pipeMaster':         { es: 'Maestro de tuberías',          en: 'Pipe master' },
  'prog.flappy.pipeMaster.desc':    { es: 'Supera 20 tuberías',          en: 'Pass 20 pipes' },
  'prog.flappy.legend':             { es: 'Leyenda alada',                en: 'Winged legend' },
  'prog.flappy.legend.desc':        { es: 'Supera 50 tuberías',          en: 'Pass 50 pipes' },

  'prog.asteroids.firstBlast':      { es: 'Primera explosión',            en: 'First blast' },
  'prog.asteroids.firstBlast.desc': { es: 'Destruye tu primer asteroide', en: 'Destroy your first asteroid' },
  'prog.asteroids.wave5':           { es: 'Superviviente',                en: 'Survivor' },
  'prog.asteroids.wave5.desc':      { es: 'Alcanza la oleada 5',          en: 'Reach wave 5' },
  'prog.asteroids.wave10':          { es: 'Leyenda espacial',             en: 'Space legend' },
  'prog.asteroids.wave10.desc':     { es: 'Alcanza la oleada 10',         en: 'Reach wave 10' },

  // ── Snake boss achievements ─────────────────────────────────────────

  'prog.snake.boss':          { es: 'Cazador de jefes',               en: 'Boss Hunter' },
  'prog.snake.boss.desc':     { es: 'Come la fruta del jefe',         en: 'Eat the boss fruit' },

  // ── Pong boss achievements ──────────────────────────────────────────

  'prog.pong.boss':           { es: 'Rey de la paleta',               en: 'Paddle King' },
  'prog.pong.boss.desc':      { es: 'Derrota al jefe en Pong',        en: 'Defeat the Pong boss' },

  // ── Flappy Bird boss achievements ───────────────────────────────────

  'prog.flappy.boss':         { es: 'Ave fénix',                      en: 'Phoenix Bird' },
  'prog.flappy.boss.desc':    { es: 'Supera el modo jefe',            en: 'Survive boss mode' },

  // ── Centipede achievements ──────────────────────────────────────────

  'prog.centipede.wave3':     { es: 'Mataciempiés',                   en: 'Centipede Slayer' },
  'prog.centipede.wave3.desc':{ es: 'Alcanza la oleada 3',            en: 'Reach wave 3' },
  'prog.centipede.wave10':    { es: 'Exterminador',                   en: 'Exterminator' },
  'prog.centipede.wave10.desc':{ es: 'Alcanza la oleada 10',          en: 'Reach wave 10' },
  'prog.centipede.queen':     { es: 'Rey del ciempiés',               en: 'Centipede King' },
  'prog.centipede.queen.desc':{ es: 'Derrota a la centipede reina',   en: 'Defeat the queen centipede' },

  // ── Mario-like achievements ────────────────────────────────────────

  'prog.mario.worldClear':    { es: 'Super Mario',                    en: 'Super Mario' },
  'prog.mario.worldClear.desc':{ es: 'Completa un nivel',             en: 'Complete a level' },
  'prog.mario.castleClear':   { es: 'Rey del castillo',               en: 'Castle King' },
  'prog.mario.castleClear.desc':{ es: 'Completa los 3 mundos',        en: 'Complete all 3 worlds' },

  // ── Space Invaders achievements ─────────────────────────────────

  'prog.spaceinvaders.firstBlood':       { es: 'Primera sangre',               en: 'First blood' },
  'prog.spaceinvaders.firstBlood.desc':  { es: 'Destruye tu primer alien',     en: 'Destroy your first alien' },
  'prog.spaceinvaders.wave5':            { es: 'Superviviente espacial',       en: 'Space survivor' },
  'prog.spaceinvaders.wave5.desc':       { es: 'Alcanza la oleada 5',          en: 'Reach wave 5' },
  'prog.spaceinvaders.legend':           { es: 'Leyenda invasora',             en: 'Invader legend' },
  'prog.spaceinvaders.legend.desc':      { es: 'Consigue 10.000 puntos',       en: 'Score 10,000 points' },

  // ── Galaga achievements ──────────────────────────────────────────

  'prog.galaga.firstHit':                { es: 'Primer impacto',               en: 'First hit' },
  'prog.galaga.firstHit.desc':           { es: 'Destruye tu primer enemigo',   en: 'Destroy your first enemy' },
  'prog.galaga.wave10':                  { es: 'Piloto veterano',              en: 'Veteran pilot' },
  'prog.galaga.wave10.desc':             { es: 'Alcanza la oleada 10',         en: 'Reach wave 10' },
  'prog.galaga.master':                  { es: 'As del Galaga',                en: 'Galaga ace' },
  'prog.galaga.master.desc':             { es: 'Consigue 50.000 puntos',       en: 'Score 50,000 points' },

  // ── Frogger achievements ─────────────────────────────────────────

  'prog.frogger.firstCross':             { es: 'Primer cruce',                 en: 'First crossing' },
  'prog.frogger.firstCross.desc':        { es: 'Cruza la carretera una vez',   en: 'Cross the road once' },
  'prog.frogger.riverKing':              { es: 'Rey del río',                  en: 'River king' },
  'prog.frogger.riverKing.desc':         { es: 'Alcanza el nivel 5',           en: 'Reach level 5' },
  'prog.frogger.legend':                 { es: 'Rana legendaria',              en: 'Frog legend' },
  'prog.frogger.legend.desc':            { es: 'Consigue 10.000 puntos',       en: 'Score 10,000 points' },

  // ── Tetris achievements ──────────────────────────────────────────

  'prog.tetris.firstLine':               { es: 'Primera línea',                en: 'First line' },
  'prog.tetris.firstLine.desc':          { es: 'Limpia tu primera línea',      en: 'Clear your first line' },
  'prog.tetris.lines50':                 { es: '50 líneas',                    en: '50 lines' },
  'prog.tetris.lines50.desc':            { es: 'Limpia 50 líneas',             en: 'Clear 50 lines' },
  'prog.tetris.master':                  { es: 'Maestro del Tetris',           en: 'Tetris master' },
  'prog.tetris.master.desc':             { es: 'Limpia 100 líneas',            en: 'Clear 100 lines' },

  // ── Pac-Man achievements ─────────────────────────────────────────

  'prog.pacman.firstDot':                { es: 'Primer punto',                 en: 'First dot' },
  'prog.pacman.firstDot.desc':           { es: 'Come tu primer punto',         en: 'Eat your first dot' },
  'prog.pacman.ghostHunter':             { es: 'Cazafantasmas',                en: 'Ghost hunter' },
  'prog.pacman.ghostHunter.desc':        { es: 'Come un fantasma con poder',   en: 'Eat a ghost with power pellet' },
  'prog.pacman.legend':                  { es: 'Leyenda del Pac-Man',          en: 'Pac-Man legend' },
  'prog.pacman.legend.desc':             { es: 'Consigue 10.000 puntos',       en: 'Score 10,000 points' },

  // ── Donkey Kong achievements ─────────────────────────────────────

  'prog.donkeykong.firstPlatform':       { es: 'Primer nivel',                 en: 'First level' },
  'prog.donkeykong.firstPlatform.desc':  { es: 'Completa el nivel 1',          en: 'Complete level 1' },
  'prog.donkeykong.barrelDodger':        { es: 'Esquivabarriles',              en: 'Barrel dodger' },
  'prog.donkeykong.barrelDodger.desc':   { es: 'Alcanza el nivel 5',           en: 'Reach level 5' },
  'prog.donkeykong.conqueror':           { es: 'Conquistador de Kong',         en: 'Kong conqueror' },
  'prog.donkeykong.conqueror.desc':      { es: 'Completa todos los niveles',   en: 'Complete all levels' },

  // ── Missile Command achievements ─────────────────────────────────

  'prog.missile.firstSave':              { es: 'Primera defensa',              en: 'First defense' },
  'prog.missile.firstSave.desc':         { es: 'Sobrevive a la primera oleada',en: 'Survive the first wave' },
  'prog.missile.master':                 { es: 'Comandante de misiles',        en: 'Missile commander' },
  'prog.missile.master.desc':            { es: 'Alcanza la oleada 10',         en: 'Reach wave 10' },
  'prog.missile.lastDefense':            { es: 'Última defensa',               en: 'Last defense' },
  'prog.missile.lastDefense.desc':       { es: 'Alcanza la oleada 20',         en: 'Reach wave 20' },

  // ── Platformer achievements ──────────────────────────────────────

  'prog.platformer.firstLevel':          { es: 'Primer nivel',                 en: 'First level' },
  'prog.platformer.firstLevel.desc':     { es: 'Completa el nivel 1',          en: 'Complete level 1' },
  'prog.platformer.pro':                 { es: 'Plataformas pro',              en: 'Platform pro' },
  'prog.platformer.pro.desc':            { es: 'Completa el nivel 5',          en: 'Complete level 5' },
  'prog.platformer.speedRunner':         { es: 'Corredor',                     en: 'Speed runner' },
  'prog.platformer.speedRunner.desc':    { es: 'Completa todos los niveles',   en: 'Complete all levels' },

  // ── Fancy Pants achievements ─────────────────────────────────────

  'prog.fancy.firstLevel':               { es: 'Paso elegante',                en: 'Fancy step' },
  'prog.fancy.firstLevel.desc':          { es: 'Completa el nivel 1',          en: 'Complete level 1' },
  'prog.fancy.runner':                   { es: 'Corredor elegante',            en: 'Fancy runner' },
  'prog.fancy.runner.desc':              { es: 'Completa el nivel 5',          en: 'Complete level 5' },
  'prog.fancy.wallJump':                { es: 'Maestro de pared',             en: 'Wall jump master' },
  'prog.fancy.wallJump.desc':           { es: 'Completa todos los niveles',   en: 'Complete all levels' },

  // ── Coop Platformer achievements ─────────────────────────────────

  'prog.coop.firstLevel':                { es: 'Primera cooperación',          en: 'First cooperation' },
  'prog.coop.firstLevel.desc':           { es: 'Completa el nivel 1',          en: 'Complete level 1' },
  'prog.coop.pro':                       { es: 'Compañeros expertos',          en: 'Expert partners' },
  'prog.coop.pro.desc':                  { es: 'Completa el nivel 5',          en: 'Complete level 5' },
  'prog.coop.masters':                   { es: 'Fuego y agua maestros',        en: 'Fire and water masters' },
  'prog.coop.masters.desc':              { es: 'Completa todos los niveles',   en: 'Complete all levels' },

  // ── Trick Quiz achievements ──────────────────────────────────────

  'prog.quiz.firstWin':                  { es: 'Primera victoria',             en: 'First victory' },
  'prog.quiz.firstWin.desc':             { es: 'Gana tu primera partida',      en: 'Win your first game' },
  'prog.quiz.trickster':                 { es: 'Tramposo',                     en: 'Trickster' },
  'prog.quiz.trickster.desc':            { es: 'Gana 3 partidas seguidas',     en: 'Win 3 games in a row' },
  'prog.quiz.master':                    { es: 'Maestro del quiz',             en: 'Quiz master' },
  'prog.quiz.master.desc':               { es: 'Gana 10 partidas',             en: 'Win 10 games' },

  // ── Papa's Pizzeria achievements ─────────────────────────────────

  'prog.papa.firstPizza':                { es: 'Primera pizza',                en: 'First pizza' },
  'prog.papa.firstPizza.desc':           { es: 'Completa tu primer día',       en: 'Complete your first day' },
  'prog.papa.chef':                      { es: 'Chef pizzero',                 en: 'Pizza chef' },
  'prog.papa.chef.desc':                 { es: 'Alcanza el día 10',            en: 'Reach day 10' },
  'prog.papa.legend':                    { es: 'Leyenda de la pizza',          en: 'Pizza legend' },
  'prog.papa.legend.desc':               { es: 'Consigue 500 puntos',          en: 'Score 500 points' },

  // ── Stick RPG achievements ───────────────────────────────────────

  'prog.stickrpg.firstDay':              { es: 'Primer día',                   en: 'First day' },
  'prog.stickrpg.firstDay.desc':         { es: 'Sobrevive al día 1',           en: 'Survive day 1' },
  'prog.stickrpg.rich':                  { es: 'Multimillonario',              en: 'Stick millionaire' },
  'prog.stickrpg.rich.desc':             { es: 'Alcanza 10.000 de oro',        en: 'Reach 10,000 gold' },
  'prog.stickrpg.legend':                { es: 'Leyenda del RPG',              en: 'RPG legend' },
  'prog.stickrpg.legend.desc':           { es: 'Alcanza el día 30',            en: 'Reach day 30' },

  // ── Crush the Castle achievements ────────────────────────────────

  'prog.crush.firstCastle':              { es: 'Primer castillo',              en: 'First castle' },
  'prog.crush.firstCastle.desc':         { es: 'Completa el nivel 1',          en: 'Complete level 1' },
  'prog.crush.crusher':                  { es: 'Aplastacastillos',             en: 'Castle crusher' },
  'prog.crush.crusher.desc':             { es: 'Completa el nivel 10',         en: 'Complete level 10' },
  'prog.crush.expert':                   { es: 'Experto en demoliciones',      en: 'Demolition expert' },
  'prog.crush.expert.desc':              { es: 'Completa el nivel 20',         en: 'Complete level 20' },

  // ── Bowman achievements ──────────────────────────────────────────

  'prog.bowman.firstShot':               { es: 'Primer disparo',               en: 'First shot' },
  'prog.bowman.firstShot.desc':          { es: 'Gana tu primera ronda',        en: 'Win your first round' },
  'prog.bowman.sharpshooter':            { es: 'Tirador certero',              en: 'Sharpshooter' },
  'prog.bowman.sharpshooter.desc':       { es: 'Gana 5 rondas',                en: 'Win 5 rounds' },
  'prog.bowman.legend':                  { es: 'Leyenda del arco',             en: 'Bow legend' },
  'prog.bowman.legend.desc':             { es: 'Consigue 50 puntos',           en: 'Score 50 points' },

  // ── Bloons TD achievements ───────────────────────────────────────

  'prog.bloons.firstBloon':              { es: 'Primer globo',                 en: 'First bloon' },
  'prog.bloons.firstBloon.desc':         { es: 'Revienta tu primer globo',     en: 'Pop your first bloon' },
  'prog.bloons.slayer':                  { es: 'Globo asesino',                en: 'Bloon slayer' },
  'prog.bloons.slayer.desc':             { es: 'Alcanza la oleada 10',         en: 'Reach wave 10' },
  'prog.bloons.master':                  { es: 'Maestro TD',                   en: 'TD master' },
  'prog.bloons.master.desc':             { es: 'Alcanza la oleada 20',         en: 'Reach wave 20' },

  // ── Territory War achievements ───────────────────────────────────

  'prog.territory.firstVictory':         { es: 'Primera victoria',             en: 'First victory' },
  'prog.territory.firstVictory.desc':    { es: 'Gana tu primera batalla',      en: 'Win your first battle' },
  'prog.territory.veteran':              { es: 'Veterano de guerra',           en: 'War veteran' },
  'prog.territory.veteran.desc':         { es: 'Gana 5 batallas',              en: 'Win 5 battles' },
  'prog.territory.legend':               { es: 'Leyenda del territorio',       en: 'Territory legend' },
  'prog.territory.legend.desc':          { es: 'Gana 10 batallas',             en: 'Win 10 battles' },

  // ── Swords and Souls achievements ────────────────────────────────

  'prog.swords.firstWave':               { es: 'Primera oleada',               en: 'First wave' },
  'prog.swords.firstWave.desc':          { es: 'Derrota la oleada 1',          en: 'Defeat wave 1' },
  'prog.swords.wave10':                  { es: 'Guerrero veterano',            en: 'Veteran warrior' },
  'prog.swords.wave10.desc':             { es: 'Alcanza la oleada 10',         en: 'Reach wave 10' },
  'prog.swords.legend':                  { es: 'Leyenda de espadas',           en: 'Swords legend' },
  'prog.swords.legend.desc':             { es: 'Alcanza la oleada 20',         en: 'Reach wave 20' },

  // ── Henry Stickmin achievements ──────────────────────────────────

  'prog.henry.firstEnding':              { es: 'Primer final',                 en: 'First ending' },
  'prog.henry.firstEnding.desc':         { es: 'Encuentra tu primer final',    en: 'Find your first ending' },
  'prog.henry.collector':                { es: 'Coleccionista de finales',     en: 'Ending collector' },
  'prog.henry.collector.desc':           { es: 'Encuentra 5 finales',          en: 'Find 5 endings' },
  'prog.henry.completionist':            { es: 'Completista',                  en: 'Completionist' },
  'prog.henry.completionist.desc':       { es: 'Encuentra 10 finales',         en: 'Find 10 endings' },

  'registry.breakout.title':  { es: 'Breakout',                       en: 'Breakout' },
  'registry.breakout.tagline':{ es: 'Rebotes y destrucción de ladrillos', en: 'Bouncing and brick destruction' },
  'registry.snake.title':     { es: 'Snake',                          en: 'Snake' },
  'registry.snake.tagline':   { es: 'Movimiento en cuadrícula y colisión propia', en: 'Grid movement and self-collision' },
  'registry.pong.title':      { es: 'Pong',                           en: 'Pong' },
  'registry.pong.tagline':    { es: 'Rebote con ángulo variable vs. IA', en: 'Angle-based bounce vs. AI' },
  'registry.flappy-bird.title':   { es: 'Flappy Bird',                en: 'Flappy Bird' },
  'registry.flappy-bird.tagline': { es: 'Gravedad constante y scroll infinito', en: 'Constant gravity and infinite scroll' },
  'registry.asteroids.title': { es: 'Asteroids',                      en: 'Asteroids' },
  'registry.asteroids.tagline':{ es: 'Física de nave: empuje, fricción y wraparound', en: 'Ship physics: thrust, friction, wraparound' },
  'registry.platformer.title':   { es: 'Platformer',                  en: 'Platformer' },
  'registry.platformer.tagline': { es: 'Tilemap, colisión pixel-perfect y cámara con seguimiento', en: 'Tilemap, pixel-perfect collision, tracking camera' },
  'registry.fancy-pants.title':   { es: 'Fancy Pants',                en: 'Fancy Pants' },
  'registry.fancy-pants.tagline': { es: 'Movimiento fluido, hang time y salto en pared', en: 'Fluid movement, hang time, wall jump' },
  'registry.coop-platformer.title':   { es: 'Fuego y Agua',           en: 'Fire and Water' },
  'registry.coop-platformer.tagline': { es: 'Cooperativo local: plataforma móvil y palanca', en: 'Local co-op: moving platforms and levers' },
  'registry.trick-quiz.title':   { es: 'Trivia Trampa',               en: 'Trick Quiz' },
  'registry.trick-quiz.tagline': { es: 'Máquina de estados: preguntas trampa y zonas ocultas', en: 'State machine: trick questions and hidden zones' },
  'registry.papa-pizzeria.title':   { es: "Papa's Pizzeria",          en: "Papa's Pizzeria" },
  'registry.papa-pizzeria.tagline': { es: 'Colas, temporizadores y multitarea culinaria', en: 'Queues, timers, and culinary multitasking' },
  'registry.stick-rpg.title':   { es: 'Stick RPG',                    en: 'Stick RPG' },
  'registry.stick-rpg.tagline': { es: 'Días, energía, diálogos y cambio de escenas', en: 'Days, energy, dialogues, scene switching' },
  'registry.crush-the-castle.title':   { es: 'Crush the Castle',      en: 'Crush the Castle' },
  'registry.crush-the-castle.tagline': { es: 'Proyectiles con física en estructuras', en: 'Physics projectiles on structures' },
  'registry.bowman.title':   { es: 'Bowman',                          en: 'Bowman' },
  'registry.bowman.tagline': { es: 'Tiro parabólico con viento',      en: 'Parabolic shot with wind' },
  'registry.bloons-td.title':{ es: 'Bloons TD',                       en: 'Bloons TD' },
  'registry.bloons-td.tagline':{ es: 'Waypoints + torres defensivas', en: 'Waypoints + defensive towers' },
  'registry.territory-war.title':   { es: 'Territory War',            en: 'Territory War' },
  'registry.territory-war.tagline': { es: 'IA de bots, turnos y captura de territorio', en: 'Bot AI, turns, and territory capture' },
  'registry.swords-and-souls.title':   { es: 'Swords and Souls',      en: 'Swords and Souls' },
  'registry.swords-and-souls.tagline': { es: 'Entrenamiento, combate por turnos y subida de nivel', en: 'Training, turn-based combat, leveling up' },
  'registry.henry-stickmin.title':   { es: 'Henry Stickmin',          en: 'Henry Stickmin' },
  'registry.henry-stickmin.tagline': { es: 'Árbol de decisiones, finales múltiples y humor', en: 'Decision tree, multiple endings, humor' },

  // ── Registro: juegos retro/arcade ───────────────────────────────────────

  'registry.space-invaders.title':    { es: 'Space Invaders',           en: 'Space Invaders' },
  'registry.space-invaders.tagline':  { es: 'Disparos verticales con oleadas de aliens', en: 'Vertical shooter with alien waves' },
  'registry.centipede.title':         { es: 'Centipede',                en: 'Centipede' },
  'registry.centipede.tagline':       { es: 'Cienpiés serpenteante y hongos', en: 'Serpentine centipede and mushrooms' },
  'registry.missile-command.title':   { es: 'Missile Command',          en: 'Missile Command' },
  'registry.missile-command.tagline': { es: 'Defensa antimisiles con el ratón', en: 'Anti-missile defense with mouse aim' },
  'registry.galaga.title':            { es: 'Galaga',                   en: 'Galaga' },
  'registry.galaga.tagline':          { es: 'Formaciones y bombardeo en picada', en: 'Formations and dive-bomb attacks' },
  'registry.frogger.title':           { es: 'Frogger',                  en: 'Frogger' },
  'registry.frogger.tagline':         { es: 'Cruza la carretera y el río', en: 'Cross the road and the river' },
  'registry.tetris.title':            { es: 'Tetris',                   en: 'Tetris' },
  'registry.tetris.tagline':          { es: 'Piezas que caen, rotación y líneas', en: 'Falling pieces, rotation, line clearing' },
  'registry.pac-man.title':           { es: 'Pac-Man',                  en: 'Pac-Man' },
  'registry.pac-man.tagline':         { es: 'Laberinto, puntos y fantasmas con IA', en: 'Maze, dots, and ghost AI' },
  'registry.donkey-kong.title':       { es: 'Donkey Kong',              en: 'Donkey Kong' },
  'registry.donkey-kong.tagline':     { es: 'Barriles, escaleras y rescate', en: 'Barrels, ladders, and rescue' },

  'registry.mario-like.title':        { es: 'Super Mario Bros',           en: 'Super Mario Bros' },
  'registry.mario-like.tagline':      { es: 'Scroll lateral, power-ups y enemigos clásicos', en: 'Side-scrolling platformer with power-ups' },

  'registry.contra-like.title':        { es: 'Contra',                          en: 'Contra' },
  'registry.contra-like.tagline':      { es: 'Run & gun con scroll lateral, power-ups y jefes', en: 'Run & gun with side-scrolling, power-ups and bosses' },

  // ── Contra-like achievements ───────────────────────────────────────────

  'prog.contra-like.first-stage':           { es: 'Primera etapa',                 en: 'First stage' },
  'prog.contra-like.first-stage.desc':      { es: 'Completa la etapa 1',           en: 'Complete stage 1' },
  'prog.contra-like.game-cleared':          { es: 'Juego completado',              en: 'Game cleared' },
  'prog.contra-like.game-cleared.desc':     { es: 'Completa las 3 etapas',         en: 'Complete all 3 stages' },
  'prog.contra-like.contra-master':         { es: 'Maestro de Contra',            en: 'Contra master' },
  'prog.contra-like.contra-master.desc':    { es: 'Alcanza la etapa 3',           en: 'Reach stage 3' },

  // ── Registro: Metroid-like ───────────────────────────────────────────────

  'registry.metroid-like.title':    { es: 'Metroid',                          en: 'Metroid' },
  'registry.metroid-like.tagline':  { es: 'Exploración no lineal con power-ups, mapa y jefe final', en: 'Non-linear exploration with power-ups, map and final boss' },

  // ── Metroid-like achievements ────────────────────────────────────────────

  'prog.metroid-like.boss-slayer':            { es: 'Matadragones',                 en: 'Dragon slayer' },
  'prog.metroid-like.boss-slayer.desc':       { es: 'Derrota al jefe final',        en: 'Defeat the final boss' },
  'prog.metroid-like.explorer':               { es: 'Explorador',                  en: 'Explorer' },
  'prog.metroid-like.explorer.desc':          { es: 'Encuentra el Space Jump',     en: 'Find the Space Jump' },
  'prog.metroid-like.demolition':             { es: 'Demolición',                  en: 'Demolition' },
  'prog.metroid-like.demolition.desc':        { es: 'Encuentra las bombas',        en: 'Find the bombs' },

  // ── Registro: Space Harrier-like ──────────────────────────────────────────

  'registry.space-harrier.title':    { es: 'Space Harrier',                    en: 'Space Harrier' },
  'registry.space-harrier.tagline':  { es: 'Pseudo-3D shooter sobre raíles con enemigos y jefes', en: 'Pseudo-3D on-rails shooter with enemies and bosses' },

  // ── Space Harrier achievements ───────────────────────────────────────────

  'prog.space-harrier.first-clear':            { es: 'Primer vuelo',                  en: 'First flight' },
  'prog.space-harrier.first-clear.desc':       { es: 'Completa la etapa 1',           en: 'Complete stage 1' },
  'prog.space-harrier.harrier-ace':            { es: 'As del espacio',               en: 'Space ace' },
  'prog.space-harrier.harrier-ace.desc':       { es: 'Completa las 3 etapas',         en: 'Complete all 3 stages' },
  'prog.space-harrier.sky-warrior':            { es: 'Guerrero del cielo',           en: 'Sky warrior' },
  'prog.space-harrier.sky-warrior.desc':       { es: 'Alcanza la etapa 3',           en: 'Reach stage 3' },
  'prog.space-harrier.perfect-run':            { es: 'Vuelo perfecto',               en: 'Perfect flight' },
  'prog.space-harrier.perfect-run.desc':       { es: 'Termina con 3 vidas',           en: 'Finish with 3 lives' },

  // ── Registro: OutRun-like ───────────────────────────────────────────────

  'registry.outrun-like.title':    { es: 'OutRun',                            en: 'OutRun' },
  'registry.outrun-like.tagline':  { es: 'Carreras top-down con tráfico, derrapes y checkpoints', en: 'Top-down racing with traffic, drifting and checkpoints' },

  // ── OutRun-like achievements ────────────────────────────────────────────

  'prog.outrun-like.first-race':             { es: 'Primera carrera',                en: 'First race' },
  'prog.outrun-like.first-race.desc':        { es: 'Completa la etapa 1',            en: 'Complete stage 1' },
  'prog.outrun-like.road-warrior':           { es: 'Guerrero de la carretera',       en: 'Road warrior' },
  'prog.outrun-like.road-warrior.desc':      { es: 'Completa las 3 etapas',          en: 'Complete all 3 stages' },
  'prog.outrun-like.arcade-king':            { es: 'Rey del arcade',                 en: 'Arcade king' },
  'prog.outrun-like.arcade-king.desc':       { es: 'Alcanza la etapa 3',             en: 'Reach stage 3' },
  'prog.outrun-like.near-miss-pro':          { es: 'Experto en apuros',              en: 'Near miss pro' },
  'prog.outrun-like.near-miss-pro.desc':     { es: 'Consigue 10 near misses',        en: 'Get 10 near misses' },
  'prog.outrun-like.speed-demon':            { es: 'Demonio de la velocidad',        en: 'Speed demon' },
  'prog.outrun-like.speed-demon.desc':       { es: 'Alcanza la velocidad máxima',    en: 'Reach maximum speed' },

  // ── Registro: Street Fighter ────────────────────────────────────────────

  'registry.street-fighter.title':    { es: 'Street Fighter',                  en: 'Street Fighter' },
  'registry.street-fighter.tagline':  { es: 'Pelea 1v1 local y vs IA con 4 personajes, supers y rounds', en: 'Local 1v1 and vs AI fighting with 4 characters, supers and rounds' },

  // ── Registro: Golden Axe-like ───────────────────────────────────────────

  'registry.golden-axe.title':    { es: 'Golden Axe',                         en: 'Golden Axe' },
  'registry.golden-axe.tagline':  { es: "Beat'em up con 3 personajes, magia, combos y jefes", en: 'Beat\'em up with 3 characters, magic, combos and bosses' },

  // ── Registro: Guitar Hero-like ─────────────────────────────────────────

  'registry.guitar-hero.title':    { es: 'Guitar Hero',                    en: 'Guitar Hero' },
  'registry.guitar-hero.tagline':  { es: 'Juego de ritmo con 5 cuerdas, combo y canciones procedurales', en: 'Rhythm game with 5 strings, combo and procedural songs' },

  // ── Registro: Bejeweled-like ───────────────────────────────────────────

  'registry.bejeweled.title':    { es: 'Bejeweled',                       en: 'Bejeweled' },
  'registry.bejeweled.tagline':  { es: 'Match-3 con gemas, cascadas y modos de juego', en: 'Match-3 with gems, cascades and game modes' },

  // ── Registro: Lemonade Stand-like ─────────────────────────────────────

  'registry.lemonade-stand.title':    { es: 'Lemonade Stand',               en: 'Lemonade Stand' },
  'registry.lemonade-stand.tagline':  { es: 'Tycoon de limonada con economía, clima y receta', en: 'Lemonade tycoon with economy, weather and recipe' },

  // ── Street Fighter achievements ────────────────────────────────────────

  'prog.street-fighter.firstVictory':            { es: 'Primera victoria',              en: 'First victory' },
  'prog.street-fighter.firstVictory.desc':       { es: 'Gana tu primer combate',        en: 'Win your first fight' },
  'prog.street-fighter.fightingLegend':          { es: 'Leyenda de la lucha',           en: 'Fighting legend' },
  'prog.street-fighter.fightingLegend.desc':     { es: 'Gana en dificultad Difícil',    en: 'Win on Hard difficulty' },
  'prog.street-fighter.roundFighter':            { es: 'Luchador de rondas',            en: 'Round fighter' },
  'prog.street-fighter.roundFighter.desc':       { es: 'Completa un combate (3 rounds)',en: 'Complete a match (3 rounds)' },

  // ── Golden Axe achievements ────────────────────────────────────────────

  'prog.golden-axe.first-blood':             { es: 'Primer combate',                  en: 'First combat' },
  'prog.golden-axe.first-blood.desc':        { es: 'Gana tu primer combate',          en: 'Win your first fight' },
  'prog.golden-axe.stage-master':            { es: 'Señor de las etapas',             en: 'Stage master' },
  'prog.golden-axe.stage-master.desc':       { es: 'Alcanza la etapa 2',              en: 'Reach stage 2' },
  'prog.golden-axe.game-cleared':            { es: 'Héroe de batalla',               en: 'Battle hero' },
  'prog.golden-axe.game-cleared.desc':       { es: 'Completa las 3 etapas',           en: 'Complete all 3 stages' },
  'prog.golden-axe.no-continue':             { es: 'Sin continuaciones',              en: 'No continues' },
  'prog.golden-axe.no-continue.desc':        { es: 'Completa el juego con 2+ vidas',  en: 'Finish the game with 2+ lives' },

  // ── Guitar Hero achievements ───────────────────────────────────────────

  'prog.guitar-hero.first-song':             { es: 'Primera canción',                en: 'First song' },
  'prog.guitar-hero.first-song.desc':        { es: 'Completa tu primera canción',    en: 'Complete your first song' },
  'prog.guitar-hero.rock-legend':            { es: 'Leyenda del rock',              en: 'Rock legend' },
  'prog.guitar-hero.rock-legend.desc':       { es: 'Completa dificultad Difícil',    en: 'Complete Hard difficulty' },
  'prog.guitar-hero.precision-player':       { es: 'Jugador preciso',               en: 'Precision player' },
  'prog.guitar-hero.precision-player.desc':  { es: 'Alcanza 90%+ de precisión',      en: 'Reach 90%+ accuracy' },
  'prog.guitar-hero.combo-king':             { es: 'Rey del combo',                 en: 'Combo king' },
  'prog.guitar-hero.combo-king.desc':        { es: 'Alcanza combo de 50 notas',     en: 'Reach 50-note combo' },

  // ── Bejeweled achievements ─────────────────────────────────────────────

  'prog.bejeweled.first-clear':             { es: 'Primera victoria',               en: 'First victory' },
  'prog.bejeweled.first-clear.desc':        { es: 'Completa un modo de juego',      en: 'Complete a game mode' },
  'prog.bejeweled.cascade-master':          { es: 'Maestro de cascadas',           en: 'Cascade master' },
  'prog.bejeweled.cascade-master.desc':     { es: 'Alcanza combo de 5 cascadas',    en: 'Reach 5-cascade combo' },
  'prog.bejeweled.gem-hoarder':             { es: 'Acaparador de gemas',           en: 'Gem hoarder' },
  'prog.bejeweled.gem-hoarder.desc':        { es: 'Limpia 100 gemas en total',      en: 'Clear 100 total gems' },
  'prog.bejeweled.speed-demon':             { es: 'Demonio de velocidad',           en: 'Speed demon' },
  'prog.bejeweled.speed-demon.desc':        { es: 'Gana en modo Contrarreloj',      en: 'Win in Time Attack mode' },

  // ── Lemonade Stand achievements ───────────────────────────────────────

  'prog.lemonade-stand.first-profit':        { es: 'Primera ganancia',              en: 'First profit' },
  'prog.lemonade-stand.first-profit.desc':   { es: 'Termina tu primer día',         en: 'Complete your first day' },
  'prog.lemonade-stand.lemonade-tycoon':     { es: 'Magnate de limonada',          en: 'Lemonade tycoon' },
  'prog.lemonade-stand.lemonade-tycoon.desc':{ es: 'Gana $5000 en total',           en: 'Earn $5000 total' },
  'prog.lemonade-stand.master-chef':          { es: 'Maestro limonero',             en: 'Master chef' },
  'prog.lemonade-stand.master-chef.desc':     { es: 'Alcanza 80% de reputación',    en: 'Reach 80% reputation' },
  'prog.lemonade-stand.mass-production':      { es: 'Producción en masa',           en: 'Mass production' },
  'prog.lemonade-stand.mass-production.desc': { es: 'Vende 200 vasos en total',      en: 'Sell 200 total cups' },

  // ── Desbloqueables ─────────────────────────────────────────────────────

  'prog.unlock.skinAsteroidsGold': { es: 'Nave dorada',              en: 'Golden Ship' },
  'prog.unlock.skinPacmanBlue':    { es: 'Pac-Man azul',            en: 'Blue Pac-Man' },
  'prog.unlock.skinShipNeon':      { es: 'Nave neón',               en: 'Neon Ship' },
  'prog.unlock.widePaddle':        { es: 'Paleta ancha',            en: 'Wide Paddle' },
  'prog.unlock.extraLife':         { es: 'Vida extra inicial',      en: 'Extra Starting Life' },
  'prog.unlock.modeSpeedrun':      { es: 'Modo contrarreloj',       en: 'Speedrun Mode' },
  'prog.unlock.modeEndless':       { es: 'Modo infinito',           en: 'Endless Mode' },
  'prog.unlock.modeHardcore':      { es: 'Modo hardcore',           en: 'Hardcore Mode' },
  'prog.unlock.scanlines':         { es: 'Cosmético: scanlines',    en: 'Cosmetic: Scanlines' },
  'prog.unlock.retroBorder':       { es: 'Cosmético: borde retro',  en: 'Cosmetic: Retro Border' },

};

// ══════════════════════════════════════════════════════════════════════════
//  Funciones públicas
// ══════════════════════════════════════════════════════════════════════════

/**
 * Obtiene el texto traducido para una clave.
 *
 * @param {string} key       Clave de traducción (p.ej. 'breakout.score').
 * @param {Object} [params]  Opcional. Valores para sustituir {param} en el texto.
 * @param {string} [lang]    Idioma explícito ('es'|'en'). Por defecto usa el
 *                           idioma actual de SettingsManager. Útil para
 *                           generar texto en ambos idiomas (p.ej. búsqueda).
 * @returns {string}         Texto traducido.
 */
export function t(key, params = {}, lang) {
  if (!lang) lang = SettingsManager.language; // 'es' | 'en'
  const entry = TRANSLATIONS[key];
  if (!entry) return key;

  let text = entry[lang];
  if (text == null) text = entry.es; // fallback a español
  if (text == null) return key;

  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, String(v));
  }
  return text;
}

/**
 * Recorre el DOM en busca de atributos data-i18n y reemplaza el
 * textContent de cada elemento por su traducción.
 *
 * Útil para textos estáticos del hub (menú, settings, etc.).
 * Se llama en la carga inicial y cada vez que cambia el idioma.
 */
export function applyI18n() {
  const lang = SettingsManager.language;
  const elements = document.querySelectorAll('[data-i18n]');
  for (const el of elements) {
    const key = el.getAttribute('data-i18n');
    if (!key) continue;
    const entry = TRANSLATIONS[key];
    if (!entry) continue;
    const text = entry[lang] || entry.es;
    if (text != null) el.textContent = text;
  }

  // Actualizar lang del <html>
  document.documentElement.lang = lang;

  // Traducir aria-label del settings-close
  const closeBtn = document.getElementById('settings-close');
  if (closeBtn) {
    const ariaKey = closeBtn.getAttribute('data-i18n');
    if (ariaKey) {
      const entry = TRANSLATIONS[ariaKey];
      if (entry) {
        closeBtn.setAttribute('aria-label', entry[lang] || entry.es);
      }
    }
  }

  // Traducir aria-label del settings-btn
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    const entry = TRANSLATIONS['settings.title'];
    if (entry) {
      settingsBtn.setAttribute('aria-label', entry[lang] || entry.es);
    }
  }

  // Traducir placeholder del search input
  const searchInput = document.getElementById('game-search');
  if (searchInput) {
    const key = searchInput.getAttribute('data-i18n-placeholder');
    if (key) {
      const entry = TRANSLATIONS[key];
      if (entry) {
        searchInput.placeholder = entry[lang] || entry.es;
      }
    }
  }
}

/**
 * Suscribe applyI18n a cambios de idioma en SettingsManager.
 * Devuelve la función unsubscribe por si se necesita limpiar.
 */
export function initI18n() {
  applyI18n();
  return SettingsManager.onChange('language', applyI18n);
}

/**
 * Registra traducciones de un juego en el diccionario global.
 * Mergea (Object.assign) para que las claves del juego se añadan
 * sin borrar las existentes. Si una clave ya existe, se sobrescribe
 * con la del juego (último registro gana).
 *
 * @param {Object<string, {es: string, en: string}>} translations
 */
export function registerTranslations(translations) {
  for (const key of Object.keys(translations)) {
    if (TRANSLATIONS[key]) {
      console.warn('i18n key already registered, overwriting:', key);
    }
  }
  Object.assign(TRANSLATIONS, translations);
}

/**
 * Carga dinámicamente las traducciones de un juego.
 *
 * Intenta import(`../games/${gameId}/i18n.js`). Si el archivo existe,
 * registra sus traducciones en el diccionario global. Si no existe,
 * lanza un console.warn no bloqueante.
 *
 * @param {string} gameId  ID del juego (ej. 'pong', 'breakout')
 * @returns {Promise<void>}
 */
export async function loadGameTranslations(gameId) {
  try {
    const module = await import(`../games/${gameId}/i18n.js`);
    if (module.default) {
      registerTranslations(module.default);
    }
  } catch {
    console.warn('Game i18n not found:', gameId);
  }
}
