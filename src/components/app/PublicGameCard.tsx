import { CalendarPlus, Users } from "lucide-react";
import type { ReactNode } from "react";

import {
  downloadCalendar,
  nextUpState,
  ukDateParts,
  ukTime,
  type PublicGame,
} from "@/lib/publicSchedule";

/** "Sat 24 Oct · 7:00 pm UK" (UK time). */
export function publicGameWhen(game: PublicGame): string {
  const { weekday, day, month } = ukDateParts(game.startsAt);
  return `${weekday} ${day} ${month} · ${ukTime(game.startsAt)} UK`;
}

/**
 * A public game's date tile and its three stacked lines: the title, "Tue 27 Oct · 8:00 pm UK" (secondary)
 * and "Lobby opens 7:45 pm · 6 rounds" (faint). Every line is one line (ellipsis), so the height never
 * depends on the title. `game` null: the stand-in before the page is up (no day or time: those need the
 * phone's clock), the same size as the real one.
 */
function PublicGameLines({ game, now }: { game: PublicGame | null; now: number }) {
  const parts = game ? ukDateParts(game.startsAt) : null;
  const lobby = !game
    ? "Lobby opens ····"
    : `${nextUpState(game, now) === "join" ? "Lobby open now" : `Lobby opens ${ukTime(game.lobbyAt)}`} · ${game.rounds} rounds`;
  return (
    <>
      <span aria-hidden="true" className="ap-date">
        <span className="ap-date-day">{parts ? parts.weekday : "···"}</span>
        <span className="ap-date-num">{parts ? parts.day : "··"}</span>
      </span>
      <span className="ap-row-text">
        <span data-ellipsis className="ap-row-title">
          {game?.title ?? "Public game"}
        </span>
        <span data-ellipsis className="ap-row-sub">
          {game ? publicGameWhen(game) : "····"}
        </span>
        <span data-ellipsis className="ap-row-sub ap-faint">
          {lobby}
        </span>
      </span>
    </>
  );
}

/** A later public game's row (Tournaments): its date tile and lines, no buttons. */
export function PublicGameRow({ game, now }: { game: PublicGame; now: number }) {
  return (
    <div data-icon="date" className="ap-row">
      <PublicGameLines game={game} now={now} />
    </div>
  );
}

/**
 * The next public game, in one layout (Play's card and Tournaments' first row): the date tile and lines,
 * then two equal 44 px buttons side by side. Join now opens the public room (its link join asks for a
 * name) and is gold from lobby time until the start; before the lobby opens it is there but off. Add to
 * calendar (an .ics file) is always offered. `data-public-game` is the state ("calendar" before the
 * lobby opens, "join" from then; "pending" for the stand-in). Its height is reserved before the first
 * paint (PUBLIC_CARD_H in lib/playCards.ts, the same with or without a title).
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
  return (
    <div data-public-game={game ? state : "pending"} className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <PublicGameLines game={game} now={now} />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          data-public-join
          disabled={!open}
          onClick={() => game && open && onJoin(game.roomCode)}
          // Before the lobby opens it says when it does (Polish batch R): "Opens 7:45 pm", still named Join now.
          aria-label={open || !game ? "Join now" : `Join now (opens ${ukTime(game.lobbyAt)})`}
          className={`${open ? "ap-btn-gold" : "ap-btn-outline ap-btn-off"} press tap-target h-11 w-full text-[15px]`}
        >
          <Users aria-hidden="true" className="h-[18px] w-[18px]" /> {open || !game ? "Join now" : `Opens ${ukTime(game.lobbyAt)}`}
        </button>
        <button
          type="button"
          data-public-calendar
          onClick={() => game && downloadCalendar(game)}
          className="ap-btn-outline press tap-target h-11 w-full text-[15px]"
        >
          <CalendarPlus aria-hidden="true" className="h-[18px] w-[18px]" /> Add to calendar
        </button>
      </div>
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
      <div className="ap-panel">
        <PublicGameNext game={game} now={now} onJoin={onJoin} />
      </div>
    </section>
  );
}
