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
 * A public game's row: its date tile (UK date), title and day and time (polish-layout/app-pages.css).
 * `game` null: the stand-in before the page is up (no day or time: those need the phone's clock), the
 * same size as the real row.
 */
export function PublicGameRow({ game }: { game: PublicGame | null }) {
  const parts = game ? ukDateParts(game.startsAt) : null;
  return (
    <div data-icon="date" className="ap-row">
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
      </span>
    </div>
  );
}

/**
 * The next public game's lobby line and its one button. Before the lobby opens it offers "Add to
 * calendar" (an .ics file); from lobby time until the start it offers "Join now", which opens the
 * public room (the room's own link join asks for a name). `game` null: the stand-in (Add to calendar,
 * doing nothing).
 */
export function PublicGameAction({
  game,
  now,
  onJoin,
  footer,
}: {
  game: PublicGame | null;
  now: number;
  onJoin: (roomCode: string) => void;
  footer?: ReactNode;
}) {
  const state = game ? nextUpState(game, now) : "calendar";
  return (
    <div className="flex flex-col gap-3 px-4 pb-4">
      <p className="text-[14px] text-muted-foreground">
        {game ? game.rounds : "·"} rounds ·{" "}
        {!game ? "Lobby opens at ····" : state === "join" ? "Lobby open now" : `Lobby opens at ${ukTime(game.lobbyAt)}`}
      </p>
      {state === "join" ? (
        <button
          type="button"
          data-public-join
          onClick={() => game && onJoin(game.roomCode)}
          className="ap-btn-gold press tap-target h-[50px] w-full text-base"
        >
          <Users aria-hidden="true" className="h-5 w-5" /> Join now
        </button>
      ) : (
        <button
          type="button"
          data-public-calendar
          onClick={() => game && downloadCalendar(game)}
          className="ap-btn-outline press tap-target h-[50px] w-full text-base"
        >
          <CalendarPlus aria-hidden="true" className="h-5 w-5" /> Add to calendar
        </button>
      )}
      {footer}
    </div>
  );
}

/**
 * Play's "Next public game": the game's row, its lobby line and its button, in one panel. Its height
 * is reserved before the first paint (PUBLIC_CARD_H in lib/playCards.ts, the same for every game: the
 * row's title and lines are one line each), so the stand-in and the real card never move anything.
 */
export function PublicGameCard({
  game,
  now,
  heading,
  onJoin,
  footer,
}: {
  /** null: a stand-in before the page is up (no day, time or state: those need the phone's clock). */
  game: PublicGame | null;
  now: number;
  heading: string;
  onJoin: (roomCode: string) => void;
  footer?: ReactNode;
}) {
  return (
    <section data-public-game={game ? nextUpState(game, now) : "pending"} aria-label={heading} className="ap-section">
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
