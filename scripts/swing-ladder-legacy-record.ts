/**
 * Records scripts/fixtures/swing-ladder-legacy.json.gz: Grappler's swingRev 18 deals and runs at every level (Normal,
 * Easy, Hard and Expert) as they were before swingRev 19 (D5, 23 Nov 2026), for swing-ladder-check. Run it on a tree
 * whose swing sim is today's (swingRev 18 dealt at every level), before any swingRev 19 code:
 *
 *   bun scripts/swing-ladder-legacy-record.ts
 *
 * For each level and each of DEALS deals (level-tune's room seeds 0, 1, 2 …): the dealt puzzle, the course's digest
 * (its whole built state), and the skill-band bot's input log at five levels (weak and great without limits; average,
 * elite and the flawless level under Joe's human limits, as the D5 ladder plays them), each with the server's stored
 * score (gradeAnswer on the dealt puzzle), its flag, the run's restarts and pterodactyl catches, and the checkpoint
 * checksums the sim gave. The check replays each log through today's server path and compares everything.
 */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { SWING_CHECKPOINT_INTERVAL, swingCheckpoint, swingGameFor, type SwingState } from "../src/lib/arcade/swing";
import { gradeAnswer } from "../src/lib/duel/gradeAnswer.server";
import type { PuzzleData } from "../src/lib/duel/types";
import type { Level } from "../src/lib/levels/levels";
import { Human, HUMAN_LIMITS, type SkillLevel } from "./arcade-skill-bands/human";
import { bot as swingBot } from "./arcade-skill-bands/bots/swing";
import { swingSlideSubmission } from "./swing-slide-deal";
import { dealAt } from "./level-tune";

const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 24);
type Ev = { t: number; k: number; a: number; b: number; c: number; d: number };

export const SWING_LADDER_LEGACY = new URL("./fixtures/swing-ladder-legacy.json.gz", import.meta.url);
export const LEGACY_PLAYERS: { level: SkillLevel; limits: boolean }[] = [
  { level: "weak", limits: false },
  { level: "average", limits: true },
  { level: "great", limits: false },
  { level: "elite", limits: true },
  { level: "perfect", limits: true },
];
export interface LegacyRun { player: string; events: number[][]; score: number; flagged: boolean; restarts: number; caught: number; sums: number[] }
export interface LegacyDeal { level: Level; n: number; puzzle: PuzzleData; course: string; runs: LegacyRun[] }

/** The compact log ([t, k, a] a press; b, c and d are always 0 for Grappler's inputs) and back. */
export const packEvents = (events: readonly Ev[]) => events.map((e) => [e.t, e.k, e.a]);
export const unpackEvents = (packed: readonly number[][]): Ev[] => packed.map(([t, k, a]) => ({ t: t!, k: k!, a: a!, b: 0, c: 0, d: 0 }));

/** A log stepped through the game (as the phone does): the checkpoint checksums and the end state. */
export function stepLog(game: ReturnType<typeof swingGameFor>, seed: number, events: readonly Ev[]): { sums: number[]; state: SwingState } {
  const byT = new Map(events.map((e) => [e.t, e]));
  let s = game.init(seed) as SwingState;
  const sums: number[] = [];
  while (!game.isOver(s)) {
    s = game.step(s, byT.get(s.tick + 1) ?? null) as SwingState;
    if (s.tick % SWING_CHECKPOINT_INTERVAL === 0) sums.push(swingCheckpoint(s).checksum);
  }
  return { sums, state: s };
}

const DEALS = 5;
const LEVELS: Level[] = ["normal", "easy", "hard", "expert"];

if (import.meta.main) {
  const deals: LegacyDeal[] = [];
  for (const level of LEVELS) {
    for (let n = 0; n < DEALS; n++) {
      const puzzle = dealAt("swing", level, n) as PuzzleData & { seed: number; swingRev: number; level?: Level };
      const seed = puzzle.seed;
      const game = swingGameFor(puzzle.swingRev, puzzle.level);
      const runs: LegacyRun[] = [];
      for (const p of LEGACY_PLAYERS) {
        const human = new Human("swing", seed, p.level, p.limits ? HUMAN_LIMITS : null);
        const events = (swingBot({ game, seed, rev: puzzle.swingRev, human, fixes: true } as never).events ?? []) as Ev[];
        const { sums, state } = stepLog(game, seed, events);
        const graded = gradeAnswer(puzzle, swingSlideSubmission(seed, events, puzzle.swingRev, (puzzle.level as never) ?? null), 0);
        runs.push({ player: `${p.level}${p.limits ? "+limits" : ""}`, events: packEvents(events), score: graded.score, flagged: Boolean((graded.extra as { flagged?: boolean } | undefined)?.flagged), restarts: state.restarts ?? 0, caught: state.caught ?? 0, sums });
      }
      deals.push({ level, n, puzzle, course: digest(game.init(seed)), runs });
      console.log(level, n, seed, runs.map((r) => `${r.player} ${r.score}${r.caught ? ` (caught ${r.caught})` : ""}`).join(" · "));
    }
  }
  writeFileSync(SWING_LADDER_LEGACY, gzipSync(JSON.stringify({ note: "Grappler swingRev 18 at every level before swingRev 19 (D5, 23 Nov 2026): scripts/swing-ladder-legacy-record.ts", deals })));
  console.log(`wrote ${deals.length} deals, ${deals.reduce((a, d) => a + d.runs.length, 0)} runs`);
}
