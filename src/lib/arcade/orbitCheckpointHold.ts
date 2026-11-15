/**
 * Orbit's SET CHECKPOINT guard (the Action overhaul, 15 Nov 2026; phone input mapping only, every revision, no stamp):
 * the button sends its one input only after it has been held ORBIT_CHECKPOINT_HOLD_MS, so a tap that lands on it by
 * accident (a release aimed near the corner) can't spend the checkpoint. The keyboard's C stays a deliberate press.
 */
export const ORBIT_CHECKPOINT_HOLD_MS = 450;

/** Whether a press that went down at `downMs` and is still held at `nowMs` has set the checkpoint. */
export function orbitCheckpointHoldDone(downMs: number, nowMs: number): boolean {
  return nowMs - downMs >= ORBIT_CHECKPOINT_HOLD_MS;
}
