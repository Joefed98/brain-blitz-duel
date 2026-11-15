// Speed: orange action pieces caught mid-move on a dark plinth.
import { build } from '../scene.mjs';
import { C, glyph, tile, upTile, slab, box, cyl, cap, torus, sphere, cone, prism, star } from '../kit.mjs';
const O = C.ORANGE;
const heart = () => { const p = []; for (let i = 0; i < 24; i++) { const t = (i / 24) * Math.PI * 2; p.push([(16 * Math.sin(t) ** 3) / 50, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 50]); } return p; };
export const SCENES = {
  // Don't Break the Chain: charms on a chain, in the cycle's order, the next one lit.
  chain: () => build(() => {
    const pts = [[-1.3, 0.35, 0.2], [-0.45, 0.35, -0.15], [0.45, 0.35, 0.15], [1.3, 0.35, -0.2]];
    for (let i = 0; i < 3; i++) { const a = pts[i], b = pts[i + 1]; for (let k = 1; k < 4; k++) { const t = k / 4; const p = a.map((v, j) => v + (b[j] - v) * t); const yaw = (Math.atan2(b[2] - a[2], b[0] - a[0]) * -180) / Math.PI; torus(0.12, 0.04, { pos: p, rot: [k % 2 ? 90 : 0, yaw, 0], col: C.SILVER }); } }
    star(0.34, 0.15, 0.09, { pos: pts[0], rot: [-10, 0, 0], col: C.GOLD });
    torus(0.22, 0.08, { pos: pts[1], rot: [80, 0, 0], col: C.RED });
    sphere(0.27, { pos: pts[2], col: C.BLUE });
    prism([[0, 0.34], [0.3, 0], [0, -0.34], [-0.3, 0]], 0.1, { pos: pts[3], rot: [-10, 0, 0], col: O, r: 0.04, emit: 0.25 });
    slab(1.8, 0.6, { col: '#2A2236', h: 0.06 });
  }),
  // Pull!: clays flying out of the trap, one breaking into pieces.
  clayshoot: () => build(() => {
    box([0.42, 0.22, 0.32], { pos: [-1.1, 0.22, 0.3], col: C.NAVY2, r: 0.06 });
    cap([-1.1, 0.4, 0.3], [-0.75, 0.62, 0.2], 0.06, { col: C.SILVER });
    const clay = (pos, rot) => cone(0.5, 0.3, 0.09, { pos, rot, col: O, r: 0.03 });
    clay([-0.25, 0.95, 0.1], [-14, 0, 18]); clay([0.6, 1.45, -0.2], [-20, 0, 12]);
    for (const [x, y, z, a] of [[1.25, 0.9, 0.3, 30], [1.5, 1.1, 0.15, -40], [1.35, 0.65, 0.05, 80], [1.6, 0.75, 0.35, 10]]) prism([[0, 0.22], [0.2, -0.09], [-0.15, -0.15]], 0.045, { pos: [x, y, z], rot: [a, a * 2, a], col: O });
    torus(0.55, 0.03, { pos: [1.42, 0.85, 0.2], rot: [90, 0, 0], col: C.GOLD_HI, emit: 0.5 });
  }),
  // Ascend: numbered discs scattered, the lowest ones already tapped gold.
  numhunt: () => build(() => {
    slab(1.55, 1.15, { col: '#2A2236' });
    const n = [['1', -1.05, -0.6], ['2', -0.25, -0.75], ['3', 0.6, -0.55], ['4', 1.15, 0.1], ['5', -0.6, 0.15], ['6', 0.25, 0.25], ['7', -1.15, 0.7], ['8', 0.75, 0.75], ['9', -0.15, 0.85]];
    n.forEach(([t, x, z], i) => cyl(0.28, 0.07, { pos: [x, i < 3 ? 0.07 : 0.1, z], col: i < 3 ? C.GOLD : i === 3 ? O : C.CREAM, r: 0.05, decal: { cell: glyph(t, C.INK, 0.7), face: 'y', w: 0.26 } }));
  }),
  // Flash: one big button, lit gold the instant it turns.
  reaction: () => build(() => {
    cyl(0.95, 0.16, { pos: [0, 0.16, 0], col: '#2A2236', r: 0.08 });
    torus(0.78, 0.07, { pos: [0, 0.33, 0], col: C.SILVER });
    cyl(0.7, 0.16, { pos: [0, 0.42, 0], col: C.GOLD, r: 0.14, emit: 0.35 });
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; box([0.12, 0.03, 0.03], { pos: [Math.cos(a) * 1.25, 0.85, Math.sin(a) * 1.25 * 0.6], rot: [0, (-a * 180) / Math.PI, 0], col: C.GOLD_HI, emit: 0.6, r: 0.02 }); }
  }),
  // Tenfall: number blocks falling into the stack, the running total shown above.
  tendrop: () => build(() => {
    box([0.75, 0.05, 0.4], { pos: [0, 0.05, 0], col: '#2A2236', r: 0.04 });
    for (const x of [-0.72, 0.72]) box([0.04, 0.9, 0.4], { pos: [x, 0.9, 0], col: C.NAVY2, r: 0.03 });
    upTile('3', { pos: [-0.33, 0.38, 0], s: 0.3, d: 0.3, col: C.CREAM }); upTile('4', { pos: [0.33, 0.38, 0], s: 0.3, d: 0.3, col: C.CREAM });
    upTile('2', { pos: [-0.33, 1.0, 0], s: 0.3, d: 0.3, col: C.CREAM });
    upTile('1', { pos: [0.3, 1.55, 0], s: 0.3, d: 0.3, col: O, rot: [0, 0, 8] });
    box([0.55, 0.26, 0.08], { pos: [0, 2.15, 0], col: '#1B2236', r: 0.05, decal: { cell: glyph('10', O, 0.75), face: 'z', w: 0.4, h: 0.22, emit: 0.8 } });
  }),
  // Bonk: three burrows, gophers in hats popping up, a soft mallet coming down.
  whack: () => build(() => {
    box([1.6, 0.14, 0.75], { pos: [0, 0.14, 0], col: C.GRASS, r: 0.12 });
    const gopher = (x, z, hat, up) => {
      cyl(0.3, 0.03, { pos: [x, 0.28, z], col: '#3A2A1C' });
      const y = 0.28 + up;
      cap([x, 0.28, z], [x, y, z], 0.24, { col: '#B07A4A' });
      sphere(0.07, { pos: [x - 0.17, y + 0.14, z], col: '#B07A4A' }); sphere(0.07, { pos: [x + 0.17, y + 0.14, z], col: '#B07A4A' });
      for (const s of [-1, 1]) sphere(0.04, { pos: [x + s * 0.09, y + 0.04, z + 0.21], col: C.INK });
      ell([0.08, 0.05, 0.04], { pos: [x, y - 0.06, z + 0.22], col: '#F2C9A8' });
      if (hat === 'party') cone(0.17, 0.02, 0.2, { pos: [x, y + 0.37, z], col: C.BLUE, pattern: { type: 'bands', axis: 'y', from: -0.2, step: 0.1, cols: [C.BLUE, C.WHITE, C.BLUE, C.WHITE] } });
      if (hat === 'top') { cyl(0.26, 0.02, { pos: [x, y + 0.2, z], col: C.INK }); cyl(0.15, 0.15, { pos: [x, y + 0.36, z], col: C.INK, pattern: { type: 'stripe', w: 0.03, col: O } }); }
    };
    gopher(-0.95, 0.15, 'party', 0.32); gopher(0.0, -0.25, 'top', 0.5); gopher(0.95, 0.2, null, 0.0);
    cap([0.35, 1.25, -0.05], [1.0, 1.55, 0.35], 0.05, { col: C.WOOD2 });
    cyl(0.2, 0.28, { pos: [0.22, 1.18, -0.12], rot: [0, -30, 70], col: O, r: 0.12 });
  }),
};
import { ell } from '../scene.mjs';
export const CAMERAS = { numhunt: { tile: { zoomOut: 0.85 } } };
