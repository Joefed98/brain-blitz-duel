/**
 * retro-summary-check (15 Nov 2026, the Retro overhaul, stage 2): the Retro games' run summaries on the answer reveal
 * (src/lib/replay/retroSummary.ts, src/components/duel/RetroRunSummary.tsx).
 *
 *  1. Every Retro game: a stored run on its dealt stamp (scripts/fixtures/replay-runs.json) gives a summary that ends
 *     where the server's replay of that run ends, with two or three key numbers in plain words (no scoring jargon, no "×"),
 *     marks inside the run (0…1) and a legend naming only the kinds on the timeline.
 *  2. The numbers are the sim's own counters at the end of the replay (Tempo's Perfect and misses, Meteor's stars, the
 *     wall's bricks, the well's lines) and the same on a second call (pure).
 *  3. Tempo's timeline has every judged note in the song's order; Breaker, Meteor and Blockzone carry the final frame.
 *  4. No summary for a game outside the ten, or with no stored run; a broken run gives none rather than throwing.
 *  5. The reveal reserves the summary's space (fixed heights in reveal-screen.css) and loads the replay after its first
 *     paint (the component), so nothing moves when it arrives; ArcadeReveal still draws no frozen world.
 */
import { readFileSync } from "node:fs";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { retroRunSummary } from "../src/lib/replay/retroSummary";
import { RETRO_SUMMARY_TYPES, retroSummaryHasPicture } from "../src/lib/replay/retroSummaryTypes";
import { makeStepper, replayToEnd } from "../src/lib/replay/steppers";
import { SCORE_JARGON } from "../src/lib/duel/scoreList";
import type { PuzzleData } from "../src/lib/duel/types";

let checks = 0;
const failures: string[] = [];
function check(ok: unknown, message: string): void {
  checks++;
  if (!ok) failures.push(message);
}

const STAMP: Record<string, string> = {
  hover: "hoverRev", breaker: "brkRev", rally: "rallyRev", wavefront: "wavRev", burst: "burstRev",
  beat: "beatRev", snake: "snakeRev", cross: "crossRev", pinball: "pinRev", blockfall: "blockfallRev",
};
const runs = (JSON.parse(readFileSync("scripts/fixtures/replay-runs.json", "utf8")) as { runs: { type: string; puzzle: PuzzleData; answer: string }[] }).runs;

for (const type of RETRO_SUMMARY_TYPES) {
  const dealt = (generatePuzzle(type as never) as unknown as Record<string, unknown>)[STAMP[type]!];
  const mine = runs.filter((r) => r.type === type && (r.puzzle as unknown as Record<string, unknown>)[STAMP[type]!] === dealt);
  check(mine.length > 0, `${type}: a stored run on the dealt stamp (${STAMP[type]} ${String(dealt)})`);
  for (const run of mine) {
    const s = retroRunSummary(run.puzzle, run.answer);
    check(s, `${type}: a summary for a stored run`);
    if (!s) continue;
    // 1.
    const stepper = makeStepper(run.puzzle, run.answer)!;
    const end = replayToEnd(stepper);
    check(s.stats.length >= 2 && s.stats.length <= 3, `${type}: two or three key numbers (${s.stats.length})`);
    for (const stat of s.stats) {
      const text = `${stat.label} ${stat.value}`;
      check(stat.label.length > 0 && stat.label.length <= 22, `${type}: "${stat.label}" is a short label`);
      check(!/×|→|·/.test(text), `${type}: "${text}" has no stray symbol`);
      check(!SCORE_JARGON.some((re) => re.test(text)), `${type}: "${text}" uses no scoring jargon`);
      check(/^[0-9]/.test(stat.value) || stat.value === "none", `${type}: "${stat.label}" shows a number ("${stat.value}")`);
    }
    check(s.marks.every((m) => m.at >= 0 && m.at <= 1), `${type}: every mark inside the run`);
    for (const k of Object.keys(s.legend)) check(s.marks.some((m) => m.kind === k), `${type}: the legend names ${k} only when it is on the timeline`);
    check(s.endedAt > 0 && s.endedAt <= 1, `${type}: the run's end inside the clock`);
    check(Math.abs(s.endedAt - Math.min(1, end.ticks / stepper.runTicks)) < 1e-9, `${type}: the summary ends where the server's replay ends`);
    // 2.
    const f = end.state as Record<string, unknown> & { bricks?: number[]; body?: unknown[] };
    const value = (label: string) => s.stats.find((x) => x.label === label)?.value;
    if (type === "beat") {
      check(value("Perfect") === String(f["perfect"]), `beat: Perfect is the sim's count`);
      check(value("Missed") === String(f["misses"]), `beat: Missed is the sim's count`);
    }
    if (type === "snake") check(value("Stars eaten") === String(f["eaten"]) && value("Comet length") === String(f.body?.length), `snake: stars and length are the sim's`);
    if (type === "blockfall") check(value("Lines") === String(f["lines"]), `blockfall: Lines is the sim's count`);
    if (type === "breaker") check(value("Bricks broken")?.startsWith(String(f.bricks!.filter((hp) => hp <= 0).length)), `breaker: bricks broken from the wall as left`);
    check(JSON.stringify(retroRunSummary(run.puzzle, run.answer)?.stats) === JSON.stringify(s.stats), `${type}: the same summary twice`);
    // 3.
    check(s.picture === retroSummaryHasPicture(type), `${type}: the picture flag`);
    if (type === "beat") {
      const judged = (f["judged"] as number[]).filter((j) => j >= 1 && j <= 4).length;
      check(s.notes?.length === judged, `beat: every judged note on the timeline (${s.notes?.length} of ${judged})`);
      check((s.notes ?? []).every((n, i, a) => i === 0 || a[i - 1]!.at <= n.at), `beat: notes in the song's order`);
    }
  }
}

// 4.
const tilt = generatePuzzle("tilt" as never) as unknown as PuzzleData;
check(retroRunSummary(tilt, "1|0|") === null, "no summary for a game outside the ten");
const hover = runs.find((r) => r.type === "hover")!;
check(retroRunSummary(hover.puzzle, null) === null, "no summary with no stored run");
let threw = false;
try {
  retroRunSummary(hover.puzzle, "garbage|x|;;;|");
} catch {
  threw = true;
}
check(!threw, "a broken run never throws");

// 5.
const css = readFileSync("src/polish-layout/reveal-screen.css", "utf8");
for (const rule of [".retro-summary-top", ".retro-summary-with-picture .retro-summary-top", ".retro-summary-timeline-wrap", ".retro-summary-stat"]) {
  const body = css.slice(css.indexOf(`${rule} {`));
  check(/height: \d+px;/.test(body.slice(0, body.indexOf("}"))), `${rule}: a fixed height`);
}
const component = readFileSync("src/components/duel/RetroRunSummary.tsx", "utf8");
check(/setTimeout\(/.test(component) && /import\("@\/lib\/replay\/retroSummary"\)/.test(component), "the replay is loaded and run after the first paint");
check(/data-retro-summary=\{summary \? puzzle\.type : "pending"\}/.test(component), "the pending box is drawn in the summary's place");
const reveal = readFileSync("src/components/duel/ArcadeReveal.tsx", "utf8");
check(/<RetroRunSummary /.test(reveal) && !/drawFinal|function Backdrop/.test(reveal), "ArcadeReveal draws the summary and no frozen world");

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL ${f}`);
  console.log(`FAIL retro-summary-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS retro-summary-check: ${checks} checks (a summary for every Retro game's stored runs on its dealt stamp, plain key numbers from the sim's own counters, Tempo's notes, the reserved space)`);
