// Pattern: violet boards with bright pieces that fit, slide, roll or join.
import { build } from '../scene.mjs';
import { C, glyph, tile, board, box, cyl, cap, torus, sphere, cone, prism, star } from '../kit.mjs';
const V = '#3A2C5E', VP = C.PURPLE;
export const SCENES = {
  // Tessellate: a board with an L-shaped gap and the last piece coming down into it.
  blockparty: () => build(() => {
    const at = board(5, 4, { col: V });
    const fill = { '0,0': C.BLUE, '1,0': C.BLUE, '2,0': C.GREEN, '3,0': C.GREEN, '4,0': C.GREEN, '0,1': C.BLUE, '1,1': C.ORANGE, '2,1': C.ORANGE, '4,1': C.PINK, '0,2': C.GOLD, '1,2': C.ORANGE, '4,2': C.PINK, '0,3': C.GOLD, '1,3': C.GOLD, '4,3': C.PINK };
    for (let j = 0; j < 4; j++) for (let i = 0; i < 5; i++) { const c = fill[`${i},${j}`]; if (c) box([0.24, 0.12, 0.24], { pos: at(i, j, 0.12), col: c, r: 0.06 }); else box([0.22, 0.01, 0.22], { pos: at(i, j, 0.01), col: '#4F3E7C', r: 0.01 }); }
    for (const [i, j] of [[2, 1], [3, 1], [3, 2], [3, 3], [2, 3]]) box([0.24, 0.12, 0.24], { pos: at(i, j, 0.95), col: VP, r: 0.06 });
    box([0.24, 0.12, 0.24], { pos: at(2, 2, 0.95), col: VP, r: 0.06 });
  }),
  // Chroma Lines: coloured pairs joined by pipes that fill the board.
  flow: () => build(() => {
    const at = board(5, 5, { col: V, step: 0.48 });
    const paths = [[C.RED, [[0, 0], [3, 0], [3, 1]]], [C.BLUE, [[0, 1], [0, 4], [1, 4]]], [C.GOLD, [[1, 1], [2, 1], [2, 3]]], [C.GREEN, [[4, 0], [4, 4], [2, 4]]], [C.PINK, [[1, 2], [1, 3]]]];
    for (const [col, pts] of paths) {
      for (let k = 0; k < pts.length - 1; k++) cap(at(...pts[k], 0.08), at(...pts[k + 1], 0.08), 0.085, { col });
      for (const e of [pts[0], pts[pts.length - 1]]) sphere(0.16, { pos: at(...e, 0.13), col });
    }
  }),
  // Topsy-Turvy: a tilted tray, coloured balls rolling towards holes of their colour.
  gravity: () => build(() => {
    const g = [];
    box([1.25, 0.08, 1.25], { pos: [0, 0.3, 0], rot: [8, 0, -10], col: V, r: 0.06,
      cut: [cyl(0.2, 0.2, { pos: [-0.65, 0.05, -0.6], isCut: true }), cyl(0.2, 0.2, { pos: [0.6, 0.05, 0.55], isCut: true }), cyl(0.2, 0.2, { pos: [0.55, 0.05, -0.55], isCut: true })] });
    for (const [x, z, c] of [[-0.65, -0.6, C.BLUE], [0.6, 0.55, C.ORANGE], [0.55, -0.55, C.GREEN]]) torus(0.22, 0.04, { pos: [x, 0.38 + x * -0.17 - z * 0.14 + 0.02, z], rot: [8, 0, -10], col: c });
    for (const [x, z, c] of [[-0.1, 0.1, C.BLUE], [0.15, 0.6, C.ORANGE], [-0.6, 0.45, C.GREEN]]) sphere(0.19, { pos: [x, 0.58 + x * -0.17 - z * 0.14, z], col: c });
    for (const [x, w, z, d] of [[0, 1.2, -0.05, 0.04]]) box([0.5, 0.08, 0.05], { pos: [-0.05, 0.47, -0.05], rot: [8, 0, -10], col: C.CREAM, r: 0.03 });
  }),
  // Skid: an ice floor, rocks, the ball sliding to the gold exit.
  iceslide: () => build(() => {
    const at = board(5, 5, { col: '#BFE6FF', step: 0.48, edge: C.SILVER });
    for (const [i, j] of [[1, 1], [3, 0], [4, 3], [0, 4], [2, 3]]) box([0.19, 0.16, 0.19], { pos: at(i, j, 0.16), rot: [0, 20 * i, 0], col: '#7C86A6', r: 0.09 });
    box([0.2, 0.02, 0.2], { pos: at(4, 0, 0.01), col: C.GOLD, r: 0.02, emit: 0.3 });
    sphere(0.21, { pos: at(2, 0, 0.21), col: C.PINK });
    for (let k = 1; k <= 3; k++) cap(at(2, 0 + k * 0.5, 0.1), at(2, 0 + k * 0.5 + 0.25, 0.1), 0.04, { col: '#FFFFFF', emit: 0.5 });
  }),
  // Lightbender: a beam from the emitter bent by mirrors onto gems that light up.
  laser: () => build(() => {
    const at = board(5, 4, { col: V, step: 0.5 });
    box([0.18, 0.14, 0.18], { pos: at(0, 3, 0.14), col: C.SILVER, r: 0.05 });
    const beam = [at(0, 3, 0.16), at(0, 0, 0.16), at(3, 0, 0.16), at(3, 2, 0.16), at(4.6, 2, 0.16)];
    for (let k = 0; k < beam.length - 1; k++) cap(beam[k], beam[k + 1], 0.055, { col: '#FF5A6E', emit: 0.9 });
    for (const [i, j, a] of [[0, 0, 45], [3, 0, -45], [3, 2, 45]]) box([0.22, 0.17, 0.03], { pos: at(i, j, 0.17), rot: [0, a, 0], col: '#DCEBFF', r: 0.02 });
    for (const [i, j, c] of [[1.5, 0, C.PINK], [3, 1, C.GOLD], [4, 2, C.CYAN]]) prism([[0, 0.17], [0.15, 0.05], [0.09, -0.13], [-0.09, -0.13], [-0.15, 0.05]], 0.08, { pos: at(i, j, 0.17), rot: [-90, 20, 0], col: c, emit: 0.35 });
  }),
  // Pipeline: pipe pieces on tiles, water running from the source through the joined ones.
  pipes: () => build(() => {
    const at = board(4, 3, { col: V, step: 0.6 });
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) box([0.27, 0.05, 0.27], { pos: at(i, j, 0.05), col: '#4F3E7C', r: 0.04 });
    const wet = C.BLUE, dry = C.SILVER;
    const seg = (a, b, col) => cap(at(...a, 0.17), at(...b, 0.17), 0.09, { col });
    seg([0, 1], [1, 1], wet); seg([1, 1], [1, 0], wet); seg([1, 0], [2, 0], wet); seg([2, 0], [2, 1], wet); seg([2, 1], [2.45, 1], wet);
    seg([3, 1], [3, 2], dry); seg([3, 1], [2.55, 1], dry); seg([0, 2], [1, 2], dry); seg([1, 2], [1, 2.45], dry); seg([3, 0], [3, 0.45], dry);
    cyl(0.22, 0.2, { pos: at(-0.55, 1, 0.2), rot: [0, 0, 90], col: C.GOLD });
  }),
  // Heave: crates pushed onto the marked squares.
  push: () => build(() => {
    const at = board(5, 4, { col: V, step: 0.5 });
    for (const [i, j] of [[1, 1], [3, 2], [4, 0]]) box([0.2, 0.012, 0.2], { pos: at(i, j, 0.012), col: C.GOLD, r: 0.01, emit: 0.2 });
    const crate = (i, j, on) => box([0.22, 0.22, 0.22], { pos: at(i, j, 0.22), col: on ? C.GOLD : C.WOOD2, r: 0.04,
      decals: [{ cell: { paint: 'lines', col: on ? '#9A6A15' : '#6E4425', w: 0.08, paths: [[[0.1, 0.1], [0.9, 0.9]], [[0.9, 0.1], [0.1, 0.9]], [[0.06, 0.06], [0.94, 0.06], [0.94, 0.94], [0.06, 0.94], [0.06, 0.06]]] }, face: 'z', w: 0.22 },
        { cell: { paint: 'lines', col: on ? '#9A6A15' : '#6E4425', w: 0.08, paths: [[[0.06, 0.06], [0.94, 0.06], [0.94, 0.94], [0.06, 0.94], [0.06, 0.06]]] }, face: 'y', w: 0.22 },
        { cell: { paint: 'lines', col: on ? '#9A6A15' : '#6E4425', w: 0.08, paths: [[[0.1, 0.1], [0.9, 0.9]], [[0.9, 0.1], [0.1, 0.9]], [[0.06, 0.06], [0.94, 0.06], [0.94, 0.94], [0.06, 0.94], [0.06, 0.06]]] }, face: 'x', w: 0.22 }] });
    crate(1, 1, true); crate(2, 2, false); crate(4, 1, false);
    for (const [i, j] of [[0, 3], [1, 3], [0, 0]]) box([0.24, 0.3, 0.24], { pos: at(i, j, 0.3), col: '#5A4A86', r: 0.05 });
    const p = at(1, 2, 0); cap([p[0], 0.2, p[2]], [p[0], 0.45, p[2]], 0.2, { col: C.PINK }); sphere(0.16, { pos: [p[0], 0.78, p[2]], col: C.PINK });
    for (const s of [-1, 1]) sphere(0.04, { pos: [p[0] + s * 0.06, 0.82, p[2] + 0.14], col: C.INK });
  }),
  // Gridlock: blocks jammed in a tray, the gold one sliding out of the exit.
  unblock: () => build(() => {
    const at = board(5, 5, { col: V, step: 0.48, edge: '#5A4A86' });
    const blk = (i0, j0, i1, j1, col) => { const a = at(i0, j0), b = at(i1, j1); box([Math.abs(b[0] - a[0]) / 2 + 0.21, 0.13, Math.abs(b[2] - a[2]) / 2 + 0.21], { pos: [(a[0] + b[0]) / 2, 0.13, (a[2] + b[2]) / 2], col, r: 0.07 }); };
    blk(2.5, 2, 3.5, 2, C.GOLD);
    blk(1, 0, 1, 2, C.BLUE); blk(2, 3, 2, 4, C.GREEN); blk(3, 0, 4, 0, C.CREAM); blk(4, 3, 4, 4, C.ORANGE); blk(0, 3, 1, 3, C.CREAM); blk(0, 4, 1, 4, C.PINK);
    box([0.05, 0.08, 0.22], { pos: [1.33, 0.06, 0], col: C.GOLD, emit: 0.5 });
  }),
};
const crop = { tile: { zoomOut: 0.8 }, hero: { zoomOut: 0.92 } };
export const CAMERAS = Object.fromEntries(Object.keys(SCENES).map((k) => [k, crop]));
