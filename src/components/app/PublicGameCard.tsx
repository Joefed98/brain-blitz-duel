import { CalendarPlus, Clock, Lock, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { fetchDuelByCode, fetchPlayers } from "@/lib/duel/api";
import {
  downloadCalendar,
  nextUpState,
  ukDateParts,
  ukDay,
  ukTime,
  type PublicGame,
} from "@/lib/publicSchedule";
import { pageHidden } from "@/lib/battery";
import { Button, LiveTag } from "@/design/components";

/** "Sat 24 Oct · 7:00 pm UK" (UK time). */
export function publicGameWhen(game: PublicGame): string {
  const { weekday, day, month } = ukDateParts(game.startsAt);
  return `${weekday} ${day} ${month} · ${ukTime(game.startsAt)} UK`;
}

/** "Tonight · 8:00 pm UK · 6 rounds", "Tomorrow · …" or "Thu 29 Oct · …" (UK dates and times). */
function publicGameLine(game: PublicGame, now: number): string {
  const day = ukDay(game.startsAt, now);
  const time = ukTime(game.startsAt);
  const evening = /pm$/.test(time) && Number(time.split(":")[0]) % 12 >= 5;
  return `${day === "Today" && evening ? "Tonight" : day} · ${time} UK · ${game.rounds} rounds`;
}

/** "1 h 25 min", "25 min", "under a minute", "2 days" until `ms` from `now`. */
export function untilText(ms: number, now: number): string {
  const minutes = Math.ceil((ms - now) / 60_000);
  if (minutes <= 1) return "under a minute";
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }
  const days = Math.round(minutes / (24 * 60));
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/**
 * Players waiting in the public room once its lobby is open (the room's own player rows, the same read
 * as "Rejoin your last room"); null until known or when the read fails. Re-read every 20 s while open.
 */
function useLobbyWaiting(roomCode: string | null, open: boolean): number | null {
  const [waiting, setWaiting] = useState<number | null>(null);
  useEffect(() => {
    if (!roomCode || !open) return setWaiting(null);
    let live = true;
    const read = async () => {
      try {
        const duel = await fetchDuelByCode(roomCode);
        if (!duel || duel.disbanded_at) return;
        const players = await fetchPlayers(duel.id);
        if (live) setWaiting(players.filter((p) => p.status !== "left").length);
      } catch {
        /* the line just leaves the count out */
      }
    };
    void read();
    // Battery (31 Oct 2026): no reads while the app is hidden.
    const timer = window.setInterval(() => {
      if (!pageHidden()) void read();
    }, 20_000);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [roomCode, open]);
  return waiting;
}

/**
 * The next public game, in one layout (Play's card and Tournaments' Next up; the design canvas's T-Play
 * and T-Tournaments): the date tile, the title and "Tonight · 8:00 pm UK · 6 rounds"; under a divider, the
 * lobby's state ("Lobby opens in 1 h 25 min", or the teal "Lobby open · 9 players waiting · starts in
 * 11 min"); then the buttons. Before the lobby opens: a quiet, disabled "Opens 7:45 pm" (lock icon, still
 * named Join now) beside Add to calendar (an .ics file); from lobby time until the start: Join now, gold,
 * across the card. Every line is one line (ellipsis) and both states are the same height, so the card's
 * height never changes (reserved before the first paint: PUBLIC_CARD_H in lib/playCards.ts).
 * `data-public-game` is the state ("calendar", "join"; "pending" for the stand-in, `game` null, drawn
 * before the page knows the phone's clock).
 */
export function PublicGameNext({
  game,
  now,
  onJoin,
}: {
  game: PublicGame | null;
  now: number;
  onJoin: (roomCode: string) => void;
}) {
  const state = game ? nextUpState(game, now) : "calendar";
  const open = state === "join";
  const waiting = useLobbyWaiting(game?.roomCode ?? null, open);
  const parts = game ? ukDateParts(game.startsAt) : null;
  return (
    <div data-public-game={game ? state : "pending"}>
      <div className="ap-next-head">
        <span aria-hidden="true" className="ap-date">
          <span className="ap-date-day">{parts ? parts.weekday.toUpperCase() : "···"}</span>
          <span className="ap-date-num">{parts ? parts.day : "··"}</span>
        </span>
        <span className="jz-row-text">
          <span data-ellipsis className="jz-row-title">
            {game?.title ?? "Public game"}
          </span>
          <span data-ellipsis className="jz-row-sub">
            {game ? publicGameLine(game, now) : "····"}
          </span>
        </span>
      </div>
      {open && game ? (
        <p data-public-status data-open="" className="ap-next-status">
          <LiveTag kind="live" className="shrink-0" />
          <span>
            Lobby open
            {waiting !== null ? ` · ${waiting} ${waiting === 1 ? "player" : "players"} waiting` : ""} · starts in{" "}
            {untilText(game.startsAt, now)}
          </span>
        </p>
      ) : (
        <p data-public-status className="ap-next-status">
          <Clock aria-hidden="true" />
          <span>{game ? `Lobby opens in ${untilText(game.lobbyAt, now)}` : "Lobby opens ····"}</span>
        </p>
      )}
      <div className="ap-next-actions">
        {open && game ? (
          <Button variant="gold" size={44} block data-public-join onClick={() => onJoin(game.roomCode)}>
            <Users aria-hidden="true" className="h-4.5 w-4.5" /> Join now
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              size={44}
              block
              data-public-join
              disabled
              // Still named Join now (it becomes it at lobby time); it shows when it opens.
              aria-label={game ? `Join now (opens ${ukTime(game.lobbyAt)})` : "Join now"}
            >
              <Lock aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
              {game ? `Opens ${ukTime(game.lobbyAt)}` : "Opens ····"}
            </Button>
            <Button variant="secondary" size={44} block data-public-calendar onClick={() => game && downloadCalendar(game)}>
              <CalendarPlus aria-hidden="true" className="h-4.5 w-4.5" /> Add to calendar
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/** A later public game's row (Tournaments' Coming up): a quiet date tile, its lines, a calendar button. */
export function PublicGameRow({ game }: { game: PublicGame }) {
  const parts = ukDateParts(game.startsAt);
  const name = game.title ?? "Public game";
  return (
    <div data-icon="date-sm" className="jz-row">
      <span aria-hidden="true" data-quiet="" className="ap-date">
        <span className="ap-date-day">{parts.weekday.toUpperCase()}</span>
        <span className="ap-date-num">{parts.day}</span>
      </span>
      <span className="jz-row-text">
        <span data-ellipsis className="jz-row-title">
          {name}
        </span>
        <span data-ellipsis className="jz-row-sub">
          {parts.day} {parts.month} · {ukTime(game.startsAt)} UK
        </span>
      </span>
      <button
        type="button"
        data-public-row-calendar
        aria-label={`Add ${name} to calendar`}
        onClick={() => downloadCalendar(game)}
        className="ap-icon-btn press"
      >
        <CalendarPlus aria-hidden="true" strokeWidth={1.9} />
      </button>
    </div>
  );
}

/** Play's "Next public game": its heading (with `link` on the right) and the next game in one panel. */
export function PublicGameCard({
  game,
  now,
  heading,
  onJoin,
  link,
}: {
  /** null: a stand-in before the page is up (no day, time or state: those need the phone's clock). */
  game: PublicGame | null;
  now: number;
  heading: string;
  onJoin: (roomCode: string) => void;
  link?: ReactNode;
}) {
  return (
    <section aria-label={heading} className="ap-section">
      <div className="ap-section-head">
        <h2 className="ap-section-title">{heading}</h2>
        {link}
      </div>
      <div className="jz-panel overflow-hidden">
        <PublicGameNext game={game} now={now} onJoin={onJoin} />
      </div>
    </section>
  );
}
