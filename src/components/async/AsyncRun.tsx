import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { Dots, WaitingLine } from "@/components/duel/Dots";
import { GameLayout, PhoneShell, isArcadeScreenType } from "@/components/duel/PhoneShell";
import { PuzzleHelp, PuzzleHelpButton } from "@/components/duel/PuzzleInstructions";
import { RoundIntro } from "@/components/duel/RoundIntro";
import { FrameScore } from "@/components/duel/GameFrame";
import { FinishedPingStrip } from "@/components/duel/FinishedPings";
import { ordinal } from "@/lib/duel/ordinal";
import { SteadyOrPlain } from "@/components/duel/SteadyStage";
import { TimerBar } from "@/components/duel/TimerBar";
import { useCrashContext } from "@/lib/useCrashContext";
import { arcadeMsRemaining } from "@/lib/arcade/clock";
import { asyncRoundWindow, currentAsyncRound, type AsyncAttemptView } from "@/lib/duel/asyncRoom";
import {
  asyncAttempt,
  asyncCheckMoves,
  asyncCheckWord,
  asyncReveal,
  startAsyncRound,
  submitAsyncAnswer,
  type AsyncReveal,
} from "@/lib/duel/asyncApi";
import { calibrateServerClock, serverNow } from "@/lib/duel/clock";
import { createDraftKeeper } from "@/lib/duel/roomDraft";
import { createRoomSender, type RoomSendPayload } from "@/lib/duel/roomSend";
import {
  puzzleDef,
  puzzleName,
  puzzlePrepMs,
  puzzleRevealMs,
  puzzleRunMs,
  puzzleShowsTimer,
  puzzleTimeLimitMs,
} from "@/lib/duel/registry";
import { clearStageState, persistStageState } from "@/lib/duel/stageState";
import { roundMusicRemaining, useRoundMusic } from "@/lib/duel/useRoundMusic";
import { INTRO_COUNTDOWN_MS, INTRO_MS, type PuzzleData, type PuzzleType } from "@/lib/duel/types";
import { roundMusicFor } from "@/lib/fx/theme";
import { noteSignatureSubmit } from "@/lib/fx/signature";
import { useSignatureVerdict } from "@/lib/fx/useSignature";
import { buzz } from "@/lib/motion";
import { holdMusicBed, playLock, releaseRoomMusic, stopWarning10, unlockAudio } from "@/lib/sound";
import type { SubmitMeta } from "@/puzzles/types";
import type { ChallengeRoundBoard } from "@/lib/duel/challenge";
import { standings } from "@/lib/duel/scoring";

import {
  RivalRoundResults,
  RivalStandings,
  rivalLooks,
  rivalRevealPlayers,
  rivalRows,
  useRivalPings,
  type AsyncRivals,
} from "./rivals";

/**
 * One player's run through an async room (21 Oct 2026; the daily challenge, later friend
 * challenges): each round's intro, its live play on the player's own clock, and its reveal, then
 * `onDone` with the finished attempt. The round's start is the server's (startAsyncRound): the
 * puzzle arrives only then, and every deadline below is that stamp plus the room's own timings
 * (asyncRoom.ts), on the shared server clock (clock.ts).
 *
 * As in a room: one answer per round (the stage's own submit or the time-out's draft, roomSend.ts,
 * retried while the round takes answers), the draft and the board's inputs kept on the device
 * (roomDraft.ts, stageState.ts) so a reload continues the same round on the same clock, and a
 * round whose clock ran out while the phone was away is sent its draft when the phone is back
 * (graded late, 0 ms left, as a room's reveal-phase answer). The intro waits for READY: the
 * player's clock starts only when they do.
 *
 * With `rivals` (a friend challenge, 22 Oct 2026) the run plays against the earlier players as a room
 * would: their "finished ✓" pings while the round runs, the arcade reveal's chart, then the round
 * leaderboard and the standings, each from the server once this device's own result is stored.
 */

/** RoundIntro's start while it waits for READY: never reaches the 3-2-1. */
const WAITING_INTRO = 8.64e15;

type Step =
  | { kind: "loading" }
  | { kind: "intro"; round: number; type: PuzzleType; introAt: number }
  | { kind: "starting"; round: number; type: PuzzleType; introAt: number }
  | { kind: "puzzle"; round: number; puzzle: PuzzleData; startedAt: number }
  | {
      kind: "reveal";
      round: number;
      puzzle: PuzzleData;
      reveal: AsyncReveal | null;
      shownAt: number;
      /** The earlier players' results for the round (rivals only; undefined while loading). */
      board?: ChallengeRoundBoard | null;
    }
  | { kind: "result" | "standings"; round: number; puzzle: PuzzleData; board: ChallengeRoundBoard }
  | { kind: "error"; message: string };

function useTicker(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

export function AsyncRun({
  roomId,
  title,
  onDone,
  leave,
  rivals,
}: {
  roomId: string;
  /** "Daily Puzzle": the intro's and play header's name for the run. */
  title: string;
  onDone: (view: AsyncAttemptView) => void;
  /** A way back out between rounds (the run continues later from where it was left). */
  leave: ReactNode;
  /** A friend challenge's earlier players (rivals.tsx); a run with none plays alone, as the daily does. */
  rivals?: AsyncRivals | undefined;
}) {
  const [step, setStep] = useState<Step>({ kind: "loading" });
  const [view, setView] = useState<AsyncAttemptView | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const now = useTicker();
  const server = serverNow();
  const sender = useRef(
    createRoomSender((payload: RoomSendPayload) => submitAsyncAnswer(payload)),
  ).current;
  const drafts = useRef(createDraftKeeper()).current;
  const syncing = useRef(false);
  const done = useRef(onDone);
  done.current = onDone;
  const withRivals = !!rivals && rivals.roster.players.some((p) => p.slot !== rivals.roster.mySlot);
  // The last round board seen: the play header's place among the earlier players.
  const lastBoard = useRef<ChallengeRoundBoard | null>(null);

  const roundCount = view?.roundCount ?? 0;
  const stateKey = step.kind === "puzzle" ? `async-${roomId}-${step.round}` : "";
  const puzzle = step.kind === "puzzle" ? step.puzzle : null;
  // Crash reports name the game and round on screen (lib/crashReporting.ts; ids only).
  useCrashContext(
    "puzzle" in step ? step.puzzle.type : "type" in step ? step.type : null,
    "round" in step ? step.round : null,
  );
  // The live puzzle round's board inputs are kept on the device, as in a room (never an arcade run).
  persistStageState(puzzle && !isArcadeScreenType(puzzle.type) ? stateKey : "");

  const sync = useCallback(async () => {
    if (syncing.current) return;
    syncing.current = true;
    try {
      await calibrateServerClock();
      const next = await asyncAttempt(roomId);
      if (!next) {
        setStep({
          kind: "error",
          message: "This challenge couldn't be loaded. Try again in a moment.",
        });
        return;
      }
      setView(next);
      const current = currentAsyncRound(next);
      if (!current) {
        done.current(next);
        return;
      }
      const type = current.type as PuzzleType;
      if (current.startedAt === null) {
        if (serverNow() >= next.closesAt) {
          done.current(next);
          return;
        }
        setStep({ kind: "intro", round: current.round, type, introAt: WAITING_INTRO });
        return;
      }
      // A round already started (a reload): the same puzzle, on the clock it started on.
      const started = await startAsyncRound(roomId, current.round);
      if (!started.ok) {
        setStep({ kind: "error", message: started.message });
        return;
      }
      setStep({
        kind: "puzzle",
        round: current.round,
        puzzle: started.puzzle,
        startedAt: started.startedAt,
      });
    } catch {
      setStep({
        kind: "error",
        message: "Couldn't reach the server. Check your connection and try again.",
      });
    } finally {
      syncing.current = false;
    }
  }, [roomId]);

  useEffect(() => {
    void sync();
  }, [sync]);
  useEffect(() => {
    releaseRoomMusic();
    holdMusicBed("intro_loop");
    return () => {
      stopWarning10();
      releaseRoomMusic();
    };
  }, []);
  useEffect(() => setHelpOpen(false), [step.kind]);

  // READY: the 3-2-1, then the round starts on the server's clock and its puzzle arrives.
  const begin = useCallback(
    async (round: number, type: PuzzleType, introAt: number) => {
      setStep({ kind: "starting", round, type, introAt });
      try {
        const started = await startAsyncRound(roomId, round);
        if (!started.ok) {
          setStep({ kind: "error", message: started.message });
          return;
        }
        setStep({ kind: "puzzle", round, puzzle: started.puzzle, startedAt: started.startedAt });
      } catch {
        setStep({
          kind: "error",
          message: "Couldn't start the round. Check your connection and try again.",
        });
      }
    },
    [roomId],
  );
  useEffect(() => {
    if (step.kind !== "intro" || step.introAt === WAITING_INTRO) return;
    if (now - step.introAt >= INTRO_MS) void begin(step.round, step.type, step.introAt);
  }, [step, now, begin]);

  // The live round's clocks (server time).
  const startedAt = step.kind === "puzzle" ? step.startedAt : null;
  const window_ = puzzle && startedAt !== null ? asyncRoundWindow(puzzle, startedAt) : null;
  const clockStart = startedAt === null ? null : startedAt + puzzlePrepMs(puzzle ?? undefined);
  const timeLimitMs = puzzleTimeLimitMs(puzzle ?? undefined);
  const clockDeadline = clockStart === null ? null : clockStart + timeLimitMs;
  const msRemaining = clockDeadline === null ? timeLimitMs : Math.max(0, clockDeadline - server);
  const runMs = step.kind === "puzzle" ? puzzleRunMs(puzzle ?? undefined) : null;
  const sendKey = step.kind === "puzzle" ? `${roomId}-${step.round}` : "";
  const sent = sendKey !== "" && sender.claimed(sendKey);

  // The time-out sends the round's draft (also at once after a reload past the clock); a send that
  // failed on the way goes again while the round takes answers. Once it lands, the reveal.
  useEffect(() => {
    if (step.kind !== "puzzle" || !window_) return;
    sender.tick(sendKey, server, server < window_.closesAt);
    const status = sender.status(sendKey).status;
    if (
      status === "landed" ||
      status === "given-up" ||
      (status === "none" && server >= window_.closesAt)
    ) {
      if (status === "landed") {
        const round = step.round;
        const shown = step.puzzle;
        setStep({ kind: "reveal", round, puzzle: shown, reveal: null, shownAt: Date.now() });
        clearStageState(stateKey);
        void asyncReveal(roomId, round).then(
          (reveal) => {
            // No stored result to show (the round closed first): on to wherever the attempt is.
            if (!reveal) return void sync();
            setStep((current) =>
              current.kind === "reveal" && current.round === round
                ? { ...current, reveal }
                : current,
            );
            if (!withRivals || !rivals) return;
            // The earlier players' results, released now that this round's own result is stored.
            void rivals.board(round).then(
              (board) => {
                if (board) lastBoard.current = board;
                setStep((current) =>
                  current.kind === "reveal" && current.round === round ? { ...current, board } : current,
                );
              },
              () =>
                setStep((current) =>
                  current.kind === "reveal" && current.round === round ? { ...current, board: null } : current,
                ),
            );
          },
          () => void sync(),
        );
      } else void sync();
      return;
    }
    if (server < window_.timeoutAt || sender.claimed(sendKey)) return;
    noteSignatureSubmit(step.puzzle.type);
    sender.send(
      sendKey,
      { duelId: roomId, roundNumber: step.round, answer: drafts.current(stateKey), msRemaining: 0 },
      server,
    );
  }, [step, server]); // eslint-disable-line react-hooks/exhaustive-deps

  // The reveal stays as long as a room's, then the next round's intro (or the results).
  useEffect(() => {
    if (step.kind !== "reveal" || !step.reveal) return;
    if (now - step.shownAt < puzzleRevealMs(step.puzzle)) return;
    // With earlier players: their round leaderboard and the standings first (once their results are in).
    if (withRivals && step.board === undefined) return;
    if (withRivals && step.board) {
      setStep({ kind: "result", round: step.round, puzzle: step.puzzle, board: step.board });
      return;
    }
    void sync();
  }, [step, now, sync, withRivals]);

  // The live round's pings from the earlier players (rivals only; never their results).
  const pingKey = step.kind === "puzzle" ? `async-${roomId}-${step.round}` : "";
  const pings = useRivalPings(
    withRivals ? rivals : undefined,
    step.kind === "puzzle" ? step.round : 0,
    step.kind === "puzzle" && !(pingKey !== "" && sender.claimed(`${roomId}-${step.round}`)),
    pingKey,
  );
  const looks = useMemo(() => (rivals ? rivalLooks(rivals.roster.players) : new Map()), [rivals]);

  const latest = useRef({ step, clockDeadline, stateKey });
  latest.current = { step, clockDeadline, stateKey };

  const handleSubmit = useCallback(
    (answer: string, meta?: SubmitMeta) => {
      const at = serverNow();
      const { step: current, clockDeadline: deadline, stateKey: key } = latest.current;
      if (current.kind !== "puzzle") return;
      const sending = `${roomId}-${current.round}`;
      if (sender.claimed(sending)) return;
      noteSignatureSubmit(current.puzzle.type);
      unlockAudio();
      playLock();
      buzz(15);
      drafts.push(key, answer, true);
      sender.send(
        sending,
        {
          duelId: roomId,
          roundNumber: current.round,
          answer,
          msRemaining: deadline === null ? 0 : Math.max(0, deadline - at),
          extra: {
            reactionAvgMs: meta?.reactionAvgMs,
            correctCount: meta?.correctCount,
            errors: meta?.errors,
          },
        },
        at,
      );
    },
    [roomId],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const handleDraft = useCallback(
    (answer: string) => drafts.push(latest.current.stateKey, answer),
    [],
  ); // eslint-disable-line react-hooks/exhaustive-deps
  const handleCheckWord = useCallback(
    (word: string, found: string[], path?: number[]) => {
      const current = latest.current.step;
      return asyncCheckWord(
        roomId,
        current.kind === "puzzle" ? current.round : 0,
        word,
        found,
        path,
      );
    },
    [roomId],
  );
  const handleCheckMoves = useCallback(
    (moves: string) => {
      const current = latest.current.step;
      return asyncCheckMoves(roomId, current.kind === "puzzle" ? current.round : 0, moves);
    },
    [roomId],
  );

  // The signature beat once this round's stored verdict arrives.
  const revealKey = step.kind === "reveal" && step.reveal ? `async-${roomId}-${step.round}` : null;
  const verdict = useMemo(
    () =>
      step.kind === "reveal" && step.reveal
        ? {
            type: step.puzzle.type,
            arcade: puzzleDef(step.puzzle.type).category === "arcade",
            correct: step.reveal.result.is_correct,
            score: step.reveal.result.score,
            msRemaining: step.reveal.result.ms_remaining,
            timeLimitMs: puzzleTimeLimitMs(step.puzzle),
          }
        : null,
    [step],
  );
  useSignatureVerdict(revealKey, verdict);

  // Round music, owned here as in practice: from the 3-2-1 to the clock or the round's end.
  const introType = step.kind === "intro" || step.kind === "starting" ? step.type : null;
  const musicType = puzzle?.type ?? introType;
  const countdownBegun =
    (step.kind === "intro" &&
      step.introAt !== WAITING_INTRO &&
      now - step.introAt >= INTRO_MS - INTRO_COUNTDOWN_MS) ||
    step.kind === "starting";
  const musicRemaining =
    step.kind === "puzzle"
      ? roundMusicRemaining(msRemaining, runMs, clockStart, server, arcadeMsRemaining)
      : null;
  useRoundMusic(
    {
      key:
        step.kind === "puzzle" || step.kind === "starting" || step.kind === "intro"
          ? `async-${roomId}-${"round" in step ? step.round : 0}`
          : "",
      track: musicType ? roundMusicFor(musicType, puzzleDef(musicType).category) : null,
      on: countdownBegun || (step.kind === "puzzle" && !sent && (musicRemaining ?? 1) > 0),
      remainingMs: musicRemaining,
      reason:
        step.kind === "puzzle"
          ? sent
            ? "early-end"
            : "timer"
          : step.kind === "reveal"
            ? "reveal"
            : "left-intro",
    },
    "left-async",
  );

  if (step.kind === "error") {
    return (
      <PhoneShell skin="play" topAction={leave}>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">{step.message}</p>
          <button
            type="button"
            onClick={() => void sync()}
            className="th-btn-gold press tap-target w-full max-w-xs rounded-xl bg-primary px-6 font-display text-base font-extrabold uppercase tracking-wide text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </PhoneShell>
    );
  }

  if (step.kind === "loading" || !view) {
    return (
      <PhoneShell skin="play">
        <div className="flex flex-1 items-center justify-center">
          <WaitingLine label={`Loading ${title}`} />
        </div>
      </PhoneShell>
    );
  }

  if (step.kind === "intro" || step.kind === "starting") {
    const counting = step.kind === "starting" || step.introAt !== WAITING_INTRO;
    return (
      // The intro draws the game frame's header itself (RoundIntro, Polish batch R).
      <PhoneShell gameType={step.type} bare>
        <RoundIntro
          topAction={counting ? undefined : leave}
          round={step.round}
          totalRounds={roundCount}
          type={step.type}
          startedAt={step.introAt}
          now={now}
          outcomes={[]}
          autoStart={false}
          ready={counting}
          onReady={() => {
            if (step.kind !== "intro" || step.introAt !== WAITING_INTRO) return;
            unlockAudio();
            playLock();
            buzz(15);
            setStep({ ...step, introAt: Date.now() - (INTRO_MS - INTRO_COUNTDOWN_MS) });
          }}
        />
      </PhoneShell>
    );
  }

  if (step.kind === "result" || step.kind === "standings") {
    const { board, puzzle: shown, round } = step;
    return (
      <PhoneShell skin="room" gameType={shown.type} topAction={leave}>
        {step.kind === "result" ? (
          <RivalRoundResults
            key={`result-${round}`}
            board={board}
            puzzle={shown}
            roundCount={roundCount}
            onNext={() => setStep({ kind: "standings", round, puzzle: shown, board })}
          />
        ) : (
          <RivalStandings key={`standings-${round}`} board={board} puzzle={shown} roundCount={roundCount} onNext={() => void sync()} />
        )}
      </PhoneShell>
    );
  }

  if (step.kind === "reveal") {
    const reveal = step.reveal;
    return (
      <PhoneShell constrained gameScreen gameType={step.puzzle.type}>
        <AnswerReveal
          round={step.round}
          totalRounds={roundCount}
          puzzle={reveal?.puzzle ?? step.puzzle}
          answersReady={!!reveal}
          myAnswer={reveal?.result.answer ?? null}
          myCorrect={!!reveal?.result.is_correct}
          myReactionAvgMs={reveal?.result.reaction_avg_ms ?? null}
          myMsRemaining={reveal?.result.ms_remaining ?? 0}
          myScore={reveal ? reveal.result.score : null}
          myExtra={reveal?.result.extra ?? null}
          {...(step.board ? { players: rivalRevealPlayers(step.board, looks) } : {})}
          startedAt={step.shownAt}
          now={now}
        />
      </PhoneShell>
    );
  }

  if (step.kind !== "puzzle") return null;
  const shownPuzzle = step.puzzle;
  const Stage = puzzleDef(shownPuzzle.type).Stage;
  const clockActive = clockStart !== null && server >= clockStart;
  // The frame's score block: my total so far; with earlier players, my place under it and their pings
  // over the header's name and context line.
  const totalSoFar = view.rounds.reduce((sum, r) => sum + (r.round < step.round ? (r.score ?? 0) : 0), 0);
  let place: string | undefined;
  let pingStrip: ReactNode = null;
  if (withRivals && rivals) {
    const board = lastBoard.current;
    const playedThrough = step.round - 1;
    const table =
      board && board.round === playedThrough
        ? standings(rivalRows(board.players), board.results, playedThrough, new Map(), board.tie)
        : null;
    const mine = table?.find((row) => row.slot === rivals.roster.mySlot);
    pingStrip = pings.length ? <FinishedPingStrip pings={pings} looks={looks} lines={2} /> : null;
    place = `${ordinal(mine?.position ?? 1)} of ${rivals.roster.players.length}`;
  }
  const frameScore = <FrameScore value={totalSoFar} note={place} />;
  return (
    <PhoneShell constrained gameScreen play gameType={shownPuzzle.type}>
      <GameLayout
        ping={pingStrip}
        // A friend challenge counts its rounds like a room; the daily says so.
        label={rivals ? `Round ${step.round} of ${roundCount}` : "Daily"}
        title={puzzleName(shownPuzzle.type)}
        help={<PuzzleHelpButton onClick={() => setHelpOpen(true)} />}
        score={frameScore}
        timer={
          puzzleShowsTimer(shownPuzzle) ? (
            <TimerBar
              msRemaining={sent ? 0 : runMs !== null ? arcadeMsRemaining(runMs) : msRemaining}
              totalMs={runMs ?? timeLimitMs}
              active={clockActive && !sent}
            />
          ) : undefined
        }
        beforeGame={
          shownPuzzle.type === "balance" ? (
            <div id={`balance-progress-${stateKey}`} className="h-3 w-full shrink-0" />
          ) : undefined
        }
        locked={sent}
        overlay={
          <>
            <PuzzleHelp
              type={shownPuzzle.type}
              open={helpOpen}
              onClose={() => setHelpOpen(false)}
            />
            {sent && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <span className="animate-stamp-in rounded-lg border-2 border-primary px-4 py-2 font-display text-lg font-bold uppercase tracking-[0.2em] text-primary">
                  Locked
                </span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  Scoring <Dots />
                </span>
              </div>
            )}
          </>
        }
      >
        <SteadyOrPlain
          Stage={Stage}
          steady={isArcadeScreenType(shownPuzzle.type)}
          key={stateKey}
          stateKey={stateKey}
          puzzle={shownPuzzle}
          phaseStartedAt={step.startedAt}
          now={server}
          locked={sent}
          onSubmit={handleSubmit}
          onDraftAnswer={handleDraft}
          checkWord={handleCheckWord}
          checkMoves={handleCheckMoves}
        />
      </GameLayout>
    </PhoneShell>
  );
}
