// Arcade · Strategy: marbles, gems and wooden trays, violet accents.
import { build, ell } from '../scene.mjs';
import { C, glyph, box, cyl, cap, torus, sphere, cone, prism, star, board } from '../kit.mjs';
const VI = '#8E80FF';
const gem = (pos, kind, col, rot = [0, 0, 0]) => {
  if (kind === 0) prism([[0, 0.2], [0.18, 0.06], [0.11, -0.17], [-0.11, -0.17], [-0.18, 0.06]], 0.09, { pos, rot: [-90 + rot[0], rot[1], rot[2]], col, r: 0.04 });
  if (kind === 1) box([0.14, 0.14, 0.14], { pos, rot: [45, 30 + rot[1], 35], col, r: 0.03 });
  if (kind === 2) ell([0.18, 0.12, 0.18], { pos, col });
  if (kind === 3) prism([...Array(6)].map((_, i) => [Math.cos((i * Math.PI) / 3) * 0.19, Math.sin((i * Math.PI) / 3) * 0.19]), 0.09, { pos, rot: [-90 + rot[0], rot[1], rot[2]], col, r: 0.04 });
};
export const SCENES = {
  // Ball Tracker: marbles running down the tracks, a gold switch turning one towards its cup.
  balltrack: () => build(() => {
    box([1.4, 0.05, 1.0], { pos: [0, -0.05, 0], col: '#3A2F62', r: 0.03 });
    const rail = (pts, col = C.SILVER) => { for (let k = 0; k < pts.length - 1; k++) cap(pts[k], pts[k + 1], 0.05, { col }); };
    rail([[-1.1, 1.2, -0.3], [-0.2, 0.9, -0.3], [0.1, 0.6, -0.3]]); rail([[0.1, 0.6, -0.3], [-0.6, 0.25, 0.1]]); rail([[0.1, 0.6, -0.3], [0.8, 0.25, 0.1]], C.GOLD);
    for (const [x, col] of [[-0.75, C.BLUE], [0.95, C.PINK]]) { cyl(0.22, 0.12, { pos: [x, 0.12, 0.2], col, r: 0.04, cut: [cyl(0.17, 0.12, { pos: [0, 0.06, 0], isCut: true })] }); }
    sphere(0.12, { pos: [-0.65, 1.17, -0.3], col: C.BLUE }); sphere(0.12, { pos: [0.5, 0.5, -0.1], col: C.PINK }); sphere(0.12, { pos: [0.95, 0.2, 0.2], col: C.PINK });
    cyl(0.09, 0.06, { pos: [0.1, 0.6, -0.3], rot: [90, 0, 0], col: C.GOLD });
  }),
  // Coral Pop: a reef of bubbles, a three of a kind popping and the treasure showing beneath.
  bubble: () => build(() => {
    box([1.4, 0.05, 1.0], { pos: [0, -0.05, 0], col: '#1F4F7A', r: 0.03 });
    const cols = [C.PINK, C.BLUE, C.GOLD, C.GREEN, VI];
    let n = 0; for (let j = 0; j < 3; j++) for (let i = 0; i < 6 - j; i++) { const x = (i - (5 - j) / 2) * 0.42, y = 1.35 - j * 0.36; sphere(0.2, { pos: [x, y, -0.3], col: cols[(i * 2 + j * 3) % 5] }); n++; }
    box([0.3, 0.16, 0.2], { pos: [0, 0.16, -0.3], col: C.WOOD2, r: 0.04 }); cyl(0.2, 0.15, { pos: [0, 0.32, -0.3], rot: [0, 0, 90], col: C.WOOD2, r: 0.04, cut: [box([0.3, 0.3, 0.3], { pos: [0.3, 0, 0], isCut: true })] }); box([0.05, 0.06, 0.02], { pos: [0, 0.3, -0.09], col: C.GOLD, r: 0.02 });
    for (const [x, y] of [[0.75, 0.5], [0.9, 0.7], [0.6, 0.75]]) sphere(0.06, { pos: [x, y, 0.0], col: C.GOLD_HI, emit: 0.5 });
    cyl(0.18, 0.1, { pos: [-0.3, 0.1, 0.6], col: C.SILVER }); sphere(0.2, { pos: [-0.3, 0.42, 0.6], col: C.GOLD });
    for (const [x, h] of [[-1.1, 0.5], [1.15, 0.35]]) cap([x, 0, -0.5], [x, h, -0.5], 0.06, { col: '#FF8A7A' });
  }),
  // Rainbow Bridge: a drawn rainbow carrying the coin over the gap into the pot.
  inkbridge: () => build(() => {
    for (const [x, w] of [[-1.15, 0.35], [1.15, 0.35]]) box([w, 0.35, 0.4], { pos: [x, 0.35, 0], col: '#7C86A6', r: 0.08 });
    const rb = [C.RED, C.ORANGE, C.GOLD, C.GREEN, C.BLUE, VI];
    rb.forEach((col, k) => { const R0 = 1.1 - k * 0.055; for (let s = 0; s < 12; s++) { const a0 = (s / 12) * Math.PI, a1 = ((s + 1) / 12) * Math.PI; cap([-Math.cos(a0) * R0 * 0.82, 0.7 + Math.sin(a0) * R0 * 0.55, 0], [-Math.cos(a1) * R0 * 0.82, 0.7 + Math.sin(a1) * R0 * 0.55, 0], 0.03, { col }); } });
    cyl(0.12, 0.025, { pos: [-0.55, 1.38, 0.04], rot: [90, 0, 0], col: C.GOLD, r: 0.02 });
    cyl(0.24, 0.15, { pos: [1.15, 0.85, 0], col: C.INK, r: 0.08 }); torus(0.22, 0.04, { pos: [1.15, 1.0, 0], col: C.INK });
    for (const [x, z] of [[1.05, 0.05], [1.2, -0.05]]) cyl(0.08, 0.015, { pos: [x, 1.02, z], col: C.GOLD });
    star(0.12, 0.05, 0.03, { pos: [0.1, 1.55, 0.2], col: C.GREEN });
  }),
  // Gemstone: a board of gems, a line of three about to clear.
  matchup: () => build(() => {
    const at = board(5, 4, { col: '#2E2552', step: 0.5 });
    const cols = [C.PINK, C.BLUE, C.GOLD, C.GREEN];
    const g = [[0, 1, 2, 0, 3], [3, 3, 3, 1, 2], [1, 0, 2, 2, 0], [2, 1, 0, 3, 1]];
    g.forEach((r, j) => r.forEach((k, i) => gem(at(i, j, 0.17), k, cols[k])));
    box([0.72, 0.012, 0.22], { pos: at(1, 1, 0.012), col: C.WHITE, emit: 0.6, r: 0.01 });
  }),
  // Tilt: a wooden maze tray, marbles rolling towards the cups of their colour.
  tilt: () => build(() => {
    box([1.25, 0.08, 1.25], { pos: [0, 0, 0], col: C.WOOD2, r: 0.05 });
    for (const [x, z, w, d] of [[0, -1.2, 1.25, 0.06], [0, 1.2, 1.25, 0.06], [-1.2, 0, 0.06, 1.25], [1.2, 0, 0.06, 1.25], [-0.3, -0.35, 0.06, 0.55], [0.4, 0.3, 0.6, 0.06], [-0.6, 0.55, 0.5, 0.06]]) box([w, 0.1, d], { pos: [x, 0.17, z], col: C.WOOD, r: 0.03 });
    for (const [x, z, col] of [[0.8, -0.8, C.BLUE], [-0.85, 0.9, C.PINK]]) { cyl(0.2, 0.04, { pos: [x, 0.1, z], col: C.GOLD, r: 0.02, cut: [cyl(0.15, 0.05, { pos: [0, 0.03, 0], isCut: true })] }); torus(0.1, 0.02, { pos: [x, 0.09, z], col }); }
    sphere(0.15, { pos: [0.25, 0.23, -0.5], col: C.BLUE }); sphere(0.15, { pos: [-0.15, 0.23, 0.75], col: C.PINK });
  }),
};
export const CAMERAS = { matchup: { tile: { zoomOut: 0.82 } }, tilt: { tile: { zoomOut: 0.9 } } };
