/**
 * Henry Stickmin — Constantes de configuración y árbol de escenas
 */
export const TYPE_SPEED = 30; // ms por carácter en el efecto máquina de escribir

/**
 * Árbol de escenas.
 * Cada escena tiene id, title, text, emoji, stickmanPose y choices.
 * Los choices pueden llevar a otra escena (next) o ser un final (ending).
 */
export const SCENES = {
  // ── ACTO 1: La Fuga ────────────────────────────────────────────────
  intro: {
    id: 'intro',
    title: 'Bienvenido, Henry',
    text: 'Henry Stickmin lleva años planeando el golpe perfecto.\nHoy es el día. El museo municipal tiene una nueva\nexposición: "El Zafiro Eterno". La seguridad es\nmáxima. Pero Henry tiene un plan... bueno, varios.',
    emoji: '🏛️',
    stickmanPose: 'thinking',
    choices: [
      { label: '🔍 Entrar sigilosamente', next: 'sneak' },
      { label: '💥 Entrar por la fuerza', next: 'force' },
      { label: '🎭 Disfrazarse de guardia', next: 'disguise' },
    ],
  },

  // ── Camino Sigiloso ────────────────────────────────────────────────
  sneak: {
    id: 'sneak',
    title: 'Sigilo ninja',
    text: 'Henry se desliza por el conducto de ventilación.\nEstá oscuro, apretado, y huele a humedad. Pero\nfunciona... hasta que el conducto se divide en tres.',
    emoji: '🌬️',
    stickmanPose: 'crawling',
    choices: [
      { label: '⬅️ Ir a la izquierda', next: 'sneak_left' },
      { label: '➡️ Ir a la derecha', next: 'sneak_right' },
      { label: '⬆️ Seguir recto', next: 'sneak_vent' },
    ],
  },
  sneak_left: {
    id: 'sneak_left',
    title: '¿Dónde estoy?',
    text: 'La izquierda lleva a la sala de calderas. Hay un\ncartel que dice "PELIGRO: GAS". Y al lado, una\nllave con una etiqueta que dice "SALA DE EXPOSICIONES".',
    emoji: '🔥',
    stickmanPose: 'pointing',
    choices: [
      { label: '🔑 Coger la llave', next: 'vault' },
      { label: '💨 Encender un fósforo', next: 'fail_explosion' },
    ],
  },
  sneak_right: {
    id: 'sneak_right',
    title: 'Sala de seguridad',
    text: 'La derecha da a la sala de vigilancia. Hay un\nsolo guardia mirando 30 monitores. Y una taza\nde café humeante en su escritorio.',
    emoji: '📹',
    stickmanPose: 'hiding',
    choices: [
      { label: '☕ Envenenar el café', next: 'vault_coffee' },
      { label: '🪑 Golpear al guardia', next: 'fail_guard_fight' },
    ],
  },

  // ── Camino Fuerza Bruta ────────────────────────────────────────────
  force: {
    id: 'force',
    title: 'A lo grande',
    text: 'Henry saca un martillo neumático de la mochila.\nLos guardias lo miran. La alarma no suena...\ntodavía. Tiene que decidir rápido qué romper.',
    emoji: '🔨',
    stickmanPose: 'holding_tool',
    choices: [
      { label: '🧱 Romper la pared', next: 'vault_wall' },
      { label: '🚪 Romper la puerta', next: 'fail_alarm' },
    ],
  },

  // ── Camino Disfraz ─────────────────────────────────────────────────
  disguise: {
    id: 'disguise',
    title: 'Disfraz profesional',
    text: 'Henry se pone un uniforme de guardia que\n"encontró". El problema: el uniforme le queda\ngrande, la placa dice "Bruce" y Henry no sabe\nel protocolo de seguridad.',
    emoji: '👮',
    stickmanPose: 'nervous',
    choices: [
      { label: '🗣️ Actuar con confianza', next: 'vault_bluff' },
      { label: '🏃 Salir corriendo', next: 'fail_chase' },
      { label: '😅 Actuar con torpeza', next: 'disguise_clumsy' },
    ],
  },

  // ── Nuevas rutas de expansión ──────────────────────────────────────
  sneak_vent: {
    id: 'sneak_vent',
    title: 'Dentro del conducto',
    text: 'Henry avanza por el conducto de ventilación.\nEscucha voces abajo. Hay una rejilla que da a\nla sala principal. Por otra ramificación se\nve un despacho con una caja fuerte abierta.',
    emoji: '🌬️',
    stickmanPose: 'crawling',
    choices: [
      { label: '⬇️ Bajar a la sala principal', next: 'sneak' },
      { label: '➡️ Ir al despacho', next: 'vault_office' },
    ],
  },
  vault_office: {
    id: 'vault_office',
    title: 'Despacho del director',
    text: 'El despacho está vacío. La caja fuerte abierta\ncontiene dinero, pero no el Zafiro. Sobre la\nmesa hay un plano del museo con una ruta\nmarcada en rojo hacia la cámara acorazada.',
    emoji: '📋',
    stickmanPose: 'pointing',
    choices: [
      { label: '💰 Coger el dinero', next: 'vault' },
      { label: '📷 Fotografiar el plano', next: 'success_plans' },
    ],
  },
  success_plans: {
    id: 'success_plans',
    title: '🎉 ¡PLAN PERFECTO!',
    text: 'Henry fotografía el plano y memoriza cada\ndetalle. Sabe exactamente qué sensores evitar\ny qué códigos usar. El Zafiro Eterno cae en\nsus manos sin un solo contratiempo.',
    emoji: '📸',
    stickmanPose: 'walking_away',
    ending: { type: 'success', text: 'El crimen perfecto. Nadie supo cómo lo hizo. Ni siquiera las cámaras.' },
  },
  disguise_clumsy: {
    id: 'disguise_clumsy',
    title: 'Torpeza profesional',
    text: 'Henry se pone el uniforme tan rápido que se\nlo pone del revés. Los guardías lo miran. Uno\ndice: "Eh, ¿estás bien?" . Henry asiente y\nsigue caminando. Nadie dice nada más.',
    emoji: '😅',
    stickmanPose: 'sweating',
    choices: [
      { label: '🚶 Seguir andando', next: 'vault_bluff' },
      { label: '🏃 Huir', next: 'fail_chase' },
    ],
  },

  // ── ACTO 2: El Zafiro ──────────────────────────────────────────────
  vault: {
    id: 'vault',
    title: 'La cámara acorazada',
    text: 'Con la llave, Henry abre la puerta trasera de la\ncámara. El Zafiro Eterno está dentro, flotando\nsobre un pedestal. Pero hay un sensor de peso\nen el suelo delante de él.',
    emoji: '💎',
    stickmanPose: 'reaching',
    choices: [
      { label: '🕺 Bailar para distraer', next: 'success_dance' },
      { label: '🏋️ Saltar el sensor', next: 'fail_sensor' },
    ],
  },
  vault_coffee: {
    id: 'vault_coffee',
    title: 'Café somnífero',
    text: 'El guardia bebe el café. Sonríe. Luego empieza\na cabecear... ¡Está dormido! Henry aprovecha\npara entrar en la cámara acorazada. El Zafiro\nEterno le espera tras un cristal blindado.',
    emoji: '💎',
    stickmanPose: 'victory',
    choices: [
      { label: '🔊 Romper el cristal con extintor', next: 'success_coffee' },
      { label: '🔍 Buscar el botón de apertura', next: 'fail_buttons' },
    ],
  },
  vault_wall: {
    id: 'vault_wall',
    title: 'A través del muro',
    text: '¡Pared derribada! Henry entra en la cámara por\nel hueco. Pero el martillo neumático hizo tanto\nruido que los guardias están subiendo. ¡Rápido!',
    emoji: '🧱',
    stickmanPose: 'running',
    choices: [
      { label: '🏃 Coger el zafiro y huir', next: 'success_wall' },
      { label: '🪤 Esconderse detrás de la cortina', next: 'fail_curtain' },
    ],
  },
  vault_bluff: {
    id: 'vault_bluff',
    title: 'Fingiendo ser Bruce',
    text: '"Eh... Bruce. Claro. Estoy haciendo... un\ninventario. Sí." Increíblemente, el guardia se lo\ncree. "Ah, el inventario de la noche. Adelante,\nBruce." ¡Dentro de la cámara!',
    emoji: '😅',
    stickmanPose: 'sweating',
    choices: [
      { label: '✅ Tomar el zafiro y salir', next: 'success_bluff' },
      { label: '📞 Llamar por radio al jefe', next: 'fail_radio' },
    ],
  },

  // ── FINALES ÉPICOS (Success) ───────────────────────────────────────
  success_dance: {
    id: 'success_dance',
    title: '🎉 ¡BAILE DE LA VICTORIA!',
    text: 'Henry pone música en su teléfono y empieza a\nbailar. El sensor de peso... ¡no detecta nada\nporque Henry se mueve! Cruza la sala dando\npasos de baile, toma el Zafiro y sale bailando.\n\nLos guardias, confundidos, lo aplauden.',
    emoji: '💃',
    stickmanPose: 'dancing',
    ending: { type: 'success', text: '¡Zafiro conseguido! Henry se convierte en una leyenda del baile y del crimen.' },
  },
  success_coffee: {
    id: 'success_coffee',
    title: '🎉 ¡CAFÉ LETAL!',
    text: 'Henry rompe el cristal con el extintor, toma el\nzafiro y sale corriendo. El guardia dormido ni se\nentera. Cuando despierta horas después, solo\nrecuerda haber tenido un sueño muy raro con\nun tipo disfrazado de guardia.',
    emoji: '☕',
    stickmanPose: 'running',
    ending: { type: 'success', text: '¡Misión cumplida! El Zafiro Eterno brilla en la guarida secreta de Henry.' },
  },
  success_wall: {
    id: 'success_wall',
    title: '🎉 ¡HUIDA ÉPICA!',
    text: 'Henry sale del museo con el zafiro bajo el brazo\nmientras los guardias tropiezan unos con otros.\nEn la puerta trasera le espera su furgoneta.\nBueno, no es SU furgoneta, pero tiene llaves.',
    emoji: '🚐',
    stickmanPose: 'driving',
    ending: { type: 'success', text: '¡Henry se convierte en el ladrón más buscado de la ciudad! Fin.' },
  },
  success_bluff: {
    id: 'success_bluff',
    title: '🎉 ¡EL MEJOR ACTOR!',
    text: 'Henry sale de la cámara andando tranquilamente,\ncon el zafiro en el bolsillo del uniforme. Saluda\nal guardia de recepción. "Buen trabajo, Bruce."\n"Siempre, siempre."',
    emoji: '🎭',
    stickmanPose: 'walking_away',
    ending: { type: 'success', text: 'Nadie supo nunca que "Bruce" era Henry Stickmin. El crimen perfecto.' },
  },

  // ── FINALES CÓMICOS (Fail) ─────────────────────────────────────────
  fail_explosion: {
    id: 'fail_explosion',
    title: '💥 ¡KABOOM!',
    text: 'El fósforo enciende el gas. La explosión lanza a\nHenry por los aires. Aterriza en la comisaría,\nliteralmente, en el tejado. Está bien... pero\nrodeado de policías.',
    emoji: '💥',
    stickmanPose: 'flying',
    ending: { type: 'fail', text: 'Henry es arrestado. Le ponen una medalla: "El ladrón más ruidoso del año".' },
  },
  fail_guard_fight: {
    id: 'fail_guard_fight',
    title: '😵 Pelea desigual',
    text: 'Henry salta sobre el guardia, pero resbala con\nuna revista en el suelo. Se golpea la cabeza\ncontra la mesa y queda inconsciente.\n\nEl guardia: "¿Ha sido un terremoto?"',
    emoji: '🪑',
    stickmanPose: 'ko',
    ending: { type: 'fail', text: 'Fin de la aventura. Henry despierta en una celda con un chichón enorme.' },
  },
  fail_alarm: {
    id: 'fail_alarm',
    title: '🚨 ¡ALARMA!',
    text: 'La puerta era blindada. El martillo rebota y golpea\na Henry en la rodilla. Mientras él salta en un pie,\nla alarma se activa. 50 guardias lo rodean en segundos.',
    emoji: '🚨',
    stickmanPose: 'injured',
    ending: { type: 'fail', text: '"Pensábamos que sería más listo", dijo el jefe de seguridad.' },
  },
  fail_chase: {
    id: 'fail_chase',
    title: '🏃 Persecución',
    text: 'Henry corre por los pasillos, pero el uniforme le\nqueda tan grande que tropiesa cada dos pasos.\nFinalmente, se enreda en los cordones y cae\nrodando por una escalera.',
    emoji: '🏃',
    stickmanPose: 'tripping',
    ending: { type: 'fail', text: 'Fin de la huida. Al menos la caída fue espectacular. 8/10 en estilo.' },
  },
  fail_sensor: {
    id: 'fail_sensor',
    title: '🚨 Alarma sísmica',
    text: 'Henry salta, pero cae justo sobre el sensor.\nLa alarma se activa. El zafiro se retrae al techo.\nPuertas blindadas sellan la sala. Henry está\ntotalmente atrapado.',
    emoji: '🔒',
    stickmanPose: 'trapped',
    ending: { type: 'fail', text: '"Al menos no bailó", dice el guardia en el monitor. "Eso habría sido humillante".' },
  },
  fail_buttons: {
    id: 'fail_buttons',
    title: '🎮 Demasiados botones',
    text: 'Hay 47 botones en el panel de control. Henry\nlos prueba todos. La puerta se cierra. Las luces\nse apagan. El suelo se abre. Un brazo robótico\nle quita el zafiro de las manos.',
    emoji: '🤖',
    stickmanPose: 'confused',
    ending: { type: 'fail', text: 'El museo contrata al creador del brazo robótico. Henry: "Habría jurado que era el rojo".' },
  },
  fail_curtain: {
    id: 'fail_curtain',
    title: '🎪 Cortina traicionera',
    text: 'La cortina resulta ser la entrada a un cuarto de\nlimpieza. Henry choca contra una estantería de\nproductos químicos. Un bote de lejía le cae en\nla cabeza.',
    emoji: '🧹',
    stickmanPose: 'covered',
    ending: { type: 'fail', text: 'Cuando los guardias lo encuentran, huele a lejía y está blanco como una nube. Ileso.' },
  },
  fail_radio: {
    id: 'fail_radio',
    title: '📻 Radio accidente',
    text: '"Jefe, aquí Bruce. He... eee... conseguido el\nzafiro. Cambio." El jefe: "¿Bruce? Bruce lleva\naños jubilado. ¿Quién eres?".',
    emoji: '📻',
    stickmanPose: 'facepalm',
    ending: { type: 'fail', text: 'El plan perfecto, arruinado por una conversación de radio. Literalmente.' },
  },
};

/** Lista de ids de escenas "normales" (no finales) para el loop de reintento */
export const SCENE_IDS = Object.keys(SCENES);
