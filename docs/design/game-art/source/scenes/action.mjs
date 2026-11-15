// Arcade · Action: Captain Joulz as a glossy toy figure, big moving set pieces, red accents.
import { build, group, ell } from '../scene.mjs';
import { C, glyph, box, cyl, cap, torus, sphere, cone, prism, star } from '../kit.mjs';
const R = '#FF4D4D';
/** Captain Joulz, the app's own hero (src/lib/arcade/hero.renderer.ts) as a toy: black suit edged gold, gold cape,
 *  gloves and boots, a masked head. pose: 'run' | 'leap' | 'hang'. About 1.2 tall, feet at y = 0. */
export function captain({ pos = [0, 0, 0], rot = [0, 0, 0], pose = 'run', scale = 1 } = {}) {
  return group(() => {
    const K = '#17171D', G = C.GOLD;
    cap([0, 0.62, 0], [0, 0.9, 0], 0.17, { col: K });
    box([0.14, 0.03, 0.12], { pos: [0, 0.82, 0.12], col: G, r: 0.02, rot: [0, 0, 0] });
    prism([[-0.06, 0.06], [0.04, 0.06], [0, 0], [0.05, 0], [-0.04, -0.08], [0, -0.01], [-0.05, -0.01]], 0.015, { pos: [0, 0.76, 0.16], col: G });
    sphere(0.17, { pos: [0, 1.13, 0], col: K }); box([0.17, 0.035, 0.1], { pos: [0, 1.15, 0.1], col: G, r: 0.03 });
    prism([[-0.2, 0.3], [0.2, 0.3], [0.34, -0.42], [-0.34, -0.42]], 0.02, { pos: [0, 0.68, -0.2], rot: [pose === 'leap' ? -35 : -18, 0, 0], col: G });
    const limb = (a, b, end, endR) => { cap(a, b, 0.065, { col: K }); sphere(endR, { pos: end, col: G }); };
    if (pose === 'run') { limb([0.1, 0.55, 0], [0.18, 0.08, 0.2], [0.18, 0.06, 0.25], 0.085); limb([-0.1, 0.55, 0], [-0.15, 0.25, -0.25], [-0.15, 0.2, -0.3], 0.085);
      limb([0.17, 0.92, 0], [0.32, 0.65, -0.18], [0.33, 0.6, -0.2], 0.075); limb([-0.17, 0.92, 0], [-0.3, 0.75, 0.25], [-0.3, 0.73, 0.28], 0.075); }
    if (pose === 'leap') { limb([0.1, 0.55, 0], [0.22, 0.25, 0.2], [0.22, 0.22, 0.24], 0.085); limb([-0.1, 0.55, 0], [-0.2, 0.32, -0.15], [-0.2, 0.3, -0.18], 0.085);
      limb([0.17, 0.92, 0], [0.38, 1.3, 0.05], [0.4, 1.35, 0.05], 0.075); limb([-0.17, 0.92, 0], [-0.35, 1.25, -0.05], [-0.37, 1.3, -0.05], 0.075); }
    if (pose === 'hang') { limb([0.1, 0.55, 0], [0.16, 0.12, 0.05], [0.16, 0.1, 0.08], 0.085); limb([-0.1, 0.55, 0], [-0.08, 0.15, 0.2], [-0.08, 0.13, 0.23], 0.085);
      limb([0.17, 0.92, 0], [0.12, 1.5, 0], [0.12, 1.55, 0], 0.075); limb([-0.17, 0.92, 0], [-0.08, 1.5, 0], [-0.08, 1.55, 0], 0.075); }
  }, { pos, rot, scale });
}
const tank = (pos, yaw, col) => group(() => {
  box([0.34, 0.1, 0.22], { pos: [0, 0.18, 0], col, r: 0.06 });
  for (const s of [-1, 1]) cap([-0.3, 0.09, s * 0.22], [0.3, 0.09, s * 0.22], 0.085, { col: '#2A2D36' });
  cyl(0.15, 0.07, { pos: [-0.02, 0.33, 0], col, r: 0.05 }); cap([0.1, 0.34, 0], [0.48, 0.36, 0], 0.035, { col });
  sphere(0.05, { pos: [0.2, 0.27, 0.13], col: C.GOLD_HI, emit: 0.8 });
}, { pos, rot: [0, yaw, 0] });
export const SCENES = {
  // Iron Wall: the crosshair on a tank's weak spot as the wave rolls up the road, a drone overhead.
  bastion: () => build(() => {
    box([1.6, 0.04, 1.2], { pos: [0, -0.04, 0], col: '#5B5F52', r: 0.02 });
    box([0.5, 0.012, 1.2], { pos: [0, 0.004, 0], col: '#3E4148', r: 0.01 });
    tank([0.05, 0, 0.3], 100, '#7A8A5A'); tank([-0.35, 0, -0.65], 80, '#6E7A55'); tank([0.5, 0, -0.75], 95, '#6E7A55');
    torus(0.22, 0.025, { pos: [0.18, 0.5, 0.42], rot: [75, 0, 0], col: R, emit: 0.6 });
    for (const [a, b] of [[[0.18, 0.5, 0.42], [0.18, 0.78, 0.5]], [[0.18, 0.5, 0.42], [0.46, 0.5, 0.42]], [[0.18, 0.5, 0.42], [-0.1, 0.5, 0.42]]]) cap(a.map((v, i) => v + (b[i] - v) * 0.6), b, 0.012, { col: R, emit: 0.6 });
    box([0.13, 0.03, 0.1], { pos: [-0.7, 1.0, -0.2], col: '#3A3F52', r: 0.02 }); for (const s of [-1, 1]) for (const t of [-1, 1]) cyl(0.07, 0.008, { pos: [-0.7 + s * 0.14, 1.04, -0.2 + t * 0.12], col: C.SILVER });
    box([1.6, 0.18, 0.08], { pos: [0, 0.18, 1.18], col: '#8A8F9C', r: 0.04, pattern: { type: 'bands', axis: 'x', from: -1.6, step: 0.4, cols: ['#8A8F9C', '#7B808D', '#8A8F9C', '#7B808D', '#8A8F9C', '#7B808D', '#8A8F9C', '#7B808D'] } });
  }),
  // Roofbound: the cave floor and roof, spikes on both, the Captain mid-flip between them.
  flip: () => build(() => {
    box([1.0, 0.1, 0.45], { pos: [0, 0, 0], col: '#4A3B58', r: 0.06 });
    box([1.0, 0.1, 0.45], { pos: [0, 1.75, 0], col: '#4A3B58', r: 0.06 });
    cone(0.14, 0.01, 0.2, { pos: [0.7, 0.3, 0], col: C.SILVER });
    cone(0.14, 0.01, 0.2, { pos: [-0.7, 1.45, 0], rot: [180, 0, 0], col: C.SILVER });
    captain({ pos: [-0.15, 0.4, 0.05], rot: [0, 90, 125], pose: 'leap', scale: 1.0 });
    for (let k = 0; k < 4; k++) sphere(0.03, { pos: [-0.75 + k * 0.13, 0.25 + k * 0.12, 0.1], col: '#FF8A3D', emit: 0.6 });
  }),
  // Orbit: the rocket leaving one planet's orbit for the next, the sun beyond.
  orbit: () => build(() => {
    sphere(0.42, { pos: [-0.9, 0.5, 0.2], col: C.BLUE }); torus(0.7, 0.012, { pos: [-0.9, 0.5, 0.2], rot: [12, 0, 8], col: '#FFFFFF', emit: 0.3 });
    sphere(0.3, { pos: [0.75, 0.9, -0.4], col: C.ORANGE }); torus(0.55, 0.012, { pos: [0.75, 0.9, -0.4], rot: [12, 0, -8], col: '#FFFFFF', emit: 0.3 });
    sphere(0.22, { pos: [1.25, 1.7, -1.2], col: C.GOLD_HI, emit: 0.85 });
    const rk = [-0.05, 0.85, 0.1];
    group(() => { cap([0, -0.18, 0], [0, 0.18, 0], 0.09, { col: C.WHITE }); cone(0.09, 0.005, 0.1, { pos: [0, 0.32, 0], col: R }); for (const a of [0, 120, 240]) prism([[0, 0], [0.12, -0.08], [0, 0.1]], 0.01, { pos: [0, -0.15, 0], rot: [0, a, 0], col: R }); cone(0.05, 0.1, 0.08, { pos: [0, -0.33, 0], rot: [180, 0, 0], col: C.GOLD_HI, emit: 0.8 }); }, { pos: rk, rot: [0, 0, -55] });
    for (const [x, y, z] of [[0.3, 1.25, 0.6], [-0.4, 1.4, -0.6], [1.3, 0.3, 0.2]]) star(0.05, 0.022, 0.015, { pos: [x, y, z], col: C.WHITE, emit: 0.6 });
  }),
  // Moon Climb: two temple walls under the moon, the Captain leaping between them past a lantern.
  ricochet: () => build(() => {
    for (const s of [-1, 1]) box([0.24, 1.3, 0.45], { pos: [s * 0.72, 1.3, 0], col: '#5A4E78', r: 0.05, pattern: { type: 'bands', axis: 'y', from: 0, step: 0.25, cols: ['#5A4E78', '#4F446A', '#5A4E78', '#4F446A', '#5A4E78', '#4F446A', '#5A4E78', '#4F446A', '#5A4E78', '#4F446A', '#5A4E78', '#4F446A'] } });
    box([0.12, 0.03, 0.2], { pos: [-0.4, 0.7, 0], col: C.WOOD2, r: 0.015 });
    sphere(0.38, { pos: [0.3, 2.55, -1.0], col: '#F3EED9', emit: 0.7 });
    captain({ pos: [-0.05, 0.85, 0.4], rot: [0, 28, -16], pose: 'leap', scale: 0.95 });
    ell([0.11, 0.15, 0.11], { pos: [-0.35, 2.3, 0.2], col: R, emit: 0.4 }); cyl(0.05, 0.02, { pos: [-0.35, 2.46, 0.2], col: C.GOLD });
  }),
  // High Rise: the tower of floors, the next block swinging in on the crane hook.
  skyline: () => build(() => {
    const win = { paint: 'grid', col: '#2A3558', n: 3, w: 6 };
    const cols = ['#4D8CFF', '#FF8A3D', '#3DDC84', '#FF6BD6', '#FFD43D'];
    for (let k = 0; k < 4; k++) box([0.42, 0.18, 0.42], { pos: [(k % 2 ? 0.05 : -0.04) * k, 0.18 + k * 0.36, 0], col: cols[k], r: 0.04, decal: { cell: win, face: 'z', w: 0.36, h: 0.14 } });
    box([0.42, 0.18, 0.42], { pos: [0.55, 2.05, 0], rot: [0, 0, -8], col: cols[4], r: 0.04, decal: { cell: win, face: 'z', w: 0.36, h: 0.14 } });
    cap([0.55, 2.25, 0], [0.62, 2.85, 0], 0.012, { col: C.INK }); torus(0.05, 0.015, { pos: [0.55, 2.25, 0], rot: [90, 0, 0], col: C.SILVER });
    box([1.2, 0.04, 0.04], { pos: [0.2, 2.88, 0], col: C.GOLD, r: 0.02 });
    box([1.0, 0.03, 0.8], { pos: [0, -0.03, 0], col: '#4A4F60', r: 0.02 });
  }),
  // Grappler: the Captain swinging on a vine over the river towards the next tree.
  swing: () => build(() => {
    box([1.6, 0.04, 0.9], { pos: [0, -0.04, 0], col: '#2F7A8F', r: 0.02 });
    for (const s of [-1, 1]) { cyl(0.13, 0.85, { pos: [s * 1.25, 0.85, -0.2], col: C.WOOD }); box([0.32, 0.05, 0.3], { pos: [s * 1.25 - s * 0.05, 0.9, 0.05], col: '#6B4A33', r: 0.03 }); ell([0.5, 0.25, 0.45], { pos: [s * 1.25, 1.85, -0.2], col: '#2E8B4A' }); }
    ell([0.7, 0.18, 0.4], { pos: [0, 2.2, -0.3], col: '#25914A' });
    sphere(0.06, { pos: [-0.1, 2.0, 0], col: C.GOLD, emit: 0.4 });
    cap([-0.1, 2.0, 0], [0.35, 1.45, 0.05], 0.025, { col: '#3E8A3A' });
    captain({ pos: [0.6, 0.1, 0.05], rot: [0, 25, -32], pose: 'hang', scale: 0.85 });
    captain({ pos: [0.5, 0.42, 0.05], rot: [0, 25, -30], pose: 'hang', scale: 0.62 });
  }),
};
export const CAMERAS = { bastion: { tile: { zoomOut: 0.8 } } };
