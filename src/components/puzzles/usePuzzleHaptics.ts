import { useEffect, type RefObject } from "react";

import { FX_EVENT, type FxEvent } from "@/lib/fx";
import { haptic } from "@/lib/haptics";

/**
 * Puzzle haptics (lib/haptics.ts): `success` on a correct answer (fx.onCorrect, a solved stage,
 * the "correct" cue) and `error` on a wrong one (fx.onWrong, the "wrong" cue), read from the same
 * signals the puzzle already gives, only while its live board is on screen (haptic's inGame gate).
 * A finished puzzle's success comes from its verdict (useSignatureVerdict). Taps, drags, placements
 * and refused moves give nothing.
 */
export function usePuzzleHaptics(ref: RefObject<HTMLDivElement | null>, enabled: boolean): void {
  useEffect(() => {
    const root = ref.current;
    if (!root || !enabled) return;
    const play = (pattern: "success" | "error") => {
      if (root.querySelector("[data-game-stage]")) haptic(pattern, { inGame: true });
    };
    const onFx = (e: Event) => {
      const hook = (e as CustomEvent<FxEvent>).detail?.hook;
      if (hook === "onCorrect" || hook === "onStageComplete") play("success");
      else if (hook === "onWrong") play("error");
    };
    const onCue = (e: Event) => {
      const cue = (e as CustomEvent<string>).detail;
      if (cue === "correct") play("success");
      else if (cue === "wrong") play("error");
    };
    window.addEventListener(FX_EVENT, onFx);
    window.addEventListener("duelz-cue", onCue);
    return () => {
      window.removeEventListener(FX_EVENT, onFx);
      window.removeEventListener("duelz-cue", onCue);
    };
  }, [ref, enabled]);
}
