import { useEffect, useState } from "react";

import { Button, Icon } from "@/design/components";
import {
  FULLSCREEN_KEY_NAME,
  PANELS_KEY_NAME,
  enterFullscreen,
  fullscreenRemembered,
  fullscreenSupported,
  isFullscreen,
  toggleArenaPanels,
  toggleFullscreen,
  useArenaPanelsHidden,
  useFullscreen,
} from "@/lib/gameFrame/screenMode";
import { gameKey, KEYS_QUERY } from "@/lib/desktop";

/** Focus is somewhere text is typed (chat, a name field): its keys are never shortcuts. */
function typing(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
}

/**
 * The arena's corner tools (P4, desktop size PR 1; docs/desktop-support.md "Full screen and hiding the panels"): on a
 * live round on the arena (a computer, or a sideways tablet), a full-screen button (where the browser has one; never on
 * an iPhone) and a button that hides the rail and side panels, in the screen's top right corner. With the panels
 * hidden, the corner keeps the timer (ArenaGamePanel portals it into `[data-arena-focus-timer]`) and both buttons.
 *
 * Keys (a mouse or trackpad only): F full screen, H the panels, Esc leaves full screen (the browser's own). A key is a
 * shortcut only when the game did not use it (checked once the game's own listeners have run: Minefield's F, Tempo's F
 * lane and every word game's letters stay the game's), never with Ctrl, Alt or Cmd, never while typing in a field.
 *
 * Full screen is remembered on this device: a player who left it on is put back by their next click or key here.
 * Presentation only: nothing here reaches the game's input, its clock or its score.
 */
export function ArenaScreenTools() {
  const hidden = useArenaPanelsHidden();
  const full = useFullscreen();
  const [canFull, setCanFull] = useState(false);
  useEffect(() => setCanFull(fullscreenSupported()), []);

  // F and H: after every game listener has had the key (a timeout, so `defaultPrevented` is final).
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function" || !window.matchMedia(KEYS_QUERY).matches) return;
    const down = (event: KeyboardEvent) => {
      if (!event.isTrusted || event.repeat || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
      const key = gameKey(event);
      if (key !== FULLSCREEN_KEY_NAME && key !== PANELS_KEY_NAME) return;
      window.setTimeout(() => {
        if (event.defaultPrevented) return;
        if (key === FULLSCREEN_KEY_NAME) {
          if (fullscreenSupported()) toggleFullscreen();
        } else toggleArenaPanels();
      }, 0);
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // The remembered choice: back into full screen on the next click or key (browsers allow it from one only).
  useEffect(() => {
    if (!fullscreenSupported() || !fullscreenRemembered() || isFullscreen()) return;
    const back = (event: Event) => {
      if (!event.isTrusted) return;
      cleanup();
      void enterFullscreen();
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", back, true);
      window.removeEventListener("keydown", back, true);
    };
    window.addEventListener("pointerdown", back, true);
    window.addEventListener("keydown", back, true);
    return cleanup;
  }, []);

  return (
    <div data-arena-tools data-panels-hidden={hidden ? "" : undefined} className="arena-tools">
      {hidden ? <div data-arena-focus-timer className="arena-tools-timer" /> : null}
      {canFull ? (
        <Button
          variant="icon"
          data-arena-fullscreen
          aria-pressed={full}
          aria-label={full ? "Leave full screen (F)" : "Full screen (F)"}
          title={full ? "Leave full screen (F, Esc)" : "Full screen (F)"}
          onClick={() => toggleFullscreen()}
        >
          <Icon name={full ? "collapse" : "expand"} size={20} />
        </Button>
      ) : null}
      <Button
        variant="secondary"
        size={44}
        data-arena-panels
        aria-pressed={hidden}
        title={hidden ? "Show panels (H)" : "Hide panels (H)"}
        onClick={() => toggleArenaPanels()}
      >
        {hidden ? "Show panels" : "Hide panels"}
      </Button>
    </div>
  );
}
