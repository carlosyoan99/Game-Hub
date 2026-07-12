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
    ParticleSystem.js          sistema de partículas reutilizable (emit/update/render)
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
      TrickQuiz.js                     Nivel 3: preguntas trampa y zonas ocultas
    papa-pizzeria/
      PapaPizzeria.js                  Nivel 3: colas, temporizadores y multitarea culinaria
    stick-rpg/
      StickRPG.js                      Nivel 3: días, energía, diálogos y cambio de escenas
    crush-the-castle/
      CrushTheCastle.js                Nivel 4: proyectiles con física en estructuras
    bowman/
      Bowman.js                        Nivel 4: tiro parabólico con viento
    bloons-td/
      BloonsTD.js                      Nivel 4: waypoints + torres defensivas
    territory-war/
      TerritoryWar.js                  Nivel 4: IA de bots, turnos y captura de territorio
    swords-and-souls/
      SwordsAndSouls.js                Nivel 5: entrenamiento, combate por turnos y subida de nivel
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
- Prueba de humo: `npm test` (requiere `npm install`). Ejecuta cada juego
  300 frames con input sintético contra un canvas simulado y falla si
  alguno lanza una excepción.
- Nuevos juegos: añadir entrada en `smoke_test.mjs` con clicks/teclas que
  ejerciten al menos la carga, el render básico y el destroy.

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
- La repetición de un patrón entre juegos (partículas, wrapText, etc.)
  es señal de que debería extraerse al motor (`src/engine/`).

## Ruta de niveles

1. **Nivel 1** (Breakout, Snake, Pong, Flappy Bird): bucle de juego,
   AABB/círculo, input. Cubierto por el motor tal cual estaba desde el
   principio. **4 juegos — completo.**

2. **Nivel 2** (Asteroids, Platformer, Fancy Pants, Fuego y Agua):
   añadió `Vector2` con un caso de uso real (empuje orientado por
   ángulo) y `Tilemap.js`/`Camera.js` al motor — colisión tile-based
   resuelta por eje separado, y cámara con seguimiento y clamp al mundo.
   Los tres plataformas comparten `Tilemap`/`Camera` sin modificarlas;
   cada uno cambia el nivel y la mecánica específica (salto en pared,
   cooperativo con plataforma móvil y palanca). **4 juegos — completo.**

3. **Nivel 3** (Trivia Trampa, Papa's Pizzeria, Stick RPG): el primer
   juego sin física (TrickQuiz) — la interacción es pura máquina de
   estados evaluada con `pointInRect`. Le siguen Papa's Pizzeria (colas +
   temporizadores + multitarea) y Stick RPG (días/energía + diálogos +
   cambio de escenas). **3 juegos — completo.**

4. **Nivel 4** (Crush the Castle, Bowman, Bloons TD, Territory War):
   proyectiles con física de gravedad, waypoints para rutas de enemigos,
   torres defensivas con auto-ataque, IA de bots con sistema de turnos y
   captura de territorio. El patrón de partículas (presente en los 4)
   se extrajo a `ParticleSystem.js` en el motor. **4 juegos — completo.**

5. **Nivel 5** (Swords and Souls, Henry Stickmin): el más complejo.
   **Swords and Souls** (completo): 4 zonas (casa/entrenamiento/arena/
   tienda), minijuegos de entrenamiento (puntería, sparring, resistencia),
   combate por turnos con IA adaptativa, subida de nivel con asignación
   de puntos y tienda con armas/armaduras/objetos. **Henry Stickmin**:
   pendiente.

## Estado actual

| Nivel | Juegos | Estado |
|-------|--------|--------|
| 🟢 Nivel 1 | Breakout, Snake, Pong, Flappy Bird (4) | ✅ Completo |
| 🟡 Nivel 2 | Asteroids, Platformer, Fancy Pants, Fuego y Agua (4) | ✅ Completo |
| 🔵 Nivel 3 | Trick Quiz, Papa's Pizzeria, Stick RPG (3) | ✅ Completo |
| 🔴 Nivel 4 | Crush the Castle, Bowman, Bloons TD, Territory War (4) | ✅ Completo |
| 🟣 Nivel 5 | Swords and Souls, Henry Stickmin (2) | ⏳ 1/2 |

Total: **16 juegos implementados** de 18 planeados.
