/**
 * Celebrations (Prompt P, 23 Oct 2026; display, sound and animation only). The shared kit and the
 * rules for when each moment fires:
 *
 * - the gold spark burst (at a point or along a row), the banner pill ("New best!", "7-day
 *   streak!", "You win!"), the Joulz hero's victory pose and run, and the GO lightning strike, all
 *   drawn by the one shared full-screen layer (CelebrationLayer: one canvas, pointer-events none,
 *   particles capped at CELEBRATION_PARTICLES and pooled; src/lib/fx/celebrationCanvas.ts);
 * - the synthesised sounds (sound.ts `playCelebrationSynth`: the signature zap, the spark chime,
 *   the meter's crackle), which follow mute and the effects volume.
 *
 * Every effect is an overlay on what already happens: nothing here waits, nothing changes a score,
 * a timer, a phase, a call or what a screen says, and a screen that moves on clears its own
 * effects (scopes, useCelebrationScope). One switch, FX_CELEBRATIONS in src/config/betaConfig.ts:
 * false leaves every screen exactly as before. prefers-reduced-motion: no particles, flashes,
 * running or count-ups; banners and the podium hero appear with a gentle fade; sounds still play.
 * celebrations-check proves it.
 */
import { FX_CELEBRATIONS, HERO_RUN_SCORE } from "@/config/betaConfig";
import { MAX_PLAYERS } from "@/lib/duel/types";
import type { Standing } from "@/lib/duel/scoring";
import { prefersReducedMotion } from "@/lib/motion";
import { playCelebrationSynth, type CelebrationSynth } from "@/lib/sound";

/** The most sparks alive at once, across every burst. */
export const CELEBRATION_PARTICLES = 120;
/** The banner: drop-in, hold, fade (ms). */
export const BANNER_IN_MS = 220;
export const BANNER_HOLD_MS = 1200;
export const BANNER_OUT_MS = 320;
/** The hero's run across the screen's bottom (ms). */
export const HERO_RUN_MS = 1600;
/** The results count-up (ms), and the rows' slide into their new order. */
export const COUNT_UP_MS = 1200;
export const COUNT_UP_SLIDE_MS = 500;
/** The GO strike: in (under 300 ms), held, out; one strike per GO, so at most one a second. */
export const STRIKE_IN_MS = 110;
export const STRIKE_MS = 620;
/** The logo's charge-in on the app's first screen (ms). */
export const LOGO_CHARGE_MS = 600;
/** Milestone streaks (days) that get a banner on the daily results. */
export const STREAK_MILESTONES: readonly number[] = [3, 7, 30];
/** The podium hero bobs this long, then holds its pose (so an idle podium costs no frames). */
export const PODIUM_HERO_BOB_MS = 6000;

export { HERO_RUN_SCORE };

/* ------------------------------------------------------------------ switch */

/** The switch: FX_CELEBRATIONS, which a check may stand in for through window.__DUELZ_BETA_CONFIG__. */
export function celebrationsOn(): boolean {
  if (typeof window !== "undefined") {
    const override = (window as unknown as { __DUELZ_BETA_CONFIG__?: { FX_CELEBRATIONS?: unknown } })
      .__DUELZ_BETA_CONFIG__?.FX_CELEBRATIONS;
    if (typeof override === "boolean") return override;
  }
  return FX_CELEBRATIONS;
}

/** Reduced motion: final states only (a gentle fade), no particles, flashes, running or counting. */
export function celebrationCalm(): boolean {
  return prefersReducedMotion();
}

/* ------------------------------------------------------------------- rules */

/** The hero run: this player's own stored round score is HERO_RUN_SCORE or more. */
export function heroRunEarned(score: number | null | undefined): boolean {
  return typeof score === "number" && score >= HERO_RUN_SCORE;
}

/** A streak that gets a banner (3, 7 or 30 days); null for any other. */
export function streakMilestone(streak: number): number | null {
  return STREAK_MILESTONES.includes(streak) ? streak : null;
}

export function streakBannerText(days: number): string {
  return `${days}-day streak!`;
}

/** The lobby meter's fill, 0 … 1 (players over the room's maximum). */
export function meterFill(players: number): number {
  return Math.max(0, Math.min(1, players / MAX_PLAYERS));
}

export function meterLabel(players: number): string {
  return `${players} of ${MAX_PLAYERS} players`;
}

/** The podium's "You win!" banner and zap: this device holds first place (shared or not). */
export function podiumWinnerIsMe(rows: readonly Standing[], mySlot: number): boolean {
  return rows.some((row) => row.slot === mySlot && row.position === 1);
}

/** Where a row's total counts up from: the total before the round being shown. */
export function countUpFrom(row: Pick<Standing, "total" | "roundScore">): number {
  return Math.max(0, row.total - row.roundScore);
}

/** A row that climbed: the small zap and sparks at its row. */
export function movedUp(row: Pick<Standing, "position" | "previousPosition">): boolean {
  return row.previousPosition !== null && row.position < row.previousPosition;
}

const heroRuns = new Set<string>();
/** Once per round: true the first time a round's key asks (rooms, practice and daily keys differ). */
export function claimHeroRun(key: string): boolean {
  if (heroRuns.has(key)) return false;
  heroRuns.add(key);
  return true;
}

/** Checks only: forget which rounds have run. */
export function resetCelebrationMemory(): void {
  heroRuns.clear();
  logoCharged = false;
}

let logoCharged = false;
/**
 * The logo charges in on the app's first screen only (the server-rendered page and its hydration
 * draw the same markup); any later mount draws the finished logo. Reading it is stable for a mount.
 */
export function logoChargeWanted(): boolean {
  return celebrationsOn() && !logoCharged;
}
/** Called once the first logo has mounted: every later logo is drawn finished. */
export function noteLogoCharged(): void {
  logoCharged = true;
}

/* ------------------------------------------------------------------ events */

export type CelebrationRequest =
  | { kind: "burst"; scope: number; x: number; y: number; w: number; count: number }
  | { kind: "banner"; scope: number; text: string; calm: boolean; burst: boolean }
  | { kind: "heroRun"; scope: number }
  | { kind: "podiumHero"; scope: number; anchor: Element; calm: boolean }
  | { kind: "strike" }
  | { kind: "clear"; scope: number };

export type CelebrationSink = (request: CelebrationRequest) => void;

let sink: CelebrationSink | null = null;
const log: CelebrationRequest[] = [];
let logging = false;

/** The layer registers itself; a request with no layer mounted is dropped. */
export function setCelebrationSink(next: CelebrationSink | null): () => void {
  sink = next;
  return () => {
    if (sink === next) sink = null;
  };
}

/** Checks only: record every request (and sound) sent from now on. */
export function logCelebrations(on: boolean): CelebrationRequest[] {
  logging = on;
  log.length = 0;
  return log;
}
const soundLog: CelebrationSynth[] = [];
export function celebrationSoundLog(): CelebrationSynth[] {
  return soundLog;
}

/** A browser check's record (window.__DUELZ_CELEBRATION_LOG__, an array it sets up; the app never does). */
function pageLog(entry: { kind: string; text?: string; at: number }): void {
  if (typeof window === "undefined") return;
  const list = (window as unknown as { __DUELZ_CELEBRATION_LOG__?: unknown }).__DUELZ_CELEBRATION_LOG__;
  if (Array.isArray(list)) list.push(entry);
}

function send(request: CelebrationRequest): void {
  if (logging) log.push(request);
  if (request.kind !== "clear") pageLog({ kind: request.kind, ...(request.kind === "banner" ? { text: request.text } : {}), at: Date.now() });
  sink?.(request);
}

let nextScope = 1;
/** A new scope for one screen's effects. */
export function celebrationScope(): number {
  return nextScope++;
}
/** The screen moved on: its effects end now. */
export function clearCelebrations(scope: number): void {
  send({ kind: "clear", scope });
}

/** A celebration sound (follows mute), only while celebrations are on. */
export function celebrationSound(kind: CelebrationSynth, volume = 1): void {
  if (!celebrationsOn()) return;
  if (logging) soundLog.push(kind);
  pageLog({ kind: `sound:${kind}`, at: Date.now() });
  playCelebrationSynth(kind, volume);
}

/** A gold spark burst at a point (CSS px in the viewport); `w` spreads it along a row. */
export function sparkBurst(scope: number, x: number, y: number, options: { w?: number; count?: number } = {}): void {
  if (!celebrationsOn() || celebrationCalm()) return;
  send({ kind: "burst", scope, x, y, w: options.w ?? 0, count: Math.min(CELEBRATION_PARTICLES, options.count ?? 36) });
}

/** A burst at an element's centre (`row`: spread along its width). */
export function sparkBurstOn(scope: number, element: Element | null, options: { row?: boolean; count?: number } = {}): void {
  if (!element) return;
  const box = element.getBoundingClientRect();
  sparkBurst(scope, box.left + box.width / 2, box.top + box.height / 2, {
    w: options.row ? box.width * 0.8 : 0,
    ...(options.count === undefined ? {} : { count: options.count }),
  });
}

/** The banner pill (`burst`: sparks off it as it lands); reduced motion fades it in and out, no drop or sparks. */
export function showBanner(scope: number, text: string, options: { burst?: boolean } = {}): void {
  if (!celebrationsOn()) return;
  const calm = celebrationCalm();
  send({ kind: "banner", scope, text, calm, burst: Boolean(options.burst) && !calm });
}

/** The hero runs once along the screen's bottom (never under reduced motion). */
export function heroRun(scope: number): void {
  if (!celebrationsOn() || celebrationCalm()) return;
  send({ kind: "heroRun", scope });
}

/** The hero in the victory pose beside the winner's step (`anchor`); still under reduced motion. */
export function podiumHero(scope: number, anchor: Element): void {
  if (!celebrationsOn()) return;
  send({ kind: "podiumHero", scope, anchor, calm: celebrationCalm() });
}

/** GO: one lightning strike across the screen and the zap (the zap alone under reduced motion). */
export function goStrike(): void {
  if (!celebrationsOn()) return;
  celebrationSound("zap");
  if (!celebrationCalm()) send({ kind: "strike" });
}
