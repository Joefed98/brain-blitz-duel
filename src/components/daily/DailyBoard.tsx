import { Lock } from "lucide-react";
import type { ReactNode } from "react";

import { Medal } from "@/components/duel/Medal";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { rankLine, type DailyBoardView } from "@/lib/duel/daily";
import { ordinal } from "@/lib/duel/ordinal";
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
  return (
    <div data-daily-board={board.open ? "open" : "locked"} className="flex flex-col gap-2">
      {me ? (
        <section
          aria-label="You"
          data-tint="me"
          data-daily-me
          className="th-card flex flex-col gap-2 rounded-xl border border-primary/70 bg-primary/10 px-3 py-2.5"
        >
          <div className="flex items-center gap-2">
            <PlayerBadge look={look} name={me.name} size={28} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="th-name truncate text-sm leading-tight text-foreground">
                {me.name}
              </span>
              <span
                className="whitespace-nowrap font-display text-xs font-bold uppercase tracking-wide text-primary"
                data-daily-rank
              >
                {me.finished || board.open
                  ? `You · ${rankLine(me.rank, board.count, ordinal)}`
                  : "You · Not finished"}
              </span>
            </span>
            <span className="th-score th-score-top shrink-0 font-mono text-3xl font-bold tabular-nums text-primary">
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
                className="flex min-w-0 flex-col items-center rounded-md border border-border/70 bg-background/60 py-0.5"
              >
                <span className="font-mono text-[10px] leading-tight text-muted-foreground">
                  R{i + 1}
                </span>
                <span className="font-mono text-sm font-bold tabular-nums leading-tight text-foreground">
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
          <p className="th-empty rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No one finished this day.
          </p>
        ) : (
          <ol className="flex flex-col gap-1.5" aria-label="Leaderboard">
            {board.rows.map((row, i) => (
              <li
                key={`${row.rank}-${i}`}
                data-tint={row.isMe ? "me" : undefined}
                data-daily-row={row.rank}
                className={`th-card grid min-h-[44px] grid-cols-[1.375rem_auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg border px-2 py-1 ${
                  row.isMe ? "border-primary/70 bg-primary/10" : "border-border bg-card"
                }`}
              >
                <Medal place={row.rank} />
                <PlayerBadge look={lookOf(row.colour, row.icon)} name={row.name} size={24} />
                <span className="th-name min-w-0 truncate text-sm leading-tight text-foreground">
                  {row.name}
                  {row.isMe ? <span className="sr-only"> (you)</span> : null}
                </span>
                <span
                  className={`th-score w-14 text-right font-mono text-xl font-bold tabular-nums ${row.rank === 1 ? "th-score-top text-primary" : "text-foreground"}`}
                >
                  {row.total}
                </span>
              </li>
            ))}
          </ol>
        )
      ) : (
        <p
          className="th-empty flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground"
          data-daily-locked
        >
          <Lock aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span className="min-w-0">{lockedNote}</span>
        </p>
      )}
      {board.count !== null ? (
        <p
          className="text-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground"
          data-daily-count
        >
          {board.count} players
        </p>
      ) : null}
    </div>
  );
}
