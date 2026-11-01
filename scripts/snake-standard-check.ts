/**
 * snake-standard-check (29 Oct 2026, docs/arcade-standard/snake.md): Meteor snakeRev 11, the arcade scoring
 * standard. snakeRev 10's world and play exactly, scored in straight-line parts that add up to 200.
 *
 *  1. Wiring: rooms deal snakeRev 12 since 1 Nov 2026 (snake-rev12-check; snakeRev 11 before), the "?" help reads its
 *     core line (snakeRev 11: SNAKE_V11_BAND_CURVE), 200 at
 *     most, snakeRev 10's world size; the standard module's parts add up to 200 and its perfect run scores 200 with
 *     every part at its maximum.
 *  2. Older stamps unchanged: 99 runs on unstamped and snakeRev 1–10 rounds, recorded on unmodified main 73f6bb7
 *     (scripts/fixtures/snake-standard-legacy.json.gz), replay to the same score, flag, final state and checkpoints.
 *  3. The same world and the same play: on 60 room seeds snakeRev 11's start is snakeRev 10's plus its own three fields,
 *     the same twice, 7 gold stars on every seed; bot logs played on both stamps give the same play tick for tick
 *     (only the scoring counters differ); nothing a run does changes what is dealt (stars, gold schedule, rocks,
 *     shower, lanes, wormholes).
 *  4. The rules, scripted: the core's straight line (120 at 27 stars, nothing more after), a gold star eaten on its
 *     first tick is worth 40 ÷ 7 and on its last nearly 0, seven full ones 40; combos (3 s window, 1 a star from the
 *     third; snakeRev 10's 1.25 s window and 1–3 a star unchanged); warp stars within 2 s (+2; snakeRev 10: 1 s); a lane
 *     ride scores once, on its 10th square; every cap; a played run scores at least 1, no input 0; the reveal's lines.
 *  5. Bots: new-stamp runs (scripts/fixtures/snake-standard-runs.json.gz, `--record` to re-record) replay through the
 *     server path to their stored score and state, unflagged, 1–200, parts adding up to the score.
 *
 *   bun scripts/snake-standard-check.ts [--record]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gunzipSync, gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human } from "./arcade-skill-bands/human";
import { entry } from "./arcade-standard/snake";
import type { StdRun } from "./arcade-standard/entry";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import {
  snakeGameFor, snakeStdCore, snakeStdParts, snakeStdGoldPoints, snakeRow, snakeCol, snakeWorldHForRev, snakeWorldWForRev,
  SNAKE_REV_10, SNAKE_REV_STD, SNAKE_REV_12, SNAKE_V11_BAND_CURVE, SNAKE_V12_BAND_CURVE, SNAKE_V9_COLS, SNAKE_V9_ROWS, SNAKE_V9_H, SNAKE_V9_WORLD_W,
  SNAKE_STD_CAPS, SNAKE_STD_CORE_MAX, SNAKE_STD_CORE_STARS, SNAKE_STD_GOLDS, SNAKE_STD_COMBO_TICKS, SNAKE_STD_WARP_TICKS,
  SNAKE_STD_LANE_RIDE, SNAKE_COMBO_TICKS, SNAKE_WARP_STAR_TICKS, SNAKE_INPUT_TURN,
  type SnakeState,
} from "../src/lib/arcade/snake";

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

const RECORD = process.argv.includes("--record");
const LEGACY = "scripts/fixtures/snake-standard-legacy.json.gz";
const FIXTURE = "scripts/fixtures/snake-standard-runs.json.gz";
const COLS = SNAKE_V9_COLS;
let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
const spec = GAME_BY_TYPE.get("snake" as never)!;
const v10 = snakeGameFor(SNAKE_REV_10);
const v11 = snakeGameFor(SNAKE_REV_STD);
const quiet = <T>(fn: () => T): T => {
  const error = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
  }
};
const play = (game: typeof v11, seed: number, events: any[], each?: (s: SnakeState) => void): SnakeState => {
  const by = new Map(events.map((e: any) => [e.t, e]));
  let state = game.init(seed) as SnakeState;
  while (!game.isOver(state)) {
    state = game.step(state, by.get(state.tick + 1) ?? null);
    each?.(state);
  }
  return state;
};

/* 1. Wiring. */
// 1 Nov 2026: rooms moved on to snakeRev 12 (snakeRev 11's parts, gold stars counting 2 towards the core, full at 20;
// snake-rev12-check). snakeRev 11 itself stays proved here.
ok((generatePuzzle("snake") as any).snakeRev === SNAKE_REV_12, "rooms deal snakeRev 12 (snakeRev 11 before 1 Nov 2026)");
ok(LIVE_BANDS.snake.rev === SNAKE_REV_12 && LIVE_BANDS.snake.curve === SNAKE_V12_BAND_CURVE, "the help reads snakeRev 12 on its core's straight line (snakeRev 11: SNAKE_V11_BAND_CURVE)");
ok(ROUND_MAX.snake === 200, "ROUND_MAX: Meteor is 200");
ok(snakeWorldWForRev(SNAKE_REV_STD) === SNAKE_V9_WORLD_W && snakeWorldHForRev(SNAKE_REV_STD) === SNAKE_V9_H, "snakeRev 11 plays in snakeRev 10's world");
ok(STANDARD.id === "snake" && STANDARD.stampKey === "snakeRev" && STANDARD.stamp === SNAKE_REV_12, "the standard module names snakeRev 12 (snakeRev 11 before 1 Nov 2026)");
ok(STANDARD.parts.reduce((a, p) => a + p.max, 0) === 200, "the parts' maxima add up to 200");
ok(SNAKE_STD_CORE_MAX + SNAKE_STD_CAPS.gold + SNAKE_STD_CAPS.combo + SNAKE_STD_CAPS.lane + SNAKE_STD_CAPS.warp === 200, "the sim's maxima add up to 200");
ok(JSON.stringify(STANDARD.parts.map((p) => [p.key, p.max])) === JSON.stringify([["core", 120], ["gold", 40], ["combo", 20], ["lane", 10], ["warp", 10]]), "parts: core 120, gold 40, combo 20, lane 10, warp 10");
{
  const perfect = STANDARD.perfect();
  ok(perfect.score === 200, `the perfect run scores 200 (got ${perfect.score})`);
  for (const p of STANDARD.parts) ok(perfect.parts[p.key] === p.max, `the perfect run's ${p.key} is ${p.max} (got ${perfect.parts[p.key]})`);
}

/* 2. Older stamps unchanged (recorded on main before the standard). */
const legacy = JSON.parse(gunzipSync(readFileSync(LEGACY)).toString()) as { runs: any[] };
ok(legacy.runs.length === 99, `99 legacy runs (got ${legacy.runs.length})`);
for (const rev of [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) ok(legacy.runs.filter((r) => r.rev === rev).length === 9, `9 legacy runs on snakeRev ${rev ?? "unstamped"}`);
for (const run of legacy.runs) {
  const now = quiet(() => spec.replay(run.seed, run.raw, run.rev));
  const tag = `snakeRev ${run.rev ?? "unstamped"} ${run.level} seed ${run.seed}`;
  ok(now.score === run.score, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
  ok(Boolean(now.flagged) === run.flagged, `${tag}: flagged ${run.flagged} as recorded`);
  ok(digest(now.state) === run.digest, `${tag}: identical final state`);
  ok(digest(now.checkpoints) === run.checkpoints, `${tag}: identical checkpoints`);
  ok(now.state.std === undefined && now.state.goldLeft === undefined && now.state.laneRides === undefined, `${tag}: no snakeRev 11 field`);
}

/* 3. The same world, the same play, nothing dealt from play. */
// Scoring counters only: the combo count (its window is longer on snakeRev 11) and the points.
const PLAY_ONLY = ["std", "goldLeft", "laneRides", "goldPts", "combo", "maxCombo", "comboPts", "warpPts"];
const playOf = (s: SnakeState) => JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => !PLAY_ONLY.includes(k))));
const DEALT = ["queue", "golds", "rockSlots", "bigRocks", "showerCells", "showerSlots", "warps", "laneRow", "laneCol", "laneCol2", "goldLife", "cols", "rows"] as const;
for (let n = 0; n < 60; n++) {
  const seed = spec.seedFor(n);
  const a = v11.init(seed) as SnakeState;
  const b = v10.init(seed) as SnakeState;
  ok(JSON.stringify(a) === JSON.stringify(v11.init(seed)), `seed ${seed}: the same world twice`);
  ok(JSON.stringify(a) === JSON.stringify({ ...b, std: 1, goldLeft: 0, laneRides: 0 }), `seed ${seed}: snakeRev 10's world plus std, goldLeft and laneRides`);
  ok(a.golds!.length === SNAKE_STD_GOLDS, `seed ${seed}: ${SNAKE_STD_GOLDS} gold stars dealt (got ${a.golds!.length})`);
}
const { bot } = await import("./arcade-skill-bands/bots/snake");
for (const level of ["weak", "average", "great", "elite"] as const)
  for (let n = 0; n < 4; n++) {
    const seed = spec.seedFor(100 + n);
    const out = bot({ game: v10, seed, rev: SNAKE_REV_10, human: new Human("snake", seed, level) } as any);
    const old: string[] = [];
    play(v10, seed, out.events ?? [], (s) => old.push(playOf(s)));
    let tick = 0;
    let same = true;
    const start = v11.init(seed) as SnakeState;
    const end = play(v11, seed, out.events ?? [], (s) => {
      if (playOf(s) !== old[tick++]) same = false;
    });
    ok(same && tick === old.length, `${level} seed ${seed}: the same log plays the same on snakeRev 10 and 11, tick for tick`);
    ok(DEALT.every((k) => JSON.stringify(end[k]) === JSON.stringify(start[k])), `${level} seed ${seed}: nothing dealt changes in play`);
  }

/* 4. The rules, scripted. */
{
  // The core: a straight line to 120 at SNAKE_STD_CORE_STARS, the same as the help's curve, nothing more after.
  let line = true;
  for (let n = 0; n <= 60; n++) {
    const want = Math.trunc((120 * Math.min(n, SNAKE_STD_CORE_STARS)) / SNAKE_STD_CORE_STARS);
    if (snakeStdCore(n) !== want || bandPoints(SNAKE_V11_BAND_CURVE, n) !== want) line = false;
  }
  ok(line, "core = trunc(120 × min(stars, 27) ÷ 27), the help curve's own line");
  ok(SNAKE_STD_CORE_STARS === 27 && snakeStdCore(27) === 120 && snakeStdCore(26) < 120 && snakeStdCore(40) === 120, "core: 120 at 27 stars, under it at 26, still 120 at 40");
  const steps = new Set<number>();
  for (let n = 1; n <= SNAKE_STD_CORE_STARS; n++) steps.add(snakeStdCore(n) - snakeStdCore(n - 1));
  ok([...steps].every((d) => d === 4 || d === 5), `each star adds the same (4 or 5 after rounding down): ${[...steps].join(", ")}`);
}

/** A quiet board: no rock falling or due, no shower, no gold star, a played run. */
const calm = (s: SnakeState): SnakeState => ({
  ...s, acted: 1, rocks: [], rockWarn: -1, rockSlot: s.rockSlots!.length, showerWarn: [], showerSlot: s.showerSlots!.length, showerDone: 1,
  gold: -1, goldAt: s.golds!.length,
});
/** A column with no mouth, rock square or lane in rows 6–30. */
const columnFor = (s: SnakeState) => {
  for (let c = 2; c < COLS - 2; c++) {
    if (c === s.laneCol || c === s.laneCol2) continue;
    let clear = true;
    for (let r = 6; r <= 30; r++) if (s.warps!.includes(r * COLS + c)) clear = false;
    if (clear) return c;
  }
  return -1;
};
/** One step straight up into the square above the head on `tick`, with a star there when `star`. */
const up = (game: typeof v11, s: SnakeState, tick: number, star: boolean): SnakeState => {
  const above = s.body[0]! - COLS;
  return game.step({ ...s, tick: tick - 1, dir: 0, nextDir: 0, sinceMove: 50, pellet: star ? above : s.body[s.body.length - 1]! }, null);
};
const seed = spec.seedFor(3);
const base11 = calm(v11.init(seed) as SnakeState);
const base10 = calm(v10.init(seed) as SnakeState);
const col = columnFor(base11);
ok(col >= 0, "a quiet column to script in");
const at = (row: number) => row * COLS + col;
const startOn = (s: SnakeState, row: number): SnakeState => ({ ...s, body: [at(row), at(row + 1), at(row + 2)], dir: 0, nextDir: 0, eaten: 0, lastStar: -9999, combo: 0, comboPts: 0, lastWarp: -9999, warpPts: 0 });

{
  // Combos: three stars 3 s apart score 1 (the third); a fourth 3 s later 1 more; one 3 s + 1 tick later starts again.
  let s = startOn(base11, 28);
  const T = SNAKE_STD_COMBO_TICKS;
  s = up(v11, s, 1000, true);
  s = up(v11, s, 1000 + T, true);
  ok(s.combo === 2 && s.comboPts === 0, `snakeRev 11: two quick stars, no combo point yet (combo ${s.combo}, ${s.comboPts})`);
  s = up(v11, s, 1000 + 2 * T, true);
  ok(s.combo === 3 && s.comboPts === 1, `snakeRev 11: the third star within 3 s scores 1 (combo ${s.combo}, ${s.comboPts})`);
  s = up(v11, s, 1000 + 3 * T, true);
  ok(s.combo === 4 && s.comboPts === 2, `snakeRev 11: the fourth scores 1 more, not 2 (${s.comboPts})`);
  s = up(v11, s, 1000 + 4 * T + 1, true);
  ok(s.combo === 1 && s.comboPts === 2, `snakeRev 11: a star 3 s + 1 tick later starts a new combo (combo ${s.combo})`);
  ok(snakeStdParts({ ...s, comboPts: 57 }).combo === SNAKE_STD_CAPS.combo, "combo points cap at 20");
  // snakeRev 10 keeps its 1.25 s window and 1–3 a star.
  let o = startOn(base10, 28);
  for (let i = 0; i < 5; i++) o = up(v10, o, 1000 + i * SNAKE_COMBO_TICKS, true);
  ok(o.combo === 5 && o.comboPts === 1 + 2 + 3, `snakeRev 10: combo 5 at 1.25 s apart scores 1 + 2 + 3 (${o.comboPts})`);
  o = up(v10, o, 1000 + 4 * SNAKE_COMBO_TICKS + SNAKE_COMBO_TICKS + 1, true);
  ok(o.combo === 1, "snakeRev 10: a star 1.25 s + 1 tick later starts again");
}
{
  // Warp stars: +2 within 2 s of a trip (snakeRev 10: 1 s), through a real wormhole.
  const m = base11.warps![0]!;
  const p = base11.warps![1]!;
  const trip = (game: typeof v11, b: SnakeState) => {
    const s = { ...b, body: [m + COLS, m + 2 * COLS, m + 3 * COLS], dir: 0, nextDir: 0, sinceMove: 50, tick: 1999, eaten: 0, lastWarp: -9999, warpPts: 0, warpsUsed: 0 };
    return game.step({ ...s, rocks: [] }, null);
  };
  const w11 = trip(v11, base11);
  ok(w11.body[0] === p && w11.warpsUsed === 1 && w11.lastWarp === 2000, `a step into a mouth comes out of its twin (head ${w11.body[0]}, twin ${p})`);
  const after = (game: typeof v11, s: SnakeState, gap: number) => {
    const row = snakeRow(s.body[0]!, COLS);
    return row > 1 ? up(game, { ...s, dir: 0 }, 2000 + gap, true) : s;
  };
  if (snakeRow(p, COLS) > 2 && !base11.warps!.includes(p - COLS)) {
    ok(after(v11, w11, SNAKE_STD_WARP_TICKS).warpPts === 2, "snakeRev 11: a star 2 s after a trip is a warp star (+2)");
    ok(after(v11, w11, SNAKE_STD_WARP_TICKS + 1).warpPts === 0, "snakeRev 11: 2 s + 1 tick after, it is not");
    const w10 = trip(v10, base10);
    ok(after(v10, w10, SNAKE_WARP_STAR_TICKS).warpPts === 2 && after(v10, w10, SNAKE_WARP_STAR_TICKS + 1).warpPts === 0, "snakeRev 10 keeps its 1 s warp window");
  } else ok(false, "the scripted wormhole exit has room above it");
  ok(snakeStdParts({ ...w11, warpPts: 30 }).warp === SNAKE_STD_CAPS.warp, "warp points cap at 10");
}
{
  // Lane rides: one ride along a lane scores once, on its 10th square; a longer ride still once.
  const lane = base11.laneCol2!;
  let s: SnakeState = { ...base11, body: [32 * COLS + lane, 33 * COLS + lane], dir: 0, nextDir: 0, laneRun: 0, laneRides: 0, pellet: 0 };
  const rides: number[] = [];
  for (let i = 0; i < 25; i++) {
    s = s.body[0]! - COLS < 0 ? s : v11.step({ ...s, sinceMove: 50, tick: 2000 + i }, null);
    rides.push(s.laneRides ?? 0);
  }
  ok(!s.dead && rides[SNAKE_STD_LANE_RIDE - 2] === 0 && rides[SNAKE_STD_LANE_RIDE - 1] === 1 && rides[24] === 1, `a ride scores once, on its ${SNAKE_STD_LANE_RIDE}th square (${rides.join("")})`);
  ok(snakeStdParts({ ...s, laneRides: 15 }).lane === SNAKE_STD_CAPS.lane, "lane points cap at 10");
  ok(snakeStdParts({ ...s, laneRides: 4 }).lane === 4, "1 a lane ride");
}
{
  // Gold stars: eaten on its first tick 40 ÷ 7, on its last tick almost nothing; seven full ones 40.
  const life = base11.goldLife!;
  const g = base11.golds!.find((x) => snakeRow(x.cell, COLS) < SNAKE_V9_ROWS - 4 && ![1, 2, 3].some((k) => base11.warps!.includes(x.cell + k * COLS)))!;
  const eat = (game: typeof v11, b: SnakeState, appeared: number, tick: number) =>
    game.step({ ...b, body: [g.cell + COLS, g.cell + 2 * COLS, g.cell + 3 * COLS], dir: 0, nextDir: 0, sinceMove: 50, gold: g.cell, goldEnd: appeared + life, tick: tick - 1, goldLeft: 0, goldPts: 0, goldsEaten: 0 }, null);
  const first = eat(v11, base11, 3000, 3001);
  ok(first.goldsEaten === 1 && first.goldLeft === life && first.goldPts === Math.trunc(40 / 7), `eaten on its first tick: its whole life left, ${Math.trunc(40 / 7)} points shown (${first.goldLeft}, ${first.goldPts})`);
  const last = eat(v11, base11, 3000, 3000 + life);
  ok(last.goldLeft === 1 && last.goldPts === 0, `eaten on its last tick: 1 tick left, 0 points (${last.goldLeft})`);
  const half = eat(v11, base11, 3000, 3001 + life / 2);
  ok(half.goldLeft === life / 2, "half way: half its worth");
  ok(snakeStdGoldPoints(7 * life, 7, life) === 40 && snakeStdGoldPoints(7 * life - 1, 7, life) === 39 && snakeStdGoldPoints(99 * life, 7, life) === 40, "seven gold stars eaten at once: 40, at most 40");
  ok(snakeStdGoldPoints(Math.round(3.5 * life), 7, life) === 20, "three and a half gold stars' worth: 20");
  const old = eat(v10, base10, 3000, 3001);
  ok(old.goldPts === 5 && old.goldLeft === 0, "snakeRev 10 keeps its 1–5 gold worth (goldLeft untouched)");
}
{
  // At least 1 for a played run, 0 with no input, 200 at most.
  const crashed: SnakeState = { ...base11, acted: 1, dead: true, eaten: 0, tick: 400 };
  ok(v11.score(crashed) === 1, "a played run with nothing scores 1");
  ok(v11.score({ ...crashed, acted: 0 }) === 0, "no input scores 0");
  let idle = v11.init(seed) as SnakeState;
  while (!v11.isOver(idle)) idle = v11.step(idle, null);
  ok(v11.score(idle) === 0, "a run with no input scores 0");
  let one = v11.init(seed) as SnakeState;
  one = v11.step(one, { t: 1, k: SNAKE_INPUT_TURN, a: 3, b: 0, c: 0, d: 0 });
  while (!v11.isOver(one)) one = v11.step(one, null);
  ok(v11.score(one) >= 1, `one swipe, then nothing: at least 1 (${v11.score(one)})`);
  const all: SnakeState = { ...crashed, eaten: 60, goldLeft: 99999, comboPts: 99, laneRides: 99, warpPts: 99 };
  ok(v11.score(all) === 200, "everything past its cap: 200");
  const parts = snakeStdParts({ ...crashed, eaten: 13, goldLeft: 2 * base11.goldLife!, comboPts: 6, laneRides: 3, warpPts: 4 });
  const score = v11.score({ ...crashed, eaten: 13, goldLeft: 2 * base11.goldLife!, comboPts: 6, laneRides: 3, warpPts: 4 });
  ok(parts.core === 57 && parts.gold === 11 && parts.combo === 6 && parts.lane === 3 && parts.warp === 4 && score === 81, `13 stars, 2 gold, 6 combo, 3 rides, 2 warp stars: 57 + 11 + 6 + 3 + 4 = 81 (${score})`);
  const reveal = buildArcadeReveal("snake", { state: { ...crashed, eaten: 13, goldLeft: 2 * base11.goldLife!, comboPts: 6, laneRides: 3, warpPts: 4 }, pellets: 13 }, score);
  ok(Boolean(reveal && reveal.lines[0] === "13 stars (120 at 27) → 57" && reveal.lines[1] === "Gold 11/40 · combos 6/20 · lanes 3/10 · warps 4/10 +24" && reveal.lines[2] === "Total → 81"), `the reveal lists each part: ${JSON.stringify(reveal?.lines)}`);
  const reveal1 = buildArcadeReveal("snake", { state: crashed, pellets: 0 }, 1);
  ok(Boolean(reveal1 && reveal1.lines.join(" | ") === "0 stars → 0 | Run played +1 | Total → 1"), `a played run with nothing: ${JSON.stringify(reveal1?.lines)}`);
}

/* 5. Bots. */
const LEVELS = ["average", "good", "great", "elite"] as const;
if (RECORD) {
  const runs: any[] = [];
  for (const level of LEVELS)
    for (let n = 0; n < 6; n++) {
      const seed = spec.seedFor(n);
      const out = bot({ game: v11, seed, rev: SNAKE_REV_STD, human: new Human("snake", seed, level) } as any);
      const checkpoints: unknown[] = [];
      const state = play(v11, seed, out.events ?? [], (s) => {
        if (s.tick % 300 === 0) checkpoints.push(spec.checkpoint(s));
      });
      const raw = spec.encode({ seed, claimedScore: v11.score(state), events: out.events ?? [], endTick: state.tick, checkpoints }, SNAKE_REV_STD, seed);
      const result = spec.replay(seed, raw, SNAKE_REV_STD);
      runs.push({ level, seed, raw, score: result.score, digest: digest(result.state) });
    }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recorded: "snakeRev 11 (the arcade scoring standard), 29 Oct 2026", runs })));
  console.log(`wrote ${FIXTURE} (${runs.length} runs)`);
}
const recorded = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { runs: any[] };
ok(recorded.runs.length === 24, `24 stored snakeRev 11 runs (got ${recorded.runs.length})`);
for (const run of recorded.runs) {
  const now = spec.replay(run.seed, run.raw, SNAKE_REV_STD);
  const tag = `${run.level} seed ${run.seed}`;
  ok(!now.flagged, `${tag}: replays unflagged (${now.reason ?? ""})`);
  ok(now.score === run.score && digest(now.state) === run.digest, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
  ok(now.score >= 1 && now.score <= 200, `${tag}: played, 1–200`);
  const p = snakeStdParts(now.state);
  ok(p.core + p.gold + p.combo + p.lane + p.warp === now.score || (now.score === 1 && p.core + p.gold + p.combo + p.lane + p.warp === 0), `${tag}: the parts add up to the score`);
  ok(Object.entries(SNAKE_STD_CAPS).every(([k, cap]) => (p as any)[k] <= cap) && p.core <= SNAKE_STD_CORE_MAX, `${tag}: each part within its maximum`);
}

if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  console.log(`FAIL snake-standard-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS snake-standard-check: ${checks} checks — wiring and the perfect 200, ${legacy.runs.length} legacy runs unchanged, 60 worlds, same play as snakeRev 10, scripted rules, ${recorded.runs.length} stored runs`);
