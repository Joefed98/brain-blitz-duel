/**
 * The shared signature beat (13 Oct 2026): one short moment on every completion,
 * the same in every game, so players learn it (a signature sound will sit on it
 * later; for now it dispatches the named cues below). A gold flash and an app-logo
 * burst, SIGNATURE_MS long, starting SIGNATURE_DELAY_MS after the solve moment so
 * a game's own completion effect (at most 1.2 s) leads into it.
 *
 * Fired from the common solve/finish points only, never from a game:
 * - every puzzle, when its verdict says solved (rooms and practice, useSignatureVerdict);
 * - non-arcade games with no finish state, at the end of the run with 120 or more;
 * - arcade finish games, when the run ends with the finish reached (arcadeFeedback);
 * - open arcade games, at the end of a run of 120 or more on the phone's own sim.
 * Two tiers: "solve", and "fast" (solved with at least half the time left, the
 * full speed part), which is a little bigger. A stored 150 on the reveal gets a
 * short gold burst on the score (perfectBurst).
 *
 * Presentation only: it never changes recorded time or the submission, never
 * takes taps (pointer-events none) and never covers the timer (it is drawn
 * over the game region, below the timer bar). prefers-reduced-motion keeps only
 * a soft gold fade with a still logo.
 *
 * Letting it be seen (13 Oct 2026): whenever the beat fires (a solve, a
 * no-finish run of 120+, an arcade run that earns it) the shared frame holds the
 * board until the beat has finished (signatureHoldUntil, at most
 * SIGNATURE_HOLD_MAX_MS from the solve or run's end): rooms keep the locked
 * board at full brightness, practice waits before showing the reveal (a tap
 * skips the wait). Rounds with no beat, and reduced motion, are never held.
 */
import { APP_LOGO_URL } from "@/lib/brand";
import { BAND_SPECS } from "@/lib/arcade/bandParts";
import { bandTotal } from "@/lib/arcade/scoreBands";
import type { PuzzleType } from "@/lib/duel/types";
import { prefersReducedMotion } from "@/lib/motion";
import { demoHushed, playVoice } from "@/lib/sound";
import { soundCue } from "./soundCues";

export type SignatureTier = "solve" | "fast";

/** Delay from the solve moment to the beat's start (ms). */
export const SIGNATURE_DELAY_MS = 1000;
/** How long the beat lasts (ms), both tiers. */
export const SIGNATURE_MS = 600;
/** The perfect-score burst on the reveal (ms). */
export const PERFECT_MS = 500;
/** Games with no finish state need at least this on the run to earn the beat. */
export const SIGNATURE_MIN_SCORE = 120;
/** A verdict this late after the solve moment no longer gets a beat (the reveal has moved on). */
export const SIGNATURE_LATE_MS = 4000;
/** The longest the shared frame holds the board for the beat, from the solve or run's end (ms). */
export const SIGNATURE_HOLD_MAX_MS = 2000;

export const SIGNATURE_CUES: Record<SignatureTier, string> = {
  solve: "shared.signature.solve",
  fast: "shared.signature.fast",
};
export const PERFECT_CUE = "shared.perfect";

/**
 * Non-arcade games with no finish state: the round runs to the buzzer (or the
 * stored verdict does not mean "solved"), so the beat needs 120+ instead.
 */
export const NO_FINISH_TYPES: ReadonlySet<PuzzleType> = new Set<PuzzleType>([
  "wordsmith",
  "wordhunt",
  "reaction",
  "stopwatch",
  "numline",
  "whack",
  "clayshoot",
  "wordfall",
]);

/** Engine ticks per second (the arcade sims' fixed 60 Hz). */
const TICKS_PER_SECOND = 60;

/** A stored or graded result: what the server said about this player's round. */
export interface SignatureVerdict {
  type: PuzzleType;
  /** Arcade-category games take their beat from the run itself, not the verdict. */
  arcade: boolean;
  correct: boolean;
  score: number;
  msRemaining: number;
  timeLimitMs: number;
}

/** The beat a verdict earns (null for none). Pure. */
export function signatureTierForVerdict(v: SignatureVerdict): SignatureTier | null {
  if (v.arcade) return null;
  if (NO_FINISH_TYPES.has(v.type)) return v.score >= SIGNATURE_MIN_SCORE ? "solve" : null;
  if (!v.correct) return null;
  return v.timeLimitMs > 0 && v.msRemaining * 2 >= v.timeLimitMs ? "fast" : "solve";
}

/**
 * The beat an arcade run earns when it ends (null for none). Finish games: the
 * band breakdown says finished ("fast" when that came with at least half the run
 * left); open games: the band total on the phone's sim is 120 or more. Pure.
 */
export function signatureTierForArcadeRun(
  type: string,
  state: object,
  runMs: number | null,
): SignatureTier | null {
  const spec = BAND_SPECS[type];
  const s = state as { band?: number; acted?: number; tick?: number };
  if (!spec || !s.band) return null;
  try {
    const parts = spec.parts(state);
    if (spec.kind === "finish") {
      if (!parts.finished) return null;
      const elapsedMs = ((s.tick ?? 0) * 1000) / TICKS_PER_SECOND;
      return runMs !== null && runMs > 0 && elapsedMs * 2 <= runMs ? "fast" : "solve";
    }
    return bandTotal(parts, Boolean(s.acted)) >= SIGNATURE_MIN_SCORE ? "solve" : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ active game */

interface ActiveGame {
  type: PuzzleType;
  arcade: boolean;
  /** The arcade run length (registry limit minus the arcade slack); null otherwise. */
  runMs: number | null;
}

let active: ActiveGame | null = null;
let lastSubmit: { type: PuzzleType; at: number } | null = null;

/** FeedbackStage (the wrapper round every Stage) registers the game on screen. */
export function setSignatureGame(game: ActiveGame): () => void {
  active = game;
  return () => {
    if (active === game) active = null;
  };
}

/**
 * The rooms and practice submit points note the moment a round's answer leaves
 * the phone (a solve, or the run's end at the buzzer): the solve moment a later
 * verdict's beat is timed from.
 */
export function noteSignatureSubmit(type: PuzzleType): void {
  lastSubmit = { type, at: Date.now() };
}

/** The noted submit moment for this game, if it was recent enough for a beat. */
export function recentSignatureSubmit(type: PuzzleType): number | null {
  if (!lastSubmit || lastSubmit.type !== type) return null;
  return Date.now() - lastSubmit.at <= SIGNATURE_LATE_MS ? lastSubmit.at : null;
}

/** The last arcade beat scheduled (its start), for signatureHoldUntil. */
let arcadeBeat: { type: PuzzleType; startsAt: number; scheduledAt: number } | null = null;

/**
 * Until when the shared frame should hold this player's board on screen so the
 * beat is seen (Date.now() clock), or null for no hold: the beat's end, capped at
 * SIGNATURE_HOLD_MAX_MS after the noted submit moment (the solve, or the run's
 * end). Every round whose beat fires holds: a solved puzzle, a no-finish game's
 * run of 120+, an arcade run that earned the beat (finish reached, or an open
 * run of 120+). Rounds with no beat (unsolved, below 120), a verdict with no
 * recent submit on this phone (a reload mid-round) and reduced motion get none.
 */
export function signatureHoldUntil(verdict: SignatureVerdict, now = Date.now()): number | null {
  if (prefersReducedMotion()) return null;
  const solvedAt = recentSignatureSubmit(verdict.type);
  if (solvedAt === null) return null;
  let startsAt: number | null = null;
  if (verdict.arcade) {
    const beat = arcadeBeat;
    if (beat && beat.type === verdict.type && now - beat.scheduledAt <= SIGNATURE_LATE_MS)
      startsAt = beat.startsAt;
  } else if (signatureTierForVerdict(verdict) !== null) {
    startsAt = Math.max(solvedAt + SIGNATURE_DELAY_MS, now);
  }
  if (startsAt === null) return null;
  const until = Math.min(startsAt + SIGNATURE_MS, solvedAt + SIGNATURE_HOLD_MAX_MS);
  return until > now ? until : null;
}

function liveGameOnScreen(): boolean {
  return typeof document !== "undefined" && document.querySelector("[data-game-stage]") !== null;
}

/** arcadeFeedback calls this once when a run ends. */
export function signatureArcadeRunOver(state: object): void {
  const game = active;
  if (!game || !game.arcade || demoHushed() || !liveGameOnScreen()) return;
  const tier = signatureTierForArcadeRun(game.type, state, game.runMs);
  if (!tier) return;
  const at = Date.now();
  arcadeBeat = { type: game.type, startsAt: at + SIGNATURE_DELAY_MS, scheduledAt: at };
  scheduleSignature(tier, at);
}

/* -------------------------------------------------------------- the beat */

const pending = new Set<ReturnType<typeof setTimeout>>();

/**
 * Schedules the beat SIGNATURE_DELAY_MS after `solvedAt` (Date.now() clock).
 * Fires at once if that moment has passed, and not at all when more than
 * SIGNATURE_LATE_MS late. Returns a cancel function.
 */
export function scheduleSignature(tier: SignatureTier, solvedAt: number): () => void {
  if (typeof window === "undefined") return () => undefined;
  const now = Date.now();
  if (now - solvedAt > SIGNATURE_LATE_MS) return () => undefined;
  const wait = Math.max(0, solvedAt + SIGNATURE_DELAY_MS - now);
  const timer = setTimeout(() => {
    pending.delete(timer);
    playSignature(tier);
  }, wait);
  pending.add(timer);
  return () => {
    clearTimeout(timer);
    pending.delete(timer);
  };
}

const GOLD = "#F5B82E";

/** The rectangle the beat is drawn over: the game region (below the timer), else the viewport. */
function beatRect(): { left: number; top: number; width: number; height: number } {
  const region = document.querySelector<HTMLElement>("[data-game-region]");
  const box = region?.getBoundingClientRect();
  if (box && box.width > 0 && box.height > 0)
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

/** Draws the beat now: a gold flash and an app-logo burst. */
export function playSignature(tier: SignatureTier): void {
  if (typeof document === "undefined" || !document.body) return;
  soundCue(SIGNATURE_CUES[tier]);
  const reduced = prefersReducedMotion();
  const fast = tier === "fast";
  const rect = beatRect();
  const layer = document.createElement("div");
  layer.dataset["signatureBeat"] = tier;
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: "none",
    zIndex: "45",
    overflow: "hidden",
    display: "grid",
    placeItems: "center",
  });
  const flash = document.createElement("div");
  Object.assign(flash.style, {
    position: "absolute",
    inset: "0",
    background: `radial-gradient(circle at 50% 50%, ${GOLD}${fast ? "8C" : "66"} 0%, ${GOLD}26 38%, transparent 72%)`,
    opacity: "0",
  });
  layer.appendChild(flash);
  const size = Math.round(Math.min(rect.width, rect.height) * (fast ? 0.34 : 0.26));
  const logo = document.createElement("img");
  logo.src = APP_LOGO_URL;
  logo.alt = "";
  logo.draggable = false;
  Object.assign(logo.style, {
    position: "relative",
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "22%",
    boxShadow: `0 0 ${fast ? 48 : 32}px ${GOLD}`,
    opacity: "0",
  });
  layer.appendChild(logo);
  const rays: HTMLElement[] = [];
  if (!reduced) {
    const count = fast ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const ray = document.createElement("span");
      Object.assign(ray.style, {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${fast ? 10 : 8}px`,
        height: `${fast ? 10 : 8}px`,
        marginLeft: `${fast ? -5 : -4}px`,
        marginTop: `${fast ? -5 : -4}px`,
        borderRadius: "999px",
        background: GOLD,
        opacity: "0",
      });
      layer.appendChild(ray);
      rays.push(ray);
    }
  }
  document.body.appendChild(layer);
  const timing = { duration: SIGNATURE_MS, easing: "ease-out", fill: "forwards" as const };
  const animate = (el: HTMLElement, frames: Keyframe[]) => {
    if (typeof el.animate === "function") el.animate(frames, timing);
  };
  if (reduced) {
    animate(flash, [{ opacity: 0 }, { opacity: 0.6, offset: 0.3 }, { opacity: 0 }]);
    animate(logo, [{ opacity: 0 }, { opacity: 0.9, offset: 0.3 }, { opacity: 0 }]);
  } else {
    const peak = fast ? 1.45 : 1.2;
    animate(flash, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }]);
    animate(logo, [
      { opacity: 0, transform: "scale(0.55) rotate(-8deg)" },
      { opacity: 1, transform: `scale(${peak}) rotate(0deg)`, offset: 0.35 },
      { opacity: 0, transform: `scale(${peak + 0.25}) rotate(0deg)` },
    ]);
    const reach = size * (fast ? 1.5 : 1.2);
    rays.forEach((ray, i) => {
      const angle = (i / rays.length) * Math.PI * 2;
      animate(ray, [
        { opacity: 0, transform: "translate(0, 0) scale(1)" },
        {
          opacity: 1,
          transform: `translate(${Math.cos(angle) * reach * 0.4}px, ${Math.sin(angle) * reach * 0.4}px) scale(1)`,
          offset: 0.25,
        },
        {
          opacity: 0,
          transform: `translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach}px) scale(0.4)`,
        },
      ]);
    });
  }
  setTimeout(() => layer.remove(), SIGNATURE_MS + 50);
}

/**
 * The reveal's perfect-score moment: a short gold burst on the stored score
 * element (only ever called for a stored 150).
 */
export function perfectBurst(target: HTMLElement): void {
  if (typeof document === "undefined" || !document.body) return;
  soundCue(PERFECT_CUE);
  playVoice("voice.perfect");
  const box = target.getBoundingClientRect();
  const reduced = prefersReducedMotion();
  const layer = document.createElement("div");
  layer.dataset["perfectBurst"] = "";
  layer.setAttribute("aria-hidden", "true");
  Object.assign(layer.style, {
    position: "fixed",
    left: `${box.left + box.width / 2}px`,
    top: `${box.top + box.height / 2}px`,
    width: "0",
    height: "0",
    pointerEvents: "none",
    zIndex: "45",
  });
  const glow = document.createElement("span");
  const glowSize = Math.max(box.width, box.height) * 1.6;
  Object.assign(glow.style, {
    position: "absolute",
    left: `${-glowSize / 2}px`,
    top: `${-glowSize / 2}px`,
    width: `${glowSize}px`,
    height: `${glowSize}px`,
    borderRadius: "999px",
    background: `radial-gradient(circle, ${GOLD}80 0%, transparent 70%)`,
    opacity: "0",
  });
  layer.appendChild(glow);
  const sparks: HTMLElement[] = [];
  if (!reduced) {
    for (let i = 0; i < 10; i++) {
      const spark = document.createElement("span");
      Object.assign(spark.style, {
        position: "absolute",
        left: "-3px",
        top: "-3px",
        width: "6px",
        height: "6px",
        borderRadius: "999px",
        background: GOLD,
        opacity: "0",
      });
      layer.appendChild(spark);
      sparks.push(spark);
    }
  }
  document.body.appendChild(layer);
  const timing = { duration: PERFECT_MS, easing: "ease-out", fill: "forwards" as const };
  if (typeof glow.animate === "function") {
    glow.animate(
      reduced
        ? [{ opacity: 0 }, { opacity: 0.7, offset: 0.3 }, { opacity: 0 }]
        : [
            { opacity: 0, transform: "scale(0.6)" },
            { opacity: 1, transform: "scale(1)", offset: 0.3 },
            { opacity: 0, transform: "scale(1.3)" },
          ],
      timing,
    );
    const reach = Math.max(box.width / 2, 40) + 24;
    sparks.forEach((spark, i) => {
      const angle = (i / sparks.length) * Math.PI * 2;
      spark.animate(
        [
          { opacity: 1, transform: "translate(0, 0)" },
          {
            opacity: 0,
            transform: `translate(${Math.cos(angle) * reach}px, ${Math.sin(angle) * reach * 0.6}px)`,
          },
        ],
        timing,
      );
    });
  }
  setTimeout(() => layer.remove(), PERFECT_MS + 50);
}
