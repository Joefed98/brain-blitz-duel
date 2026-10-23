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

/** A public game's row: its date tile (UK date), title and day and time (polish-layout/app-pages.css). */
export function PublicGameRow({ game }: { game: PublicGame }) {
  const { weekday, day } = ukDateParts(game.startsAt);
  return (
    <div data-icon="date" className="ap-row">
      <span aria-hidden="true" className="ap-date">
        <span className="ap-date-day">{weekday}</span>
        <span className="ap-date-num">{day}</span>
      </span>
      <span className="ap-row-text">
        <span className="ap-row-title">{game.title ?? "Public game"}</span>
        <span data-ellipsis className="ap-row-sub">
          {publicGameWhen(game)}
        </span>
      </span>
    </div>
  );
}

/**
 * The next public game's lobby line and its one button. Before the lobby opens it offers "Add to
 * calendar" (an .ics file); from lobby time until the start it offers "Join now", which opens the
 * public room (the room's own link join asks for a name).
 */
export function PublicGameAction({
  game,
  now,
  onJoin,
  footer,
}: {
  game: PublicGame;
  now: number;
  onJoin: (roomCode: string) => void;
  footer?: ReactNode;
}) {
  const state = nextUpState(game, now);
  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <p className="text-[14px] text-muted-foreground">
        {game.rounds} rounds · {state === "join" ? "Lobby open now" : `Lobby opens at ${ukTime(game.lobbyAt)}`}
      </p>
      {state === "join" ? (
        <button
          type="button"
          data-public-join
          onClick={() => onJoin(game.roomCode)}
          className="ap-btn-gold press tap-target h-[50px] w-full text-base"
        >
          <Users aria-hidden="true" className="h-5 w-5" /> Join now
        </button>
      ) : (
        <button
          type="button"
          data-public-calendar
          onClick={() => downloadCalendar(game)}
          className="ap-btn-outline press tap-target h-[50px] w-full text-base"
        >
          <CalendarPlus aria-hidden="true" className="h-5 w-5" /> Add to calendar
        </button>
      )}
      {footer}
    </div>
  );
}

/** Play's "Next public game": the game's row, its lobby line and its button, in one panel. */
export function PublicGameCard({
  game,
  now,
  heading,
  onJoin,
  footer,
}: {
  game: PublicGame;
  now: number;
  heading: string;
  onJoin: (roomCode: string) => void;
  footer?: ReactNode;
}) {
  return (
    <section data-public-game={nextUpState(game, now)} aria-label={heading} className="ap-section">
      <div className="ap-section-head">
        <h2 className="ap-section-title">{heading}</h2>
      </div>
      <div className="ap-panel">
        <PublicGameRow game={game} />
        <PublicGameAction game={game} now={now} onJoin={onJoin} footer={footer} />
      </div>
    </section>
  );
}
