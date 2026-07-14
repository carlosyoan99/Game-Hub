# GameHub Engine — Contexto del proyecto

## Estado actual (Julio 2026)

**25 juegos implementados** distribuidos en categorías de complejidad progresiva.

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
| **Fuego y Agua** (Coop) | 2 jugadores locales, palancas, plataformas móviles, 5 niveles | ⭐⭐⭐ |
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
| **Crush the Castle** | Proyectiles con física, 4 tipos de bloque, oleadas infinitas | ⭐⭐⭐⭐ |
| **Bowman** | Tiro parabólico con viento, IA adaptativa, power-ups | ⭐⭐⭐ |
| **Bloons TD** | Waypoints + 3 torres, 11 tipos de bloon, 15 oleadas | ⭐⭐⭐⭐ |
| **Territory War** | Turnos, 5 unidades, captura de territorio, IA de bots | ⭐⭐⭐⭐⭐ |

## 🎭 Rol y Aventura

| Juego | Mecánica principal | Dificultad |
|:--- |:--- |:--- |
| **Swords and Souls** | 4 zonas, 3 minijuegos, 12 enemigos, combate por turnos, tienda | ⭐⭐⭐⭐⭐ |
| **Henry Stickmin** | 40+ escenas, 29 finales, árbol de decisiones | ⭐⭐⭐⭐ |

---

## Arquitectura del motor (18 módulos)

| Módulo | Función |
|:--- |:--- |
| `GameEngine.js` | Bucle rAF con delta-time clamp y maxDt (0.25s) |
| `GameBase.js` | Clase base con init/destroy/renderHUD comunes |
| `InputManager.js` | Teclado + ratón + touch, attach/detach lifecycle |
| `AudioManager.js` | Web Audio API: SFX procedimentales, música, 40+ efectos |
| `HapticManager.js` | Vibration API con 7 patrones predefinidos |
| `SettingsManager.js` | Singleton: tema, idioma, reducedMotion, volumen, háptico |
| `StorageManager.js` | localStorage namespaced por juego |
| `CollisionUtils.js` | AABB, círculo, círculo-AABB, pointInRect, clamp |
| `Vector2.js` | fromAngle, add/sub/scale, normalize |
| `SeededRandom.js` | PRNG Mulberry32 con encode/decode para códigos |
| `ParticleSystem.js` | emit/burst/update/render con reducedMotion guard |
| `Tilemap.js` | parseAscii, resolveAABB por eje separado, render con viewport |
| `Camera.js` | follow con clamp al mundo, apply(ctx) para scroll |
| `GameUI.js` | renderOverlay, renderPauseOverlay, renderDefaultHUD |
| `wrapText.js` | Word-wrap para textos multilínea en canvas |
| `i18n.js` | ES/EN con registerTranslations, loadGameTranslations |
| `IconRenderer.js` | 35+ iconos SVG inline para canvas |
| `AssetLoader.js` | Carga asíncrona de imágenes, audio, JSON |

---

## Progreso de implementación

| Categoría | Juegos | Estado |
|:--- |:--- |:--- |
| 🏓 Arcade Clásico | 10 | ✅ Completo |
| 🎮 Plataformas | 4 | ✅ Completo |
| 🧩 Puzzle y Gestión | 5 | ✅ Completo |
| ⚔️ Estrategia | 4 | ✅ Completo |
| 🎭 Rol y Aventura | 2 | ✅ Completo |
| **Total** | **25** | **✅ 25/25** |

---

## Funcionalidades del Hub

- ✅ **Búsqueda en vivo**: filtra juegos por título/tagline en ES y EN
- ✅ **Settings modal**: tema oscuro/claro, idioma ES/EN, volumen, vibración
- ✅ **Tema claro/oscuro**: paletas específicas diseñadas manualmente
- ✅ **Reducción de animaciones**: desactiva partículas y animaciones decorativas
- ✅ **i18n ES/EN**: hub + todos los juegos traducidos
- ✅ **Carga dinámica**: cada juego se carga bajo demanda vía import()
- ✅ **Carga paralela**: juego + traducciones se cargan simultáneamente
- ✅ **Indicador de carga**: barra de progreso mientras se carga el juego
- ✅ **Iconos SVG**: en hub (gear, search, close, sun, moon, etc.), no emojis
- ✅ **Favicon SVG**: inline, sin 404 de favicon.ico
- ✅ **Responsive**: canvas se escala al ancho de la ventana

---

## Tester de humo

`npm test` (smoke_test.mjs):
- Recorre los 25 juegos del registro
- Para cada uno: init() → 300+ frames con input sintético → destroy()
- Verifica que no se lancen excepciones
- Verifica asserts específicos por juego (score, lives, etc.)
