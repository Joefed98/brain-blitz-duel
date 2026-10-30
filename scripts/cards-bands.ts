/**
 * Cards & Board's measuring tool (30 Oct 2026; docs/arcade-standard/freecell.md, tripeaks.md, pokersquares.md): plays
 * the skill-band bots (scripts/arcade-skill-bands/bots/) weak to flawless on the seeds rooms deal, through the server's
 * replay, and prints each level's median score with p10–p90, its median core units (FreeCell's card units, TriPeaks'
 * cards cleared, Poker Squares' hand points: an open-ended core is full at the near-perfect median), the share of runs
 * finished, and the median finish time (each speed part is full by the near-perfect median's).
 *
 *   bun scripts/cards-bands.ts [freecell tripeaks pokersquares] [--seeds=60] [--from=0]
 */
import { ALL_LEVELS, Human, LEVEL_LABEL } from "./arcade-skill-bands/human";
import { GAME_BY_TYPE } from "./arcade-skill-bands/games";
import type { SkillBot } from "./arcade-skill-bands/bot";
import { UNITS } from "./arcade-skill-bands/units";

// The replay logs a desync for a log sent without checkpoints; the scores are the replay's own either way.
console.error = () => {};
const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 60);
const FROM = Number(opt("from") ?? 0);
const TYPES = args.filter((a) => !a.startsWith("--"));
const pct = (xs: number[], p: number) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]! : NaN);

for (const type of TYPES.length ? TYPES : ["freecell", "tripeaks", "pokersquares"]) {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const { bot } = (await import(`./arcade-skill-bands/bots/${type}.ts`)) as { bot: SkillBot };
  console.log(`\n${type}: ${SEEDS} seeds from ${FROM}`);
  console.log("level          median  p10–p90    units  finished  finish median (p10–p90)");
  for (const level of ALL_LEVELS) {
    const scores: number[] = [];
    const finish: number[] = [];
    const units: number[] = [];
    for (let n = FROM; n < FROM + SEEDS; n++) {
      const seed = spec.seedFor(n);
      const game = spec.gameFor(spec.live, seed);
      const out = bot({ game, seed, rev: spec.live, human: new Human(type, seed, level), fixes: true });
      const events = out.events ?? [];
      const raw = spec.encode({ seed, claimedScore: 0, events, endTick: 0, checkpoints: [] }, spec.live, seed);
      const r = spec.replay(seed, raw, spec.live);
      scores.push(r.score);
      units.push(UNITS[type]!(r.state).u);
      if (r.state.ended === 1) finish.push(r.state.finishTick / 60);
    }
    const f = finish.length ? `${pct(finish, 0.5).toFixed(1)} s (${pct(finish, 0.1).toFixed(1)}–${pct(finish, 0.9).toFixed(1)})` : "—";
    console.log(`${LEVEL_LABEL[level].padEnd(14)} ${String(pct(scores, 0.5)).padStart(6)}  ${`${pct(scores, 0.1)}–${pct(scores, 0.9)}`.padEnd(9)}  ${String(pct(units, 0.5)).padStart(5)}  ${`${finish.length}/${SEEDS}`.padEnd(8)}  ${f}`);
  }
}
