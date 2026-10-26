/**
 * Roofbound flipRev 8 tuning report (a tool, not a check; docs/expansions/x200-flip.md): the skill-band bot at every
 * tier on the room seeds the skill-band runner uses (roomSeed(n), n from --from), every run through the server's
 * encode + replay, on flipRev 6 (the revision rooms dealt before) and flipRev 8. Prints median / p90 / best per tier,
 * zero scores, and rev 8's parts (base, skill pay and each feature's raw points).
 *
 *   bun scripts/flip-x200-bands.ts [--seeds=60] [--from=0] [--rev=6,8] [--levels=weak,average,good,great,near,elite,random] [--json=<path>]
 */
import { writeFileSync } from "node:fs";
import { flipBandParts, flipCheckpoint, flipGameFor, flipStarsTaken, flipSweetsTaken, flipTrailStars, flipV8Features, flipV8Units, FLIP_REV_EXPAND, type FlipState } from "../src/lib/arcade/flip";
import { encodeFlipRun, replayFlipRun } from "../src/lib/duel/flip";
import { bot, randomBot } from "./arcade-skill-bands/bots/flip";
import { roomSeed } from "./arcade-skill-bands/games";
import { Human, TIERS, type SkillTier } from "./arcade-skill-bands/human";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 60);
const FROM = Number(opt("from") ?? 0);
const REVS = (opt("rev") ?? "6,8").split(",").map(Number);
const LEVELS = (opt("levels") ?? [...TIERS, "random"].join(",")).split(",") as (SkillTier | "random")[];

export function playFlip(rev: number, level: SkillTier | "random", n: number) {
  const seed = roomSeed(n);
  const game = flipGameFor(rev);
  const human = new Human("flip", seed, level === "random" ? "weak" : level);
  const { events = [] } = (level === "random" ? randomBot : bot)({ game, seed, rev, human });
  let state = game.init(seed) as FlipState;
  const byTick = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    state = game.step(state, byTick.get(state.tick + 1) ?? null) as FlipState;
    if (state.tick % 300 === 0) checkpoints.push(flipCheckpoint(state));
  }
  const raw = encodeFlipRun({ seed, claimedScore: game.score(state), events, inputs: [], taps: [], endTick: state.tick, checkpoints } as never);
  const result = replayFlipRun(seed, raw, rev);
  return { n, seed, raw, events, result, state: result.state, local: game.score(state) };
}

const q = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1) + 0.5))]!;
const med = (xs: number[]) => q([...xs].sort((a, b) => a - b), 0.5);

if (import.meta.main) {
  const out: unknown[] = [];
  for (const rev of REVS) {
    console.log(`flipRev ${rev} (seeds ${FROM}–${FROM + SEEDS - 1})`);
    for (const level of LEVELS) {
      const rows = Array.from({ length: SEEDS }, (_, i) => playFlip(rev, level, FROM + i));
      const scores = rows.map((r) => r.result.score).sort((a, b) => a - b);
      const zeros = scores.filter((v) => v === 0).length;
      const bad = rows.filter((r) => r.result.flagged || r.local !== r.result.score).length;
      let extra = "";
      if (rev === FLIP_REV_EXPAND) {
        const f = rows.map((r) => flipV8Features(r.state));
        const base = rows.map((r) => {
          const p = flipBandParts(r.state);
          return p.bonus - flipV8Features(r.state).total + p.points;
        });
        extra = ` | base ${med(base)} · skill ${med(f.map((x) => x.total))} (raw ${med(f.map((x) => x.raw))}: trails ${med(f.map((x) => x.trails))} sweet ${med(f.map((x) => x.sweets))} combo ${med(f.map((x) => x.combo))} zones ${med(f.map((x) => x.zones))} cps ${med(f.map((x) => x.checkpoints))}) · lasted ${rows.filter((r) => r.state.ended === 1).length}/${SEEDS} · stars ${med(rows.map((r) => flipStarsTaken(r.state)))}`;
      }
      console.log(`  ${level.padEnd(8)} median ${q(scores, 0.5)}  p90 ${q(scores, 0.9)}  best ${scores.at(-1)}  p10 ${q(scores, 0.1)}  zeros ${zeros}${bad ? `  MISMATCH ${bad}` : ""}${extra}`);
      for (const r of rows)
        out.push({
          rev, level, n: r.n, seed: r.seed, score: r.result.score,
          ...(rev === FLIP_REV_EXPAND
            ? { ...flipV8Features(r.state), units: flipV8Units(r.state), finished: r.state.ended === 1, acted: Boolean(r.state.acted), sweetN: flipSweetsTaken(r.state), trailsFull: flipTrailStars(r.state).full, comboPts: r.state.comboPts ?? 0, zonesOk: r.state.zonesOk ?? 0, cleanCps: r.state.cleanCps ?? 0, stars: flipStarsTaken(r.state) }
            : {}),
        });
    }
  }
  const json = opt("json");
  if (json) writeFileSync(json, JSON.stringify(out));
}
