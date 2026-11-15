// Logic: navy grid boards edged in teal, cream cells, teal and gold accents.
import { build } from '../scene.mjs';
import { C, glyph, tile, upTile, board, box, cyl, cap, torus, sphere, cone, prism, star } from '../kit.mjs';
const T = C.TEAL, B = '#1E3A44', E = '#2ED3B7';
const cell = (pos, col, ch, ink = C.INK, h = 0.06) => box([0.2, h, 0.2], { pos: [pos[0], h, pos[2]], col, r: 0.04, decal: ch ? { cell: glyph(ch, ink, 0.7), face: 'y', w: 0.19 } : undefined });
export const SCENES = {
  // Island Link: numbered islands joined by single and double bridges.
  bridges: () => build(() => {
    box([1.55, 0.06, 1.15], { pos: [0, -0.06, 0], col: '#2B6E9A', r: 0.06 });
    const I = { a: [-1.1, -0.7, '3'], b: [0.4, -0.7, '4'], c: [1.15, 0.1, '2'], d: [-1.1, 0.7, '2'], e: [0.4, 0.7, '3'] };
    const br = (p, q, n) => { for (let k = 0; k < n; k++) { const o = (k - (n - 1) / 2) * 0.12; const dx = q[0] - p[0], dz = q[1] - p[1], L = Math.hypot(dx, dz); const nx = -dz / L, nz = dx / L;
      box([L / 2 - 0.2, 0.025, 0.04], { pos: [(p[0] + q[0]) / 2 + nx * o, 0.1, (p[1] + q[1]) / 2 + nz * o], rot: [0, (-Math.atan2(dz, dx) * 180) / Math.PI, 0], col: C.WOOD2, r: 0.02 }); } };
    br(I.a, I.b, 2); br(I.a, I.d, 1); br(I.b, I.e, 2); br(I.d, I.e, 1); br(I.e, I.c, 1);
    for (const [x, z, n] of Object.values(I)) { cyl(0.27, 0.1, { pos: [x, 0.1, z], col: C.SAND, r: 0.06, decal: { cell: glyph(n, C.INK, 0.75), face: 'y', w: 0.22 } }); }
    cone(0.06, 0.01, 0.14, { pos: [1.32, 0.34, -0.02], col: C.GREEN });
  }),
  // Loopline: one closed loop drawn along the grid lines between clue numbers.
  fences: () => build(() => {
    const at = board(4, 4, { col: B, step: 0.6 });
    for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) sphere(0.045, { pos: at(i - 0.5, j - 0.5, 0.03), col: C.SILVER });
    const loop = [[-0.5, -0.5], [2.5, -0.5], [2.5, 0.5], [3.5, 0.5], [3.5, 3.5], [1.5, 3.5], [1.5, 2.5], [-0.5, 2.5]];
    loop.forEach((p, k) => { const q = loop[(k + 1) % loop.length]; cap(at(...p, 0.05), at(...q, 0.05), 0.06, { col: T }); });
    for (const [i, j, n] of [[0, 0, '2'], [2, 1, '1'], [3, 2, '2'], [1, 2, '0'], [3, 0, '3']]) box([0.13, 0.03, 0.13], { pos: at(i, j, 0.03), col: C.CREAM, r: 0.03, decal: { cell: glyph(n, C.INK, 0.8), face: 'y', w: 0.13 } });
  }),
  // Regions: the grid split into tinted regions, each of N squares holding N.
  fillomino: () => build(() => {
    const at = board(4, 4, { col: B, step: 0.52 });
    const g = ['3322', '3122', '4114', '4444'], tint = { 1: C.GOLD, 2: C.PINK, 3: C.BLUE, 4: T };
    g.forEach((r, j) => [...r].forEach((n, i) => cell(at(i, j), tint[n], (i + j) % 2 === 0 || n === '1' ? n : null, C.INK, 0.05 + (n === '1' ? 0.04 : 0))));
  }),
  // Colour Flood: a board of coloured squares, the flood spreading from the corner.
  flood: () => build(() => {
    const at = board(5, 5, { col: B, step: 0.46 });
    const cols = [T, C.PINK, C.GOLD, C.BLUE, C.ORANGE];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const flooded = i + j < 4 && !(i === 2 && j === 1);
      const c = flooded ? T : cols[(i * 3 + j * 2 + (i * j) % 3) % 5];
      box([0.21, flooded ? 0.1 : 0.07, 0.21], { pos: at(i, j, flooded ? 0.1 : 0.07), col: c, r: 0.05 });
    }
  }),
  // Lamplighter: bulbs on the board lighting their rows, numbered walls.
  lightup: () => build(() => {
    const at = board(5, 5, { col: B, step: 0.46 });
    const walls = { '1,1': '1', '3,3': '2', '4,0': '', '0,3': '0' };
    const bulbs = [[0, 1], [3, 2], [4, 3], [1, 4]];
    const lit = new Set(); for (const [i, j] of bulbs) for (let k = 0; k < 5; k++) { lit.add(`${k},${j}`); lit.add(`${i},${k}`); }
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const k = `${i},${j}`;
      if (k in walls) box([0.21, 0.14, 0.21], { pos: at(i, j, 0.14), col: C.INK, r: 0.04, decal: walls[k] ? { cell: glyph(walls[k], C.WHITE, 0.7), face: 'y', w: 0.2 } : undefined });
      else box([0.21, 0.04, 0.21], { pos: at(i, j, 0.04), col: lit.has(k) ? '#FFE9A8' : '#C9D3EA', r: 0.03 });
    }
    for (const [i, j] of bulbs) { const p = at(i, j); cyl(0.07, 0.05, { pos: [p[0], 0.12, p[2]], col: C.SILVER }); sphere(0.15, { pos: [p[0], 0.28, p[2]], col: C.GOLD_HI, emit: 0.7 }); }
  }),
  // Minefield: covered squares, opened ones with counts, a flag and a mine.
  minesweeper: () => build(() => {
    const at = board(5, 5, { col: B, step: 0.46 });
    const open = { '0,4': '', '1,4': '1', '0,3': '1', '1,3': '2', '2,4': '1', '0,2': '1', '2,3': '3' };
    const ink = { 1: '#2F6BFF', 2: '#1E8F55', 3: '#E8473F' };
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const k = `${i},${j}`;
      if (k in open) box([0.21, 0.02, 0.21], { pos: at(i, j, 0.02), col: '#DCE3F0', r: 0.02, decal: open[k] ? { cell: glyph(open[k], ink[open[k]], 0.78), face: 'y', w: 0.2 } : undefined });
      else box([0.21, 0.09, 0.21], { pos: at(i, j, 0.09), col: (i + j) % 2 ? '#3A6E6A' : '#43807A', r: 0.05 });
    }
    const f = at(2, 2); cap([f[0], 0.18, f[2]], [f[0], 0.62, f[2]], 0.02, { col: C.INK }); prism([[0, 0], [0.24, -0.08], [0, -0.17]], 0.015, { pos: [f[0], 0.62, f[2]], col: C.RED });
    const m = at(3, 3, 0.3); sphere(0.14, { pos: m, col: C.INK }); for (const r of [[0, 0, 0], [0, 0, 90], [90, 0, 0], [0, 0, 45], [0, 0, -45]]) cyl(0.025, 0.22, { pos: m, rot: r, col: C.INK });
    sphere(0.035, { pos: [m[0] - 0.05, m[1] + 0.06, m[2] + 0.1], col: C.WHITE });
  }),
  // Mosaic: a nonogram half filled, the clue numbers along the edges.
  nonogram: () => build(() => {
    const at = board(5, 5, { col: B, step: 0.42 });
    const pic = ['.###.', '#####', '##.##', '#####', '.#.#.'];
    pic.forEach((r, j) => [...r].forEach((c, i) => box([0.19, c === '#' ? 0.09 : 0.02, 0.19], { pos: at(i, j, c === '#' ? 0.09 : 0.02), col: c === '#' ? (j < 3 ? T : C.INK) : '#DCE3F0', r: 0.03 })));
    const rc = ['3', '5', '2 2', '5', '1 1'], cc = ['3', '4', '2\n1', '4', '3'];
    rc.forEach((t, j) => box([0.18, 0.02, 0.17], { pos: at(-1.15, j, 0.02), col: C.CREAM, r: 0.02, decal: { cell: glyph(t, C.INK, t.length > 1 ? 0.45 : 0.7), face: 'y', w: 0.17 } }));
    cc.forEach((t, i) => box([0.17, 0.02, 0.18], { pos: at(i, -1.15, 0.02), col: C.CREAM, r: 0.02, decal: { cell: glyph(t, C.INK, 0.55), face: 'y', w: 0.17 } }));
  }),
  // Safe Cracker: the safe door, its dial and the four-digit code going in.
  safe: () => build(() => {
    box([0.95, 0.85, 0.4], { pos: [0, 0.85, -0.3], col: '#3C4A5E', r: 0.1 });
    box([0.8, 0.7, 0.05], { pos: [0, 0.85, 0.1], col: '#56677F', r: 0.05 });
    cyl(0.32, 0.06, { pos: [-0.2, 0.95, 0.18], rot: [90, 0, 0], col: C.SILVER, r: 0.04, decal: { cell: { paint: 'ticks', col: '#2A3558', n: 10, big: 5 }, face: 'y', w: 0.3, h: 0.08, off: [0, 0.2] } });
    cyl(0.12, 0.05, { pos: [-0.2, 0.95, 0.27], rot: [90, 0, 0], col: C.GOLD });
    cap([0.4, 1.2, 0.18], [0.4, 0.75, 0.18], 0.05, { col: C.GOLD });
    ['7', '3', '0', '?'].forEach((d, i) => upTile(d === '?' ? null : d, { pos: [-0.66 + i * 0.44, 0.22, 0.75], s: 0.19, d: 0.06, col: d === '?' ? T : C.CREAM }));
  }),
  // Shikaku: the grid cut into rectangles, one number in each.
  shikaku: () => build(() => {
    const at = board(5, 5, { col: B, step: 0.46 });
    const rects = [[0, 0, 1, 1, C.BLUE, '4'], [2, 0, 4, 0, C.GOLD, '3'], [2, 1, 4, 2, T, '6'], [0, 2, 0, 4, C.PINK, '3'], [1, 2, 1, 3, C.ORANGE, '2'], [1, 4, 4, 4, '#C9D3EA', '4'], [2, 3, 4, 3, C.GREEN, '3']];
    for (const [i0, j0, i1, j1, col, n] of rects) { const a = at(i0, j0), b = at(i1, j1); const w = (b[0] - a[0]) / 2 + 0.2, d = (b[2] - a[2]) / 2 + 0.2;
      box([w, 0.08, d], { pos: [(a[0] + b[0]) / 2, 0.08, (a[2] + b[2]) / 2], col, r: 0.05, decal: { cell: glyph(n, C.INK, 0.7), face: 'y', w: 0.2, off: [a[0] - (a[0] + b[0]) / 2, -(a[2] - (a[2] + b[2]) / 2)] } }); }
  }),
  // Box Six: a 6 × 6 sudoku, the boxes ruled, digits in.
  sudoku: () => build(() => {
    const at = board(6, 6, { col: B, step: 0.4, pad: 0.1 });
    const g = ['1 3 5 ', ' 52 4 ', '4  2 6', '2 6  3', ' 1 64 ', ' 4 3 1'];
    g.forEach((r, j) => [...r].forEach((d, i) => { const p = at(i, j); p[0] += Math.floor(i / 3) * 0.06 - 0.03; p[2] += Math.floor(j / 2) * 0.06 - 0.06;
      box([0.17, 0.05, 0.17], { pos: [p[0], 0.05, p[2]], col: d === ' ' ? '#DCE3F0' : (i + j) % 5 === 0 ? T : C.CREAM, r: 0.03, decal: d !== ' ' ? { cell: glyph(d, C.INK, 0.75), face: 'y', w: 0.16 } : undefined }); }));
    upTile('5', { pos: [0.75, 0.45, 0.6], s: 0.17, d: 0.05, col: C.GOLD, rot: [-40, 0, 10] });
  }),
  // Tents and Trees: a grassy grid, trees with their tents beside them.
  tents: () => build(() => {
    const at = board(5, 4, { col: '#2C5E35', step: 0.5 });
    for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) box([0.23, 0.03, 0.23], { pos: at(i, j, 0.03), col: (i + j) % 2 ? '#4CAF50' : '#58BB5C', r: 0.03 });
    const tree = (i, j) => { const p = at(i, j); cyl(0.05, 0.12, { pos: [p[0], 0.18, p[2]], col: C.WOOD }); cone(0.2, 0.02, 0.28, { pos: [p[0], 0.5, p[2]], col: '#1E7A3C' }); cone(0.16, 0.02, 0.2, { pos: [p[0], 0.7, p[2]], col: '#25914A' }); };
    const tent = (i, j, col) => { const p = at(i, j); prism([[-0.2, 0], [0.2, 0], [0, 0.3]], 0.17, { pos: [p[0], 0.06, p[2]], rot: [0, 90, 0], col }); prism([[-0.06, 0], [0.06, 0], [0, 0.14]], 0.01, { pos: [p[0] + 0.17, 0.06, p[2]], rot: [0, 90, 0], col: C.INK }); };
    tree(0, 0); tent(1, 0, C.ORANGE); tree(3, 1); tent(3, 2, T); tree(1, 3); tent(0, 3, C.GOLD); tree(4, 3);
  }),
  // Hanoi: three posts on a wooden base, the tower part moved, one disc in the air.
  tower: () => build(() => {
    box([1.35, 0.08, 0.42], { pos: [0, 0.08, 0], col: C.WOOD, r: 0.06 });
    for (let k = 0; k < 3; k++) cap([-0.85 + 0.85 * k, 0.15, 0], [-0.85 + 0.85 * k, 1.15, 0], 0.045, { col: k === 2 ? C.GOLD : C.SILVER });
    cyl(0.42, 0.08, { pos: [-0.85, 0.24, 0], col: T, r: 0.06 }); cyl(0.34, 0.08, { pos: [-0.85, 0.4, 0], col: C.ORANGE, r: 0.06 });
    cyl(0.26, 0.08, { pos: [0.85, 0.24, 0], col: C.BLUE, r: 0.06 });
    cyl(0.2, 0.08, { pos: [0.0, 1.35, 0], col: C.PINK, r: 0.06 });
  }),
  // Trail: numbered squares joined by one path from 1 onwards.
  trail: () => build(() => {
    const at = board(4, 4, { col: B, step: 0.56 });
    const order = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 2], [0, 3], [1, 3], [1, 2], [2, 2], [2, 3], [3, 3], [3, 2], [3, 1], [2, 1], [2, 0], [3, 0]];
    order.forEach(([i, j], n) => { const shown = [0, 4, 7, 11, 15].includes(n); box([0.25, 0.05, 0.25], { pos: at(i, j, 0.05), col: n < 9 ? '#BDF2E7' : C.CREAM, r: 0.04, decal: shown ? { cell: glyph(String(n + 1), C.INK, 0.6), face: 'y', w: 0.22 } : undefined }); });
    for (let n = 0; n < 8; n++) cap(at(...order[n], 0.16), at(...order[n + 1], 0.16), 0.055, { col: T });
    sphere(0.1, { pos: at(...order[8], 0.16), col: C.GOLD });
  }),
  // Polypotions: flasks of coloured layers, one tipping to pour.
  tubes: () => build(() => {
    box([1.2, 0.07, 0.4], { pos: [-0.25, 0.07, 0], col: C.NAVY2, r: 0.05 });
    const flask = (pos, cols, rot) => {
      const s = 0.27; cap([0, 0, 0], [0, 1.0, 0], s, { pos, rot, col: '#D7E9EE', pattern: { type: 'bands', axis: 'y', from: -0.27, step: 0.31, cols } });
      if (!rot) torus(0.27, 0.04, { pos: [pos[0], pos[1] + 1.2, pos[2]], col: '#E9F6FA' });
    };
    flask([-1.0, 0.42, 0], [C.ORANGE, C.BLUE, C.ORANGE, C.PINK]);
    flask([-0.3, 0.42, 0], [C.BLUE, C.PINK, C.BLUE]);
    flask([0.4, 0.42, 0], [T, T]);
    flask([1.45, 1.05, 0], [C.PINK, C.PINK], [0, 0, 62]);
    cap([0.47, 1.6, 0], [0.42, 1.0, 0], 0.07, { col: C.PINK });
  }),
};
const crop = { tile: { zoomOut: 0.8 }, hero: { zoomOut: 0.92 } };
export const CAMERAS = Object.fromEntries(Object.keys(SCENES).filter((k) => !['safe', 'tower', 'tubes', 'bridges'].includes(k)).map((k) => [k, crop]));
