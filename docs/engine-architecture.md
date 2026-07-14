# GameHub Engine — Arquitectura Técnica

> Documentación completa del motor de juego común para los 25 juegos del GameHub Engine.
> Julio 2026.

---

## Índice

1. [Visión general](#1-visión-general)
2. [Game Engine (bucle de juego)](#2-game-engine)
3. [GameBase (clase base)](#3-gamebase)
4. [Input Manager](#4-input-manager)
5. [Audio Manager](#5-audio-manager)
6. [Haptic Manager](#6-haptic-manager)
7. [Settings Manager](#7-settings-manager)
8. [Storage Manager](#8-storage-manager)
9. [Collision Utils](#9-collision-utils)
10. [Vector 2D](#10-vector-2d)
11. [Seeded Random](#11-seeded-random)
12. [Particle System](#12-particle-system)
13. [Tilemap](#13-tilemap)
14. [Camera](#14-camera)
15. [Game UI](#15-game-ui)
16. [wrapText](#16-wraptext)
17. [i18n (internacionalización)](#17-i18n)
18. [Icon Renderer](#18-icon-renderer)
19. [Asset Loader](#19-asset-loader)
20. [Hub (main.js)](#20-hub)
21. [Patrones de uso](#21-patrones-de-uso)
22. [Flujo de carga de un juego](#22-flujo-de-carga)

---

## 1. Visión general

GameHub Engine es un motor de juegos Canvas 2D modular, sin dependencias externas. Proporciona 18 módulos reutilizables que los juegos consumen según sus necesidades.

### Principios de diseño

- **Zero dependencias externas**: todo está escrito en JavaScript vanilla.
- **Carga bajo demanda**: cada juego se carga vía `import()` dinámico solo cuando el usuario lo selecciona.
- **Namespacing por juego**: storage, traducciones y estado están aislados por juego.
- **Interfaz uniforme**: todos los juegos implementan la misma API (`init/update/render/destroy`).
- **Singleton compartido**: AudioManager, HapticManager, SettingsManager son globales y persistidos.

### Resolución y escalado

- **Resolución base**: 900×540 píxeles (relación 16:9).
- **Escalado responsive**: el canvas se escala proporcionalmente al ancho de la ventana (máx 900px, con padding de 16px a cada lado).
- **Coordenadas internas**: los juegos siempre trabajan en coordenadas lógicas 900×540. El escalado lo maneja CSS (`canvas { width: 100%; }`).
- **InputManager** ajusta las coordenadas del ratón automáticamente usando `canvas.getBoundingClientRect()` y el factor de escala `canvas.width / rect.width`.

---

## 2. Game Engine

**Archivo**: `src/engine/GameEngine.js`

### Responsabilidad

Gestiona el bucle principal de juego usando `requestAnimationFrame` con delta time en segundos.

### API pública

```js
class GameEngine {
  constructor(canvas, { maxDt = 0.25 })
  
  loadGame(gameInstance)  // Carga un juego e inicia el loop
  unloadGame()            // Detiene el juego y llama a destroy()
  start()                 // Reanuda el loop tras stop()
  stop()                  // Pausa el loop (cancela rAF)
  resize(width, height)   // Cambia tamaño del canvas
}
```

### Bucle interno (`_loop`)

```js
_loop(timestamp) {
  const dt = Math.min((timestamp - this.lastTime) / 1000, this.maxDt);
  this.lastTime = timestamp;
  
  if (this.currentGame) {
    this.currentGame.update(dt);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.currentGame.render(this.ctx);
  }
  
  this._rafId = requestAnimationFrame(this._loop);
}
```

**maxDt (0.25s)**: evita el "spiral of death" tras pausas largas (cambio de pestaña, debugger). Si el frame anterior fue hace >0.25s, se trunca a 0.25s para evitar que la física salte.

### Ciclo de vida

```
constructor → (loadGame → init → [update+render]×n → unloadGame → destroy) → ...
```

El InputManager se attacha en el constructor y permanece vivo entre juegos (no se detach/attach en cada carga).

---

## 3. GameBase

**Archivo**: `src/engine/GameBase.js`

### Responsabilidad

Clase base opcional que unifica el boilerplate común de todos los juegos.

### API pública

```js
class GameBase {
  init(engine, storageKey?)   // Guarda engine, canvas, input, width, height
  handleResize(width, height) 
  destroy()                   // Vacío por defecto
  renderHUD(ctx, opts?)       // Delega en renderDefaultHUD de GameUI
  renderPauseOverlay(ctx, opts?)  // Delega en renderPauseOverlay de GameUI
  handleRestartInput(endStatuses?)  // Patrón won/lost → restart
}
```

### Propiedades establecidas en `init()`

| Propiedad | Origen | Descripción |
|-----------|--------|-------------|
| `engine` | Parámetro | Instancia de GameEngine |
| `canvas` | `engine.canvas` | Elemento canvas del DOM |
| `input` | `engine.input` | InputManager compartido |
| `width` | `canvas.width` | Ancho lógico del canvas |
| `height` | `canvas.height` | Alto lógico del canvas |
| `storage` | Nuevo StorageManager | Si se pasa storageKey |

### handleRestartInput

Implementa el patrón más común entre juegos: cuando `status` es 'won' o 'lost', espera Space o click y llama a `this._restart()`. Retorna `true` si manejó el input (consumiendo el frame).

---

## 4. Input Manager

**Archivo**: `src/engine/InputManager.js`

### Responsabilidad

Abstrae teclado + ratón + touch mínimo. Una instancia compartida por todos los juegos.

### API pública

```js
class InputManager {
  mouse: { x, y, down, clickedThisFrame }
  
  attach(canvas)          // Conecta event listeners al canvas
  detach()                // Desconecta event listeners
  isDown(code)            // ¿Tecla actualmente presionada?
  wasPressed(code)        // ¿Tecla presionada este frame (just-pressed)?
  endFrame()              // Limpia just-pressed y clickedThisFrame
}
```

### Eventos gestionados

| Evento | Listener | Acción |
|--------|----------|--------|
| `keydown` | `window` | Añade a `keys` y `keysJustPressed` |
| `keyup` | `window` | Elimina de `keys` |
| `mousemove` | `canvas` | Actualiza `mouse.x/y` (escalados) |
| `mousedown` | `canvas` | `mouse.down = true`, `clickedThisFrame = true` |
| `mouseup` | `window` | `mouse.down = false` |
| `touchstart` | `canvas` | Primer toque → mouse move + down |
| `touchmove` | `canvas` | Primer toque → mouse move |
| `touchend` | `canvas` | `mouse.down = false` |

### Coordenadas de ratón escaladas

```js
const rect = canvas.getBoundingClientRect();
const scaleX = canvas.width / rect.width;
const scaleY = canvas.height / rect.height;
mouse.x = (e.clientX - rect.left) * scaleX;
mouse.y = (e.clientY - rect.top) * scaleY;
```

Esto permite que el canvas tenga tamaño CSS variable pero las coordenadas lógicas
sean siempre 0..900 y 0..540.

### Touch

Soporte mínimo: el primer dedo en pantalla se mapea a las coordenadas del ratón.
No soporta multritouch. Útil para dispositivos móviles donde el usuario toca la
pantalla para disparar o mover.

---

## 5. Audio Manager

**Archivo**: `src/engine/AudioManager.js`

### Responsabilidad

Singleton basado en Web Audio API. Soporta sonidos procedimentales (sin archivos) y reproducción de archivos de audio.

### Inicialización (Autoplay Policy)

```js
AudioManager.resume();  // Crear contexto (primera vez) o reanudar
```

Debe llamarse desde un gesto del usuario (click/touch/keydown). El hub lo hace
automáticamente en el primer click global.

### Sonidos procedimentales

40+ efectos predefinidos organizados por juego:

```js
AudioManager.sfx({ type: 'jump', volume: 0.5 });
AudioManager.sfx({ type: 'coin' });
AudioManager.sfx({ type: 'explosion' });
AudioManager.sfx({ type: 'galaga_shoot' });
AudioManager.sfx({ type: 'pacman_chomp' });
// ... ver switch completo en AudioManager.js
```

### Tipos de sonido

| Tipo | API | Descripción |
|------|-----|-------------|
| Tono | `beep(freq, dur, vol, type)` | Oscilador senoidal/cuadrado/sierra/triángulo |
| Ruido | `noise(dur, vol, lowpass?)` | Ruido blanco con filtro paso bajo opcional |
| SFX predefinido | `sfx({ type, volume })` | Combina tonos + noise con timing |
| Archivo | `load(key, url)` + `play(key)` | Audio buffer desde archivo |
| Música | `playMusic(url)` / `stopMusic()` | Loop de fondo |

### Arquitectura de nodos

```
AudioContext
  └── MasterGain (volumen maestro) → destination
        ├── SFXGain (volumen SFX) ← Fuentes de sonido
        └── MusicGain (volumen música) ← Fuente de música
```

### Persistencia

Volúmenes guardados en localStorage bajo `gamehub:audio:volumes`.

### Beneficios del diseño procedimental

- **Zero assets de audio**: los 25 juegos funcionan sin archivos de sonido.
- **Latencia cero**: los sonidos se generan al instante, sin esperar descargas.
- **Personalizable**: cada juego tiene efectos únicos (galaga_shoot ≠ asteroids_shoot).
- **Determinista**: mismo tipo + volumen produce el mismo sonido.

---

## 6. Haptic Manager

**Archivo**: `src/engine/HapticManager.js`

### Responsabilidad

Singleton que provee vibración háptica complementaria a los efectos de audio, usando la Vibration API (`navigator.vibrate`).

### API pública

```js
class HapticManagerImpl {
  get supported()      // ¿API disponible?
  get enabled()        // ¿Activado por el usuario?
  set enabled(v)       // ON/OFF (persistido)
  vibrate(pattern)     // String (preset), número (ms), o array (secuencia)
  stop()               // Detiene vibración actual
}
```

### Patrones predefinidos

| Patrón | Secuencia (ms) | Uso típico |
|--------|---------------|------------|
| `jump` | 30, 20, 15 | Salto |
| `coin` | 20, 30, 40 | Moneda/punto |
| `hit` | 60 | Golpe/daño |
| `shoot` | 15, 10, 15 | Disparo |
| `explosion` | 80, 30, 60, 30, 40 | Explosión |
| `select` | 20 | Selección |
| `powerup` | 30, 20, 40, 20, 60 | Power-up |

### Persistencia

Estado `enabled` guardado en localStorage bajo `gamehub:haptic:enabled`.

### Seguridad

- Verifica `navigator.vibrate` antes de llamar.
- Envuelve en try/catch (navegadores bloquean la API en ciertos contextos).
- No disponible en iOS Safari ni escritorio sin gamepad háptico.

---

## 7. Settings Manager

**Archivo**: `src/engine/SettingsManager.js`

### Responsabilidad

Singleton central de configuración del hub. Gestiona tema, reducción de animaciones, idioma, volumen y vibración. Lee/escribe localStorage bajo `gamehub:settings:*`.

### API pública

```js
class SettingsManagerImpl {
  // Getters/setters con persistencia automática
  theme: 'dark' | 'light'
  reducedMotion: boolean
  language: 'es' | 'en'
  masterVolume: number (0-1)   // Delegado a AudioManager
  sfxVolume: number (0-1)      // Delegado a AudioManager
  musicVolume: number (0-1)     // Delegado a AudioManager
  hapticEnabled: boolean        // Delegado a HapticManager
  
  onChange(key, fn)       // Listener específico
  onAnyChange(fn)         // Listener global
  reset()                 // Valores por defecto
  getAll()                // Copia plana de settings
}
```

### Valores por defecto

| Clave | Valor |
|-------|-------|
| theme | 'dark' |
| reducedMotion | false |
| language | 'es' |
| masterVolume | 0.8 |
| sfxVolume | 1.0 |
| musicVolume | 0.5 |
| hapticEnabled | true |

### Guards

- Al delegar en AudioManager, los setters verifican que los gain nodes existan (seguro incluso tras destroy()).
- HapticManager no tiene destroy(), solo stop() — seguro siempre.
- Los cambios se persisten automáticamente en localStorage + notifican a listeners.

---

## 8. Storage Manager

**Archivo**: `src/engine/StorageManager.js`

### Responsabilidad

Namespacing de localStorage por juego para evitar colisiones de claves.

### API

```js
class StorageManager {
  constructor(namespace)  // 'breakout', 'snake', etc.
  get(key, fallback?)     // Lee y parsea JSON
  set(key, value)         // Serializa a JSON y guarda
  remove(key)             // Elimina clave
}
```

### Formato de clave

```
gamehub:<namespace>:<key>
```

Ejemplos:
- `gamehub:breakout:highscore`
- `gamehub:snake:highscore`
- `gamehub:platformer:bestTime`

### Manejo de errores

`get()` y `set()` están envueltos en try/catch. Si localStorage no está disponible o está lleno, `get()` devuelve el fallback y `set()` retorna `false`.

---

## 9. Collision Utils

**Archivo**: `src/engine/CollisionUtils.js`

### Responsabilidad

Funciones puras de detección de colisiones. Sin clases, sin estado — solo funciones.

### API

```js
aabbIntersects(a, b)                    // Rect vs Rect (AABB)
circleIntersects(a, b)                  // Circle vs Circle
circleIntersectsAABB(circle, rect)      // Circle vs Rect
pointInRect(px, py, rect)               // Point vs Rect (clicks UI)
clamp(value, min, max)                  // Limitar valor
```

### Formatos

```js
// Rect: { x, y, width, height } — x,y = esquina superior izquierda
// Circle: { x, y, radius } — x,y = centro
```

### Uso por juego

| Función | Juegos |
|---------|--------|
| `circleIntersectsAABB` | Breakout, Pong, Flappy Bird (bola/pájaro vs paleta/ladrillo/tubería) |
| `circleIntersects` | Asteroids (nave vs asteroide, bala vs asteroide) |
| `aabbIntersects` | Platformer, Fancy Pants, Coop Platformer, Donkey Kong (jugador vs meta/palanca) |
| `pointInRect` | Trick Quiz, Papa's Pizzeria, Stick RPG, Swords and Souls, Henry Stickmin (clicks en UI) |
| `clamp` | Todos (límites de canvas, paletas, cámara, volumen) |

---

## 10. Vector 2D

**Archivo**: `src/engine/Vector2.js`

### Responsabilidad

Clase vectorial minimalista para operaciones 2D comunes.

### API

```js
class Vector2 {
  constructor(x, y)
  add(v)              // Suma vectorial
  sub(v)              // Resta vectorial
  scale(s)            // Multiplicación escalar
  get length()        // Magnitud (hipotenusa)
  normalized()        // Vector unitario
  static fromAngle(radians, magnitude?)  // Crear desde ángulo
}
```

### Uso principal

`Vector2.fromAngle()` se usa en Asteroids para calcular la dirección de propulsión de la nave según su rotación:

```js
// Asteroids.js
const thrust = Vector2.fromAngle(this.ship.angle, THRUST_POWER);
this.ship.vx += thrust.x;
this.ship.vy += thrust.y;
```

---

## 11. Seeded Random

**Archivo**: `src/engine/SeededRandom.js`

### Responsabilidad

Generador de números pseudoaleatorios (PRNG) basado en el algoritmo Mulberry32. Produce secuencias deterministas: a igual semilla, igual secuencia.

### API

```js
class SeededRandom {
  constructor(seed?)
  next()                  // float [0, 1)
  nextInt(min, max)       // entero [min, max]
  nextFloat(min, max)     // float [min, max)
  pick(arr)               // elemento aleatorio
  shuffle(arr)            // Fisher-Yates in-place
  
  static fromLevel(level, difficulty?)  // Semilla desde nivel
  static encode(seed)     // Número → código (base36, ej. "A7K2")
  static decode(str)      // Código → número
}
```

### Algoritmo Mulberry32

```js
next() {
  let t = (this._state += 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
```

Genera floats de 32 bits con buena distribución y periodo largo.

### Uso en juegos

- **Asteroids**: generación de oleadas y formas de asteroides.
- **Crush the Castle**: generación procedural de castillos.
- **Bowman**: viento, power-ups y terreno.
- **Bloons TD**: tipos de bloon por oleada.
- **Stick RPG**: eventos aleatorios.
- **Swords and Souls**: entrenamiento y combate.
- **Todos los Nivel 1**: ángulo de saque, posición de comida, etc.

---

## 12. Particle System

**Archivo**: `src/engine/ParticleSystem.js`

### Responsabilidad

Sistema de partículas reutilizable para efectos visuales: explosiones, impactos, estelas.

### API

```js
class ParticleSystem {
  constructor(gravity?)
  
  emit(x, y, color, count, speed, options?)  // Explosión de partículas
  burst(x, y, color, count, speed, opts?)    // Atajo para explosiones
  update(dt)                                  // Avanzar simulación
  render(ctx)                                 // Dibujar (respeta reducedMotion)
  clear()                                     // Eliminar todas
  get isEmpty()                               // ¿Sin partículas activas?
}
```

### Opciones de emit

| Opción | Default | Descripción |
|--------|---------|-------------|
| `vyOffset` | 0 | Empuje vertical inicial |
| `lifeMin` | 0.3 | Vida mínima (s) |
| `lifeMax` | 0.6 | Vida máxima (s) |
| `radiusMin` | 1 | Radio mínimo (px) |
| `radiusMax` | 2 | Radio máximo (px) |
| `speedMin` | 0.2 | Fracción mínima de speed |
| `speedMax` | 0.8 | Fracción máxima de speed |

### reducedMotion guard

```js
render(ctx) {
  if (SettingsManager.reducedMotion) return;
  // ...
}
```

Cuando `reducedMotion` está activado, las partículas no se dibujan. El gameplay esencial no se ve afectado.

### Uso típico

```js
this.particles = new ParticleSystem(150);
this.particles.burst(x, y, '#ffb454', 12, 80);
this.particles.update(dt);
this.particles.render(ctx);
```

---

## 13. Tilemap

**Archivo**: `src/engine/Tilemap.js`

### Responsabilidad

Representa niveles de plataformas como cuadrícula de enteros. Resuelve colisiones por eje separado contra AABB. Renderiza solo tiles visibles en el viewport.

### API

```js
class Tilemap {
  constructor({ data, tileSize, solidTiles? })
  
  get pixelWidth()        // Ancho total en px
  get pixelHeight()       // Alto total en px
  tileAt(col, row)        // Tile en coordenadas de grid
  resolveAABB(entity, vx, vy, dt)  // Colisión por eje separado
  render(ctx, viewport, tileColors?)  // Render viewport-based
  
  static parseAscii(rows, legend)  // ASCII art → data numérica
}
```

### Colisión por eje separado

La técnica clásica: mover primero en X, resolver colisiones X, luego mover en Y, resolver colisiones Y. Esto evita que las esquinas de las baldosas "enganchan" al personaje y permite distinguir suelo/techo/pared.

```js
resolveAABB(entity, vx, vy, dt) {
  // 1. Mover en X
  entity.x += vx * dt;
  // 2. Resolver colisiones X → entity.x corregido
  this._resolveAxis(entity, 'x', vx, result);
  
  // 3. Mover en Y
  entity.y += vy * dt;
  // 4. Resolver colisiones Y → entity.y corregido
  this._resolveAxis(entity, 'y', vy, result);
  
  return { onGround, onCeiling, onWall };
}
```

### Corrección restrictiva

Cuando el AABB barre varias baldosas sólidas en un mismo frame (dt alto, movimiento rápido), se usa `pickMoreRestrictive()` para elegir la corrección que detiene antes, evitando "teletransportes" a través de la geometría.

### Render con viewport

Solo dibuja las baldosas visibles dentro del viewport actual, optimizando para niveles grandes.

### parseAscii

Convierte arrays de strings (arte ASCII) a la matriz numérica que usa Tilemap:

```js
const data = Tilemap.parseAscii(LEVEL_ROWS[0], { '#': 1, 'G': 2 });
```

---

## 14. Camera

**Archivo**: `src/engine/Camera.js`

### Responsabilidad

Cámara 2D de scroll: centra al objetivo (normalmente el jugador) en el viewport, con clamp para no mostrar fuera de los límites del mundo.

### API

```js
class Camera {
  constructor(viewWidth, viewHeight)
  resize(viewWidth, viewHeight)
  follow(target, worldWidth, worldHeight)
  apply(ctx)  // ctx.translate(-Math.round(this.x), -Math.round(this.y))
}
```

### Uso típico

```js
// En update():
this.camera.follow(this.player, this.tilemap.pixelWidth, this.tilemap.pixelHeight);

// En render():
ctx.save();
this.camera.apply(ctx);
// dibujar en coordenadas de mundo...
ctx.restore();
```

### Scroll suave

La posición de la cámara se redondea (`Math.round`) para evitar subpixel rendering y artefactos de escalado.

---

## 15. Game UI

**Archivo**: `src/engine/GameUI.js`

### Responsabilidad

Helpers reutilizables para renderizar overlays y HUD comunes, reduciendo la duplicación entre juegos.

### Funciones

```js
// Pantalla de Game Over / Victoria
renderOverlay(ctx, { width, height, score?, title?, subtitle?, actionText?, colors? })

// Overlay de pausa
renderPauseOverlay(ctx, { width, height, extraText?, colors? })

// Configuración de contexto para HUD
setupHUDContext(ctx, color?)
clearHUDContext(ctx)

// HUD estándar (score + record + lives)
renderDefaultHUD(ctx, game, { showLives?, extraLeft?, extraRight?, extraCenter? })
```

### HUD por defecto

Muestra automáticamente:
- Izquierda: score, record, líneas extra
- Derecha: lives (si showLives y game.lives existen), líneas extra
- Centro: líneas extra centrales

Usa las claves i18n compartidas `game.score`, `game.record`, `game.lives`.

---

## 16. wrapText

**Archivo**: `src/engine/wrapText.js`

### Responsabilidad

Dibuja texto con word-wrap en un contexto Canvas 2D.

### API

```js
wrapText(ctx, text, x, y, maxWidth, lineHeight)
```

### Algoritmo

1. Parte el texto por espacios.
2. Acumula palabras en una línea hasta que supera `maxWidth`.
3. Cuando supera, empuja la línea acumulada y comienza una nueva.
4. Dibuja cada línea en `y + i * lineHeight`.

### Uso

Trick Quiz, Papa's Pizzeria, Stick RPG, Swords and Souls, Henry Stickmin — todos los juegos con UI textual multilínea.

---

## 17. i18n

**Archivo**: `src/engine/i18n.js`

### Responsabilidad

Sistema de traducción ES/EN para el hub y todos los juegos.

### API

```js
t(key, params?, lang?)              // Traducir clave
applyI18n()                          // Aplicar data-i18n al DOM
initI18n()                           // Inicializar y suscribir a cambios
registerTranslations(translations)   // Registrar traducciones de un juego
loadGameTranslations(gameId)         // Cargar traducciones dinámicamente
```

### Formato

```js
const TRANSLATIONS = {
  'breakout.score': { es: 'Puntuación: {n}', en: 'Score: {n}' },
  // ...
};
```

### Sustitución de parámetros

```js
t('breakout.score', { n: 42 });  // "Puntuación: 42" / "Score: 42"
```

### Fallback

Si una clave no existe en EN → usa ES. Si no existe en ningún lado → muestra la clave.

### Carga dinámica

```js
// Cada juego tiene su i18n.js
export default {
  'breakout.score': { es: 'Puntuación: {n}', en: 'Score: {n}' },
  'breakout.level': { es: 'Nivel {n}', en: 'Level {n}' },
};

// El motor lo carga al iniciar el juego:
await loadGameTranslations('breakout');
// → import('../games/breakout/i18n.js')
// → registerTranslations(module.default)
```

### HTML

```html
<span data-i18n="menu.eyebrow">Selecciona un juego</span>
```

`applyI18n()` recorre el DOM buscando `[data-i18n]` y reemplaza el textContent por la traducción.

---

## 18. Icon Renderer

**Archivo**: `src/engine/IconRenderer.js`

### Responsabilidad

Sistema de iconos SVG inline para renderizar en canvas. Los SVGs se definen como strings, se convierten a data URIs y se cachean como Image objects.

### API

```js
icon(ctx, name, x, y, size?, color?)           // Renderizar icono
preloadIcons(names, size?)                      // Precargar iconos
getIconNames()                                  // Lista de nombres disponibles
```

### Iconos disponibles (35+)

heart, heartgreen, swords, arrow, shield, money, star, bolt, check, cross,
muscle, brain, chat, home, skull, crown, trophy, target, clock, fire,
bomb, potion, pizza, cart, music, books, key, alarm, theater, world,
gear, lock, unlock, flag, refresh, gamepad, gem, hero

### Uso en canvas

```js
import { icon } from '../../engine/IconRenderer.js';
icon(ctx, 'heart', x, y, 16, '#e74c3c');     // Corazón rojo 16px
icon(ctx, 'star', x, y, 20, '#ffb454');       // Estrella 20px
```

### En Node.js (smoke tests)

Cuando `Image` no está disponible (Node.js), dibuja un placeholder de texto sin lanzar error.

---

## 19. Asset Loader

**Archivo**: `src/engine/AssetLoader.js`

### Responsabilidad

Carga y cachea imágenes/audio/JSON por URL para compartir assets entre juegos sin recargar.

### API

```js
AssetLoader.loadImageAsync(url)     // → Promise<HTMLImageElement>
AssetLoader.loadAudioAsync(url)     // → Promise<HTMLAudioElement>
AssetLoader.loadJSONAsync(url)      // → Promise<object>
AssetLoader.clearCache()            // Vaciar caché
```

### Caché

Los assets se cachean internamente en un Map. Si se solicita la misma URL dos veces, la segunda devuelve la Promise ya existente.

---

## 20. Hub

**Archivo**: `src/main.js`

### Responsabilidad

Punto de entrada de la aplicación: renderiza el menú, gestiona la búsqueda, carga juegos, maneja settings.

### Funcionalidades

1. **Menú de juegos**: renderiza cards del registro con título y tagline traducidos.
2. **Búsqueda en vivo**: filtra cards por título/tagline en ES y EN mientras el usuario escribe.
3. **Carga de juegos**: `launchGame()` carga el código del juego y sus traducciones en paralelo, muestra indicador de progreso.
4. **Settings modal**: tema, idioma, animaciones, volumen, vibración.
5. **Teclado**: Escape para volver al menú, 's' para settings.
6. **Responsive**: redimensiona el canvas al cambiar la ventana.
7. **Inicialización de audio**: primer click/tecla del usuario → `AudioManager.resume()`.

### Flujo de lanzamiento

```js
async function launchGame(gameMeta) {
  // 1. Ocultar menú, mostrar loading
  // 2. Cargar en paralelo:
  //    - gameMeta.load()        → import() dinámico del juego
  //    - loadGameTranslations() → import() dinámico de i18n
  // 3. fitCanvas() → escalar al viewport
  // 4. engine.loadGame(new GameClass()) → init + bucle
}
```

---

## 21. Patrones de uso

### Patrón: juego con estados

```js
class MiJuego extends GameBase {
  init(engine) {
    super.init(engine, 'mi-juego');
    this.status = 'playing';   // 'playing' | 'won' | 'lost' | 'paused'
    this.score = 0;
    this.lives = 3;
  }
  
  update(dt) {
    if (this.handleRestartInput()) return; // Space/click → restart
    
    if (this.status !== 'playing') return;
    
    // Lógica del juego...
    this.input.endFrame();
  }
  
  render(ctx) {
    // Render del juego...
    this.renderHUD(ctx); // score + record + lives
  }
}
```

### Patrón: juego basado en oleadas

```js
class WaveGame extends GameBase {
  update(dt) {
    if (this.handleRestartInput()) return;
    
    if (this.status === 'wave-transition') {
      this.waveTransitionTimer -= dt;
      if (this.waveTransitionTimer <= 0 || /* click/Space */) {
        this._startNextWave();
      }
      this.input.endFrame();
      return;
    }
    
    // Lógica de oleada activa...
    this.input.endFrame();
  }
}
```

### Patrón: juego por turnos

```js
class TurnGame extends GameBase {
  update(dt) {
    if (this.handleRestartInput()) return;
    
    if (this.phase === 'player-turn') {
      // Esperar input del jugador
      this._handlePlayerInput();
    } else if (this.phase === 'ai-turn') {
      // IA ejecuta acciones
      this.aiTimer -= dt;
      if (this.aiTimer <= 0) {
        this._executeAIAction();
      }
    }
    
    this.input.endFrame();
  }
}
```

---

## 22. Flujo de carga de un juego

```
Usuario hace click en una card del menú
  │
  ├─ main.js: launchGame(gameMeta)
  │   ├─ menu.hidden = true
  │   ├─ loadingIndicator.hidden = false
  │   │
  │   ├─ [PARALELO]
  │   │   ├─ gameMeta.load()
  │   │   │   └─ import('./games/<id>/index.js')
  │   │   │       └─ re-exporta la Game Class
  │   │   │
  │   │   └─ loadGameTranslations(gameMeta.id)
  │   │       └─ import('./games/<id>/i18n.js')
  │   │           └─ registerTranslations(module.default)
  │   │
  │   ├─ fitCanvas() → engine.resize(width, height)
  │   ├─ loadingIndicator.hidden = true
  │   └─ engine.loadGame(new GameClass())
  │       ├─ game.init(engine)
  │       │   ├─ GameBase.init() → this.engine, canvas, input, storage
  │       │   └─ Setup específico del juego
  │       │
  │       └─ engine.start()
  │           └─ requestAnimationFrame loop
  │               ├─ dt = min(timestamp - lastTime, 0.25) / 1000
  │               ├─ game.update(dt)
  │               ├─ ctx.clearRect()
  │               └─ game.render(ctx)
  │
  └─ [Vuelta al menú: botón "← Menú" o Escape]
      └─ engine.unloadGame()
          ├─ engine.stop() → cancelAnimationFrame
          └─ game.destroy()
              └─ (limpieza específica, si aplica)
```
