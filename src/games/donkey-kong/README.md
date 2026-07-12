# Donkey Kong

**Nivel 3 — Plataformas / Arcade**

¡El clásico juego donde Jumpman (Mario) debe rescatar a Pauline de Donkey Kong! Salta plataformas, esquiva barriles y escala estructuras en 4 pantallas diferentes.

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
| **25m** | Rampas inclinadas, barriles ruedan |
| **50m** | Cintas transportadoras que mueven al jugador |
| **75m** | Ascensores móviles verticales |
| **100m** | Remaches que se destruyen al pisarlos |

## Mecánicas

- **Salto con gravedad:** Física básica con gravedad
- **Escaleras:** Sube y baja entre plataformas
- **Barriles:** Ruedan por las plataformas y rebotan
- **4 pantallas distintas:** Cada una con diseño y mecánica únicos
- **3 vidas:** Al morir, reinicias en la misma pantalla

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
