import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { strFromU8, unzipSync } from 'fflate';
import { importSTEP, makeBox, measureShapeVolumeProperties, setOC } from 'replicad';
import init from 'replicad-opencascadejs';
import { to3MF } from '../src/export.js';
import { bounds, connections, outline, rectangle, technicRuns } from '../src/footprint.js';
import { makeBrick } from '../src/model.js';
import { defaults } from '../src/settings.js';

const oc = await init({ wasmBinary: await readFile(new URL(import.meta.resolve('replicad-opencascadejs/wasm'))) });
setOC(oc);
const fine = { tolerance: 0.025, angularTolerance: 0.18 };
const frame = rectangle(3, 3).filter(([x, y]) => x !== 1 || y !== 1);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} vs ${expected}`);

function dimensions(shape) {
  const box = shape.boundingBox;
  const [min, max] = box.bounds;
  box.delete();
  return max.map((value, i) => value - min[i]);
}

function validate(shape) {
  const analyzer = new oc.BRepCheck_Analyzer(shape.wrapped);
  try {
    assert.ok(analyzer.IsValid(), 'Open CASCADE topology check');
  } finally {
    analyzer.delete();
  }
}

function hasMaterial(shape, point) {
  const probe = makeBox(point.map(value => value - 0.01), point.map(value => value + 0.01));
  const intersection = shape.intersect(probe);
  const properties = measureShapeVolumeProperties(intersection);
  try {
    return properties.volume > 0.000004;
  } finally {
    properties.delete();
    intersection.delete();
    probe.delete();
  }
}

test('outlines cover all 3 × 3 footprints, including diagonal contacts', () => {
  const grid = rectangle(3, 3);
  for (let mask = 1; mask < 2 ** grid.length; mask++) {
    const cells = grid.filter((_, index) => mask & (1 << index));
    assert.equal(outline(cells).reduce((area, loop) => area + loop.area, 0), cells.length);
  }
  assert.deepEqual(outline(frame).map(loop => loop.area).sort(), [-1, 9]);
});

test('tube, pin and automatic Technic positions follow the footprint', () => {
  assert.equal(connections(rectangle(4, 2)).tubes.length, 3);
  assert.equal(connections(rectangle(4, 2)).pins.length, 0);
  assert.equal(connections(rectangle(1, 4)).pins.length, 3);
  assert.equal(technicRuns(rectangle(1, 4)).axis, 'x');
  assert.equal(technicRuns(rectangle(1, 4)).runs.length, 3);
  assert.equal(technicRuns([[0, 0]]).runs.length, 0);
});

const samples = [
  ['reference brick', {}, [31.8, 15.8, 11.4]],
  ['reference plate with studs', { plates: 1 }, [31.8, 15.8, 5]],
  ['technical brick with default round passages', { category: 'technical', technic: undefined }, [31.8, 15.8, 11.4]],
  ['five-module rounded beam', { category: 'technical', technicalShape: 'beam', cells: [], beamLength: 5, technic: 'pin' }, [39.4, 7.4, 8]],
  ['single-module axle beam for FDM', { category: 'technical', technicalShape: 'beam', beamLength: 1, technic: 'axle', mode: 'fdm' }, [7.4, 7.4, 8]],
  ['large brick with hollow FDM studs and connector adjustments', {
    category: 'children', mode: 'fdm', nozzle: 0.6, clutch: 0.15, bridging: true,
    top: 'hollow', technic: 'pin', snot: 'stud', side: 'west',
  }, [63.68, 31.68, 23.6]],
  ['tile plate', { top: 'tile', plates: 1, cells: rectangle(1, 4) }, [7.8, 31.8, 3.2]],
  ['hollow FDM with tube haunches and pin passages', { mode: 'fdm', top: 'hollow', bridging: true, technic: 'pin', clutch: 0.15 }, [31.8, 15.8, 11.4]],
  ['cross axle passages with SNOT recesses', { technic: 'axle', snot: 'recess' }, [31.8, 15.8, 11.4]],
  ['side studs', { snot: 'stud', side: 'west' }, [33.6, 15.8, 11.4]],
  ['pitch 45° including low terrace', { slope: '45', top: 'tile' }, [31.8, 15.8, 9.6]],
  ['hollow grid with bottom chamfer', { cells: frame, mode: 'fdm', top: 'hollow' }, [23.8, 23.8, 11.4]],
  ['concave and diagonal disconnected footprint', { cells: [[0, 0], [1, 0], [2, 0], [2, 1], [3, 2]], mode: 'fdm' }, [31.8, 23.8, 11.4]],
];

for (const [name, options, expected] of samples) {
  test(`valid B-Rep and measured dimensions for ${name}`, () => {
    const shape = makeBrick({ ...defaults, ...options });
    try {
      validate(shape);
      dimensions(shape).forEach((value, i) => close(value, expected[i]));
      if (options.slope) {
        const normals = shape.mesh(fine).normals;
        assert.ok(normals.some((value, i) => i % 3 === 0
          && Math.abs(value - Math.SQRT1_2) < 1e-5
          && Math.abs(normals[i + 2] - Math.SQRT1_2) < 1e-5), '45° roof normal');
      }
    } finally {
      shape.delete();
    }
  });
}

test('classic brick has an underside stud relief, a raised center web and wall ribs', () => {
  const shape = makeBrick(defaults);
  try {
    const [width, depth] = dimensions(shape);
    close(32 - width, 0.2);
    close(16 - depth, 0.2);
    assert.equal(hasMaterial(shape, [12, 4, 10.1]), false);
    assert.equal(hasMaterial(shape, [12, 4, 10.65]), true);
    assert.equal(hasMaterial(shape, [0, 5.5, 1.5]), false);
    assert.equal(hasMaterial(shape, [0, 5.5, 3]), true);
    assert.equal(hasMaterial(shape, [14.6, 0, 2]), false);
    assert.equal(hasMaterial(shape, [14.6, 4, 2]), true);
  } finally {
    shape.delete();
  }
});

test('small footprints use a cavity, a solid post, or a hollow tube by layout', () => {
  const single = makeBrick({ ...defaults, cells: rectangle(1, 1) });
  const pair = makeBrick({ ...defaults, cells: rectangle(2, 1) });
  const square = makeBrick({ ...defaults, cells: rectangle(2, 2) });
  try {
    for (const shape of [single, pair, square]) validate(shape);
    dimensions(single).forEach((value, i) => close(value, [7.8, 7.8, 11.4][i]));
    dimensions(pair).forEach((value, i) => close(value, [15.8, 7.8, 11.4][i]));
    dimensions(square).forEach((value, i) => close(value, [15.8, 15.8, 11.4][i]));
    assert.equal(hasMaterial(single, [0, 0, 1]), false);
    assert.equal(hasMaterial(pair, [0, 0, 1]), true);
    assert.equal(hasMaterial(pair, [1.7, 0, 1]), false);
    assert.equal(hasMaterial(square, [0, 0, 1]), false);
    assert.equal(hasMaterial(square, [3, 0, 1]), true);
  } finally {
    single.delete();
    pair.delete();
    square.delete();
  }
});

test('large brick has recessed underside tubes and two distinct stud sockets', () => {
  const options = { ...defaults, category: 'children', cells: rectangle(2, 2) };
  const measured = makeBrick({ ...options, top: undefined });
  const enlargedSocket = makeBrick({ ...options, top: 'hollow-classic' });
  const classic = makeBrick({ ...defaults, cells: rectangle(2, 2) }).translate([8, 8, 19.2]);
  const intersection = enlargedSocket.intersect(classic);
  const properties = measureShapeVolumeProperties(intersection);
  const classicBase = makeBrick({ ...defaults, cells: rectangle(4, 4) }).translateZ(-9.6);
  const lowerIntersection = enlargedSocket.intersect(classicBase);
  const lowerProperties = measureShapeVolumeProperties(lowerIntersection);
  try {
    validate(measured);
    validate(enlargedSocket);
    assert.equal(hasMaterial(measured, [6.05, 0, 0.8]), false);
    assert.equal(hasMaterial(measured, [6.05, 0, 2]), true);
    assert.equal(hasMaterial(measured, [5.1, 0, 2]), false);
    assert.equal(hasMaterial(measured, [11.1, 8, 20.8]), true);
    assert.equal(hasMaterial(enlargedSocket, [11.1, 8, 20.8]), false);
    close(properties.volume, 0);
    assert.equal(hasMaterial(measured, [4, 4, 1.7]), true);
    assert.equal(hasMaterial(enlargedSocket, [4, 4, 1.7]), false);
    close(lowerProperties.volume, 0);
  } finally {
    lowerProperties.delete();
    lowerIntersection.delete();
    classicBase.delete();
    properties.delete();
    intersection.delete();
    classic.delete();
    measured.delete();
    enlargedSocket.delete();
  }
});

test('beam holes have material between them and counterbores on both faces', () => {
  const shape = makeBrick({ ...defaults, category: 'technical', technicalShape: 'beam', beamLength: 5, technic: 'pin' });
  try {
    for (const x of [-16, -8, 0, 8, 16]) assert.equal(hasMaterial(shape, [x, 0, 4]), false);
    assert.equal(hasMaterial(shape, [4, 0, 4]), true);
    assert.equal(hasMaterial(shape, [0, 2.55, 4]), true);
    assert.equal(hasMaterial(shape, [0, 3, 0.7]), false);
    assert.equal(hasMaterial(shape, [0, 3, 7.3]), false);
    assert.equal(hasMaterial(shape, [0, 3, 1.1]), true);
  } finally {
    shape.delete();
  }
});

test('underside tube cutters never punch through a sloped roof or its low terrace', () => {
  for (const [slope, top, x, z] of [['33', 'tile', -8, 4.25], ['45', 'hollow', -8, 2.6], ['reverse', 'tile', 8, 2.6]]) {
    const shape = makeBrick({ ...defaults, slope, top });
    try {
      validate(shape);
      assert.equal(hasMaterial(shape, [x, 0, z]), true, `${slope} roof above tube`);
      assert.equal(hasMaterial(shape, [x, 0, 0.4]), false, `${slope} tube remains open below`);
    } finally {
      shape.delete();
    }
  }
});

test('binary STL, round-trip STEP and closed directed 3MF mesh', async () => {
  const shape = makeBrick(defaults);
  try {
    const stl = new DataView(await shape.blobSTL({ ...fine, binary: true }).arrayBuffer());
    const count = stl.getUint32(80, true);
    assert.ok(count > 100);
    assert.equal(stl.byteLength, 84 + 50 * count);

    const imported = await importSTEP(shape.blobSTEP());
    try {
      validate(imported);
      const expected = dimensions(shape);
      dimensions(imported).forEach((value, i) => close(value, expected[i]));
    } finally {
      imported.delete();
    }

    const archive = unzipSync(new Uint8Array(await to3MF(shape.mesh(fine)).arrayBuffer()));
    assert.ok(archive['_rels/.rels']);
    assert.ok(archive['[Content_Types].xml']);
    const xml = strFromU8(archive['3D/3dmodel.model']);
    assert.match(xml, /unit="millimeter"/);
    const edges = new Map();
    const triangles = [...xml.matchAll(/<triangle v1="(\d+)" v2="(\d+)" v3="(\d+)"\/>/g)];
    assert.ok(triangles.length > 100);
    for (const [, a, b, c] of triangles) {
      for (const [start, end] of [[a, b], [b, c], [c, a]]) {
        const ordered = start < end;
        const edge = ordered ? `${start},${end}` : `${end},${start}`;
        const [forward, backward] = edges.get(edge) ?? [0, 0];
        edges.set(edge, ordered ? [forward + 1, backward] : [forward, backward + 1]);
      }
    }
    for (const visits of edges.values()) assert.deepEqual(visits, [1, 1]);
    assert.deepEqual(bounds(defaults.cells), { x: 0, y: 0, width: 4, depth: 2 });
  } finally {
    shape.delete();
  }
});
