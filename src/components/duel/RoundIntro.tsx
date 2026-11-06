import { puzzleDef, puzzleName, typeTimeLimitMs, usesArcadeClock } from "@/lib/duel/registry";
import { starsOf } from "@/lib/duel/practiceGoals";
import { prepareSwingCourse } from "@/lib/arcade/swing";
import { prepareInkLevels } from "@/lib/arcade/inkBridge";
import { mgDeal } from "@/lib/arcade/cards/muggins";
import { pyDeal } from "@/lib/arcade/cards/pyramid";
import { INTRO_COUNTDOWN_MS, INTRO_MS, TOTAL_ROUNDS, type PuzzleType } from "@/lib/duel/types";
import type { Outcome } from "@/lib/duel/scoring";
import type { PuzzleData } from "@/lib/duel/types";
import { Button as JzButton, Stars } from "@/design/components";
import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { fx } from "@/lib/fx";
import { roundMusicFor } from "@/lib/fx/theme";
import { prepareBeatTrack, prepareRoundMusic, startMusic, stopMusic, stopMusicIf } from "@/lib/sound";
import { preloadGameArt } from "@/lib/arcade/gameArt.renderer";
import { preloadGameData, useGameDataReady } from "@/lib/duel/gamePreload";

import { CATEGORY_NAMES, FrameName } from "./GameFrame";
import { MuteToggle } from "./MuteToggle";
import { RoomChatSlot } from "./RoomFooter";
import { Dots } from "./Dots";
import { arcadeGroupOf } from "@/lib/duel/arcadeGroups";
import { PuzzleInstructions } from "./PuzzleInstructions";
import { hasIntroDemo, IntroDemo, introDemoAspect, useArcadeIntroDemo } from "./IntroDemo";
import { PuzzleIntroDemo, usePuzzleDemo } from "./PuzzleDemo";
import { IntroStage } from "./IntroStage";
import { useDesktop } from "@/lib/desktop";
import { screenKeys } from "@/lib/desktopKeys";
import { goStrike } from "@/lib/fx/celebrations";
import { useCelebrationsOn } from "@/components/fx/useCelebration";
import { haptic } from "@/lib/haptics";

/** The intro ending this close to GO (ms) still gets its GO strike as the round takes over. */
const GO_STRIKE_GRACE_MS = 600;

/**
 * The demo box (IntroStage) is never squeezed below this height (px) while a smaller
 * text step is left: past it the intro steps GOAL / HOW / SCORE down a size
 * (data-compact 1, then 2) instead, so the text always fits above READY with
 * no scrolling and the picture stays readable. The box's size comes from the text
 * alone, never from the demo, so it is the same with a demo, while one loads and without.
 */
const INTRO_VISUAL_MIN_PX = 110;
const INTRO_COMPACT_STEPS = 2;

interface RoundIntroProps {
  round: number;
  type: PuzzleType;
  /** Shared timestamp the intro is timed from. */
  startedAt: number;
  now: number;
  outcomes: Outcome[];
  /** Ready state, driven by the server. Practice mode leaves these off. */
  ready?: boolean;
  readyCount?: number;
  activeCount?: number;
  onReady?: () => void;
  practice?: boolean;
  deviceBest?: number | null;
  onBack?: () => void;
  /** This round's public puzzle, for puzzle-specific intro lines. */
  puzzle?: PuzzleData | null;
  /** The room's round count; its last round announces "final round". */
  totalRounds?: number;
  /**
   * False where the intro waits for READY (an async room's round, played on the player's own
   * clock): no "auto-start in" line. Rooms and practice keep it.
   */
  autoStart?: boolean;
  /** A control in the header before the sound button (a room guest's or the daily's "⋯" menu). */
  topAction?: ReactNode;
}

export function RoundIntro({
  round,
  type,
  startedAt,
  now,
  totalRounds = TOTAL_ROUNDS,
  ready = false,
  readyCount = 0,
  activeCount = 0,
  onReady,
  practice = false,
  deviceBest = null,
  onBack,
  puzzle = null,
  autoStart = true,
  topAction,
}: RoundIntroProps) {
  // In a room, the footer's chat button (RoomChatSlot), beside the countdown and Ready.
  const chatButton = useContext(RoomChatSlot);
  const elapsed = Math.max(0, now - startedAt);
  const remaining = Math.max(0, INTRO_MS - elapsed);
  const counting = remaining <= INTRO_COUNTDOWN_MS;
  const secondsLeft = Math.max(1, Math.ceil(remaining / 1000));
  const autoSeconds = Math.max(0, Math.ceil((remaining - INTRO_COUNTDOWN_MS) / 1000));
  const Example = puzzleDef(type).IntroExample;
  const savedPuzzleDemo = usePuzzleDemo(type);
  const puzzleDemo = hasIntroDemo(type) ? null : savedPuzzleDemo;
  // Engine games play their demo once a recorded one is there; until then, and for good when it is
  // stopped or missing, the same box shows the game's still (IntroStage), so the intro never moves.
  const savedArcadeDemo = useArcadeIntroDemo(type);
  const arcadeDemo = hasIntroDemo(type) && savedArcadeDemo !== "pending" ? savedArcadeDemo : null;
  const introLine = puzzle ? (puzzleDef(type).introLine?.(puzzle) ?? null) : null;
  // Arcade phases carry 3 s of invisible slack; show the run length only.
  // Any puzzle that carries its own stored clock shows it (Bomb v2 90 s, Counterweight balanceRev 2 120 s,
  // Ballpark numlineRev 2 90 s, Double Take spotRev 1 and Tally countRev 2 60 s, Tower's five discs): it is the
  // same limit puzzleTimeLimitMs gives the round's phase and grading. Stored rounds without one use the type limit.
  const ownLimit = (puzzle as { timeLimitMs?: number } | null)?.timeLimitMs;
  const limitMs = typeof ownLimit === "number" && ownLimit > 0 ? ownLimit : typeTimeLimitMs(type);
  const seconds = Math.round((limitMs - (usesArcadeClock(type) ? 3000 : 0)) / 1000);
  const twoPlayer = activeCount === 2;
  const theme = puzzleDef(type).theme;
  // Letterfall's word list: READY stays held until it is installed (normally long before).
  const dataReady = useGameDataReady(type);
  const countdownCued = useRef("");
  useEffect(() => {
    if (!counting) return;
    const key = `${startedAt}-${secondsLeft}`;
    if (countdownCued.current === key) return;
    countdownCued.current = key;
    fx.onCountdown(secondsLeft, theme);
    // Haptics (lib/haptics.ts): a light tick on 3, 2 and 1.
    haptic("tick");
  }, [counting, secondsLeft, startedAt, type]);

  // Haptics: a firmer one on GO, at the countdown's end (the intro may hand over a moment early, so
  // an unmount just before GO still gives it, as the GO strike below does).
  useEffect(() => {
    if (!counting) return;
    const delay = Math.max(0, INTRO_MS - Math.max(0, now - startedAt));
    const at = Date.now() + delay;
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      haptic("go");
    };
    const timer = window.setTimeout(fire, delay);
    return () => {
      window.clearTimeout(timer);
      if (!fired && at - Date.now() < GO_STRIKE_GRACE_MS) fire();
    };
  }, [counting, startedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Celebrations (src/lib/fx/celebrations.ts): GO (the countdown's end) gets one lightning strike
  // and the zap. The round's own start is untouched: the intro hands over on time and the strike
  // plays over the first moment of play.
  const celebrate = useCelebrationsOn();
  useEffect(() => {
    if (!counting || !celebrate) return;
    const delay = Math.max(0, INTRO_MS - Math.max(0, now - startedAt));
    const at = Date.now() + delay;
    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      goStrike();
    };
    const timer = window.setTimeout(fire, delay);
    return () => {
      window.clearTimeout(timer);
      if (at - Date.now() < GO_STRIKE_GRACE_MS) fire();
    };
  }, [counting, startedAt, celebrate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rooms preload in starting/round_title; practice keeps its existing entry point.
  useEffect(() => {
    if (practice) prepareRoundMusic(roundMusicFor(type, puzzleDef(type).category));
    // Tempo's tick-locked track (no round bed): decoded during the intro so it plays from the first frame.
    if (type === "beat") prepareBeatTrack();
  }, [type, practice]);

  // Grappler (swingRev 14, 15, 16 and 17) builds and proves its course from the seed: built while the intro is up (after its
  // first paint), so the round itself starts at once (rooms and practice; an async round's seed arrives at its start).
  useEffect(() => {
    if (puzzle?.type !== "swing") return;
    const { seed, swingRev } = puzzle;
    const timer = window.setTimeout(() => prepareSwingCourse(seed, swingRev), 120);
    return () => window.clearTimeout(timer);
  }, [puzzle]);

  // Muggins and Pyramid build and prove their deal from the seed (cached): built while the intro is up, the same way.
  useEffect(() => {
    if (puzzle?.type !== "muggins" && puzzle?.type !== "pyramid") return;
    const { type: kind, seed } = puzzle;
    const timer = window.setTimeout(() => (kind === "muggins" ? mgDeal(seed) : pyDeal(seed)), 120);
    return () => window.clearTimeout(timer);
  }, [puzzle]);

  // Rainbow Bridge builds and proves its ten levels from the seed (cached; inkRev 13's take longest): built while the
  // intro is up, the same way.
  useEffect(() => {
    if (puzzle?.type !== "inkbridge") return;
    const { seed, inkRev } = puzzle;
    const timer = window.setTimeout(() => prepareInkLevels(seed, inkRev), 120);
    return () => window.clearTimeout(timer);
  }, [puzzle]);

  // Arcade art: start loading the game's world sprites as the intro begins, so the
  // demo (which waits for them) and the round itself draw the art from frame one.
  useEffect(() => {
    void preloadGameArt(type);
    // Letterfall's dictionary: fetched as its intro begins, never with the main bundle.
    void preloadGameData(type);
  }, [type]);

  // Intro bed: restarts on each intro, never during the 3-2-1 (late arrivals skip it).
  useEffect(() => {
    if (counting) return;
    stopMusic(0);
    startMusic("intro_loop", { fadeMs: 0 });
    return () => stopMusicIf("intro_loop", 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt, type]);
  useEffect(() => {
    if (counting) stopMusicIf("intro_loop", 300);
  }, [counting]);

  // Round music is owned by the room/practice round state, never by this screen.

  // Fit: the text takes what it needs and the demo box (IntroStage) the rest.
  // If that leaves the box under INTRO_VISUAL_MIN_PX, or the text itself does
  // not fit, step the text down one size and measure again. Only the text and
  // the screen decide this, so a demo arriving later never changes the layout.
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(0);
  useLayoutEffect(() => setCompact(0), [type]);
  useEffect(() => {
    const reset = () => setCompact(0);
    window.addEventListener("resize", reset);
    return () => window.removeEventListener("resize", reset);
  }, []);
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el || compact >= INTRO_COMPACT_STEPS) return;
    const check = () => {
      const stage = el.querySelector<HTMLElement>("[data-intro-stage]");
      const overflow = el.scrollHeight - el.clientHeight > 1;
      const cramped = stage !== null && stage.clientHeight + 1 < INTRO_VISUAL_MIN_PX;
      if (overflow || cramped) setCompact((c) => Math.min(INTRO_COMPACT_STEPS, c + 1));
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [compact, counting, type]);

  return (
    // The intro's accent (31 Oct 2026): a puzzle's category colour, an arcade game's group colour (arcadeGroups.ts),
    // as its tile border and the room settings chip; gold stays for Ready.
    <div
      data-compact={compact}
      data-intro-accent={introAccent(type)}
      className="round-intro flex min-h-0 flex-1 flex-col gap-2 overflow-hidden animate-round-in"
    >
      {/* The game frame's 60 px header (Polish batch R): back (practice), the name over the category dot and
          "{Category} · Practice / Round n of N", the best (practice), the room's "⋯" menu and sound. */}
      <div data-intro-header className="intro-header" style={NO_SELECT}>
        {practice && onBack ? (
          <button type="button" onClick={onBack} aria-label="Back" className="intro-back press">
            <ChevronLeft aria-hidden="true" className="h-6 w-6" />
          </button>
        ) : null}
        <div className="game-frame-left">
          <FrameName as="h1" className="round-intro-title" text={puzzleName(type)} />
          <span className="game-frame-context">
            <span aria-hidden="true" className="game-frame-dot" />
            <span className="game-frame-context-text">
              {CATEGORY_NAMES[puzzleDef(type).category]} · {practice ? "Practice" : `Round ${round} of ${totalRounds}`}
            </span>
          </span>
        </div>
        <div className="intro-header-right">
          {practice ? (
            <span data-intro-best className="intro-best">
              {deviceBest === null ? (
                "No best yet"
              ) : (
                <>
                  <span className="intro-best-label">Best</span>
                  <span className="intro-best-value">{deviceBest}</span>
                </>
              )}
              {/* Practice goals: this game's mastery stars (a star once earned is kept: practiceGoals.ts). */}
              <Stars tier={starsOf(type, deviceBest)} />
            </span>
          ) : null}
          {topAction}
          <MuteToggle variant="frame" />
        </div>
      </div>
      {counting ? (
        <div className="flex flex-1 items-center justify-center" aria-live="polite">
          <p
            key={secondsLeft}
            className="font-mono text-[min(40vh,18rem)] font-bold leading-none text-category-accent animate-countdown-number"
          >
            {secondsLeft}
          </p>
        </div>
      ) : (
        <>
          {/* One layout for every game: GOAL, HOW, the demo box, SCORE. The box is the same size with a demo,
              while it loads and without one (IntroStage); the still fills it until a demo plays. */}
          <div
            ref={contentRef}
            className="round-intro-content flex min-h-0 flex-1 flex-col items-center justify-start gap-2 overflow-hidden py-1"
          >
            <PuzzleInstructions
              type={type}
              beforeScore={
                <IntroStage
                  key={type}
                  still={<Example />}
                  aspect={arcadeDemo ? introDemoAspect(type, arcadeDemo) : puzzleDemo ? puzzleDemo.log.w / puzzleDemo.log.h : null}
                  demo={
                    arcadeDemo
                      ? (onDemoReady) => <IntroDemo type={type} demo={arcadeDemo} onReady={onDemoReady} />
                      : puzzleDemo
                        ? (onDemoReady) => <PuzzleIntroDemo demo={puzzleDemo} onReady={onDemoReady} />
                        : null
                  }
                />
              }
            />
            {introLine ? (
              <p className="shrink-0 text-sm font-bold text-foreground">
                {introLine}
              </p>
            ) : null}
            <DesktopKeys type={type} />
            <p className="round-intro-time shrink-0 text-xs text-muted-foreground">
              You have {seconds} seconds
            </p>
          </div>

          {/* The footer: in a room the chat button, then the auto-start countdown as a ring in the category
              colour, then Ready in gold. */}
          <div className="intro-footer sticky bottom-0 z-10 flex shrink-0 flex-col items-stretch gap-1.5 pt-1">
            <div className="flex h-[52px] items-center gap-2">
              {chatButton}
              {!counting && onReady && autoStart ? (
                <AutoStartRing seconds={autoSeconds} total={Math.round((INTRO_MS - INTRO_COUNTDOWN_MS) / 1000)} />
              ) : null}
              <JzButton
                variant={ready ? "secondary" : "gold"}
                size={52}
                disabled={ready || !dataReady}
                onClick={onReady}
                className="min-w-0 flex-1"
              >
                {!dataReady ? "Loading words…" : ready ? "Ready ✓" : "Ready"}
              </JzButton>
            </div>

            {/* The ready count only takes a row when there is someone to wait for. */}
            {activeCount > 1 ? (
            <p className="flex h-5 items-center justify-center gap-1.5 text-[13px] text-muted-foreground">
              {ready && twoPlayer && readyCount < activeCount ? (
                <>
                  Waiting for opponent <Dots />
                </>
              ) : (
                <>
                  {readyCount} of {activeCount} ready
                </>
              )}
            </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The game's keys, on desktop only (useDesktop: a mouse or trackpad in a wide window; never a phone,
 * whose intro is unchanged): one short line of key caps under the rules (docs/desktop-support.md).
 */
function DesktopKeys({ type }: { type: PuzzleType }) {
  const desktop = useDesktop();
  const keys = screenKeys(type, desktop);
  if (!desktop || !keys) return null;
  return (
    <p data-desktop-keys="" className="desktop-keys shrink-0" aria-label="Keyboard controls">
      {keys.map(([key, action]) => (
        <span key={key}>
          <kbd>{key}</kbd> {action}
        </span>
      ))}
    </p>
  );
}

const NO_SELECT = { userSelect: "none", WebkitUserSelect: "none" } as const;

/** The auto-start countdown: a 44 px ring in the category colour, the seconds inside (display only). */
function AutoStartRing({ seconds, total }: { seconds: number; total: number }) {
  const r = 19;
  const c = 2 * Math.PI * r;
  const share = total > 0 ? Math.max(0, Math.min(1, seconds / total)) : 0;
  return (
    <span data-auto-start={seconds} role="timer" aria-label={`Auto-start in ${seconds}s`} className="intro-ring">
      <svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#26262C" strokeWidth="3.5" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--category-accent)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span aria-hidden="true">{seconds}</span>
    </span>
  );
}

/** The colour an intro takes: the game's arcade group (Retro, Sports, Cards & Board, Action, Strategy) or its category. */
export function introAccent(type: PuzzleType): string {
  const category = puzzleDef(type).category;
  return (category === "arcade" ? arcadeGroupOf(type) : null) ?? category;
}
