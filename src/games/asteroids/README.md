# Asteroids

**Nivel 2 — Nave / Física**

Asteroids expandido con **10 oleadas** progresivas. Las primeras oleadas solo tienen asteroides; desde la oleada 3 aparecen naves enemigas que persiguen y disparan. La nave del jugador tiene propulsión con fricción exponencial, giro y disparos.

## Gameplay

Controlas una nave triangular en un espacio sin bordes (wraparound). Destruye asteroides y enemigos esquivando sus ataques. Los asteroides grandes se dividen en medianos, y estos en pequeños. Cada 10 oleadas completadas es victoria.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Sobrevivir 10 oleadas |
| **Victoria** | Completar la oleada 10 |
| **Derrota** | Perder todas las vidas (3) |
| **Puntuación** | Asteroide grande: 20; mediano: 50; pequeño: 100; enemigo: 50 + wave×10 |

## Controles

| Tecla | Acción |
|-------|--------|
| ← → / A D | Rotar nave |
| ↑ / W | Propulsión |
| Espacio / Click sostenido | Disparar |
| Click / Espacio | Reiniciar |

## Constantes de balance

| Oleada | Asteroides | Enemigos | Velocidad enemigos | HP enemigos |
|--------|-----------|----------|-------------------|-------------|
| 1 | 3-4 | 0 | — | — |
| 2 | 4-5 | 0 | — | — |
| 3 | 5-6 | 1 | 53-83 px/s | 2 |
| 5 | 7-8 | 2 | 59-89 px/s | 3 |
| 10 | 12-15 | 4-5 | 74-104 px/s | 5+ |

- **Nave**: radio 12 px, velocidad máx 340 px/s
- **Fricción exponencial**: `e^(-0.6 × dt)` — independiente del framerate
- **Munición**: ilimitada, cooldown 0.25s entre disparos
- **Balas**: velocidad 480 px/s, duran 0.9s
- **Invencibilidad post-respawn**: 2 segundos
- **Enemigos**: aparecen desde wave 3, persiguen y disparan cada 1.5-0.7s

## Estructura del código

- **`Asteroids.js`**: Clase principal con toda la lógica
  - `_spawnWave()` → genera asteroides + enemigos según oleada
  - `_updateShip()` → giro, propulsión, fricción, disparo
  - `_updateEnemies()` → IA de persecución y disparo
  - `_checkCollisions()` → balas vs asteroides/enemigos, nave vs todo
  - `_splitAsteroid()` → fragmentación en 2 partes más pequeñas
  - `_wrap()` → wraparound por bordes del canvas
  - `generateAsteroidShape()` → contorno irregular (no círculos perfectos)
- **`i18n.js`**: Traducciones específicas (asteroids.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD/Espacio) + ratón |
| `StorageManager` | Persistencia de highscore |
| `Vector2` | `fromAngle()` para propulsión orientada por ángulo |
| `CollisionUtils` | `circleIntersects()` para colisiones circulares |
| `AudioManager` | SFX de disparo, impacto, explosión, powerup |
| `HapticManager` | Vibración en impactos y eventos |
| `ParticleSystem` | `burst()` para explosiones de enemigos |
| `SeededRandom` | Semilla para generación de oleadas y formas |
| `i18n` | Textos traducidos |
