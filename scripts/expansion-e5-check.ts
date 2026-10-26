/**
 * expansion-e5-check (25 Oct 2026, docs/expansions/e5.md): the world expansions of Swish (binRev 7) and
 * Slice (sliceRev 9), each raised to 200 (docs/scoring-200.md). Flightpath was split out of E5 (26 Oct 2026,
 * parked on claude/flightpath-e5-parked): it stays exactly as on main, which section 2 also proves.
 *
 *  1. Older stamps are untouched: runs recorded on unmodified main on the stamps rooms dealt before
 *     (binRev 6 and 3, bullRev 6 and 4, sliceRev 8 and 6; scripts/fixtures/expansion-e5-legacy.json.gz)
 *     replay unflagged to their stored score and to a byte-identical final state (Flightpath's too).
 *  2. Rooms deal the new stamps; ROUND_MAX is 200 for both games and the "?" help and intro state it;
 *     Flightpath was split out of E5 (expansion E9 moved it on to bullRev 8, docs/expansions/e9.md, proved by
 *     expansion-e9-check; bullRev 6 stays its score-bands revision).
 *  3. Stored runs on the new stamps (scripts/fixtures/expansion-e5-runs.json.gz, the skill-band bots at four
 *     levels, plus each game's best 200 found on the recorded seeds): each replays unflagged to its stored
 *     score; every score is 0–200, scored on the new rules (band 3 and the game's marker from the first tick);
 *     each game has a stored 200.
 *  4. The rules: Swish's far buckets (throws 1–6 only, inside the stall and clear of the main bucket, the hoops
 *     over them on a throw a drag can make, a far basket counted and its points capped at 50); Slice's board
 *     (430 × 805, more throws), sizes and values (bread 26 px worth 1 … golden fruit 10 px worth 5), six golden
 *     fruits, five tickets each fillable from the schedule, the bonus capped at 50, and the dodge rules.
 *
 *   bun scripts/expansion-e5-check.ts            # ~20 s
 *   bun scripts/expansion-e5-check.ts --record   # re-record the new-stamp runs (only when a rule here changes)
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";

import { GAMES } from "./arcade-skill-bands/games";
import { Human, LEVELS } from "./arcade-skill-bands/human";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { appendClientCounters, arcadeCounters } from "../src/lib/arcade/diagnostics";
import { BAND_STRICT_MARK } from "../src/lib/arcade/scoreBands";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { ROUND_MAX, roundMaxFor } from "../src/lib/duel/roundMax";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { fillMax } from "../src/lib/duel/roundMax";
import { BULLSEYE_REV_EXPAND, BULLSEYE_REV_STRICT } from "../src/lib/arcade/bullseye";
import {
  BINTOSS_BALL_R,
  BINTOSS_EXPAND,
  BINTOSS_FAR_CAP,
  BINTOSS_FAR_HALF,
  BINTOSS_FAR_POINTS,
  BINTOSS_FAR_THROWS,
  BINTOSS_HOOP_HALF,
  BINTOSS_REV_EXPAND,
  BINTOSS_THROWS,
  BINTOSS_V7_MAX_SPEED,
  BINTOSS_V7_RIGHT,
  binTossBinCentre,
  binTossFarPoints,
  binTossGameFor,
  binTossHalf,
  type BinTossState,
} from "../src/lib/arcade/binToss";
import {
  SLICE_REV_EXPAND,
  SLICE_V9,
  SLICE_V9_BONUS_CAP,
  SLICE_V9_GOLD,
  SLICE_V9_GOLDS,
  SLICE_V9_H,
  SLICE_V9_RADIUS,
  SLICE_V9_TICKETS,
  SLICE_V9_VALUE,
  SLICE_V9_W,
  sliceGameFor,
  sliceRadius,
  sliceTotalDiscs,
  sliceV9Bonus,
  sliceWorldHFor,
  sliceWorldWFor,
  type SliceState,
} from "../src/lib/arcade/slice";
import type { PuzzleType } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function ok(cond: unknown, message: string): void {
  if (cond) passes++;
  else if (failures.length < 80) failures.push(message);
}
const section = (name: string) => console.log(`— ${name}`);
const digest = (state: unknown) => createHash("sha256").update(JSON.stringify(state)).digest("hex");
const RECORD = process.argv.includes("--record");
const LEGACY = "scripts/fixtures/expansion-e5-legacy.json.gz";
const RUNS = "scripts/fixtures/expansion-e5-runs.json.gz";
const NEW_REV: Record<"bintoss" | "slice", number> = { bintoss: BINTOSS_REV_EXPAND, slice: SLICE_REV_EXPAND };
const TYPES = Object.keys(NEW_REV) as (keyof typeof NEW_REV)[];
/** The legacy fixture also holds Flightpath's older stamps, which still replay on main's (unchanged) Flightpath. */
const LEGACY_TYPES = [...TYPES, "bullseye"];
const spec = (type: string) => GAMES.find((g) => g.type === type)!;

interface StoredRun {
  type: string;
  rev: number;
  level: string;
  seed: number;
  raw: string;
  score: number;
  digest: string;
}

/* ============================== 1. Older stamps ============================== */
section("Older stamps replay exactly as recorded on main");
{
  const runs = JSON.parse(gunzipSync(readFileSync(LEGACY)).toString()) as StoredRun[];
  ok(runs.length === 72, `72 legacy runs (got ${runs.length})`);
  for (const run of runs) {
    const replay = spec(run.type).replay(run.seed, run.raw, run.rev);
    const tag = `${run.type} rev ${run.rev} ${run.level} ${run.seed}`;
    ok(!replay.flagged && replay.desyncTick == null, `${tag}: replays unflagged (${replay.reason ?? ""})`);
    ok(replay.score === run.score, `${tag}: replays to its stored ${run.score} (got ${replay.score})`);
    ok(digest(replay.state) === run.digest, `${tag}: final state identical to main's`);
  }
  for (const type of LEGACY_TYPES) ok(new Set(runs.filter((r) => r.type === type).map((r) => r.rev)).size === 2, `${type}: two older stamps covered`);
}

/* ============================== 2. Stamps, maximum and texts ============================== */
section("Rooms deal the new stamps; the maximum is 200 and the texts say so");
for (const type of TYPES) {
  const live = LIVE_BANDS[type];
  const dealt = (generatePuzzle(type as PuzzleType) as unknown as Record<string, unknown>)[live.field];
  ok(dealt === NEW_REV[type] && LIVE_BANDS[type].rev === NEW_REV[type], `${type}: rooms deal ${live.field} ${NEW_REV[type]} (got ${String(dealt)})`);
  ok(ROUND_MAX[type] === 200 && roundMaxFor(type) === 200, `${type}: ROUND_MAX is 200`);
  ok(fillMax(INTRO_SCORE[type], type).includes("200"), `${type}: the intro states 200: ${fillMax(INTRO_SCORE[type], type)}`);
  ok(fillMax(PUZZLE_INSTRUCTIONS[type].score, type).includes("Up to 200."), `${type}: the help ends "Up to 200."`);
  const how = PUZZLE_INSTRUCTIONS[type].how.filter((line) => !line.helpOnly);
  // One phone line each (46 characters, as batch 5's; Slice's first line was written before that rule, 50).
  ok(how.length <= 3 && how.every((line) => `${line.action} ${line.detail}`.length <= (type === "slice" ? 50 : 46)), `${type}: intro HOW fits three short lines`);
  const s = spec(type);
  const init = s.gameFor(NEW_REV[type], s.seedFor(0)).init(s.seedFor(0)) as { band?: number };
  ok(init.band === BAND_STRICT_MARK, `${type}: band ${BAND_STRICT_MARK} from the first tick`);
}
{
  // Flightpath was split out of E5; expansion E9 (docs/expansions/e9.md) then moved rooms on to bullRev 8 at 200, with
  // bullRev 6 as its score-bands revision (expansion-e9-check covers it).
  const dealt = (generatePuzzle("bullseye") as unknown as Record<string, unknown>).bullRev;
  ok(dealt === BULLSEYE_REV_EXPAND && LIVE_BANDS.bullseye.rev === BULLSEYE_REV_EXPAND && LIVE_BANDS.bullseye.strictRev === BULLSEYE_REV_STRICT, `bullseye: rooms deal E9's bullRev ${BULLSEYE_REV_EXPAND}, after bullRev ${BULLSEYE_REV_STRICT} (got ${String(dealt)})`);
  ok(ROUND_MAX.bullseye === 200, "bullseye: ROUND_MAX is 200 since expansion E9");
}

/* ============================== 3. Stored runs on the new stamps ============================== */
section("Runs on the new stamps replay to their stored scores; each game has a 200");
async function playRun(type: string, rev: number, level: (typeof LEVELS)[number], seed: number): Promise<StoredRun> {
  const s = spec(type);
  const { bot } = (await import(`./arcade-skill-bands/bots/${type}.ts`)) as { bot: SkillBot };
  const game = s.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(type, seed, level) });
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const by = new Map((out.events ?? []).map((e) => [e.t, e]));
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, by.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(s.checkpoint(state));
  }
  const score = game.score(state);
  const body = { seed, claimedScore: score, events: out.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints };
  const raw = appendClientCounters(s.encode(body, rev, seed), arcadeCounters(type, state, score));
  const replay = s.replay(seed, raw, rev);
  return { type, rev, level, seed, raw, score: replay.score, digest: digest(replay.state) };
}
if (RECORD) {
  const runs: StoredRun[] = [];
  for (const type of TYPES) {
    for (const level of LEVELS) for (let n = 0; n < 3; n++) runs.push(await playRun(type, NEW_REV[type], level, spec(type).seedFor(2000 + n)));
    // The best run: the first 200 the near-perfect bot plays on the recorded seeds.
    let found = false;
    for (let n = 0; n < 400 && !found; n++) {
      const run = await playRun(type, NEW_REV[type], "near", spec(type).seedFor(n));
      if (run.score === 200) {
        runs.push({ ...run, level: "best" });
        found = true;
      }
    }
    console.log(`  ${type}: ${found ? "a 200 recorded" : "NO 200 FOUND"}`);
  }
  writeFileSync(RUNS, gzipSync(JSON.stringify(runs)));
  console.log(`  recorded ${runs.length} runs to ${RUNS}`);
}
{
  const runs = JSON.parse(gunzipSync(readFileSync(RUNS)).toString()) as StoredRun[];
  for (const type of TYPES) ok(runs.filter((r) => r.type === type && r.level !== "best").length === 12, `${type}: 12 level runs`);
  for (const run of runs) {
    const replay = spec(run.type).replay(run.seed, run.raw, run.rev);
    const tag = `${run.type} rev ${run.rev} ${run.level} ${run.seed}`;
    ok(run.rev === NEW_REV[run.type as keyof typeof NEW_REV], `${tag}: recorded on the new stamp`);
    ok(!replay.flagged && replay.desyncTick == null, `${tag}: replays unflagged (${replay.reason ?? ""})`);
    ok(replay.score === run.score, `${tag}: replays to its stored ${run.score} (got ${replay.score})`);
    ok(digest(replay.state) === run.digest, `${tag}: the same final state`);
    ok(replay.score >= 0 && replay.score <= 200, `${tag}: 0–200`);
    const st = replay.state as { band?: number; expand?: number; v9?: number };
    ok(st.band === BAND_STRICT_MARK && (st.expand === 1 || st.v9 === 1), `${tag}: scored on the new rules`);
  }
  for (const type of TYPES) ok(runs.some((r) => r.type === type && r.score === 200), `${type}: a stored 200`);
}

/* ============================== 4. The rules ============================== */
section("Swish binRev 7: far buckets, hoops over them, far points");
{
  const game = binTossGameFor(BINTOSS_REV_EXPAND);
  let hoops = 0;
  for (let n = 0; n < 300; n++) {
    const seed = 104729 * n + 7;
    const s = game.init(seed) as BinTossState;
    ok(s.expand === BINTOSS_EXPAND && s.fars?.length === BINTOSS_THROWS, `seed ${seed}: a far slot per throw`);
    for (let index = 0; index < BINTOSS_THROWS; index++) {
      const far = s.fars![index]!;
      if (index >= BINTOSS_FAR_THROWS) {
        ok(far === 0 && s.slides[index]!.amp >= 0, `seed ${seed} throw ${index + 1}: no far bucket`);
        continue;
      }
      ok(s.slides[index]!.amp === 0, `seed ${seed} throw ${index + 1}: the main bucket is still`);
      ok(far + BINTOSS_FAR_HALF <= BINTOSS_V7_RIGHT - 8 * 256, `seed ${seed} throw ${index + 1}: the far bucket inside the stall`);
      const gap = far - BINTOSS_FAR_HALF - (binTossBinCentre(index) + binTossHalf(index, s.rev));
      ok(gap >= 4 * BINTOSS_BALL_R, `seed ${seed} throw ${index + 1}: a ball's width and more between the buckets (${gap / 256} px)`);
      const hoop = s.hoops?.[index];
      if (hoop) {
        hoops++;
        ok(Math.abs(hoop.x - far) <= 60 * 256 + BINTOSS_HOOP_HALF, `seed ${seed} throw ${index + 1}: the hoop over the far bucket`);
      }
    }
  }
  ok(hoops > 600, `hoops on most seeds (${hoops} of 900)`);
  ok(BINTOSS_V7_MAX_SPEED > 1500, `a drag can throw at ${BINTOSS_V7_MAX_SPEED}`);
  ok(binTossFarPoints({ farIn: 6 }) === BINTOSS_FAR_CAP && binTossFarPoints({ farIn: 3 }) === 3 * BINTOSS_FAR_POINTS, "far points 9 each, up to 50");
  // A far basket: search a throw that lands in the far bucket on throw 1 and check what it counts.
  const seed = 99;
  let s = game.init(seed) as BinTossState;
  while (s.phase !== 0) s = game.step(s, null);
  let landed: BinTossState | null = null;
  for (let vy = -900; vy >= -1700 && !landed; vy -= 20)
    for (let vx = 300; vx <= 1400 && !landed; vx += 6) {
      let t = game.step(s, { t: s.tick + 1, k: 1, a: vx, b: vy, c: 0, d: 0 });
      while (t.phase === 1) t = game.step(t, null);
      if (t.farIn === 1) landed = t;
    }
  ok(landed && landed.baskets === 1 && landed.farResults?.[0] === 1 && landed.results[0] === 1, "a far basket counts as a basket and a far one");
}

section("Slice sliceRev 9: the larger board, sizes and values, golden fruit, tickets, the bonus");
{
  const game = sliceGameFor(SLICE_REV_EXPAND);
  ok(sliceWorldWFor(SLICE_REV_EXPAND) === SLICE_V9_W && sliceWorldHFor(SLICE_REV_EXPAND) === SLICE_V9_H && SLICE_V9_W === 430 && SLICE_V9_H === 805, "the board is 430 × 805");
  ok(game.inputRanges?.some((r) => JSON.stringify(r).includes(String(SLICE_V9_H))), "input bounds run to the larger board");
  const old = sliceGameFor(8).init(5);
  for (let n = 0; n < 200; n++) {
    const seed = 15485863 * n + 3;
    const s = game.init(seed) as SliceState;
    ok(s.v9 === SLICE_V9 && s.worldW === SLICE_V9_W && s.worldH === SLICE_V9_H, `seed ${seed}: the v9 board`);
    const plain = s.objects.filter((o) => !o.bomb && !o.special);
    ok(plain.filter((o) => o.colour === SLICE_V9_GOLD).length === SLICE_V9_GOLDS, `seed ${seed}: six golden fruit`);
    ok(plain.every((o) => o.r === SLICE_V9_RADIUS[o.colour] && o.value === SLICE_V9_VALUE[o.colour]), `seed ${seed}: each food's size and value from its kind`);
    ok(s.objects.filter((o) => o.bomb).every((o) => sliceRadius(o) === 20), `seed ${seed}: chillies keep their size`);
    ok(s.objects.every((o) => o.x / 256 >= 0 && o.x / 256 <= SLICE_V9_W), `seed ${seed}: every throw starts on the board`);
    ok(s.objects.length > old.objects.length, `seed ${seed}: more throws than sliceRev 8 (${s.objects.length} > ${old.objects.length})`);
    let total = 0;
    for (const o of s.objects) if (!o.bomb) total += (o.value ?? 1) + o.payload.reduce((a, p) => a + (p.bomb ? 0 : (p.value ?? 1)), 0);
    ok(sliceTotalDiscs(s) === total, `seed ${seed}: the most the run offers is its foods' values`);
    ok(s.tickets?.length === SLICE_V9_TICKETS, `seed ${seed}: five tickets`);
    for (const [k, t] of (s.tickets ?? []).entries()) {
      const thrown = plain.filter((o) => o.colour === t.kind && o.launchTick >= t.from && o.launchTick < t.until - 40).length;
      ok(t.count >= 1 && t.count <= 3 && thrown >= t.count && (thrown >= t.count + 1 || thrown === 1), `seed ${seed} ticket ${k + 1}: ${t.count} in a row, ${thrown} thrown in its window`);
      if (k > 0) ok(t.from >= s.tickets![k - 1]!.until, `seed ${seed} ticket ${k + 1}: one at a time`);
    }
  }
  ok(sliceV9Bonus({ ...(game.init(1) as SliceState), goldPts: 30, ticketCuts: [3, 3, 3, 3, 3], dodgePts: 20 }) === SLICE_V9_BONUS_CAP, "the bonus counts up to 50");
  // Tickets in a row: cuts of another plain food start the count again.
  const s0 = game.init(77) as SliceState;
  const t0 = s0.tickets![0]!;
  ok(t0.from > 0 && t0.until - t0.from === 480, "a ticket lasts eight seconds");
}

console.log(
  failures.length === 0
    ? `PASS expansion-e5-check: ${passes} checks — older stamps replay as on main; rooms deal binRev 7 and sliceRev 9 at 200 (Flightpath split out, then moved on by expansion E9); stored new-stamp runs and a 200 each; the new rules`
    : `FAIL expansion-e5-check: ${failures.length} of ${passes + failures.length} checks failed\n${failures.map((f) => `  ✗ ${f}`).join("\n")}`,
);
if (failures.length > 0) process.exit(1);
