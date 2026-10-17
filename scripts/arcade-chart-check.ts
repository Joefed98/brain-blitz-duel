/**
 * arcade-chart-check (17 Oct 2026): the room answer reveal's arcade score chart (display only;
 * src/lib/duel/arcadeChart.ts, src/components/duel/ArcadeScoreChart.tsx).
 *
 *  1. Rows: every score 0–150 sits on row 0 (0–50), 1 (51–100) or 2 (101–150), with 0, 50, 51,
 *     100, 101 and 150 checked by name; out-of-range and fractional stored values clamp and round.
 *  2. Places, both looks: 0 at the line's left end, 50 at the first row's right end, 51 one point
 *     into the second row, 100 at its end, 101 one point into the third, 150 at its right end; in
 *     "rows" every row reads left to right, in "snake" the middle row reads right to left, so
 *     along the snake every score is further along than the one below it and the ends meet at the
 *     bends. The labels are 0, 50, 100 and 150 at the ends and bends ("snake") or the row ends.
 *  3. Markers: random rooms of 2–10 players (scores bunched, a few points apart and tied) at
 *     phone widths: no two markers in a row overlap, each badge sits on its score's exact place,
 *     names and scores face the chart's middle, ties stack, and "You" is told by ring, label and
 *     weight, never by a colour.
 *  4. The default look is "snake", and `?chart=rows|snake` picks either for comparison.
 *
 *   bun scripts/arcade-chart-check.ts
 */
import { readFileSync } from "node:fs";

import {
  ARCADE_CHART_STYLE,
  CHART_BADGE,
  CHART_GAP,
  arcadeChartStyle,
  chartLabels,
  chartPoint,
  chartRow,
  chartScore,
  layoutMarkers,
  markerWidth,
  rowLanes,
  type ArcadeChartStyle,
} from "../src/lib/duel/arcadeChart";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else if (failures.length < 40) failures.push(message);
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const STYLES: ArcadeChartStyle[] = ["snake", "rows"];

/* 1. Rows. */
const NAMED: [number, 0 | 1 | 2][] = [[0, 0], [50, 0], [51, 1], [100, 1], [101, 2], [150, 2]];
for (const [score, row] of NAMED) check(chartRow(score) === row, `score ${score} on row ${row} (got ${chartRow(score)})`);
for (let s = 0; s <= 150; s++) check(chartRow(s) === (s <= 50 ? 0 : s <= 100 ? 1 : 2), `score ${s}: wrong row`);
check(chartScore(-5) === 0 && chartScore(170) === 150 && chartScore(50.4) === 50 && chartScore(NaN) === 0, "stored values clamp to 0–150 and round");
check(chartRow(50.4) === 0 && chartRow(50.6) === 1, "fractions round before the row is picked");

/* 2. Places in both looks. */
for (const style of STYLES) {
  const at = (s: number) => chartPoint(s, style);
  const mid = style === "snake";
  const want: [number, 0 | 1 | 2, number][] = [
    [0, 0, 0],
    [50, 0, 1],
    [51, 1, mid ? 1 - 1 / 50 : 1 / 50],
    [100, 1, mid ? 0 : 1],
    [101, 2, 1 / 50],
    [150, 2, 1],
  ];
  for (const [score, row, x] of want) {
    const p = at(score);
    check(p.row === row && near(p.x, x), `${style}: score ${score} should be row ${row} x ${x.toFixed(3)} (got row ${p.row} x ${p.x.toFixed(3)})`);
  }
  for (let s = 0; s <= 150; s++) {
    const p = at(s);
    check(p.x >= 0 && p.x <= 1 && p.along >= 0 && p.along <= 1, `${style}: score ${s} off its row (${JSON.stringify(p)})`);
    if (s > 0 && chartRow(s) === chartRow(s - 1)) {
      const q = at(s - 1);
      check(p.along > q.along, `${style}: ${s} is not further along than ${s - 1}`);
      const dir = style === "snake" && p.row === 1 ? -1 : 1;
      check(dir * (p.x - q.x) > 0, `${style}: ${s} reads the wrong way on row ${p.row}`);
      check(near(Math.abs(p.x - q.x), 1 / 50), `${style}: one point is 1/50 of a row (${s})`);
    }
  }
  // Each row starts one point past the previous row's end, at the same end of the line in a snake.
  for (const [end, start] of [[50, 51], [100, 101]]) {
    const a = at(end);
    const b = at(start);
    if (style === "snake") check(near(Math.abs(a.x - b.x), 1 / 50), `snake: ${start} continues from ${end} round the bend`);
    else check(near(b.x, 1 / 50) && near(a.x, 1), `rows: ${start} starts its row at the left, ${end} ends its row at the right`);
  }
}
check(JSON.stringify(chartLabels("snake").map((l) => [l.text, l.row, l.side, l.bend])) ===
  JSON.stringify([["0", 0, "left", false], ["50", 0, "right", true], ["100", 1, "left", true], ["150", 2, "right", false]]),
  "snake labels: 0, 50 (right bend), 100 (left bend), 150");
check(JSON.stringify(chartLabels("rows").map((l) => `${l.row}${l.side[0]}${l.text}`)) === JSON.stringify(["0l0", "0r50", "1l50", "1r100", "2l100", "2r150"]),
  "rows labels: 0–50, 50–100, 100–150 at each row's ends");

/* 3. Markers. */
let seed = 1017;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const int = (n: number) => Math.floor(rand() * n);
const NAMES = ["Sam", "Ali", "Jo", "Priyanka", "Kwame", "Lena", "Tom", "Mia", "Zed", "Christopher"];
function overlaps(style: ArcadeChartStyle, trackW: number, scores: number[]): string | null {
  const markers = layoutMarkers(scores.map((score, i) => ({ key: i + 1, score, name: NAMES[i]! })), trackW, style);
  for (const m of markers) {
    const p = chartPoint(scores[m.key - 1]!, style);
    if (m.row !== p.row) return `marker ${m.key} on row ${m.row}, score's row ${p.row}`;
    if (!near(m.px, p.x * trackW)) return `marker ${m.key} at ${m.px}, not its score's place`;
    const badgeCentre = m.labelSide === "right" ? m.left + CHART_BADGE / 2 : m.left + m.width - CHART_BADGE / 2;
    if (!near(badgeCentre, m.px)) return `marker ${m.key}: badge not centred on its place`;
    if (m.width !== markerWidth(NAMES[m.key - 1]!, scores[m.key - 1]!)) return `marker ${m.key}: width`;
    if ((m.px > trackW / 2) !== (m.labelSide === "left")) return `marker ${m.key}: label faces outward`;
  }
  for (const a of markers)
    for (const b of markers)
      if (a.key < b.key && a.row === b.row && a.lane === b.lane && a.left < b.left + b.width + CHART_GAP && b.left < a.left + a.width + CHART_GAP)
        return `markers ${a.key} and ${b.key} overlap (row ${a.row}, lane ${a.lane})`;
  const lanes = rowLanes(markers);
  for (const m of markers) if (m.lane >= lanes[m.row]) return "rowLanes undercounts";
  return null;
}
for (const style of STYLES) {
  for (const trackW of [270, 298, 320, 342]) {
    for (let t = 0; t < 400; t++) {
      const n = 2 + int(9);
      const base = int(151);
      const kind = t % 4;
      const scores = Array.from({ length: n }, () =>
        kind === 0 ? int(151) : kind === 1 ? Math.min(150, base + int(6)) : kind === 2 ? base : [0, 50, 51, 100, 101, 150][int(6)]!,
      );
      const bad = overlaps(style, trackW, scores);
      if (bad) {
        check(false, `${style} ${trackW}px [${scores.join(",")}]: ${bad}`);
        break;
      }
      passes++;
    }
  }
  // Two players a few points apart and a tie stack, never sit on top of each other.
  const apart = layoutMarkers([{ key: 1, score: 132, name: "Sam" }, { key: 2, score: 135, name: "Ali" }], 300, style);
  check(apart[0]!.lane !== apart[1]!.lane, `${style}: 132 and 135 stack`);
  check(apart[1]!.px - apart[0]!.px > 15, `${style}: 3 points apart are ${(apart[1]!.px - apart[0]!.px).toFixed(1)} px apart on a 300 px line`);
  const tie = layoutMarkers([{ key: 1, score: 88, name: "Sam" }, { key: 2, score: 88, name: "Ali" }], 300, style);
  check(tie[0]!.lane === 0 && tie[1]!.lane === 1 && near(tie[0]!.px, tie[1]!.px), `${style}: a tie stacks on one place, slot order`);
}

/* "You" is not a colour. */
{
  const chart = readFileSync("src/components/duel/ArcadeScoreChart.tsx", "utf8");
  check(/YOU_RING = "0 0 0 2px var\(--background\), 0 0 0 4px var\(--foreground\)"/.test(chart), "You has a ring in the foreground colour");
  check(/p\.isMe \? "You" : p\.name/.test(chart) && /p\.isMe \? "font-bold/.test(chart), 'You has its own label, in bold');
  check(!/var\(--me\)|gold|--primary/.test(chart), "the chart never marks You (or anyone) with the gold accent");
  check(/<PlayerBadge look=\{p\.look/.test(chart), "every marker is the player's badge (colour and icon)");
}

/* 4. The look. */
check(ARCADE_CHART_STYLE === "snake", "the default look is snake (Joe's design)");
check(arcadeChartStyle("?chart=rows") === "rows" && arcadeChartStyle("?chart=snake") === "snake", "?chart= picks a look");
check(arcadeChartStyle("") === ARCADE_CHART_STYLE && arcadeChartStyle("?chart=pie") === ARCADE_CHART_STYLE, "anything else draws the default");
const reveal = readFileSync("src/components/duel/ArcadeReveal.tsx", "utf8");
check(/<ArcadeScoreChart/.test(reveal) && !/function Track\(/.test(reveal), "the reveal draws the chart in place of the single line");
check(/score: p\.isMe \? myScore : p\.score/.test(reveal), "the chart reads stored scores only");

console.log(`arcade-chart-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log("PASS: every score sits on its row and place in both looks, markers never overlap, and You stands out without a colour");
