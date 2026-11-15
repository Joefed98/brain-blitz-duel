/**
 * The arena (phase 2 step 4 pass 2, 15 Nov 2026; docs/design/game-fx/README.md "The arena"): a game's live round on a
 * computer, or on a tablet held sideways at least 1024 px wide, draws the board or world as large as the screen's
 * height allows, beside one side panel that carries the timer, the score, the best and (in a room) the standings.
 * The header is not drawn there, so nothing is doubled. Presentation only: every device draws the identical world
 * (the same world size and visible area, scaled uniformly), and the sim, its inputs and its result never read this.
 */
import { createContext, useContext, useSyncExternalStore } from "react";

import { checkOverride } from "@/lib/checkOverride";
import type { LayoutMode } from "@/lib/layoutMode";

/** A sideways tablet wide enough for the arena (a touch screen; the desktop layout has its own query). */
export const TABLET_ARENA_QUERY = "(orientation: landscape) and (min-width: 1024px) and (min-height: 600px)";

function readTabletArena(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(TABLET_ARENA_QUERY).matches;
}
function subscribe(change: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const list = window.matchMedia(TABLET_ARENA_QUERY);
  list.addEventListener?.("change", change);
  return () => list.removeEventListener?.("change", change);
}

/** Whether a game screen draws the arena: every computer, and a sideways tablet from 1024 px wide. */
export function useArenaLayout(layout: LayoutMode, gameScreen: boolean): boolean {
  const tabletArena = useSyncExternalStore(subscribe, readTabletArena, () => false);
  if (!gameScreen) return false;
  const forced = checkOverride<boolean>("__DUELZ_ARENA__");
  if (forced === false) return false;
  return layout === "desktop" || (layout === "tablet" && tabletArena);
}

/** The arena's side panel width (px) outside a room; in a room the game's block sits at the top of the room panel. */
export const ARENA_PANEL_W = 320;

/**
 * Where the live round's panel content goes: PhoneShell (or, in a room on a computer, the room panel) owns the mount
 * node; GameLayout portals its timer, score and menu into it, once, so the header copies are never drawn too.
 */
export interface ArenaMountValue {
  arena: boolean;
  mount: HTMLElement | null;
  setMount: (el: HTMLElement | null) => void;
  /** A room panel is on screen (its standings are the room's; the game's block goes at its top). */
  roomPanel: boolean;
}
export const ArenaMount = createContext<ArenaMountValue>({ arena: false, mount: null, setMount: () => {}, roomPanel: false });
export const useArenaMount = () => useContext(ArenaMount);
