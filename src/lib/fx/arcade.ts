import { completeFx, fx, visualFx } from "./index";
import { momentFrame } from "./momentCues";
import { signatureArcadeRunOver } from "./signature";

/** HUD-only observer, called after a frame advances. Does not inspect inputs or score. */
export function arcadeFeedback(
  options: {
    /** The game's PuzzleType id: fires its success-effect cues (momentCues.ts). */
    game?: string;
    combo?: boolean;
    /** The game's own completion cue when it fires on this run's last frame (completeFx), else null. */
    completeCue?: (state: object) => string | null;
  } = {},
) {
  const comboCue = options.combo !== false;
  let previousCombo = 0;
  let previousCascades = 0;
  let finished = false;
  // A finish cue may fire a frame or two before the sim reports the run over.
  let finishCueTick = -Infinity;
  return (state: object, over: boolean) => {
    // Test hook (scripts/arcade-play-check.ts): headless runs observe each drawn frame's
    // sim state here. Unset in the app, so this is one property read per frame.
    (globalThis as { __arcadeProbe?: (state: object, over: boolean) => void }).__arcadeProbe?.(state, over);
    // Success-effect cues first: a cue with a file may stand in for the generic combo or complete sound.
    const quiet = options.game ? momentFrame(options.game, state as { tick: number }) : null;
    const tick = (state as { tick?: number }).tick ?? 0;
    if (quiet?.has("complete")) finishCueTick = tick;
    const s = state as Record<string, unknown>;
    const number = (key: string) => typeof s[key] === "number" ? s[key] as number : 0;
    const combo = number("combo") || (number("comboLive") ? 1 + number("streak") : 0);
    const onCombo = (value: number) => (quiet?.has("combo") ? visualFx("onCombo", value) : fx.onCombo(value));
    if (comboCue && combo > previousCombo && combo > 1) onCombo(combo);
    const cascades = number("cascades");
    if (cascades > previousCascades) onCombo(cascades - previousCascades + 1);
    if (over && !finished) {
      finished = true;
      // Complete means the run ended, not a claim of perfect server correctness.
      // A game whose own completion cue fires now leaves out the generic sound once that cue has a file.
      const ownCue = options.completeCue?.(state) ?? null;
      if (tick - finishCueTick <= 60) visualFx("onComplete");
      else if (ownCue) completeFx(ownCue);
      else fx.onComplete();
      // The shared signature beat: arcade finish reached, or an open run of 120+.
      signatureArcadeRunOver(state);
    }
    previousCombo = combo;
    previousCascades = cascades;
  };
}