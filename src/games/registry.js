/**
 * registry.js
 * Fuente única de verdad de qué juegos existen. Añadir un juego nuevo
 * significa: crear su carpeta en src/games/<id>/, exportar una clase que
 * implemente la Game Interface (ver GameEngine.js), y añadir una entrada
 * aquí. El hub (main.js) no necesita tocarse.
 *
 * Cada entrada puede incluir un campo opcional `test` con la configuración
 * para el smoke test (smoke_test.mjs). Sin este campo, el test usará
 * valores por defecto (300 frames, sin input).
 */
export const GAME_REGISTRY = [
  {
    id: 'breakout',
    title: 'Breakout',
    title_i18n: 'registry.breakout.title',
    tagline: 'Rebotes y destrucción de ladrillos',
    tagline_i18n: 'registry.breakout.tagline',
    level: 1,
    load: () => import('./breakout/index.js').then((m) => m.Breakout),
    test: {
      keys: [{ code: 'ArrowRight', atFrame: 10 }, { code: 'ArrowLeft', atFrame: 50 }],
      assert: (g) => { if (g.score === undefined) throw new Error('Missing score'); },
    },
  },
  {
    id: 'snake',
    title: 'Snake',
    title_i18n: 'registry.snake.title',
    tagline: 'Movimiento en cuadrícula y colisión propia',
    tagline_i18n: 'registry.snake.tagline',
    level: 1,
    load: () => import('./snake/index.js').then((m) => m.Snake),
    test: { keys: [
      { code: 'ArrowDown', atFrame: 10 }, { code: 'ArrowLeft', atFrame: 40 },
      { code: 'ArrowDown', atFrame: 120 }, { code: 'ArrowRight', atFrame: 180 },
      { code: 'ArrowUp', atFrame: 220 },
    ] },
  },
  {
    id: 'pong',
    title: 'Pong',
    title_i18n: 'registry.pong.title',
    tagline: 'Rebote con ángulo variable vs. IA',
    tagline_i18n: 'registry.pong.tagline',
    level: 1,
    load: () => import('./pong/index.js').then((m) => m.Pong),
    test: { keys: [
      { code: 'ArrowUp', atFrame: 5 }, { code: 'ArrowDown', atFrame: 100 },
      { code: 'ArrowUp', atFrame: 150 }, { code: 'ArrowDown', atFrame: 200 },
    ] },
  },
  {
    id: 'flappy-bird',
    title: 'Flappy Bird',
    title_i18n: 'registry.flappy-bird.title',
    tagline: 'Gravedad constante y scroll infinito',
    tagline_i18n: 'registry.flappy-bird.tagline',
    level: 1,
    load: () => import('./flappy-bird/index.js').then((m) => m.FlappyBird),
    test: { keys: [
      { code: 'Space', atFrame: 5 }, { code: 'Space', atFrame: 40 },
      { code: 'Space', atFrame: 80 }, { code: 'Space', atFrame: 120 },
      { code: 'Space', atFrame: 160 }, { code: 'Space', atFrame: 200 },
    ] },
  },
  {
    id: 'asteroids',
    title: 'Asteroids',
    title_i18n: 'registry.asteroids.title',
    tagline: 'Física de nave: empuje, fricción y wraparound',
    tagline_i18n: 'registry.asteroids.tagline',
    level: 2,
    load: () => import('./asteroids/index.js').then((m) => m.Asteroids),
    test: {
      frames: 400, keys: [
        { code: 'ArrowUp', atFrame: 5 }, { code: 'Space', atFrame: 30 },
        { code: 'ArrowLeft', atFrame: 80 }, { code: 'Space', atFrame: 100 },
        { code: 'ArrowRight', atFrame: 150 }, { code: 'Space', atFrame: 180 },
        { code: 'ArrowUp', atFrame: 200 },
      ],
      assert: (g) => {
        if (g.ship === undefined) throw new Error('Missing ship');
        if (g.bullets === undefined) throw new Error('Missing bullets');
      },
    },
  },
  {
    id: 'platformer',
    title: 'Platformer',
    title_i18n: 'registry.platformer.title',
    tagline: 'Tilemap, colisión pixel-perfect y cámara con seguimiento',
    tagline_i18n: 'registry.platformer.tagline',
    level: 2,
    load: () => import('./platformer/index.js').then((m) => m.Platformer),
    test: { frames: 350, keys: [
      { code: 'ArrowRight', atFrame: 5 }, { code: 'Space', atFrame: 60 },
      { code: 'ArrowRight', atFrame: 100 }, { code: 'Space', atFrame: 160 },
    ] },
  },
  {
    id: 'fancy-pants',
    title: 'Fancy Pants',
    title_i18n: 'registry.fancy-pants.title',
    tagline: 'Movimiento fluido, hang time y salto en pared',
    tagline_i18n: 'registry.fancy-pants.tagline',
    level: 2,
    load: () => import('./fancy-pants/index.js').then((m) => m.FancyPants),
    test: { frames: 350, keys: [
      { code: 'ArrowRight', atFrame: 5 }, { code: 'Space', atFrame: 90 },
      { code: 'ArrowRight', atFrame: 150 }, { code: 'Space', atFrame: 155 },
    ] },
  },
  {
    id: 'coop-platformer',
    title: 'Fuego y Agua',
    title_i18n: 'registry.coop-platformer.title',
    tagline: 'Cooperativo local: plataforma móvil y palanca',
    tagline_i18n: 'registry.coop-platformer.tagline',
    level: 2,
    load: () => import('./coop-platformer/index.js').then((m) => m.CoopPlatformer),
    test: { frames: 350, keys: [
      { code: 'KeyD', atFrame: 5 }, { code: 'ArrowRight', atFrame: 5 },
      { code: 'KeyW', atFrame: 80 }, { code: 'ArrowUp', atFrame: 80 },
    ] },
  },
  {
    id: 'trick-quiz',
    title: 'Trivia Trampa',
    title_i18n: 'registry.trick-quiz.title',
    tagline: 'Máquina de estados: preguntas trampa y zonas ocultas',
    tagline_i18n: 'registry.trick-quiz.tagline',
    level: 3,
    load: () => import('./trick-quiz/index.js').then((m) => m.TrickQuiz),
    test: { frames: 350, clicks: [
      { atFrame: 30, x: 642, y: 282 }, { atFrame: 100, x: 400, y: 300 },
    ] },
  },
  {
    id: 'papa-pizzeria',
    title: "Papa's Pizzeria",
    title_i18n: 'registry.papa-pizzeria.title',
    tagline: 'Colas, temporizadores y multitarea culinaria',
    tagline_i18n: 'registry.papa-pizzeria.tagline',
    level: 3,
    load: () => import('./papa-pizzeria/index.js').then((m) => m.PapaPizzeria),
    test: { frames: 350, clicks: [
      { atFrame: 30, x: 100, y: 100 }, { atFrame: 60, x: 200, y: 300 },
      { atFrame: 120, x: 350, y: 200 },
    ] },
  },
  {
    id: 'stick-rpg',
    title: 'Stick RPG',
    title_i18n: 'registry.stick-rpg.title',
    tagline: 'Días, energía, diálogos y cambio de escenas',
    tagline_i18n: 'registry.stick-rpg.tagline',
    level: 3,
    load: () => import('./stick-rpg/index.js').then((m) => m.StickRPG),
    test: { frames: 350, clicks: [
      { atFrame: 30, x: 200, y: 300 }, { atFrame: 100, x: 400, y: 500 },
      { atFrame: 180, x: 300, y: 350 },
    ] },
  },
  {
    id: 'crush-the-castle',
    title: 'Crush the Castle',
    title_i18n: 'registry.crush-the-castle.title',
    tagline: 'Proyectiles con física en estructuras',
    tagline_i18n: 'registry.crush-the-castle.tagline',
    level: 4,
    load: () => import('./crush-the-castle/index.js').then((m) => m.CrushTheCastle),
    test: { frames: 350, keys: [
      { code: 'ArrowUp', atFrame: 5 }, { code: 'Space', atFrame: 15 },
      { code: 'ArrowUp', atFrame: 100 }, { code: 'Space', atFrame: 120 },
      { code: 'ArrowUp', atFrame: 200 }, { code: 'Space', atFrame: 220 },
    ] },
  },
  {
    id: 'bowman',
    title: 'Bowman',
    title_i18n: 'registry.bowman.title',
    tagline: 'Tiro parabólico con viento',
    tagline_i18n: 'registry.bowman.tagline',
    level: 4,
    load: () => import('./bowman/index.js').then((m) => m.Bowman),
    test: {
      frames: 350, keys: [
        { code: 'Space', atFrame: 5 }, { code: 'Space', atFrame: 100 },
        { code: 'Space', atFrame: 180 },
      ],
      assert: (g) => { if (g.player1HP === undefined) throw new Error('Missing player HP'); },
    },
  },
  {
    id: 'bloons-td',
    title: 'Bloons TD',
    title_i18n: 'registry.bloons-td.title',
    tagline: 'Waypoints + torres defensivas',
    tagline_i18n: 'registry.bloons-td.tagline',
    level: 4,
    load: () => import('./bloons-td/index.js').then((m) => m.BloonsTD),
    test: {
      frames: 400, keys: [
        { code: 'Space', atFrame: 5 }, { code: 'Digit1', atFrame: 30 },
        { code: 'Space', atFrame: 100 }, { code: 'Space', atFrame: 200 },
      ], clicks: [
        { atFrame: 150, x: 400, y: 270 }, { atFrame: 300, x: 500, y: 200 },
      ],
      assert: (g) => {
        if (g.money === undefined) throw new Error('Missing money');
        if (g.lives === undefined) throw new Error('Missing lives');
      },
    },
  },
  {
    id: 'territory-war',
    title: 'Territory War',
    title_i18n: 'registry.territory-war.title',
    tagline: 'IA de bots, turnos y captura de territorio',
    tagline_i18n: 'registry.territory-war.tagline',
    level: 4,
    load: () => import('./territory-war/index.js').then((m) => m.TerritoryWar),
    test: {
      frames: 400, keys: [
        { code: 'Space', atFrame: 10 }, { code: 'Space', atFrame: 30 },
      ], clicks: [
        { atFrame: 50, x: 100, y: 200 }, { atFrame: 200, x: 50, y: 450 },
      ],
      assert: (g) => {
        if (g.units === undefined) throw new Error('Missing units');
        if (g.turnNumber === undefined) throw new Error('Missing turnNumber');
      },
    },
  },
  {
    id: 'swords-and-souls',
    title: 'Swords and Souls',
    title_i18n: 'registry.swords-and-souls.title',
    tagline: 'Entrenamiento, combate por turnos y subida de nivel',
    tagline_i18n: 'registry.swords-and-souls.tagline',
    level: 5,
    load: () => import('./swords-and-souls/index.js').then((m) => m.SwordsAndSouls),
    test: {
      frames: 400, clicks: [
        { atFrame: 20, x: 100, y: 100 }, { atFrame: 60, x: 300, y: 200 },
        { atFrame: 100, x: 400, y: 300 }, { atFrame: 150, x: 200, y: 400 },
        { atFrame: 250, x: 500, y: 350 },
      ],
      assert: (g) => {
        if (g.player === undefined) throw new Error('Missing player');
        if (g.currentScene === undefined) throw new Error('Missing currentScene');
      },
    },
  },
  {
    id: 'henry-stickmin',
    title: 'Henry Stickmin',
    title_i18n: 'registry.henry-stickmin.title',
    tagline: 'Árbol de decisiones, finales múltiples y humor',
    tagline_i18n: 'registry.henry-stickmin.tagline',
    level: 5,
    load: () => import('./henry-stickmin/index.js').then((m) => m.HenryStickmin),
    test: {
      frames: 400, keys: [
        { code: 'Space', atFrame: 10 }, { code: 'Space', atFrame: 40 },
        { code: 'Space', atFrame: 80 }, { code: 'Space', atFrame: 150 },
        { code: 'Space', atFrame: 200 },
      ],
      assert: (g) => {
        if (g.sceneId === undefined) throw new Error('Missing sceneId');
        if (g.phase === undefined) throw new Error('Missing phase');
      },
    },
  },
  // ── Juegos retro/arcade ───────────────────────────────────────────────────

  {
    id: 'space-invaders',
    title: 'Space Invaders',
    title_i18n: 'registry.space-invaders.title',
    tagline: 'Disparos verticales con oleadas de aliens',
    tagline_i18n: 'registry.space-invaders.tagline',
    level: 1,
    load: () => import('./space-invaders/index.js').then((m) => m.SpaceInvaders),
    test: {
      frames: 350, keys: [
        { code: 'ArrowRight', atFrame: 5 }, { code: 'Space', atFrame: 30 },
        { code: 'ArrowRight', atFrame: 80 }, { code: 'Space', atFrame: 100 },
        { code: 'ArrowLeft', atFrame: 150 }, { code: 'Space', atFrame: 200 },
      ],
      assert: (g) => {
        if (g.score === undefined) throw new Error('Missing score');
        if (g.lives === undefined) throw new Error('Missing lives');
      },
    },
  },
  {
    id: 'centipede',
    title: 'Centipede',
    title_i18n: 'registry.centipede.title',
    tagline: 'Cienpiés serpenteante y hongos',
    tagline_i18n: 'registry.centipede.tagline',
    level: 1,
    load: () => import('./centipede/index.js').then((m) => m.Centipede),
    test: {
      frames: 350, keys: [
        { code: 'ArrowRight', atFrame: 5 }, { code: 'Space', atFrame: 30 },
        { code: 'ArrowLeft', atFrame: 80 }, { code: 'Space', atFrame: 100 },
      ],
      assert: (g) => {
        if (g.score === undefined) throw new Error('Missing score');
        if (g.centipede === undefined) throw new Error('Missing centipede');
      },
    },
  },
  {
    id: 'missile-command',
    title: 'Missile Command',
    title_i18n: 'registry.missile-command.title',
    tagline: 'Defensa antimisiles con el ratón',
    tagline_i18n: 'registry.missile-command.tagline',
    level: 1,
    load: () => import('./missile-command/index.js').then((m) => m.MissileCommand),
    test: {
      frames: 350, clicks: [
        { atFrame: 30, x: 200, y: 200 }, { atFrame: 80, x: 400, y: 300 },
        { atFrame: 150, x: 300, y: 250 },
      ],
      assert: (g) => {
        if (g.score === undefined) throw new Error('Missing score');
        if (g.cities === undefined) throw new Error('Missing cities');
      },
    },
  },
  {
    id: 'galaga',
    title: 'Galaga',
    title_i18n: 'registry.galaga.title',
    tagline: 'Formaciones y bombardeo en picada',
    tagline_i18n: 'registry.galaga.tagline',
    level: 1,
    load: () => import('./galaga/index.js').then((m) => m.Galaga),
    test: {
      frames: 350, keys: [
        { code: 'ArrowRight', atFrame: 5 }, { code: 'Space', atFrame: 30 },
        { code: 'ArrowLeft', atFrame: 80 }, { code: 'Space', atFrame: 100 },
      ],
      assert: (g) => {
        if (g.score === undefined) throw new Error('Missing score');
        if (g.enemies === undefined) throw new Error('Missing enemies');
      },
    },
  },
  {
    id: 'frogger',
    title: 'Frogger',
    title_i18n: 'registry.frogger.title',
    tagline: 'Cruza la carretera y el río',
    tagline_i18n: 'registry.frogger.tagline',
    level: 1,
    load: () => import('./frogger/index.js').then((m) => m.Frogger),
    test: {
      frames: 350, keys: [
        { code: 'ArrowUp', atFrame: 5 }, { code: 'ArrowUp', atFrame: 50 },
        { code: 'ArrowLeft', atFrame: 100 }, { code: 'ArrowUp', atFrame: 150 },
      ],
      assert: (g) => {
        if (g.score === undefined) throw new Error('Missing score');
        if (g.frog === undefined) throw new Error('Missing frog');
      },
    },
  },
  {
    id: 'tetris',
    title: 'Tetris',
    title_i18n: 'registry.tetris.title',
    tagline: 'Piezas que caen, rotación y líneas',
    tagline_i18n: 'registry.tetris.tagline',
    level: 3,
    load: () => import('./tetris/index.js').then((m) => m.Tetris),
    test: {
      frames: 350, keys: [
        { code: 'ArrowLeft', atFrame: 10 }, { code: 'ArrowDown', atFrame: 30 },
        { code: 'ArrowRight', atFrame: 60 }, { code: 'ArrowUp', atFrame: 80 },
        { code: 'Space', atFrame: 150 }, { code: 'KeyP', atFrame: 200 },
        { code: 'KeyP', atFrame: 210 },
      ],
      assert: (g) => {
        if (g.score === undefined) throw new Error('Missing score');
        if (g.grid === undefined) throw new Error('Missing grid');
      },
    },
  },
  {
    id: 'pac-man',
    title: 'Pac-Man',
    title_i18n: 'registry.pac-man.title',
    tagline: 'Laberinto, puntos y fantasmas con IA',
    tagline_i18n: 'registry.pac-man.tagline',
    level: 3,
    load: () => import('./pac-man/index.js').then((m) => m.PacMan),
    test: {
      frames: 350, keys: [
        { code: 'ArrowRight', atFrame: 10 }, { code: 'ArrowUp', atFrame: 60 },
        { code: 'ArrowLeft', atFrame: 120 }, { code: 'ArrowDown', atFrame: 200 },
      ],
      assert: (g) => {
        if (g.score === undefined) throw new Error('Missing score');
        if (g.ghosts === undefined) throw new Error('Missing ghosts');
      },
    },
  },
  {
    id: 'donkey-kong',
    title: 'Donkey Kong',
    title_i18n: 'registry.donkey-kong.title',
    tagline: 'Barriles, escaleras y rescate',
    tagline_i18n: 'registry.donkey-kong.tagline',
    level: 3,
    load: () => import('./donkey-kong/index.js').then((m) => m.DonkeyKong),
    test: {
      frames: 350, keys: [
        { code: 'ArrowRight', atFrame: 10 }, { code: 'Space', atFrame: 50 },
        { code: 'ArrowRight', atFrame: 80 }, { code: 'ArrowUp', atFrame: 120 },
        { code: 'ArrowRight', atFrame: 160 },
      ],
      assert: (g) => {
        if (g.score === undefined) throw new Error('Missing score');
        if (g.player === undefined) throw new Error('Missing player');
      },
    },
  },
];
