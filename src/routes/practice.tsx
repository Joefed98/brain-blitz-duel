import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { WaitingLine } from "@/components/duel/Dots";
import { Icon } from "@/design/components";
import { CatalogueHeaderTools, GamesCatalogue, tileDescriptionId } from "@/components/games/GamesCatalogue";
import { readGamesView, rememberGamesView, type GamesView } from "@/components/games/gamesView";
import { FirstGameWin } from "@/components/games/FirstGameWin";
import { FIRST_GAME, FIRST_GAME_COACH } from "@/lib/firstOpen";
import { GamePage } from "@/components/games/GamePage";
import { gamePageLink } from "@/lib/nav/gamePage";
import { useMyIdentity } from "@/lib/identity/identityApi";
import { useEarlyAccessHeld } from "@/lib/plus/plusApi";
import { GameLayout, PhoneShell, isArcadeScreenType } from "@/components/duel/PhoneShell";
import { FrameScore } from "@/components/duel/GameFrame";
import { SteadyOrPlain } from "@/components/duel/SteadyStage";
import { GameStage } from "@/components/duel/GameParts";
import { loadGameDef } from "@/lib/duel/gameLoader";
import { useCrashContext } from "@/lib/useCrashContext";
import { useArcadeScreenTickMs } from "@/lib/fx/useArcadeScreenTick";
import { PuzzleHelp } from "@/components/duel/PuzzleInstructions";

import { RoundIntro } from "@/components/duel/RoundIntro";
import { preloadGameData } from "@/lib/duel/gamePreload";
import { TimerBar } from "@/components/duel/TimerBar";
import { arcadeMsRemaining } from "@/lib/arcade/clock";
import {
  practiceCheckWordFn,
  practiceCheckMovesFn,
  practiceGenerateFn,
  practiceGradeFn,
  practiceStartFn,
} from "@/lib/duel/practice.functions";
import { orbitDevPlanet } from "@/lib/arcade/orbitDevJump";
import { practiceUpdateGate, useUpdateGate } from "@/lib/appUpdate";
import { APP_BUILD_ID } from "@/lib/appVersion";
import { DevKeyStatus, SaveDemoButton, useDemoKey } from "@/components/duel/SaveDemoButton";
import {
  PUZZLE_REGISTRY,
  puzzleDef,
  puzzleDurationMs,
  puzzleName,
  puzzlePrepMs,
  puzzleShowsTimer,
  puzzleTimeLimitMs,
  puzzleRunMs,
  isPlayable,
} from "@/lib/duel/catalogue";
import { clearStageState } from "@/lib/duel/stageState";
import { DemoRecorder, type PuzzleDemoLog } from "@/lib/duel/puzzleDemo";
import { hasIntroDemo } from "@/components/duel/IntroDemo";
import { INTRO_COUNTDOWN_MS, INTRO_MS, type PuzzleData, type PuzzleType } from "@/lib/duel/types";
import {
  playLock,
  releaseRoomMusic,
  holdMusicBed,
  screenMusic,
  stopWarning10,
  unlockAudio,
} from "@/lib/sound";
import { roundMusicFor } from "@/lib/fx/theme";
import { roundMusicRemaining, useRoundMusic } from "@/lib/duel/useRoundMusic";
import { useHomeBed, useScreenMusic } from "@/lib/useScreenMusic";
import type { SubmitMeta } from "@/puzzles/types";
import type { MovesView } from "@/lib/duel/moves";
import { recordPracticeGoals } from "@/lib/duel/practiceGoals";
import { SaveProgressOffer } from "@/components/account/SaveProgress";
import { cachedAccount, useAccount } from "@/lib/account/accountApi";
import {
  bestOf,
  practiceRunRecord,
  runStarLine,
  starCountOf,
  type PracticeProgressView,
} from "@/lib/practice/progress";
import { PRACTICE_REFRESH_NOTE, STAR_TOTAL_MAX, levelOf } from "@/lib/practice/progressRules";
import {
  applyPracticeRun,
  notePracticeRefreshSeen,
  practiceProgressNow,
  usePracticeProgress,
} from "@/lib/practice/useProgress";
import { ChallengeMoments } from "@/components/app/PracticeChallenges";
import { queueChallengeMoments, useServerChallenges } from "@/lib/challenges/challengesClient";
import { APP_NAME } from "@/lib/brand";
import { noteSignatureSubmit, signatureHoldUntil } from "@/lib/fx/signature";
import { useSignatureVerdict } from "@/lib/fx/useSignature";
import { notePracticePlayed } from "@/lib/duel/practiceRecent";
import { inputTypeField } from "@/lib/inputType";
import { PageAside } from "@/components/app/PageAside";

import { OfflineInstallCard } from "@/components/offline/OfflineInstallCard";
import { OfflineRunResult } from "@/components/offline/OfflineRunResult";
import { OfflineRuns } from "@/components/offline/OfflineRuns";
import { PendingClock } from "@/components/offline/PendingClock";
import { useOfflinePractice } from "@/components/offline/useOfflinePractice";
import { isOnline, useOnline } from "@/lib/offline/online";
import { ONLINE_ONLY_TYPES } from "@/lib/offline/offlineStatus";
import { syncOffline } from "@/lib/offline/install";
import { notePracticeRoundFinished } from "@/lib/offline/packGrowth";
import { takePackDeal } from "@/lib/offline/packs";
import { playLevel, setGameLevel, useLevelChoice } from "@/lib/levels/levelChoice";
import { LEVEL_LABEL, NORMAL, storedLevelKey, levelOfPuzzle, type Level } from "@/lib/levels/levels";
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
  validateSearch: (search: Record<string, unknown>): { game?: string; q?: string; page?: string; quick?: string; first?: string } => ({
    // ?first=1 with ?game= (the first game on a new phone, lib/firstOpen.ts): Easy, straight into the round, a coach
    // line over the board, then the win screen.
    ...(search["first"] === "1" || search["first"] === 1 ? { first: "1" } : {}),
    ...(typeof search["game"] === "string" ? { game: search["game"] } : {}),
    // ?quick=1 with ?game= (Home's Play, P1): the round's intro opens already in its 3-2-1, as a game page's Play does.
    // (TanStack reads a typed ?quick=1 as the number 1, a navigated one as the string "1".)
    ...(search["quick"] === "1" || search["quick"] === 1 ? { quick: "1" } : {}),
    // ?page=<type>: that game's page (src/lib/nav/gamePage.ts, phase 2 step 3).
    ...(typeof search["page"] === "string" && search["page"] ? { page: search["page"] } : {}),
    // The desktop rail's search (AppRail) opens the list with its words typed.
    ...(typeof search["q"] === "string" && search["q"] ? { q: search["q"] } : {}),
  }),
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


/**
 * The list's last line: an account's stars and bests are saved to it; a guest is offered the save-your-progress
 * sheet (SaveProgressOffer, as Profile's Customise does), since a guest's progress stays with this phone's guest.
 */
function PracticeFooter() {
  const account = useAccount();
  const [offer, setOffer] = useState(false);
  // Before the account is known: the device's cached account (an account's line from the first paint).
  const isAccount = account.kind === "account" || (account.kind === "unknown" && cachedAccount() !== null);
  if (isAccount) return <p className="ap-faint jz-meta text-center">Stars and bests are saved to your account.</p>;
  return (
    <p data-practice-save-progress className="ap-faint jz-meta text-center">
      <button type="button" onClick={() => setOffer(true)} className="ap-link press -my-3 inline-flex h-11 items-center align-middle">
        Save your progress
      </button>{" "}
      to keep your stars on any phone
      {offer ? <SaveProgressOffer onClose={() => setOffer(false)} /> : null}
    </p>
  );
}


/**
 * A tile's description: its stars (the tile is named exactly its game; Joe, 14 Nov 2026: the catalogue shows stars and
 * the best lives on the game's page). Not drawn. `data-card-best` / `data-none` / `data-pending` still carry the
 * account's best and a queued run's clock for the checks that read them.
 */
function TileBest({ type, pending, progress }: { type: PuzzleType; pending: boolean; progress: PracticeProgressView | null }) {
  // The best at the level this player plays the game at (the catalogue's difficulty switch).
  const best = bestOf(progress, type, storedLevelKey(playLevel(type)));
  return (
    <span
      id={tileDescriptionId(type)}
      data-card-best={best ?? undefined}
      data-none={best === null || undefined}
      data-pending={pending || undefined}
      className="sr-only"
    >
      {pending ? <PendingClock /> : null}
      {`${starCountOf(progress, type)} of 3 stars`}
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
  // The catalogue's Shelves · All switch (P2, 22 Nov 2026): remembered on the device, read after the first paint so
  // the server's render and the phone's agree. The level is chosen on each game's page (levelChoice.ts).
  const [gamesView, setGamesView] = useState<GamesView>("shelves");
  useEffect(() => setGamesView(readGamesView()), []);
  const chooseGamesView = useCallback((next: GamesView) => {
    rememberGamesView(next);
    setGamesView(next);
  }, []);
  const levelChoice = useLevelChoice();
  // Wave 2 E2: the player's own tile style on their game tiles, and the games early access holds back (Joulz Plus).
  const myTileStyle = useMyIdentity().loadout?.slots["tile-style"] ?? null;
  const heldBack = useEarlyAccessHeld();
  const railQuery = (Route.useSearch() as { q?: string }).q;
  const [query, setQuery] = useState(() => railQuery ?? "");
  const [searchOpen, setSearchOpen] = useState(() => Boolean(railQuery));
  useEffect(() => {
    if (railQuery === undefined) return;
    setQuery(railQuery);
    setSearchOpen(true);
  }, [railQuery]);
  const toggleSearch = useCallback(() => {
    setSearchOpen((open) => {
      if (open) setQuery("");
      return !open;
    });
  }, []);
  const search = Route.useSearch() as { game?: string; page?: string; quick?: string; first?: string };
  const navigate = useNavigate();
  const router = useRouter();
  // A game's page (?page=<type>, gamePage.ts): shown on the list stage in place of the catalogue. Opening one from the
  // catalogue pushes it (Back returns to the catalogue); the URL's parameter drives it, and this state follows.
  const [pageType, setPageType] = useState<PuzzleType | null>(() => (isPlayable(search.page) ? search.page : null));
  const pushedPage = useRef(false);
  useEffect(() => {
    setPageType(isPlayable(search.page) ? search.page : null);
  }, [search.page]);
  const isAccountNow = useAccount().kind === "account";
  const openPage = useCallback(
    (next: PuzzleType) => {
      unlockAudio();
      setNotice(null);
      setPageType(next);
      pushedPage.current = true;
      void navigate({ ...gamePageLink(next), state: (prev: unknown) => prev as never });
    },
    [navigate],
  );
  const closePage = useCallback(() => {
    setNotice(null);
    setPageType(null);
    const history = (router as { history?: { back?: () => void } }).history;
    if (pushedPage.current && history?.back) {
      pushedPage.current = false;
      history.back();
      return;
    }
    void navigate({ to: "/practice", search: {}, replace: true, state: (prev: unknown) => prev as never });
  }, [navigate, router]);
  // A new version reloads only on the list, never mid-run (lib/appUpdate).
  useUpdateGate(practiceUpdateGate(stage));
  // The first finished round's top-up, once back on the list (after the gate above has opened).
  const firstPacks = useRef(false);
  useEffect(() => {
    if (stage !== "list" || !firstPacks.current) return;
    const timer = window.setTimeout(() => {
      firstPacks.current = false;
      void syncOffline().catch(() => {});
    }, 300);
    return () => window.clearTimeout(timer);
  }, [stage]);
  const [type, setType] = useState<PuzzleType | null>(null);
  // Crash reports name the game on screen (lib/crashReporting.ts); practice has no round number.
  useCrashContext(type, null);
  const [puzzle, setPuzzle] = useState<PuzzleData | null>(null);
  const [sealed, setSealed] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [deviceBest, setDeviceBest] = useState<number | null>(null);
  const [newBest, setNewBest] = useState(false);
  // Practice progress (wave 2 C1a): the account's stars and bests, from the server.
  const progressView = usePracticeProgress();
  // The one-time refresh note: shown once on the list, then remembered on the server.
  const noteShown = useRef(false);
  useEffect(() => {
    if (stage !== "list" || !progressView || progressView.noteSeen || noteShown.current) return;
    noteShown.current = true;
    notePracticeRefreshSeen();
  }, [stage, progressView]);
  /** Practice goals: the star line this run earned ("Silver star earned"), with the new-best moment. */
  const [earnedStar, setEarnedStar] = useState<string | null>(null);
  // Practice challenges (wave 2 C1b): the server's progress, asked again each time the list comes back.
  const serverChallenges = useServerChallenges(stage === "list");
  const [run, setRun] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  // Offline practice (31 Oct 2026): the pack seed of a run dealt from a saved pack (null: a live deal), the
  // run waiting for the server whose result is on screen, and a line for a game that can't be played now.
  const packSeed = useRef<number | null>(null);
  /** The server's start token for this round (practiceReceipt.ts): asked for as the clock starts, sent with the answer. */
  const startToken = useRef<Promise<string | null> | null>(null);
  const beginRound = useCallback(() => {
    // Live deals only: a pack run is queued and graded later on the phone's own clock.
    startToken.current =
      packSeed.current === null && sealed
        ? practiceStartFn({ data: { sealed } }).then(
            (r) => r?.start ?? null,
            () => null,
          )
        : null;
    setStartedAt(Date.now());
    setStage("puzzle");
  }, [sealed]);
  // The first game on a new phone (?first=1): no intro to read, the board at once; the first tap is the game's first tap.
  const firstRun = useRef(false);
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
  // The list holds the app-wide home bed (it carries on from the Play tab); a round's intro takes over from it.
  useHomeBed(stage === "list", screenMusic("music_practice"));
  useScreenMusic("music_reveal", stage === "reveal");

  const load = useCallback(
    /**
     * Deals a round of `next` and opens its intro. `quick` (Play on a game's page, or Play again): the intro opens
     * already in its 3-2-1 (Joe, 14 Nov 2026), since the page has just shown the game's goal and how to play; the
     * intro itself is unchanged. Otherwise (a ?game= link) the full intro, Goal / How / Ready, as before.
     */
    async (next: PuzzleType, quick = false, levelOverride?: Level) => {
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
      // The level this player plays the game at (levelChoice.ts; Normal where the game lacks it; the intro example
      // is always Normal).
      const level = exampleMode ? NORMAL : (levelOverride ?? playLevel(next));
      setDeviceBest(bestOf(practiceProgressNow(), next, storedLevelKey(level)));
      setNewBest(false);
      setEarnedStar(null);
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
      // The game's own code (gameLoader.ts), fetched alongside the deal (the service worker's copy offline), so the
      // intro and the round draw it from their first frame.
      const code = loadGameDef(next).catch(() => null);
      // A live deal when there is a connection; else (or when it doesn't come) a deal from the game's saved pack.
      // A slow live deal with no saved deal to fall back on is still waited for: only a failed request (or no
      // connection) ends in the "not saved" notice.
      type Made = { puzzle: unknown; sealed: string };
      let made: Made | null = null;
      let live: Promise<Made | null> | null = null;
      let slow = false;
      if (isOnline() || exampleMode) {
        live = practiceGenerateFn({ data: { type: next, example: exampleMode, ...(level !== NORMAL ? { level } : {}) } }).then(
          (m) => m as Made,
          () => null,
        );
        try {
          made = await withTimeout(live, LIVE_DEAL_TIMEOUT_MS);
        } catch {
          slow = true;
        }
      }
      // Saved packs hold Normal deals only, so another level needs a connection.
      if (!made && !exampleMode && level === NORMAL) {
        const deal = await takePackDeal(next);
        if (deal) {
          made = { puzzle: deal.puzzle, sealed: deal.sealed };
          packSeed.current = deal.id;
        }
      }
      if (!made && slow && live) made = await live;
      if (!made) {
        const name = PUZZLE_REGISTRY[next].name;
        setNotice(
          ONLINE_ONLY_TYPES.has(next)
            ? `${name} is online only.`
            : level !== NORMAL
              ? `${name} on ${LEVEL_LABEL[level]} needs a connection. Normal games are saved for offline play.`
              : `No ${name} games are saved for offline play yet.`,
        );
        setType(null);
        setStage("list");
        return;
      }
      setPuzzle(made.puzzle as PuzzleData);
      // The account's best on the level this puzzle was dealt on (Classic until wave 3.5).
      setDeviceBest(bestOf(practiceProgressNow(), next, levelOf((made.puzzle as { level?: unknown }).level)));
      setSealed(made.sealed);
      await code;
      setStartedAt(quick ? Date.now() - (INTRO_MS - INTRO_COUNTDOWN_MS) : Date.now());
      setStage("intro");
    },
    [exampleMode],
  );

  // A Warm up tile (?game=): start that game once, then drop the parameter so Back and a reload show the list.
  const openedFromSearch = useRef(false);
  useEffect(() => {
    const wanted = search.game;
    // Only a playable game: a retired one's link opens the list (catalogue.ts isPlayable).
    if (openedFromSearch.current || !wanted || !isPlayable(wanted)) return;
    openedFromSearch.current = true;
    // The first game on a new phone (?first=1): Ascend on Easy, straight into the round (lib/firstOpen.ts).
    if (search.first === "1" && wanted === FIRST_GAME.type) {
      firstRun.current = true;
      void load(wanted as PuzzleType, true, FIRST_GAME.level);
    }
    // Home's Play asks for the quick start (?quick=1): straight into the 3-2-1; any other link shows the full intro.
    else void load(wanted as PuzzleType, search.quick === "1");
    // Back from the round lands on the game's page (gamePage.ts), not straight on the catalogue.
    void navigate({
      to: "/practice",
      search: { page: wanted },
      replace: true,
      state: (prev: unknown) => prev as never,
    });
  }, [search.game, search.quick, search.first, load, navigate]);

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
      // The start token, if it has come (never waited on for long: the grade bounds the claim without it too).
      const start = startToken.current ? await withTimeout(startToken.current, 1_500).catch(() => null) : null;
      startToken.current = null;
      try {
        result = await practiceGradeFn({
          data: {
            puzzle,
            sealed,
            answer,
            msRemaining: remaining,
            ...(start ? { start } : {}),
            clientVersion: APP_BUILD_ID,
            ...inputTypeField(),
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
        // Stars and bests are the server's (the grade's own `progress`, counted on the account); intro examples never count.
        const record = practiceRunRecord(result.progress, deviceBest);
        applyPracticeRun(puzzle.type, result.progress);
        setDeviceBest(record.best);
        setNewBest(record.improved);
        // The device's challenge record (the list reads the server's progress, which wins wherever it has a row).
        recordPracticeGoals(puzzle.type, result.score, extra, record.best);
        setEarnedStar(runStarLine(result.progress));
        // The challenges the server completed on this run: their moment waits for the list (never over the reveal).
        queueChallengeMoments((result as { challenges?: unknown }).challenges);
        // This device's first finished round starts its offline packs (lib/offline/packGrowth.ts), not the app's
        // opening: the top-up runs once the player is back on the list (a round on screen holds it).
        if (notePracticeRoundFinished()) firstPacks.current = true;
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
    [puzzle, sealed, clockDeadline, timeLimitMs, stopRecording, stateKey, deviceBest],
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
    beginRound();
  }, [stage, now, startedAt, beginRound]);

  // Out of time: grade an empty answer, exactly as a room does.
  useEffect(() => {
    if (stage !== "puzzle" || !puzzle) return;
    if (now - startedAt <= durationMs) return;
    void grade(draftAnswer.current);
  }, [stage, now, startedAt, durationMs, puzzle, grade]);

  // Practice's reveal stays until Play again or Back (27 Oct 2026): no separate result page.

  if (stage === "list") {
    // Offline practice: which games wait on the server, and (with no connection) which can't be played now.
    const pendingTypes = new Set(offlineStore.runs.filter((r) => r.status === "queued").map((r) => r.type));
    const offlineMark = (key: PuzzleType) => {
      if (online || !offlineStore.loaded) return null;
      if (ONLINE_ONLY_TYPES.has(key))
        return (
          <span data-online-only className="of-mark">
            <Icon name="offline" size={18} style={{ width: 15, height: 15 }} />
            Online only
          </span>
        );
      if ((offlineStore.counts[key] ?? 0) === 0)
        return (
          <span data-none-saved className="of-mark">
            <Icon name="offline" size={18} style={{ width: 15, height: 15 }} />
            None saved
          </span>
        );
      return null;
    };
    // A game's page (phase 2 step 3): opened from a tile, the hero, Home's Recently played or Challenges.
    if (pageType && isPlayable(pageType)) {
      const pageMark = offlineMark(pageType);
      return (
        <PhoneShell skin="practice" railTab="practice">
              <GamePage
                type={pageType}
                name={PUZZLE_REGISTRY[pageType].name}
                progress={progressView}
                server={serverChallenges}
                account={serverChallenges?.account ?? isAccountNow}
                notice={notice}
                mark={pageMark}
                onBack={closePage}
                level={levelChoice.games[pageType] ?? levelChoice.catalogue}
                onLevel={(next) => setGameLevel(pageType, next)}
                onPlay={() => void load(pageType, true)}
              />
        </PhoneShell>
      );
    }
    const stars = { earned: progressView?.stars ?? 0, total: STAR_TOTAL_MAX };
    return (
      <PhoneShell
        tabs="practice"
        title="Games"
        headerAction={
          <CatalogueHeaderTools stars={stars.earned} total={stars.total} searchOpen={searchOpen} onSearch={toggleSearch} />
        }
        aside={<PageAside panels={["public", "daily", "week"]} />}
      >
        <GamesCatalogue
          progress={progressView}
          query={query}
          onQuery={setQuery}
          searchOpen={searchOpen}
          view={gamesView}
          onView={chooseGamesView}
          hidden={heldBack}
          tileStyle={myTileStyle}
          onOpen={openPage}
          onPlay={(next) => void load(next, true)}
          tileExtra={(key) => {
            const mark = offlineMark(key);
            const pending = pendingTypes.has(key);
            return (
              <>
                {mark || pending ? (
                  <span aria-hidden={mark ? undefined : true} className="gm-tile-badge">
                    {/* Offline practice: a run of this game is waiting for the server (the best may still change). */}
                    {mark ?? <PendingClock />}
                  </span>
                ) : null}
                <TileBest type={key} pending={pending} progress={progressView} />
              </>
            );
          }}
          before={
            <>
              {/* The fresh start (10 Nov 2026): a one-time note, once per player (the server remembers it). */}
              {progressView && !progressView.noteSeen ? (
                <p role="status" data-practice-refresh-note className="jz-panel ap-empty">
                  {PRACTICE_REFRESH_NOTE}
                </p>
              ) : null}
              <DevKeyStatus status={demoStatus} />
              {/* Offline practice: Add to Home Screen (iPhone Safari only, shown from <html data-offline-install>). */}
              <OfflineInstallCard />
              {notice ? (
                <p role="status" data-practice-notice className="jz-panel ap-empty">
                  {notice}
                </p>
              ) : null}
              {demoKey ? (
                <label className="jz-panel jz-row">
                  <span className="jz-row-text">
                    <span className="jz-row-title">Intro examples</span>
                    <span className="jz-row-sub whitespace-normal">
                      Each game loads its fixed intro example, for recording demos.
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={exampleMode}
                    onChange={(e) => setExampleMode(e.target.checked)}
                    className="h-5 w-5 shrink-0"
                    style={{ accentColor: "var(--primary)" }}
                  />
                </label>
              ) : null}
              <ChallengeMoments />
            </>
          }
          after={
            <>
              <OfflineRuns runs={offlineStore.runs} now={Date.now()} />
              {/* No Retired section (13 Nov 2026, Joe's rule): retired games are out of the app (catalogue.ts isPlayable). */}
              <PracticeFooter />
            </>
          }
        />
      </PhoneShell>
    );
  }

  if (stage === "offline" && type) {
    return (
      <PhoneShell skin="room">
        <OfflineRunResult runId={offlineRunId} type={type} onPlayAgain={() => void load(type, true)} onBack={() => setStage("list")} />
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

  if (stage === "intro" && firstRun.current) {
    // The first game: the board at once (FirstRunStart begins the round on its first effect).
    return <FirstRunStart onStart={beginRound} />;
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
            beginRound();
          }}
        />
      </PhoneShell>
    );
  }

  if (stage === "reveal" && graded && firstRun.current) {
    return (
      <PhoneShell constrained gameScreen reveal gameType={type}>
        <FirstGameWin
          score={graded.score}
          onPlayAgain={() => {
            firstRun.current = false;
            void load(type, true, FIRST_GAME.level);
          }}
        />
      </PhoneShell>
    );
  }

  if (stage === "reveal" && graded) {
    return (
      <PhoneShell constrained gameScreen reveal gameType={type}>
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
          starLine={earnedStar}
          startedAt={startedAt}
          now={now}
          onPlayAgain={() => void load(type, true)}
          onBack={() => setStage("list")}
          onPlayLevel={(next) => {
            // The step-up card's "Play Hard": this game's level from now on (its page shows it too), then the round.
            setGameLevel(type, next);
            void load(type, true, next);
          }}
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

  const StageComponent = GameStage;
  const clockActive = clockStart !== null && now >= clockStart;
  return (
    <PhoneShell constrained gameScreen play gameType={type}>
      <GameLayout
        label="Practice"
        title={puzzleName(puzzle.type)}
        onHelp={() => setHelpOpen(true)}
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
          <>
            <PuzzleHelp type={puzzle.type} open={helpOpen} onClose={() => setHelpOpen(false)} level={levelOfPuzzle(puzzle)} />
            {firstRun.current ? (
              <p role="status" data-first-game-coach="" className="gm-first-coach">
                {FIRST_GAME_COACH}
              </p>
            ) : null}
          </>
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

/** The first game's start: begins the round once, as soon as the deal is in (no intro, no countdown). */
function FirstRunStart({ onStart }: { onStart: () => void }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    onStart();
  }, [onStart]);
  return (
    <PhoneShell>
      <div className="flex flex-1 items-center justify-center">
        <WaitingLine label="Making a puzzle" />
      </div>
    </PhoneShell>
  );
}
