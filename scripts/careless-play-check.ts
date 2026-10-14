/**
 * Careless-play costs (13 Oct 2026; scoring reference open item 16):
 *
 *   - Flash (`reaction`, tapRev 2): false starts cost 8 each for the first two,
 *     11 each after that (tapRev 1 and unstamped: 8 each).
 *   - Bang On (`stopwatch`, tapRev 2): the same line to 101 at 200 ms, then an
 *     even fall to 0 at 325 ms (tapRev 1: to 74 at 300 ms, 0 at 500 ms).
 *   - Pull! (`clayshoot`, clayRev 4): rev 3's clays and birds, plus 1 point for
 *     every 20 shots that hit nothing beyond the first 30.
 *
 * Proves: older stamps score exactly as before (independent copies of the old
 * formulas, and rev-3 Pull! replays matching rev 4 tick for tick apart from the
 * score); the new anchors; the stored breakdown the reveals read; and, on 30
 * seeded room puzzles played by the fairness kits (scripts/puzzle-fairness/),
 * that the careless lines land where asked while honest medians move by at most 3.
 *
 * Since the 14 Oct 2026 Speed tuning rooms deal Flash and Bang On `tapRev: 3` and
 * Pull! `clayRev: 5` (scripts/speed-oct14-check.ts), so this check deals the
 * 13 Oct puzzles itself (scripts/speed-oct14-legacy-generators.ts, the same seeds
 * main dealt) to keep proving the tapRev 2 / clayRev 4 change.
 *
 *   bun scripts/careless-play-check.ts            # 30 seeds (5001–5030)
 *   bun scripts/careless-play-check.ts --md       # also print the markdown table
 */
import { clayEmptyShotCost, clayEmptyShots, clayScore, CLAY_CONFIG, CLAY_REV, CLAY_REV3, CLAY_REV4 } from "../src/lib/arcade/clayShoot";
import { replayClayRun } from "../src/lib/duel/clayShoot";
import { withPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
import { reactionFalseStartCost, scoreReaction, scoreStopWatch } from "../src/lib/duel/scoring";
import { TAP_REV, TAP_REV_CARELESS } from "../src/lib/duel/tapLog";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LEVELS } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { grade, runPlay, runSpam, type GradedRun } from "./puzzle-fairness/run";
import { beforePuzzle } from "./speed-bands-oct14";

const MD = process.argv.includes("--md");
const SEEDS = Array.from({ length: 30 }, (_, i) => 5001 + i);
const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);
const clamp = (v: number) => Math.max(0, Math.min(150, v));

/* ------------------------------ old formulas (copies) ------------------------------ */

const oldReaction = (avg: number, fs: number) =>
  clamp((avg <= 200 ? 150 : clamp(Math.round(150 - 0.16 * (avg - 200)))) - 8 * Math.max(0, fs));
const oldStopWatch = (d: number, rev1: boolean) => {
  if (d <= 20) return 150;
  if (rev1 && d > 300) return clamp(Math.round((74 * (500 - d)) / 200));
  return clamp(Math.round(150 - 0.27 * (d - 20)));
};
const oldClay = (orange: number, gold: number, birds: number, rev?: number) => {
  const hasBirds = rev === 2 || rev === 3;
  const all = orange === 22 && gold === 3 && (!hasBirds || birds === 0);
  return clamp(orange * 5 + gold * 10 + (all ? 10 : 0) - (hasBirds ? birds * 10 : 0));
};

/* ----------------------------------- 1. anchors ----------------------------------- */

let anchorCount = 0;
for (let avg = 100; avg <= 1200; avg += 7) {
  for (let fs = 0; fs <= 20; fs++) {
    anchorCount++;
    for (const rev of [0, TAP_REV]) if (scoreReaction(avg, fs, rev) !== oldReaction(avg, fs)) fail(`Flash rev ${rev} avg ${avg} fs ${fs} changed`);
    const want = clamp((avg <= 200 ? 150 : clamp(Math.round(150 - 0.16 * (avg - 200)))) - (8 * Math.min(fs, 2) + 11 * Math.max(0, fs - 2)));
    if (scoreReaction(avg, fs, TAP_REV_CARELESS) !== want) fail(`Flash rev 2 avg ${avg} fs ${fs}: ${scoreReaction(avg, fs, TAP_REV_CARELESS)} ≠ ${want}`);
  }
}
if (reactionFalseStartCost(2, 2) !== 16 || reactionFalseStartCost(3, 2) !== 27 || reactionFalseStartCost(9, 2) !== 93 || reactionFalseStartCost(9, 1) !== 72) fail("Flash false-start cost anchors");
for (let d = 0; d <= 500; d++) {
  anchorCount++;
  for (const rev of [0, TAP_REV]) {
    if (scoreStopWatch(d, rev) !== oldStopWatch(d, false)) fail(`Bang On rev ${rev} ${d} ms changed (legacy shape)`);
    if (withPuzzleScoreRev(1, () => scoreStopWatch(d, rev)) !== oldStopWatch(d, true)) fail(`Bang On rev ${rev} ${d} ms changed (puzzleScoreRev 1)`);
  }
  const now = withPuzzleScoreRev(1, () => scoreStopWatch(d, TAP_REV_CARELESS));
  if (d <= 200 && now !== oldStopWatch(d, true)) fail(`Bang On rev 2 ${d} ms moved below the knee`);
}
const sw = (d: number) => withPuzzleScoreRev(1, () => scoreStopWatch(d, TAP_REV_CARELESS));
if (sw(200) !== 101 || sw(236) !== 72 || sw(325) !== 0 || sw(500) !== 0 || sw(20) !== 150) fail(`Bang On rev 2 anchors: 200→${sw(200)} 236→${sw(236)} 325→${sw(325)}`);
for (let orange = 0; orange <= 22; orange++)
  for (const gold of [0, 1, 2, 3])
    for (const birds of [0, 1, 5])
      for (const empty of [0, 30, 49, 50, 300]) {
        anchorCount++;
        for (const rev of [undefined, 2, CLAY_REV3]) if (clayScore(orange, gold, birds, rev, empty) !== oldClay(orange, gold, birds, rev)) fail(`Pull! rev ${rev} changed`);
        const want = clamp(oldClay(orange, gold, birds, 3) - Math.floor(Math.max(0, empty - 30) / 20));
        if (clayScore(orange, gold, birds, CLAY_REV4, empty) !== want) fail(`Pull! rev 4 ${orange}/${gold}/${birds}/${empty}`);
      }
if (clayEmptyShotCost(30, CLAY_REV4) !== 0 || clayEmptyShotCost(49, CLAY_REV4) !== 0 || clayEmptyShotCost(50, CLAY_REV4) !== 1 || clayEmptyShotCost(330, CLAY_REV4) !== 15 || clayEmptyShotCost(330, CLAY_REV3) !== 0) fail("Pull! empty-shot cost anchors");
if (CLAY_REV < CLAY_REV4 || CLAY_CONFIG.birdPenalty !== 10) fail("Pull! current revision");
console.log(`anchors: ${anchorCount} score points; older stamps match independent copies of the old formulas; new anchors hold`);

/* ------------------------ 2. room puzzles: before / after + identity ------------------------ */

type Row = { label: string; before: number[]; after: number[] };
const restamp = (p: PuzzleData): PuzzleData =>
  p.type === "clayshoot" ? { ...p, clayRev: CLAY_REV3 } : ({ ...p, tapRev: TAP_REV } as PuzzleData);

function audit(type: PuzzleType): Row[] {
  const kit = KITS[type]!;
  const rows = new Map<string, Row>();
  const add = (label: string, before: GradedRun, after: GradedRun) => {
    const row = rows.get(label) ?? { label, before: [], after: [] };
    row.before.push(before.score);
    row.after.push(after.score);
    rows.set(label, row);
  };
  let identity = 0;
  for (const seed of SEEDS) {
    const after = beforePuzzle(type, seed);
    const wantRev = type === "clayshoot" ? CLAY_REV4 : TAP_REV_CARELESS;
    const rev = type === "clayshoot" ? (after as { clayRev?: number }).clayRev : (after as { tapRev?: number }).tapRev;
    if (rev !== wantRev) fail(`${type} seed ${seed}: 13 Oct puzzle stamped ${rev}, want ${wantRev}`);
    const before = restamp(after);
    const runs: { label: string; answer: string; ms: number }[] = [
      ...runSpam(kit, after, seed).map((s) => ({ label: s.label, answer: s.answer, ms: s.msRemaining })),
      ...LEVELS.map((level) => {
        const r = runPlay(kit, after, seed, level);
        return { label: level, answer: r.answer, ms: r.msRemaining };
      }),
    ];
    for (const run of runs) {
      const a = grade(after, run.answer, run.ms);
      const b = grade(before, run.answer, run.ms);
      add(run.label, b, a);
      const ea = (a.extra ?? {}) as Record<string, unknown>;
      const eb = (b.extra ?? {}) as Record<string, unknown>;
      identity++;
      if (type === "reaction") {
        const times = eb["times"] as number[];
        const fs = eb["falseStarts"] as number;
        const avg = Math.round(times.reduce((x, y) => x + y, 0) / times.length);
        if (b.score !== oldReaction(avg, fs)) fail(`Flash ${run.label} ${seed}: tapRev 1 score ${b.score} ≠ old ${oldReaction(avg, fs)}`);
        if ("falseStartCost" in eb) fail("Flash tapRev 1 stores a falseStartCost");
        if (ea["falseStartCost"] !== reactionFalseStartCost(fs, 2)) fail(`Flash ${run.label} ${seed}: stored cost ${String(ea["falseStartCost"])}`);
        const base = avg <= 200 ? 150 : clamp(Math.round(150 - 0.16 * (avg - 200)));
        if (a.score !== clamp(base - (ea["falseStartCost"] as number))) fail(`Flash ${run.label} ${seed}: score is not base − stored cost`);
      } else if (type === "stopwatch") {
        const d = Math.round((eb["distances"] as number[]).reduce((x, y) => x + y, 0) / 10);
        if (b.score !== oldStopWatch(d, true)) fail(`Bang On ${run.label} ${seed}: tapRev 1 score ${b.score} ≠ old ${oldStopWatch(d, true)}`);
        if ("kneeMs" in eb) fail("Bang On tapRev 1 stores the rev-2 curve");
        if (ea["averageMs"] !== d || ea["kneeMs"] !== 200 || ea["zeroMs"] !== 325) fail(`Bang On ${run.label} ${seed}: stored curve`);
        if (d <= 200 && a.score !== b.score) fail(`Bang On ${run.label} ${seed}: ${d} ms moved`);
      } else {
        const rb = replayClayRun(before.type === "clayshoot" ? before.seed : 0, run.answer, CLAY_REV3);
        const ra = replayClayRun(after.type === "clayshoot" ? after.seed : 0, run.answer, CLAY_REV4);
        const strip = (s: object) => JSON.stringify({ ...s, rev: 0 });
        if (strip(rb.state) !== strip(ra.state) || JSON.stringify(rb.checkpoints) !== JSON.stringify(ra.checkpoints)) fail(`Pull! ${run.label} ${seed}: rev 3 and rev 4 sims differ`);
        if (b.score !== oldClay(rb.orangeHits, rb.goldHits, rb.birdHits, 3)) fail(`Pull! ${run.label} ${seed}: rev 3 score changed`);
        if ("emptyShotCost" in eb) fail("Pull! rev 3 stores an empty-shot cost");
        const empty = clayEmptyShots(ra.shots, ra.hits, ra.birdHits);
        if (ea["emptyShots"] !== empty || ea["emptyShotCost"] !== clayEmptyShotCost(empty, CLAY_REV4)) fail(`Pull! ${run.label} ${seed}: stored empty shots`);
        if (a.score !== clamp(b.score - (ea["emptyShotCost"] as number)) && b.score > 0) fail(`Pull! ${run.label} ${seed}: score is not rev 3 − stored cost`);
        if (ra.flagged !== rb.flagged && !rb.flagged) fail(`Pull! ${run.label} ${seed}: rev 4 replay flagged (${ra.reason ?? ""})`);
      }
    }
  }
  console.log(`${type}: ${identity} runs graded under the old and new stamps`);
  return [...rows.values()];
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2]! : Math.round((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2);
};

/** Careless lines: [label, lowest, highest] for the after median. */
const TARGETS: Record<string, [string, number, number]> = {
  reaction: ["tap-every-colour", 45, 65],
  stopwatch: ["tap-random-time", 60, 80],
  clayshoot: ["mash-on-movers", 12, 22],
};
const NAMES: Record<string, string> = { reaction: "Flash", stopwatch: "Bang On", clayshoot: "Pull!" };
const table: string[] = ["| Game | Line | Before median | After median | Change |", "|---|---|---|---|---|"];
for (const type of ["reaction", "stopwatch", "clayshoot"] as const) {
  const rows = audit(type);
  for (const row of rows) {
    const b = median(row.before);
    const a = median(row.after);
    const honest = (LEVELS as readonly string[]).includes(row.label);
    table.push(`| ${NAMES[type]} | ${row.label}${row.label === TARGETS[type]![0] ? " (careless line)" : ""} | ${b} | ${a} | ${a - b >= 0 ? "+" : ""}${a - b} |`);
    if (honest && Math.abs(a - b) > 3) fail(`${type} ${row.label}: honest median moved ${b} → ${a}`);
    if (row.after.some((v, i) => v > row.before[i]!)) fail(`${type} ${row.label}: some run scores more after`);
  }
  const [label, lo, hi] = TARGETS[type]!;
  const row = rows.find((r) => r.label === label);
  const a = row ? median(row.after) : -1;
  if (a < lo || a > hi) fail(`${type} ${label}: after median ${a}, want ${lo}–${hi}`);
}
console.log(table.join("\n"));
if (MD) console.log("\n(markdown above)");

if (failures.length) {
  console.log(`FAIL (${failures.length})`);
  for (const f of failures.slice(0, 40)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("PASS: careless play costs more in Flash, Bang On and Pull!; honest medians within 3; older stamps unchanged");
