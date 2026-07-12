# Flappy Bird

**Nivel 1 — Arcade Clásico**

Flappy Bird con sistema de **5 niveles** de dificultad progresiva. Controla un pájaro que debe atravesar tuberías sin chocar. Cada nivel aumenta la velocidad, reduce el espacio entre tuberías y acelera la frecuencia de aparición.

## Gameplay

El pájaro cae constantemente por gravedad. Cada click/espacio le da un impulso hacia arriba. Debes pasar por los huecos de las tuberías para sumar puntos. Al alcanzar la puntuación objetivo, avanzas al siguiente nivel.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Completar los 5 niveles |
| **Victoria** | Alcanzar la puntuación objetivo en nivel 5 |
| **Derrota** | Chocar contra tubería, techo o suelo |
| **Puntuación** | 10 pts por tubería superada. Récord total acumulado. |

## Controles

| Tecla | Acción |
|-------|--------|
| Espacio / Click / ↑ | Aleteo (impulso hacia arriba) |
| Click / Espacio | Avanzar / Reiniciar |

## Constantes de balance

| Nivel | Velocidad tuberías | Ratio hueco | Intervalo spawn | Puntuación objetivo | Dificultad |
|-------|-------------------|-------------|-----------------|-------------------|------------|
| 1 | 180 px/s | 1.00 | 1.4s | 5 | Fácil |
| 2 | 200 px/s | 0.93 | 1.3s | 7 | Medio |
| 3 | 220 px/s | 0.86 | 1.2s | 9 | Difícil |
| 4 | 245 px/s | 0.79 | 1.1s | 11 | Experto |
| 5 | 270 px/s | 0.72 | 1.0s | 15 | Imposible |

- **Gravedad**: 900 px/s²
- **Impulso aleteo**: -320 px/s (hacia arriba)
- **Hueco base**: min(150, max(70, altura×0.4))
- **Tubería**: 60 px de ancho
- **Pájaro**: radio 12 px, posición X fija al 30% del ancho
- **Margen tubería**: min(60, altura×0.15)
- **Inclinación**: el pájaro rota según su velocidad vertical (máx ±45°)

## Estructura del código

- **`FlappyBird.js`**: Clase principal
  - `_getLevelConfig()` / `_getTargetScore()` → configuración por nivel
  - `_updatePipes()` → spawn, movimiento y colisión de tuberías
  - `_spawnPipe()` → generación con hueco aleatorio
  - `_checkCollisions()` → bird vs tuberías, techo, suelo
  - `_nextLevel()` / `_endGame()` / `_restart()` → gestión de estado
  - `clampTiltAngle()` → función helper de inclinación del pájaro
- **`i18n.js`**: Traducciones específicas (flappy.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (Espacio/↑) + ratón |
| `StorageManager` | Persistencia de highscore |
| `CollisionUtils` | `circleIntersectsAABB()` para colisiones pájaro vs tuberías |
| `AudioManager` | SFX de aleteo, comida, powerup, explosión |
| `HapticManager` | Vibración en eventos |
| `i18n` | Textos traducidos |
| `SeededRandom` | Semilla para posición de huecos |
