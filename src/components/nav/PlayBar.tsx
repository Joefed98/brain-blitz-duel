import { useRouter } from "@tanstack/react-router";

import { goToTab, type AppTab } from "@/components/app/AppTabBar";
import { unlockAudio } from "@/lib/sound";

/** Home's play section (its "Play live with friends" heading, Quick play under it): what the Play bar opens. */
export const PLAY_SECTION = "[data-play-hero]";

/**
 * The gold Play bar (phase 2 step 1, 14 Nov 2026): full width, the angled cuts, flat champagne on its 4 px ledge,
 * fixed just above the tab bar on Home and Games only (never a Play tab). It opens the existing Play screen, Home's
 * play section (create or join a room, and rated play's Play card where that is open), until the Play screen of the
 * Home redesign replaces it. `rail`: the rail's gold Play button (the same action, a computer or a sideways tablet).
 */
export function PlayBar({ from, variant = "bar", compact = false }: { from: AppTab | undefined; variant?: "bar" | "rail"; compact?: boolean }) {
  const router = useRouter();
  const open = () => {
    unlockAudio();
    if (from) goToTab(router, from, "play", undefined, PLAY_SECTION);
    else void router.navigate({ to: "/", state: { navScroll: PLAY_SECTION } as never });
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
