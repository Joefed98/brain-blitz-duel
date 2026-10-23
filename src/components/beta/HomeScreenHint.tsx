import { Share, SquarePlus, X } from "lucide-react";
import { useEffect } from "react";

import { HOME_HINT_KEY } from "@/lib/playCards";

/**
 * The Add to Home Screen hint (22 Oct 2026): a gentle card on the Play tab, on iPhone Safari only (not
 * already a home-screen app), on the device's first visit. Its slot is reserved before the first paint
 * by the Play tab's boot script (playCards.ts, token "homescreen"), so it never pops in; it marks the
 * device as told the moment it shows, so it shows once per device; the ✕ collapses it. Only the Play
 * tab draws it, so never during a round.
 */
export function HomeScreenHint({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    try {
      window.localStorage.setItem(
        HOME_HINT_KEY,
        JSON.stringify({ shownAt: new Date().toISOString() }),
      );
    } catch {
      /* storage blocked: the boot script never reserves it then */
    }
  }, []);
  return (
    <section
      aria-label="Add to Home Screen"
      data-home-hint
      data-tint="teal"
      className="th-card relative flex flex-col gap-2 rounded-2xl border border-border bg-card/80 p-4"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="press absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2 pr-9">
        <SquarePlus aria-hidden="true" className="h-5 w-5 shrink-0 text-primary" />
        <h2 className="whitespace-nowrap font-display text-base font-extrabold uppercase leading-tight tracking-[0.02em] text-foreground">
          Add to Home Screen
        </h2>
      </div>
      <p className="flex flex-wrap items-center gap-x-1 text-sm text-foreground">
        <span>Tap</span>
        <Share aria-label="Share" className="h-4 w-4 text-primary" />
        <span className="font-semibold">Share</span>
        <span>then</span>
        <span className="font-semibold">Add to Home Screen</span>
      </p>
      <p className="text-[13px] text-muted-foreground">
        Full screen, and your streak and history stay in the app.
      </p>
    </section>
  );
}
