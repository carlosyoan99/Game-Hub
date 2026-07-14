# Papa's Pizzeria

**Puzzle y Gestión**

Juego de gestión de tiempo: los clientes llegan en cola con pedidos personalizados y el jugador debe preparar cada pizza siguiendo 7 pasos secuenciales. Cada paso tiene un temporizador. Si el cliente espera demasiado, se va y aumenta la barra de enfado.

## Gameplay

Los clientes llegan con pedidos de pizza específicos (combinación de toppings). Debes seleccionar un cliente de la cola, hacer click en la estación correcta para cada paso, y esperar a que se complete antes de pasar al siguiente. Gestiona múltiples clientes simultáneamente.

**Pasos de preparación**: Tomar pedido → Amasar → Salsa → Queso → Topping(s) → Hornear → Servir

| Aspecto | Descripción |
|---------|-------------|
| **Objetivo** | Servir 15 pizzas |
| **Victoria** | Alcanzar 15 pizzas servidas |
| **Derrota** | 4 clientes se van (MAX_ANGER = 4) |
| **Puntuación** | $10 por pizza + $5 propina si se sirve rápido |

## Controles

| Entrada | Acción |
|---------|--------|
| Click en cliente | Seleccionar cliente de la cola |
| Click en estación | Iniciar paso de preparación |
| Click / Espacio | Reiniciar |

## Constantes de balance

| Parámetro | Valor |
|-----------|-------|
| Tiempo por paso | 0.8s - 3.0s (según paso) |
| Paciencia base | 18s (±4s varianza) |
| Intervalo spawn | 7s (±3s) |
| Máxima cola | 5 clientes |
| Máximo enfado | 4 (game over) |
| Pizzas para ganar | 15 |
| Ingredientes | 8 tipos de topping |
| Propina | $5 si paciencia > 60% al servir |

- **Dificultad progresiva**: paciencia disminuye 2% por pizza servida, spawn se acelera
- **Toppings**: 1-3 por pizza, seleccionados aleatoriamente

## Estructura del código

- **`PapaPizzeria.js`**: Clase principal
  - `_spawnCustomer()` → genera clientes con pedidos aleatorios
  - `_handleClick()` → selección de cliente o estación
  - `_serveCustomer()` → entrega pizza, calcula propina, gestiona puntuación
  - `_customerLeft()` → cliente se va, aumenta enfado
  - `_layoutStations()` → posiciona estaciones según tamaño del canvas
  - `_customerRect()` → posiciona tarjetas de cliente en cola
- **`i18n.js`**: Traducciones específicas (papa.*)

## Dependencias del engine

| Módulo | Uso |
|--------|-----|
| `InputManager` | Ratón (clicks) |
| `StorageManager` | Persistencia de mejor puntuación |
| `CollisionUtils` | `pointInRect()` para detección de clicks |
| `AudioManager` | SFX de selección, moneda, powerup, golpe |
| `HapticManager` | Vibración en eventos |
| `SeededRandom` | Semilla para pedidos y tiempos de llegada |
| `i18n` | Textos traducidos |
