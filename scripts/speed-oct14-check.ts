/**
 * Speed tuning (14 Oct 2026): Flash and Bang On `tapRev: 3`, Don't Break the
 * Chain `chainCycleRev: 1`, Pull! `clayRev: 5` (plus Ascend's move timer and
 * Bonk's bigger rule box, which are drawing only).
 *
 *  1. Stored rounds grade exactly as before: every answer in
 *     scripts/fixtures/speed-oct14-legacy.json.gz (Flash and Bang On tapRev 2,
 *     three-symbol chains, Pull! clayRev 4, recorded on main before the change)
 *     and in scripts/fixtures/speed-oct14-rounds.json.gz (the new stamps,
 *     recorded with this change) still grades to the stored score and extra.
 *  2. Rooms stamp the new revisions; Ascend stays on tapRev 1.
 *  3. Flash: every gold-like decoy (amber, border, word, half) in each puzzle,
 *     the first decoy plain, the schedule rules unchanged, the replay never reads
 *     the decoys, the new curve's anchors, false starts cost as tapRev 2.
 *  4. Bang On: watch 1 plain; blind spots from watch 2, growing, clear of the
 *     target band and inside the bar; two diagonal watches; three longer sweeps;
 *     a player stopping on the first crossing settles all ten inside 60 s; the
 *     curve's anchors (150 at ≤ 5 ms, 137 at 20 ms, tapRev 2's 101 at 200 ms and
 *     0 at 325 ms kept).
 *  5. Pull!: 14–16 birds that all cross before the end, rev 4's clays and score.
 *  6. Bands on 30 seeded room puzzles (scripts/speed-bands-oct14.ts): Flash near
 *     70 / 100 / 125 / 145; Bang On within the anchors; Chain's good players no
 *     lower than before; every careless line lower than before.
 *
 *   bun scripts/speed-oct14-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { CLAY_BIRD_MAX_V5, CLAY_BIRD_MIN_V5, CLAY_REV, CLAY_REV4, CLAY_REV5, CLAY_RUN_TICKS, clayEmptyShotCost, clayGameFor, clayScore } from "../src/lib/arcade/clayShoot";
import { CHAIN_CYCLE_REV } from "../src/lib/duel/types";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { FLASH_REV3_CURVE, reactionFalseStartCost, scoreReaction, scoreStopWatch, STOPWATCH_REV3_CURVE } from "../src/lib/duel/scoring";
import { markerState, targetCentre, watchLifeMs, watchStop } from "../src/lib/duel/stopWatch";
import { replayFlash, TAP_REV, TAP_REV_CARELESS, TAP_REV_SPEED_TUNING } from "../src/lib/duel/tapLog";
import {
  REACTION_DECOY_MS,
  REACTION_FLASH_MS,
  REACTION_GOLD_LIKE_DECOYS,
  REACTION_PLAIN_DECOYS,
  REACTION_ROUND_MS,
  STOPWATCH_GAP_MS,
  STOPWATCH_LEAD_IN_MS,
  STOPWATCH_ROUND_MS,
  type PuzzleData,
  type ReactionPuzzleData,
  type StopWatchPuzzleData,
} from "../src/lib/duel/types";
import { stableExtra, type LegacyCase } from "./puzzle-score-legacy-record";
import { roomPuzzle } from "./puzzle-fairness/run";
import { bands, CARELESS_LINE, median, NAMES, SPEED_BAND_TYPES } from "./speed-bands-oct14";

const failures: string[] = [];
const fail = (msg: string) => failures.push(msg);
const lines: string[] = [];

/* ------------------------------ 1. stored rounds ------------------------------ */

for (const file of ["speed-oct14-legacy", "speed-oct14-rounds"]) {
  const fixture = JSON.parse(gunzipSync(readFileSync(`scripts/fixtures/${file}.json.gz`)).toString()) as { recordedOn: string; cases: LegacyCase[] };
  let entries = 0;
  const error = console.error;
  console.error = () => {};
  for (const c of fixture.cases) {
    for (const e of c.entries) {
      entries++;
      const g = gradeAnswer(c.puzzle, e.answer, e.ms);
      const same = g.score === e.score && g.isCorrect === e.isCorrect && g.correctCount === e.correctCount && g.errors === e.errors && g.storedMs === e.storedMs && stableExtra(g.extra) === e.extra;
      if (!same) fail(`${file} ${c.type} ${c.label}: ${e.score} → ${g.score} (extra ${stableExtra(g.extra) === e.extra ? "same" : "changed"})`);
    }
  }
  console.error = error;
  const stamps = new Set(fixture.cases.map((c) => `${c.type}:${JSON.stringify(stampOf(c.puzzle))}`));
  lines.push(`${file}: ${entries} stored answers on ${fixture.cases.length} puzzles (${[...stamps].sort().join(", ")}; recorded ${fixture.recordedOn}) grade exactly as stored`);
}

function stampOf(p: PuzzleData): number | null {
  const r = p as { tapRev?: number; chainCycleRev?: number; clayRev?: number };
  return p.type === "chain" ? (r.chainCycleRev ?? 0) : p.type === "clayshoot" ? (r.clayRev ?? 0) : (r.tapRev ?? 0);
}

/* ------------------------------ 2. room stamps ------------------------------ */

const WANT: Record<string, number> = { reaction: TAP_REV_SPEED_TUNING, stopwatch: TAP_REV_SPEED_TUNING, numhunt: TAP_REV, chain: CHAIN_CYCLE_REV, clayshoot: CLAY_REV5 };
for (const [type, want] of Object.entries(WANT)) {
  for (let seed = 1; seed <= 20; seed++) {
    const got = stampOf(roomPuzzle(type as PuzzleData["type"], seed));
    if (got !== want) fail(`${type} seed ${seed}: rooms stamp ${got}, want ${want}`);
  }
}
if (CLAY_REV !== CLAY_REV5) fail("Pull! CLAY_REV is not 5");
lines.push(`rooms stamp Flash and Bang On tapRev ${TAP_REV_SPEED_TUNING}, Ascend tapRev ${TAP_REV}, chainCycleRev ${CHAIN_CYCLE_REV}, Pull! clayRev ${CLAY_REV5}`);

/* --------------------------------- 3. Flash --------------------------------- */

let flashPuzzles = 0;
for (let seed = 1; seed <= 500; seed++) {
  const p = roomPuzzle("reaction", seed) as ReactionPuzzleData;
  flashPuzzles++;
  const kinds = p.decoys.map((d) => d.color);
  if (!(REACTION_PLAIN_DECOYS as readonly string[]).includes(kinds[0]!)) fail(`Flash ${seed}: first decoy ${kinds[0]} is not plain`);
  const need = REACTION_GOLD_LIKE_DECOYS.slice(0, Math.max(0, kinds.length - 1));
  for (const k of need) if (!kinds.includes(k)) fail(`Flash ${seed}: no ${k} decoy`);
  for (const k of kinds) if (![...REACTION_PLAIN_DECOYS, ...REACTION_GOLD_LIKE_DECOYS].includes(k as never)) fail(`Flash ${seed}: unknown decoy ${k}`);
  // Schedule rules (speed-tuning-check's): decoys never overlap a gold flash; all inside the round.
  let segment = 0;
  for (const f of p.flashes) {
    const before = p.decoys.filter((d) => d.at >= segment && d.at < f);
    if (before.length < 1 || before.length > 3 || before.some((d) => d.at + REACTION_DECOY_MS > f)) fail(`Flash ${seed}: decoys before ${f}`);
    segment = f + REACTION_FLASH_MS;
  }
  if (p.flashes.at(-1)! + REACTION_FLASH_MS > REACTION_ROUND_MS - 500) fail(`Flash ${seed}: last gold too late`);
  // The replay reads only the gold flashes: a decoy-free copy replays every log identically.
  const taps = [...p.flashes.map((f) => f + 180), ...p.decoys.map((d) => d.at + 200)].sort((a, b) => a - b);
  if (JSON.stringify(replayFlash(p, taps, REACTION_ROUND_MS)) !== JSON.stringify(replayFlash({ flashes: p.flashes }, taps, REACTION_ROUND_MS))) fail(`Flash ${seed}: replay reads decoys`);
}
const flashAt = (avg: number, fs = 0) => scoreReaction(avg, fs, TAP_REV_SPEED_TUNING);
for (const [x, y] of FLASH_REV3_CURVE) if (flashAt(x) !== y) fail(`Flash rev 3 anchor ${x} ms → ${flashAt(x)}, want ${y}`);
if (flashAt(100) !== 150 || flashAt(1_200) !== 0 || flashAt(250) !== 114 || flashAt(160, 3) !== 150 - 4 - 27) fail(`Flash rev 3 anchors: 100→${flashAt(100)} 250→${flashAt(250)} 1200→${flashAt(1200)} 160/3fs→${flashAt(160, 3)}`);
for (let fs = 0; fs <= 20; fs++) if (reactionFalseStartCost(fs, TAP_REV_SPEED_TUNING) !== reactionFalseStartCost(fs, TAP_REV_CARELESS)) fail(`Flash rev 3 false-start cost ${fs}`);
for (let avg = 1; avg <= 1_200; avg++) {
  if (flashAt(avg) > flashAt(avg - 1)) fail(`Flash rev 3 rises at ${avg}`);
  if (flashAt(avg) > scoreReaction(avg, 0, TAP_REV_CARELESS)) fail(`Flash rev 3 above rev 2 at ${avg}`);
}
lines.push(`Flash: ${flashPuzzles} room puzzles deal every gold-like decoy (first decoy plain), keep the schedule rules and replay without reading decoys; curve 150 at ≤ 150 ms, 128 at 200, 100 at 300, 0 at 800, never above tapRev 2; false starts as tapRev 2`);

/* -------------------------------- 4. Bang On -------------------------------- */

let watchSets = 0;
let latestHonest = 0;
for (let seed = 1; seed <= 500; seed++) {
  const p = roomPuzzle("stopwatch", seed) as StopWatchPuzzleData;
  watchSets++;
  const w = p.watches;
  if (w.length !== 10) fail(`Bang On ${seed}: ${w.length} watches`);
  if (w[0]!.blind || w[0]!.diagonal || w[0]!.moving || w[0]!.hidden) fail(`Bang On ${seed}: watch 1 is not plain`);
  if (w.filter((s) => s.diagonal).length !== 2 || w.some((s) => s.diagonal && s.vertical)) fail(`Bang On ${seed}: diagonal watches`);
  if (w.filter((s) => s.sweepMs > 1_180).length !== 3) fail(`Bang On ${seed}: longer sweeps`);
  let lastWidth = 0;
  w.forEach((s, i) => {
    if (i >= 1 && !s.blind?.length) fail(`Bang On ${seed}: watch ${i + 1} has no blind spot`);
    for (const [from, to] of s.blind ?? []) {
      const width = Math.round((to - from) * 100) / 100;
      if (from < 0.05 || to > 0.95 || width <= 0) fail(`Bang On ${seed}: watch ${i + 1} blind spot outside the bar`);
      if (width < lastWidth) fail(`Bang On ${seed}: watch ${i + 1} blind spot shrinks`);
      lastWidth = width;
      const reach = s.half + (s.moving?.amplitude ?? 0);
      if (to > s.centre - reach && from < s.centre + reach) fail(`Bang On ${seed}: watch ${i + 1} blind spot over the target`);
    }
  });
  // A player stopping each watch at its first centre crossing: all ten settle inside the round.
  let start = STOPWATCH_LEAD_IN_MS;
  for (const s of w) {
    let e = 1;
    let prev = (markerState(s, 0).pos - targetCentre(s, 0)) * markerState(s, 0).dir;
    for (; e < watchLifeMs(s); e++) {
      const st = markerState(s, e);
      const off = (st.pos - targetCentre(s, e)) * st.dir;
      if (Math.sign(off) !== Math.sign(prev) && off !== 0) break;
      prev = off;
    }
    if (watchStop(s, e).distance > 20) fail(`Bang On ${seed}: first crossing not near the line`);
    start += e + STOPWATCH_GAP_MS;
  }
  latestHonest = Math.max(latestHonest, start - STOPWATCH_GAP_MS);
}
if (latestHonest > STOPWATCH_ROUND_MS) fail(`Bang On: a first-crossing run ends at ${latestHonest} ms`);
const swAt = (d: number) => scoreStopWatch(d, TAP_REV_SPEED_TUNING);
for (const [x, y] of STOPWATCH_REV3_CURVE) if (swAt(x) !== y) fail(`Bang On rev 3 anchor ${x} ms → ${swAt(x)}, want ${y}`);
if (swAt(0) !== 150 || swAt(6) === 150 || swAt(500) !== 0) fail("Bang On rev 3 ends");
for (let d = 200; d <= 500; d++) if (swAt(d) !== scoreStopWatch(d, TAP_REV_CARELESS)) fail(`Bang On rev 3 moved tapRev 2's fall at ${d} ms`);
for (let d = 1; d <= 500; d++) if (swAt(d) > swAt(d - 1)) fail(`Bang On rev 3 rises at ${d}`);
lines.push(`Bang On: ${watchSets} room sets (watch 1 plain; blind spots from watch 2, growing, clear of the target; 2 diagonal; 3 longer sweeps); first-crossing runs end by ${(latestHonest / 1000).toFixed(1)} s; curve 150 at ≤ 5 ms, 137 at 20, 101 at 200, 0 at 325 (tapRev 2's fall kept)`);

/* --------------------------------- 5. Pull! --------------------------------- */

const birdCounts: Record<number, number> = {};
for (let seed = 1; seed <= 300; seed++) {
  const s5 = clayGameFor(CLAY_REV5).init(seed);
  const s4 = clayGameFor(CLAY_REV4).init(seed);
  const n = s5.birds?.launch.length ?? 0;
  birdCounts[n] = (birdCounts[n] ?? 0) + 1;
  if (n < CLAY_BIRD_MIN_V5 || n > CLAY_BIRD_MAX_V5) fail(`Pull! ${seed}: ${n} birds`);
  if (JSON.stringify(s5.schedule) !== JSON.stringify(s4.schedule)) fail(`Pull! ${seed}: clays differ from rev 4`);
  // Every bird is gone (crossed and left) before the run ends.
  let st = s5;
  const game = clayGameFor(CLAY_REV5);
  while (!game.isOver(st)) st = game.step(st, null);
  if (st.birdStatus?.some((b) => b !== 3)) fail(`Pull! ${seed}: a bird still in the sky at the end (${CLAY_RUN_TICKS} ticks)`);
}
for (const [o, g, b, e] of [[22, 3, 0, 0], [22, 3, 1, 0], [20, 2, 3, 80], [5, 0, 0, 400]] as const)
  if (clayScore(o, g, b, CLAY_REV5, e) !== clayScore(o, g, b, CLAY_REV4, e) || clayEmptyShotCost(e, CLAY_REV5) !== clayEmptyShotCost(e, CLAY_REV4)) fail("Pull! rev 5 scoring differs from rev 4");
lines.push(`Pull!: 300 seeds fly ${Object.entries(birdCounts).map(([k, v]) => `${k} birds ×${v}`).join(", ")}, all gone before the end; rev 4's clays, score and empty-shot cost`);

/* --------------------------------- 6. bands --------------------------------- */

/** Honest medians after the change: [lowest, highest] per level. */
const TARGET: Record<string, Record<string, [number, number]>> = {
  reaction: { average: [62, 80], good: [92, 112], great: [117, 135], near: [138, 150] },
  stopwatch: { average: [100, 118], good: [110, 128], great: [120, 138], near: [126, 142] },
  chain: { average: [30, 60], good: [80, 100], great: [120, 150], near: [140, 150] },
  clayshoot: { average: [80, 100], good: [115, 140], great: [140, 150], near: [145, 150] },
};
const table = ["| Game | Player | Before | After |", "|---|---|---|---|"];
for (const type of SPEED_BAND_TYPES) {
  for (const row of bands(type)) {
    const b = median(row.before);
    const a = median(row.after);
    table.push(`| ${NAMES[type]} | ${row.label}${row.label === CARELESS_LINE[type] ? " (careless)" : ""} | ${b} | ${a} |`);
    const target = TARGET[type]![row.label];
    if (target && (a < target[0] || a > target[1])) fail(`${NAMES[type]} ${row.label}: after median ${a}, want ${target[0]}–${target[1]}`);
    if (type === "chain" && row.label === "good" && a < b) fail(`Chain good players fell ${b} → ${a}`);
    if (row.label === CARELESS_LINE[type] && b > 0 && a >= b) fail(`${NAMES[type]} careless line did not fall (${b} → ${a})`);
    if (!target && a > b) fail(`${NAMES[type]} ${row.label}: careless/spam line rose ${b} → ${a}`);
  }
}
lines.push(table.join("\n"));

console.log(lines.join("\n"));
if (failures.length) {
  console.log(`FAIL (${failures.length})`);
  for (const f of failures.slice(0, 40)) console.log(`  ${f}`);
  process.exit(1);
}
console.log("PASS: Speed tuning — stored rounds grade unchanged, rooms stamp the new revisions, new rules and curves hold, bands as reported");
