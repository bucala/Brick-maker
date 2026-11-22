import { rectangle } from './footprint.js';

export const PLATE_HEIGHT = 3.2;

export const categories = {
  classic: {
    title: 'Klasická',
    description: 'Štandardný formát so spojmi zhora a zdola.',
    scale: 1,
    defaultPassage: 'none',
    filenameSuffix: '',
  },
  technical: {
    title: 'Technická',
    description: 'Priechodné otvory pre kolíky alebo osky. Nastavujú sa v Prepojeniach.',
    scale: 1,
    defaultPassage: 'pin',
    filenameSuffix: '-technicka',
  },
  children: {
    title: 'Detská',
    description: 'Zväčšený formát s hornými a spodnými spojmi.',
    scale: 2,
    defaultPassage: null,
    filenameSuffix: '-detska',
  },
};

export const defaults = {
  category: 'classic',
  cells: rectangle(4, 2),
  disabled: [],
  plates: 3,
  top: 'solid',
  mode: 'reference',
  nozzle: 0.4,
  clutch: 0,
  bridging: false,
  technic: 'none',
  axis: 'auto',
  snot: 'none',
  side: 'south',
  slope: 'flat',
};

export function getCategory(id) {
  return Object.hasOwn(categories, id) ? categories[id] : categories[defaults.category];
}

export function allowsExtraConnections(params) {
  return getCategory(params.category).defaultPassage !== null && params.plates >= 3 && params.slope === 'flat';
}
