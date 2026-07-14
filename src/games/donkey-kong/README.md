# Donkey Kong

**Plataformas**

El clásico juego donde Jumpman (Mario) debe rescatar a Pauline de Donkey Kong. Salta plataformas, esquiva barriles y escala estructuras en 4 pantallas diferentes. El juego comienza con un mensaje de tutorial explicando las mecánicas básicas.

## Gameplay

Controlas a Jumpman mientras sube por estructuras evitando barriles que Donkey Kong lanza desde arriba. Hay 4 pantallas distintas (25m, 50m, 75m, 100m) cada una con mecánicas únicas. Llega hasta Pauline para completar la pantalla.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Alcanzar a Pauline en cada pantalla |
| **Derrota** | Perder todas las vidas (3) |
| **Puntuación** | Remache: 50pts; Pantalla completada: 100pts; Nivel: 500pts |

## Controles

| Tecla | Acción |
|-------|--------|
| ← / A | Mover izquierda |
| → / D | Mover derecha |
| ↑ / W / Espacio | Saltar o subir escalera |
| ↓ / S | Bajar escalera |
| Click / Espacio | Reiniciar tras Game Over |

## Pantallas

| Pantalla | Mecánica |
|----------|----------|
| **25m** | Rampas inclinadas, barriles que ruedan y rebotan |
| **50m** | Cintas transportadoras que mueven al jugador |
| **75m** | Ascensores móviles verticales |
| **100m** | Remaches que se destruyen al pisarlos |

## Mecánicas

- **Salto con gravedad**: física básica con gravedad
- **Escaleras**: sube y baja entre plataformas (pulsa ↑/↓ cerca de una escalera)
- **Barriles**: ruedan por las plataformas, rebotan al llegar al borde
- **4 pantallas distintas**: cada una con diseño y mecánica únicos
- **3 vidas**: al morir, reinicias en la misma pantalla
- **Tutorial inicial**: al comenzar el juego aparece un mensaje explicativo

## Estructura del código

- **`DonkeyKong.js`**: Clase principal
  - `_initLevel()` → configura la pantalla actual con plataformas y escaleras
  - `_updatePlayer()` → movimiento horizontal, salto, escaleras
  - `_updateBarrels()` → spawn y física de barriles
  - `_checkCollisions()` → muerte, remaches, meta
  - Pantallas: constantes con datos de plataformas, escaleras, ascensores

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Teclado (flechas/WASD/Espacio) |
| `StorageManager` | Persistencia de highscore |
| `CollisionUtils` | `aabbIntersects` para colisiones |
| `AudioManager` | SFX de salto, impacto, moneda, explosión |
| `HapticManager` | Vibración al morir |
| `ParticleSystem` | Efectos al destruir remaches |
| `i18n` | Textos traducidos |
