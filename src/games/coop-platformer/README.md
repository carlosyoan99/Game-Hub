# Coop Platformer (Fuego y Agua)

**Nivel 2 — Plataformas Cooperativo**

Platformer cooperativo local para **2 jugadores** con **5 niveles**. Un jugador controla al personaje rojo (WASD) y el otro al azul (flechas). Deben cooperar usando palancas y plataformas móviles para llegar cada uno a su meta respectiva.

## Gameplay

Dos jugadores deben alcanzar sus metas simultáneamente. El nivel incluye una palanca que abre una verja (un jugador debe mantenerla pulsada mientras el otro pasa) y plataformas móviles que se desplazan lateralmente. Si un jugador cae, ambos reaparecen.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Ambos jugadores alcanzar sus metas |
| **Victoria** | Completar los 5 niveles |
| **Derrota** | No aplica (los jugadores reaparecen al caer) |
| **Récord** | Mejor tiempo por run |

## Controles

| Tecla | Jugador 1 (Rojo) | Jugador 2 (Azul) |
|-------|------------------|-----------------|
| Movimiento | A / D | ← / → |
| Salto | W | ↑ |
| Avanzar | Click o Espacio | — |

## Constantes de balance

| Parámetro | Valor |
|-----------|-------|
| Gravedad | 1400 px/s² |
| Velocidad movimiento | 200 px/s |
| Velocidad salto | -500 px/s |
| Caída máxima | 900 px/s |
| Corte de salto | 50% al soltar |
| Coyote time | 0.1s |
| Tamaño tile | 32×32 px |
| Plataforma móvil | velocidad 1.1, oscila entre minX y maxX |

## Estructura del código

- **`CoopPlatformer.js`**: Clase principal
  - `_loadLevel()` → carga niveles con marcadores L (palanca), F (meta J1), W (meta J2)
  - `_updateCharacter()` → física individual para cada jugador
  - `_updatePlatform()` → movimiento sinusoidal de plataforma móvil
  - `_updateGate()` → apertura/cierre de verja según palanca
  - `_checkWin()` → ambos jugadores deben estar en su meta
  - `_respawnBoth()` → reinicio de posición para ambos
- **`i18n.js`**: Traducciones específicas (coop-platformer.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado dual (WASD + Flechas) |
| `StorageManager` | Persistencia de mejor tiempo y nivel guardado |
| `Tilemap` | `parseAscii()`, `resolveAABB()`, `render()` (tiles sólidos: #, =) |
| `Camera` | `follow()` centrado en punto medio entre ambos jugadores |
| `CollisionUtils` | `aabbIntersects()` para palanca y metas, `clamp()` |
| `AudioManager` | SFX de salto, palanca, powerup |
| `HapticManager` | Vibración en interacción con palanca |
