/**
 * Meteor snakeRev 12's tuning report (1 Nov 2026, docs/arcade-standard/snake.md "snakeRev 12"): the skill-band bots
 * (scripts/arcade-skill-bands/bots/snake.ts, weak → flawless) play snakeRev 12 on room seeds, each run replayed through
 * the server path, and the report gives per level the median score on snakeRev 12 and on snakeRev 11 (the same final
 * state scored without `gold2`: the two stamps play identically, snake-rev12-check proves it), stars eaten, gold stars
 * eaten, the core's stars (a gold star 2), each part, and how often the core is full.
 *
 * --targets=20,25,30 also gives each level's median score were the core full at that many core stars (what-if only).
 *
 *   bun scripts/snake-rev12-bands.ts [--seeds=60] [--from=0] [--levels=weak,average,...] [--targets=20,25,30]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/snake";
import { snakeGameFor, snakeStdParts, snakeStdScore, snakeCoreStars, SNAKE_REV_12, SNAKE_STD_CORE_MAX, type SnakeState } from "../src/lib/arcade/snake";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 60);
const FROM = Number(opt("from") ?? 0);
const TARGETS = (opt("targets")?.split(",") ?? []).map(Number);
const LEVELS = (opt("levels")?.split(",") ?? [...ALL_LEVELS]) as (typeof ALL_LEVELS)[number][];
const spec = GAME_BY_TYPE.get("snake" as never)!;
const game = snakeGameFor(SNAKE_REV_12);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};

const rows: string[] = [];
const whatIfRows: string[] = [];
for (const level of LEVELS) {
  const cols: Record<string, number[]> = { v12: [], v11: [], stars: [], golds: [], core: [], gold: [], combo: [], lane: [], warp: [], coreFull: [], crashed: [] };
  const whatIf: number[][] = TARGETS.map(() => []);
  for (let n = FROM; n < FROM + SEEDS; n++) {
    const seed = spec.seedFor(n);
    const out = bot({ game, seed, rev: SNAKE_REV_12, human: new Human("snake", seed, level) } as any);
    const by = new Map((out.events ?? []).map((e: any) => [e.t, e]));
    let state = game.init(seed) as SnakeState;
    const checkpoints: unknown[] = [];
    while (!game.isOver(state)) {
      state = game.step(state, (by.get(state.tick + 1) as any) ?? null);
      if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
    }
    const raw = spec.encode({ seed, claimedScore: game.score(state), events: out.events ?? [], endTick: state.tick, checkpoints }, SNAKE_REV_12, seed);
    const result = spec.replay(seed, raw, SNAKE_REV_12);
    if (result.flagged || result.score !== game.score(state)) throw new Error(`${level} seed ${seed}: replay ${result.score} flagged ${result.flagged}`);
    const s = result.state as SnakeState;
    const p = snakeStdParts(s);
    const { gold2: _drop, ...v11 } = s;
    cols.v12!.push(result.score);
    cols.v11!.push(snakeStdScore(v11 as SnakeState));
    cols.stars!.push(s.eaten);
    cols.golds!.push(s.goldsEaten ?? 0);
    cols.core!.push(snakeCoreStars(s));
    cols.gold!.push(p.gold);
    cols.combo!.push(p.combo);
    cols.lane!.push(p.lane);
    cols.warp!.push(p.warp);
    cols.coreFull!.push(p.core === SNAKE_STD_CORE_MAX ? 1 : 0);
    cols.crashed!.push(s.dead ? 1 : 0);
    const cs = snakeCoreStars(s);
    TARGETS.forEach((t, i) => whatIf[i]!.push(result.score - p.core + Math.trunc((SNAKE_STD_CORE_MAX * Math.min(cs, t)) / t)));
  }
  const pct = (xs: number[]) => `${Math.round((100 * xs.reduce((a, b) => a + b, 0)) / xs.length)} %`;
  rows.push(
    `| ${level} | ${median(cols.v11!)} | ${median(cols.v12!)} | ${median(cols.stars!)} | ${median(cols.golds!)} | ${median(cols.core!)} | ${median(cols.gold!)} | ${median(cols.combo!)} | ${median(cols.lane!)} | ${median(cols.warp!)} | ${pct(cols.coreFull!)} | ${pct(cols.crashed!)} |`,
  );
  if (TARGETS.length) whatIfRows.push(`| ${level} | ${whatIf.map((xs) => median(xs)).join(" | ")} |`);
  console.error(`${level} done`);
}
console.log(`snakeRev 12 bands, seeds n = ${FROM}–${FROM + SEEDS - 1}`);
console.log("| Level | rev 11 | rev 12 | Stars | Golds | Core stars | Gold | Combo | Lane | Warp | Core full | Crashed |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) console.log(r);
if (TARGETS.length) {
  console.log(`\nWhat if the core were full at (core stars): ${TARGETS.join(", ")}`);
  console.log(`| Level | ${TARGETS.join(" | ")} |`);
  console.log(`| --- | ${TARGETS.map(() => "---").join(" | ")} |`);
  for (const r of whatIfRows) console.log(r);
}
