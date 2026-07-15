# Metroid-like (Exploración no lineal)

Juego de exploración y acción con mapa de salas interconectadas. Consigue power-ups para desbloquear nuevas áreas y derrota al jefe final.

## Controles

| Tecla | Acción |
|-------|--------|
| ← → / A D | Moverse |
| ↑ / W / Espacio | Saltar |
| Shift (izq) | Correr (con Speed Booster) |
| ↓ / S | Morph Ball (con habilidad) |
| J | Disparar misil (con habilidad) |
| K | Colocar bomba (con habilidad) |
| M | Minimapa (toggle) |

### Gamepad
- LStick / D-pad: Moverse
- A: Saltar
- X: Correr
- Down / LStickDown: Morph Ball
- B: Disparar
- Y: Bomba
- Back: Mapa

## Mecánica

- **Exploración no lineal**: 6 salas interconectadas en un grid 4×5.
- **Power-ups**: Consigue habilidades que abren nuevas rutas:
  - 🔵 **Morph Ball**: rueda por espacios estrechos
  - 🔴 **Misiles**: dispara y abre puertas, daña enemigos y jefe
  - 💣 **Bombas**: destruye bloques agrietados (cracked)
  - ⬆ **Space Jump**: doble salto
  - ⚡ **Speed Booster**: corre más rápido
- **Mapa**: minimapa en esquina superior derecha muestra salas exploradas.
- **Enemigos**: Zoomers (suelo), Skrees (techo), Boss al final.
- **HP**: 50 de salud, recuperable con ítems de vida.

## Salas

| # | Sala | Conexiones | Contenido |
|---|------|------------|-----------|
| 0 | Central Hub | → Izq, Der, Abajo | Morph Ball, HP |
| 1 | Factory Hall | → Arriba | Bomba, enemigos |
| 2 | Upper Factory | → Abajo | Misil, enemigos |
| 3 | Left Caverns | → Derecha | Space Jump, enemigos |
| 4 | Bomb Training | → Arriba, Abajo | Bombas, cracked blocks |
| 5 | Boss Lair | → Arriba | ⚠️ Jefe final |

## Logros

- **Matadragones**: derrota al jefe final
- **Explorador**: encuentra el Space Jump
- **Demolición**: encuentra las bombas
