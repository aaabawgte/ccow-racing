// Vozači su kolege iz dućana. Rang prati poziciju u dućanu; lik ne mijenja fiziku auta.
// look opisuje portret (vidi portrait.js).

export const RARITIES = {
  common: { name: 'Common', role: 'Prodajni savjetnik', color: '#8f98a3', price: 5000 },
  rare: { name: 'Rare', role: 'Senior prodajni savjetnik', color: '#3b82d6', price: 20000 },
  epic: { name: 'Epic', role: 'Zamjenik voditelja', color: '#9b4fd8', price: 60000 },
  legendary: { name: 'Legendary', role: 'Voditelj', color: '#e8a317', price: 200000 },
  special: { name: 'Special', role: 'Promotor', color: '#e0457b', price: 40000 },
};

const SKIN = '#f1c7a5';
const SKIN_WARM = '#e8b58f';

export const CHARACTERS = [
  {
    id: 'josip', name: 'Josip Davidović', rarity: 'common', car: 'cruze', carColor: '#f2f2ef',
    look: { skin: SKIN, hair: 'buzz', hairColor: '#3b2a1e', build: 'big', height: 'tall', shirt: '#2f4f73' },
  },
  {
    id: 'bruno', name: 'Bruno Ježek', rarity: 'common', car: 'p208', carColor: '#9a9ea3',
    look: { skin: SKIN, hair: 'curly', hairColor: '#5a3b24', build: 'normal', eyes: 'narrow', shirt: '#3a6b4f' },
  },
  {
    id: 'filip', name: 'Filip Lalić', rarity: 'common', car: 'mazda3', carColor: '#2c5aa0',
    look: { skin: SKIN_WARM, hair: 'receding', hairColor: '#1b1b1d', build: 'fat', height: 'short', glasses: 'square', shirt: '#7a3b3b' },
  },
  {
    id: 'tin', name: 'Tin Pantić', rarity: 'common', car: 'octavia', carColor: '#2f4f86',
    look: { skin: SKIN, hair: 'sidepart', hairColor: '#c9a35a', build: 'thin', shirt: '#46557a' },
  },
  {
    id: 'lucija', name: 'Lucija Kučkovečki', rarity: 'common', car: 'multipla', carColor: '#f29bc1',
    look: { skin: SKIN, hair: 'ponytail', hairColor: '#5b3a24', build: 'fit', height: 'tall', female: true, shirt: '#b04f7a' },
  },
  {
    id: 'lorena', name: 'Lorena Laco', rarity: 'common', car: 'a4', carColor: '#9aa0a6',
    look: { skin: SKIN, hair: 'long', hairColor: '#e3c27a', build: 'muscle', height: 'tall', female: true, shirt: '#2c2f36' },
  },
  {
    id: 'jure', name: 'Jure Papa', rarity: 'common', car: 'corsa', carColor: '#3566b0',
    look: { skin: SKIN, hair: 'short', hairColor: '#c8a560', beard: 'goatee', build: 'thin', shirt: '#5a6b3a' },
  },
  {
    id: 'ivan', name: 'Ivan Bandur', rarity: 'rare', car: 'jaguar', carColor: '#111214',
    look: { skin: SKIN_WARM, hair: 'baldTop', hairColor: '#2a1d16', build: 'thin', height: 'tall', eyes: 'sleepy', flush: true, mouth: 'tipsy', shirt: '#3d3f46' },
  },
  {
    id: 'jasminka', name: 'Jasminka Čalić', rarity: 'rare', car: 'e36', carColor: '#b3161c',
    look: { skin: SKIN, hair: 'bob', hairColor: '#b5622e', build: 'sturdy', glasses: 'round', female: true, shirt: '#6a4b8a' },
  },
  {
    id: 'hrvoje', name: 'Hrvoje Vučković', rarity: 'epic', car: 'twingors', carColor: '#f5c400',
    look: { skin: SKIN, hair: 'gelled', hairColor: '#141416', build: 'fat', height: 'tall', shirt: '#1f3b5c' },
  },
  {
    id: 'luka', name: 'Luka Tomašević', rarity: 'epic', car: 'meganers', carColor: '#f4f4f2',
    look: { skin: SKIN, hair: 'buzz', hairColor: '#3a2a1f', build: 'thin', tattoos: true, mouth: 'goofy', eyes: 'wide', shirt: '#f0f0f0', sleeveless: true },
  },
  {
    id: 'marko', name: 'Marko Haman', rarity: 'legendary', car: 'vitara', carColor: '#141516',
    look: { skin: SKIN, hair: 'buzz', hairColor: '#231a14', build: 'normal', shirt: '#121214', mouth: 'smirk', allBlack: true },
  },
  {
    id: 'antonio', name: 'Antonio Brkić', rarity: 'special', dept: 'Kuhinje', car: null,
    look: { skin: SKIN_WARM, hair: 'buzz', hairColor: '#121214', build: 'normal', tattoos: true, shirt: '#7a5a3a', sleeveless: true },
  },
  {
    id: 'tamara', name: 'Tamara Šmasung', rarity: 'special', dept: 'Samsung', car: null,
    look: { skin: SKIN, hair: 'ponytail', hairColor: '#141416', build: 'normal', height: 'short', chubbyFace: true, female: true, brow: 'raised', mouth: 'odd', shirt: '#1428a0' },
  },
  {
    id: 'kiki', name: 'Kiki Panel', rarity: 'special', dept: 'Sony', car: null,
    look: { skin: SKIN, hair: 'sidepartGel', hairColor: '#121214', build: 'thin', height: 'tall', shirt: '#101010' },
  },
  {
    id: 'hrc', name: 'Hrc Higijena', rarity: 'special', dept: 'Philips', car: null,
    look: { skin: SKIN, hair: 'buzz', hairColor: '#241b15', build: 'normal', height: 'short', shirt: '#0b5ed7' },
  },
  {
    id: 'jan', name: 'Jan Jazavčina', rarity: 'special', dept: 'Samsung TV', car: null,
    look: { skin: SKIN, hair: 'bowl', hairColor: '#141416', build: 'skinny', gaunt: true, shirt: '#1428a0' },
  },
];

export function characterById(id) {
  return CHARACTERS.find((c) => c.id === id);
}
