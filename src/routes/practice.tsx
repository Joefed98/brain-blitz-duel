import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { WaitingLine } from "@/components/duel/Dots";
import { GameLayout, PhoneShell, isArcadeScreenType } from "@/components/duel/PhoneShell";
import { SteadyOrPlain } from "@/components/duel/SteadyStage";
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
  puzzleCategories,
  puzzleDef,
  puzzleDurationMs,
  puzzleName,
  puzzlePrepMs,
  puzzleRevealMs,
  puzzleShowsTimer,
  puzzleTimeLimitMs,
  puzzleRunMs,
  typesInCategory,
} from "@/lib/duel/registry";
import { clearStageState } from "@/lib/duel/stageState";
import { DemoRecorder, type PuzzleDemoLog } from "@/lib/duel/puzzleDemo";
import { hasIntroDemo } from "@/components/duel/IntroDemo";
import { INTRO_COUNTDOWN_MS, INTRO_MS, type PuzzleData, type PuzzleType } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import {
  playCorrect,
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
import { notePracticePlayed } from "@/lib/duel/practiceRecent";
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

type Stage = "list" | "loading" | "intro" | "puzzle" | "reveal" | "result";

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
 * A practice card's best under the game's current stamps ("Best 132"); nothing before a first run.
 * Kept out of the card's accessible name (aria-hidden; the button points at it with
 * aria-describedby), so the button is always named exactly the game, before and after a best.
 */
function CardBest({ type }: { type: PuzzleType }) {
  const best = readPracticeBest(type, currentPracticeStamp(type));
  if (best === null) return null;
  return (
    <span
      id={cardBestId(type)}
      aria-hidden="true"
      data-card-best={best}
      className="shrink-0 font-mono text-xs font-normal tabular-nums text-muted-foreground"
    >
      Best {best}
    </span>
  );
}

/** The id the card's button describes itself by (its best, when there is one). */
function cardBestId(type: PuzzleType): string {
  return `practice-best-${type}`;
}

/** "Word", "Arcade"… */
function categoryLabel(category: PuzzleCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

type PracticeFilter = PuzzleCategory | "all";

/** The list's chips and search: the game's name or category, any case. */
function matchesFilter(type: PuzzleType, filter: PracticeFilter, query: string): boolean {
  const definition = PUZZLE_REGISTRY[type];
  if (filter !== "all" && definition.category !== filter) return false;
  const q = query.trim().toLowerCase();
  return q === "" || definition.name.toLowerCase().includes(q) || definition.category.includes(q);
}

const GAME_ROW =
  "press flex min-h-[60px] w-full items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2 text-left font-display text-sm font-semibold text-foreground";

/**
 * A practice row's icon, name and category line ("Arcade · Not played yet" before a first run).
 * Only the name is in the button's accessible name: the icon and the line are aria-hidden, the
 * best is the button's description (CardBest).
 */
function GameRowLabel({ type }: { type: PuzzleType }) {
  const definition = PUZZLE_REGISTRY[type];
  const played = readPracticeBest(type, currentPracticeStamp(type)) !== null;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <GameIcon type={type} size={44} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="min-w-0 truncate">{definition.name}</span>
        <span
          aria-hidden="true"
          className="truncate font-sans text-xs font-normal text-muted-foreground"
        >
          {categoryLabel(definition.category)}
          {played ? "" : " · Not played yet"}
        </span>
      </span>
    </span>
  );
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
          : stage === "reveal" || stage === "result"
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

  useEffect(() => {
    if (stage !== "reveal") return;
    if (now - startedAt < puzzleRevealMs(puzzle ?? undefined)) return;
    setStage("result");
  }, [stage, now, startedAt, puzzle]);

  // The practice card takes the place of the podium fanfare.
  const resultCued = useRef(0);
  useEffect(() => {
    if (stage !== "result" || resultCued.current === run) return;
    resultCued.current = run;
    playCorrect();
  }, [stage, run]);
  useEffect(() => {
    if (stage !== "result" || !newBest) return;
    const timer = setTimeout(() => setNewBest(false), 1600);
    return () => clearTimeout(timer);
  }, [stage, newBest]);

  if (stage === "list") {
    const visible = (key: PuzzleType) => matchesFilter(key, filter, query);
    const activeRows = puzzleCategories()
      .flatMap((category) => typesInCategory(category))
      .filter(visible);
    const previewRows = PREVIEW_PUZZLE_TYPES.filter(visible);
    const retiredRows = RETIRED_PUZZLE_TYPES.filter(
      (key) => !PREVIEW_PUZZLE_TYPES.includes(key),
    ).filter(visible);
    return (
      <PhoneShell tabs="practice">
        <div className="flex flex-1 flex-col gap-5">
          <div>
            <h1 className="font-display text-2xl font-bold">Practice</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              One game at a time. Personal bests stay on this device.
            </p>
            <DevKeyStatus status={demoStatus} />
          </div>

          {demoKey ? (
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
              <span className="flex flex-col">
                <span className="font-display text-sm font-semibold text-foreground">
                  Intro examples
                </span>
                <span className="text-xs text-muted-foreground">
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
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search games"
                aria-label="Search games"
                autoComplete="off"
                spellCheck={false}
                className="tap-target w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div role="group" aria-label="Category" className="-mx-1 flex flex-wrap gap-1.5 px-1">
              {(["all", ...puzzleCategories()] as const).map((chip) => {
                const on = filter === chip;
                return (
                  <button
                    key={chip}
                    type="button"
                    aria-pressed={on}
                    data-practice-filter={chip}
                    onClick={() => setFilter(chip)}
                    className={`press h-9 rounded-full border px-3.5 font-display text-xs font-semibold uppercase tracking-wide ${
                      on
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {chip === "all" ? "All" : categoryLabel(chip)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {activeRows.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => void load(key)}
                aria-describedby={cardBestId(key)}
                data-practice-game={key}
                className={GAME_ROW}
              >
                <GameRowLabel type={key} />
                <CardBest type={key} />
              </button>
            ))}
            {activeRows.length === 0 && previewRows.length === 0 && retiredRows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                No games match.
              </p>
            ) : null}
          </div>

          {previewRows.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                New · practice only
              </p>
              <div className="flex flex-col gap-2">
                {previewRows.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void load(key)}
                    aria-describedby={cardBestId(key)}
                    data-practice-game={key}
                    className={GAME_ROW}
                  >
                    <GameRowLabel type={key} />
                    <CardBest type={key} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {retiredRows.length > 0 && (
            <details className="flex flex-col gap-2" open={query.trim() !== "" || undefined}>
              <summary className="press cursor-pointer font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Retired ({retiredRows.length})
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {retiredRows.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => void load(key)}
                    aria-describedby={cardBestId(key)}
                    data-practice-game={key}
                    className={`${GAME_ROW} opacity-80`}
                  >
                    <GameRowLabel type={key} />
                    <CardBest type={key} />
                  </button>
                ))}
              </div>
            </details>
          )}
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
      <PhoneShell gameType={type}>
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

  if (stage === "result" && graded) {
    const secondsUsed = Math.max(0, Math.round((timeLimitMs - graded.msRemaining) / 100) / 10);
    return (
      <PhoneShell gameType={type}>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center animate-phase-in">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {puzzleName(type)}
          </p>
          <p className="font-mono text-6xl font-bold text-primary animate-pop-in">{graded.score}</p>
          <div className="flex h-12 shrink-0 flex-col items-center gap-1" aria-live="polite">
            <p className="font-mono text-sm text-muted-foreground">
              Best: {deviceBest ?? "—"} · this device
            </p>
            {newBest ? (
              <p className="font-display text-sm font-bold text-primary practice-new-best">
                New best!
              </p>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {graded.isCorrect ? "Correct" : graded.score > 0 ? "Partly solved" : "Not quite"} ·{" "}
            {graded.reactionAvgMs !== null
              ? `${graded.reactionAvgMs}ms average`
              : `${secondsUsed}s`}
          </p>

          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={() => void load(type)}
              className="press tap-target w-full rounded-xl bg-primary px-6 font-display text-base font-bold uppercase tracking-wide text-primary-foreground"
            >
              Play again
            </button>
            <button
              type="button"
              onClick={() => setStage("list")}
              className="press tap-target w-full rounded-xl border border-border bg-card font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Back
            </button>
          </div>
        </div>
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
        label="PRACTICE"
        title={puzzleName(puzzle.type)}
        help={<PuzzleHelpButton onClick={() => setHelpOpen(true)} />}
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
