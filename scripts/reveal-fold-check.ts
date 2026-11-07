/**
 * reveal-fold-check (1 Nov 2026, Joe: the score breakdown squashed the snake chart): the arcade answer reveal shows its
 * breakdown as one line until tapped (`revealSummary`, src/components/duel/ArcadeReveal.tsx).
 *
 *  1. On the arcade scoring standard the line is "<score> points · <first part's name> <its points> + bonuses <the other parts>" (text pass, 4 Nov 2026: no "core" or "features"), each
 *     figure as stored in the part lines (stdLines), and the tap opens every stored line.
 *  2. Any other game's line is its first stored line, and the tap opens the rest: every stored line is shown once,
 *     folded or opened, never rewritten (reveal-score-check proves they are all in the markup).
 *  3. Lines that merely look like counts ("Planets 12 / 40") are never read as points.
 *  4. The markup: the folded line is a ≥ 44 px button with aria-expanded, the full list and the parts card are in the
 *     page but hidden until it is opened (room-16-check measures it in Chromium: no scroll at 375×667, the chart's full
 *     height, then opened).
 *
 * room-16-check proves the reveal at 414×896 and 375×667 in Chromium.
 */
import { readFileSync } from "node:fs";
import { revealSummary } from "../src/components/duel/ArcadeReveal";
import { stdLines, type StdPart } from "../src/lib/arcade/arcadeStandard";
import { breakdownRows, plainText, realFullClear, rowText, statRepeatsPart } from "../src/lib/duel/revealBreakdown";
import { engineScoreLines } from "../src/lib/duel/engineBreakdown";
import { nearMiss } from "../src/lib/duel/nearMiss";

let failures = 0;
const check = (ok: boolean, what: string) => {
  if (!ok) {
    failures++;
    console.log(`FAIL ${what}`);
  }
};

const part = (label: string, detail: string, points: number, max: number): StdPart => ({ key: label.toLowerCase(), label, detail, points, max });
const parts = [part("Distance", "412 ft", 110, 130), part("Home runs", "4 of 10", 20, 50), part("Signs", "2 hit", 12, 20)];
const lines = stdLines(parts, 142);
const std = revealSummary(lines, 142);
check(std?.summary === "142 points, distance 110 + bonuses 32", `standard: ${JSON.stringify(std?.summary)}`);
check(JSON.stringify(std?.rest) === JSON.stringify(lines), "standard: the tap opens every stored line");

// A run held up to 1 for playing: its parts are still read as stored.
const low = stdLines([part("Distance", "3 ft", 0, 130), part("Home runs", "0 of 10", 0, 50)], 1);
check(revealSummary(low, 1)?.summary === "1 point, distance 0 + bonuses 0", `at least 1: ${JSON.stringify(revealSummary(low, 1)?.summary)}`);

// Two parts at least: a one-part list falls back to its first line.
const one = stdLines([part("Hands", "23 points", 160, 160)], 160);
check(revealSummary(one, 160)?.summary === one[0], "one part: its own line");

// Not the standard: first line, the rest behind the tap, nothing lost or duplicated.
for (const old of [
  ["Planets 12 / 40 · survived", "Stardust 4/30"],
  ["Core 112 / 150", "Ice 8 / 10", "Big lines 6 / 10", "Treasures 18 / 30"],
  ["4 lanes × 10 = 40", "3 crossings × 20 = 60", "Total → 100 · capped at 150"],
  ["Board cleared → 130 · time +12"],
]) {
  const r = revealSummary(old, 142);
  check(r?.summary === old[0], `${old[0]}: the first stored line (${JSON.stringify(r?.summary)})`);
  check(JSON.stringify([r?.summary, ...(r?.rest ?? [])]) === JSON.stringify(old), `${old[0]}: every stored line once`);
}
check(revealSummary([], 10) === null, "no lines: no summary");

const src = readFileSync("src/components/duel/ArcadeReveal.tsx", "utf8");
check(/data-reveal-summary=\{open \? "open" : "closed"\}/.test(src) && /aria-expanded=\{open\}/.test(src) && /min-h-11/.test(src), "the folded line is a 44 px button with aria-expanded");
// 3 Nov 2026 (Joe's audit): a room folds the breakdown behind "See breakdown"; practice shows it open and no chart.
const list = readFileSync("src/components/duel/RevealBreakdown.tsx", "utf8");
check(/data-reveal-breakdown="" hidden=\{hidden\}/.test(list), "the breakdown list takes its hidden state from the reveal");
check(/<RevealBreakdown lines=\{breakdownLines\} score=\{myScore\} hidden=\{!practice && !open\} \/>/.test(src), "rooms: the full list is in the markup, hidden until opened; practice: open");
check(/data-reveal-tiles=""\s*hidden=\{!practice && !open\}/.test(src), "rooms: the parts card is in the markup, hidden until opened; practice: open");
check(/See breakdown/.test(src), "rooms: the fold is a clear \"See breakdown\" button, not a tiny ▾");
check(/\{!practice \? \(\s*<div data-chart-panel/.test(src), "practice: no snake chart (it would hold one dot)");

// The breakdown's words (revealBreakdown.ts): no arrows, adds up to the score, one "·" a line at most, singular for one,
// lower-case units, every stored line kept on a row.
{
  const rowsStd = breakdownRows(lines, 142);
  const sum = rowsStd.filter((r) => r.kind !== "total" && r.points !== null).reduce((a, r) => a + r.points!, 0);
  check(sum === 142 && rowsStd.at(-1)?.kind === "total" && rowsStd.at(-1)?.points === 142, `standard rows add up to the score (${sum})`);
  const lowRows = breakdownRows(low, 1);
  const adj = lowRows.find((r) => r.kind === "adjust");
  check(adj?.name === "At least 1 for playing" && adj.points === 1, `the at-least-1 is written out (${JSON.stringify(adj)})`);
  const penRows = breakdownRows(stdLines([part("Squares", "40 safe", 120, 150), part("No mines hit", "2 hit", 10, 20)], 120).map((l) => l.replace("Total → 120 of 200", "Total → 120")), 120);
  const pen = penRows.find((r) => r.kind === "adjust");
  check(pen?.name === "Penalties" && pen.points === -10, `penalties written out so the rows add up (${JSON.stringify(pen)})`);
  for (const [stored, want] of [
    ["3 / 25 clays → 2", "3 of 25 clays: 2 points"],
    ["1 / 42 barriers → 2", "1 of 42 barriers: 2 points"],
    ["Solved · 2.6S", "Solved · 2.6 s"],
    ["1 words found → 1", "1 word found: 1 point"],
    ["1 swaps", "1 swap"],
  ] as const) {
    const got = breakdownRows([stored], null).map(rowText).join(" | ");
    check(got === want, `"${stored}" reads "${want}" (got "${got}")`);
  }
  const many = breakdownRows(["Best streak 4 · Gold 2/3 · Let fall 1/2"], null);
  check(many.length === 3 && many.every((r) => (rowText(r).match(/·/g) ?? []).length <= 1), "a stored line with several \"·\" splits into rows");
  check(breakdownRows(["A → 5", "A → 5"], null).length === 1, "no duplicated rows");
  for (const r of [...rowsStd, ...lowRows, ...penRows]) check(!rowText(r).includes("→"), `no arrow: ${rowText(r)}`);
}
check(nearMiss("pool", { spots: 0 }) === "7 left to pot", `Cue Ball's near miss reads "7 left to pot" (${nearMiss("pool", { spots: 0 })})`);
check(!/from the end/.test(readFileSync("src/lib/duel/nearMiss.ts", "utf8").replace(/\/\/.*$/gm, "")), "no \"N from the end\" lines");
// A real full clear only: a finish whose core part is full (Flightpath, Home Run, Curl Champ, Ringer, Five Hands
// always "finish", and cheered "Full clear!" on a score of 1).
check(!realFullClear("finish", low, 1), "no \"Full clear!\" on a score of 1");
check(realFullClear("finish", stdLines([part("Core", "all", 130, 130), part("Speed", "x", 70, 70)], 200), 200), "a full core on a finish is a full clear");
check(!realFullClear("time", stdLines([part("Core", "all", 130, 130), part("Speed", "x", 70, 70)], 200), 200), "a run that ran out of time is no full clear");
const celebrationSrc = readFileSync("src/components/duel/ArcadeCelebration.tsx", "utf8");
check(!/sr-only/.test(celebrationSrc), "the headline shows once (no second, screen-reader copy)");
check(/useState\(false\)/.test(src), "folded by default");

// 6 Nov 2026 (Joe's review of the re-captured reveals).
// Grappler's course part is full at 70 % of the course: "Full clear!" only for the whole course.
const swingLines = stdLines([part("Course", "85 % of the course, 44 of 51 stretches", 110, 110), part("Pars", "32 of 40", 32, 40)], 142);
check(!realFullClear("finish", swingLines, 142), "no \"Full clear!\" at 85 % of the course (44 of 51 stretches)");
check(realFullClear("finish", stdLines([part("Course", "100 % of the course, 51 of 51 stretches", 110, 110), part("Pars", "32 of 40", 32, 40)], 142), 142), "the whole course is a full clear");
// Plain words for a count and its cost each, and Meteor's gold stars.
check(plainText("2 lives lost × 5") === "2 lives lost, 5 each", `"2 lives lost, 5 each" (${plainText("2 lives lost × 5")})`);
// Stats a part's detail already states are left out (Summit / Thirteen's Time, Thirteen's Removed, Curl Champ's 4-foot);
// Rally's paddle width is never a stat.
const cardLines = stdLines([part("Pyramid cards", "28 of 28 removed", 120, 120), part("Speed", "cleared in 23.0 s", 47, 50)], 167);
check(statRepeatsPart("Time", cardLines, [], "23.0 s"), "Time 23.0 s repeats Speed's detail");
check(statRepeatsPart("Removed", cardLines, [], "28 / 28"), "Removed 28 / 28 repeats the cards' detail");
check(statRepeatsPart("In the 4-foot", stdLines([part("Stones", "8 thrown", 137, 150), part("Red ring", "6 in the 4-foot", 15, 20)], 152), [], "6 / 8"), "In the 4-foot repeats Red ring");
check(!statRepeatsPart("Length", stdLines([part("Stars eaten", "22 stars", 120, 120), part("Combos", "4", 14, 20)], 134), [], "25"), "an extra fact stays");
check(statRepeatsPart("Paddle", ["Gold-ball hits: 22 → 133 of 140"], [], "40 px"), "no paddle width");
// Bonk, Pull! and Mixed Signals: rows with points, costs included, adding up to the stored score.
const sum = (ls: string[] | null, score: number) => {
  const rows = breakdownRows(ls ?? [], score);
  const total = rows.filter((r) => r.kind !== "total" && r.kind !== "note").reduce((a, r) => a + (r.points ?? 0), 0);
  return { rows, total };
};
{
  const whack = engineScoreLines("whack", { hits: 4, totalTargets: 64, wrong: 2, bombs: 1, empty: 83, depth: { base: 0, combo: 0, diamonds: 0, comboBest: 1, diamondHits: 0, diamondTotal: 2 } }, ["4 / 64 hits → 0"], 0);
  check(whack !== null, "Bonk: rows for a stored depth run");
  const w = sum(whack, 0);
  check(w.total === 0 && w.rows.some((r) => r.name === "Wrong colour" && (r.points ?? 0) < 0) && w.rows.some((r) => r.name === "Hedgehogs"), `Bonk: wrong colour and hedgehogs as cost rows adding up to 0 (${w.rows.map(rowText).join(" | ")})`);
  check(!w.rows.some((r) => r.name === "Penalties" || r.name === "Adjustment"), "Bonk: no unexplained gap row");
  check(engineScoreLines("whack", { hits: 4, totalTargets: 64, wrong: 2, bombs: 1, empty: 83, depth: { base: 9, combo: 0, diamonds: 0 } }, [], 9) === null, "Bonk: counts that don't give the stored base fall back to the stored lines");
  const clash = engineScoreLines("stroop", { wrong: 38, depth: { base: 0, gold: 3, streak: 0, stretch: 0, best: 2, golds: 1, goldWords: 5, standard: 1 } }, ["14 / 52 correct → 0", "38 wrong · 0 net → 0 · more than 3 wrong", "streak +0 (best 2) · gold +3 (1/5)"], 0);
  const c = sum(clash, 0);
  check(clash !== null && c.total === 0 && c.rows.some((r) => r.name === "Wrong words" && (r.points ?? 0) < 0), `Mixed Signals: words right less the wrong words, adding up to 0 (${c.rows.map(rowText).join(" | ")})`);
  const finish = engineScoreLines("stroop", { wrong: 1, depth: { base: 150, gold: 12, streak: 15, stretch: 9, best: 40, golds: 4, goldWords: 5, standard: 1 } }, ["51 / 52 correct → 186", "1 wrong · finish 150 · speed +9", "streak +15 (best 40) · gold +12 (4/5)"], 186);
  check(finish !== null && sum(finish, 186).total === 186, "Mixed Signals: a finish's rows add up to its score");
  const clay = engineScoreLines("clayshoot", { orangeHits: 1, goldHits: 0, birdHits: 0, emptyShots: 86, emptyShotCost: 2, total: 25, depth: { base: 2, doubles: 0, streak: 0, doublesHit: 0, doublesTotal: 7, streakBest: 1 } }, ["1 / 25 clays → 2"], 2, 9);
  const k = sum(clay, 2);
  check(clay !== null && k.total === 2 && k.rows.some((r) => r.name === "Empty shots" && (r.points ?? 0) < 0), `Pull!: the empty-shot cost as a row, adding up to 2 (${k.rows.map(rowText).join(" | ")})`);
}

if (failures) {
  console.log(`FAIL reveal-fold-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("PASS reveal-fold-check: the breakdown folds to one line (the first part + bonuses on the standard, else the first stored line); every stored line once, behind a 44 px tap");
