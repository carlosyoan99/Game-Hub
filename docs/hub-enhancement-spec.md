# Hub Enhancement Spec

> Fecha: Julio 2026
> Basado en entrevista con el usuario (3 rondas de preguntas)

---

## 1. Resumen ejecutivo

Expandir y mejorar el GameHub Engine en 3 áreas prioritarias:

1. **Niveles y contenido** — Expandir juegos con más niveles, progresión
   pseudoaleatoria y semillas compartibles.
2. **Hub features** — Buscador en vivo, panel de configuración (settings),
   selector de idioma, tema claro/oscuro, reducción de animaciones,
   controles de volumen y vibración.
3. **Estética retro 8-bit / NES** — Renovar la interfaz del hub con
   paleta de colores vivos, bordes pixelados, tipografía retro y
   texturas de consola clásica.

**Prioridad**: Niveles (1) > Hub features (2) > Estética (3)

---

## 2. Sistema de niveles y contenido

### 2.1. Análisis de juegos que necesitan niveles

El usuario delegó la decisión. Análisis por juego:

| Juego | ¿Tiene niveles? | Tiempo partida | Acción necesaria |
|-------|----------------|----------------|------------------|
| Breakout | No | <1 min | Añadir niveles con distinta disposición de ladrillos |
| Snake | No | <1 min | Añadir niveles con obstáculos, diferentes velocidades |
| Pong | No | <2 min | Añadir niveles con distinta IA, velocidad progresiva |
| Flappy Bird | No | <30s | Añadir niveles con diferente spacing, scroll speed |
| Asteroids | No | <2 min | Añadir oleadas con más asteroides, enemigos que disparan |
| Platformer | No | <2 min | Nuevos mapas de tiles (más niveles) |
| Fancy Pants | No | <1 min | Nuevos mapas con distinta dificultad de plataformas |
| Coop Platformer | No | <1 min | Nuevos niveles cooperativos |
| Trick Quiz | No | <2 min | Más sets de preguntas (banco de preguntas ampliable) |
| Papa's Pizzeria | Sí (clientes) | ~3 min | Más recetas, clientes más exigentes, mejoras de cocina |
| Stick RPG | No | ~3 min | Más días, eventos aleatorios, más escenas |
| Crush the Castle | Sí (oleadas) | ~3 min | Más estructuras de castillos, más tipos de bloques |
| Bowman | Sí (turnos) | ~3 min | Más rondas, power-ups, diferentes terrenos |
| Bloons TD | Sí (oleadas) | ~5 min | Más tipos de bloons, mejoras de torres |
| Territory War | Sí (turnos) | ~5 min | Más tipos de unidad, mapas más grandes |
| Swords and Souls | Sí (progresión) | ~5 min | Más enemigos, habilidades, equipo |
| Henry Stickmin | No | ~3 min | Más escenas, más ramas en el árbol de decisiones |

### 2.2. Sistema de contenido pseudoaleatorio

- **Semilla visible (seed)**: Cada nivel/misión genera un código de
  semilla (string corto tipo `A7K2`) que se muestra al jugador.
  - Misma semilla = mismo nivel exacto (compartible).
  - Semilla basada en `nivel + dificultad + timestamp hash`.
- **Por dificultad**: La aleatoriedad escala con la dificultad. Niveles
  bajos = más predecibles, niveles altos = más caóticos.
- Implementar un generador de números pseudoaleatorios con semilla
  (seeded PRNG) en `src/engine/` para que todos los juegos lo usen.

### 2.3. Estructura de niveles

- **Extender sistemas existentes**: No rediseñar desde cero. Cada juego
  que ya tiene oleadas/niveles (Bloons TD, Crush the Castle, etc.)
  recibe más contenido dentro de su arquitectura actual.
- **Juegos sin niveles**: Los 11 juegos que no tienen sistema de
  progresión (Breakout, Snake, Pong, Flappy Bird, Asteroids, ambos
  Platformers, Trick Quiz, Stick RPG, Bowman, Henry Stickmin) reciben
  un sistema básico de niveles: selección de nivel → juego → récord.

---

## 3. Hub — Buscador de juegos

### 3.1. Búsqueda en vivo

- Input de texto en la parte superior del menú principal.
- Filtra las cards del `game-grid` en tiempo real mientras el usuario
  escribe.
- Busca en: `title`, `tagline` y la traducción actual de ambos.
- Sin botón de buscar — los resultados aparecen instantáneamente.
- Placeholder: "🔍 Buscar juegos..."
- Si no hay resultados, mostrar mensaje "No se encontraron juegos".

### 3.2. Datos de búsqueda

Los datos ya existen en `GAME_REGISTRY` (title, tagline, level). Con el
sistema de idioma, se añadirá un campo de traducción (ver sección 5).

---

## 4. Hub — Panel de configuración (Settings)

### 4.1. Acceso

- **Icono** ⚙️ en la esquina superior derecha de la topbar.
- **Atajo de teclado**: `S` (o Escape con menú visible) abre/cierra.
- Click fuera del modal o Escape lo cierra.

### 4.2. Tipo de panel

**Overlay / Modal** con fondo semitransparente oscuro. Centrado en
pantalla, con bordes pixelados retro.

### 4.3. Opciones de configuración

| Opción | Tipo | Valores | Persistencia | Notas |
|--------|------|---------|-------------|-------|
| Tema | Selector | Oscuro / Claro | localStorage | Paleta específica diseñada manualmente (no inversión automática) |
| Reducir animaciones | Toggle | ON / OFF | localStorage | Afecta hub + juegos (desactiva partículas y animaciones decorativas) |
| Idioma | Selector | ES / EN | localStorage | Hub + juegos traducidos |
| Volumen maestro | Slider | 0–100% | localStorage | Integrado con `AudioManager.setMasterVolume()` |
| Volumen SFX | Slider | 0–100% | localStorage | Integrado con `AudioManager.setSfxVolume()` |
| Volumen música | Slider | 0–100% | localStorage | Integrado con `AudioManager.setMusicVolume()` |
| Vibración | Toggle | ON / OFF | localStorage | Integrado con `HapticManager.enabled` |

### 4.4. Persistencia

- Todas las settings se guardan en `localStorage` bajo namespace
  `gamehub:settings:*`.
- Se cargan al iniciar el hub.
- Compatibilidad con el sistema de almacenamiento existente
  (`StorageManager` no es necesario aquí ya que es global, no por
  juego).

---

## 5. Sistema de idioma

### 5.1. Alcance

**Hub + juegos**: Todos los textos visibles en el hub y dentro de los
17 juegos deben estar disponibles en ES (español) y EN (inglés).

### 5.2. Arquitectura

- Archivo central de traducciones: `src/engine/i18n.js`
- Estructura: `{ clave: { es: '...', en: '...' } }`
- Función global `t(clave)` que devuelve el texto en el idioma actual.
- Los juegos llaman a `t('breakout.title')` en vez de strings fijos.
- Fallback: si falta una clave en EN, se usa ES.

### 5.3. Claves de traducción del hub

- Títulos, taglines, botones, mensajes del menú, settings.
- `GAME_REGISTRY` necesitará un campo `title_i18n` o similar, o se
  mantiene title/tagline en ES y se consulta el i18n para EN.

### 5.4. Claves de traducción de juegos

- Cada juego tendrá sus propias claves: textos de UI, diálogos,
  mensajes de feedback, descripciones de items, etc.

---

## 6. Estética retro 8-bit / NES

### 6.1. Identidad visual

- Inspiración: NES / Famicom, consola de 8 bits.
- No es terminal/CRT, es consola clásica con colores vivos.

### 6.2. Paleta de colores

- **Tema oscuro** (base): Fondo azul marino oscuro (`#0a0e1a`),
  acentos naranja quemado (`#e8a838`), verde hierba (`#48a848`),
  cian brillante (`#38b8e8`), rojo ladrillo (`#c84848`).
- **Tema claro**: Paleta específica diseñada manualmente (no inversión).
  Tonos crema/papel, con los mismos acentos de color pero sobre fondo
  claro.

### 6.3. Tipografía

- Mantener `'Courier New', monospace` como base por su estética
  pixelada/mono.
- Opcional: cargar una fuente web retro tipo "Press Start 2P" o
  "Pixelify Sans" (evaluar si merece la pena la dependencia externa).
- Texto ligeramente más grande y bold para emular píxeles visibles.

### 6.4. Elementos visuales

- **Bordes**: Doble borde pixelado (simulando NES), con esquinas
  recortadas. Grosor de 2-3px.
- **Cards de juegos**: Fondo con textura sutil de cuadrícula 4x4.
  Sombra pixelada (3px abajo, 2px derecha).
- **Iconos**: Usar emojis como ya se hace, o reemplazar con glyphs
  pixel-art si es viable.
- **Animaciones hover**: Transición suave con escala +1.02 y brillo
  (brightness) en vez de solo translateY.
- **Scanlines / CRT**: NO — es estética NES, no monitor de tubo.
- **Canvas de juego**: Borde pixelado doble, con sombra.

---

## 7. Reducción de animaciones

### 7.1. Alcance

Cuando `reducedMotion` está activado:

**Hub:**
- `transition: none` en todas las cards y botones.
- `transform: none` en hover states.
- Sin animaciones de aparición/desaparición.

**Juegos:**
- `ParticleSystem.emit()` no emite partículas (o se salta el render).
- Animaciones decorativas desactivadas (wobble de bloques en Crush the
  Castle, trails de flechas en Bowman, etc.).
- Scroll, movimiento de fondo parallax y efectos visuales no esenciales
  se reducen o eliminan.
- El gameplay esencial (movimiento, colisiones, input) NO se ve
  afectado.

### 7.2. Implementación

- Flag global en settings: `settings.reducedMotion`
- `ParticleSystem.render()` comprueba el flag y no dibuja si está
  activo.
- Los juegos consultan `window.__gamehubSettings?.reducedMotion` o
  reciben el flag vía el engine/input.

---

## 8. Sistema de semillas (Seeded PRNG)

### 8.1. Módulo nuevo

Crear `src/engine/SeededRandom.js` con:

```js
export class SeededRandom {
  constructor(seed) { /* implementar MWC1616 o similar */ }
  /** Devuelve float [0, 1) */
  next() { /* ... */ }
  /** Devuelve int [min, max] inclusive */
  nextInt(min, max) { /* ... */ }
  /** Genera código de semilla legible (4-6 chars) */
  static encode(n) { /* base36 o similar */ }
  static decode(str) { /* ... */ }
}
```

### 8.2. Uso

- Cada nivel/generación se crea con una semilla.
- La semilla se muestra al jugador (ej. `Nivel #A7K2`).
- Se puede re-introducir manualmente para repetir el mismo nivel.
- El PRNG reemplaza a `Math.random()` para toda la generación de
  contenido procedimental.

---

## 9. Integración con sistemas existentes

### 9.1. AudioManager (ya existe)

- Los sliders de volumen en settings llaman a:
  - `AudioManager.setMasterVolume(value)`
  - `AudioManager.setSfxVolume(value)`
  - `AudioManager.setMusicVolume(value)`
- No hace falta duplicar persistencia — AudioManager ya guarda en
  localStorage.

### 9.2. HapticManager (ya existe)

- El toggle de vibración en settings llama a:
  - `HapticManager.enabled = value`
- HapticManager ya persiste su estado en localStorage.

### 9.3. SettingsManager (nuevo)

- Nuevo módulo `src/engine/SettingsManager.js`
- Singleton que gestiona: tema, reducedMotion, idioma, volumen, vibración
  y **key bindings** (rebinding de controles por juego).
- Lee/escribe bajo `gamehub:settings:*` en localStorage.
- Expone eventos/callbacks para que el hub y los juegos reaccionen a
  cambios en caliente (ej. cambiar tema sin recargar).

#### Key Bindings API

Las bindings personalizadas se almacenan en localStorage bajo `gamehub:binds:<gameKey>`
como JSON `{ "action": ["KeyA", "GamepadLeft"], ... }`.

```js
// Consultar bindings
SettingsManager.getBinding(gameKey, action)        // → string[] | null
SettingsManager.getEffectiveKeys(gameKey, action, defaults) // → string[]
SettingsManager.getAllBindings(gameKey, defaultMap)  // → merged para UI

// Guardar / resetear
SettingsManager.setBinding(gameKey, action, keys)   // null para reset
SettingsManager.resetBinding(gameKey, action)
SettingsManager.resetAllBindings(gameKey)

// Aplicar al InputManager activo
SettingsManager.applyBindings(input, gameKey, defaultMap)
//   → input.clearActions() + input.bind(action, ...keys) para cada acción

// Listener de cambios
SettingsManager.onBindingChange(gameKey, action, fn)

// Modo escucha (para capturar la siguiente tecla/gamepad presionado)
SettingsManager.listenForBind(input, onBind)
//   → intercepta keydown + gamepad polling (100ms, transiciones false→true)
//   → retorna función cancel()
//   → soporta teclado y gamepad (D-pad, botones de cara, hombros, gatillos)
```

#### Integración con GameBase

La clase base `GameBase.init()` aplica las bindings automáticamente si
el juego define `this._defaultBindings()`:

```js
class MiJuego extends GameBase {
  init(engine) {
    super.init(engine, 'mi-juego');
    // _defaultBindings se llama automáticamente desde GameBase.init()
    // → SettingsManager.applyBindings(this.input, storageKey, defaults)
  }

  _defaultBindings() {
    return {
      moveLeft:  ['ArrowLeft', 'KeyA', 'GamepadLStickLeft', 'GamepadLeft'],
      moveRight: ['ArrowRight', 'KeyD', 'GamepadLStickRight', 'GamepadRight'],
      jump:      ['Space', 'KeyW', 'GamepadA'],
      shoot:     ['Space', 'GamepadR1', 'GamepadX'],
    };
  }
}
```

Los juegos que usan `isActionDown()`/`wasActionPressed()` obtienen el
rebinding gratis — el jugador puede reasignar teclas y se aplican en
caliente al iniciar la partida.

---

## 10. No incluido en este spec

- No se rediseña la arquitectura del motor (`GameEngine`, `InputManager`,
  etc.) — se extiende.
- No se añaden nuevos juegos — solo se expanden los existentes.
- No se modifica el sistema de builds — sigue siendo cero dependencias.
- Henry Stickmin queda pendiente de contenido nuevo (depende de su
  estado actual en el Nivel 5).

---

## 11. Checklist de implementación

- [x] **SettingsManager.js** — Singleton con tema, reducedMotion, idioma, key bindings
- [x] **i18n.js** — Archivo de traducciones ES/EN + función `t()`
- [x] **SeededRandom.js** — PRNG con semilla (Mulberry32)
- [x] **main.js** — Añadir buscador en vivo, icono settings, modal
- [x] **index.html** — Añadir elementos HTML para search + settings
- [x] **main.css** — Refactorizar a estética retro 8-bit NES + tema claro
- [ ] **Juegos Nivel 1** — Breakout, Snake, Pong, Flappy: sistema de niveles
- [ ] **Juegos Nivel 2** — Asteroids, Platformers: nuevos mapas/oleadas
- [ ] **Juegos Nivel 3** — TrickQuiz, Papa's, Stick RPG: más contenido
- [ ] **Juegos Nivel 4** — Crush, Bowman, Bloons, Territory: expandir
- [ ] **Juegos Nivel 5** — Swords, Henry: más contenido + traducciones
- [x] **Smoke test** — Actualizar `smoke_test.mjs` con nuevos casos
- [x] **README.md** — Actualizar documentación
