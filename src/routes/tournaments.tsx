import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { PublicGameCard } from "@/components/app/PublicGameCard";
import { useClock } from "@/components/app/useClock";
import { readRoomHistory, type RoomRecord } from "@/lib/duel/deviceHistory";
import { ordinal } from "@/lib/duel/ordinal";
import {
  publicRoomCodes,
  scheduledGames,
  ukDay,
  ukTime,
  upcomingGames,
} from "@/lib/publicSchedule";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/tournaments")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `${APP_NAME} tournaments — public games` },
      {
        name: "description",
        content: `Scheduled public ${APP_NAME} games: join the room when the lobby opens.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TournamentsScreen,
});

function TournamentsScreen() {
  const navigate = useNavigate();
  const games = useMemo(() => scheduledGames(), []);
  const now = useClock(games.flatMap((g) => [g.lobbyAt, g.startsAt]));
  const upcoming = upcomingGames(now, games);
  const [next, ...later] = upcoming;
  const [results, setResults] = useState<RoomRecord[]>([]);
  useEffect(() => {
    const codes = publicRoomCodes(games);
    setResults(readRoomHistory().filter((r) => codes.has(r.code)));
  }, [games]);

  return (
    <PhoneShell tabs="tournaments">
      <div className="flex flex-1 flex-col gap-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold">Tournaments</h1>
            <span className="rounded-full border border-category-logic/60 px-2 py-0.5 font-mono text-[11px] uppercase tracking-widest text-category-logic">
              Beta
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Scheduled public games. Join the room when its lobby opens; everyone plays the same
            rounds.
          </p>
        </div>

        {next ? (
          <PublicGameCard
            game={next}
            now={now}
            heading="Next up"
            onJoin={(room) => void navigate({ to: "/duel/$code", params: { code: room } })}
          />
        ) : (
          <div
            data-public-none
            className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-6 text-center"
          >
            <CalendarClock aria-hidden="true" className="h-7 w-7 text-muted-foreground" />
            <p className="font-display text-sm font-semibold text-foreground">
              No public games scheduled
            </p>
            <p className="text-xs text-muted-foreground">
              New dates appear here as soon as they are set.
            </p>
          </div>
        )}

        {later.length > 0 ? (
          <section aria-label="Coming up" className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-bold">Coming up</h2>
            <ul className="flex flex-col gap-2">
              {later.map((game) => (
                <li
                  key={`${game.roomCode}-${game.startsAt}`}
                  data-public-later
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/80 px-4 py-3"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-display text-sm font-semibold text-foreground">
                      {ukDay(game.startsAt, now)} · {ukTime(game.startsAt)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {game.title ? `${game.title} · ` : ""}
                      {game.rounds} rounds · lobby {ukTime(game.lobbyAt)}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    UK
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-label="Your results" className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">Your results</h2>
          {results.length === 0 ? (
            <div
              data-public-results-empty
              className="flex items-center gap-3 rounded-xl border border-dashed border-border px-4 py-4"
            >
              <Trophy aria-hidden="true" className="h-6 w-6 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No public games played yet</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((r) => (
                <li
                  key={r.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/80 px-4 py-3"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-display text-sm font-semibold text-foreground">
                      {ukDay(r.at, now)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.players} players ·{" "}
                      <span className="font-mono tabular-nums">{r.points}</span> points
                    </span>
                  </span>
                  <span
                    className={`shrink-0 font-mono text-base font-bold tabular-nums ${r.place === 1 ? "text-primary" : "text-foreground"}`}
                  >
                    {r.place === null ? "Left" : ordinal(r.place)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PhoneShell>
  );
}
