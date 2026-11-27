/**
 * The Pattern reveals' boards drawn in the reveal template's stage (the polish plan's G4, A2, 27 Nov 2026; display only).
 *
 * The template measures its stage (P2's `useRevealStageSize`: the space under the score card). A Pattern reveal is its
 * board plus a few rows of its own (a caption, the player's pills, a key); the board takes what the stage has left
 * after those rows, as large as the stage's width allows, so it is drawn once at its own size and the reveal's fit
 * (AnswerReveal's useRevealFit) has nothing left to shrink. Until the stage is measured (the first frame, a check's bare
 * render) the hook answers null and the game's own CSS size stands.
 *
 * Nothing here reaches outside the game's own reveal: the rows are measured inside it (`root` holds them and the
 * board, `rowsAround`), the stage's size comes from the template's context.
 */
import { useLayoutEffect, useState, type RefObject } from "react";

import { useRevealStageSize } from "@/components/duel/revealContext";

/** The reveal card's own padding round the game's reveal (reveal-screen.css `.answer-reveal-content > .reveal-card`). */
export const REVEAL_CARD_PAD = 12;

/**
 * The height of everything stacked above and below `board` inside `root`: at each level from the board up to the root,
 * a column (block or column flex) adds its other shown children, its gaps and its padding; a row adds nothing (its
 * children sit beside the board). Content only, so a box that stretches to fill the stage never feeds back into the size.
 */
export function rowsAround(root: HTMLElement, board: HTMLElement): number {
  let around = 0;
  let child: HTMLElement = board;
  let parent = board.parentElement;
  while (parent && child !== root) {
    const cs = getComputedStyle(parent);
    const flex = cs.display.includes("flex");
    const column = flex ? cs.flexDirection.startsWith("column") : cs.display !== "grid" && cs.display !== "inline";
    if (column) {
      const shown = Array.from(parent.children).filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el !== child && el.offsetParent !== null && getComputedStyle(el).position !== "absolute",
      );
      for (const el of shown) {
        const m = getComputedStyle(el);
        around += el.offsetHeight + (parseFloat(m.marginTop) || 0) + (parseFloat(m.marginBottom) || 0);
      }
      if (flex) around += (parseFloat(cs.rowGap) || 0) * shown.length;
    }
    around += (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    child = parent;
    parent = parent.parentElement;
  }
  return Math.round(around);
}

/**
 * The board's width in CSS px for the template's stage, or null before the stage is measured. `aspect` is the board's
 * width over its height (1 for a square board); `max` caps the width (a board that should never grow past its art).
 */
export function useRevealBoardWidth(
  root: RefObject<HTMLElement | null>,
  board: RefObject<HTMLElement | null>,
  { aspect = 1, max = Number.POSITIVE_INFINITY, min = 120 }: { aspect?: number; max?: number; min?: number } = {},
): number | null {
  const stage = useRevealStageSize();
  const [width, setWidth] = useState<number | null>(null);
  // After every render (the rows can change with the view shown): measured before paint, set only when it changes.
  useLayoutEffect(() => {
    const r = root.current;
    const b = board.current;
    if (!r || !b || stage.w <= 0 || stage.h <= 0) return;
    // The rows round the board inside the game's own reveal (its caption, pills and key), never the board itself.
    const around = rowsAround(r, b);
    const w = stage.w - 2 * REVEAL_CARD_PAD;
    const h = stage.h - 2 * REVEAL_CARD_PAD - around;
    const next = Math.round(Math.max(min, Math.min(w, h * aspect, max)));
    setWidth((was) => (was === next ? was : next));
  });
  return width;
}
