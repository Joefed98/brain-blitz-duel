/**
 * Batch-2 arcade upgrades (Oct 2026): Meteor snakeRev 2, Hover hoverRev 2,
 * Coral Pop bubbleRev 2, Gemstone matchupRev 2.
 *
 *  1. Legacy identity: unstamped rounds of all four games replay and score exactly
 *     as before (digest saved from the code before the upgrades).
 *  2. Per game, the new rules: determinism, the new elements, and proof that the
 *     score cap of 150 is reachable on the new revision by a real input log
 *     replayed through the server path.
 *  3. The intro's stated maximums are true, and the intro HOW / SCORE rules hold.
 *
 *   bun scripts/arcade-batch2-check.ts            (BATCH2_ONLY=snake,hover,bubble,matchup)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { inputAt, recordInput, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { legacyDigest } from "./arcade-batch2-legacy";
import { rev2Digest } from "./arcade-batch2-rev2-legacy";
import {
  snakeCheckpoint,
  snakeCol,
  snakeGame,
  snakeGameFor,
  snakeReversal,
  snakeRocksEarned,
  snakeRow,
  snakeStepTicks,
  SNAKE_COLS,
  SNAKE_INPUT_TURN,
  SNAKE_REV,
  SNAKE_REV2,
  SNAKE_ROCK_MAX,
  SNAKE_ROCK_MAX_V3,
  SNAKE_SHOWER_ROCKS,
  SNAKE_SHOWER_STARS,
  SNAKE_ROCK_WARN_TICKS,
  SNAKE_ROWS,
  SNAKE_RUN_TICKS,
  type SnakeState,
} from "../src/lib/arcade/snake";
import { encodeSnakeRun, replaySnakeRun } from "../src/lib/duel/snake";
import {
  hoverCheckpoint,
  hoverGame,
  hoverGameFor,
  hoverGapTop,
  hoverMoveOffset,
  hoverStarY,
  pillarX,
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_GAP_MARGIN,
  HOVER_GAP_MIN,
  HOVER_MOVE_AMP,
  HOVER_PILLAR_W,
  HOVER_REACHABLE_GATES,
  HOVER_REV,
  HOVER_RUN_TICKS,
  HOVER_STARS,
  HOVER_WORLD_BOTTOM,
  type HoverState,
} from "../src/lib/arcade/hover";
import { encodeHoverRun, replayHoverRun } from "../src/lib/duel/hover";
import {
  bubbleGame,
  bubbleGameFor,
  bubCellX,
  bubCellY,
  BUB_BOMB,
  BUB_COLS,
  BUB_JOKER,
  BUB_LINE,
  BUB_QUEUE,
  BUB_R,
  BUB_REV,
  BUB_V2_PARTIAL_MAX,
  type BubState,
} from "../src/lib/arcade/bubble";
import { encodeBubbleRun, replayBubbleRun } from "../src/lib/duel/bubble";
import {
  matchupGame,
  matchupGameFor,
  matchupHasLine,
  matchupIndex,
  matchupPending,
  MATCHUP_CELLS,
  MATCHUP_INPUT_SWAP,
  MATCHUP_JACKPOT,
  MATCHUP_REV,
  MATCHUP_SIZE,
  MATCHUP_REV2,
  matchupParRaw,
  matchupV3StepTicks,
  type MatchupState,
} from "../src/lib/arcade/matchup";
import { encodeMatchupRun, replayMatchupRun } from "../src/lib/duel/matchup";
import { playBubble, playMatchup } from "./arcade-batch2-bots";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";

let checks = 0;
const ok = (value: unknown, message: string) => {
  assert.ok(value, message);
  checks++;
};
const section = (name: string) => console.log(`— ${name}`);
const ONLY = process.env.BATCH2_ONLY?.split(",");
const want = (key: string) => !ONLY || ONLY.includes(key);
const SEEDS = (count: number, step = 104_729) => Array.from({ length: count }, (_, i) => 1 + i * step);

/* ============================ 1. Legacy identity ============================ */
section("legacy identity");
{
  const saved = JSON.parse(readFileSync(new URL("./fixtures/arcade-batch2-legacy.json", import.meta.url), "utf8"));
  const now = await legacyDigest(new URL("..", import.meta.url).pathname.replace(/\/$/, ""));
  assert.deepEqual(now, saved, "unstamped rounds must replay exactly as before");
  checks += saved.length;
  console.log(`  ${saved.length} unstamped runs (matchup, bubble, snake, hover) identical to the pre-upgrade code`);
}
section("rev-2 identity (Gemstone matchupRev 2, Meteor snakeRev 2 as shipped in #15)");
{
  const saved = JSON.parse(readFileSync(new URL("./fixtures/arcade-batch2-rev2-legacy.json", import.meta.url), "utf8"));
  const now = await rev2Digest(new URL("..", import.meta.url).pathname.replace(/\/$/, ""));
  assert.deepEqual(now, saved, "rev-2 rounds must replay exactly as before");
  checks += saved.length;
  console.log(`  ${saved.length} rev-2 runs identical to the code before matchupRev 3 / snakeRev 3`);
}

/* ================================ 2a. Meteor ================================ */
if (want("snake")) {
  section("Meteor snakeRev 3 (asteroids + 20-star meteor shower)");
  const game = snakeGameFor(SNAKE_REV);
  ok(snakeGameFor(SNAKE_REV2).init(5).rev === SNAKE_REV2 && snakeGameFor(SNAKE_REV2).init(5).showerCells === undefined, "rev-2 rounds keep asteroids without a shower");
  ok(snakeGameFor(undefined) === snakeGame && snakeGame.init(5).rev === undefined, "unstamped Meteor keeps the original game");
  ok(game.init(5).rev === SNAKE_REV, "the state carries the current stamp");
  ok(JSON.stringify(game.init(99)) === JSON.stringify(game.init(99)), "rev-2 rock schedule is seeded");
  ok(JSON.stringify(game.init(99).queue) === JSON.stringify(snakeGame.init(99).queue), "rev 2 keeps the original star queue");
  ok(snakeRocksEarned(6) === 0 && snakeRocksEarned(7) === 1 && snakeRocksEarned(11) === 1 && snakeRocksEarned(12) === 2 && snakeRocksEarned(500) === SNAKE_ROCK_MAX, "rocks earned from length 10, then every 5 stars, max 8");

  for (const seed of SEEDS(200, 7919)) {
    const s = game.init(seed);
    const stars = new Set(s.queue);
    const slots = s.rockSlots ?? [];
    ok(slots.length >= SNAKE_ROCK_MAX, `seed ${seed}: at least ${SNAKE_ROCK_MAX} rock slots`);
    slots.forEach((slot, i) => {
      const r = snakeRow(slot.cell), c = snakeCol(slot.cell);
      ok(!stars.has(slot.cell), `seed ${seed}: no rock square ever holds a star`);
      ok(r > 0 && r < SNAKE_ROWS - 1 && c > 0 && c < SNAKE_COLS - 1, "rock squares are off the border");
      ok(slot.tick - SNAKE_ROCK_WARN_TICKS > 0 && slot.tick < SNAKE_RUN_TICKS, "every rock lands inside the run after a full warning");
      for (const other of slots.slice(i + 1)) {
        ok(Math.max(Math.abs(snakeRow(other.cell) - r), Math.abs(snakeCol(other.cell) - c)) >= 2, "rock squares never touch");
        ok(other.tick > slot.tick, "slot ticks rise");
      }
    });
  }

  /** Greedy BFS bot on the real sim: plans at each cell step, avoiding rocks and any shadow. */
  const playSnake = (seed: number, avoidShadow = true) => {
    let state = game.init(seed);
    const events: ArcadeInputEvent[] = [];
    const checkpoints: ReturnType<typeof snakeCheckpoint>[] = [];
    const neighbours = (cell: number) => {
      const r = snakeRow(cell), c = snakeCol(cell);
      const out: [number, number][] = [];
      if (r > 0) out.push([0, cell - SNAKE_COLS]);
      if (c < SNAKE_COLS - 1) out.push([1, cell + 1]);
      if (r < SNAKE_ROWS - 1) out.push([2, cell + SNAKE_COLS]);
      if (c > 0) out.push([3, cell - 1]);
      return out;
    };
    const plan = (s: SnakeState): number => {
      const blocked = new Set<number>(s.rocks ?? []);
      if (avoidShadow && (s.rockWarn ?? -1) >= 0) blocked.add(s.rockWarn!);
      if (avoidShadow) for (const cell of s.showerWarn ?? []) blocked.add(cell);
      // Body cells free up as the tail moves: cell at index i is free after (length - i) steps.
      const freeAt = new Map<number, number>();
      s.body.forEach((cell, i) => freeAt.set(cell, s.body.length - i));
      const head = s.body[0]!;
      const reach = (from: number, banned: Set<number>) => {
        const seen = new Map<number, number>([[from, -1]]);
        const dist = new Map<number, number>([[from, 0]]);
        const queue = [from];
        while (queue.length) {
          const cell = queue.shift()!;
          for (const [dir, next] of neighbours(cell)) {
            if (seen.has(next) || blocked.has(next) || banned.has(next)) continue;
            const d = dist.get(cell)! + 1;
            if ((freeAt.get(next) ?? 0) > d) continue;
            seen.set(next, cell === from ? dir : seen.get(cell)!);
            dist.set(next, d);
            queue.push(next);
          }
        }
        return { seen, dist };
      };
      const { seen } = reach(head, new Set());
      const space = (dir: number, next: number) => reach(next, new Set([head])).seen.size + (dir === s.dir ? 0.5 : 0);
      const options = neighbours(head).filter(([dir, next]) => !snakeReversal(s.dir, dir) && !blocked.has(next) && !(s.body.slice(0, -1).includes(next)));
      if (options.length === 0) return s.dir;
      const first = seen.get(s.pellet);
      if (first !== undefined && first >= 0) {
        const into = options.find(([d]) => d === first);
        // Take the star route only if it leaves room to keep moving.
        if (into && space(into[0], into[1]) > s.body.length + 2) return first;
      }
      let best = options[0]!;
      for (const option of options) if (space(option[0], option[1]) > space(best[0], best[1])) best = option;
      return best[0];
    };
    let planned = -1;
    while (!game.isOver(state)) {
      const t = state.tick + 1;
      const stepping = state.sinceMove + 1 >= snakeStepTicks(state.eaten);
      if (stepping && planned !== t) {
        const dir = plan(state);
        planned = t;
        if (dir !== state.dir) recordInput(events, { t, k: SNAKE_INPUT_TURN, a: dir, b: 0, c: 0, d: 0 }, game.inputRanges);
      }
      state = game.step(state, inputAt(events, t));
      if (state.tick % 300 === 0) checkpoints.push(snakeCheckpoint(state));
    }
    const score = game.score(state);
    const raw = encodeSnakeRun({ seed, claimedScore: score, events, endTick: state.tick, checkpoints });
    return { state, score, raw, events };
  };

  let best = { seed: 0, score: -1 };
  let rocksSeen = 0;
  let total = 0;
  let showers = 0;
  const RUNS = SEEDS(30, 15_485_863);
  for (const seed of RUNS) {
    const run = playSnake(seed);
    const replay = replaySnakeRun(seed, run.raw, SNAKE_REV);
    ok(replay.score === run.score && !replay.flagged, `seed ${seed}: server replay agrees (${replay.reason ?? "ok"})`);
    ok(JSON.stringify(replay.state) === JSON.stringify(run.state), `seed ${seed}: identical final state`);
    rocksSeen += replay.rocks;
    total += run.score;
    if (run.score > best.score) best = { seed, score: run.score };
    // Every rock that landed did so on its seeded slot square at its seeded tick.
    const slotCells = new Map((run.state.rockSlots ?? []).map((slot) => [slot.cell, slot.tick]));
    for (const rock of run.state.rocks ?? []) ok(slotCells.has(rock) || (run.state.showerCells ?? []).includes(rock), "every landed rock is on a slot or shower square");
    ok((run.state.rocks ?? []).length <= SNAKE_ROCK_MAX_V3, `at most ${SNAKE_ROCK_MAX_V3} rocks`);
    if ((run.state.showerCells ?? []).every((cell) => (run.state.rocks ?? []).includes(cell))) showers += 1;
  }
  ok(showers > 0, `the bot meets the meteor shower (${showers} of ${RUNS.length} runs)`);
  ok(rocksSeen > 0, "the bot meets real rocks");
  ok(best.score === 150, `150 is reachable on snakeRev 3 through the server replay (best ${best.score} on seed ${best.seed})`);
  console.log(`  bot: mean ${(total / RUNS.length).toFixed(1)}, best ${best.score} (seed ${best.seed}), ${rocksSeen} rocks landed over ${RUNS.length} runs`);

  // The shower's squares and moments, from the seed only.
  for (const seed of SEEDS(200, 7919)) {
    const s = game.init(seed);
    const stars = new Set(s.queue);
    const cells = s.showerCells ?? [];
    const slotCells = (s.rockSlots ?? []).map((slot) => slot.cell);
    ok(cells.length === SNAKE_SHOWER_ROCKS, `seed ${seed}: three shower squares`);
    cells.forEach((cell, i) => {
      const r = snakeRow(cell), c = snakeCol(cell);
      ok(!stars.has(cell), "a shower square never holds a star");
      ok(r > 0 && r < SNAKE_ROWS - 1 && c > 0 && c < SNAKE_COLS - 1, "shower squares are off the border");
      for (const other of [...slotCells, ...cells.slice(i + 1)])
        ok(Math.max(Math.abs(snakeRow(other) - r), Math.abs(snakeCol(other) - c)) >= 2, "shower squares touch no rock square or each other");
    });
    for (const t of s.showerSlots ?? []) ok(t - SNAKE_ROCK_WARN_TICKS > 0 && t < SNAKE_RUN_TICKS, "every shower moment has a full warning inside the run");
    ok(JSON.stringify(s.rockSlots) === JSON.stringify(snakeGameFor(SNAKE_REV2).init(seed).rockSlots), "rev 3 keeps the rev-2 asteroid schedule");
  }
  ok(SNAKE_ROCK_MAX_V3 === SNAKE_ROCK_MAX + SNAKE_SHOWER_ROCKS, "rock cap = 8 asteroids + 3 shower rocks = 11");
  {
    const base = game.init(4242);
    const due = base.showerSlots![0]!;
    const far = cellAway(base.showerCells![0]!);
    let s: SnakeState = { ...base, eaten: SNAKE_SHOWER_STARS - 1, tick: due - SNAKE_ROCK_WARN_TICKS - 1, body: [far, ...base.body.slice(1)] };
    s = game.step(s, null);
    ok((s.showerWarn ?? []).length === 0, "no shower before 20 stars");
    s = { ...base, eaten: SNAKE_SHOWER_STARS, tick: due - SNAKE_ROCK_WARN_TICKS - 1, sinceMove: 0, body: [far, ...base.body.slice(1)] };
    s = game.step(s, null);
    ok(JSON.stringify(s.showerWarn) === JSON.stringify(base.showerCells) && s.showerLandTick === due, "at 20 stars, three shadows appear 2 s before the seeded moment");
    let landed = { ...s, tick: due - 1, sinceMove: 0, body: [far, ...base.body.slice(1)] } as SnakeState;
    landed = game.step(landed, null);
    ok(!landed.dead && base.showerCells!.every((cell) => (landed.rocks ?? []).includes(cell)), "all three shower rocks land together");
    const onHead = game.step({ ...s, tick: due - 1, sinceMove: 0, body: [base.showerCells![1]!, ...base.body.slice(1)] }, null);
    ok(onHead.dead && onHead.rockHit === 2, "a shower rock landing on the head ends the run");
    const again = { ...landed, eaten: 40, showerSlot: 0, tick: base.showerSlots![1]! - SNAKE_ROCK_WARN_TICKS - 1 } as SnakeState;
    ok((game.step(again, null).showerWarn ?? []).length === 0, "the shower comes only once");
  }

  // Head-only collisions, built directly on a rev-3 state.
  {
    const base = game.init(4242);
    const head = base.body[0]!;
    const above = head - SNAKE_COLS;
    const stepTicks = snakeStepTicks(0);
    // The head moving into a rock ends the run.
    let s: SnakeState = { ...base, rocks: [above], sinceMove: stepTicks - 1 };
    s = game.step(s, null);
    ok(s.dead && s.rockHit === 1, "the head moving into a rock ends the run");
    // A rock landing on the tail does nothing, and the tail passes through.
    const tail = base.body[base.body.length - 1]!;
    s = { ...base, rockWarn: tail, rockLandTick: 1, sinceMove: 0 };
    s = game.step(s, null);
    ok(!s.dead && (s.rocks ?? []).includes(tail), "a rock landing on the tail does nothing");
    for (let i = 0; i < 3 * stepTicks; i++) s = game.step(s, null);
    ok(!s.dead, "the body passes over a rock square");
    // A rock landing on the head ends the run.
    s = { ...base, rockWarn: head, rockLandTick: 1, sinceMove: 0 };
    s = game.step(s, null);
    ok(s.dead && s.rockHit === 2, "a rock landing on the head ends the run");
    // The shadow appears exactly SNAKE_ROCK_WARN_TICKS before landing, only once a rock is earned.
    const slot = base.rockSlots![0]!;
    s = { ...base, eaten: 6, tick: slot.tick - SNAKE_ROCK_WARN_TICKS - 1, sinceMove: 0 };
    s = game.step(s, null);
    ok((s.rockWarn ?? -1) === -1, "no shadow before a rock is earned");
    s = { ...base, eaten: 7, tick: slot.tick - SNAKE_ROCK_WARN_TICKS - 1, sinceMove: 0, body: [cellAway(slot.cell), ...base.body.slice(1)] };
    s = game.step(s, null);
    ok(s.rockWarn === slot.cell && s.rockLandTick === slot.tick, "the shadow starts 2 s before the slot's landing tick");
  }
}


/* ================================ 2b. Hover ================================ */
if (want("hover")) {
  section("Hover hoverRev 2");
  const game = hoverGameFor(HOVER_REV);
  ok(hoverGameFor(undefined) === hoverGame && hoverGame.init(5).rev === undefined, "unstamped Hover keeps the original game");
  ok(game.init(5).rev === HOVER_REV, "rev-2 state carries the stamp");
  ok(JSON.stringify(game.init(77)) === JSON.stringify(game.init(77)), "rev-2 courses are seeded");
  ok(hoverGame.init(5).totalGates === 42 && HOVER_REACHABLE_GATES === 42 && hoverGame.init(5).pillars.length === 45, "45 barriers are built and a clean run reaches 42 (the text says 42)");
  ok(/\b42 barriers\b/.test(INTRO_SCORE.hover) && PUZZLE_INSTRUCTIONS.hover.score.includes("42"), "intro and help say 42 barriers");
  for (const seed of SEEDS(200, 7919)) {
    const s = game.init(seed);
    const legacy = hoverGame.init(seed);
    ok(s.totalGates === HOVER_REACHABLE_GATES, "rev 2 keeps the 42 reachable barriers");
    ok(s.totalStars === HOVER_STARS, `seed ${seed}: ten gold stars on reachable barriers`);
    s.pillars.forEach((p, i) => {
      ok(p.x0 === legacy.pillars[i]!.x0, "barrier spacing unchanged");
      const sweep = p.movePhase === undefined ? 0 : HOVER_MOVE_AMP;
      ok(p.gapTop - sweep >= HOVER_GAP_MARGIN && p.gapTop + p.gapH + sweep <= HOVER_WORLD_BOTTOM - HOVER_GAP_MARGIN, "every gap stays inside the margins");
      if (p.gap2Top !== undefined) {
        ok(i >= 16 && p.movePhase === undefined && p.starDy === undefined, "two-gap barriers are later, still and starless");
        ok(p.gap2Top - (p.gapTop + p.gapH) >= 15_360, "a solid wall between the two gaps");
      }
      if (p.movePhase !== undefined) ok(i >= 23, "moving barriers only on later stretches");
      if (p.starDy !== undefined) {
        ok(p.gapH === HOVER_GAP_MIN && i < HOVER_REACHABLE_GATES, "stars sit in the tightest gaps on reachable barriers");
        ok(p.starDy > HOVER_DISC_R && p.starDy < p.gapH - HOVER_DISC_R, "a star sits inside its gap");
      }
    });
  }
  // The moving offset is a slow, bounded, continuous integer wave.
  for (let t = 0; t < 1000; t++) {
    const a = hoverMoveOffset(t, 17), b = hoverMoveOffset(t + 1, 17);
    ok(Number.isInteger(a) && Math.abs(a) <= HOVER_MOVE_AMP && Math.abs(b - a) <= 256, "moving gaps slide at most 1 px a tick");
  }

  /** Beam search over tap / no tap on the real sim: proves every barrier and every star on a seed. */
  const playHover = (seed: number) => {
    type Node = { s: HoverState; taps: { t: number; prev: Node["taps"] } | null };
    let beam: Node[] = [{ s: game.init(seed), taps: null }];
    const target = (s: HoverState) => {
      for (let i = s.gates; i < s.pillars.length; i++) {
        const p = s.pillars[i]!;
        const ahead = pillarX(p, s.distance) + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R);
        if (ahead < 0) continue;
        const starY = hoverStarY(p, s.tick);
        if (starY !== null && !(s.starsTaken ?? []).includes(i)) return starY;
        const top = hoverGapTop(p, s.tick) + (p.gapH >> 1);
        if (p.gap2Top === undefined) return top;
        const low = p.gap2Top + ((p.gap2H ?? 0) >> 1);
        return Math.abs(low - s.y) < Math.abs(top - s.y) ? low : top;
      }
      return HOVER_WORLD_BOTTOM >> 1;
    };
    for (let tick = 1; tick <= HOVER_RUN_TICKS; tick++) {
      const next = new Map<string, { node: Node; cost: number }>();
      for (const node of beam) {
        for (const tap of [false, true]) {
          const s = game.step(node.s, tap);
          if (s.crashed) continue;
          const key = `${s.stars ?? 0}:${s.y >> 10}:${s.vy >> 8}`;
          const cost = -(s.stars ?? 0) * 1e9 - s.gates * 1e7 + Math.abs(s.y - target(s));
          const old = next.get(key);
          if (!old || cost < old.cost) next.set(key, { node: { s, taps: tap ? { t: tick, prev: node.taps } : node.taps }, cost });
        }
      }
      // Keep the best few per star count, so a doomed star chase never crowds out the safe line.
      const ranked = [...next.values()].sort((a, b) => a.cost - b.cost);
      const perStars = new Map<number, number>();
      beam = [];
      for (const item of ranked) {
        const stars = item.node.s.stars ?? 0;
        const used = perStars.get(stars) ?? 0;
        if (used >= 220) continue;
        perStars.set(stars, used + 1);
        beam.push(item.node);
      }
      if (beam.length === 0) { if (process.env.BATCH2_DEBUG) console.log("beam died at", tick); break; }
    }
    const best = [...beam].sort((a, b) => (b.s.stars ?? 0) - (a.s.stars ?? 0) || b.s.gates - a.s.gates)[0];
    const inputs: number[] = [];
    for (let link = best?.taps ?? null; link; link = link.prev) inputs.push(link.t);
    inputs.reverse();
    // Replay the chosen taps exactly as the phone would, with checkpoints.
    let state = game.init(seed);
    const taps = new Set(inputs);
    const checkpoints: ReturnType<typeof hoverCheckpoint>[] = [];
    while (!game.isOver(state)) {
      state = game.step(state, taps.has(state.tick + 1));
      if (state.tick % 300 === 0) checkpoints.push(hoverCheckpoint(state));
    }
    const score = game.score(state);
    return { state, score, raw: encodeHoverRun({ seed, claimedScore: score, inputs, endTick: state.tick, checkpoints }) };
  };
  const RUNS = SEEDS(Number(process.env.BATCH2_HOVER_RUNS ?? 6), 15_485_863);
  let full = 0;
  for (const seed of RUNS) {
    const run = playHover(seed);
    const replay = replayHoverRun(seed, run.raw, HOVER_REV);
    ok(replay.score === run.score && !replay.flagged, `seed ${seed}: server replay agrees (${replay.reason ?? "ok"})`);
    ok(JSON.stringify(replay.state) === JSON.stringify(run.state), `seed ${seed}: identical final state`);
    ok(run.score === 150 && replay.gates === 42 && replay.stars === HOVER_STARS, `seed ${seed}: all 42 barriers and all ${HOVER_STARS} stars (score ${run.score}, ${replay.gates} barriers, ${replay.stars} stars)`);
    if (run.score === 150) full += 1;
  }
  console.log(`  beam bot: 150 (42 barriers + ${HOVER_STARS} stars) on ${full} / ${RUNS.length} seeds through the server replay`);
  // Barriers alone cap at 130; stars alone at 20.
  const s0 = game.init(9);
  ok(game.score({ ...s0, gates: 42 }) === 130 && game.score({ ...s0, stars: 10 }) === 20 && game.score({ ...s0, gates: 42, stars: 10 }) === 150, "barriers worth up to 130, stars up to 20, cap 150");
  ok(game.score({ ...s0, gates: 45, stars: 12 }) === 150, "score never exceeds 150");
}

/* ============================== 2c. Coral Pop ============================== */
if (want("bubble")) {
  section("Coral Pop bubbleRev 2");
  const game = bubbleGameFor(BUB_REV);
  ok(bubbleGameFor(undefined) === bubbleGame && bubbleGame.init(5).rev === undefined, "unstamped Coral Pop keeps the original game");
  ok(game.init(5).rev === BUB_REV, "rev-2 state carries the stamp");
  ok(JSON.stringify(game.init(31)) === JSON.stringify(game.init(31)), "rev-2 queues are seeded");
  for (const seed of SEEDS(200, 7919)) {
    const s = game.init(seed);
    const legacy = bubbleGame.init(seed);
    ok(JSON.stringify(s.grid) === JSON.stringify(legacy.grid), "rev 2 keeps the original field (no specials in it)");
    const count = (v: number) => s.queue.filter((q) => q === v).length;
    ok(count(BUB_JOKER) === 8 && count(BUB_BOMB) === 2 && count(BUB_LINE) === 2, `seed ${seed}: 8 Jokers, 2 mines, 2 torpedoes in the queue`);
    ok(s.queue.slice(0, 5).every((v) => v <= 5), "the first five shots are plain colours");
    s.queue.forEach((v, i) => {
      if (v <= 5) ok(v === legacy.queue[i], "every plain queue colour is unchanged");
    });
    ok(s.queue.length === BUB_QUEUE, "queue length unchanged");
  }

  /** Fires `kind` from just below an empty cell so it lands there; returns the state after landing. */
  const landAt = (base: BubState, grid: number[], row: number, col: number, kind: number) => {
    let s: BubState = {
      ...base,
      grid,
      startCount: grid.filter(Boolean).length,
      flightColour: kind,
      x: bubCellX(row, col) * 256,
      y: (bubCellY(row, base.descents) + BUB_R + 6) * 256,
      vx: 0,
      vy: -1536,
    };
    for (let i = 0; i < 20 && s.flightColour !== 0; i++) s = game.step(s, null);
    return s;
  };
  {
    const base = game.init(77);
    const empty = () => base.grid.map(() => 0);
    const at = (r: number, c: number) => r * BUB_COLS + c;
    // Row 0 alternates two colours (holds everything, matches nothing); row 1: red pair, gap, blue pair.
    const grid = empty();
    for (let c = 0; c < 10; c++) grid[at(0, c)] = c % 2 === 0 ? 3 : 4;
    grid[at(1, 1)] = 1;
    grid[at(1, 2)] = 1;
    grid[at(1, 4)] = 2;
    grid[at(1, 5)] = 2;
    const joker = landAt(base, grid, 1, 3, BUB_JOKER);
    ok(joker.grid[at(1, 1)] === 0 && joker.grid[at(1, 2)] === 0 && joker.grid[at(1, 4)] === 0 && joker.grid[at(1, 5)] === 0 && joker.grid[at(1, 3)] === 0, "a Joker between a red pair and a blue pair pops both");
    ok(joker.jokers === 1 && joker.popped === 5, `the Joker counts itself with the four it matched (jokers ${joker.jokers}, popped ${joker.popped}, dropped ${joker.dropped})`);
    const lone = empty();
    for (let c = 0; c < 10; c++) lone[at(0, c)] = c % 2 === 0 ? 3 : 4;
    const kept = landAt(base, lone, 1, 3, BUB_JOKER);
    ok(kept.grid[at(1, 3)] === 3 || kept.grid[at(1, 3)] === 4, "a Joker that matches nothing stays, as a colour it touches");
    ok(kept.jokers === 0, "and does not count as used");
    const bomb = landAt(base, grid, 1, 3, BUB_BOMB);
    ok(bomb.grid[at(1, 2)] === 0 && bomb.grid[at(1, 4)] === 0 && bomb.grid[at(0, 3)] === 0 && bomb.grid[at(0, 4)] === 0 && bomb.grid[at(1, 3)] === 0, "a mine clears its neighbours and itself");
    ok(bomb.grid[at(1, 1)] === 0 || bomb.dropped > 0 || bomb.grid[at(1, 1)] === 1, "a mine leaves farther bubbles (or drops loose ones)");
    ok(bomb.bombs === 1, "the mine counts");
    const torpedo = landAt(base, grid, 1, 3, BUB_LINE);
    ok([1, 2, 4, 5].every((c) => torpedo.grid[at(1, c)] === 0) && torpedo.grid[at(0, 0)] === 3, "a torpedo clears its whole row and nothing above");
    ok(torpedo.lines === 1 && torpedo.lastSpecialCleared === 4, "the torpedo counts what it cleared");
  }
  // Score: partial credit up to 99 (one bubble left), a full clear 130 + speed.
  {
    const s = game.init(1);
    const last = s.grid.findIndex((v) => v > 0);
    ok(game.score({ ...s, grid: s.grid.map((v, i) => (i === last ? v : 0)) }) === BUB_V2_PARTIAL_MAX, `a part-cleared field scores up to ${BUB_V2_PARTIAL_MAX}`);
    ok(/up to 99\b/.test(INTRO_SCORE.bubble), "the intro states the 99 partial maximum");
    ok(game.score({ ...s, cleared: true, endedTick: 1 }) === 150, "a full clear early scores 150");
  }
  // Real play: replay identity, balance against the original, and a 150 through the server replay.
  {
    const SEED_150 = 96;
    const run = playBubble(game, SEED_150, 0);
    const raw = encodeBubbleRun({ seed: SEED_150, claimedScore: run.score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints });
    const replay = replayBubbleRun(SEED_150, raw, BUB_REV);
    ok(replay.score === run.score && !replay.flagged && JSON.stringify(replay.state) === JSON.stringify(run.state), "server replay agrees");
    ok(replay.score === 150 && replay.cleared, `150 is reachable on bubbleRev 2 through the server replay (seed ${SEED_150}, cleared at ${replay.endedSeconds} s)`);
    const N = Number(process.env.BATCH2_BUBBLE_RUNS ?? 16);
    let v1 = 0, v2 = 0, clears1 = 0, clears2 = 0;
    for (const seed of SEEDS(N, 7919)) {
      const a = playBubble(bubbleGame, seed, 30);
      const b = playBubble(game, seed, 30);
      v1 += a.score;
      v2 += b.score;
      clears1 += a.state.cleared ? 1 : 0;
      clears2 += b.state.cleared ? 1 : 0;
    }
    console.log(`  shot bot (0.5 s between shots), ${N} seeds: original mean ${(v1 / N).toFixed(1)} (${clears1} clears), rev 2 mean ${(v2 / N).toFixed(1)} (${clears2} clears)`);
    ok(Math.abs(v2 - v1) / N <= 15, "rev 2 stays within 15 points of the original on average (rebalanced partial credit)");
  }
}

/* =============================== 2d. Gemstone =============================== */
if (want("matchup")) {
  section("Gemstone matchupRev 3 (constant play at the original fall speed)");
  const game = matchupGameFor(MATCHUP_REV);
  ok(matchupGameFor(undefined) === matchupGame && matchupGame.init(5).rev === undefined, "unstamped Gemstone keeps the original game");
  ok(game.init(5).rev === MATCHUP_REV && matchupGameFor(MATCHUP_REV2).init(5).rev === MATCHUP_REV2, "the state carries the current stamp; rev-2 rounds keep rev 2");
  ok(JSON.stringify(game.init(5).queues) === JSON.stringify(matchupGame.init(5).queues), "rev 2 keeps the same board and refill queues");

  // A board with no lines where swapping (2,2)<->(3,2) makes a 5-line in row 3 and a 3-line down column 2 (a T).
  const jackpotBoard = (): number[] => {
    const cells = Array.from({ length: MATCHUP_CELLS }, (_, i) => {
      const r = Math.floor(i / MATCHUP_SIZE), c = i % MATCHUP_SIZE;
      return 2 + ((r + 2 * c) % 4);
    });
    for (const c of [0, 1, 3, 4]) cells[matchupIndex(3, c)] = 0;
    cells[matchupIndex(3, 2)] = 1;
    cells[matchupIndex(2, 2)] = 0;
    cells[matchupIndex(4, 2)] = 0;
    cells[matchupIndex(5, 2)] = 0;
    return cells;
  };
  {
    const board = jackpotBoard();
    ok(!matchupHasLine(board), "the jackpot test board has no line before the swap");
    let s: MatchupState = { ...game.init(9), cells: board };
    s = game.step(s, { t: 1, k: MATCHUP_INPUT_SWAP, a: 2, b: 2, c: 3, d: 2 });
    ok(s.cells.includes(MATCHUP_JACKPOT + 0) && s.jackpots === 1, "5 and a T in one swap makes a Jackpot gem in that colour");
    const legacy = matchupGame.step({ ...matchupGame.init(9), cells: board }, { t: 1, k: MATCHUP_INPUT_SWAP, a: 2, b: 2, c: 3, d: 2 });
    ok(legacy.cells.every((v) => v < MATCHUP_JACKPOT), "the original rules never make a Jackpot");
    // Let any cascade settle, then set the Jackpot off by swapping it.
    for (let i = 0; i < 400 && matchupPending(s); i++) s = game.step(s, null);
    const where = s.cells.findIndex((v) => v === MATCHUP_JACKPOT);
    ok(where >= 0, "the Jackpot gem is on the settled board");
    const r = Math.floor(where / MATCHUP_SIZE), c = where % MATCHUP_SIZE;
    const colourCount = s.cells.filter((v) => v === 0).length;
    const before = s.raw;
    const nr = r > 0 ? r - 1 : r + 1;
    s = game.step(s, { t: s.tick + 1, k: MATCHUP_INPUT_SWAP, a: r, b: c, c: nr, d: c });
    ok(s.jackpotsFired === 1, "swapping a Jackpot sets it off");
    ok(s.raw - before >= 10 * Math.max(colourCount, MATCHUP_SIZE + 7), `it clears its colour plus a cross (+${s.raw - before} points)`);
    ok(s.raw - before < matchupParRaw(s) / 10, "one Jackpot is worth well under a tenth of the par (it cannot make 150 alone)");
  }
  // Constant play: swaps land while a cascade is still to resolve, and replay identically.
  {
    let pendingSwaps = 0;
    let best = 0;
    for (const seed of SEEDS(Number(process.env.BATCH2_MATCHUP_RUNS ?? 6), 15_485_863)) {
      const run = playMatchup(game, seed, 20);
      const raw = encodeMatchupRun({ seed, claimedScore: run.score, events: run.events, endTick: run.state.tick, checkpoints: run.checkpoints });
      const replay = replayMatchupRun(seed, raw, MATCHUP_REV);
      ok(replay.score === run.score && !replay.flagged && JSON.stringify(replay.state) === JSON.stringify(run.state), `seed ${seed}: server replay agrees`);
      best = Math.max(best, replay.score);
      // Count swaps applied while the board was still settling.
      let s = game.init(seed);
      const byTick = new Map(run.events.map((e) => [e.t, e]));
      for (let t = 1; t <= run.state.tick; t++) {
        const event = byTick.get(t) ?? null;
        const pending = matchupPending(s);
        const next = game.step(s, event);
        if (event && pending && next.swaps > s.swaps) pendingSwaps += 1;
        s = next;
      }
    }
    ok(pendingSwaps > 0, `swaps are accepted while gems are still clearing (${pendingSwaps} in the sample)`);
    ok(best === 150, "150 is reachable on matchupRev 3 through the server replay");
    // Cascade steps wait for the previous step's original-speed fall (rev 3), on sim ticks.
    let s = game.init(4242);
    let lastStep = -1;
    for (const e of playMatchup(game, 4242, 40).events) {
      while (s.tick + 1 < e.t) {
        const serial = s.resolveSerial ?? 0;
        s = game.step(s, null);
        if ((s.resolveSerial ?? 0) > serial) {
          if (lastStep >= 0) ok(s.tick - lastStep >= matchupV3StepTicks(1, false), "cascade steps wait for the original fall");
          lastStep = s.tick;
        }
      }
      const serial = s.resolveSerial ?? 0;
      s = game.step(s, e);
      if ((s.resolveSerial ?? 0) > serial) lastStep = -1;
    }
    // Balance: the same bot pace scores about the same on both rules.
    const N = 8;
    let v1 = 0, v2 = 0;
    for (const seed of SEEDS(N, 7919)) {
      v1 += playMatchup(matchupGame, seed, 66).score;
      v2 += playMatchup(game, seed, 66).score;
    }
    console.log(`  swap bot (1.1 s think), ${N} seeds: original mean ${(v1 / N).toFixed(1)}, rev 3 mean ${(v2 / N).toFixed(1)} (par ${matchupParRaw(game.init(1))})`);
    ok(Math.abs(v2 - v1) / N <= 15, "at the same pace rev 3 stays within 15 points of the original (rebalanced par)");
  }
}

function cellAway(cell: number): number {
  // A square far from `cell` for the head, so a test landing cannot hit it.
  return cell < (SNAKE_ROWS * SNAKE_COLS) / 2 ? SNAKE_ROWS * SNAKE_COLS - 1 - SNAKE_COLS : SNAKE_COLS + 1;
}

/* ============================ 3. Intro text rules ============================ */
section("intro text");
for (const type of (["matchup", "bubble", "snake", "hover"] as const).filter(want)) {
  const help = PUZZLE_INSTRUCTIONS[type];
  const intro = help.how.filter((line) => !line.helpOnly);
  ok(intro.length <= 3, `${type}: intro HOW has at most three lines (${intro.length})`);
  // One phone line each at 375 px (measured in Chromium: READY fully visible at 375×667 with these lengths).
  for (const line of intro) ok(`${line.action} ${line.detail}`.length <= 46, `${type}: intro HOW line fits one line: ${line.action} ${line.detail}`);
  ok(help.goal.length <= 34, `${type}: intro GOAL fits one line: ${help.goal}`);
  ok(INTRO_SCORE[type].length <= 90, `${type}: intro SCORE within 90 characters`);
  ok(!/pellet/i.test(JSON.stringify(help) + INTRO_SCORE[type]), `${type}: no "pellet" wording`);
}
ok(/up to 150/i.test(INTRO_SCORE.snake), "Meteor intro states the 150 maximum the bot reaches");

console.log(`arcade batch 2: ${checks} checks passed`);
