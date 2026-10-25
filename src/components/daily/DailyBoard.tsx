import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Medal } from "@/components/duel/Medal";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { rankLine, type DailyBoardView } from "@/lib/duel/daily";
import { ordinal } from "@/lib/duel/ordinal";
import { tieMarks } from "@/lib/duel/tieDisplay";
import { youStyle } from "@/components/duel/Standings";
import { isPlayerColour, isPlayerIcon, type PlayerLook } from "@/lib/duel/playerLook";

/** A board row's badge: the player's stored colour and icon (an initial on gold without one). */
function lookOf(colour: number | null, icon: string | null): PlayerLook {
  return { colour: isPlayerColour(colour) ? colour : 0, icon: isPlayerIcon(icon) ? icon : null };
}

/**
 * A daily's board (21 Oct 2026): "You" pinned on top with your place, total and round scores, then
 * the top 50 in the round leaderboard's rows (medal, badge, name, total). Names exactly as set, cut
 * with an ellipsis; the count only from 20 players (daily.ts). Locked (today, before you finish)
 * it shows only your own line and how to open it.
 */
export function DailyBoard({
  board,
  lockedNote,
  look,
  share,
}: {
  board: DailyBoardView;
  /** What opens today's board ("Finish today's 6 rounds to see the board."). */
  lockedNote: string;
  /** This device's look, for its pinned line. */
  look: PlayerLook;
  /** Today's Share, under your line once you've finished (DailyShareButton). */
  share?: ReactNode;
}) {
  const me = board.me;
  // Ties (tieDisplay.ts): the board breaks a tie on points by time used; level on both shares the rank.
  const marks = tieMarks(board.rows.map((row, i) => ({ slot: i, points: row.total, position: row.rank })));
  const you = youStyle(look);
  return (
    <div data-daily-board={board.open ? "open" : "locked"} className="flex flex-col gap-2">
      {me ? (
        <section
          aria-label="You"
          data-you=""
          data-daily-me
          style={you}
          className="th-card flex flex-col gap-2 rounded-[18px] border px-3.5 py-3"
        >
          <div className="flex items-center gap-2">
            <PlayerBadge look={look} name={me.name} size={28} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="th-name truncate text-[15px] font-semibold leading-tight text-foreground">
                {me.name} <span className="rs-you">(you)</span>
              </span>
              <span
                className="whitespace-nowrap text-[13px] font-semibold text-[var(--ap-text-2)]"
                data-daily-rank
              >
                {me.finished || board.open
                  ? `You · ${rankLine(me.rank, board.count, ordinal)}`
                  : "You · Not finished"}
              </span>
            </span>
            <span className="th-score shrink-0 text-3xl tabular-nums text-foreground">
              {me.total}
            </span>
          </div>
          <div
            className="grid grid-flow-col gap-1"
            style={{ gridAutoColumns: "minmax(0, 1fr)" }}
            aria-label="Round scores"
          >
            {me.rounds.map((score, i) => (
              <span
                key={i}
                className="flex min-w-0 flex-col items-center rounded-lg bg-[var(--ap-input)] py-1"
              >
                <span className="text-[10.5px] leading-tight text-muted-foreground">
                  R{i + 1}
                </span>
                <span className="text-sm font-bold tabular-nums leading-tight text-foreground">
                  {score ?? "–"}
                </span>
              </span>
            ))}
          </div>
          {me.finished && share ? <div className="flex">{share}</div> : null}
        </section>
      ) : null}

      {board.open ? (
        board.rows.length === 0 ? (
          <p className="ap-panel px-4 py-6 text-center text-sm text-muted-foreground">
            No one finished this day.
          </p>
        ) : (
          <ol className="rs-list" aria-label="Leaderboard">
            {board.rows.map((row, i) => {
              const mark = marks.get(i);
              return (
                <li
                  key={`${row.rank}-${i}`}
                  data-you={row.isMe ? "" : undefined}
                  data-daily-row={row.rank}
                  style={row.isMe ? you : undefined}
                  className="rs-row"
                >
                  <Medal place={row.rank} shared={mark?.shared} />
                  <PlayerBadge look={lookOf(row.colour, row.icon)} name={row.name} size={28} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="th-name rs-name leading-tight">
                      {row.name}
                      {row.isMe ? <span className="rs-you"> (you)</span> : null}
                    </span>
                    {mark?.note ? <span data-tie-note className="rs-sub">{mark.note}</span> : null}
                  </span>
                  <span className="th-score rs-total w-14 text-right text-xl">{row.total}</span>
                </li>
              );
            })}
          </ol>
        )
      ) : (
        <p
          className="ap-panel flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground"
          data-daily-locked
        >
          <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="min-w-0">{lockedNote}</span>
        </p>
      )}
      {board.count !== null ? (
        <p
          className="text-center text-[13px] text-muted-foreground"
          data-daily-count
        >
          {board.count} players
        </p>
      ) : null}
    </div>
  );
}
