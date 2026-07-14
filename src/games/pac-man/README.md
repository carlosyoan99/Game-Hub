# Pac-Man

**Puzzle y Gestión**

El clásico juego del come-cocos. Recorre el laberinto comiendo puntos y power pellets mientras esquivas a los fantasmas.

## Gameplay

Controlas a Pac-Man en un laberinto lleno de puntos. Debes comer todos los puntos para avanzar al siguiente nivel. Los power pellets (puntos grandes) te permiten comer fantasmas temporalmente. Cada fantasma tiene una personalidad de IA diferente. El laberinto tiene un pasillo que conecta ambos lados (wrap-around).

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Comer todos los puntos del laberinto |
| **Derrota** | Perder todas las vidas (3) |
| **Puntuación** | Punto: 10pts; Power pellet: 50pts; Fantasma: 200-1600pts |

## Controles

| Tecla | Acción |
|-------|--------|
| ↑ / W | Mover arriba |
| ↓ / S | Mover abajo |
| ← / A | Mover izquierda |
| → / D | Mover derecha |
| Click / Espacio | Reiniciar tras Game Over |

## IA de Fantasmas

| Fantasma | Color | Comportamiento |
|----------|-------|----------------|
| **Blinky** | Rojo | Persigue directamente a Pac-Man |
| **Pinky** | Rosa | Apunta 4 casillas delante de Pac-Man |
| **Inky** | Cyan | Usa la posición de Blinky para flanquear |
| **Clyde** | Naranja | Persigue cuando está lejos, huye cuando está cerca |

## Mecánicas

- **Laberinto clásico**: 21×21 tiles con paredes, puntos y power pellets
- **Modos scatter/chase**: los fantasmas alternan entre dispersarse y perseguir
- **Frightened mode**: al comer power pellet, los fantasmas se vuelven azules y huyen
- **Fantasmas comidos**: vuelven a la casa fantasma y reaparecen (salen a fila vacía)
- **Wrap-around**: pasillo que conecta ambos lados del laberinto
- **Niveles progresivos**: mayor velocidad de fantasmas

## Estructura del código

- **`PacMan.js`**: Clase principal
  - `_updatePlayer()` → movimiento con colisión walkable y wrap-around
  - `_updateGhosts()` → IA individual de los 4 fantasmas
  - `_checkCollisions()` → puntos, power pellets, fantasmas
  - `_eatenGhost()` → fantasma comido, vuelve a casa
  - `_nextLevel()` → aumenta velocidad de fantasmas
  - `MAZE_DATA`: matriz 21×21 del laberinto

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD) |
| `StorageManager` | Persistencia de highscore |
| `AudioManager` | SFX de punto, powerup, moneda, explosión |
| `HapticManager` | Vibración en power pellets y muerte |
| `ParticleSystem` | Efectos al comer fantasmas |
| `i18n` | Textos traducidos |
