/**
 * The Attention overhaul (15 Nov 2026, phase 2 step 4; docs/design/game-reviews/attention.md, docs/design/attention-overhaul.md):
 * a new look for all six Attention games (Blender-rendered pieces in public/attention/) and these rule changes, each one
 * stamp above what the game dealt before:
 *
 *   - Double Take `spotRev 4` (SPOT_REV_NEXT): a picture stays up until the player taps Next (or Done on the last
 *     picture), so the hidden seventh can still be found after the six; a colour difference always changes the
 *     shape's lightness by at least MIN_LIGHTNESS_GAP (attentionPalette.data.ts), so it reads without hue. Scoring is
 *     spotRev 3's (the standard's Double Take) exactly.
 *   - Tally `countRev 7` (COUNT_REV_MARKS): every tray is spread on a jittered grid with no two shapes touching at any
 *     size (shapes sized as a share of the tray, drawn in a box of the tray's own shape), shapes can be tapped to mark
 *     them as counted (a display aid; nothing is sent), and every colour on a tray that isn't counted differs in
 *     lightness from the counted ones. The questions, counts and scoring are countRev 6's.
 *   - Matchmaker `pairRev 4` (PAIR_REV_CLEAR): the board's colours are five a full step of lightness apart (no red /
 *     orange or pink / purple) over six shapes (the hexagon and the diamond added), and turning a third card while a
 *     miss is showing turns the miss back at once. Replay and scoring are pairRev 3's.
 *
 * Eagle Eye, Labyrinth and Bomb Defusal change look, sound, help and input only (no stamp): their levels come later.
 *
 * Every older stamp deals, grades and reads exactly as before. Checks written for the stamps before pin new deals to
 * them with `pinPreAttentionOverhaul(true)`. Shared by phone and server, pure but for the deal's seeded picks.
 */
import { dealPinned, setDealPin } from "./dealEra";
import { PAIR_ENAMEL, SPOT_ENAMEL, TALLY_ENAMEL, lightnessApart } from "./attentionPalette.data";
import { pick, randInt, randomBelow, shuffled } from "./random";
import type { CountUpPuzzleData, CountUpShape, CountUpStage, GlyphColour, PairCard, PairPuzzleData, SpotPuzzleData, SpotShape, StroopColour } from "./types";

/** Double Take's stamp on the scoring standard (standard/stamps.ts, one above its live 2) and the hidden difference. */
export const SPOT_REV_STANDARD = 3;
/** Double Take: the picture stays until Next; colour changes legible by lightness. */
export const SPOT_REV_NEXT = 4;
/** Tally's stamp after Joe's puzzle notes (the second tray's question kinds). */
export const COUNT_REV_NOTES = 6;
/** Tally: spread trays, tap-to-mark, legible colours. */
export const COUNT_REV_MARKS = 7;
/** Matchmaker's stamp on the scoring standard. */
export const PAIR_REV_STANDARD = 3;
/** Matchmaker: five legible colours over six shapes, a third card skips the flip-back wait. */
export const PAIR_REV_CLEAR = 4;

/** Checks written for the stamps before 15 Nov 2026's overhaul deal them; returns the previous setting. */
export function pinPreAttentionOverhaul(on: boolean): boolean {
  return setDealPin("preAttentionOverhaul", on);
}

export function preAttentionOverhaulPinned(): boolean {
  return dealPinned("preAttentionOverhaul");
}

const typed = <T extends { type: string }>(puzzle: unknown, type: T["type"]): T | null => {
  const p = puzzle as T | null;
  return p && p.type === type ? p : null;
};

/** Double Take spotRev 4+: the picture waits for Next; legible colour changes. */
export const spotWaitsForNext = (puzzle: unknown): boolean => (typed<SpotPuzzleData>(puzzle, "spotdiff")?.spotRev ?? 0) >= SPOT_REV_NEXT;
/** Tally countRev 7+: spread trays and tap-to-mark. */
export const tallySpread = (puzzle: unknown): boolean => (typed<CountUpPuzzleData>(puzzle, "countup")?.countRev ?? 0) >= COUNT_REV_MARKS;
/** Matchmaker pairRev 4+: the clear palette and the quick flip-back. */
export const pairClear = (puzzle: unknown): boolean => (typed<PairPuzzleData>(puzzle, "pairmatch")?.pairRev ?? 0) >= PAIR_REV_CLEAR;

/**
 * The deal layer: each game one stamp up, only over the stamp it was dealt today (so checks that deal older eras keep
 * them); any other game, or with the pin, unchanged.
 */
export function dealAttentionOverhaul<T extends { type: string }>(puzzle: T): T {
  if (dealPinned("preAttentionOverhaul")) return puzzle;
  const spot = typed<SpotPuzzleData>(puzzle, "spotdiff");
  if (spot && spot.spotRev === SPOT_REV_STANDARD) return { ...legibleSpot(spot), spotRev: SPOT_REV_NEXT } as unknown as T;
  const count = typed<CountUpPuzzleData>(puzzle, "countup");
  if (count && count.countRev === COUNT_REV_NOTES) return { ...spreadTally(count), countRev: COUNT_REV_MARKS } as unknown as T;
  const pair = typed<PairPuzzleData>(puzzle, "pairmatch");
  if (pair && pair.pairRev === PAIR_REV_STANDARD) return { ...clearPairBoard(pair), pairRev: PAIR_REV_CLEAR } as unknown as T;
  return puzzle;
}

/* ------------------------------------------------------------------ Double Take */

type SpotColourId = keyof typeof SPOT_ENAMEL;
const spotHex = (c: StroopColour): string => SPOT_ENAMEL[c as SpotColourId] ?? SPOT_ENAMEL.BROWN;

/** The colours a Double Take shape of colour `c` may change to on spotRev 4 (lightness apart, never itself). */
export function spotColourSwaps(c: StroopColour): StroopColour[] {
  return (Object.keys(SPOT_ENAMEL) as StroopColour[]).filter((o) => o !== c && lightnessApart(spotHex(c), spotHex(o)));
}

/**
 * Every colour difference in both pictures made legible: where the changed panel's colour is too close in lightness
 * to the other panel's, it is re-picked from the legible ones. Only a colour difference's own cell changes, so the
 * differences, their cells, labels and the hidden seventh are untouched.
 */
export function legibleSpot(p: SpotPuzzleData): SpotPuzzleData {
  const fix = (top: SpotShape[], bottom: SpotShape[]): SpotShape[] => {
    const byCell = new Map(top.map((s) => [s.cell, s]));
    return bottom.map((b) => {
      const t = byCell.get(b.cell);
      if (!t || t.colour === b.colour || t.kind !== b.kind) return b;
      if (lightnessApart(spotHex(t.colour), spotHex(b.colour))) return b;
      return { ...b, colour: pick(spotColourSwaps(t.colour)) };
    });
  };
  return {
    ...p,
    bottom: fix(p.top, p.bottom),
    ...(p.reef ? { reef: { top: p.reef.top, bottom: fix(p.reef.top, p.reef.bottom) } } : {}),
  };
}

/* ------------------------------------------------------------------ Tally */

type TallyColourId = keyof typeof TALLY_ENAMEL;
const tallyHex = (c: GlyphColour): string => TALLY_ENAMEL[c as TallyColourId] ?? TALLY_ENAMEL.RED;
const TALLY_COLOURS = Object.keys(TALLY_ENAMEL) as GlyphColour[];

/** The colours a tray counts: its question's colour(s); none for a shape-only question. */
export function tallyCountedColours(stage: CountUpStage): GlyphColour[] {
  if (stage.compare) return [stage.compare.more, stage.compare.less];
  if (stage.ask === "shape") return [];
  return [stage.targetColour];
}

/** The hue look-alikes Tally never puts beside each other (countUp.tsx TOO_CLOSE): never introduced by a recolour. */
export const TALLY_HUE_LOOKALIKES: readonly (readonly [GlyphColour, GlyphColour])[] = [
  ["RED", "ORANGE"],
  ["ORANGE", "BROWN"],
  ["BLUE", "PURPLE"],
];
const hueLookalike = (a: GlyphColour, b: GlyphColour) => TALLY_HUE_LOOKALIKES.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

/** True when a colour sits clear in lightness of every counted colour (or is one of them). */
export function tallyColourClear(colour: GlyphColour, counted: GlyphColour[]): boolean {
  return counted.includes(colour) || counted.every((c) => lightnessApart(tallyHex(c), tallyHex(colour)));
}

/** The jittered grid a tray of `n` shapes is spread on: the fewest cells, rows no more than columns. */
export function tallyGrid(n: number): { cols: number; rows: number } {
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  return { cols, rows };
}

/** A shape's drawn size as a share of its grid cell, and how far its centre may wander from the cell's centre. */
export const TALLY_SIZE_SHARE: [number, number] = [0.6, 0.78];
export const TALLY_JITTER_SHARE = 0.1;

/**
 * countRev 7's layout: shape k of the tray in its own cell of the grid (cells shuffled, some left empty), a seeded
 * size and wander inside the cell, so no two shapes ever touch at any size. `x`, `y` are the centre in per cent of the
 * tray's width and height and `size` the shape's box in per cent of the tray's width; the tray is drawn in a box of
 * cols : rows, so per cent of width means the same length on both axes.
 */
export function spreadStage(stage: CountUpStage): CountUpStage {
  const { cols, rows } = tallyGrid(stage.shapes.length);
  const cells = shuffled(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, stage.shapes.length);
  const cw = 100 / cols;
  const shapes: CountUpShape[] = stage.shapes.map((shape, k) => {
    const cell = cells[k]!;
    const share = TALLY_SIZE_SHARE[0] + (randomBelow(1000) / 1000) * (TALLY_SIZE_SHARE[1] - TALLY_SIZE_SHARE[0]);
    const room = (1 - share) / 2 - 0.02;
    const wander = Math.max(0, Math.min(TALLY_JITTER_SHARE, room));
    const jx = (randomBelow(2001) / 1000 - 1) * wander;
    const jy = (randomBelow(2001) / 1000 - 1) * wander;
    const col = cell % cols;
    const row = Math.floor(cell / cols);
    return {
      ...shape,
      x: round3((col + 0.5 + jx) * cw),
      y: round3(((row + 0.5 + jy) * 100) / rows),
      size: round3(share * cw),
      rotation: randInt(-25, 25),
      layer: k,
    };
  });
  return { ...stage, cols, rows, shapes };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

/** Colours clear of every counted one in lightness and never their hue look-alike (GOLD never dealt). */
function clearOf(counted: GlyphColour[]): GlyphColour[] {
  return TALLY_COLOURS.filter((c) => c !== "GOLD" && !counted.includes(c) && tallyColourClear(c, counted) && counted.every((k) => !hueLookalike(c, k)));
}

/**
 * A comparison tray whose two colours leave no clear filler colour: its "less" colour is renamed to one that does (every
 * shape of it, so both counts and the answer are unchanged); any filler already in the new colour is left for the
 * recolour that follows.
 */
function compareWithRoom(stage: CountUpStage): CountUpStage {
  const cmp = stage.compare;
  if (!cmp || clearOf([cmp.more, cmp.less]).length > 0) return stage;
  const options = TALLY_COLOURS.filter(
    (c) => c !== "GOLD" && c !== cmp.more && tallyColourClear(c, [cmp.more]) && !hueLookalike(c, cmp.more) && clearOf([cmp.more, c]).length > 0,
  );
  if (options.length === 0) return stage;
  const less = pick(options);
  // The two colours swap: fillers already in the new colour take the old one (no longer counted), and the recolour that
  // follows moves them on if they sit too close to the counted colours.
  const shapes = stage.shapes.map((s) => (s.colour === cmp.less ? { ...s, colour: less } : s.colour === less ? { ...s, colour: cmp.less } : s));
  return { ...stage, compare: { more: cmp.more, less }, shapes };
}

/** countRev 7: each tray's uncounted colours made clear of the counted ones, then spread on its grid. */
export function spreadTally(p: CountUpPuzzleData): CountUpPuzzleData {
  const stages = p.stages.map((dealt) => {
    const stage = compareWithRoom(dealt);
    const counted = tallyCountedColours(stage);
    // A replacement colour is clear in lightness of the counted ones and never their hue look-alike.
    const clear = clearOf(counted);
    const shapes = stage.shapes.map((s) => (tallyColourClear(s.colour, counted) || clear.length === 0 ? s : { ...s, colour: pick(clear) }));
    return spreadStage({ ...stage, shapes });
  });
  return { ...p, stages };
}

/** The squared distance between two spread shapes' centres, in tray-width per cent (the tray box is cols : rows). */
export function tallyCentreGap(stage: CountUpStage, a: CountUpShape, b: CountUpShape): number {
  const h = (100 * stage.rows) / stage.cols; // the tray's height in width per cent
  return Math.hypot(a.x - b.x, ((a.y - b.y) * h) / 100);
}

/* ------------------------------------------------------------------ Matchmaker */

/** pairRev 4's colours and shapes (types.ts PairShape takes the two new shapes). */
export const PAIR_CLEAR_COLOURS = Object.keys(PAIR_ENAMEL) as StroopColour[];
export const PAIR_CLEAR_SHAPES = ["circle", "square", "triangle", "star", "hexagon", "diamond"] as const;

/** A new board on the clear palette: the same number of pairs, every pair a distinct shape-and-colour, a gold pair. */
export function clearPairBoard(p: PairPuzzleData): PairPuzzleData {
  const pairs = p.cards.length / 2;
  const combos: PairCard[] = PAIR_CLEAR_SHAPES.flatMap((shape) => PAIR_CLEAR_COLOURS.map((colour) => ({ shape, colour }) as PairCard));
  const chosen = shuffled(combos).slice(0, pairs);
  const cards = shuffled(chosen.flatMap((card) => [card, { ...card }]));
  const gold = chosen[randomBelow(pairs)]!;
  return { ...p, cards, gold: { ...gold } };
}
