import { useEffect, type RefObject } from "react";
import { FX_EVENT, type FxEvent } from "@/lib/fx";
import { puzzleReject } from "@/lib/fx/puzzleReject";

/** Existing rejection signals only; ordinary danger art and disabled controls are not errors. */
export function usePuzzleRejections(
  ref: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  type?: string,
) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    root.setAttribute("data-shared-rejections", "true");
    let involved: Element | null = null;
    const pointer = (e: Event) => {
      if (e.target instanceof Element && e.target.closest("[data-game-stage]"))
        involved =
          e.target.closest("button, input, [data-cell], [data-pointer-index], [data-play-area]") ??
          e.target;
    };
    const wrong = (e: Event) => {
      if (!root.querySelector("[data-game-stage]")) return;
      const fx = (e as CustomEvent<FxEvent>).detail;
      const cue = (e as CustomEvent<string>).detail;
      if (fx?.hook === "onWrong" || cue === "wrong")
        puzzleReject(involved?.isConnected ? involved : root.querySelector("[data-game-stage]"));
    };
    const seen = new WeakMap<Element, string>();
    const tracked = new Set<Element>();
    const inspect = () => {
      for (const node of tracked) {
        if (
          !node.isConnected ||
          (!node.classList.contains("animate-shake") &&
            node.getAttribute("data-puzzle-state") !== "error")
        ) {
          seen.delete(node);
          tracked.delete(node);
        }
      }
      for (const node of root.querySelectorAll<HTMLElement>(
        "[data-game-stage] .animate-shake, [data-game-stage] [data-puzzle-state='error']",
      )) {
        const shake = node.classList.contains("animate-shake");
        // Only known error-cell paint; never infer wrong from a bomb/wire/hazard's colour.
        const painted =
          ["sudoku", "nonogram", "wordsearch", "trail", "tilegrid", "numhunt"].includes(
            type ?? "",
          ) && node.getAttribute("data-puzzle-state") === "error";
        if (!shake && !painted) continue;
        const signature = node.className;
        if (seen.get(node) === signature) continue;
        seen.set(node, signature);
        tracked.add(node);
        puzzleReject(node);
      }
      for (const node of root.querySelectorAll<HTMLElement>(
        "[data-game-stage] [data-puzzle-cell]",
      )) {
        if (
          !node.classList.contains("animate-shake") &&
          node.getAttribute("data-puzzle-state") !== "error"
        )
          seen.delete(node);
      }
    };
    const observer = new MutationObserver(inspect);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "data-puzzle-state"],
    });
    root.addEventListener("pointerdown", pointer, true);
    root.addEventListener("keydown", pointer, true);
    window.addEventListener(FX_EVENT, wrong);
    window.addEventListener("duelz-cue", wrong);
    return () => {
      root.removeAttribute("data-shared-rejections");
      observer.disconnect();
      root.removeEventListener("pointerdown", pointer, true);
      root.removeEventListener("keydown", pointer, true);
      window.removeEventListener(FX_EVENT, wrong);
      window.removeEventListener("duelz-cue", wrong);
    };
  }, [ref, enabled, type]);
}
