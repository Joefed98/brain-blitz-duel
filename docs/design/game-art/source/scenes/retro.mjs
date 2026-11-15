// Arcade · Retro: bright, slightly glowing game pieces over a dark screen slab with a cyan rim.
import { build } from '../scene.mjs';
import { C, glyph, box, cyl, cap, torus, sphere, cone, prism, star } from '../kit.mjs';
import { ell as ell2 } from '../scene.mjs';
const SCR = '#141A33', RIM = C.CYAN;
const deck = (w, d) => { box([w, 0.08, d], { pos: [0, -0.08, 0], col: SCR, r: 0.06 }); for (const s of [-1, 1]) box([w, 0.03, 0.025], { pos: [0, 0.0, s * d], col: RIM, r: 0.015, emit: 0.6 }); for (const s of [-1, 1]) box([0.025, 0.03, d], { pos: [s * w, 0.0, 0], col: RIM, r: 0.015, emit: 0.6 }); };
const ship = (pos, col, rot = [0, 0, 0], k = 1) => { cap([0, 0, -0.22 * k], [0, 0, 0.18 * k], 0.09 * k, { pos, rot, col }); prism([[-0.3 * k, -0.1 * k], [0.3 * k, -0.1 * k], [0, 0.18 * k]], 0.025 * k, { pos: [pos[0], pos[1], pos[2] + 0.05 * k], rot: [-90 + rot[0], rot[1], rot[2]], col }); };
export const SCENES = {
  // Tempo: notes riding down four lanes onto the glowing pads.
  beat: () => build(() => {
    deck(1.1, 1.5);
    const cols = [C.PINK, C.CYAN, C.GOLD, C.GREEN];
    cols.forEach((col, i) => { const x = (i - 1.5) * 0.52; box([0.22, 0.005, 1.45], { pos: [x, 0.005, 0], col: '#222B4F', r: 0.004 });
      cyl(0.22, 0.06, { pos: [x, 0.06, 1.15], col, emit: i === 2 ? 0.6 : 0.15 });
      for (const z of [[-1.1, -0.3], [-0.6, 0.35], [-1.2, 0.5], [0.1, 0.8]][i]) cyl(0.17, 0.05, { pos: [x, 0.07, z], col: C.WHITE, pattern: { type: 'rings', step: 0.1, cols: [col, C.WHITE] } });
    });
  }),
  // Blockzone: the well filling with four-square pieces, the next one dropping in.
  blockfall: () => build(() => {
    const s = 0.3, W = 6;
    box([W * s / 2 + 0.06, 0.06, s / 2 + 0.06], { pos: [0, 0.06, 0], col: SCR, r: 0.04 });
    for (const sx of [-1, 1]) box([0.05, 1.5, s / 2 + 0.06], { pos: [sx * (W * s / 2 + 0.05), 1.5, 0], col: RIM, r: 0.03, emit: 0.4 });
    const rows = ['OOPPGG', 'BOOPGY', 'BBYYYY'.split('').reverse().join(''), 'B.CCCC'];
    const col = { O: C.ORANGE, P: C.PINK, G: C.GREEN, B: C.BLUE, Y: C.GOLD, C: C.CYAN };
    rows.reverse().forEach((r, j) => [...r].forEach((c, i) => { if (c !== '.') box([s / 2 - 0.01, s / 2 - 0.01, s / 2 - 0.01], { pos: [(i - (W - 1) / 2) * s, 0.12 + s / 2 + j * s, 0], col: col[c], r: 0.05 }); }));
    for (const [i, j] of [[2, 0], [3, 0], [4, 0], [3, 1]]) box([s / 2 - 0.01, s / 2 - 0.01, s / 2 - 0.01], { pos: [(i - 2.5) * s, 2.0 + j * s, 0], col: '#B26BFF', r: 0.05 });
  }),
  // Breaker: the brick wall with its gold brick, the ball heading up from the paddle.
  breaker: () => build(() => {
    deck(1.3, 1.25);
    const cols = [C.PINK, C.ORANGE, C.GOLD, C.GREEN];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) { if (j === 3 && (i === 1 || i === 4)) continue; box([0.19, 0.08, 0.09], { pos: [(i - 2.5) * 0.42, 0.08, -1.0 + j * 0.24], col: j === 1 && i === 3 ? '#FFD86B' : cols[j], r: 0.04, emit: j === 1 && i === 3 ? 0.4 : 0 }); }
    box([0.32, 0.07, 0.07], { pos: [0.1, 0.07, 1.0], col: C.CYAN, r: 0.06, emit: 0.3 });
    sphere(0.1, { pos: [-0.25, 0.1, 0.25], col: C.WHITE });
    cap([-0.25, 0.1, 0.25], [0.05, 0.1, 0.8], 0.035, { col: C.CYAN, emit: 0.5 });
  }),
  // Fission: atoms splitting into smaller ones, the beam rising from the cannon.
  burst: () => build(() => {
    deck(1.3, 1.1);
    const atom = (p, r, col) => { sphere(r, { pos: p, col }); torus(r * 1.6, r * 0.12, { pos: p, rot: [70, 0, 20], col: C.WHITE }); torus(r * 1.6, r * 0.12, { pos: p, rot: [70, 60, -30], col: C.WHITE }); };
    atom([-0.6, 0.9, -0.3], 0.3, C.PINK); atom([0.55, 1.15, -0.45], 0.2, C.GOLD); atom([0.95, 0.85, -0.15], 0.2, C.GOLD);
    cap([0.1, 0.25, 0.8], [0.1, 1.45, 0.8], 0.035, { col: C.CYAN, emit: 0.9 });
    cone(0.2, 0.08, 0.12, { pos: [0.1, 0.12, 0.8], col: C.SILVER });
  }),
  // Spacewalk: an astronaut on a station deck, ships and a comet crossing the lanes.
  cross: () => build(() => {
    box([1.6, 0.08, 1.2], { pos: [0, -0.08, 0], col: SCR, r: 0.06 });
    for (const z of [-0.45, 0.25]) box([1.6, 0.012, 0.25], { pos: [0, 0.01, z], col: '#3C2A7A', r: 0.01, emit: 0.2 });
    box([1.6, 0.04, 0.2], { pos: [0, 0.04, 0.95], col: '#566087', r: 0.03 });
    ship([-0.8, 0.22, -0.45], C.SILVER, [0, 90, 0], 1.3); ship([0.75, 0.22, 0.25], C.ORANGE, [0, -90, 0], 1.3);
    sphere(0.13, { pos: [0.3, 0.3, -0.45], col: C.GOLD_HI, emit: 0.5 }); cap([0.3, 0.3, -0.45], [0.95, 0.3, -0.45], 0.06, { col: C.CYAN, emit: 0.6 });
    const a = [0.0, 0.0, 0.85];
    cap([a[0], 0.2, a[2]], [a[0], 0.38, a[2]], 0.15, { col: C.WHITE });
    sphere(0.16, { pos: [a[0], 0.66, a[2]], col: C.WHITE }); ell2([0.11, 0.08, 0.06], { pos: [a[0], 0.67, a[2] + 0.12], col: C.GOLD });
    box([0.1, 0.12, 0.06], { pos: [a[0], 0.4, a[2] - 0.16], col: C.SILVER, r: 0.03 });
  }),
  // Hover: a little craft threading the gap in a row of barriers.
  hover: () => build(() => {
    deck(1.4, 1.2);
    for (const [z, gap] of [[-0.8, 0.4], [0.2, -0.5]]) { for (const [x0, x1] of [[-1.35, gap - 0.35], [gap + 0.35, 1.35]]) box([(x1 - x0) / 2, 0.22, 0.08], { pos: [(x0 + x1) / 2, 0.22, z], col: C.PINK, r: 0.05, emit: 0.25 }); }
    const p = [-0.45, 0.55, 0.65];
    ell2([0.32, 0.09, 0.32], { pos: p, col: C.SILVER }); sphere(0.14, { pos: [p[0], p[1] + 0.08, p[2]], col: C.CYAN, emit: 0.2 });
    torus(0.3, 0.025, { pos: [p[0], p[1] - 0.05, p[2]], col: C.GOLD, emit: 0.5 });
    for (const [x, z] of [[0.6, -0.2], [-0.95, -0.25], [0.95, 0.75]]) star(0.1, 0.045, 0.03, { pos: [x, 0.25, z], rot: [-20, 0, 0], col: C.GOLD });
  }),
  // Pinball: the tilted table, bumpers, flippers and the ball.
  pinball: () => build(() => {
    box([1.0, 0.06, 1.45], { pos: [0, -0.06, 0], col: '#3A1E66', r: 0.05 });
    for (const s of [-1, 1]) box([0.05, 0.1, 1.45], { pos: [s * 1.0, 0.06, 0], col: C.CYAN, r: 0.03, emit: 0.4 });
    box([1.0, 0.1, 0.05], { pos: [0, 0.06, -1.45], col: C.CYAN, r: 0.03, emit: 0.4 });
    for (const [x, z, c] of [[-0.42, -0.8, C.PINK], [0.4, -0.9, C.CYAN], [0, -0.35, C.GOLD]]) { cyl(0.17, 0.1, { pos: [x, 0.1, z], col: c, emit: 0.3 }); cyl(0.22, 0.03, { pos: [x, 0.22, z], col: C.WHITE }); }
    for (const s of [-1, 1]) cap([s * 0.6, 0.07, 0.95], [s * 0.18, 0.07, 1.18], 0.07, { col: C.GOLD });
    sphere(0.12, { pos: [0.2, 0.12, 0.35], col: C.SILVER });
    for (const x of [-0.35, 0, 0.35]) box([0.1, 0.012, 0.06], { pos: [x, 0.012, 0.05], col: C.ORANGE, emit: 0.5, r: 0.01 });
    prism([[-0.12, 0], [0.12, 0], [0, 0.2]], 0.012, { pos: [-0.65, 0.012, 0.45], rot: [-90, 0, 0], col: C.LIME, emit: 0.4 });
  }),
  // Rally: the court, two paddles, the warm ball mid-rally.
  rally: () => build(() => {
    deck(1.0, 1.45);
    box([1.0, 0.012, 0.015], { pos: [0, 0.01, 0], col: C.WHITE, r: 0.006, emit: 0.4 });
    box([0.3, 0.07, 0.06], { pos: [-0.3, 0.07, -1.3], col: C.PINK, r: 0.05, emit: 0.3 });
    box([0.3, 0.07, 0.06], { pos: [0.25, 0.07, 1.3], col: C.CYAN, r: 0.05, emit: 0.3 });
    for (let k = 0; k < 5; k++) sphere(0.11 - k * 0.018, { pos: [0.15 - k * 0.09, 0.3, 0.3 + k * 0.17], col: k ? '#FF8A3D' : '#FFE0A0', emit: 0.3 + 0.1 * k });
    box([0.2, 0.012, 0.08], { pos: [0.6, 0.012, -0.6], col: C.GOLD, r: 0.01, emit: 0.5 });
  }),
  // Meteor: the comet weaving across the grid towards a gold star.
  snake: () => build(() => {
    deck(1.3, 1.1);
    const path = [[-1.0, 0.6], [-0.6, 0.6], [-0.25, 0.45], [0.0, 0.1], [0.3, -0.15], [0.65, -0.2]];
    path.forEach(([x, z], i) => sphere(0.08 + i * 0.025, { pos: [x, 0.08 + i * 0.025, z], col: i === path.length - 1 ? '#FFF4D6' : ['#3DDC84', '#36E2F5', '#4D8CFF', '#B26BFF', '#FF6BD6'][i], emit: i === path.length - 1 ? 0.6 : 0.2 }));
    star(0.2, 0.09, 0.05, { pos: [1.0, 0.24, -0.55], rot: [-15, -20, 0], col: C.GOLD, emit: 0.3 });
    star(0.13, 0.06, 0.04, { pos: [-0.7, 0.18, -0.6], rot: [-15, 10, 0], col: C.WHITE, emit: 0.3 });
    box([0.18, 0.15, 0.18], { pos: [0.3, 0.15, 0.6], col: '#6A7392', r: 0.07 });
  }),
  // Wavefront: a formation of enemy ships, the player's ship firing up at them.
  wavefront: () => build(() => {
    deck(1.3, 1.25);
    const enemy = (x, z, col) => { box([0.18, 0.07, 0.1], { pos: [x, 0.25, z], col: '#4A5068', r: 0.04 }); for (const s of [-1, 1]) prism([[0, 0.1], [0.16, -0.06], [0, -0.06]], 0.02, { pos: [x + s * 0.17, 0.25, z], rot: [-90, s < 0 ? 180 : 0, 0], col }); box([0.14, 0.02, 0.02], { pos: [x, 0.33, z + 0.08], col, emit: 0.7, r: 0.01 }); };
    for (let j = 0; j < 2; j++) for (let i = 0; i < 4; i++) enemy((i - 1.5) * 0.55 + j * 0.2, -0.9 + j * 0.42, j ? C.ORANGE : C.PINK);
    ship([0.05, 0.2, 0.95], C.CYAN, [0, 180, 0], 1.4);
    for (const z of [0.45, 0.0]) cap([0.05, 0.22, z], [0.05, 0.22, z - 0.18], 0.035, { col: C.LIME, emit: 0.9 });
  }),
};
const crop = { tile: { zoomOut: 0.78 }, hero: { zoomOut: 0.9 } };
export const CAMERAS = Object.fromEntries(Object.keys(SCENES).filter((k) => k !== 'blockfall').map((k) => [k, crop]));
