import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { CountdownTimer } from "@/components/duel/CountdownTimer";
import { FinalResult } from "@/components/duel/FinalResult";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { PuzzleStage } from "@/components/duel/PuzzleStage";
import { RoundResult } from "@/components/duel/RoundResult";
import { ScoreStrip } from "@/components/duel/ScoreStrip";
import {
  advanceRound,
  ensureRematch,
  markReady,
  startDuel,
  submitAnswer,
} from "@/lib/duel/api";
import { serverNow, toMs } from "@/lib/duel/clock";
import { duelOutcome, resultFor, roundBreakdown, totalScore } from "@/lib/duel/scoring";
import { getStoredName } from "@/lib/duel/session";
import { useDuel } from "@/lib/duel/useDuel";
import {
  NEXT_ROUND_AUTO_MS,
  PUZZLE_LABELS,
  ROUND_MS,
  TOTAL_ROUNDS,
  puzzlePrepMs,
} from "@/lib/duel/types";

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
  const resultShownAt = useRef<Record<number, number>>({});

  const round = duel?.current_round ?? 0;
  const puzzle = duel && round > 0 ? duel.puzzles[round - 1] : undefined;
  const startedAt = toMs(duel?.round_started_at ?? null);
  const clockStart = startedAt === null ? null : startedAt + puzzlePrepMs(puzzle);
  const deadline = clockStart === null ? null : clockStart + ROUND_MS;
  const inCountdown = startedAt !== null && now < startedAt;
  const msRemaining = deadline === null ? ROUND_MS : Math.max(0, deadline - now);

  const mySlot = me?.player_slot ?? 0;
  const opponentSlot = opponent?.player_slot ?? (mySlot === 1 ? 2 : 1);
  const myResult = resultFor(results, mySlot, round);
  const opponentResult = resultFor(results, opponentSlot, round);
  const myTotal = totalScore(results, mySlot);
  const opponentTotal = totalScore(results, opponentSlot);

  // Slot 1 starts the duel as soon as both players are in.
  useEffect(() => {
    if (!duel || !me) return;
    if (duel.status === "waiting" && players.length === 2 && me.player_slot === 1) {
      void startDuel(duel.id);
    }
  }, [duel?.id, duel?.status, players.length, me?.player_slot]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer ran out without a submission — record a zero for this round.
  useEffect(() => {
    if (!duel || !me || !puzzle || duel.status !== "in_progress") return;
    if (deadline === null || now < deadline || myResult) return;
    const key = `${duel.id}-${round}`;
    if (timeoutSubmitted.current === key) return;
    timeoutSubmitted.current = key;
    void submitAnswer({
      duelId: duel.id,
      playerSlot: me.player_slot,
      roundNumber: round,
      puzzle,
      answer: "",
      msRemaining: 0,
    });
  }, [duel?.id, duel?.status, round, now, deadline, myResult, me?.player_slot, puzzle]); // eslint-disable-line react-hooks/exhaustive-deps

  const roundOver =
    !!myResult && (!!opponentResult || (deadline !== null && now > deadline + 1200));

  // Auto-continue after 10 seconds on the round result screen.
  useEffect(() => {
    if (!roundOver || !me || !duel) return;
    if (!resultShownAt.current[round]) resultShownAt.current[round] = now;
    const shownAt = resultShownAt.current[round]!;
    if (me.ready_round < round && now - shownAt > NEXT_ROUND_AUTO_MS) {
      void markReady(me.id, round);
    }
  }, [roundOver, now, round, me?.id, me?.ready_round, duel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Slot 1 moves the shared duel state on once both players are ready.
  useEffect(() => {
    if (!duel || !me || me.player_slot !== 1 || duel.status !== "in_progress") return;
    if (players.length < 2) return;
    if (players.every((p) => p.ready_round >= round) && round > 0) {
      void advanceRound(duel);
    }
  }, [duel, players, me?.player_slot, round]); // eslint-disable-line react-hooks/exhaustive-deps

  // Both phones follow the rematch duel as soon as it exists.
  useEffect(() => {
    if (!duel?.next_duel_id || !me) return;
    let cancelled = false;
    void (async () => {
      const { ensureJoined, fetchDuelById } = await import("@/lib/duel/api");
      try {
        await ensureJoined(duel.next_duel_id!, me.display_name || getStoredName() || "Player");
        const next = await fetchDuelById(duel.next_duel_id!);
        if (next && !cancelled) {
          await navigate({ to: "/duel/$code", params: { code: next.room_code } });
        }
      } catch {
        /* opponent-only rematch; ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [duel?.next_duel_id, me?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = (answer: string) => {
    if (!duel || !me || !puzzle || myResult || deadline === null) return;
    void submitAnswer({
      duelId: duel.id,
      playerSlot: me.player_slot,
      roundNumber: round,
      puzzle,
      answer,
      msRemaining: Math.max(0, deadline - serverNow()),
    });
  };

  const handlePlayAgain = async () => {
    if (!duel || !me) return;
    setRematchBusy(true);
    try {
      const next = await ensureRematch(duel, me.display_name);
      await navigate({ to: "/duel/$code", params: { code: next.room_code } });
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
          myTotal={myTotal}
          opponentTotal={opponentTotal}
          breakdown={roundBreakdown(results, mySlot, opponentSlot)}
          roundOrder={duel.round_order}
          busy={rematchBusy}
          onPlayAgain={() => void handlePlayAgain()}
          onHome={() => void navigate({ to: "/" })}
        />
      </PhoneShell>
    );
  }

  if (inCountdown) {
    const secondsLeft = Math.max(1, Math.ceil(((startedAt ?? now) - now) / 1000));
    return (
      <Centered>
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Round {round} of {TOTAL_ROUNDS}
        </p>
        <p className="font-mono text-8xl font-bold text-primary">
          {secondsLeft > 0 ? secondsLeft : "GO"}
        </p>
      </Centered>
    );
  }

  if (roundOver) {
    const shownAt = resultShownAt.current[round] ?? now;
    const autoSeconds = Math.max(
      0,
      Math.ceil((NEXT_ROUND_AUTO_MS - (now - shownAt)) / 1000),
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
          onNext={() => void markReady(me.id, round)}
        />
      </PhoneShell>
    );
  }

  const clockActive = clockStart !== null && now >= clockStart;

  return (
    <PhoneShell>
      <div className="flex flex-1 flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Round {round} of {TOTAL_ROUNDS}
          </span>
          <span className="font-display text-sm font-bold text-foreground">
            {puzzle ? PUZZLE_LABELS[puzzle.type] : ""}
          </span>
        </div>

        <div className="flex justify-center">
          <CountdownTimer msRemaining={msRemaining} active={clockActive} />
        </div>

        <ScoreStrip
          myName={me.display_name}
          opponentName={opponent?.display_name ?? "Opponent"}
          myTotal={myTotal}
          opponentTotal={opponentTotal}
        />

        {puzzle && (
          <PuzzleStage
            puzzle={puzzle}
            roundStartedAt={startedAt ?? now}
            now={now}
            locked={!!myResult}
            onSubmit={handleSubmit}
          />
        )}

        {myResult && (
          <p className="pb-2 text-center text-sm text-muted-foreground">
            Answer locked in — waiting for opponent…
          </p>
        )}
      </div>
    </PhoneShell>
  );
}
