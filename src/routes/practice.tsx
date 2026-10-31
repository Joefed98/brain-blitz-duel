import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CloudOff, Search } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

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
import { ARCADE_GROUPS, arcadeGroupInfo, arcadeGroupOf, arcadeGroupTypes, type ArcadeGroup } from "@/lib/duel/arcadeGroups";
import {
  practiceSideCounts,
  practiceSideOf,
  readPracticeSide,
  rememberPracticeSide,
  type PracticeSide,
} from "@/lib/duel/practiceSide";

import { OfflineInstallCard } from "@/components/offline/OfflineInstallCard";
import { OfflineRunResult } from "@/components/offline/OfflineRunResult";
import { OfflineRuns } from "@/components/offline/OfflineRuns";
import { PendingClock } from "@/components/offline/PendingClock";
import { useOfflinePractice } from "@/components/offline/useOfflinePractice";
import { isOnline, useOnline } from "@/lib/offline/online";
import { ONLINE_ONLY_TYPES } from "@/lib/offline/offlineStatus";
import { takePackDeal } from "@/lib/offline/packs";
import { flushQueue, queueRun } from "@/lib/offline/queue";

/** How long a live deal may take before practice falls back to a saved pack deal (a weak signal underground). */
const LIVE_DEAL_TIMEOUT_MS = 10_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("timeout")), ms);
    work.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

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

type Stage = "list" | "loading" | "intro" | "puzzle" | "reveal" | "offline";

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
/** Offline practice: the games with a run waiting for the server (their rows' best carries the clock). */
const PendingTypes = createContext<ReadonlySet<PuzzleType>>(new Set());

function RowBest({ type }: { type: PuzzleType }) {
  const best = readPracticeBest(type, currentPracticeStamp(type));
  const pending = useContext(PendingTypes).has(type);
  return (
    <span
      id={cardBestId(type)}
      aria-hidden="true"
      data-card-best={best ?? undefined}
      data-none={best === null || undefined}
      data-pending={pending || undefined}
      className="ap-best"
    >
      {/* Offline practice: a run of this game is waiting for the server (the best may still change). */}
      {pending ? <PendingClock /> : null}
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
type ArcadeFilter = ArcadeGroup | "all";

/** The switch's counts (practiceSide.ts, from the registry: the active games on each side). */
const SIDE_COUNTS = practiceSideCounts();

/** The Arcade side's chips: three across, Cards & Board over two columns (no sideways scrolling). */
const ARCADE_CHIPS: { id: ArcadeFilter; label: string; span?: 2 }[] = [
  { id: "all", label: "All games" },
  { id: "retro", label: arcadeGroupInfo("retro").label },
  { id: "sports", label: arcadeGroupInfo("sports").label },
  { id: "cards", label: arcadeGroupInfo("cards").label, span: 2 },
  { id: "action", label: arcadeGroupInfo("action").label },
];

/**
 * The list's chips and search, scoped to the side shown: the game's name or category (on the Arcade
 * side also its group), any case. A game on the other side never matches.
 */
function matchesFilter(type: PuzzleType, side: PracticeSide, filter: PracticeFilter | ArcadeFilter, query: string): boolean {
  if (practiceSideOf(type) !== side) return false;
  const definition = PUZZLE_REGISTRY[type];
  const group = arcadeGroupOf(type);
  if (filter !== "all") {
    if (side === "puzzles" && definition.category !== filter) return false;
    if (side === "arcade" && group !== filter) return false;
  }
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  if (definition.name.toLowerCase().includes(q) || definition.category.includes(q)) return true;
  return group !== null && arcadeGroupInfo(group).label.toLowerCase().includes(q);
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
  const [side, setSideState] = useState<PracticeSide>(readPracticeSide);
  const [puzzleFilter, setPuzzleFilter] = useState<PracticeFilter>("all");
  const [arcadeFilter, setArcadeFilter] = useState<ArcadeFilter>("all");
  const [query, setQuery] = useState("");
  // The switch: remembered on this device; the search starts empty on the other side.
  const setSide = useCallback((next: PracticeSide) => {
    rememberPracticeSide(next);
    setSideState((was) => {
      if (was !== next) setQuery("");
      return next;
    });
  }, []);
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
  // Offline practice (31 Oct 2026): the pack seed of a run dealt from a saved pack (null: a live deal), the
  // run waiting for the server whose result is on screen, and a line for a game that can't be played now.
  const packSeed = useRef<number | null>(null);
  const [offlineRunId, setOfflineRunId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const online = useOnline();
  const offlineStore = useOfflinePractice();
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
      setNotice(null);
      setOfflineRunId(null);
      packSeed.current = null;
      // A live deal when there is a connection; else (or when it doesn't come) a deal from the game's saved pack.
      // A slow live deal with no saved deal to fall back on is still waited for: only a failed request (or no
      // connection) ends in the "not saved" notice.
      type Made = { puzzle: unknown; sealed: string };
      let made: Made | null = null;
      let live: Promise<Made | null> | null = null;
      let slow = false;
      if (isOnline() || exampleMode) {
        live = practiceGenerateFn({ data: { type: next, example: exampleMode } }).then(
          (m) => m as Made,
          () => null,
        );
        try {
          made = await withTimeout(live, LIVE_DEAL_TIMEOUT_MS);
        } catch {
          slow = true;
        }
      }
      if (!made && !exampleMode) {
        const deal = await takePackDeal(next);
        if (deal) {
          made = { puzzle: deal.puzzle, sealed: deal.sealed };
          packSeed.current = deal.id;
        }
      }
      if (!made && slow && live) made = await live;
      if (!made) {
        const name = PUZZLE_REGISTRY[next].name;
        setNotice(ONLINE_ONLY_TYPES.has(next) ? `${name} is online only.` : `No ${name} games are saved for offline play yet.`);
        setType(null);
        setStage("list");
        return;
      }
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
      // Offline practice: a pack deal (or any run with no connection) is queued on the phone and graded by the
      // server when there is one; the result screen waits on it. A live deal whose answer can't be sent too.
      const queueThisRun = async () => {
        const run = await queueRun({
          type: puzzle.type,
          packSeed: packSeed.current,
          puzzle,
          sealed,
          answer,
          msRemaining: remaining,
          extra: { reactionAvgMs: meta?.reactionAvgMs, correctCount: meta?.correctCount, errors: meta?.errors },
          playedAt: Date.now(),
          arcade: isArcadeScreenType(puzzle.type),
        });
        clearStageState(stateKey);
        setOfflineRunId(run.id);
        setStage("offline");
        void flushQueue();
      };
      if (!wasExample && (packSeed.current !== null || !isOnline())) {
        await queueThisRun();
        return;
      }
      let result: Awaited<ReturnType<typeof practiceGradeFn>>;
      try {
        result = await practiceGradeFn({
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
      } catch (error) {
        if (wasExample) throw error;
        await queueThisRun();
        return;
      }
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
    const filter = side === "puzzles" ? puzzleFilter : arcadeFilter;
    const visible = (key: PuzzleType) => matchesFilter(key, side, filter, query);
    // Puzzles: one section per category (Arcade is the other side). Arcade: one section per group.
    const groups: { id: string; label: string; dot: string; rows: PuzzleType[] }[] =
      side === "puzzles"
        ? puzzleCategories()
            .filter((category) => category !== "arcade")
            .map((category) => ({ id: category, label: categoryLabel(category), dot: category, rows: typesInCategory(category).filter(visible) }))
        : ARCADE_GROUPS.map((group) => ({ id: group.id, label: group.label, dot: group.id, rows: arcadeGroupTypes(group.id).filter(visible) }));
    const shown = groups.filter((group) => group.rows.length > 0);
    const matches = shown.flatMap((group) => group.rows);
    const previewRows = PREVIEW_PUZZLE_TYPES.filter(visible);
    const retiredRows = RETIRED_PUZZLE_TYPES.filter(
      (key) => !PREVIEW_PUZZLE_TYPES.includes(key),
    ).filter(visible);
    // Offline practice: which games wait on the server, and (with no connection) which can't be played now.
    const pendingTypes = new Set(offlineStore.runs.filter((r) => r.status === "queued").map((r) => r.type));
    const offlineMark = (key: PuzzleType) => {
      if (online || !offlineStore.loaded) return null;
      if (ONLINE_ONLY_TYPES.has(key))
        return (
          <span data-online-only className="of-mark">
            <CloudOff aria-hidden="true" />
            Online only
          </span>
        );
      if ((offlineStore.counts[key] ?? 0) === 0)
        return (
          <span data-none-saved className="of-mark">
            <CloudOff aria-hidden="true" />
            None saved
          </span>
        );
      return null;
    };
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
        {offlineMark(key)}
        <RowBest type={key} />
      </button>
    );
    // A heading over a list: the category's (or group's) dot, its name and count, and the BEST label over the column.
    const listHead = (title: string, count: number, dot?: string) => (
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
    // Recently played (practiceRecent.ts), with All and no search: up to four of this side's games, each with its best.
    const recentRows =
      filter === "all" && query.trim() === ""
        ? recentPracticeTypes()
            .filter(isLiveType)
            .filter((key) => practiceSideOf(key) === side)
            .slice(0, 4)
        : [];
    const searchLabel = side === "puzzles" ? "Search puzzles" : "Search arcade games";
    // A chosen group with no games yet (Cards & Board until its games are registered).
    const emptyGroup =
      side === "arcade" && arcadeFilter !== "all" && query.trim() === "" && matches.length === 0 ? arcadeGroupInfo(arcadeFilter) : null;
    return (
      <PhoneShell tabs="practice">
        <PendingTypes.Provider value={pendingTypes}>
          <div className="ap-stack">
            <div className="flex flex-col gap-3">
              <h1 className="ap-title">Practice</h1>
              <DevKeyStatus status={demoStatus} />
              {/* Puzzles | Arcade: one tab, two sides; the counts are the registry's active games. */}
              <div role="group" aria-label="Game type" data-practice-switch={side} className="ap-switch">
                {(["puzzles", "arcade"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={side === option}
                    data-practice-side={option}
                    data-count={SIDE_COUNTS[option]}
                    onClick={() => setSide(option)}
                    className="ap-switch-opt press"
                  >
                    {option === "puzzles" ? "Puzzles" : "Arcade"}{" "}
                    <span className="ap-switch-count">{SIDE_COUNTS[option]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Offline practice: Add to Home Screen (iPhone Safari only, shown from <html data-offline-install>). */}
            <OfflineInstallCard />
            {notice ? (
              <p role="status" data-practice-notice className="ap-panel ap-empty">
                {notice}
              </p>
            ) : null}

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
                  placeholder={searchLabel}
                  aria-label={searchLabel}
                  autoComplete="off"
                  spellCheck={false}
                  className="ap-input ap-search"
                />
              </div>
              {side === "puzzles" ? (
                // All games and the six puzzle categories in the 4-column grid: none is cut off at 375 px.
                <div role="group" aria-label="Category" className="ap-chip-grid">
                  {(["all", ...puzzleCategories().filter((category) => category !== "arcade")] as const).map((chip) => {
                    const on = puzzleFilter === chip;
                    return (
                      <button
                        key={chip}
                        type="button"
                        aria-pressed={on}
                        data-practice-filter={chip}
                        onClick={() => setPuzzleFilter(chip)}
                        className="ap-chip th-hit press"
                      >
                        {chip === "all" ? null : <span aria-hidden="true" data-dot={chip} className="ap-dot" />}
                        {chip === "all" ? "All games" : categoryLabel(chip)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div role="group" aria-label="Arcade group" data-cols="3" className="ap-chip-grid">
                  {ARCADE_CHIPS.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      aria-pressed={arcadeFilter === chip.id}
                      data-practice-filter={chip.id}
                      data-span={chip.span}
                      onClick={() => setArcadeFilter(chip.id)}
                      className="ap-chip th-hit press"
                    >
                      {chip.id === "all" ? null : <span aria-hidden="true" data-dot={chip.id} className="ap-dot" />}
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
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

            <OfflineRuns runs={offlineStore.runs} now={Date.now()} />

            {shown.map(({ id, label, dot, rows }) => (
              <section key={id} aria-label={label} data-practice-group={id} className="ap-section">
                {listHead(label, rows.length, dot)}
                <div className="ap-panel">{rows.map((key) => row(key))}</div>
              </section>
            ))}
            {emptyGroup ? (
              <p data-practice-empty-group={emptyGroup.id} className="ap-panel ap-empty">
                {emptyGroup.label} games are coming soon
              </p>
            ) : matches.length === 0 && previewRows.length === 0 && retiredRows.length === 0 ? (
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
        </PendingTypes.Provider>
      </PhoneShell>
    );
  }

  if (stage === "offline" && type) {
    return (
      <PhoneShell skin="room">
        <OfflineRunResult runId={offlineRunId} type={type} onPlayAgain={() => void load(type)} onBack={() => setStage("list")} />
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
