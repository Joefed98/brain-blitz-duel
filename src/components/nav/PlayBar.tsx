import { useRouter } from "@tanstack/react-router";

import type { AppTab } from "@/components/app/AppTabBar";
import { unlockAudio } from "@/lib/sound";

/** The Play page (phase 2 step 3, src/routes/play.tsx): what the Play bar and the rail's Play open. */
export const PLAY_PATH = "/play";

/**
 * The gold Play bar (phase 2 step 1, 14 Nov 2026): full width, the angled cuts, flat champagne on its 4 px ledge,
 * fixed just above the tab bar on Home and Games only (never a Play tab). It opens the Play page (phase 2 step 3:
 * Find a match or Create a room, then Arena, Rooms, Practice and Daily), pushed so Back returns to the screen it was
 * tapped on. `rail`: the rail's gold Play button (the same action, a computer or a sideways tablet).
 */
export function PlayBar({ from, variant = "bar", compact = false }: { from: AppTab | undefined; variant?: "bar" | "rail"; compact?: boolean }) {
  const router = useRouter();
  const open = () => {
    unlockAudio();
    if (typeof window !== "undefined" && window.location.pathname === PLAY_PATH) return;
    // From a main tab: pushed with the tab's back-state, so Back returns to it (and from it to Home).
    void router.navigate({ to: PLAY_PATH as never, state: { fromPlayTab: true, playFrom: from ?? null } as never });
  };
  if (variant === "rail")
    return (
      <button
        type="button"
        onClick={open}
        aria-label={compact ? "Play" : undefined}
        title={compact ? "Play" : undefined}
        data-nav-play="rail"
        data-compact={compact ? "" : undefined}
        className="jz-nav-play jz-nav-play-rail"
      >
        <span className="jz-nav-play-face">
          {compact ? <PlayGlyph /> : "Play"}
        </span>
      </button>
    );
  return (
    <div data-nav-playbar className="jz-nav jz-nav-playbar">
      <button type="button" onClick={open} data-nav-play="bar" className="jz-nav-play">
        <span className="jz-nav-play-face">Play</span>
      </button>
    </div>
  );
}

/** The compact rail's Play: a solid triangle (a small control glyph, not art). */
function PlayGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M5 3.2v11.6L14.6 9z" fill="currentColor" />
    </svg>
  );
}
