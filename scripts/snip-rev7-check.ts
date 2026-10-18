/**
 * Scrumper snipRev 7 (Oct 2026, proven deals): snipRev 6's tall game with every
 * deal a room can produce proven winnable at human pace.
 *
 * In a deal each pin gets its own seeded wobble. snipRev 6 draws it per pin in
 * 1 px steps (21 values, 21^k deals for k pins: up to 194,481 for a four-pin
 * level, too many to prove in CI); snipRev 7 draws it per pin from
 * SNIP_PROVEN_WOBBLES (−10, −5, 0, +5, +10 px), so a level has exactly 5^k
 * deals, 4,435 over the 67-level bank, and this check plays every one.
 *
 *  1. Old rounds: snipRev 6 runs recorded on main before this change
 *     (fixtures/arcade-tuning-f2-legacy.json) replay to the same score and the
 *     same final state; scripted runs of every older revision (unstamped,
 *     snipRev 2–6) on 60 seeds, every level dealt, hash as they did on main
 *     (scripts/snip-rev7-digest.ts); the 129 older templates, snipRev 6's bands
 *     and its orders for 2,000 seeds are byte-identical (digests taken on main).
 *  2. New rounds are stamped snipRev 7, score on the bands and play in the tall
 *     world with snipRev 6's step, score, end and input ranges.
 *  3. The deal: each pin's wobble is one of the five steps, drawn on the level's
 *     own pin stream (checked against 300 seeds' ten levels); every value turns
 *     up and the pins of a level move independently. The bank is snipRev 6's,
 *     with Crook gutter run (116, which loses at pin wobble +10 / 0) swapped for
 *     its fixed copy (129, pins drawn apart) in the same band.
 *  4. Every per-pin deal of every snipRev 7 level is fed by its stored plan
 *     (fixtures/snip-rev7-proofs.json, scripts/snip-rev7-proofs.ts): human pace,
 *     every cut used, inside the level's 12 s; ten levels fit the minute.
 *  5. Stored snipRev 7 runs (fixtures/snip-rev7-runs.json, skill-band runs,
 *     scripts/snip-rev7-runs.ts) replay to their stored score and state, and the
 *     run bot feeds all ten apples and scores 150 through the server replay.
 *
 *   bun scripts/snip-rev7-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { TuningF2Record } from "./arcade-tuning-f2-legacy";
import { puzzleUsesBands } from "../src/lib/arcade/bandParts";
import { snipFxFor } from "../src/lib/arcade/arcadeFxGames.renderer";
import { inputAt, recordInput, rngBelow, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { ARCADE_REVEAL_RENDERERS, revealWorldH } from "../src/lib/arcade/revealRenderers";
import * as snip from "../src/lib/arcade/snip";
import {
  snipGameFor,
  snipLevelOrderV6,
  snipLevelOrderV7,
  SNIP_BANDS_V6,
  SNIP_BANDS_V7,
  SNIP_CONFIG,
  SNIP_LEVEL_TICKS,
  SNIP_PROVEN_FIRST,
  SNIP_PROVEN_SWAPS,
  SNIP_PROVEN_WOBBLES,
  SNIP_REV_BANK6,
  SNIP_REV_PROVEN,
  SNIP_RUN_TICKS,
  SNIP_TALL_H,
  snipWorldHFor,
  type SnipState,
} from "../src/lib/arcade/snip";
import { encodeSnipRun, replaySnipRun } from "../src/lib/duel/snip";
import { generateSnip } from "../src/lib/duel/arcade.server";
import { cutFor } from "./snip-check-lib";
import { SNIP_DIGEST_REVS, snipRevDigest } from "./snip-rev7-digest";
import { playSnipRun, snipDealIndex, snipPinWobbles, SNIP_DEAL_PROOFS, SNIP_PLAN_SYMBOLS } from "./snip-run-bot";
import { playSnipLevel } from "./snip-solver";
import { playRevOf } from "./scoring-targets-revs";

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);
const T = SNIP_CONFIG.templates;

/* ============================== 1. Old rounds ============================== */
section("Stored rounds (snipRev 6 and older) replay and score exactly as before");
{
  const fixture = JSON.parse(readFileSync("scripts/fixtures/arcade-tuning-f2-legacy.json", "utf8")) as { runs: TuningF2Record[] };
  const runs = fixture.runs.filter((r) => r.type === "snip");
  for (const run of runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySnipRun(run.seed, raw, run.rev);
    ok(run.rev === SNIP_REV_BANK6, `${run.level} seed ${run.seed}: recorded on snipRev 6`);
    ok(result.score === run.score && !result.flagged, `${run.level} seed ${run.seed}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${run.level} seed ${run.seed}: the replayed final state is byte-identical`);
  }
  ok(runs.length >= 8, `${runs.length} recorded snipRev 6 runs`);
  // Digests taken on main before this change (b068718), scripts/snip-rev7-digest.ts.
  const before: Record<string, number> = { null: 3701123638, "2": 4029793509, "3": 1441216746, "4": 680318570, "5": 1197834674, "6": 575053783 };
  for (const rev of SNIP_DIGEST_REVS) ok(snipRevDigest(snip, rev) === before[String(rev)], `${rev === null ? "unstamped" : `snipRev ${rev}`}: 60 scripted runs, every level dealt, hash as on main`);
  ok(SNIP_PROVEN_FIRST === 129 && fnv(JSON.stringify(T.slice(0, SNIP_PROVEN_FIRST))) === 261485590, "the 129 older templates are unchanged (fixed copies are only appended)");
  ok(fnv(JSON.stringify(SNIP_BANDS_V6)) === 3149399468, "snipRev 6's bands are unchanged");
  const orders: number[] = [];
  for (let seed = 1; seed <= 2000; seed++) orders.push(...snipLevelOrderV6(seed));
  ok(fnv(JSON.stringify(orders)) === 126831639, "snipRev 6 deals the same ten levels for 2,000 seeds");
}

/* ======================== 2. Stamp, world, rules ======================== */
section("New rounds: snipRev 7, the tall world, snipRev 6's rules");
{
  ok(playRevOf("snip", generateSnip().snipRev) === SNIP_REV_PROVEN, `new rounds stamped ${SNIP_REV_PROVEN} (got ${playRevOf("snip", generateSnip().snipRev)})`);
  ok(puzzleUsesBands({ type: "snip", snipRev: SNIP_REV_PROVEN } as never), "snipRev 7 scores on the bands");
  ok(snipWorldHFor(SNIP_REV_PROVEN) === SNIP_TALL_H, "snipRev 7 plays in the 360 × 640 world");
  ok(revealWorldH(ARCADE_REVEAL_RENDERERS.snip!, { type: "snip", seed: 5, snipRev: SNIP_REV_PROVEN } as never) === SNIP_TALL_H, "the reveal draws snipRev 7 at the tall height");
  const game = snipGameFor(SNIP_REV_PROVEN);
  const bank6 = snipGameFor(SNIP_REV_BANK6);
  const s0 = game.init(42) as SnipState;
  ok(s0.rev === SNIP_REV_PROVEN && s0.worldH === SNIP_TALL_H && Boolean(s0.band), "the state carries the stamp, the tall world and the bands");
  ok(snipFxFor(s0).height === SNIP_TALL_H, "effects follow the tall world");
  ok(game.step === bank6.step && game.score === bank6.score && game.isOver === bank6.isOver && game.inputRanges === bank6.inputRanges && game.runTicks === bank6.runTicks && game.draw === bank6.draw, "snipRev 6's step, score, end, art and input ranges (only the deal differs)");
}

/* ============================== 3. The deal ============================== */
section("The deal: each pin on its own seeded step; snipRev 6's bank with the failing level fixed");
{
  const game = snipGameFor(SNIP_REV_PROVEN);
  const values = new Set<number>();
  let streams = true;
  let inSteps = true;
  let multi = 0;
  let independent = 0;
  let levels = 0;
  for (let seed = 1; seed <= 300; seed++) {
    let s = game.init(seed) as SnipState;
    let rng = seed | 0;
    const log: ArcadeInputEvent[] = [];
    let level = -1;
    while (!game.isOver(s)) {
      if (s.level !== level) {
        level = s.level;
        levels++;
        const w = snipPinWobbles(s);
        // The level's pin stream: one draw of five per pin, carried on from the last level.
        for (const x of w) {
          const r = rngBelow(rng, SNIP_PROVEN_WOBBLES.length);
          rng = r.state;
          streams &&= x === SNIP_PROVEN_WOBBLES[r.value];
          inSteps &&= SNIP_PROVEN_WOBBLES.includes(x);
          values.add(x);
        }
        streams &&= s.rng === rng;
        if (w.length >= 2) {
          multi++;
          if (new Set(w).size > 1) independent++;
        }
      }
      const k = s.levelTick + 1 - 30;
      if (k >= 0 && k % 10 === 0 && s.ropes[k / 10]?.alive) recordInput(log, cutFor(s, k / 10), game.inputRanges);
      s = game.step(s, inputAt(log, s.tick + 1)) as SnipState;
    }
  }
  ok(levels >= 2900, `300 seeds deal ${levels} levels (a scripted run cutting every rope early; a few runs end on the clock)`);
  ok(inSteps, "every pin's wobble is one of −10, −5, 0, +5, +10 px");
  ok(streams, "each pin draws its own wobble from the level's pin stream, in pin order, carried from level to level");
  ok(values.size === SNIP_PROVEN_WOBBLES.length, `all five wobbles are dealt (${[...values].sort((a, b) => a - b).join(", ")})`);
  ok(independent > 0 && independent < multi, `pins move independently: ${independent} of ${multi} multi-pin levels dealt their pins different wobbles`);

  const bands = SNIP_BANDS_V7;
  const pool = [...bands.easy, ...bands.medium, ...bands.hard];
  ok(Object.keys(SNIP_PROVEN_SWAPS).length === T.length - SNIP_PROVEN_FIRST, `${T.length - SNIP_PROVEN_FIRST} fixed copies appended, one per swapped level`);
  for (const b of ["easy", "medium", "hard"] as const) {
    ok(bands[b].length === SNIP_BANDS_V6[b].length && bands[b].every((t, i) => t === (SNIP_PROVEN_SWAPS[SNIP_BANDS_V6[b][i]!] ?? SNIP_BANDS_V6[b][i])), `${b}: snipRev 6's levels, swapped ones replaced by their fixed copies in the same slot`);
  }
  for (const [from, to] of Object.entries(SNIP_PROVEN_SWAPS)) {
    const a = T[Number(from)]!;
    const b = T[to]!;
    ok(Number(from) < SNIP_PROVEN_FIRST && !pool.includes(Number(from)) && pool.includes(to), `${a.name} (${from}) is dealt as its fixed copy (${to})`);
    const { pins: _pa, ...restA } = a;
    const { pins: _pb, ...restB } = b;
    ok(JSON.stringify(restA) === JSON.stringify(restB), `${a.name} (${to}) differs from ${from} only in its pins`);
    // Pins drawn apart: at no deal do two pins sit within 10 px of each other.
    let gap = Infinity;
    for (let i = 0; i < b.pins.length; i++) for (let j = i + 1; j < b.pins.length; j++) gap = Math.min(gap, Math.hypot(Math.max(0, Math.abs(b.pins[i]![0] - b.pins[j]![0]) - 20), b.pins[i]![1] - b.pins[j]![1]));
    ok(gap >= 10, `${b.name} (${to}): its pins stay at least 10 px apart at every deal (closest ${gap.toFixed(1)} px)`);
  }
  ok(new Set(pool).size === pool.length && pool.length === 67, `${pool.length} distinct templates in the snipRev 7 bands`);
  ok(pool.every((t) => T[t]!.h === SNIP_TALL_H && T[t]!.pins.length + (T[t]!.hooks?.length ?? 0) <= 4), "all tall, at most four ropes and vines a level");
  ok(new Set(pool.map((t) => T[t]!.name)).size === pool.length, "every level has its own name");
  let mix = true;
  const seen = new Set<number>();
  for (let seed = 1; seed <= 2000; seed++) {
    const o = snipLevelOrderV7(seed);
    o.forEach((t) => seen.add(t));
    mix &&= new Set(o).size === 10 && o.slice(0, 2).every((t) => bands.easy.includes(t)) && o.slice(2, 5).every((t) => bands.medium.includes(t)) && o.slice(5).every((t) => bands.hard.includes(t));
  }
  ok(mix, "2,000 seeds: ten distinct levels, 2 easy, then 3 medium, then 5 hard");
  let same = true;
  for (let seed = 1; seed <= 2000; seed++) same &&= JSON.stringify(snipLevelOrderV7(seed)) === JSON.stringify(snipLevelOrderV6(seed).map((t) => SNIP_PROVEN_SWAPS[t] ?? t));
  ok(same, "a seed meets snipRev 6's ten levels (swapped ones as their fixed copies)");
  ok(pool.every((t) => seen.has(t)), "every level is dealt by some seed");
}

/* ============================== 4. Proofs ============================== */
section("Every per-pin deal of every level: a stored human-paced winning plan");
{
  const bands = SNIP_BANDS_V7;
  const pool = [...bands.easy, ...bands.medium, ...bands.hard];
  const worst = new Map<number, number>();
  let deals = 0;
  let proven = 0;
  for (const t of pool) {
    const tpl = T[t]!;
    const proof = SNIP_DEAL_PROOFS[String(t)];
    const k = tpl.pins.length;
    const count = SNIP_PROVEN_WOBBLES.length ** k;
    ok(!!proof && proof.pins === k && proof.deal.length === count && proof.name === tpl.name, `template ${t} (${tpl.name}): a stored proof covering all ${count} deals of its ${k} pin${k > 1 ? "s" : ""}`);
    if (!proof) continue;
    for (const plan of proof.plans) {
      let pace = plan.length > 0 && plan[0]![1] >= 24;
      for (let i = 1; i < plan.length; i++) pace &&= plan[i]![1] - plan[i - 1]![1] >= 12;
      ok(pace, `template ${t}: plan ${JSON.stringify(plan)} is human-paced (first cut ≥ 24 ticks in, cuts ≥ 12 apart)`);
      if (tpl.hooks) ok(plan.some(([rope]) => rope >= k), `template ${t}: plan ${JSON.stringify(plan)} cuts a crook's vine (cut, catch, cut)`);
    }
    let w = 0;
    for (let i = 0; i < count; i++) {
      const combo: number[] = [];
      for (let p = 0, x = i; p < k; p++, x = Math.floor(x / SNIP_PROVEN_WOBBLES.length)) combo.unshift(SNIP_PROVEN_WOBBLES[x % SNIP_PROVEN_WOBBLES.length]!);
      deals++;
      const plan = proof.plans[SNIP_PLAN_SYMBOLS.indexOf(proof.deal[i]!)];
      if (snipDealIndex(combo) !== i || !plan) {
        ok(false, `template ${t} deal ${JSON.stringify(combo)}: no stored plan`);
        continue;
      }
      const res = playSnipLevel(t, combo, plan);
      const won = res.eaten && res.applied === plan.length && res.tick <= SNIP_LEVEL_TICKS;
      ok(won, `template ${t} (${tpl.name}) deal ${JSON.stringify(combo)}: plan ${JSON.stringify(plan)} feeds the apple with every cut used (${res.eaten ? `fed at ${res.tick}` : "not fed"}, ${res.applied} of ${plan.length} cuts)`);
      if (won) proven++;
      w = Math.max(w, res.tick);
    }
    ok(w === proof.worst, `template ${t}: slowest deal fed at tick ${w} (stored ${proof.worst})`);
    worst.set(t, w);
  }
  ok(proven === deals && deals === 4435, `${proven} of ${deals} deals proven (every per-pin wobble combination of the 67 levels)`);
  const slowest = (band: readonly number[], k: number) => band.map((t) => worst.get(t) ?? Infinity).sort((a, b) => b - a).slice(0, k).reduce((a, b) => a + b, 0);
  const bound = slowest(bands.easy, 2) + slowest(bands.medium, 3) + slowest(bands.hard, 5);
  ok(bound <= SNIP_RUN_TICKS, `every ten-level deal fits the minute (worst mix ${(bound / 60).toFixed(1)} s with stored plans)`);
  console.log(`  ${proven} deals proven; worst ten-level mix ${(bound / 60).toFixed(1)} s; slowest single deal ${(Math.max(...worst.values()) / 60).toFixed(1)} s`);
}

/* ============================== 5. Runs ============================== */
section("Stored snipRev 7 runs replay unchanged; the run bot scores 150 through the server replay");
{
  const fixture = JSON.parse(readFileSync("scripts/fixtures/snip-rev7-runs.json", "utf8")) as { runs: TuningF2Record[] };
  for (const run of fixture.runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySnipRun(run.seed, raw, run.rev);
    ok(run.rev === SNIP_REV_PROVEN, `${run.level} seed ${run.seed}: recorded on snipRev 7`);
    ok(result.score === run.score && !result.flagged, `${run.level} seed ${run.seed}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${run.level} seed ${run.seed}: the replayed final state is byte-identical`);
  }
  ok(fixture.runs.length >= 8, `${fixture.runs.length} stored snipRev 7 runs`);
  const game = snipGameFor(SNIP_REV_PROVEN);
  let best = 0;
  for (const seed of [1, 77, 4242]) {
    const r = playSnipRun(game, seed, {});
    const raw = encodeSnipRun({ seed, claimedScore: r.score, events: r.events, endTick: r.state.tick, checkpoints: r.checkpoints });
    const replay = replaySnipRun(seed, raw, SNIP_REV_PROVEN);
    ok(replay.score === r.score && !replay.flagged && JSON.stringify(replay.state) === JSON.stringify(r.state), `seed ${seed}: server replay agrees (${r.score}: ${r.state.eaten} apples, ${r.state.stars} leaves, done at ${(r.state.finishTick / 60).toFixed(1)} s)`);
    ok(r.state.eaten === SNIP_CONFIG.levels, `seed ${seed}: the bot feeds all ten apples inside the minute`);
    best = Math.max(best, replay.score);
  }
  console.log(`  best snipRev 7 run through the server replay: ${best}`);
  ok(best === 150, `a run scores 150 on snipRev 7 through the server replay (best ${best})`);
}

if (failures.length) {
  console.log(failures.slice(0, 60).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} Scrumper snipRev 7 checks`);
  process.exit(1);
}
console.log(`Scrumper snipRev 7: ${checks} checks passed`);
