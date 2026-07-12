# Bowman

**Nivel 4 — Estrategia / Defensa**

Dos arqueros en lados opuestos del campo de batalla. El jugador apunta con el ratón (ángulo y potencia) y dispara flechas con física parabólica afectada por viento. La IA enemiga apunta con margen de error variable según la dificultad, que escala con las rondas jugadas.

## Gameplay

Por turnos, tú y la IA os disparáis flechas. El viento cambia cada turno y afecta la trayectoria. La dificultad de la IA escala: cada 4 rondas se vuelve más precisa. Cada 3 rondas completas recibes un power-up aleatorio. Gana el que reduzca la vida del contrario a 0.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Reducir la vida del enemigo a 0 |
| **Victoria** | HP enemigo ≤ 0 o más HP tras 20 turnos |
| **Derrota** | HP jugador ≤ 0 |
| **Rondas máximas** | 20 (si se acaban, gana el que más HP tenga) |

## Controles

| Tecla | Acción |
|-------|--------|
| Ratón (movimiento) | Apuntar (ángulo) |
| Click / Espacio | Disparar |
| ↑↓ | Ajustar ángulo fino |
| Click / Espacio | Reiniciar |

## Constantes de balance

| Parámetro | Valor |
|-----------|-------|
| Gravedad | 350 px/s² |
| Viento máximo | ±80 px/s² |
| Velocidad flecha | 500 × potencia |
| HP inicial | 100 por arquero |
| Daño por flecha | 15-50 (según cercanía al centro) |

### Power-ups (cada 3 rondas)

| Power-up | Efecto |
|----------|--------|
| 🛡️ Escudo | Reduce daño recibido a la mitad (un golpe) |
| 🏹 Multidisparo | Dispara 2 flechas |
| 💚 Curación | +25 HP |

### Dificultad de IA

| Rondas | Dificultad | Precisión |
|--------|-----------|-----------|
| 1-3 | 1 | ±0.28 rad de error |
| 4-7 | 2 | ±0.23 rad |
| 8-11 | 3 | ±0.18 rad |
| 12-15 | 4 | ±0.13 rad |
| 16-19 | 5 | ±0.08 rad |

## Estructura del código

- **`Bowman.js`**: Clase principal
  - `_calculateAIShot()` → cálculo de ángulo/potencia óptima con margen de error
  - `_fire()` → lanzamiento de flecha
  - `_updateArrow()` → física parabólica con gravedad, viento y colisiones
  - `_onArrowHit()` → cálculo de daño basado en distancia al centro
  - `_nextTurn()` → cambio de turno, recalcula viento
  - `_getPowerUp()` → selección aleatoria de power-up
  - `_renderArcher()` → dibujo detallado de arqueros (arco, flecha, HP bar)
  - `_renderArrow()` → dibujo de flecha con cabeza y plumas
  - `_renderWindIndicator()` → indicador visual de dirección/intensidad del viento
- **`i18n.js`**: Traducciones específicas (bowman.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Ratón + teclado (flechas/Espacio) |
| `StorageManager` | Persistencia de highscore |
| `CollisionUtils` | `clamp()` para límites |
| `ParticleSystem` | `burst()` para impacto de flecha y suelo |
| `AudioManager` | SFX de impacto, powerup, explosión |
| `HapticManager` | Vibración en impactos |
| `SeededRandom` | Semilla para viento, power-ups y terreno |
| `i18n` | Textos traducidos |
