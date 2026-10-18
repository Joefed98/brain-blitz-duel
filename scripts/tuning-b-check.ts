/**
 * Tuning B (Oct 2026): the gameplay revisions and the display rules it adds.
 *
 *  1. Flightpath bullRev 4: new rounds are stamped 4; winds, drift and ring
 *     swaps are drawn exactly as before; three balloons on darts 3–10, one each
 *     of +1, +2, +3, seeded; each flies back and forth across the board itself
 *     (crossing its middle, clearing both edges, moving with the drift) at its
 *     value's speed; a dart through a balloon pops it, adds its value and still
 *     scores the ring it lands in; "BULLSEYE!" (and the other dart pops) fire
 *     once, on the landing of the dart that earned them; perfect runs reach 150
 *     through the server replay and every balloon can be popped.
 *  2. Breaker brkRev 4: stamped 4; a caught Fireball lasts 3.5 s (rev 3: 5 s).
 *  3. Rally rallyRev 4: stamped 4; the two +3 pads never overlap, before or
 *     after they move, each staying in its own half (rev 3 could overlap).
 *  4. Arena fill: Tuning B gave each arena a fill; since 15 Oct 2026 every gap on an
 *     arcade play screen is the screen edge's black and the per-game fills are gone.
 *  5. Fission: no FIRE button; the arena tap sends the same fire input.
 *
 * Older revisions' identity is proved elsewhere (arcade-score-bands-check,
 * arcade-batch3/5-check legacy digests, arcade-self-replay).
 *
 *   bun scripts/tuning-b-check.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { playFlightpath, playRally } from "./arcade-batch5-bots";
import {
  bullseyeBalloonV4At,
  bullseyeCheckpoint,
  bullseyeGameFor,
  bullseyeInit,
  bullseyeInitFor,
  bullseyeInitRev4,
  bullseyeRingAt,
  bullseyeRingValue,
  bullseyeRingValues,
  bullseyeScalePct,
  bullseyeTargetDx,
  bullseyeV4HalfSpan,
  bullseyeWinds,
  BULLSEYE_ARROWS,
  BULLSEYE_BALLOON_COUNT,
  BULLSEYE_BALLOON_R,
  BULLSEYE_CX,
  BULLSEYE_CY,
  BULLSEYE_FLIGHT_TICKS,
  BULLSEYE_OUTER_R,
  BULLSEYE_REV_BAND,
  BULLSEYE_REV_TUNED,
  BULLSEYE_V4_BALLOON_SPEED,
  type BullseyeBalloonV4,
  type BullseyeState,
} from "../src/lib/arcade/bullseye";
import { encodeBullseyeRun, replayBullseyeRun } from "../src/lib/duel/bullseye";
import { BULLSEYE_FX } from "../src/lib/arcade/arcadeFxGames.renderer";
import {
  breakerGameFor,
  BRK_FIRE_TICKS,
  BRK_FIRE_TICKS_V4,
  BRK_PADDLE_Y_FP,
  BRK_POWER_FIRE,
  BRK_REV_BAND,
  BRK_REV_TUNED,
  BRK_REV_TUNEF,
} from "../src/lib/arcade/breaker";
import {
  rallyCheckpoint,
  rallyGameFor,
  rallyTargetLeft,
  RALLY_REV_BAND,
  RALLY_REV_TUNED,
  RALLY_REV_TUNEF,
  RALLY_TARGET_W,
  RALLY_WORLD_W,
  type RallyState,
} from "../src/lib/arcade/rally";
import { generateBreaker, generateBullseye, generateRally } from "../src/lib/duel/arcade.server";
import { BURST_INPUT_FIRE, BURST_INPUT_RANGES } from "../src/lib/arcade/burst";
import { playRevOf } from "./scoring-targets-revs";

let checks = 0;
const ok = (value: unknown, message: string) => {
  assert.ok(value, message);
  checks++;
};
const section = (name: string) => console.log(`— ${name}`);
const SEEDS = (count: number, step = 104_729) => Array.from({ length: count }, (_, i) => 1 + i * step);

/* ============================ 1. Flightpath ============================ */
section("Flightpath bullRev 4 (value balloons across the board)");
{
  ok(playRevOf("bullseye", generateBullseye().bullRev) === BULLSEYE_REV_TUNED, "new rounds are stamped bullRev 4");
  const game = bullseyeGameFor(BULLSEYE_REV_TUNED);
  for (const seed of SEEDS(300, 7919)) {
    const winds = bullseyeWinds(seed);
    const s = bullseyeInitFor(seed, winds, BULLSEYE_REV_TUNED);
    const legacy = bullseyeInit(seed, winds);
    ok(JSON.stringify(s) === JSON.stringify(bullseyeInitFor(seed, winds, BULLSEYE_REV_TUNED)), `seed ${seed}: balloons are seeded`);
    ok(JSON.stringify({ ...s, rng: 0, rev: undefined, tune: undefined, balloons: undefined, band: undefined, acted: undefined }) === JSON.stringify({ ...legacy, rng: 0 }), `seed ${seed}: winds, drift and ring swaps drawn exactly as before`);
    ok(JSON.stringify(bullseyeInitRev4(seed, winds)) === JSON.stringify({ ...s, band: undefined, acted: undefined }), `seed ${seed}: band-stamped init`);
    const balloons = (s.balloons ?? []) as unknown as (BullseyeBalloonV4 | null)[];
    const darts = balloons.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
    ok(darts.length === BULLSEYE_BALLOON_COUNT && darts.every((i) => i >= 2), `seed ${seed}: three balloons on darts 3-10`);
    ok(JSON.stringify(darts.map((i) => balloons[i]!.value).sort()) === "[1,2,3]", `seed ${seed}: one each of +1, +2, +3`);
    for (const arrow of darts) {
      const b = balloons[arrow]!;
      const half = bullseyeV4HalfSpan(arrow);
      const radius = (BULLSEYE_OUTER_R * bullseyeScalePct(arrow)) / 100;
      let minX = Infinity, maxX = -Infinity, nearest = Infinity;
      const speed = BULLSEYE_V4_BALLOON_SPEED[b.value]!;
      const loop = Math.ceil((4 * half * 256) / speed) + 2;
      for (let t = 0; t <= loop; t++) {
        const at = bullseyeBalloonV4At(b, s, arrow, t);
        const dx = at.x - BULLSEYE_CX - bullseyeTargetDx(arrow, t, s.driftPhase, s.driftDir);
        const dy = at.y - BULLSEYE_CY;
        minX = Math.min(minX, dx);
        maxX = Math.max(maxX, dx);
        nearest = Math.min(nearest, Math.hypot(dx, dy));
        // Inside the board's height band: never flies round the board.
        ok(Math.abs(dy) <= radius, `seed ${seed} dart ${arrow + 1}: balloon stays across the board (dy ${dy})`);
        if (t > 0) {
          // Speed by value: horizontal travel in board coordinates (drift taken out) per tick.
          const before = bullseyeBalloonV4At(b, s, arrow, t - 1);
          const step = Math.abs((at.x - bullseyeTargetDx(arrow, t, s.driftPhase, s.driftDir)) - (before.x - bullseyeTargetDx(arrow, t - 1, s.driftPhase, s.driftDir)));
          ok(step <= Math.ceil(speed / 256), `seed ${seed}: +${b.value} balloon moves at most ${Math.ceil(speed / 256)} px a tick (${step})`);
        }
      }
      ok(minX <= -radius - BULLSEYE_BALLOON_R && maxX >= radius + BULLSEYE_BALLOON_R, `seed ${seed} dart ${arrow + 1}: balloon clears both edges of the board (${minX}..${maxX})`);
      ok(nearest <= radius * 0.7, `seed ${seed} dart ${arrow + 1}: balloon crosses the board's middle (nearest ${nearest.toFixed(1)} px)`);
    }
  }
  ok(BULLSEYE_V4_BALLOON_SPEED[1]! < BULLSEYE_V4_BALLOON_SPEED[2]! && BULLSEYE_V4_BALLOON_SPEED[2]! < BULLSEYE_V4_BALLOON_SPEED[3]!, "+1 slowest, +2 faster, +3 fastest");

  // Pop and carry on: a dart thrown through the balloon adds its value to the ring it lands in.
  let pops = 0;
  for (const seed of SEEDS(40, 15_485_863)) {
    const winds = bullseyeWinds(seed);
    const run = playFlightpath(game, seed, bullseyeCheckpoint, { balloons: true, init: bullseyeInitFor(seed, winds, BULLSEYE_REV_TUNED) });
    const s = run.state;
    for (const hit of s.hits) {
      const values = bullseyeRingValues(s, hit.arrow);
      const ring = bullseyeRingAt(hit.x - hit.tdx, hit.y, bullseyeScalePct(hit.arrow));
      ok(hit.ring === ring, `seed ${seed}: the ring is scored even when a balloon pops`);
      const ringValue = hit.bull === 1 ? 12 : bullseyeRingValue(ring, values);
      ok(hit.value === ringValue + (hit.bal ?? 0), `seed ${seed} dart ${hit.arrow + 1}: ${hit.value} = ring ${ringValue} + balloon ${hit.bal ?? 0}`);
      if (hit.pop === 1) {
        pops++;
        const balloon = (s.balloons?.[hit.arrow] ?? null) as unknown as BullseyeBalloonV4 | null;
        ok(balloon !== null && hit.bal === balloon.value, `seed ${seed}: the pop scores the balloon's own value`);
      }
    }
    const score = game.score(s);
    const raw = encodeBullseyeRun({ seed, claimedScore: score, events: run.events, endTick: s.tick, checkpoints: run.checkpoints as never });
    const replay = replayBullseyeRun(seed, raw, winds, BULLSEYE_REV_TUNED);
    ok(!replay.flagged && replay.score === score, `seed ${seed}: server replay agrees (${replay.score})`);
    ok(replay.pops === BULLSEYE_BALLOON_COUNT && replay.balloonPoints === 6, `seed ${seed}: every balloon can be popped (${replay.pops}, +${replay.balloonPoints})`);
    ok(replay.tuned === 1, `seed ${seed}: replay reports bullRev 4`);
    // A perfect board run (inner bulls and tens, balloons ignored) still reaches 150.
    const board = playFlightpath(game, seed, bullseyeCheckpoint, { balloons: false, init: bullseyeInitFor(seed, winds, BULLSEYE_REV_TUNED) });
    const boardScore = game.score(board.state);
    const boardReplay = replayBullseyeRun(seed, encodeBullseyeRun({ seed, claimedScore: boardScore, events: board.events, endTick: board.state.tick, checkpoints: board.checkpoints as never }), winds, BULLSEYE_REV_TUNED);
    ok(!boardReplay.flagged && boardReplay.score === 150, `seed ${seed}: a perfect run scores 150 through the server replay (${boardReplay.score}, total ${boardReplay.total})`);
  }
  console.log(`  40 seeds: ${pops} balloon pops each scored with the ring underneath; perfect runs reach 150 through the server replay`);

  // A dart that misses the balloon scores exactly the band revision's ring value (inner bull 12).
  for (const seed of SEEDS(20, 31_337)) {
    const winds = bullseyeWinds(seed);
    const band = bullseyeGameFor(BULLSEYE_REV_BAND);
    const board = playFlightpath(band, seed, bullseyeCheckpoint, { balloons: false, init: bullseyeInitFor(seed, winds, BULLSEYE_REV_BAND) });
    let a: BullseyeState = bullseyeInitFor(seed, winds, BULLSEYE_REV_TUNED);
    const byTick = new Map(board.events.map((e) => [e.t, e]));
    while (!game.isOver(a)) a = game.step(a, byTick.get(a.tick + 1) ?? null);
    a.hits.forEach((hit, i) => {
      const old = board.state.hits[i]!;
      ok(hit.x === old.x && hit.y === old.y && hit.ring === old.ring, `seed ${seed}: same throw lands in the same place`);
      if (hit.pop !== 1) ok(hit.value === old.value, `seed ${seed}: without a balloon the dart scores as on bullRev 3`);
    });
  }

  // "BULLSEYE!" and the other dart pops: every counter only rises, and only on a landing.
  const events = BULLSEYE_FX.events;
  for (const seed of SEEDS(30, 999_331)) {
    const winds = bullseyeWinds(seed);
    const run = playFlightpath(game, seed, bullseyeCheckpoint, { balloons: seed % 2 === 0, init: bullseyeInitFor(seed, winds, BULLSEYE_REV_TUNED) });
    let s: BullseyeState = bullseyeInitFor(seed, winds, BULLSEYE_REV_TUNED);
    const byTick = new Map(run.events.map((e) => [e.t, e]));
    let before = events.map((e) => e.count(s));
    let fired = 0;
    let bulls = 0;
    while (!game.isOver(s)) {
      const prev = s;
      s = game.step(s, byTick.get(s.tick + 1) ?? null);
      const after = events.map((e) => e.count(s));
      const landed = prev.flightTick > 0 && s.flightTick === 0;
      events.forEach((event, i) => {
        if (event.kind === "combo" || event.kind === "final") return;
        ok(after[i]! >= before[i]!, `seed ${seed} tick ${s.tick}: ${event.kind} counter fell (${before[i]} → ${after[i]})`);
        if (after[i]! > before[i]!) {
          ok(landed, `seed ${seed} tick ${s.tick}: a ${event.kind} pop fired off a landing`);
          ok(after[i]! - before[i]! === 1, `seed ${seed}: one landing, one pop`);
        }
      });
      if (after[0]! > before[0]!) {
        fired++;
        const hit = s.hits.at(-1)!;
        ok(hit.ring === 0 && hit.value - (hit.bal ?? 0) >= 10, `seed ${seed} tick ${s.tick}: "BULLSEYE!" only for a dart in the bullseye`);
      }
      if (landed) {
        const hit = s.hits.at(-1)!;
        if (hit.ring === 0 && hit.value - (hit.bal ?? 0) >= 10) bulls++;
      }
      before = after;
    }
    ok(fired === bulls, `seed ${seed}: "BULLSEYE!" fired ${fired} times for ${bulls} bullseyes`);
  }
}

/* ============================== 2. Breaker ============================== */
section("Breaker brkRev 4 (3.5 s Fireball)");
{
  // Tuning F (Oct 2026) moved rooms on to brkRev 5 (2.5 s Fireball); arcade-tuning-f-check covers it.
  // Taller worlds batch 1 (16 Oct 2026) moved rooms on to brkRev 6 (the taller court); arcade-tuning-g1-check covers it.
  ok(playRevOf("breaker", generateBreaker().brkRev) === BRK_REV_TUNEF + 1, "new rounds are stamped brkRev 6 (brkRev 5 rules on the taller court)");
  ok(BRK_FIRE_TICKS_V4 === 210 && BRK_FIRE_TICKS === 300, "Fireball 3.5 s (210 ticks), was 5 s");
  for (const [rev, want] of [[BRK_REV_TUNED, BRK_FIRE_TICKS_V4], [BRK_REV_BAND, BRK_FIRE_TICKS]] as const) {
    const game = breakerGameFor(rev);
    const s = game.init(4242);
    const lit = game.step({ ...s, capsules: [{ x: s.paddleX * 256, y: BRK_PADDLE_Y_FP - 512, kind: BRK_POWER_FIRE }] }, null);
    ok(lit.fire === want && lit.fireballs === 1, `brkRev ${rev}: a caught Fireball burns for ${want} ticks (${lit.fire})`);
  }
  const a = breakerGameFor(BRK_REV_TUNED).init(77);
  const b = breakerGameFor(BRK_REV_BAND).init(77);
  ok(JSON.stringify({ ...a, tune: undefined }) === JSON.stringify(b), "same wall and draws as brkRev 3");
}

/* =============================== 3. Rally =============================== */
section("Rally rallyRev 4 (pads never overlap)");
{
  // Tuning F (Oct 2026) moved rooms on to rallyRev 5 (a second bumper); arcade-tuning-f-check covers it.
  ok(playRevOf("rally", generateRally().rallyRev) === RALLY_REV_TUNEF + 1, "new rounds are stamped rallyRev 6 (rallyRev 5 pads and bumpers on the taller court)");
  const half = Math.trunc(RALLY_WORLD_W / 2);
  const overlap = (s: RallyState) => {
    const [p, q] = (s.live ?? []).map((spot) => rallyTargetLeft(s.spots ?? [], spot));
    return p !== undefined && q !== undefined && p < q + RALLY_TARGET_W && q < p + RALLY_TARGET_W;
  };
  let strikes = 0;
  let oldOverlaps = 0;
  for (const seed of SEEDS(40, 65_537)) {
    for (const [rev, tuned] of [[RALLY_REV_TUNED, true], [RALLY_REV_BAND, false]] as const) {
      const game = rallyGameFor(rev);
      const run = playRally(game, seed, rallyCheckpoint, 0.4);
      let s = game.init(seed);
      const byTick = new Map(run.events.map((e) => [e.t, e]));
      let seen = false;
      while (!game.isOver(s)) {
        s = game.step(s, byTick.get(s.tick + 1) ?? null);
        if (!tuned) {
          if (overlap(s)) seen = true;
          continue;
        }
        ok(!overlap(s), `seed ${seed} tick ${s.tick}: the two +3 pads overlap`);
        const [left, right] = (s.live ?? []).map((spot) => rallyTargetLeft(s.spots ?? [], spot));
        ok(left! + RALLY_TARGET_W <= half && right! >= half, `seed ${seed} tick ${s.tick}: each pad stays in its own half`);
      }
      if (tuned) strikes += s.targetHits ?? 0;
      else if (seen) oldOverlaps++;
    }
  }
  console.log(`  40 seeds: ${strikes} pad strikes, no overlap on rallyRev 4 (rallyRev 3 overlapped on ${oldOverlaps} seeds)`);
  ok(strikes > 40, "the bot strikes pads, so pads do move");
}

/* ============================ 4. Arena fill ============================ */
section("Arena fill below the arena");
{
  // Tuning B gave each arena a fill (its art's bottom-edge colour, or none for the page colour).
  // Superseded 15 Oct 2026 (arcade play screen, display only): every gap on an arcade play
  // screen, the space below the world included, is the screen edge's black, so the per-game
  // fills (arenaFill.renderer.ts) are gone; arcade-play-check and bottom-clearance-check prove the black.
  const css = readFileSync("src/styles.css", "utf8");
  ok(!existsSync("src/lib/arcade/arenaFill.renderer.ts"), "no per-game arena fill table");
  ok(!/--arena-fill/.test(css), "no --arena-fill in the arena slot");
  ok(/\[data-arena-slot\]::after \{[^}]*background: var\(--screen-edge\);/.test(css), "the space below every arena is the screen edge's black");
}

/* ============================== 5. Fission ============================== */
section("Fission controls");
{
  const source = readFileSync("src/puzzles/burst.tsx", "utf8");
  ok(!/aria-label="Fire"/.test(source) && !/content-\['FIRE'\]/.test(source), "no FIRE button");
  ok(/pointer=\{\(kind\) => kind === "down" \? fire\(\) : null\}/.test(source), "a tap on the arena fires");
  ok(/k: BURST_INPUT_FIRE, a: 0, b: fireFlip\.current, c: 0/.test(source), "the arena tap sends the same fire input as the old button");
  ok(JSON.stringify(BURST_INPUT_RANGES.map((r) => r.k)) === JSON.stringify([7, BURST_INPUT_FIRE]), "input ranges unchanged (move, fire)");
  ok((source.match(/className="h-\[76px\] w-full/g) ?? []).length === 2, "two 76 px arrows (touch targets well above 44 px)");
}

console.log(`Tuning B: ${checks} checks passed`);
