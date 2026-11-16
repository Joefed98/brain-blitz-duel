/**
 * The level bands for Roofbound and High Rise (15 Nov 2026; docs/arcade-standard/flip.md and skyline.md "Levels"): plays
 * the skill-band bots on real deals at each level and reports the mean and median score, the finish rate and the
 * crashes or lives lost, graded by the server replay on the dealt puzzle. A tool, not a check.
 *
 *   bun scripts/action-levels-bands.ts <flip|skyline> [--levels=easy,normal,hard,expert] [--bots=average,…,limited]
 *       [--seeds=24] [--from=0] [--json]
 *
 * Bot levels are the skill-band tool's (human.ts) plus `limited`: the elite held to the human limits Joe's brief names
 * (scripts/arcade-skill-bands/humanLimits.ts: 0.25 s reactions, 0.15 s finger lag, no superhuman accuracy). Joe's targets
 * are for `limited`: about 198 Normal, 160 Hard, 140 Expert, mostly finishing; Easy gives `average` a real shot at 175.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData } from "../src/lib/duel/types";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import { GAME_BY_TYPE, roomSeed } from "./arcade-skill-bands/games";
import { Human, type SkillLevel } from "./arcade-skill-bands/human";
import { limitedElite } from "./arcade-skill-bands/humanLimits";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { flipGraceScore } from "../src/lib/arcade/flip";
import { skylineStdParts } from "../src/lib/arcade/skyline";

export type BotName = SkillLevel | "limited";

export interface BandRow {
  level: Level;
  bot: BotName;
  runs: number;
  mean: number;
  median: number;
  p10: number;
  p90: number;
  finish: number;
  /** Mean crashes (Roofbound) or lives lost (High Rise) a run. */
  slips: number;
  /** High Rise: runs reaching 61 floors (the Skyscraper challenge's figure). */
  floors61?: number;
  /** Each scored part's mean. */
  parts: Record<string, number>;
}

export function dealAt(type: "flip" | "skyline", level: Level, n: number): PuzzleData {
  const seed = roomSeed(n);
  return withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed, ...(level !== "normal" ? { level } : {}) }));
}

/** One bot run on a dealt puzzle: the log encoded as the phone sends it and graded by the server. */
export async function playDealt(type: "flip" | "skyline", puzzle: PuzzleData, botLevel: BotName): Promise<{ score: number; finished: boolean; slips: number; floors: number; raw: string; parts: Record<string, number> }> {
  const spec = GAME_BY_TYPE.get(type)!;
  const bot = ((await import(`./arcade-skill-bands/bots/${type}.ts`)) as { bot: SkillBot }).bot;
  const loose = puzzle as unknown as Record<string, number>;
  const seed = loose["seed"]!;
  const rev = type === "flip" ? loose["flipRev"]! : loose["skylineRev"]!;
  const game = spec.gameForPuzzle!(puzzle);
  const human = botLevel === "limited" ? limitedElite(type, seed) : new Human(type, seed, botLevel);
  const out = bot({ game, seed, rev, human, fixes: true });
  let state = game.init(seed);
  const byTick = new Map((out.events ?? []).map((e) => [e.t, e]));
  const taps = new Set(out.taps ?? []);
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? taps.has(t) : (byTick.get(t) ?? null));
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const body = { seed, claimedScore: game.score(state), events: out.events ?? [], inputs: out.taps ?? [], taps: [], endTick: state.tick, checkpoints };
  const raw = spec.encode(body, rev, seed);
  const graded = gradeAnswer(puzzle, raw, 0);
  if ((graded.extra as any)?.flagged) throw new Error(`${type} ${puzzleLevel(puzzle)} seed ${seed}: the bot's run was flagged`);
  const finished = type === "flip" ? state.ended === 1 : !state.missed;
  const slips = type === "flip" ? (state.saves ?? 0) : (state.livesLost ?? 0);
  const parts: Record<string, number> = {};
  if (type === "flip") {
    const b = flipGraceScore(state);
    parts["core"] = b.core;
    for (const [k, v] of Object.entries(b.features)) parts[k] = v;
  } else for (const p of skylineStdParts(state) ?? []) parts[p.key] = p.points;
  return { score: graded.score, finished, slips, floors: state.placed ?? 0, raw, parts };
}

const q = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor((s.length - 1) * p)))] ?? 0;
};

export async function bands(type: "flip" | "skyline", levels: Level[], bots: BotName[], ns: number[]): Promise<BandRow[]> {
  const rows: BandRow[] = [];
  for (const level of levels) {
    const deals = ns.map((n) => dealAt(type, level, n));
    for (const b of bots) {
      const runs = [];
      for (const p of deals) runs.push(await playDealt(type, p, b));
      const scores = runs.map((r) => r.score);
      rows.push({
        level,
        bot: b,
        runs: runs.length,
        mean: Math.round((scores.reduce((a, c) => a + c, 0) / runs.length) * 10) / 10,
        median: q(scores, 0.5),
        p10: q(scores, 0.1),
        p90: q(scores, 0.9),
        finish: Math.round((100 * runs.filter((r) => r.finished).length) / runs.length),
        slips: Math.round((runs.reduce((a, r) => a + r.slips, 0) / runs.length) * 100) / 100,
        ...(type === "skyline" ? { floors61: runs.filter((r) => r.floors >= 61).length } : {}),
        parts: Object.fromEntries(Object.keys(runs[0]?.parts ?? {}).map((k) => [k, Math.round((runs.reduce((a, r) => a + (r.parts[k] ?? 0), 0) / runs.length) * 10) / 10])),
      });
    }
  }
  return rows;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const type = args.find((a) => !a.startsWith("--")) as "flip" | "skyline";
  if (type !== "flip" && type !== "skyline") throw new Error("usage: bun scripts/action-levels-bands.ts <flip|skyline> …");
  const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  const levels = (opt("levels") ?? "easy,normal,hard,expert").split(",") as Level[];
  const bots = (opt("bots") ?? "average,great,near,elite,limited").split(",") as BotName[];
  const from = Number(opt("from") ?? 0);
  const ns = Array.from({ length: Number(opt("seeds") ?? 24) }, (_, i) => from + i);
  const rows = await bands(type, levels, bots, ns);
  if (args.includes("--json")) console.log(JSON.stringify(rows));
  else
    for (const r of rows)
      console.log(
        `${type} ${r.level.padEnd(6)} ${r.bot.padEnd(8)} mean ${String(r.mean).padStart(5)} median ${String(r.median).padStart(3)} p10–p90 ${r.p10}–${r.p90} finish ${r.finish}% ${type === "flip" ? "crashes" : "lives lost"} ${r.slips}${r.floors61 !== undefined ? ` 61+ floors ${r.floors61}/${r.runs}` : ""} · ${Object.entries(r.parts).map(([k, v]) => `${k} ${v}`).join(", ")}`,
      );
}
