/**
 * arcade-chart-check (17 Oct 2026): the room answer reveal's arcade chart (display only;
 * src/lib/duel/arcadeChart.ts, src/components/duel/ArcadeScoreChart.tsx). One look: the snake.
 *
 *  1. Rows: every score 0–150 sits on row 0 (0–50), 1 (51–100) or 2 (101–150), with 0, 50, 51,
 *     100, 101 and 150 checked by name; out-of-range and fractional stored values clamp and round.
 *  2. Places: 0 at the line's left end, 50 at the first row's right end, 51 one point round the
 *     bend into the middle row (which reads right to left), 100 at its left end, 101 one point
 *     round the second bend, 150 at the right end; along the snake every score is further along
 *     than the one below it. Since 3 Nov 2026 a fourth band, 151–200, reads right to left (200 at the left end), on
 *     one 0–200 axis for every game, labelled 0, 50, 100, 150 and 200 down the left.
 *  3. Markers: random rooms of 2–10 players (scores bunched, a few points apart and tied) at
 *     phone widths: no two markers in a row overlap, each badge sits on its score's exact place,
 *     names face the chart's middle, ties stack, and "You" is told by ring, label and weight,
 *     never by a colour.
 *  4. No points figure: markers carry a badge and a name only (widths have no room for a number),
 *     the component never draws, titles or tags a score, and there is no other look and no
 *     address option.
 *  5. Legibility (23 Oct 2026, Prompt D): every player's own line along the snake in their colour,
 *     about twice the old 3 px track (6 px, round caps and joins), this player's drawn last and
 *     thicker; all text #F3F1EC, at least 13 px, names semibold, on a dark backing; the chart takes
 *     the reveal's spare height. room-extras-check proves in the browser that no two labels overlap.
 *
 *   bun scripts/arcade-chart-check.ts
 */
import { readFileSync } from "node:fs";

import {
  CHART_BADGE,
  CHART_GAP,
  CHART_ROW_COUNT,
  CHART_ROWS,
  chartLabels,
  chartOnBend,
  chartPoint,
  chartRow,
  chartScore,
  layoutMarkers,
  markerWidth,
  rowLanes,
} from "../src/lib/duel/arcadeChart";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else if (failures.length < 40) failures.push(message);
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/* 1. Rows. */
const NAMED: [number, 0 | 1 | 2][] = [[0, 0], [50, 0], [51, 1], [100, 1], [101, 2], [150, 2]];
for (const [score, row] of NAMED) check(chartRow(score) === row, `score ${score} on row ${row} (got ${chartRow(score)})`);
for (let s = 0; s <= 150; s++) check(chartRow(s) === (s <= 50 ? 0 : s <= 100 ? 1 : 2), `score ${s}: wrong row`);
check(chartScore(-5) === 0 && chartScore(170) === 150 && chartScore(50.4) === 50 && chartScore(NaN) === 0, "stored values clamp to 0–150 and round");
check(chartRow(50.4) === 0 && chartRow(50.6) === 1, "fractions round before the row is picked");

/* 2. Places on the snake. */
const want: [number, 0 | 1 | 2, number][] = [
  [0, 0, 0],
  [50, 0, 1],
  [51, 1, 1 - 1 / 50],
  [100, 1, 0],
  [101, 2, 1 / 50],
  [150, 2, 1],
];
for (const [score, row, x] of want) {
  const p = chartPoint(score);
  check(p.row === row && near(p.x, x), `score ${score} should be row ${row} x ${x.toFixed(3)} (got row ${p.row} x ${p.x.toFixed(3)})`);
}
for (let s = 0; s <= 150; s++) {
  const p = chartPoint(s);
  check(p.x >= 0 && p.x <= 1 && p.along >= 0 && p.along <= 1, `score ${s} off its row (${JSON.stringify(p)})`);
  if (s > 0 && chartRow(s) === chartRow(s - 1)) {
    const q = chartPoint(s - 1);
    check(p.along > q.along, `${s} is not further along than ${s - 1}`);
    const dir = p.row === 1 ? -1 : 1;
    check(dir * (p.x - q.x) > 0, `${s} reads the wrong way on row ${p.row}`);
    check(near(Math.abs(p.x - q.x), 1 / 50), `one point is 1/50 of a row (${s})`);
  }
}
for (const [end, start] of [[50, 51], [100, 101]])
  check(near(Math.abs(chartPoint(end).x - chartPoint(start).x), 1 / 50), `${start} continues from ${end} round the bend`);
// Four bands (3 Nov 2026, the reveal's own screen; Joe's correction the same day): one 0–200 axis for every game, each
// row a band and each bend a boundary. The labels: 0 at the snake's start and 200 at its end (both left), 50 and 150
// beside the right-hand bends, 100 beside the left-hand one; no lines across the chart; exactly 50, 100 and 150 on their
// bends. (The brief changed the rule: three rows on the game's own maximum, labelled 0, 50, 100, 150.)
check(
  JSON.stringify(chartLabels().map((l) => [l.text, l.edge, l.side])) ===
    JSON.stringify([["0", 0, "left"], ["50", 1, "right"], ["100", 2, "left"], ["150", 3, "right"], ["200", 4, "left"]]) &&
    JSON.stringify(chartLabels(200)) === JSON.stringify(chartLabels()),
  "labels: 0 and 200 at the snake's left ends, 50 and 150 by the right bends, 100 by the left bend, the same for every game",
);
check(chartOnBend(50) === 1 && chartOnBend(100, 200) === 2 && chartOnBend(150, 200) === 3 && chartOnBend(150) === 3, "50, 100 and 150 sit on the bends");
check([0, 1, 49, 51, 99, 101, 149, 151, 199, 200].every((v) => chartOnBend(v, 200) === null) && chartOnBend(50.4) === 1, "no other score sits on a bend (scores round first)");
{
  const chart = readFileSync("src/components/duel/ArcadeScoreChart.tsx", "utf8");
  check(!/data-chart-band|<line[^>]*x2=\{width\}/.test(chart), "no lines across the chart");
  check(/data-chart-bend=\{chartOnBend\(p\.score, max\)/.test(chart) && /bend % 2 === 1 \? R \+ BEND : L - BEND, y: edgeY\(bend\)/.test(chart), "a dot at 50, 100 or 150 is drawn at its bend's middle");
  check(/chartOnBend\(score, max\) \? bendLen\(p\.row\) \/ 2/.test(chart), "the player's line runs on to the bend for those scores");
}
check(CHART_ROW_COUNT === 4 && CHART_ROWS.map((r) => `${r.lo}-${r.hi}`).join() === "0-50,51-100,101-150,151-200", "four bands of 50: 0–50, 51–100, 101–150, 151–200");
for (const [score, row, x] of [[151, 3, 1 - 1 / 50], [175, 3, 0.5], [200, 3, 0], [150, 2, 1]] as const) {
  const p = chartPoint(score, 200);
  check(p.row === row && near(p.x, x), `score ${score} of 200 should be row ${row} x ${x.toFixed(3)} (got row ${p.row} x ${p.x.toFixed(3)})`);
}
check(chartScore(250, 200) === 200 && chartScore(170, 150) === 150, "a score clamps to its game's maximum and the axis' 200");
for (let s = 151; s <= 200; s++) {
  const p = chartPoint(s, 200);
  const q = chartPoint(s - 1, 200);
  if (p.row === q.row) check(q.x - p.x > 0, `${s} reads the wrong way on the fourth row (right to left)`);
}

/* 3. Markers. */
let seed = 1017;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const int = (n: number) => Math.floor(rand() * n);
const NAMES = ["Sam", "Ali", "Jo", "Priyanka", "Kwame", "Lena", "Tom", "Mia", "Zed", "Christopher"];
function layoutProblem(trackW: number, scores: number[]): string | null {
  const markers = layoutMarkers(scores.map((score, i) => ({ key: i + 1, score, name: NAMES[i]! })), trackW);
  for (const m of markers) {
    const p = chartPoint(scores[m.key - 1]!);
    if (m.row !== p.row) return `marker ${m.key} on row ${m.row}, score's row ${p.row}`;
    if (!near(m.px, p.x * trackW)) return `marker ${m.key} at ${m.px}, not its score's place`;
    const badgeCentre = m.labelSide === "right" ? m.left + CHART_BADGE / 2 : m.left + m.width - CHART_BADGE / 2;
    if (!near(badgeCentre, m.px)) return `marker ${m.key}: badge not centred on its place`;
    if (m.width !== markerWidth(NAMES[m.key - 1]!)) return `marker ${m.key}: width`;
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
for (const trackW of [270, 298, 320, 342]) {
  for (let t = 0; t < 400; t++) {
    const n = 2 + int(9);
    const base = int(151);
    const kind = t % 4;
    const scores = Array.from({ length: n }, () =>
      kind === 0 ? int(151) : kind === 1 ? Math.min(150, base + int(6)) : kind === 2 ? base : [0, 50, 51, 100, 101, 150][int(6)]!,
    );
    const bad = layoutProblem(trackW, scores);
    if (bad) {
      check(false, `${trackW}px [${scores.join(",")}]: ${bad}`);
      break;
    }
    passes++;
  }
}
const apart = layoutMarkers([{ key: 1, score: 132, name: "Sam" }, { key: 2, score: 135, name: "Ali" }], 300);
check(apart[0]!.lane !== apart[1]!.lane, "132 and 135 stack");
check(apart[1]!.px - apart[0]!.px > 15, `3 points apart are ${(apart[1]!.px - apart[0]!.px).toFixed(1)} px apart on a 300 px line`);
const tie = layoutMarkers([{ key: 1, score: 88, name: "Sam" }, { key: 2, score: 88, name: "Ali" }], 300);
check(tie[0]!.lane === 0 && tie[1]!.lane === 1 && near(tie[0]!.px, tie[1]!.px), "a tie stacks on one place, slot order");
check(markerWidth("Sam") === markerWidth("Sam"), "a marker's width depends on its name only");

/* "You", and no figures. */
{
  const chart = readFileSync("src/components/duel/ArcadeScoreChart.tsx", "utf8");
  const code = chart.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  check(/YOU_RING = "0 0 0 2px var\(--background\), 0 0 0 4px var\(--foreground\)"/.test(code), "You has a ring in the foreground colour");
  check(/p\.isMe \? "You" : p\.name/.test(code) && /p\.isMe \? "font-bold/.test(code), "You has its own label, in bold");
  check(!/var\(--me\)|gold|--primary/.test(code), "the chart never marks You (or anyone) with the gold accent");
  check(/<PlayerBadge look=\{p\.look/.test(code), "every marker is the player's badge (colour and icon)");
  check(!/chartScore|data-chart-score|title=|\{p\.score\}|tabular-nums">\{/.test(code), "no marker draws, titles or tags a score");
  check(!/"rows"|\?chart=|URLSearchParams|ARCADE_CHART_STYLE|arcadeChartStyle|lineY.map/.test(code), "one look: no rows drawing and no address option");
  const lib = readFileSync("src/lib/duel/arcadeChart.ts", "utf8");
  check(!/ARCADE_CHART_STYLE|ArcadeChartStyle|"rows"|URLSearchParams/.test(lib), "arcadeChart.ts has the snake only");
}
/* 5. Legibility. */
{
  const code = readFileSync("src/components/duel/ArcadeScoreChart.tsx", "utf8");
  check(/const TEXT = "#F3F1EC"/.test(code), "chart text is #F3F1EC");
  check(!/text-\[(9|10|11|12)px\]|text-xs/.test(code), "no chart text under 13 px");
  check(/text-\[13px\]/.test(code) && /font-semibold/.test(code), "names and labels are 13 px semibold");
  check(/BACKING = "rgba\(7, 7, 10, 0\.\d+\)"/.test(code) && /background: BACKING/.test(code), "text sits on a dark backing");
  const lineW = Number(/const LINE_W = (\d+)/.exec(code)?.[1]);
  const myW = Number(/const MY_LINE_W = (\d+)/.exec(code)?.[1]);
  check(lineW >= 6 && myW > lineW, `lines about twice the old 3 px (${lineW}), this player's thicker (${myW})`);
  check((code.match(/strokeLinejoin="round"/g) ?? []).length >= 2 && /data-chart-line/.test(code), "each player's line has round joins");
  check(/Number\(a\.isMe\) - Number\(b\.isMe\)/.test(code), "this player's line is drawn last (on top)");
  check(/stroke=\{colourOf\(p\)\}/.test(code), "each line in its player's colour");
  check(/flex-1/.test(code) && /MAX_EXTRA/.test(code), "the chart takes the reveal's spare height");
}
const reveal = readFileSync("src/components/duel/ArcadeReveal.tsx", "utf8");
check(/<ArcadeScoreChart/.test(reveal) && !/function Track\(/.test(reveal), "the reveal draws the chart in place of the single line");
check(/score: p\.isMe \? myScore : p\.score/.test(reveal), "the chart places stored scores only");

console.log(`arcade-chart-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log("PASS: every score sits on its row and place on the snake, markers never overlap and show no points, and You stands out without a colour");
