/**
 * The press's light touch (S1, 27 Nov 2026; presentation only): a completed tap on any tappable thing in app or game
 * chrome plays the light `tick` pattern through the one haptics helper (src/lib/haptics.ts: the Haptics setting, the
 * device's support and the 150 ms gap all apply; iPhone Safari has no vibration, so nothing happens there). The targets
 * are the ones the press scale covers (src/design/utilities.css): never inside game art (a reveal's board, a play area),
 * whose own moments have their own haptics, and only for a pointer tap (a click from the keyboard plays nothing).
 * The root route installs it once.
 */
import { haptic } from "./haptics";

/** What a press is: the same roles the press scale covers. */
export const JZ_TAPPABLE =
  'button, [role="button"], [role="tab"], [role="switch"], [role="radio"], [role="checkbox"], [role="option"], [role="menuitem"], a[href], summary';
/** Game art: its own moments play their own haptics. */
const GAME_ART = "[data-skin-off], [data-game-arena], [data-game-stage]";
/** A game screen's chrome (its header, intro, reveal and sheets); the rest of a game screen is the game. */
const GAME_CHROME =
  '[data-game-frame-header], [data-intro-header], .round-instructions, [data-reveal-screen], [data-help-sheet], [data-settings-sheet], [data-room-chat-sheet], [data-sound-panel], [role="dialog"], [data-app-updating]';

/** The tappable chrome element a click landed on, or null (game art, disabled, or not tappable). */
export function pressTarget(target: EventTarget | null): Element | null {
  if (!target || typeof (target as Element).closest !== "function") return null;
  const el = (target as Element).closest(JZ_TAPPABLE);
  if (!el) return null;
  if (el.matches(':disabled, [aria-disabled="true"]') || el.closest(GAME_ART)) return null;
  if (el.closest(".game-screen") && !el.closest(GAME_CHROME)) return null;
  return el;
}

let installed = false;

/** Listens once on the document (capture, passive): a pointer tap on a chrome target plays the light touch. */
export function installPressFeel(): void {
  if (installed || typeof document === "undefined") return;
  installed = true;
  document.addEventListener(
    "click",
    (event) => {
      // detail 0: a click from the keyboard (Enter, Space) or a script, not a tap.
      if (event.detail === 0 || !pressTarget(event.target)) return;
      haptic("tick");
    },
    { capture: true, passive: true },
  );
}
