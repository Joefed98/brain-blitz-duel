import { useEffect, useState, type ReactNode } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { AnswerReveal } from "@/components/duel/AnswerReveal";
import { WaitingLine } from "@/components/duel/Dots";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { RoundHighlightView } from "@/components/replay/RoundHighlight";
import { ReplayBoundary } from "@/components/replay/ReplayBoundary";
import { asyncReveal, type AsyncReveal } from "@/lib/duel/asyncApi";
import type { AsyncAttemptView } from "@/lib/duel/asyncRoom";
import { puzzleName } from "@/lib/duel/registry";
import {
  VERDICT_LABEL,
  VERDICT_TONE,
  roundVerdict,
  scoreOnlyVerdict,
  summaryWithoutTime,
} from "@/lib/duel/resultPresentation";
import type { ReplayRound } from "@/lib/replay/replay.server";
import type { PuzzleType } from "@/lib/duel/types";

/**
 * An async room's results for the player who has finished it (21 Oct 2026; the daily challenge):
 * their total and place, then every round as the round leaderboard's rows draw them (game, time ·
 * verdict · summary on one line, the stored score), each opening its reveal and the player's own
 * replay (RoundHighlightView, the results screen's highlight), then on to the leaderboard. Only the
 * player's own rounds, fetched one by one from the server (asyncRevealFn).
 */
export function AsyncResults({
  roomId,
  view,
  title,
  placeLine,
  onBoard,
  boardLabel = "See leaderboard",
  actions,
  share,
}: {
  roomId: string;
  view: AsyncAttemptView;
  title: string;
  /** "3rd of 45" (or "3rd" under the cold-start count); null while unknown. */
  placeLine: string | null;
  onBoard: () => void;
  boardLabel?: string;
  /** In place of the board button (a friend challenge's creator: Send the challenge, Done). */
  actions?: ReactNode;
  /** A Share button beside the board button (the daily's). */
  share?: ReactNode;
}) {
  const [reveals, setReveals] = useState<(AsyncReveal | null | undefined)[]>(() =>
    view.rounds.map(() => undefined),
  );
  const [open, setOpen] = useState<number | null>(null);
  const [revealing, setRevealing] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let live = true;
    view.rounds.forEach((round, index) => {
      void asyncReveal(roomId, round.round).then(
        (reveal) => live && setReveals((list) => list.map((r, i) => (i === index ? reveal : r))),
        () => live && setReveals((list) => list.map((r, i) => (i === index ? null : r))),
      );
    });
    return () => {
      live = false;
    };
  }, [roomId, view]);
  useEffect(() => {
    if (revealing === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [revealing]);

  const shown = revealing !== null ? reveals[revealing - 1] : null;
  if (revealing !== null && shown) {
    return (
      <PhoneShell constrained gameScreen gameType={shown.puzzle.type}>
        <AnswerReveal
          round={revealing}
          totalRounds={view.roundCount}
          puzzle={shown.puzzle}
          answersReady
          myAnswer={shown.result.answer}
          myCorrect={shown.result.is_correct}
          myReactionAvgMs={shown.result.reaction_avg_ms}
          myMsRemaining={shown.result.ms_remaining}
          myScore={shown.result.score}
          myExtra={shown.result.extra}
          startedAt={0}
          now={now}
        />
        <button
          type="button"
          data-async-back
          onClick={() => setRevealing(null)}
          className="th-btn-ghost press tap-target mx-auto mt-2 w-full max-w-xs shrink-0 whitespace-nowrap rounded-xl border border-border bg-card font-display text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          Back to results
        </button>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell skin="play">
      <div data-async-results className="flex flex-1 flex-col gap-4 animate-phase-in">
        <header className="flex flex-col items-center gap-1 text-center">
          <p className="th-kicker text-primary">{title} · Results</p>
          <p className="th-score th-score-top font-mono text-6xl font-bold tabular-nums text-primary animate-pop-in">
            {view.total}
          </p>
          <p
            className="whitespace-nowrap font-display text-sm font-bold uppercase tracking-wide text-foreground"
            data-async-place
          >
            {placeLine ?? " "}
          </p>
        </header>

        <ol className="flex flex-col gap-1.5">
          {view.rounds.map((round, index) => {
            const reveal = reveals[index];
            const type = round.type as PuzzleType;
            const score = round.score ?? 0;
            const verdict = roundVerdict(
              { roundCorrect: reveal ? reveal.result.is_correct : null, roundScore: score },
              scoreOnlyVerdict(type),
            );
            const summary = reveal
              ? round.missed
                ? "No answer"
                : summaryWithoutTime(reveal.summary)
              : "";
            const expanded = open === round.round;
            const replay: ReplayRound | null =
              reveal && !round.missed
                ? {
                    round: round.round,
                    puzzle: reveal.puzzle,
                    winner: {
                      slot: 1,
                      name: "You",
                      score: reveal.result.score,
                      isCorrect: reveal.result.is_correct,
                      answer: reveal.result.answer,
                      extra: reveal.result.extra as never,
                      reactionAvgMs: reveal.result.reaction_avg_ms,
                      msRemaining: reveal.result.ms_remaining,
                    },
                    runnerUp: 0,
                    answered: 1,
                  }
                : null;
            return (
              <li key={round.round} data-async-round={round.round}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen((value) => (value === round.round ? null : round.round))}
                  className="th-card grid min-h-[52px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-lg border border-border bg-card px-2 py-1.5 text-left"
                >
                  <GameIcon type={type} size={36} />
                  <span className="flex min-w-0 flex-col">
                    <span className="th-name truncate text-sm leading-tight text-foreground">
                      {round.round}. {puzzleName(type)}
                    </span>
                    <span
                      data-ellipsis
                      data-row-line
                      className="block truncate font-mono text-[11px] leading-tight text-muted-foreground"
                    >
                      {reveal === undefined ? (
                        "…"
                      ) : (
                        <>
                          <span
                            data-verdict={verdict}
                            className={`font-bold ${VERDICT_TONE[verdict]}`}
                          >
                            {round.missed ? "✗" : VERDICT_LABEL[verdict]}
                          </span>
                          {summary ? ` · ${summary}` : ""}
                        </>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className={`th-score w-14 text-right font-mono text-2xl font-bold tabular-nums ${score >= 150 ? "th-score-top text-primary" : "text-foreground"}`}
                    >
                      {score}
                    </span>
                    <span
                      aria-hidden="true"
                      className="w-3 text-center font-mono text-[11px] text-muted-foreground"
                    >
                      {expanded ? "▴" : "▾"}
                    </span>
                  </span>
                </button>
                {expanded ? (
                  <div className="mt-1.5 flex flex-col gap-2 rounded-lg border border-border/60 bg-card/60 p-2">
                    {reveal ? (
                      <>
                        {reveal.detail.length > 0 ? (
                          <p className="font-mono text-[11px] text-muted-foreground">
                            {reveal.detail.join(" · ")}
                          </p>
                        ) : null}
                        {replay ? (
                          <ReplayBoundary>
                            <RoundHighlightView round={replay} players={2} />
                          </ReplayBoundary>
                        ) : null}
                        <button
                          type="button"
                          data-async-reveal={round.round}
                          onClick={() => setRevealing(round.round)}
                          className="th-btn-outline-gold press tap-target w-full whitespace-nowrap rounded-xl border border-primary/70 bg-primary/10 font-display text-xs font-bold uppercase tracking-widest text-primary"
                        >
                          See the reveal
                        </button>
                      </>
                    ) : (
                      <WaitingLine label="Loading" />
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>

        {actions ?? (
          <div className="mt-auto flex gap-2">
            <button
              type="button"
              data-async-board
              onClick={onBoard}
              className="th-btn-gold press tap-target min-w-0 flex-1 whitespace-nowrap rounded-xl bg-primary px-4 py-3 font-display text-base font-extrabold uppercase tracking-wide text-primary-foreground"
            >
              {boardLabel}
            </button>
            {share}
          </div>
        )}
      </div>
    </PhoneShell>
  );
}
