import { createContext, useContext, useEffect, useLayoutEffect, useRef, type ReactNode, type Ref } from "react";

import { MuteToggle } from "./MuteToggle";
import { BOARD_FILL, CATEGORY_NAMES, FrameName, GoalLine, useBoardTray } from "./GameFrame";
import { AppHeader } from "@/components/app/AppHeader";
import { AppWordmark } from "@/components/brand/AppWordmark";
import { FxLayer } from "./FxLayer";
import type { PuzzleType } from "@/lib/duel/types";
import { puzzleDef } from "@/lib/duel/registry";
import { usePuzzleSurfaces } from "@/components/puzzles/usePuzzleSurfaces";
import { GameLayoutDevOverlay } from "./GameLayoutDevOverlay";
import { GameColumnLayout } from "@/components/puzzles/gameColumn";
import { usePuzzleHaptics } from "@/components/puzzles/usePuzzleHaptics";
import { usePuzzleRejections } from "@/components/puzzles/usePuzzleRejections";
import { AppTabBar, type AppTab } from "@/components/app/AppTabBar";
import type { ThemeSkin } from "@/lib/theme";
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { AppRail } from "@/components/app/AppRail";
import { DesktopControlsHint } from "./DesktopControlsHint";
import { BannerSlot } from "@/components/app/PageAside";
import { useLayoutMode } from "@/lib/layoutMode";
import { DESKTOP_MODES } from "@/lib/duel/desktopModes";
import { DesktopPresentation, type DesktopPresentationValue } from "@/lib/desktopPresentation";

interface PhoneShellProps {
  children: ReactNode;
  /** Hide the slim top bar (the home screen carries its own big wordmark). */
  bare?: boolean;
  /** Lock active puzzle and reveal layouts to the device viewport. */
  constrained?: boolean;
  /** Suppress iOS selection/callouts throughout an active round screen. */
  gameScreen?: boolean;
  gameType?: PuzzleType | undefined;
  /** Room score summary that replaces the wordmark (screens other than a live round; the frame has its own score). */
  gameHeader?: ReactNode;
  /** A small control beside the mute toggle (a guest's Leave between rounds). */
  topAction?: ReactNode;
  /**
   * The live round (GameLayout's play screen), as opposed to its intro or reveal. Its top bar
   * gives way to GameLayout's frame header (Polish 2); an arcade play screen (isArcadeScreenType)
   * also paints every gap the screen edge's black, a puzzle's (data-puzzle-play) draws the
   * category background and tray (display only).
   */
  play?: boolean;
  /**
   * One of the app shell's four tab screens (Play, Practice's list, Tournaments, Profile): the
   * bottom tab bar is drawn and the page leaves room for it. Never set on a room or game screen.
   */
  tabs?: AppTab;
  /**
   * The page skin (polish-layout/theme.css): the tab screens take their own (from `tabs`); the
   * room's lobby, results, standings and podium pass "room". Never set on a round's intro or game.
   */
  skin?: ThemeSkin;
  /**
   * The computer layout (31 Oct 2026): a tab page's right column (PageAside), drawn beside the page
   * from 700 px wide (lib/layoutMode.ts); never on a phone.
   */
  aside?: ReactNode;
}

/**
 * A room's right panel (RoomPanel) on the computer layout: the room route provides it around every
 * screen it draws, and PhoneShell draws it on the right from 1024 px wide; never on a phone or tablet.
 */
export const RoomPanelSlot = createContext<ReactNode>(null);

/** Arcade games and the engine games on the arcade stage (Letterfall, Tenfall, Bonk, Pull!, Mixed Signals). */
export function isArcadeScreenType(type: PuzzleType | undefined): boolean {
  const definition = type ? puzzleDef(type) : undefined;
  return Boolean(definition && (definition.arcadeRun || definition.category === "arcade"));
}

/**
 * What a live round's shell hands to GameLayout's frame (null on every other screen): the game, and
 * whether it is an arcade play screen (the arena edge to edge under the header, no goal line).
 */
const GameFrameShell = createContext<{ type: PuzzleType | undefined; arcade: boolean; topAction?: ReactNode } | null>(null);

/** Inline no-select style for text on game screens (timer digits, HUD, banners). */
export const NO_SELECT_STYLE = {
  userSelect: "none",
  WebkitUserSelect: "none",
  WebkitTouchCallout: "none",
  WebkitTapHighlightColor: "transparent",
} as const;

const CONTROL = "button, a, input, textarea, select, [role='button']";

/**
 * Identical round geometry: mode-specific text cannot resize the game region.
 *
 * The game frame (Polish 2, 24 Oct 2026, display only; docs/design-system.md "Game screens"): every
 * game's live round, puzzle or arcade, in practice, a room or the daily, has one 60px header
 * (polish-layout/game-frame.css): the game's name over a dot in its category colour and
 * "{Category} · {label}" (Practice, Round n of N, Daily) on the left, the 48px timer ring centred,
 * the score block, "?" and sound on the right. Puzzles add the goal line under it (GoalLine) and sit
 * on the tray; arcade worlds start directly under it.
 */
export function GameLayout({ label, title, help, progress, score, ping, timer, beforeGame, children, overlay, stageRef, locked = false, held = false }: {
  /** The context after the category: "Practice", "Round 2 of 6", "Daily". */
  label: ReactNode;
  title: ReactNode;
  help: ReactNode;
  /** A room's round pips: in the context line where the header has room for them (game-frame.css). */
  progress?: ReactNode;
  /** The header's score block (FrameScore). */
  score?: ReactNode;
  /**
   * A room's live "finished" ping (FinishedPingStrip), laid over the header's name and context
   * while it shows; never over the timer, the score, "?", sound or the board.
   */
  ping?: ReactNode;
  /** @deprecated The frame's name and context line say the round and game; kept so callers compile. */
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
  const frame = useContext(GameFrameShell);
  const arcade = Boolean(frame?.arcade);
  const type = frame?.type;
  const category = type ? puzzleDef(type).category : undefined;
  const regionRef = useRef<HTMLDivElement | null>(null);
  const trayRef = useRef<HTMLDivElement | null>(null);
  const setRegion = (el: HTMLDivElement | null) => {
    regionRef.current = el;
    if (typeof stageRef === "function") stageRef(el);
    else if (stageRef) (stageRef as { current: HTMLDivElement | null }).current = el;
  };
  // Puzzles: the tray behind the board (GameFrame useBoardTray); arcade worlds have none.
  useBoardTray(regionRef, trayRef, Boolean(frame && !arcade && type));
  const stage = (
    <div ref={setRegion} data-game-region className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      {frame && !arcade && type ? <div ref={trayRef} data-game-tray aria-hidden="true" className="game-tray" /> : null}
      <div data-game-stage className={`game-column game-column-centred game-column-lifted flex min-h-0 flex-1 flex-col ${locked ? `pointer-events-none transition-opacity duration-200${held ? "" : " opacity-30"}` : ""}`} data-board-held={locked && held ? "" : undefined}>
        <GameColumnLayout.Provider value>{children}</GameColumnLayout.Provider>
      </div>
      {overlay}
    </div>
  );
  const nameLength = typeof title === "string" ? Math.max(6, title.length) : 12;
  const contextLength = (category ? CATEGORY_NAMES[category].length + 3 : 0) + (typeof label === "string" ? label.length : 12);
  const header = (
    <div
      data-round-heading
      data-game-topbar
      data-game-frame-header
      data-arcade-header={arcade ? "" : undefined}
      className="game-frame-header"
      style={NO_SELECT_STYLE}
    >
      <div data-header-left className="game-frame-left">
        {typeof title === "string" ? (
          <FrameName data-frame-name text={title} />
        ) : (
          <span data-frame-name className="game-frame-name" style={{ ["--name-len" as string]: nameLength }}>{title}</span>
        )}
        <span data-frame-context data-fit={contextLength > 20 ? "short" : undefined} className="game-frame-context">
          <span aria-hidden="true" className="game-frame-dot" />
          <span className="game-frame-context-text">
            {category ? <span className="game-frame-cat">{CATEGORY_NAMES[category]} · </span> : null}
            {label}
          </span>
          {progress ? <span data-frame-pips className="game-frame-pips">{progress}</span> : null}
        </span>
        {ping}
      </div>
      <div data-frame-timer data-arcade-timer={arcade ? "" : undefined} className="game-frame-timer">{timer}</div>
      <div data-header-right className="game-frame-right">
        {score}
        {help}
        {frame?.topAction}
        <MuteToggle variant="frame" />
      </div>
    </div>
  );
  return (
    <div data-round-layout data-frame={arcade ? "arcade" : "puzzle"} className="flex min-h-0 flex-1 flex-col animate-round-in">
      {header}
      {!arcade && type ? (
        <GoalLine type={type}>
          {beforeGame}
          {stage}
        </GoalLine>
      ) : (
        <>
          {beforeGame}
          {stage}
        </>
      )}
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
 * No feedback (16 Oct 2026, fix-up of the home-screen bottom flash): the values are worked out once
 * per geometry (screen size, orientation and top inset, none of which the grown root can change)
 * and written only when they differ, so a resize the growth itself sets off (iOS may fire one when
 * the root outgrows its short viewport) changes nothing and the root never flips between heights.
 * Play screens share one root, so the values stay while any of them is up.
 *
 * Capped at the screen (18 Oct 2026, display only): the growth is the top inset and the grown
 * height never passes the screen's own height (--standalone-screen), so whichever way WebKit lays
 * the app out, short or (as it can after a few rounds, or once fixed) the whole screen, and even
 * when that changes while a play screen is up, the play screen is exactly the screen's height:
 * min(100dvh + inset, screen). Before, a 48px shortfall measured on a short viewport stayed on a
 * viewport that had grown to the whole screen and pushed the lowest controls (Fission's arrows)
 * 48px down, 32px off the bottom. Neither value depends on layout, so nothing can feed back.
 * arcade-repeat-play-check proves it over four practice runs and a mid-run viewport change.
 */
const shortfall = { users: 0, key: "", px: 0, screen: 0 };

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

/** The screen's height for this orientation (iOS never swaps screen.width and screen.height). */
function screenHeight(key: string): number {
  const portrait = key.includes(":p:");
  return portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
}

const setRootVar = (name: string, value: string) => {
  const root = document.documentElement;
  if (root.style.getPropertyValue(name) === value) return;
  if (value) root.style.setProperty(name, value);
  else root.style.removeProperty(name);
};

function applyShortfall() {
  const geometry = standaloneGeometry();
  const key = geometry?.key ?? "";
  if (key !== shortfall.key) {
    shortfall.key = key;
    shortfall.screen = geometry ? screenHeight(key) : 0;
    // The growth: the top inset (WebKit bug 254868 lays the app out short by exactly that), capped below by the screen.
    shortfall.px = geometry && shortfall.screen > 0 ? Math.round(geometry.inset) : 0;
  }
  const want = shortfall.px > 0 ? `${shortfall.px}px` : "";
  setRootVar("--standalone-short", want);
  setRootVar("--standalone-screen", want ? `${shortfall.screen}px` : "");
}

function useStandaloneShortfall(active: boolean) {
  // Before paint (17 Oct 2026, display only): the play screen's first frame already has its full height.
  useIsoLayoutEffect(() => {
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
      root.style.removeProperty("--standalone-screen");
    };
  }, [active]);
}

/**
 * A reopened iOS home-screen app (17 Oct 2026, fix-up after #95, display only) settles its
 * geometry after a round's first frame: laid out the whole screen with no safe-area insets,
 * then short by the top inset (WebKit bug 254868) with the insets, so a puzzle board drawn on
 * the first frame jumped up a few px. In a home-screen app (navigator.standalone) a puzzle's
 * live round is held hidden (data-geometry-hold: the game column invisible, its entrance fade
 * paused) from before its first paint until the geometry is known: the safe-area insets have
 * arrived (a home-screen app always has one) and the layout viewport, 100dvh and the insets
 * have read the same for three frames in a row, at most 400 ms. On a settled launch that is
 * three frames under the fade's transparent start. Safari and every other browser never hold.
 * first-paint-check's standalone pass proves it.
 */
const HOLD_STABLE_FRAMES = 3;
const HOLD_MAX_MS = 400;

function geometryReading(): { key: string; insets: boolean } {
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;left:0;top:0;width:1px;height:100dvh;box-sizing:content-box;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const insets = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].map((v) => parseFloat(v) || 0);
  const dvh = parseFloat(cs.height) || 0;
  probe.remove();
  return { key: `${window.innerWidth}x${window.innerHeight}:${dvh}:${insets.join(",")}`, insets: insets.some((v) => v > 0) };
}

function useGeometryHold(ref: { current: HTMLElement | null }, active: boolean) {
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el || (navigator as Navigator & { standalone?: boolean }).standalone !== true) return;
    el.dataset["geometryHold"] = "";
    const started = performance.now();
    let last = geometryReading().key;
    let stable = 0;
    let frame = requestAnimationFrame(function check() {
      const reading = geometryReading();
      if (reading.key === last) stable++;
      else {
        last = reading.key;
        stable = 0;
      }
      if ((reading.insets && stable >= HOLD_STABLE_FRAMES) || performance.now() - started >= HOLD_MAX_MS) {
        delete el.dataset["geometryHold"];
        return;
      }
      frame = requestAnimationFrame(check);
    });
    return () => {
      cancelAnimationFrame(frame);
      delete el.dataset["geometryHold"];
    };
  }, [active]);
}

/** Mobile-first column, centred on larger screens, with a little depth behind. */
export function PhoneShell({ children, bare = false, constrained = false, gameScreen = false, gameType, gameHeader, topAction, play = false, tabs, skin, aside }: PhoneShellProps) {
  useRootSelectionLock(gameScreen);
  // The computer layout (31 Oct 2026, presentation only): every slot below is null on a phone, so a
  // phone's markup is exactly as before; children keep their place in the tree on every layout, so
  // crossing a breakpoint never remounts a page or a running game.
  const layout = useLayoutMode();
  const desktop = layout === "desktop";
  const wider = layout !== "phone";
  const roomPanel = useContext(RoomPanelSlot);
  const tabPage = Boolean(tabs && !gameScreen);
  const panel = desktop && !tabPage && roomPanel ? roomPanel : null;
  const modeInfo = gameType ? DESKTOP_MODES[gameType] : undefined;
  const presentation: DesktopPresentationValue = {
    mode: desktop && gameScreen && modeInfo ? modeInfo.mode : null,
    rotate: Boolean(desktop && gameScreen && play && modeInfo?.mode === "rotate"),
    keys: desktop && gameScreen && play && modeInfo?.mode === "rotate" ? (modeInfo.keys ?? null) : null,
  };
  const definition = gameType ? puzzleDef(gameType) : undefined;
  const theme = definition?.theme;
  const puzzleSurface = Boolean(gameScreen && definition && !definition.retired && !definition.arcadeRun && definition.category !== "arcade");
  /** Arcade games and the engine games on the arcade stage (their live round is the arcade play screen, polish-layout/bottom.css). */
  const arcadeScreen = Boolean(gameScreen && isArcadeScreenType(gameType));
  /** The live round of an arcade play screen: GameLayout owns the one compact header row. */
  const arcadePlay = arcadeScreen && play;
  useStandaloneShortfall(arcadePlay && constrained);
  /** Every game's live round (Polish 2): GameLayout's frame header replaces the app's top bar. */
  const framePlay = Boolean(gameScreen && play);
  /** A puzzle's game screen, intro or reveal: its edges and the page behind share the screen's own colour (polish-layout/bottom.css). */
  const puzzleScreen = Boolean(definition && !definition.arcadeRun && definition.category !== "arcade");
  const surfaceRef = useRef<HTMLDivElement>(null);
  useGeometryHold(surfaceRef, Boolean(play && constrained && gameScreen && !arcadeScreen));
  usePuzzleSurfaces(surfaceRef, gameType, puzzleSurface);
  usePuzzleRejections(surfaceRef, Boolean(gameScreen && definition && !definition.arcadeRun && definition.category !== "arcade"), gameType);
  usePuzzleHaptics(surfaceRef, Boolean(gameScreen && definition && !definition.arcadeRun && definition.category !== "arcade"));
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
      data-puzzle-play={framePlay && puzzleScreen ? "" : undefined}
      data-board-fill={framePlay && puzzleScreen && gameType && BOARD_FILL.has(gameType) ? "" : undefined}
      data-particle-shape={theme?.particleShape ?? "disc"}
      data-tab-screen={tabs && !gameScreen ? tabs : undefined}
      data-skin={gameScreen ? undefined : (skin ?? tabs)}
      data-layout={wider ? layout : undefined}
      data-desktop-mode={presentation.mode ?? undefined}
      data-room-panel={panel ? "" : undefined}
      data-desktop-cap={desktop && gameScreen && modeInfo?.maxWorldWidth ? "" : undefined}
      style={gameScreen ? (desktop && modeInfo?.maxWorldWidth ? { ...NO_SELECT_STYLE, ["--dk-world-max" as string]: `${modeInfo.maxWorldWidth}px` } : NO_SELECT_STYLE) : undefined}
    >
      {desktop ? <AppRail current={tabPage ? tabs : undefined} compact={!tabPage} /> : null}
      <div aria-hidden="true" className="screen-background"><div className="screen-drift" /></div>
      {/* Desktop arcade play (31 Oct 2026): the game's scenery fades out at the edges of the centre (one static layer over it). */}
      {desktop && arcadePlay ? <div aria-hidden="true" data-dk-fade="" /> : null}
      <div
        data-game-column={constrained ? "" : undefined}
        data-shell-column={gameScreen ? "game" : "page"}
        data-app-page={tabs && !gameScreen ? tabs : undefined}
        className={`relative flex min-h-0 w-full flex-col justify-start ${gameScreen ? "pad-game-safe" : "mx-auto max-w-[430px] pad-safe"} ${
          constrained ? "no-overscroll h-full overflow-hidden" : "min-h-[100dvh]"
        }`}
      >
        {/* The four tab screens: their own header (Prompt R; none on the computer layout, where the rail has the logo and sound); every other screen keeps the top bar. */}
        {tabs && !gameScreen ? <AppHeader /> : !bare && !framePlay && (
          <div data-game-topbar={gameScreen ? "" : undefined} className="mb-2 grid h-9 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2" style={gameScreen ? NO_SELECT_STYLE : undefined}>
            <div className="min-w-0">{gameHeader ?? <AppWordmark />}</div>
            <div className="flex shrink-0 items-center">{topAction}<MuteToggle /></div>
          </div>
        )}
        {/* Offline practice: the slim banner, drawn only while <html data-offline> is set (never on a game screen). */}
        {gameScreen ? null : <OfflineBanner />}
        {desktop && tabPage && tabs !== "profile" ? <BannerSlot page={tabs as "play" | "practice" | "tournaments"} /> : null}
        <DesktopPresentation.Provider value={presentation}>
          {framePlay ? <GameFrameShell.Provider value={{ type: gameType, arcade: arcadeScreen, topAction }}>{children}</GameFrameShell.Provider> : children}
        </DesktopPresentation.Provider>
        {wider && tabPage && aside ? aside : null}
      </div>
      {panel}
      {desktop && framePlay && gameType ? <DesktopControlsHint type={gameType} /> : null}
      {tabs && !gameScreen && !desktop ? <AppTabBar current={tabs} /> : null}
      <FxLayer theme={theme} />
    </div>
  );
}
