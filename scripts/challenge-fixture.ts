/**
 * Stand-in friend-challenge data for the screen harness (scripts/safe-area-harness.tsx H.challenge,
 * with H.daily carrying the run's attempt view and reveals): a 6-round challenge Sam made, played by
 * Priya and Bartholomew-Jo (the longest name a player can set) before Joe, this device. The rounds
 * are real dealt puzzles (a fixed seed); names and scores are made up. Used by
 * scripts/shots/challenge-shots.ts and the theme / no-wrap screens (scripts/theme-screens.ts).
 */
import { asyncRoundWindow } from "../src/lib/duel/asyncRoom";
import { CHALLENGE_MAX_PLAYERS, CHALLENGE_OPEN_MS, rivalRow, type ChallengeFinalBoard, type ChallengeInfo, type ChallengePlayer, type ChallengeRoster, type ChallengeRoundBoard, type ChallengeSummary } from "../src/lib/duel/challenge";
import { dealChallenge } from "../src/lib/duel/challenge.server";
import { CHALLENGE_RECORD_KEY } from "../src/lib/duel/challengeRecord";
import { gradeAnswer } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { awardRoundsFor } from "../src/lib/duel/awardRounds";
import { puzzleDef, puzzlePrepMs, puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { roomTieRounds } from "../src/lib/duel/tieBreak";
import type { PuzzleCategory, PuzzleData, RoundResultRow, StoredPuzzleType } from "../src/lib/duel/types";
import { LONGEST_NAME } from "./daily-fixture";

export const CHALLENGE_CODE = "K7QM2X";

export interface HarnessChallenge {
  info: ChallengeInfo;
  roster: ChallengeRoster;
  pings: number[];
  boards: Record<number, ChallengeRoundBoard>;
  final: ChallengeFinalBoard | null;
  list: ChallengeSummary[];
  /** The run's puzzles by type (H.puzzles: the stand-in round start sends these). */
  puzzles: Record<string, PuzzleData>;
}

export interface ChallengeScreenData {
  challenge: HarnessChallenge;
  /** The run's attempt view and reveals (H.daily, which the async-room stubs read). */
  daily: { status: unknown; boards: Record<string, unknown>; view: unknown; reveals: unknown[] };
  /** Round 1's start, ms before the page opens (the run starts mid-round or past its time-out). */
  startOffsetMs: number | null;
  record: [string, string];
}

const CATS: PuzzleCategory[] = ["logic", "pattern", "speed", "attention", "word", "arcade"];
const PLAYERS: ChallengePlayer[] = [
  { slot: 1, name: "Sam", colour: 2, icon: null },
  { slot: 2, name: "Priya", colour: 5, icon: null },
  { slot: 3, name: LONGEST_NAME, colour: 7, icon: null },
  { slot: 4, name: "Joe", colour: 6, icon: null },
];
const ME = 4;
/** Each player's round scores (Joe's last). */
const SCORES: Record<number, number[]> = {
  1: [131, 118, 102, 140, 96, 121],
  2: [124, 150, 88, 112, 131, 99],
  3: [97, 104, 120, 101, 75, 143],
  4: [138, 121, 96, 150, 72, 117],
};

let dealt: { puzzles: PuzzleData[] } | null = null;
function deal() {
  if (dealt) return dealt;
  const log = console.log;
  console.log = () => undefined;
  dealt = withSeededRandom(2210, () => dealChallenge({ categories: CATS, rounds: 6, seed: 2210 }));
  console.log = log;
  return dealt;
}

function row(slot: number, round: number, puzzle: PuzzleData, now: number): RoundResultRow {
  const graded = gradeAnswer(puzzle, "", 0);
  const score = SCORES[slot]![round - 1]!;
  return {
    id: `r${slot}-${round}`,
    duel_id: "challenge-room",
    player_slot: slot,
    round_number: round,
    answer: graded.answer || null,
    is_correct: score >= 120,
    ms_remaining: Math.max(0, puzzleTimeLimitMs(puzzle) - (9000 + slot * 3100 + round * 700)),
    reaction_avg_ms: graded.reactionAvgMs,
    correct_count: graded.correctCount,
    errors: graded.errors,
    extra: graded.extra ?? null,
    score,
    submitted_at: new Date(now).toISOString(),
  };
}

/** The screens' data at `now`: which state the link is in, how many have played, where round 1 starts. */
export function challengeFixture(
  kind: "create" | "landing" | "live" | "result" | "podium" | "creator",
  now: number = Date.now(),
): ChallengeScreenData {
  const { puzzles } = deal();
  const pubs = puzzles.map((p) => splitPuzzle(p).pub as PuzzleData);
  const order = puzzles.map((p) => p.type as StoredPuzzleType);
  const players = kind === "creator" ? [{ ...PLAYERS[0]!, name: "Joe", colour: 6, slot: 1 }] : PLAYERS;
  const mySlot = kind === "creator" ? 1 : ME;
  const resultsThrough = (through: number) =>
    players.flatMap((p) =>
      puzzles.slice(0, through).map((puzzle, i) => {
        const full = row(kind === "creator" ? ME : p.slot, i + 1, puzzle, now);
        const shaped = { ...full, player_slot: p.slot };
        return p.slot === mySlot ? shaped : rivalRow(shaped, p.slot, "challenge-room");
      }),
    );
  const summary = (slot: number, round: number) => {
    try {
      return puzzleDef(puzzles[round - 1]!.type).roundSummary(row(slot, round, puzzles[round - 1]!, now), puzzles[round - 1]!);
    } catch {
      return { summary: "—", detail: [] };
    }
  };
  const boards: Record<number, ChallengeRoundBoard> = {};
  for (let r = 1; r <= 6; r++)
    boards[r] = {
      round: r,
      mySlot,
      players,
      results: resultsThrough(r),
      details: players.map((p) => ({ playerSlot: p.slot, ...summary(p.slot, r) })),
      tie: roomTieRounds(puzzles),
      correctAnswer: null,
    };
  const final: ChallengeFinalBoard = {
    code: CHALLENGE_CODE,
    mySlot,
    players,
    results: resultsThrough(6),
    roundOrder: order,
    awardRounds: awardRoundsFor({ round_order: order, puzzles_public: puzzles, round_count: 6 }),
    tie: roomTieRounds(puzzles),
    isCreator: kind === "creator",
    creatorName: kind === "creator" ? "Joe" : "Sam",
    expiresAt: now + CHALLENGE_OPEN_MS - 86_400_000 * 2,
  };
  const state = kind === "landing" ? "play" : kind === "live" || kind === "result" ? "continue" : kind === "create" ? "play" : "done";
  const info: ChallengeInfo = {
    found: true,
    code: CHALLENGE_CODE,
    roomId: "challenge-room",
    creatorName: kind === "creator" ? "Joe" : "Sam",
    isCreator: kind === "creator",
    roundCount: 6,
    players: kind === "landing" ? 3 : players.length,
    maxPlayers: CHALLENGE_MAX_PLAYERS,
    expiresAt: now + CHALLENGE_OPEN_MS - 86_400_000 * 2 - 3_600_000 * 5,
    state,
    roundsDone: 0,
    fromRoom: false,
  };
  // Joe's run: round 1 under way (live) or just past its time-out (the reveal, then the results).
  const window = asyncRoundWindow(pubs[0], 0);
  const startOffsetMs = kind === "live" ? 4000 : kind === "result" ? window.timeoutAt + 200 : null;
  const view = {
    roomId: "challenge-room",
    attemptId: "a",
    roundCount: 6,
    rounds: order.map((type, i) => ({
      round: i + 1,
      type,
      startedAt: null as number | null,
      score: kind === "podium" || kind === "creator" ? SCORES[ME]![i]! : null,
      missed: false,
    })),
    finished: kind === "podium" || kind === "creator",
    total: kind === "podium" || kind === "creator" ? SCORES[ME]!.reduce((a, b) => a + b, 0) : 0,
    closesAt: now + CHALLENGE_OPEN_MS,
  };
  const reveals = puzzles.map((puzzle, i) => ({
    puzzle,
    result: { ...row(ME, i + 1, puzzle, now), player_slot: 1 },
    missed: false,
    summary: summary(ME, i + 1).summary,
    detail: [],
    correctAnswer: null,
  }));
  const list: ChallengeSummary[] = [
    {
      code: CHALLENGE_CODE,
      roundCount: 6,
      createdAt: now - 86_400_000,
      expiresAt: now + 6 * 86_400_000,
      myTotal: 694,
      friends: [
        { name: "Sam", total: 708, finished: true },
        { name: "Priya", total: 612, finished: true },
        { name: LONGEST_NAME, total: 694, finished: true },
        { name: "Kofi", total: null, finished: false },
      ],
    },
    { code: "P4HN8R", roundCount: 3, createdAt: now - 3 * 86_400_000, expiresAt: now + 4 * 86_400_000, myTotal: 388, friends: [] },
  ];
  return {
    challenge: {
      info,
      roster: { mySlot, myName: kind === "creator" ? "Joe" : "Joe", players },
      pings: [1, 2],
      boards,
      final: kind === "podium" || kind === "creator" ? final : null,
      list,
      puzzles: Object.fromEntries(pubs.map((p) => [p.type, p])),
    },
    daily: { status: { available: false }, boards: {}, view, reveals },
    startOffsetMs,
    record: [CHALLENGE_RECORD_KEY, JSON.stringify({ mine: [{ code: CHALLENGE_CODE, at: now - 86_400_000 }], opened: [CHALLENGE_CODE], friendFinished: null, followups: [] })],
  };
}

/** Round 1's game (the run screens' round). */
export function challengeRound1(): { type: string; prepMs: number } {
  const p = deal().puzzles[0]!;
  return { type: p.type, prepMs: puzzlePrepMs(p) };
}
