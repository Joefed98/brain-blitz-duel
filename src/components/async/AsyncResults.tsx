import { useEffect, useState, type ReactNode } from "react";

import { ChevronDown } from "lucide-react";
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
import { Button } from "@/design/components";

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
  footer,
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
  /** Under the buttons (the daily's SEND FEEDBACK link). */
  footer?: ReactNode;
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
      <PhoneShell constrained gameScreen reveal gameType={shown.puzzle.type}>
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
          heroRun={false}
          startedAt={0}
          now={now}
        />
        <Button
          variant="secondary"
          block
          data-async-back
          onClick={() => setRevealing(null)}
          className="mx-auto mt-2 max-w-xs shrink-0"
        >
          Back to results
        </Button>
      </PhoneShell>
    );
  }

  return (
    <PhoneShell skin="play">
      <div data-async-results className="flex flex-1 flex-col gap-4 animate-phase-in">
        <header className="flex flex-col items-center gap-1 text-center">
          <p className="th-kicker">{title}, results</p>
          <p className="th-score text-6xl tabular-nums text-foreground animate-pop-in">
            {view.total}
          </p>
          <p
            className="whitespace-nowrap text-[15px] font-semibold text-foreground"
            data-async-place
          >
            {placeLine ?? " "}
          </p>
        </header>

        <ol className="rs-list">
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
              <li key={round.round} data-async-round={round.round} className="rs-row block p-0">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen((value) => (value === round.round ? null : round.round))}
                  className="grid min-h-[56px] w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2.5 py-1.5 pl-3 pr-2 text-left"
                >
                  <GameIcon type={type} size={36} />
                  <span className="flex min-w-0 flex-col">
                    <span className="rs-name leading-tight">{puzzleName(type)}</span>
                    <span
                      data-ellipsis
                      data-row-line
                      className="block truncate text-[12.5px] leading-tight text-muted-foreground"
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
                          {summary ? `, ${summary}` : ""}
                        </>
                      )}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className="th-score rs-total w-12 text-right"
                    >
                      {score}
                    </span>
                    <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-[var(--ap-faint)] transition-transform ${expanded ? "rotate-180" : ""}`} />
                  </span>
                </button>
                {expanded ? (
                  <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
                    {reveal ? (
                      <>
                        {reveal.detail.length > 0 ? (
                          <p className="text-[12.5px] text-muted-foreground">
                            {reveal.detail.join(" · ")}
                          </p>
                        ) : null}
                        {replay ? (
                          <ReplayBoundary>
                            <RoundHighlightView round={replay} players={2} />
                          </ReplayBoundary>
                        ) : null}
                        <Button
                          variant="secondary"
                          block
                          data-async-reveal={round.round}
                          onClick={() => setRevealing(round.round)}
                        >
                          See the reveal
                        </Button>
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
            <Button
              variant="secondary"
              size={52}
              data-async-board
              onClick={onBoard}
              className="min-w-0 flex-1"
            >
              {boardLabel}
            </Button>
            {share}
          </div>
        )}
        {footer}
      </div>
    </PhoneShell>
  );
}
