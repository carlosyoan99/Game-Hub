# Stick RPG

**Rol y Aventura**

Juego de simulación con sistema de días/energía, diálogos con NPCs y cambio de escenas en un mapa urbano. El jugador se mueve entre escenas (Casa, Calles, Gimnasio, Biblioteca, Trabajo, Tienda, Parque, Mercado). Cada escena tiene actividades que consumen energía y otorgan dinero o mejoran estadísticas.

## Gameplay

Gestiona tu tiempo y energía para sobrevivir 14 días. Cada día puedes realizar actividades en diferentes escenas. Dormir en casa regenera energía y avanza al día siguiente. Mejora tus estadísticas (fuerza, inteligencia, carisma) para alcanzar la victoria. Cada día trae conversaciones e interacciones nuevas: no todas las opciones están siempre disponibles, y los eventos aleatorios añaden variedad.

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Sobrevivir 14 días o alcanzar 40 puntos totales de stats |
| **Victoria** | Día 14 alcanzado o stats totales ≥ 40 |
| **Derrota** | No hay derrota directa (energía 0 solo impide acciones) |
| **Estadísticas** | Fuerza, Inteligencia, Carisma |

## Controles

| Entrada | Acción |
|---------|--------|
| Click en acción | Realizar actividad |
| Click en navegación | Cambiar de escena |
| Click / Espacio | Reiniciar |

## Escenas y actividades

| Escena | Actividades | Efectos |
|--------|------------|---------|
| Casa | Dormir, Leer | Regenera energía, +Inteligencia |
| Calles | Caminar, Mendigar | +Carisma, +Dinero |
| Gimnasio | Pesas ligeras, Pesas pesadas, Cardio | +Fuerza, +Carisma |
| Biblioteca | Leer libro, Estudiar, Investigar | +Inteligencia, +Dinero |
| Trabajo | Media jornada, Completa, Extra | +Dinero |
| Tienda | Comida, Bebida, Vitaminas, Libros | +Energía, +Stats |
| Parque | Relajarse, Explorar | +Energía, Eventos |
| Mercado | Comerciar, Trabajo | +Dinero |

## Constantes de balance

| Parámetro | Valor |
|-----------|-------|
| Energía máxima | 100 |
| Dinero inicial | $20 |
| Días máximo | 14 |
| Restauración al dormir | 100 energía |
| Stats para victoria | 40 total |
| Evento aleatorio | 40% probabilidad al despertar |
| Diálogo NPC | 3.5s de duración |

## Estructura del código

- **`StickRPG.js`**: Clase principal
  - `SCENES{}`: definición de 8 escenas con acciones, diálogos y conexiones
  - `_performAction()` → ejecuta acción específica con switch por id
  - `_goToScene()` → cambio de escena con actualización de botones
  - `_checkWinCondition()` → verifica día 14 o stats ≥ 40
  - `_updateSceneActions()` → posiciona botones según resolución
  - `RANDOM_EVENTS[]`: 7 eventos aleatorios con efectos
- **`i18n.js`**: Traducciones específicas (stick.*) — incluye nombres de escenas, acciones, diálogos NPC y eventos

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Ratón (clicks) |
| `StorageManager` | Persistencia de mejor día alcanzado |
| `CollisionUtils` | `pointInRect()` para detección de clicks |
| `wrapText` | Renderizado de texto de diálogo multilínea |
| `AudioManager` | SFX de moneda, powerup, selección |
| `HapticManager` | Vibración en eventos |
| `SeededRandom` | Semilla para eventos aleatorios y variedad de diálogos |
| `i18n` | Textos traducidos |
