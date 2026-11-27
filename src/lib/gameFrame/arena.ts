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
 * The Cabinet (the polish plan's B1, Joe's pick D1, 20 Nov 2026): a second, left panel on arcade play screens outside
 * a room (the big score, the timer bar, best and stars, the live run strip), 280 px; the right panel keeps the goal,
 * the status chips, the challenges and the controls. The world sits centred between them at its largest uniform scale.
 */
export const ARENA_PANEL_LEFT_W = 280;
/**
 * The Cabinet's switch: on since 22 Nov 2026 (P4, Joe's approval of desktop-geometry-check's K18 lines, after every
 * arcade world was measured no smaller with it at 1366 × 768 and 1920 × 1080). Where it would draw a world smaller (a
 * narrow window; Cue Ball's turned table) the single panel stays (cabinetFits, PhoneShell).
 */
export const ARENA_CABINET_LEFT = true;
/**
 * Whether the arena's panels draw the canvas HUD's values in place of the world (hudPlacement.ts). On since 27 Nov 2026
 * (P4, after A3's value channel): the stage switches the HUD painters off for its draw on the arena, and the panel's
 * "This run" card lists what they noted (ArenaGamePanel's HudRows). HUDs drawn another way stay in the world.
 */
export const ARENA_HUD_IN_PANEL = true;

/**
 * Whether the Cabinet's left panel is on: the switch above, or (checks and review shots only, never a production build:
 * checkOverride) a page's `window.__DUELZ_CABINET__ = true`, so the Cabinet can be drawn and judged before it is on.
 */
export function cabinetLeftOn(): boolean {
  return ARENA_CABINET_LEFT || checkOverride<boolean>("__DUELZ_CABINET__") === true;
}

/** The computer's compact rail beside a game (desktop-layout.css --dk-rail-compact). */
export const ARENA_RAIL_COMPACT_W = 76;
/** A computer's arcade column caps by desktop mode (desktop-layout.css): tall 640, wide 960. */
const COLUMN_MAX = { tall: 640, wide: 960 } as const;

/**
 * Whether the Cabinet's left panel fits without drawing the world any smaller than the single panel does (Joe, 22 Nov
 * 2026: the Cabinet never draws a game smaller than before). Without it the world is drawn as wide as the least of its
 * column's cap, the space beside the rail and the right panel, and its height's fit (`worldW` / `worldH`, the arena
 * slot's own world); the left panel takes 280 px of that space, so it goes on only while what is left still holds that
 * width. Presentation only: the world's size, place on the world and inputs are the same either way.
 */
export function cabinetFits(o: {
  viewportW: number;
  viewportH: number;
  worldW: number;
  worldH: number;
  mode: "tall" | "wide";
  maxWorldWidth?: number;
}): boolean {
  if (!(o.worldW > 0 && o.worldH > 0)) return false;
  const space = o.viewportW - ARENA_RAIL_COMPACT_W - ARENA_PANEL_W;
  const today = Math.min(COLUMN_MAX[o.mode], space, o.maxWorldWidth ?? Infinity, (o.viewportH * o.worldW) / o.worldH);
  return space - ARENA_PANEL_LEFT_W >= today;
}

/**
 * Where the live round's panel content goes: PhoneShell (or, in a room on a computer, the room panel) owns the mount
 * node; GameLayout portals its timer, score and menu into it, once, so the header copies are never drawn too.
 */
export interface ArenaMountValue {
  arena: boolean;
  mount: HTMLElement | null;
  setMount: (el: HTMLElement | null) => void;
  /** The Cabinet's left panel (arcade play screens outside a room); null where there is none. */
  leftMount: HTMLElement | null;
  setLeftMount: (el: HTMLElement | null) => void;
  /** A room panel is on screen (its standings are the room's; the game's block goes at its top). */
  roomPanel: boolean;
}
export const ArenaMount = createContext<ArenaMountValue>({ arena: false, mount: null, setMount: () => {}, leftMount: null, setLeftMount: () => {}, roomPanel: false });
export const useArenaMount = () => useContext(ArenaMount);
