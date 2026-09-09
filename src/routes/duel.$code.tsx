import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { CountdownTimer } from "@/components/duel/CountdownTimer";
import { FinalResult } from "@/components/duel/FinalResult";
import { PhoneShell } from "@/components/duel/PhoneShell";

import { RoundIntro } from "@/components/duel/RoundIntro";
import { RoundResult } from "@/components/duel/RoundResult";
import { ScoreStrip } from "@/components/duel/ScoreStrip";
import {
  advancePhase,
  ensureRematch,
  fetchRevealPuzzle,
  markReady,
  submitAnswer,
} from "@/lib/duel/api";
import { serverNow, toMs } from "@/lib/duel/clock";
import {
  duelOutcome,
  resultFor,
  roundBreakdown,
  totalScore,
  totalScoreThrough,
} from "@/lib/duel/scoring";
import { getStoredName } from "@/lib/duel/session";
import { useDuel } from "@/lib/duel/useDuel";
import {
  puzzleDef,
  puzzleDurationMs,
  puzzleName,
  puzzlePrepMs,
  puzzleShowsTimer,
} from "@/lib/duel/registry";
import {
  INTRO_MS,
  NEXT_ROUND_AUTO_MS,
  REVEAL_MS,
  ROUND_MS,
  TOTAL_ROUNDS,
  type PuzzleData,
} from "@/lib/duel/types";
import type { SubmitMeta } from "@/puzzles/types";

export const Route = createFileRoute("/duel/$code")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Duel in progress — Duelz" },
      {
        name: "description",
        content: "Three timed puzzles, head to head. Solve faster than your opponent to win.",
      },
      { property: "og:title", content: "Duel in progress — Duelz" },
      {
        property: "og:description",
        content: "Three timed puzzles, head to head. Solve faster than your opponent to win.",
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

function DuelScreen() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const roomCode = code.toUpperCase();
  const state = useDuel(roomCode);
  const { duel, players, results, me, opponent, now } = state;

  const [rematchBusy, setRematchBusy] = useState(false);
  const timeoutSubmitted = useRef<string>("");
  const lastAdvance = useRef(0);
  const dueSince = useRef(0);
  const [revealed, setRevealed] = useState<{ round: number; puzzle: PuzzleData } | null>(null);

  const round = duel?.current_round ?? 0;
  const puzzle = duel && round > 0 ? duel.puzzles_public[round - 1] : undefined;
  const phase = duel?.phase ?? "intro";
  const phaseStart = toMs(duel?.phase_started_at ?? null) ?? toMs(duel?.round_started_at ?? null);

  // The clock starts once any puzzle preparation (sequence playback) is done.
  const puzzleStart = phase === "puzzle" ? phaseStart : null;
  const clockStart = puzzleStart === null ? null : puzzleStart + puzzlePrepMs(puzzle);
  // End of the puzzle phase. Most types run for 30s; Reaction Time has its own length.
  const deadline = puzzleStart === null ? null : puzzleStart + puzzleDurationMs(puzzle);
  const showTimer = puzzleShowsTimer(puzzle);
  const clockDeadline = clockStart === null ? null : clockStart + ROUND_MS;
  const msRemaining = clockDeadline === null ? ROUND_MS : Math.max(0, clockDeadline - now);

  const mySlot = me?.player_slot ?? 0;
  const opponentSlot = opponent?.player_slot ?? (mySlot === 1 ? 2 : 1);
  const myResult = resultFor(results, mySlot, round);
  const opponentResult = resultFor(results, opponentSlot, round);

  // Scores stay hidden until a round is fully over.
  const scoredThrough = phase === "result" ? round : round - 1;
  const myTotal = totalScoreThrough(results, mySlot, scoredThrough);
  const opponentTotal = totalScoreThrough(results, opponentSlot, scoredThrough);

  const isHost = me?.player_slot === 1;

  // Kick the duel off if both players are in but the server hasn't started it.
  useEffect(() => {
    if (!duel || !me) return;
    if (duel.status === "waiting" && players.length === 2) void advancePhase(duel.id);
  }, [duel?.id, duel?.status, players.length, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      answer: "",
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
    if (phase === "intro") due = elapsed >= INTRO_MS;
    else if (phase === "puzzle")
      due = (!!myResult && !!opponentResult) || (deadline !== null && now > deadline + 800);
    else if (phase === "reveal") due = elapsed >= REVEAL_MS;
    else
      due =
        (players.length === 2 && players.every((p) => p.ready_round >= round)) ||
        elapsed >= NEXT_ROUND_AUTO_MS;

    if (!due) {
      dueSince.current = 0;
      return;
    }
    if (dueSince.current === 0) dueSince.current = now;
    if (!isHost && now - dueSince.current < 2_500) return;
    if (Date.now() - lastAdvance.current < 1_500) return;
    lastAdvance.current = Date.now();
    void advancePhase(duel.id);
  }, [duel, isHost, phase, phaseStart, now, round, players, myResult, opponentResult, deadline]); // eslint-disable-line react-hooks/exhaustive-deps

  // The correct answer only exists on the client once the round has ended.
  useEffect(() => {
    if (!duel || round < 1 || phase !== "reveal") return;
    if (revealed?.round === round) return;
    let cancelled = false;
    void fetchRevealPuzzle(duel.id, round).then((found) => {
      if (found && !cancelled) setRevealed({ round, puzzle: found });
    });
    return () => {
      cancelled = true;
    };
  }, [duel?.id, phase, round, revealed?.round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Both phones follow the rematch duel as soon as it exists.
  useEffect(() => {
    if (!duel?.next_duel_id || !me) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await ensureRematch(duel.id, me.display_name || getStoredName() || "Player");
        if (!cancelled) await navigate({ to: "/duel/$code", params: { code: next.roomCode } });
      } catch {
        /* opponent-only rematch; ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [duel?.next_duel_id, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (answer: string, meta?: SubmitMeta) => {
    if (!duel || !me || !puzzle || myResult) return;
    void submitAnswer({
      duelId: duel.id,
      roundNumber: round,
      answer,
      msRemaining: clockDeadline === null ? 0 : Math.max(0, clockDeadline - serverNow()),
      extra: {
        reactionAvgMs: meta?.reactionAvgMs,
        correctCount: meta?.correctCount,
        errors: meta?.errors,
      },
    });
  };

  const handlePlayAgain = async () => {
    if (!duel || !me) return;
    setRematchBusy(true);
    try {
      const next = await ensureRematch(duel.id, me.display_name);
      await navigate({ to: "/duel/$code", params: { code: next.roomCode } });
    } catch {
      setRematchBusy(false);
    }
  };

  if (state.loading) {
    return (
      <Centered>
        <p className="text-sm text-muted-foreground">Loading duel…</p>
      </Centered>
    );
  }

  if (state.notFound || !duel) {
    return (
      <Centered>
        <h1 className="font-display text-2xl">Duel not found</h1>
        <p className="text-sm text-muted-foreground">
          No duel exists with the code {roomCode}.
        </p>
        <HomeButton />
      </Centered>
    );
  }

  if (!me) {
    return (
      <Centered>
        <h1 className="font-display text-2xl">You're not in this duel</h1>
        <p className="text-sm text-muted-foreground">
          Head back home and join with the room code.
        </p>
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
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Room code</p>
          <p className="font-mono text-6xl font-bold tracking-[0.2em] text-primary">
            {duel.room_code}
          </p>
          <p className="text-sm text-muted-foreground">Waiting for opponent…</p>
          <div className="flex w-full flex-col gap-2">
            {players.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl px-4 py-3 text-left font-display text-sm ${
                  p.player_slot === me.player_slot
                    ? "border border-me/40 bg-me/10 text-me"
                    : "border border-opponent/40 bg-opponent/10 text-opponent"
                }`}
              >
                {p.display_name}
                {p.player_slot === me.player_slot && " (you)"}
              </div>
            ))}
          </div>
        </div>
      </PhoneShell>
    );
  }

  if (duel.status === "finished") {
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
        />
      </PhoneShell>
    );
  }

  if (phase === "reveal" && puzzle) {
    return (
      <PhoneShell>
        <AnswerReveal
          round={round}
          puzzle={revealed?.round === round ? revealed.puzzle : puzzle}
          myAnswer={myResult?.answer ?? null}
          myCorrect={!!myResult?.is_correct}
          myReactionAvgMs={myResult?.reaction_avg_ms ?? null}
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
    return (
      <PhoneShell>
        <RoundResult
          round={round}
          myName={me.display_name}
          opponentName={opponent?.display_name ?? "Opponent"}
          myRoundScore={myResult?.score ?? 0}
          opponentRoundScore={opponentResult?.score ?? 0}
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

  return (
    <PhoneShell>
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Round {round} of {TOTAL_ROUNDS}
          </span>
          <span className="font-display text-sm font-bold text-foreground">
            {puzzle ? puzzleName(puzzle.type) : ""}
          </span>
        </div>

        {showTimer && (
          <div className="flex justify-center">
            <CountdownTimer msRemaining={msRemaining} active={clockActive} />
          </div>
        )}

        <ScoreStrip
          myName={me.display_name}
          opponentName={opponent?.display_name ?? "Opponent"}
          myTotal={myTotal}
          opponentTotal={opponentTotal}
        />

        {puzzle && Stage && (
          <Stage
            puzzle={puzzle}
            phaseStartedAt={puzzleStart ?? now}
            now={now}
            locked={!!myResult}
            onSubmit={handleSubmit}
          />
        )}

        {myResult && (
          <p className="pb-2 text-center text-sm text-muted-foreground">
            Answer locked — waiting for opponent…
          </p>
        )}
      </div>
    </PhoneShell>
  );
}
