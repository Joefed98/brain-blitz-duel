import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { ArcadeRevealData } from "@/lib/arcade/reveal";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { Dots, WaitingLine } from "@/components/duel/Dots";
import { FinalResult } from "@/components/duel/FinalResult";
import { GameLayout, PhoneShell } from "@/components/duel/PhoneShell";
import { useDemoKey } from "@/components/duel/SaveDemoButton";
import { PuzzleHelp, PuzzleHelpButton } from "@/components/duel/PuzzleInstructions";
import { RoundIntro } from "@/components/duel/RoundIntro";
import { DuelStart } from "@/components/duel/DuelStart";
import { DUEL_START_MS } from "@/lib/duel/startPresentation";
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
import { buzz } from "@/lib/motion";
import {
  playLock,
  playPlayerJoined,
  startMusic,
  releaseRoomMusic,
  stopMusic,
  unlockAudio,
} from "@/lib/sound";
import {
  advancePhase,
  checkGroup,
  checkWord,
  ensureRematch,
  fetchRevealPuzzle,
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
import { elapsedMs, formatElapsed } from "@/lib/duel/resultPresentation";
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
  INTRO_MS,
  INTRO_WAIT_MS,
  NEXT_ROUND_AUTO_MS,
  STANDINGS_MS,
  TOTAL_ROUNDS,
  type PuzzleData,
  type RoundRevealData,
} from "@/lib/duel/types";
import type { SubmitMeta } from "@/puzzles/types";

export const Route = createFileRoute("/duel/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Duelz room — six timed puzzle rounds" },
      {
        name: "description",
        content:
          "Up to ten players solve the same six timed puzzles at the same moment. Highest total wins.",
      },
      { property: "og:title", content: "Duelz room — six timed puzzle rounds" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Six rounds. Two to ten players. Fastest brain wins.",
      },
      {
        name: "twitter:description",
        content: "Six rounds. Two to ten players. Fastest brain wins.",
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

/** Lobby controls: copy the code, or share the join link where supported. */
function LobbyActions({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/duel/${roomCode}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      buzz(10);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the code is on screen anyway */
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        title: "Duelz",
        text: `Join my Duelz room — code ${roomCode} — ${link}`,
        url: link,
      });
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
        {copied ? "Copied" : "Copy code"}
      </button>
      {canShare && (
        <button
          type="button"
          onClick={() => void share()}
          className="press tap-target flex-1 rounded-xl border border-border bg-card font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Share link
        </button>
      )}
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
    !(duel.status === "in_progress" && (duel.phase === "starting" || duel.phase === "puzzle" || duel.phase === "reveal"));
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
  const introReadyCount = roomPlayers.filter(
    (p) => p.status === "active" && p.intro_ready_round >= round,
  ).length;
  const answeredThisRound = results.filter((r) => r.round_number === round).length;
  const roundDetails = new Map(
    (currentReveal ? currentReveal.players : []).map((detail) => [detail.playerSlot, detail]),
  );
  const table = standings(roomPlayers, results, scoredThrough, roundDetails);
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

    const activeReady = roomPlayers.filter(
      (p) => p.status === "active" && p.intro_ready_round >= round,
    ).length;

    let due = false;
    if (phase === "starting") due = elapsed >= DUEL_START_MS;
    else if (phase === "intro")
      due = elapsed >= INTRO_MS || (elapsed < INTRO_WAIT_MS && activeReady >= activeCount);
    else if (phase === "puzzle")
      due = answeredThisRound >= activeCount || (deadline !== null && now > deadline + 800);
    else if (phase === "reveal") due = elapsed >= puzzleRevealMs(puzzle);
    else if (phase === "result") due = elapsed >= NEXT_ROUND_AUTO_MS;
    else if (phase === "standings") due = elapsed >= STANDINGS_MS;

    if (!due) {
      dueSince.current = 0;
      return;
    }
    if (dueSince.current === 0) dueSince.current = now;
    if (phase !== "starting" && !leads && now - dueSince.current < 2_500) return;
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
    else stopMusic(0);
  }, [musicScreen]);
  useEffect(() => () => releaseRoomMusic(), []);

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

  if (state.notFound || !duel) {
    return (
      <Centered>
        <h1 className="font-display text-2xl">Room not found</h1>
        <p className="text-sm text-muted-foreground">No room exists with the code {roomCode}.</p>
        <HomeButton />
      </Centered>
    );
  }

  if (!me) {
    return (
      <Centered>
        <h1 className="font-display text-2xl">You're not in this room</h1>
        <p className="text-sm text-muted-foreground">Head back home and join with the room code.</p>
        <HomeButton />
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

  if (duel.status === "in_progress" && phase === "starting" && phaseStart !== null && now < phaseStart + DUEL_START_MS) {
    return <DuelStart startedAt={phaseStart} type={puzzle?.type} />;
  }

  if (state.opponentDisconnected) {
    return (
      <Centered>
        <h1 className="font-display text-2xl text-warn">Opponent disconnected</h1>
        <p className="text-sm text-muted-foreground">
          {opponent?.display_name} dropped out of the duel.
        </p>
        <HomeButton />
      </Centered>
    );
  }

  if (duel.status === "waiting") {
    return (
      <PhoneShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-7 text-center">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Room code</p>
            <p className="mt-3 font-mono text-6xl font-bold tracking-[0.2em] text-primary animate-pop-in">
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
            onRemove={(slot) => void removePlayer(duel.id, slot)}
            onMuteForEveryone={(slot, muted) => void setPlayerMuted(duel.id, slot, muted)}
          />
          {confirmDisband && (
            <div
              role="alertdialog"
              aria-label="Disband room"
              className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 p-6"
            >
              <div className="w-full max-w-sm space-y-4 rounded-md border border-border bg-card p-5 text-center">
                <p className="font-display text-lg">Disband this room?</p>
                <p className="text-sm text-muted-foreground">
                  The code will no longer work for anyone.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmDisband(false)}
                    className="tap-target flex-1 rounded-md border border-border"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDisband()}
                    className="tap-target flex-1 rounded-md bg-primary text-primary-foreground"
                  >
                    Disband
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <RoomChat chat={chat} myUserId={me.user_id} />
      </PhoneShell>
    );
  }

  if (duel.status === "finished") {
    if (isMulti) {
      return (
        <PhoneShell>
          <Podium
            rows={standings(roomPlayers, results, TOTAL_ROUNDS)}
            mySlot={mySlot}
            results={results}
            roundOrder={duel.round_order}
            isHost={isHost}
            busy={rematchBusy}
            onPlayAgain={() => void handlePlayAgain()}
            onLeave={() => void handleLeave()}
          />
          <RoomChat chat={chat} myUserId={me.user_id} />
        </PhoneShell>
      );
    }
    return (
      <PhoneShell>
        <FinalResult
          outcome={duelOutcome(results, mySlot, opponentSlot)}
          myName={me.display_name}
          opponentName={opponent?.display_name ?? "Opponent"}
          myTotal={totalScore(results, mySlot)}
          opponentTotal={totalScore(results, opponentSlot)}
          breakdown={roundBreakdown(results, mySlot, opponentSlot)}
          roundOrder={duel.round_order}
          busy={rematchBusy}
          isHost={isHost}
          onPlayAgain={() => void handlePlayAgain()}
          onHome={() => void handleLeave()}
        />
        <RoomChat chat={chat} myUserId={me.user_id} />
      </PhoneShell>
    );
  }

  if ((phase === "intro" || phase === "starting") && puzzle) {
    return (
      <PhoneShell gameType={puzzle.type}>
        <RoundIntro
          round={round}
          totalRounds={duel.round_count}
          type={puzzle.type}
          puzzle={puzzle}
          startedAt={phase === "starting" && phaseStart !== null ? phaseStart + DUEL_START_MS : phaseStart ?? now}
          now={now}
          outcomes={outcomes}
          ready={me.intro_ready_round >= round}
          readyCount={introReadyCount}
          activeCount={activeCount}
          onReady={() => {
            unlockAudio();
            playLock();
            buzz(15);
            void readyUp(duel.id, round);
          }}
        />
        <RoomChat chat={chat} myUserId={me.user_id} />
      </PhoneShell>
    );
  }

  if (phase === "reveal" && puzzle) {
    return (
      <PhoneShell constrained gameScreen gameType={puzzle?.type}>
        <AnswerReveal
          round={round}
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
        <PhoneShell gameType={puzzle?.type}>
          <span className="category-tag">{puzzle ? puzzleDef(puzzle.type).category : ""}</span>
          <RoundResultsTable
            roundTitle={roundTitle}
            rows={table}
            times={roundTimes}
            mySlot={mySlot}
            autoSeconds={autoSeconds}
            isHost={isHost}
            finalRound={round >= duel.round_count}
            onNext={() => void advancePhase(duel.id, true)}
          />
          <RoomChat chat={chat} myUserId={me.user_id} />
        </PhoneShell>
      );
    }
    return (
      <PhoneShell gameType={puzzle?.type}>
        <span className="category-tag">{puzzle ? puzzleDef(puzzle.type).category : ""}</span>
        <RoundResult
          roundTitle={roundTitle}
          myName={me.display_name}
          opponentName={opponent?.display_name ?? "Opponent"}
          myRoundScore={myResult?.score ?? 0}
          mySummary={myStanding?.summary ?? "No answer"}
          myTime={formatElapsed(roundTimes.get(mySlot) ?? null)}
          opponentRoundScore={opponentResult?.score ?? 0}
          opponentSummary={opponentStanding?.summary ?? "No answer"}
          opponentTime={formatElapsed(roundTimes.get(opponentSlot) ?? null)}
          autoSeconds={autoSeconds}
          finalRound={round >= duel.round_count}
          isHost={isHost}
          onNext={() => void advancePhase(duel.id, true)}
        />
        <RoomChat chat={chat} myUserId={me.user_id} />
      </PhoneShell>
    );
  }

  if (phase === "standings") {
    const autoSeconds = Math.max(0, Math.ceil((STANDINGS_MS - (now - (phaseStart ?? now))) / 1000));
    return (
      <PhoneShell gameType={puzzle?.type}>
        <span className="category-tag">{puzzle ? puzzleDef(puzzle.type).category : ""}</span>
        {isMulti ? (
          <Standings
            round={round}
            rows={table}
            mySlot={mySlot}
            autoSeconds={autoSeconds}
            isHost={isHost}
            onNext={() => void advancePhase(duel.id, true)}
          />
        ) : (
          <DuelOverall
            round={round}
            rows={table}
            mySlot={mySlot}
            autoSeconds={autoSeconds}
            isHost={isHost}
            onNext={() => void advancePhase(duel.id, true)}
          />
        )}
        <RoomChat chat={chat} myUserId={me.user_id} />
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
        label={`Round ${round} of ${TOTAL_ROUNDS}`}
        title={puzzle ? puzzleName(puzzle.type) : ""}
        help={<PuzzleHelpButton onClick={() => setHelpOpen(true)} />}
        progress={<RoundPips currentRound={round} outcomes={outcomes} />}
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
          />
        )}
      </GameLayout>
    </PhoneShell>
  );
}
