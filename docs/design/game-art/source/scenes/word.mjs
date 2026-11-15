// Word: cream letter tiles with ink Archivo letters, blue and gold accents, navy trays.
import { build } from '../scene.mjs';
import { C, glyph, tile, upTile, prism, slab, box, cyl, cap, torus, sphere } from '../kit.mjs';
const hex = (r) => [...Array(6)].map((_, i) => [Math.cos((i * Math.PI) / 3) * r, Math.sin((i * Math.PI) / 3) * r]);
const hexTile = (ch, pos, col, ink = C.INK) => prism(hex(0.4), 0.09, { pos, rot: [-90, 0, 0], col, r: 0.05, decal: { cell: glyph(ch, ink, 0.66), face: 'z', w: 0.32 } });
/** A tile with a small clue number in its corner (and maybe a letter). */
const numTile = (n, ch, pos, col = C.CREAM) => box([0.3, 0.09, 0.3], { pos, col, r: 0.05, decal: { cell: { paint: 'multi', items: [{ text: String(n), size: 0.3, dx: -0.28, dy: -0.28, col: '#5A6280' }, ...(ch ? [{ text: ch, size: 0.62, dy: 0.06 }] : [])] }, face: 'y', w: 0.28 } });
const grid = (rows, f) => { const R = rows.length, W = rows[0].length; rows.forEach((row, j) => [...row].forEach((ch, i) => f(ch, [(i - (W - 1) / 2) * 0.66, 0.09, (j - (R - 1) / 2) * 0.66], i, j))); };

export const SCENES = {
  // Nucleus: seven hex tiles, the centre letter gold.
  wordsmith: () => build(() => {
    hexTile('R', [0, 0.09, 0], C.GOLD);
    'STAERN'.split('').forEach((ch, i) => { const a = (i * Math.PI) / 3 + Math.PI / 6; hexTile(ch, [Math.cos(a) * 0.74, 0.09, Math.sin(a) * 0.74], C.CREAM); });
  }),
  // Forage: a 4 × 4 board with a traced word lit blue and joined by a gold trace.
  wordhunt: (k) => build(() => {
    slab(1.42, 1.42, { col: C.NAVY });
    const rows = ['PLAN', 'OTES', 'RING', 'DUCK'];
    const path = [[0, 0], [1, 1], [2, 1], [3, 1]]; // P-T-E-S? reads PTES; use a word: S T O P below
    const lit = new Set(['3,1', '2,1', '1,1', '0,0'].concat([]));
    grid(rows, (ch, pos, i, j) => tile(ch, { pos, col: lit.has(`${i},${j}`) ? C.BLUE : C.CREAM, ink: lit.has(`${i},${j}`) ? C.WHITE : C.INK }));
    const pts = [[3, 1], [2, 1], [1, 1], [0, 0]].map(([i, j]) => [(i - 1.5) * 0.66, 0.27, (j - 1.5) * 0.66]);
    for (let n = 0; n < pts.length - 1; n++) cap(pts[n], pts[n + 1], 0.045, { col: C.GOLD });
    pts.forEach((p) => sphere(0.075, { pos: p, col: C.GOLD }));
  }),
  // Lookout: a letter grid with one word ringed, and a magnifying glass over it.
  wordsearch: (k) => build(() => {
    slab(1.42, 1.42, { col: C.NAVY });
    grid(['KCAT', 'OWLX', 'BEAR', 'MZFN'], (ch, pos, i, j) => tile(ch, { pos, col: j === 2 ? C.BLUE : C.CREAM, ink: j === 2 ? C.WHITE : C.INK }));
    // The magnifier: a gold ring with a glassy lens, the handle off to the front right.
    torus(0.42, 0.07, { pos: [0.55, 0.55, 0.62], rot: [-62, 0, 0], col: C.GOLD });
    cyl(0.4, 0.015, { pos: [0.55, 0.55, 0.62], rot: [-62, 0, 0], col: '#BFE3FF' });
    cap([0.86, 0.36, 0.98], [1.32, 0.18, 1.4], 0.085, { col: C.INK });
  }),
  // Slider: a tray of tiles with the top row slid half a tile out to the right.
  wordslide: () => build(() => {
    slab(1.42, 1.42, { col: C.NAVY });
    grid(['FROG', 'LAKE', 'MINT', 'SODA'], (ch, pos, i, j) => tile(ch, { pos: j === 0 ? [pos[0] + 0.42, pos[1] + 0.02, pos[2]] : pos, col: j === 0 ? C.GOLD : C.CREAM }));
    prism([[0, 0.14], [0.22, 0], [0, -0.14]], 0.04, { pos: [1.85, 0.12, -0.99], rot: [-90, 0, 0], col: C.GOLD });
  }),
  // Swapword: a 3 × 3 board, two tiles lifted and crossing in mid-air.
  swapword: () => build(() => {
    slab(1.1, 1.1, { col: C.NAVY });
    grid(['CAT', 'O E', 'WIN'], (ch, pos, i, j) => { if (i === 1 && j === 1) return; tile(ch === ' ' ? null : ch, { pos }); });
    tile('R', { pos: [-0.1, 0.62, 0.05], col: C.BLUE, ink: C.WHITE, rot: [0, 0, -16] });
    tile('D', { pos: [0.42, 0.38, -0.32], col: C.GOLD, rot: [0, 0, 14] });
  }),
  // Interlock: two words crossing, built from tiles.
  tilegrid: () => build(() => {
    const across = 'PLANET', down = 'SNOW';
    [...across].forEach((ch, i) => tile(ch, { pos: [(i - 2.5) * 0.66, 0.09, 0], col: i === 3 ? C.GOLD : C.CREAM }));
    [...down].forEach((ch, j) => { if (j === 1) return; tile(ch, { pos: [0.5 * 0.66, 0.09, (j - 1) * 0.66] }); });
    [...'CAP'].forEach((ch, j) => { if (j === 1) return; tile(ch, { pos: [-1.5 * 0.66, 0.09, (j - 1) * 0.66], col: j === 2 ? C.BLUE : C.CREAM, ink: j === 2 ? C.WHITE : C.INK }); });
  }),
  // Strikeout: a word on standing tiles, two still hidden, and red strikes beside it.
  strikeout: () => build(() => {
    slab(1.75, 0.5, { col: C.NAVY });
    [...'PUZ?LE'].forEach((ch, i) => upTile(ch === '?' ? null : ch, { pos: [(i - 2.5) * 0.6, 0.3, 0], s: 0.27, d: 0.07, col: ch === '?' ? C.BLUE : C.CREAM }));
    for (let i = 0; i < 3; i++) {
      const pos = [-0.9 + i * 0.55, 0.06, 0.85];
      box([0.24, 0.05, 0.06], { pos, rot: [0, 45, 0], col: C.RED, r: 0.04 }); box([0.24, 0.05, 0.06], { pos, rot: [0, -45, 0], col: C.RED, r: 0.04 });
    }
  }),
  // Cryptogrid: a crossword of numbered tiles, a few letters already cracked.
  codeword: () => build(() => {
    slab(1.42, 1.42, { col: C.NAVY });
    const L = [['3', 'C'], ['8', ''], ['1', 'D'], ['5', 'E'], ['', '#'], ['2', ''], ['#', ''], ['8', ''], ['7', ''], ['5', 'E'], ['4', ''], ['6', 'Y'], ['1', 'D'], ['#', ''], ['2', ''], ['9', '']];
    grid(['abcd', 'efgh', 'ijkl', 'mnop'], (ch, pos, i, j) => {
      const [n, l] = L[j * 4 + i];
      if (n === '#' || l === '#') { box([0.3, 0.04, 0.3], { pos: [pos[0], 0.04, pos[2]], col: C.INK, r: 0.04 }); return; }
      numTile(n, l, pos, l ? C.CREAM : '#DCE3F5');
    });
  }),
  // Roundabout: the letter wheel, six tiles round a gold hub.
  letterwheel: (k) => build(() => {
    cyl(1.05, 0.06, { pos: [0, 0.06, 0], col: C.NAVY, r: 0.05 });
    torus(1.05, 0.06, { pos: [0, 0.07, 0], col: C.BLUE });
    cyl(0.28, 0.08, { pos: [0, 0.14, 0], col: C.GOLD });
    'ROUTED'.split('').forEach((ch, i) => { const a = (i * Math.PI) / 3 - Math.PI / 2; tile(ch, { pos: [Math.cos(a) * 0.68, 0.2, Math.sin(a) * 0.68], s: 0.22, h: 0.07, col: i === 0 ? C.BLUE : C.CREAM, ink: i === 0 ? C.WHITE : C.INK }); });
    if (k === 'hero') { [...'ROUTE'].forEach((ch, i) => tile(ch, { pos: [1.45 + i * 0.5, 0.07, -0.55], s: 0.22, h: 0.07 })); [...'DOT'].forEach((ch, i) => tile(ch, { pos: [2.45, 0.07, -0.55 + (i + 1) * 0.5], s: 0.22, h: 0.07 })); }
  }),
};

const crop = { tile: { zoomOut: 0.8 } };
export const CAMERAS = { wordhunt: crop, wordsearch: crop, wordslide: crop, codeword: crop, swapword: { tile: { zoomOut: 0.9 } }, letterwheel: { hero: { zoomOut: 0.95 } } };
