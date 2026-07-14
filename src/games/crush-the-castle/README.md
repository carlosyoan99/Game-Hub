# Crush the Castle

**Estrategia**

Derriba castillos enemigos disparando proyectiles desde una catapulta. El proyectil sigue una trayectoria parabólica con gravedad, y los bloques tienen puntos de vida que se reducen con el impacto. El objetivo es eliminar a todos los soldados enemigos dentro del castillo.

## Gameplay

Apunta con el ratón (ángulo y potencia) y dispara proyectiles desde una catapulta para derribar castillos. Cada impacto daña los bloques (madera, piedra, reforzados, explosivos) y puede matar soldados. Tienes munición limitada por oleada.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Eliminar todos los soldados enemigos |
| **Victoria** | Todos los soldados eliminados |
| **Derrota** | Quedarse sin munición con soldados vivos |
| **Oleadas** | Ilimitadas — cada oleada castillos más grandes |

## Controles

| Tecla | Acción |
|-------|--------|
| Ratón (movimiento) | Apuntar (ángulo y potencia) |
| Click / Espacio | Disparar |
| Flechas ↑↓ | Ajustar ángulo |
| Flechas ←→ | Ajustar potencia |
| Click / Espacio | Siguiente oleada / Reiniciar |

## Constantes de balance

| Parámetro | Valor |
|-----------|-------|
| Gravedad | 400 px/s² |
| Tamaño bloque | 28×28 px |
| Radio proyectil | 6 px |
| Velocidad proyectil | 500 × potencia |
| Munición base | 5 por oleada (+1 cada 2 oleadas) |

### Tipos de bloque

| Tipo | HP | Color | Efecto especial |
|------|----|-------|-----------------|
| Madera | 2 | #6b4a2e | — |
| Piedra | 4 | #5a5a6a | — |
| Reforzado | 8 | #4a5a6a | Disponible desde wave 3 |
| Explosivo | 1 | #c84848 | Explosiona al destruirse, daña bloques cercanos (wave 5+) |

- **Puntuación**: bloque destruido +10 (+5 por impacto), soldado eliminado +25
- **Soldados**: 2-6 por oleada según wave

## Estructura del código

- **`CrushTheCastle.js`**: Clase principal
  - `_buildCastle()` → genera estructura del castillo con bloques y soldados
  - `_fire()` → lanza proyectil desde la catapulta
  - `_updateProjectile()` → física parabólica con gravedad, colisiones y rebotes
  - `_checkWaveEnd()` → verifica condición de victoria/derrota
  - `_renderCatapult()` → dibujo detallado de la catapulta con ruedas y brazo
  - `DEBRIS_OPTS`: constantes de partículas para escombros
- **`i18n.js`**: Traducciones específicas (crush.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Ratón + teclado (flechas/Espacio) |
| `StorageManager` | Persistencia de highscore |
| `CollisionUtils` | `clamp()` para límites |
| `ParticleSystem` | `burst()` para impacto, explosiones y escombros |
| `AudioManager` | SFX de disparo, impacto, explosión, powerup |
| `HapticManager` | Vibración en impactos y explosiones |
| `SeededRandom` | Semilla para generación de castillos |
| `i18n` | Textos traducidos |
