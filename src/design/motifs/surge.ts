/**
 * Surge (S1 PR 2; DESIGN.md "Bolt motifs"): a brief full-screen gold flash, about 400 ms in and 600 ms out
 * (--jz-dur-surge), never more than once a second. One fixed layer on the body, made on the first call and kept; a
 * call restarts its one opacity animation (no React, no frame loop). Under reduced motion it is a soft gold tint.
 */
export const SURGE_MIN_GAP_MS = 1000;
let last = -Infinity;
let layer: HTMLDivElement | null = null;

/** Flashes the screen gold; returns false (and does nothing) within a second of the last one, or with no document. */
export function surge(now: number = Date.now()): boolean {
  if (typeof document === "undefined" || now - last < SURGE_MIN_GAP_MS) return false;
  last = now;
  if (!layer || !layer.isConnected) {
    layer = document.createElement("div");
    layer.className = "jz-motif jz-surge";
    layer.setAttribute("aria-hidden", "true");
    layer.addEventListener("animationend", () => layer?.removeAttribute("data-on"));
    document.body.appendChild(layer);
  }
  layer.removeAttribute("data-on");
  void layer.offsetWidth; // restart the animation from its first frame
  layer.setAttribute("data-on", "");
  return true;
}

/** Test hook: forget the gap and the layer. */
export function resetSurgeForTest(): void {
  last = -Infinity;
  layer?.remove();
  layer = null;
}
