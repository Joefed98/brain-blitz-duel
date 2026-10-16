import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode, type Ref } from "react";

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
  /**
   * The live round (GameLayout's play screen), as opposed to its intro or reveal. An
   * arcade play screen (isArcadeScreenType) then gives its top bar to GameLayout's one
   * compact header row and paints every gap the screen edge's black (display only).
   */
  play?: boolean;
}

/** Arcade games and the engine games on the arcade stage (Letterfall, Tenfall, Bonk, Pull!, Mixed Signals). */
export function isArcadeScreenType(type: PuzzleType | undefined): boolean {
  const definition = type ? puzzleDef(type) : undefined;
  return Boolean(definition && (definition.arcadeRun || definition.category === "arcade"));
}

/** What an arcade play screen's shell hands to GameLayout's compact header (null on every other screen). */
const ArcadePlayHeader = createContext<{ gameHeader?: ReactNode; topAction?: ReactNode } | null>(null);

/** Inline no-select style for text on game screens (timer digits, HUD, banners). */
export const NO_SELECT_STYLE = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
} as const;

const CONTROL = "button, a, input, textarea, select, [role='button']";

/** Identical round geometry: mode-specific text cannot resize the game region. */
export function GameLayout({ label, title, help, progress, roundLabel, timer, beforeGame, children, overlay, stageRef, locked = false, held = false }: {
  label: ReactNode;
  title: ReactNode;
  help: ReactNode;
  progress?: ReactNode;
  /**
   * A room's round and game (RoundLabel) for the arcade play header: beside the timer,
   * after the score, in place of the round pips. Other screens ignore it.
   */
  roundLabel?: ReactNode;
  timer?: ReactNode;
  beforeGame?: ReactNode;
  children: ReactNode;
  overlay?: ReactNode;
  stageRef?: Ref<HTMLDivElement>;
  locked?: boolean;
  /** A locked board held at full brightness while the signature beat plays (dims after). */
  held?: boolean;
}) {
  const arcade = useContext(ArcadePlayHeader);
  const stage = (
    <div ref={stageRef} data-game-region className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div data-game-stage className={`game-column game-column-centred game-column-lifted flex min-h-0 flex-1 flex-col ${locked ? `pointer-events-none transition-opacity duration-200${held ? "" : " opacity-30"}` : ""}`} data-board-held={locked && held ? "" : undefined}>
        <GameColumnLayout.Provider value>{children}</GameColumnLayout.Provider>
      </div>
      {overlay}
    </div>
  );
  if (arcade) {
    // Arcade play screens (15 Oct 2026, display only): one 44px row under the safe-area
    // top: the score (or PRACTICE and the game) left, the timer centred, "?" and sound
    // right; the arena starts 4px under it (styles.css "Arcade play screen"). In a room
    // (16 Oct 2026) the round and game (RoundLabel) sit between the score and the timer,
    // 8px from each, and replace the round pips, which no phone width has room for beside it.
    const roomLabel = arcade.gameHeader && roundLabel;
    return (
      <div data-round-layout className="flex min-h-0 flex-1 flex-col gap-1 animate-round-in">
        <div data-round-heading data-game-topbar data-arcade-header className="grid h-11 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 px-1" style={NO_SELECT_STYLE}>
          {roomLabel ? (
            <div data-header-left className="flex min-w-0 items-center gap-2 pr-1">
              <div className="min-w-0 flex-1">{arcade.gameHeader}</div>
              {roundLabel}
            </div>
          ) : <div className="min-w-0">
            {arcade.gameHeader ?? (
              <div className="flex min-w-0 flex-col gap-0.5 leading-none">
                <span className="truncate font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
                <span className="truncate font-display text-xs font-bold text-foreground">{title}</span>
              </div>
            )}
          </div>}
          <div data-arcade-timer className="flex min-w-[52px] flex-col items-center justify-center gap-1">{timer}{roomLabel ? null : progress}</div>
          <div className="flex min-w-0 items-center justify-end gap-1">{help}{arcade.topAction}<MuteToggle /></div>
        </div>
        {beforeGame}
        {stage}
        <GameLayoutDevOverlay />
      </div>
    );
  }
  return (
    <div data-round-layout className="flex min-h-0 flex-1 flex-col gap-2 animate-round-in">
      <div data-round-heading data-game-topbar className="grid h-7 shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
        <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <span className="min-w-0 whitespace-normal break-words text-right font-display text-sm font-bold leading-none text-foreground">{title}</span>
          <div className="flex shrink-0 items-center gap-2">{help}{progress}</div>
        </div>
      </div>
      {timer}
      {beforeGame}
      {stage}
      <GameLayoutDevOverlay />
    </div>
  );
}

/** useLayoutEffect in the browser (before the first paint), a no-op on the server. */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * While any game screen is mounted, lock selection at the document root:
 * html/body get the `game-lock` class, `selectstart` is cancelled, and touches
 * that start inside a play area (`[data-play-area]`, not on controls) are
 * cancelled with a non-passive listener — React's own touch handlers are
 * passive, so they cannot do this.
 */
function useRootSelectionLock(active: boolean) {
  // Before paint (16 Oct 2026, display only): a round that starts on a timer (a room's
  // server deadline, practice's intro countdown) runs passive effects after its first
  // frame, which a scrolled intro page then drew offset before the scroll reset snapped it.
  useIsoLayoutEffect(() => {
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

/**
 * iOS home-screen apps (15 Oct 2026, display only). With viewport-fit=cover and a
 * black-translucent status bar, WebKit lays a home-screen app out in a viewport short by
 * the top safe-area inset (https://bugs.webkit.org/show_bug.cgi?id=254868), drawn from the
 * top of the screen: on an iPhone 11, 100dvh is 848px of an 896px screen, so a 100dvh
 * shell ended 48px early. While an arcade play screen is up, this measures that shortfall
 * (the screen's height less 100dvh, at most the top inset, 0 anywhere but an iOS
 * home-screen app: navigator.standalone) into --standalone-short on the root, which the
 * play screen adds to its height (polish-layout/bottom.css). Once WebKit lays the app out
 * full height the shortfall measures 0 and nothing changes. arcade-device-bottom-check
 * proves it.
 *
 * No feedback (16 Oct 2026, fix-up of the home-screen bottom flash): the shortfall is
 * measured once per geometry (screen size, orientation and top inset, none of which the
 * grown root can change), always with the root's growth taken off first, and written only
 * when it differs. A resize the growth itself sets off (iOS may fire one when the root
 * outgrows its short viewport) finds the same geometry and does nothing, so the value can
 * never feed back into itself and the root never flips between its two heights. Play
 * screens share one root, so the value stays while any of them is up.
 */
const shortfall = { users: 0, key: "", px: 0 };

function standaloneGeometry(): { key: string; inset: number } | null {
  if ((navigator as Navigator & { standalone?: boolean }).standalone !== true) return null;
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;padding-top:env(safe-area-inset-top,0px);visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const inset = parseFloat(getComputedStyle(probe).paddingTop) || 0;
  probe.remove();
  // The viewport's aspect, not screen.orientation (which some browsers misreport); 48px of growth can never flip it.
  const portrait = window.innerHeight >= window.innerWidth;
  return { key: `${screen.width}x${screen.height}:${portrait ? "p" : "l"}:${inset}`, inset };
}

/** The screen's height less 100dvh, at most the top inset; measured with the root at its own height. */
function measureShortfall(inset: number, key: string): number {
  const root = document.documentElement;
  root.style.removeProperty("--standalone-short");
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:100dvh;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const dvh = probe.getBoundingClientRect().height;
  probe.remove();
  const portrait = key.includes(":p:");
  const screenH = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
  return Math.round(Math.min(inset, Math.max(0, screenH - dvh)));
}

function applyShortfall() {
  const root = document.documentElement;
  const geometry = standaloneGeometry();
  const key = geometry?.key ?? "";
  if (key !== shortfall.key) {
    shortfall.key = key;
    shortfall.px = geometry ? measureShortfall(geometry.inset, key) : 0;
  }
  const want = shortfall.px > 0 ? `${shortfall.px}px` : "";
  if (root.style.getPropertyValue("--standalone-short") === want) return;
  if (want) root.style.setProperty("--standalone-short", want);
  else root.style.removeProperty("--standalone-short");
}

function useStandaloneShortfall(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    if (shortfall.users++ === 0) {
      // Each new play screen measures afresh; the listeners are shared by every play screen up.
      shortfall.key = "\u0000";
      window.addEventListener("resize", applyShortfall);
      window.addEventListener("orientationchange", applyShortfall);
      window.visualViewport?.addEventListener("resize", applyShortfall);
    }
    applyShortfall();
    return () => {
      if (--shortfall.users > 0) return;
      window.removeEventListener("resize", applyShortfall);
      window.removeEventListener("orientationchange", applyShortfall);
      window.visualViewport?.removeEventListener("resize", applyShortfall);
      root.style.removeProperty("--standalone-short");
    };
  }, [active]);
}

/** Mobile-first column, centred on larger screens, with a little depth behind. */
export function PhoneShell({ children, bare = false, constrained = false, gameScreen = false, gameType, gameHeader, topAction, play = false }: PhoneShellProps) {
  useRootSelectionLock(gameScreen);
  const definition = gameType ? puzzleDef(gameType) : undefined;
  const theme = definition?.theme;
  const puzzleSurface = Boolean(gameScreen && definition && !definition.retired && !definition.arcadeRun && definition.category !== "arcade");
  /** Arcade games and the engine games on the arcade stage (their live round is the arcade play screen, polish-layout/bottom.css). */
  const arcadeScreen = Boolean(gameScreen && isArcadeScreenType(gameType));
  /** The live round of an arcade play screen: GameLayout owns the one compact header row. */
  const arcadePlay = arcadeScreen && play;
  useStandaloneShortfall(arcadePlay && constrained);
  /** A puzzle's game screen, intro or reveal: its edges and the page behind share the screen's own colour (polish-layout/bottom.css). */
  const puzzleScreen = Boolean(definition && !definition.arcadeRun && definition.category !== "arcade");
  const surfaceRef = useRef<HTMLDivElement>(null);
  usePuzzleSurfaces(surfaceRef, gameType, puzzleSurface);
  usePuzzleRejections(surfaceRef, Boolean(gameScreen && definition && !definition.arcadeRun && definition.category !== "arcade"), gameType);
  return (
    <div
      ref={surfaceRef}
      className={`relative w-full bg-background ${gameScreen ? "game-screen" : ""} ${
        constrained ? "no-overscroll game-viewport overflow-hidden" : "min-h-[100dvh]"
      }`}
      data-category={theme?.accent}
      data-puzzle-surface={puzzleSurface ? gameType : undefined}
      data-arcade-screen={arcadeScreen ? "" : undefined}
      data-arcade-play={arcadePlay ? "" : undefined}
      data-puzzle-screen={puzzleScreen ? "" : undefined}
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
        {!bare && !arcadePlay && (
          <div data-game-topbar={gameScreen ? "" : undefined} className="mb-2 grid h-9 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2" style={gameScreen ? NO_SELECT_STYLE : undefined}>
            <div className="min-w-0">{gameHeader ?? <Wordmark />}</div>
            <div className="flex shrink-0 items-center">{topAction}<MuteToggle /></div>
          </div>
        )}
        {arcadePlay ? <ArcadePlayHeader.Provider value={{ gameHeader, topAction }}>{children}</ArcadePlayHeader.Provider> : children}
      </div>
      <FxLayer theme={theme} />
    </div>
  );
}
