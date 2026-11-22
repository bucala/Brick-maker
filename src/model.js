import { draw, drawCircle, makeBox, makeCompound, makeCylinder } from 'replicad';
import { GRID, PITCH, bounds, connections, key, outline, inset, technicRuns } from './footprint.js';
import { allowsExtraConnections, beamGeometry, getCategory, isBeam } from './settings.js';

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

function profile(loops, amount, width, depth, pitch) {
  let drawing = null;
  // A containing loop always has a larger absolute area than its children.
  for (const loop of loops) {
    const boundary = polygon(inset(loop, amount, width, depth, pitch));
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

function stud(x, y, z, radius, height, detailed, rotation = 0, axis = [0, 1, 0]) {
  let shape = makeCylinder(radius, height + JOIN, [0, 0, -JOIN]);
  if (detailed) shape = shape.chamfer(0.2, edge => edge.inPlane('XY', height));
  if (rotation) shape = shape.rotate(rotation, [0, 0, 0], axis);
  return shape.translate(x, y, z);
}

function slopedCutter(width, depth, height, degrees, reverse, { pitch, edgeGap, slopeFloor: bottom }) {
  const left = -width * pitch / 2 + edgeGap;
  const right = -left;
  const grade = (reverse ? 1 : -1) * Math.tan(degrees * Math.PI / 180);
  const ridge = reverse ? right : left;
  const knee = ridge + (bottom - height) / grade;
  const plane = x => height + (x - ridge) * grade;
  const topAt = x => Math.max(bottom, plane(x));
  const a = left - 2;
  const b = right + 2;
  const profile = [[a, topAt(a)]];
  if (knee > a && knee < b) profile.push([knee, bottom]);
  profile.push([b, topAt(b)], [b, height + 5], [a, height + 5]);
  const vertical = polygon(profile).sketchOnPlane('XZ', -depth * pitch / 2 - 2).extrude(depth * pitch + 4);
  return { vertical, grade, knee, topAt, gradeAt: x => plane(x) > bottom ? grade : 0 };
}

const wallDirections = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function wallRibs(cells, occupied, px, py, ceiling, geometry, clutch) {
  const { pitch, edgeGap, wall, ribWidth, ribReach, ribRecess } = geometry;
  const innerWall = pitch / 2 - edgeGap - wall;
  const reach = ribReach + clutch / 2;
  const halfWidth = ribWidth / 2;
  return cells.flatMap(([x, y]) => wallDirections.flatMap(([dx, dy]) => {
    if (occupied.has(key(x + dx, y + dy))) return [];
    const cx = px(x + 0.5);
    const cy = py(y + 0.5);
    const a = [cx + dx * (innerWall - reach) - Math.abs(dy) * halfWidth,
      cy + dy * (innerWall - reach) - Math.abs(dx) * halfWidth, ribRecess];
    const b = [cx + dx * (innerWall + JOIN) + Math.abs(dy) * halfWidth,
      cy + dy * (innerWall + JOIN) + Math.abs(dx) * halfWidth, ceiling];
    return [makeBox(a, b)];
  }));
}

function classicStudReliefs(cells, px, py, compensation) {
  const { pitch, studDiameter, studHeight } = getCategory('classic').geometry;
  const offsets = [-pitch / 2, pitch / 2];
  const radius = (studDiameter + 0.1 + compensation) / 2;
  return cells.flatMap(([x, y]) => offsets.flatMap(dx => offsets.map(dy => makeCylinder(
    radius, studHeight + 0.2 + JOIN, [px(x + 0.5) + dx, py(y + 0.5) + dy, -JOIN],
  ))));
}

function passage(kind, length, adjustment, counterboreDepth) {
  const span = length + 2 * JOIN;
  const diameter = (kind === 'axle' ? 4.8 : 4.9) + adjustment;
  const radius = diameter / 2;
  const bore = makeCylinder(radius, span, [0, 0, -JOIN]);
  if (kind === 'axle') {
    const half = 0.9 + adjustment / 2;
    const reach = radius + JOIN;
    const x = makeBox([-reach, -half, -JOIN], [reach, half, length + JOIN]);
    const y = makeBox([-half, -reach, -JOIN], [half, reach, length + JOIN]);
    return bore.intersect(x.fuse(y));
  }
  const near = makeCylinder(3.1, counterboreDepth + JOIN, [0, 0, -JOIN]);
  const far = makeCylinder(3.1, counterboreDepth + JOIN, [0, 0, length - counterboreDepth]);
  return bore.fuse(near).fuse(far);
}

function makeBeam(params, adjustment, detailed) {
  const { pitch, width, thickness, counterboreDepth } = beamGeometry;
  const count = params.beamLength ?? 5;
  if (!Number.isInteger(count) || count < 1 || count > GRID) throw new Error('Dĺžka nosníka musí byť od 1 do 16 modulov.');
  const radius = width / 2;
  const halfSpan = (count - 1) * pitch / 2;
  const outline = count === 1 ? drawCircle(radius) : draw([-halfSpan, -radius])
    .lineTo([halfSpan, -radius])
    .threePointsArcTo([halfSpan, radius], [halfSpan + radius, 0])
    .lineTo([-halfSpan, radius])
    .threePointsArcTo([-halfSpan, -radius], [-halfSpan - radius, 0])
    .close();
  let body = prism(outline, 0, thickness);
  if (detailed && params.mode === 'fdm') body = body.chamfer(0.3, edge => edge.inPlane('XY', 0));
  const kind = params.technic ?? 'pin';
  if (kind === 'none') return body;
  const tool = passage(kind, thickness, adjustment, counterboreDepth);
  const holes = Array.from({ length: count }, (_, i) => tool.clone().translateX(i * pitch - halfSpan));
  tool.delete();
  return apply(body, 'cut', holes);
}

function addTechnic(shape, cells, width, depth, kind, requestedAxis, adjustment, edgeGap) {
  const { axis, runs } = technicRuns(cells, requestedAxis);
  const alongX = axis === 'x';
  const direction = alongX ? [1, 0, 0] : [0, 1, 0];
  const across = a => (a - (alongX ? depth : width) / 2) * PITCH;
  const along = a => (a - (alongX ? width : depth) / 2) * PITCH;
  const point = (a, b) => alongX ? [b, a, HOLE_Z] : [a, b, HOLE_Z];
  const bosses = [];
  const cutters = [];
  for (const run of runs) {
    const pos = across(run.seam);
    const start = along(run.start) + edgeGap;
    const stop = along(run.end) - edgeGap;
    const length = stop - start;
    bosses.push(makeCylinder(3.6, length, point(pos, start), direction));
    const rotationAxis = alongX ? [0, 1, 0] : [-1, 0, 0];
    cutters.push(passage(kind, length, adjustment, 0.8).rotate(90, [0, 0, 0], rotationAxis).translate(point(pos, start)));
  }
  return apply(apply(shape, 'fuse', bosses), 'cut', cutters);
}

export function makeBrick(params, detailed = true) {
  const { geometry, defaultPassage, defaultTop } = getCategory(params.category);
  const {
    cells, disabled, plates, top = defaultTop, mode, nozzle, clutch, bridging,
    technic = defaultPassage, axis, snot, side, slope,
  } = params;
  const fdm = mode === 'fdm';
  const compensation = fdm ? { 0.2: 0.15, 0.4: 0.2, 0.6: 0.25 }[nozzle] : 0;
  const fitAdjustment = compensation - clutch;
  if (isBeam(params)) return makeBeam(params, fitAdjustment, detailed);
  if (!cells.length) throw new Error('Do pôdorysu pridaj aspoň jednu bunku.');
  const { pitch, plateHeight, edgeGap, wall, roof, studDiameter, studHeight, tubeRecess } = geometry;
  const { x: minX, y: minY, width, depth } = bounds(cells);
  const local = cells.map(([x, y]) => [x - minX, y - minY]);
  const occupied = new Set(local.map(cell => key(...cell)));
  const loops = outline(local).sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
  const height = plates * plateHeight;
  const ceiling = height - roof + JOIN;
  const tubeInside = (geometry.tubeBore + fitAdjustment) / 2;
  const radius = (studDiameter + clutch) / 2;
  const px = x => (x - width / 2) * pitch;
  const py = y => (y - depth / 2) * pitch;

  const outer = profile(loops, edgeGap, width, depth, pitch);
  const inner = profile(loops, edgeGap + wall, width, depth, pitch);
  let shell = prism(outer, 0, height);
  if (detailed && fdm) shell = shell.chamfer(0.3, edge => edge.inPlane('XY', 0));
  let topAt = () => height;
  let slopeCutter;
  let cavity = prism(inner, -JOIN, ceiling);
  if (slope !== 'flat') {
    const degrees = slope === '33' ? 33 : 45;
    slopeCutter = slopedCutter(width, depth, height, degrees, slope === 'reverse', geometry);
    cavity = cavity.cut(slopeCutter.vertical.clone().translateZ(-roof * Math.hypot(1, slopeCutter.grade)));
    topAt = slopeCutter.topAt;
  }
  shell = shell.cut(cavity);

  const { tubes, pins } = connections(local);
  const supports = [];
  const cutTubes = [];
  const tubeRadius = (Math.SQRT2 * pitch - studDiameter + clutch) / 2;
  for (const { x, y } of tubes) {
    const tubeHeight = ceiling - tubeRecess;
    supports.push(makeCylinder(tubeRadius, tubeHeight, [px(x), py(y), tubeRecess]));
    if (bridging && fdm && detailed && !slopeCutter) {
      const rise = Math.min(0.6, Math.max(0.35, tubeHeight - studHeight));
      const cone = taper(px(x), py(y), ceiling - rise, tubeRadius - JOIN, ceiling, tubeRadius + rise - JOIN);
      // A haunch may merge with the walls but stays inside the outer envelope.
      supports[supports.length - 1] = supports.at(-1).fuse(cone.intersect(prism(outer, -JOIN, height + JOIN)));
    }
    cutTubes.push(makeCylinder(tubeInside, tubeHeight, [px(x), py(y), tubeRecess - JOIN]));
  }
  if (geometry.pinDiameter) {
    for (const [x, y] of pins) supports.push(makeCylinder((geometry.pinDiameter + clutch) / 2, ceiling, [px(x), py(y), 0]));
  }
  shell = apply(shell, 'fuse', supports);
  if (detailed) shell = apply(shell, 'fuse', wallRibs(local, occupied, px, py, ceiling, geometry, clutch));
  if (detailed && pitch === PITCH && local.length === 8 && Math.min(width, depth) === 2 && width * depth === 8) {
    // The center web on the 2 × 4 reference brick stops above the mating zone.
    const webLength = pitch - edgeGap - wall + JOIN;
    const [x, y] = width === 4 ? [0.4, webLength] : [webLength, 0.4];
    const webBottom = Math.max(studHeight + 0.2, height - roof - 6.3);
    shell = shell.fuse(makeBox([-x, -y, webBottom], [x, y, ceiling]));
  }
  if (cutTubes.length) {
    const bores = combine(cutTubes);
    // A full-height underside bore would pierce the shell where its roof slopes down.
    shell = shell.cut(slopeCutter ? bores.intersect(cavity) : bores);
  }

  if (slopeCutter) shell = shell.cut(slopeCutter.vertical);
  if (top === 'hollow-classic' && geometry.classicSocketDiameter) {
    shell = apply(shell, 'cut', classicStudReliefs(local, px, py, compensation));
  }

  const extraConnections = allowsExtraConnections(params);
  if (extraConnections && technic !== 'none') {
    shell = addTechnic(shell, local, width, depth, technic, axis, fitAdjustment, edgeGap);
  }

  if (extraConnections && snot !== 'none') {
    const [dx, dy] = { west: [-1, 0], east: [1, 0], south: [0, -1], north: [0, 1] }[side];
    const direction = [dx, dy, 0];
    const rotationAxis = [-dy, dx, 0];
    const z = height - 3.9;
    const bosses = [];
    const cuts = [];
    for (const [x, y] of local) {
      if (occupied.has(key(x + dx, y + dy))) continue;
      const faceOffset = pitch / 2 - edgeGap;
      const center = [px(x + 0.5) + dx * faceOffset, py(y + 0.5) + dy * faceOffset, z];
      if (snot === 'stud') bosses.push(stud(...center, radius, studHeight, detailed, 90, rotationAxis));
      else {
        const position = distance => [center[0] + dx * distance, center[1] + dy * distance, z];
        bosses.push(makeCylinder(3.15, 2.5, position(-2.5), direction));
        cuts.push(makeCylinder((studDiameter + fitAdjustment) / 2, 1.85 + JOIN, position(-1.85), direction));
      }
    }
    shell = apply(apply(shell, 'fuse', bosses), 'cut', cuts);
  }

  if (top !== 'tile') {
    const boreDiameter = { hollow: geometry.hollowStudDiameter, 'hollow-classic': geometry.classicSocketDiameter }[top];
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
      studs.push(stud(cx, cy, z, radius, studHeight, detailed, angle));
      if (boreDiameter) {
        bores.push(makeCylinder((boreDiameter + compensation) / 2, studHeight + JOIN, [cx, cy, z], normal));
      }
      if (top === 'solid' && detailed && !slopeCutter && geometry.studReliefDiameter) {
        bores.push(makeCylinder(geometry.studReliefDiameter / 2, geometry.studReliefDepth + JOIN, [cx, cy, height - roof - JOIN]));
      }
    }
    shell = apply(apply(shell, 'fuse', studs), 'cut', bores);
  }
  return shell;
}
