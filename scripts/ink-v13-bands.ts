/**
 * Rainbow Bridge inkRev 13 bands (a tool, not a check; docs/arcade-standard/inkbridge.md "inkRev 13"): the skill-band
 * bot (scripts/arcade-skill-bands/bots/inkbridge.ts, its fixed bots) plays the skill-band tool's room seeds (seed index
 * n → roomSeed(n)) on inkRev 13, every run scored through the server's encode + replay, and writes one row per run with
 * what the score is made of (levels, ink-par credit, trick shots, clovers, the finish tick). `--fit` re-scores saved
 * rows on today's parts (inkV13Score's arithmetic) without playing again, so a change of the parts' maximums is
 * measured on the same runs; the bot never sees the parts.
 *
 *   bun scripts/ink-v13-bands.ts --from=0 --seeds=30 --levels=weak,average,good,great,near,elite,perfect --out=<json>
 *   bun scripts/ink-v13-bands.ts --fit=<json>[,<json>…]
 */
import { readFileSync, writeFileSync } from "node:fs";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { inkBridgeGameFor, inkCheckpoint, inkV13Score, INK_LEVELS, INK_REV_CLOVER, INK_RUN_TICKS, type InkState } from "../src/lib/arcade/inkBridge";
import { stdTotal } from "../src/lib/arcade/arcadeStandard";
import { encodeInkBridgeRun, replayInkBridgeRun } from "../src/lib/duel/inkBridge";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, ALL_LEVELS, type SkillLevel } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/inkbridge";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

export interface InkV13Row {
  level: SkillLevel;
  n: number;
  score: number;
  levels: number;
  inkPar: number;
  parLevels: number;
  tricks: number;
  clovers: number;
  ended: number;
  fails: number;
}

const game = inkBridgeGameFor(INK_REV_CLOVER);

/** Plays a log on inkRev 13 and scores it through the server's encode + replay. */
export function replayedV13(seed: number, events: ArcadeInputEvent[]): { score: number; state: InkState } {
  let s = game.init(seed) as InkState;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    if (s.tick % 300 === 0) checkpoints.push(inkCheckpoint(s));
  }
  const raw = encodeInkBridgeRun({ seed, claimedScore: game.score(s), events, inputs: [], taps: [], endTick: s.tick, checkpoints } as never);
  const r = replayInkBridgeRun(seed, raw, INK_REV_CLOVER);
  return { score: r.score, state: r.state };
}

/** A saved row on today's parts. */
export function rescoreV13(r: InkV13Row): number {
  const fake = { levels: r.levels, inkPar: r.inkPar, tricks: r.tricks, shamrocks: r.clovers, endedTick: r.ended, tick: r.ended } as InkState;
  return r.score === 0 ? 0 : stdTotal(inkV13Score(fake), true);
}

const q = (v: readonly number[], p: number) => [...v].sort((a, b) => a - b)[Math.min(v.length - 1, Math.floor(p * v.length))]!;
const med = (v: readonly number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

function table(rows: InkV13Row[]): void {
  for (const lv of ALL_LEVELS) {
    const rs = rows.filter((r) => r.level === lv);
    if (!rs.length) continue;
    const sc = rs.map(rescoreV13);
    console.log(
      `${lv.padEnd(8)} n=${rs.length} median ${med(sc)} (p10 ${q(sc, 0.1)}–p90 ${q(sc, 0.9)}) | levels ${med(rs.map((r) => r.levels))} (all ten ${rs.filter((r) => r.levels >= INK_LEVELS).length})` +
        ` par ${med(rs.map((r) => r.parLevels))} credit ${med(rs.map((r) => r.inkPar))} tricks ${med(rs.map((r) => r.tricks))} clovers ${med(rs.map((r) => r.clovers))} fails ${med(rs.map((r) => r.fails))} end ${(med(rs.map((r) => r.ended)) / 60).toFixed(1)} s`,
    );
  }
}

if (import.meta.main) {
  const fit = opt("fit");
  if (fit) table(fit.split(",").flatMap((p) => JSON.parse(readFileSync(p, "utf8")) as InkV13Row[]));
  else {
    const from = Number(opt("from") ?? 0);
    const seeds = Number(opt("seeds") ?? 30);
    const levels = (opt("levels")?.split(",") ?? [...ALL_LEVELS]) as SkillLevel[];
    const out = opt("out");
    const rows: InkV13Row[] = [];
    for (let n = from; n < from + seeds; n++) {
      const seed = roomSeed(n);
      for (const level of levels) {
        const res = bot({ game, seed, rev: INK_REV_CLOVER, human: new Human("inkbridge", seed, level), fixes: true });
        const { score, state: s } = replayedV13(seed, res.events ?? []);
        rows.push({ level, n, score, levels: s.levels, inkPar: s.inkPar ?? 0, parLevels: s.parLevels ?? 0, tricks: s.tricks ?? 0, clovers: s.shamrocks ?? 0, ended: s.endedTick || Math.min(s.tick, INK_RUN_TICKS), fails: s.fails });
      }
      if (out) writeFileSync(out, JSON.stringify(rows));
      if ((n - from) % 5 === 4) console.error(`… ${n - from + 1} seeds`);
    }
    table(rows);
  }
}
