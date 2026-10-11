import { useEffect, useRef, type ReactNode, type Ref } from "react";

import { MuteToggle } from "./MuteToggle";
import { Wordmark } from "./Wordmark";
import { FxLayer } from "./FxLayer";
import type { PuzzleType } from "@/lib/duel/types";
import { puzzleDef } from "@/lib/duel/registry";
import { usePuzzleSurfaces } from "@/components/puzzles/usePuzzleSurfaces";
import { GameLayoutDevOverlay } from "./GameLayoutDevOverlay";
import { GameColumnLayout } from "@/components/puzzles/gameColumn";
import { usePuzzleRejections } from "@/components/puzzles/usePuzzleRejections";

interface PhoneShellProps {
  children: ReactNode;
  /** Hide the slim top bar (the home screen carries its own big wordmark). */
  bare?: boolean;
  /** Lock active puzzle and reveal layouts to the device viewport. */
  constrained?: boolean;
  /** Suppress iOS selection/callouts throughout an active round screen. */
  gameScreen?: boolean;
  gameType?: PuzzleType | undefined;
  /** Room score summary that replaces the wordmark without taking board height. */
  gameHeader?: ReactNode;
  /** A small control beside the mute toggle (a guest's Leave between rounds). */
  topAction?: ReactNode;
}

/** Inline no-select style for text on game screens (timer digits, HUD, banners). */
export const NO_SELECT_STYLE = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
} as const;

const CONTROL = "button, a, input, textarea, select, [role='button']";

/** Identical round geometry: mode-specific text cannot resize the game region. */
export function GameLayout({ label, title, help, progress, timer, beforeGame, children, overlay, stageRef, locked = false }: {
  label: ReactNode;
  title: ReactNode;
  help: ReactNode;
  progress?: ReactNode;
  timer?: ReactNode;
  beforeGame?: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
  stageRef?: Ref<HTMLDivElement>;
  locked?: boolean;
}) {
  return (
    <div data-round-layout className="flex min-h-0 flex-1 flex-col gap-2 animate-phase-in">
      <div data-round-heading data-game-topbar className="grid h-7 shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <span className="min-w-0 whitespace-normal break-words text-right font-display text-sm font-bold leading-none text-foreground">{title}</span>
          <div className="flex shrink-0 items-center gap-2">{help}{progress}</div>
        </div>
      </div>
      {timer}
      {beforeGame}
      <div ref={stageRef} data-game-region className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div data-game-stage className={`game-column flex min-h-0 flex-1 flex-col ${locked ? "pointer-events-none opacity-30 transition-opacity duration-200" : ""}`}>
          <GameColumnLayout.Provider value>{children}</GameColumnLayout.Provider>
        </div>
        {overlay}
      </div>
      <GameLayoutDevOverlay />
    </div>
  );
}

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
    const count = Number(root.dataset["gameLocks"] ?? "0") + 1;
    root.dataset["gameLocks"] = String(count);
    root.classList.add("game-lock");
    body.classList.add("game-lock");
    // A scrolled pre-round page (room intro + chat bar) must not leave the
    // locked game column offset or with a collapsed-toolbar height.
    window.scrollTo(0, 0);
    const noSelect = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea")) return;
      event.preventDefault();
    };
    const noMenu = (event: Event) => event.preventDefault();
    const noTouch = (event: TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-scrollable]")) return;
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
      const left = Number(root.dataset["gameLocks"] ?? "1") - 1;
      root.dataset["gameLocks"] = String(Math.max(0, left));
      if (left <= 0) {
        root.classList.remove("game-lock");
        body.classList.remove("game-lock");
      }
    };
  }, [active]);
}

/** Mobile-first column, centred on larger screens, with a little depth behind. */
export function PhoneShell({ children, bare = false, constrained = false, gameScreen = false, gameType, gameHeader, topAction }: PhoneShellProps) {
  useRootSelectionLock(gameScreen);
  const definition = gameType ? puzzleDef(gameType) : undefined;
  const theme = definition?.theme;
  const puzzleSurface = Boolean(gameScreen && definition && !definition.retired && !definition.arcadeRun && definition.category !== "arcade");
  const surfaceRef = useRef<HTMLDivElement>(null);
  usePuzzleSurfaces(surfaceRef, gameType, puzzleSurface);
  usePuzzleRejections(surfaceRef, Boolean(gameScreen && definition && !definition.arcadeRun && definition.category !== "arcade"), gameType);
  return (
    <div
      ref={surfaceRef}
      className={`relative w-full bg-background ${gameScreen ? "game-screen" : ""} ${
        constrained ? "no-overscroll h-full overflow-hidden" : "min-h-[100dvh]"
      }`}
      data-category={theme?.accent}
      data-puzzle-surface={puzzleSurface ? gameType : undefined}
      data-particle-shape={theme?.particleShape ?? "disc"}
      style={gameScreen ? NO_SELECT_STYLE : undefined}
    >
      <div aria-hidden="true" className="screen-background"><div className="screen-drift" /></div>
      <div
        data-game-column={constrained ? "" : undefined}
        className={`relative flex min-h-0 w-full flex-col justify-start ${gameScreen ? "pad-game-safe" : "mx-auto max-w-[430px] pad-safe"} ${
          constrained ? "no-overscroll h-full overflow-hidden" : "min-h-[100dvh]"
        }`}
      >
        {!bare && (
          <div data-game-topbar={gameScreen ? "" : undefined} className="mb-2 grid h-9 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2" style={gameScreen ? NO_SELECT_STYLE : undefined}>
            <div className="min-w-0">{gameHeader ?? <Wordmark />}</div>
            <div className="flex shrink-0 items-center">{topAction}<MuteToggle /></div>
          </div>
        )}
        {children}
      </div>
      <FxLayer theme={theme} />
    </div>
  );
}
