import { Fragment, useContext, type ReactNode } from "react";

import { GoalLineContext, useGoalProgress } from "@/components/duel/GameFrame";

import "@/polish-batch-p/batch-p.css";

/**
 * Polish batch P (Pattern and Logic, 25 Oct 2026; display only, docs/polish-batches/batch-p-pattern-logic.md).
 * Inside a live round's frame the game's own HUD row above the board is not drawn: its progress figure
 * goes to the frame's goal line (`useFrameProgress`) and its counts to one summary line just above the
 * dock (`LiveSummary`; the Logic games draw it inside their arena, under the board, where their status
 * line was, so the board's box keeps main's size). Intros, demos and reveals have no frame and keep the old HUD. Both read only
 * what the stage already computes; nothing here touches answers, grading or timing.
 */

/** True inside a live round's frame (the goal line is there to take the progress). */
export function useInFrame(): boolean {
  return useContext(GoalLineContext) !== null;
}

/**
 * Publishes "{done} / {total} {unit}" (or `text`) to the goal line's right; returns true when the frame
 * shows it.
 * Published in a layout effect, so it is on screen from the first paint.
 */
export function useFrameProgress(done: number, total: number, unit: string, text?: string): boolean {
  return useGoalProgress({ done, total, text: text ?? `${done} / ${total} ${unit}` });
}

/** One summary item: a label and its figure ("Moves 12"), the figure bright and tabular. */
export function SummaryItem({ label, value, warn = false, after }: { label?: string; value: ReactNode; warn?: boolean; after?: string }) {
  return (
    <span className="pl-summary-item">
      {label ? <>{label} </> : null}
      <b data-warn={warn ? "" : undefined}>{value}</b>
      {after ? <> {after}</> : null}
    </span>
  );
}

/**
 * The one-line live summary above the dock: items joined by " · ", one 20px line that never wraps
 * (its height is fixed, so nothing moves when a figure changes). Drawn only inside the frame.
 */
export function LiveSummary({
  items,
  className = "",
  inArena = false,
}: {
  items: Array<ReactNode | null | false | undefined>;
  className?: string;
  /** Drawn inside the arena under the board (the Logic games, whose arena held the old status line). */
  inArena?: boolean;
}) {
  const inFrame = useInFrame();
  if (!inFrame) return null;
  const shown = items.filter((item) => item !== null && item !== false && item !== undefined);
  return (
    <p data-after-arena={inArena ? undefined : ""} data-live-summary className={`pl-summary ${className}`.trim()}>
      {shown.map((item, index) => (
        <Fragment key={index}>
          {index > 0 ? <span aria-hidden="true" className="pl-summary-dot">·</span> : null}
          {item}
        </Fragment>
      ))}
    </p>
  );
}
