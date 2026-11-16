/**
 * pool-levels-check (the Sports overhaul's stage 3, 15 Nov 2026; docs/arcade-standard/pool.md "Levels"; no browser,
 * ~30 s, `CHECKS_FULL=1` replays every witness at every level): Cue Ball's four levels on the difficulty framework.
 *
 *   1. Normal is today's game byte for byte: a Normal deal is the deal with no levels at all (the registry stood out),
 *      on many seeds, and a Normal run's state carries no `level`.
 *   2. Each level stamps `level` on the same deal (the layouts never change with the level).
 *   3. The registry (gameLevels.ts) mirrors the sim's tables: Easy 5, Normal 10, Hard 10, Expert 15 a foul, and each
 *      level's preview.
 *   4. A foul's cost is graded from the stored puzzle's level: the same run of fouls, graded at each level through the
 *      server's own gradeAnswer, differs by exactly fouls × the cost; Normal grades exactly as an unlevelled puzzle.
 *   5. The preview each level draws (pixels, through the real renderer): Easy shows more of the lines than Normal,
 *      Normal more than Hard, Hard more than Expert, and Expert still the ghost ball and its line.
 *   6. 200 is reachable at every level: poolRev 4's proved bank's witnesses (no fouls) replay to 200 through the server
 *      replay with each level stamped.
 *   7. Older stamps are unchanged: a poolRev 3 run graded with a level stamped scores exactly as without one.
 *   8. The bot's perception is neutral on Normal (no extra error, no extra draw), the intro's level line names each
 *      level's preview and foul cost, and Normal has none (today's intro).
 *
 *   bun scripts/pool-levels-check.ts
 */
import { readFileSync } from "node:fs";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

import { poolBlackOpen, poolGameFor, poolGameForPuzzle, poolPenalty, POOL_CUE, POOL_LEVEL_BLACK_AT, POOL_LEVEL_FOUL, POOL_SPOTS, POOL_LEVEL_PREVIEW, POOL_W, POOL_H, type PoolState } from "../src/lib/arcade/pool";
import { drawPool, poolBlackStatus, type PoolAim } from "../src/lib/arcade/pool.renderer";
import { replayPoolRun } from "../src/lib/duel/pool";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { Level } from "../src/lib/levels/levels";
import { gameLevelSettings, levelsOf, withGameLevels } from "../src/lib/levels/gameLevels";
import { POOL_PERCEPTION } from "./arcade-skill-bands/bots/pool";
import { poolLevelLine } from "../src/puzzles/pool";
import { playPool, poolRunRaw } from "./pool-levels-tune";
import { dealAt } from "./level-tune";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;

const FULL = process.env["CHECKS_FULL"] === "1";
const failures: string[] = [];
let passes = 0;
const ok = (cond: boolean, line: string) => {
  if (cond) {
    passes++;
    console.log(`  ok ${line}`);
  } else {
    failures.push(line);
    console.log(`  FAIL ${line}`);
  }
};
const LEVELS = ["easy", "hard", "expert"] as const;
const deal = (n: number, level?: string) => dealAt("pool", (level ?? "normal") as Level, n) as unknown as Record<string, unknown>;

console.log("1. Normal is today's game");
ok(levelsOf("pool").join() === "easy,normal,hard,expert", `Cue Ball offers ${levelsOf("pool").join(", ")}`);
let same = 0;
const SEEDS = FULL ? 400 : 60;
for (let n = 0; n < SEEDS; n++) {
  const today = withGameLevels({}, () => deal(n));
  if (JSON.stringify(deal(n)) === JSON.stringify(today) && JSON.stringify(deal(n, "normal")) === JSON.stringify(today)) same++;
}
ok(same === SEEDS, `a Normal deal is byte for byte the deal without levels on ${same} of ${SEEDS} seeds`);
const normalState = poolGameForPuzzle(deal(3) as never).init(Number(deal(3)["seed"]));
ok(!("level" in normalState), "a Normal run's state carries no level");
ok(JSON.stringify(normalState) === JSON.stringify(poolGameFor(4).init(Number(deal(3)["seed"]))), "a Normal run starts from today's poolRev 4 state exactly");

console.log("2. Each level stamps the same deal");
for (const lv of LEVELS) {
  let good = 0;
  for (let n = 0; n < 30; n++) {
    const d = deal(n, lv);
    const { level, ...rest } = d;
    if (level === lv && JSON.stringify(rest) === JSON.stringify(deal(n))) good++;
  }
  ok(good === 30, `${lv}: every deal is Normal's deal with level "${lv}" (${good} of 30)`);
}

console.log("3. The registry mirrors the sim");
for (const lv of LEVELS) {
  const s = gameLevelSettings<{ foul: number; preview: string }>("pool", lv);
  ok(!!s && s.foul === POOL_LEVEL_FOUL[lv] && s.preview === POOL_LEVEL_PREVIEW[lv], `${lv}: a foul costs ${POOL_LEVEL_FOUL[lv]}, the preview "${POOL_LEVEL_PREVIEW[lv]}"`);
}
ok(POOL_LEVEL_FOUL.easy === 5 && POOL_LEVEL_FOUL.normal === 10 && POOL_LEVEL_FOUL.hard === 10 && POOL_LEVEL_FOUL.expert === 15, "Joe's foul costs: Easy 5, Normal 10, Hard 10, Expert 15");

console.log("4. A foul's cost comes from the stored puzzle's level");
{
  // An average player's run with fouls; the same shots are played at each level (the layouts and physics are the same,
  // only a foul's cost differs), each log sent as the phone would send it at that level and graded by the server.
  let found = false;
  for (let n = 0; n < 40 && !found; n++) {
    const r = playPool("normal", "average", n);
    if (r.fouls < 1 || r.score < 60) continue;
    found = true;
    const plainPuzzle = withGameLevels({}, () => dealAt("pool", "normal", n));
    const plain = gradeAnswer(plainPuzzle, poolRunRaw(plainPuzzle, r.events).raw, 0).score;
    ok(r.score === plain, `deal ${n}: Normal grades exactly as the unlevelled puzzle (${plain}, ${r.fouls} foul(s))`);
    for (const lv of LEVELS) {
      const puzzle = dealAt("pool", lv, n);
      const { raw, state } = poolRunRaw(puzzle, r.events);
      const got = gradeAnswer(puzzle, raw, 0).score;
      const want = Math.max(1, Math.min(200, plain + r.fouls * (POOL_LEVEL_FOUL.normal - POOL_LEVEL_FOUL[lv])));
      ok(got === want && state.fouls === r.fouls, `deal ${n}: ${lv} scores ${got} (Normal ${plain} + ${r.fouls} × ${POOL_LEVEL_FOUL.normal - POOL_LEVEL_FOUL[lv]})`);
      ok(poolPenalty(state) === r.fouls * POOL_LEVEL_FOUL[lv], `deal ${n}: the ${lv} penalty is ${r.fouls} × ${POOL_LEVEL_FOUL[lv]}`);
      // A log claiming Normal's score at this level is caught by the server's replay (the level is read, not trusted).
      const normalRaw = poolRunRaw(plainPuzzle, r.events).raw;
      if (lv !== "hard") ok(replayPoolRun(Number((puzzle as unknown as { seed: number }).seed), normalRaw, 4, lv).flagged, `deal ${n}: Normal's claimed score is flagged at ${lv}`);
    }
  }
  ok(found, "a run with fouls was found to grade at every level");
}

console.log("5. The preview each level draws");
{
  // A table with the cue ball lined up on an object ball, the aim straight at it.
  const s = poolGameFor(4).init(Number(deal(0)["seed"])) as PoolState;
  const cue = s.balls.find((b) => b.id === POOL_CUE)!;
  const target = s.balls.find((b) => b.id !== POOL_CUE && !b.down)!;
  const dx = target.x - cue.x;
  const dy = target.y - cue.y;
  const frame = (preview: PoolAim["preview"] | "none") => {
    const c = createCanvas(POOL_W, POOL_H);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawPool(ctx, s, preview === "none" ? null : ({ dx, dy, power: 0.6, spinX: 0, spinY: 0, ...(preview && preview !== "normal" ? { preview } : {}) } as PoolAim));
    return c.getContext("2d").getImageData(0, 0, POOL_W, POOL_H).data;
  };
  const bare = frame("none");
  // Pixels the aim changes from the table with no aim drawn (the cue, the ghost ball and the lines).
  const lit = (preview: PoolAim["preview"] | "none") => {
    const px = frame(preview);
    let n = 0;
    for (let i = 0; i < px.length; i += 4) if (Math.abs(px[i]! - bare[i]!) + Math.abs(px[i + 1]! - bare[i + 1]!) + Math.abs(px[i + 2]! - bare[i + 2]!) > 24) n++;
    return n;
  };
  const counts = { none: lit("none"), ghost: lit("ghost"), short: lit("short"), normal: lit("normal"), long: lit("long") };
  console.log(`    pixels the aim changes: none ${counts.none}, Expert ${counts.ghost}, Hard ${counts.short}, Normal ${counts.normal}, Easy ${counts.long}`);
  ok(counts.long > counts.normal, "Easy shows more of the lines than Normal");
  ok(counts.normal > counts.short, "Normal shows more than Hard (Hard's object-ball line is shorter)");
  ok(counts.short > counts.ghost, "Hard shows more than Expert (Expert: no object-ball or cue-ball line)");
  ok(counts.ghost > counts.none, "Expert still draws the ghost ball and the line to it");
  const plain = (() => {
    const c = createCanvas(POOL_W, POOL_H);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawPool(ctx, s, { dx, dy, power: 0.6, spinX: 0, spinY: 0 });
    return c.toBuffer("image/png");
  })();
  const normal = (() => {
    const c = createCanvas(POOL_W, POOL_H);
    const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
    drawPool(ctx, s, { dx, dy, power: 0.6, spinX: 0, spinY: 0, preview: "normal" });
    return c.toBuffer("image/png");
  })();
  ok(plain.equals(normal), "Normal's preview is today's preview, pixel for pixel");
}

console.log("6. 200 at every level");
{
  const witnesses = JSON.parse(readFileSync("scripts/fixtures/pool-witness-v4.json", "utf8")) as Record<string, string>;
  const entries = Object.entries(witnesses).slice(0, FULL ? undefined : 12);
  for (const lv of ["normal", ...LEVELS] as const) {
    let at200 = 0;
    for (const [seed, raw] of entries) {
      const r = replayPoolRun(Number(seed), raw, 4, lv === "normal" ? undefined : lv);
      if (!r.flagged && r.score === 200) at200++;
    }
    ok(at200 === entries.length, `${lv}: ${at200} of ${entries.length} proved witnesses replay to 200 with the level stamped`);
  }
}

console.log("7. Older stamps are unchanged");
{
  const witnesses = JSON.parse(readFileSync("scripts/fixtures/pool-witness-v3.json", "utf8")) as Record<string, string>;
  let same = 0;
  const entries = Object.entries(witnesses).slice(0, 8);
  for (const [seed, raw] of entries) {
    const plain = replayPoolRun(Number(seed), raw, 3);
    const levelled = replayPoolRun(Number(seed), raw, 3, "expert");
    if (plain.score === levelled.score && JSON.stringify(plain.state) === JSON.stringify(levelled.state)) same++;
  }
  ok(same === entries.length, `poolRev 3: a level stamped changes nothing (${same} of ${entries.length} runs identical)`);
}

console.log("8. The bot's perception and the intro's line");
ok(POOL_PERCEPTION.normal.aim === 1 && POOL_PERCEPTION.normal.judge === 0 && POOL_PERCEPTION.normal.leave === 1, "the bot plays Normal exactly as before (no extra error, no extra draw)");
ok(POOL_PERCEPTION.ghost.judge >= POOL_PERCEPTION.short.judge && POOL_PERCEPTION.short.judge > 0 && POOL_PERCEPTION.long.aim < 1, "the perception follows the preview: Easy surer, Hard and Expert less sure, Expert the least");
ok(poolLevelLine(undefined) === null && poolLevelLine("normal") === null, "Normal's intro has no level line (today's intro)");
for (const lv of LEVELS) {
  const line = poolLevelLine(lv) ?? "";
  ok(line.includes(String(POOL_LEVEL_FOUL[lv])) && line.length <= 90, `${lv}: "${line}"`);
}

console.log("9. Easy's black opens at 5 of 7 (Joe, 16 Nov 2026); every other level all seven first");
{
  ok(POOL_LEVEL_BLACK_AT.easy === 2 && POOL_LEVEL_BLACK_AT.normal === 0 && POOL_LEVEL_BLACK_AT.hard === 0 && POOL_LEVEL_BLACK_AT.expert === 0, "the black opens with 2 of your 7 up on Easy, with none up at Normal, Hard and Expert");
  ok(gameLevelSettings<{ blackAt: number }>("pool", "easy")?.blackAt === POOL_LEVEL_BLACK_AT.easy, "the registry's Easy blackAt mirrors the sim's");
  ok((poolLevelLine("easy") ?? "").includes(`${POOL_SPOTS - POOL_LEVEL_BLACK_AT.easy} of your 7`), "Easy's intro line names the black's opening");
  for (const [lv, down, open] of [["easy", 4, false], ["easy", 5, true], ["easy", 7, true], [undefined, 6, false], [undefined, 7, true], ["hard", 6, false], ["expert", 6, false]] as const) {
    const st = { spotsDown: down, black: 0, level: lv } as const;
    ok(poolBlackOpen(st) === open && poolBlackStatus(st) === (open ? "open" : "locked"), `${lv ?? "normal"} with ${down} of 7 down: the black is ${open ? "open" : "locked"} (sim and display agree)`);
  }
  // Easy average players' runs: a legal black (the black part) only ever with 5+ of their 7 down, and some clear early.
  let early = 0;
  let wrong = 0;
  let normalWrong = 0;
  const N = FULL ? 60 : 20;
  for (let n = 0; n < N; n++) {
    const e = playPool("easy", "average", n);
    const st = e.state as PoolState;
    if (st.black === 1 && st.spotsDown < POOL_SPOTS - POOL_LEVEL_BLACK_AT.easy) wrong++;
    if (st.black === 1 && st.spotsDown < POOL_SPOTS) early++;
    const m = playPool("normal", "average", n).state as PoolState;
    if (m.black === 1 && m.spotsDown < POOL_SPOTS) normalWrong++;
  }
  ok(wrong === 0, `Easy: no legal black with fewer than 5 of 7 down (${N} average runs)`);
  ok(early > 0, `Easy: average players pot the black early (at 5 or 6 of 7) on ${early} of ${N} runs`);
  ok(normalWrong === 0, `Normal: a legal black only after all seven (${N} average runs)`);
}

if (failures.length) {
  console.log(`FAIL pool-levels-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`PASS pool-levels-check: ${passes} checks`);
