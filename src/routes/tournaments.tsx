import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
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
import { EmptyState, SectionHeader } from "@/design/components";
import { TournamentHubSections } from "@/components/tournaments/TournamentHub";
import { tournamentsBackend, useTournamentHub } from "@/lib/tournaments/tournamentsApi";
import { HallOfFame } from "@/components/tournaments/BigEventLive";
import { TOURNAMENT_KINDS_ON } from "@/config/tournamentConfig";
import { NavArt } from "@/components/nav/NavArt";
import { useTournamentsAccess } from "@/components/nav/navigation";

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
      <TournamentsTab />
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

/**
 * The Tournaments tab (the navigation step, 14 Nov 2026): always in the navigation. A player who has tournaments
 * (today's switch: TOURNAMENTS_FOR_EVERYONE or the tester list, answered by the server's hub) gets the tournaments
 * screens exactly as before; everyone else the coming-soon page, which lists the upcoming public games where any are
 * scheduled and shows no list where none are.
 */
function TournamentsTab() {
  const access = useTournamentsAccess();
  return <TournamentsScreen soon={!access.open} />;
}

/** The coming-soon page's top: the trophy, a quiet tag and two lines (the navigation's own look, nav.css). */
function ComingSoon() {
  return (
    <section aria-label="Tournaments are coming" data-tournaments-soon className="th-card jz-nav jz-nav-soon">
      <NavArt name="trophyHero" size={96} />
      <span className="jz-nav-soon-tag">Coming soon</span>
      <h2 className="jz-nav-soon-title">Compete for trophies</h2>
      <p className="jz-nav-soon-body">
        Arenas, daily Score Attacks and cups, with trophies for your Profile. They open here soon.
      </p>
    </section>
  );
}

function TournamentsScreen({ soon }: { soon: boolean }) {
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
  // Wave 4 (W4b): the Arena and the daily Score Attack, once the server answers with tournaments open; until then
  // (and for anyone they aren't open to) the tab is exactly the public games below.
  const { hub: liveHub, refresh } = useTournamentHub();
  // The coming-soon page never draws the hub (a player it shows to has no tournaments).
  const hub = soon ? null : liveHub;
  const openEvent = (id: string) => void navigate({ to: "/tournament", search: { id } });
  const remind = async (id: string, on: boolean) => {
    const b = await tournamentsBackend();
    await b?.remind(id, on).catch(() => undefined);
    refresh();
  };

  return (
    <PhoneShell tabs="tournaments" title="Tournaments" aside={<PageAside panels={["daily", "week"]} />}>
      <div className="ap-stack">
        {soon ? null : (
        <div className="flex items-start gap-2.5">
          <span className="ap-beta">Beta</span>
          <p className="ap-sub">
            Public games on set dates. Join when the lobby opens, and everyone plays the same rounds.
          </p>
        </div>
        )}
        {soon ? <ComingSoon /> : null}

        {hub ? <TournamentHubSections hub={hub} onOpen={openEvent} onRemind={(id, on) => void remind(id, on)} /> : null}
        {/* The Joulz Championship's hall of fame (W4c): nothing while the Championship is off or nobody has won. */}
        {hub ? <HallOfFame on={TOURNAMENT_KINDS_ON.championship} /> : null}

        {next ? (
          <section aria-label="Next up" className="ap-section">
            <SectionHeader title="Next up" />
            <div className="jz-panel overflow-hidden">
              <PublicGameNext
                game={next}
                now={now}
                onJoin={(room) => void navigate({ to: "/duel/$code", params: { code: room } })}
              />
            </div>
          </section>
        ) : soon ? null : (
          // Nothing scheduled (T-TournamentsEmpty; wave 1's empty-state card, E2): what to do meanwhile; the
          // Discord button only with its link.
          <section aria-label="No public games" className="ap-section">
            <EmptyState
              data-public-none
              layout="card"
              title="No public games on the calendar"
              body={`${discord ? "New dates are posted in the beta Discord." : "New dates are posted here."} Until then, start a room with friends or sharpen up in Practice.`}
              action={
                discord
                  ? { label: "Open the beta Discord", href: discord, external: true, data: { "data-discord-link": "" } }
                  : { label: "Go to Practice", onClick: () => goToTab(router, "tournaments", "practice") }
              }
              secondary={discord ? { label: "Go to Practice", onClick: () => goToTab(router, "tournaments", "practice") } : undefined}
            />
          </section>
        )}

        {later.length > 0 ? (
          <section aria-label="Coming up" className="ap-section">
            <SectionHeader title="Coming up" />
            <div className="jz-panel">
              {later.map((game) => (
                <div key={`${game.roomCode}-${game.startsAt}`} data-public-later>
                  <PublicGameRow game={game} />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* Coming soon: the results only where public games are scheduled or this device has played one. */}
        {soon && !next && results.length === 0 ? null : (
        <section aria-label="Your results" className="ap-section">
          <SectionHeader
            title="Your results"
            right={
              <>
                {results.length > 0 ? (
                  <span className="ap-meta">
                    {results.length} {results.length === 1 ? "game" : "games"}
                  </span>
                ) : null}
              </>
            }
          />
          {results.length === 0 ? (
            // Wave 1's empty-state card (E3's words for a results list): the button goes to playing.
            <EmptyState
              data-public-results-empty
              layout="card"
              title="No results yet"
              body="Play a public game and your place, medal and points land here."
              action={{ label: "Play with friends", onClick: () => goToTab(router, "tournaments", "play") }}
            />
          ) : (
            <ul className="jz-panel">
              {results.map((r) => {
                const title = gameForResult(r, games)?.title ?? "Public game";
                // "2nd of 14" where the room's size is recorded; the place alone if it isn't.
                const place =
                  r.place === null ? "Left" : r.players > 0 ? `${ordinal(r.place)} of ${r.players}` : ordinal(r.place);
                return (
                  <li key={r.key} data-public-result data-icon="place" className="jz-row">
                    {r.place === null ? (
                      <span role="img" aria-label="Left before the end" data-place-disc="n" className="ap-place">
                        <span aria-hidden="true">–</span>
                      </span>
                    ) : (
                      <PlaceDisc place={r.place} label={`${ordinal(r.place)} place`} />
                    )}
                    <span className="jz-row-text">
                      <span data-ellipsis className="jz-row-title">
                        {title}
                      </span>
                      <span data-ellipsis className="jz-row-sub">
                        {ukDay(r.at, now)}, {place}
                      </span>
                    </span>
                    <span className="ap-points">{r.points.toLocaleString("en-GB")}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        )}
      </div>
    </PhoneShell>
  );
}
