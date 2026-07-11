# GameHub Engine

Punto de entrada único + motor de juego común para una colección de
minijuegos en Canvas 2D. Sin frameworks, sin build step obligatorio:
funciona abriendo `index.html` con un servidor estático simple
(los `import` ES6 requieren `http://`, no `file://`).

```
npx serve .
# o
python3 -m http.server 8000
```

## Estructura

```
index.html              punto de entrada único (hub)
styles/main.css          tema visual del hub
src/
  main.js                 lógica del hub: menú, carga dinámica, resize
  engine/
    GameEngine.js          bucle de juego (rAF, delta time, clamp)
    InputManager.js        teclado + ratón + touch mínimo
    Vector2.js              utilidades de vector
    CollisionUtils.js       AABB, círculo, círculo-AABB, clamp
    AssetLoader.js           caché de imágenes/audio/JSON
    StorageManager.js        localStorage namespaced por juego
    Tilemap.js                colisión por eje contra cuadrícula, render por viewport, arte ASCII
    Camera.js                  cámara de scroll que sigue a un objetivo, con clamp al mundo
  games/
    registry.js              lista de juegos + import() dinámico
    breakout/
      Breakout.js              Nivel 1: rebote con ángulo variable
    snake/
      Snake.js                  Nivel 1: movimiento en cuadrícula, cola, colisión propia
    pong/
      Pong.js                    Nivel 1: dos palas, IA simple
    flappy-bird/
      FlappyBird.js               Nivel 1: gravedad constante, scroll infinito
    asteroids/
      Asteroids.js                 Nivel 2: física de nave, wraparound, primer uso de Vector2
    platformer/
      Platformer.js                 Nivel 2: primer uso de Tilemap + Camera
    fancy-pants/
      FancyPants.js                  Nivel 2: aceleración/fricción, hang time, salto en pared
    coop-platformer/
      CoopPlatformer.js               Nivel 2: cooperativo local, plataforma móvil, palanca
    trick-quiz/
      TrickQuiz.js                     Nivel 3: primer juego sin física, primer uso real de pointInRect
```

## La "Game Interface"

Cada juego es una clase plana (sin herencia obligatoria) con estos métodos:

```js
class MiJuego {
  init(engine)          // setup inicial; engine da acceso a canvas/ctx
  update(dt)             // dt en segundos
  render(ctx)             // dibujo; el engine ya limpió el canvas
  handleResize(w, h)      // opcional
  destroy()                // opcional; quitar listeners propios
}
```

El motor no sabe nada de reglas de juego concretas: solo llama a estos
métodos en orden. `Breakout.js` es la referencia de cómo estructurar
input, colisiones y HUD dentro de esta interfaz.

## Añadir un juego nuevo

1. `src/games/<id>/` con tu clase principal exportada.
2. Usa `InputManager`, `CollisionUtils`, `StorageManager` del motor en
   vez de reinventar detección de teclas o localStorage.
3. Añade una entrada en `src/games/registry.js` con `load()` apuntando
   a un `import()` dinámico — así el código de cada juego solo se
   descarga cuando el jugador lo elige, y el hub no crece con cada
   juego nuevo.
4. No toques `main.js` ni `GameEngine.js` salvo que el juego necesite
   una capacidad genuinamente nueva del motor (en ese caso, esa
   capacidad debería servir a más de un juego, no ser un parche
   específico).

## Verificación

- Sintaxis: `find src -name "*.js" -exec node --check {} \;` (sin dependencias).
- Prueba de humo (opcional, requiere `npm install` para `jsdom` como
  devDependency — no se usa en el motor ni en ningún juego, solo para
  simular DOM/teclado en el test): `npm test` ejecuta cada juego 300
  frames con input sintético contra un canvas simulado y falla si
  alguno lanza una excepción. Es un smoke test, no cobertura exhaustiva:
  detecta errores de referencia y de estado, no bugs de balance/feel.

## Convenciones (auditoría continua)

- Un juego nuevo se construye rápido; en una pasada posterior se
  audita: fugas de listeners en `destroy()`, límites de canvas,
  rendimiento del bucle de colisiones (por ahora O(n) simple, migrar a
  spatial hashing si algún juego de Nivel 4+ lo necesita).
- `StorageManager` namespacea por juego (`gamehub:<id>:<key>`) para
  evitar colisiones de claves cuando haya varios juegos con
  `highscore`, `progress`, etc.
- Cero dependencias externas en el motor. Si un juego concreto necesita
  algo (p. ej. un pathfinding A* para Nivel 4), que viva dentro de la
  carpeta de ese juego, no en `src/engine/`.

## Ruta de niveles

1. **Nivel 1** (Breakout, Snake, Pong, Flappy Bird): bucle de juego,
   AABB/círculo, input. Cubierto por el motor tal cual estaba desde el
   principio.
2. **Nivel 2** (Asteroids, Platformer, Fancy Pants, Fuego y Agua):
   añadió `Vector2` con un caso de uso real (empuje orientado por
   ángulo) y `Tilemap.js`/`Camera.js` al motor — colisión tile-based
   resuelta por eje separado, y cámara con seguimiento y clamp al mundo.
   Los tres plataformas comparten `Tilemap`/`Camera` sin modificarlas;
   cada uno cambia el nivel y la mecánica específica (salto en pared,
   cooperativo con plataforma móvil y palanca). Completo.
3. **Nivel 3** (Trivia Trampa, en curso): el primer juego sin física —
   la interacción es pura máquina de estados (pregunta → feedback →
   siguiente pregunta o game over) evaluada con `pointInRect`, que ya
   existía en `CollisionUtils.js` desde Nivel 1 pero no tenía un caso de
   uso real hasta ahora. Papa's Pizzeria (colas + temporizadores) y
   Stick RPG (días/energía + diálogos) seguirían este mismo patrón: sin
   Tilemap ni Camera, estado + UI por click.
4. **Nivel 4+**: IA de waypoints, proyectiles con física propia, etc. —
   estos probablemente vivan como módulos dentro del propio juego hasta
   que un segundo juego repita el patrón; solo entonces se "sube" al
   motor.
