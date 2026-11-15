// Attention: things to find and look closely at, pink accents.
import { build } from '../scene.mjs';
import { C, glyph, tile, upTile, slab, box, cyl, cap, torus, sphere, cone, prism, star } from '../kit.mjs';
const P = C.PINK;
const bird = [[0, 0.1], [0.5, 0.42], [0.34, 0.05], [0.2, -0.05], [0.12, -0.38], [0, -0.22], [-0.12, -0.38], [-0.2, -0.05], [-0.34, 0.05], [-0.5, 0.42]];
const birdPaint = (col, flip) => ({ paint: 'polys', shapes: [[col, bird.map(([x, y]) => [0.5 + x * 0.85 * (flip ? -1 : 1), 0.5 - y * 0.85])]] });
export const SCENES = {
  // Bomb Defusal: a cartoon device with a countdown, three wires, one cut.
  bomb: () => build(() => {
    box([1.0, 0.38, 0.62], { pos: [0, 0.38, 0], col: '#3A3F52', r: 0.12 });
    box([0.5, 0.17, 0.04], { pos: [-0.2, 0.52, 0.62], col: '#0E0F14', r: 0.04, decal: { cell: glyph('0:07', '#FF4D4D', 0.48), face: 'z', w: 0.44, h: 0.15, emit: 0.85 } });
    for (const [i, col] of [[0, C.RED], [1, C.BLUE], [2, C.YELLOW]]) {
      const x = 0.42 + i * 0.16;
      if (i === 1) { cap([x, 0.78, -0.25], [x, 0.95, 0.0], 0.04, { col }); cap([x, 0.78, 0.45], [x + 0.05, 0.96, 0.18], 0.04, { col }); }
      else cap([x, 0.78, -0.25], [x, 0.78, 0.45], 0.04, { col, }), cap([x, 0.77, -0.25], [x, 1.02, 0.1], 0.04, { col });
    }
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) box([0.08, 0.04, 0.08], { pos: [-0.55 + i * 0.2, 0.78, -0.2 + j * 0.22], col: j ? P : C.SILVER, r: 0.03 });
    sphere(0.09, { pos: [0.75, 0.82, 0.35], col: C.LIME, emit: 0.6 });
  }),
  // Tally: a scatter of shapes and a counter for one kind.
  countup: () => build(() => {
    slab(1.5, 1.05, { col: '#2E2340' });
    const items = [['s', C.BLUE, -1.05, -0.5], ['c', P, -0.4, -0.6], ['t', C.GOLD, 0.35, -0.55], ['s', P, 1.0, -0.45], ['c', C.BLUE, -0.85, 0.15], ['t', P, -0.15, 0.05], ['s', C.GOLD, 0.6, 0.1], ['c', P, 1.15, 0.45], ['t', C.BLUE, -1.1, 0.7], ['s', P, -0.35, 0.65], ['c', C.GOLD, 0.35, 0.7]];
    for (const [k, col, x, z] of items) {
      if (k === 's') sphere(0.2, { pos: [x, 0.2, z], col });
      if (k === 'c') box([0.18, 0.18, 0.18], { pos: [x, 0.18, z], rot: [0, 25, 0], col, r: 0.05 });
      if (k === 't') cone(0.22, 0.01, 0.22, { pos: [x, 0.22, z], col, r: 0.02 });
    }
    box([0.36, 0.3, 0.08], { pos: [0, 0.95, -1.1], col: '#1B2236', r: 0.05, decal: { cell: glyph('5', P, 0.8), face: 'z', w: 0.3, h: 0.26, emit: 0.8 } });
  }),
  // Labyrinth: a walled maze, the path drawn in gold to the exit.
  maze: () => build(() => {
    slab(1.4, 1.4, { col: '#2E2340' });
    const W = [[-1.4, -1.4, 1.4, -1.4], [-1.4, 1.4, 1.4, 1.4], [-1.4, -1.4, -1.4, 0.7], [1.4, -0.7, 1.4, 1.4], [-0.7, -1.4, -0.7, 0.0], [0.0, -0.7, 0.0, 0.7], [-0.7, 0.7, 0.7, 0.7], [0.7, -0.7, 0.7, 0.0], [0.7, -0.7, 1.4, -0.7], [-1.4, 0.7, -0.7, 0.7]];
    for (const [x0, z0, x1, z1] of W) box([Math.abs(x1 - x0) / 2 + 0.06, 0.14, Math.abs(z1 - z0) / 2 + 0.06], { pos: [(x0 + x1) / 2, 0.14, (z0 + z1) / 2], col: C.CREAM, r: 0.05 });
    const path = [[-1.05, 1.05], [-1.05, -1.05], [-0.35, -1.05], [-0.35, 0.35], [0.35, 0.35], [0.35, -1.05], [1.05, -1.05], [1.05, -0.35], [1.05, 1.05], [1.75, 1.05]];
    for (let i = 0; i < path.length - 1; i++) cap([path[i][0], 0.04, path[i][1]], [path[i + 1][0], 0.04, path[i + 1][1]], 0.06, { col: C.GOLD });
    sphere(0.17, { pos: [-1.05, 0.17, 1.05], col: P });
  }),
  // Matchmaker: face-down cards, two turned up and matching.
  pairmatch: () => build(() => {
    const face = (sym, col) => ({ paint: 'multi', items: [{ text: sym, col, size: 0.95, weight: 400 }] });
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
      const pos = [(i - 1.5) * 0.62, 0.03, (j - 1) * 0.82];
      const up = (i === 0 && j === 1) || (i === 2 && j === 2);
      box([0.26, 0.03, 0.36], { pos, col: up ? C.WHITE : P, r: 0.03, decal: up ? { cell: face('★', C.GOLD), face: 'y', w: 0.26, h: 0.36 } : { cell: { paint: 'ring', col: '#FFFFFF66', r: 0.3, w: 0.06 }, face: 'y', w: 0.22 } });
    }
    box([0.26, 0.03, 0.36], { pos: [0.35, 0.6, 0.15], rot: [-40, 0, 25], col: P, r: 0.03 });
  }),
  // Double Take: two little pictures in frames, one difference ringed.
  spotdiff: () => build(() => {
    const pic = (miss) => ({ paint: 'polys', shapes: [['#7EC8FF', [[0, 0], [1, 0], [1, 0.62], [0, 0.62]]], ['#4CC24A', [[0, 0.62], [1, 0.55], [1, 1], [0, 1]]],
      ['#F4EFE6', [[0.2, 0.75], [0.48, 0.75], [0.48, 0.5], [0.2, 0.5]]], ['#E8473F', [[0.16, 0.52], [0.34, 0.32], [0.52, 0.52]]], ['#3E6FD8', [[0.3, 0.75], [0.38, 0.75], [0.38, 0.62], [0.3, 0.62]]],
      ['#2F8A3C', [[0.66, 0.78], [0.76, 0.35], [0.86, 0.78]]], ...(miss ? [] : [['#FFD43D', [[0.78, 0.08], [0.92, 0.08], [0.92, 0.22], [0.78, 0.22]]]])] });
    for (const [x, miss] of [[-0.62, false], [0.62, true]]) {
      box([0.56, 0.5, 0.05], { pos: [x, 0.62, 0], rot: [-8, x < 0 ? 10 : -10, 0], col: C.WOOD2, r: 0.04, decal: { cell: pic(miss), face: 'z', w: 0.48, h: 0.42 } });
    }
    torus(0.13, 0.025, { pos: [0.94, 0.95, 0.12], rot: [82, -10, 0], col: P, emit: 0.4 });
  }),
  // Eagle Eye: a field of bird badges, the ones matching the target picked out.
  symscan: () => build(() => {
    slab(1.45, 1.05, { col: '#2E2340' });
    const kinds = [[0, 0], [1, 1], [0, 1], [2, 0], [1, 0], [0, 0], [2, 1], [1, 1], [0, 0], [2, 0], [0, 1], [1, 0]];
    kinds.forEach(([k, flip], n) => {
      const i = n % 4, j = Math.floor(n / 4), pos = [(i - 1.5) * 0.7, 0.07, (j - 1) * 0.7];
      const hit = k === 0 && !flip;
      cyl(0.28, 0.07, { pos, col: hit ? P : C.CREAM, r: 0.04, decal: { cell: birdPaint(k === 2 ? '#3E6FD8' : C.INK, flip), face: 'y', w: 0.26 } });
    });
    box([0.32, 0.32, 0.06], { pos: [0, 0.75, -1.15], col: C.GOLD, r: 0.06, decal: { cell: birdPaint(C.INK, false), face: 'z', w: 0.28 } });
  }),
};
export const CAMERAS = { symscan: { tile: { zoomOut: 0.85 } }, countup: { tile: { zoomOut: 0.9 } } };
