/**
 * Speed tuning bands (14 Oct 2026): before / after medians for Flash, Bang On,
 * Don't Break the Chain and Pull! on 30 seeded room puzzles (5001–5030), played
 * by the fairness kits (scripts/puzzle-fairness/kits-speed.ts, kits-engine.ts)
 * at the four skill levels plus their careless lines. "Before" is the same seed
 * on the stamp rooms dealt before the change (Flash and Bang On tapRev 2 from
 * the old generators, the three-symbol chain, Pull! clayRev 4); "after" is
 * today's room puzzle. Every answer is graded by the server's gradeAnswer.
 *
 *   bun scripts/speed-bands-oct14.ts [--md] [types…]
 */
import { CLAY_REV4, CLAY_REV5 } from "../src/lib/arcade/clayShoot";
import { generateChainV2 } from "../src/lib/duel/chain.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LEVELS } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle, runPlay, runSpam } from "./puzzle-fairness/run";
import { TAP_REV_SPEED_TUNING } from "../src/lib/duel/tapLog";
import { buildReactionRev2, buildStopWatchRev2 } from "./speed-oct14-legacy-generators";

export const SPEED_BAND_TYPES = ["reaction", "stopwatch", "chain", "clayshoot"] as const;
export const SPEED_BAND_SEEDS = Array.from({ length: 30 }, (_, i) => 5001 + i);
export const CARELESS_LINE: Record<string, string> = {
  reaction: "tap-every-colour",
  stopwatch: "tap-random-time",
  chain: "tap-random",
  clayshoot: "mash-on-movers",
};
export const NAMES: Record<string, string> = { reaction: "Flash", stopwatch: "Bang On", chain: "Don't Break the Chain", clayshoot: "Pull!" };

/** The puzzle a room dealt for this seed before the 14 Oct change. */
export function beforePuzzle(type: (typeof SPEED_BAND_TYPES)[number], seed: number): PuzzleData {
  // generatePuzzle's stamps, as rooms stored them.
  const stamp = (p: object) => ({ ...p, speedPar: 1, puzzleScoreRev: 1 }) as unknown as PuzzleData;
  if (type === "reaction") return stamp(withSeededRandom(seed, () => buildReactionRev2()));
  if (type === "stopwatch") return stamp(withSeededRandom(seed, () => buildStopWatchRev2()));
  if (type === "chain") return stamp(withSeededRandom(seed, () => generateChainV2()));
  return { ...(roomPuzzle("clayshoot", seed) as Extract<PuzzleData, { type: "clayshoot" }>), clayRev: CLAY_REV4 };
}

/**
 * The puzzle a room dealt for this seed right after the 14 Oct change. Pull! has since moved on to
 * clayRev 6 (taller worlds batch 2, arcade-tuning-g2-check); this script keeps measuring clayRev 5. Flash and Bang On
 * have since moved on to tapRev 4 (20 Oct 2026, scoring-batch2-check); this script keeps measuring tapRev 3.
 */
export function afterPuzzle(type: (typeof SPEED_BAND_TYPES)[number], seed: number): PuzzleData {
  const p = roomPuzzle(type, seed);
  if (type === "reaction" || type === "stopwatch") return { ...(p as object), tapRev: TAP_REV_SPEED_TUNING } as unknown as PuzzleData;
  if (type === "chain") return { ...(p as object), chainDepthRev: undefined } as unknown as PuzzleData; // depth's chainDepthRev 1: depth-chain-check
  return type === "clayshoot" ? ({ ...(p as Extract<PuzzleData, { type: "clayshoot" }>), clayRev: CLAY_REV5 }) : p;
}

export const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2]! : Math.round((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2);
};

export type BandRow = { label: string; before: number[]; after: number[] };

export function bands(type: (typeof SPEED_BAND_TYPES)[number], seeds = SPEED_BAND_SEEDS): BandRow[] {
  const kit = KITS[type as PuzzleType]!;
  const rows = new Map<string, BandRow>();
  const add = (label: string, side: "before" | "after", score: number) => {
    const row = rows.get(label) ?? { label, before: [], after: [] };
    row[side].push(score);
    rows.set(label, row);
  };
  for (const seed of seeds) {
    for (const [side, puzzle] of [["before", beforePuzzle(type, seed)], ["after", afterPuzzle(type, seed)]] as const) {
      for (const level of LEVELS) add(level, side, runPlay(kit, puzzle, seed, level).score);
      for (const s of runSpam(kit, puzzle, seed)) add(s.label, side, s.score);
    }
  }
  return [...rows.values()];
}

if (import.meta.main) {
  const md = process.argv.includes("--md");
  const pick = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const types = SPEED_BAND_TYPES.filter((t) => pick.length === 0 || pick.includes(t));
  const lines = ["| Game | Player | Before | After |", "|---|---|---|---|"];
  for (const type of types) {
    for (const row of bands(type)) {
      const careless = row.label === CARELESS_LINE[type];
      lines.push(`| ${NAMES[type]} | ${row.label}${careless ? " (careless)" : ""} | ${median(row.before)} | ${median(row.after)} |`);
    }
  }
  console.log(md ? lines.join("\n") : lines.join("\n").replaceAll("|", " "));
}
