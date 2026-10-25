/**
 * Expansion E6 score distributions (25 Oct 2026): the skill-band bots (scripts/arcade-skill-bands) play
 * Coral Pop, Gemstone and Ball Tracker on the revision rooms dealt before the expansion and on the new one,
 * on the same room seeds, every run scored by the server's encode + replay path. Prints, per level, the
 * median, the top 10 % (p90) and the best score, and on the new stamp the median feature bonus, so the
 * tuning table in docs/expansions/e6.md can be reproduced. Not a check.
 *
 *   bun scripts/e6-bands.ts [bubble|matchup|balltrack …] [--seeds=30] [--json=<path>]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { writeFileSync } from "node:fs";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import { Human, LEVELS, LEVEL_LABEL } from "./arcade-skill-bands/human";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 30);
const JSON_PATH = opt("json");
const ONLY = args.filter((a) => !a.startsWith("--"));

/** Each game: the revision rooms dealt before E6, the E6 revision, and the new revision's feature bonus. */
export const E6_GAMES: Record<string, { before: number; after: number; bonus: (state: any) => number }> = {
  bubble: { before: 7, after: 8, bonus: (s) => (s.reef ? (require("../src/lib/arcade/bubble").bubV8FeatureBonus(s) as number) : 0) },
  matchup: { before: 8, after: 9, bonus: (s) => (s.goals !== undefined ? (require("../src/lib/arcade/matchup").matchupV9FeatureBonus(s) as number) : 0) },
  balltrack: { before: 6, after: 7, bonus: (s) => (s.r7 ? (require("../src/lib/arcade/ballTrack").btV7FeatureBonus(s) as number) : 0) },
};

export interface E6Run { type: string; rev: number; level: string; seed: number; score: number; bonus: number; state: any }

export function playE6(type: string, rev: number, level: string, n: number): E6Run {
  const spec: any = GAME_BY_TYPE.get(type as never)!;
  const { bot } = require(`./arcade-skill-bands/bots/${type}.ts`);
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const human = new Human(spec.type, seed, level as never);
  const res = bot({ game, seed, rev, human });
  let state = game.init(seed);
  const checkpoints: unknown[] = [];
  const byTick = new Map((res.events ?? []).map((e: any) => [e.t, e]));
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, byTick.get(t) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const raw = spec.encode({ seed, claimedScore: claimed, events: res.events ?? [], inputs: [], taps: [], endTick: state.tick, checkpoints }, rev, seed);
  const result = spec.replay(seed, raw, rev);
  if (result.flagged || result.score !== claimed) throw new Error(`${type} rev ${rev} ${level} ${n}: bot ${claimed}, replay ${result.score}${result.flagged ? " (flagged)" : ""}`);
  return { type, rev, level, seed, score: result.score, bonus: E6_GAMES[type]!.bonus(result.state), state: result.state };
}

const q = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))]!;

if (import.meta.main) {
  const out: Omit<E6Run, "state">[] = [];
  for (const type of ONLY.length ? ONLY : Object.keys(E6_GAMES)) {
    const g = E6_GAMES[type]!;
    console.log(`\n${type}: rev ${g.before} → rev ${g.after}, ${SEEDS} seeds`);
    console.log(`${"level".padEnd(13)} ${"before: median / p90 / best".padEnd(30)} after: median / p90 / best (median bonus)`);
    for (const level of LEVELS) {
      const cols: string[] = [];
      for (const rev of [g.before, g.after]) {
        const runs: E6Run[] = [];
        for (let n = 0; n < SEEDS; n++) runs.push(playE6(type, rev, level, n));
        for (const r of runs) out.push({ type: r.type, rev: r.rev, level: r.level, seed: r.seed, score: r.score, bonus: r.bonus });
        const s = runs.map((r) => r.score).sort((a, b) => a - b);
        const b = runs.map((r) => r.bonus).sort((a, b) => a - b);
        cols.push(`${q(s, 0.5)} / ${q(s, 0.9)} / ${s.at(-1)}${rev === g.after ? ` (${q(b, 0.5)})` : ""}`);
      }
      console.log(`${LEVEL_LABEL[level].padEnd(13)} ${cols[0]!.padEnd(30)} ${cols[1]}`);
    }
  }
  if (JSON_PATH) writeFileSync(JSON_PATH, JSON.stringify(out));
}
