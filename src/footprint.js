export const GRID = 16;
export const PITCH = 8;
export const key = (x, y) => `${x},${y}`;

export function rectangle(width, depth, x = 0, y = 0) {
  return Array.from({ length: width * depth }, (_, i) => [
    x + i % width,
    y + Math.floor(i / width),
  ]);
}

export function bounds(cells) {
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) + 1,
    depth: Math.max(...ys) - Math.min(...ys) + 1 };
}

const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const neighbors = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const offsets = [[0, 0], [1, 0], [1, 1], [0, 1]];

// Boundary edges run with the brick material on their left.
export function outline(cells) {
  const occupied = new Set(cells.map(([x, y]) => key(x, y)));
  const edges = new Map();
  for (const [x, y] of cells) {
    offsets.forEach(([ox, oy], direction) => {
      const [nx, ny] = neighbors[direction];
      if (occupied.has(key(x + nx, y + ny))) return;
      const start = [x + ox, y + oy];
      const [dx, dy] = directions[direction];
      edges.set(key(...start) + ':' + direction, { start, direction, end: [start[0] + dx, start[1] + dy] });
    });
  }
  const loops = [];
  while (edges.size) {
    const first = edges.values().next().value;
    let edge = first;
    const turns = [];
    do {
      const next = [1, 0, 3].map(turn => (edge.direction + turn) % 4)
        .map(dir => dir === first.direction && key(...edge.end) === key(...first.start) ? first : edges.get(key(...edge.end) + ':' + dir)).find(Boolean);
      if (!next) throw new Error('Neuzavretý obrys pôdorysu.');
      if (next.direction !== edge.direction) turns.push({ point: next.start, from: edge.direction, to: next.direction });
      edges.delete(key(...edge.start) + ':' + edge.direction);
      edge = next;
    } while (edge !== first);
    const area = turns.reduce((sum, { point: [x, y] }, i) => {
      const [nx, ny] = turns[(i + 1) % turns.length].point;
      return sum + x * ny - nx * y;
    }, 0) / 2;
    loops.push({ turns, area });
  }
  return loops;
}

export function inset(loop, amount, width, depth, pitch = PITCH) {
  return loop.turns.map(({ point: [x, y], from, to }) => {
    const [ax, ay] = directions[from];
    const [bx, by] = directions[to];
    return [pitch * (x - width / 2) - amount * (ay + by), pitch * (y - depth / 2) + amount * (ax + bx)];
  });
}

export function connections(cells) {
  const occupied = new Set(cells.map(([x, y]) => key(x, y)));
  const has = (x, y) => occupied.has(key(x, y));
  const tubes = [];
  const pins = [];
  for (const [x, y] of cells) {
    if (has(x + 1, y) && has(x, y + 1) && has(x + 1, y + 1)) {
      const ribs = [
        !has(x - 1, y) && !has(x - 1, y + 1),
        !has(x + 2, y) && !has(x + 2, y + 1),
        !has(x, y - 1) && !has(x + 1, y - 1),
        !has(x, y + 2) && !has(x + 1, y + 2),
      ];
      tubes.push({ x: x + 1, y: y + 1, ribs });
    }
    if (has(x + 1, y) && ![y - 1, y + 1].some(row => has(x, row) && has(x + 1, row))) {
      pins.push([x + 1, y + 0.5]);
    }
    if (has(x, y + 1) && ![x - 1, x + 1].some(col => has(col, y) && has(col, y + 1))) {
      pins.push([x + 0.5, y + 1]);
    }
  }
  return { tubes, pins };
}

export function technicRuns(cells, axis = 'auto') {
  if (axis === 'auto') {
    const y = technicRuns(cells, 'y');
    const x = technicRuns(cells, 'x');
    return y.runs.length >= x.runs.length ? y : x;
  }
  const coordinates = axis === 'x' ? cells.map(([x, y]) => [y, x]) : cells;
  const occupied = new Set(coordinates.map(cell => key(...cell)));
  const has = (a, b) => occupied.has(key(a, b));
  const hasPair = (a, b) => has(a, b) && has(a + 1, b);
  const touches = (a, b) => has(a, b) || has(a + 1, b);
  const runs = [];
  for (const [a, b] of coordinates) {
    if (!hasPair(a, b) || touches(a, b - 1)) continue;
    let end = b + 1;
    while (hasPair(a, end)) end++;
    if (!touches(a, end)) runs.push({ seam: a + 1, start: b, end });
  }
  return { axis, runs };
}
