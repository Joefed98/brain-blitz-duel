/**
 * Prepare to Duel lightning (Prompt Q, 23 Oct 2026; display only): thin branching bolts in
 * gold and white strike behind the logo at random moments, each fading out in under 300 ms
 * with a soft, brief brightening of the background. Drawn on its own canvas layer
 * (PrepareLightning.tsx); the screen's length, voice, music, room moments and everything
 * after it are unchanged.
 *
 * Safety (WCAG 2.3.1, three flashes a second): strikes are at least LIGHTNING_MIN_GAP_MS
 * apart (never more than 2 in any second), the brightening is a dim gold glow round the
 * strike (never a full-screen white flash), and every strike ends LIGHTNING_FLASH_CLEAR_MS
 * before the moment's own gold flash (roomMoments PREPARE_FLASH_MS), so no second holds more
 * than one strike and that flash. Under prefers-reduced-motion nothing is drawn.
 *
 * Pure: the plan and the bolt shapes come from a random source passed in (Math.random on
 * the phone: the strikes are decoration, so they need not match between players).
 */
import { DUEL_START_MS, DUEL_START_VOICE_MS } from "@/lib/duel/startPresentation";
import { PREPARE_FLASH_MS } from "./roomMoments";

/** A strike's whole life: drawn, then faded to nothing. */
export const LIGHTNING_FADE_MS = 260;
/** Strike to strike, at least: 2 a second at most. */
export const LIGHTNING_MIN_GAP_MS = 550;
export const LIGHTNING_MAX_GAP_MS = 1_350;
export const LIGHTNING_FIRST_MS = 350;
/** Every strike has faded this long before the gold flash. */
export const LIGHTNING_FLASH_CLEAR_MS = 700;
export const LIGHTNING_LAST_END_MS = PREPARE_FLASH_MS - LIGHTNING_FLASH_CLEAR_MS;
/** The brightening's peak alpha (a gold radial glow, centred on the strike). */
export const LIGHTNING_GLOW_ALPHA = 0.14;
/** Distinct bolt shapes, built once per screen size. */
export const LIGHTNING_BOLTS = 3;

export interface Strike {
  atMs: number;
  /** Which of the LIGHTNING_BOLTS shapes. */
  bolt: number;
}

/** The screen's strikes, in order, from a random source in [0, 1). */
export function planStrikes(rand: () => number): Strike[] {
  const strikes: Strike[] = [];
  let at = LIGHTNING_FIRST_MS + Math.round(rand() * 400);
  let last = -1;
  while (at + LIGHTNING_FADE_MS <= LIGHTNING_LAST_END_MS && at < DUEL_START_MS) {
    // Never the same shape twice running.
    let bolt = Math.floor(rand() * LIGHTNING_BOLTS);
    if (bolt === last) bolt = (bolt + 1) % LIGHTNING_BOLTS;
    strikes.push({ atMs: at, bolt });
    last = bolt;
    at += LIGHTNING_MIN_GAP_MS + Math.round(rand() * (LIGHTNING_MAX_GAP_MS - LIGHTNING_MIN_GAP_MS));
  }
  return strikes;
}

/**
 * A strike's strength at `sinceMs` after it lands: a quick double flicker, then an ease-out
 * fade, 0 from LIGHTNING_FADE_MS on.
 */
export function strikeStrength(sinceMs: number): number {
  if (sinceMs < 0 || sinceMs >= LIGHTNING_FADE_MS) return 0;
  const fade = (1 - sinceMs / LIGHTNING_FADE_MS) ** 2;
  // The dip at 40–70 ms reads as the second return stroke of a real strike.
  return sinceMs >= 40 && sinceMs < 70 ? fade * 0.45 : fade;
}

/** A strike's thunder (Prompt S): its recorded crack, quieter than GO's. */
export const STRIKE_THUNDER_MS = 750;
/** No strike's thunder sounds while the "Prepare to Duel" voice line plays, nor this close either side of it. */
export const STRIKE_VOICE_CLEAR_MS = 400;
/**
 * Whether a strike landing at `atMs` sounds its thunder. The voice line plays from DUEL_START_VOICE_MS
 * for `voiceMs` (the decoded file's real length, voiceDurationMs("prepareToDuel")): the crack
 * (STRIKE_THUNDER_MS long) must end STRIKE_VOICE_CLEAR_MS before the line starts, or start
 * STRIKE_VOICE_CLEAR_MS after it ends. Strikes in between are still drawn, silently.
 */
export function strikeSounds(atMs: number, voiceMs: number): boolean {
  return (
    atMs + STRIKE_THUNDER_MS <= DUEL_START_VOICE_MS - STRIKE_VOICE_CLEAR_MS ||
    atMs >= DUEL_START_VOICE_MS + voiceMs + STRIKE_VOICE_CLEAR_MS
  );
}

/** A strike lands now (`sinceMs` after its time): late arrivals (a screen opened mid-strike) stay silent. */
export const STRIKE_SOUND_LATE_MS = 120;

/** The strike live at `elapsedMs` (the latest one landed and not yet faded), if any. */
export function liveStrike(plan: readonly Strike[], elapsedMs: number): Strike | null {
  for (let i = plan.length - 1; i >= 0; i--) {
    const s = plan[i]!;
    if (s.atMs <= elapsedMs) return elapsedMs - s.atMs < LIGHTNING_FADE_MS ? s : null;
  }
  return null;
}

export type Point = readonly [number, number];
export interface BoltShape {
  /** Polylines, the main channel first; `width` is the core's line width in CSS px. */
  lines: { points: Point[]; width: number }[];
  /** Where the brightening centres (the channel's middle), CSS px. */
  glow: Point;
}

/** A jagged line from a to b: midpoint displacement, `depth` halvings, offset ∝ length. */
function jag(rand: () => number, a: Point, b: Point, depth: number, rough: number): Point[] {
  let pts: Point[] = [a, b];
  for (let d = 0; d < depth; d++) {
    const next: Point[] = [pts[0]!];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1]!;
      const q = pts[i]!;
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const off = (rand() - 0.5) * len * rough;
      // Offset across the segment.
      const nx = -(q[1] - p[1]) / (len || 1);
      const ny = (q[0] - p[0]) / (len || 1);
      next.push([(p[0] + q[0]) / 2 + nx * off, (p[1] + q[1]) / 2 + ny * off], q);
    }
    pts = next;
  }
  return pts;
}

/**
 * One branching bolt across a w × h box: from above the top edge, down through most of the
 * screen, off to one side of the centre (the logo sits there), with 2–3 thinner branches.
 */
export function buildBolt(rand: () => number, w: number, h: number, index: number): BoltShape {
  // Shapes alternate sides so two strikes in a row land apart.
  const side = index % 2 === 0 ? -1 : 1;
  const x0 = w / 2 + side * w * (0.12 + rand() * 0.3);
  const x1 = x0 + (rand() - 0.5) * w * 0.35;
  const y1 = h * (0.62 + rand() * 0.28);
  const main = jag(rand, [x0, -8], [x1, y1], 6, 0.4);
  const lines: BoltShape["lines"] = [{ points: main, width: 1.6 }];
  const branches = 2 + Math.floor(rand() * 2);
  for (let b = 0; b < branches; b++) {
    const from = main[Math.floor(main.length * (0.2 + rand() * 0.55))]!;
    const dir = rand() < 0.5 ? -1 : 1;
    const len = h * (0.1 + rand() * 0.16);
    const to: Point = [from[0] + dir * len * (0.45 + rand() * 0.5), from[1] + len];
    const points = jag(rand, from, to, 4, 0.6);
    lines.push({ points, width: 0.9 });
    // A twig off the branch, now and then.
    if (rand() < 0.5) {
      const tf = points[Math.floor(points.length * (0.3 + rand() * 0.4))]!;
      const tl = len * 0.4;
      lines.push({
        points: jag(rand, tf, [tf[0] + dir * tl * 0.7, tf[1] + tl], 3, 0.6),
        width: 0.6,
      });
    }
  }
  // Kept on the screen (a tall, narrow phone would let the jags wander off its sides).
  const clampX = (x: number) => Math.min(w * 1.05, Math.max(-w * 0.05, x));
  for (const line of lines) line.points = line.points.map(([x, y]): Point => [clampX(x), y]);
  return { lines, glow: [clampX((x0 + x1) / 2), y1 * 0.45] };
}
