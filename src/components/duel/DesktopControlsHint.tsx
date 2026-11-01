import { useEffect, useState } from "react";

import { useDesktop } from "@/lib/desktop";
import { mouseLine, screenKeys } from "@/lib/desktopKeys";
import type { PuzzleType } from "@/lib/duel/types";

/**
 * The desktop controls hint (31 Oct 2026, presentation only; docs/desktop-layout.md): on a live round at
 * the desktop layout with a mouse or trackpad (useDesktop), a small panel at the bottom left of the
 * play screen names the game's keys (turned for a rotated game, desktopKeys.ts screenKeys) and how the
 * mouse plays; it fades after 8 s and never takes a click. Never on a phone or tablet.
 */
const SHOW_MS = 8000;

export function DesktopControlsHint({ type }: { type: PuzzleType }) {
  const desktop = useDesktop();
  const [shown, setShown] = useState(true);
  useEffect(() => {
    if (!desktop) return;
    setShown(true);
    const t = window.setTimeout(() => setShown(false), SHOW_MS);
    return () => window.clearTimeout(t);
  }, [desktop, type]);
  const keys = screenKeys(type, desktop);
  const mouse = mouseLine(type);
  if (!desktop || (!keys && !mouse)) return null;
  return (
    <div
      data-controls-hint
      data-shown={shown || undefined}
      aria-label="Controls"
      className="dk-controls-hint"
    >
      {keys?.map(([key, action]) => (
        <span key={key}>
          <kbd>{key}</kbd> {action}
        </span>
      ))}
      {mouse ? <span>{mouse}</span> : null}
    </div>
  );
}
