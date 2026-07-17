/**
 * Street Fighter — M. Bison (El dictador)
 *
 * Jefe final con ataques poderosos y buena velocidad.
 * Especial: Psycho Crusher (carga psíquica)
 * Super: Knee Press Nightmare (combo aéreo)
 */
export const BISON = {
  id: 'bison', name: 'M. Bison',
  color: '#8b2a8b', pantsColor: '#e74c3c', skinColor: '#c48c5c',
  hp: 110, speed: 190, jumpVel: -420,
  attacks: {
    punch: { damage: 7, startup: 3, active: 3, recovery: 5, range: 40, hitstun: 13 },
    kick:  { damage: 10, startup: 5, active: 4, recovery: 6, range: 50, hitstun: 17 },
    special: { damage: 16, startup: 6, active: 6, recovery: 10, range: 75, hitstun: 22, name: 'Psycho Crusher' },
    super: { damage: 28, startup: 10, active: 8, recovery: 12, range: 85, hitstun: 32, name: 'Knee Press Nightmare' },
  },
  specialKey: '236K',
};
