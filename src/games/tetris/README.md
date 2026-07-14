# Tetris

**Puzzle y Gestión**

El clásico juego de puzzle donde las piezas caen y debes completar líneas horizontales para sumar puntos. Cada 10 líneas completadas se sube de nivel, aumentando la velocidad de caída.

## Gameplay

Siete tipos de tetrominós caen desde la parte superior del tablero (10×20). Debes rotarlos y moverlos para encajarlos sin dejar huecos. Cada línea completa se elimina y suma puntos. El juego se acelera a medida que avanzas de nivel.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Máxima puntuación posible |
| **Derrota** | Las piezas se apilan hasta arriba |
| **Puntuación** | 1 línea: 100×nivel; 2: 300×nivel; 3: 500×nivel; 4 (Tetris): 800×nivel |
| **Niveles** | Cada 10 líneas → +1 nivel → mayor velocidad |

## Controles

| Tecla | Acción |
|-------|--------|
| ← / A | Mover izquierda |
| → / D | Mover derecha |
| ↑ / W | Rotar |
| ↓ / S | Soft drop (caída rápida) |
| Espacio | Hard drop (caída instantánea) |
| P / Escape | Pausa |
| Click / Espacio | Reiniciar tras Game Over |

## Mecánicas

- **7-bag randomizer**: las 7 piezas aparecen en lotes aleatorios (sin sequías extremas)
- **Ghost piece**: sombra que muestra dónde caerá la pieza
- **Wall kick**: las piezas se desplazan lateralmente al rotar cerca de los bordes
- **Lock delay**: la pieza tarda ~0.1s en fijarse al tocar el suelo (verificado cada frame)
- **Niveles**: cada 10 líneas se sube de nivel (mayor velocidad de caída)
- **Pausa**: P o Escape para pausar/reanudar

## Velocidad por nivel

| Nivel | Intervalo de caída |
|-------|-------------------|
| 1 | 0.80s |
| 2 | 0.72s |
| 3 | 0.63s |
| 4 | 0.55s |
| 5 | 0.47s |
| 6 | 0.38s |
| 7 | 0.30s |
| 8 | 0.22s |
| 9 | 0.17s |
| 10+ | 0.10s |

## Estructura del código

- **`Tetris.js`**: Clase principal
  - `PIECES[]`: definición de los 7 tetrominós con rotaciones
  - `_spawnPiece()` → nueva pieza, actualiza preview
  - `_move()` / `_rotate()` → movimiento y rotación con wall kick
  - `_hardDrop()` → caída instantánea
  - `_findFullRows()` → detección y eliminación de líneas
  - `_lockPiece()` → fija la pieza actual y comprueba líneas
  - `_updateGhost()` → calcula posición de la ghost piece
  - `_clearLines()` → animación de eliminación
  - `_checkLevelUp()` → cada 10 líneas

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD/Espacio/P/Escape) |
| `StorageManager` | Persistencia de highscore |
| `AudioManager` | SFX de movimiento, impacto, powerup |
| `HapticManager` | Vibración en líneas |
| `ParticleSystem` | Efectos al limpiar líneas |
| `i18n` | Textos traducidos |
