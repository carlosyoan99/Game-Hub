# Bloons TD

**Estrategia**

Juego de Tower Defense: los globos (Bloons) siguen un camino fijo a través del mapa. El jugador coloca torres que disparan automáticamente a los bloons cercanos. Cada oleada trae más bloons y más resistentes. Sistema de dinero y vidas con 3 tipos de torre.

## Gameplay

Los bloons entran por el lado izquierdo y siguen un camino serpenteante hasta la salida. Coloca torres estratégicamente a lo largo del camino para eliminarlos antes de que lleguen al final. Cada bloon eliminado da dinero para comprar más torres. Cada bloon que escapa resta una vida.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Sobrevivir el mayor número de oleadas posible |
| **Derrota** | Perder todas las vidas (20) |
| **Oleadas** | Infinitas, dificultad progresiva |
| **Velocidad** | 1x / 2x / 3x — seleccionable con teclas 4/5/6 |
| **Auto-avance** | 5 segundos sin click para comenzar siguiente oleada |

## Controles

| Tecla | Acción |
|-------|--------|
| Click | Colocar torre (si hay dinero suficiente) |
| 1 / 2 / 3 | Seleccionar tipo de torre |
| 4 / 5 / 6 | Velocidad 1x / 2x / 3x |
| P | Alternar modo colocación |
| Espacio / Click | Iniciar oleada |
| Click / Espacio | Reiniciar |

**🎮 Gamepad**: D-pad L/R → seleccionar torre · A → colocar · Start → iniciar oleada

## Tipos de torre

| Torre | Coste | Daño | Alcance | Velocidad | Especial |
|-------|-------|------|---------|-----------|----------|
| Dardo | $50 | 1 | 100px | 0.4s | — |
| Cañón | $100 | 3 | 120px | 0.8s | Daño en área (30px) |
| Francotirador | $200 | 5 | 400px | 1.4s | Alto daño, gran alcance |

## Tipos de bloon

| Bloon | Velocidad | HP | Puntos | Aparece desde |
|-------|-----------|----|--------|---------------|
| Rojo | 50 | 1 | 1 | Oleada 1 |
| Azul | 60 | 1 | 2 | Oleada 2 |
| Verde | 70 | 2 | 3 | Oleada 3 |
| Amarillo | 90 | 2 | 4 | Oleada 4 |
| Rosa | 110 | 3 | 5 | Oleada 5 |
| Negro | 80 | 4 | 8 | Oleada 6 |
| Blanco | 100 | 5 | 10 | Oleada 7 |
| Plomo | 40 | 8 | 15 | Oleada 8 |
| Púrpura | 120 | 3 | 7 | Oleada 9 |
| Cebra | 95 | 6 | 12 | Oleada 10 |
| Cerámica | 70 | 10 | 20 | Oleada 11+ |

- **Vidas iniciales**: 20
- **Dinero inicial**: $300
- **Bonus por oleada**: $20 + wave×5 al completar
- **$ por bloon**: puntos × 2

## Estructura del código

- **`BloonsTD.js`**: Clase principal
  - `_calculatePath()` → convierte waypoints relativos a absolutos según resolución
  - `_startWave()` → prepara oleada con tipos de bloon sesgados
  - `_spawnBloon()` → crea bloon en el punto de inicio
  - `_updateBloons()` → movimiento por path con interpolación entre waypoints
  - `_updateTowers()` → auto-ataque con selección del bloon más cercano
  - `_updateProjectiles()` → proyectiles con seguimiento y daño de área
  - `_tryPlaceTower()` → verifica coste, espacio libre y coloca torre
  - `RELATIVE_WAYPOINTS` → waypoints como fracciones (0-1) escalables
- **`i18n.js`**: Traducciones específicas (bloons.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Ratón + teclado (1/2/3/4/5/6/P/Espacio) |
| `StorageManager` | Persistencia de highscore |
| `ParticleSystem` | `burst()` para impacto, muerte de bloon y explosiones |
| `AudioManager` | SFX de moneda, powerup, inicio de oleada |
| `HapticManager` | Vibración en eventos |
| `SeededRandom` | Semilla para tipos de bloon por oleada |
| `i18n` | Textos traducidos |
| `IconRenderer` | Icono SVG clock para indicador de velocidad |
