// Shared pieces and colours for the game scenes. Colours are the art kit's (docs/design/style-guide/source/art2.mjs):
// category and group hues plus cream, navy, ink and the art gold. Each category has a family look:
//   Word: cream letter tiles on a navy tray, blue accents.     Number: cream number tiles, green accents.
//   Speed: orange action pieces on a dark plinth.             Attention: pink accents, things to spot.
//   Pattern: violet boards and pieces.                        Logic: teal-edged grid boards, cream cells.
//   Arcade groups: retro neon cabinet colours, sports kit, cards on felt, action toys, strategy marbles and gems.
import { box, cyl, sphere, cap, prism, torus, star, group, cone } from './scene.mjs';
export const C = {
  GOLD: '#EDB43E', GOLD_HI: '#F3DDA6', INK: '#121218', CREAM: '#F4EFE6', NAVY: '#2A3558', NAVY2: '#3B4870', BLUE: '#4D8CFF',
  RED: '#E8473F', GREEN: '#3DDC84', ORANGE: '#FF8A3D', VIOLET: '#8E80FF', PURPLE: '#B26BFF', PINK: '#FF6BD6', TEAL: '#2ED3B7',
  SILVER: '#C9D3EA', BRONZE: '#D9A066', CYAN: '#36E2F5', LIME: '#C6FF3D', WHITE: '#F7F7FA', GREY: '#8A93AD', WOOD: '#7A5638',
  WOOD2: '#A8754A', FELT: '#1E6B57', GRASS: '#3E9A47', SKY: '#6FB7FF', YELLOW: '#FFD43D', MAROON: '#8E2F3C', SAND: '#E2C38A',
};
export const CAT = { word: C.BLUE, number: C.GREEN, speed: C.ORANGE, attention: C.PINK, pattern: C.PURPLE, logic: C.TEAL };

/** A glyph decal cell. */
export const glyph = (text, col = C.INK, size = 0.72, extra = {}) => ({ text, col, size, ...extra });
/** A rounded square tile with a glyph on top. s = half width. */
export function tile(ch, { pos = [0, 0, 0], s = 0.3, h = 0.09, col = C.CREAM, ink = C.INK, size = 0.72, rot } = {}) {
  return box([s, h, s], { pos, rot, col, r: Math.min(s, h) * 0.55, decal: ch == null ? undefined : { cell: glyph(ch, ink, size), face: 'y', w: s * 0.92 } });
}
/** A tile standing up facing the camera, glyph on the front. */
export function upTile(ch, { pos = [0, 0, 0], s = 0.3, d = 0.08, col = C.CREAM, ink = C.INK, size = 0.72, rot } = {}) {
  return box([s, s, d], { pos, rot, col, r: d * 0.6, decal: ch == null ? undefined : { cell: glyph(ch, ink, size), face: 'z', w: s * 0.92 } });
}
/** A low tray or board slab whose top is at y = 0. */
export const slab = (w, d, { col = C.NAVY, h = 0.1, pos = [0, 0, 0], r } = {}) => box([w, h, d], { pos: [pos[0], pos[1] - h, pos[2]], col, r: r ?? Math.min(h, 0.08) });
/** A grid of tiles from rows of characters ('.' = gap, ' ' = blank tile). */
export function tileGrid(rows, { step = 0.66, s = 0.3, y = 0.09, col = C.CREAM, ink = C.INK, colAt, size } = {}) {
  const R = rows.length, Cn = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return;
    const pos = [(i - (Cn - 1) / 2) * step, y, (j - (R - 1) / 2) * step];
    const cc = colAt ? colAt(i, j, ch) : null;
    tile(ch === ' ' ? null : ch, { pos, s, col: cc?.col || col, ink: cc?.ink || ink, size });
  }));
}
/** A playing card lying flat (or rotated): rank and suit painted on top. */
export function card(rank, suit, { pos = [0, 0, 0], rot, back = false, backCol = C.BLUE, s = 1 } = {}) {
  const red = suit === '♥' || suit === '♦';
  const w = 0.36 * s, h = 0.52 * s;
  return box([w, 0.022, h], { pos, rot, col: back ? backCol : C.WHITE, r: 0.02,
    decal: back ? { cell: { paint: 'grid', col: '#ffffff55', n: 6, w: 4 }, face: 'y', w: w * 0.8, h: h * 0.85 }
      : { cell: { paint: 'card', rank, suit, ink: red ? '#D23A3A' : '#16161C' }, face: 'y', w, h } });
}
/** An upright card. */
export function upCard(rank, suit, { pos = [0, 0, 0], rot = [0, 0, 0], s = 1, back = false, backCol = C.BLUE } = {}) {
  const red = suit === '♥' || suit === '♦'; const w = 0.36 * s, h = 0.52 * s;
  return box([w, h, 0.022], { pos, rot, col: back ? backCol : C.WHITE, r: 0.02,
    decal: back ? { cell: { paint: 'grid', col: '#ffffff55', n: 6, w: 4 }, face: 'z', w: w * 0.8, h: h * 0.85 }
      : { cell: { paint: 'card', rank, suit, ink: red ? '#D23A3A' : '#16161C' }, face: 'z', w, h } });
}
/** A rounded marble. */
export const marble = (col, pos, r = 0.2) => sphere(r, { pos: [pos[0], (pos[1] ?? 0) + r, pos[2]], col });
export { box, cyl, sphere, cap, prism, torus, star, group, cone };
