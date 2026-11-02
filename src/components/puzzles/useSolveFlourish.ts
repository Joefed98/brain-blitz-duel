import { useEffect, type RefObject } from "react";
import type { PuzzleType } from "@/lib/duel/types";

/** Existing three finishes retain their private artwork/animation. */
export const SOLVE_FLOURISH: Partial<Record<PuzzleType, string>> = {
  sudoku: "Cell ripple",
  nonogram: "Cell ripple",
  lightsout: "Lights-off wave",
  unblock: "Gold block exits",
  flow: "Completed-path glow",
  trail: "Completed-path glow",
  tiles: "Tiles pulse in numeric order",
  push: "Crates glow green in turn",
  tower: "Finished stack shines",
  safe: "Drums lock and door tilts",
  bomb: "Green DEFUSED glow",
  lightup: "Lit cells brighten together",
  pipes: "Existing water flow",
  tubes: "Existing corks",
  rings: "Existing record spin",
  tilegrid: "Interlocked tiles shimmer",
  wordslide: "Completed rows shimmer",
  wordsearch: "Found-word paths shine",
  letterwheel: "Crossword letters shimmer",
  strikeout: "Revealed rows shimmer",
  codeword: "Decoded grid shimmers",
  swapword: "Placed tiles shimmer",
  target: "Final equation shines",
  equation: "Balanced equations shine",
  numpyramid: "Pyramid tier ripple",
  measure: "Filled jugs shine in turn",
  checkout: "Checked-out boards shine",
  numline: "Placed markers ripple along the lines",
  countup: "Completed tallies shine",
  balance: "Balanced weights shine",
  symscan: "Completed grids ripple",
  numhunt: "Finished number trail shines",
  spotdiff: "Found differences shine",
  blockparty: "Tessellated cells ripple",
  iceslide: "Blue cup finish shines",
  laser: "Completed beams glow",
  maze: "Exit path shines",
  gravity: "Locked balls shine",
  chain: "Full chain shines",
  pairmatch: "Matched pairs shimmer",
  flood: "Flooded cells ripple",
  tents: "Tent rows shimmer",
  shikaku: "Rectangle borders shine",
  fences: "The loop lights up around the board",
  fillomino: "Regions flash in turn",
  bridges: "Bridges light island to island",
  kakuro: "Runs light up one by one",
  dig: "Drained channel cells shimmer",
};

/** Runs only on the already-authoritative solved reveal. Never intercepts submission or phase changes. */
export function useSolveFlourish(
  ref: RefObject<HTMLDivElement | null>,
  type: PuzzleType,
  solved: boolean,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !solved || !SOLVE_FLOURISH[type] || ["pipes", "tubes", "rings"].includes(type))
      return;
    root.dataset["solveFlourish"] = type;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animations: Animation[] = [];
    const glow = (node: Element, delay = 0, transform?: string) => {
      if (!(node instanceof HTMLElement || node instanceof SVGElement) || !node.animate) return;
      const green = type === "push" || type === "bomb";
      const highlight = `drop-shadow(0 0 4px var(${green ? "--ok" : "--primary"})) brightness(1.18)`;
      const frames: Keyframe[] = [
        { filter: "none" },
        { filter: highlight, ...(transform && !reduced ? { transform } : {}) },
        { filter: "none" },
      ];
      animations.push(
        node.animate(frames, {
          duration: reduced ? 500 : 540,
          delay: reduced ? 0 : delay,
          easing: "ease-in-out",
          fill: "none",
        }),
      );
    };
    let selector =
      "[data-puzzle-cell], .word-letter-tile, .grid > button, .grid > div, .grid > span";
    if (["flow", "trail", "laser", "wordsearch"].includes(type))
      selector = "svg path, svg polyline, svg line";
    if (type === "tiles") selector = "[data-pointer-index]";
    if (type === "push") selector = 'svg[aria-label="Crate home"]';
    if (type === "lightsout") selector = ".lightsout-bulb";
    if (type === "unblock") selector = '[aria-label="Gold block"]';
    if (type === "safe") selector = ".solve-safe-door";
    if (type === "lightup") selector = ".lightup-cell-lit";
    if (type === "tower") selector = ".hanoi-disc";
    const targets = Array.from(root.querySelectorAll(selector)).slice(0, 144);
    if (type === "tiles")
      targets.sort(
        (a, b) =>
          Number(a.getAttribute("data-pointer-index")) -
          Number(b.getAttribute("data-pointer-index")),
      );
    const simultaneous = ["lightup", "laser", "tower", "bomb"].includes(type);
    if (targets.length)
      targets.forEach((node, index) => {
        const delay = simultaneous
          ? 0
          : Math.round((index * 580) / Math.max(1, targets.length - 1));
        glow(
          node,
          delay,
          type === "unblock"
            ? "translateX(110%)"
            : type === "tiles"
              ? "scale(1.035)"
              : type === "safe"
                ? "perspective(600px) rotateY(-5deg)"
                : undefined,
        );
      });
    else
      glow(
        root.firstElementChild ?? root,
        0,
        type === "safe" ? "perspective(600px) rotateY(-5deg)" : undefined,
      );
    return () => {
      animations.forEach((animation) => animation.cancel());
      delete root.dataset["solveFlourish"];
    };
  }, [ref, type, solved]);
}
