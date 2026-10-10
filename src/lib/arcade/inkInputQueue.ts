/**
 * Rainbow Bridge client input queue: turns finger samples into the one-per-tick
 * STROKE / LIFT events the sim records. Shared by the Stage and the proof script.
 *
 * Live drops (rounds 9–10): the sim only makes a live stroke solid on LIFT, and the
 * recorder delivers one event per tick. Queuing every 12 px sample meant a long
 * stroke drained over many ticks with its LIFT last, so a fast-falling coin (lower
 * in the arena it is faster) passed through the still-dashed draft before it was
 * committed. While the coin is falling we therefore send only the newest finger
 * point each tick (older backlog points are merged into one longer segment), so
 * the LIFT lands at most a tick or two after the finger lifts. The sim, its
 * inputs and replays are unchanged — this only decides which samples are sent.
 */
import { INK_INPUT_LIFT, INK_INPUT_STROKE, INK_STEP_PX } from "./inkBridge";

export interface InkPayload {
  k: number;
  a: number;
  b: number;
  c: number;
}

const MAX_PENDING = 120;

export class InkInputQueue {
  pending: InkPayload[] = [];
  pen: { x: number; y: number } | null = null;
  presses = 0;

  push(payload: InkPayload): void {
    if (this.pending.length < MAX_PENDING) this.pending.push(payload);
  }

  /** A button press (RELEASE / UNDO / RESET / DROP AGAIN). */
  press(k: number): void {
    this.presses = (this.presses + 1) % 256;
    this.pen = null;
    this.push({ k, a: this.presses, b: 0, c: 0 });
  }

  /** Finger sample in world coordinates; returns the payload to send now on "down". */
  pointer(kind: "down" | "move" | "up", x: number, y: number, liveDropping: boolean): InkPayload | null {
    if (kind === "down") {
      this.pen = { x, y };
      const start = { k: INK_INPUT_STROKE, a: x, b: y, c: 1 };
      this.push(start);
      return start;
    }
    const from = this.pen;
    if (!from) return null;
    if (Math.hypot(x - from.x, y - from.y) >= INK_STEP_PX || (kind === "up" && (x !== from.x || y !== from.y))) {
      this.pen = { x, y };
      this.push({ k: INK_INPUT_STROKE, a: x, b: y, c: 0 });
    }
    if (kind === "up") {
      this.pen = null;
      // Live levels: finger-up while the coin is falling commits the draft so far.
      if (liveDropping) {
        this.presses = (this.presses + 1) % 256;
        this.push({ k: INK_INPUT_LIFT, a: this.presses, b: 0, c: 0 });
      }
    }
    return null;
  }

  /** The event for this tick. While a live drop is falling, stale stroke points are merged. */
  next(liveDropping: boolean): InkPayload | null {
    if (liveDropping) {
      while (
        this.pending.length > 1 &&
        isContinuation(this.pending[0]!) &&
        isContinuation(this.pending[1]!)
      ) {
        this.pending.shift();
      }
    }
    return this.pending.shift() ?? null;
  }
}

function isContinuation(p: InkPayload): boolean {
  return p.k === INK_INPUT_STROKE && p.c === 0;
}
