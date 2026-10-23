import { CalendarPlus, Trophy, Users } from "lucide-react";
import type { ReactNode } from "react";

import {
  downloadCalendar,
  nextUpState,
  ukDay,
  ukTime,
  type PublicGame,
} from "@/lib/publicSchedule";

/**
 * A scheduled public game: day and time (UK time), rounds and lobby time, and one button. Before
 * the lobby opens it offers "Add to calendar" (an .ics file); from lobby time until the start it
 * offers "Join now", which opens the public room (the room's own link join asks for a name).
 */
export function PublicGameCard({
  game,
  now,
  heading,
  onJoin,
  footer,
  tint = "teal",
}: {
  /** null: a stand-in before the page is up (no day, time or state: those need the phone's clock). */
  game: PublicGame | null;
  now: number;
  heading: string;
  onJoin: (roomCode: string) => void;
  footer?: ReactNode;
  /** The card's tint (polish-layout/theme.css): teal on Play, gold with a faint trophy for Tournaments' Next up. */
  tint?: "teal" | "gold";
}) {
  const gold = tint === "gold";
  const state = game ? nextUpState(game, now) : "calendar";
  return (
    <section
      data-public-game={game ? state : "pending"}
      aria-label={heading}
      data-tint={tint}
      className="th-card th-card-clip flex flex-col gap-3 rounded-2xl border border-category-logic/35 bg-card/80 p-4"
    >
      {gold ? <Trophy aria-hidden="true" strokeWidth={1.5} className="th-trophy" /> : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`th-kicker ${gold ? "text-primary" : "text-category-logic"}`}>{heading}</p>
          <p className="mt-1 whitespace-nowrap font-display text-xl font-bold uppercase leading-tight text-foreground">
            {game ? `${ukDay(game.startsAt, now)} · ${ukTime(game.startsAt)}` : "····"}
          </p>
          {game?.title ? (
            <p className="mt-0.5 truncate text-sm text-foreground">{game.title}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono tabular-nums">{game ? game.rounds : "·"}</span> rounds ·{" "}
            {!game ? "Lobby opens at ····" : state === "join" ? "Lobby open now" : `Lobby opens at ${ukTime(game.lobbyAt)}`}
          </p>
        </div>
        <span data-tone={gold ? "gold" : "teal"} className="th-pill shrink-0">
          UK time
        </span>
      </div>
      {state === "join" ? (
        <button
          type="button"
          data-public-join
          onClick={() => game && onJoin(game.roomCode)}
          className={`${gold ? "th-btn-gold" : "th-btn-teal"} press tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-category-logic font-display text-base font-extrabold uppercase tracking-wide text-[#0B0B0F]`}
        >
          <Users aria-hidden="true" className="h-5 w-5" /> Join now
        </button>
      ) : (
        <button
          type="button"
          data-public-calendar
          onClick={() => game && downloadCalendar(game)}
          className={`${gold ? "th-btn-outline-gold" : "th-btn-outline-teal"} press tap-target flex w-full items-center justify-center gap-2 rounded-xl border border-category-logic/60 bg-category-logic/10 font-display text-sm font-bold uppercase tracking-wide text-category-logic`}
        >
          <CalendarPlus aria-hidden="true" className="h-5 w-5" /> Add to calendar
        </button>
      )}
      {footer}
    </section>
  );
}
