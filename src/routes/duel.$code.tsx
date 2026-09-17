import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { Dots, WaitingLine } from "@/components/duel/Dots";
import { FinalResult } from "@/components/duel/FinalResult";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { RoundIntro } from "@/components/duel/RoundIntro";
import { RoundPips } from "@/components/duel/RoundPips";
import { RoundResult } from "@/components/duel/RoundResult";
import { RoomLobby } from "@/components/duel/RoomLobby";
import { ScoreStrip } from "@/components/duel/ScoreStrip";
import { SoloScoreStrip } from "@/components/duel/SoloScoreStrip";
import { Standings } from "@/components/duel/Standings";
import { Podium } from "@/components/duel/Podium";
import { TimerRing } from "@/components/duel/TimerRing";
import { buzz } from "@/lib/motion";
import {
  playLock,
  playPlayerJoined,
  playRoundStart,
  startMusic,
  stopMusic,
  unlockAudio,
} from "@/lib/sound";
import {
  advancePhase,
  checkGroup,
  checkWord,
  ensureRematch,
  fetchDuelById,
  fetchRevealPuzzle,
  leaveRoom,
  markReady,
  readyUp,
  removePlayer,
  startRoom,
  submitAnswer,
} from "@/lib/duel/api";
import { serverNow, toMs } from "@/lib/duel/clock";
import { clearStageState } from "@/lib/duel/stageState";
import {
  duelOutcome,
  resultFor,
  roundBreakdown,
  standings,
  totalScore,
  totalScoreThrough,
} from "@/lib/duel/scoring";
import { useDuel } from "@/lib/duel/useDuel";
import {
  puzzleDef,
  puzzleDurationMs,
  puzzleName,
  puzzlePrepMs,
  puzzleRevealMs,
  puzzleShowsTimer,
  puzzleTimeLimitMs,
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
      {
        property: "og:description",
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

  const [rematchBusy, setRematchBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const timeoutSubmitted = useRef<string>("");
  const draftAnswer = useRef("");
  const lastAdvance = useRef(0);
  const dueSince = useRef(0);
  const [revealed, setRevealed] = useState<{ round: number; data: RoundRevealData } | null>(null);

  // A new room (after Play again) starts with fresh button state.
  useEffect(() => {
    setStarting(false);
    setRematchBusy(false);
  }, [duel?.id]);

  const round = duel?.current_round ?? 0;
  const phase = duel?.phase ?? "intro";

  /**
   * The round's puzzle never changes once the round starts, so it is held by
   * room + round rather than taken fresh from every refreshed room row. That
   * keeps the puzzle object identical while a round is live, so a realtime
   * update cannot re-mount or reset the puzzle a player is working on.
   */
  const stateKey = duel && round > 0 ? `${duel.id}-${round}` : "";
  const incoming = duel && round > 0 ? duel.puzzles_public[round - 1] : undefined;
  const heldPuzzle = useRef<{ key: string; value: PuzzleData | undefined }>({
    key: "",
    value: undefined,
  });
  if (heldPuzzle.current.key !== stateKey) heldPuzzle.current = { key: stateKey, value: incoming };
  const puzzle = heldPuzzle.current.value;

  useEffect(() => {
    draftAnswer.current = "";
    // The previous round's inputs are no longer needed once a new round opens.
    if (duel && round > 1) clearStageState(`${duel.id}-${round - 1}`);
  }, [duel?.id, round]); // eslint-disable-line react-hooks/exhaustive-deps
  const phaseStart = toMs(duel?.phase_started_at ?? null) ?? toMs(duel?.round_started_at ?? null);

  // The clock starts once any puzzle preparation (sequence playback) is done.
  const puzzleStart = phase === "puzzle" ? phaseStart : null;
  const clockStart = puzzleStart === null ? null : puzzleStart + puzzlePrepMs(puzzle);
  // End of the puzzle phase. Most types run for 30s; Reaction Time has its own length.
  const deadline = puzzleStart === null ? null : puzzleStart + puzzleDurationMs(puzzle);
  const showTimer = puzzleShowsTimer(puzzle);
  const timeLimitMs = puzzleTimeLimitMs(puzzle);
  const clockDeadline = clockStart === null ? null : clockStart + timeLimitMs;
  const msRemaining = clockDeadline === null ? timeLimitMs : Math.max(0, clockDeadline - now);

  const mySlot = me?.player_slot ?? 0;
  const opponentSlot = opponent?.player_slot ?? (mySlot === 1 ? 2 : 1);
  const myResult = resultFor(results, mySlot, round);
  const opponentResult = resultFor(results, opponentSlot, round);

  // Scores stay hidden until a round is fully over.
  const scoredThrough = phase === "result" ? round : round - 1;
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
    (revealed?.round === round ? revealed.data.players : []).map((detail) => [
      detail.playerSlot,
      detail,
    ]),
  );
  const table = standings(roomPlayers, results, scoredThrough, roundDetails);
  const myStanding = table.find((r) => r.slot === mySlot);
  const opponentStanding = table.find((r) => r.slot === opponentSlot);
  const roundTitle = puzzle
    ? `Round ${round} · ${puzzleName(puzzle.type)}${revealed?.round === round && revealed.data.correctAnswer ? ` · ${revealed.data.correctAnswer}` : ""}`
    : `Round ${round}`;
  /** Only the host drives the standings screen on; timers do the rest. */
  const leads = isHost;

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
    if (phase === "intro")
      due = elapsed >= INTRO_MS || (elapsed < INTRO_WAIT_MS && activeReady >= activeCount);
    else if (phase === "puzzle")
      due = answeredThisRound >= activeCount || (deadline !== null && now > deadline + 800);
    else if (phase === "reveal") due = elapsed >= puzzleRevealMs(puzzle);
    else {
      const autoMs = isMulti ? STANDINGS_MS : NEXT_ROUND_AUTO_MS;
      const hostReady = roomPlayers.find((p) => p.user_id === duel.host_user_id);
      const skipped = isMulti
        ? !!hostReady && hostReady.ready_round >= round
        : roomPlayers.length === 2 && roomPlayers.every((p) => p.ready_round >= round);
      due = skipped || elapsed >= autoMs;
    }

    if (!due) {
      dueSince.current = 0;
      return;
    }
    if (dueSince.current === 0) dueSince.current = now;
    if (!leads && now - dueSince.current < 2_500) return;
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
    if (!duel || round < 1 || (phase !== "reveal" && phase !== "result")) return;
    if (revealed?.round === round) return;
    let cancelled = false;
    void fetchRevealPuzzle(duel.id, round).then((found) => {
      if (found && !cancelled) setRevealed({ round, data: found });
    });
    return () => {
      cancelled = true;
    };
  }, [duel?.id, phase, round, revealed?.round]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * The lobby bed plays from the waiting room through the first round's intro,
   * and fades out as round one's puzzle opens.
   */
  const lobbyMusic =
    !!duel &&
    (duel.status === "waiting" ||
      (duel.status === "in_progress" && round === 1 && phase === "intro"));
  const lobbyPlaying = useRef(false);
  useEffect(() => {
    if (lobbyMusic) {
      lobbyPlaying.current = true;
      startMusic("lobby_loop");
    } else if (lobbyPlaying.current) {
      lobbyPlaying.current = false;
      stopMusic(400);
    }
  }, [lobbyMusic]);
  useEffect(
    () => () => {
      if (lobbyPlaying.current) stopMusic(400);
    },
    [],
  );

  // A cue for each new player card in the lobby.
  const lobbyCount = duel?.status === "waiting" ? roomPlayers.length : 0;
  const seenCount = useRef(0);
  useEffect(() => {
    if (seenCount.current > 0 && lobbyCount > seenCount.current) playPlayerJoined();
    seenCount.current = lobbyCount;
  }, [lobbyCount]);

  // The countdown sting lands its final hit on GO.
  const roundStartCued = useRef(0);
  useEffect(() => {
    if (phase !== "intro" || round < 1 || phaseStart === null) return;
    if (roundStartCued.current === round) return;
    if (now < phaseStart + INTRO_MS - 1300) return;
    roundStartCued.current = round;
    playRoundStart();
  }, [phase, round, now, phaseStart]);

  // Every phone follows the host into the new room as soon as it exists.
  useEffect(() => {
    const nextId = duel?.next_duel_id;
    if (!nextId || !me) return;
    let cancelled = false;
    void (async () => {
      const next = await fetchDuelById(nextId);
      if (next && !cancelled)
        await navigate({ to: "/duel/$code", params: { code: next.room_code } });
    })();
    return () => {
      cancelled = true;
    };
  }, [duel?.next_duel_id, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      await navigate({ to: "/duel/$code", params: { code: next.roomCode } });
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
            onRemove={(slot) => void removePlayer(duel.id, slot)}
          />
        </div>
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
          onPlayAgain={() => void handlePlayAgain()}
          onHome={() => void navigate({ to: "/" })}
        />
      </PhoneShell>
    );
  }

  if (phase === "intro" && puzzle) {
    return (
      <PhoneShell>
        <RoundIntro
          round={round}
          type={puzzle.type}
          startedAt={phaseStart ?? now}
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
      </PhoneShell>
    );
  }

  if (phase === "reveal" && puzzle) {
    return (
      <PhoneShell constrained>
        <AnswerReveal
          round={round}
          puzzle={revealed?.round === round ? revealed.data.puzzle : puzzle}
          answersReady={revealed?.round === round}
          myAnswer={myResult?.answer ?? null}
          myCorrect={!!myResult?.is_correct}
          myReactionAvgMs={myResult?.reaction_avg_ms ?? null}
          myMsRemaining={myResult?.ms_remaining ?? 0}
          startedAt={phaseStart ?? now}
          now={now}
        />
      </PhoneShell>
    );
  }

  if (phase === "result") {
    const autoSeconds = Math.max(
      0,
      Math.ceil(
        ((isMulti ? STANDINGS_MS : NEXT_ROUND_AUTO_MS) - (now - (phaseStart ?? now))) / 1000,
      ),
    );
    if (isMulti) {
      return (
        <PhoneShell>
          <Standings
            round={round}
            roundTitle={roundTitle}
            rows={table}
            mySlot={mySlot}
            autoSeconds={autoSeconds}
            isHost={isHost}
            ready={me.ready_round >= round}
            onNext={() => void markReady(duel.id, round)}
          />
        </PhoneShell>
      );
    }
    return (
      <PhoneShell>
        <RoundResult
          round={round}
          roundTitle={roundTitle}
          myName={me.display_name}
          opponentName={opponent?.display_name ?? "Opponent"}
          myRoundScore={myResult?.score ?? 0}
          mySummary={myStanding?.summary ?? "No answer"}
          opponentRoundScore={opponentResult?.score ?? 0}
          opponentSummary={opponentStanding?.summary ?? "No answer"}
          myTotal={myTotal}
          opponentTotal={opponentTotal}
          autoSeconds={autoSeconds}
          ready={me.ready_round >= round}
          onNext={() => void markReady(duel.id, round)}
        />
      </PhoneShell>
    );
  }

  const clockActive = clockStart !== null && now >= clockStart;
  const Stage = puzzle ? puzzleDef(puzzle.type).Stage : null;
  const compactTimer = puzzle
    ? [
        "target",
        "blockparty",
        "chaincalc",
        "wordsmith",
        "wordhunt",
        "spotdiff",
        "sudoku",
        "pipes",
        "patcomp",
        "flow",
        "iceslide",
        "push",
      ].includes(puzzle.type)
    : false;

  return (
    <PhoneShell constrained>
      <div className="flex min-h-0 flex-1 flex-col gap-2 animate-phase-in">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Round {round} of {TOTAL_ROUNDS}
          </span>
          <div className="flex items-center gap-3">
            <span className="font-display text-sm font-bold text-foreground">
              {puzzle ? puzzleName(puzzle.type) : ""}
            </span>
            <RoundPips currentRound={round} outcomes={outcomes} />
          </div>
        </div>

        {showTimer && (
          <div
            className={`flex justify-center -my-3 ${
              compactTimer
                ? "h-[88px] shrink-0 items-center scale-[0.7] [@media(max-height:680px)]:h-[80px] [@media(max-height:680px)]:scale-[0.64]"
                : "h-[104px] shrink-0 items-center scale-[0.78]"
            }`}
          >
            <TimerRing
              msRemaining={myResult ? 0 : msRemaining}
              totalMs={timeLimitMs}
              active={clockActive && !myResult}
            />
          </div>
        )}

        {puzzle?.type !== "spotdiff" &&
          puzzle?.type !== "blockparty" &&
          (isMulti ? (
            <SoloScoreStrip
              name={me.display_name}
              total={myTotal}
              position={myStanding?.position ?? 1}
              playerCount={roomPlayers.length}
            />
          ) : (
            <ScoreStrip
              myName={me.display_name}
              opponentName={opponent?.display_name ?? "Opponent"}
              myTotal={myTotal}
              opponentTotal={opponentTotal}
            />
          ))}

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          {puzzle && Stage && (
            <div
              className={`flex min-h-0 flex-1 flex-col ${
                myResult ? "pointer-events-none opacity-30 transition-opacity duration-200" : ""
              }`}
            >
              {/* Keyed by the round alone: mounted once, never re-keyed by room updates. */}
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
            </div>
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
        </div>
      </div>
    </PhoneShell>
  );
}
