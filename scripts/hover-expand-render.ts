/**
 * Renders Hover hoverRev 8 frames off-screen with @napi-rs/canvas (no browser): hover-expand-check's
 * bounds proof draws the new objects alone through the game's own renderer and measures where
 * their pixels fall. Display only; never imported by the sim or the app.
 */
import { createCanvas } from "@napi-rs/canvas";

/** Lets the renderer's cached sprites (artCanvas) paint on @napi-rs/canvas, as OffscreenCanvas does in a browser. */
export function installOffscreenCanvas(): void {
  const g = globalThis as { OffscreenCanvas?: unknown };
  if (g.OffscreenCanvas) return;
  g.OffscreenCanvas = function OffscreenCanvas(w: number, h: number) {
    return createCanvas(w, h);
  };
}

export { createCanvas };
