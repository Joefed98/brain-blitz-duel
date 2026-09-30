import { useEffect, type ReactNode } from "react";

import { MuteToggle } from "./MuteToggle";
import { Wordmark } from "./Wordmark";

interface PhoneShellProps {
  children: ReactNode;
  /** Hide the slim top bar (the home screen carries its own big wordmark). */
  bare?: boolean;
  /** Lock active puzzle and reveal layouts to the device viewport. */
  constrained?: boolean;
  /** Suppress iOS selection/callouts throughout an active round screen. */
  gameScreen?: boolean;
}

/** Inline no-select style for text on game screens (timer digits, HUD, banners). */
export const NO_SELECT_STYLE = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
} as const;

const CONTROL = "button, a, input, textarea, select, [role='button']";

/**
 * While any game screen is mounted, lock selection at the document root:
 * html/body get the `game-lock` class, `selectstart` is cancelled, and touches
 * that start inside a play area (`[data-play-area]`, not on controls) are
 * cancelled with a non-passive listener — React's own touch handlers are
 * passive, so they cannot do this.
 */
function useRootSelectionLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const body = document.body;
    const count = Number(root.dataset.gameLocks ?? "0") + 1;
    root.dataset.gameLocks = String(count);
    root.classList.add("game-lock");
    body.classList.add("game-lock");
    const noSelect = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea")) return;
      event.preventDefault();
    };
    const noMenu = (event: Event) => event.preventDefault();
    const noTouch = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-play-area]") || target.closest(CONTROL)) return;
      if (event.cancelable) event.preventDefault();
    };
    document.addEventListener("selectstart", noSelect);
    document.addEventListener("contextmenu", noMenu);
    document.addEventListener("touchstart", noTouch, { passive: false });
    return () => {
      document.removeEventListener("selectstart", noSelect);
      document.removeEventListener("contextmenu", noMenu);
      document.removeEventListener("touchstart", noTouch);
      const left = Number(root.dataset.gameLocks ?? "1") - 1;
      root.dataset.gameLocks = String(Math.max(0, left));
      if (left <= 0) {
        root.classList.remove("game-lock");
        body.classList.remove("game-lock");
      }
    };
  }, [active]);
}

/** Mobile-first column, centred on larger screens, with a little depth behind. */
export function PhoneShell({ children, bare = false, constrained = false, gameScreen = false }: PhoneShellProps) {
  useRootSelectionLock(gameScreen);
  return (
    <div
      className={`relative w-full bg-background ${gameScreen ? "game-screen" : ""} ${
        constrained ? "no-overscroll h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
      }`}
      style={gameScreen ? NO_SELECT_STYLE : undefined}
    >
      {/* Depth: one soft warm glow top-centre, one cool glow bottom, faint grid. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 40% at 50% -5%, color-mix(in oklab, var(--primary) 16%, transparent), transparent 70%), radial-gradient(50% 35% at 50% 105%, color-mix(in oklab, var(--opponent) 10%, transparent), transparent 70%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div
        className={`relative mx-auto flex min-h-0 w-full max-w-[430px] flex-col pad-safe ${
          constrained ? "no-overscroll h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
        }`}
      >
        {!bare && (
          <div className="mb-2 flex items-center justify-between" style={gameScreen ? NO_SELECT_STYLE : undefined}>
            <Wordmark />
            <MuteToggle />
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
