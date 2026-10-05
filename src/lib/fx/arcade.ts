import { fx } from "./index";

/** HUD-only observer, called after a frame advances. Does not inspect inputs or score. */
export function arcadeFeedback() {
  let previous: Record<string, number | boolean> | null = null;
  let finished = false;
  return (state: object, over: boolean) => {
    const s = state as Record<string, unknown>;
    const number = (key: string) => typeof s[key] === "number" ? s[key] as number : 0;
    const combo = number("combo") || (number("comboLive") ? 1 + number("streak") : 0);
    const snapshot: Record<string, number | boolean> = {
      combo, cascades: number("cascades"), bad: number("bombsHit") + number("misses") + number("livesLost") + number("wrong") + number("fails"),
      good: number("hits") + number("home") + number("eaten") + number("baskets") + number("slices") + number("perfect") + number("good") + number("raw"),
      dead: Boolean(s["dead"] || s["crashed"] || s["missed"] || number("ended") === 2),
    };
    if (previous) {
      if (combo > Number(previous["combo"]) && combo > 1) fx.onCombo(combo);
      if (number("cascades") > Number(previous["cascades"])) fx.onCombo(number("cascades") - Number(previous["cascades"]) + 1);
      // Existing per-game hit/miss sounds already adapt to shared correct/wrong hooks.
    }
    if (over && !finished) {
      finished = true;
      if (snapshot["dead"]) fx.onWrong();
      else fx.onComplete();
    }
    previous = snapshot;
  };
}