import { Share, SquarePlus, X } from "lucide-react";
import { useEffect } from "react";

import { HOME_HINT_KEY } from "@/lib/playCards";

/**
 * The Add to Home Screen hint (22 Oct 2026; the tab screens' panel look, Prompt R): a gentle card on the Play tab, on iPhone Safari only (not
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
      className="ap-panel relative flex flex-col gap-1.5 py-3.5 pl-4 pr-12"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="press absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-[var(--ap-faint)]"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2.5">
        <SquarePlus aria-hidden="true" className="h-5 w-5 shrink-0 text-muted-foreground" />
        <h2 className="ap-row-title">Add to Home Screen</h2>
      </div>
      <p className="flex flex-wrap items-center gap-x-1 text-[14px] text-muted-foreground">
        <span>Tap</span>
        <Share aria-label="Share" className="h-4 w-4" />
        <span className="font-semibold text-foreground">Share</span>
        <span>then</span>
        <span className="font-semibold text-foreground">Add to Home Screen</span>
      </p>
      <p className="text-[13.5px] text-muted-foreground">
        Full screen, and your streak and history stay in the app.
      </p>
    </section>
  );
}
