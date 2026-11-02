/**
 * Screen-tap to sim-input mappings for the canvas tap-target games, kept pure so
 * scripts/tap-mapping-check.ts runs the phone's exact arithmetic against the real
 * renderers and sims. Each takes the tapped element's on-screen box and the client
 * point; the stages call these from their pointer handlers and nothing else.
 */
import { BEAT_LANES, BEAT_WORLD_W } from "@/lib/arcade/beat";
import { CLAY_H, CLAY_W, clayView } from "@/lib/arcade/clayShoot";
import {
  CLASH_DROP,
  CLASH_INPUT_LANE,
  CLASH_SET_LANE,
  CLASH_WORLD_W,
} from "@/lib/arcade/colourClash";

export interface TapBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The computer layout's rotate mode (31 Oct 2026, input mapping only; desktopModes.ts): an arena inside
 * `[data-arena-rotor]` is drawn turned exactly 90° clockwise, so its on-screen box is its own box turned.
 * These return the arena's own (untransformed) box and the point in it, so every caller maps exactly as
 * on a phone. Outside a rotor (every phone, tablet and the other modes) they return the element's box
 * and the client point unchanged, so nothing changes there.
 *
 * Turned 90° clockwise, the arena's top-left corner sits at the screen box's top-right: its x axis runs
 * down the screen and its y axis from right to left.
 */
export function isRotatedArena(el: Element | null | undefined): boolean {
  return Boolean(el?.closest("[data-arena-rotor]"));
}

/** `rect` is the arena's on-screen (turned) box; pure, so checks run the stage's exact arithmetic. */
export function unrotatePoint(rect: TapBox, clientX: number, clientY: number): { box: TapBox; x: number; y: number } {
  return { box: { left: 0, top: 0, width: rect.height, height: rect.width }, x: clientY - rect.top, y: rect.left + rect.width - clientX };
}

/** The inverse of unrotatePoint: where a point of the arena's own box shows on screen. */
export function rotatePoint(rect: TapBox, x: number, y: number): { clientX: number; clientY: number } {
  return { clientX: rect.left + rect.width - y, clientY: rect.top + x };
}

export function arenaPointer(el: Element | null | undefined, clientX: number, clientY: number): { box: TapBox | null; x: number; y: number } {
  if (!el) return { box: null, x: clientX, y: clientY };
  const rect = el.getBoundingClientRect();
  if (!isRotatedArena(el)) return { box: rect, x: clientX, y: clientY };
  return unrotatePoint(rect, clientX, clientY);
}

/** The arena's own size in CSS px (a turned arena's screen box has its width and height swapped). */
export function arenaSize(el: Element | null | undefined): { width: number; height: number } | null {
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return isRotatedArena(el) ? { width: rect.height, height: rect.width } : { width: rect.width, height: rect.height };
}

/** A drag or swipe's screen movement as the arena sees it (turned back on a rotated arena). */
export function arenaDelta(el: Element | null | undefined, dx: number, dy: number): { dx: number; dy: number } {
  return isRotatedArena(el) ? { dx: dy, dy: -dx } : { dx, dy };
}

/** ArcadeCanvasStage: screen point to world point, or null outside the drawn play area. */
export function arcadeWorldPoint(
  box: TapBox | null | undefined,
  clientX: number,
  clientY: number,
  worldW: number,
  worldH: number,
  clamp: boolean,
): { x: number; y: number } | null {
  if (!box || box.width < 1) return null;
  const x = Math.round(((clientX - box.left) / box.width) * worldW);
  const y = Math.round(((clientY - box.top) / box.height) * worldH);
  if (!clamp && (x < 0 || x > worldW || y < 0 || y > worldH)) return null;
  return { x: Math.max(0, Math.min(worldW, x)), y: Math.max(0, Math.min(worldH, y)) };
}

/** Pull!: the shot's world point (the sim's 360 × 400 sky; clayRev 6: 360 × 680), or null off the sky. */
export function clayTapWorld(
  box: TapBox,
  clientX: number,
  clientY: number,
  worldH: number = CLAY_H,
): { wx: number; wy: number } | null {
  const { scaleX, scaleY } = clayView({ width: box.width, height: box.height }, worldH);
  const wx = Math.round((clientX - box.left) / scaleX);
  const wy = Math.round((clientY - box.top) / scaleY);
  if (wx < 0 || wx > CLAY_W || wy < 0 || wy > worldH) return null;
  return { wx, wy };
}

/** Mixed Signals: a press and release (world points) become a lane pick, or a drop for a downward flick. */
export function clashTapPayload(
  down: { x: number; y: number },
  up: { x: number; y: number },
): { k: number; a: number; b: number; c: number } {
  if (up.y - down.y > 40) return { k: CLASH_INPUT_LANE, a: CLASH_DROP, b: 0, c: 0 };
  return {
    k: CLASH_INPUT_LANE,
    a: CLASH_SET_LANE,
    b: Math.min(CLASH_WORLD_W - 1, Math.max(0, Math.round(up.x))),
    c: 0,
  };
}

/** Tempo: which lane the finger is in, from the sim's own mapping. */
export function beatLaneAt(box: TapBox, clientX: number): number {
  const x = ((clientX - box.left) / box.width) * BEAT_WORLD_W;
  const lane = Math.floor((x / BEAT_WORLD_W) * BEAT_LANES);
  return Math.max(0, Math.min(BEAT_LANES - 1, lane));
}
