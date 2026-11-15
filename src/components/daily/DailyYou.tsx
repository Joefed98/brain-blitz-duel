import type { ReactNode } from "react";

import type { DailyBoardView } from "@/lib/duel/daily";
import { dailyTopPlaceLine, type DailyTopPlace } from "@/lib/leaderboards/dailyPlace";
import { Icon, Panel, Row } from "@/design/components";
import { TournamentArt } from "@/components/tournaments/TournamentArt";

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
    <div data-daily-you={board.open ? "open" : "locked"} className="dl-you">
      {me ? (
        <Panel as="section" pad aria-label="You" data-daily-me className="dl-me">
          <div className="dl-me-head">
            <span className="dl-me-text">
              <span className="dl-me-name" data-ellipsis="">
                {me.name} <span className="rs-you">(you)</span>
              </span>
              <span className="dl-me-rank" data-daily-rank>
                {!me.finished ? "You, not finished" : place?.rank ? `You, ${dailyTopPlaceLine(place.rank)}` : "You, finished"}
              </span>
            </span>
            <span className="dl-me-total">{me.total}</span>
          </div>
          <div className="dl-rounds" style={ROUND_COLUMNS} aria-label="Round scores">
            {me.rounds.map((score, i) => (
              <span key={i} className="dl-round">
                <span className="dl-round-label">R{i + 1}</span>
                <span className="dl-round-score">{score ?? "–"}</span>
              </span>
            ))}
          </div>
          {me.finished && place && !place.rank && place.note ? (
            <p data-daily-place-note data-wrap-ok className="rs-sub">
              {place.note}
            </p>
          ) : null}
          {me.finished && share ? <div className="flex">{share}</div> : null}
        </Panel>
      ) : !board.open ? (
        <p className="jz-panel dl-locked" data-daily-locked>
          <Icon name="lock" size={18} className="-m-px" />
          <span className="min-w-0">{lockedNote}</span>
        </p>
      ) : null}
      <Panel>
        <Row
          as="button"
          icon="44"
          data-open-daily-board
          onClick={onTop100}
          leading={<TournamentArt name="board" />}
          title="Daily top 100"
          sub="Today and earlier days"
        >
          <Icon name="chevron-right" size={20} tone="text-3" />
        </Row>
      </Panel>
    </div>
  );
}

const ROUND_COLUMNS = { gridAutoColumns: "minmax(0, 1fr)" } as const;

