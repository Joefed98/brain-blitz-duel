// Arcade · Sports: the kit for each sport, glossy and toy-like, on its own patch of playing surface.
import { build, ell } from '../scene.mjs';
import { C, glyph, box, cyl, cap, torus, sphere, cone, prism, star } from '../kit.mjs';
const stone = (x, z, col) => { cyl(0.26, 0.1, { pos: [x, 0.1, z], col: '#9BA3B5', r: 0.08, pattern: { type: 'stripe', w: 0.035, col: '#C9CFDD' } }); cyl(0.2, 0.03, { pos: [x, 0.22, z], col }); cap([x - 0.05, 0.27, z], [x + 0.14, 0.27, z], 0.04, { col }); };
export const SCENES = {
  // Curl Champ: the house painted in the ice, a gold stone on the button beating two reds.
  curling: () => build(() => {
    box([1.5, 0.05, 1.3], { pos: [0, -0.05, 0], col: '#E6F2FA', r: 0.04 });
    cyl(1.0, 0.004, { pos: [0, 0.002, -0.1], col: '#E6F2FA', pattern: { type: 'rings', step: 0.25, cols: [C.RED, '#F4F8FB', C.BLUE, '#F4F8FB'], edge: true } });
    stone(0.05, -0.12, C.GOLD); stone(-0.55, 0.15, C.RED); stone(0.62, -0.55, C.RED); stone(0.35, 0.85, C.GOLD);
    cap([-0.9, 0.06, 0.95], [-0.45, 0.06, 0.6], 0.02, { col: '#6FB7FF', emit: 0.3 });
  }),
  // Top Bins: the goal, a wall of training dummies, the ball curling to the gold hoop in the corner.
  freekick: () => build(() => {
    box([1.7, 0.03, 1.2], { pos: [0, -0.03, 0], col: C.GRASS, r: 0.02, pattern: { type: 'bands', axis: 'z', from: -1.2, step: 0.3, cols: ['#3E9A47', '#46A84F', '#3E9A47', '#46A84F', '#3E9A47', '#46A84F', '#3E9A47', '#46A84F'] } });
    const G = [-1.1, 1.1], top = 0.9, z = -0.8;
    for (const x of G) cap([x, 0, z], [x, top, z], 0.045, { col: C.WHITE });
    cap([G[0], top, z], [G[1], top, z], 0.045, { col: C.WHITE });
    box([1.1, top / 2, 0.01], { pos: [0, top / 2, z - 0.35], col: '#DDE6EE', r: 0.005, decal: { cell: { paint: 'grid', col: '#9AA8B8', n: 10, w: 3 }, face: 'z', w: 1.1, h: top / 2 } });
    torus(0.18, 0.03, { pos: [0.82, 0.68, z + 0.02], rot: [90, 0, 0], col: C.GOLD, emit: 0.4 });
    for (const x of [-0.45, -0.15, 0.15]) { cap([x, 0.1, -0.05], [x, 0.5, -0.05], 0.13, { col: C.BLUE }); sphere(0.1, { pos: [x, 0.74, -0.05], col: C.BLUE }); }
    sphere(0.14, { pos: [0.55, 0.62, -0.35], col: C.WHITE, pattern: { type: 'stripe', w: 0.035, col: C.INK } });
    sphere(0.14, { pos: [0.1, 0.14, 0.8], col: C.WHITE, pattern: { type: 'stripe', w: 0.035, col: C.INK } });
    for (let k = 0; k < 6; k++) { const t = k / 6; sphere(0.025, { pos: [0.1 + 0.45 * t + 0.35 * Math.sin(t * Math.PI), 0.14 + 0.48 * t, 0.8 - 1.15 * t], col: C.WHITE, emit: 0.4 }); }
  }),
  // Home Run: the bat meeting the ball over the plate, the ball flying off.
  homerun: () => build(() => {
    box([1.4, 0.03, 1.1], { pos: [0, -0.03, 0], col: '#B9774A', r: 0.02 });
    cyl(0.75, 0.005, { pos: [0.6, 0.004, -0.6], col: C.GRASS });
    prism([[-0.25, 0.12], [0.25, 0.12], [0.25, -0.05], [0, -0.25], [-0.25, -0.05]], 0.012, { pos: [-0.2, 0.012, 0.45], rot: [-90, 0, 0], col: C.WHITE });
    cone(0.07, 0.035, 0.6, { pos: [-0.35, 0.75, 0.2], rot: [0, 30, -70], col: C.WOOD2, r: 0.03 });
    sphere(0.045, { pos: [-0.9, 0.55, 0.05], col: C.INK });
    sphere(0.15, { pos: [0.6, 0.95, -0.3], col: C.WHITE, pattern: { type: 'stripe', axis: 'x', w: 0.012, col: C.RED } });
    for (let k = 1; k < 5; k++) sphere(0.05, { pos: [0.6 - k * 0.22, 0.95 - k * 0.07, -0.3 + k * 0.12], col: C.WHITE, emit: 0.3 });
  }),
  // Crazy Golf: a hole with a little windmill, the ball rolling up to the flag.
  minigolf: () => build(() => {
    box([1.3, 0.05, 1.0], { pos: [0, 0.05, 0], col: C.GRASS, r: 0.04, cut: [cyl(0.1, 0.1, { pos: [0.75, 0.06, -0.45], isCut: true })] });
    for (const [x, z, w, d] of [[0, -1.0, 1.35, 0.06], [0, 1.0, 1.35, 0.06], [-1.3, 0, 0.06, 1.0], [1.3, 0, 0.06, 1.0]]) box([w, 0.1, d], { pos: [x, 0.12, z], col: C.WOOD2, r: 0.04 });
    cap([0.75, 0.1, -0.45], [0.75, 0.95, -0.45], 0.02, { col: C.WHITE }); prism([[0, 0], [0.3, -0.09], [0, -0.2]], 0.012, { pos: [0.77, 0.95, -0.45], col: C.RED });
    box([0.2, 0.32, 0.2], { pos: [-0.5, 0.42, -0.35], col: C.CREAM, r: 0.04 }); prism([[-0.25, 0], [0.25, 0], [0, 0.25]], 0.22, { pos: [-0.5, 0.74, -0.35], col: C.RED });
    for (const a of [0, 90, 180, 270]) box([0.05, 0.3, 0.015], { pos: [-0.5, 0.72, -0.12], rot: [0, 0, a + 20], col: C.WHITE, r: 0.01 }).pos = [-0.5 + Math.cos(((a + 110) * Math.PI) / 180) * 0.3, 0.72 + Math.sin(((a + 110) * Math.PI) / 180) * 0.3, -0.12];
    sphere(0.08, { pos: [0.2, 0.18, 0.15], col: C.WHITE });
    cap([0.15, 0.2, 0.75], [0.5, 1.0, 1.05], 0.025, { col: C.SILVER }); box([0.14, 0.05, 0.05], { pos: [0.13, 0.16, 0.72], col: C.INK, r: 0.03 });
  }),
  // Cue Ball: the cue lined up behind the white, spots and stripes on the felt.
  pool: () => build(() => {
    box([1.5, 0.06, 1.05], { pos: [0, -0.06, 0], col: C.FELT, r: 0.03 });
    for (const [x, z] of [[-1.5, -1.05], [0, -1.08], [1.5, -1.05]]) cyl(0.12, 0.004, { pos: [x * 0.98, 0.002, z * 0.98], col: C.INK });
    box([1.55, 0.09, 0.07], { pos: [0, 0.03, -1.1], col: C.WOOD, r: 0.04 });
    const ball = (x, z, col, stripe) => sphere(0.17, { pos: [x, 0.17, z], col: stripe ? C.CREAM : col, pattern: stripe ? { type: 'stripe', w: 0.075, col } : undefined });
    ball(0.25, -0.25, C.RED); ball(0.62, -0.42, C.GOLD, true); ball(0.6, -0.05, C.BLUE, true); ball(0.95, -0.25, C.INK); ball(0.98, 0.1, C.GREEN);
    ball(-0.45, 0.35, C.CREAM);
    cap([-0.68, 0.24, 0.6], [-1.6, 0.5, 1.4], 0.035, { col: C.WOOD2 }); cap([-0.62, 0.22, 0.55], [-0.68, 0.24, 0.6], 0.03, { col: C.BLUE });
  }),
  // Apex: a race car on the kerb at sunset, the start lights over the track.
  racing: () => build(() => {
    box([1.6, 0.03, 1.1], { pos: [0, -0.03, 0], col: '#3A3F4E', r: 0.02 });
    box([1.6, 0.02, 0.1], { pos: [0, 0.0, 0.85], col: C.WHITE, r: 0.01, pattern: { type: 'bands', axis: 'x', from: -1.6, step: 0.2, cols: [C.RED, C.WHITE, C.RED, C.WHITE, C.RED, C.WHITE, C.RED, C.WHITE, C.RED, C.WHITE, C.RED, C.WHITE, C.RED, C.WHITE, C.RED, C.WHITE] } });
    const car = [0, 0, 0.2];
    ell([0.75, 0.12, 0.26], { pos: [car[0], 0.2, car[2]], col: C.RED });
    ell([0.22, 0.1, 0.14], { pos: [car[0] - 0.1, 0.3, car[2]], col: C.INK });
    box([0.08, 0.03, 0.34], { pos: [car[0] - 0.72, 0.38, car[2]], col: C.RED, r: 0.02 }); box([0.025, 0.08, 0.02], { pos: [car[0] - 0.7, 0.3, car[2]], col: C.INK, r: 0.01 });
    box([0.06, 0.02, 0.34], { pos: [car[0] + 0.72, 0.12, car[2]], col: C.INK, r: 0.01 });
    for (const [x, z] of [[-0.45, 0.3], [-0.45, -0.3], [0.45, 0.28], [0.45, -0.28]]) cyl(0.13, 0.07, { pos: [x, 0.13, car[2] + z], rot: [90, 0, 0], col: '#1A1A20', r: 0.04, pattern: { type: 'rings', step: 0.06, cols: [C.SILVER, '#1A1A20'] } });
    box([0.7, 0.07, 0.05], { pos: [0.1, 1.1, -0.85], col: C.INK, r: 0.03 });
    for (let k = 0; k < 5; k++) sphere(0.06, { pos: [-0.38 + k * 0.2, 1.1, -0.8], col: k < 3 ? C.RED : '#3A1515', emit: k < 3 ? 0.8 : 0 });
    for (const x of [-0.65, 0.85]) cap([x, 0, -0.85], [x, 1.1, -0.85], 0.03, { col: C.SILVER });
  }),
};
export const CAMERAS = {};
