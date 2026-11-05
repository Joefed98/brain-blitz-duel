/**
 * Breaker under the arcade scoring standard (brkRev 11, 29 Oct 2026; docs/arcade-standard/breaker.md).
 *
 *  1. Older stamps unchanged: skill-band bot runs on every earlier revision (unstamped, 2–10), recorded on main
 *     before the change (scripts/fixtures/breaker-standard-legacy.json, scripts/breaker-standard-legacy.ts), replay on
 *     today's code to the same score and the same final state, never flagged.
 *  2. brkRev 11 runs (scripts/fixtures/breaker-standard-runs.json) replay to their recorded score and state.
 *  3. Rooms and practice deal brkRev 11; LIVE_BANDS and the help read it.
 *  4. Play unchanged: brkRev 11 starts from brkRev 10's board plus the marker, and every brkRev 10 log plays to the
 *     same state on brkRev 11 (only `std` differs); identical runs for every player (same seed, same board and features).
 *  5. The parts: core a straight line on all 108 bricks (gold included) to 140; clear 10 and speed up to 20 only when
 *     cleared (full with half the run left, evenly to 0 at the buzzer); gold 30 split evenly; combos, power-ups and lost
 *     balls pay or cost nothing; a played run at least 1, no input 0, never above 200.
 *  6. A perfect run (the stored flawless run, replayed by the server) scores 200 with every part at its maximum; the
 *     reveal lines add up to the stored score; the help states every part and the 200.
 *
 *   bun scripts/breaker-standard-check.ts
 */
import { hasScorePart } from "../src/lib/duel/scoreList";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import {
  BRK_REV_PHONE,
  BRK_REV_STD,
  BRK_RUN_TICKS,
  BRK_V11_BAND_CURVE,
  BRK_V11_BRICKS,
  BRK_V11_CLEAR_POINTS,
  BRK_V11_CORE_MAX,
  BRK_V11_GOLD_MAX,
  BRK_V11_MAX,
  BRK_V11_SPEED_MAX,
  brkCheckpoint,
  brkStdScore,
  brkStdSpeed,
  breakerGameFor,
  breakerStdParts,
  breakerWorldHFor,
  breakerWorldWFor,
  type BrkState,
} from "../src/lib/arcade/breaker";
import { replayBreakerRun } from "../src/lib/duel/breaker";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { bandLines, bandPoints } from "../src/lib/arcade/scoreBands";
import { BAND_SPECS } from "../src/lib/arcade/bandParts";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { breakerPuzzle } from "../src/puzzles/breaker";
import { entry } from "./arcade-standard/breaker";
import type { StdRun } from "./arcade-standard/entry";

/** The game's arcade-standard-check entry, read as this check always has (the first perfect run, split into parts). */
const STANDARD = {
  id: entry.type,
  stampKey: entry.field,
  stamp: entry.rev,
  parts: entry.parts,
  perfect: () => {
    const r = (entry.perfect() as StdRun[])[0]!;
    return { score: r.score, parts: r.parts! };
  },
};

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
function section(name: string): void {
  console.log(`· ${name}`);
}

interface Rec {
  rev: number | null;
  level: string;
  seed: number;
  score: number;
  stateHash: number;
  raw: string;
}
const load = (name: string): Rec[] => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8")) as Rec[];
const unzip = (raw: string) => gunzipSync(Buffer.from(raw, "base64")).toString("utf8");

section("1. Older stamps replay and score exactly as on main");
const legacy = load("breaker-standard-legacy.json");
{
  const revs = new Set(legacy.map((r) => r.rev));
  ok([null, 2, 3, 4, 5, 6, 7, 8, 9, 10].every((r) => revs.has(r)), "the legacy fixture covers unstamped and brkRev 2–10");
  for (const rec of legacy) {
    const run = replayBreakerRun(rec.seed, unzip(rec.raw), rec.rev);
    ok(!run.flagged, `legacy rev ${rec.rev} ${rec.level} seed ${rec.seed}: replay flagged (${run.reason ?? ""})`);
    ok(run.score === rec.score, `legacy rev ${rec.rev} ${rec.level} seed ${rec.seed}: score ${run.score}, main ${rec.score}`);
    ok(fnv(JSON.stringify(run.state)) === rec.stateHash, `legacy rev ${rec.rev} ${rec.level} seed ${rec.seed}: final state differs from main`);
    ok((run.state as BrkState).std === undefined, `legacy rev ${rec.rev}: no std marker on an older state`);
  }
}

section("2. brkRev 11 runs replay to their recorded score and state");
const after = load("breaker-standard-runs.json");
for (const rec of after) {
  const run = replayBreakerRun(rec.seed, unzip(rec.raw), rec.rev);
  ok(!run.flagged && run.score === rec.score && fnv(JSON.stringify(run.state)) === rec.stateHash, `rev 11 ${rec.level} seed ${rec.seed}: ${run.score} vs ${rec.score}`);
}

section("3. Rooms and practice deal brkRev 11");
{
  const dealt = generatePuzzle("breaker") as { brkRev?: number };
  ok(dealt.brkRev === BRK_REV_STD && BRK_REV_STD === BRK_REV_PHONE + 1, `rooms deal brkRev ${dealt.brkRev}, expected ${BRK_REV_STD}`);
  ok((breakerPuzzle.generate() as { brkRev?: number }).brkRev === BRK_REV_STD, "practice's own generate deals brkRev 11");
  ok(LIVE_BANDS.breaker.rev === BRK_REV_STD && LIVE_BANDS.breaker.curve === BRK_V11_BAND_CURVE, "LIVE_BANDS names brkRev 11 and its straight line");
  ok(roundMaxFor("breaker") === 200 && BRK_V11_MAX === 200, "the round maximum is 200 and the parts add to it");
  ok(breakerWorldWFor(BRK_REV_STD) === breakerWorldWFor(BRK_REV_PHONE) && breakerWorldHFor(BRK_REV_STD) === breakerWorldHFor(BRK_REV_PHONE), "brkRev 11 plays brkRev 10's 420 × 784 court");
}

section("4. Play unchanged from brkRev 10; identical runs for every player");
{
  const g10 = breakerGameFor(BRK_REV_PHONE);
  const g11 = breakerGameFor(BRK_REV_STD);
  const strip = (s: BrkState) => {
    const { std: _std, ...rest } = s;
    return JSON.stringify(rest);
  };
  for (let seed = 1; seed <= 40; seed++) {
    const a = g10.init(seed * 7919);
    const b = g11.init(seed * 7919);
    ok(b.std === 1 && strip(b) === JSON.stringify(a), `seed ${seed}: brkRev 11's board is brkRev 10's plus the marker`);
    ok(JSON.stringify(g11.init(seed * 7919)) === JSON.stringify(b), `seed ${seed}: two players get the same board, gold and power-ups`);
  }
  for (const rec of legacy.filter((r) => r.rev === BRK_REV_PHONE).concat(after)) {
    const raw = unzip(rec.raw);
    // A log's checkpoints carry (or lack) brkRev 11's marker, so replaying it on the other revision reports a desync
    // (expected; quietened here): the comparison is of the played state, not the flag.
    const quiet = console.error;
    console.error = () => {};
    const r10 = replayBreakerRun(rec.seed, raw, BRK_REV_PHONE);
    const r11 = replayBreakerRun(rec.seed, raw, BRK_REV_STD);
    console.error = quiet;
    ok(strip(r11.state) === strip(r10.state), `seed ${rec.seed} ${rec.level}: the same log plays to the same state on brkRev 10 and 11`);
    // Features are fixed at init: the gold and power-up layout never moves during a run, whatever the player does.
    ok(JSON.stringify(r11.state.gild) === JSON.stringify(g11.init(rec.seed).gild) && JSON.stringify(r11.state.gold.map((g, i) => (g > 0 ? i : -1)).filter((i) => i >= 0)) === JSON.stringify(g11.init(rec.seed).gold.map((g, i) => (g > 0 ? i : -1)).filter((i) => i >= 0)), `seed ${rec.seed}: gold and power-up bricks fixed at init`);
  }
  // The marker is folded into the checkpoint last; brkRev 10's checksums are untouched (section 1 replays them unflagged).
  const s10 = g10.init(5);
  const s11 = g11.init(5);
  ok(brkCheckpoint(s10).checksum !== brkCheckpoint(s11).checksum, "brkRev 11 checkpoints carry the marker");
}

section("5. The parts");
{
  const g = breakerGameFor(BRK_REV_STD);
  const base = { ...g.init(42), acted: 1 } as BrkState;
  const goldIdx = base.bricks.map((_, i) => i).filter((i) => base.gild?.[i] === 1);
  const wallIdx = base.bricks.map((_, i) => i).filter((i) => base.gild?.[i] !== 1);
  ok(base.bricks.length === BRK_V11_BRICKS && goldIdx.length === 3 && wallIdx.length === 105, "108 bricks: 105 wall, 3 gold");
  const withBroken = (n: number, extra: Partial<BrkState> = {}): BrkState => {
    const order = wallIdx.concat(goldIdx);
    const bricks = base.bricks.slice();
    for (let i = 0; i < n; i++) bricks[order[i]!] = 0;
    const goldBroken = order.slice(0, n).filter((i) => base.gild?.[i] === 1).length;
    return { ...base, bricks, goldBroken, ...extra };
  };
  // Core: a straight line, floor(140 × k ÷ 108), each brick worth the same.
  let straight = true;
  for (let k = 0; k <= BRK_V11_BRICKS; k++) {
    const p = breakerStdParts(withBroken(k));
    if (p.core !== Math.floor((BRK_V11_CORE_MAX * k) / BRK_V11_BRICKS) || p.core !== bandPoints(BRK_V11_BAND_CURVE, k)) straight = false;
  }
  ok(straight, "core = floor(140 × bricks ÷ 108) at every count (the help's curve gives the same)");
  ok(breakerStdParts(withBroken(BRK_V11_BRICKS)).core === BRK_V11_CORE_MAX, "core is 140 at all 108");
  ok(BRK_V11_BAND_CURVE.units.length === 2, "the core curve has no knots between 0 and 108");
  // Gold counts in the core and pays its own 10 each.
  const g3 = withBroken(BRK_V11_BRICKS);
  ok(breakerStdParts(g3).gold === BRK_V11_GOLD_MAX && breakerStdParts(g3).goldBroken === 3, "all 3 gold bricks pay 30");
  for (let k = 0; k <= 3; k++) ok(breakerStdParts({ ...base, goldBroken: k }).gold === 10 * k, `gold ${k} pays ${10 * k}`);
  ok(breakerStdParts({ ...base, goldBroken: 9 }).gold === BRK_V11_GOLD_MAX, "gold is capped at the bricks dealt");
  // Clear and speed only when cleared.
  const uncleared = withBroken(104, { endedTick: 1000 });
  ok(breakerStdParts(uncleared).clear === 0 && breakerStdParts(uncleared).speed === 0, "no clear or speed points without a clear");
  const cleared = (tick: number) => breakerStdParts(withBroken(105, { cleared: true, endedTick: tick }));
  ok(cleared(1000).clear === BRK_V11_CLEAR_POINTS, "clearing the wall pays 10");
  ok(cleared(1).speed === 20 && cleared(BRK_RUN_TICKS / 2).speed === 20, "full 20 with at least half the run left");
  ok(cleared(BRK_RUN_TICKS).speed === 0, "0 at the buzzer");
  let even = true;
  for (let t = BRK_RUN_TICKS / 2; t <= BRK_RUN_TICKS; t++) {
    const want = Math.floor((2 * BRK_V11_SPEED_MAX * (BRK_RUN_TICKS - t)) / BRK_RUN_TICKS);
    if (brkStdSpeed(t) !== (2 * (BRK_RUN_TICKS - t) >= BRK_RUN_TICKS ? 20 : want)) even = false;
    if (t > BRK_RUN_TICKS / 2 && brkStdSpeed(t) > brkStdSpeed(t - 1)) even = false;
  }
  ok(even, "speed falls evenly from half the run to 0 at the buzzer, never rising");
  // Nothing else pays or costs.
  const mid = withBroken(60);
  const sMid = brkStdScore(mid);
  ok(brkStdScore({ ...mid, comboPts: 40, chain: 30, bestChain: 30, comboUps: 2 }) === sMid, "combos pay nothing");
  ok(brkStdScore({ ...mid, losses: 12 }) === sMid, "lost balls cost no points");
  ok(brkStdScore({ ...mid, powerUps: 6, fireballs: 2 }) === sMid, "power-ups pay nothing extra");
  ok(brkStdScore(mid) === breakerStdParts(mid).sum, "the score is the parts' sum");
  // Floors and cap.
  ok(brkStdScore({ ...base, acted: 1 }) === 1, "a played run with nothing broken scores 1");
  ok(brkStdScore({ ...withBroken(30), acted: 0 }) === 0, "no input scores 0");
  ok(brkStdScore(withBroken(BRK_V11_BRICKS, { cleared: true, endedTick: 600 })) === 200, "everything at once is 200");
  ok(brkStdScore(withBroken(BRK_V11_BRICKS, { cleared: true, endedTick: 600, goldBroken: 7 })) === 200, "never above 200");
  // A feature never costs core: breaking gold adds to the core too.
  ok(breakerStdParts(withBroken(106)).core > breakerStdParts(withBroken(105)).core, "a gold brick adds core points as well as its own");
  // A real played run of weak play scores at least 1.
  ok(after.every((r) => r.score >= 1), "every recorded brkRev 11 run scores at least 1");
}

section("6. A perfect run is 200; reveal and help");
{
  const p = STANDARD.perfect();
  const sum = STANDARD.parts.reduce((a, x) => a + x.max, 0);
  ok(sum === 200, `the parts' maxima add to 200 (${sum})`);
  ok(p.score === 200, `the stored flawless run scores ${p.score}`);
  for (const part of STANDARD.parts) ok(p.parts[part.key] === part.max, `perfect run: ${part.key} ${p.parts[part.key]} of ${part.max}`);
  // Reveal lines (bandLines through BAND_SPECS) add up to the stored score.
  for (const rec of after) {
    const run = replayBreakerRun(rec.seed, unzip(rec.raw), rec.rev);
    const parts = BAND_SPECS.breaker!.parts(run.state);
    const lines = bandLines(parts, run.score, Boolean(run.state.acted));
    ok(parts.points + parts.bonus === breakerStdParts(run.state).sum && lines[0]!.startsWith(`${breakerStdParts(run.state).bricks} / 108 bricks → `), `reveal parts for seed ${rec.seed}: ${lines.join(" | ")}`);
  }
  const help = PUZZLE_INSTRUCTIONS.breaker.score;
  // Text pass (4 Nov 2026): one line a part, then the total.
  ok(hasScorePart(help, "Bricks", 140) && hasScorePart(help, "Clear", 10) && hasScorePart(help, "Speed", 20) && hasScorePart(help, "Gold bricks", 30) && help.includes("10 each (30 for all 3)") && help.endsWith("Total 200."), `the help states every part and the 200: ${help}`);
  ok(!/combo/i.test(INTRO_SCORE.breaker) && /200|\{max\}/.test(INTRO_SCORE.breaker), `the intro line: ${INTRO_SCORE.breaker}`);
  ok(!PUZZLE_INSTRUCTIONS.breaker.how.some((h) => /combo/i.test(h.action + h.detail)), "the help no longer explains combos (they pay nothing)");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} Breaker standard checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} Breaker standard checks — brkRev 11 scores bricks 140 + clear 10 + speed 20 + gold 30 = 200; older stamps unchanged`);
