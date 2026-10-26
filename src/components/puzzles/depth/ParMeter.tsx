import type { CSSProperties } from "react";

import "@/polish-depth-d6/depth-d6.css";

/**
 * The par line (Logic depth to 200, 25 Oct 2026; docs/depth/d6-logic.md): "Moves 6 · Par 8" with a slim bar whose
 * gold marker sits at par. The fill grows with each move; past par it turns warn red (the par bonus is gone). One
 * fixed-width summary item inside the frame's live summary, so nothing moves when a figure changes. Display only:
 * the server judges par from the stored minimum.
 */
export function ParMeter({ label, moves, par, limit, out = false }: { label: string; moves: number; par: number; limit?: number | null | undefined; out?: boolean }) {
  // The bar runs to twice par, so par sits at its middle.
  const span = Math.max(1, par * 2);
  const fill = Math.max(0, Math.min(1, moves / span));
  const over = moves > par;
  return (
    <span className="pl-summary-item d6-par" data-depth-par={par} data-over={over ? "" : undefined}>
      {label}{" "}
      {limit !== undefined && limit !== null ? (
        <b data-warn={over || out ? "" : undefined}>
          <span data-move-limit={limit}>{Math.min(moves, limit)} / {limit}</span>
        </b>
      ) : (
        <b data-warn={over ? "" : undefined}>{moves}</b>
      )}
      <span aria-hidden="true" className="d6-par-sep">·</span>
      Par <b className="d6-par-value">{par}</b>
      <span aria-hidden="true" className="d6-par-bar" style={{ "--d6-fill": fill } as CSSProperties}>
        <span className="d6-par-fill" />
        <span className="d6-par-mark" />
      </span>
    </span>
  );
}
