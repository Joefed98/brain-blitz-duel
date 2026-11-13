import type { ReactNode } from "react";

import type { DailyBoardView } from "@/lib/duel/daily";
import { dailyTopPlaceLine, type DailyTopPlace } from "@/lib/leaderboards/dailyPlace";
import { Icon } from "@/design/components";

/**
 * Your own Daily line (13 Nov 2026, one identity everywhere): the old public board of everyone's names is retired for
 * the Daily top 100 (/daily-board: one board, accounts' finished attempts only, hidden under-18s as "Hidden player").
 * This keeps only what is yours (your place, total and round scores, today's Share) and the way to the top 100. The
 * server's old board call now answers only the caller's own row (daily.functions.ts); stored attempts are unchanged.
 */
export function DailyYou({
  board,
  lockedNote,
  share,
  onTop100,
  place,
}: {
  board: DailyBoardView;
  /** What opens today's place ("Finish today's 6 rounds to see the board."). */
  lockedNote: string;
  /** Today's Share, under your line once you've finished (DailyShareButton). */
  share?: ReactNode;
  /** Opens the Daily top 100 for this daily. */
  onTop100: () => void;
  /**
   * An account's place on the Daily top 100 (Joe, 13 Nov 2026: one board); null for a guest, whose line shows the score
   * without a place.
   */
  place: DailyTopPlace | null;
}) {
  const me = board.me;
  return (
    <div data-daily-you={board.open ? "open" : "locked"} className="flex flex-col gap-2">
      {me ? (
        <section aria-label="You" data-daily-me className="th-card flex flex-col gap-2 rounded-[18px] border px-3.5 py-3" /* design-lint-ignore: moved unchanged from the old DailyBoard */>
          <div className="flex items-center gap-2">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="th-name truncate text-[15px] font-semibold leading-tight text-foreground" /* design-lint-ignore: moved unchanged from the old DailyBoard */ data-ellipsis="">
                {me.name} <span className="rs-you">(you)</span>
              </span>
              <span className="whitespace-nowrap text-[13px] font-semibold text-[var(--ap-text-2)]" /* design-lint-ignore: moved unchanged from the old DailyBoard */ data-daily-rank>
                {!me.finished ? "You, not finished" : place?.rank ? `You, ${dailyTopPlaceLine(place.rank)}` : "You, finished"}
              </span>
            </span>
            <span className="th-score shrink-0 text-3xl tabular-nums text-foreground">{me.total}</span>
          </div>
          <div className="grid grid-flow-col gap-1" style={ROUND_COLUMNS} aria-label="Round scores">
            {me.rounds.map((score, i) => (
              <span key={i} className="flex min-w-0 flex-col items-center rounded-lg bg-[var(--ap-input)] py-1" /* design-lint-ignore: moved unchanged from the old DailyBoard */>
                <span className="text-[10.5px] leading-tight text-muted-foreground" /* design-lint-ignore: moved unchanged from the old DailyBoard */>R{i + 1}</span>
                <span className="text-sm font-bold tabular-nums leading-tight text-foreground">{score ?? "–"}</span>
              </span>
            ))}
          </div>
          {me.finished && place && !place.rank && place.note ? (
            <p data-daily-place-note data-wrap-ok className="rs-sub">
              {place.note}
            </p>
          ) : null}
          {me.finished && share ? <div className="flex">{share}</div> : null}
        </section>
      ) : !board.open ? (
        <p className="jz-panel flex items-center gap-2 px-4 py-5 text-sm text-muted-foreground" data-daily-locked>
          <Icon name="lock" size={18} className="-m-px" />
          <span className="min-w-0">{lockedNote}</span>
        </p>
      ) : null}
      <button type="button" data-open-daily-board className="press tap-target jz-panel flex items-center justify-between gap-2 px-4 py-3 text-left" onClick={onTop100}>
        <span className="flex min-w-0 flex-col">
          <span className="rs-name">Daily top 100</span>
          <span className="rs-sub">Today and earlier days</span>
        </span>
        <Icon name="chevron-right" size={20} className="shrink-0" />
      </button>
    </div>
  );
}

const ROUND_COLUMNS = { gridAutoColumns: "minmax(0, 1fr)" } as const;
