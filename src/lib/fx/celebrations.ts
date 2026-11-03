/**
 * Celebrations (Prompt P, 23 Oct 2026; display, sound and animation only). The shared kit and the
 * rules for when each moment fires:
 *
 * - the gold spark burst (at a point or along a row), the banner pill ("New best!", "7-day
 *   streak!", "You win!"), the Joulz hero's victory pose and run, and the GO lightning strike, all
 *   drawn by the one shared full-screen layer (CelebrationLayer: one canvas, pointer-events none,
 *   particles capped at CELEBRATION_PARTICLES and pooled; src/lib/fx/celebrationCanvas.ts);
 * - the recorded sounds (Prompt S, 24 Oct 2026: the sfx_* files in public/sounds, one manifest slot
 *   each under `shared.celebrate.*`, CELEBRATION_SOUND_SLOTS), played through playCueSlot, so they
 *   follow mute and the effects volume, are preloaded with every effect once sound unlocks, and a
 *   file not decoded yet is skipped, never waited for.
 *
 * Every effect is an overlay on what already happens: nothing here waits, nothing changes a score,
 * a timer, a phase, a call or what a screen says, and a screen that moves on clears its own
 * effects (scopes, useCelebrationScope). One switch, FX_CELEBRATIONS in src/config/betaConfig.ts:
 * false leaves every screen exactly as before. prefers-reduced-motion: no particles, flashes,
 * running or count-ups; banners and the podium hero appear with a gentle fade; sounds still play.
 * celebrations-check proves it.
 */
import { FX_CELEBRATIONS, HERO_DANCE_SCORE, HERO_GRAND_SCORE, HERO_RUN_SCORE } from "@/config/betaConfig";
import { MAX_PLAYERS } from "@/lib/duel/types";
import type { Standing } from "@/lib/duel/scoring";
import { prefersReducedMotion } from "@/lib/motion";
import { playCueSlot, soundUnlocked } from "@/lib/sound";

/** The most sparks alive at once, across every burst. */
export const CELEBRATION_PARTICLES = 120;
/** The banner: drop-in, hold, fade (ms). */
export const BANNER_IN_MS = 220;
export const BANNER_HOLD_MS = 1200;
export const BANNER_OUT_MS = 320;
/** The hero's run across the screen's bottom (ms). */
export const HERO_RUN_MS = 1600;
/** The hero's dance on a 190–199 reveal: on, dance, off (ms). */
export const HERO_DANCE_MS = 1500;
/** The hero's lap of the screen with fireworks on a 200 reveal (ms). */
export const HERO_GRAND_MS = 3000;
/** Reduced motion's stand-in for both: the hero standing still with a short glow (ms). */
export const HERO_STILL_MS = 1400;
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

export { HERO_DANCE_SCORE, HERO_GRAND_SCORE, HERO_RUN_SCORE };

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

/** The reveal's hero moment for this player's own stored round score: 200 grand, 190–199 dance, 150+ run. */
export type HeroMoment = "run" | "dance" | "grand";
export function heroMomentFor(score: number | null | undefined): HeroMoment | null {
  if (typeof score !== "number") return null;
  if (score >= HERO_GRAND_SCORE) return "grand";
  if (score >= HERO_DANCE_SCORE) return "dance";
  return heroRunEarned(score) ? "run" : null;
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
  crackleTurn = 0;
  lastTickAt = -Infinity;
}

let logoCharged = false;
/**
 * The first charge-in belongs to the screen the app opened on: a header first drawn after a route
 * change (a room link opened first, then Play) is drawn finished.
 */
const openPath = typeof window === "undefined" ? null : window.location.pathname;
/** Back from at least this long in the background counts as reopening the app (an iOS home-screen app resumed). */
export const APP_REOPEN_HIDDEN_MS = 30_000;
/**
 * The logo charges in once per app open (memory only, no storage): the app's first header, drawn as it
 * opens (the server-rendered page and its hydration draw the same markup), and again when the app is
 * reopened (onAppOpen). Never on a tab switch, a route change or a return to the Play tab.
 */
export function logoChargeWanted(): boolean {
  if (!celebrationsOn() || logoCharged) return false;
  return typeof window === "undefined" || openPath === null || window.location.pathname === openPath;
}
/**
 * The charge-in's sound, as it plays: only when sound is already unlocked (an iPhone blocks sound
 * before the first tap, so the app's first charge-in is silent), never queued; none under reduced
 * motion, where the mark is drawn finished.
 */
export function logoChargeSound(): void {
  if (!celebrationsOn() || celebrationCalm() || !soundUnlocked()) return;
  celebrationSound("logoCharge");
}
/** Called once the first logo has mounted: every later logo is drawn finished. */
export function noteLogoCharged(): void {
  logoCharged = true;
}

const openListeners = new Set<() => void>();
let openInstalled = false;
let hiddenAt: number | null = null;
/** The app was reopened (a bfcache restore, or back after APP_REOPEN_HIDDEN_MS hidden): the header on screen charges in again. */
export function appReopened(): void {
  if (!celebrationsOn()) return;
  openListeners.forEach((listener) => listener());
}
/** The header listens for a reopen while it is on screen. */
export function onAppOpen(listener: () => void): () => void {
  if (!openInstalled && typeof window !== "undefined" && typeof document !== "undefined") {
    openInstalled = true;
    window.addEventListener("pageshow", (event) => {
      if ((event as PageTransitionEvent).persisted) appReopened();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else {
        if (hiddenAt !== null && Date.now() - hiddenAt >= APP_REOPEN_HIDDEN_MS) appReopened();
        hiddenAt = null;
      }
    });
  }
  openListeners.add(listener);
  return () => {
    openListeners.delete(listener);
  };
}

/* ------------------------------------------------------------------ events */

export type CelebrationRequest =
  | { kind: "burst"; scope: number; x: number; y: number; w: number; count: number }
  | { kind: "banner"; scope: number; text: string; calm: boolean; burst: boolean }
  | { kind: "heroRun"; scope: number; anchor?: Element | null }
  | { kind: "heroShow"; scope: number; show: "dance" | "grand"; calm: boolean; anchor?: Element | null }
  | { kind: "skip"; scope: number }
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
const soundLog: CelebrationSound[] = [];
export function celebrationSoundLog(): CelebrationSound[] {
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
  if (request.kind !== "clear")
    pageLog({
      kind: request.kind,
      ...(request.kind === "banner" ? { text: request.text } : {}),
      ...(request.kind === "heroShow" ? { text: `${request.show}${request.calm ? ":calm" : ""}` } : {}),
      at: Date.now(),
    });
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

/* ------------------------------------------------------------------ sounds */

export type CelebrationSound =
  | "zap"
  | "chime"
  | "crackle"
  | "victory"
  | "heroRun"
  | "overtake"
  | "countTick"
  | "countDing"
  | "thunder"
  | "prepareThunder"
  | "streak"
  | "streakBig"
  | "logoCharge"
  | "heroDance"
  | "heroGrand"
  | "firework";

/** Each sound's manifest slot (src/lib/fx/manifest.ts); the crackle rotates through its three. */
export const CELEBRATION_SOUND_SLOTS: Record<Exclude<CelebrationSound, "crackle">, string> & { crackle: readonly string[] } = {
  zap: "shared.celebrate.zap",
  chime: "shared.celebrate.chime",
  crackle: ["shared.celebrate.crackle1", "shared.celebrate.crackle2", "shared.celebrate.crackle3"],
  victory: "shared.celebrate.victory",
  heroRun: "shared.celebrate.heroRun",
  overtake: "shared.celebrate.overtake",
  countTick: "shared.celebrate.countTick",
  countDing: "shared.celebrate.countDing",
  thunder: "shared.celebrate.thunder",
  prepareThunder: "shared.celebrate.prepareThunder",
  streak: "shared.celebrate.streak",
  streakBig: "shared.celebrate.streakBig",
  logoCharge: "shared.celebrate.logoCharge",
  heroDance: "shared.celebrate.heroDance",
  heroGrand: "shared.celebrate.heroGrand",
  firework: "shared.celebrate.firework",
};

let crackleTurn = 0;
/** The next crackle's slot: 1, 2, 3, 1… so the same one never plays twice in a row. */
export function nextCrackleSlot(): string {
  const slots = CELEBRATION_SOUND_SLOTS.crackle;
  const slot = slots[crackleTurn % slots.length]!;
  crackleTurn = (crackleTurn + 1) % slots.length;
  return slot;
}

/**
 * A celebration sound, only while celebrations are on: the slot's recorded file (follows mute and
 * the effects volume; the slot's own volume and play cap). Silent before sound is unlocked or while
 * the file is still decoding, never queued for later.
 */
export function celebrationSound(kind: CelebrationSound, volume = 1): void {
  if (!celebrationsOn()) return;
  if (logging) soundLog.push(kind);
  pageLog({ kind: `sound:${kind}`, at: Date.now() });
  playCueSlot(kind === "crackle" ? nextCrackleSlot() : CELEBRATION_SOUND_SLOTS[kind], volume);
}

/** The count-up's ticks: at most this many a second, across every row counting at once. */
export const COUNT_TICKS_PER_S = 12;
let lastTickAt = -Infinity;
/** A count-up's displayed number changed: a tick, unless one played under 1/COUNT_TICKS_PER_S s ago. */
export function countUpTick(now = typeof performance === "undefined" ? Date.now() : performance.now()): void {
  if (!celebrationsOn() || now - lastTickAt < 1000 / COUNT_TICKS_PER_S) return;
  lastTickAt = now;
  celebrationSound("countTick");
}
/** A count-up landed on its final score (rows landing together share one ding: the slot's gap). */
export function countUpDing(): void {
  celebrationSound("countDing");
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
export function heroRun(scope: number, anchor: Element | null = null): void {
  if (!celebrationsOn() || celebrationCalm()) return;
  send({ kind: "heroRun", scope, anchor });
  celebrationSound("heroRun");
}

/**
 * A 190–199 reveal: the hero runs on, dances about 1.5 s and steps off, with its flourish. Reduced
 * motion: the hero stands still with a short glow instead (the sound still plays).
 */
export function heroDance(scope: number, anchor: Element | null = null): void {
  if (!celebrationsOn()) return;
  send({ kind: "heroShow", scope, show: "dance", calm: celebrationCalm(), anchor });
  celebrationSound("heroDance");
}

/**
 * A 200 reveal: the hero runs a lap of the screen under fireworks (about 3 s), with the whoosh, the big
 * flourish and a crackle per firework (the layer plays those as they burst). Reduced motion: the hero
 * stands still with a short glow, and only the flourish plays.
 */
export function heroGrand(scope: number, anchor: Element | null = null): void {
  if (!celebrationsOn()) return;
  const calm = celebrationCalm();
  send({ kind: "heroShow", scope, show: "grand", calm, anchor });
  if (!calm) celebrationSound("heroRun");
  celebrationSound("heroGrand");
}

/** A firework bursting in the 200 lap (the layer calls it, at most every 450 ms). */
export function fireworkPop(): void {
  celebrationSound("firework", 0.8);
}

/** A tap anywhere skips the reveal's hero moment: the hero, its glow and its sparks go at once. */
export function skipCelebration(scope: number): void {
  send({ kind: "skip", scope });
}

/** The hero in the victory pose beside the winner's step (`anchor`); still under reduced motion. */
export function podiumHero(scope: number, anchor: Element): void {
  if (!celebrationsOn()) return;
  send({ kind: "podiumHero", scope, anchor, calm: celebrationCalm() });
}

/** GO: one lightning strike across the screen, its thunder and the zap (the sounds alone under reduced motion). */
export function goStrike(): void {
  if (!celebrationsOn()) return;
  celebrationSound("zap");
  celebrationSound("thunder");
  if (!celebrationCalm()) send({ kind: "strike" });
}
