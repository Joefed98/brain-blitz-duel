/**
 * Each arcade game's own run summary on the answer reveal (the Sports overhaul, phase 2 step 4; Joe, 15 Nov 2026): a
 * short visual summary of the run, drawn large under the score, inside the shared reveal layout (ArcadeReveal):
 * where you crashed, your best streak, the landing spots. Display only: built by replaying this player's own stored
 * input log on the phone through the game's own sim (the server's replay is what scored it); nothing is sent or stored.
 *
 * A game opts in with one line in RUN_SUMMARIES (its component lives in its own chunk, so the reveal loads only the
 * game it shows). Games without one show the reveal as before.
 */
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import type { PuzzleData } from "@/lib/duel/types";

export interface RunSummaryProps {
  puzzle: PuzzleData;
  /** This player's stored answer (the input log); null while it hasn't arrived. */
  myAnswer: string | null;
  /** The server's stored score for this run. */
  myScore: number | null;
  /** Practice draws the summary with the breakdown open; rooms with "See breakdown". */
  practice: boolean;
}

type SummaryComponent = LazyExoticComponent<ComponentType<RunSummaryProps>>;

export const RUN_SUMMARIES: Partial<Record<string, SummaryComponent>> = {
  pool: lazy(() => import("@/components/duel/summaries/PoolSummary")),
  curling: lazy(() => import("@/components/duel/summaries/CurlingSummary")),
  racing: lazy(() => import("@/components/duel/summaries/RacingSummary")),
};

export function hasRunSummary(type: string): boolean {
  return Boolean(RUN_SUMMARIES[type]);
}

/** The game's run summary, or nothing (a game without one, or before its answer has arrived). */
export function RunSummary(props: RunSummaryProps) {
  const Summary = RUN_SUMMARIES[props.puzzle.type];
  if (!Summary || !props.myAnswer) return null;
  return (
    <div data-run-summary={props.puzzle.type} className="run-summary w-full shrink-0">
      <Suspense fallback={<div className="run-summary-placeholder" aria-hidden="true" />}>
        <Summary {...props} />
      </Suspense>
    </div>
  );
}
