# GameHub Engine — Contexto del proyecto

## Estado actual (Julio 2026)

**25 juegos implementados** distribuidos en categorías de complejidad progresiva.
Motor con soporte completo de teclado, ratón, touch, gamepad y action mapping rebindable.

---

## 🏓 Arcade Clásico

| Juego | Mecánica principal | Dificultad |
|:--- |:--- |:--- |
| **Breakout** | Rebotes con ángulos variables, 5 niveles, ladrillos duros | ⭐ |
| **Snake** | Movimiento grid con cola, 5 niveles con obstáculos | ⭐ |
| **Pong** | Dos paletas + IA predictiva, 5 niveles progresivos | ⭐ |
| **Flappy Bird** | Gravedad constante, scroll infinito, 5 niveles | ⭐⭐ |
| **Space Invaders** | Disparos verticales, oleadas infinitas, escudos | ⭐⭐ |
| **Centipede** | Ciempiés segmentado, hongos, arañas, oleadas infinitas | ⭐⭐ |
| **Missile Command** | Defensa antimisiles con ratón, oleadas infinitas | ⭐⭐ |
| **Galaga** | Formaciones + picadas + nave gemela, oleadas infinitas | ⭐⭐ |
| **Frogger** | Cruce de carretera y río, oleadas infinitas | ⭐⭐ |
| **Asteroids** | Física wraparound, 10 oleadas, naves enemigas | ⭐⭐ |

## 🎮 Plataformas

| Juego | Mecánica principal | Dificultad |
|:--- |:--- |:--- |
| **Platformer** | Tilemap + cámara, 5 niveles, coyote time, salto variable | ⭐⭐⭐ |
| **Fancy Pants** | Aceleración/fricción, wall-jump, hang time, 5 niveles | ⭐⭐⭐ |
| **Fuego y Agua** (Coop) | 2 jugadores locales, palancas, plataformas móviles, 5 niveles, gamepad dual | ⭐⭐⭐ |
| **Donkey Kong** | 4 pantallas (25m/50m/75m/100m), barriles, escaleras | ⭐⭐⭐ |

## 🧩 Puzzle y Gestión

| Juego | Mecánica principal | Dificultad |
|:--- |:--- |:--- |
| **Trivia Trampa** | 18 preguntas trampa, zonas ocultas, 3 vidas | ⭐⭐ |
| **Papa's Pizzeria** | Colas, temporizadores, 7 pasos de preparación | ⭐⭐⭐ |
| **Stick RPG** | 8 escenas, 14 días, energía, diálogos con NPCs | ⭐⭐⭐⭐ |
| **Tetris** | 7-bag randomizer, ghost piece, wall kick, pausa | ⭐⭐⭐ |
| **Pac-Man** | Laberinto 21×21, 4 IA de fantasmas, power pellets | ⭐⭐⭐ |

## ⚔️ Estrategia

| Juego | Mecánica principal | Dificultad |
|:--- |:--- |:--- |
| **Crush the Castle** | Proyectiles con física, 4 tipos de bloque, oleadas infinitas, gamepad | ⭐⭐⭐⭐ |
| **Bowman** | Tiro parabólico con viento, IA adaptativa, power-ups, gamepad | ⭐⭐⭐ |
| **Bloons TD** | Waypoints + 3 torres, 11 tipos de bloon, 15 oleadas | ⭐⭐⭐⭐ |
| **Territory War** | Turnos, 5 unidades, captura de territorio, IA de bots | ⭐⭐⭐⭐⭐ |

## 🎭 Rol y Aventura

| Juego | Mecánica principal | Dificultad |
|:--- |:--- |:--- |
| **Swords and Souls** | 4 zonas, 3 minijuegos, 12 enemigos, combate por turnos, tienda | ⭐⭐⭐⭐⭐ |
| **Henry Stickmin** | 40+ escenas, 29 finales, árbol de decisiones | ⭐⭐⭐⭐ |

---

## Arquitectura del motor (18 módulos)

| Módulo | Función | Novedades recientes |
|:--- |:--- |:--- |
| `GameEngine.js` | Bucle rAF con delta-time clamp y maxDt (0.25s) | ✅ Toasts automáticos en gamepad con/disc, `destroy()` con cleanup de listeners |
| `GameBase.js` | Clase base con init/destroy/renderHUD comunes | ✅ Auto-aplicación de bindings via `_defaultBindings()`, `destroy()` sobrescribible |
| `InputManager.js` | Teclado + ratón + touch + gamepad, attach/detach lifecycle | ✅ Gamepad API (polling, deadzone radial 0.15, sticks analógicos, 24 teclas virtuales), action mapping (`bind/unbind/isActionDown/wasActionPressed`), `getBoundKeys()`, `clearActions()`, blur cleanup, `e.repeat` filter, mouse wheel, contextmenu prevention, `endFrame()` automático |
| `AudioManager.js` | Web Audio API: SFX procedimentales, música, 40+ efectos | — |
| `HapticManager.js` | Vibration API con 7 patrones predefinidos | — |
| `SettingsManager.js` | Singleton: tema, idioma, reducedMotion, volumen, háptico | ✅ Key bindings API completa (`getBinding/setBinding/applyBindings/listenForBind/resetAllBindings`), `_bindingListeners` separados, `listenForBind` con soporte de gamepad + detección de transiciones |
| `StorageManager.js` | localStorage namespaced por juego | — |
| `CollisionUtils.js` | AABB, círculo, círculo-AABB, pointInRect, clamp | — |
| `Vector2.js` | fromAngle, add/sub/scale, normalize | — |
| `SeededRandom.js` | PRNG Mulberry32 con encode/decode para códigos | — |
| `ParticleSystem.js` | emit/burst/update/render con reducedMotion guard | — |
| `Tilemap.js` | parseAscii, resolveAABB por eje separado, render con viewport | — |
| `Camera.js` | follow con clamp al mundo, apply(ctx) para scroll | — |
| `GameUI.js` | Overlays, HUD, helpers de renderizado | ✅ `renderGamepadIndicator()` con tooltip hover + nombre real del control, `createToastManager()` con slide-in animation (easeOutCubic, 0.3s), fade-out, 3 toasts máx. |
| `wrapText.js` | Word-wrap para textos multilínea en canvas | — |
| `i18n.js` | ES/EN con registerTranslations, loadGameTranslations | ✅ 3 traducciones de gamepad (`connected/disconnected/tooltip`) |
| `IconRenderer.js` | 35+ iconos SVG inline para canvas | — |
| `AssetLoader.js` | Carga asíncrona de imágenes, audio, JSON | — |

---

## Funcionalidades del Hub

- ✅ **Búsqueda en vivo**: filtra juegos por título/tagline en ES y EN
- ✅ **Settings modal**: tema oscuro/claro, idioma ES/EN, volumen, vibración, **key bindings**
- ✅ **Tema claro/oscuro**: paletas específicas diseñadas manualmente
- ✅ **Reducción de animaciones**: desactiva partículas y animaciones decorativas
- ✅ **i18n ES/EN**: hub + todos los juegos traducidos
- ✅ **Carga dinámica**: cada juego se carga bajo demanda vía import()
- ✅ **Carga paralela**: juego + traducciones se cargan simultáneamente
- ✅ **Indicador de carga**: barra de progreso mientras se carga el juego
- ✅ **Iconos SVG**: en hub (gear, search, close, sun, moon, etc.), no emojis
- ✅ **Favicon SVG**: inline, sin 404 de favicon.ico
- ✅ **Responsive**: canvas se escala al ancho de la ventana
- ✅ **Gamepad indicator**: icono automático en HUD + tooltip hover con nombre del control
- ✅ **Toast notifications**: notificaciones al conectar/desconectar gamepad con slide-in animado
- ✅ **Action mapping**: todos los juegos pueden usar `bind()` para teclado + gamepad
- ✅ **Rebinding de controles**: teclas personalizables via SettingsManager + `listenForBind`

## Juegos con gamepad

De los 25 juegos, **16 tienen soporte de gamepad** implementado:

| Juego | Controles gamepad |
|:--- |:--- |
| Asteroids | Rotación (LStick/L/R), propulsión (A), disparo (X), hiperespacio (B) |
| Bloons TD | Selección de torre (D-pad L/R), colocar (A), inicio oleada (Start) |
| Bowman | Ángulo (D-pad Up/Down + LStick), disparo (A) |
| Breakout | Paleta (LStick L/R + D-pad), saque (A) |
| Centipede | Movimiento (LStick), disparo (A) |
| Coop Platformer | 2 jugadores: P1 (LStick + A), P2 (RStick + B) |
| Crush the Castle | Ángulo (D-pad Up/Down + LStick), potencia (D-pad L/R + LStick), disparo (A), siguiente oleada (A/Start) |
| Donkey Kong | Movimiento (LStick L/R + D-pad), salto (A), escaleras (Up/Down) |
| Fancy Pants | Movimiento (LStick L/R), salto (A), wall-jump |
| Flappy Bird | Salto (A, Space, Up) |
| Frogger | Movimiento direccional (D-pad + LStick) |
| Galaga | Movimiento (LStick L/R), disparo (A) |
| Pac-Man | Movimiento direccional (D-pad + LStick), acción (A) |
| Pong | Paleta (LStick Up/Down + D-pad) |
| Snake | Movimiento direccional (D-pad + LStick) |
| Space Invaders | Movimiento (LStick L/R + D-pad), disparo (A) |

---

---

## 🎮 Guía rápida de gamepad para desarrolladores

### 1. Detectar gamepad

El engine lo maneja automáticamente. El estado está en `this.input.gamepad`:

```js
if (this.input.gamepad.connected) {
  // Hay un gamepad conectado
}
```

El engine muestra un icono 🎮 en el HUD y un toast "Gamepad conectado" automáticamente.

### 2. Botones digitales — `isDown()` / `wasPressed()`

Usar códigos con prefijo `Gamepad*`. Compatibles con `isDown()` (mantenido) y `wasPressed()` (justo este frame):

```js
// Botones de acción
this.input.wasPressed('GamepadA')      // Saltar, disparar, confirmar
this.input.wasPressed('GamepadB')      // Atrás, cancelar
this.input.wasPressed('GamepadX')      // Acción secundaria
this.input.wasPressed('GamepadY')      // Acción terciaria

// Gatillos (umbral digital 0.5)
this.input.isDown('GamepadL2')         // Gatillo izquierdo
this.input.isDown('GamepadR2')         // Gatillo derecho

// D-pad
this.input.isDown('GamepadUp')
this.input.isDown('GamepadDown')
this.input.isDown('GamepadLeft')
this.input.isDown('GamepadRight')

// Hombros
this.input.isDown('GamepadL1')
this.input.wasPressed('GamepadR1')

// Menú
this.input.wasPressed('GamepadStart')  // Pausa, iniciar partida
this.input.wasPressed('GamepadSelect') // Volver al menú
```

Lista completa de códigos virtuales:

| Código | Botón | Notas |
|:--- |:--- |:--- |
| `GamepadA` | Cara sur (A/⭕/✖) | Acción principal |
| `GamepadB` | Cara este (B/❌/◻) | Acción secundaria |
| `GamepadX` | Cara oeste (X/◻/△) | Acción terciaria |
| `GamepadY` | Cara norte (Y/△/◈) | Acción cuaternaria |
| `GamepadL1` | Hombro izquierdo (LB/L1) | — |
| `GamepadR1` | Hombro derecho (RB/R1) | — |
| `GamepadL2` | Gatillo izquierdo (LT/L2) | Digital (umbral 0.5) |
| `GamepadR2` | Gatillo derecho (RT/R2) | Digital (umbral 0.5) |
| `GamepadUp` | D-pad arriba | — |
| `GamepadDown` | D-pad abajo | — |
| `GamepadLeft` | D-pad izquierda | — |
| `GamepadRight` | D-pad derecha | — |
| `GamepadSelect` | Select/Back | — |
| `GamepadStart` | Start | — |
| `GamepadL3` | Click stick izquierdo (L3) | — |
| `GamepadR3` | Click stick derecho (R3) | — |
| `GamepadHome` | Home/Guide | — |
| `GamepadLStickUp` | Stick izq. arriba | Umbral 0.5 |
| `GamepadLStickDown` | Stick izq. abajo | Umbral 0.5 |
| `GamepadLStickLeft` | Stick izq. izquierda | Umbral 0.5 |
| `GamepadLStickRight` | Stick izq. derecha | Umbral 0.5 |
| `GamepadRStickUp` | Stick der. arriba | Umbral 0.5 |
| `GamepadRStickDown` | Stick der. abajo | Umbral 0.5 |
| `GamepadRStickLeft` | Stick der. izquierda | Umbral 0.5 |
| `GamepadRStickRight` | Stick der. derecha | Umbral 0.5 |

### 3. Sticks analógicos — `gamepad.leftStick` / `rightStick`

Para movimiento suave (no solo direcciones cardinales):

```js
if (this.input.gamepad.connected) {
  const ls = this.input.gamepad.leftStick;
  const rs = this.input.gamepad.rightStick;

  // Movimiento analógico suave
  this.player.x += ls.x * SPEED * dt;
  this.player.y += ls.y * SPEED * dt;

  // Gatillos como valores analógicos 0..1
  const brake = this.input.gamepad.leftTrigger;
  const accelerate = this.input.gamepad.rightTrigger;
}
```

Los sticks ya tienen deadzone radial 0.15 aplicada. Los valores van de -1 a 1.

### 4. Action mapping — `bind()` / `isActionDown()` / `wasActionPressed()`

**Recomendado** para juegos nuevos. Permite que el jugador reasigne teclas:

```js
// En init():
this.input.bind('moveLeft',  'ArrowLeft',  'KeyA', 'GamepadLStickLeft', 'GamepadLeft');
this.input.bind('moveRight', 'ArrowRight', 'KeyD', 'GamepadLStickRight', 'GamepadRight');
this.input.bind('jump',      'Space',      'KeyW', 'GamepadA');
this.input.bind('shoot',     'Space',      'GamepadR1');

// En update():
if (this.input.isActionDown('moveLeft'))  this.player.x -= SPEED * dt;
if (this.input.isActionDown('moveRight')) this.player.x += SPEED * dt;
if (this.input.wasActionPressed('jump'))  this.player.vy = -JUMP_FORCE;
if (this.input.wasActionPressed('shoot')) this._fire();
```

### 5. Auto-bindings via `_defaultBindings()`

Si extiendes `GameBase`, puedes definir bindings por defecto y el engine las aplica
automáticamente al iniciar el juego. El jugador puede sobrescribirlas:

```js
class MiJuego extends GameBase {
  init(engine) {
    super.init(engine, 'mi-juego');
    // _defaultBindings() se aplica automáticamente desde GameBase.init()
  }

  _defaultBindings() {
    return {
      moveLeft: ['ArrowLeft', 'KeyA', 'GamepadLStickLeft', 'GamepadLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadLStickRight', 'GamepadRight'],
      jump: ['Space', 'KeyW', 'GamepadA'],
      shoot: ['Space', 'GamepadR1', 'GamepadX'],
    };
  }

  update(dt) {
    // Usar isActionDown / wasActionPressed siempre
    if (this.input.isActionDown('moveLeft')) this.player.x -= SPEED * dt;
  }
}
```

### 6. Ejemplo completo mínimo

```js
import GameBase from '../../engine/GameBase.js';

class MiJuego extends GameBase {
  init(engine) {
    super.init(engine, 'mi-juego');
    this.player = { x: 100, y: 100 };
    this.status = 'playing';
  }

  update(dt) {
    if (this.handleRestartInput()) return;
    if (this.status !== 'playing') return;

    // Teclado + gamepad simultáneo (action mapping)
    if (this.input.isActionDown('moveLeft'))  this.player.x -= 200 * dt;
    if (this.input.isActionDown('moveRight')) this.player.x += 200 * dt;
    if (this.input.wasActionPressed('jump'))  this.player.y -= 50;

    // Analógico puro (opcional, además del action mapping)
    if (this.input.gamepad.connected) {
      const stick = this.input.gamepad.leftStick;
      this.player.x += stick.x * 300 * dt;
    }

    // Clics (ratón o toque)
    if (this.input.mouse.clickedThisFrame) {
      // this.input.mouse.x, this.input.mouse.y
    }
  }

  _defaultBindings() {
    return {
      moveLeft: ['ArrowLeft', 'KeyA', 'GamepadLeft', 'GamepadLStickLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadRight', 'GamepadLStickRight'],
      jump: ['Space', 'KeyW', 'GamepadUp', 'GamepadA'],
    };
  }
}
```

### 7. Reglas de oro

| Regla | Explicación |
|:--- |:--- |
| **Siempre usa action mapping** | `bind()` + `isActionDown()` / `wasActionPressed()` permite rebinding automático |
| **Define _defaultBindings()** | El engine aplica los defaults + cualquier binding personalizada del jugador |
| **No mezcles códigos directos con action mapping** | O usas `isDown('Space')` o `isActionDown('shoot')`, no ambos para la misma acción |
| **Ofrece sticks y D-pad** | `GamepadLStickLeft` + `GamepadLeft` para cubrir ambos estilos de juego |
| **Gamepad no reemplaza al teclado** | Todos los juegos deben funcionar solo con teclado. El gamepad es adicional |
| **endFrame() es automático** | El engine lo llama. No llames `this.input.endFrame()` manualmente |
| **No llames a poll() manualmente** | El engine lo hace al inicio de cada frame. Llamarlo otra vez es redundante |

---

## Documentación

| Documento | Contenido |
|:--- |:--- |
| `docs/engine-architecture.md` | Arquitectura técnica completa de los 18 módulos, APIs, diagramas Mermaid del bucle, flujo de input, arquitectura de audio, flujo de carga de juego y patrones de uso |
| `docs/retro-arcade-expansion-spec.md` | Especificación de expansión retro arcade con features implementadas y futuras |
| `docs/hub-enhancement-spec.md` | Especificación de mejoras del hub con checklist de items completados |

---

## Tester de humo

`npm test` (smoke_test.mjs):
- Recorre los 25 juegos del registro
- Para cada uno: init() → 300+ frames con input sintético → destroy()
- Verifica que no se lancen excepciones
- Verifica asserts específicos por juego (score, lives, etc.)
- **Último resultado**: ✅ 25/25 pasaron
