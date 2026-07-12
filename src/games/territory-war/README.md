# Territory War

**Nivel 4 — Estrategia / Defensa por Turnos**

Dos equipos de figuras stickman en un campo de batalla dividido en zonas de territorio. Por turnos, los jugadores/IA mueven sus unidades, atacan al enemigo y capturan territorio. El equipo que elimina a todas las unidades enemigas o captura todo el territorio gana.

## Gameplay

El campo de batalla es una cuadrícula de 11×7 casillas. Comienzas con 3 unidades (2 infantes + 1 arquero) en el lado izquierdo. Cada turno puedes mover una unidad, atacar a un enemigo cercano y comprar nuevas unidades. La IA juega su turno inmediatamente después.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Eliminar todas las unidades enemigas |
| **Victoria** | Sin unidades enemigas en el campo |
| **Derrota** | Sin unidades propias en el campo |
| **Recursos** | $50 + turno×5 por turno |

## Controles

| Entrada | Acción |
|---------|--------|
| Click en unidad | Seleccionar unidad |
| Click en casilla azul | Mover unidad |
| Click en casilla roja | Atacar enemigo |
| Botón "Terminar turno" | Pasar turno |
| Botón "Comprar" | Comprar infante ($100) |
| Click / Espacio | Reiniciar |

## Tipos de unidad

| Unidad | HP | Daño | Alcance | Movimiento | Coste | Símbolo |
|--------|-----|------|---------|-----------|-------|---------|
| ⚔️ Infante | 50 | 15 | 1 | 2 | $100 | ⚔️ |
| 🏹 Arquero | 35 | 12 | 3 | 1 | $150 | 🏹 |
| 🐴 Caballería | 60 | 20 | 1 | 4 | $200 | 🐴 |
| 💚 Sanador | 30 | 5 | 2 | 2 | $120 | 💚 |
| 🛡️ Tanque | 100 | 10 | 1 | 1 | $180 | 🛡️ |

## Constantes de balance

| Parámetro | Valor |
|-----------|-------|
| Tamaño grid | 11×7 casillas |
| Recursos iniciales | $300 por equipo |
| Recurso por turno | $50 + turno×5 |
| Rango de captura | 1 casilla (adyacente + propia) |
| Victoria | Eliminar todas las unidades enemigas |

## Estructura del código

- **`TerritoryWar.js`**: Clase principal
  - `_recomputeGrid()` → calcula TILE_SIZE dinámico según resolución
  - `_startTurn()` → recursos, reset de acciones, IA compra unidades
  - `_handlePlayerInput()` → selección, movimiento, ataque del jugador
  - `_aiDoAction()` → IA con prioridades: atacar > curar > moverse
  - `_addUnit()` / `_playerBuyUnit()` / `_aiBuyUnits()` → compra y despliegue
  - `_captureTerritory()` → captura de casillas adyacentes
  - `_getValidMoves()` / `_getValidAttacks()` → cálculo de alcance
  - `_pixelToTile()` / `_tileToPixel()` → conversión coordenadas
- **`i18n.js`**: Traducciones específicas (territory.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Ratón (clicks) |
| `StorageManager` | Persistencia de wins y highscore |
| `CollisionUtils` | `pointInRect()` para detección de clicks, `clamp()` |
| `ParticleSystem` | `burst()` para captura de territorio y muerte de unidades |
| `AudioManager` | SFX de ataque, muerte, powerup |
| `HapticManager` | Vibración en eventos |
| `SeededRandom` | Semilla para IA y generación de unidades |
| `i18n` | Textos traducidos |
