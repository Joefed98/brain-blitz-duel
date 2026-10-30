/**
 * Fission burstRev 10: the arcade scoring standard (29 Oct 2026, docs/arcade-standard/burst.md).
 *
 *  1. Rooms and practice deal burstRev 10 at 200 in the 390 × 650 world; the "?" help reads its core line; the intro
 *     demo stays stopped until one is recorded on it.
 *  2. Older stamps unchanged: 72 runs (unstamped, burstRev 2, 3, 4, 5, 6, 8 and 9; weak and elite bots and random
 *     input on three seeds) recorded on main 73f6bb7 before the change (scripts/burst-standard-legacy.ts) replay
 *     through today's server path to the identical score and final state (SHA-256), and older states never carry
 *     burstRev 10's fields.
 *  3. The new rules: five waves, 87 atoms; core 140 × popped ÷ 87 on a straight line; wave clears 7 within the quick
 *     time, evenly less to 0 at twice it; golden atoms 5 each (25 for five); lives −5; any input scores at least 1,
 *     no input 0, never below 0 or above 200; the golden atom appears its seeded delay after its wave (queued while
 *     another is up), bounces, takes a life on touching the ship and is taken by a shot for 5; the run completes when
 *     the five waves are cleared and the last golden atom is gone; a wave clears once.
 *  4. Identical runs: a weak bot, an elite bot and random input on one seed start from the identical state, with the
 *     seed's own golden atoms and carriers (burstScheduleV10); each golden atom appears at its seeded spot and side
 *     for every player.
 *  5. Scores: the server replay scores the bots' runs as the phone did; the breakdown (reveal) adds up to the
 *     score; medians rise weak < average < good < great < near < elite < flawless on the same seeds.
 *  6. A perfect run: the oracle (scripts/arcade-standard/burst.ts) scores 200 through the server replay, every
 *     part at its maximum, and the parts' maxima add up to 200.
 *
 *   bun scripts/burst-standard-check.ts      (~40 s)
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS, type SkillLevel } from "./arcade-skill-bands/human";
import { bot as burstBot } from "./arcade-skill-bands/bots/burst";
import { entry, playOracle } from "./arcade-standard/burst";
import type { StdRun } from "./arcade-standard/entry";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  burstAtomsOf,
  burstBandParts,
  burstCheckpoint,
  burstGameFor,
  burstGoldenCount,
  burstScheduleV10,
  burstStdParts,
  burstV10Atoms,
  burstV10ClearPoints,
  burstV9QuickTicks,
  burstWorldHFor,
  BURST_CHECKPOINT_INTERVAL,
  BURST_GOLD_R,
  BURST_INPUT_FIRE,
  BURST_INPUT_MOVE,
  BURST_LIVES,
  BURST_REV_STD,
  BURST_TALL_H,
  BURST_V10_ATOMS,
  BURST_V10_BAND_CURVE,
  BURST_V10_CLEAR_MAX,
  BURST_V10_CLEAR_PER_WAVE,
  BURST_V10_CORE_MAX,
  BURST_V10_GOLDEN_DELAY,
  BURST_V10_GOLDEN_JITTER,
  BURST_V10_GOLDEN_MAX,
  BURST_V10_GOLDEN_PTS,
  BURST_V10_GOLDENS,
  BURST_V10_LIFE_COST,
  BURST_V10_PARTS,
  BURST_V10_WAVES,
  BURST_V9_GOLDEN_LIFE,
  BURST_WORLD_W,
  type BurstState,
} from "../src/lib/arcade/burst";
import { encodeBurstRun, replayBurstRun } from "../src/lib/duel/burst";
import { generateBurst } from "../src/lib/duel/arcade.server";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { bandPoints, bandTotal } from "../src/lib/arcade/scoreBands";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { burstPuzzle } from "../src/puzzles/burst";

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
const section = (name: string) => console.log(`\n== ${name}`);
const spec = GAME_BY_TYPE.get("burst")!;
const game = burstGameFor(BURST_REV_STD);
const FP = 256;
const digest = (state: unknown): string => createHash("sha256").update(JSON.stringify(state)).digest("hex");
const fire = (t: number, b = 1): ArcadeInputEvent => ({ t, k: BURST_INPUT_FIRE, a: 0, b, c: 0, d: 0 });

/* ============================== 1. Dealt ============================== */
section("Rooms and practice deal burstRev 10");
ok(generateBurst().burstRev === BURST_REV_STD && (generatePuzzle("burst") as { burstRev?: number }).burstRev === BURST_REV_STD, "rooms deal burstRev 10");
ok((burstPuzzle.generate() as { burstRev?: number }).burstRev === BURST_REV_STD, "the practice definition deals burstRev 10");
ok(LIVE_BANDS.burst.rev === BURST_REV_STD && LIVE_BANDS.burst.curve === BURST_V10_BAND_CURVE && roundMaxFor("burst") === 200, "LIVE_BANDS reads burstRev 10's core line; ROUND_MAX 200");
ok(burstWorldHFor(BURST_REV_STD) === BURST_TALL_H, "the 390 × 650 world");
{
  const src = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(/demo\.puzzle\.burstRev !== BURST_REV_STD\) return null/.test(src), "an older intro demo stays stopped on burstRev 10");
}
const help = PUZZLE_INSTRUCTIONS.burst.score;
ok(help.includes(`up to ${BURST_V10_CORE_MAX}.`) && help.includes(`${BURST_V10_CORE_MAX} + ${BURST_V10_CLEAR_MAX} + ${BURST_V10_GOLDEN_MAX} = 200`) && help.includes(`costs ${BURST_V10_LIFE_COST}`) && help.endsWith("Up to 200."), `the "?" help states the parts and that they total 200: ${help}`);
ok(/140/.test(INTRO_SCORE.burst) && /35/.test(INTRO_SCORE.burst) && /25/.test(INTRO_SCORE.burst) && /lost life costs 5/.test(INTRO_SCORE.burst), `the intro states the parts: ${INTRO_SCORE.burst}`);
ok(PUZZLE_INSTRUCTIONS.burst.how.some((h) => /golden/i.test(h.action) && /costs a life|hurts/.test(h.detail)), "the help says the golden atom hurts");

/* ============================== 2. Older stamps ============================== */
section("Older stamps replay exactly as on main (73f6bb7)");
{
  const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/burst-standard-legacy.json.gz")).toString()) as {
    runs: { rev: number | null; seed: number; who: string; raw: string; score: number; state: string }[];
  };
  const revs = new Set<number | null>();
  for (const run of fixture.runs) {
    const replay = replayBurstRun(run.seed, run.raw, run.rev);
    ok(replay.score === run.score, `burstRev ${run.rev} ${run.who} seed ${run.seed}: stored ${run.score}, replays ${replay.score}`);
    ok(digest(replay.state) === run.state, `burstRev ${run.rev} ${run.who} seed ${run.seed}: the replayed state is unchanged`);
    ok(replay.state.std === undefined && replay.state.gDue === undefined && replay.state.done === undefined, `burstRev ${run.rev}: no burstRev 10 fields`);
    revs.add(run.rev);
  }
  ok(fixture.runs.length === 72 && revs.size === 8, `the fixture covers 8 older stamps (${revs.size}, ${fixture.runs.length} runs)`);
  console.log(`  ${fixture.runs.length} runs on ${revs.size} older stamps replay to the stored score and state`);
}

/* ============================== 3. The rules ============================== */
section("The new rules");
{
  for (let n = 0; n < 6; n++) {
    const seed = spec.seedFor(n);
    const s0 = game.init(seed);
    ok(s0.std === 1 && s0.carry === 1 && s0.waves.length === BURST_V10_WAVES, `seed ${n}: five waves`);
    ok(burstV10Atoms(s0.waves) === BURST_V10_ATOMS, `seed ${n}: 87 atoms, every split piece counted (${burstV10Atoms(s0.waves)})`);
    ok(JSON.stringify(s0.waves) === JSON.stringify(burstGameFor(9).init(seed).waves.slice(0, 5)), `seed ${n}: burstRev 9's first five waves`);
    ok(s0.goldens!.length === BURST_V10_GOLDENS && s0.goldens!.every((g) => g.tick >= BURST_V10_GOLDEN_DELAY && g.tick <= BURST_V10_GOLDEN_DELAY + BURST_V10_GOLDEN_JITTER), `seed ${n}: one golden atom a wave, 1–2 s after it`);
    ok((s0.drops ?? []).length === 0 && s0.gDue!.every((d) => d === -1), `seed ${n}: nothing scheduled before the waves come`);
  }
  ok(burstAtomsOf(0) === 15 && burstAtomsOf(1) === 7 && burstAtomsOf(2) === 3 && burstAtomsOf(3) === 1, "L 15, M 7, S 3, XS 1 atoms");
  ok(BURST_V10_PARTS.core + BURST_V10_PARTS.clear + BURST_V10_PARTS.gold === 200 && BURST_V10_CLEAR_MAX === 35 && BURST_V10_GOLDEN_PTS * BURST_V10_GOLDENS === 25, "140 + 35 + 25 = 200; 7 a wave, 5 a golden atom");

  // Core: a straight line, 140 × popped ÷ 87.
  const base = { ...game.init(spec.seedFor(1)), acted: 1 } as BurstState;
  let straight = true;
  for (let h = 0; h <= BURST_V10_ATOMS; h++) {
    const p = burstStdParts({ ...base, hits: h });
    if (p.core !== Math.floor((BURST_V10_CORE_MAX * h) / BURST_V10_ATOMS) || p.core !== bandPoints(BURST_V10_BAND_CURVE, h)) straight = false;
    if (h > 0 && p.core - burstStdParts({ ...base, hits: h - 1 }).core > 2) straight = false;
  }
  ok(straight && burstStdParts({ ...base, hits: BURST_V10_ATOMS }).core === 140, "core = floor(140 × popped ÷ 87): each atom adds 1 or 2, 140 at all 87");

  // Wave clears.
  for (const wave of base.waves) {
    const q = burstV9QuickTicks(wave);
    ok(burstV10ClearPoints(0, q) === 7 && burstV10ClearPoints(q, q) === 7 && burstV10ClearPoints(2 * q, q) === 0 && burstV10ClearPoints(99999, q) === 0, `quick time ${q}: 7 within it, 0 at twice it`);
    let even = true;
    for (let t = q; t <= 2 * q; t++) if (burstV10ClearPoints(t, q) !== Math.min(7, Math.floor((7 * (2 * q - t)) / q))) even = false;
    ok(even, `quick time ${q}: evenly less between`);
  }
  ok(burstStdParts({ ...base, clearPts: 999 }).clear === BURST_V10_CLEAR_MAX, "the wave clears cap at 35");
  // Golden atoms and lives.
  ok(burstStdParts({ ...base, goldHit: 0b11111 }).gold === 25 && burstStdParts({ ...base, goldHit: 0b101 }).gold === 10, "5 a golden atom, 25 for all five");
  ok(burstStdParts({ ...base, lives: 1 }).lives === 2 * BURST_V10_LIFE_COST, "a lost life costs 5");
  // Floor and ceiling.
  ok(game.score({ ...base, acted: 0, hits: 40 }) === 0, "no input scores 0");
  ok(game.score({ ...base, hits: 0, lives: 0 }) === 1 && game.score({ ...base, hits: 1, lives: 0 }) === 1, "any input scores at least 1, even after three lives lost (never below 0)");
  ok(game.score({ ...base, hits: 87, clearPts: 35, goldHit: 31 }) === 200 && game.score({ ...base, hits: 87, clearPts: 99, goldHit: 31 }) === 200, "at most 200");

  // The golden atom: appears its delay after its wave, is queued behind one still up, bounces, hurts, is taken by a shot.
  const seed = spec.seedFor(3);
  const s0 = game.init(seed);
  let s = { ...s0, tick: 199, wave: 0, nextWaveAt: 200, acted: 1, x: 20 * FP, targetX: 20 * FP } as BurstState;
  s = game.step(s, null);
  ok(s.wave === 1 && s.gDue![0] === 200 + s0.goldens![0]!.tick && s.gDue!.slice(1).every((d) => d === -1), "wave 1's golden atom is due its delay after the wave appears");
  let appeared = -1;
  for (let i = 0; i < 200 && appeared < 0; i++) {
    s = game.step({ ...s, invuln: 999 }, null);
    if ((s.gn ?? -1) === 0) appeared = s.tick;
  }
  ok(appeared === 200 + s0.goldens![0]!.tick && s.gUntil === appeared + BURST_V9_GOLDEN_LIFE, "it appears on its due tick and fades 5 s later");
  ok(s.gx === s0.goldens![0]!.x * FP || Math.abs((s.gx ?? 0) - s0.goldens![0]!.x * FP) <= 3 * FP, "at its seeded spot");
  // Queued: wave 2's golden due while wave 1's is up appears when it fades.
  const q = game.step({ ...s, gDue: [-2, s.tick, -1, -1, -1], invuln: 999 }, null);
  ok(q.gn === 0, "a golden atom due while another is up waits");
  let qq = q;
  for (let i = 0; i < BURST_V9_GOLDEN_LIFE && qq.gn !== 1; i++) qq = game.step({ ...qq, invuln: 999 }, null);
  ok(qq.gn === 1 && qq.tick === (s.gUntil ?? 0), "it appears the tick the earlier one fades");
  // It moves and bounces inside the arena.
  let m = s;
  const ys = new Set<number>();
  for (let i = 0; i < 200 && m.gn === 0; i++) {
    m = game.step({ ...m, invuln: 999 }, null);
    ys.add(m.gy ?? 0);
    ok((m.gx ?? 0) - BURST_GOLD_R * FP >= 0 && (m.gx ?? 0) + BURST_GOLD_R * FP <= BURST_WORLD_W * FP && (m.gy ?? 0) + BURST_GOLD_R * FP <= BURST_TALL_H * FP, "the golden atom stays in the arena");
  }
  ok(ys.size > 50, "the golden atom moves");
  // It hurts: the ship under it.
  let h = { ...s, invuln: 0 } as BurstState;
  let hurt = false;
  for (let i = 0; i < BURST_V9_GOLDEN_LIFE && h.gn === 0; i++) {
    h = game.step({ ...h, x: h.gx ?? 0, targetX: h.gx ?? 0, balls: [] }, null);
    if (h.lives < BURST_LIVES) hurt = true;
  }
  ok(hurt, "the golden atom takes a life when it touches the ship");
  // Only one life a touch (the usual invulnerability), as for atoms.
  ok(h.lives >= BURST_LIVES - 2, "a touch costs one life, then the ship is safe a moment");
  // A shot takes it for 5.
  let t = { ...s, freeze: 300, balls: [], invuln: 999 } as BurstState;
  t = game.step({ ...t, x: t.gx!, targetX: t.gx! }, fire(t.tick + 1));
  for (let i = 0; i < 80; i++) t = game.step(t, null);
  ok(burstGoldenCount(t) === 1 && ((t.goldHit ?? 0) & 1) === 1 && t.gn !== 0 && burstStdParts(t).gold === 5, "a shot takes the golden atom for 5");
}

/* ============================== 4. Identical runs ============================== */
section("Every player on a seed plays the identical run");
function events(seed: number, who: SkillLevel | "random"): ArcadeInputEvent[] {
  if (who !== "random") return burstBot({ game, seed, rev: BURST_REV_STD, human: new Human("burst", seed, who), fixes: true }).events ?? [];
  let a = (seed ^ 0x77) >>> 0;
  const r = () => (a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 4294967296;
  const out: ArcadeInputEvent[] = [];
  for (let tt = 1; tt < game.runTicks; tt += 5 + Math.floor(r() * 30)) {
    const f = r() < 0.6;
    out.push({ t: tt, k: f ? BURST_INPUT_FIRE : BURST_INPUT_MOVE, a: f ? 0 : Math.floor(r() * BURST_WORLD_W), b: f ? Math.floor(r() * 2) : 0, c: 0, d: 0 });
  }
  return out;
}
function play(seed: number, evs: ArcadeInputEvent[]): BurstState[] {
  const byTick = new Map(evs.map((e) => [e.t, e]));
  let s = game.init(seed);
  const states = [s];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    states.push(s);
  }
  return states;
}
for (let n = 0; n < 5; n++) {
  const seed = spec.seedFor(n);
  const runs = (["weak", "elite", "random"] as const).map((who) => play(seed, events(seed, who)));
  const first = runs[0]![0]!;
  ok(runs.every((r) => JSON.stringify(r[0]) === JSON.stringify(first)), `seed ${n}: every player starts from the same state`);
  ok(JSON.stringify({ goldens: first.goldens, carriers: first.carriers }) === JSON.stringify(burstScheduleV10(seed, first.waves, BURST_TALL_H)), `seed ${n}: the golden atoms and carriers are the seed's own`);
  for (const r of runs) {
    let lastEntry = -1;
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1]!;
      const b = r[i]!;
      ok(b.goldens === r[0]!.goldens && b.carriers === r[0]!.carriers, `seed ${n}: the schedules never change mid-run`);
      ok(b.cleared <= b.wave && b.wave <= BURST_V10_WAVES, `seed ${n}: a wave clears once, never more than five`);
      if (b.wave > a.wave) lastEntry = b.tick;
      if ((b.gn ?? -1) >= 0 && (a.gn ?? -1) !== b.gn) {
        const g = first.goldens![b.gn!]!;
        ok(b.tick >= lastEntry && (b.gUntil ?? 0) === b.tick + BURST_V9_GOLDEN_LIFE, `seed ${n}: golden atom ${b.gn} appears for 5 s`);
        ok(Math.abs((b.gx ?? 0) - g.x * FP) <= 3 * FP && Math.abs((b.gy ?? 0) - g.y * FP) <= 3 * FP, `seed ${n}: golden atom ${b.gn} at its seeded spot`);
      }
      if (b.ended && b.done) ok(b.cleared === BURST_V10_WAVES && b.gDue!.every((d) => d === -2) && (b.gn ?? -1) < 0 && b.ended === 1, `seed ${n}: a complete run has all five waves cleared and every golden atom gone`);
    }
  }
}

/* ============================== 5. Scores ============================== */
section("Scores: the server agrees, the breakdown adds up, skill orders");
{
  const by: Record<string, number[]> = {};
  const SEEDS = 30;
  let complete = 0;
  for (const level of ALL_LEVELS) {
    for (let n = 0; n < SEEDS; n++) {
      const seed = spec.seedFor(n);
      const evs = events(seed, level);
      const byTick = new Map(evs.map((e) => [e.t, e]));
      let st = game.init(seed);
      const checkpoints: unknown[] = [];
      while (!game.isOver(st) && st.tick < game.runTicks) {
        st = game.step(st, byTick.get(st.tick + 1) ?? null);
        if (st.tick % BURST_CHECKPOINT_INTERVAL === 0) checkpoints.push(burstCheckpoint(st));
      }
      const score = game.score(st);
      const raw = encodeBurstRun({ seed, claimedScore: score, events: evs, endTick: st.tick, checkpoints } as never);
      const replay = replayBurstRun(seed, raw, BURST_REV_STD);
      ok(replay.score === score && !replay.flagged, `${level} seed ${n}: the server replay scores ${replay.score}, the phone ${score}`);
      ok(score >= 1 && score <= 200, `${level} seed ${n}: a played run scores 1–200 (${score})`);
      const parts = burstBandParts(replay.state);
      const p = burstStdParts(replay.state);
      ok(parts.points === p.core && parts.bonus === p.clear + p.gold && parts.penalty === p.lives && Math.max(1, bandTotal(parts, true, 200)) === score, `${level} seed ${n}: the breakdown adds up to the score`);
      if (st.done) complete++;
      (by[level] ??= []).push(score);
    }
  }
  const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;
  const m = ALL_LEVELS.map((l) => med(by[l]!));
  console.log(`  medians on ${SEEDS} seeds, weak → flawless: ${m.join(" / ")}; ${complete} complete runs`);
  ok(m.every((v, i) => i === 0 || v > m[i - 1]!), `medians rise weak < average < good < great < near < elite < flawless (${m.join(", ")})`);
  let idle = game.init(spec.seedFor(2));
  while (!game.isOver(idle) && idle.tick < game.runTicks) idle = game.step(idle, null);
  ok(game.score(idle) === 0, "doing nothing scores 0");
}

/* ============================== 6. Perfect ============================== */
section("A perfect run scores 200");
{
  const perfect = STANDARD.perfect();
  ok(STANDARD.id === "burst" && STANDARD.stampKey === "burstRev" && STANDARD.stamp === BURST_REV_STD, "the standard module names burstRev 10");
  ok(STANDARD.parts.reduce((a, p) => a + p.max, 0) === 200, "the parts' maxima add up to 200");
  ok(perfect.score === 200 && STANDARD.parts.every((p) => perfect.parts[p.key] === p.max), `the oracle's run scores 200 through the server replay, every part at its maximum (${JSON.stringify(perfect)})`);
  const { state } = playOracle(1453580015);
  ok(state.done === 1 && state.lives === BURST_LIVES && state.hits === BURST_V10_ATOMS && burstGoldenCount(state) === 5 && state.clearPts === BURST_V10_CLEAR_PER_WAVE * 5, "a complete run: 87 atoms, five quick waves, five golden atoms, no life lost");
}

if (failures.length) {
  console.log(`\nFAIL burst-standard-check: ${failures.length} of ${checks} checks failed`);
  for (const f of [...new Set(failures)].slice(0, 40)) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`\nPASS burst-standard-check: ${checks} checks — rooms deal burstRev 10; older stamps replay as on main; core 140 × popped ÷ 87, wave clears up to 35, golden atoms up to 25, lives −5, at least 1 for any play; the golden atom hurts; identical runs for every player; a perfect run scores 200`);
