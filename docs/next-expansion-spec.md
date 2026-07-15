# GameHub Engine — Próxima Expansión (2026-Q3)

> **Fecha**: Julio 2026
> **Estado**: Planificación — spec basado en entrevista con el desarrollador
> **Objetivo**: Plan unificado que cubre nuevos juegos, mejoras a existentes, sistema de progresión y mejoras al hub/engine.

---

## 1. Visión General

Esta expansión tiene un enfoque 50/50: **mitad contenido nuevo, mitad mejorar lo existente**. Se añadirán 8+ juegos en géneros no cubiertos actualmente, se completará el soporte de gamepad en todos los juegos, se añadirá un sistema completo de progresión (perfil + logros + desbloqueables) y se pulirá visualmente la experiencia.

### 1.1 Principios de diseño

- **Misma estética retro actual**: colores sólidos, paletas retro, pixel art simple. Consistente con los 25 juegos existentes.
- **Prioridad a los más icónicos primero**: los juegos más reconocibles de cada género se implementan primero.
- **Progresión persistente**: sistema completo de perfil, logros, estadísticas y desbloqueables, todo en localStorage (sin backend).
- **Gamepad con action mapping en todos**: bind() + _defaultBindings() + isActionDown() obligatorio en juegos nuevos y existentes.
- **Estilo por tandas**: agrupación en batches por complejidad y dependencias.

### 1.2 Lo que NO cambia

- Canvas 2D rendering a 900×540
- Ciclo de vida `init/update/render/destroy`
- Carga dinámica vía `import()`
- i18n ES/EN en todos los juegos
- Smoke test obligatorio (25→33+ juegos)
- Sin dependencias externas

---

## 2. Nuevos Juegos por Género

Se añadirán **7 nuevos géneros** no cubiertos actualmente, con al menos **1 juego icónico por género** (total 8+ juegos nuevos).

### 2.1 Batch 1 — Los más icónicos (prioridad máxima)

| # | Juego | Género | Referencia | Complejidad | Líneas est. |
|---|-------|--------|-----------|-------------|-------------|
| 1 | **Super Mario-like** | Plataformas avanzadas | Super Mario Bros. | 🔴🔴🔴🔴 | ~700 |
| 2 | **Street Fighter-like** | Pelea 1v1 | Street Fighter II | 🔴🔴🔴🔴🔴 | ~800 |
| 3 | **Contra-like** | Run & Gun | Contra | 🔴🔴🔴🔴 | ~650 |

### 2.2 Batch 2 — Mecánicas únicas

| # | Juego | Género | Referencia | Complejidad | Líneas est. |
|---|-------|--------|-----------|-------------|-------------|
| 4 | **OutRun-like** | Carreras | OutRun | 🔴🔴🔴 | ~500 |
| 5 | **Guitar Hero-like** | Ritmo | Guitar Hero / DDR | 🔴🔴🔴 | ~450 |
| 6 | **Bejeweled-like** | Puzzle match-3 | Bejeweled | 🔴🔴 | ~400 |

### 2.3 Batch 3 — Experiencias más tranquilas

| # | Juego | Género | Referencia | Complejidad | Líneas est. |
|---|-------|--------|-----------|-------------|-------------|
| 7 | **Lemonade Stand-like** | Tycoon / Simulación | Lemonade Stand | 🔴🔴🔴 | ~500 |
| 8 | *(por definir)* | A elección | — | Variable | ~400-600 |

**Total estimado**: 8 juegos nuevos, ~4,000-5,000 líneas de código.

---

## 3. Especificaciones de Juegos Nuevos

### 3.1 Super Mario-like (Plataformas avanzadas)

**Mecánicas principales:**
- Scroll lateral infinito o por niveles (cámara sigue al jugador)
- Movimiento: izquierda/derecha + salto (con coyote time y variable jump height)
- Enemigos: Goomba-like (camina), Koopa-like (caparazón pateable)
- Power-ups: hongo (crecer), flor (disparar bolas de fuego), estrella (invulnerabilidad temporal)
- Bloques: ? (monedas/power-up), ladrillos (rompibles), tuberías (entradas a zonas secretas)
- Monedas, bandera de meta por nivel
- 3 vidas, puntos, récord

**Requerimientos técnicos:**
- Usar `Camera.js` del engine con scroll lateral (`follow()` centrado en X)
- Usar `Tilemap.js` con `parseAscii()` para niveles
- Action mapping con gamepad (`_defaultBindings()`)
- Power-up state machine (small → big → fire → star)

**Controles gamepad:**
| Acción | Teclas | Gamepad |
|--------|--------|---------|
| Mover | A/D, ←/→ | LStick L/R, D-pad L/R |
| Saltar | Espacio, ↑, W | GamepadA |
| Disparar | Espacio (si tiene flor) | GamepadB |
| Correr | Shift | GamepadX |

**i18n keys:** `mario.score`, `mario.coins`, `mario.world`, `mario.lives`

---

### 3.2 Street Fighter-like (Pelea 1v1)

**Mecánicas principales:**
- 2 jugadores (PvP local) o 1 jugador vs IA
- Escenario fijo, sin scroll
- Barra de salud, barra de super (se llena al recibir/golpear)
- Movimientos básicos: caminar, agacharse, saltar
- Golpes: puñetazo, patada, especial (con combo de teclas)
- Rounds al mejor de 3
- 4+ personajes con movimientos especiales únicos
- IA con diferentes niveles de dificultad

**Requerimientos técnicos:**
- InputManager con detección de combos/secuencias (`wasPressed` encadenados)
- Sistema de hitboxes (usar `CollisionUtils.circleIntersectsAABB` o similar)
- Estados: idle, walking, crouching, jumping, attacking, hit, blocking
- Frame data simplificado: startup, active, recovery frames

**Controles gamepad (P1):**
| Acción | Teclas | Gamepad |
|--------|--------|---------|
| Moverse | A/D, ←/→ | LStick L/R, D-pad L/R |
| Saltar | W, ↑ | GamepadUp |
| Agacharse | S, ↓ | GamepadDown |
| Puñetazo | J | GamepadX |
| Patada | K | GamepadA |
| Especial | L | GamepadB |
| Super | U (con barra llena) | GamepadY |

**Controles gamepad (P2):** Usar teclas separadas (F/D, R/F, etc.) + segundo gamepad.

**i18n keys:** `fighter.round`, `fighter.fight`, `fighter.ko`, `fighter.playerWins`, `fighter.character`

---

### 3.3 Contra-like (Run & Gun)

**Mecánicas principales:**
- Scroll lateral automático o por niveles
- Jugador se mueve en 8 direcciones, salta, dispara
- Armas: pistola (default), spread gun, machine gun, laser, fire
- Power-ups: S (Spread), M (Machine), L (Laser), R (Rapid), F (Fire)
- Oleadas de enemigos que entran desde bordes
- Jefes de nivel con patrones de ataque
- 3 vidas, continues opcionales

**Requerimientos técnicos:**
- Camera.js con scroll lateral
- Tilemap.js para plataformas y paredes
- Sistema de proyectiles (pool reutilizable)
- Spawners de enemigos por zona
- Animaciones de muerte/explosión

**Controles gamepad:**
| Acción | Teclas | Gamepad |
|--------|--------|---------|
| Mover | WASD, flechas | LStick |
| Disparar | J / Click | GamepadA (automático si se mantiene) |
| Saltar | K / Espacio | GamepadX |
| Cambiar arma | L | GamepadY |

**i18n keys:** `contra.score`, `contra.lives`, `contra.stage`, `contra.weapon`

---

### 3.4 OutRun-like (Carreras)

**Mecánicas principales:**
- Vista top-down o pseudo-3D (efecto de carretera que se acerca)
- Coche del jugador en la parte inferior, carretera con curvas
- Tráfico (coches lentos a esquivar)
- Límite de tiempo que se extiende al pasar checkpoints
- Diferentes rutas/rutas secundarias
- Velocidad fija (el jugador solo controla dirección)

**Requerimientos técnicos:**
- Efecto de scroll de carretera (simple: líneas que se mueven hacia abajo)
- Colisiones con tráfico y bordes
- Sistema de checkpoints

**Controles gamepad:**
| Acción | Teclas | Gamepad |
|--------|--------|---------|
| Izquierda | A, ← | LStick Left, D-pad Left |
| Derecha | D, → | LStick Right, D-pad Right |
| Acelerar | W, ↑ | GamepadR2 (gatillo) |
| Frenar | S, ↓ | GamepadL2 (gatillo) |
| Cambio abajo | Q | GamepadL1 |
| Cambio arriba | E | GamepadR1 |

**i18n keys:** `racing.score`, `racing.time`, `racing.checkpoint`, `racing.gameOver`

---

### 3.5 Guitar Hero-like (Ritmo)

**Mecánicas principales:**
- 3-5 carriles verticales con notas que caen
- Pulsar la tecla correspondiente cuando la nota llega a la zona de impacto
- Precisión: Perfect, Good, Miss
- Racha (combo) que multiplica puntuación
- Canciones con diferente velocidad/complejidad
- Indicador visual de la nota actual

**Requerimientos técnicos:**
- Timing preciso (comparar posición de nota vs zona de impacto)
- Generación procedural de canciones (no audio real, solo visual)
- Sistema de scoring con combo multiplicador

**Nota**: Sin archivos de audio reales. Las "canciones" son secuencias procedimentales generadas por `AudioManager.beep()`.

**Controles gamepad:**
| Acción | Teclas | Gamepad |
|--------|--------|---------|
| Carril 1 | D | GamepadLeft (D-pad) |
| Carril 2 | F | GamepadUp |
| Carril 3 | J | GamepadA |
| Carril 4 | K | GamepadB |
| Carril 5 | L | GamepadRight |

**i18n keys:** `rhythm.score`, `rhythm.combo`, `rhythm.song`, `rhythm.perfect`

---

### 3.6 Bejeweled-like (Match-3)

**Mecánicas principales:**
- Tablero 8×8 de gemas de 6+ tipos
- Intercambiar gemas adyacentes para formar líneas de 3+
- Las gemas matching desaparecen, caen nuevas, crean cascadas
- Puntuación: 3=30pts, 4=60pts, 5=100pts, cascada ×2
- Modo Zen (sin límite) y modo Time Attack (60s)
- Gemas especiales: bomba (explosiona 3×3), hipercubo (elimina todas del mismo color)

**Requerimientos técnicos:**
- Lógica de matching (horizontal + vertical)
- Sistema de cascadas con animación
- Detección de que no hay más movimientos posibles (reshuffle)

**Controles gamepad:**
| Acción | Teclas | Gamepad |
|--------|--------|---------|
| Mover cursor | Flechas, WASD | LStick, D-pad |
| Seleccionar/Intercambiar | Espacio, Enter | GamepadA |
| Deseleccionar | Escape | GamepadB |

**i18n keys:** `match3.score`, `match3.time`, `match3.combo`, `match3.noMoves`

---

### 3.7 Lemonade Stand-like (Tycoon)

**Mecánicas principales:**
- Día a día: comprar ingredientes, fijar precio, vender
- Variables: clima (soleado/lluvioso/nublado), temperatura
- Costos: hielo, limones, azúcar, vasos
- Satisfacción del cliente: precio justo, calidad
- 30 días por partida, puntuación final = dinero total
- Eventos aleatorios: ofertas, clientes especiales, competencia

**Requerimientos técnicos:**
- UI de menús/paneles (botones, sliders, texto informativo)
- Sistema económico simple (ingresos - costos = ganancia)
- Generación procedural de clima y eventos

**Controles gamepad:**
| Acción | Teclas | Gamepad |
|--------|--------|---------|
| Navegar menú | Flechas, WASD | LStick, D-pad |
| Seleccionar | Espacio, Enter | GamepadA |
| Volver | Escape | GamepadB |
| Día siguiente | N | GamepadStart |

**i18n keys:** `tycoon.day`, `tycoon.money`, `tycoon.weather`, `tycoon.customer`, `tycoon.sold`

---

## 4. Mejoras a Juegos Existentes

### 4.1 Gamepad completo (9 juegos)

Implementar `_defaultBindings()` + action mapping en los 9 juegos que aún no tienen gamepad:

| Juego | Prioridad | Complejidad |
|-------|-----------|-------------|
| Missile Command | Alta (ratón-only → añadir gamepad como alternativa) | Media |
| Platformer | Alta | Baja (tiene movimiento direccional claro) |
| Tetris | Alta | Baja |
| Trick Quiz | Media | Media (navegación de opciones) |
| Papa's Pizzeria | Media | Alta (UI compleja) |
| Stick RPG | Media | Alta (múltiples escenas) |
| Territory War | Media | Alta (selección de unidades + placement) |
| Swords and Souls | Baja | Alta (múltiples minijuegos + combate) |
| Henry Stickmin | Baja | Media (selección de opciones) |

**Requerimiento técnico**: Todos deben usar `_defaultBindings()` y `isActionDown()`/`wasActionPressed()` para permitir rebinding automático.

### 4.2 Más contenido

| Mejora | Juegos objetivo | Descripción |
|--------|----------------|-------------|
| **Jefes finales** | Breakout, Snake, Pong, Flappy Bird, Centipede | Añadir un boss al completar todos los niveles/oleada X |
| **Modos dificultad** | Todos los juegos | Fácil/Normal/Difícil con cambios en velocidad, IA, vidas, spawn rate |
| **Más niveles** | Platformer, Fancy Pants, Coop Platformer | Extender de 5 a 8-10 niveles |
| **Power-ups adicionales** | Space Invaders, Galaga, Asteroids | Escudo, disparo triple, bomba nuclear |
| **Modo contrarreloj** | Pac-Man, Snake, Frogger | Speedrun mode con timer global |

### 4.3 Polaco visual

| Mejora | Descripción | Prioridad |
|--------|-------------|-----------|
| Screen shake en impactos | Usar `Camera.js` o shake manual en ctx | Alta |
| Hit-stop / freeze frames | Pausar 2-3 frames al golpear enemigo | Alta |
| Transiciones entre niveles | Fundido a negro/color | Media |
| Animaciones de UI | Score que sube animado, vidas que desaparecen | Media |
| Partículas en power-ups | Efectos al recoger power-up | Baja |
| Retro scanlines overlay | Efecto de líneas de scan CRT sutiles | Baja |

---

## 5. Sistema de Progresión (Nuevo)

### 5.1 Arquitectura

Nuevo módulo en el engine: `ProgressionManager.js`

```
src/engine/
  ProgressionManager.js    ← NUEVO
  PlayerProfile.js         ← NUEVO (opcional, separado)
```

**Almacenamiento**: Todo en localStorage bajo prefijo `gamehub:progression:`.
No requiere backend ni servidor.

### 5.2 Perfil de jugador

```js
class ProgressionManager {
  // ── Perfil ───────────────────────────────────
  get playerName()             // String, editable
  set playerName(v)
  get totalGamesPlayed()       // Número total de partidas iniciadas
  get totalPlayTime()          // Segundos acumulados en todos los juegos
  get gamesBeaten()            // Array de IDs de juegos completados
  get totalAchievements()      // Cuenta total de logros desbloqueados
  get level()                  // Nivel global del jugador (basado en XP)
  get xp()                     // Experiencia acumulada
  get xpForNextLevel()         // XP necesaria para subir de nivel

  // ── Estadísticas por juego ──────────────────
  getGameStats(gameId)         // { plays, wins, bestScore, totalTime, ... }
  recordGamePlay(gameId, score, won, duration)

  // ── Logros ──────────────────────────────────
  getAchievements(gameId)      // Array de logros con estado { id, unlocked, unlockedAt }
  checkAchievement(gameId, achievementId)  // Evalúa si se cumple condición
  isAchievementUnlocked(gameId, achievementId)

  // ── Desbloqueables ──────────────────────────
  isUnlocked(itemId)           // Skin, power-up, personaje, etc.
  getUnlockedItems(category)   // Filtrados por categoría

  // ── XP / Nivelación ────────────────────────
  addXp(amount, reason?)       // Gana XP, sube nivel si corresponde
  get levelTitle()             // Título según nivel (Novato→Experto→Leyenda)
}
```

### 5.3 Sistema de XP

| Acción | XP | Límite |
|--------|-----|--------|
| Jugar una partida | +10 | 1 por juego/hora |
| Ganar/completar un juego | +50 | 1 por juego/hora |
| Desbloquear logro | +100 | Cada logro único |
| Jugar 3 juegos diferentes en un día | +30 | Diario |
| Puntuación récord (nuevo best) | +25 | 1 por juego |
| Vencer a un jefe final | +75 | 1 por jefe |

**Niveles**:
| Nivel | XP Total | Título |
|-------|----------|--------|
| 1 | 0 | Novato |
| 2 | 200 | Aprendiz |
| 3 | 500 | Jugador |
| 4 | 1,000 | Veterano |
| 5 | 2,000 | Experto |
| 6 | 3,500 | Maestro |
| 7 | 5,500 | Leyenda |
| 8+ | +2,000 c/n | Leyenda {n} |

### 5.4 Logros por juego (ejemplos)

**Breakout**: "Rompe-ladrillos" (completar nivel 1), "Imposible" (completar nivel 5), "Imparable" (sin perder vidas en un nivel)

**Snake**: "Pequeña" (10 comidas), "Grande" (50 comidas), "Inmortal" (100 comidas)

**Pac-Man**: "Comecocos" (primer nivel), "Fantasma" (comer 4 fantasmas en un power pellet), "Leyenda" (nivel 5+)

**Pong**: "Primer punto", "Racha de 3", "Imbatible" (ganar en difícil)

**Nuevos juegos**: Logros específicos por hitos de progresión.

### 5.5 Desbloqueables

| Categoría | Ejemplos | Cómo se desbloquea |
|-----------|----------|-------------------|
| Skins de nave | Asteroids: nave dorada | Logro "100 asteroides destruidos" |
| Skins de personaje | Pac-Man: azul/verde | Nivel 3 / Logro específico |
| Power-ups iniciales | Breakout: paleta ancha | Completar el juego 5 veces |
| Modos extra | Contrarreloj en Snake | Nivel 5 |
| Fondos/temas | CRT scanlines toggle | Logro "Jugar todos los juegos" |

### 5.6 UI de progresión

El hub (main.js) tendrá un nuevo botón/panel "Perfil" accesible desde el menú principal:
- **Pestaña Perfil**: nombre editable, nivel, XP bar, stats globales
- **Pestaña Logros**: grid de logros por juego (icono + nombre + descripción, bloqueados en gris)
- **Pestaña Estadísticas**: tabla por juego (veces jugado, mejor puntuación, tiempo total)
- **Pestaña Desbloqueables**: grid de items desbloqueados/bloqueados

---

## 6. Mejoras al Engine

### 6.1 Nuevos módulos

| Módulo | Archivo | Propósito |
|--------|---------|-----------|
| `ProgressionManager.js` | `src/engine/` | Sistema de progresión global (perfil, XP, logros) |
| `ComboDetector.js` | `src/engine/` | Detección de combos/secuencias de teclas (para fighting game) |
| `ScreenShake.js` | `src/engine/` | Efecto de screen shake reutilizable |

### 6.2 Mejoras a módulos existentes

| Módulo | Mejora |
|--------|--------|
| `GameUI.js` | `renderDifficultySelector()`, `renderBossHealthBar()`, `renderAchievementPopup()` |
| `i18n.js` | Claves para perfil, logros, niveles, títulos de jugador |
| `SettingsManager.js` | Persistencia de perfil, reset de progreso |
| `IconRenderer.js` | Nuevos iconos: trophy, medal, star-filled, lock, unlock |

### 6.3 Gamepad en el Hub

- Navegación del menú principal con gamepad (D-pad + A para seleccionar)
- Settings navegable con gamepad
- Búsqueda con gamepad (¿virtual keyboard? o modo de navegación)

---

## 7. Plan de Implementación por Tandas

### 🏗️ Tanda 1 — Fundación + Juegos más icónicos

**Orden**: Engine → Progression → Mario-like → Gamepad restante → Contra-like

| Paso | Descripción | Dependencias |
|------|-------------|-------------|
| 1.1 | `ProgressionManager.js` + `PlayerProfile.js` + UI de perfil en hub | — |
| 1.2 | `ScreenShake.js` + integrar en juegos existentes (Asteroids, Breakout, Galaga) | — |
| 1.3 | **Super Mario-like** (primer juego nuevo, establece patrón de plataformas avanzadas) | Tilemap, Camera |
| 1.4 | Gamepad completo en Platformer + Tetris + Missile Command (baja complejidad) | — |
| 1.5 | Logros para juegos existentes (Breakout, Snake, Pong, Flappy Bird, Asteroids) | ProgressionManager |
| 1.6 | **Contra-like** (run & gun, scroll lateral, power-ups, jefes) | Camera, Tilemap, ProgressionManager |

### 🏗️ Tanda 2 — Pelea + Carreras + Jefes

| Paso | Descripción | Dependencias |
|------|-------------|-------------|
| 2.1 | `ComboDetector.js` + sistema de hitboxes | — |
| 2.2 | **Street Fighter-like** (PvP local + vs IA + 4 personajes) | ComboDetector, CollisionUtils |
| 2.3 | **OutRun-like** (carreras top-down con tráfico y checkpoints) | — |
| 2.4 | Jefes finales en Breakout, Snake, Centipede (contenido nuevo) | — |
| 2.5 | Gamepad en Papa's Pizzeria + Stick RPG (complejidad media) | — |
| 2.6 | Modos de dificultad en Pong, Breakout, Space Invaders | — |

### 🏗️ Tanda 3 — Ritmo + Puzzle + Tycoon + Pulido

| Paso | Descripción | Dependencias |
|------|-------------|-------------|
| 3.1 | **Guitar Hero-like** (ritmo, notas, combo, canciones procedurales) | AudioManager |
| 3.2 | **Bejeweled-like** (match-3, cascadas, gemas especiales) | — |
| 3.3 | **Lemonade Stand-like** (tycoon, día a día, economía simple) | — |
| 3.4 | Gamepad en Swords and Souls + Henry Stickmin + Territory War (complejidad alta) | — |
| 3.5 | Polaco visual general: screen shake, hit-stop, transiciones, animaciones de UI | — |
| 3.6 | Desbloqueables: skins, power-ups, modos extra ligados a logros | ProgressionManager |
| 3.7 | Logros para todos los juegos nuevos | ProgressionManager |

---

## 8. Criterios de Aceptación

### 8.1 Por juego nuevo

- [ ] Implementa `init/update/render/destroy`
- [ ] Tiene `_defaultBindings()` con gamepad + action mapping
- [ ] i18n ES/EN completo
- [ ] README.md con controles (teclado + gamepad)
- [ ] Registrado en `registry.js` con smoke test
- [ ] Entrada en `src/engine/i18n.js` para registry + claves del juego
- [ ] Smoke test pasa

### 8.2 Por mejora

- [ ] Gamepad añadido: `wasPressed('GamepadA')` funciona y está documentado en README
- [ ] Jefes finales: al menos 1 boss con patrón de ataque único
- [ ] Modos dificultad: afectan velocidad, IA, vidas o spawn rate
- [ ] Logros: al menos 3 por juego, persisted en ProgressionManager

### 8.3 Sistema de progresión

- [ ] Perfil visible desde el hub con nombre, nivel, XP, stats
- [ ] Logros con UI de grid (icono + nombre + estado)
- [ ] XP se acumula correctamente
- [ ] Desbloqueables funcionales
- [ ] Datos persistentes en localStorage
- [ ] Posibilidad de resetear progreso

---

## 9. Resumen de Archivos

### Nuevos archivos

```
src/engine/ProgressionManager.js    ~300 líneas
src/engine/PlayerProfile.js         ~150 líneas (opcional)
src/engine/ComboDetector.js         ~100 líneas
src/engine/ScreenShake.js           ~80 líneas
src/games/mario-like/index.js       ~10 líneas
src/games/mario-like/MarioLike.js   ~700 líneas
src/games/mario-like/i18n.js        ~30 líneas
src/games/mario-like/README.md      ~80 líneas
src/games/street-fighter/...        ~800 líneas
src/games/contra-like/...           ~650 líneas
src/games/outrun-like/...           ~500 líneas
src/games/rhythm/...                ~450 líneas
src/games/match3/...                ~400 líneas
src/games/tycoon/...                ~500 líneas
```

### Archivos modificados

```
src/engine/GameUI.js                +renderDifficultySelector, renderBossHealthBar, renderAchievementPopup
src/engine/i18n.js                  +claves de perfil, logros, registry de juegos nuevos
src/engine/SettingsManager.js       +resetProgression
src/engine/IconRenderer.js          +nuevos iconos
src/games/registry.js               +8 nuevos juegos
src/main.js                         +panel de perfil en hub
src/games/*/README.md               +controles gamepad donde falten
docs/engine-architecture.md         +ProgressionManager, ScreenShake, ComboDetector
docs/retro-arcade-expansion-spec.md +referencia a este spec
```

---

## 10. Estimación

| Componente | Líneas estimadas |
|-----------|------------------|
| Engine: ProgressionManager + Profile | ~450 |
| Engine: ScreenShake + ComboDetector | ~180 |
| UI de progresión en hub | ~300 |
| 8 juegos nuevos | ~4,000 |
| Gamepad en 9 juegos existentes | ~500 |
| Jefes finales + modos (6 juegos) | ~600 |
| Logros + desbloqueables | ~400 |
| Polaco visual | ~300 |
| Documentación | ~200 |
| **Total estimado** | **~7,000** |
