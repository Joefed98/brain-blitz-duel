/**
 * Practice challenges (6 Nov 2026, practice goals): two for each of 20 games, each built only from what the game
 * already measures and stores with a graded run. Nothing here changes how a game plays or scores.
 *
 *   part       an arcade game on the arcade scoring standard: one of its parts (the reveal line "<Label>: … → N of M",
 *              extra.reveal.lines, built by the server's replay) reaching `max` in one run;
 *   bonus      a puzzle on the scoring standard: a finish (extra.parts.kind "finish") whose bonus (par or clean,
 *              extra.parts.efficiency) reaches `max`;
 *   speed      the same finish with its speed points (extra.parts.speed) at `max`: solved by the game's "full by" time;
 *   scoreRuns  `runs` runs of `score` or more.
 *
 * Every number is the game's own (practice-goals-check proves each against the live spec or the standard's rules
 * table, so a retune that moves one fails the check). Shared and pure; no registry import (the registry pulls in
 * every puzzle module).
 *
 * The list is the proposal for Joe's approval (the PR lists it); the games are a guess at the most played: the beta's
 * practice_plays isn't readable from the repo (docs/beta-sql.md section 12 ranks them).
 */
import type { PuzzleType } from "./types";

export type ChallengeGoal =
  | { kind: "part"; label: string; max: number }
  | { kind: "bonus"; max: number }
  | { kind: "speed"; max: number; withinS: number }
  | { kind: "scoreRuns"; score: number; runs: number };

export interface PracticeChallenge {
  /** Stable id: `<type>.<name>`; progress is stored under it. */
  id: string;
  type: PuzzleType;
  /** The goal in plain words, one line. */
  text: string;
  /** What completing it earns (shown as unlocking with an account until accounts exist). */
  reward: string;
  goal: ChallengeGoal;
}

const part = (type: PuzzleType, name: string, text: string, label: string, max: number): PracticeChallenge => ({
  id: `${type}.${name}`,
  type,
  text,
  reward: "Badge",
  goal: { kind: "part", label, max },
});
const bonus = (type: PuzzleType, name: string, text: string, max: number): PracticeChallenge => ({
  id: `${type}.${name}`,
  type,
  text,
  reward: "Badge",
  goal: { kind: "bonus", max },
});
const speed = (type: PuzzleType, withinS: number, max: number): PracticeChallenge => ({
  id: `${type}.speed`,
  type,
  text: `Solve it within ${withinS} s`,
  reward: "Badge",
  goal: { kind: "speed", max, withinS },
});
const runs = (type: PuzzleType, score: number, count: number): PracticeChallenge => ({
  id: `${type}.runs${score}`,
  type,
  text: `Score ${score} or more in ${count} runs`,
  reward: "Badge",
  goal: { kind: "scoreRuns", score, runs: count },
});

export const PRACTICE_CHALLENGES: readonly PracticeChallenge[] = [
  // Puzzles (the standard's par, clean and speed parts: patternRules.ts, logicRules.ts, word.ts)
  bonus("unblock", "par", "Solve it at par", 20),
  speed("unblock", 40, 30),
  bonus("lightsout", "par", "Solve it in par presses", 20),
  speed("lightsout", 20, 30),
  bonus("sudoku", "clean", "Solve it with no mistakes", 10),
  speed("sudoku", 45, 40),
  bonus("flood", "par", "Solve it at par", 40),
  speed("flood", 30, 10),
  bonus("tower", "par", "Solve it at par", 10),
  speed("tower", 45, 40),
  bonus("safe", "clean", "Crack it with no mistakes", 10),
  speed("safe", 30, 40),
  bonus("tiles", "par", "Solve it at par", 15),
  speed("tiles", 30, 35),
  bonus("codeword", "clean", "Crack it without a wrong letter", 10),
  speed("codeword", 60, 40),
  bonus("swapword", "par", "Solve it at par", 30),
  speed("swapword", 60, 20),
  bonus("wordslide", "par", "Solve it at par", 15),
  speed("wordslide", 33, 35),
  // Arcade (each game's standard parts: src/lib/arcade/liveBands.ts LIVE_BANDS std)
  part("pinball", "joulz", "Max out J-O-U-L-Z in one run", "J-O-U-L-Z", 20),
  part("pinball", "multiball", "Max out Multiball in one run", "Multiball", 20),
  part("skyline", "perfects", "Max out Perfect drops in one run", "Perfect drops", 30),
  part("skyline", "gold", "Max out Gold blocks in one run", "Gold blocks", 20),
  part("beat", "gold", "Max out Golden notes in one run", "Golden notes", 15),
  runs("beat", 150, 3),
  part("bubble", "clear", "Clear the reef", "Reef cleared", 10),
  part("bubble", "chests", "Max out Chests in one run", "Chests", 30),
  part("bintoss", "finish", "Get all ten in", "All ten in", 10),
  part("bintoss", "hoops", "Max out Hoops in one run", "Hoops", 24),
  part("bullseye", "dead", "Max out Dead-centre darts in one run", "Dead-centre darts", 20),
  runs("bullseye", 150, 3),
  part("homerun", "homers", "Max out Home runs in one run", "Home runs", 40),
  part("homerun", "streak", "Max out Perfect streak in one run", "Perfect streak", 20),
  part("pool", "black", "Pot the black", "Black", 10),
  part("pool", "streak", "Max out Pots in a row in one run", "Pots in a row", 30),
  part("blockfall", "multi", "Max out Multi-line clears in one run", "Multi-line clears", 24),
  part("blockfall", "low", "Max out Low stack in one run", "Low stack", 16),
  part("bastion", "drones", "Down all three drones", "Drones", 30),
  part("bastion", "base", "Finish with the base untouched", "Base intact", 10),
];

/** The challenge's target on its progress bar (the part's or bonus's maximum, or the runs needed). */
export function challengeTarget(goal: ChallengeGoal): number {
  return goal.kind === "scoreRuns" ? goal.runs : goal.max;
}

/** A standard part line as the server stores it: "<Label>: <detail> → <points> of <max>". */
const STD_PART_LINE = /^([^:→]+): .* → (-?\d+) of (\d+)$/;

/**
 * What one graded run gives a challenge: the part's or bonus's points, 1 for a run that counts, else 0. Read only from
 * the stored score and extra (the server's own grade); a run with no such part reads 0.
 */
export function challengeValueOf(goal: ChallengeGoal, score: number, extra: Record<string, unknown> | null | undefined): number {
  if (goal.kind === "scoreRuns") return Number.isFinite(score) && score >= goal.score ? 1 : 0;
  if (goal.kind === "part") {
    const lines = (extra?.["reveal"] as { lines?: unknown } | undefined)?.lines;
    if (!Array.isArray(lines)) return 0;
    for (const line of lines) {
      if (typeof line !== "string") continue;
      const m = STD_PART_LINE.exec(line);
      if (m && m[1] === goal.label) return Math.max(0, Number(m[2]));
    }
    return 0;
  }
  // A puzzle on the scoring standard: only a finish counts.
  if (extra?.["standard"] !== 1) return 0;
  const parts = extra["parts"] as { kind?: string; efficiency?: number; speed?: number } | undefined;
  if (!parts || parts.kind !== "finish") return 0;
  const v = goal.kind === "bonus" ? parts.efficiency : parts.speed;
  return typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;
}

/** The challenges for one game. */
export function challengesFor(type: string): PracticeChallenge[] {
  return PRACTICE_CHALLENGES.filter((c) => c.type === type);
}
