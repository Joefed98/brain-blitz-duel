/**
 * Tilt tiltRev 11's tuning report (3 Nov 2026, docs/arcade-standard/tilt.md "tiltRev 11"): the skill-band bots
 * (scripts/arcade-skill-bands/bots/tilt.ts, weak → flawless) play tiltRev 11 on bank seeds (the skill-band tool's seed
 * index: 0–59 the tuning seeds, 10000 on the fresh ones), each run replayed through the server path, and the report
 * gives per level the median score and parts, mazes finished, pars met, clean mazes, falls and finish time, plus each
 * maze's median time ÷ par (how tight each par is at each level).
 *
 * --what-if=<scale>,<speedFullS> also scores every run with the par scaled by scale / 100 and the speed part full by
 * that many seconds (score-only: par and speed never change play), to tune the constants.
 *
 * --dump=<file> writes every run's maze times, pars, falls and progress as JSON (for trying other constants offline).
 *
 *   bun scripts/tilt-rev11-bands.ts [--seeds=40] [--from=10000] [--levels=weak,average,...] [--what-if=100,60] [--dump=<file>]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/tilt";
import {
  tiltGameFor,
  tiltParParts,
  TILT_P_PAR_POINTS,
  TILT_P_SPEED_POINTS,
  TILT_REV_PAR,
  TILT_RUN_TICKS,
  type TiltState,
} from "../src/lib/arcade/tilt";

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 40);
const FROM = Number(opt("from") ?? 10000);
const LEVELS = (opt("levels")?.split(",") ?? [...ALL_LEVELS]) as (typeof ALL_LEVELS)[number][];
const WHAT_IF = (opt("what-if")?.split(";") ?? []).map((w) => w.split(",").map(Number) as [number, number]);
const DUMP = opt("dump");
const dump: unknown[] = [];
const spec = GAME_BY_TYPE.get("tilt" as never)!;
const game = tiltGameFor(TILT_REV_PAR);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[s.length >> 1]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : 0;
};

/** A run's score with the par scaled and the speed part full by another time (score-only what-if). */
function whatIf(s: TiltState, score: number, scale: number, fullS: number): number {
  const p = tiltParParts(s);
  const met = (s.mazeTicks ?? []).filter((t, k) => t <= Math.trunc(((s.list[k]!.par ?? 0) * scale) / 100)).length;
  const full = fullS * 60;
  const end = s.endedTick;
  const speed = p.mazes >= 4 ? (end <= full ? TILT_P_SPEED_POINTS : Math.trunc((TILT_P_SPEED_POINTS * (TILT_RUN_TICKS - end)) / (TILT_RUN_TICKS - full))) : 0;
  if (score <= 1 && !s.acted) return score;
  return Math.max(1, score - p.par - p.speed + TILT_P_PAR_POINTS * met + speed);
}

const rows: string[] = [];
const ratioRows: string[] = [];
const whatRows: string[] = [];
for (const level of LEVELS) {
  const cols: Record<string, number[]> = { score: [], core: [], par: [], clean: [], finish: [], speed: [], mazes: [], pars: [], cleanMazes: [], falls: [], end: [] };
  const ratios: number[][] = [[], [], [], []];
  const what: number[][] = WHAT_IF.map(() => []);
  for (let n = FROM; n < FROM + SEEDS; n++) {
    const seed = spec.seedFor(n);
    const out = bot({ game, seed, rev: TILT_REV_PAR, human: new Human("tilt", seed, level), fixes: true } as any);
    const by = new Map((out.events ?? []).map((e: any) => [e.t, e]));
    let state = game.init(seed) as TiltState;
    const checkpoints: unknown[] = [];
    while (!game.isOver(state) && state.tick < game.runTicks) {
      state = game.step(state, (by.get(state.tick + 1) as any) ?? null) as TiltState;
      if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
    }
    const raw = spec.encode({ seed, claimedScore: game.score(state), events: out.events ?? [], endTick: state.tick, checkpoints }, TILT_REV_PAR, seed);
    const result = spec.replay(seed, raw, TILT_REV_PAR);
    if (result.flagged || result.score !== game.score(state)) throw new Error(`${level} seed ${seed}: replay ${result.score} flagged ${result.flagged}`);
    const s = result.state as TiltState;
    const p = tiltParParts(s);
    cols.score!.push(result.score);
    cols.core!.push(p.core);
    cols.par!.push(p.par);
    cols.clean!.push(p.clean);
    cols.finish!.push(p.finish);
    cols.speed!.push(p.speed);
    cols.mazes!.push(p.mazes);
    cols.pars!.push(p.parsMet);
    cols.cleanMazes!.push(p.cleanMazes);
    cols.falls!.push(s.falls ?? 0);
    cols.end!.push(p.mazes >= 4 ? Math.round(s.endedTick / 6) / 10 : 90);
    (s.mazeTicks ?? []).forEach((t, k) => ratios[k]!.push(Math.round((100 * t) / (s.list[k]!.par || 1))));
    if (DUMP) dump.push({ level, n, seed, score: result.score, acted: s.acted ?? 0, mazes: s.mazes, prog: s.progMaze === s.mazes ? (s.prog ?? 0) : 0, mazeTicks: s.mazeTicks, par: s.list.map((m) => m.par), cleanTo: s.cleanTo ?? null, falls: s.falls ?? 0, end: s.endedTick });
    WHAT_IF.forEach(([scale, full], i) => what[i]!.push(whatIf(s, result.score, scale, full)));
  }
  const m = (k: string) => median(cols[k]!);
  rows.push(`| ${level} | ${m("score")} | ${m("core")} | ${m("par")} | ${m("clean")} | ${m("finish")} | ${m("speed")} | ${m("mazes")} | ${m("pars")} | ${m("cleanMazes")} | ${m("falls")} | ${m("end")} |`);
  ratioRows.push(`| ${level} | ${ratios.map((r) => `${median(r)} (${r.length})`).join(" | ")} |`);
  if (WHAT_IF.length) whatRows.push(`| ${level} | ${what.map((w) => median(w)).join(" | ")} |`);
  console.error(`${level} done`);
}
if (DUMP) (await import("node:fs")).writeFileSync(DUMP, JSON.stringify(dump));
console.log(`tiltRev 11 bands, bank seeds n = ${FROM}–${FROM + SEEDS - 1}`);
console.log("| Level | Score | Core | Par | Clean | All 4 | Speed | Mazes | Pars met | Clean mazes | Falls | Finish s |");
console.log("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
for (const r of rows) console.log(r);
console.log("\nMedian maze time ÷ par, % (finished runs)");
console.log("| Level | Maze 1 | Maze 2 | Maze 3 | Maze 4 |");
console.log("| --- | --- | --- | --- | --- |");
for (const r of ratioRows) console.log(r);
if (WHAT_IF.length) {
  console.log(`\nWhat if (par scale %, speed full by s): ${WHAT_IF.map((w) => w.join("/")).join(" · ")}`);
  console.log(`| Level | ${WHAT_IF.map((w) => w.join("/")).join(" | ")} |`);
  console.log(`| --- | ${WHAT_IF.map(() => "---").join(" | ")} |`);
  for (const r of whatRows) console.log(r);
}
