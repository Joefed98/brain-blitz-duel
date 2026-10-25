/**
 * Roofbound rev 7 tuning report (not a check): the skill-band bot at four levels on fixed room
 * seeds, every run through the server's encode + replay, on flipRev 6 (old) and flipRev 7 (new).
 * Prints median, p90 (top 10 %) and best per level, and rev 7's parts (base, features).
 *
 *   bun scripts/flip-rev7-bands.ts [--seeds=30] [--rev=7]
 */
import { flipCheckpoint, flipGameFor, flipStarsTaken, flipV7Features, flipBandParts, type FlipState } from "../src/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "../src/lib/duel/flip";
import { bot } from "./arcade-skill-bands/bots/flip";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, LEVELS } from "./arcade-skill-bands/human";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 30);
const REVS = (opt("rev") ?? "6,7").split(",").map(Number);

export function playFlip(rev: number, level: (typeof LEVELS)[number], n: number) {
  const seed = roomSeed(n);
  const game = flipGameFor(rev);
  const human = new Human("flip", seed, level);
  const { events = [] } = bot({ game, seed, rev, human });
  let state = game.init(seed) as FlipState;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null) as FlipState;
    if (state.tick % 300 === 0) checkpoints.push(flipCheckpoint(state));
  }
  const raw = encodeFlipRun({ seed, claimedScore: game.score(state), events, inputs: [], taps: [], endTick: state.tick, checkpoints } as never);
  const result = replayFlipRun(seed, raw, rev);
  return { seed, raw, result, state: result.state };
}

const q = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1) + 0.5))]!;
const med = (xs: number[]) => q([...xs].sort((a, b) => a - b), 0.5);

if (import.meta.main) {
  for (const rev of REVS) {
    console.log(`flipRev ${rev}`);
    for (const level of LEVELS) {
      const rows = Array.from({ length: SEEDS }, (_, n) => playFlip(rev, level, n));
      const scores = rows.map((r) => r.result.score).sort((a, b) => a - b);
      let extra = "";
      if (rev === 7) {
        const f = rows.map((r) => flipV7Features(r.state));
        const base = rows.map((r) => { const p = flipBandParts(r.state); return p.points + (p.finished ? 10 : 0); });
        const units = rows.map((r) => flipBandParts(r.state).units).sort((a, b) => a - b);
        extra = ` | units ${q(units, 0.1)}/${q(units, 0.5)}/${q(units, 0.9)} · base ${med(base)} · trails ${med(f.map((x) => x.trails))} · combo ${med(f.map((x) => x.combo))} · zones ${med(f.map((x) => x.zones))} · cps ${med(f.map((x) => x.checkpoints))} · feat ${med(f.map((x) => x.total))} · saves ${med(rows.map((r) => r.state.saves ?? 0))} · lasted ${rows.filter((r) => r.state.ended === 1).length}/${SEEDS} · stars ${med(rows.map((r) => flipStarsTaken(r.state)))}`;
      }
      console.log(`  ${level.padEnd(8)} median ${q(scores, 0.5)}  p90 ${q(scores, 0.9)}  best ${scores.at(-1)}  (p10 ${q(scores, 0.1)})${extra}`);
    }
  }
}
