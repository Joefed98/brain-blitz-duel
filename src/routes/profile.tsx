import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { FeedbackLink } from "@/components/beta/FeedbackLink";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { useHomeBed } from "@/lib/useScreenMusic";
import { goToTab } from "@/components/app/AppTabBar";
import { PlaceDisc } from "@/components/app/TabIcons";
import { readRoomHistory, type RoomRecord } from "@/lib/duel/deviceHistory";
import { rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
import { bestOf, starTotalLine } from "@/lib/practice/progress";
import { STAR_TOTAL_MAX } from "@/lib/practice/progressRules";
import { usePracticeProgress } from "@/lib/practice/useProgress";
import { ACTIVE_PUZZLE_TYPES, PUZZLE_REGISTRY, gameCounts } from "@/lib/duel/catalogue";
import { getStoredName } from "@/lib/duel/session";
import { ordinal } from "@/lib/duel/ordinal";
import type { PuzzleType } from "@/lib/duel/types";
import { ukDay } from "@/lib/publicSchedule";
import { APP_NAME } from "@/lib/brand";
import { Button, EmptyState, Icon, SectionHeader } from "@/design/components";
import { useAccountName } from "@/lib/account/accountApi";
import { SeasonSection } from "@/components/seasons/SeasonSection";
import { ProfileCard, ProfileRatings } from "@/components/identity/ProfileCard";
import { Gauge, bestStreak } from "@/components/profile/ProfileGauges";
import { SaveProgressOffer } from "@/components/account/SaveProgress";
import { Onboarding } from "@/components/duel/Onboarding";
import { NavArt } from "@/components/nav/NavArt";
import type { NavArtName } from "@/components/nav/navArt.data";
import { useDailyRecord } from "@/lib/badges/badgesApi";
import { useWaitingRequests } from "@/lib/friends/friendsApi";
import { useRatedWins } from "@/lib/profile/ratedWins";
import { useLayoutMode } from "@/lib/layoutMode";
import { TrophyCabinet, TrophyShelf } from "@/components/tournaments/TournamentHub";
import { useMyTrophies } from "@/lib/tournaments/tournamentsApi";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `${APP_NAME}: you` },
      {
        name: "description",
        content: `Your ${APP_NAME} card, trophies, ratings, stars, friends and badges.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfileScreen,
});

/** Every game rooms deal ("Any of the 72 games"). */
const ACTIVE_GAMES = (() => {
  const counts = gameCounts();
  return counts.puzzle + counts.arcade;
})();

/**
 * You (the You tab, the Profile route; P3, 22 Nov 2026, Joe's mix of Y2 and Y3, plan section 2.1, mockup
 * you-mixed-phone): Profile and More in one page.
 *
 * An account: the player card large with Customise; the trophy shelf as one row under it; three ring gauges (rated
 * wins, stars, the Daily streak) in place of stat tiles; the strongest categories (with the three ratings, where rated play
 * is open); four quick rows, Friends, Challenges, Badges and Help ("How it works"); then the recent matches, the season
 * and the trophy cabinet; Settings in the header. A guest: one card and one calm "Save your progress" row, nothing
 * more (30 words at most; the name a guest plays under is picked in the shared name sheet when it is needed).
 */
function ProfileScreen() {
  // The app-wide home bed carries on here from the other tabs (docs/sound-cues/music.md).
  useHomeBed();
  const router = useRouter();
  const [name, setName] = useState("");
  const [look, setLook] = useState<PlayerLook>({ colour: 0, icon: null });
  const [history, setHistory] = useState<RoomRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [help, setHelp] = useState(false);
  const [offer, setOffer] = useState(false);

  useEffect(() => {
    setName(getStoredName());
    const remembered = rememberedLook();
    setLook({ colour: remembered.colour ?? 0, icon: remembered.icon ?? null });
    setHistory(readRoomHistory());
    setLoaded(true);
  }, []);
  // Practice stars and bests are the account's (the server's: useProgress.ts), the same on every device.
  const progress = usePracticeProgress();
  const bests = useMemo(
    () =>
      ACTIVE_PUZZLE_TYPES.map((type) => ({ type, best: bestOf(progress, type) }))
        .filter((row): row is { type: PuzzleType; best: number } => row.best !== null)
        .sort((a, b) => b.best - a.best || PUZZLE_REGISTRY[a.type].name.localeCompare(PUZZLE_REGISTRY[b.type].name)),
    [progress],
  );
  // The Daily's streak (the server's for an account, this device's otherwise: useDailyRecord).
  const daily = useDailyRecord();
  const streakBest = useMemo(() => Math.max(bestStreak(daily?.days ?? []), daily?.streak ?? 0), [daily]);
  // A signed-in player is shown by their username (changed in Settings → Account), a guest by the name they play under.
  const accountName = useAccountName();
  const shownName = accountName ?? (name.trim() || "Player");
  const waiting = useWaitingRequests(accountName !== null);
  // Rated wins: the server's count of this account's counted rated matches and wins (ratedWinCountFn).
  const rated = useRatedWins(accountName !== null);
  // Wave 4 (W4b): the trophy cabinet holds only the account's real trophies, and isn't drawn without one.
  const trophies = useMyTrophies(accountName !== null);
  // Room podiums on this device (the shelf's medals), newest first.
  const podiums = useMemo(
    () =>
      history
        .filter((r): r is RoomRecord & { place: 1 | 2 | 3 } => r.place === 1 || r.place === 2 || r.place === 3)
        .sort((a, b) => b.at - a.at)
        .map((r) => ({ key: r.key, place: r.place })),
    [history],
  );
  // Get started (an account's only): three steps that tick off from this device's own records, until all are done.
  const steps = [
    { id: "room", title: "Play your first room", sub: "Rooms, wins and podiums start counting", done: history.length > 0 },
    { id: "daily", title: "Do today’s daily", sub: "Starts your streak", done: (daily?.days.length ?? 0) > 0 },
    { id: "practice", title: "Set a practice best", sub: `Any of the ${ACTIVE_GAMES} games`, done: bests.length > 0 },
  ] as const;
  const doneCount = steps.filter((step) => step.done).length;
  // A tablet or computer draws the card column as the page's side column (PhoneShell's aside); a phone heads the page with it.
  const wide = useLayoutMode() !== "phone";

  const push = (to: string, search?: Record<string, unknown>) =>
    void router.navigate({ to, ...(search ? { search } : {}), state: { fromPlayTab: true } as never } as never);
  const openStep = (id: (typeof steps)[number]["id"]) => {
    if (id === "room") goToTab(router, "profile", "play");
    else if (id === "practice") goToTab(router, "profile", "practice");
    else push("/daily", { kind: "puzzle" });
  };
  const openGames = () => goToTab(router, "profile", "practice");
  // An account's Customise card opens Customise (a guest's opens the save-your-progress sheet, in ProfileCard).
  const openCustomise = () => push("/customise");

  if (help) return <Onboarding onDone={() => setHelp(false)} />;

  // The card column (Joe's style guide, profile.png): on a phone it heads the page; on a tablet or computer it is the
  // page's side column (PhoneShell's aside, drawn on the left: polish-layout/profile.css), sticky while the page scrolls.
  const cardColumn = <ProfileCard guestName={shownName} guestColour={loaded ? look.colour : null} onCustomise={openCustomise} />;

  const quickRows: { key: string; art: NavArtName; label: string; open: () => void; count?: number }[] = [
    { key: "friends", art: "friends", label: "Friends", open: () => push("/friends"), count: waiting },
    { key: "challenges", art: "challenges", label: "Challenges", open: () => push("/challenges") },
    { key: "badges", art: "tournaments", label: "Badges", open: () => push("/badges") },
    { key: "help", art: "support", label: "Help", open: () => setHelp(true) },
  ];

  return (
    <PhoneShell
      tabs="profile"
      title="You"
      headerAction={
        <Button variant="secondary" size={44} data-open-settings onClick={() => push("/settings")}>
          <Icon name="settings" size={20} /> Settings
        </Button>
      }
      aside={
        <aside aria-label="Your card" data-page-aside className="dk-aside pf-aside">
          {cardColumn}
        </aside>
      }
    >
      <div className="jz-page-stack pf-page" data-profile-page={accountName ? "account" : "guest"}>
        {wide ? null : cardColumn}

        {/* A guest (Joe, 20 Nov 2026: one card and one calm row): where their progress lives, and the beta's Send
            feedback link (nothing while TALLY_URL is empty). None for an account. */}
        {accountName ? null : (
          <div data-profile-footer className="pf-save">
            <button type="button" className="jz-row jz-panel press pf-save-row" onClick={() => setOffer(true)} data-save-progress-row>
              <Icon name="star" size={24} tone="gold" />
              <span className="jz-row-text">
                <span className="jz-row-title">Save your progress</span>
                <span data-look-moved data-wrap-ok className="jz-row-sub pf-footer-note">
                  Saved on this phone. Create an account to keep it everywhere. Pick your card in Customise.
                </span>
              </span>
              <Icon name="chevron-right" size={20} className="jz-chevron" />
            </button>
            <FeedbackLink />
            {offer ? <SaveProgressOffer onClose={() => setOffer(false)} /> : null}
          </div>
        )}

        {accountName ? (
          <>
            {/* The trophy shelf: the newest season emblems, trophies and podium medals in one row. */}
            <TrophyShelf trophies={trophies} podiums={podiums} />

            {/* Three ring gauges in place of stat tiles: rated wins (the server's count), stars, the Daily streak. */}
            <div className="pf-gauges" data-profile-gauges>
              <Gauge
                share={rated && rated.played ? rated.wins / rated.played : 0}
                tone="var(--jz-win)"
                figure={!rated ? "–" : rated.played ? `${Math.round((rated.wins / rated.played) * 100)}%` : "0"}
                label="Rated wins"
                sub={rated ? `${rated.wins} of ${rated.played}` : " "}
                ariaLabel={rated ? `Rated wins: ${rated.wins} of ${rated.played}` : "Rated wins"}
                data={{ "data-gauge": "rated-wins", "data-rated-wins": rated ? `${rated.wins}/${rated.played}` : undefined }}
              />
              {progress ? (
                <section aria-label="Mastery stars" data-profile-mastery={progress.stars} className="pf-gauge-slot">
                  <Gauge
                    share={progress.stars / STAR_TOTAL_MAX}
                    tone="var(--jz-gold)"
                    figure={String(progress.stars)}
                    label="Stars"
                    sub={`of ${STAR_TOTAL_MAX}`}
                    ariaLabel={`${starTotalLine(progress)}. Open Games`}
                    onClick={openGames}
                    data={{ "data-gauge": "stars", "data-profile-mastery-open": "" }}
                  />
                </section>
              ) : (
                <Gauge share={0} tone="var(--jz-gold)" figure="0" label="Stars" sub={`of ${STAR_TOTAL_MAX}`} data={{ "data-gauge": "stars" }} />
              )}
              <Gauge
                share={streakBest ? (daily?.streak ?? 0) / streakBest : 0}
                tone="var(--jz-bronze)"
                figure={String(daily?.streak ?? 0)}
                label="Daily streak"
                sub={`best ${streakBest}`}
                ariaLabel={`Daily streak ${daily?.streak ?? 0}, best ${streakBest}`}
                data={{ "data-gauge": "streak" }}
              />
            </div>

            {/* The strongest categories and the three ratings, only where rated play is open (W3c's figures). */}
            <ProfileRatings />

            {/* Friends, Challenges, Badges and Help ("How it works", the three intro panels). */}
            <nav aria-label="More" className="pf-quick" data-profile-rows>
              {quickRows.map((row) => (
                <button key={row.key} type="button" className="pf-quick-tile press" onClick={row.open} data-profile-row={row.key}>
                  <NavArt name={row.art} size={36} />
                  <span className="pf-quick-label" data-one-line>
                    {row.label}
                  </span>
                  {row.count ? (
                    <span className="pf-count pf-quick-count" data-friends-waiting={row.count} aria-label={`${row.count} waiting`}>
                      {row.count > 99 ? "99+" : row.count}
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>

            {/* Recent matches: this device's finished rooms (deviceHistory.ts). */}
            {loaded && history.length === 0 ? (
              <section aria-label="Recent matches" className="pf-section">
                <SectionHeader title="Recent matches" />
                <EmptyState
                  data-recent-rooms-empty
                  layout="card"
                  gold
                  title="No games yet"
                  body="Your games and results show up here."
                  action={{ label: "Start playing", onClick: () => goToTab(router, "profile", "play") }}
                />
              </section>
            ) : null}
            {history.length > 0 ? (
              <section aria-label="Recent matches" className="pf-section" data-profile-history>
                <SectionHeader title="Recent matches" />
                <ul className="jz-panel">
                  {history.slice(0, 5).map((r) => (
                    <li key={r.key} data-recent-room={r.code} data-icon="place" className="jz-row">
                      {r.place === null ? (
                        <span role="img" aria-label="Left before the end" data-place-disc="n" className="jz-place">
                          <span aria-hidden="true">–</span>
                        </span>
                      ) : (
                        <PlaceDisc place={r.place} label={`${ordinal(r.place)} place`} />
                      )}
                      <span className="jz-row-text">
                        <span data-ellipsis className="jz-row-title">
                          Room {r.code}
                        </span>
                        <span data-ellipsis className="jz-row-sub">
                          {ukDay(r.at, Date.now())}, {r.players} {r.players === 1 ? "player" : "players"}
                          {r.place === null ? ", left" : ""}
                        </span>
                      </span>
                      <span className="pf-row-figure">{r.points.toLocaleString("en-GB")}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* Wave 4 W4d: the season peak and history with the season emblems (accounts, real data only). */}
            <SeasonSection />
            <TrophyCabinet trophies={trophies} />

            {/* Get started (T-ProfileNew): three steps that tick off from this device's own records, last on the page
                and shown only until all three are done. */}
            {loaded && doneCount < steps.length ? (
              <section aria-label="Get started" data-get-started className="pf-section">
                <SectionHeader title="Get started" right={<span className="jz-meta-line">{doneCount} of {steps.length}</span>} />
                <div className="jz-panel">
                  {steps.map((step) => (
                    <button
                      key={step.id}
                      type="button"
                      data-step={step.id}
                      data-done={step.done || undefined}
                      aria-label={step.done ? `${step.title}, done` : step.title}
                      data-icon="check"
                      onClick={() => openStep(step.id)}
                      className="jz-row press"
                    >
                      <span aria-hidden="true" data-done={step.done || undefined} className="jz-check">
                        {step.done ? <Icon name="check" size={18} /> : null}
                      </span>
                      <span className="jz-row-text">
                        <span className="jz-row-title">{step.title}</span>
                        <span data-ellipsis className="jz-row-sub">
                          {step.sub}
                        </span>
                      </span>
                      <Icon name="chevron-right" size={20} className="jz-chevron" />
                    </button>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </PhoneShell>
  );
}
