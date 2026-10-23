import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";

import { slotReserved, type PlaySlotId } from "@/lib/playCards";

/** How long a card takes to collapse when the server says it shouldn't show. */
export const SLOT_COLLAPSE_MS = 420;

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * A Play tab card that depends on the server or device storage (playCards.ts). Always in the markup,
 * shown from the first frame when this visit reserved it (<html data-play-cards>, set before the first
 * paint), drawing the card's last known state until the server answers:
 *
 *  - `state` "pending" or "show": the card as given (its own size; no placeholder of another height);
 *  - "hide": a reserved card collapses smoothly (height, then the flex gap above it) and is removed;
 *  - not reserved: never shown on this visit, whatever the server says (no pop-in).
 */
export function PlaySlot({ id, state, children }: { id: PlaySlotId; state: "pending" | "show" | "hide"; children: ReactNode }) {
  // Unknown until the page is up: the first render matches the server's (CSS decides what shows).
  const [reserved, setReserved] = useState<boolean | null>(null);
  const [gone, setGone] = useState(false);
  useBeforePaint(() => setReserved(slotReserved(id)), [id]);
  useEffect(() => {
    if (state !== "hide") return setGone(false);
    const timer = window.setTimeout(() => setGone(true), SLOT_COLLAPSE_MS);
    return () => window.clearTimeout(timer);
  }, [state]);
  if (reserved === false || gone) return null;
  return (
    <div
      data-play-slot={id}
      data-slot-state={reserved === null ? "boot" : state}
      aria-hidden={state === "hide" || undefined}
      className="play-slot"
    >
      <div className="min-h-0">{children}</div>
    </div>
  );
}
