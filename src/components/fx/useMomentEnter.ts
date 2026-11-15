import { useEffect, useRef } from "react";
import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { gameFx, type GameFxKind, type GameFxOptions } from "@/lib/fx/kit";
import { useCelebrationsOn } from "./useCelebration";

/**
 * The in-match screens' shared entrance (15 Nov 2026, the effects pass): the screen's sections arrive one after another
 * (polish-layout/moments.css, `[data-moment-enter]`), the same on round results, standings, the podium, the final screen
 * and the answer reveal, so moving between them reads as one language. `rise` lifts each section in; `fade` (screens
 * that measure their rows to slide them: standings, the podium, the final screen) only fades, so no measurement moves.
 * Nothing with the celebrations off (every screen exactly as before), under reduced effects or the battery saver; reduced
 * motion jumps it to its end (every section in place and visible).
 */
export function useMomentEnter(kind: "rise" | "fade" = "rise"): { "data-moment-enter"?: "rise" | "fade" } {
  const on = useCelebrationsOn();
  return on && !arcadeReducedEffects() ? { "data-moment-enter": kind } : {};
}

/**
 * An app moment (15 Nov 2026, the effects pass): the kit's effect on the element `selector` finds, once each time `key`
 * changes to a new non-null value (a badge earned, a level reached, a reward claimed…). The same kit and look as the
 * games' and results' moments; nothing with the celebrations off; never a haptic (outside a live board, the kit's rule).
 */
export function useAppMoment(kind: GameFxKind, selector: string, key: string | number | null | undefined, options: GameFxOptions = {}): void {
  const on = useCelebrationsOn();
  const last = useRef<string | number | null>(null);
  useEffect(() => {
    if (!on || key === null || key === undefined || key === last.current) return;
    last.current = key;
    // After the element has painted (it is usually mounted by the same render).
    const frame = requestAnimationFrame(() => gameFx(kind, document.querySelector(selector), { inGame: false, ...options }));
    return () => cancelAnimationFrame(frame);
  }, [on, key]); // eslint-disable-line react-hooks/exhaustive-deps
}
