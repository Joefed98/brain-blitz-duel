/**
 * TEMPORARY: retired at the start of wave 3, with Joe's approval (with round-engine-parity-check and spans.ts).
 *
 * Main's own code from da93f5d, before the round engine (B6, docs/round-engine/plan.md), kept so
 * round-engine-parity-check can run it beside the engine and compare. Every block between `// legacy:begin <id>` and
 * `// legacy:end <id>` is main's text exactly (spans.ts names each span, its substitutions and its hash; the check
 * proves each block against `git show da93f5d:<file>` when history is there, else against the stored hash). Only the
 * lines outside those blocks are new: imports, small wrappers that turn the two inline snippets (the room's stored
 * row, the async round's stored values) into functions, and the stand-ins those snippets name.
 *
 * Never edit a block; to change what is compared, change spans.ts and regenerate.
 */
import { gradeAnswer } from "../../src/lib/duel/gradeAnswer.server";
import { trustedMsRemaining, type Graded, type SubmitExtra } from "../../src/lib/duel/grade";
import { puzzlePrepMs, puzzleTimeLimitMs, puzzleRevealMs } from "../../src/lib/duel/catalogue";
import { roomPuzzleCloseMs, roomTimeoutMs } from "../../src/lib/duel/roomClose";
import { INTRO_MS, type DuelPhase, type PuzzleCategory, type PuzzleData, type PuzzleType } from "../../src/lib/duel/types";
import { generatePuzzle, type GenerateContext } from "../../src/lib/duel/generate.server";
import { newRoomSeed, pickRoundOrder, type RoundSelectionOptions } from "../../src/lib/duel/selection";
import { stampTieRev } from "../../src/lib/duel/tieBreak";
import type { UnblockBankRow } from "../../src/lib/duel/unblock.server";
import { dailyRoundOrder } from "../../src/lib/duel/daily.server";
import type { DailyKind } from "../../src/lib/duel/daily";
import { challengeRoundOrder } from "../../src/lib/duel/challenge.server";
import { splitPuzzle } from "../../src/lib/duel/secrets";
import { asJson } from "../../src/lib/data/db.server";

type Loose = Record<string, unknown>;
const iso = (ms: number) => new Date(ms).toISOString();

/* ---------------------------------------------------------------- roomGrade.server.ts */

// legacy:begin roomGrade
export interface RoomReceipt {
  /** The room's phase when the answer arrived ("puzzle", or "reveal" for a late one). */
  phase: DuelPhase;
  /** The room's phase_started_at (round_started_at when missing). */
  phaseStartedAt: string | null;
  /** Server time the answer arrived (ms). */
  nowMs: number;
}

/** The server's own figure for the time left when the answer arrived; undefined with no stamp. */
export function roomReceiptMsRemaining(puzzle: PuzzleData, receipt: RoomReceipt): number | undefined {
  const limitMs = puzzleTimeLimitMs(puzzle);
  if (receipt.phase !== "puzzle") return 0;
  const startedAt = Date.parse(receipt.phaseStartedAt ?? "");
  if (!Number.isFinite(startedAt)) return undefined;
  return limitMs - (receipt.nowMs - startedAt - puzzlePrepMs(puzzle));
}

export function gradeRoomAnswer(
  puzzle: PuzzleData,
  receipt: RoomReceipt,
  answer: string,
  msRemaining: number,
  extra?: SubmitExtra,
) {
  const limitMs = puzzleTimeLimitMs(puzzle);
  const received = roomReceiptMsRemaining(puzzle, receipt);
  // The player's own measurement stands unless it is impossible for the clock.
  const { ms, clamped } = trustedMsRemaining(msRemaining, received ?? limitMs, limitMs);
  // msLeft: the time left the grade used (display and pings only: buzzer.ts).
  return { graded: gradeAnswer(puzzle, answer, ms, extra, received), clamped, serverMs: received ?? limitMs, msLeft: ms };
}
// legacy:end roomGrade

/** Main's gradeRoomAnswer, as main's gradeAsyncAnswer imported it. */
const LEGACY_ROOM_GRADE = { gradeRoomAnswer };

/* ---------------------------------------------------------------- asyncRoom.ts */

// legacy:begin asyncWindow
export interface AsyncRoundWindow {
  /** The phone sends its draft from here (ms, same clock as `startedAt`). */
  timeoutAt: number;
  /** Answers from here on are late (graded with 0 ms left). */
  lateFrom: number;
  /** The round takes no answer from here on. */
  closesAt: number;
}

export function asyncRoundWindow(
  puzzle: PuzzleData | undefined,
  startedAt: number,
): AsyncRoundWindow {
  const lateFrom = startedAt + roomPuzzleCloseMs(puzzle);
  return {
    timeoutAt: startedAt + roomTimeoutMs(puzzle),
    lateFrom,
    closesAt: lateFrom + puzzleRevealMs(puzzle),
  };
}

/** Whether an answer received at `nowMs` is in time, late, or past the round's close. */
export function asyncReceipt(
  puzzle: PuzzleData | undefined,
  startedAt: number,
  nowMs: number,
): "puzzle" | "late" | "closed" {
  const window = asyncRoundWindow(puzzle, startedAt);
  if (nowMs >= window.closesAt) return "closed";
  return nowMs >= window.lateFrom ? "late" : "puzzle";
}

// legacy:end asyncWindow

/* ---------------------------------------------------------------- asyncRoom.server.ts */

// legacy:begin gradeAsync
/** The room's grading of an async answer: gradeRoomAnswer on the player's own round start. */
export async function gradeAsyncAnswer(
  puzzle: PuzzleData,
  startedAt: number,
  nowMs: number,
  answer: string,
  msRemaining: number,
  extra?: SubmitExtra,
) {
  const { gradeRoomAnswer } = LEGACY_ROOM_GRADE;
  const receipt = asyncReceipt(puzzle, startedAt, nowMs);
  return {
    receipt,
    ...gradeRoomAnswer(
      puzzle,
      // In time: the round's own puzzle phase from its stored start; late: a reveal-phase answer (0 ms left).
      { phase: receipt === "puzzle" ? "puzzle" : "reveal", phaseStartedAt: iso(startedAt), nowMs },
      answer,
      msRemaining,
      extra,
    ),
  };
}

// legacy:end gradeAsync

/** The values main's submitAsyncAnswer stored for a graded answer. */
export function legacyAsyncValues(graded: Graded, nowMs: number) {
// legacy:begin asyncValues
  const values = {
    answered: true,
    answered_at: iso(nowMs),
    answer: graded.answer || null,
    is_correct: graded.isCorrect,
    ms_remaining: graded.storedMs,
    reaction_avg_ms: graded.reactionAvgMs,
    correct_count: graded.correctCount,
    errors: graded.errors,
    extra: graded.extra ?? null,
    score: graded.score,
  };
// legacy:end asyncValues
  return values;
}

/* ---------------------------------------------------------------- duel.functions.ts submitAnswerFn */

/** The row main's submitAnswerFn inserted for a graded answer (the insert captured, nothing written). */
export async function legacyRoomRow(
  graded: Graded,
  room: { id: string },
  player: { player_slot: number },
  data: { roundNumber: number },
): Promise<Record<string, unknown>> {
  let row: Record<string, unknown> = {};
  const client = null;
  const captureRow = async (_client: null, written: Record<string, unknown>) => {
    row = written;
    return { error: null as { code?: string } | null };
  };
// legacy:begin roomRow
    const { answer, isCorrect, score, reactionAvgMs, correctCount, errors, extra, storedMs } = graded;

    const { error } = await captureRow(client, {
      duel_id: room.id,
      player_slot: player.player_slot,
      round_number: data.roundNumber,
      answer: answer || null,
      is_correct: isCorrect,
      ms_remaining: storedMs,
      reaction_avg_ms: reactionAvgMs,
      correct_count: correctCount,
      errors,
      extra: asJson(extra),
      score,
    });
// legacy:end roomRow
  void error;
  return row;
}

/* ---------------------------------------------------------------- practiceReceipt.ts */

// legacy:begin practiceReceipt
export const PRACTICE_START_SLACK_MS = 5_000;

export interface PracticeReceipt {
  /** Server ms when the deal was sealed; undefined for a deal sealed before the bound. */
  dealtAt?: number | undefined;
  /** Server ms from a valid start token for this deal; undefined with none. */
  startAt?: number | undefined;
  /** Server ms when the answer arrived. */
  nowMs: number;
}

/** The server's start for the round's clock (before prep), or undefined when the deal carries no `dealtAt`. */
export function practiceStartMs(receipt: PracticeReceipt): number | undefined {
  const { dealtAt, startAt } = receipt;
  if (dealtAt === undefined || !Number.isFinite(dealtAt)) return undefined;
  const latest = dealtAt + INTRO_MS + PRACTICE_START_SLACK_MS;
  if (startAt !== undefined && Number.isFinite(startAt) && startAt >= dealtAt) return Math.min(startAt, latest);
  return dealtAt + INTRO_MS;
}

/** The server's own time left when the answer arrived (the room's receiptMsRemaining), or undefined with no bound. */
export function practiceReceiptMsRemaining(puzzle: PuzzleData, receipt: PracticeReceipt): number | undefined {
  const start = practiceStartMs(receipt);
  if (start === undefined) return undefined;
  return puzzleTimeLimitMs(puzzle) - (receipt.nowMs - start - puzzlePrepMs(puzzle));
}

/**
 * The time left practice grades with: the claim held to the receipt as in a room (trustedMsRemaining, the same
 * allowance) when the deal carries the server's figures, else the claim as it is (gradeAnswer holds it to the round's
 * length, as before). `received` is passed on to gradeAnswer, which holds tap and action logs to it as a room's are.
 */
export function practiceTrustedMs(puzzle: PuzzleData, claimedMs: number, received: number | undefined): { ms: number; clamped: boolean; received: number | undefined } {
  if (received === undefined) return { ms: claimedMs, clamped: false, received: undefined };
  const { ms, clamped } = trustedMsRemaining(claimedMs, received, puzzleTimeLimitMs(puzzle));
  return { ms, clamped, received };
}
// legacy:end practiceReceipt

/* ---------------------------------------------------------------- generate.server.ts */

// legacy:begin buildRoomPuzzles
/** Generated ONCE per room so every player receives identical puzzles. */
export function buildRoomPuzzles(
  options: RoundSelectionOptions & GenerateContext & {
    /** A room saved with settings: its rounds as dealt from them (roomDeal.ts) on this seed. */
    roundOrder?: readonly PuzzleType[] | undefined;
  } = {},
): {
  roundOrder: PuzzleType[];
  puzzles: PuzzleData[];
} {
  // The room seed orders the categories and picks every banked board.
  const seed = options.seed ?? newRoomSeed();
  const roundOrder = options.roundOrder ? [...options.roundOrder] : pickRoundOrder({ ...options, seed });
  return {
    roundOrder,
    // Every room puzzle carries the tie-break stamp (tieBreak.ts), so a room's
    // rounds are all on the new tie-break clock or, for older rooms, none are.
    puzzles: roundOrder.map((type) =>
      stampTieRev(
        generatePuzzle(type, {
          unblockRow: options.unblockRow ?? null,
          bankSeed: seed,
          recentBankKeys: options.recentBankKeys,
        }),
      ),
    ),
  };
}

// legacy:end buildRoomPuzzles

/* ---------------------------------------------------------------- daily.server.ts */

// legacy:begin dealDaily
/** Deals one daily from its seed: the order, then every puzzle, as a room's start does. */
export function dealDaily(
  kind: DailyKind,
  input: {
    seed: number;
    /** Yesterday's round order (the draw's "previous room"), then older ones. */
    recent?: readonly (readonly string[])[];
    unblockRow?: UnblockBankRow | null;
    recentBankKeys?: ReadonlySet<string>;
  },
): { roundOrder: PuzzleType[]; puzzles: PuzzleData[] } {
  const roundOrder = dailyRoundOrder(kind, input.seed, input.recent ?? []);
  return {
    roundOrder,
    puzzles: roundOrder.map((type) =>
      stampTieRev(
        generatePuzzle(type, {
          unblockRow: input.unblockRow ?? null,
          bankSeed: input.seed,
          recentBankKeys: input.recentBankKeys,
        }),
      ),
    ),
  };
}

// legacy:end dealDaily

/* ---------------------------------------------------------------- challenge.server.ts */

// legacy:begin dealChallenge
/** Deals one challenge: the order, then every puzzle on the challenge's seed, as a room's start does. */
export function dealChallenge(input: {
  categories: readonly PuzzleCategory[];
  rounds: number;
  seed: number;
  unblockRow?: UnblockBankRow | null;
}): { roundOrder: PuzzleType[]; puzzles: PuzzleData[] } {
  const roundOrder = challengeRoundOrder(input.categories, input.rounds, input.seed);
  return {
    roundOrder,
    puzzles: roundOrder.map((type) =>
      stampTieRev(
        generatePuzzle(type, { unblockRow: input.unblockRow ?? null, bankSeed: input.seed }),
      ),
    ),
  };
}

// legacy:end dealChallenge

/* ---------------------------------------------------------------- practice.functions.ts */

// legacy:begin dealPractice
/** One fresh practice deal of a type (the board picked by a new seed), split into its public and private halves. */
async function dealPractice(type: PuzzleType, unblockRow: unknown): Promise<{ pub: PuzzleData; priv: Loose; seed: number }> {
  const { generatePuzzle } = await import("../../src/lib/duel/generate.server");
  const { newRoomSeed } = await import("../../src/lib/duel/selection");
  const seed = newRoomSeed();
  const { pub, priv } = splitPuzzle(generatePuzzle(type, { unblockRow: unblockRow as never, bankSeed: seed }));
  return { pub: pub as PuzzleData, priv: priv as Loose, seed };
}

// legacy:end dealPractice

export { dealPractice };

/** The hashes of the spans above as cut from da93f5d (before substitutions). */
export const LEGACY_HASHES: Record<string, string> = {
  "roomGrade": "b67e8f7563b3d9f90ef13a0f29784c60582d86e3d677f44181e32148462424c0",
  "asyncWindow": "e46313f9ec4d3c884f183b131ca2d435486374145d1af919f2fa01e5d00a777b",
  "gradeAsync": "7c480a19c406488f35f8d28083e371b494fcb4760d43fddb619c39cd41721aa0",
  "asyncValues": "51b5408176daaa9e88ff1f1c5368db911187c21c9eb94af6b4d447376f687de3",
  "roomRow": "921721aa4828edc9ab334d7e18a134c9aeaac4b2109aa173c65f39089c880583",
  "practiceReceipt": "491107058a5158c9f2fe96e3935133382c00c1838ee87c07bf4f46038053f35a",
  "buildRoomPuzzles": "576658e4f3d02b9f54db5fe5ba4ce0a12e93c096e3a29e48d8792410c23895d4",
  "dealDaily": "1656b2c3e2df542fadc3cde1d5653e31587a7cf7055d1bd86cfa2430a0bffffe",
  "dealChallenge": "ef9d3e09695f97536a23da637a2b26bee23edf7829b47a15b41bc00ba41a149d",
  "dealPractice": "d23c3e0f0c910c787254fa892679710c6a77f7182451febf5d370ffcec491f78"
};

// Used by the copied blocks' types only.
export type { DuelPhase, SubmitExtra };
void [gradeAnswer, trustedMsRemaining, puzzlePrepMs, puzzleTimeLimitMs, puzzleRevealMs, roomPuzzleCloseMs, roomTimeoutMs, INTRO_MS];
