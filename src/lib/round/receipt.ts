/**
 * The round engine's receipt (B6, docs/round-engine/plan.md): the server's own figure for the time left on a round's
 * clock when an answer arrived. It bounds the phone's time claim (trust.ts) and its tap and action logs (gradeAnswer's
 * `receivedMsRemaining`). One function for every mode, each with its own way of knowing when the round started:
 *
 *  - `phase`: a room's puzzle phase stamp (`phase_started_at`). An answer that arrives in any other phase (the
 *    reveal: a late answer) arrived after the clock, 0 ms left. Was roomGrade.server.ts `roomReceiptMsRemaining`.
 *  - `start`: an async round's stored start (the Daily, challenges; later a rated match's recorded run). In time it is
 *    the round's own puzzle phase from that start; late or closed, a reveal-phase answer. Was the mapping inside
 *    asyncRoom.server.ts `gradeAsyncAnswer`.
 *  - `sealed`: practice's sealed deal time and start token (practiceReceipt.ts has the rules); undefined for a deal
 *    sealed before the bound. Was practiceReceipt.ts `practiceStartMs` / `practiceReceiptMsRemaining`.
 *  - `none`: no bound (queued offline runs).
 *
 * Moved unchanged: round-engine-parity-check compares every mode against main's own functions. Pure; phone and server.
 */
import { puzzlePrepMs, puzzleTimeLimitMs } from "@/lib/duel/catalogue";
import { INTRO_MS, type DuelPhase, type PuzzleData } from "@/lib/duel/types";
import { windowReceipt } from "./window";

/** A room's receipt: the phase the answer arrived in and that phase's start. */
export interface PhaseReceipt {
  /** The room's phase when the answer arrived ("puzzle", or "reveal" for a late one). */
  phase: DuelPhase;
  /** The room's phase_started_at (round_started_at when missing). */
  phaseStartedAt: string | null;
  /** Server time the answer arrived (ms). */
  nowMs: number;
}

/** An async round's receipt: the player's own stored start. */
export interface StartReceipt {
  /** Server ms the round started (async_results.started_at). */
  startedAt: number;
  nowMs: number;
}

/** Practice's receipt (practiceReceipt.ts). */
export interface SealedReceipt {
  /** Server ms when the deal was sealed; undefined for a deal sealed before the bound. */
  dealtAt?: number | undefined;
  /** Server ms from a valid start token for this deal; undefined with none. */
  startAt?: number | undefined;
  nowMs: number;
}

export type RoundReceipt =
  | ({ mode: "phase" } & PhaseReceipt)
  | ({ mode: "start" } & StartReceipt)
  | ({ mode: "sealed" } & SealedReceipt)
  | { mode: "none" };

/**
 * How long after the intro's own start a practice start token is still taken at face value (the deal's download and
 * the intro's first paint). practiceReceipt.ts re-exports it.
 */
export const PRACTICE_START_SLACK_MS = 5_000;

const iso = (ms: number) => new Date(ms).toISOString();

/** An async round's receipt as the room phase it stands for (in time: the puzzle phase from its start; else the reveal). */
export function phaseReceiptOf(puzzle: PuzzleData | undefined, receipt: StartReceipt): PhaseReceipt {
  const timing = windowReceipt(puzzle, receipt.startedAt, receipt.nowMs);
  return { phase: timing === "puzzle" ? "puzzle" : "reveal", phaseStartedAt: iso(receipt.startedAt), nowMs: receipt.nowMs };
}

/** Practice: the server's start for the round's clock (before prep), or undefined when the deal carries no `dealtAt`. */
export function sealedStartMs(receipt: SealedReceipt): number | undefined {
  const { dealtAt, startAt } = receipt;
  if (dealtAt === undefined || !Number.isFinite(dealtAt)) return undefined;
  const latest = dealtAt + INTRO_MS + PRACTICE_START_SLACK_MS;
  if (startAt !== undefined && Number.isFinite(startAt) && startAt >= dealtAt) return Math.min(startAt, latest);
  return dealtAt + INTRO_MS;
}

/** The server's own time left when the answer arrived; undefined with no bound. */
export function receiptMsRemaining(puzzle: PuzzleData, receipt: RoundReceipt): number | undefined {
  if (receipt.mode === "none") return undefined;
  if (receipt.mode === "start") return receiptMsRemaining(puzzle, { mode: "phase", ...phaseReceiptOf(puzzle, receipt) });
  const limitMs = puzzleTimeLimitMs(puzzle);
  if (receipt.mode === "sealed") {
    const start = sealedStartMs(receipt);
    if (start === undefined) return undefined;
    return limitMs - (receipt.nowMs - start - puzzlePrepMs(puzzle));
  }
  if (receipt.phase !== "puzzle") return 0;
  const startedAt = Date.parse(receipt.phaseStartedAt ?? "");
  if (!Number.isFinite(startedAt)) return undefined;
  return limitMs - (receipt.nowMs - startedAt - puzzlePrepMs(puzzle));
}
