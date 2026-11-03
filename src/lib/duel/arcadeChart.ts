/**
 * The room answer reveal's arcade chart (17 Oct 2026, display only): every player's marker on one
 * continuous "snake" line that bends round in rows. It shows roughly who is ahead: markers carry each
 * player's badge and name and no points figure (exact scores are for the results screen; your own is
 * the reveal's big number).
 *
 * Four bands (3 Nov 2026, the reveal as its own screen): the line runs in four rows of 50 points on one
 * 0–200 axis whatever the game's maximum (roundMax.ts; SCORE_CEILING): 0–50 left to right, 51–100 right to
 * left, 101–150 left to right, 151–200 right to left, so 0 and 200 both sit at the left. Each row is one
 * band and the bend between two rows is the boundary (Joe's correction, same day: no lines across the
 * chart): "0" at the snake's start (top left), "200" at its end (bottom left), "50" and "150" beside the
 * middle of the two right-hand bends, "100" beside the middle of the left-hand bend. A score of exactly 50,
 * 100 or 150 puts its dot on that bend's middle (`chartOnBend`). A game whose maximum is 150 simply never
 * reaches the last band. (Before: three rows on the game's maximum, in thirds.) `max` only clamps a score.
 *
 * Pure geometry (scripts/arcade-chart-check.ts proves every score's row and place, and that
 * markers never overlap); ArcadeScoreChart draws it. Places come from the server's stored scores.
 */
import { DEFAULT_ROUND_MAX, SCORE_CEILING } from "./roundMax";

/** The chart's rows (bands), each CHART_BAND points. */
export const CHART_ROW_COUNT = 4;
export type ChartRow = 0 | 1 | 2 | 3;
export const CHART_ROW_IDS: readonly ChartRow[] = [0, 1, 2, 3];
/** One band's width in points, and the axis' top. */
export const CHART_BAND = SCORE_CEILING / CHART_ROW_COUNT;
export const CHART_TOP_SCORE = SCORE_CEILING;

/** Each row's lowest and highest score: 0–50, 51–100, 101–150, 151–200 (`max` is kept for callers; the bands are fixed). */
export function chartRows(_max = DEFAULT_ROUND_MAX): readonly { lo: number; hi: number }[] {
  return CHART_ROW_IDS.map((r) => ({ lo: r === 0 ? 0 : r * CHART_BAND + 1, hi: (r + 1) * CHART_BAND }));
}

/** The rows (0–50, 51–100, 101–150, 151–200). */
export const CHART_ROWS = chartRows();

/** A stored score on the chart: a whole number from 0 to the game's maximum (never past the axis' 200). */
export function chartScore(score: number, max = DEFAULT_ROUND_MAX): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(Math.min(CHART_TOP_SCORE, Math.max(1, Math.round(max))), Math.round(score)));
}

/** The row a score sits on: 0 for 0–50, 1 for 51–100, 2 for 101–150, 3 for 151–200. */
export function chartRow(score: number, max = DEFAULT_ROUND_MAX): ChartRow {
  const s = chartScore(score, max);
  return Math.min(CHART_ROW_COUNT - 1, Math.max(0, Math.ceil(s / CHART_BAND) - 1)) as ChartRow;
}

/** Rows that read right to left (the second and fourth). */
export const chartRowReversed = (row: ChartRow) => row % 2 === 1;

export interface ChartPoint {
  row: ChartRow;
  /** How far along its row in reading order, 0 at the row's start boundary to 1 at its end. */
  along: number;
  /** Where across the chart, 0 at the left end of the line to 1 at the right end. */
  x: number;
}

/**
 * Where a score sits. Each row runs from its start boundary (0, 50, 100, 150) to its end (50, 100, 150,
 * 200): 50 is the first row's end, 51 one point round the bend into the second, which reads right to
 * left, so its x is mirrored (as is the fourth's).
 */
export function chartPoint(score: number, max = DEFAULT_ROUND_MAX): ChartPoint {
  const s = chartScore(score, max);
  const row = chartRow(s, max);
  const start = row * CHART_BAND;
  const along = (s - start) / CHART_BAND;
  return { row, along, x: chartRowReversed(row) ? 1 - along : along };
}

export interface ChartLabel {
  text: string;
  /**
   * Where: 0 the first row's line (the snake's start), CHART_ROW_COUNT the last row's line (its end), k the middle of the
   * bend between rows k − 1 and k.
   */
  edge: number;
  /** Which side of the chart: the start and end and the left-hand bend on the left, the right-hand bends on the right. */
  side: "left" | "right";
}

/** The scale's labels in order: 0, 50, 100, 150, 200. `max` is kept for callers; the axis is fixed. */
export function chartLabels(_max = DEFAULT_ROUND_MAX): ChartLabel[] {
  return Array.from({ length: CHART_ROW_COUNT + 1 }, (_, edge) => ({
    text: String(edge * CHART_BAND),
    edge,
    // Bends after a left-to-right row are on the right (50, 150); the snake's two ends and the bend at 100 on the left.
    side: edge > 0 && edge < CHART_ROW_COUNT && edge % 2 === 1 ? "right" : "left",
  }));
}

/** The bend a score sits on: 1, 2 or 3 for exactly 50, 100 or 150 (its dot is drawn at that bend's middle), else null. */
export function chartOnBend(score: number, max = DEFAULT_ROUND_MAX): 1 | 2 | 3 | null {
  const s = chartScore(score, max);
  const edge = s / CHART_BAND;
  return Number.isInteger(edge) && edge > 0 && edge < CHART_ROW_COUNT ? (edge as 1 | 2 | 3) : null;
}

/* ---------------------------------------------------------------- markers */

/**
 * Space each side of the line for the snake's bends and, on the left, the axis' labels, CSS px (23 Oct 2026: the
 * labels are 13 px semibold on a dark backing; 48 since 3 Nov 2026 so "200" clears the left bends).
 */
export const CHART_MARGIN = 48;
/** A marker's badge diameter and the vertical step between stacked markers, CSS px. */
export const CHART_BADGE = 22;
export const CHART_LANE = 30;
/** The widest a name is drawn before it ellipsises, CSS px. */
export const CHART_NAME_MAX = 68;
/** Space kept clear between two markers in one lane, CSS px. */
export const CHART_GAP = 4;
/** A name's widest likely advance per character at 13 px semibold (Manrope), CSS px, so short names never ellipsise. */
const NAME_CHAR_PX = 8.8;

/** A marker's drawn width: badge and name (capped, on its 4 px-padded backing) in a 13 px font; no points figure. */
export function markerWidth(name: string): number {
  const nameW = Math.min(CHART_NAME_MAX, Math.ceil(Math.max(1, name.length) * NAME_CHAR_PX));
  return CHART_BADGE + 4 + nameW + 8 + 2;
}

export interface MarkerIn {
  key: number;
  score: number;
  name: string;
}

export interface MarkerOut {
  key: number;
  row: ChartRow;
  /** The score's exact place on the line, CSS px from the line's left end. */
  px: number;
  /** The marker's drawn box, CSS px from the line's left end. */
  left: number;
  width: number;
  /** Which side of the badge the name sits (towards the chart's middle). */
  labelSide: "left" | "right";
  /** 0 sits just above the line; each lane above stacks one CHART_LANE higher. */
  lane: number;
}

/**
 * Places every marker: the badge's centre on the score's exact place, its name towards
 * the middle of the chart, and markers that would touch stacked into lanes above (lowest free lane
 * first, in order along the line; ties in key order), so no two ever overlap and every name stays
 * readable. `trackW` is the line's length in CSS px; `max` the game's maximum.
 */
export function layoutMarkers(markers: readonly MarkerIn[], trackW: number, max = DEFAULT_ROUND_MAX): MarkerOut[] {
  const placed = markers.map((m) => {
    const point = chartPoint(m.score, max);
    const px = point.x * trackW;
    const width = markerWidth(m.name);
    const labelSide: "left" | "right" = px > trackW / 2 ? "left" : "right";
    const left = labelSide === "right" ? px - CHART_BADGE / 2 : px + CHART_BADGE / 2 - width;
    return { key: m.key, row: point.row, px, left, width, labelSide, lane: 0 };
  });
  for (const row of CHART_ROW_IDS) {
    const lanes: { left: number; right: number }[][] = [];
    const inRow = placed
      .filter((m) => m.row === row)
      .sort((a, b) => a.left - b.left || a.px - b.px || a.key - b.key);
    for (const m of inRow) {
      let lane = 0;
      while (lanes[lane]?.some((box) => m.left < box.right + CHART_GAP && box.left < m.left + m.width + CHART_GAP)) lane++;
      (lanes[lane] ??= []).push({ left: m.left, right: m.left + m.width });
      m.lane = lane;
    }
  }
  return placed;
}

/** How many lanes each row needs (at least one, so an empty row keeps its height). */
export function rowLanes(markers: readonly MarkerOut[]): number[] {
  const lanes: number[] = CHART_ROW_IDS.map(() => 1);
  for (const m of markers) lanes[m.row] = Math.max(lanes[m.row] ?? 1, m.lane + 1);
  return lanes;
}

/* ---------------------------------------------------------------- who is drawn */

/** In rooms bigger than CHART_ALL_UP_TO (31 Oct 2026, rooms of 16) the chart draws this many players by score, plus this player. */
export const CHART_TOP = 8;
/** Rooms up to the old cap of ten draw every player, as before. */
export const CHART_ALL_UP_TO = 10;

/**
 * Who the chart draws: in a room of up to CHART_ALL_UP_TO, everyone scored; in a bigger room the
 * CHART_TOP highest stored scores (ties to the lower slot), plus this player when they are not among them. Everyone still scoring is
 * counted separately (`pending`), never drawn. Display only.
 */
export function chartShown<T extends { slot: number; isMe: boolean; score: number | null }>(
  players: readonly T[],
): { shown: T[]; pending: T[]; hidden: number } {
  const scored = players.filter((p) => p.score !== null).sort((a, b) => b.score! - a.score! || a.slot - b.slot);
  const top = players.length <= CHART_ALL_UP_TO ? scored : scored.slice(0, CHART_TOP);
  const me = scored.find((p) => p.isMe);
  const shown = me && !top.includes(me) ? [...top, me] : top;
  const pending = players.filter((p) => p.score === null);
  return { shown, pending, hidden: scored.length - shown.length };
}
