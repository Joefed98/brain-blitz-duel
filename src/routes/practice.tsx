import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { WaitingLine } from "@/components/duel/Dots";
import { GameLayout, PhoneShell, isArcadeScreenType } from "@/components/duel/PhoneShell";
import { FrameScore } from "@/components/duel/GameFrame";
import { SteadyOrPlain } from "@/components/duel/SteadyStage";
import { useCrashContext } from "@/lib/useCrashContext";
import { useArcadeScreenTickMs } from "@/lib/fx/useArcadeScreenTick";
import { PuzzleHelp, PuzzleHelpButton } from "@/components/duel/PuzzleInstructions";

import { RoundIntro } from "@/components/duel/RoundIntro";
import { preloadGameData } from "@/lib/duel/gamePreload";
import { TimerBar } from "@/components/duel/TimerBar";
import { arcadeMsRemaining } from "@/lib/arcade/clock";
import {
  practiceCheckWordFn,
  practiceCheckMovesFn,
  practiceGenerateFn,
  practiceGradeFn,
} from "@/lib/duel/practice.functions";
import { orbitDevPlanet } from "@/lib/arcade/orbitDevJump";
import { practiceUpdateGate, useUpdateGate } from "@/lib/appUpdate";
import { APP_BUILD_ID } from "@/lib/appVersion";
import { DevKeyStatus, SaveDemoButton, useDemoKey } from "@/components/duel/SaveDemoButton";
import {
  PUZZLE_REGISTRY,
  RETIRED_PUZZLE_TYPES,
  PREVIEW_PUZZLE_TYPES,
  gameCounts,
  puzzleCategories,
  puzzleDef,
  puzzleDurationMs,
  puzzleName,
  puzzlePrepMs,
  puzzleShowsTimer,
  puzzleTimeLimitMs,
  puzzleRunMs,
  typesInCategory,
  isLiveType,
} from "@/lib/duel/registry";
import { clearStageState } from "@/lib/duel/stageState";
import { DemoRecorder, type PuzzleDemoLog } from "@/lib/duel/puzzleDemo";
import { hasIntroDemo } from "@/components/duel/IntroDemo";
import { INTRO_COUNTDOWN_MS, INTRO_MS, type PuzzleData, type PuzzleType } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import {
  playLock,
  releaseRoomMusic,
  holdMusicBed,
  stopWarning10,
  unlockAudio,
} from "@/lib/sound";
import { roundMusicFor } from "@/lib/fx/theme";
import { roundMusicRemaining, useRoundMusic } from "@/lib/duel/useRoundMusic";
import { useScreenMusic } from "@/lib/useScreenMusic";
import type { SubmitMeta } from "@/puzzles/types";
import type { MovesView } from "@/lib/duel/moves";
import { readPracticeBest, recordPracticeBest } from "@/lib/duel/practiceBest";
import { currentPracticeStamp, stampSignature } from "@/lib/duel/practiceStamps";
import { APP_NAME } from "@/lib/brand";
import { noteSignatureSubmit, signatureHoldUntil } from "@/lib/fx/signature";
import { useSignatureVerdict } from "@/lib/fx/useSignature";
import { GameIcon } from "@/components/app/GameIcon";
import { notePracticePlayed, recentPracticeTypes } from "@/lib/duel/practiceRecent";
import type { PuzzleCategory } from "@/lib/duel/types";

export const Route = createFileRoute("/practice")({
  ssr: false,
  // ?game=<type>: open that game's round at once (the Play tab's Warm up tiles).
  validateSearch: (search: Record<string, unknown>): { game?: string } =>
    typeof search["game"] === "string" ? { game: search["game"] } : {},
  head: () => ({
    meta: [
      { title: `${APP_NAME} practice — try any game` },
      {
        name: "description",
        content: `Practise any ${APP_NAME} game and keep personal best scores on this device. Room scores are unaffected.`,
      },
      { property: "og:title", content: `${APP_NAME} practice — try any game` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: `Practise ${APP_NAME} games with personal best scores saved only on this device.`,
      },
      {
        name: "twitter:description",
        content: `Practise ${APP_NAME} games with personal best scores saved only on this device.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PracticeScreen,
});

type Stage = "list" | "loading" | "intro" | "puzzle" | "reveal";

interface Graded {
  puzzle: PuzzleData;
  isCorrect: boolean;
  score: number;
  msRemaining: number;
  reactionAvgMs: number | null;
  answer: string;
  extra?: Record<string, unknown> | null;
}

function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  // Low-end performance (16 Oct 2026): 4 Hz instead of 10 while reduced effects are on in a live arena (lib/fx/lowEnd.ts).
  const tickMs = useArcadeScreenTickMs(100);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [active, tickMs]);
  return now;
}

/**
 * A practice row's best under the game's current stamps, in the BEST column; "–" before a first run.
 * Kept out of the row's accessible name (aria-hidden; the button points at it with aria-describedby),
 * so the button is always named exactly the game, before and after a best.
 */
function RowBest({ type }: { type: PuzzleType }) {
  const best = readPracticeBest(type, currentPracticeStamp(type));
  return (
    <span
      id={cardBestId(type)}
      aria-hidden="true"
      data-card-best={best ?? undefined}
      data-none={best === null || undefined}
      className="ap-best"
    >
      {best ?? "–"}
    </span>
  );
}

/** The id the row's button describes itself by (its best). */
function cardBestId(type: PuzzleType): string {
  return `practice-best-${type}`;
}

/** "Word", "Arcade"… */
function categoryLabel(category: PuzzleCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

type PracticeFilter = PuzzleCategory | "all";

/** The games rooms deal (the title's "72 games"). */
const ACTIVE_GAME_COUNT = (() => {
  const counts = gameCounts();
  return counts.puzzle + counts.arcade;
})();

/** The list's chips and search: the game's name or category, any case. */
function matchesFilter(type: PuzzleType, filter: PracticeFilter, query: string): boolean {
  const definition = PUZZLE_REGISTRY[type];
  if (filter !== "all" && definition.category !== filter) return false;
  const q = query.trim().toLowerCase();
  return q === "" || definition.name.toLowerCase().includes(q) || definition.category.includes(q);
}

/** The signature verdict for a graded practice run. */
function practiceVerdict(graded: Graded) {
  return {
    type: graded.puzzle.type,
    arcade: puzzleDef(graded.puzzle.type).category === "arcade",
    correct: graded.isCorrect,
    score: graded.score,
    msRemaining: graded.msRemaining,
    timeLimitMs: puzzleTimeLimitMs(graded.puzzle),
  };
}

function PracticeScreen() {
  const [stage, setStage] = useState<Stage>("list");
  const [filter, setFilter] = useState<PracticeFilter>("all");
  const [query, setQuery] = useState("");
  const search = Route.useSearch() as { game?: string };
  const navigate = useNavigate();
  // A new version reloads only on the list, never mid-run (lib/appUpdate).
  useUpdateGate(practiceUpdateGate(stage));
  const [type, setType] = useState<PuzzleType | null>(null);
  // Crash reports name the game on screen (lib/crashReporting.ts); practice has no round number.
  useCrashContext(type, null);
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [sealed, setSealed] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [deviceBest, setDeviceBest] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  const [run, setRun] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const grading = useRef(false);
  const introCancelled = useRef(false);
  const draftAnswer = useRef("");
  /** The run whose round ended early (submitted); its music stops at once. */
  const [endedKey, setEndedKey] = useState("");
  /** When the beat fires, the reveal waits for it to finish (Date.now() clock). */
  const [revealAt, setRevealAt] = useState<number | null>(null);
  // Letterfall's word list starts downloading (or loads from the device cache) as soon as
  // the game list is shown, so the run never waits for it.
  useEffect(() => {
    if (stage === "list") void preloadGameData("wordfall");
  }, [stage]);
  const now = useTicker(stage === "intro" || stage === "puzzle" || stage === "reveal");
  const { key: demoKey, status: demoStatus } = useDemoKey();
  const stateKey = `practice-${run}`;
  // Dev only: "Intro examples" loads each game's fixed intro example and records touches.
  const [exampleMode, setExampleMode] = useState(false);
  const exampleRun = useRef(false);
  const recorder = useRef<DemoRecorder | null>(null);
  const [recording, setRecording] = useState<PuzzleDemoLog | null>(null);
  const recordArea = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !exampleRun.current || !demoKey || !puzzle || hasIntroDemo(puzzle.type)) return;
      if (!recorder.current) {
        recorder.current = new DemoRecorder(startedAt);
        recorder.current.attach(el);
      }
    },
    [demoKey, puzzle, startedAt],
  );
  const stopRecording = useCallback(() => {
    const rec = recorder.current;
    recorder.current = null;
    setRecording(rec ? rec.finish() : null);
  }, []);

  useEffect(() => setHelpOpen(false), [stage, type]);
  useEffect(() => {
    releaseRoomMusic();
    holdMusicBed("intro_loop");
    return () => {
      stopWarning10();
      releaseRoomMusic();
    };
  }, []);
  // Silent until the slots get files (docs/sound-cues/music.md).
  useScreenMusic("music_practice", stage === "list");
  useScreenMusic("music_reveal", stage === "reveal");

  const load = useCallback(
    async (next: PuzzleType) => {
      unlockAudio();
      introCancelled.current = false;
      grading.current = false;
      draftAnswer.current = "";
      setRun((count) => {
        clearStageState(`practice-${count}`);
        return count + 1;
      });
      setType(next);
      if (!exampleMode) notePracticePlayed(next);
      setDeviceBest(readPracticeBest(next, currentPracticeStamp(next)));
      setNewBest(false);
      setGraded(null);
      setRevealAt(null);
      setPuzzle(null);
      setStage("loading");
      recorder.current?.finish();
      recorder.current = null;
      setRecording(null);
      exampleRun.current = exampleMode;
      const made = await practiceGenerateFn({ data: { type: next, example: exampleMode } });
      setPuzzle(made.puzzle as PuzzleData);
      // The best under the stamps this puzzle was actually dealt with.
      setDeviceBest(readPracticeBest(next, stampSignature(made.puzzle as PuzzleData)));
      setSealed(made.sealed);
      setStartedAt(Date.now());
      setStage("intro");
    },
    [exampleMode],
  );

  // A Warm up tile (?game=): start that game once, then drop the parameter so Back and a reload show the list.
  const openedFromSearch = useRef(false);
  useEffect(() => {
    const wanted = search.game;
    if (openedFromSearch.current || !wanted || !(wanted in PUZZLE_REGISTRY)) return;
    openedFromSearch.current = true;
    void load(wanted as PuzzleType);
    void navigate({
      to: "/practice",
      search: {},
      replace: true,
      state: (prev: unknown) => prev as never,
    });
  }, [search.game, load, navigate]);

  const cancelIntro = useCallback(() => {
    introCancelled.current = true;
    grading.current = true;
    draftAnswer.current = "";
    clearStageState(stateKey);
    setPuzzle(null);
    setType(null);
    setSealed("");
    setGraded(null);
    setRevealAt(null);
    setStartedAt(0);
    setHelpOpen(false);
    setStage("list");
  }, [stateKey]);

  const prepMs = puzzlePrepMs(puzzle ?? undefined);
  const durationMs = puzzleDurationMs(puzzle ?? undefined);
  const clockStart = stage === "puzzle" ? startedAt + prepMs : null;
  const timeLimitMs = puzzleTimeLimitMs(puzzle ?? undefined);
  // The shared signature beat, once this run's graded verdict lands.
  const signatureVerdict = useMemo(() => (graded ? practiceVerdict(graded) : null), [graded]);
  useSignatureVerdict(graded ? stateKey : null, signatureVerdict);
  const clockDeadline = clockStart === null ? null : clockStart + timeLimitMs;
  const msRemaining = clockDeadline === null ? timeLimitMs : Math.max(0, clockDeadline - now);
  const runMs = stage === "puzzle" ? puzzleRunMs(puzzle ?? undefined) : null;

  const grade = useCallback(
    async (answer: string, meta?: SubmitMeta) => {
      if (!puzzle || grading.current) return;
      grading.current = true;
      noteSignatureSubmit(puzzle.type);
      setEndedKey(stateKey);
      stopWarning10();
      stopRecording();
      // Dev Orbit jump runs are never graded, stored or offered as demos.
      if (puzzle.type === "orbit" && orbitDevPlanet() !== null) {
        setRecording(null);
        clearStageState(stateKey);
        setPuzzle(null);
        setType(null);
        setGraded(null);
        setStage("list");
        return;
      }
      playLock();
      buzz(15);
      const remaining =
        clockDeadline === null ? timeLimitMs : Math.max(0, clockDeadline - Date.now());
      const wasExample = exampleRun.current;
      const result = await practiceGradeFn({
        data: {
          puzzle,
          sealed,
          answer,
          msRemaining: remaining,
          clientVersion: APP_BUILD_ID,
          extra: {
            reactionAvgMs: meta?.reactionAvgMs,
            correctCount: meta?.correctCount,
            errors: meta?.errors,
          },
        },
      });
      const { extraJson, ...rest } = result as typeof result & { extraJson?: string | null };
      let extra: Record<string, unknown> | null = null;
      try {
        extra = extraJson ? (JSON.parse(extraJson) as Record<string, unknown>) : null;
      } catch {
        extra = null;
      }
      setGraded({ ...(rest as Graded), extra });
      if (!wasExample) {
        const record = recordPracticeBest(puzzle.type, stampSignature(puzzle), result.score);
        setDeviceBest(record.best);
        setNewBest(record.improved);
      }
      // When the beat fires (a solve, a 120+ run) the board stays until it has finished
      // (at most 2 s from the solve; a tap skips the wait); otherwise the reveal is at once.
      const holdUntil = signatureHoldUntil(practiceVerdict({ ...(rest as Graded), extra }));
      if (holdUntil !== null) {
        setRevealAt(holdUntil);
        return;
      }
      setStartedAt(Date.now());
      setStage("reveal");
    },
    [puzzle, sealed, clockDeadline, timeLimitMs, stopRecording, stateKey],
  );

  const holding = stage === "puzzle" && revealAt !== null;
  const showReveal = useCallback(() => {
    setRevealAt(null);
    setStartedAt(Date.now());
    setStage("reveal");
  }, []);
  useEffect(() => {
    if (!holding || revealAt === null) return;
    const timer = window.setTimeout(showReveal, Math.max(0, revealAt - Date.now()));
    // A tap anywhere goes to the reveal at once.
    const skip = () => showReveal();
    document.addEventListener("pointerdown", skip, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", skip, true);
    };
  }, [holding, revealAt, showReveal]);

  // Round music: the one owner is this practice round state (useRoundMusic).
  // It starts as the 3-2-1 begins (or at the game, when Ready skipped it) and
  // stops only at time up, an early end, the reveal, Back or leaving practice.
  const countdownBegun = stage === "intro" && now - startedAt >= INTRO_MS - INTRO_COUNTDOWN_MS;
  const musicRemaining =
    stage === "puzzle"
      ? roundMusicRemaining(msRemaining, runMs, clockStart, now, arcadeMsRemaining)
      : null;
  const roundEnded = endedKey === stateKey;
  useRoundMusic(
    {
      key: stateKey,
      track: type ? roundMusicFor(type, puzzleDef(type).category) : null,
      on: countdownBegun || (stage === "puzzle" && !roundEnded && (musicRemaining ?? 1) > 0),
      remainingMs: musicRemaining,
      reason:
        stage === "puzzle"
          ? roundEnded
            ? "early-end"
            : "timer"
          : stage === "reveal"
            ? "reveal"
            : "practice-back",
    },
    "left-practice",
  );

  // The intro runs for exactly as long as it does in a room.
  useEffect(() => {
    if (stage !== "intro" || introCancelled.current) return;
    if (now - startedAt < INTRO_MS) return;
    setStartedAt(Date.now());
    setStage("puzzle");
  }, [stage, now, startedAt]);

  // Out of time: grade an empty answer, exactly as a room does.
  useEffect(() => {
    if (stage !== "puzzle" || !puzzle) return;
    if (now - startedAt <= durationMs) return;
    void grade(draftAnswer.current);
  }, [stage, now, startedAt, durationMs, puzzle, grade]);

  // Practice's reveal stays until Play again or Back (27 Oct 2026): no separate result page.

  if (stage === "list") {
    const visible = (key: PuzzleType) => matchesFilter(key, filter, query);
    const groups = puzzleCategories()
      .map((category) => ({ category, rows: typesInCategory(category).filter(visible) }))
      .filter((group) => group.rows.length > 0);
    const matches = groups.flatMap((group) => group.rows);
    const previewRows = PREVIEW_PUZZLE_TYPES.filter(visible);
    const retiredRows = RETIRED_PUZZLE_TYPES.filter(
      (key) => !PREVIEW_PUZZLE_TYPES.includes(key),
    ).filter(visible);
    // One row per game: a tap opens its round. The best sits in one fixed-width BEST column.
    const row = (key: PuzzleType, retired = false) => (
      <button
        key={key}
        type="button"
        onClick={() => void load(key)}
        aria-label={PUZZLE_REGISTRY[key].name}
        aria-describedby={cardBestId(key)}
        data-practice-game={key}
        data-icon="game"
        className={`ap-row press${retired ? " opacity-80" : ""}`}
      >
        <GameIcon type={key} size={44} />
        <span data-ellipsis aria-hidden="true" className="ap-row-title min-w-0 flex-1">
          {PUZZLE_REGISTRY[key].name}
        </span>
        <RowBest type={key} />
      </button>
    );
    // A heading over a list: the category's dot, its name and count, and the BEST label over the column.
    const listHead = (title: string, count: number, dot?: PuzzleCategory) => (
      <div className="ap-col-head">
        {dot ? <span aria-hidden="true" data-dot={dot} data-size="10" className="ap-dot" /> : null}
        <h2 className="ap-section-title">{title}</h2>
        <span className="ap-meta">
          {count} {count === 1 ? "game" : "games"}
        </span>
        <span aria-hidden="true" className="ap-col-label">
          BEST
        </span>
      </div>
    );
    // Recently played (practiceRecent.ts), with All and no search: up to four, each with its best.
    const recentRows = filter === "all" && query.trim() === "" ? recentPracticeTypes().filter(isLiveType).slice(0, 4) : [];
    return (
      <PhoneShell tabs="practice">
        <div className="ap-stack">
          <div>
            <div className="flex items-baseline justify-between gap-2.5">
              <h1 className="ap-title">Practice</h1>
              <span className="ap-meta text-[14px]">{ACTIVE_GAME_COUNT} games</span>
            </div>
            <DevKeyStatus status={demoStatus} />
          </div>

          {demoKey ? (
            <label className="ap-panel ap-row">
              <span className="ap-row-text">
                <span className="ap-row-title">Intro examples</span>
                <span className="ap-row-sub whitespace-normal">
                  Each game loads its fixed intro example, for recording demos.
                </span>
              </span>
              <input
                type="checkbox"
                role="switch"
                checked={exampleMode}
                onChange={(e) => setExampleMode(e.target.checked)}
                className="h-5 w-5 shrink-0 accent-[var(--primary)]"
              />
            </label>
          ) : null}

          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--ap-faint)]"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games"
                aria-label="Search games"
                autoComplete="off"
                spellCheck={false}
                className="ap-input ap-search"
              />
            </div>
            {/* All games and the seven categories in a 4 × 2 grid: none is cut off at 375 px. */}
            <div role="group" aria-label="Category" className="ap-chip-grid">
              {(["all", ...puzzleCategories()] as const).map((chip) => {
                const on = filter === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    aria-pressed={on}
                    data-practice-filter={chip}
                    onClick={() => setFilter(chip)}
                    className="ap-chip th-hit press"
                  >
                    {chip === "all" ? null : <span aria-hidden="true" data-dot={chip} className="ap-dot" />}
                    {chip === "all" ? "All games" : categoryLabel(chip)}
                  </button>
                );
              })}
            </div>
          </div>

          {recentRows.length > 0 ? (
            <section aria-label="Recently played" data-practice-recent-list className="ap-section">
              <h2 className="ap-section-title">Recently played</h2>
              <div className="ap-panel ap-game-strip">
                {recentRows.map((key) => {
                  const best = readPracticeBest(key, currentPracticeStamp(key));
                  return (
                    <button
                      key={key}
                      type="button"
                      data-practice-recent={key}
                      aria-label={`${PUZZLE_REGISTRY[key].name}, recently played`}
                      onClick={() => void load(key)}
                      className="press"
                    >
                      <GameIcon type={key} size={52} />
                      <span aria-hidden="true" className="ap-strip-name">
                        {PUZZLE_REGISTRY[key].name}
                      </span>
                      <span aria-hidden="true" data-none={best === null || undefined} className="ap-strip-best">
                        {best ?? "–"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {groups.map(({ category, rows }) => (
            <section key={category} aria-label={categoryLabel(category)} data-practice-group={category} className="ap-section">
              {listHead(categoryLabel(category), rows.length, category)}
              <div className="ap-panel">{rows.map((key) => row(key))}</div>
            </section>
          ))}
          {matches.length === 0 && previewRows.length === 0 && retiredRows.length === 0 ? (
            <p className="ap-panel ap-empty">No games match</p>
          ) : null}

          {previewRows.length > 0 && (
            <section aria-label="Practice only" className="ap-section">
              {listHead("New · practice only", previewRows.length)}
              <div className="ap-panel">{previewRows.map((key) => row(key))}</div>
            </section>
          )}

          {retiredRows.length > 0 && (
            <details className="flex flex-col gap-2.5" open={query.trim() !== "" || undefined}>
              <summary className="ap-section-title th-hit press cursor-pointer">
                Retired ({retiredRows.length})
              </summary>
              <div className="ap-panel mt-2.5">{retiredRows.map((key) => row(key, true))}</div>
            </details>
          )}

          <p className="ap-faint text-center text-[13px]">Personal bests stay on this device.</p>
        </div>
      </PhoneShell>
    );
  }

  if (stage === "loading" || !puzzle || !type) {
    return (
      <PhoneShell>
        <div className="flex flex-1 items-center justify-center">
          <WaitingLine label="Making a puzzle" />
        </div>
      </PhoneShell>
    );
  }

  if (stage === "intro") {
    return (
      // The intro draws the game frame's header itself (RoundIntro, Polish batch R).
      <PhoneShell gameType={type} bare>
        <RoundIntro
          round={1}
          type={type}
          startedAt={startedAt}
          now={now}
          outcomes={[]}
          practice
          deviceBest={deviceBest}
          onBack={cancelIntro}
          puzzle={puzzle}
          onReady={() => {
            if (introCancelled.current) return;
            playLock();
            setStartedAt(Date.now());
            setStage("puzzle");
          }}
        />
      </PhoneShell>
    );
  }

  if (stage === "reveal" && graded) {
    return (
      <PhoneShell constrained gameScreen gameType={type}>
        <AnswerReveal
          round={1}
          practice
          puzzle={graded.puzzle}
          answersReady
          myAnswer={graded.answer || null}
          myCorrect={graded.isCorrect}
          myReactionAvgMs={graded.reactionAvgMs}
          myMsRemaining={graded.msRemaining}
          myScore={graded.score}
          myExtra={graded.extra ?? null}
          personalBest={newBest}
          startedAt={startedAt}
          now={now}
          onPlayAgain={() => void load(type)}
          onBack={() => setStage("list")}
        />
        <SaveDemoButton
          demoKey={demoKey}
          puzzle={graded.puzzle}
          sealed={sealed}
          answer={graded.answer}
          recording={recording}
        />
      </PhoneShell>
    );
  }

  const StageComponent = puzzleDef(puzzle.type).Stage;
  const clockActive = clockStart !== null && now >= clockStart;
  return (
    <PhoneShell constrained gameScreen play gameType={type}>
      <GameLayout
        label="Practice"
        title={puzzleName(puzzle.type)}
        help={<PuzzleHelpButton onClick={() => setHelpOpen(true)} />}
        // Practice has no live score: the block shows this device's best under today's stamps.
        score={<FrameScore label="Best" value={deviceBest} />}
        timer={
          puzzleShowsTimer(puzzle) ? (
            <TimerBar
              msRemaining={holding ? 0 : runMs !== null ? arcadeMsRemaining(runMs) : msRemaining}
              totalMs={runMs ?? timeLimitMs}
              active={clockActive && !holding}
            />
          ) : undefined
        }
        beforeGame={
          puzzle.type === "balance" ? (
            <div id={`balance-progress-${stateKey}`} className="h-3 w-full shrink-0" />
          ) : undefined
        }
        stageRef={recordArea}
        locked={holding}
        held={holding}
        overlay={
          <PuzzleHelp type={puzzle.type} open={helpOpen} onClose={() => setHelpOpen(false)} />
        }
      >
        <SteadyOrPlain
          Stage={StageComponent}
          steady={isArcadeScreenType(puzzle.type)}
          key={stateKey}
          stateKey={stateKey}
          puzzle={puzzle}
          phaseStartedAt={startedAt}
          now={now}
          locked={false}
          onSubmit={(answer, meta) => void grade(answer, meta)}
          onDraftAnswer={(answer) => {
            draftAnswer.current = answer;
          }}
          checkWord={async (word, found, path) => {
            const verdict = await practiceCheckWordFn({
              data: { puzzle, word, found, path: path ?? [], sealed },
            });
            recorder.current?.verdict(verdict);
            return verdict;
          }}
          checkMoves={async (moves) =>
            (await practiceCheckMovesFn({ data: { puzzle, sealed, moves } })) as MovesView | null
          }
        />
      </GameLayout>
    </PhoneShell>
  );
}
