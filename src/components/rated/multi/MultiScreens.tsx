/**
 * Rated 4- and 8-player matches: the three screens (wave 3, session W3d; docs/mockups/wave-3/08, 09, 10, read with
 * wave 2's identity: avatars, the five-tab bar and the Joules line win where the mockups differ). Presentational only:
 * every number comes from rules.ts (placings, points, movement) or from the server (rating changes, Joules), never
 * worked out from anything else here. Built behind W3b's switches (RATED_FORMATS_ON.ffa4 / .ffa8 in src/config/ratedConfig.ts, off at launch).
 *
 * - `MultiFilling` (08): the chips, "Filling your match", the seat count and bar, a seat card per player (a recorded
 *   run labelled), "Searching…" for empty seats, How it scores (the size's placing points), Leave queue.
 * - `MultiStandings` (09): "After game n of N", the progress bars, the game's headline, the standings with movement
 *   arrows (an arrow, never colour alone), your row outlined in gold, the next game and its countdown.
 * - `MultiFinal` (10): "You finished 2nd", the podium (2nd, 1st, 3rd), your rating change, the Joules line, the rest of
 *   the placings with each live player's rating change, Next match and Share. The equipped podium entrance and
 *   celebration (wave 2's E2) draws in its own layer inside the podium only (`entrance`), never over the placings,
 *   and the placings are drawn from the first frame (never waiting on it); under reduced motion it isn't drawn.
 */
import { useMemo, type ReactNode } from "react";

import { LOGO_PATHS } from "@/components/brand/logoGeometry";
import { PlayerBadge } from "@/components/duel/PlayerBadge";
import { Button, Icon, Medal, Panel } from "@/design/components";
import { Avatar } from "@/design/identity";
import type { AvatarLook } from "@/design/identity/avatars";
import type { PlayerLook } from "@/lib/duel/playerLook";
import { useReducedMotion } from "@/lib/motion";
import {
  countWord,
  movement,
  multiPointsTable,
  ordinal,
  type MultiSize,
  type StandingRow,
} from "@/lib/rated/multi/rules";

/** How a seat is drawn. */
export interface SeatView {
  seatId: string;
  name: string;
  /** Wave 2's avatar (accounts); a guest look (colour and initial) otherwise. */
  avatar?: AvatarLook | null;
  look?: PlayerLook;
  you?: boolean;
  recorded?: boolean;
  /** The rank emblem (W3a's tier), drawn small at the seat's end. */
  emblem?: ReactNode;
}

function SeatDisc({ seat, size }: { seat: SeatView; size: number }) {
  if (seat.avatar) return <Avatar look={seat.avatar} size={size} />;
  return <PlayerBadge look={seat.look ?? { colour: 0, icon: null }} name={seat.name} size={size} />;
}

function RecordedTag() {
  return (
    <span className="rm-recorded jz-label" data-recorded-run>
      Recorded run
    </span>
  );
}

const BOLT_PATH = LOGO_PATHS.bolt;

/** The Joules line: electric lime with the small bolt mark (DESIGN.md "Results, Joules and places"). */
export function JoulesLine({ amount }: { amount: number }) {
  return (
    <p className="rm-joules jz-meta" data-joules={amount}>
      <svg viewBox="6 0.5 16 33" width="9" height="18" aria-hidden="true">
        <path d={BOLT_PATH} fill="currentColor" />
      </svg>
      +{amount.toLocaleString("en-GB")} Joules
    </p>
  );
}

function Chips({ size, picks, games }: { size: MultiSize; picks: string; games?: number }) {
  return (
    <div className="rm-chips">
      <span className="rm-chip jz-meta">{size} players</span>
      <span className="rm-chip jz-meta">{picks}</span>
      {games ? <span className="rm-chip jz-meta">{games} games</span> : null}
    </div>
  );
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/* ------------------------------------------------------------------ 08 filling */

export function MultiFilling({
  size,
  picks,
  games,
  seats,
  elapsedMs,
  onLeave,
}: {
  size: MultiSize;
  picks: string;
  games: number;
  /** The seats filled so far (live players and recorded runs), in seat order. */
  seats: readonly SeatView[];
  elapsedMs: number;
  onLeave: () => void;
}) {
  const filled = Math.min(size, seats.length);
  const table = multiPointsTable(size);
  return (
    <section className="rm-screen" data-rated-multi="filling" data-size={size}>
      <Chips size={size} picks={picks} games={games} />
      <h1 className="jz-title">Filling your match</h1>
      <div className="rm-fill-row">
        <span className="jz-score-l" data-fill-count>
          {filled} / {size}
        </span>
        <span className="rm-bar" role="progressbar" aria-valuemin={0} aria-valuemax={size} aria-valuenow={filled}>
          <span className="rm-bar-fill" style={{ width: `${(filled / size) * 100}%` }} />
        </span>
        <span className="jz-meta rm-quiet" data-fill-clock>
          {clock(elapsedMs)}
        </span>
      </div>
      <ul className="rm-seats" data-seats>
        {Array.from({ length: size }, (_, i) => {
          const seat = seats[i];
          if (!seat)
            return (
              <li key={`empty-${i}`} className="rm-seat" data-empty>
                <span className="rm-seat-ghost" aria-hidden="true" />
                <span className="jz-body rm-quiet">Searching…</span>
              </li>
            );
          return (
            <li key={seat.seatId} className="rm-seat" data-you={seat.you ? "" : undefined} data-seat={seat.seatId}>
              <SeatDisc seat={seat} size={40} />
              <span className="rm-seat-text">
                <span className="jz-card-title rm-name" data-ellipsis>
                  {seat.name}
                </span>
                {seat.recorded ? <RecordedTag /> : null}
              </span>
              {seat.emblem ?? null}
            </li>
          );
        })}
      </ul>
      <Panel pad className="rm-howto" data-how-it-scores>
        <h2 className="jz-card-title">How it scores</h2>
        <ol className="rm-points" data-points-table={table.join(",")}>
          {table.map((points, i) => (
            <li key={i}>
              <span className="jz-label rm-quiet">{ordinal(i + 1)}</span>
              <span className="jz-score-s" data-first={i === 0 ? "" : undefined}>
                {points}
              </span>
            </li>
          ))}
        </ol>
        <p className="jz-body rm-quiet">
          Points for your place in each game. Most points after {countWord(games)} games wins.
        </p>
      </Panel>
      <div className="rm-footer">
        <Button variant="secondary" size={52} block onClick={onLeave} data-leave-queue>
          Leave queue
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ 09 standings */

function Move({ row }: { row: StandingRow }) {
  const m = movement(row);
  if (m === "up") return <span className="rm-move" data-move="up"><Icon name="up" size={18} tone="cyan" label="Up" /></span>;
  if (m === "down") return <span className="rm-move" data-move="down"><Icon name="down" size={18} tone="red" label="Down" /></span>;
  return (
    <span className="rm-move rm-quiet" data-move={m ?? "none"} aria-label={m === "same" ? "No change" : undefined}>
      –
    </span>
  );
}

export function MultiStandings({
  size,
  game,
  games,
  rows,
  seats,
  headline,
  next,
}: {
  size: MultiSize;
  /** Games played so far (1-based). */
  game: number;
  games: number;
  rows: readonly StandingRow[];
  seats: readonly SeatView[];
  /** The game just played: its name, its winner's name, your place and points. */
  headline: { gameName: string; winnerName: string; yourPlace: number; yourPoints: number; tile?: ReactNode };
  /** The next game and the time to it; none after the last game. */
  next?: { gameName: string; msLeft: number; tile?: ReactNode } | null;
}) {
  const bySeat = useMemo(() => new Map(seats.map((s) => [s.seatId, s])), [seats]);
  return (
    <section className="rm-screen" data-rated-multi="standings" data-size={size}>
      <p className="jz-meta rm-cyan">
        After game {game} of {games}
      </p>
      <h1 className="jz-title">Standings</h1>
      <div className="rm-steps" aria-hidden="true">
        {Array.from({ length: games }, (_, i) => (
          <span key={i} className="rm-step" data-done={i < game ? "" : undefined} />
        ))}
      </div>
      <Panel pad tone="cyan" className="rm-headline" data-game-headline>
        {headline.tile ?? null}
        <span>
          <span className="jz-card-title rm-strong">
            {headline.gameName}: {headline.winnerName} wins it
          </span>
          <span className="jz-meta rm-text-2 rm-block">
            You came {ordinal(headline.yourPlace)} · +{headline.yourPoints} points
          </span>
        </span>
      </Panel>
      <Panel as="ol" className="rm-table" data-standings>
        <li className="rm-table-head jz-label rm-quiet" aria-hidden="true">
          <span>Place</span>
          <span>Points</span>
        </li>
        {rows.map((row) => {
          const seat = bySeat.get(row.seatId);
          if (!seat) return null;
          return (
            <li
              key={row.seatId}
              className="rm-row"
              data-standing={row.seatId}
              data-place={row.place}
              data-you={seat.you ? "" : undefined}
            >
              <span className="jz-score-s rm-place" data-medal-place={row.place <= 3 ? row.place : undefined}>
                {row.place}
              </span>
              <Move row={row} />
              <SeatDisc seat={seat} size={32} />
              <span className="jz-body rm-name rm-grow" data-ellipsis>
                {seat.name}
                {seat.you ? <span className="rm-quiet"> (you)</span> : null}
              </span>
              {seat.recorded ? <RecordedTag /> : null}
              <span className="jz-score-m" data-points>
                {row.points}
              </span>
            </li>
          );
        })}
      </Panel>
      {next ? (
        <div className="rm-next" data-next-game>
          {next.tile ?? null}
          <span className="rm-grow">
            <span className="jz-label rm-cyan rm-block">{game + 1 === games ? "Final game" : "Next game"}</span>
            <span className="jz-card-title rm-strong">{next.gameName}</span>
          </span>
          <span className="jz-score-l" data-next-clock>
            {clock(next.msLeft)}
          </span>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ 10 final */

function Change({ change }: { change: number }) {
  const sign = change > 0 ? "+" : change < 0 ? "−" : "±";
  return (
    <span className="rm-change" data-change={change} data-dir={change > 0 ? "up" : change < 0 ? "down" : "same"}>
      {sign}
      {Math.abs(change)}
    </span>
  );
}

export interface FinalRating {
  rating: number;
  change: number;
  parts?: readonly { label: string; rating: number; change: number }[];
}

export function MultiFinal({
  size,
  picks,
  rows,
  seats,
  changes,
  yourRating,
  joules,
  entrance,
  onNext,
  onShare,
}: {
  size: MultiSize;
  picks: string;
  /** The final placings (rules.ts finalPlacings). */
  rows: readonly StandingRow[];
  seats: readonly SeatView[];
  /** Each live player's rating change, by seat id (W3a's answer). */
  changes: ReadonlyMap<string, number>;
  yourRating: FinalRating | null;
  joules: number | null;
  /** Wave 2's equipped podium entrance and celebration, drawn in the podium's own layer only. */
  entrance?: ReactNode;
  onNext: () => void;
  onShare?: () => void;
}) {
  const reduced = useReducedMotion();
  const bySeat = useMemo(() => new Map(seats.map((s) => [s.seatId, s])), [seats]);
  const you = rows.find((r) => bySeat.get(r.seatId)?.you);
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);
  const order = [top[1], top[0], top[2]].filter((r): r is StandingRow => !!r);
  const shared = (place: number) => rows.filter((r) => r.place === place).length > 1;
  return (
    <section className="rm-screen" data-rated-multi="final" data-size={size}>
      <Chips size={size} picks={picks} />
      <h1 className="jz-title rm-centre" data-final-headline>
        {you ? `You finished ${shared(you.place) ? "joint " : ""}${ordinal(you.place)}` : "Final placings"}
      </h1>
      <div className="rm-podium" data-podium>
        <ol className="rm-steps-podium">
          {order.map((row) => {
            const seat = bySeat.get(row.seatId);
            if (!seat) return null;
            return (
              <li key={row.seatId} className="rm-pod" data-pod-place={row.place} data-standing={row.seatId}>
                <SeatDisc seat={seat} size={row.place === 1 ? 56 : 48} />
                <span className="jz-meta rm-name rm-centre" data-ellipsis>
                  {seat.you ? "You" : seat.name}
                </span>
                {seat.recorded ? (
                  <RecordedTag />
                ) : changes.has(row.seatId) ? (
                  <span className="jz-label">
                    <Change change={changes.get(row.seatId)!} />
                  </span>
                ) : null}
                <Medal place={row.place} shared={shared(row.place)} size="m" />
                <span className="rm-block-step jz-cut-sm" data-step={row.place}>
                  <span className="jz-score-m" data-points>
                    {row.points}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        {entrance && !reduced ? (
          <div className="rm-entrance" aria-hidden="true" data-podium-entrance>
            {entrance}
          </div>
        ) : null}
      </div>
      {yourRating ? (
        <Panel pad className="rm-rating" data-your-rating>
          <div className="rm-rating-top">
            <span className="rm-grow">
              <span className="jz-label rm-quiet rm-block">Joulz Rating</span>
              <span className="jz-score-l" data-rating>
                {yourRating.rating.toLocaleString("en-GB")}
              </span>
            </span>
            <span className="jz-score-l">
              <Change change={yourRating.change} />
            </span>
          </div>
          {yourRating.parts?.length ? (
            <div className="rm-rating-parts jz-meta">
              {yourRating.parts.map((p) => (
                <span key={p.label}>
                  <span className="rm-quiet">{p.label}</span> {p.rating.toLocaleString("en-GB")} <Change change={p.change} />
                </span>
              ))}
            </div>
          ) : null}
          {joules !== null ? <JoulesLine amount={joules} /> : null}
        </Panel>
      ) : joules !== null ? (
        <JoulesLine amount={joules} />
      ) : null}
      {rest.length ? (
        <Panel as="ol" className="rm-table" data-placings>
          {rest.map((row) => {
            const seat = bySeat.get(row.seatId);
            if (!seat) return null;
            const change = changes.get(row.seatId);
            return (
              <li key={row.seatId} className="rm-row" data-standing={row.seatId} data-place={row.place} data-you={seat.you ? "" : undefined}>
                <span className="jz-score-s rm-place">{shared(row.place) ? `=${row.place}` : row.place}</span>
                <SeatDisc seat={seat} size={32} />
                <span className="jz-body rm-name rm-grow" data-ellipsis>
                  {seat.name}
                  {seat.you ? <span className="rm-quiet"> (you)</span> : null}
                </span>
                {seat.recorded ? <RecordedTag /> : change !== undefined ? <span className="jz-meta"><Change change={change} /></span> : null}
                <span className="jz-score-m" data-points>
                  {row.points}
                </span>
              </li>
            );
          })}
        </Panel>
      ) : null}
      <div className="rm-actions">
        <Button variant="gold" size={52} block onClick={onNext} data-next-match>
          Next match
        </Button>
        {onShare ? (
          <Button variant="secondary" size={52} onClick={onShare} data-share>
            Share
          </Button>
        ) : null}
      </div>
    </section>
  );
}
