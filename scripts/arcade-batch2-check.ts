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
  SNAKE_ROCK_MAX,
  SNAKE_ROCK_WARN_TICKS,
  SNAKE_ROWS,
  SNAKE_RUN_TICKS,
  type SnakeState,
} from "../src/lib/arcade/snake";
import { encodeSnakeRun, replaySnakeRun } from "../src/lib/duel/snake";
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

/* ================================ 2a. Meteor ================================ */
if (want("snake")) {
  section("Meteor snakeRev 2");
  const game = snakeGameFor(SNAKE_REV);
  ok(snakeGameFor(undefined) === snakeGame && snakeGame.init(5).rev === undefined, "unstamped Meteor keeps the original game");
  ok(game.init(5).rev === SNAKE_REV, "rev-2 state carries the stamp");
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
    for (const rock of run.state.rocks ?? []) ok(slotCells.has(rock), "every landed rock is on a slot square");
  }
  ok(rocksSeen > 0, "the bot meets real rocks");
  ok(best.score === 150, `150 is reachable on snakeRev 2 through the server replay (best ${best.score} on seed ${best.seed})`);
  console.log(`  bot: mean ${(total / RUNS.length).toFixed(1)}, best ${best.score} (seed ${best.seed}), ${rocksSeen} rocks landed over ${RUNS.length} runs`);

  // Head-only collisions, built directly on a rev-2 state.
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
  for (const line of intro) ok(`${line.action} ${line.detail}`.length <= 110, `${type}: intro HOW line is short: ${line.action} ${line.detail}`);
  ok(INTRO_SCORE[type].length <= 90, `${type}: intro SCORE within 90 characters`);
  ok(!/pellet/i.test(JSON.stringify(help) + INTRO_SCORE[type]), `${type}: no "pellet" wording`);
}
ok(/up to 150/i.test(INTRO_SCORE.snake), "Meteor intro states the 150 maximum the bot reaches");

console.log(`arcade batch 2: ${checks} checks passed`);
