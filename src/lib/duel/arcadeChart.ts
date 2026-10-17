/**
 * The room answer reveal's arcade chart (17 Oct 2026, display only): every player's marker on one
 * continuous "snake" line that bends round in three rows, 0–50, 51–100 and 101–150 (the middle row
 * runs right to left), labelled 0 and 50 on the first row's ends, 100 at the second bend and 150 at
 * the end. It shows roughly who is ahead: markers carry each player's badge and name and no points
 * figure (exact scores are for the results screen; your own is the reveal's big number).
 *
 * Pure geometry (scripts/arcade-chart-check.ts proves every score's row and place, and that
 * markers never overlap); ArcadeScoreChart draws it. Places come from the server's stored scores.
 */
import { MAX_ROUND_SCORE } from "./scoring";

/** Each row's lowest and highest score. */
export const CHART_ROWS = [
  { lo: 0, hi: 50 },
  { lo: 51, hi: 100 },
  { lo: 101, hi: MAX_ROUND_SCORE },
] as const;

/** Points per row: a row runs from its previous boundary (0, 50, 100) to its own (50, 100, 150). */
const SPAN = 50;

/** A stored score on the chart's scale: a whole number from 0 to 150. */
export function chartScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(MAX_ROUND_SCORE, Math.round(score)));
}

/** The row a score sits on: 0 for 0–50, 1 for 51–100, 2 for 101–150. */
export function chartRow(score: number): 0 | 1 | 2 {
  const s = chartScore(score);
  return s <= CHART_ROWS[0].hi ? 0 : s <= CHART_ROWS[1].hi ? 1 : 2;
}

export interface ChartPoint {
  row: 0 | 1 | 2;
  /** How far along its row in reading order, 0 at the row's start boundary to 1 at its end. */
  along: number;
  /** Where across the chart, 0 at the left end of the line to 1 at the right end. */
  x: number;
}

/**
 * Where a score sits. Each row runs from its start boundary (0, 50, 100) to its end (50, 100,
 * 150): 50 is the first row's end, 51 one point round the bend into the second, which reads right
 * to left, so its x is mirrored.
 */
export function chartPoint(score: number): ChartPoint {
  const s = chartScore(score);
  const row = chartRow(s);
  const along = (s - row * SPAN) / SPAN;
  return { row, along, x: row === 1 ? 1 - along : along };
}

export interface ChartLabel {
  text: string;
  /** The row whose line the label sits by; a bend label sits between this row and the next. */
  row: 0 | 1 | 2;
  side: "left" | "right";
  bend: boolean;
}

/** The scale's labels: 0 and 150 at the line's ends, 50 and 100 at its bends. */
export function chartLabels(): ChartLabel[] {
  return [
    { text: "0", row: 0, side: "left", bend: false },
    { text: "50", row: 0, side: "right", bend: true },
    { text: "100", row: 1, side: "left", bend: true },
    { text: "150", row: 2, side: "right", bend: false },
  ];
}

/* ---------------------------------------------------------------- markers */

/** Space each side of the line for the scale's labels and the snake's bends, CSS px. */
export const CHART_MARGIN = 36;
/** A marker's badge diameter and the vertical step between stacked markers, CSS px. */
export const CHART_BADGE = 20;
export const CHART_LANE = 28;
/** The widest a name is drawn before it ellipsises, CSS px. */
export const CHART_NAME_MAX = 56;
/** Space kept clear between two markers in one lane, CSS px. */
export const CHART_GAP = 4;

/** A marker's drawn width: badge and name (capped), in an 11 px font; no points figure. */
export function markerWidth(name: string): number {
  const nameW = Math.min(CHART_NAME_MAX, Math.ceil(Math.max(1, name.length) * 6.6));
  return CHART_BADGE + 4 + nameW + 6;
}

export interface MarkerIn {
  key: number;
  score: number;
  name: string;
}

export interface MarkerOut {
  key: number;
  row: 0 | 1 | 2;
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
 * readable. `trackW` is the line's length in CSS px.
 */
export function layoutMarkers(markers: readonly MarkerIn[], trackW: number): MarkerOut[] {
  const placed = markers.map((m) => {
    const point = chartPoint(m.score);
    const px = point.x * trackW;
    const width = markerWidth(m.name);
    const labelSide: "left" | "right" = px > trackW / 2 ? "left" : "right";
    const left = labelSide === "right" ? px - CHART_BADGE / 2 : px + CHART_BADGE / 2 - width;
    return { key: m.key, row: point.row, px, left, width, labelSide, lane: 0 };
  });
  for (const row of [0, 1, 2] as const) {
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
export function rowLanes(markers: readonly MarkerOut[]): [number, number, number] {
  const lanes: [number, number, number] = [1, 1, 1];
  for (const m of markers) lanes[m.row] = Math.max(lanes[m.row], m.lane + 1);
  return lanes;
}
