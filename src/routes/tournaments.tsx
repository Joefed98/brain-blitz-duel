import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CalendarClock, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { PublicGameNext, PublicGameRow } from "@/components/app/PublicGameCard";
import { useClock } from "@/components/app/useClock";
import { readRoomHistory, type RoomRecord } from "@/lib/duel/deviceHistory";
import { ordinal } from "@/lib/duel/ordinal";
import {
  publicRoomCodes,
  scheduledGames,
  ukDay,
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
      <div className="ap-stack">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="ap-title">Tournaments</h1>
            <span className="ap-beta">Beta</span>
          </div>
          <p className="ap-sub">
            Public games on set dates. Join when the lobby opens, and everyone plays the same rounds.
          </p>
        </div>

        <section aria-label="Upcoming" className="ap-section">
          <div className="ap-section-head">
            <h2 className="ap-section-title">Upcoming</h2>
          </div>
          <div className="ap-panel">
            {next ? (
              <PublicGameNext
                game={next}
                now={now}
                onJoin={(room) => void navigate({ to: "/duel/$code", params: { code: room } })}
              />
            ) : (
              <p data-public-none className="ap-empty">
                <CalendarClock aria-hidden="true" />
                No public games scheduled yet
              </p>
            )}
            {later.map((game) => (
              <div key={`${game.roomCode}-${game.startsAt}`} data-public-later>
                <PublicGameRow game={game} now={now} />
              </div>
            ))}
          </div>
        </section>

        <section aria-label="Your results" className="ap-section">
          <div className="ap-section-head">
            <h2 className="ap-section-title">Your results</h2>
          </div>
          <div className="ap-panel">
            {results.length === 0 ? (
              <p data-public-results-empty className="ap-empty">
                <Trophy aria-hidden="true" />
                Your public game finishes will show here
              </p>
            ) : (
              <ul>
                {results.map((r) => (
                  <li key={r.key} className="ap-row">
                    <span className="ap-row-text">
                      <span className="ap-row-title">{ukDay(r.at, now)}</span>
                      <span data-ellipsis className="ap-row-sub">
                        {r.players} players · {r.points} points
                      </span>
                    </span>
                    <span
                      className="ap-score shrink-0 text-[18px]"
                    >
                      {r.place === null ? "Left" : ordinal(r.place)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </PhoneShell>
  );
}
