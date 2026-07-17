/**
 * Street Fighter — Ryu (El luchador equilibrado)
 *
 * Personaje versátil con buen equilibrio entre velocidad y daño.
 * Especial: Hadouken (proyectil)
 */
export const RYU = {
  id: 'ryu', name: 'Ryu',
  color: '#e7edf3', pantsColor: '#e7edf3', skinColor: '#d4a574',
  hp: 100, speed: 180, jumpVel: -420,
  attacks: {
    punch: { damage: 6, startup: 3, active: 2, recovery: 4, range: 40, hitstun: 12 },
    kick:  { damage: 9, startup: 5, active: 3, recovery: 6, range: 50, hitstun: 16 },
    special: { damage: 14, startup: 8, active: 4, recovery: 10, range: 70, hitstun: 20, name: 'Hadouken' },
    super: { damage: 25, startup: 10, active: 6, recovery: 12, range: 80, hitstun: 30, name: 'Shinku Hadouken' },
  },
  specialKey: '236P',
};
