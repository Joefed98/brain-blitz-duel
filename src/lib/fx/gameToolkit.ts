import { prefersReducedMotion } from "@/lib/motion";
import { puzzleReject } from "./puzzleReject";

/**
 * The game toolkit's move feedback (Polish 2, 24 Oct 2026, display only; DESIGN.md
 * "Game screens"): one right-move flash and one wrong-move flash for the category batches to use
 * game by game. Neither validates, scores or submits anything.
 */

const RIGHT_MS = 240;

/** A brief glow in the category colour round a piece the player just placed right (polish-layout/game-frame.css). */
export function rightMoveFlash(element: Element | null | undefined): void {
  if (!element || typeof document === "undefined") return;
  element.setAttribute("data-move-flash", "right");
  // Reduced motion keeps the glow (it does not move) but shortens it.
  setTimeout(() => element.removeAttribute("data-move-flash"), prefersReducedMotion() ? 160 : RIGHT_MS);
}

/**
 * The shared wrong move: the existing ±3px shake and 240ms red outline (puzzleReject). Pass
 * `sound = false` where the move already plays its own "wrong".
 */
export function wrongMoveFlash(element: Element | null | undefined, sound = true): void {
  puzzleReject(element ?? null, sound);
}
