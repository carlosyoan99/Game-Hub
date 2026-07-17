# GameHub Engine

Sistema modular para una colección de 35 minijuegos Canvas 2D con motor de juego común.
Sin frameworks, sin build step obligatorio — abre `index.html` con un servidor estático simple
(los `import` ES6 requieren `http://`, no `file://`).

```bash
npx serve .
# o
python3 -m http.server 8000
```

## Estructura del proyecto

```
index.html                  Punto de entrada único (hub)
styles/main.css             Tema visual del hub (retro NES, oscuro/claro)
src/
  main.js                   Hub: menú, búsqueda, carga dinámica, settings, progresión
  engine/                   Motor de juego común (25 módulos)
    GameEngine.js            Bucle rAF con delta-time clamp
    GameBase.js              Clase base con auto-aplicación de bindings
    InputManager.js          Teclado + ratón + gamepad + touch + action mapping
    AudioManager.js          Web Audio API: SFX procedimental + música
    HapticManager.js         Vibration API con patrones predefinidos
    SettingsManager.js       Singleton: tema, idioma, volumen, háptico, bindings
    StorageManager.js        localStorage namespaced por juego
    ProgressionManager.js    XP, niveles, logros, desbloqueables, estadísticas
    CollisionUtils.js        AABB, círculo, círculo-AABB, clamp
    Vector2.js               Utilidades vectoriales 2D
    SeededRandom.js          PRNG Mulberry32 con códigos compartibles
    ParticleSystem.js        Emisor de partículas reutilizable
    Tilemap.js               Colisión tile-based por eje separado
    Camera.js                Cámara 2D de scroll con clamp al mundo
    GameUI.js                Overlays de game-over, pausa y HUD estándar
    wrapText.js              Texto con word-wrap para canvas
    i18n.js                  Sistema ES/EN con carga dinámica por juego
    IconRenderer.js          Iconos SVG inline para canvas
    AssetLoader.js           Carga y caché de imágenes/audio/JSON
    CRTEffects.js            Post-procesado CRT (scanlines, vigneta)
    VisualEffects.js         Efectos visuales reutilizables
    ScreenShake.js           Efecto de vibración de cámara
    ComboDetector.js         Detector de combos para action mapping
    Hitbox.js                Sistema de hitboxes para fighting games
    AspectRatioManager.js    Gestión de relaciones de aspecto (4:3, 5:3, 16:9)
  games/                    Todos los juegos (cada uno es una unidad independiente)
    registry.js              Lista maestra de 35 juegos con import() dinámico
    <game-id>/               Cada juego tiene: index.js, <Game>.js, i18n.js, README.md
assets/
  icons/                    Iconos SVG usados en el hub
docs/                       Documentación técnica
```

## Juegos incluidos (35)

### 🏓 Arcade Clásico

| Juego | Mecánicas clave |
|-------|----------------|
| **Breakout** | 5 niveles, rebote con ángulo variable, ladrillos duros |
| **Snake** | 5 niveles, movimiento grid, obstáculos |
| **Pong** | 5 niveles, IA progresiva con predicción de rebotes |
| **Flappy Bird** | 5 niveles, gravedad constante, tuberías progresivas |
| **Space Invaders** | Oleadas infinitas, aliens que disparan, nave misteriosa |
| **Centipede** | Oleadas infinitas, ciempiés segmentado, arañas y hongos |
| **Missile Command** | Oleadas infinitas, defensa antimisiles con ratón |
| **Galaga** | Oleadas infinitas, formaciones, picadas, nave gemela |
| **Frogger** | Oleadas infinitas, 5 carriles de coches + 4 de río |
| **Asteroids** | 10 oleadas, física wraparound, enemigos que persiguen |

### 🎮 Plataformas

| Juego | Mecánicas clave |
|-------|----------------|
| **Platformer** | 5 niveles, tilemap + cámara, coyote time, salto variable |
| **Fancy Pants** | 5 niveles, aceleración/fricción, wall-jump, hang time |
| **Fuego y Agua** (Coop) | 5 niveles, 2 jugadores locales, palancas, plataformas móviles |
| **Donkey Kong** | 4 pantallas (25m/50m/75m/100m), barriles, escaleras |

### 🧩 Puzzle y Gestión

| Juego | Mecánicas clave |
|-------|----------------|
| **Trivia Trampa** | 18 preguntas con zonas ocultas y trampas |
| **Papa's Pizzeria** | Colas, temporizadores, 7 pasos de preparación |
| **Stick RPG** | 8 escenas, 14 días, 3 estadísticas, eventos aleatorios |
| **Tetris** | 7-bag randomizer, ghost piece, wall kick, pausa |
| **Pac-Man** | Laberinto 21×21, 4 IA de fantasmas distintas, power pellets |

### ⚔️ Estrategia

| Juego | Mecánicas clave |
|-------|----------------|
| **Crush the Castle** | Oleadas infinitas, proyectiles con física, 4 tipos de bloque |
| **Bowman** | Tiro parabólico con viento, IA adaptativa, power-ups |
| **Bloons TD** | 15 oleadas, 3 torres, 11 tipos de bloon, x2/x3 speed |
| **Territory War** | Turnos, 5 tipos de unidad, captura de territorio, IA de bots |

### 🎭 Rol y Aventura

| Juego | Mecánicas clave |
|-------|----------------|
| **Swords and Souls** | 4 zonas, 3 minijuegos de entrenamiento, 12 enemigos, tienda |
| **Henry Stickmin** | 40+ escenas, 29 finales, 5 caminos iniciales |

### 🚀 Expansión retro (Nivel 1-3)

| Juego | Mecánicas clave |
|-------|----------------|
| **Super Mario Bros** | Scroll lateral, 4 power-ups, plataformas móviles, bandera final |
| **Contra** | Run & gun, 5 armas intercambiables, 3 jefes finales |
| **Metroid** | Exploración no lineal, 4 power-ups, mapa interconectado, jefe final |

### 🏎️ Shooter y Carreras

| Juego | Mecánicas clave |
|-------|----------------|
| **Space Harrier** | Pseudo-3D shooter sobre raíles, 30+ enemigos, 3 jefes |
| **OutRun** | Carreras top-down, tráfico, derrapes, 4 músicas, 5 checkpoints |

### 🥊 Lucha y Beat'em Up

| Juego | Mecánicas clave |
|-------|----------------|
| **Street Fighter** | 4 personajes (Ryu, Ken, Chun-Li, Dhalsim), supers, rounds, IA |
| **Golden Axe** | 3 personajes, 8 oleadas, magia, 3 jefes |

### 🎸 Ritmo y Puzzle

| Juego | Mecánicas clave |
|-------|----------------|
| **Guitar Hero** | 5 cuerdas, combo, canciones procedurales, 4 dificultades |
| **Bejeweled** | Match-3, cascadas, power-ups especiales |
| **Lemonade Stand** | Tycoon económico, clima dinámico, 12 días, 6 recetas |

## La Game Interface

Cada juego es una clase que extiende `GameBase` con estos métodos:

```js
class MiJuego extends GameBase {
  init(engine)          // Setup inicial; engine da acceso a canvas/ctx/input
  update(dt)            // Lógica por frame, dt en segundos
  render(ctx)           // Dibujo; el engine ya limpió el canvas
  handleResize(w, h)    // Opcional
  destroy()             // Opcional
}
```

El motor llama a estos métodos en orden dentro del bucle rAF. No sabe nada de reglas de juego concretas.

## Action Mapping

Todos los juegos usan **action mapping** para abstraer la entrada del jugador:

```js
// Las acciones por defecto vienen de GameBase._defaultBindings()
// Cada juego puede sobrescribirlas añadiendo las suyas:

_defaultBindings() {
  const parent = super._defaultBindings ? super._defaultBindings() : {};
  return {
    ...parent,                                    // hereda moveLeft, moveRight, action, etc.
    jump: ['Space', 'ArrowUp', 'KeyW', 'GamepadA'],
    shoot: ['KeyJ', 'GamepadX'],
  };
}

// En update(), usar acciones en vez de teclas concretas:
if (this.input.wasActionPressed('jump'))  this.jump();
if (this.input.isActionDown('shoot'))     this.shoot();

// Las teclas raw también funcionan:
if (this.input.isDown('Digit1')) this.selectTower(0);
```

### Acciones por defecto (GameBase)

| Acción | Teclas asignadas |
|--------|-----------------|
| `moveLeft` | ←, A, GamepadLStickLeft, GamepadLeft |
| `moveRight` | →, D, GamepadLStickRight, GamepadRight |
| `moveUp` | ↑, W, GamepadLStickUp, GamepadUp |
| `moveDown` | ↓, S, GamepadLStickDown, GamepadDown |
| `action` | Espacio, J, GamepadA |
| `action2` | K, GamepadX |
| `pause` | Escape, P, GamepadStart |
| `back` | Escape, GamepadB |

### Gamepad

El InputManager soporta gamepad con:
- **Botones digitales**: A, B, X, Y, L1, R1, L2, R2, Select, Start, D-pad
- **Sticks analógicos**: izquierdo y derecho (con deadzone radial 0.15 + re-escalado)
- **Gatillos analógicos**: como valor continuo 0-1 y como botón digital (umbral 0.5)
- **Teclas virtuales**: todos los botones se exponen como `GamepadA`, `GamepadLStickLeft`, etc.
- **Funcionan con action mapping** y también con `isDown()` raw

### Reasignación de teclas

Los jugadores pueden reasignar teclas mediante `SettingsManager`:
```js
SettingsManager.setBinding('breakout', 'jump', ['Space', 'KeyW', 'GamepadA']);
```

Los cambios persisten en localStorage y se aplican automáticamente al iniciar la partida.

## Progresión

El sistema de progresión incluye:

- **Perfil de jugador**: nombre, XP, nivel (1-10 con títulos como Novato, Leyenda, etc.)
- **Estadísticas**: partidas jugadas, victorias, mejor puntuación, tiempo total por juego
- **Logros**: 60+ logros distribuidos entre los 35 juegos (3 por juego)
- **Desbloqueables**: 10 ítems cosméticos (skins, modos, power-ups) vinculados a logros y XP
- **Bonus diario**: XP extra por jugar 3 juegos diferentes en un día

## Añadir un juego nuevo

1. Crear `src/games/<id>/` con `index.js`, `<Game>.js`, `i18n.js`, `README.md`
2. Extender `GameBase` y definir `_defaultBindings()` con las acciones del juego
3. Implementar `init()`, `update()`, `render()` según la Game Interface
4. Añadir entrada en `src/games/registry.js` con `load()` apuntando a `import()` dinámico
5. Crear `i18n.js` con `export default { 'id.clave': { es, en } }` para traducciones
6. Añadir `test` config al registry para el smoke test

## Verificación

```bash
# Sintaxis
find src -name "*.js" -exec node --check {} \;

# Smoke test (requiere npm install)
npm test
# Ejecuta cada juego 300+ frames con input sintético contra canvas simulado
```

## Convenciones

- **Zero dependencias externas** en el motor. Si un juego necesita algo específico, vive en su carpeta.
- **Action mapping** en todos los juegos: usar `isActionDown()` en vez de `isDown()` siempre que sea posible.
- **StorageManager** namespacea por juego (`gamehub:<id>:<key>`).
- **i18n** con carga dinámica: cada juego tiene su `i18n.js`, el motor lo carga al iniciar el juego.
- **Patrones comunes** que se repiten entre juegos (partículas, HUD, wrapText, action mapping) se extraen al motor.
- **Escalado responsive**: el canvas se escala al ancho de la ventana (máx 1200×800, 4 configuraciones de aspecto).
- **35 juegos**, todos con smoke test automatizado (350+ frames cada uno).
