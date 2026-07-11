/**
 * registry.js
 * Fuente única de verdad de qué juegos existen. Añadir un juego nuevo
 * significa: crear su carpeta en src/games/<id>/, exportar una clase que
 * implemente la Game Interface (ver GameEngine.js), y añadir una entrada
 * aquí. El hub (main.js) no necesita tocarse.
 */
export const GAME_REGISTRY = [
  {
    id: 'breakout',
    title: 'Breakout',
    tagline: 'Rebotes y destrucción de ladrillos',
    level: 1,
    // Import dinámico: el código del juego no se descarga hasta que se elige.
    load: () => import('./breakout/Breakout.js').then((m) => m.Breakout),
  },
  {
    id: 'snake',
    title: 'Snake',
    tagline: 'Movimiento en cuadrícula y colisión propia',
    level: 1,
    load: () => import('./snake/Snake.js').then((m) => m.Snake),
  },
  {
    id: 'pong',
    title: 'Pong',
    tagline: 'Rebote con ángulo variable vs. IA',
    level: 1,
    load: () => import('./pong/Pong.js').then((m) => m.Pong),
  },
  {
    id: 'flappy-bird',
    title: 'Flappy Bird',
    tagline: 'Gravedad constante y scroll infinito',
    level: 1,
    load: () => import('./flappy-bird/FlappyBird.js').then((m) => m.FlappyBird),
  },
  {
    id: 'asteroids',
    title: 'Asteroids',
    tagline: 'Física de nave: empuje, fricción y wraparound',
    level: 2,
    load: () => import('./asteroids/Asteroids.js').then((m) => m.Asteroids),
  },
  {
    id: 'platformer',
    title: 'Platformer',
    tagline: 'Tilemap, colisión pixel-perfect y cámara con seguimiento',
    level: 2,
    load: () => import('./platformer/Platformer.js').then((m) => m.Platformer),
  },
  {
    id: 'fancy-pants',
    title: 'Fancy Pants',
    tagline: 'Movimiento fluido, hang time y salto en pared',
    level: 2,
    load: () => import('./fancy-pants/FancyPants.js').then((m) => m.FancyPants),
  },
  {
    id: 'coop-platformer',
    title: 'Fuego y Agua',
    tagline: 'Cooperativo local: plataforma móvil y palanca',
    level: 2,
    load: () => import('./coop-platformer/CoopPlatformer.js').then((m) => m.CoopPlatformer),
  },
  {
    id: 'trick-quiz',
    title: 'Trivia Trampa',
    tagline: 'Máquina de estados: preguntas trampa y zonas ocultas',
    level: 3,
    load: () => import('./trick-quiz/TrickQuiz.js').then((m) => m.TrickQuiz),
  },
  // Próximos juegos se añaden aquí siguiendo el mismo patrón.
];
