/**
 * Moon Climb (Ricochet's id, ricoRev 3) and Blockzone (Blockfall's id, blockfallRev 2), 3 Nov 2026
 * (docs/arcade-standard/ricochet.md, blockfall.md):
 *
 *  1. older stamps replay exactly: 24 runs recorded on main before the change (ricoRev 2, the ninja wall-climb, and
 *     blockfallRev 1; scripts/fixtures/moon-blockzone-legacy.json, `bun scripts/moon-blockzone-legacy-record.ts`) score
 *     the same and end in the same state through today's server replay;
 *  2. Moon Climb's deal: no coins or gold lanterns, six sky lanterns, three scrolls, mid-ledges 18 px wide; every
 *     tower's witness rides every lantern, earns the whole flow part, takes every scroll and no hit, so it scores 200
 *     through the server replay (12 towers at quick depth, 60 with CHECKS_FULL=1);
 *  3. Moon Climb's rules: a leap that meets a ledge clings to its near side and a tap from there leaps back; a lantern
 *     touched in a leap is ridden up for MOON_RIDE ticks, then lets go towards the wall the leap was heading for; a
 *     tap's direction picks the wall to leap off towards; Flow counts clean landings, a slide or a hit ends it;
 *     the tap's direction is the only payload; no input scores 0, one tap at least 1;
 *  4. Blockzone's rules: 90 s, hold does nothing (and is outside the stamp's inputs), the soft drop speeds the fall
 *     while on, the lock wait is 30 ticks and a move or turn while resting restarts it at most 10 times, a hard drop
 *     locks at once, the parts sum to 200;
 *  5. Blockzone's deal: 300 distinct seeds, the oracle takes each to exactly 200 through the server replay (24 at
 *     quick depth, all and the file rebuilt with CHECKS_FULL=1); rooms deal blockfallRev 2 from it, and Ricochet
 *     ricoRev 3;
 *  6. the bands rise weak → flawless on both (flawless 200 on every seed);
 *  7. names, help and intro: Moon Climb and Blockzone, no hold or pads, intro score lines within 90 characters.
 *
 *   bun scripts/moon-blockzone-check.ts [--full]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import {
  MODE_CLING, MODE_FLIGHT, MODE_RIDE, MOON_CORE_FULL_M, MOON_FLOW_SLIDE, MOON_FLOW_STEP, MOON_LEDGE_HW, MOON_REV, MOON_RIDE, MOON_SCROLLS, MOON_SKY,
  moonCheckpoint, moonDeal, moonGame, moonLedgeX, moonStdParts, NINJA_CHECKPOINT_INTERVAL, NINJA_CLING_X, NINJA_INPUT_TAP, NINJA_START, type MoonState,
} from "../src/lib/arcade/ricochetNinja";
import { encodeMoonRun, replayMoonRun, replayNinjaRun } from "../src/lib/duel/ricochet";
import {
  BF_CHECKPOINT_INTERVAL, BF_INPUT_DROP, BF_INPUT_HOLD, BF_INPUT_MOVE, BF_INPUT_SOFT, BF_INPUT_TURN, BF_LOCK_TICKS, BF_ZONE_LOCK_RESETS, BF_ZONE_RUN_TICKS,
  BF_ZONE_STD_SPEC, BLOCKFALL_REV_ZONE, bfCheckpoint, bfFits, bzInit, blockzoneGame, blockfallStdParts, type BfState,
} from "../src/lib/arcade/blockfall";
import { encodeBlockfallRun, replayBlockfallRun } from "../src/lib/duel/blockfall";
import { BLOCKFALL_DEAL_V2 } from "../src/lib/duel/blockfallDealV2.server";
import { generateBlockfall, generateRicochet } from "../src/lib/duel/arcade.server";
import { blockfallOracleRun } from "./blockfall-oracle";
import { ALL_LEVELS, Human } from "./arcade-skill-bands/human";
import { bot as ricoBot } from "./arcade-skill-bands/bots/ricochet";
import { bot as bfBot } from "./arcade-skill-bands/bots/blockfall";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { ROUND_MAX } from "../src/lib/duel/roundMax";

console.error = () => {};
const FULL = process.env["CHECKS_FULL"] === "1" || process.argv.includes("--full");
let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
const digest = (state: unknown) => createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 16);
const tap = (t: number, a = 0): ArcadeInputEvent => ({ t, k: NINJA_INPUT_TAP, a, b: 0, c: 0, d: 0 });

/** A Moon Climb run as the phone sends it (with checkpoints), through the server replay. */
function moonRaw(seed: number, events: ArcadeInputEvent[]): string {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = moonGame.init(seed);
  const cps = [];
  while (!moonGame.isOver(s)) {
    s = moonGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % NINJA_CHECKPOINT_INTERVAL === 0) cps.push(moonCheckpoint(s));
  }
  return encodeMoonRun({ seed, claimedScore: moonGame.score(s), events, endTick: s.tick, checkpoints: cps });
}
function bzRaw(seed: number, events: ArcadeInputEvent[]): string {
  const at = new Map(events.map((e) => [e.t, e]));
  let s = blockzoneGame.init(seed);
  const cps = [];
  while (!blockzoneGame.isOver(s)) {
    s = blockzoneGame.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % BF_CHECKPOINT_INTERVAL === 0) cps.push(bfCheckpoint(s));
  }
  return encodeBlockfallRun({ seed, claimedScore: blockzoneGame.score(s), events, endTick: s.tick, checkpoints: cps });
}

/* 1. Older stamps replay exactly. */
{
  const fx = JSON.parse(readFileSync("scripts/fixtures/moon-blockzone-legacy.json", "utf8")) as { runs: { type: string; rev: number; seed: number; raw: string; score: number; digest: string }[] };
  const bad: string[] = [];
  for (const r of fx.runs) {
    const out = r.type === "ricochet" ? replayNinjaRun(r.seed, r.raw) : replayBlockfallRun(r.seed, r.raw, r.rev);
    if (out.score !== r.score || digest(out.state) !== r.digest) bad.push(`${r.type} rev ${r.rev} seed ${r.seed}: ${out.score} vs ${r.score}`);
  }
  ok(fx.runs.length === 24 && bad.length === 0, `legacy: 24 runs recorded on main (ricoRev 2, blockfallRev 1) replay to the same score and state${bad.length ? ` (${bad.join("; ")})` : ""}`);
}

/* 2. Moon Climb's deal. */
{
  const seeds = FULL ? Array.from({ length: 60 }, (_, i) => i * 7919 + 3) : [0, 1, 2, 77, 10000, 123456789, 5000, 5131, 5262, 5393, 5524, 5655];
  const bad: string[] = [];
  let ledges = 0;
  for (const seed of seeds) {
    const d = moonDeal(seed);
    const t = d.tower;
    if (t.coins.length || t.lanterns.length || t.sky.length !== MOON_SKY || t.scrolls.length !== MOON_SCROLLS) bad.push(`${seed}: items ${t.coins.length}/${t.lanterns.length}/${t.sky.length}/${t.scrolls.length}`);
    ledges += t.ledges.length;
    const r = replayMoonRun(seed, moonRaw(seed, d.witness.map((e) => tap(e.t, e.a))));
    const parts = moonStdParts(r.state) ?? [];
    if (r.flagged || r.score !== 200 || parts.some((p) => p.points !== p.max) || r.hits !== 0) bad.push(`${seed}: ${r.score}${r.flagged ? " flagged" : ""}`);
  }
  ok(bad.length === 0, `moon deal: ${seeds.length} towers: no coins or gold lanterns, ${MOON_SKY} sky lanterns, ${MOON_SCROLLS} scrolls, and the witness scores 200 with every part full and no hit${bad.length ? ` (${bad.join("; ")})` : ""}`);
  ok(ledges >= seeds.length * 4, `moon deal: towers carry mid-ledges (${ledges} on ${seeds.length} towers)`);
  ok(MOON_LEDGE_HW * 2 === 18, "moon deal: a mid-ledge is 18 px wide");
}

/* 3. Moon Climb's rules. */
{
  // Play seed 4's witness to its first ledge landing, its first ride and its first ride's end.
  const d = moonDeal(4);
  const at = new Map(d.witness.map((e) => [e.t, e.a]));
  let s = moonGame.init(4);
  let ledgeLanding: MoonState | null = null;
  let grab: MoonState | null = null;
  let afterLedge: MoonState | null = null;
  while (!s.ended) {
    const prev = s;
    const a = at.get(s.tick + 1);
    s = moonGame.step(s, a === undefined ? null : tap(s.tick + 1, a));
    if (!ledgeLanding && prev.mode === MODE_FLIGHT && s.mode === MODE_CLING && s.ledge >= 0) ledgeLanding = s;
    if (ledgeLanding && !afterLedge && prev.ledge >= 0 && s.mode === MODE_FLIGHT) afterLedge = s;
    if (!grab && s.mode === MODE_RIDE) grab = s;
  }
  ok(!!ledgeLanding && ledgeLanding.x === moonLedgeX(ledgeLanding.tower.ledges[ledgeLanding.ledge]!, ledgeLanding.wall === 1 ? 0 : 1), "moon rules: a leap that meets a ledge clings to its near side");
  ok(!!afterLedge && afterLedge.toX === NINJA_CLING_X[ledgeLanding!.wall === 1 ? 0 : 1], "moon rules: a tap on a ledge leaps back to the wall the ninja came from");
  ok(!!ledgeLanding && ledgeLanding.streak > 0, "moon rules: a ledge landing carries the flow");
  // A ride with no tap: MOON_RIDE ticks up, then the lantern lets go towards the wall the leap was heading for.
  if (grab) {
    let r: MoonState = grab;
    const y0 = r.y;
    let n = 0;
    while (r.mode === MODE_RIDE && n < 400) {
      r = moonGame.step(r, null);
      n++;
    }
    ok(n === MOON_RIDE && r.y > y0 && r.mode === MODE_FLIGHT && r.toX === NINJA_CLING_X[grab.wall], `moon rules: a ride lasts ${MOON_RIDE} ticks rising, then drops towards the wall it was heading for (${n})`);
    const left = moonGame.step(grab, tap(grab.tick + 1, -1));
    const right = moonGame.step(grab, tap(grab.tick + 1, 1));
    ok(left.mode === MODE_FLIGHT && left.toX === NINJA_CLING_X[0] && right.toX === NINJA_CLING_X[1] && left.leaps === grab.leaps + 1, "moon rules: a tap on a lantern leaps off towards the side asked for");
    ok(grab.rides === 1 && grab.gotSky.filter(Boolean).length === 1, "moon rules: a grabbed lantern counts one ride");
  } else ok(false, "moon rules: seed 4's witness rides a lantern");
  // Flow: a slide past MOON_FLOW_SLIDE before the take-off ends the streak; a hit ends it.
  {
    let f: MoonState = { ...moonGame.init(9), streak: 5, slid: MOON_FLOW_SLIDE } as MoonState;
    f = moonGame.step(f, tap(1));
    ok(f.streak === 0, "moon rules: a take-off after sliding too far ends the flow");
    let g: MoonState = { ...moonGame.init(9), streak: 5, slid: 0 } as MoonState;
    g = moonGame.step(g, tap(1));
    while (g.mode === MODE_FLIGHT) g = moonGame.step(g, null);
    ok(g.streak === 6 && (MOON_FLOW_STEP !== 6 || g.flow === 1), "moon rules: a clean leap adds one to the flow");
  }
  const ranges = moonGame.inputRanges!;
  ok(ranges.length === 1 && ranges[0]!.k === NINJA_INPUT_TAP && ranges[0]!.a[0] === -1 && ranges[0]!.a[1] === 1, "moon rules: the tap carries a direction (−1, 0, 1) and nothing else");
  ok(replayMoonRun(5, moonRaw(5, [])).score === 0, "moon score: no input scores 0");
  ok(replayMoonRun(5, moonRaw(5, [tap(3)])).score >= 1, "moon score: one tap scores at least 1");
  const full = moonStdParts({ ...moonGame.init(3), acted: 1, best: NINJA_START + MOON_CORE_FULL_M * 40 * 256 } as MoonState)!;
  ok(full[0]!.points === full[0]!.max && full.slice(1).every((p) => p.points === 0), "moon score: the core is full at its full height, nothing else from height");
}

/* 4. Blockzone's rules. */
{
  ok(blockzoneGame.runTicks === BF_ZONE_RUN_TICKS && BF_ZONE_RUN_TICKS === 90 * 60, "zone rules: a 90-second run");
  ok(!blockzoneGame.inputRanges!.some((r) => r.k === BF_INPUT_HOLD), "zone rules: hold is not one of the stamp's inputs");
  const s0 = { ...bzInit(11), tick: 1 };
  const held = blockzoneGame.step(s0, { t: 2, k: BF_INPUT_HOLD, a: 0, b: 0, c: 0, d: 0 });
  ok(held.hold === -1 && held.piece.shape === s0.piece.shape && held.held === 0, "zone rules: a hold input does nothing");
  // Soft drop: rows fallen in 30 ticks with and without it.
  const fallen = (soft: boolean) => {
    let s: BfState = bzInit(11);
    if (soft) s = blockzoneGame.step(s, { t: 1, k: BF_INPUT_SOFT, a: 1, b: 0, c: 0, d: 0 });
    const y0 = s.piece.y;
    for (let i = 0; i < 30; i++) s = blockzoneGame.step(s, null);
    return s.piece.y - y0;
  };
  ok(fallen(true) >= 10 && fallen(false) <= 1, `zone rules: the soft drop speeds the fall (${fallen(true)} rows vs ${fallen(false)} in 0.5 s)`);
  // Lock wait: rest the piece on the floor, then count ticks to the lock; moves while resting restart it, at most 10 times.
  let r: BfState = bzInit(13);
  r = blockzoneGame.step(r, { t: 1, k: BF_INPUT_SOFT, a: 1, b: 0, c: 0, d: 0 });
  while (bfFits(r.board, r.piece.shape, r.piece.turn, r.piece.x, r.piece.y + 1)) r = blockzoneGame.step(r, null);
  const restAt = r.tick;
  let plain = r;
  while (plain.pieces === r.pieces) plain = blockzoneGame.step(plain, null);
  ok(plain.tick - restAt === BF_LOCK_TICKS && BF_LOCK_TICKS === 30, `zone rules: a resting piece locks after 0.5 s (${plain.tick - restAt} ticks)`);
  let wiggle = r;
  let dir = 1;
  let n = 0;
  while (wiggle.pieces === r.pieces && n < 2000) {
    const t = wiggle.tick + 1;
    const ev = t % 20 === 0 ? { t, k: BF_INPUT_MOVE, a: dir, b: 0, c: 0, d: 0 } : null;
    if (ev) dir = -dir;
    wiggle = blockzoneGame.step(wiggle, ev);
    n++;
  }
  ok(wiggle.pieces === r.pieces + 1 && n > BF_LOCK_TICKS * 3 && n <= BF_LOCK_TICKS * (BF_ZONE_LOCK_RESETS + 2) + 20, `zone rules: moving a resting piece restarts its lock wait, at most ${BF_ZONE_LOCK_RESETS} times (${n} ticks)`);
  const dropped = blockzoneGame.step(bzInit(13), { t: 1, k: BF_INPUT_DROP, a: 0, b: 0, c: 0, d: 0 });
  ok(dropped.pieces === 1, "zone rules: a hard drop locks at once");
  ok(BF_ZONE_STD_SPEC.parts.reduce((a, p) => a + p.max, 0) === 200 && BF_ZONE_STD_SPEC.rev === BLOCKFALL_REV_ZONE, "zone score: the parts' maximums sum to 200");
  ok(blockzoneGame.score(bzInit(12)) === 0, "zone score: no input scores 0");
  ok(blockzoneGame.score({ ...bzInit(12), acted: 1, ended: 2 }) === 1, "zone score: a run that played and topped out at once scores 1");
  ok((blockfallStdParts({ ...bzInit(12), acted: 1, pieces: 40 }) ?? [])[1]!.points === 40, "zone score: 1 for every piece placed");
  ok([BF_INPUT_MOVE, BF_INPUT_TURN, BF_INPUT_DROP, BF_INPUT_SOFT].every((k) => blockzoneGame.inputRanges!.some((x) => x.k === k)), "zone rules: move, turn, drop and the soft drop are the stamp's inputs");
}

/* 5. Blockzone's deal and the rooms' stamps. */
{
  ok(BLOCKFALL_DEAL_V2.length === 300 && new Set(BLOCKFALL_DEAL_V2).size === 300, "zone deal: 300 distinct seeds");
  const picks = FULL ? BLOCKFALL_DEAL_V2.map((_, i) => i) : Array.from({ length: 24 }, (_, i) => Math.floor((i * 299) / 23));
  const bad: string[] = [];
  for (const i of picks) {
    const r = blockfallOracleRun(BLOCKFALL_DEAL_V2[i]!, 2).result;
    if (r.score !== 200 || r.flagged) bad.push(`#${i}: ${r.score}`);
  }
  ok(bad.length === 0, `zone deal: the oracle takes ${picks.length} deal seeds to 200 through the server replay${bad.length ? ` (${bad.join(", ")})` : ""}`);
  if (FULL) {
    let same = true;
    try {
      execFileSync("bun", ["scripts/blockfall-deal.ts", "--rev=2", "--check"], { stdio: "pipe" });
    } catch {
      same = false;
    }
    ok(same, "zone deal: the file is what blockfall-deal.ts --rev=2 builds");
  }
  const dealt = generateBlockfall();
  ok(dealt.blockfallRev === BLOCKFALL_REV_ZONE && BLOCKFALL_DEAL_V2.includes(dealt.seed), "zone deal: rooms deal blockfallRev 2 from its deal");
  ok(generateRicochet().ricoRev === MOON_REV, "moon deal: rooms deal ricoRev 3");
  ok(ROUND_MAX.ricochet === 200 && ROUND_MAX.blockfall === 200, "round max: both 200");
}

/* 6. The bands rise. */
{
  const rise = (name: string, run: (level: (typeof ALL_LEVELS)[number], n: number) => number) => {
    const medians: number[] = [];
    for (const level of ALL_LEVELS) {
      const scores = Array.from({ length: 12 }, (_, n) => run(level, n));
      if (level === "perfect") ok(scores.every((x) => x === 200), `${name} bands: flawless play scores 200 on every seed (${scores.join(", ")})`);
      else ok(scores.every((x) => x >= 1), `${name} bands: every ${level} run scores at least 1`);
      medians.push([...scores].sort((a, b) => a - b)[6]!);
    }
    ok(medians.every((m, i) => i === 0 || m >= medians[i - 1]!) && medians[0]! < medians[3]!, `${name} bands: medians rise weak → flawless (${medians.join(" / ")})`);
  };
  rise("moon", (level, n) => {
    const seed = 2000 + n * 31;
    const ev = ricoBot({ game: moonGame as any, seed, rev: MOON_REV, human: new Human("ricochet", seed, level), fixes: true }).events ?? [];
    return replayMoonRun(seed, moonRaw(seed, ev)).score;
  });
  rise("zone", (level, n) => {
    const seed = BLOCKFALL_DEAL_V2[(n * 37) % 300]!;
    const ev = bfBot({ game: blockzoneGame as any, seed, rev: 2, human: new Human("blockfall", seed, level), fixes: true }).events ?? [];
    return replayBlockfallRun(seed, bzRaw(seed, ev), 2).score;
  });
}

/* 7. Names, help and intro. */
{
  ok(gameDisplayName("ricochet") === "Moon Climb" && gameDisplayName("blockfall") === "Blockzone", "names: Moon Climb and Blockzone");
  const bz = JSON.stringify(PUZZLE_INSTRUCTIONS.blockfall);
  ok(/90 seconds/.test(bz) && /drag down/i.test(bz) && /flick/i.test(bz) && !/hold/i.test(bz) && !/pads?\b/i.test(bz), "help: Blockzone's 90 s, the soft drop and flick named, no hold or pads");
  ok(!/tetr/i.test(bz), "help: no borrowed names");
  const mc = JSON.stringify(PUZZLE_INSTRUCTIONS.ricochet);
  ok(/lantern/i.test(mc) && /ledge/i.test(mc) && /flow/i.test(mc) && !/coin/i.test(mc), "help: Moon Climb's lanterns, ledges and flow named, no coins");
  ok(PUZZLE_INSTRUCTIONS.ricochet.score.includes("200") && PUZZLE_INSTRUCTIONS.blockfall.score.includes("200"), "help: both SCORE texts state 200");
  for (const k of ["ricochet", "blockfall"] as const) {
    const line = INTRO_SCORE[k];
    ok(line.length <= 90, `intro: ${k}'s score line is at most 90 characters (${line.length}: ${line})`);
  }
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL moon-blockzone-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS moon-blockzone-check: ${checks} checks (${FULL ? "full" : "quick"} depth)`);
