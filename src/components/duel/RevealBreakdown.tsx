import { breakdownRows, pointsWord, type BreakdownRow } from "@/lib/duel/revealBreakdown";

/**
 * The score breakdown as a short list (3 Nov 2026, Joe's audit; display only): one row a part, its name, what the run
 * did and its points of the part's maximum with a bar; penalties and the at-least-1 written out; the total last, so the
 * rows add up to the score shown. Every row carries its stored line (`data-line`), never rewritten in storage.
 */
export function RevealBreakdown({
  lines,
  score,
  extra = [],
  hidden = false,
  storedLines,
}: {
  /** The run's stored lines when `lines` were rewritten for display (arcadeBandStd.ts): kept on the list as stored. */
  storedLines?: readonly string[] | undefined;
  lines: readonly string[];
  score: number | null;
  /** Stored tiles and cost rows shown as plain label / value rows under the parts. */
  extra?: readonly { label: string; value: string }[];
  hidden?: boolean;
}) {
  const rows = breakdownRows(lines, score);
  if (!rows.length && !extra.length) return null;
  return (
    <ul data-reveal-breakdown="" data-stored-lines={storedLines?.join("\n") || undefined} hidden={hidden} className="reveal-breakdown w-full animate-fade-in">
      {rows.map((row, i) => (
        <BreakdownItem key={`${i}-${row.name}`} row={row} />
      ))}
      {extra.map((tile) => (
        <li key={`tile-${tile.label}`} data-breakdown-kind="tile" className="reveal-breakdown-row">
          <span className="reveal-breakdown-name">{tile.label}</span>
          <span className="reveal-breakdown-points">{tile.value}</span>
        </li>
      ))}
    </ul>
  );
}

function BreakdownItem({ row }: { row: BreakdownRow }) {
  const figure =
    row.points === null
      ? null
      : row.max !== null
        ? `${row.points} of ${row.max}`
        : row.kind === "adjust" && row.points > 0
          ? `+${pointsWord(row.points)}`
          : row.kind === "total"
            ? pointsWord(row.points)
            : pointsWord(row.points);
  const share = row.max ? Math.max(0, Math.min(1, (row.points ?? 0) / row.max)) : null;
  return (
    <li data-breakdown-kind={row.kind} data-line={row.line || undefined} className="reveal-breakdown-row">
      <span className="reveal-breakdown-text">
        <span className="reveal-breakdown-name">{row.name}</span>
        {row.detail ? <span className="reveal-breakdown-detail">{row.detail}</span> : null}
      </span>
      {figure ? <span className="reveal-breakdown-points">{figure}</span> : null}
      {share !== null ? (
        <span aria-hidden="true" className="reveal-breakdown-bar">
          <span style={{ width: `${Math.round(share * 100)}%` }} />
        </span>
      ) : null}
    </li>
  );
}
