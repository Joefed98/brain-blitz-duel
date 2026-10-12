import { fx } from "./index";

/** HUD-only observer, called after a frame advances. Does not inspect inputs or score. */
export function arcadeFeedback(options: { combo?: boolean } = {}) {
  const comboCue = options.combo !== false;
  let previousCombo = 0;
  let previousCascades = 0;
  let finished = false;
  return (state: object, over: boolean) => {
    // Test hook (scripts/arcade-play-check.ts): headless runs observe each drawn frame's
    // sim state here. Unset in the app, so this is one property read per frame.
    (globalThis as { __arcadeProbe?: (state: object, over: boolean) => void }).__arcadeProbe?.(state, over);
    const s = state as Record<string, unknown>;
    const number = (key: string) => typeof s[key] === "number" ? s[key] as number : 0;
    const combo = number("combo") || (number("comboLive") ? 1 + number("streak") : 0);
    if (comboCue && combo > previousCombo && combo > 1) fx.onCombo(combo);
    const cascades = number("cascades");
    if (cascades > previousCascades) fx.onCombo(cascades - previousCascades + 1);
    if (over && !finished) {
      finished = true;
      // Complete means the run ended, not a claim of perfect server correctness.
      fx.onComplete();
    }
    previousCombo = combo;
    previousCascades = cascades;
  };
}