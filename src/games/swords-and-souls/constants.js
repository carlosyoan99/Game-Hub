/**
 * Swords and Souls — Constantes de configuración y balance
 */

export const BASE_HP = 50;
export const HP_PER_LEVEL = 8;

// Escenas del hub
export const SCENES = ['home', 'training', 'arena', 'shop'];

export const SCENE_NAME_KEYS = {
  home: 'swords.sceneHome',
  training: 'swords.sceneTraining',
  arena: 'swords.sceneArena',
  shop: 'swords.sceneShop',
};

export const SCENE_SUBTITLE_KEYS = {
  home: 'swords.sceneSubHome',
  training: 'swords.sceneSubTraining',
  arena: 'swords.sceneSubArena',
  shop: 'swords.sceneSubShop',
};

// Equipo
export const EQUIPMENT = {
  weapons: [
    { id: 'fists', name: 'Puños', cost: 0, strBonus: 0, archBonus: 0, desc: 'Siempre los tienes contigo.' },
    { id: 'sword', name: 'Espada de hierro', cost: 50, strBonus: 3, archBonus: 0, desc: 'Un clásico confiable.' },
    { id: 'bow', name: 'Arco corto', cost: 60, strBonus: 0, archBonus: 4, desc: 'Para ataques a distancia.' },
    { id: 'battleaxe', name: 'Hacha de guerra', cost: 120, strBonus: 6, archBonus: 0, desc: 'Golpea como un martillo.' },
    { id: 'longbow', name: 'Arco largo', cost: 140, strBonus: 0, archBonus: 7, desc: 'Precisión letal.' },
    { id: 'flamberge', name: 'Espada llameante', cost: 300, strBonus: 10, archBonus: 3, desc: 'Leyenda forjada en fuego.' },
    { id: 'voidblade', name: 'Espada del vacío', cost: 500, strBonus: 15, archBonus: 5, desc: 'Artefacto de otro mundo.' },
  ],
  armor: [
    { id: 'rags', name: 'Harapos', cost: 0, defBonus: 0, desc: 'Mejor que nada.' },
    { id: 'leather', name: 'Armadura de cuero', cost: 40, defBonus: 2, desc: 'Ligera y flexible.' },
    { id: 'chainmail', name: 'Cota de malla', cost: 100, defBonus: 5, desc: 'Protección sólida.' },
    { id: 'plate', name: 'Armadura de placas', cost: 250, defBonus: 9, desc: 'Lo mejor en defensa.' },
    { id: 'dragonplate', name: 'Armadura de dragón', cost: 500, defBonus: 15, desc: 'Forjada con escamas de dragón.' },
  ],
  items: [
    { id: 'potion_hp', name: 'Poción de vida', cost: 20, desc: 'Cura 30 HP en combate.' },
    { id: 'potion_big', name: 'Poción de vida +', cost: 50, desc: 'Cura 60 HP en combate.' },
    { id: 'sharpening_stone', name: 'Piedra de afilar', cost: 30, desc: '+2 ATQ permanente.' },
    { id: 'tome', name: 'Tomo antiguo', cost: 80, desc: '+1 a todas las stats.' },
  ],
};

// Enemigos por oleada (12 en total)
export const ENEMIES = [
  { name: 'Slime', emoji: '🟢', hp: 20, str: 3, def: 0, arch: 0, xpReward: 10, goldReward: 5 },
  { name: 'Esqueleto', emoji: '💀', hp: 30, str: 5, def: 2, arch: 2, xpReward: 20, goldReward: 10 },
  { name: 'Lobo', emoji: '🐺', hp: 25, str: 7, def: 1, arch: 0, xpReward: 25, goldReward: 12 },
  { name: 'Goblin', emoji: '👺', hp: 20, str: 4, def: 1, arch: 5, xpReward: 30, goldReward: 15 },
  { name: 'Orco', emoji: '👹', hp: 45, str: 9, def: 4, arch: 0, xpReward: 40, goldReward: 20 },
  { name: 'Nigromante', emoji: '🧙', hp: 35, str: 3, def: 2, arch: 8, xpReward: 50, goldReward: 25 },
  { name: 'Dragón joven', emoji: '🐉', hp: 60, str: 12, def: 5, arch: 6, xpReward: 80, goldReward: 40 },
  { name: 'Caballero oscuro', emoji: '🖤', hp: 55, str: 10, def: 7, arch: 4, xpReward: 100, goldReward: 50 },
  { name: 'Troll', emoji: '🗿', hp: 80, str: 15, def: 8, arch: 1, xpReward: 120, goldReward: 60 },
  { name: 'Demonio', emoji: '👿', hp: 50, str: 11, def: 3, arch: 10, xpReward: 140, goldReward: 70 },
  { name: 'Dragón anciano', emoji: '🐲', hp: 100, str: 18, def: 6, arch: 8, xpReward: 200, goldReward: 100 },
  { name: 'Rey esqueleto', emoji: '👑', hp: 120, str: 14, def: 10, arch: 7, xpReward: 250, goldReward: 120 },
];
