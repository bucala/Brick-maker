import { draw, drawCircle, makeBox, makeCompound, makeCylinder } from 'replicad';
import { PITCH, bounds, connections, key, outline, inset, technicRuns } from './footprint.js';
import { PLATE_HEIGHT, allowsExtraConnections, getCategory } from './settings.js';

const CLEARANCE = 0.1;
const WALL = 1.2;
const ROOF = 1.2;
const STUD_RADIUS = 2.4;
const STUD_HEIGHT = 1.8;
const TUBE_RADIUS = (Math.SQRT2 * PITCH - 2 * STUD_RADIUS) / 2;
const JOIN = 0.08;
const HOLE_Z = 5.8;

function polygon(points) {
  const pen = draw(points[0]);
  for (const point of points.slice(1)) pen.lineTo(point);
  return pen.close();
}

function prism(drawing, z, height) {
  return drawing.sketchOnPlane('XY', z).extrude(height);
}

function profile(loops, amount, width, depth) {
  let drawing = null;
  // A containing loop always has a larger absolute area than its children.
  for (const loop of loops) {
    const boundary = polygon(inset(loop, amount, width, depth));
    drawing = loop.area > 0 ? (drawing?.fuse(boundary) ?? boundary) : drawing.cut(boundary);
  }
  return drawing;
}

function combine(shapes) {
  return shapes.length === 1 ? shapes[0] : makeCompound(shapes);
}

function apply(shape, operation, tools) {
  return tools.length ? shape[operation](combine(tools)) : shape;
}

function taper(x, y, z1, r1, z2, r2) {
  const base = drawCircle(r1).translate(x, y).sketchOnPlane('XY', z1);
  const cap = drawCircle(r2).translate(x, y).sketchOnPlane('XY', z2);
  return base.loftWith(cap, { ruled: true });
}

function stud(x, y, z, radius, quality, rotation = 0, axis = [0, 1, 0]) {
  let shape = makeCylinder(radius, STUD_HEIGHT + JOIN, [0, 0, -JOIN]);
  if (quality) shape = shape.chamfer(0.2, edge => edge.inPlane('XY', STUD_HEIGHT));
  if (rotation) shape = shape.rotate(rotation, [0, 0, 0], axis);
  return shape.translate(x, y, z);
}

function slopedCutter(width, depth, height, degrees, reverse) {
  const left = -width * PITCH / 2 + CLEARANCE;
  const right = -left;
  const grade = (reverse ? 1 : -1) * Math.tan(degrees * Math.PI / 180);
  const ridge = reverse ? right : left;
  const bottom = 2.8;
  const knee = ridge + (bottom - height) / grade;
  const plane = x => height + (x - ridge) * grade;
  const topAt = x => Math.max(bottom, plane(x));
  const a = left - 2;
  const b = right + 2;
  const profile = [[a, topAt(a)]];
  if (knee > a && knee < b) profile.push([knee, bottom]);
  profile.push([b, topAt(b)], [b, height + 5], [a, height + 5]);
  const vertical = polygon(profile).sketchOnPlane('XZ', -depth * PITCH / 2 - 2).extrude(depth * PITCH + 4);
  return { vertical, grade, knee, topAt, gradeAt: x => plane(x) > bottom ? grade : 0 };
}

function ribsFor(x, y, z, inside, radius, flags) {
  const half = 0.4;
  const reach = PITCH - CLEARANCE - WALL + JOIN;
  const start = inside + JOIN;
  if (radius <= start) return [];
  const ends = [
    [[x - reach, y - half, 0], [x - start, y + half, z]],
    [[x + start, y - half, 0], [x + reach, y + half, z]],
    [[x - half, y - reach, 0], [x + half, y - start, z]],
    [[x - half, y + start, 0], [x + half, y + reach, z]],
  ];
  return ends.flatMap(([a, b], i) => flags[i] ? [makeBox(a, b)] : []);
}

function addTechnic(shape, cells, width, depth, kind, requestedAxis, diameter) {
  const { axis, runs } = technicRuns(cells, requestedAxis);
  const alongX = axis === 'x';
  const direction = alongX ? [1, 0, 0] : [0, 1, 0];
  const across = a => (a - (alongX ? depth : width) / 2) * PITCH;
  const along = a => (a - (alongX ? width : depth) / 2) * PITCH;
  const point = (a, b, z = HOLE_Z) => alongX ? [b, a, z] : [a, b, z];
  const bosses = [];
  const cutters = [];
  for (const run of runs) {
    const pos = across(run.seam);
    const start = along(run.start) + CLEARANCE;
    const stop = along(run.end) - CLEARANCE;
    const length = stop - start;
    bosses.push(makeCylinder(3.5, length, point(pos, start), direction));
    const origin = point(pos, start - JOIN);
    const bore = makeCylinder(diameter / 2, length + 2 * JOIN, origin, direction);
    if (kind === 'axle') {
      const aMin = -diameter / 2 - JOIN;
      const aMax = -aMin;
      const half = 0.9 + (diameter - 4.8) / 2;
      const low = start - 2 * JOIN;
      const high = stop + 2 * JOIN;
      const box = (u, v, w, t) => makeBox(point(pos + u, low, HOLE_Z + v), point(pos + w, high, HOLE_Z + t));
      cutters.push(bore.intersect(box(aMin, -half, aMax, half).fuse(box(-half, aMin, half, aMax))));
    } else {
      const near = makeCylinder(3.05, 0.8 + JOIN, origin, direction);
      const far = makeCylinder(3.05, 0.8 + JOIN, point(pos, stop - 0.8), direction);
      cutters.push(bore.fuse(near).fuse(far));
    }
  }
  return apply(apply(shape, 'fuse', bosses), 'cut', cutters);
}

export function makeBrick(params, detailed = true) {
  const { scale, defaultPassage } = getCategory(params.category);
  const {
    cells, disabled, plates, top, mode, nozzle, clutch: clutchMm, bridging,
    technic = defaultPassage, axis, snot, side, slope,
  } = params;
  if (!cells.length) throw new Error('Do pôdorysu pridaj aspoň jednu bunku.');
  const { x: minX, y: minY, width, depth } = bounds(cells);
  const local = cells.map(([x, y]) => [x - minX, y - minY]);
  const occupied = new Set(local.map(cell => key(...cell)));
  const loops = outline(local).sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  const height = plates * PLATE_HEIGHT;
  const ceiling = height - ROOF + JOIN;
  const fdm = mode === 'fdm';
  // Apply printer adjustments in millimeters of the finished part.
  const clutch = clutchMm / scale;
  const compensation = fdm ? { 0.2: 0.15, 0.4: 0.2, 0.6: 0.25 }[nozzle] / scale : 0;
  const tubeInside = (4.8 + compensation - clutch) / 2;
  const radius = STUD_RADIUS + clutch / 2;
  const px = x => (x - width / 2) * PITCH;
  const py = y => (y - depth / 2) * PITCH;

  const outer = profile(loops, CLEARANCE, width, depth);
  const inner = profile(loops, CLEARANCE + WALL, width, depth);
  let shell = prism(outer, 0, height);
  if (detailed && fdm) shell = shell.chamfer(0.3 / scale, edge => edge.inPlane('XY', 0));
  let topAt = () => height;
  let slopeCutter;
  let cavity = prism(inner, -JOIN, height - ROOF + JOIN);
  if (slope !== 'flat') {
    const degrees = slope === '33' ? 33 : 45;
    slopeCutter = slopedCutter(width, depth, height, degrees, slope === 'reverse');
    cavity = cavity.cut(slopeCutter.vertical.clone().translateZ(-ROOF * Math.hypot(1, slopeCutter.grade)));
    topAt = slopeCutter.topAt;
  }
  shell = shell.cut(cavity);

  const { tubes, pins } = connections(local);
  const supports = [];
  const cutTubes = [];
  const tubeRadius = TUBE_RADIUS + clutch / 2;
  for (const { x, y, ribs } of tubes) {
    supports.push(makeCylinder(tubeRadius, ceiling, [px(x), py(y), 0]));
    if (bridging && fdm && detailed && !slopeCutter) {
      const rise = Math.min(0.6 / scale, Math.max(0.35 / scale, height - ROOF - STUD_HEIGHT));
      const cone = taper(px(x), py(y), ceiling - rise, tubeRadius - JOIN, ceiling, tubeRadius + rise - JOIN);
      // A haunch may merge with the walls but stays inside the outer envelope.
      supports[supports.length - 1] = supports.at(-1).fuse(cone.intersect(prism(outer, -JOIN, height + JOIN)));
    }
    cutTubes.push(makeCylinder(tubeInside, ceiling, [px(x), py(y), -JOIN]));
    if (detailed) {
      const ribsToAdd = ribsFor(px(x), py(y), ceiling, tubeInside, tubeRadius, ribs);
      for (const rib of ribsToAdd) supports[supports.length - 1] = supports.at(-1).fuse(rib);
    }
  }
  for (const [x, y] of pins) supports.push(makeCylinder(1.6 + clutch / 2, ceiling, [px(x), py(y), 0]));
  // Merge each support before combining tools so their shared edges are resolved.
  shell = apply(shell, 'fuse', supports);
  shell = apply(shell, 'cut', cutTubes);

  if (slopeCutter) shell = shell.cut(slopeCutter.vertical);

  const extraConnections = allowsExtraConnections(params);
  if (extraConnections && technic !== 'none') {
    shell = addTechnic(shell, local, width, depth, technic, axis, 4.8 + compensation - clutch);
  }

  if (extraConnections && snot !== 'none') {
    const [dx, dy] = { west: [-1, 0], east: [1, 0], south: [0, -1], north: [0, 1] }[side];
    const direction = [dx, dy, 0];
    const rotationAxis = [-dy, dx, 0];
    const z = HOLE_Z - 1.6;
    const bosses = [];
    const cuts = [];
    for (const [x, y] of local) {
      if (occupied.has(key(x + dx, y + dy))) continue;
      const center = [px(x + 0.5) + dx * (4 - CLEARANCE), py(y + 0.5) + dy * (4 - CLEARANCE), z];
      if (snot === 'stud') bosses.push(stud(...center, radius, detailed, 90, rotationAxis));
      else {
        const position = distance => [center[0] + dx * distance, center[1] + dy * distance, z];
        bosses.push(makeCylinder(3.15, 2.5, position(-2.5), direction));
        cuts.push(makeCylinder((4.8 + compensation - clutch) / 2, 1.85 + JOIN, position(-1.85), direction));
      }
    }
    shell = apply(apply(shell, 'fuse', bosses), 'cut', cuts);
  }

  if (top !== 'tile') {
    const excluded = new Set(disabled);
    const studs = [];
    const bores = [];
    for (const [x, y] of local) {
      if (excluded.has(key(x + minX, y + minY))) continue;
      const cx = px(x + 0.5);
      const cy = py(y + 0.5);
      // A stud at the break would straddle two mating planes.
      if (slopeCutter && Math.abs(cx - slopeCutter.knee) <= radius + JOIN) continue;
      const gradient = slopeCutter?.gradeAt(cx) ?? 0;
      const angle = -Math.atan(gradient) * 180 / Math.PI;
      const normal = [-gradient / Math.hypot(1, gradient), 0, 1 / Math.hypot(1, gradient)];
      const z = topAt(cx);
      studs.push(stud(cx, cy, z, radius, detailed, angle));
      if (top === 'hollow') bores.push(makeCylinder((3.2 + compensation) / 2, STUD_HEIGHT + JOIN, [cx, cy, z], normal));
    }
    shell = apply(apply(shell, 'fuse', studs), 'cut', bores);
  }
  return scale === 1 ? shell : shell.scale(scale);
}
