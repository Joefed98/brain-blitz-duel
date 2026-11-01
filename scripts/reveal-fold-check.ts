/**
 * reveal-fold-check (1 Nov 2026, Joe: the score breakdown squashed the snake chart): the arcade answer reveal shows its
 * breakdown as one line until tapped (`revealSummary`, src/components/duel/ArcadeReveal.tsx).
 *
 *  1. On the arcade scoring standard the line is "<score> · core <first part> + features <the other parts>", each
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
check(std?.summary === "142 · core 110 + features 32", `standard: ${JSON.stringify(std?.summary)}`);
check(JSON.stringify(std?.rest) === JSON.stringify(lines), "standard: the tap opens every stored line");

// A run held up to 1 for playing: its parts are still read as stored.
const low = stdLines([part("Distance", "3 ft", 0, 130), part("Home runs", "0 of 10", 0, 50)], 1);
check(revealSummary(low, 1)?.summary === "1 · core 0 + features 0", `at least 1: ${JSON.stringify(revealSummary(low, 1)?.summary)}`);

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
check(/data-reveal-breakdown="" hidden=\{!open\}/.test(src), "the full list is in the markup, hidden until opened");
check(/data-reveal-tiles=""\s*hidden=\{!open\}/.test(src), "the parts card is in the markup, hidden until opened");
check(/useState\(false\)/.test(src), "folded by default");

if (failures) {
  console.log(`FAIL reveal-fold-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("PASS reveal-fold-check: the breakdown folds to one line (core + features on the standard, else the first stored line); every stored line once, behind a 44 px tap");
