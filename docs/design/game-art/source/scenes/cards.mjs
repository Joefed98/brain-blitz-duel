// Arcade · Cards & Board: our own card faces (rank and suit, no court art) and tiles on deep blue felt, pink accents.
import { build } from '../scene.mjs';
import { C, glyph, box, cyl, cap, torus, sphere, card, upCard } from '../kit.mjs';
const FELT = '#1E3F7A', PK = '#FF5C93';
const felt = (w, d) => box([w * 0.92, 0.05, d * 0.92], { pos: [0, -0.05, 0], col: FELT, r: 0.04 });
export const SCENES = {
  // Five Hands: two rows of hands laid out, the chosen column lit in gold.
  fivehands: () => build(() => {
    felt(1.9, 1.25);
    const rows = [[['A', '♠'], ['K', '♠'], ['Q', '♠'], ['J', '♠'], ['10', '♠']], [['7', '♥'], ['7', '♦'], ['7', '♣'], ['2', '♥'], ['2', '♠']]];
    rows.forEach((r, j) => r.forEach(([rk, st], i) => card(rk, st, { pos: [(i - 2) * 0.72, 0.03, -0.55 + j * 1.1], s: 0.95 })));
    box([0.42, 0.012, 1.12], { pos: [1.44, 0.012, 0], col: C.GOLD, r: 0.04, emit: 0.3 });
    card('9', '♦', { pos: [1.44, 0.05, 0.0], rot: [0, 8, 0], s: 0.95 });
  }),
  // Free Cell: the cascades fanned down the felt, a card in a free cell and an ace home.
  freecell: () => build(() => {
    felt(1.8, 1.4);
    const cols = [[['K', '♣'], ['Q', '♥'], ['J', '♠']], [['9', '♦'], ['8', '♣'], ['7', '♥']], [['5', '♠'], ['4', '♥'], ['3', '♣']], [['10', '♥'], ['9', '♠']]];
    cols.forEach((c, i) => c.forEach(([rk, st], k) => card(rk, st, { pos: [(i - 1.5) * 0.85, 0.03 + k * 0.03, -0.15 + k * 0.32], s: 0.9 })));
    for (let i = 0; i < 4; i++) box([0.34, 0.006, 0.48], { pos: [(i - 1.5) * 0.85, 0.006, -1.0], col: '#2C5296', r: 0.03 });
    card('A', '♥', { pos: [0.425, 0.04, -1.0], s: 0.9 }); card('6', '♣', { pos: [-1.275, 0.04, -1.0], s: 0.9 });
  }),
  // Mahjong Solitaire: a small stack of tiles, two matching ones lifted out.
  mahjong: () => build(() => {
    felt(1.6, 1.2);
    const face = (k) => k === 'dots' ? { paint: 'dots', col: '#1E8F55', pts: [[0.3, 0.3, 0.1], [0.7, 0.3, 0.1], [0.5, 0.5, 0.1], [0.3, 0.7, 0.1], [0.7, 0.7, 0.1]] }
      : k === 'reds' ? { paint: 'dots', col: '#D23A3A', pts: [[0.5, 0.3, 0.12], [0.5, 0.7, 0.12]] }
      : k === 'bars' ? { paint: 'lines', col: '#2F6BFF', w: 0.08, paths: [[[0.3, 0.2], [0.3, 0.8]], [[0.5, 0.2], [0.5, 0.8]], [[0.7, 0.2], [0.7, 0.8]]] }
      : { paint: 'multi', items: [{ text: '★', col: PK, size: 0.7, weight: 400 }] };
    const t = (x, y, z, k, col = C.CREAM, rot) => box([0.2, 0.08, 0.27], { pos: [x, y, z], rot, col, r: 0.04, pattern: { type: 'bands', axis: 'y', from: -0.08, step: 0.05, cols: ['#1E8F55'] }, decal: { cell: face(k), face: 'y', w: 0.19, h: 0.26 } });
    const kinds = ['dots', 'bars', 'reds', 'bars', 'dots', 'reds'];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) t((i - 1.5) * 0.42, 0.08, (j - 1) * 0.56, kinds[(i + j * 2) % 6]);
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) t((i - 0.5) * 0.42, 0.24, (j - 0.5) * 0.56, kinds[(i + j) % 6]);
    t(0, 0.4, 0, 'star');
    t(1.15, 0.35, 0.45, 'star', C.CREAM, [-20, 0, 15]);
  }),
  // Thirteen: the pyramid of cards, a 6 and a 7 making 13.
  pyramid: () => build(() => {
    felt(1.7, 1.3);
    const rows = [[['K', '♠']], [['4', '♥'], ['9', '♣']], [['6', '♦'], ['J', '♠'], ['2', '♥']], [['7', '♣'], ['Q', '♦'], ['5', '♠'], ['8', '♥']]];
    rows.forEach((r, j) => r.forEach(([rk, st], i) => card(rk, st, { pos: [(i - (r.length - 1) / 2) * 0.7, 0.03 + j * 0.035, -0.9 + j * 0.5], s: 0.85 })));
    card('6', '♥', { pos: [0.95, 0.06, 0.95], rot: [0, -12, 0], s: 0.85 });
    torus(0.12, 0.03, { pos: [-1.2, 0.03, 0.75], col: C.GOLD });
  }),
  // Summit: three peaks of cards, a run being played onto the waste.
  tripeaks: () => build(() => {
    felt(2.0, 1.3);
    for (let p = 0; p < 3; p++) { const cx = (p - 1) * 1.25;
      card('', '', { pos: [cx, 0.03, -0.9], back: true, backCol: PK, s: 0.75 });
      card('', '', { pos: [cx - 0.3, 0.06, -0.55], back: true, backCol: PK, s: 0.75 }); card('', '', { pos: [cx + 0.3, 0.06, -0.55], back: true, backCol: PK, s: 0.75 }); }
    const base = [['3', '♥'], ['8', '♣'], ['J', '♦'], ['5', '♠'], ['10', '♥'], ['2', '♣'], ['Q', '♠']];
    base.forEach(([rk, st], i) => card(rk, st, { pos: [(i - 3) * 0.55, 0.09, -0.15], s: 0.75 }));
    card('9', '♥', { pos: [-0.3, 0.06, 0.85], s: 0.85 }); card('10', '♠', { pos: [-0.1, 0.09, 0.9], rot: [0, -8, 0], s: 0.85 });
    for (let k = 0; k < 3; k++) card('', '', { pos: [-1.2, 0.03 + k * 0.03, 0.85], back: true, backCol: PK, s: 0.85 });
  }),
};
export const CAMERAS = Object.fromEntries(Object.keys(SCENES).map((k) => [k, { tile: { zoomOut: 0.86, el: 52 }, hero: { zoomOut: 0.95, el: 50 } }]));
