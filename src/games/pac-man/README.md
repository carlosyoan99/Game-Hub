# Pac-Man

**Nivel 3 — Laberinto / Arcade**

El clásico juego del come-cocos. Recorre el laberinto comiendo puntos y power pellets mientras esquivas a los fantasmas.

## Gameplay

Controlas a Pac-Man en un laberinto lleno de puntos. Debes comer todos los puntos para avanzar al siguiente nivel. Los power pellets (puntos grandes) te permiten comer fantasmas temporalmente. Cada fantasma tiene una personalidad de IA diferente.

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

- **Laberinto clásico:** 21x21 tiles con paredes, puntos y power pellets
- **Modos scatter/chase:** Los fantasmas alternan entre dispersarse y perseguir
- **Frightened mode:** Al comer power pellet, los fantasmas se vuelven azules y huyen
- **Fantasmas comidos:** Vuelven a la casa fantasma y reaparecen
- **Wrap-around:** Pasillo que conecta ambos lados del laberinto
- **Niveles progresivos:** Mayor velocidad de fantasmas

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD) |
| `StorageManager` | Persistencia de highscore |
| `AudioManager` | SFX de punto, powerup, moneda, explosión |
| `HapticManager` | Vibración en power pellets y muerte |
| `ParticleSystem` | Efectos al comer fantasmas |
| `i18n` | Textos traducidos |
