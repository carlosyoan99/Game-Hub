# Swords and Souls

**Rol y Aventura**

RPG completo con hub de 4 zonas (Casa, Entrenamiento, Arena, Tienda), minijuegos de entrenamiento (puntería, sparring, resistencia), combate por turnos con IA adaptativa, subida de nivel con asignación de puntos y tienda con armas/armaduras/objetos.

## Gameplay

Entrena tus estadísticas con minijuegos, enfréntate a 12 oleadas de enemigos en combate por turnos, compra equipo en la tienda y sube de nivel. La IA enemiga se adapta a tus patrones de ataque/defensa.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Derrotar tantas oleadas como sea posible |
| **Progresión** | 12 enemigos únicos, dificultad escala con oleadas |
| **Derrota** | Caer en combate (HP ≤ 0) |
| **Récord** | Mejor oleada alcanzada y oro total acumulado |

## Controles

| Entrada | Acción |
|---------|--------|
| Click | Navegar hub, entrenar, comprar, combatir |
| Click / Espacio | Reiniciar |

## Minijuegos de entrenamiento

| Entrenamiento | Mecánica | Estadística | Recompensa |
|--------------|----------|-------------|------------|
| Arquería | Click en blancos móviles | Arquería | +1 por 3 aciertos |
| Sparring | Click rápido en saco | Fuerza | +1 por 3 golpes |
| Resistencia | Clickeo rápido contra reloj | Resistencia | +1 por 3 clics |

## Constantes de balance

### Estadísticas base

| Stat | Base | Efecto |
|------|------|--------|
| Fuerza (str) | 3 | Ataque cuerpo a cuerpo |
| Agilidad (agi) | 3 | Velocidad |
| Resistencia (end) | 3 | Defensa |
| Arquería (arch) | 1 | Ataque a distancia |
| HP | 50 + (nivel-1)×8 | — |

### Progresión

| Nivel | XP necesario | Puntos de stat |
|-------|-------------|----------------|
| 1 | 20 | 3 |
| 2 | 33 | 3 |
| 3 | 51 | 3 |
| 4 | 76 | 3 |
| 5 | 111 | 3 |

### Enemigos (12 oleadas)

| # | Enemigo | HP | ATQ | DEF | XP | Oro |
|---|---------|-----|-----|-----|----|-----|
| 1 | Slime | 20 | 3 | 0 | 10 | 5 |
| 2 | Esqueleto | 30 | 5 | 2 | 20 | 10 |
| 3 | Lobo | 25 | 7 | 1 | 25 | 12 |
| 4 | Goblin | 20 | 4 | 1 | 30 | 15 |
| 5 | Orco | 45 | 9 | 4 | 40 | 20 |
| 6 | Nigromante | 35 | 3 | 2 | 50 | 25 |
| 7 | Dragón joven | 60 | 12 | 5 | 80 | 40 |
| 8 | Caballero oscuro | 55 | 10 | 7 | 100 | 50 |
| 9 | Troll | 80 | 15 | 8 | 120 | 60 |
| 10 | Demonio | 50 | 11 | 3 | 140 | 70 |
| 11 | Dragón anciano | 100 | 18 | 6 | 200 | 100 |
| 12 | Rey esqueleto | 120 | 14 | 10 | 250 | 120 |

### Tienda

| Categoría | Items | Precios |
|-----------|-------|---------|
| Armas | 7 (desde Puños gratis hasta Espada del Vacío $500) | $0-$500 |
| Armaduras | 5 (desde Harapos gratis hasta Dragón $500) | $0-$500 |
| Objetos | Poción ($20), Poción+ ($50), Afilar ($30), Tomo ($80) | $20-$80 |

## Estructura del código

- **`SwordsAndSouls.js`**: Clase principal
  - **Hub**: `_handleHubClick()`, `_goToScene()`, `_rest()`, `_assignStat()`
  - **Entrenamiento**: `_startTraining()`, `_updateTraining()`, `_finishTraining()`
  - **Combate**: `_startCombat()`, `_updateCombat()`, `_doPlayerAction()`, `_executeEnemyTurn()`
  - **Tienda**: `_handleShopClick()`, `_buyItem()`
  - **Render**: `_renderHub()`, `_renderTraining()`, `_renderCombat()`, `_renderShop()`
  - **Constantes**: `EQUIPMENT{}`, `ENEMIES[]`, `BASE_HP`, `HP_PER_LEVEL`
- **`i18n.js`**: Traducciones específicas (swords.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Ratón (clicks) |
| `StorageManager` | Persistencia de bestWave y totalGold |
| `CollisionUtils` | `pointInRect()` para detección de clicks en botones |
| `ParticleSystem` | `burst()` para impactos en combate y entrenamiento |
| `AudioManager` | SFX de golpe, disparo, powerup, moneda |
| `HapticManager` | Vibración en combate y subida de nivel |
| `SeededRandom` | Semilla para entrenamiento y combate |
| `i18n` | Textos traducidos |
