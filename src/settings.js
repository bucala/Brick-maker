import { rectangle } from './footprint.js';

export const defaults = {
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
