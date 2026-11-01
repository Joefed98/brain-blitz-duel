import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { CalendarDays, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { useHomeBed } from "@/lib/useScreenMusic";
import { PageAside } from "@/components/app/PageAside";
import { goToTab } from "@/components/app/AppTabBar";
import { PublicGameNext, PublicGameRow } from "@/components/app/PublicGameCard";
import { PlaceDisc } from "@/components/app/TabIcons";
import { useClock } from "@/components/app/useClock";
import { betaValue } from "@/lib/beta/betaValues";
import { readRoomHistory, type RoomRecord } from "@/lib/duel/deviceHistory";
import { ordinal } from "@/lib/duel/ordinal";
import {
  publicRoomCodes,
  scheduledGames,
  ukDay,
  upcomingGames,
  type PublicGame,
} from "@/lib/publicSchedule";
import { APP_NAME } from "@/lib/brand";
import { OnlineOnly } from "@/components/offline/OnlineOnly";

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
  component: OfflineTournaments,
});

/** Offline practice (31 Oct 2026): with no connection, the offline state and a way to Practice. */
function OfflineTournaments() {
  // The app-wide home bed carries on here from the other tabs (docs/sound-cues/music.md).
  useHomeBed();
  return (
    <OnlineOnly tabs="tournaments" live body="Tournaments need a connection. Practice games are saved on this phone, so they still work.">
      <TournamentsScreen />
    </OnlineOnly>
  );
}

/**
 * The scheduled game a result belongs to: the same room, finished between its lobby opening and four hours
 * after its start (public games share one room code, so the time tells them apart). Null: not in the
 * schedule any more, and the row says "Public game".
 */
function gameForResult(record: RoomRecord, games: readonly PublicGame[]): PublicGame | null {
  return (
    games.find((g) => g.roomCode === record.code && record.at >= g.lobbyAt && record.at <= g.startsAt + 4 * 3_600_000) ??
    null
  );
}

function TournamentsScreen() {
  const navigate = useNavigate();
  const router = useRouter();
  const games = useMemo(() => scheduledGames(), []);
  const now = useClock(games.flatMap((g) => [g.lobbyAt, g.startsAt]));
  const upcoming = upcomingGames(now, games);
  const [next, ...later] = upcoming;
  const [results, setResults] = useState<RoomRecord[]>([]);
  useEffect(() => {
    const codes = publicRoomCodes(games);
    setResults(readRoomHistory().filter((r) => codes.has(r.code)));
  }, [games]);
  const discord = betaValue("DISCORD_URL");

  return (
    <PhoneShell tabs="tournaments" aside={<PageAside panels={["daily", "week"]} />}>
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

        {next ? (
          <section aria-label="Next up" className="ap-section">
            <div className="ap-section-head">
              <h2 className="ap-section-title">Next up</h2>
            </div>
            <div className="ap-panel overflow-hidden">
              <PublicGameNext
                game={next}
                now={now}
                onJoin={(room) => void navigate({ to: "/duel/$code", params: { code: room } })}
              />
            </div>
          </section>
        ) : (
          // Nothing scheduled (T-TournamentsEmpty): what to do meanwhile; the Discord button only with its link.
          <section aria-label="No public games" data-public-none className="ap-panel ap-empty-card">
            <span aria-hidden="true" className="ap-empty-icon">
              <CalendarDays strokeWidth={1.7} />
            </span>
            <h2 data-wrap-ok className="ap-section-title mt-1 whitespace-normal text-[20px]">
              No public games on the calendar
            </h2>
            <p className="max-w-[300px] text-[15px] leading-[1.45] text-[var(--ap-text-2)]">
              {discord ? "New dates are posted in the beta Discord. " : "New dates are posted here. "}
              Until then, start a room with friends or sharpen up in Practice.
            </p>
            <div className="mt-1.5 flex w-full flex-col gap-2">
              {discord ? (
                <a
                  href={discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-discord-link
                  className="ap-btn-outline press tap-target h-12 w-full text-[15px]"
                >
                  Open the beta Discord
                  <ExternalLink aria-hidden="true" className="h-[15px] w-[15px]" />
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => goToTab(router, "tournaments", "practice")}
                className="ap-link press tap-target h-11 w-full"
              >
                Go to Practice
              </button>
            </div>
          </section>
        )}

        {later.length > 0 ? (
          <section aria-label="Coming up" className="ap-section">
            <div className="ap-section-head">
              <h2 className="ap-section-title">Coming up</h2>
            </div>
            <div className="ap-panel">
              {later.map((game) => (
                <div key={`${game.roomCode}-${game.startsAt}`} data-public-later>
                  <PublicGameRow game={game} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section aria-label="Your results" className="ap-section">
          <div className="ap-section-head">
            <h2 className="ap-section-title">Your results</h2>
            {results.length > 0 ? (
              <span className="ap-meta">
                {results.length} {results.length === 1 ? "game" : "games"}
              </span>
            ) : null}
          </div>
          {results.length === 0 ? (
            <div data-public-results-empty className="ap-panel flex items-center gap-3.5 p-4">
              <span aria-hidden="true" className="ap-ghost-discs">
                <span />
                <span />
                <span />
              </span>
              <p className="min-w-0 flex-1 text-[14px] leading-[1.4] text-[var(--ap-text-2)]">
                Play a public game and your place, medal and points land here.
              </p>
            </div>
          ) : (
            <ul className="ap-panel">
              {results.map((r) => {
                const title = gameForResult(r, games)?.title ?? "Public game";
                // "2nd of 14" where the room's size is recorded; the place alone if it isn't.
                const place =
                  r.place === null ? "Left" : r.players > 0 ? `${ordinal(r.place)} of ${r.players}` : ordinal(r.place);
                return (
                  <li key={r.key} data-public-result data-icon="place" className="ap-row">
                    {r.place === null ? (
                      <span role="img" aria-label="Left before the end" data-place-disc="n" className="ap-place">
                        <span aria-hidden="true">–</span>
                      </span>
                    ) : (
                      <PlaceDisc place={r.place} label={`${ordinal(r.place)} place`} />
                    )}
                    <span className="ap-row-text">
                      <span data-ellipsis className="ap-row-title">
                        {title}
                      </span>
                      <span data-ellipsis className="ap-row-sub">
                        {ukDay(r.at, now)} · {place}
                      </span>
                    </span>
                    <span className="ap-points">{r.points.toLocaleString("en-GB")}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </PhoneShell>
  );
}
