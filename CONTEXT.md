Aquí tienes un listado por categorías, ordenado de menor a mayor **complejidad lógica** (no gráfica), para que subas de nivel progresivamente.

---

### 🟢 Nivel 1: Arcade y Reflejos (Física básica + Puntuación)
**Lo que aprendes**: Bucle de juego, detección de colisiones (AABB/Círculo), entrada de teclado/ratón.

| Juego Flash | Mecánica a programar desde 0 | Dificultad |
| :--- | :--- | :--- |
| **Pong / Breakout** | Rebotes con ángulos variables. Romper ladrillos = destrucción de instancias. | ⭐ |
| **Snake** | Movimiento en cuadrícula con cola (arrays). Colisión contra uno mismo. | ⭐ |
| **Asteroids** | Física de nave espacial (aceleración/fricción). Disparos y spawn de enemigos. | ⭐⭐ |
| **Flappy Bird** (Flash tenía clones) | Gravedad constante, colisión por tuberías (scroll infinito). | ⭐⭐ |

---

### 🟡 Nivel 2: Plataformas (Física avanzada + Cámaras)
**Lo que aprendes**: Gravedad, salto con variable de fuerza, detección de suelo/techo, y **Tilemaps** (mapas basados en baldosas).

| Juego Flash | Mecánica a programar desde 0 | Dificultad |
| :--- | :--- | :--- |
| **Super Mario 63** | Colisiones pixel-perfect con el suelo. Movimiento de cámara que sigue al jugador. | ⭐⭐⭐ |
| **Fancy Pants Adventures** | Curvas de salto suaves (velocidad Y variable). Zonas de "pared" para deslizarse. | ⭐⭐⭐ |
| **Fireboy & Watergirl** | **Multijugador local** (2 teclados). Plataformas móviles y activadores (palancas). | ⭐⭐⭐ |

---

### 🔵 Nivel 3: Rompecabezas y Gestión (Máquinas de Estados + UI)
**Lo que aprendes**: Manejo de inventarios, estados de objetos (abierto/cerrado), y lógica condicional compleja.

| Juego Flash | Mecánica a programar desde 0 | Dificultad |
| :--- | :--- | :--- |
| **The Impossible Quiz** | Sistema de preguntas con respuestas únicas (click en zonas ocultas). Guardado de "vidas". | ⭐⭐ |
| **Papa's Pizzeria** | **Gestión de colas** (pedidos en fila). Temporizadores y multitarea (cocinar + servir). | ⭐⭐⭐ |
| **Stick RPG (versión simple)** | Sistema de "días" y energía. Diálogos con NPCs y cambio de escenas (mapa). | ⭐⭐⭐⭐ |

---

### 🔴 Nivel 4: Estrategia y Defensa (Pathfinding + IA + Proyectiles)
**Lo que aprendes**: Spawneo de oleadas, seguimiento de rutas (Waypoints), y disparos con precisión.

| Juego Flash | Mecánica a programar desde 0 | Dificultad |
| :--- | :--- | :--- |
| **Crush the Castle** | Física de **proyectiles** (puntos de estrés en estructuras). Detección por polígonos. | ⭐⭐⭐⭐ |
| **Bowman** (archery) | Tiro parabólico con viento. IA enemiga que apunta con margen de error. | ⭐⭐⭐ |
| **Bloons TD** (básico) | Enemigos que siguen un camino fijo (waypoints). Torres que disparan a objetivos cercanos. | ⭐⭐⭐⭐ |
| **Territory War** | IA de bots para moverse y atacar. Sistema de turnos o tiempo real con cooldowns. | ⭐⭐⭐⭐⭐ |

---

### 🟣 Nivel 5: RPG y Acción Compleja (Persistencia + Árboles de Habilidades)
**Lo que aprendes**: Guardado en `localStorage`, sistemas de "subida de nivel" y combos.

| Juego Flash | Mecánica a programar desde 0 | Dificultad |
| :--- | :--- | :--- |
| **Swords and Souls** | Entrenamiento por minijuegos que suben estadísticas. Combate por turnos con IA adaptativa. | ⭐⭐⭐⭐⭐ |
| **Henry Stickmin** (colección) | **Árbol de decisiones** (puntos de ramificación). Reproducción de animaciones secuenciales. | ⭐⭐⭐⭐ |

---

### 🧠 Mi recomendación de "Ruta de Aprendizaje" para programar

1.  **Semana 1**: Haz un **Breakout** (aprenderás Canvas y colisiones).
2.  **Semana 2**: Haz un **Plataformas** con un mapa de tiles (aprenderás a cargar niveles desde arrays).
3.  **Semana 3**: Haz la mecánica de **Bowman** (trayectorias y apuntado con el mouse).
4.  **Semana 4**: Une todo en un pequeño **RPG** donde el combate sea el minijuego de Bowman y el mapa sea el de plataformas.

**Tecnología pura**: Usa **Canvas 2D** + JavaScript vanilla para los primeros 3 juegos. Cuando domines eso, cambia a **Phaser 3** para ahorrar código en los más complejos (TD y RPG).
