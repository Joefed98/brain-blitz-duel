import type { ReactNode } from "react";

import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { Medal } from "@/design/components";
import { boardTime, rowName, top500Label, type BoardRow } from "@/lib/leaderboards/boards";

/** The Top 500 emblem (mockup 03's small size, `public/art/emblems/top-500.svg`). */
export const TOP500_EMBLEM_URL = "/art/emblems/top-500.svg";

/** "Top 500 #37" with its emblem. */
export function Top500Line({ rank }: { rank: number }) {
  return (
    <span className="lb-top500" data-top500={rank}>
      <img src={TOP500_EMBLEM_URL} alt="" aria-hidden="true" width={16} height={20} />
      <span>{top500Label(rank)}</span>
    </span>
  );
}

/** A row's place: the medal art for 1st to 3rd, the number from 4th; shared places marked. */
function Place({ rank, shared }: { rank: number; shared: boolean }) {
  return (
    <span className="lb-place">
      <Medal place={rank} shared={shared} />
    </span>
  );
}

/** A player's disc: their colour and initial, or a plain disc for a hidden or deleted player. */
function Disc({ row }: { row: BoardRow }) {
  if (row.colour === null || !row.name) return <span className="lb-disc" aria-hidden="true" data-hidden-disc />;
  return <PlayerBadge look={{ colour: row.colour, icon: null }} name={row.name} size={36} />;
}

/**
 * One board row (mockups 01 and 02): place, disc, name (and the Top 500 line), then the Daily's time and the value.
 * Shows only what the server sent: a hidden player is "Hidden player" in their place, rank and value unchanged.
 */
export function BoardRowView({
  row,
  shared,
  pinned = false,
  showTime = false,
  sub,
}: {
  row: BoardRow;
  shared: boolean;
  pinned?: boolean;
  showTime?: boolean;
  sub?: ReactNode;
}) {
  const name = rowName(row);
  return (
    <li
      className="lb-row"
      data-board-row={row.rank}
      data-me={row.isMe ? "" : undefined}
      data-pinned={pinned ? "" : undefined}
      data-hidden-player={row.hidden ? "" : undefined}
      aria-label={`${row.rank}${shared ? " (shared)" : ""}, ${name}, ${row.value.toLocaleString("en-GB")}`}
    >
      {pinned ? <span className="lb-place lb-place-me">{row.rank.toLocaleString("en-GB")}</span> : <Place rank={row.rank} shared={shared} />}
      <Disc row={row} />
      <span className="lb-who">
        <span className="lb-name" data-ellipsis>
          {name}
        </span>
        {row.top500 ? <Top500Line rank={row.top500} /> : sub ? <span className="lb-sub" data-ellipsis>{sub}</span> : null}
      </span>
      {showTime && typeof row.timeMs === "number" ? <span className="lb-time">{boardTime(row.timeMs)}</span> : null}
      <span className="lb-value">{row.value.toLocaleString("en-GB")}</span>
    </li>
  );
}

/** Whether a row shares its place with the row before or after it. */
function sharedAt(rows: readonly BoardRow[], i: number): boolean {
  const r = rows[i]!;
  return (i > 0 && rows[i - 1]!.rank === r.rank) || (i + 1 < rows.length && rows[i + 1]!.rank === r.rank);
}

/**
 * A board: its rows, then your own row pinned below when it isn't among them (mockups 01 and 02). `footer` sits
 * between the list and the pinned row ("Scroll for the top 500", "…").
 */
export function BoardList({
  rows,
  me,
  showTime = false,
  footer,
  meSub,
  label,
}: {
  rows: readonly BoardRow[];
  me: BoardRow | null | undefined;
  showTime?: boolean;
  footer?: ReactNode;
  meSub?: ReactNode;
  label: string;
}) {
  const meShown = rows.some((r) => r.isMe);
  return (
    <div className="lb-board" data-board-list>
      <ol className="lb-rows" aria-label={label}>
        {rows.map((row, i) => (
          <BoardRowView key={`${row.rank}-${i}`} row={row} shared={sharedAt(rows, i)} showTime={showTime} />
        ))}
      </ol>
      {footer}
      {me && !meShown ? (
        <ol className="lb-rows lb-pinned" aria-label="Your place" data-board-pinned>
          <BoardRowView row={me} shared={false} pinned showTime={showTime} sub={meSub} />
        </ol>
      ) : null}
    </div>
  );
}
