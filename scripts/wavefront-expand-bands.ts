/**
 * Wavefront expansion (wavRev 9) tuning table: the skill-band bots (scripts/arcade-skill-bands/) play
 * wavRev 8 and wavRev 9 on the same room seeds; every score is the server replay's. Prints, per level,
 * the median, top 10 % (90th percentile) and best score, and on wavRev 9 the base points, the features'
 * edge, waves cleared and how often the boss fell. A tool, not a check.
 *
 *   bun scripts/wavefront-expand-bands.ts [--seeds=40] [--revs=8,9] [--save=<file.json>]
 */
import { writeFileSync } from "node:fs";
import { GAMES } from "./arcade-skill-bands/games";
import { Human, LEVELS } from "./arcade-skill-bands/human";
import { bot } from "./arcade-skill-bands/bots/wavefront";
import { encodeWavefrontRun, replayWavefrontRun } from "../src/lib/duel/wavefront";
import { wavCheckpoint, wavefrontBandParts, wavEdgeUnits, type WavState } from "../src/lib/arcade/wavefront";
import { bandPoints } from "../src/lib/arcade/scoreBands";
import { WAV_X_EDGE_CURVE } from "../src/lib/arcade/wavefront";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 40);
const REVS = (opt("revs") ?? "8,9").split(",").map(Number);
const SAVE = opt("save");
const spec = GAMES.find((g) => g.type === "wavefront")!;

export interface WavBandRun {
  rev: number;
  level: string;
  n: number;
  seed: number;
  score: number;
  raw: string;
  base: number;
  units: number;
  edge: number;
  edgeUnits: number;
  waves: number;
  killed: boolean;
}

export function playWavefront(rev: number, level: (typeof LEVELS)[number], n: number): WavBandRun {
  const seed = spec.seedFor(n);
  const game = spec.gameFor(rev, seed);
  const human = new Human("wavefront", seed, level);
  const out = bot({ game, seed, rev, human });
  const events = out.events ?? [];
  const byTick = new Map(events.map((e) => [e.t, e]));
  let state = game.init(seed) as WavState;
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null);
    if (state.tick % 300 === 0) checkpoints.push(wavCheckpoint(state));
  }
  const raw = encodeWavefrontRun({ seed, claimedScore: game.score(state), events, inputs: [], taps: [], endTick: state.tick, checkpoints } as never);
  const result = replayWavefrontRun(seed, raw, rev);
  const s = result.state as WavState;
  const parts = wavefrontBandParts(s);
  return { rev, level, n, seed, score: result.score, raw, base: parts.points, units: parts.units, edge: s.x9 ? bandPoints(WAV_X_EDGE_CURVE, wavEdgeUnits(s)) : 0, edgeUnits: s.x9 ? wavEdgeUnits(s) : 0, waves: s.wavesCleared, killed: Boolean(s.bossKilled) };
}

if (import.meta.main) {
  const runs: WavBandRun[] = [];
  const q = (xs: number[], p: number) => {
    const a = [...xs].sort((x, y) => x - y);
    return a[Math.min(a.length - 1, Math.floor(p * (a.length - 1) + 0.5))]!;
  };
  console.log(`seeds ${SEEDS}`);
  console.log("rev level     median  top10%  best   | base (units p10/50/90)  edge(units)  waves  boss-killed");
  for (const rev of REVS)
    for (const level of LEVELS) {
      const mine: WavBandRun[] = [];
      for (let n = 0; n < SEEDS; n++) mine.push(playWavefront(rev, level, n));
      runs.push(...mine);
      const sc = mine.map((r) => r.score);
      console.log(
        `${String(rev).padEnd(3)} ${level.padEnd(9)} ${String(q(sc, 0.5)).padStart(6)}  ${String(q(sc, 0.9)).padStart(6)}  ${String(Math.max(...sc)).padStart(4)}   | ${String(q(mine.map((r) => r.base), 0.5)).padStart(4)} (${q(mine.map((r) => r.units), 0.1)}/${q(mine.map((r) => r.units), 0.5)}/${q(mine.map((r) => r.units), 0.9)})  ${String(q(mine.map((r) => r.edge), 0.5)).padStart(4)} (${q(mine.map((r) => r.edgeUnits), 0.5)})  ${q(mine.map((r) => r.waves), 0.5)}  ${mine.filter((r) => r.killed).length}/${SEEDS}`,
      );
    }
  if (SAVE) writeFileSync(SAVE, JSON.stringify(runs));
}
