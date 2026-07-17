/**
 * Street Fighter — Ken (El luchador agresivo)
 *
 * Similar a Ryu pero más rápido, con menos HP.
 * Especial: Tatsumaki (torbellino)
 * Super: Shoryuken (golpe ascendente)
 */
export const KEN = {
  id: 'ken', name: 'Ken',
  color: '#e74c3c', pantsColor: '#e7edf3', skinColor: '#d4a574',
  hp: 95, speed: 190, jumpVel: -430,
  attacks: {
    punch: { damage: 5, startup: 2, active: 2, recovery: 4, range: 38, hitstun: 11 },
    kick:  { damage: 8, startup: 4, active: 3, recovery: 5, range: 48, hitstun: 15 },
    special: { damage: 12, startup: 6, active: 3, recovery: 8, range: 65, hitstun: 18, name: 'Tatsumaki' },
    super: { damage: 22, startup: 8, active: 5, recovery: 10, range: 75, hitstun: 28, name: 'Shoryuken' },
  },
  specialKey: '623P',
};
