/**
 * Scrumper snipRev 6 (Oct 2026 bank growth): the Tuning E tall game dealing
 * from a bigger bank, so regular players see fewer repeats.
 *
 *  1. Old rounds: 12 real snipRev 5 runs recorded with the code on main before
 *     this change (scripts/fixtures/snip-bank6-legacy.json,
 *     scripts/snip-bank6-legacy.ts) replay through today's server path to the
 *     same score and the same final state, unflagged; the 103 older templates,
 *     snipRev 5's bands and its level orders for 2,000 seeds are byte-identical
 *     to main's (digests taken there).
 *  2. New rounds are stamped snipRev 6, score on the bands, and play in the
 *     tall world (arena, reveal, effects) with the same rules as snipRev 5.
 *  3. The bank: at least 60 distinct tall templates, every new one our own
 *     design built only from the orchard parts (pins, picker's crooks, springy
 *     branches, planks, gutters, wasp nests, sliding baskets, golden leaves),
 *     most of them crook levels; 2,000 seeds draw ten distinct levels with at
 *     most 2 easy (2 easy / 3 medium / 5 hard).
 *  4. Every new template has stored human-paced winning plans at pin wobble
 *     −10, 0 and +10 (scripts/fixtures/snip-rev6-proofs.json) that use every
 *     cut, cut a crook's vine on crook levels and take several cuts on hard
 *     ones; hard crook levels cannot be won without the catch; every
 *     ten-level mix fits the minute with every level inside its 12 s.
 *  5. Repeats across ten rooms (reported), and strong seeded runs through the
 *     server replay.
 *
 *   bun scripts/snip-bank6-check.ts
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fnv } from "./arcade-tuning-a-legacy";
import type { SnipBank6Record } from "./snip-bank6-legacy";
import { puzzleUsesBands } from "../src/lib/arcade/bandParts";
import { snipFxFor } from "../src/lib/arcade/arcadeFxGames.renderer";
import { ARCADE_REVEAL_RENDERERS, revealWorldH } from "../src/lib/arcade/revealRenderers";
import {
  snipGameFor,
  snipLevelOrderTall,
  snipLevelOrderV6,
  SNIP_BANDS_TALL,
  SNIP_BANDS_V6,
  SNIP_BANK6_FIRST,
  SNIP_CONFIG,
  SNIP_LEVEL_TICKS,
  SNIP_REV_BANK6,
  SNIP_REV_TALL,
  SNIP_RUN_TICKS,
  SNIP_TALL_H,
  snipWorldHFor,
  type SnipState,
} from "../src/lib/arcade/snip";
import { encodeSnipRun, replaySnipRun } from "../src/lib/duel/snip";
import { generateSnip } from "../src/lib/duel/arcade.server";
import { playSnipLevel } from "./snip-solver";
import { playSnipRun, SNIP_PROOFS } from "./snip-run-bot";

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};
const section = (name: string) => console.log(`— ${name}`);
const T = SNIP_CONFIG.templates;

/* ============================== 1. Old rounds ============================== */
section("Stored snipRev 5 rounds replay and score exactly as before");
{
  const fixture = JSON.parse(readFileSync("scripts/fixtures/snip-bank6-legacy.json", "utf8")) as { runs: SnipBank6Record[] };
  for (const run of fixture.runs) {
    const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
    const result = replaySnipRun(run.seed, raw, run.rev);
    ok(run.rev === SNIP_REV_TALL, `${run.level} seed ${run.seed}: recorded on snipRev 5`);
    ok(result.score === run.score && !result.flagged, `${run.level} seed ${run.seed}: stored ${run.score}, replays ${result.score}${result.flagged ? " (flagged)" : ""}`);
    ok(fnv(JSON.stringify(result.state)) === run.stateHash, `${run.level} seed ${run.seed}: the replayed final state is byte-identical`);
    ok((result.state as SnipState).order.every((t) => t < SNIP_BANK6_FIRST), `${run.level} seed ${run.seed}: a snipRev 5 run never meets a new template`);
  }
  ok(fixture.runs.length >= 12, `${fixture.runs.length} recorded snipRev 5 runs`);
  // Digests taken on main before this change (eb143ad).
  ok(SNIP_BANK6_FIRST === 103 && fnv(JSON.stringify(T.slice(0, SNIP_BANK6_FIRST))) === 224414787, "the 103 older templates are unchanged (new ones are only appended)");
  ok(fnv(JSON.stringify(SNIP_BANDS_TALL)) === 2076273067, "snipRev 5's bands are unchanged");
  const orders: number[] = [];
  for (let seed = 1; seed <= 2000; seed++) orders.push(...snipLevelOrderTall(seed));
  ok(fnv(JSON.stringify(orders)) === 1999662017, "snipRev 5 deals the same ten levels for 2,000 seeds");
}

/* ======================== 2. Stamp, world, rules ======================== */
section("New rounds: snipRev 6, the tall world, the same rules");
{
  ok(generateSnip().snipRev === SNIP_REV_BANK6, `new rounds stamped ${SNIP_REV_BANK6} (got ${generateSnip().snipRev})`);
  ok(puzzleUsesBands({ type: "snip", snipRev: SNIP_REV_BANK6 } as never), "snipRev 6 scores on the bands");
  ok(snipWorldHFor(SNIP_REV_BANK6) === SNIP_TALL_H, "snipRev 6 plays in the 360 × 640 world");
  const r = ARCADE_REVEAL_RENDERERS.snip!;
  ok(revealWorldH(r, { type: "snip", seed: 5, snipRev: SNIP_REV_BANK6 } as never) === SNIP_TALL_H, "the reveal draws snipRev 6 at the tall height");
  const game = snipGameFor(SNIP_REV_BANK6);
  const tall = snipGameFor(SNIP_REV_TALL);
  const s0 = game.init(42) as SnipState;
  ok(s0.rev === SNIP_REV_BANK6 && s0.worldH === SNIP_TALL_H && Boolean(s0.band), "the state carries the stamp, the tall world and the bands");
  ok(snipFxFor(s0).height === SNIP_TALL_H, "effects follow the tall world");
  ok(game.step === tall.step && game.score === tall.score && game.isOver === tall.isOver && game.inputRanges === tall.inputRanges && game.runTicks === tall.runTicks, "the same step, score, end and input ranges as snipRev 5 (only the deal differs)");
}

/* ============================== 3. The bank ============================== */
section("The bank: at least 60 levels, mostly new crook levels, at most 2 easy a run");
const bands = SNIP_BANDS_V6;
const pool = [...bands.easy, ...bands.medium, ...bands.hard];
const added = pool.filter((t) => t >= SNIP_BANK6_FIRST);
{
  ok(new Set(pool).size === pool.length && pool.length >= 60, `${pool.length} distinct templates in the snipRev 6 bands (snipRev 5: ${[...SNIP_BANDS_TALL.easy, ...SNIP_BANDS_TALL.medium, ...SNIP_BANDS_TALL.hard].length})`);
  ok((["easy", "medium", "hard"] as const).every((b) => SNIP_BANDS_TALL[b].every((t) => bands[b].includes(t))), "every snipRev 5 level keeps its band");
  ok(added.length === T.length - SNIP_BANK6_FIRST && added.every((t) => T[t]!.h === SNIP_TALL_H), `all ${added.length} new templates are tall and in a band`);
  ok(pool.every((t) => T[t]!.pins.length + (T[t]!.hooks?.length ?? 0) <= 4), "at most four ropes and vines a level (the cut log packs the rope in 2 bits)");
  const crooks = added.filter((t) => T[t]!.hooks);
  ok(crooks.length * 2 > added.length, `${crooks.length} of ${added.length} new levels are picker's-crook levels`);
  ok(added.filter((t) => !bands.easy.includes(t)).length * 2 > added.length, "most new levels are medium or hard");
  // Our own designs: only the orchard parts; no bubbles, air cushions, spiders or automatic rope pins.
  const allowed = new Set(["name", "sweet", "pins", "platforms", "mouth", "stars", "planks", "gutters", "springs", "nests", "slide", "h", "hooks"]);
  ok(added.every((t) => Object.keys(T[t]!).every((k) => allowed.has(k))), "new templates use only pins, crooks, branches, planks, gutters, nests, ledges, sliding baskets and leaves");
  ok(added.every((t) => T[t]!.stars.length === 1), "one golden leaf a level");
  const key = (t: number) => JSON.stringify([T[t]!.sweet, T[t]!.pins.map(([x, y]) => [x, y]), T[t]!.hooks ?? [], T[t]!.mouth]);
  ok(new Set(pool.map(key)).size === pool.length, "no two levels share their apple, pins, crooks and basket");
  ok(new Set(pool.map((t) => T[t]!.name)).size === pool.length, "every level has its own name");
  const usedParts = new Set(added.flatMap((t) => (["springs", "planks", "gutters", "nests", "slide"] as const).filter((k) => T[t]![k])));
  ok(usedParts.size === 5, `the new levels mix in every orchard part (${[...usedParts].join(", ")})`);
  let mix = true;
  for (let seed = 1; seed <= 2000; seed++) {
    const o = snipLevelOrderV6(seed);
    mix &&= new Set(o).size === 10 && o.slice(0, 2).every((t) => bands.easy.includes(t)) && o.slice(2, 5).every((t) => bands.medium.includes(t)) && o.slice(5).every((t) => bands.hard.includes(t));
  }
  ok(mix, "2,000 seeds: ten distinct levels, 2 easy, then 3 medium, then 5 hard");
  const seen = new Set<number>();
  for (let seed = 1; seed <= 2000; seed++) for (const t of snipLevelOrderV6(seed)) seen.add(t);
  ok(pool.every((t) => seen.has(t)), "every level is dealt by some seed");
  console.log(`  bank by difficulty: easy ${bands.easy.length}, medium ${bands.medium.length}, hard ${bands.hard.length} (snipRev 5: ${SNIP_BANDS_TALL.easy.length}, ${SNIP_BANDS_TALL.medium.length}, ${SNIP_BANDS_TALL.hard.length})`);
}

/* ============================== 4. Proofs ============================== */
section("Every new level: a stored human-paced plan at every wobble; ten levels fit the minute");
{
  const ropeOnlyWins = (t: number) => {
    const n = T[t]!.pins.length;
    let x = t * 2654435761 >>> 0 || 1;
    const r = (k: number) => {
      x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
      return x % k;
    };
    let wins = 0;
    for (let k = 0; k < 120; k++) {
      const order = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) {
        const j = r(i + 1);
        [order[i], order[j]] = [order[j]!, order[i]!];
      }
      let at = 24 + r(260);
      const plan = order.map((rope) => {
        const step: [number, number] = [rope, at];
        at += 12 + r(160);
        return step;
      });
      if (playSnipLevel(t, 0, plan).eaten) wins++;
    }
    return wins;
  };
  for (const t of added.filter((c) => T[c]!.hooks && bands.hard.includes(c))) {
    const wins = ropeOnlyWins(t);
    ok(wins <= 2, `template ${t} (${T[t]!.name}): cutting only the ropes almost never feeds the apple (${wins} of 120): it needs a cut, a catch and another cut`);
  }
  const worst = new Map<number, number>();
  for (const t of pool) {
    const tpl = T[t]!;
    let w = 0;
    for (const jit of [-10, 0, 10]) {
      const proof = SNIP_PROOFS[String(t)]?.[String(jit)];
      ok(!!proof?.fast, `template ${t} (${tpl.name}) wobble ${jit}: a stored winning plan`);
      if (!proof?.fast) continue;
      const plan = proof.fast.plan;
      if (t >= SNIP_BANK6_FIRST) {
        let pace = plan[0]![1] >= 24;
        for (let i = 1; i < plan.length; i++) pace &&= plan[i]![1] - plan[i - 1]![1] >= 12;
        ok(pace, `template ${t} wobble ${jit}: human pace (first cut ≥ 24 ticks in, cuts ≥ 12 apart)`);
        const res = playSnipLevel(t, jit, plan);
        ok(res.eaten && res.tick === proof.fast.tick && res.applied === plan.length, `template ${t} wobble ${jit}: the plan feeds the apple at tick ${proof.fast.tick}, every cut used`);
        if (tpl.hooks) ok(plan.some(([rope]) => rope >= tpl.pins.length), `template ${t} wobble ${jit}: the plan cuts a crook's vine (cut, catch, cut)`);
        if (bands.hard.includes(t)) ok(plan.length >= 3, `template ${t} wobble ${jit}: a hard level takes several parts (${plan.length} cuts)`);
        if (proof.leaf) {
          const lr = playSnipLevel(t, jit, proof.leaf.plan);
          ok(lr.eaten && lr.star, `template ${t} wobble ${jit}: the leaf plan takes the leaf and feeds the apple`);
        }
      }
      // (snipRev 5's templates are replayed in arcade-tuning-e-check; their stored ticks bound the mix here.)
      w = Math.max(w, proof.fast.tick);
    }
    worst.set(t, w);
    ok(w <= SNIP_LEVEL_TICKS, `template ${t}: fed within the 12 s level`);
  }
  const slowest = (band: readonly number[], k: number) => band.map((t) => worst.get(t) ?? Infinity).sort((a, b) => b - a).slice(0, k).reduce((a, b) => a + b, 0);
  const bound = slowest(bands.easy, 2) + slowest(bands.medium, 3) + slowest(bands.hard, 5);
  ok(bound <= SNIP_RUN_TICKS, `every ten-level mix fits the minute (worst mix ${(bound / 60).toFixed(1)} s with stored plans)`);
  console.log(`  worst mix, fastest plans: ${(bound / 60).toFixed(1)} s; slowest single level ${(Math.max(...worst.values()) / 60).toFixed(1)} s`);
}

/* ============================== 5. Repeats and runs ============================== */
section("Repeats across ten rooms; strong runs through the server replay");
{
  // A regular player's ten rooms: of the 100 levels, how many were already met in an earlier room (exact expectation).
  const expected = (b: { easy: readonly number[]; medium: readonly number[]; hard: readonly number[] }) => {
    let rep = 0;
    for (const [band, k] of [[b.easy, 2], [b.medium, 3], [b.hard, 5]] as const) for (let room = 0; room < 10; room++) rep += k * (1 - (1 - k / band.length) ** room);
    return rep;
  };
  const before = expected(SNIP_BANDS_TALL);
  const after = expected(bands);
  console.log(`  expected repeats in ten rooms (of 100 levels): snipRev 5 ${before.toFixed(1)}, snipRev 6 ${after.toFixed(1)}`);
  ok(after < before, "fewer repeats across ten rooms than snipRev 5");
  const game = snipGameFor(SNIP_REV_BANK6);
  let best = 0;
  for (const seed of [1, 77, 4242]) {
    const r = playSnipRun(game, seed, {});
    const raw = encodeSnipRun({ seed, claimedScore: r.score, events: r.events, endTick: r.state.tick, checkpoints: r.checkpoints });
    const replay = replaySnipRun(seed, raw, SNIP_REV_BANK6);
    ok(replay.score === r.score && !replay.flagged && JSON.stringify(replay.state) === JSON.stringify(r.state), `seed ${seed}: server replay agrees (${r.score}: ${r.state.eaten} apples, ${r.state.stars} leaves, done at ${(r.state.finishTick / 60).toFixed(1)} s)`);
    ok(r.state.eaten === SNIP_CONFIG.levels, `seed ${seed}: the bot feeds all ten apples inside the minute`);
    best = Math.max(best, replay.score);
  }
  console.log(`  best snipRev 6 run through the server replay: ${best}`);
  ok(best >= 140, `a strong run scores at least 140 on snipRev 6 (best ${best})`);
}

if (failures.length) {
  console.log(failures.slice(0, 60).join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} Scrumper snipRev 6 checks`);
  process.exit(1);
}
console.log(`Scrumper snipRev 6: ${checks} checks passed`);
