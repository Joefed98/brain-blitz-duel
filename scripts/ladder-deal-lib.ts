/**
 * D5's per-level proved deals for Meteor and Rally (23 Nov 2026): the seeds a level deals, each kept only when a player
 * held to Joe's human limits (0.25 s to react, 0.15 s to move) scores exactly 200 on it through the server's replay
 * (`gradeAnswer` on the dealt puzzle, unflagged). The witnesses (the logs that prove each seed) are stored in a fixture,
 * so `--check` replays every one and rebuilds the deal file byte for byte without any bot.
 *
 * A script library (scripts/snake-level-deal.ts and scripts/rally-level-deal.ts build with it; the ladder checks read it).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import type { ArcadeInputEvent } from "../src/lib/arcade/engine";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { playEvents } from "./ladder-legacy-lib";

export const DEAL_LEVELS: readonly Level[] = ["easy", "normal", "hard", "expert"];

export interface LevelWitness {
  level: Level;
  seed: number;
  /** The candidate index (the skill-band room seed n) and the try that found the 200. */
  n: number;
  variant: number;
  events: ArcadeInputEvent[];
}
export interface LevelWitnessFile {
  /** Candidates tried at each level. */
  tried: Record<string, number>;
  witnesses: LevelWitness[];
}

export interface LevelDealPlan {
  type: PuzzleType;
  /** The stamp field and the stamp the deal carries. */
  field: string;
  rev: number;
  /** Seeds kept a level. */
  keep: number;
  /** The candidate seed for index n (the skill-band room seeds). */
  seedFor: (n: number) => number;
  /** Candidate indices in order (tuning seeds first, then fresh ones). */
  candidates: readonly number[];
  dealFile: string;
  witnessFile: string;
  /** The deal file's source for the kept seeds (a pure function of its arguments). */
  source: (kept: Record<string, number[]>, tried: Record<string, number>) => string;
}

/**
 * The puzzle a level deals for a seed, as generatePuzzle writes it: the game's stamp, the base stamps every deal carries
 * (speedPar 1, puzzleScoreRev 3) and `level` only off Normal. The ladder checks prove a sample of real deals equal it.
 */
export function levelPuzzle(plan: Pick<LevelDealPlan, "type" | "field" | "rev">, seed: number, level: Level): PuzzleData {
  return { type: plan.type, seed, [plan.field]: plan.rev, speedPar: 1, puzzleScoreRev: 3, ...(level !== "normal" ? { level } : {}) } as unknown as PuzzleData;
}

/** A log through the server's replay on the puzzle: its stored score and whether it was flagged. */
export function proveLog(type: PuzzleType, puzzle: PuzzleData, events: readonly ArcadeInputEvent[]): { score: number; flagged: boolean } {
  const { raw } = playEvents(type, puzzle, events);
  const g = gradeAnswer(puzzle, raw, 0);
  return { score: g.score, flagged: Boolean((g.extra as { flagged?: unknown } | undefined)?.flagged) };
}

export function readWitnesses(file: string): LevelWitnessFile {
  return JSON.parse(gunzipSync(readFileSync(file)).toString()) as LevelWitnessFile;
}

export function keptOf(data: LevelWitnessFile): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const level of DEAL_LEVELS) out[level] = data.witnesses.filter((w) => w.level === level).map((w) => w.seed);
  return out;
}

/** Replays stored witnesses (all, or every `every`-th): each must score exactly 200, unflagged. */
export function checkWitnesses(plan: LevelDealPlan, every = 1): { checked: number; bad: string[]; data: LevelWitnessFile } {
  const data = readWitnesses(plan.witnessFile);
  const bad: string[] = [];
  let checked = 0;
  data.witnesses.forEach((w, i) => {
    if (i % every !== 0) return;
    checked++;
    const r = proveLog(plan.type, levelPuzzle(plan, w.seed, w.level), w.events);
    if (r.score !== 200 || r.flagged) bad.push(`${w.level} ${w.seed}: ${r.flagged ? "flagged" : r.score}`);
  });
  return { checked, bad, data };
}

/** Builds (or, with --check, proves) a plan's deal: `prove` finds a 200 log for a puzzle or returns null. */
export async function runLevelDeal(plan: LevelDealPlan, prove: (puzzle: PuzzleData, level: Level) => Promise<{ variant: number; events: ArcadeInputEvent[] } | null>, args: string[]): Promise<void> {
  if (args.includes("--check")) {
    const { checked, bad, data } = checkWitnesses(plan);
    const same = readFileSync(plan.dealFile, "utf8") === plan.source(keptOf(data), data.tried);
    console.log(`${checked} witnesses replayed, ${bad.length} failing; ${plan.dealFile} ${same ? "identical" : "DIFFERS"}`);
    for (const b of bad.slice(0, 20)) console.log(`  ${b}`);
    process.exit(bad.length || !same ? 1 : 0);
  }
  const only = args.find((a) => a.startsWith("--levels="))?.slice(9).split(",") as Level[] | undefined;
  const levels = only ?? DEAL_LEVELS;
  // Levels not rebuilt keep their stored witnesses.
  let old: LevelWitnessFile = { tried: {}, witnesses: [] };
  try {
    old = readWitnesses(plan.witnessFile);
  } catch {
    // none yet
  }
  const witnesses: LevelWitness[] = old.witnesses.filter((w) => !levels.includes(w.level));
  const tried: Record<string, number> = { ...old.tried };
  for (const level of levels) {
    let kept = 0;
    tried[level] = 0;
    for (const n of plan.candidates) {
      if (kept >= plan.keep) break;
      tried[level]! += 1;
      const seed = plan.seedFor(n);
      const found = await prove(levelPuzzle(plan, seed, level), level);
      if (found) {
        witnesses.push({ level, seed, n, variant: found.variant, events: found.events });
        kept++;
      }
      if (tried[level]! % 20 === 0) console.log(`${level}: ${kept} kept of ${tried[level]}`);
    }
    console.log(`${level}: ${kept} kept of ${tried[level]} candidates`);
  }
  witnesses.sort((a, b) => DEAL_LEVELS.indexOf(a.level) - DEAL_LEVELS.indexOf(b.level) || plan.candidates.indexOf(a.n) - plan.candidates.indexOf(b.n));
  const data: LevelWitnessFile = { tried, witnesses };
  writeFileSync(plan.witnessFile, gzipSync(JSON.stringify(data)));
  writeFileSync(plan.dealFile, plan.source(keptOf(data), tried));
  console.log(`wrote ${plan.dealFile} and ${plan.witnessFile}`);
}

/** The deal file's text for a game (one list a level, the room seed picking from the level's own list). */
export function levelDealSource(o: { title: string; exportName: string; fnName: string; builder: string; witness: string; rev: string; prover: string }, kept: Record<string, number[]>, tried: Record<string, number>): string {
  const lines = DEAL_LEVELS.map((l) => `  ${l}: [${(kept[l] ?? []).join(",")}],`).join("\n");
  const counts = DEAL_LEVELS.map((l) => `${l} ${(kept[l] ?? []).length} of ${tried[l] ?? 0}`).join(", ");
  return `/**
 * ${o.title}'s deal (${o.rev}, D5's ladder; built by \`${o.builder}\`, do not edit): one list of seeds a level,
 * each with a stored witness (${o.witness})
 * that scores exactly 200 through the server's replay at that level, played by ${o.prover}.
 * Kept of the candidates tried: ${counts}.
 */
import type { Level } from "@/lib/levels/levels";

export const ${o.exportName}: Readonly<Record<Level, readonly number[]>> = {
${lines}
};

/** The seed a room seed deals at a level (Normal when none is asked): the level's own list. */
export function ${o.fnName}(level: Level | null | undefined, roomSeed: number): number {
  const list = ${o.exportName}[level ?? "normal"] ?? ${o.exportName}.normal;
  const n = list.length;
  return list[((Math.trunc(roomSeed) % n) + n) % n]!;
}
`;
}
