import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ArcadeRevealData } from "@/lib/arcade/reveal";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { ConfirmDialog } from "@/components/duel/ConfirmDialog";
import type { ContinueState } from "@/components/duel/ContinueFooter";
import { Dots, WaitingLine } from "@/components/duel/Dots";
import { DropoutBanner, LeaveGameButton } from "@/components/duel/DropoutBanner";
import { JoinFromLink } from "@/components/duel/JoinFromLink";
import { FinalResult } from "@/components/duel/FinalResult";
import { GameLayout, PhoneShell } from "@/components/duel/PhoneShell";
import { useDemoKey } from "@/components/duel/SaveDemoButton";
import { PuzzleHelp, PuzzleHelpButton } from "@/components/duel/PuzzleInstructions";
import { RoundIntro } from "@/components/duel/RoundIntro";
import { preloadGameData } from "@/lib/duel/gamePreload";
import { DuelStart } from "@/components/duel/DuelStart";
import { RoundTitle } from "@/components/duel/RoundTitle";
import {
  DUEL_START_MS,
  ROUND_TITLE_MS,
  WINNER_CRASH_GRACE_MS,
  WINNER_REVEAL_MS,
} from "@/lib/duel/startPresentation";
import { WinnerReveal } from "@/components/duel/WinnerReveal";
import { animateFx } from "@/lib/fx/motion";
import { RoundPips } from "@/components/duel/RoundPips";
import { RoundResult } from "@/components/duel/RoundResult";
import { RoundResultsTable } from "@/components/duel/RoundResultsTable";
import { RoomChat } from "@/components/duel/RoomChat";
import { RoomLobby } from "@/components/duel/RoomLobby";
import { ScoreStrip } from "@/components/duel/ScoreStrip";
import { SoloScoreStrip } from "@/components/duel/SoloScoreStrip";
import { Standings } from "@/components/duel/Standings";
import { DuelOverall } from "@/components/duel/DuelOverall";
import { Podium } from "@/components/duel/Podium";
import { TimerBar } from "@/components/duel/TimerBar";
import { arcadeMsRemaining } from "@/lib/arcade/clock";
import { buzz, prefersReducedMotion } from "@/lib/motion";
import {
  playLock,
  playPlayerJoined,
  playSound,
  startMusic,
  releaseRoomMusic,
  holdMusicBed,
  stopMusic,
  unlockAudio,
} from "@/lib/sound";
import { roundMusicFor } from "@/lib/fx/theme";
import { roundMusicRemaining, useRoundMusic } from "@/lib/duel/useRoundMusic";
import {
  advancePhase,
  checkGroup,
  checkMoves,
  checkWord,
  continueOn,
  ensureRematch,
  fetchRevealPuzzle,
  finishNow,
  leaveRoom,
  disbandRoom,
  readyUp,
  removePlayer,
  setRoomModes,
  startRoom,
  submitAnswer,
} from "@/lib/duel/api";
import { serverNow, toMs } from "@/lib/duel/clock";
import { clearStageState } from "@/lib/duel/stageState";
import { elapsedMs, formatElapsed, roundVerdict } from "@/lib/duel/resultPresentation";
import {
  absentRivals,
  allContinued,
  allIntroReady,
  canFinishNow,
  forfeitOutcome,
  hasContinued,
  isContinuePhase,
  waitedOn,
} from "@/lib/duel/roomFlow";
import {
  duelOutcome,
  resultFor,
  roundBreakdown,
  standings,
  totalScore,
  totalScoreThrough,
} from "@/lib/duel/scoring";
import { useDuel } from "@/lib/duel/useDuel";
import { normaliseCategories } from "@/lib/duel/categories";
import { setPlayerMuted, useRoomChat } from "@/lib/duel/useRoomChat";
import {
  puzzleDef,
  puzzleDurationMs,
  puzzleName,
  puzzlePrepMs,
  puzzleRevealMs,
  puzzleShowsTimer,
  puzzleTimeLimitMs,
  puzzleRunMs,
} from "@/lib/duel/registry";
import {
  INTRO_COUNTDOWN_MS,
  INTRO_MS,
  INTRO_WAIT_MS,
  NEXT_ROUND_AUTO_MS,
  STANDINGS_MS,
  TOTAL_ROUNDS,
  type PuzzleData,
  type RoundRevealData,
} from "@/lib/duel/types";
import type { SubmitMeta } from "@/puzzles/types";
import { nearMiss } from "@/lib/duel/nearMiss";
import { roomInvite } from "@/lib/duel/roomLink";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";

const ROOM_TITLE = `Join a ${APP_NAME} room`;
const ROOM_DESCRIPTION = `You're invited to a live ${APP_NAME} room. ${APP_TAGLINE}`;

export const Route = createFileRoute("/duel/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: ROOM_TITLE },
      {
        name: "description",
        content: ROOM_DESCRIPTION,
      },
      { property: "og:title", content: ROOM_TITLE },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: ROOM_DESCRIPTION,
      },
      {
        name: "twitter:description",
        content: ROOM_DESCRIPTION,
      },
    ],
  }),
  component: DuelScreen,
});

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <PhoneShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        {children}
      </div>
    </PhoneShell>
  );
}

function HomeButton({ label = "Back to home" }: { label?: string }) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => void navigate({ to: "/" })}
      className="tap-target w-full max-w-xs rounded-xl bg-primary px-6 font-display text-base font-bold uppercase tracking-wide text-primary-foreground"
    >
      {label}
    </button>
  );
}

/** Lobby controls: Copy and Share both hand over the room link plus the code. */
function LobbyActions({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);
  const { link, text } = roomInvite(roomCode, typeof window === "undefined" ? "" : window.location.origin);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      buzz(10);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the code is on screen anyway */
    }
  };

  // Where the share sheet isn't available, Share copies the link instead.
  const share = async () => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      await copy();
      return;
    }
    try {
      await navigator.share({ title: APP_NAME, text, url: link });
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="flex w-full gap-2">
      <button
        type="button"
        onClick={() => void copy()}
        className="press tap-target flex-1 rounded-xl border border-border bg-card font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
      <button
        type="button"
        onClick={() => void share()}
        className="press tap-target flex-1 rounded-xl border border-primary/70 bg-primary/10 font-display text-xs font-semibold uppercase tracking-widest text-primary"
      >
        Share
      </button>
    </div>
  );
}

function DuelScreen() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const roomCode = code.toUpperCase();
  const state = useDuel(roomCode);
  const { duel, players, results, me, opponent, roomPlayers, isMulti, isHost, now } = state;
  // Accepted ?dev=1 key enables presentation-only readouts (layout overlay) in rooms too.
  useDemoKey();

  const [rematchBusy, setRematchBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmDisband, setConfirmDisband] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const timeoutSubmitted = useRef<string>("");
  const draftAnswer = useRef("");
  const lastAdvance = useRef(0);
  const dueSince = useRef(0);
  const [revealed, setRevealed] = useState<{
    round: number;
    tournamentKey: string;
    data: RoundRevealData;
  } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // Reset button state when a new tournament opens in this room.
  useEffect(() => {
    setStarting(false);
    setRematchBusy(false);
  }, [duel?.id, duel?.status]);

  const round = duel?.current_round ?? 0;
  const phase = duel?.phase ?? "intro";

  useEffect(() => setHelpOpen(false), [phase, round]);

  // The round order is fixed at room start: if Letterfall is in it, fetch its word list
  // now (or load it from the device cache) so no player waits for it at play time.
  const roundOrderKey = Array.isArray(duel?.round_order) ? duel.round_order.join(",") : "";
  useEffect(() => {
    if (roundOrderKey.split(",").includes("wordfall")) void preloadGameData("wordfall");
  }, [roundOrderKey]);

  /**
   * The round's puzzle never changes once the round starts, so it is held by
   * room + round rather than taken fresh from every refreshed room row. That
   * keeps the puzzle object identical while a round is live, so a realtime
   * update cannot re-mount or reset the puzzle a player is working on.
   */
  const tournamentKey = duel ? `${duel.id}-${duel.tournament_history?.length ?? 0}` : "";
  const stateKey = duel && round > 0 ? `${tournamentKey}-${round}` : "";
  const incoming = duel && round > 0 ? duel.puzzles_public[round - 1] : undefined;
  const heldPuzzle = useRef<{ key: string; value: PuzzleData | undefined }>({
    key: "",
    value: undefined,
  });
  if (heldPuzzle.current.key !== stateKey) heldPuzzle.current = { key: stateKey, value: incoming };
  const puzzle = heldPuzzle.current.value;
  const currentReveal =
    revealed?.round === round && revealed.tournamentKey === tournamentKey ? revealed.data : null;

  useEffect(() => {
    draftAnswer.current = "";
    setRevealed(null);
    // The previous round's inputs are no longer needed once a new round opens.
    if (round > 1) clearStageState(`${tournamentKey}-${round - 1}`);
  }, [tournamentKey, round]);
  const phaseStart = toMs(duel?.phase_started_at ?? null) ?? toMs(duel?.round_started_at ?? null);

  // Chat and reactions never reserve or cover space during viewport-locked play/reveal.
  const chatActive =
    !!duel &&
    !(
      duel.status === "in_progress" &&
      (duel.phase === "starting" ||
        duel.phase === "round_title" ||
        duel.phase === "puzzle" ||
        duel.phase === "reveal" ||
        duel.phase === "winner_reveal")
    );
  const chat = useRoomChat(duel?.id ?? null, me?.user_id ?? null, chatActive);
  useEffect(() => {
    if (!chatActive) chat.setSheetOpen(false);
  }, [chatActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // The clock starts once any puzzle preparation (sequence playback) is done.
  const puzzleStart = phase === "puzzle" ? phaseStart : null;
  const clockStart = puzzleStart === null ? null : puzzleStart + puzzlePrepMs(puzzle);
  // End of the puzzle phase. Most types run for 30s; Reaction Time has its own length.
  const deadline = puzzleStart === null ? null : puzzleStart + puzzleDurationMs(puzzle);
  const showTimer = puzzleShowsTimer(puzzle);
  const timeLimitMs = puzzleTimeLimitMs(puzzle);
  const clockDeadline = clockStart === null ? null : clockStart + timeLimitMs;
  const msRemaining = clockDeadline === null ? timeLimitMs : Math.max(0, clockDeadline - now);
  // Arcade rounds show the run itself, driven by the sim, not the phase slack.
  const runMs = phase === "puzzle" ? puzzleRunMs(puzzle) : null;

  const mySlot = me?.player_slot ?? 0;
  const opponentSlot = opponent?.player_slot ?? (mySlot === 1 ? 2 : 1);
  const myResult = resultFor(results, mySlot, round);
  const opponentResult = resultFor(results, opponentSlot, round);

  // Scores stay hidden until a round is fully over.
  const scoredThrough = phase === "result" || phase === "standings" ? round : round - 1;
  const myTotal = totalScoreThrough(results, mySlot, scoredThrough);
  const opponentTotal = totalScoreThrough(results, opponentSlot, scoredThrough);

  // One pip per finished round: who took it.
  const outcomes = Array.from({ length: scoredThrough }, (_, i) => {
    const mine = resultFor(results, mySlot, i + 1)?.score ?? 0;
    const theirs = resultFor(results, opponentSlot, i + 1)?.score ?? 0;
    return mine > theirs ? ("win" as const) : mine < theirs ? ("loss" as const) : ("draw" as const);
  });

  const activeCount = roomPlayers.filter((p) => p.status === "active").length || 1;
  // Ready and Continue wait only for connected active players (roomFlow).
  const waitingOn = waitedOn(roomPlayers, now);
  const waitCount = waitingOn.length || 1;
  const introReadyCount = waitingOn.filter((p) => p.intro_ready_round >= round).length;
  const answeredThisRound = results.filter((r) => r.round_number === round).length;
  const roundDetails = new Map(
    (currentReveal ? currentReveal.players : []).map((detail) => [detail.playerSlot, detail]),
  );
  const table = standings(roomPlayers, results, scoredThrough, roundDetails).map((row) => {
    const line = phase === "result" && puzzle ? nearMiss(puzzle.type, resultFor(results, row.slot, round)?.extra) : null;
    return line ? { ...row, summary: `${row.summary} · ${line}` } : row;
  });
  const myStanding = table.find((r) => r.slot === mySlot);
  const opponentStanding = table.find((r) => r.slot === opponentSlot);
  const roundTitle = puzzle
    ? `Round ${round} · ${puzzleName(puzzle.type)}${currentReveal?.correctAnswer ? ` · ${currentReveal.correctAnswer}` : ""}`
    : `Round ${round}`;
  /** Only the host drives the standings screen on; timers do the rest. */
  const leads = isHost;
  const roundTimes = new Map(
    roomPlayers.map((player) => [
      player.player_slot,
      elapsedMs(resultFor(results, player.player_slot, round), timeLimitMs),
    ]),
  );

  // Timer ran out without a submission — record a zero for this round.
  useEffect(() => {
    if (!duel || !me || !puzzle || duel.status !== "in_progress" || phase !== "puzzle") return;
    if (deadline === null || now < deadline || myResult) return;
    const key = `${duel.id}-${round}`;
    if (timeoutSubmitted.current === key) return;
    timeoutSubmitted.current = key;
    void submitAnswer({
      duelId: duel.id,
      roundNumber: round,
      answer: draftAnswer.current,
      msRemaining: 0,
    });
  }, [duel?.id, duel?.status, phase, round, now, deadline, myResult, me?.id, puzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Every timed screen change goes through the server, which is the single
   * place phase, round and status move — and is idempotent, so both phones
   * asking at once can never skip a screen. Slot 1 leads; slot 2 only steps in
   * if the lead phone has stalled.
   */
  useEffect(() => {
    if (!duel || !me || duel.status !== "in_progress" || round < 1) return;
    if (phaseStart === null) return;
    const elapsed = now - phaseStart;

    let due = false;
    if (phase === "starting") due = elapsed >= DUEL_START_MS;
    else if (phase === "round_title") due = elapsed >= ROUND_TITLE_MS;
    else if (phase === "intro")
      due = elapsed >= INTRO_MS || (elapsed < INTRO_WAIT_MS && allIntroReady(roomPlayers, round, now));
    else if (phase === "puzzle")
      due = answeredThisRound >= activeCount || (deadline !== null && now > deadline + 800);
    else if (phase === "reveal") due = elapsed >= puzzleRevealMs(puzzle);
    else if (phase === "result")
      due = elapsed >= NEXT_ROUND_AUTO_MS || allContinued(roomPlayers, round, phase, now);
    else if (phase === "standings")
      due = elapsed >= STANDINGS_MS || allContinued(roomPlayers, round, phase, now);
    else if (phase === "winner_reveal") due = elapsed >= WINNER_REVEAL_MS;

    if (!due) {
      dueSince.current = 0;
      return;
    }
    if (dueSince.current === 0) dueSince.current = now;
    if (
      phase !== "starting" &&
      phase !== "round_title" &&
      phase !== "winner_reveal" &&
      !leads &&
      now - dueSince.current < 2_500
    )
      return;
    if (Date.now() - lastAdvance.current < 1_500) return;
    lastAdvance.current = Date.now();
    void advancePhase(duel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    duel,
    leads,
    phase,
    phaseStart,
    now,
    round,
    roomPlayers,
    answeredThisRound,
    activeCount,
    deadline,
  ]);

  // The correct answer only exists on the client once the round has ended.
  useEffect(() => {
    if (!duel || round < 1 || (phase !== "reveal" && phase !== "result" && phase !== "standings"))
      return;
    if (revealed?.round === round && revealed.tournamentKey === tournamentKey) return;
    let cancelled = false;
    void fetchRevealPuzzle(duel.id, round).then((found) => {
      if (found && !cancelled) setRevealed({ round, tournamentKey, data: found });
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentKey, phase, round, revealed?.round, revealed?.tournamentKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Beds are requested only outside rounds; manifest music is silent until supplied.
  const musicScreen =
    duel?.status === "waiting"
      ? "lobby_loop"
      : duel?.status === "finished"
        ? "podium_loop"
        : phase === "result" || phase === "standings"
          ? "standings_loop"
          : null;
  useEffect(() => {
    if (musicScreen) startMusic(musicScreen);
    // The intro screen owns its own bed (intro_loop).
    else if (phase !== "intro") stopMusic(0);
  }, [musicScreen]); // eslint-disable-line react-hooks/exhaustive-deps
  // Intro bed loads once the room starts and is held with the other beds.
  const roomStarted = !!duel && duel.status !== "waiting";
  useEffect(() => {
    if (roomStarted) holdMusicBed("intro_loop");
  }, [roomStarted]);
  useEffect(() => () => releaseRoomMusic(), []);

  // Round music: the one owner is this round-phase state (useRoundMusic).
  // It starts as the 3-2-1 begins (or at the game, when there was no 3-2-1)
  // and stops only at time up, an early end, the reveal or leaving the room.
  const inProgress = duel?.status === "in_progress";
  const introPhase =
    inProgress && (phase === "intro" || phase === "starting" || phase === "round_title");
  const introStartAt =
    phaseStart === null
      ? null
      : phase === "starting"
        ? phaseStart + DUEL_START_MS + ROUND_TITLE_MS
        : phase === "round_title"
          ? phaseStart + ROUND_TITLE_MS
          : phaseStart;
  const countdownBegun =
    introPhase && introStartAt !== null && now >= introStartAt + INTRO_MS - INTRO_COUNTDOWN_MS;
  const chatAvailable = chatActive && !countdownBegun;
  const chatSeconds = phaseStart === null ? null :
    phase === "intro" ? Math.max(0, Math.ceil((INTRO_WAIT_MS - (now - phaseStart)) / 1000)) :
    phase === "result" ? Math.max(0, Math.ceil((NEXT_ROUND_AUTO_MS - (now - phaseStart)) / 1000)) :
    phase === "standings" ? Math.max(0, Math.ceil((STANDINGS_MS - (now - phaseStart)) / 1000)) : null;
  const chatScreen = phase === "intro" ? "Intro" : phase === "result" ? "Results" : phase === "standings" ? "Standings" : duel?.status === "finished" ? "Podium" : "Lobby";
  const chatLabel = chatSeconds === null ? chatScreen : `${chatScreen} ${Math.floor(chatSeconds / 60)}:${String(chatSeconds % 60).padStart(2, "0")}`;
  const puzzlePhase = inProgress && phase === "puzzle";
  const musicRemaining = puzzlePhase
    ? roundMusicRemaining(msRemaining, runMs, clockStart, now, arcadeMsRemaining)
    : null;
  const roundOver = puzzlePhase && (!!myResult || (musicRemaining ?? 1) <= 0);
  useRoundMusic(
    {
      key: inProgress ? stateKey : "",
      track: puzzle ? roundMusicFor(puzzle.type, puzzleDef(puzzle.type).category) : null,
      on: countdownBegun || (puzzlePhase && !roundOver),
      remainingMs: musicRemaining,
      reason: puzzlePhase ? (myResult ? "early-end" : "timer") : introPhase ? "left-intro" : "reveal",
    },
    "left-room",
  );

  // The crash and shake land as the podium appears after a winner reveal
  // (also for a player who arrived mid-reveal); fanfare and gg are unchanged.
  const podiumShell = useRef<HTMLDivElement>(null);
  const crashed = useRef<string | null>(null);
  const finished = duel?.status === "finished";
  useEffect(() => {
    if (!finished || !duel || duel.phase !== "winner_reveal" || phaseStart === null) return;
    if (crashed.current === duel.id) return;
    crashed.current = duel.id;
    if (serverNow() - phaseStart > WINNER_REVEAL_MS + WINNER_CRASH_GRACE_MS) return;
    playSound("winner_crash");
    if (podiumShell.current && !prefersReducedMotion()) animateFx(podiumShell.current, "shake");
  }, [finished, duel?.id, duel?.phase, phaseStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // A cue for each new player card in the lobby.
  const lobbyCount = duel?.status === "waiting" ? roomPlayers.length : 0;
  const seenCount = useRef(0);
  useEffect(() => {
    if (seenCount.current > 0 && lobbyCount > seenCount.current) playPlayerJoined();
    seenCount.current = lobbyCount;
  }, [lobbyCount]);

  // Every phone follows the host into the new room as soon as it exists.

  /**
   * The callbacks handed to a puzzle keep the same identity for the whole round
   * — the latest room state is read through a ref instead — so nothing inside
   * the puzzle re-runs because the room changed.
   */
  const latest = useRef({ duel, me, puzzle, myResult, round, clockDeadline });
  latest.current = { duel, me, puzzle, myResult, round, clockDeadline };

  const handleSubmit = useCallback((answer: string, meta?: SubmitMeta) => {
    // The elapsed time is measured here, at the moment of the player's action.
    const at = serverNow();
    const {
      duel: room,
      me: player,
      puzzle: current,
      myResult: mine,
      round: roundNumber,
    } = latest.current;
    if (!room || !player || !current || mine) return;
    unlockAudio();
    playLock();
    buzz(15);
    void submitAnswer({
      duelId: room.id,
      roundNumber,
      answer,
      msRemaining:
        latest.current.clockDeadline === null ? 0 : Math.max(0, latest.current.clockDeadline - at),
      extra: {
        reactionAvgMs: meta?.reactionAvgMs,
        correctCount: meta?.correctCount,
        errors: meta?.errors,
      },
    });
  }, []);

  const handleDraftAnswer = useCallback((answer: string) => {
    draftAnswer.current = answer;
  }, []);

  const handleCheckWord = useCallback(
    (word: string, found: string[], path?: number[]) =>
      checkWord(latest.current.duel!.id, latest.current.round, word, found, path),
    [],
  );

  const handleCheckGroup = useCallback(
    (indices: number[]) => checkGroup(latest.current.duel!.id, latest.current.round, indices),
    [],
  );

  const handleCheckMoves = useCallback(
    (moves: string) => checkMoves(latest.current.duel!.id, latest.current.round, moves),
    [],
  );

  const handlePlayAgain = async () => {
    if (!duel || !me) return;
    setRematchBusy(true);
    try {
      const next = await ensureRematch(duel.id);
      if (next.roomCode === duel.room_code) await state.refresh();
    } catch {
      setRematchBusy(false);
    }
  };

  const handleStart = async () => {
    if (!duel) return;
    unlockAudio();
    playLock();
    setStarting(true);
    try {
      await startRoom(duel.id);
    } catch {
      setStarting(false);
    }
  };

  const handleLeave = async () => {
    if (duel) await leaveRoom(duel.id);
    await navigate({ to: "/" });
  };

  const handleFinishNow = async () => {
    if (!duel) return;
    await finishNow(duel.id);
    await state.refresh();
  };

  // Results and standings: everyone's Continue; the server moves on once all are in.
  const continueState: ContinueState = {
    continued: !!me && isContinuePhase(phase) && hasContinued(me, round, phase),
    continuedCount: isContinuePhase(phase)
      ? waitingOn.filter((p) => hasContinued(p, round, phase)).length
      : 0,
    waitingCount: waitCount,
    onContinue: () => {
      if (!duel || !isContinuePhase(phase)) return;
      unlockAudio();
      buzz(10);
      void continueOn(duel.id, round, phase).then(() => state.refresh());
    },
  };

  const handleDisband = async () => {
    if (!duel) return;
    await disbandRoom(duel.id);
    await navigate({ to: "/" });
  };

  if (state.loading) {
    return (
      <Centered>
        <WaitingLine label="Loading room" />
      </Centered>
    );
  }

  // Not in the room (a room's rows are only readable by its players): the link
  // offers a name-only join while the room is in its lobby.
  if (state.notFound || !duel || !me || (me.status === "left" && duel.status === "waiting")) {
    return (
      <Centered>
        <JoinFromLink roomCode={roomCode} onJoined={state.refresh} />
      </Centered>
    );
  }

  if (duel.disbanded_at) {
    return (
      <Centered>
        <h1 className="font-display text-2xl">Room disbanded</h1>
        <p className="text-sm text-muted-foreground">The host closed this room.</p>
        <HomeButton />
      </Centered>
    );
  }

  if (
    duel.status === "in_progress" &&
    phase === "starting" &&
    phaseStart !== null &&
    now < phaseStart + DUEL_START_MS
  ) {
    return <DuelStart startedAt={phaseStart} type={puzzle?.type} />;
  }

  // While the guarded server write catches up, render the next shared frame,
  // never replay a completed title or expose a shell between the two screens.
  const titleStart = phaseStart === null ? null :
    phase === "starting" ? phaseStart + DUEL_START_MS :
    phase === "round_title" ? phaseStart : null;
  if (duel.status === "in_progress" && puzzle && titleStart !== null && now < titleStart + ROUND_TITLE_MS) {
    return <RoundTitle key={`${stateKey}-${titleStart}`} startedAt={titleStart} round={round} totalRounds={duel.round_count ?? TOTAL_ROUNDS} type={puzzle.type} />;
  }

  if (duel.status === "in_progress" && phase === "winner_reveal" && phaseStart !== null) {
    return <WinnerReveal startedAt={phaseStart} />;
  }

  // A player who tapped Leave doesn't come back into a game in progress.
  if (me.status === "left" && duel.status === "in_progress") {
    return (
      <Centered>
        <h1 className="font-display text-2xl">You left this game</h1>
        <p className="text-sm text-muted-foreground">The others are still playing.</p>
        <HomeButton />
      </Centered>
    );
  }

  // Everyone else has left or dropped out: no dead end. The rounds carry on
  // on their timers (absent players score 0) and the player can finish now.
  const absent = absentRivals(players, me.user_id, now);
  const dropout =
    duel.status === "in_progress" && canFinishNow(players, me.user_id, now) ? (
      <DropoutBanner
        absentNames={absent.map((p) => p.display_name)}
        myTotal={myTotal}
        absentTotal={absent.length === 1 ? totalScoreThrough(results, absent[0]!.player_slot, scoredThrough) : null}
        onFinish={handleFinishNow}
      />
    ) : null;
  // Guests can leave a game between rounds (the host's leave would close the room).
  const leaveAction =
    duel.status === "in_progress" && !isHost ? <LeaveGameButton onLeave={handleLeave} /> : undefined;

  if (duel.status === "waiting") {
    return (
      <PhoneShell>
        <div className="flex flex-1 flex-col items-center gap-5 pt-2 text-center">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Room code</p>
            <p className="mt-2 font-mono text-5xl font-bold tracking-[0.2em] text-primary animate-pop-in">
              {duel.room_code}
            </p>
          </div>

          <LobbyActions roomCode={duel.room_code} />

          <RoomLobby
            players={roomPlayers}
            hostUserId={duel.host_user_id}
            meUserId={me.user_id}
            isHost={isHost}
            starting={starting}
            onStart={() => void handleStart()}
            categories={normaliseCategories(duel.selected_categories)}
            tournamentHistory={duel.tournament_history ?? []}
            onCategoriesChange={(categories) => void setRoomModes(duel.id, categories)}
            onDisband={() => setConfirmDisband(true)}
            onLeave={() => setConfirmLeave(true)}
            onRemove={(slot) => void removePlayer(duel.id, slot)}
            onMuteForEveryone={(slot, muted) => void setPlayerMuted(duel.id, slot, muted)}
          />
          {confirmDisband && (
            <ConfirmDialog
              title="Disband this room?"
              body="The code will no longer work for anyone."
              confirmLabel="Disband"
              onCancel={() => setConfirmDisband(false)}
              onConfirm={() => void handleDisband()}
            />
          )}
          {confirmLeave && (
            <ConfirmDialog
              title="Leave this room?"
              body="You can join again with the link while the room is in the lobby."
              confirmLabel="Leave"
              onCancel={() => setConfirmLeave(false)}
              onConfirm={() => void handleLeave()}
            />
          )}
        </div>
        <RoomChat chat={chat} myUserId={me.user_id} available={chatAvailable} screenLabel={chatLabel} />
      </PhoneShell>
    );
  }

  if (duel.status === "finished") {
    // A "Finish now" ending: the same recorded outcome the room's history keeps.
    const forfeit = forfeitOutcome(duel, players);
    const iWonForfeit = forfeit?.winner.user_id === me.user_id;
    // A host who left can't restart the room (the reset removes left players).
    const canPlayAgain = isHost && me.status !== "left";
    // The other player in a two-player game, even after they left.
    const rival = opponent ?? players.find((p) => p.player_slot === opponentSlot) ?? null;
    const rivalName = rival?.display_name ?? "Opponent";
    if (isMulti) {
      return (
        <div ref={podiumShell}>
          <PhoneShell>
            <Podium
              rows={standings(roomPlayers, results, duel.round_count ?? TOTAL_ROUNDS)}
              mySlot={mySlot}
              results={results}
              roundOrder={duel.round_order}
              isHost={canPlayAgain}
              busy={rematchBusy}
              onPlayAgain={() => void handlePlayAgain()}
              onLeave={() => void handleLeave()}
            />
            <RoomChat chat={chat} myUserId={me.user_id} available={chatAvailable} screenLabel={chatLabel} />
          </PhoneShell>
        </div>
      );
    }
    return (
      <div ref={podiumShell}>
        <PhoneShell>
          <FinalResult
            outcome={
              forfeit ? (iWonForfeit ? "win" : "loss") : duelOutcome(results, mySlot, opponentSlot)
            }
            note={
              forfeit
                ? iWonForfeit
                  ? `${rivalName} left the game. You win.`
                  : `You left the game. ${forfeit.winner.display_name} wins.`
                : null
            }
            myName={me.display_name}
            opponentName={rivalName}
            myTotal={totalScore(results, mySlot)}
            opponentTotal={totalScore(results, opponentSlot)}
            breakdown={roundBreakdown(results, mySlot, opponentSlot, duel.round_count ?? TOTAL_ROUNDS)}
            roundOrder={duel.round_order}
            busy={rematchBusy}
            isHost={canPlayAgain}
            onPlayAgain={() => void handlePlayAgain()}
            onHome={() => void handleLeave()}
          />
          <RoomChat chat={chat} myUserId={me.user_id} available={chatAvailable} screenLabel={chatLabel} />
        </PhoneShell>
      </div>
    );
  }

  if ((phase === "intro" || phase === "starting" || phase === "round_title") && puzzle) {
    return (
      <PhoneShell gameType={puzzle.type} topAction={leaveAction}>
        {dropout}
        <RoundIntro
          round={round}
          totalRounds={duel.round_count}
          type={puzzle.type}
          puzzle={puzzle}
          startedAt={
            titleStart !== null
              ? titleStart + ROUND_TITLE_MS
              : (phaseStart ?? now)
          }
          now={now}
          outcomes={outcomes}
          ready={me.intro_ready_round >= round}
          readyCount={introReadyCount}
          activeCount={waitCount}
          onReady={() => {
            unlockAudio();
            playLock();
            buzz(15);
            void readyUp(duel.id, round);
          }}
        />
        <RoomChat chat={chat} myUserId={me.user_id} available={chatAvailable} screenLabel={chatLabel} />
      </PhoneShell>
    );
  }

  if (phase === "reveal" && puzzle) {
    return (
      <PhoneShell constrained gameScreen gameType={puzzle?.type}>
        <AnswerReveal
          round={round}
          totalRounds={duel.round_count ?? TOTAL_ROUNDS}
          puzzle={currentReveal?.puzzle ?? puzzle}
          answersReady={!!currentReveal}
          myAnswer={myResult?.answer ?? null}
          myCorrect={!!myResult?.is_correct}
          myReactionAvgMs={myResult?.reaction_avg_ms ?? null}
          myMsRemaining={myResult?.ms_remaining ?? 0}
          myScore={myResult ? myResult.score : null}
          players={roomPlayers
            .filter((p) => p.status !== "left" || resultFor(results, p.player_slot, round))
            .map((p) => {
              const row = resultFor(results, p.player_slot, round);
              const reveal = (row?.extra as Record<string, unknown> | null | undefined)?.["reveal"];
              return {
                slot: p.player_slot,
                name: p.display_name,
                isMe: p.player_slot === mySlot,
                reveal: row ? ((reveal as ArcadeRevealData | undefined) ?? null) : null,
              };
            })}
          myExtra={myResult?.extra ?? null}
          startedAt={phaseStart ?? now}
          now={now}
        />
      </PhoneShell>
    );
  }

  if (phase === "result") {
    const autoSeconds = Math.max(
      0,
      Math.ceil((NEXT_ROUND_AUTO_MS - (now - (phaseStart ?? now))) / 1000),
    );
    if (isMulti) {
      return (
        <PhoneShell gameType={puzzle?.type} topAction={leaveAction}>
          {dropout}
          <span className="category-tag">{puzzle ? puzzleDef(puzzle.type).category : ""}</span>
          <RoundResultsTable
            roundTitle={roundTitle}
            rows={table}
            times={roundTimes}
            mySlot={mySlot}
            autoSeconds={autoSeconds}
            finalRound={round >= duel.round_count}
            continueState={continueState}
          />
          <RoomChat chat={chat} myUserId={me.user_id} available={chatAvailable} screenLabel={chatLabel} />
        </PhoneShell>
      );
    }
    return (
      <PhoneShell gameType={puzzle?.type} topAction={leaveAction}>
        {dropout}
        <span className="category-tag">{puzzle ? puzzleDef(puzzle.type).category : ""}</span>
        <RoundResult
          roundTitle={roundTitle}
          myName={me.display_name}
          opponentName={opponent?.display_name ?? "Opponent"}
          myRoundScore={myResult?.score ?? 0}
          myVerdict={roundVerdict({ roundCorrect: myResult ? myResult.is_correct : null, roundScore: myResult?.score ?? 0 })}
          mySummary={myStanding?.summary ?? "No answer"}
          myTime={formatElapsed(roundTimes.get(mySlot) ?? null)}
          opponentRoundScore={opponentResult?.score ?? 0}
          opponentVerdict={roundVerdict({
            roundCorrect: opponentResult ? opponentResult.is_correct : null,
            roundScore: opponentResult?.score ?? 0,
          })}
          opponentSummary={opponentStanding?.summary ?? "No answer"}
          opponentTime={formatElapsed(roundTimes.get(opponentSlot) ?? null)}
          autoSeconds={autoSeconds}
          finalRound={round >= duel.round_count}
          continueState={continueState}
        />
        <RoomChat chat={chat} myUserId={me.user_id} available={chatAvailable} screenLabel={chatLabel} />
      </PhoneShell>
    );
  }

  if (phase === "standings") {
    const autoSeconds = Math.max(0, Math.ceil((STANDINGS_MS - (now - (phaseStart ?? now))) / 1000));
    return (
      <PhoneShell gameType={puzzle?.type} topAction={leaveAction}>
        {dropout}
        <span className="category-tag">{puzzle ? puzzleDef(puzzle.type).category : ""}</span>
        {isMulti ? (
          <Standings
            round={round}
            totalRounds={duel.round_count ?? TOTAL_ROUNDS}
            rows={table}
            mySlot={mySlot}
            autoSeconds={autoSeconds}
            continueState={continueState}
          />
        ) : (
          <DuelOverall
            round={round}
            totalRounds={duel.round_count ?? TOTAL_ROUNDS}
            rows={table}
            mySlot={mySlot}
            autoSeconds={autoSeconds}
            continueState={continueState}
          />
        )}
        <RoomChat chat={chat} myUserId={me.user_id} available={chatAvailable} screenLabel={chatLabel} />
      </PhoneShell>
    );
  }

  const clockActive = clockStart !== null && now >= clockStart;
  const Stage = puzzle ? puzzleDef(puzzle.type).Stage : null;
  const roomGameHeader =
    puzzle?.type === "spotdiff" || puzzle?.type === "blockparty" ? undefined : isMulti ? (
      <SoloScoreStrip
        name={me.display_name}
        total={myTotal}
        position={myStanding?.position ?? 1}
        playerCount={roomPlayers.length}
        compact
      />
    ) : (
      <ScoreStrip
        myName={me.display_name}
        opponentName={opponent?.display_name ?? "Opponent"}
        myTotal={myTotal}
        opponentTotal={opponentTotal}
        compact
      />
    );
  return (
    <PhoneShell constrained gameScreen gameType={puzzle?.type} gameHeader={roomGameHeader}>
      <GameLayout
        label={`Round ${round} of ${duel.round_count ?? TOTAL_ROUNDS}`}
        title={puzzle ? puzzleName(puzzle.type) : ""}
        help={<PuzzleHelpButton onClick={() => setHelpOpen(true)} />}
        progress={<RoundPips currentRound={round} outcomes={outcomes} totalRounds={duel.round_count ?? TOTAL_ROUNDS} />}
        timer={
          showTimer ? (
            <TimerBar
              msRemaining={myResult ? 0 : runMs !== null ? arcadeMsRemaining(runMs) : msRemaining}
              totalMs={runMs ?? timeLimitMs}
              active={clockActive && !myResult}
            />
          ) : undefined
        }
        beforeGame={
          puzzle?.type === "balance" ? (
            <div id={`balance-progress-${stateKey}`} className="h-3 w-full shrink-0" />
          ) : undefined
        }
        locked={!!myResult}
        overlay={
          <>
            {puzzle && (
              <PuzzleHelp type={puzzle.type} open={helpOpen} onClose={() => setHelpOpen(false)} />
            )}
            {myResult && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <span className="animate-stamp-in rounded-lg border-2 border-primary px-4 py-2 font-display text-lg font-bold uppercase tracking-[0.2em] text-primary">
                  Locked
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {isMulti ? "Waiting for other players" : "Waiting for opponent"} <Dots />
                </span>
              </div>
            )}
          </>
        }
      >
        {puzzle && Stage && (
          // Keyed by the round alone: mounted once, never re-keyed by room updates.
          <Stage
            key={stateKey}
            stateKey={stateKey}
            puzzle={puzzle}
            phaseStartedAt={puzzleStart ?? now}
            now={now}
            locked={!!myResult}
            onSubmit={handleSubmit}
            onDraftAnswer={handleDraftAnswer}
            checkWord={handleCheckWord}
            checkGroup={handleCheckGroup}
            checkMoves={handleCheckMoves}
          />
        )}
      </GameLayout>
    </PhoneShell>
  );
}
