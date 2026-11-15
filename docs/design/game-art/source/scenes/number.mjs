// Number: cream number tiles with ink digits, green accents, navy trays.
import { build } from '../scene.mjs';
import { C, glyph, tile, upTile, slab, box, cyl, cap, torus, sphere, cone, prism } from '../kit.mjs';
const G = C.GREEN, G2 = '#1E8F55';
const dart = (tip, dir, col, k = 1) => {
  const n = Math.hypot(...dir), d = dir.map((v) => v / n), at = (t) => tip.map((v, i) => v + d[i] * t * k);
  cap(at(0.02), at(0.22), 0.025 * k, { col: C.SILVER });
  cap(at(0.22), at(0.62), 0.05 * k, { col: C.INK });
  cap(at(0.62), at(0.86), 0.022 * k, { col: C.SILVER });
  const yaw = (Math.atan2(d[0], d[2]) * 180) / Math.PI, pitch = (-Math.asin(d[1]) * 180) / Math.PI;
  for (const r of [0, 90]) box([0.13 * k, 0.008 * k, 0.11 * k], { pos: at(0.9), rot: [pitch, yaw, r], col, r: 0.006 });
};
export const SCENES = {
  // Checkout: a dartboard standing up, three darts in the doubles and treble.
  checkout: () => build(() => {
    const B = [0, 1.15, 0];
    cyl(1.1, 0.09, { pos: B, rot: [90, 0, 0], col: C.INK, r: 0.06, decal: { cell: { paint: 'dartboard' }, face: 'y', w: 0.98 } });
    torus(1.1, 0.06, { pos: B, rot: [90, 0, 0], col: '#2B2B33' });
    box([0.08, 0.6, 0.06], { pos: [0, 0.6, -0.15], col: C.WOOD, r: 0.03 });
    dart([0.42, 1.42, 0.1], [0.3, 0.15, 1], C.GREEN, 1.3);
    dart([-0.45, 0.82, 0.1], [-0.25, -0.05, 1], C.GREEN, 1.3);
    dart([0.08, 1.0, 0.1], [0.08, -0.18, 1], C.GOLD, 1.3);
  }),
  // Operator: an equation on tiles, gold circles for the signs, one sign still to place.
  equation: (k) => build(() => {
    const row = k === 'tile' ? [['8', 'n'], ['×', 's'], ['3', 'n'], ['', 'gap'], ['4', 'n']] : [['8', 'n'], ['×', 's'], ['3', 'n'], ['', 'gap'], ['4', 'n'], ['=', 'e'], ['20', 'n']];
    slab(row.length * 0.3 + 0.05, 0.55, { col: C.NAVY });
    row.forEach(([ch, t], i) => {
      const x = (i - (row.length - 1) / 2) * 0.6;
      if (t === 'n') tile(ch, { pos: [x, 0.09, 0], s: 0.26, col: C.CREAM, size: ch.length > 1 ? 0.6 : 0.72 });
      if (t === 's' || t === 'e') cyl(0.23, 0.07, { pos: [x, 0.07, 0], col: t === 's' ? C.GOLD : '#C9D3EA', r: 0.05, decal: { cell: glyph(ch, C.INK, 0.8), face: 'y', w: 0.22 } });
      if (t === 'gap') { torus(0.21, 0.035, { pos: [x, 0.035, 0], col: C.GOLD }); }
    });
    const gx = (3 - (row.length - 1) / 2) * 0.6;
    cyl(0.23, 0.07, { pos: [gx, 0.62, 0.1], rot: [-30, 0, 10], col: C.GOLD, r: 0.05, decal: { cell: glyph('+', C.INK, 0.8), face: 'y', w: 0.22 } });
  }),
  // Kakuro: a corner of the grid, clue squares split by a diagonal, a few digits in.
  kakuro: () => build(() => {
    slab(1.42, 1.42, { col: C.NAVY });
    const rows = [['K', '', '16', '7'], ['17', '9', '8', ''], ['K4', '1', '3', '?'], ['', '', '', '']];
    const clue = { '0,0': [null, null], '1,0': ['', '23'], '2,0': [null, '16'], '3,0': [null, '7'], '0,1': ['17', null], '0,2': ['6', '4'], '0,3': ['', null] };
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const pos = [(i - 1.5) * 0.66, 0.09, (j - 1.5) * 0.66], key = `${i},${j}`;
      if (clue[key]) { const [a, b] = clue[key]; box([0.3, 0.07, 0.3], { pos: [pos[0], 0.07, pos[2]], col: '#20283F', r: 0.04, decal: { cell: { paint: 'kakuro', bg: '#20283F', col: G, a: b ?? '', b: a ?? '' }, face: 'y', w: 0.3 } }); continue; }
      const digits = { '1,1': '9', '2,1': '8', '1,2': '1', '2,2': '3', '3,1': '6' };
      tile(digits[key] || null, { pos, col: digits[key] ? C.CREAM : '#DDE6DA' });
    }
  }),
  // Brimful: three jugs of different sizes, water measured into them.
  measure: () => build(() => {
    const jug = (x, r, h, fill) => {
      cyl(r, h, { pos: [x, h, 0], col: '#CFE6F5', r: 0.08, pattern: { type: 'bands', axis: 'y', from: -h, step: h * 2 * fill, cols: [C.BLUE] } });
      torus(r - 0.02, 0.035, { pos: [x, h * 2, 0], col: '#E6F3FB' });
      for (let k = 1; k < 4; k++) box([0.1, 0.012, 0.02], { pos: [x - r * 0.35, (h * 2 * k) / 4, r - 0.005], col: '#5B7FA8', r: 0.008 });
    };
    jug(-0.95, 0.42, 0.75, 0.62); jug(0.05, 0.34, 0.55, 0.35); jug(0.85, 0.26, 0.4, 0.9);
    upTile('4', { pos: [0.1, 0.28, 0.85], s: 0.24, col: G, ink: C.INK });
  }),
  // Ballpark: a number line with ticks, a gold pin placed on it and the number to place.
  numline: () => build(() => {
    box([1.6, 0.08, 0.16], { pos: [0, 0.08, 0], col: C.CREAM, r: 0.06, decal: { cell: { paint: 'ticks', col: '#2A3558', n: 20, big: 5 }, face: 'y', w: 1.55, h: 0.16 } });
    for (const [x, t] of [[-1.47, '0'], [1.47, '100']]) upTile(t, { pos: [x, 0.33, -0.05], s: 0.2, d: 0.05, col: '#C9D3EA', size: t.length > 2 ? 0.48 : 0.7 });
    cap([0.45, 0.17, 0], [0.45, 0.85, 0], 0.035, { col: C.SILVER });
    sphere(0.13, { pos: [0.45, 0.92, 0], col: C.GOLD });
    upTile('64', { pos: [0.45, 1.35, 0], s: 0.27, d: 0.07, col: G, ink: C.INK, size: 0.64 });
  }),
  // Integer Pyramid: number blocks stacked three, two, one, the top still blank.
  numpyramid: () => build(() => {
    const rows = [['4', '7', '2'], ['11', '9'], ['?']];
    rows.forEach((r, j) => r.forEach((t, i) => {
      const x = (i - (r.length - 1) / 2) * 0.7, y = 0.32 + j * 0.64;
      upTile(t === '?' ? null : t, { pos: [x, y, 0], s: 0.31, d: 0.22, col: j === 2 ? C.GOLD : j === 1 ? '#DDF5E7' : C.CREAM, size: t.length > 1 ? 0.6 : 0.72 });
    }));
  }),
  // Exact: the six numbers on tiles and the target lit on a board behind them.
  target: () => build(() => {
    box([1.0, 0.36, 0.1], { pos: [0, 0.9, -0.55], col: '#1B2236', r: 0.06, decal: { cell: glyph('347', G, 0.6), face: 'z', w: 0.8, h: 0.3, emit: 0.8 } });
    box([0.06, 0.28, 0.06], { pos: [-0.6, 0.28, -0.55], col: C.NAVY2, r: 0.03 }); box([0.06, 0.28, 0.06], { pos: [0.6, 0.28, -0.55], col: C.NAVY2, r: 0.03 });
    ['25', '50', '75', '100', '3', '6'].forEach((t, i) => tile(t, { pos: [(i - 2.5) * 0.52, 0.09, 0.35 + (i % 2) * 0.12], s: 0.23, size: t.length > 2 ? 0.45 : t.length > 1 ? 0.58 : 0.72, col: i === 3 ? G : C.CREAM }));
  }),
  // Counterweight: a balance, weights on both pans, level.
  balance: () => build(() => {
    cyl(0.5, 0.06, { pos: [0, 0.06, 0], col: C.NAVY2 });
    cap([0, 0.1, 0], [0, 1.35, 0], 0.06, { col: C.GOLD });
    box([1.3, 0.05, 0.06], { pos: [0, 1.38, 0], col: C.GOLD, r: 0.04 });
    sphere(0.1, { pos: [0, 1.42, 0], col: C.GOLD });
    for (const sx of [-1, 1]) {
      const x = sx * 1.18;
      cap([x, 1.36, 0], [x - 0.35, 0.62, 0], 0.012, { col: C.SILVER }); cap([x, 1.36, 0], [x + 0.35, 0.62, 0], 0.012, { col: C.SILVER });
      cyl(0.45, 0.04, { pos: [x, 0.6, 0], col: C.SILVER, r: 0.03 });
    }
    const wt = (x, t, r, h, col) => cyl(r, h, { pos: [x, 0.64 + h, 0], col, r: 0.05, decal: { cell: glyph(t, C.INK, 0.62), face: 'y', w: r * 0.9 } });
    wt(-1.18, '9', 0.26, 0.14, G);
    wt(1.0, '5', 0.2, 0.11, C.CREAM); wt(1.36, '4', 0.17, 0.09, C.CREAM);
  }),
};
export const CAMERAS = { kakuro: { tile: { zoomOut: 0.72 } }, equation: { tile: { zoomOut: 0.9 } } };
