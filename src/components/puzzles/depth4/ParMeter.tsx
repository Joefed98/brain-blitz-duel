import { SummaryItem } from "@/components/puzzles/batchP/LiveSummary";

import "./depth4.css";

/**
 * Depth batch 4 (docs/depth/d4-pattern.md): the par meter for the live summary line, "Moves 12 · Par 15"
 * and a slim bar whose gold marker is the par. The bar fills with the moves made (the par sits at two
 * thirds of its length); over par the figure and the fill turn warn red. Two summary items, so it lives in
 * the summary's fixed 20 px line and never moves the board. Display only: the count is the stage's own,
 * the par the puzzle's public `par`.
 *
 * Shared request: Gridlock, Pipeline and Turntable use it here; it could move to the toolkit for other games.
 */
export function parItems(label: string, used: number, par: number) {
  const over = par > 0 && used > par;
  const span = Math.max(1, par * 1.5);
  const fill = Math.min(1, used / span);
  return [
    <SummaryItem key="used" label={label} value={used} warn={over} />,
    <span key="par" className="pl-summary-item d4-par" data-d4-par={par} data-over={over ? "" : undefined}>
      Par <b>{par}</b>
      <span className="d4-par-bar" aria-hidden="true">
        <span className="d4-par-fill" style={{ width: `${fill * 100}%` }} />
        <span className="d4-par-mark" style={{ left: `${(par / span) * 100}%` }} />
      </span>
    </span>,
  ];
}
