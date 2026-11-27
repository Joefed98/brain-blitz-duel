/**
 * Thirteen's pyramid layouts (display only; D6, 23 Nov 2026, Joe: "a separate layout file"): for each pyramid height,
 * the card size, the step between neighbours, the first row's top and the step between rows, on the 414 × 772 world
 * (pyramid.renderer.ts draws and hit-tests from these). Seven rows is today's (62 × 90 on a 58 px step); pyramidRev 4's
 * level deals use 6, 8 and 9. Every height's pyramid ends above the panel (y 472, 12 px clear of it at 484), its bottom
 * row inside the world's width, each card a few pixels over its right-hand neighbour so every index shows.
 *
 * Card widths on the smallest phone (375 × 667: the world drawn 317 px wide, a scale of 0.766): 6 and 7 rows 47.5 px,
 * 8 rows 39.8 px, 9 rows 36.8 px (Joe's floor: 36 px at 9 rows).
 */
export interface PyLayout {
  rows: number;
  cardW: number;
  cardH: number;
  stepX: number;
  rowY0: number;
  rowStep: number;
}

/** The world's width (pyramid.renderer.ts's PY_WORLD_W). */
const WORLD_W = 414;

export const PY_LAYOUTS: Readonly<Record<number, PyLayout>> = {
  // Six rows: today's cards, the pyramid centred in the space above the panel.
  6: { rows: 6, cardW: 62, cardH: 90, stepX: 58, rowY0: 74, rowStep: 56 },
  7: { rows: 7, cardW: 62, cardH: 90, stepX: 58, rowY0: 46, rowStep: 56 },
  8: { rows: 8, cardW: 52, cardH: 76, stepX: 49, rowY0: 46, rowStep: 50 },
  9: { rows: 9, cardW: 48, cardH: 70, stepX: 45, rowY0: 46, rowStep: 44 },
};

export function pyLayoutFor(rows: number): PyLayout {
  const l = PY_LAYOUTS[rows];
  if (!l) throw new Error(`pyramid: no layout for ${rows} rows`);
  return l;
}

/** Card `pos` of row `row`'s box (its top-left corner) in a layout. */
export function pyLayoutBox(l: PyLayout, row: number, pos: number): { x: number; y: number } {
  const rowW = (row + 1) * l.stepX - (l.stepX - l.cardW);
  return { x: WORLD_W / 2 - rowW / 2 + pos * l.stepX, y: l.rowY0 + row * l.rowStep };
}
