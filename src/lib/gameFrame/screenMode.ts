/**
 * Full screen and distraction-free play on the arena (P4, desktop size PR 1, 27 Nov 2026; docs/desktop-support.md
 * "Full screen and hiding the panels"). Presentation only: nothing here reaches a sim, an input log, a timer or a score.
 *
 * Full screen: the browser's own (the Fullscreen API on the whole page), on a computer and on Android where the browser
 * allows it; never offered on an iPhone (its Safari has no page full screen). The choice is remembered on this device
 * (`duelz-fullscreen:v1`): a player who turned it on is put back into full screen by their next click or key on a game
 * screen (browsers only allow full screen from a click or a key), and leaving it (Esc, the button, F) turns it off.
 *
 * Hidden panels: the rail and the side panels hidden during play, the world given the whole screen (and its own HUD,
 * which the panel listed, drawn in the world again). Kept for this visit only; the same key or button brings them back.
 */
import { useSyncExternalStore } from "react";

const FULLSCREEN_KEY = "duelz-fullscreen:v1";

/** The key that turns full screen on and off, and the one that hides and shows the panels (gameKey names). */
export const FULLSCREEN_KEY_NAME = "f";
export const PANELS_KEY_NAME = "h";

type FsDocument = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

/** An iPhone or iPod (its Safari has no page full screen; iPads report a Mac and keep it where WebKit allows). */
function iPhone(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPod/.test(navigator.userAgent);
}

/** Whether this browser can put the page in full screen (false on the server and on an iPhone). */
export function fullscreenSupported(): boolean {
  if (typeof document === "undefined" || iPhone()) return false;
  const doc = document as FsDocument;
  return Boolean(doc.fullscreenEnabled ?? doc.webkitFullscreenEnabled);
}

export function isFullscreen(): boolean {
  if (typeof document === "undefined") return false;
  const doc = document as FsDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

function readRemembered(): boolean {
  try {
    return localStorage.getItem(FULLSCREEN_KEY) === "1";
  } catch {
    return false;
  }
}

function remember(on: boolean): void {
  try {
    localStorage.setItem(FULLSCREEN_KEY, on ? "1" : "0");
  } catch {
    /* storage off: the choice lasts this visit only */
  }
}

/** The player's remembered choice (on this device). */
export function fullscreenRemembered(): boolean {
  return readRemembered();
}

/** Enters full screen (from a click or a key only, as browsers require). */
export async function enterFullscreen(): Promise<void> {
  if (!fullscreenSupported() || isFullscreen()) return;
  const el = document.documentElement as FsElement;
  try {
    await (el.requestFullscreen ? el.requestFullscreen({ navigationUI: "hide" }) : el.webkitRequestFullscreen?.());
    remember(true);
  } catch {
    /* refused (no click or key behind it): nothing changes */
  }
}

export async function exitFullscreen(): Promise<void> {
  remember(false);
  if (!isFullscreen()) return;
  const doc = document as FsDocument;
  try {
    await (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.());
  } catch {
    /* already out */
  }
}

export function toggleFullscreen(): void {
  if (isFullscreen()) void exitFullscreen();
  else void enterFullscreen();
}

function subscribeFullscreen(fn: () => void): () => void {
  if (typeof document === "undefined") return () => {};
  // Leaving full screen any way (Esc, the browser's own control) is the player's choice too.
  const change = () => {
    if (!isFullscreen()) remember(false);
    fn();
  };
  document.addEventListener("fullscreenchange", change);
  document.addEventListener("webkitfullscreenchange", change);
  return () => {
    document.removeEventListener("fullscreenchange", change);
    document.removeEventListener("webkitfullscreenchange", change);
  };
}

/** Whether the page is in full screen now (re-renders on every change). */
export function useFullscreen(): boolean {
  return useSyncExternalStore(subscribeFullscreen, isFullscreen, () => false);
}

/* ---------------------------------------------------------------- hidden panels */

let panelsHidden = false;
const panelListeners = new Set<() => void>();

/** Whether the rail and side panels are hidden for play (this visit only). */
export function arenaPanelsHidden(): boolean {
  return panelsHidden;
}

export function setArenaPanelsHidden(hidden: boolean): void {
  if (hidden === panelsHidden) return;
  panelsHidden = hidden;
  for (const fn of panelListeners) fn();
}

export function toggleArenaPanels(): void {
  setArenaPanelsHidden(!panelsHidden);
}

function subscribePanels(fn: () => void): () => void {
  panelListeners.add(fn);
  return () => {
    panelListeners.delete(fn);
  };
}

export function useArenaPanelsHidden(): boolean {
  return useSyncExternalStore(subscribePanels, arenaPanelsHidden, () => false);
}
