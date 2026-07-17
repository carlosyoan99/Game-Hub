/**
 * Street Fighter — Zangief (El luchador más fuerte)
 *
 * Tanque con el HP más alto, pero el más lento.
 * Especial: Pile Driver (golpe de fuerza bruta)
 * Super: Atomic Buster (golpe devastador)
 */
export const ZANGIEF = {
  id: 'zangief', name: 'Zangief',
  color: '#e74c3c', pantsColor: '#1a1a2a', skinColor: '#d4a574',
  hp: 120, speed: 120, jumpVel: -380,
  attacks: {
    punch: { damage: 8, startup: 5, active: 3, recovery: 6, range: 32, hitstun: 14 },
    kick:  { damage: 11, startup: 7, active: 4, recovery: 8, range: 42, hitstun: 18 },
    special: { damage: 18, startup: 10, active: 5, recovery: 12, range: 30, hitstun: 24, name: 'Pile Driver' },
    super: { damage: 30, startup: 12, active: 8, recovery: 14, range: 35, hitstun: 35, name: 'Atomic Buster' },
  },
  specialKey: '360P',
};
