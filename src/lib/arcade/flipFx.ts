/**
 * Roofbound's stage-2 effects (the Action overhaul, 15 Nov 2026; docs/arcade-standard/flip.md "Stage 2"): the moments
 * the renderer draws and the sound observer sounds, each read from the sim's own state. Display only: nothing here is
 * read by the sim, the server replay or the score, and nothing writes a state. flipRev 11–13 (the flow revisions) only.
 *
 * Every moment is worked out from one state alone (the take-off tick from the arc timer, the landing tick from `land`),
 * so a replay, a reveal or a seek back draws exactly what the live run drew.
 */
import { FLIP_ARC_TICKS, FLIP_RUNNER_HALF_PX_V2, FLIP_SPIKE, FLIP_V8_SHIELD_TICKS, flipSegShift, type FlipState } from "./flip";

const FP = 256;
const HALF = FLIP_RUNNER_HALF_PX_V2 * FP;

/** A spike counts as a near miss when it passes within this many px of the runner's box (take-off or landing). */
export const FLIP_NEAR_MISS_PX = 24;
/** How long a near miss's glint shows on its spike (ticks). */
export const FLIP_NEAR_GLINT_TICKS = 16;
/** A landing's dust puff (ticks). */
export const FLIP_PUFF_TICKS = 20;
/** A double flip's ring at the runner (ticks). */
export const FLIP_RING_TICKS = 22;
/** A crash's white flash before the respawn blink (ticks). */
export const FLIP_CRASH_FLASH_TICKS = 8;
/** The flow counter's tick-up after a clean landing (ticks). */
export const FLIP_FLOW_POP_TICKS = 14;
/** The flow counter cracking and falling away on a break (ticks). */
export const FLIP_FLOW_BREAK_TICKS = 34;
/** A break of a streak this long or longer cracks the counter (the sound observer's rule for flip.flowBreak). */
export const FLIP_FLOW_BREAK_MIN = 3;
/** The end card's flow best counts up over this long (ms; the sound slot flip.flowCount is 800 ms). */
export const FLIP_FLOW_COUNT_MS = 800;
/** The stage holds a survived flow run's answer this long so SURVIVED! and the count land before the reveal (ms). */
export const FLIP_END_HOLD_MS = 1200;

const flowRun = (s: FlipState): boolean => Boolean(s.flow && s.v8);

/** The tick the current flip took off (the arc timer counts down from arcN), or null on the ground. */
export function flipTakeoffTick(s: FlipState): number | null {
  if (s.flipT <= 0) return null;
  return s.tick - ((s.arcN || FLIP_ARC_TICKS) - s.flipT);
}

/** The tick the runner last landed (land counts the ticks since), or null in the air or before the first landing. */
export function flipLandTick(s: FlipState): number | null {
  if (s.flipT > 0 || s.land === undefined || s.land >= 99) return null;
  return s.tick - s.land;
}

/** The tick of the latest crash while its shield lasts (a save or flipRev 13's respawn), or null. */
export function flipCrashTick(s: FlipState): number | null {
  if (!s.exp || (s.inv ?? 0) <= 0) return null;
  return s.tick - (FLIP_V8_SHIELD_TICKS - (s.inv ?? 0));
}

export interface FlipNearMiss {
  /** The spike's index in the course's segments. */
  seg: number;
  /** The tick it happened (the take-off just before the spike, or the landing just after it). */
  tick: number;
  /** "off": flipped away just before a spike; "on": landed just past one. */
  kind: "off" | "on";
}

/**
 * The run's latest near miss on a spike, if it is this flip's take-off or this stretch's landing: flipped off a surface
 * with a spike's leading edge within FLIP_NEAR_MISS_PX of the runner's box ahead, or landed with one's trailing edge
 * within FLIP_NEAR_MISS_PX behind it. A crash at or after it cancels it (the spike was not missed).
 */
export function flipNearMiss(s: FlipState): FlipNearMiss | null {
  if (!flowRun(s) || s.ended === 2) return null;
  // In the air: this flip's take-off. On the ground: this landing, else the take-off of the flip that ended in it (its
  // arc length is still in the state), so a take-off's glint outlasts a short arc. The latest one that counts wins.
  const off = flipTakeoffTick(s);
  const land = off === null ? flipLandTick(s) : null;
  const tries: [number | null, "off" | "on", number][] = off !== null
    ? [[off, "off", s.side ^ 1]]
    : [[land, "on", s.side], [land === null ? null : land - (s.arcN || FLIP_ARC_TICKS), "off", s.side ^ 1]];
  const crash = flipCrashTick(s);
  for (const [at, kind, side] of tries) {
    if (at === null || at < 1 || (crash !== null && crash >= at)) continue;
    const m = nearMissAt(s, at, kind, side);
    if (m) return m;
  }
  return null;
}

function nearMissAt(s: FlipState, at: number, kind: "off" | "on", side: number): FlipNearMiss | null {
  const x = s.v8!.xs[at];
  if (x === undefined) return null;
  const near = FLIP_NEAR_MISS_PX * FP;
  let best: FlipNearMiss | null = null;
  let gap = Infinity;
  for (let i = Math.max(0, s.cursor - 24); i < s.segs.length; i++) {
    const seg = s.segs[i]!;
    if (seg.x0 - (seg.amp ?? 0) > x + HALF + near) break;
    if (seg.kind !== FLIP_SPIKE || seg.side !== side) continue;
    const d = flipSegShift(seg, at);
    const g = kind === "off" ? seg.x0 + d - (x + HALF) : x - HALF - (seg.x1 + d);
    if (g >= 0 && g <= near && g < gap) {
      gap = g;
      best = { seg: i, tick: at, kind };
    }
  }
  return best;
}

/** The near miss whose glint shows this tick (within FLIP_NEAR_GLINT_TICKS of it), or null. */
export function flipNearMissShown(s: FlipState): FlipNearMiss | null {
  const m = flipNearMiss(s);
  return m && s.tick - m.tick < FLIP_NEAR_GLINT_TICKS ? m : null;
}

/** The current flip is a double flip (taken off within the combo window with a hazard close by). */
export function flipIsDouble(s: FlipState): boolean {
  return flowRun(s) && s.flipT > 0 && (s.chain ?? 0) > 0;
}

/** A clean landing that just added to the flow streak: the counter's tick-up (ticks since), or null. */
export function flipFlowPopAge(s: FlipState): number | null {
  if (!flowRun(s) || !(s.streak ?? 0)) return null;
  const at = flipLandTick(s);
  if (at === null) return null;
  const age = s.tick - at;
  return age < FLIP_FLOW_POP_TICKS ? age : null;
}

/** The landing's puff this tick: where (world x, 1/256 px), how old, on which side and whether it was a sweet spot. */
export function flipLandingPuff(s: FlipState): { x: number; age: number; side: number; sweet: boolean } | null {
  if (!flowRun(s) || s.ended === 2) return null;
  const at = flipLandTick(s);
  if (at === null || at < 1) return null;
  const age = s.tick - at;
  if (age >= FLIP_PUFF_TICKS) return null;
  const x = s.v8!.xs[at];
  if (x === undefined) return null;
  return { x, age, side: s.side, sweet: (s.sweetT ?? -1) === at };
}

/** The end card's flow best `ms` after the run ended: an ease-out count to it over FLIP_FLOW_COUNT_MS (at once when still). */
export function flipFlowCountShown(best: number, ms: number, still: boolean): number {
  const k = still ? 1 : Math.max(0, Math.min(1, ms / FLIP_FLOW_COUNT_MS));
  return Math.round(best * (1 - (1 - k) * (1 - k) * (1 - k)));
}

/** The stage's end hold: a survived flow run waits for SURVIVED! and the flow best's count before the reveal. */
export function flipEndHoldMs(s: FlipState): number {
  return flowRun(s) && s.ended === 1 && (s.bestStreak ?? 0) > 0 ? FLIP_END_HOLD_MS : 0;
}
