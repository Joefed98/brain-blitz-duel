/**
 * Runs played away from the server (offline practice, 31 Oct 2026). Each finished run is stored on the phone
 * (IndexedDB) with its game, stamps, pack seed, the full answer (move list or input log, exactly what the
 * phone would have sent) and when it was played. When there is a connection the queue is sent, oldest first,
 * to the server's practice grading (practiceGradeQueuedFn), which replays and grades each run exactly as
 * online practice does; the server's score is the one kept. A run stays queued until the server has
 * confirmed or rejected it: a failed send leaves it for the next try. Confirmed runs update this device's
 * practice best; a rejected run shows "Couldn't be confirmed", never a score. Practice only: no room,
 * tournament, daily or challenge ever reads this queue.
 */
import { APP_BUILD_ID } from "@/lib/appVersion";
import { splitClientCounters } from "@/lib/arcade/diagnostics";
import { recordPracticeBest } from "@/lib/duel/practiceBest";
import { recordPracticeGoals } from "@/lib/duel/practiceGoals";
import { stampSignature } from "@/lib/duel/practiceStamps";
import type { SubmitExtra } from "@/lib/duel/grade";
import type { PuzzleData, PuzzleType } from "@/lib/duel/types";

import { getAll, putOne, update } from "./db";
import { emitOfflineChange } from "./events";
import { isOnline } from "./online";

export type QueuedRunStatus = "queued" | "confirmed" | "rejected";

export interface QueuedRun {
  id: string;
  type: PuzzleType;
  /** The deal's stamp signature: the stamps the run was played (and is graded) on. */
  stamp: string;
  /** The pack seed (null for a live deal whose answer couldn't be sent). */
  packSeed: number | null;
  puzzle: PuzzleData;
  sealed: string;
  answer: string;
  msRemaining: number;
  extra?: SubmitExtra;
  playedAt: number;
  /** The phone's own score for an arcade run (its simulation's), shown as provisional; null for puzzles. */
  provisional: number | null;
  status: QueuedRunStatus;
  attempts: number;
  /** The server's result once confirmed. */
  score?: number;
  isCorrect?: boolean;
  /** This run beat the device's practice best when confirmed. */
  improved?: boolean;
  resolvedAt?: number;
  reason?: string;
}

/** Confirmed and rejected runs are kept this long for the Practice tab's list, then dropped. */
export const RESOLVED_KEEP_MS = 7 * 24 * 3600_000;

/** The phone's own score in an arcade run's answer (the counters after "~"), or null. */
export function provisionalScore(answer: string): number | null {
  const score = splitClientCounters(answer).counters?.["score"];
  return typeof score === "number" && Number.isFinite(score) ? Math.max(0, score) : null;
}

export async function readRuns(): Promise<QueuedRun[]> {
  try {
    return (await getAll<QueuedRun>("runs")).sort((a, b) => a.playedAt - b.playedAt);
  } catch {
    return [];
  }
}

export async function queueRun(run: Omit<QueuedRun, "id" | "status" | "attempts" | "stamp" | "provisional"> & { arcade: boolean }): Promise<QueuedRun> {
  const { arcade, ...rest } = run;
  const record: QueuedRun = {
    ...rest,
    id: `${run.playedAt.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    stamp: stampSignature(run.puzzle),
    provisional: arcade ? provisionalScore(run.answer) : null,
    status: "queued",
    attempts: 0,
  };
  await putOne("runs", record);
  emitOfflineChange();
  return record;
}

export interface GradeResponse {
  status: "graded" | "rejected";
  reason?: string;
  score?: number;
  isCorrect?: boolean;
  /** The server's stored extra as JSON text (practice goals read its parts). */
  extraJson?: string | null;
}

export interface FlushDeps {
  /** Signs in again (a fresh token) before anything is sent. */
  ensureSession: () => Promise<unknown>;
  grade: (run: QueuedRun) => Promise<GradeResponse>;
}

async function defaultGrade(run: QueuedRun): Promise<GradeResponse> {
  const { practiceGradeQueuedFn } = await import("@/lib/duel/practice.functions");
  const result = await practiceGradeQueuedFn({
    data: {
      puzzle: run.puzzle,
      sealed: run.sealed,
      answer: run.answer,
      msRemaining: run.msRemaining,
      ...(run.extra ? { extra: run.extra } : {}),
      clientVersion: APP_BUILD_ID,
    },
  });
  return result as GradeResponse;
}

async function defaultSession(): Promise<unknown> {
  const { ensureSession } = await import("@/lib/duel/session");
  return ensureSession();
}

let flushing: Promise<void> | null = null;

/** Sends every queued run, oldest first; stops at the first failure and leaves the rest queued. */
export function flushQueue(deps: FlushDeps = { ensureSession: defaultSession, grade: defaultGrade }): Promise<void> {
  if (flushing) return flushing;
  if (!isOnline()) return Promise.resolve();
  flushing = (async () => {
    try {
      const runs = await readRuns();
      const now = Date.now();
      // Old confirmed or rejected runs are dropped (the queue never loses one that isn't resolved).
      for (const run of runs) {
        if (run.status !== "queued" && (run.resolvedAt ?? now) < now - RESOLVED_KEEP_MS) {
          await update<QueuedRun>("runs", run.id, () => null).catch(() => null);
        }
      }
      const queued = runs.filter((r) => r.status === "queued");
      if (queued.length === 0) return;
      // An expired sign-in is refreshed first; without one, nothing is sent.
      try {
        await deps.ensureSession();
      } catch {
        return;
      }
      for (const run of queued) {
        let result: GradeResponse;
        try {
          result = await deps.grade(run);
        } catch {
          await update<QueuedRun>("runs", run.id, (r) => (r ? { ...r, attempts: r.attempts + 1 } : r)).catch(() => null);
          return;
        }
        if (result.status === "rejected") {
          await update<QueuedRun>("runs", run.id, (r) => (r ? { ...r, status: "rejected", reason: result.reason ?? "rejected", resolvedAt: Date.now() } : r));
        } else {
          const score = Math.max(0, Number(result.score) || 0);
          const best = recordPracticeBest(run.type, run.stamp, score);
          // Practice goals (stars and challenges) from the server's own grade, as an online run's.
          let extra: Record<string, unknown> | null = null;
          try {
            extra = result.extraJson ? (JSON.parse(result.extraJson) as Record<string, unknown>) : null;
          } catch {
            extra = null;
          }
          recordPracticeGoals(run.type, score, extra, best.best);
          await update<QueuedRun>("runs", run.id, (r) =>
            r ? { ...r, status: "confirmed", score, isCorrect: result.isCorrect === true, improved: best.improved, resolvedAt: Date.now() } : r,
          );
        }
        emitOfflineChange();
      }
    } finally {
      flushing = null;
    }
  })();
  return flushing;
}
