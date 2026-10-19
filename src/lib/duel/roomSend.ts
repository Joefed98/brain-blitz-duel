/**
 * One answer per round, retried until it lands (19 Oct 2026, room flow only; nothing here grades).
 *
 * The room page sends one answer per round: the stage's own submit, or the time-out's draft. Before
 * this, a send that failed on the way (a dropped request at the buzzer, a phone between cells) was
 * never retried, so the round ended with no result and scored 0 (#115's audit, item 4). Now a send
 * that throws is sent again, the same answer with the same time claim, after a short backoff
 * (ROOM_SEND_RETRY_MS) while the round still takes answers (the puzzle and reveal phases) and no
 * result is stored. A reply from the server ("stored", "already stored", "that round is over") is
 * never retried: only a send that threw. The server keeps the first answer it stores, so a retry
 * of an answer that did land (its reply lost) changes nothing.
 *
 * Pure and clock-free (the caller passes "now"), so room-send-check drives it with a failing send.
 */

import type { SubmitExtra } from "./grade";

/** Waits before each retry, ms (the last repeats); the round's answer is given up only when the round closes. */
export const ROOM_SEND_RETRY_MS = [400, 800, 1600, 3200, 5000, 5000] as const;

export interface RoomSendPayload {
  duelId: string;
  roundNumber: number;
  answer: string;
  msRemaining: number;
  extra?: SubmitExtra;
}

type Status = "idle" | "sending" | "waiting" | "landed" | "given-up";

export interface RoomSender {
  /** True once this round (key) has an answer on its way or landed: no second answer is sent. */
  claimed(key: string): boolean;
  /** Sends the round's one answer; false (nothing sent) when the round already has one. */
  send(key: string, payload: RoomSendPayload, now: number): boolean;
  /** Retries a failed send once its backoff has passed, while `open` (the round takes answers). */
  tick(key: string, now: number, open: boolean): void;
  /** The current round's state (checks and diagnostics). */
  status(key: string): { status: Status | "none"; attempts: number; payload: RoomSendPayload | null };
}

export function createRoomSender(transport: (payload: RoomSendPayload) => Promise<unknown>): RoomSender {
  let current: { key: string; payload: RoomSendPayload; status: Status; attempts: number; retryAt: number } | null =
    null;

  const attempt = (key: string, now: number) => {
    const entry = current;
    if (!entry || entry.key !== key) return;
    entry.status = "sending";
    entry.attempts += 1;
    const startedAt = now;
    transport(entry.payload).then(
      () => {
        if (current === entry) entry.status = "landed";
      },
      () => {
        if (current !== entry) return;
        const wait = ROOM_SEND_RETRY_MS[Math.min(entry.attempts, ROOM_SEND_RETRY_MS.length) - 1]!;
        entry.status = "waiting";
        entry.retryAt = startedAt + wait;
      },
    );
  };

  return {
    claimed(key) {
      return current?.key === key && current.status !== "idle";
    },
    send(key, payload, now) {
      if (current?.key === key && current.status !== "idle") return false;
      current = { key, payload, status: "idle", attempts: 0, retryAt: 0 };
      attempt(key, now);
      return true;
    },
    tick(key, now, open) {
      const entry = current;
      if (!entry || entry.key !== key || entry.status !== "waiting") return;
      if (!open) {
        entry.status = "given-up";
        return;
      }
      if (now >= entry.retryAt) attempt(key, now);
    },
    status(key) {
      if (!current || current.key !== key) return { status: "none", attempts: 0, payload: null };
      return { status: current.status, attempts: current.attempts, payload: current.payload };
    },
  };
}
