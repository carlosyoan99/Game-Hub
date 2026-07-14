# GameHub Engine

Sistema modular para una colección de 25 minijuegos Canvas 2D con motor de juego común.
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
  main.js                   Hub: menú, búsqueda, carga dinámica, settings
  engine/                   Motor de juego común (18 módulos)
    GameEngine.js            Bucle rAF con delta-time clamp
    GameBase.js              Clase base para todos los juegos
    InputManager.js          Teclado + ratón + touch
    AudioManager.js          Web Audio API: SFX + música + procedimental
    HapticManager.js         Vibration API con patrones predefinidos
    SettingsManager.js       Singleton: tema, idioma, volumen, háptico
    StorageManager.js        localStorage namespaced por juego
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
  games/                    Todos los juegos (cada uno es una unidad independiente)
    registry.js              Lista maestra de juegos con import() dinámico
    <game-id>/               Cada juego tiene: index.js, <Game>.js, i18n.js, README.md
assets/
  icons/                    Iconos SVG usados en el hub
docs/                       Documentación técnica
```

## Juegos incluidos (25)

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

## La Game Interface

Cada juego es una clase que extiende `GameBase` (o implementa la interfaz plana) con estos métodos:

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

## Añadir un juego nuevo

1. Crear `src/games/<id>/` con `index.js`, `<Game>.js`, `i18n.js`, `README.md`
2. Usar los módulos del motor (`InputManager`, `CollisionUtils`, etc.) en vez de reinventar
3. Añadir entrada en `src/games/registry.js` con `load()` apuntando a `import()` dinámico
4. Si tiene traducciones, crear `i18n.js` con `export default { 'id.clave': { es, en } }`
5. Añadir entradas al smoke test en `smoke_test.mjs`

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
- **StorageManager** namespacea por juego (`gamehub:<id>:<key>`).
- **i18n** con carga dinámica: cada juego tiene su `i18n.js`, el motor lo carga al iniciar el juego.
- **Patrones comunes** que se repiten entre juegos (partículas, HUD, wrapText) se extraen al motor.
- **Escalado responsive**: el canvas se escala al ancho de la ventana (máx 900×540).
