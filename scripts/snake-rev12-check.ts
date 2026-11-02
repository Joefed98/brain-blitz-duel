/**
 * snake-rev12-check (1 Nov 2026, docs/arcade-standard/snake.md "snakeRev 12"): Meteor snakeRev 12. snakeRev 11's world,
 * play and parts exactly, with the core counting each gold comet star (the bigger star that appears now and then) as 2
 * stars and full at 28 core stars (snakeRev 11: 27 stars eaten; 20 until 2 Nov 2026, before it shipped).
 *
 *  1. Wiring: rooms deal snakeRev 12; the "?" help reads its core line (SNAKE_V12_BAND_CURVE: 0 → 0, 28 → 120) and says
 *     a gold star counts 2, the core is full at 28 and the parts make 200; the intro says so in under 90 characters;
 *     the standard module names snakeRev 12 and its perfect run scores 200 with every part at its maximum; ROUND_MAX 200;
 *     snakeRev 11's world size; snakeRev 12 keeps snakeRev 10's play for the band-era checks (playRevOf); the intro
 *     demo plays only when recorded on snakeRev 12; the HUD counts the core's stars.
 *  2. Older stamps unchanged: 56 runs on unstamped and snakeRev 1–11 rounds (12 on snakeRev 11, the stamp rooms dealt
 *     before), recorded on unmodified main ae1efbe (scripts/fixtures/snake-rev12-legacy.json.gz,
 *     scripts/snake-rev12-legacy.ts), replay to the same score, flag, final state and checkpoints, with no `gold2`.
 *  3. The same world and the same play: on 60 room seeds snakeRev 12's start is snakeRev 11's plus `gold2: 1`; bot logs
 *     at every level played on both stamps give the same state tick for tick (but `gold2`), every part but the core the
 *     same, and the core never lower on snakeRev 12.
 *  4. The rules, scripted: the core's straight line (120 × core stars ÷ 28 rounded down, 120 at 28, nothing more after); a gold star eaten in
 *     the sim adds 2 core stars and its gold-part worth as on snakeRev 11 (eating one never costs core); 14 stars and 3
 *     gold stars fill the core; caps, at least 1 for a played run, 0 with no input; the reveal's lines; grading's parts.
 *  5. Bots: snakeRev 12 runs (scripts/fixtures/snake-rev12-runs.json.gz, `--record` to re-record) replay through the
 *     server path to their stored score and state, unflagged, 1–200, parts adding up to the score.
 *
 *   bun scripts/snake-rev12-check.ts [--record]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gunzipSync, gzipSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS } from "./arcade-skill-bands/human";
import { entry } from "./arcade-standard/snake";
import type { StdRun } from "./arcade-standard/entry";
import { playRevOf } from "./scoring-targets-revs";
import { digest, type SnakeLegacyRecord } from "./snake-rev12-legacy";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { ROUND_MAX } from "../src/lib/duel/roundMax";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { LIVE_BANDS } from "../src/lib/arcade/liveBands";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { buildArcadeReveal } from "../src/lib/arcade/reveal";
import {
  snakeGameFor, snakeStdParts, snakeCoreStars, snakeV12Core, snakeStdCore, snakeRow, snakeWorldHForRev, snakeWorldWForRev,
  SNAKE_REV_STD, SNAKE_REV_12, SNAKE_V12_BAND_CURVE, SNAKE_V12_CORE_STARS, SNAKE_V12_GOLD_CORE, SNAKE_V9_COLS, SNAKE_V9_ROWS,
  SNAKE_STD_CAPS, SNAKE_STD_CORE_MAX, SNAKE_INPUT_TURN,
  type SnakeState,
} from "../src/lib/arcade/snake";

const RECORD = process.argv.includes("--record");
const LEGACY = "scripts/fixtures/snake-rev12-legacy.json.gz";
const FIXTURE = "scripts/fixtures/snake-rev12-runs.json.gz";
const COLS = SNAKE_V9_COLS;
let checks = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond && failures.length < 80) failures.push(label);
};
const spec = GAME_BY_TYPE.get("snake" as never)!;
const v11 = snakeGameFor(SNAKE_REV_STD);
const v12 = snakeGameFor(SNAKE_REV_12);
const quiet = <T>(fn: () => T): T => {
  const error = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
  }
};
const play = (game: typeof v12, seed: number, events: any[], each?: (s: SnakeState) => void): SnakeState => {
  const by = new Map(events.map((e: any) => [e.t, e]));
  let state = game.init(seed) as SnakeState;
  while (!game.isOver(state)) {
    state = game.step(state, by.get(state.tick + 1) ?? null);
    each?.(state);
  }
  return state;
};
const without = (s: SnakeState) => {
  const { gold2: _g, ...rest } = s;
  return rest as SnakeState;
};

/* 1. Wiring. */
ok((generatePuzzle("snake") as any).snakeRev === SNAKE_REV_12 && SNAKE_REV_12 === SNAKE_REV_STD + 1, "rooms deal snakeRev 12 (snakeRev 11 before 1 Nov 2026)");
ok(LIVE_BANDS.snake.rev === SNAKE_REV_12 && LIVE_BANDS.snake.curve === SNAKE_V12_BAND_CURVE, "the help reads snakeRev 12's core line");
ok(JSON.stringify(SNAKE_V12_BAND_CURVE.units) === JSON.stringify([0, 28]) && JSON.stringify(SNAKE_V12_BAND_CURVE.points) === JSON.stringify([0, 120]), "the help's curve is the straight line 0 → 0, 20 → 120");
ok(SNAKE_V12_CORE_STARS === 28 && SNAKE_V12_GOLD_CORE === 2, "the core is full at 28 core stars; a gold star counts 2");
ok(ROUND_MAX.snake === 200, "ROUND_MAX: Meteor is 200");
ok(snakeWorldWForRev(SNAKE_REV_12) === snakeWorldWForRev(SNAKE_REV_STD) && snakeWorldHForRev(SNAKE_REV_12) === snakeWorldHForRev(SNAKE_REV_STD), "snakeRev 12 plays in snakeRev 11's world");
ok(playRevOf("snake", SNAKE_REV_12) === 10 && playRevOf("snake", SNAKE_REV_STD) === 10, "snakeRev 12 keeps snakeRev 10's play for the band-era checks (as snakeRev 11 does)");
{
  const help = PUZZLE_INSTRUCTIONS.snake.score;
  ok(help.includes("each big gold star 2") && help.includes("up to 120") && help.includes("A good run (100 points) counts 24 stars") && help.includes("Stars are full at 28"), `the help says a gold star counts 2 and the core is full at 20: ${help}`);
  ok(help.includes("Gold stars also add up to 40, combos up to 20, lane rides up to 10 and warp stars up to 10: 120 + 80 = 200") && help.endsWith("Up to 200."), "the help lists every part and their 200");
  const gold = PUZZLE_INSTRUCTIONS.snake.how.find((l) => l.action.startsWith("Gold comet stars"));
  ok(Boolean(gold?.detail.includes("counts as 2 stars")), "the help's gold-star line says it counts as 2 stars");
  const intro = INTRO_SCORE.snake;
  ok(intro.length <= 90 && intro.includes("120 at 28") && intro.includes("gold stars count 2") && intro.includes("200"), `the intro states the core, the gold stars' 2 and the top: ${intro}`);
  const demo = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  ok(demo.includes('demo.puzzle.snakeRev !== SNAKE_REV_12) return null;'), "the intro demo plays only when recorded on snakeRev 12");
  const renderer = readFileSync("src/lib/arcade/snake.renderer.ts", "utf8");
  ok(renderer.includes("`STARS ${snakeCoreStars(state)}`") && !renderer.includes("`STARS ${state.eaten}`"), "the HUD counts the core's stars");
}
{
  const perfect = (entry.perfect() as StdRun[])[0]!;
  ok(entry.type === "snake" && entry.field === "snakeRev" && entry.rev === SNAKE_REV_12, "the standard module names snakeRev 12");
  ok(entry.parts.reduce((a, p) => a + p.max, 0) === 200, "the parts' maxima add up to 200");
  ok(JSON.stringify(entry.parts.map((p) => [p.key, p.max])) === JSON.stringify([["core", 120], ["gold", 40], ["combo", 20], ["lane", 10], ["warp", 10]]), "parts: core 120, gold 40, combo 20, lane 10, warp 10 (unchanged)");
  ok(perfect.score === 200, `the perfect run scores 200 (got ${perfect.score})`);
  for (const p of entry.parts) ok(perfect.parts![p.key] === p.max, `the perfect run's ${p.key} is ${p.max} (got ${perfect.parts![p.key]})`);
}

/* 2. Older stamps unchanged (recorded on main before snakeRev 12). */
const legacy = JSON.parse(gunzipSync(readFileSync(LEGACY)).toString()) as { runs: SnakeLegacyRecord[] };
ok(legacy.runs.length === 56, `56 legacy runs (got ${legacy.runs.length})`);
for (const rev of [null, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) ok(legacy.runs.filter((r) => r.rev === rev).length === 4, `4 legacy runs on snakeRev ${rev ?? "unstamped"}`);
ok(legacy.runs.filter((r) => r.rev === 11).length === 12, "12 legacy runs on snakeRev 11");
for (const run of legacy.runs) {
  const raw = gunzipSync(Buffer.from(run.raw, "base64")).toString();
  const now = quiet(() => spec.replay(run.seed, raw, run.rev));
  const tag = `snakeRev ${run.rev ?? "unstamped"} ${run.level} seed ${run.seed}`;
  ok(now.score === run.score, `${tag}: replays to its stored ${run.score} (got ${now.score})`);
  ok(Boolean(now.flagged) === run.flagged, `${tag}: flagged ${run.flagged} as recorded`);
  ok(digest(now.state) === run.digest, `${tag}: identical final state`);
  ok(digest(now.checkpoints) === run.checkpoints, `${tag}: identical checkpoints`);
  ok(now.state.gold2 === undefined, `${tag}: no snakeRev 12 field`);
}

/* 3. The same world, the same play. */
for (let n = 0; n < 60; n++) {
  const seed = spec.seedFor(n);
  const a = v12.init(seed) as SnakeState;
  ok(JSON.stringify(a) === JSON.stringify(v12.init(seed)), `seed ${seed}: the same world twice`);
  ok(JSON.stringify(a) === JSON.stringify({ ...(v11.init(seed) as SnakeState), gold2: 1 }), `seed ${seed}: snakeRev 11's world plus gold2`);
}
const { bot } = await import("./arcade-skill-bands/bots/snake");
let goldRuns = 0;
for (const level of ALL_LEVELS)
  for (let n = 0; n < 3; n++) {
    const seed = spec.seedFor(300 + n);
    const out = bot({ game: v12, seed, rev: SNAKE_REV_12, human: new Human("snake", seed, level) } as any);
    // The bot plays the same on both stamps (it reads only snakeRev 11's fields).
    const out11 = bot({ game: v11, seed, rev: SNAKE_REV_STD, human: new Human("snake", seed, level) } as any);
    ok(JSON.stringify(out.events ?? []) === JSON.stringify(out11.events ?? []), `${level} seed ${seed}: the bot plays the same log on snakeRev 11 and 12`);
    const old: string[] = [];
    play(v11, seed, out.events ?? [], (s) => old.push(JSON.stringify(s)));
    let tick = 0;
    let same = true;
    const end = play(v12, seed, out.events ?? [], (s) => {
      if (JSON.stringify(without(s)) !== old[tick++] || s.gold2 !== 1) same = false;
    });
    ok(same && tick === old.length, `${level} seed ${seed}: the same log plays the same on snakeRev 11 and 12, tick for tick (but gold2)`);
    const p12 = snakeStdParts(end);
    const p11 = snakeStdParts(without(end));
    ok(p12.gold === p11.gold && p12.combo === p11.combo && p12.lane === p11.lane && p12.warp === p11.warp, `${level} seed ${seed}: every part but the core as on snakeRev 11`);
    ok(p12.core === snakeV12Core(end.eaten + 2 * (end.goldsEaten ?? 0)) && p12.core >= p11.core, `${level} seed ${seed}: the core counts gold stars twice and is never lower (${p11.core} → ${p12.core})`);
    if ((end.goldsEaten ?? 0) > 0) goldRuns++;
  }
ok(goldRuns >= 10, `bot runs eat gold stars (${goldRuns} of 21)`);

/* 4. The rules, scripted. */
{
  let line = true;
  for (let n = 0; n <= 60; n++) {
    const want = Math.trunc((120 * Math.min(n, 28)) / 28);
    if (snakeV12Core(n) !== want || bandPoints(SNAKE_V12_BAND_CURVE, n) !== want) line = false;
  }
  ok(line, "core = trunc(120 × min(core stars, 28) ÷ 28), the help curve's own line");
  ok(snakeV12Core(1) === 4 && snakeV12Core(27) === 115 && snakeV12Core(28) === 120 && snakeV12Core(40) === 120, "4 for one core star: 115 at 27, 120 at 28, still 120 at 40");
  // snakeRev 11's line is unchanged.
  ok(snakeStdCore(27) === 120 && snakeStdCore(26) < 120 && snakeStdCore(20) === 88, "snakeRev 11 keeps its line (120 at 27)");
  const base = { ...(v12.init(5) as SnakeState), acted: 1 };
  ok(snakeCoreStars({ ...base, eaten: 9, goldsEaten: 3 }) === 15 && snakeCoreStars({ ...without(base), eaten: 9, goldsEaten: 3 }) === 9, "core stars: 9 stars and 3 gold stars count 15 (snakeRev 11: 9)");
  ok(snakeStdParts({ ...base, eaten: 22, goldsEaten: 3 }).core === 120 && snakeStdParts({ ...base, eaten: 21, goldsEaten: 3 }).core === 115, "22 stars and 3 gold stars fill the core; 21 and 3 do not");
  ok(snakeStdParts({ ...without(base), eaten: 14, goldsEaten: 3 }).core === snakeStdCore(14), "snakeRev 11 never counts a gold star towards the core");
}
{
  // A gold star eaten in the sim: +2 core stars (+12 core) and its gold-part worth exactly as on snakeRev 11.
  const s0 = { ...(v12.init(spec.seedFor(3)) as SnakeState), acted: 1, rocks: [], rockWarn: -1 } as SnakeState;
  const life = s0.goldLife!;
  const g = s0.golds!.find((x) => snakeRow(x.cell, COLS) < SNAKE_V9_ROWS - 4 && ![1, 2, 3].some((k) => s0.warps!.includes(x.cell + k * COLS)))!;
  const eat = (game: typeof v12, b: SnakeState) =>
    game.step({ ...b, body: [g.cell + COLS, g.cell + 2 * COLS, g.cell + 3 * COLS], dir: 0, nextDir: 0, sinceMove: 50, gold: g.cell, goldEnd: 3000 + life, tick: 3000, eaten: 5, goldLeft: 0, goldPts: 0, goldsEaten: 0 }, null);
  const a = eat(v12, s0);
  const b = eat(v11, without(s0));
  ok(a.goldsEaten === 1 && a.eaten === 5 && snakeCoreStars(a) === 7, `a gold star eaten: 5 stars + 2 = 7 core stars (got ${snakeCoreStars(a)}), the meteor no longer`);
  ok(snakeStdParts(a).core === snakeV12Core(7) && snakeStdParts(a).core - snakeV12Core(5) === 9, "a gold star adds 9 to the core (21 → 30 at 5 → 7 core stars)");
  ok(snakeStdParts(a).gold === snakeStdParts(b).gold && a.goldLeft === b.goldLeft && snakeStdParts(a).gold === Math.trunc(40 / 7), `and pays its gold part as on snakeRev 11 (${snakeStdParts(a).gold})`);
  ok(a.body.length === b.body.length && JSON.stringify(without(a)) === JSON.stringify(b), "eating it plays exactly as on snakeRev 11");
}
{
  const crashed: SnakeState = { ...(v12.init(spec.seedFor(3)) as SnakeState), acted: 1, dead: true, eaten: 0, tick: 400 };
  ok(v12.score(crashed) === 1, "a played run with nothing scores 1");
  ok(v12.score({ ...crashed, acted: 0 }) === 0, "no input scores 0");
  let idle = v12.init(spec.seedFor(3)) as SnakeState;
  while (!v12.isOver(idle)) idle = v12.step(idle, null);
  ok(v12.score(idle) === 0, "a run with no input scores 0");
  let one = v12.init(spec.seedFor(3)) as SnakeState;
  one = v12.step(one, { t: 1, k: SNAKE_INPUT_TURN, a: 3, b: 0, c: 0, d: 0 });
  while (!v12.isOver(one)) one = v12.step(one, null);
  ok(v12.score(one) >= 1, `one swipe, then nothing: at least 1 (${v12.score(one)})`);
  ok(v12.score({ ...crashed, eaten: 60, goldsEaten: 7, goldLeft: 99999, comboPts: 99, laneRides: 99, warpPts: 99 }) === 200, "everything past its cap: 200");
  const life = crashed.goldLife!;
  const st = { ...crashed, eaten: 13, goldsEaten: 2, goldLeft: 2 * life, comboPts: 6, laneRides: 3, warpPts: 4 };
  const parts = snakeStdParts(st);
  const score = v12.score(st);
  ok(parts.core === 72 && parts.gold === 11 && parts.combo === 6 && parts.lane === 3 && parts.warp === 4 && score === 96, `13 stars, 2 gold, 6 combo, 3 rides, 2 warp stars: 72 + 11 + 6 + 3 + 4 = 96 (${score}; snakeRev 11: ${v11.score(without(st))})`);
  const reveal = buildArcadeReveal("snake", { state: st, pellets: 13 }, score);
  ok(Boolean(reveal && reveal.lines[0] === "13 stars + 2 gold ×2 (120 at 28) → 72" && reveal.lines[1] === "Gold 11/40 · combos 6/20 · lanes 3/10 · warps 4/10 +24" && reveal.lines[2] === "Total → 96"), `the reveal lists each part: ${JSON.stringify(reveal?.lines)}`);
  const plain = { ...st, goldsEaten: 0, goldLeft: 0 };
  const reveal0 = buildArcadeReveal("snake", { state: plain, pellets: 13 }, v12.score(plain));
  ok(Boolean(reveal0 && reveal0.lines[0] === "13 stars (120 at 28) → 55"), `with no gold star: ${JSON.stringify(reveal0?.lines)}`);
  const reveal1 = buildArcadeReveal("snake", { state: crashed, pellets: 0 }, 1);
  ok(Boolean(reveal1 && reveal1.lines.join(" | ") === "0 stars → 0 | Run played +1 | Total → 1"), `a played run with nothing: ${JSON.stringify(reveal1?.lines)}`);
  // snakeRev 11's reveal is unchanged.
  const reveal11 = buildArcadeReveal("snake", { state: without(st), pellets: 13 }, v11.score(without(st)));
  ok(Boolean(reveal11 && reveal11.lines[0] === "13 stars (120 at 27) → 57"), `snakeRev 11's reveal unchanged: ${JSON.stringify(reveal11?.lines)}`);
  ok(SNAKE_STD_CORE_MAX + SNAKE_STD_CAPS.gold + SNAKE_STD_CAPS.combo + SNAKE_STD_CAPS.lane + SNAKE_STD_CAPS.warp === 200, "the sim's maxima add up to 200");
}

/* 5. Bots. */
const LEVELS = ["weak", "average", "good", "great", "elite", "perfect"] as const;
if (RECORD) {
  const runs: any[] = [];
  for (const level of LEVELS)
    for (let n = 0; n < 3; n++) {
      const seed = spec.seedFor(400 + n);
      const out = bot({ game: v12, seed, rev: SNAKE_REV_12, human: new Human("snake", seed, level) } as any);
      const checkpoints: unknown[] = [];
      const state = play(v12, seed, out.events ?? [], (s) => {
        if (s.tick % 300 === 0) checkpoints.push(spec.checkpoint(s));
      });
      const raw = spec.encode({ seed, claimedScore: v12.score(state), events: out.events ?? [], endTick: state.tick, checkpoints }, SNAKE_REV_12, seed);
      const result = spec.replay(seed, raw, SNAKE_REV_12);
      runs.push({ level, seed, raw, score: result.score, digest: digest(result.state) });
    }
  writeFileSync(FIXTURE, gzipSync(JSON.stringify({ recorded: "snakeRev 12 (gold stars count 2 towards the core, full at 28), 2 Nov 2026", runs })));
  console.log(`wrote ${FIXTURE} (${runs.length} runs)`);
}
const recorded = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as { runs: any[] };
ok(recorded.runs.length === 18, `18 stored snakeRev 12 runs (got ${recorded.runs.length})`);
for (const run of recorded.runs) {
  const now = spec.replay(run.seed, run.raw, SNAKE_REV_12);
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
  console.log(`FAIL snake-rev12-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(`PASS snake-rev12-check: ${checks} checks — wiring and the perfect 200, ${legacy.runs.length} legacy runs unchanged, 60 worlds, same play as snakeRev 11, scripted rules, ${recorded.runs.length} stored runs`);
