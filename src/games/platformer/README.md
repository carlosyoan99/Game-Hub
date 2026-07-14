# Platformer

**Plataformas**

Platformer con **5 niveles** de dificultad creciente. Corre y salta a través de niveles diseñados con tiles ASCII, usando el sistema de tilemap y cámara del motor. Incluye coyote time, salto variable y 3 vidas.

## Gameplay

El jugador se mueve por un mundo de tiles sólidos representados con `#`. El objetivo es alcanzar la meta (tile `G`) en cada nivel. La cámara sigue al jugador. Si caes al vacío, pierdes una vida.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Completar los 5 niveles |
| **Victoria** | Alcanzar la meta del nivel 5 |
| **Derrota** | Perder las 3 vidas (caer al vacío) |
| **Récord** | Mejor tiempo por run (bestTime) |

## Controles

| Tecla | Acción |
|-------|--------|
| ← → / A D | Movimiento lateral |
| Espacio / ↑ / W | Saltar |
| Click / Espacio | Avanzar / Reiniciar |

## Constantes de balance

| Parámetro | Valor |
|-----------|-------|
| Gravedad | 1400 px/s² |
| Velocidad movimiento | 220 px/s |
| Velocidad salto | -520 px/s (hacia arriba) |
| Caída máxima | 900 px/s |
| Coyote time | 0.1s |
| Corte de salto | 50% al soltar botón (salto variable) |
| Tamaño tile | 32×32 px |
| Jugador | 20×28 px |
| Vidas | 3 |

- **Salto variable**: si sueltas el botón mientras subes, el impulso se corta al 50% (una sola vez)
- **Coyote time**: 0.1s de gracia para saltar tras salir de una plataforma

## Estructura del código

- **`Platformer.js`**: Clase principal
  - `_loadLevel()` → carga niveles desde LEVEL_ROWS (ASCII art)
  - `_findGoal()` → localiza el tile 'G' en el nivel
  - `_updatePlayer()` → física horizontal, gravedad, salto, colisiones tilemap
  - `_loseLife()` / `_win()` → gestión de estado
- **`i18n.js`**: Traducciones específicas (platformer.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD/Espacio) |
| `StorageManager` | Persistencia de mejor tiempo y nivel guardado |
| `Tilemap` | `parseAscii()`, `resolveAABB()`, `render()` — colisión por eje separado |
| `Camera` | `follow()` con scroll, `resize()` en handleResize |
| `CollisionUtils` | `aabbIntersects()` para meta, `clamp()` |
| `AudioManager` | SFX de salto, daño, powerup |
| `HapticManager` | Vibración en daño y powerup |
