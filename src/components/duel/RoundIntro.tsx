import { puzzleDef, puzzleName, typeTimeLimitMs, usesArcadeClock } from "@/lib/duel/registry";
import { INTRO_COUNTDOWN_MS, INTRO_MS, TOTAL_ROUNDS, type PuzzleType } from "@/lib/duel/types";
import type { Outcome } from "@/lib/duel/scoring";
import type { PuzzleData } from "@/lib/duel/types";
import { Button } from "@/components/ui/button";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fx } from "@/lib/fx";
import { roundMusicFor } from "@/lib/fx/theme";
import { prepareRoundMusic, startMusic, stopMusic, stopMusicIf } from "@/lib/sound";
import { preloadGameArt } from "@/lib/arcade/gameArt.renderer";
import { preloadGameData, useGameDataReady } from "@/lib/duel/gamePreload";

import { RoundPips } from "./RoundPips";
import { Dots } from "./Dots";
import { PuzzleInstructions } from "./PuzzleInstructions";
import { hasIntroDemo, IntroDemo, introDemoAspect, useArcadeIntroDemo } from "./IntroDemo";
import { PuzzleIntroDemo, usePuzzleDemo } from "./PuzzleDemo";
import { IntroStage } from "./IntroStage";
import { useDesktop } from "@/lib/desktop";
import { DESKTOP_KEYS } from "@/lib/desktopKeys";

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
}

export function RoundIntro({
  round,
  type,
  startedAt,
  now,
  outcomes,
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
}: RoundIntroProps) {
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
  }, [counting, secondsLeft, startedAt, type]);

  // Rooms preload in starting/round_title; practice keeps its existing entry point.
  useEffect(() => {
    if (practice) prepareRoundMusic(roundMusicFor(type, puzzleDef(type).category));
  }, [type, practice]);

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
    <div data-compact={compact} className="round-intro flex min-h-0 flex-1 flex-col gap-2 overflow-hidden animate-round-in">
      <div className="category-header flex items-start justify-between">
        {practice && onBack ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            className="press h-8 shrink-0 px-2.5"
          >
            ← Back
          </Button>
        ) : null}
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {practice ? "Practice" : `Round ${round} of ${totalRounds}`}{" "}
            <span className="category-tag">· {theme.accent}</span>
          </span>
          {!counting && onReady && autoStart ? (
            <span className="font-mono text-[0.7rem] text-foreground/70">
              auto-start in {autoSeconds}s
            </span>
          ) : null}
        </div>
        {!practice && <RoundPips currentRound={round} outcomes={outcomes} totalRounds={totalRounds} />}
      </div>

      <h1 className="round-intro-title w-full min-w-0 whitespace-normal break-words text-center font-display text-[2.25rem] font-bold leading-none animate-pop-in sm:text-[2.75rem]">
        {puzzleName(type)}
      </h1>
      {practice ? <p className="text-center font-mono text-xs text-muted-foreground">Best: {deviceBest ?? "—"} · this device</p> : null}

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
              <p className="shrink-0 font-mono text-sm font-bold uppercase tracking-widest text-primary">
                {introLine}
              </p>
            ) : null}
            <DesktopKeys type={type} />
            <p className="round-intro-time shrink-0 text-xs text-muted-foreground">
              You have {seconds} seconds
            </p>
          </div>

          <div className="sticky bottom-0 z-10 flex shrink-0 flex-col items-center gap-2 bg-background pt-1">
            <Button
              type="button"
              disabled={ready || !dataReady}
              onClick={onReady}
              className={`press h-[60px] w-full rounded-2xl font-display text-2xl font-bold uppercase tracking-[0.12em] disabled:opacity-100 ${
                ready ? "bg-opponent text-primary-foreground" : "bg-primary text-primary-foreground"
              }`}
            >
              {!dataReady ? "Loading words…" : ready ? "Ready ✓" : "Ready"}
            </Button>

            {/* The ready count only takes a row when there is someone to wait for. */}
            {activeCount > 1 ? (
            <p className="flex h-5 items-center gap-1.5 font-mono text-xs text-muted-foreground">
              {activeCount > 1 ? (
                ready && twoPlayer && readyCount < activeCount ? (
                  <>
                    Waiting for opponent <Dots />
                  </>
                ) : (
                  <>
                    {readyCount} of {activeCount} ready
                  </>
                )
              ) : null}
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
  const keys = DESKTOP_KEYS[type];
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
