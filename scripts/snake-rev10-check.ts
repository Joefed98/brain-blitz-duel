/**
 * snake-rev10-check (27 Oct 2026, docs/phone-notes-oct-2026/snake.md): Meteor snakeRev 10, Joe's phone notes.
 *
 *  1. Wiring: rooms deal snakeRev 10, the "?" help reads it (SNAKE_V9_BAND_CURVE, unchanged), 200 at most, the
 *     snakeRev 9 world size.
 *  2. The world, on 60 room seeds: the same twice; everything snakeRev 9 draws is unchanged (stars, gold
 *     schedule, shower, lanes, the first two wormhole pairs, rock slots' ticks and squares, a 2 × 2 rock's block
 *     holding its slot's square); five 2 × 2 rocks off the border, never on a star, gold star, mouth or shower
 *     square and never touching another rock; a third wormhole pair clear of everything; a second vertical lane
 *     4+ columns from the first, off the start column, through no mouth; gold stars stay 5 s.
 *  3. The rules, scripted: the head moving into any square of a landed 2 × 2 rock ends the run (rockHit 1; the
 *     same move on snakeRev 9, where the rock is one square, does not); a 2 × 2 rock landing with the head under
 *     any of its squares ends it (rockHit 2), on the body it does nothing; the second lane is fast; a gold star is
 *     on the board exactly 5 s (3.5 s on snakeRev 9); snakeGoldWorth with the default life is the old formula.
 *  4. Bots: new-stamp runs (scripts/fixtures/snake-rev10-runs.json.gz, `--record` to re-record) replay through
 *     the server path to their stored score and state, unflagged, at most 200 with every feature within its cap;
 *     elite bots route round the 2 × 2 rocks (at most 3 rock deaths in 30 runs); no input scores 0.
 *
 * Older revisions (snakeRev 1–9) are proved unchanged by expansion-e2-check's legacy and new-stamp fixtures.
 *
 *   bun scripts/snake-rev10-check.ts [--record]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gunzipSync, gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import {
  snakeGameFor, snakeGoldWorth, snakeRow, snakeCol, snakeRockCells, snakeRockSpan, snakeStepTicksFor, snakeStepTicks, snakeV9Bonus,
  snakeWorldHForRev, snakeWorldWForRev,
  SNAKE_REV_200, SNAKE_REV_10, SNAKE_REV_STD, SNAKE_V11_BAND_CURVE, SNAKE_V9_BAND_CURVE, SNAKE_V9_CAPS, SNAKE_V9_COLS, SNAKE_V9_ROWS, SNAKE_V9_H, SNAKE_V9_WORLD_W,
  SNAKE_GOLD_LIFE, SNAKE_V10_GOLD_LIFE, SNAKE_V10_BIG_ROCKS, SNAKE_INPUT_TURN, SNAKE_RUN_TICKS, SNAKE_GOLD_MIN, SNAKE_GOLD_SPAN,
  type SnakeState,
} from "../src/lib/arcade/snake";
import { clampInt } from "../src/lib/arcade/engine";

const RECORD = process.argv.includes("--record");
const FIXTURE = "scripts/fixtures/snake-rev10-runs.json.gz";
const COLS = SNAKE_V9_COLS, ROWS = SNAKE_V9_ROWS;
let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};
const digest = (state: unknown) => createHash("sha256").update(JSON.stringify(state)).digest("hex").slice(0, 24);
const spec = GAME_BY_TYPE.get("snake" as never)!;
const v9 = snakeGameFor(SNAKE_REV_200);
const v10 = snakeGameFor(SNAKE_REV_10);
const r = (c: number) => snakeRow(c, COLS);
const c = (x: number) => snakeCol(x, COLS);
const touching = (a: number, b: number) => Math.abs(r(a) - r(b)) <= 1 && Math.abs(c(a) - c(b)) <= 1;

/* 1. Wiring. */
// The arcade scoring standard (29 Oct 2026): rooms moved on to snakeRev 11, snakeRev 10's play on new scoring
// (snake-standard-check); snakeRev 10 itself stays proved below.
ok((generatePuzzle("snake") as any).snakeRev === SNAKE_REV_STD, "rooms deal snakeRev 11 (snakeRev 10 before the arcade scoring standard)");
ok(LIVE_BANDS.snake.rev === SNAKE_REV_STD && LIVE_BANDS.snake.curve === SNAKE_V11_BAND_CURVE, "the help reads snakeRev 11 on SNAKE_V11_BAND_CURVE (snakeRev 10: SNAKE_V9_BAND_CURVE)");
ok(ROUND_MAX.snake === 200, "ROUND_MAX: Meteor is 200");
ok(snakeWorldWForRev(SNAKE_REV_10) === SNAKE_V9_WORLD_W && snakeWorldHForRev(SNAKE_REV_10) === SNAKE_V9_H, "snakeRev 10 plays in snakeRev 9's world");

/* 2. The world. */
let fiveBig = 0;
for (let n = 0; n < 60; n++) {
  const seed = spec.seedFor(n);
  const a: SnakeState = v10.init(seed);
  const b: SnakeState = v9.init(seed);
  const tag = `seed ${seed}`;
  ok(JSON.stringify(a) === JSON.stringify(v10.init(seed)), `${tag}: the same world twice`);
  for (const k of ["queue", "golds", "showerCells", "showerSlots", "laneRow", "laneCol", "cols", "rows", "pellet", "body", "exp", "band"] as const)
    ok(JSON.stringify(a[k]) === JSON.stringify(b[k]), `${tag}: ${k} as on snakeRev 9`);
  ok(JSON.stringify(a.warps!.slice(0, 4)) === JSON.stringify(b.warps), `${tag}: snakeRev 9's two wormhole pairs`);
  ok(a.goldLife === SNAKE_V10_GOLD_LIFE && b.goldLife === undefined, `${tag}: gold stars stay 5 s (snakeRev 9: no goldLife)`);
  const big = a.bigRocks ?? [];
  if (big.length === SNAKE_V10_BIG_ROCKS) fiveBig++;
  ok(big.length >= SNAKE_V10_BIG_ROCKS - 1 && big.length <= SNAKE_V10_BIG_ROCKS, `${tag}: ${SNAKE_V10_BIG_ROCKS} 2 × 2 rocks (got ${big.length})`);
  ok(a.rockSlots!.length === b.rockSlots!.length, `${tag}: the same rock slots`);
  const stars = new Set(a.queue);
  const goldCells = new Set(a.golds!.map((g) => g.cell));
  const allCells = a.rockSlots!.map((s) => snakeRockSpan(a, s.cell));
  a.rockSlots!.forEach((slot, i) => {
    const old = b.rockSlots![i]!;
    ok(slot.tick === old.tick, `${tag} slot ${i}: its tick`);
    const span = allCells[i]!;
    ok(big.includes(slot.cell) ? span.length === 4 && span.includes(old.cell) : slot.cell === old.cell, `${tag} slot ${i}: its square (in its block)`);
    if (span.length === 4) {
      ok(r(span[3]!) === r(span[0]!) + 1 && c(span[3]!) === c(span[0]!) + 1, `${tag} slot ${i}: a 2 × 2 block`);
      for (const x of span) {
        ok(r(x) >= 1 && r(x) <= ROWS - 2 && c(x) >= 1 && c(x) <= COLS - 2, `${tag} slot ${i}: ${x} off the border`);
        ok(!stars.has(x) && !goldCells.has(x) && !a.warps!.includes(x), `${tag} slot ${i}: ${x} not on a star, gold star or mouth`);
        ok(!(a.showerCells ?? []).some((s) => touching(s, x)), `${tag} slot ${i}: ${x} clear of the shower`);
        ok(allCells.every((other, j) => j === i || other.every((o) => !touching(o, x))), `${tag} slot ${i}: ${x} touches no other rock`);
      }
    }
  });
  const rockCells = new Set([...allCells.flat(), ...(a.showerCells ?? [])]);
  ok(a.warps!.length === 6 && new Set(a.warps).size === 6, `${tag}: three wormhole pairs`);
  for (const w of a.warps!.slice(4)) {
    ok(r(w) >= 2 && r(w) < ROWS - 2 && c(w) >= 2 && c(w) < COLS - 2, `${tag}: mouth ${w} off the border`);
    ok(!stars.has(w) && !goldCells.has(w) && !rockCells.has(w), `${tag}: mouth ${w} clear of stars, gold stars and rocks`);
    ok(r(w) !== a.laneRow && c(w) !== a.laneCol && c(w) !== a.laneCol2, `${tag}: mouth ${w} off every lane`);
    ok(a.warps!.every((o) => o === w || Math.abs(r(o) - r(w)) > 2 || Math.abs(c(o) - c(w)) > 2), `${tag}: mouth ${w} 3+ squares from the others`);
  }
  ok(a.laneCol2 !== undefined && Math.abs(a.laneCol2 - a.laneCol!) >= 4 && a.laneCol2 !== COLS >> 1 && a.warps!.every((w) => c(w) !== a.laneCol2), `${tag}: a second vertical lane 4+ columns from the first, off the start column, through no mouth`);
  let s = a;
  while (!v10.isOver(s)) s = v10.step(s, null);
  ok(v10.score(s) === 0, `${tag}: no input scores 0`);
}
ok(fiveBig >= 55, `five 2 × 2 rocks on nearly every seed (${fiveBig} of 60)`);

/* 3. The rules, scripted. */
{
  const seed = spec.seedFor(3);
  const a: SnakeState = v10.init(seed);
  const anchor = a.bigRocks![0]!;
  const corner = anchor + COLS + 1;
  // The head right below the block's bottom-right square, heading up, about to step.
  const body = [corner + COLS, corner + 2 * COLS, corner + 3 * COLS];
  const at = (g: typeof v10, st: SnakeState) => g.step({ ...st, body, dir: 0, nextDir: 0, sinceMove: 50, rocks: [anchor], rockWarn: -1, tick: 700 }, null);
  const hit = at(v10, a);
  ok(hit.dead && hit.rockHit === 1, "snakeRev 10: the head moving into a 2 × 2 rock's far square ends the run (rockHit 1)");
  const old = at(v9, { ...a, bigRocks: undefined, laneCol2: undefined, goldLife: undefined });
  ok(!old.dead && old.body[0] === corner, "snakeRev 9: the same move onto the square beside a one-square rock carries on");
  ok(JSON.stringify(snakeRockCells({ ...a, rocks: [anchor] })) === JSON.stringify([anchor, anchor + 1, anchor + COLS, anchor + COLS + 1]), "snakeRockCells covers the block");
  // Landing: the head under the block's top-right square.
  const land = (head: number[]) => v10.step({ ...a, body: head, dir: 0, nextDir: 0, sinceMove: 0, rocks: [], rockWarn: anchor, rockLandTick: 701, tick: 700, rockSlot: 99 }, null);
  const onHead = land([anchor + 1, anchor + 1 + COLS * 3, anchor + 1 + COLS * 4]);
  ok(onHead.dead && onHead.rockHit === 2, "a 2 × 2 rock landing with the head under any of its squares ends the run (rockHit 2)");
  const onBody = land([anchor + 1 - 2 * COLS, anchor + 1 - COLS, anchor + 1]);
  ok(!onBody.dead && (onBody.rocks ?? []).includes(anchor), "a 2 × 2 rock landing on the body does nothing");
  // A played run that crashed before its first star scores 1 (snakeRev 9: 0); no input still scores 0.
  const crashed = { ...a, acted: 1, dead: true, eaten: 0, tick: 400 };
  ok(v10.score(crashed) === 1 && v9.score({ ...crashed, bigRocks: undefined, laneCol2: undefined, goldLife: undefined }) === 0, "a played run with no star and no bonus scores 1 on snakeRev 10 (0 on snakeRev 9)");
  ok(v10.score({ ...crashed, acted: 0 }) === 0, "no input still scores 0");
  // The second lane steps faster going up or down it.
  const lane = { ...a, eaten: 0, body: [a.laneCol2! + 10 * COLS] };
  ok(snakeStepTicksFor(lane, 0) < snakeStepTicks(0) && snakeStepTicksFor(lane, 1) === snakeStepTicks(0), "the second lane is fast along it, not across");
  // The gold worth: unchanged with the default life; snakeRev 10 runs 5 → 1 over the first 3.5 s, then pays 1.
  let same = true;
  for (let left = -5; left <= SNAKE_GOLD_LIFE + 5; left++) {
    const was = SNAKE_GOLD_MIN + Math.trunc((SNAKE_GOLD_SPAN * clampInt(left, 0, SNAKE_GOLD_LIFE) + SNAKE_GOLD_LIFE - 1) / SNAKE_GOLD_LIFE);
    if (snakeGoldWorth(1000 - left, 1000) !== was) same = false;
  }
  ok(same, "snakeGoldWorth with the default life is snakeRev 9's formula");
  const L = SNAKE_V10_GOLD_LIFE;
  ok(snakeGoldWorth(1000 - L, 1000, L) === 5 && snakeGoldWorth(1000 - (L - SNAKE_GOLD_LIFE) - 1, 1000, L) === 2 && snakeGoldWorth(1000 - (L - SNAKE_GOLD_LIFE), 1000, L) === 1 && snakeGoldWorth(999, 1000, L) === 1, "snakeRev 10's gold worth: 5 on arrival, 1 in its last 1.5 s");
}
// A gold star stays exactly its life: a 3-long meteor circling a quiet 2 × 2 loop to the end of the run.
for (const [game, life, name] of [[v10, SNAKE_V10_GOLD_LIFE, "snakeRev 10"], [v9, SNAKE_GOLD_LIFE, "snakeRev 9"]] as const) {
  const seed = spec.seedFor(5);
  let s: SnakeState = game.init(seed);
  const busy = new Set([...s.queue, ...(s.golds ?? []).map((g) => g.cell), ...(s.warps ?? [])]);
  let loop = -1;
  for (let top = 2 * COLS + 2; top < (ROWS - 3) * COLS && loop < 0; top++) {
    const cells = [top, top + 1, top + COLS, top + COLS + 1];
    if (c(top) >= 1 && c(top) <= COLS - 3 && cells.every((x) => !busy.has(x))) loop = top;
  }
  // Head bottom-left (having come left from bottom-right), turning clockwise every square: up, right, down, left.
  s = { ...s, body: [loop + COLS, loop + COLS + 1, loop + 1], dir: 3, nextDir: 3 };
  const shown = new Map<number, number>();
  while (!game.isOver(s)) {
    s = game.step(s, { t: s.tick + 1, k: SNAKE_INPUT_TURN, a: (s.dir + 1) % 4, b: 0, c: 0, d: 0 });
    if ((s.gold ?? -1) >= 0) shown.set(s.goldAt!, (shown.get(s.goldAt!) ?? 0) + 1);
  }
  ok(!s.dead && s.tick === SNAKE_RUN_TICKS, `${name}: the loop survives the run`);
  ok(shown.size >= 6 && [...shown.values()].every((t) => t === life), `${name}: every gold star is on the board ${life} ticks (${[...shown.values()].join(", ")})`);
}

/* 4. Bots. */
const LEVELS = ["average", "good", "great", "elite"] as const;
if (RECORD) {
  const { bot } = await import("./arcade-skill-bands/bots/snake");
  const runs: any[] = [];
  for (const level of LEVELS)
    for (let n = 0; n < 6; n++) {
      const seed = spec.seedFor(n);
      const out = bot({ game: v10, seed, rev: SNAKE_REV_10, human: new Human("snake", seed, level) } as any);
      let state = v10.init(seed);
      const by = new Map((out.events ?? []).map((e: any) => [e.t, e]));
      const checkpoints: unknown[] = [];
      while (!v10.isOver(state)) {
        state = v10.step(state, by.get(state.tick + 1) ?? null);
        if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
      }
      const raw = spec.encode({ seed, claimedScore: v10.score(state), events: out.events ?? [], endTick: state.tick, checkpoints }, SNAKE_REV_10, seed);
      const result = spec.replay(seed, raw, SNAKE_REV_10);
      runs.push({ level, seed, raw, score: result.score, digest: digest(result.state) });
    }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recorded: "snakeRev 10 (Joe's phone notes), 27 Oct 2026", runs })));
  console.log(`wrote ${FIXTURE} (${runs.length} runs)`);
}
const recorded = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { runs: any[] };
ok(recorded.runs.length === 24, `24 stored snakeRev 10 runs (got ${recorded.runs.length})`);
for (const run of recorded.runs) {
  const now = spec.replay(run.seed, run.raw, SNAKE_REV_10);
  const tag = `${run.level} seed ${run.seed}`;
  ok(!now.flagged, `${tag}: replays unflagged (${now.reason ?? ""})`);
  ok(now.score === run.score && digest(now.state) === run.digest, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
  ok(now.score > 0 && now.score <= 200, `${tag}: played, above 0 and at most 200`);
  const b = snakeV9Bonus(now.state) as any;
  ok(Object.entries(SNAKE_V9_CAPS).every(([k, cap]) => b[k] <= cap), `${tag}: each feature within its cap`);
}
{
  const { bot } = await import("./arcade-skill-bands/bots/snake");
  let rockDeaths = 0;
  for (let n = 0; n < 30; n++) {
    const seed = spec.seedFor(n);
    const out = bot({ game: v10, seed, rev: SNAKE_REV_10, human: new Human("snake", seed, "elite") } as any);
    let state = v10.init(seed);
    const by = new Map((out.events ?? []).map((e: any) => [e.t, e]));
    while (!v10.isOver(state)) state = v10.step(state, by.get(state.tick + 1) ?? null);
    if (state.rockHit) rockDeaths++;
  }
  ok(rockDeaths <= 3, `elite bots route round the 2 × 2 rocks (${rockDeaths} rock deaths in 30 runs)`);
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL snake-rev10-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS snake-rev10-check: ${checks} checks — wiring, 60 worlds (snakeRev 9's draws unchanged, ${fiveBig} with five 2 × 2 rocks), scripted rules, ${recorded.runs.length} stored runs`);
