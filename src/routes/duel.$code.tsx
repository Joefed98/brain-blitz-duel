import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCrashContext } from "@/lib/useCrashContext";
import type { ArcadeRevealData } from "@/lib/arcade/reveal";
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TermsGate } from "@/components/beta/TermsGate";
import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { ConfirmDialog } from "@/components/duel/ConfirmDialog";
import type { ContinueState } from "@/components/duel/ContinueFooter";
import { Dots, WaitingLine } from "@/components/duel/Dots";
import { DropoutBanner, LeaveGameButton } from "@/components/duel/DropoutBanner";
import { JoinFromLink } from "@/components/duel/JoinFromLink";
import { CategoryPill } from "@/components/app/CategoryPill";
import { FinalResult } from "@/components/duel/FinalResult";
import { GameLayout, PhoneShell, RoomPanelSlot, isArcadeScreenType } from "@/components/duel/PhoneShell";
import { RoomPanel } from "@/components/duel/RoomPanel";
import { SteadyOrPlain } from "@/components/duel/SteadyStage";
import { useDemoKey } from "@/components/duel/SaveDemoButton";
import { PuzzleHelp, PuzzleHelpButton } from "@/components/duel/PuzzleInstructions";
import { RoundIntro } from "@/components/duel/RoundIntro";
import { preloadGameData } from "@/lib/duel/gamePreload";
import { markOnboardingSeen } from "@/lib/onboarding";
import { useDeviceRoomRecord } from "@/lib/duel/deviceHistory";
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
import { RoundHighlight } from "@/components/replay/RoundHighlight";
import { PlayOfTheGame } from "@/components/replay/PlayOfTheGame";
import { RoundResultsTable } from "@/components/duel/RoundResultsTable";
import { RoomChat, RoundChatDot } from "@/components/duel/RoomChat";
import { RoomLobby } from "@/components/duel/RoomLobby";
import { RoomChatButton, RoomChatSlot, RoomFooter, RoomMenu, type RoomMenuItem } from "@/components/duel/RoomFooter";
import { FinishedPingStrip, useFinishedPings } from "@/components/duel/FinishedPings";
// Loaded on demand: only a finished room shows it, so the room's own screens never wait for it.
const RoomChallengeButton = lazy(() =>
  import("@/components/challenge/ChallengeShare").then((m) => ({ default: m.RoomChallengeButton })),
);
import { FrameScore } from "@/components/duel/GameFrame";
import { ordinal } from "@/lib/duel/ordinal";
import { Standings } from "@/components/duel/Standings";
import { DuelOverall } from "@/components/duel/DuelOverall";
import { Podium } from "@/components/duel/Podium";
import { RoomShareButton } from "@/components/share/ShareResultButton";
import { TimerBar } from "@/components/duel/TimerBar";
import { arcadeMsRemaining } from "@/lib/arcade/clock";
import { prefersReducedMotion } from "@/lib/motion";
import {
  playLock,
  playPlayerJoined,
  playSound,
  playVoice,
  screenMusic,
  startMusic,
  releaseRoomMusic,
  holdMusicBed,
  stopMusic,
  unlockAudio,
} from "@/lib/sound";
import { useHomeBed } from "@/lib/useScreenMusic";
import { roundMusicFor } from "@/lib/fx/theme";
import { roundMusicRemaining, useRoundMusic } from "@/lib/duel/useRoundMusic";
import {
  advancePhase,
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
  setPlayerLook,
  setRoomSettings,
  startRoom,
  submitAnswer,
} from "@/lib/duel/api";
import { serverNow, toMs } from "@/lib/duel/clock";
import { clearStageState, persistStageState } from "@/lib/duel/stageState";
import { createRoomSender } from "@/lib/duel/roomSend";
import { createDraftKeeper } from "@/lib/duel/roomDraft";
import { roomPuzzleCloseMs, roomTimeoutMs } from "@/lib/duel/roomClose";
import { elapsedMs, formatElapsed, roundVerdict, scoreOnlyVerdict } from "@/lib/duel/resultPresentation";
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
import { roomTieRounds } from "@/lib/duel/tieBreak";
import { useDuel } from "@/lib/duel/useDuel";
import { roundClockMs } from "@/lib/duel/buzzer";
import { showRoundChatDot } from "@/lib/duel/chatNotice";
import { setPlayerMuted, useRoomChat } from "@/lib/duel/useRoomChat";
import {
  puzzleDef,
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
  type PuzzleType,
  type RoundRevealData,
} from "@/lib/duel/types";
import type { SubmitMeta } from "@/puzzles/types";
import { nearMiss } from "@/lib/duel/nearMiss";
import { lookColumnsPresent, PLAYER_COLOURS, resolvePlayerLooks } from "@/lib/duel/playerLook";
import { startRaceGhosts } from "@/lib/duel/raceGhosts";
import { podiumAwards } from "@/lib/duel/podiumAwards";
import { awardRoundsFor } from "@/lib/duel/awardRounds";
import { roomInvite } from "@/lib/duel/roomLink";
import { APP_URL } from "@/config/appUrl";
import { noteSignatureSubmit } from "@/lib/fx/signature";
import { useSignatureHold, useSignatureVerdict } from "@/lib/fx/useSignature";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { roomUpdateGate, useUpdateGate } from "@/lib/appUpdate";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { Button, SkeletonPage } from "@/design/components";

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
  component: OfflineDuel,
});

/** Offline practice (31 Oct 2026): with no connection, the offline state and a way to Practice. */
function OfflineDuel() {
  return (
    <OnlineOnly body="Rooms need a connection. Practice games are saved on this phone, so they still work.">
      <DuelScreen />
    </OnlineOnly>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <PhoneShell skin="room">
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
  const { link, text } = roomInvite(roomCode, APP_URL);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
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
    // Secondary buttons (the gold rule: sharing is not a play action).
    <div className="flex shrink-0 gap-2">
      <Button
        variant="secondary"
        onClick={() => void copy()}
        className="w-26 px-2"
      >
        {copied ? "Link copied" : "Copy link"}
      </Button>
      <Button
        variant="secondary"
        onClick={() => void share()}
        className="w-19 px-2"
      >
        Share
      </Button>
    </div>
  );
}

function DuelScreen() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const roomCode = code.toUpperCase();
  const state = useDuel(roomCode);
  const { duel, players, results, me, opponent, roomPlayers, isMulti, isHost, now } = state;
  // A new version reloads only between rounds and lands back here (lib/appUpdate).
  useUpdateGate(
    roomUpdateGate({
      loading: state.loading,
      notFound: state.notFound,
      member: !!me,
      status: duel?.status,
      phase: duel?.phase,
    }),
  );
  // Accepted ?dev=1 key enables presentation-only readouts (layout overlay) in rooms too.
  useDemoKey();
  // Arriving through a room link: no first-time intro now or later (lib/onboarding).
  useEffect(() => markOnboardingSeen(), []);
  // This device's own history (Profile, Tournaments, Play's "Rejoin"): device storage only, nothing drawn here.
  useDeviceRoomRecord({ duel, players, results, me });

  const [rematchBusy, setRematchBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [confirmDisband, setConfirmDisband] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  /**
   * The round's one answer (keyed `${room id}-${round}`), as in practice: the stage's own submit or the
   * time-out's draft, never both; a send that fails on the way is retried while the round takes answers.
   */
  const sender = useRef(createRoomSender((payload) => submitAnswer(payload))).current;
  /** The live round's draft, by its round (stateKey), kept on the device so a reload mid-round keeps it. */
  const drafts = useRef(createDraftKeeper()).current;
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

  // Play again reopened this room (finished → waiting): every player in it hears "rematch".
  const seenStatus = useRef<{ id: string; status: string } | null>(null);
  useEffect(() => {
    if (!duel) return;
    const before = seenStatus.current;
    seenStatus.current = { id: duel.id, status: duel.status };
    if (before?.id === duel.id && before.status === "finished" && duel.status === "waiting") playVoice("voice.rematch");
  }, [duel?.id, duel?.status]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // The live puzzle round's stage inputs are kept on the device too (stageState.ts), so a reload continues
  // the same board. Never an arcade run (its sim replays its input log); practice never marks a round.
  persistStageState(puzzle && !isArcadeScreenType(puzzle.type) ? stateKey : "");
  // Crash reports name the game and round on screen (lib/crashReporting.ts; ids only).
  useCrashContext(round > 0 ? puzzle?.type : null, round > 0 ? round : null);
  const currentReveal =
    revealed?.round === round && revealed.tournamentKey === tournamentKey ? revealed.data : null;

  useEffect(() => {
    // Other rounds' stored drafts are dropped; this round's (one kept through a reload) stays.
    drafts.prune(stateKey);
    setRevealed(null);
    // The previous round's inputs are no longer needed once a new round opens.
    if (round > 1) clearStageState(`${tournamentKey}-${round - 1}`);
  }, [tournamentKey, round]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // End of the puzzle phase. Most types run for 30s; Reaction Time has its own length. Arcade rounds
  // wait a little longer for a run still being played (roomClose.ts); the room moves on 800 ms later.
  const deadline = puzzleStart === null ? null : puzzleStart + roomTimeoutMs(puzzle);
  const closesAt = puzzleStart === null ? null : puzzleStart + roomPuzzleCloseMs(puzzle);
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
  // Only active players' answers count towards "everyone's in" (a player who answered and left keeps a row).
  const answeredThisRound = results.filter(
    (r) => r.round_number === round && roomPlayers.some((p) => p.player_slot === r.player_slot && p.status === "active"),
  ).length;
  const roundDetails = new Map(
    (currentReveal ? currentReveal.players : []).map((detail) => [detail.playerSlot, detail]),
  );
  // Tie-break clocks for rooms stamped tieRev; null keeps older rooms' ranking.
  const tieRounds = roomTieRounds(duel?.puzzles_public);
  // Everyone's colour and icon, the same on every phone (every row, left players included).
  const looks = useMemo(() => resolvePlayerLooks(players), [players]);
  // Who else has finished this round (never how they did); the live round only, never practice or replays.
  // Beta: a device's first room played after finishing a friend's challenge (challengeRecord.ts).
  const playing = duel?.status === "in_progress" && !!me;
  useEffect(() => {
    if (!playing) return;
    void import("@/lib/duel/challengeRecord").then(({ takeChallengeFollowup }) => {
      const code = takeChallengeFollowup("room");
      if (code) void import("@/lib/duel/challengeApi").then(({ sendChallengeFollowup }) => sendChallengeFollowup("room", code));
    });
  }, [playing]);
  // Racing's ghost cars (display only, raceGhosts.ts): the room's broadcast channel, joined only while a Racing round
  // is on screen (intro to reveal); nothing from it reaches the sim, the log or the score.
  const ghostRound = duel?.status === "in_progress" && me && puzzle?.type === "racing" && (phase === "intro" || phase === "puzzle") ? round : null;
  const ghostLook = me ? looks.get(mySlot) : undefined;
  useEffect(() => {
    if (ghostRound === null || !duel || !me) return;
    const colour = PLAYER_COLOURS[ghostLook?.colour ?? 0]?.hex ?? "#C9CCD6";
    return startRaceGhosts(duel.id, ghostRound, { key: String(mySlot), name: me.display_name, colour });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostRound, duel?.id, mySlot]);
  const finishedPings = useFinishedPings(players, round, mySlot, duel?.status === "in_progress" && phase === "puzzle", stateKey);
  const table = standings(roomPlayers, results, scoredThrough, roundDetails, tieRounds).map((row) => {
    const line = phase === "result" && puzzle ? nearMiss(puzzle.type, resultFor(results, row.slot, round)?.extra) : null;
    return line ? { ...row, summary: `${row.summary} · ${line}` } : row;
  });
  const myStanding = table.find((r) => r.slot === mySlot);
  const opponentStanding = table.find((r) => r.slot === opponentSlot);
  const roundTitle = puzzle ? `Round ${round} · ${puzzleName(puzzle.type)}` : `Round ${round}`;
  /** Only a single fewest-moves count makes a short "Best: 17 moves" line; longer answers stay off the title. */
  const bestLine = /^\d+ (moves|presses|pushes|pours|tilts)$/.test(
    currentReveal?.correctAnswer ?? "",
  )
    ? `Best: ${currentReveal!.correctAnswer}`
    : null;
  /** Only the host drives the standings screen on; timers do the rest. */
  const leads = isHost;
  // The round's own clock (an arcade run's length): the time column shows it in full at the buzzer.
  const roundClock = roundClockMs(puzzle);
  const roundTimes = new Map(
    roomPlayers.map((player) => [
      player.player_slot,
      elapsedMs(resultFor(results, player.player_slot, round), timeLimitMs, roundClock, puzzle?.type),
    ]),
  );

  // The shared signature beat, once this player's stored verdict lands.
  const signatureVerdict = useMemo(
    () =>
      puzzle && myResult
        ? {
            type: puzzle.type,
            arcade: puzzleDef(puzzle.type).category === "arcade",
            correct: myResult.is_correct,
            score: myResult.score,
            msRemaining: myResult.ms_remaining,
            timeLimitMs,
          }
        : null,
    [puzzle, myResult, timeLimitMs],
  );
  useSignatureVerdict(duel && myResult ? `${duel.id}-${round}` : null, signatureVerdict);
  // Whenever the beat fires (a solve, a 120+ run) the locked board stays at full
  // brightness (no Locked card yet) until the beat has finished, at most 2 s from
  // the solve or run's end; then it dims as before.
  // The hold is on the phone's own clock (the beat's), re-checked on every tick.
  const holdUntil = useSignatureHold(duel && myResult ? `${duel.id}-${round}` : null, signatureVerdict);
  const boardHeld = holdUntil !== null && Date.now() < holdUntil;

  // Timer ran out without a submission: send the round's draft (the partial answer practice grades
  // too). Also when the room has already moved to the reveal before this phone sent anything (the
  // server still takes late answers then), so a slow phone never ends a round with no answer at all.
  // A send that failed on the way (the stage's or this one) goes again here, after its backoff.
  useEffect(() => {
    if (!duel || !me || !puzzle || duel.status !== "in_progress" || myResult) return;
    const key = `${duel.id}-${round}`;
    sender.tick(key, now, phase === "puzzle" || phase === "reveal");
    if (phase === "puzzle") {
      if (deadline === null || now < deadline) return;
    } else if (phase !== "reveal") return;
    if (sender.claimed(key)) return;
    noteSignatureSubmit(puzzle.type);
    sender.send(key, { duelId: duel.id, roundNumber: round, answer: drafts.current(stateKey), msRemaining: 0 }, now);
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
      due = answeredThisRound >= activeCount || (closesAt !== null && now > closesAt);
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
    closesAt,
  ]);

  // The correct answer only exists on the client once the round has ended.
  useEffect(() => {
    if (!duel || round < 1 || (phase !== "reveal" && phase !== "result" && phase !== "standings"))
      return;
    // A reveal-phase fetch holds only my own answer (late answers are still
    // accepted then), or nothing at all before my answer is in; fetch again
    // once my answer is stored or the round has closed for everyone.
    if (
      revealed?.round === round &&
      revealed.tournamentKey === tournamentKey &&
      (!revealed.data.partial ||
        (phase === "reveal" && !(revealed.data.awaitingAnswer && myResult)))
    )
      return;
    let cancelled = false;
    void fetchRevealPuzzle(duel.id, round).then((found) => {
      if (found && !cancelled) setRevealed({ round, tournamentKey, data: found });
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentKey, phase, round, revealed?.round, revealed?.tournamentKey, revealed?.data.partial, revealed?.data.awaitingAnswer, !!myResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // Beds are requested only outside rounds; manifest music is silent until supplied.
  // The prepare, title, reveal and winner screens stay silent until their slot has a file.
  // The lobby plays its own bed again (lobby_loop, 1 Nov 2026 follow-up): it crossfades the home bed out over 400 ms
  // (FADE_MS), and the home bed resumes where it was when the player goes back to a tab page.
  const musicScreen =
    duel?.status === "waiting"
      ? "lobby_loop"
      : duel?.status === "finished"
        ? "podium_loop"
        : phase === "result" || phase === "standings"
          ? "standings_loop"
          : phase === "starting"
            ? screenMusic("music_prepare")
            : phase === "round_title"
              ? screenMusic("music_round_title")
              : phase === "reveal"
                ? screenMusic("music_reveal")
                : phase === "winner_reveal"
                  ? screenMusic("music_winner")
                  : null;
  useEffect(() => {
    if (musicScreen) startMusic(musicScreen);
    // The intro screen owns its own bed (intro_loop). While the room loads nothing is stopped, so the home bed
    // carries on until the lobby's bed crossfades it out.
    else if (phase !== "intro" && duel) stopMusic(0);
  }, [musicScreen, !!duel]); // eslint-disable-line react-hooks/exhaustive-deps
  // Only while the room loads: the home bed plays on from the Play tab (no gap) until the lobby's bed takes over.
  useHomeBed(!duel);
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
  // The room footer's chat button (RoomFooter), beside each screen's main action.
  const chatButton = <RoomChatButton chat={chat} available={chatAvailable} />;
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
  const latest = useRef({ duel, me, puzzle, myResult, round, clockDeadline, stateKey });
  latest.current = { duel, me, puzzle, myResult, round, clockDeadline, stateKey };

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
    // One send per round: a stage's own submit (some send just before the buzzer) and the
    // time-out's draft can never both go, so the stage's answer is the one graded, as in practice.
    const sent = `${room.id}-${roundNumber}`;
    if (sender.claimed(sent)) return;
    noteSignatureSubmit(current.type);
    unlockAudio();
    playLock();
    // Kept as the round's draft too, so a reload before it lands still has it.
    drafts.push(latest.current.stateKey, answer, true);
    // Not stored on the way: sent again, the same answer and time claim, after a short wait (roomSend.ts).
    sender.send(
      sent,
      {
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
      },
      at,
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDraftAnswer = useCallback((answer: string) => {
    drafts.push(latest.current.stateKey, answer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCheckWord = useCallback(
    (word: string, found: string[], path?: number[]) =>
      checkWord(latest.current.duel!.id, latest.current.round, word, found, path),
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
      <PhoneShell skin="room">
        <SkeletonPage label="Loading room" rows={4} card />
      </PhoneShell>
    );
  }

  // Not in the room (a room's rows are only readable by its players): the link
  // offers a name-only join while the room is in its lobby. That join is an entry point, so the
  // beta terms come first there (once per device); a device already in the room (its lobby, rounds,
  // reveals or results) is never interrupted by them: it sees them at its next entry point.
  if (state.notFound || !duel || !me || (me.status === "left" && duel.status === "waiting")) {
    return (
      <TermsGate>
        <Centered>
          <JoinFromLink roomCode={roomCode} onJoined={state.refresh} />
        </Centered>
      </TermsGate>
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

  // The computer layout's room panel (31 Oct 2026, presentation only): drawn by PhoneShell on the right
  // from 1024 px wide (RoomPanelSlot), never on a phone or tablet; every screen below supplies it.
  const inRound = duel.status === "in_progress" && ["intro", "starting", "round_title", "puzzle", "reveal"].includes(phase);
  const panelRows =
    duel.status === "waiting"
      ? roomPlayers.map((p, i) => ({ slot: p.player_slot, name: p.display_name, total: 0, position: i + 1 }))
      : table.map((r) => ({ slot: r.slot, name: r.name, total: r.total, position: r.position }));
  const roomPanel = (
    <RoomPanel
      roomCode={duel.room_code}
      round={round}
      totalRounds={duel.round_count ?? TOTAL_ROUNDS}
      roundOrder={duel.round_order ?? []}
      status={duel.status as "waiting" | "in_progress" | "finished"}
      inRound={inRound}
      rows={panelRows}
      players={roomPlayers}
      mySlot={mySlot}
      myAnswered={!!myResult}
      looks={looks}
      chat={chat}
      chatAvailable={chatAvailable}
      myUserId={me.user_id}
    />
  );
  const withPanel = (node: React.ReactNode) => <RoomPanelSlot.Provider value={roomPanel}>{node}</RoomPanelSlot.Provider>;

  if (duel.status === "waiting") {
    // Disband room (host) and Leave room (guests) are in the header's "⋯" menu (Polish batch R).
    const lobbyMenu: RoomMenuItem[] = isHost
      ? [{ label: "Disband room", danger: true, onSelect: () => setConfirmDisband(true) }]
      : [{ label: "Leave room", danger: true, onSelect: () => setConfirmLeave(true) }];
    return withPanel(
      <PhoneShell skin="room" topAction={<RoomMenu items={lobbyMenu} />}>
        <RoomChatSlot.Provider value={chatButton}>
        <div className="flex flex-1 flex-col gap-5 pt-1 text-left">
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <p className="rs-meta">Room code</p>
              <p className="rs-code mt-1.5 animate-pop-in">{duel.room_code}</p>
            </div>
            <LobbyActions roomCode={duel.room_code} />
          </div>

          <RoomLobby
            players={roomPlayers}
            hostUserId={duel.host_user_id}
            meUserId={me.user_id}
            isHost={isHost}
            starting={starting}
            onStart={() => void handleStart()}
            storedSettings={duel.selected_categories}
            tournamentHistory={duel.tournament_history ?? []}
            onSettingsChange={(settings) => setRoomSettings(duel.id, settings)}
            onDisband={() => setConfirmDisband(true)}
            onLeave={() => setConfirmLeave(true)}
            onRemove={(slot) => void removePlayer(duel.id, slot)}
            onMuteForEveryone={(slot, muted) => void setPlayerMuted(duel.id, slot, muted)}
            looks={looks}
            allPlayers={players}
            canChooseLook={lookColumnsPresent(players)}
            onLookChange={(look) => setPlayerLook(duel.id, look)}
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
        </RoomChatSlot.Provider>
        <RoomChat chat={chat} myUserId={me.user_id} players={players} looks={looks} available={chatAvailable} screenLabel={chatLabel} bar={false} />
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
    // Leave (Home) is in the header's "⋯" menu (Polish batch R).
    const finalMenu = <RoomMenu items={[{ label: "Leave", onSelect: () => void handleLeave() }]} />;
    if (isMulti) {
      return withPanel(
        <div ref={podiumShell}>
          <PhoneShell skin="room" topAction={finalMenu}>
            <RoomChatSlot.Provider value={chatButton}>
            <Podium
              rows={standings(roomPlayers, results, duel.round_count ?? TOTAL_ROUNDS, undefined, tieRounds)}
              looks={looks}
              awards={podiumAwards(roomPlayers, results, awardRoundsFor(duel), tieRounds)}
              mySlot={mySlot}
              results={results}
              roundOrder={duel.round_order}
              isHost={canPlayAgain}
              busy={rematchBusy}
              onPlayAgain={() => void handlePlayAgain()}
              onLeave={() => void handleLeave()}
              playOfTheGame={forfeit ? null : <PlayOfTheGame roomId={duel.id} active />}
              share={<RoomShareButton duel={duel} players={players} results={results} me={me} />}
              challenge={forfeit ? null : <Suspense fallback={null}><RoomChallengeButton duelId={duel.id} total={totalScore(results, mySlot)} rounds={duel.round_count ?? TOTAL_ROUNDS} /></Suspense>}
            />
            </RoomChatSlot.Provider>
            <RoomChat chat={chat} myUserId={me.user_id} players={players} looks={looks} available={chatAvailable} screenLabel={chatLabel} bar={false} />
          </PhoneShell>
        </div>
      );
    }
    return withPanel(
      <div ref={podiumShell}>
        <PhoneShell skin="room" topAction={finalMenu}>
          <RoomChatSlot.Provider value={chatButton}>
          <FinalResult
            outcome={
              forfeit ? (iWonForfeit ? "win" : "loss") : duelOutcome(results, mySlot, opponentSlot, tieRounds)
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
            myLook={looks.get(mySlot)}
            opponentLook={looks.get(opponentSlot)}
            awards={podiumAwards(roomPlayers, results, awardRoundsFor(duel), tieRounds)}
            looks={looks}
            names={new Map(players.map((p) => [p.player_slot, p.display_name]))}
            mySlot={mySlot}
            myTotal={totalScore(results, mySlot)}
            opponentTotal={totalScore(results, opponentSlot)}
            breakdown={roundBreakdown(results, mySlot, opponentSlot, duel.round_count ?? TOTAL_ROUNDS)}
            roundOrder={duel.round_order}
            busy={rematchBusy}
            isHost={canPlayAgain}
            onPlayAgain={() => void handlePlayAgain()}
            onHome={() => void handleLeave()}
            playOfTheGame={forfeit ? null : <PlayOfTheGame roomId={duel.id} active />}
            share={<RoomShareButton duel={duel} players={players} results={results} me={me} />}
            challenge={forfeit ? null : <Suspense fallback={null}><RoomChallengeButton duelId={duel.id} total={totalScore(results, mySlot)} rounds={duel.round_count ?? TOTAL_ROUNDS} /></Suspense>}
          />
          </RoomChatSlot.Provider>
          <RoomChat chat={chat} myUserId={me.user_id} players={players} looks={looks} available={chatAvailable} screenLabel={chatLabel} bar={false} />
        </PhoneShell>
      </div>
    );
  }

  if ((phase === "intro" || phase === "starting" || phase === "round_title") && puzzle) {
    return withPanel(
      // The intro draws the game frame's header itself (RoundIntro, Polish batch R), with a guest's "⋯" menu.
      <PhoneShell gameType={puzzle.type} bare>
        {dropout}
        <RoomChatSlot.Provider value={chatButton}>
        <RoundIntro
          topAction={leaveAction}
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
            void readyUp(duel.id, round);
          }}
        />
        </RoomChatSlot.Provider>
        <RoomChat chat={chat} myUserId={me.user_id} players={players} looks={looks} available={chatAvailable} screenLabel={chatLabel} bar={false} />
      </PhoneShell>
    );
  }

  if (phase === "reveal" && puzzle) {
    return withPanel(
      <PhoneShell constrained gameScreen reveal gameType={puzzle?.type}>
        <AnswerReveal
          round={round}
          totalRounds={duel.round_count ?? TOTAL_ROUNDS}
          puzzle={currentReveal?.puzzle ?? puzzle}
          answersReady={!!currentReveal && !currentReveal.awaitingAnswer}
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
              // Other players' rows stay unreadable until late answers stop; the
              // reveal fetch carries where their runs ended and their stored score (to place markers).
              const progress = currentReveal?.progress?.find((g) => g.playerSlot === p.player_slot);
              const axis = progress?.axis;
              return {
                slot: p.player_slot,
                name: p.display_name,
                isMe: p.player_slot === mySlot,
                look: looks.get(p.player_slot),
                // Places their marker on the chart (no figure is drawn): their result row once readable,
                // else the reveal's progress entry.
                score: row ? row.score : (progress?.score ?? null),
                reveal: row
                  ? ((reveal as ArcadeRevealData | undefined) ?? null)
                  : axis
                    ? { axis, lines: [], tiles: [], outcome: "time" as const }
                    : null,
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
      return withPanel(
        <PhoneShell skin="room" gameType={puzzle?.type} topAction={leaveAction}>
          {dropout}
          {puzzle ? <CategoryPill category={puzzleDef(puzzle.type).category} className="self-start" /> : null}
          <RoomChatSlot.Provider value={chatButton}>
          <RoundResultsTable
            roundTitle={roundTitle}
            best={bestLine}
            rows={table}
            times={roundTimes}
            clockMs={roundClock}
            scoreOnly={scoreOnlyVerdict(puzzle?.type)}
            looks={looks}
            mySlot={mySlot}
            autoSeconds={autoSeconds}
            finalRound={round >= duel.round_count}
            continueState={continueState}
            highlight={
              <RoundHighlight
                roomId={duel.id}
                round={round}
                active={phase === "result"}
                players={table.length}
                msLeft={NEXT_ROUND_AUTO_MS - (now - (phaseStart ?? now))}
              />
            }
          />
          </RoomChatSlot.Provider>
          <RoomChat chat={chat} myUserId={me.user_id} players={players} looks={looks} available={chatAvailable} screenLabel={chatLabel} bar={false} />
        </PhoneShell>
      );
    }
    return withPanel(
      <PhoneShell skin="room" gameType={puzzle?.type} topAction={leaveAction}>
        {dropout}
        {puzzle ? <CategoryPill category={puzzleDef(puzzle.type).category} className="self-start" /> : null}
        <RoomChatSlot.Provider value={chatButton}>
        <RoundResult
          gameType={puzzle?.type}
          roundTitle={roundTitle}
          best={bestLine}
          myName={me.display_name}
          opponentName={opponent?.display_name ?? "Opponent"}
          myLook={looks.get(mySlot)}
          opponentLook={looks.get(opponentSlot)}
          myRoundScore={myResult?.score ?? 0}
          myVerdict={roundVerdict({ roundCorrect: myResult ? myResult.is_correct : null, roundScore: myResult?.score ?? 0 }, scoreOnlyVerdict(puzzle?.type))}
          mySummary={myStanding?.summary ?? "No answer"}
          myTime={formatElapsed(roundTimes.get(mySlot) ?? null, roundClock)}
          opponentRoundScore={opponentResult?.score ?? 0}
          opponentVerdict={roundVerdict({
            roundCorrect: opponentResult ? opponentResult.is_correct : null,
            roundScore: opponentResult?.score ?? 0,
          }, scoreOnlyVerdict(puzzle?.type))}
          opponentSummary={opponentStanding?.summary ?? "No answer"}
          opponentTime={formatElapsed(roundTimes.get(opponentSlot) ?? null, roundClock)}
          autoSeconds={autoSeconds}
          finalRound={round >= duel.round_count}
          continueState={continueState}
          highlight={
            <RoundHighlight
              roomId={duel.id}
              round={round}
              active={phase === "result"}
              players={3}
              msLeft={NEXT_ROUND_AUTO_MS - (now - (phaseStart ?? now))}
            />
          }
        />
        </RoomChatSlot.Provider>
        <RoomChat chat={chat} myUserId={me.user_id} players={players} looks={looks} available={chatAvailable} screenLabel={chatLabel} bar={false} />
      </PhoneShell>
    );
  }

  if (phase === "standings") {
    const autoSeconds = Math.max(0, Math.ceil((STANDINGS_MS - (now - (phaseStart ?? now))) / 1000));
    // Above Continue: the round's winner (or those level on the top score) and the next round's game.
    const topRound = Math.max(0, ...table.map((row) => row.roundScore));
    const nextType = duel.round_order?.[round] as PuzzleType | undefined;
    const extras = {
      winners: topRound > 0 ? table.filter((row) => row.roundScore === topRound).map((row) => ({ slot: row.slot, name: row.name })) : [],
      winnerScore: topRound,
      game: puzzle?.type,
      next: round < (duel.round_count ?? TOTAL_ROUNDS) && nextType ? nextType : null,
    };
    return withPanel(
      <PhoneShell skin="room" gameType={puzzle?.type} topAction={leaveAction}>
        {dropout}
        {puzzle ? <CategoryPill category={puzzleDef(puzzle.type).category} className="self-start" /> : null}
        <RoomChatSlot.Provider value={chatButton}>
        {isMulti ? (
          <Standings
            round={round}
            totalRounds={duel.round_count ?? TOTAL_ROUNDS}
            rows={table}
            looks={looks}
            mySlot={mySlot}
            autoSeconds={autoSeconds}
            continueState={continueState}
            extras={extras}
          />
        ) : (
          <DuelOverall
            round={round}
            totalRounds={duel.round_count ?? TOTAL_ROUNDS}
            rows={table}
            looks={looks}
            mySlot={mySlot}
            autoSeconds={autoSeconds}
            continueState={continueState}
            extras={extras}
          />
        )}
        </RoomChatSlot.Provider>
        <RoomChat chat={chat} myUserId={me.user_id} players={players} looks={looks} available={chatAvailable} screenLabel={chatLabel} bar={false} />
      </PhoneShell>
    );
  }

  const clockActive = clockStart !== null && now >= clockStart;
  const Stage = puzzle ? puzzleDef(puzzle.type).Stage : null;
  // Live "finished" pings (finishedPings.ts): over the frame header's name and context line; never
  // the board, the timer or the score.
  const pingStrip = finishedPings.length ? (
    <FinishedPingStrip pings={finishedPings} looks={looks} lines={2} />
  ) : null;
  // During the round, unread chat shows only as a small dot on the header's score (chatNotice.ts).
  const chatDot = showRoundChatDot(chat.unread, chatAvailable) ? <RoundChatDot unread={chat.unread} /> : null;
  // The frame's score block: my room total, with my place (3+ players) or the opponent's total under it.
  const frameScore = isMulti ? (
    <FrameScore
      value={myTotal}
      note={`${ordinal(myStanding?.position ?? 1)} of ${roomPlayers.length}`}
      extra={chatDot}
    />
  ) : (
    <FrameScore
      value={myTotal}
      note={<span className="text-opponent">{opponent?.display_name ?? "Opponent"} {opponentTotal}</span>}
      extra={chatDot}
    />
  );
  return withPanel(
    <PhoneShell constrained gameScreen play gameType={puzzle?.type}>
      <GameLayout
        label={`Round ${round} of ${duel.round_count ?? TOTAL_ROUNDS}`}
        title={puzzle ? puzzleName(puzzle.type) : ""}
        help={<PuzzleHelpButton onClick={() => setHelpOpen(true)} />}
        progress={<RoundPips currentRound={round} outcomes={outcomes} totalRounds={duel.round_count ?? TOTAL_ROUNDS} />}
        score={frameScore}
        ping={pingStrip}
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
        held={boardHeld}
        overlay={
          <>
            {puzzle && (
              <PuzzleHelp type={puzzle.type} open={helpOpen} onClose={() => setHelpOpen(false)} />
            )}
            {myResult && !boardHeld && (
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
          <SteadyOrPlain
            Stage={Stage}
            steady={isArcadeScreenType(puzzle?.type)}
            key={stateKey}
            stateKey={stateKey}
            puzzle={puzzle}
            phaseStartedAt={puzzleStart ?? now}
            now={now}
            locked={!!myResult}
            onSubmit={handleSubmit}
            onDraftAnswer={handleDraftAnswer}
            checkWord={handleCheckWord}
            checkMoves={handleCheckMoves}
          />
        )}
      </GameLayout>
    </PhoneShell>
  );
}
