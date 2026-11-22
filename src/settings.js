import { PITCH, rectangle } from './footprint.js';

const classicGeometry = {
  pitch: PITCH, plateHeight: 3.2, edgeGap: 0.1, wall: 1.2, roof: 1,
  studDiameter: 4.8, studHeight: 1.8, hollowStudDiameter: 3.2,
  studReliefDiameter: 2.6, studReliefDepth: 1.7,
  tubeBore: 4.8, tubeRecess: 0, pinDiameter: 3.2,
  ribWidth: 0.6, ribReach: 0.2, ribRecess: 0, slopeFloor: 2.8,
};

const childrenGeometry = {
  pitch: 16, plateHeight: 6.4, edgeGap: 0.16, wall: 1.52, roof: 1.6,
  studDiameter: 9.38, studHeight: 4.4, hollowStudDiameter: 5.8,
  classicSocketDiameter: 6.6,
  tubeBore: 10.69, tubeRecess: 1.6, pinDiameter: 0,
  ribWidth: 1.2, ribReach: 1.6, ribRecess: 0.4, slopeFloor: 5.6,
};

export const beamGeometry = { pitch: PITCH, width: 7.4, thickness: 8, counterboreDepth: 0.9 };

export const categories = {
  classic: {
    title: 'Klasická',
    description: 'Štandardný formát so spojmi zhora a zdola.',
    geometry: classicGeometry,
    defaultTop: 'solid',
    defaultPassage: 'none',
    filenameSuffix: '',
  },
  technical: {
    title: 'Technická',
    description: 'Zaoblený nosník alebo kocka s priechodnými otvormi.',
    geometry: classicGeometry,
    defaultTop: 'solid',
    defaultPassage: 'pin',
    filenameSuffix: '-technicka',
  },
  children: {
    title: 'Detská',
    description: 'Duté study, zapustené rúrky a vnútorné rebrá na uchytenie.',
    geometry: childrenGeometry,
    defaultTop: 'hollow',
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

export function isBeam(params) {
  return params.category === 'technical' && params.technicalShape === 'beam';
}

export function getCategory(id) {
  return Object.hasOwn(categories, id) ? categories[id] : categories[defaults.category];
}

export function allowsExtraConnections(params) {
  return !isBeam(params) && getCategory(params.category).defaultPassage !== null && params.plates >= 3 && params.slope === 'flat';
}
