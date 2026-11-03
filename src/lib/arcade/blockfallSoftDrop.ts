/**
 * Blockzone's soft drop on the phone (3 Nov 2026, input mapping only, no stamp; Joe's phone note: after a soft drop
 * the next pieces kept falling very fast).
 *
 * The cause: a drag down that ended in a flick sent the hard drop on release and never the soft drop's "off", so
 * the sim (blockfallRev 2's `soft`, which only an input clears) kept every later piece falling at the soft-drop
 * speed. The phone now tracks what it asked for: the soft drop is on only while a drag down (or ↓) holds it for the
 * piece it started on. The stage's discreteTick sends the "off" the tick after the finger lifts (whatever the release
 * sent), the key is let go, or the piece locks; a drag still down after a lock must move down again to speed the next
 * piece up. The sim is unchanged, so every stored round replays as before.
 */
import { BF_INPUT_SOFT, type BfState } from "./blockfall";

export interface SoftPayload {
  k: number;
  a: number;
  b: number;
  c: number;
}

export interface SoftDrop {
  /** A drag down (or ↓ pressed) starts the soft drop: the payload to send. */
  on(by: "drag" | "key"): SoftPayload;
  /** The drag turned back, the key was let go or the finger lifted off a slow drag: the "off" to send, if it was on. */
  off(): SoftPayload | null;
  /** The finger lifted (any release): a drag's soft drop ends; the "off" follows on the next tick if not sent now. */
  lifted(): void;
  /** Every sim tick: the "off" to send (the drag lifted, or the piece it started on locked), else null. */
  tick(state: Pick<BfState, "pieces" | "soft">): SoftPayload | null;
  /** Set when a lock ends a drag's soft drop: the stage measures the next drag down from the finger's place. */
  onLockedMidDrag?: () => void;
}

const OFF: SoftPayload = { k: BF_INPUT_SOFT, a: 0, b: 0, c: 0 };

export function createSoftDrop(): SoftDrop {
  let by: "drag" | "key" | null = null;
  let pieces = -1;
  /** Whether this phone has asked for the soft drop since its last "off". */
  let asked = false;
  /** An "off" is queued and the sim hasn't applied it yet (no second one meanwhile). */
  let offInFlight = false;
  const api: SoftDrop = {
    on(source) {
      by = source;
      pieces = -1;
      asked = true;
      offInFlight = false;
      return { k: BF_INPUT_SOFT, a: 1, b: 0, c: 0 };
    },
    off() {
      const was = asked;
      by = null;
      pieces = -1;
      asked = false;
      if (!was) return null;
      offInFlight = true;
      return { ...OFF };
    },
    lifted() {
      if (by === "drag") by = null;
    },
    tick(state) {
      if (by !== null && pieces < 0) pieces = state.pieces;
      if (by !== null && state.pieces !== pieces) {
        if (by === "drag") api.onLockedMidDrag?.();
        by = null;
      }
      const soft = state.soft ?? 0;
      if (soft === 0) offInFlight = false;
      // Nothing holds the soft drop now: whenever the sim has it on (an "on" that landed after a quick lift, a lock
      // mid-drag, a flick's release), one "off" follows.
      if (by === null && soft === 1 && !offInFlight) {
        asked = false;
        offInFlight = true;
        return { ...OFF };
      }
      return null;
    },
  };
  return api;
}
