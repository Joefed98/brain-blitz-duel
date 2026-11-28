import { useEffect, useState } from "react";

import { useDesktop } from "@/lib/desktop";
import { useLandscapeChosen } from "@/lib/gameFrame/landscape";
import { mouseLine, screenKeys } from "@/lib/desktopKeys";
import type { PuzzleType } from "@/lib/duel/types";
import { fullscreenSupported } from "@/lib/gameFrame/screenMode";

/**
 * The screen keys this game's hint names (P4, desktop size PR 1): F full screen (where the browser has it) and H the
 * panels, each only where the game doesn't take the letter itself (its own key line names it, or it types letters).
 */
const TYPES_LETTERS: ReadonlySet<PuzzleType> = new Set<PuzzleType>(["strikeout", "codeword", "letterwheel", "tilegrid", "wordhunt", "wordsmith"]);
function screenModeKeys(type: PuzzleType, keys: readonly (readonly [string, string])[] | undefined): [string, string][] {
  if (TYPES_LETTERS.has(type)) return [];
  const taken = (letter: string) => (keys ?? []).some(([k]) => new RegExp(`(^|[^A-Za-z])${letter}([^A-Za-z]|$)`).test(k));
  const out: [string, string][] = [];
  if (fullscreenSupported() && !taken("F")) out.push(["F", "full screen"]);
  if (!taken("H")) out.push(["H", "hide panels"]);
  return out;
}

/**
 * The desktop controls hint (31 Oct 2026, presentation only; docs/desktop-layout.md): on a live round at
 * the desktop layout with a mouse or trackpad (useDesktop), a small panel in the free space left of the
 * play column (never over the game or its HUD; not shown where that space is under 150 px) names the game's keys (turned for a rotated game, desktopKeys.ts screenKeys) and how the
 * mouse plays; it fades after 8 s and never takes a click. Never on a phone or tablet.
 */
const SHOW_MS = 8000;
/** The narrowest free space beside the play column the hint is shown in (px); narrower, no hint. */
const MIN_ROOM = 150;

export function DesktopControlsHint({ type }: { type: PuzzleType }) {
  const desktop = useDesktop();
  const [shown, setShown] = useState(true);
  // Only in the free space left of the play column, never over the game or its HUD: its width, or nothing.
  const [room, setRoom] = useState(0);
  useEffect(() => {
    if (!desktop) return;
    const column = document.querySelector("[data-shell-column='game']");
    const measure = () => {
      const c = column?.getBoundingClientRect();
      const rail = document.querySelector("[data-app-rail]")?.getBoundingClientRect();
      // The hint starts 16 px right of the rail and keeps 16 px clear of the column.
      setRoom(c ? Math.floor(c.left - (rail?.right ?? 0) - 32) : 0);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" || !column ? null : new ResizeObserver(measure);
    if (observer && column) observer.observe(column);
    window.addEventListener("resize", measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [desktop, type]);
  useEffect(() => {
    if (!desktop) return;
    setShown(true);
    const t = window.setTimeout(() => setShown(false), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [desktop, type]);
  const landscape = useLandscapeChosen(type);
  const keys = screenKeys(type, desktop, landscape);
  const mouse = mouseLine(type);
  const screen = screenModeKeys(type, keys);
  if (!desktop || (!keys && !mouse) || room < MIN_ROOM) return null;
  return (
    <div
      data-controls-hint
      data-shown={shown || undefined}
      aria-label="Controls"
      className="dk-controls-hint"
      style={{ maxWidth: Math.min(300, room) }}
    >
      {keys?.map(([key, action]) => (
        <span key={key}>
          <kbd>{key}</kbd> {action}
        </span>
      ))}
      {mouse ? <span>{mouse}</span> : null}
      {/* The arena's screen keys (lib/gameFrame/screenMode.ts), where the game itself doesn't use the letter. */}
      {screen.map(([key, action]) => (
        <span key={`screen-${key}`}>
          <kbd>{key}</kbd> {action}
        </span>
      ))}
    </div>
  );
}
