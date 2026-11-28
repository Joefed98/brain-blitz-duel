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
import { RatedHome } from "@/components/rated/RatedHome";
import { CompeteBoards } from "@/components/leaderboards/CompeteBoards";
import { useTournamentsAccess } from "@/components/nav/navigation";
import { useRatedStatus } from "@/lib/rated/ratedApi";
import { recordRatedEvent } from "@/lib/rated/ratedEvents";
import { Button } from "@/design/components";

export const Route = createFileRoute("/tournaments")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `${APP_NAME} compete` },
      {
        name: "description",
        content: `Ranked play, tournaments and leaderboards on ${APP_NAME}.`,
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
    <OnlineOnly tabs="tournaments" live body="Compete needs a connection. Practice still works.">
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
 * Compete (the Tournaments tab, id `tournaments`; P3, 22 Nov 2026, Joe's order of 20 Nov, plan section 2.1, mockup
 * compete-mixed-phone): about ranked play and tournaments. First the player's rating, tier, bar and gold Find a match
 * (RatedHome: only where rated play is open to them); then tournaments (the hub: live events as cards with their one
 * action, then the week's fixtures as rows; only for players tournaments are open to), with the scheduled public games
 * where any are; then, lower down, the leaderboards as tabs (CompeteBoards), the Daily top 100 one of them. Nothing
 * here changes who may see rated play or tournaments: each part asks the server as before. The "Coming soon" page is
 * gone (the leaderboards are open to all, so the tab is never empty).
 */
function TournamentsTab() {
  const access = useTournamentsAccess();
  return <TournamentsScreen soon={!access.open} />;
}

function TournamentsScreen({ soon }: { soon: boolean }) {
  // `soon`: tournaments aren't open to this player (the hub is never drawn for them).
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
  const hub = soon ? null : liveHub;
  const openEvent = (id: string) => void navigate({ to: "/tournament", search: { id } });
  const remind = async (id: string, on: boolean) => {
    const b = await tournamentsBackend();
    await b?.remind(id, on).catch(() => undefined);
    refresh();
  };

  const nextSection = next ? (
    <section aria-label="Next up" className="jz-page-section">
      <SectionHeader title="Next public game" />
      <div className="jz-panel overflow-hidden">
        <PublicGameNext game={next} now={now} onJoin={(room) => void navigate({ to: "/duel/$code", params: { code: room } })} />
      </div>
    </section>
  ) : null;
  // Nothing scheduled (T-TournamentsEmpty; wave 1's empty-state card, E2): what to do meanwhile; the Discord button
  // only with its link. Only for a player with tournaments.
  const noneSection =
    next || soon ? null : (
      <section aria-label="No public games" className="jz-page-section">
        <EmptyState
          data-public-none
          layout="card"
          title="No public games on the calendar"
          body={discord ? "New dates go up in the beta Discord." : "New dates go up here."}
          action={
            discord
              ? { label: "Open the beta Discord", href: discord, external: true, data: { "data-discord-link": "" } }
              : { label: "Go to Practice", onClick: () => goToTab(router, "tournaments", "practice") }
          }
          secondary={discord ? { label: "Go to Practice", onClick: () => goToTab(router, "tournaments", "practice") } : undefined}
        />
      </section>
    );
  const laterSection =
    later.length > 0 ? (
      <section aria-label="Coming up" className="jz-page-section">
        <SectionHeader title="Coming up" />
        <div className="jz-panel">
          {later.map((game) => (
            <div key={`${game.roomCode}-${game.startsAt}`} data-public-later>
              <PublicGameRow game={game} />
            </div>
          ))}
        </div>
      </section>
    ) : null;
  const resultsEmpty = (
    // Wave 1's empty-state card (E3's words for a results list): the button goes to playing.
    <EmptyState
      data-public-results-empty
      layout="card"
      title="No results yet"
      body="Your public game results land here."
      action={{ label: "Play with friends", onClick: () => goToTab(router, "tournaments", "play") }}
    />
  );
  const resultsList =
    results.length > 0 ? (
      <section aria-label="Your results" className="jz-page-section">
        <SectionHeader
          title="Public games"
          right={
            <span className="jz-meta-line">
              {results.length} {results.length === 1 ? "game" : "games"}
            </span>
          }
        />
        <ul className="jz-panel">
          {results.map((r) => {
            const title = gameForResult(r, games)?.title ?? "Public game";
            // "2nd of 14" where the room's size is recorded; the place alone if it isn't.
            const place =
              r.place === null ? "Left" : r.players > 0 ? `${ordinal(r.place)} of ${r.players}` : ordinal(r.place);
            return (
              <li key={r.key} data-public-result data-icon="place" className="jz-row">
                {r.place === null ? (
                  <span role="img" aria-label="Left before the end" data-place-disc="n" className="jz-place">
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
                <span className="jz-points">{r.points.toLocaleString("en-GB")}</span>
              </li>
            );
          })}
        </ul>
      </section>
    ) : null;

  // Rated play's status (null for anyone it isn't open to): the ladder and the header's Tiers link follow it.
  const rated = useRatedStatus();
  const openTiers = () => {
    recordRatedEvent({ event: "tier_ladder_viewed", from: "home" });
    void navigate({ to: "/tiers" as never, state: { fromPlayTab: true } as never } as never);
  };
  // A player without tournaments: the public games only where some are scheduled or this device played one.
  const publicGames = (
    <>
      {nextSection}
      {laterSection}
      {!next && results.length === 0 ? null : (resultsList ?? (
        <section aria-label="Your results" className="jz-page-section">
          <SectionHeader title="Your results" />
          {resultsEmpty}
        </section>
      ))}
    </>
  );

  return (
    <PhoneShell
      tabs="tournaments"
      title="Compete"
      headerAction={
        rated ? (
          <Button variant="secondary" size={44} onClick={openTiers} data-compete-tiers>
            Tiers
          </Button>
        ) : hub ? (
          <span className="jz-beta-pill">Beta</span>
        ) : undefined
      }
      aside={<PageAside panels={["daily", "week"]} />}
    >
      <div className="jz-page-stack tn-tab cp-page" data-tournaments-tab={soon ? "closed" : "open"}>
        {/* 1. Ranked play: the rating, tier, bar and gold Find a match (nothing for anyone rated play isn't open to). */}
        <RatedHome />

        {/* 2. Tournaments (a player with tournaments): live events as cards, then the week's fixtures as rows. */}
        {hub ? <TournamentHubSections hub={hub} heading="Tournaments" compact={!!rated} onOpen={openEvent} onRemind={(id, on) => void remind(id, on)} upcoming={<>{nextSection}{laterSection}{noneSection}</>} results={resultsList} resultsEmpty={hub.entries.length === 0 ? resultsEmpty : undefined} /> : publicGames}
        {/* The Joulz Championship's hall of fame (W4c): nothing while the Championship is off or nobody has won. */}
        {hub ? <HallOfFame on={TOURNAMENT_KINDS_ON.championship} /> : null}

        {/* 3. The leaderboards, lower down: Rating, Puzzles, Arcade and the Daily top 100 as tabs, your row pinned. */}
        <CompeteBoards />
      </div>
    </PhoneShell>
  );
}
