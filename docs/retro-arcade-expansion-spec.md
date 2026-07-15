# Retro/Arcade Game Expansion Spec

> **Goal:** Add 8 new retro/arcade games to the GameHub Engine, following the established game isolation pattern and matching the quality level of existing games.

## 1. Overview

### 1.1 New Games (Ordered by Implementation)

| # | Game | Complexity | Est. Lines | Key Mechanics |
|---|------|-----------|-----------|---------------|
| 1 | **Space Invaders** | Medium | ~400 | Vertical shooter, alien waves descending, shields, score |
| 2 | **Centipede** | Medium | ~400 | Serpentine centipede, mushrooms, shooting, scoring |
| 3 | **Missile Command** | Medium | ~400 | Mouse-aim defense, cities to protect, incoming missiles |
| 4 | **Galaga** | Medium-High | ~500 | Formation flying, dive-bomb enemies, tractor beam, dual ship |
| 5 | **Frogger** | Medium | ~450 | Lane crossing (road + river), obstacles, timing, time limit |
| 6 | **Tetris** | High | ~550 | Falling pieces, rotation, line clearing, preview, scoring (+ pause) |
| 7 | **Pac-Man** | High | ~600 | Maze navigation, ghost AI, power pellets, energizer dots |
| 8 | **Donkey Kong** | High | ~550 | Vertical platforming, barrels, ladders, simulated scroll, Pauline rescue |

### 1.2 Quality Target

All games must match the quality level of existing games in the project:
- Canvas 2D rendering at 900x540
- `init/update/render/destroy` lifecycle
- Full i18n (Spanish + English)
- Particle effects via the engine's `ParticleSystem.js` module
- Audio SFX (8-bit/chip tune style)
- Arcade mode: single run, score increases until game over, high score persisted
- Visual polish: retro color palettes, screenshake, hit-stop
- README.md per game
- Smoke test integration (must pass `node smoke_test.mjs`)

## 2. Architecture & Conventions

### 2.1 File Structure (per game)

```
src/games/<game-id>/
  +-- <Game>.js         # Game class implementation
  +-- index.js           # Re-exports game class
  +-- i18n.js            # ES/EN translations (default export)
  +-- README.md          # Description, controls, credits
```

### 2.2 Game Class Interface

```js
class GameName {
  constructor() {
    this.width = 900;
    this.height = 540;
    this.engine = null; // set by GameEngine
  }

  init() {}        // Setup state, load assets
  update(dt) {}    // Game logic per frame
  render(ctx) {}   // Draw per frame (ctx = CanvasRenderingContext2D)
  destroy() {}     // Cleanup (remove listeners, stop audio, etc.)
}
```

### 2.3 index.js Pattern

```js
export { GameName } from './GameName.js';
```

### 2.4 i18n.js Pattern

Use `export default` with keys mapped to `{es, en}` objects, matching the pattern used by all existing games:

```js
export default {
  'game-name.title':     { es: 'Titulo',                     en: 'Title' },
  'game-name.score':     { es: 'Puntuacion: {n}',            en: 'Score: {n}' },
  'game-name.highScore': { es: 'Record: {n}',                en: 'High Score: {n}' },
  // ...
};
```

Translations are loaded dynamically by `loadGameTranslations(gameId)` which calls `registerTranslations(module.default)`.

### 2.5 Registry Registration

Add to `src/games/registry.js` following the existing `GAME_REGISTRY` array format:

```js
{
  id: 'space-invaders',
  title: 'Space Invaders',
  title_i18n: 'registry.space-invaders.title',
  tagline: 'Clasico de disparos verticales con oleadas de aliens',
  tagline_i18n: 'registry.space-invaders.tagline',
  level: 1,
  load: () => import('./space-invaders/index.js').then((m) => m.SpaceInvaders),
},
```

- `level` field (1-5) reflects complexity. New games are lower-level (1-2), matching their simpler mechanics vs. existing games.
- Registry i18n keys (`registry.<id>.title` and `registry.<id>.tagline`) must also be added to `src/engine/i18n.js`.

### 2.6 Audio Assets

Audio samples should be 8-bit/chip tune CC0-licensed, stored at:

```
assets/audio/<game-id>/
```

All samples must be preloaded via `AudioManager` before gameplay starts. If a dedicated `public/` directory is added later, audio can be moved there.

### 2.7 Input Handling

Games use the engine's `InputManager` (`this.input`) for all input. El engine lo crea, lo attacha al canvas y gestiona su ciclo de vida. Los juegos **nunca** deben subscribirse directamente a eventos del DOM.

```js
const mx = this.input.mouse.x;
const my = this.input.mouse.y;
```

#### Dispositivos soportados

| Dispositivo | API | Detalles |
|-------------|-----|----------|
| **Teclado** | `isDown(code)` / `wasPressed(code)` | Usa `e.code` (código físico, no varía con layout). Filtr `e.repeat` para evitar auto-repeat en `wasPressed()`. |
| **Ratón** | `mouse.x`, `mouse.y`, `mouse.down`, `mouse.clickedThisFrame`, `mouse.button` (0=izq,1=medio,2=der), `mouse.wheel` (acumulador ±1 por tick) | Coordenadas escaladas automáticamente al tamaño lógico del canvas. `wheel` se resetea cada frame. |
| **Gamepad** | `isDown('GamepadA')` + 24 teclas virtuales; `bind()` + `isActionDown()` para action mapping | Polling vía `navigator.getGamepads()` cada frame. Deadzone radial 0.15 en sticks. |
| **Touch** | Mapea el primer toque a `mouse.x/y` y `mouse.clickedThisFrame` | `touch-action: none` en CSS. Sin multitouch. |

#### Ciclo de vida del input (por frame)

El engine llama estos métodos automáticamente en `_loop()`:

```
input.poll()              → Refresca gamepad (navigator.getGamepads())
game.update(dt)           → El juego lee input vía isDown/wasPressed
ctx.clearRect()
game.render(ctx)          → El juego dibuja (puede leer mouse.x/y)
toasts.updateToasts(dt)   → Anima las notificaciones temporales
renderGamepadIndicator()  → Icono gamepad + tooltip hover
toasts.renderToasts()     → Notificaciones en pantalla
input.endFrame()          → Limpia keysJustPressed, mouse.clickedThisFrame, mouse.wheel
```

Los juegos **no deben** llamar `endFrame()` manualmente.

### Indicador visual de gamepad conectado

El engine renderiza automáticamente un icono de gamepad en la esquina superior derecha
del canvas cuando hay un control conectado (`input.gamepad.connected === true`).

- **Función**: `renderGamepadIndicator(ctx, input, canvasWidth, mouseX, mouseY)` (GameUI.js)
- **Tooltip hover**: si el ratón está sobre el icono (radio 22px), se muestra el nombre del
  control extraído del `gamepad.id` (p.ej. "Xbox 360 Controller" en vez del ID completo).
- **Nombre legible**: la función interna `_formatGamepadName()` limpia el raw ID eliminando
  paréntesis y sufijos de vendor ("STANDARD GAMEPAD", "Vendor:", "Product:").
- **Traducción**: si el ID está vacío, usa la clave i18n `gamepad.tooltip`.

### Toast notifications (eventos de gamepad)

El engine integra `createToastManager()` (GameUI.js) que muestra notificaciones
temporales con animación slide-in:

- **Disparo**: al conectar/desconectar un gamepad, el engine muestra automáticamente
  un toast con `gamepad.connected` o `gamepad.disconnected` de i18n.
- **Animación**: slide-in de 40px desde abajo en 0.3s con easeOutCubic (frenado suave).
- **Fade-out**: en los últimos 0.5s de vida.
- **Duración**: 3 segundos.
- **Máx. simultáneos**: 3 (los más antiguos se descartan).
- **Renderizado**: centrado en la parte inferior del canvas, con fondo oscuro,
  borde sutil y sombra ligera.

```js
// Uso manual (si se necesita en un juego):
const toasts = createToastManager();
toasts.addToast('🎮 Gamepad conectado');
toasts.updateToasts(dt);
toasts.renderToasts(ctx, canvasWidth, canvasHeight);
```

#### Gamepad: teclas virtuales

El gamepad se refleja en teclas virtuales con prefijo `Gamepad*`, compatibles con `isDown()` y `wasPressed()`:

```
GamepadA, GamepadB, GamepadX, GamepadY       // Botones de cara
GamepadL1, GamepadR1, GamepadL2, GamepadR2   // Hombros/gatillos
GamepadSelect, GamepadStart, GamepadHome      // Botones de sistema
GamepadUp, GamepadDown, GamepadLeft, GamepadRight  // D-pad
GamepadL3, GamepadR3                          // Click sticks
GamepadLStickLeft, LStickRight, LStickUp, LStickDown  // Stick izq (digital)
GamepadRStickLeft, RStickRight, RStickUp, RStickDown  // Stick der (digital)
```

Valores analógicos con deadzone via `this.input.gamepad.leftStick` / `rightStick`.

#### Action mapping

```js
// En init() del juego:
this.input.bind('moveLeft',  'ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft');
this.input.bind('jump',      'Space',     'KeyW', 'GamepadA');

// En update():
if (this.input.isActionDown('moveLeft'))  player.x -= SPEED * dt;
if (this.input.wasActionPressed('jump'))  player.vy = -JUMP_FORCE;
```

#### Eventos gestionados por InputManager

| Evento | Listener | Acción |
|--------|----------|--------|
| `keydown` | `window` | Añade a `keys` y `keysJustPressed` (filtra `e.repeat`) |
| `keyup` | `window` | Elimina de `keys` |
| `mousemove` | `canvas` | Actualiza `mouse.x/y` escalados |
| `mousedown` | `canvas` | `mouse.down=true`, `mouse.button=e.button`, `clickedThisFrame=true` |
| `mouseup` | `window` | `mouse.down=false`, `mouse.button=0` |
| `wheel` | `canvas` | Acumula `Math.sign(e.deltaY)` en `mouse.wheel`, `preventDefault()` |
| `touchstart` | `canvas` | Primer toque → mouse move + down |
| `touchmove` | `canvas` | Primer toque → mouse move |
| `touchend` | `canvas` | `mouse.down=false` |
| `blur` | `window` | Limpia teclas, mouse, wheel y estado de gamepad |
| `contextmenu` | `canvas` | `preventDefault()` (evita menú contextual) |
| `gamepadconnected` | `window` | Activa detección de gamepad |
| `gamepaddisconnected` | `window` | Limpia estado del gamepad |

### 2.8 Game States

All games should use a `this.status` string to track state:

- `'playing'` -- Active gameplay
- `'game-over'` -- Player lost, show final score + restart prompt
- `'paused'` -- (Tetris only) Game paused, show pause overlay
- `'won'` -- (optional) Player cleared the final wave/level

Reuse engine i18n shared keys for overlays:
- `game.gameOver`, `game.restart`, `game.continue`, `game.score`, `game.record`

### 2.9 Scoring & Persistence

- All games track score during play
- High score saved via `StorageManager` (matching existing games)
- Display current score + high score on HUD during gameplay
- Show final score on game-over screen

### 2.10 Particle Effects

Use the engine's `ParticleSystem.js` for visual effects. Import at the top of the game file:

```js
import { ParticleSystem } from '../../engine/ParticleSystem.js';
```

## 3. Game Specifications

### 3.1 Space Invaders (First Priority, Batch 1)

**Mechanics:**
- Player ship moves left/right at bottom (arrow keys or A/D), shoots upward (Space)
- Waves of aliens (rows) that move side-to-side and descend
- Aliens speed up as fewer remain
- Random alien dive-bombs (shoots downward)
- 4 destructible shields (rows of blocks)
- Scoring: basic alien = 10pts, medium = 20pts, top = 30pts
- Mystery ship flies across top (50-300pts random)

**Arcade Mode:**
- 3 lives total
- New wave starts after clearing all aliens
- Each wave increases alien speed + adds 1 more shooter alien
- Score increases until Game Over (all lives lost)
- High score saved to localStorage

**States:** `playing`, `game-over`

**i18n Keys:**
- `space.title` / `space.score` / `space.highScore`
- `space.lives` / `space.wave`
- Reuses shared `game.wave` key (see section 4.1)

**SFX:**
- `shoot`: Short high beep
- `explosion`: Medium noise burst
- `alienHit`: Short pop (different per alien type)
- `mystery`: Low warbling
- `gameOver`: Descending tone
- `waveStart`: Ascending arpeggio

**Waves:**
- Wave 1: 5x11 aliens (55), speed 1, 0 shooter aliens
- Wave 2: 5x11 aliens, speed 1.3, 1 shooter
- Wave 3: 5x11 aliens, speed 1.6, 2 shooters
- ...speed increases each wave, shooters cap at 4

---

### 3.2 Centipede (Batch 1)

**Mechanics:**
- Centipede snakes down the screen through mushrooms
- Player shoots at bottom, can move freely (arrow keys or mouse)
- Centipede drops down a row when hitting a mushroom or screen edge
- Shooting a centipede segment creates a mushroom
- Other enemies: spiders (bounce around), fleas (drop more mushrooms), scorpions (poison mushrooms)

**Arcade Mode:**
- 3 lives, progressive difficulty
- Centipede speed increases, more segments per wave
- Score and high score

**States:** `playing`, `game-over`

---

### 3.3 Missile Command (Batch 1)

**Mechanics:**
- Player aims with mouse cursor, clicks to launch counter-missiles
- Incoming missiles rain from top toward 6 cities
- Player's missiles explode with expanding blast radius
- 3 bases with limited ammo, replenished between waves
- Smart bombs (bonus weapon)

**Input:** Mouse-only. Cursor tracked via `InputManager`. Left-click fires at cursor location.

**Arcade Mode:**
- 3 lives, cities get destroyed if hit
- Wave ends when no more incoming missiles
- Each wave has more missiles, faster speed
- Game over when all cities destroyed
- Score and high score

**States:** `playing`, `game-over`

---

### 3.4 Galaga (Batch 2)

**Mechanics:**
- Player ship at bottom, moves left/right, shoots upward
- Aliens in formation at top, periodically dive-bomb in patterns
- Tractor beam: aliens can capture player ship (dual-ship if rescued)
- Bonus stages (challenging stages where aliens fly patterns without shooting)

**Arcade Mode:**
- 3 lives, waves of enemies
- Each wave: aliens fly into formation, then attack in waves
- Dual ship: if captured, shoot the tractor beam ship to free it -> dual fire
- Score and high score

**States:** `playing`, `game-over`

---

### 3.5 Frogger (Batch 2)

**Mechanics:**
- Player moves frog in 4 directions (grid-based, arrow keys)
- Road section: dodge cars, trucks, logs
- River section: ride logs/turtles, avoid alligators, reach home slots
- 5 home slots to fill (lady frog, time bonus)
- Obstacles: cars, trucks, alligators, snakes, otters
- Time limit per level

**Arcade Mode:**
- 3 lives, levels repeat with increasing difficulty
- Each level increases traffic speed + decreases log frequency
- Score for reaching home, bonus for time remaining
- High score saved

**States:** `playing`, `game-over`

---

### 3.6 Tetris (Batch 3)

**Mechanics:**
- 7 tetromino pieces (I, O, T, S, Z, J, L) fall from top
- Left/right movement, rotation (clockwise), hard drop
- Line clearing: 1 line = 100pts, 2 = 300pts, 3 = 500pts, 4 = 800pts
- Preview of next piece
- Ghost piece showing landing position
- Increasing speed as score rises

**Arcade Mode:**
- Game over when pieces stack to top
- Score increases with lines, combo bonuses
- Level increases every 10 lines (speed increases)
- High score saved

**Pause:** Must support pause toggle (P or Escape key). Show overlay with the shared `game.paused` i18n key.

**States:** `playing`, `paused`, `game-over`

---

### 3.7 Pac-Man (Batch 3)

**Mechanics:**
- Player navigates maze, eats dots and power pellets
- 4 ghosts with distinct AI:
    - Blinky (red): chases directly
    - Pinky (pink): ambushes (targets 4 tiles ahead)
    - Inky (cyan): uses Blinky's position to calculate
    - Clyde (orange): chases when far, scatters when close
- Power pellets let player eat ghosts (2pts, 4pts, 8pts, 16pts)
- Fruit bonuses appear periodically

**Arcade Mode:**
- 3 lives, levels increase ghost speed + reduce power-pellet duration
- Fruit bonuses change per level
- Score and high score

**States:** `playing`, `game-over`

---

### 3.8 Donkey Kong (Batch 3)

**Mechanics:**
- Player (Jumpman) moves left/right and jumps (single screen)
- **Simulated vertical scroll**: screen sections shift as player climbs. The engine has no camera/scroll system, so each screen section is a self-contained area within the fixed 900x540 canvas.
- Avoid: rolling barrels, fireballs, Donkey Kong's random throws
- Reach Pauline at top to win level
- 4 distinct screens (25m, 50m, 75m, 100m):
    - 25m: ramps + ladder, barrels roll down
    - 50m: conveyor belts + ladder
    - 75m: ramps + moving elevators
    - 100m: rivets to remove, final confrontation

**Arcade Mode:**
- 3 lives, levels loop with increasing difficulty
- Score: jumping barrels, collecting items, reaching Pauline
- Time bonus for remaining time
- High score saved

**States:** `playing`, `game-over`

## 4. i18n Shared Keys

### 4.1 Existing shared keys (in `src/engine/i18n.js`)

Reuse these engine i18n keys across games:
- `game.score` / `game.record` / `game.gameOver` / `game.restart` / `game.continue`
- `game.levelComplete` / `game.victory`
- `game.wave` -- use this for all wave-based games (Space Invaders, Galaga, Missile Command)

### 4.2 New shared keys to add to `src/engine/i18n.js`

*(Added in a previous implementation phase — already present in the engine)*

```
'game.lives':   { es: 'Vidas: {n}',   en: 'Lives: {n}' },
'game.paused':  { es: 'PAUSA',        en: 'PAUSED' },
```

### 4.3 Registry title/tagline keys

Each game needs registry keys in `src/engine/i18n.js` following the existing pattern:

```
'registry.space-invaders.title':    { es: 'Space Invaders',    en: 'Space Invaders' },
'registry.space-invaders.tagline':  { es: 'Disparos verticales con oleadas de aliens', en: 'Vertical shooter with alien waves' },
'registry.centipede.title':         { es: 'Centipede',          en: 'Centipede' },
'registry.centipede.tagline':       { es: 'Cienpies serpenteante y hongos', en: 'Serpentine centipede and mushrooms' },
'registry.missile-command.title':   { es: 'Missile Command',    en: 'Missile Command' },
'registry.missile-command.tagline': { es: 'Defensa antimisiles con el raton', en: 'Anti-missile defense with mouse aim' },
'registry.galaga.title':            { es: 'Galaga',             en: 'Galaga' },
'registry.galaga.tagline':          { es: 'Formaciones y bombardeo en picada', en: 'Formations and dive-bomb attacks' },
'registry.frogger.title':           { es: 'Frogger',            en: 'Frogger' },
'registry.frogger.tagline':         { es: 'Cruza la carretera y el rio', en: 'Cross the road and the river' },
'registry.tetris.title':            { es: 'Tetris',             en: 'Tetris' },
'registry.tetris.tagline':          { es: 'Piezas que caen, rotacion y lineas', en: 'Falling pieces, rotation, line clearing' },
'registry.pac-man.title':           { es: 'Pac-Man',            en: 'Pac-Man' },
'registry.pac-man.tagline':         { es: 'Laberinto, puntos y fantasmas con IA', en: 'Maze, dots, and ghost AI' },
'registry.donkey-kong.title':       { es: 'Donkey Kong',        en: 'Donkey Kong' },
'registry.donkey-kong.tagline':     { es: 'Barriles, escaleras y rescate', en: 'Barrels, ladders, and rescue' },
```

## 5. Testing

### 5.1 Smoke Test

Each game must pass the existing smoke test (`smoke_test.mjs`):
- Imports all games via `GAME_REGISTRY`
- Calls `init()` without errors
- Calls `update(dt)` x5 without errors
- Calls `render(ctx)` without errors
- Calls `destroy()` without errors

### 5.2 Registration

Each game must be registered in `GAME_REGISTRY` and in `src/engine/i18n.js` with title/tagline translations. The smoke test validates this by iterating all registry entries.

## 6. Implementation Order & Batching

### Batch 1 (First milestone -- Space Invaders first)
| Order | Game | Rationale |
|-------|------|-----------|
| 1 | **Space Invaders** | Foundation for Galaga, establishes shooter + economy pattern |
| 2 | **Centipede** | Completely different mechanic, tests engine flexibility |
| 3 | **Missile Command** | Mouse-based aiming, unique mechanic |

### Batch 2 (Second milestone)
| Order | Game | Rationale |
|-------|------|-----------|
| 4 | **Galaga** | Builds on Space Invaders with formations + dive-bomb |
| 5 | **Frogger** | Grid-based movement, introduces obstacle lanes |

### Batch 3 (Third milestone)
| Order | Game | Rationale |
|-------|------|-----------|
| 6 | **Tetris** | No enemies, pure puzzle + piece rotation, adds pause |
| 7 | **Pac-Man** | Maze pathfinding, ghost AI, most complex AI |
| 8 | **Donkey Kong** | Platforming physics, 4 distinct screens, simulated scroll |

## 7. Audio Plan

### 7.1 Source
Download CC0/royalty-free 8-bit sound effect packs before each batch. Recommended sources:
- freesound.org (filter by CC0 license)
- opengameart.org
- kenney.nl (public domain asset packs)

### 7.2 Per-Game Sounds

| Game | Sound IDs |
|------|-----------|
| Space Invaders | `shoot`, `explosion`, `alienHit`, `mystery`, `gameOver`, `waveStart` |
| Centipede | `shoot`, `segmentHit`, `mushroom`, `spider`, `gameOver` |
| Missile Command | `launch`, `explosion`, `incoming`, `cityDestroyed`, `gameOver` |
| Galaga | `shoot`, `explosion`, `formation`, `capture`, `rescue`, `bonus` |
| Frogger | `hop`, `squash`, `splash`, `home`, `timeWarning`, `gameOver` |
| Tetris | `move`, `rotate`, `drop`, `lineClear`, `tetris`, `gameOver` |
| Pac-Man | `chomp`, `powerPellet`, `ghostEat`, `death`, `fruit`, `gameOver` |
| Donkey Kong | `jump`, `barrel`, `death`, `climb`, `levelComplete`, `gameOver` |

## 8. Visual Style

- Color palettes inspired by original arcade cabinets:
    - Space Invaders: green/white aliens on black background
    - Pac-Man: blue maze with yellow hero
    - Tetris: colorful pieces on dark background
    - etc.
- Pixel-art aesthetic via `image-rendering: pixelated`
- Dark backgrounds with bright neon/lit sprites
- Particle effects (explosions, score popups, trail effects) via `ParticleSystem.js`
- Screenshake on explosions/impacts
- Glow effects via shadow blur on select elements

## 9. Directory Structure (Final)

```
src/games/
  +-- space-invaders/
  |   +-- SpaceInvaders.js
  |   +-- index.js
  |   +-- i18n.js
  |   +-- README.md
  +-- centipede/
  +-- missile-command/
  +-- galaga/
  +-- frogger/
  +-- tetris/
  +-- pac-man/
  +-- donkey-kong/
assets/
  +-- audio/
      +-- space-invaders/
      +-- centipede/
      ...
```

## 10. Future Considerations (Out of Scope)

- Online leaderboard
- Achievement system
- Speedrun timer
- Multitouch gestures (pinch-zoom, swipe)
- Canvas camera/scroll system (would simplify Donkey Kong)
