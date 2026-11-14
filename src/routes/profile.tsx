import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { FeedbackLink } from "@/components/beta/FeedbackLink";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { useHomeBed } from "@/lib/useScreenMusic";
import { Onboarding } from "@/components/duel/Onboarding";
import { goToTab } from "@/components/app/AppTabBar";
import { GameIcon } from "@/components/app/GameIcon";
import { PlaceDisc } from "@/components/app/TabIcons";
import { SettingsSheet } from "@/components/app/SettingsSheet";
import { YourChallenges } from "@/components/challenge/YourChallenges";
import { ProfileChallenges } from "@/components/app/ProfileChallenges";
import { readRoomHistory, roomStats, type RoomRecord } from "@/lib/duel/deviceHistory";
import { useDailyRecord } from "@/lib/badges/badgesApi";
import { dailyStreak, readDailyRecord, type DailyRecord } from "@/lib/duel/dailyRecord";
import { ukDayKey } from "@/lib/duel/daily";
import { rememberedLook, type PlayerLook } from "@/lib/duel/playerLook";
import { bestOf, starTotalLine } from "@/lib/practice/progress";
import { GEM_THRESHOLDS, STAR_TOTAL_MAX, gemsFor, nextGem } from "@/lib/practice/progressRules";
import { usePracticeProgress } from "@/lib/practice/useProgress";
import { ACTIVE_PUZZLE_TYPES, PUZZLE_REGISTRY, gameCounts } from "@/lib/duel/catalogue";
import { getStoredName, setStoredName } from "@/lib/duel/session";
import { ordinal } from "@/lib/duel/ordinal";
import type { PuzzleType } from "@/lib/duel/types";
import { ukDay } from "@/lib/publicSchedule";
import { APP_NAME } from "@/lib/brand";
import { Button, EmptyState, Icon, Input, Progress, SectionHeader } from "@/design/components";
import { GUEST_NAME_MAX } from "@/lib/names/username";
import { useAccountName } from "@/lib/account/accountApi";
import { SeasonSection } from "@/components/seasons/SeasonSection";
import { ProfileCard, ProfileRatings } from "@/components/identity/ProfileCard";
import { ProfileArt } from "@/components/profile/ProfileArt";
import { ProfileBadges } from "@/components/profile/ProfileBadges";
import { ProfileFriends } from "@/components/profile/ProfileFriends";
import { useLayoutMode } from "@/lib/layoutMode";
import { TrophyCabinet } from "@/components/tournaments/TournamentHub";
import { useMyTrophies } from "@/lib/tournaments/tournamentsApi";
import { ProfileBoards } from "@/components/leaderboards/ProfileBoards";

export const Route = createFileRoute("/profile")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `${APP_NAME} profile` },
      {
        name: "description",
        content: `Your ${APP_NAME} card, rooms, practice stars and bests.`,
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

function ProfileScreen() {
  // The app-wide home bed carries on here from the other tabs (docs/sound-cues/music.md).
  useHomeBed();
  const router = useRouter();
  const [name, setName] = useState("");
  const [look, setLook] = useState<PlayerLook>({ colour: 0, icon: null });
  const [settings, setSettings] = useState(false);
  const [intro, setIntro] = useState(false);
  const [history, setHistory] = useState<RoomRecord[]>([]);
  const [daily, setDaily] = useState<DailyRecord | null>(null);
  const [loaded, setLoaded] = useState(false);
  const dailyView = useDailyRecord();
  const dailyShown =
    dailyView?.source === "server"
      ? dailyView
      : daily
        ? { days: daily.days, best: daily.best, streak: dailyStreak(daily.days, ukDayKey(Date.now())) }
        : null;

  useEffect(() => {
    setName(getStoredName());
    const remembered = rememberedLook();
    setLook({ colour: remembered.colour ?? 0, icon: remembered.icon ?? null });
    setHistory(readRoomHistory());
    setDaily(readDailyRecord());
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
  const upNext = progress ? nextGem(progress.stars) : null;
  const stats = useMemo(() => roomStats(history), [history]);
  // A signed-in player is shown by their username (changed in Settings → Account), a guest by the name typed.
  const accountName = useAccountName();
  const shownName = accountName ?? (name.trim() || "Player");
  // Wave 4 (W4b): the trophy cabinet holds only the account's real trophies, and isn't drawn without one.
  const trophies = useMyTrophies(accountName !== null);
  // What this device has done (its own records): the Get started steps tick off from these, and a
  // section with nothing in it yet isn't drawn (a new player sees no zeros).
  const steps = [
    { id: "room", title: "Play your first room", sub: "Rooms, wins and podiums start counting", done: history.length > 0 },
    { id: "daily", title: "Do today’s daily", sub: "Starts your streak", done: (daily?.days.length ?? 0) > 0 },
    { id: "practice", title: "Set a practice best", sub: `Any of the ${ACTIVE_GAMES} games`, done: bests.length > 0 },
  ] as const;
  const doneCount = steps.filter((step) => step.done).length;
  // A tablet or computer draws the card column as the page's side column (PhoneShell's aside); a phone heads the page with it.
  const wide = useLayoutMode() !== "phone";

  if (intro) return <Onboarding onDone={() => setIntro(false)} />;

  const openStep = (id: (typeof steps)[number]["id"]) => {
    if (id === "room") goToTab(router, "profile", "play");
    else if (id === "practice") goToTab(router, "profile", "practice");
    else void router.navigate({ to: "/daily", search: { kind: "puzzle" }, state: { fromPlayTab: true } as never } as never);
  };
  const openGames = () => goToTab(router, "profile", "practice");
  // The gem the star total has unlocked (the latest), and the next one.
  const gem = progress ? GEM_THRESHOLDS.find((g) => g.gem === gemsFor(progress.stars).at(-1)) ?? null : null;

  // The card column (Joe's style guide, profile.png): on a phone it heads the page; on a tablet or computer it is the
  // page's side column (PhoneShell's aside, drawn on the left: polish-layout/profile.css), sticky while the page scrolls.
  const cardColumn = (
    <>
      <ProfileCard guestName={shownName} guestColour={loaded ? look.colour : null} />
      {/* A guest's display name for new rooms, the Daily and challenges; an account's name is its username, changed in
          Settings → Account. "Your look" is retired (13 Nov 2026): a guest picks their colour in each lobby. */}
      {accountName ? null : (
        <section aria-label="Your name" data-profile-rooms className="pf-section">
          <div className="jz-panel pf-name" data-profile-guest-name>
            <label htmlFor="profile-name" className="pf-name-label">
              Display name
            </label>
            <Input
              id="profile-name"
              value={name}
              maxLength={GUEST_NAME_MAX}
              placeholder="Your name"
              onChange={(e) => {
                setName(e.target.value);
                setStoredName(e.target.value.trim());
              }}
            />
            <p data-look-moved data-wrap-ok className="pf-name-note">
              Pick your colour in any room’s lobby. Save your progress to choose a full card in Customise.
            </p>
          </div>
        </section>
      )}
    </>
  );

  return (
    <PhoneShell
      tabs="profile"
      title="Profile"
      headerAction={
        <Button variant="icon" aria-label="Settings" data-open-settings onClick={() => setSettings(true)} className="-mr-2.5">
          <Icon name="settings" size={20} />
        </Button>
      }
      aside={
        <aside aria-label="Your card" data-page-aside className="dk-aside pf-aside">
          {cardColumn}
        </aside>
      }
    >
      <div className="ap-stack pf-page" data-profile-page>
        {wide ? null : cardColumn}

        {/* Get started (T-ProfileNew): three steps that tick off from this device's own records. */}
        {loaded && doneCount < steps.length ? (
          <section aria-label="Get started" data-get-started className="pf-section">
            <SectionHeader title="Get started" right={<span className="ap-meta">{doneCount} of {steps.length}</span>} />
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
                  <span aria-hidden="true" data-done={step.done || undefined} className="ap-check">
                    {step.done ? <Icon name="check" size={18} /> : null}
                  </span>
                  <span className="jz-row-text">
                    <span className="jz-row-title">{step.title}</span>
                    <span data-ellipsis className="jz-row-sub">
                      {step.sub}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={20} className="ap-chevron" />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* Ratings: the Joulz Rating, Puzzles and Arcade, only where rated play is open (W3c's figures). */}
        <ProfileRatings />

        {/* Mastery (wave 2 C1a): the account's star total out of the live games' stars and the gem it has unlocked;
            a tap opens Games. */}
        {progress ? (
          <section aria-label="Mastery stars" data-profile-mastery={progress.stars} className="pf-section">
            <SectionHeader
              title="Mastery"
              right={
                <button type="button" className="pf-see press" onClick={openGames} data-profile-mastery-games>
                  Games
                </button>
              }
            />
            <button type="button" className="jz-panel pf-mastery press" onClick={openGames} data-profile-mastery-open>
              <Icon name="star" size={24} tone="gold" />
              <span className="pf-mastery-text">
                <span className="pf-mastery-line" data-one-line>
                  {starTotalLine(progress)}
                </span>
                <Progress value={progress.stars / STAR_TOTAL_MAX} />
                <span data-profile-next-gem className="pf-mastery-sub" data-one-line>
                  {upNext ? `Next gem: ${upNext.name} at ${upNext.stars}` : `All ${GEM_THRESHOLDS.length} gems unlocked`}
                </span>
              </span>
              {gem ? (
                <span className="pf-gem" data-profile-gem={gem.gem}>
                  <ProfileArt name="gem" />
                  <span className="pf-gem-name" data-one-line>
                    {gem.name}
                  </span>
                </span>
              ) : null}
            </button>
          </section>
        ) : null}

        {/* Recent matches: this device's finished rooms (deviceHistory.ts), with the rooms played, wins and podiums. */}
        {loaded && history.length === 0 ? (
          // Nothing played in a room yet (wave 1's empty state, E3): where games and results will show.
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
            <div className="pf-stats">
              {[
                { label: "Rooms played", value: stats.played },
                { label: "Wins", value: stats.wins },
                { label: "Podiums", value: stats.podiums },
              ].map((stat) => (
                <div key={stat.label} data-profile-stat={stat.label} className="pf-stat">
                  <span className="pf-stat-value">{stat.value}</span>
                  <span className="pf-stat-label" data-one-line>
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
            <ul className="jz-panel">
              {history.slice(0, 5).map((r) => (
                <li key={r.key} data-recent-room={r.code} data-icon="place" className="jz-row">
                  {r.place === null ? (
                    <span role="img" aria-label="Left before the end" data-place-disc="n" className="ap-place">
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

        {/* Wave 2 C2: the badges earned in one row; every badge on the Badges page (/badges). */}
        <ProfileBadges />
        {/* Friends (wave 2 B1): a strip of friends' cards; See all opens Friends. */}
        <ProfileFriends />

        {/* The daily challenge (badgesApi.ts useDailyRecord): the streak of UK days played and best totals, worked
            out on the server from the Dailies it stores (the same on every device); this device's record until it answers. */}
        {dailyShown && dailyShown.days.length > 0 ? (
          <section aria-label="Daily" data-profile-daily className="pf-section">
            <SectionHeader title="Daily" />
            <div className="pf-stats">
              {[
                { label: "Day streak", value: dailyShown.streak },
                { label: "Best puzzle", value: dailyShown.best.puzzle ?? null },
                { label: "Best arcade", value: dailyShown.best.arcade ?? null },
              ].map((stat) => (
                <span key={stat.label} data-profile-daily-stat={stat.label} className="pf-stat">
                  <span className="pf-stat-value">{stat.value === null ? "–" : stat.value.toLocaleString("en-GB")}</span>
                  <span className="pf-stat-label" data-one-line>
                    {stat.label}
                  </span>
                </span>
              ))}
            </div>
          </section>
        ) : null}

        {/* Wave 4 W4d: the season peak and history with the season emblems (accounts, real data only). */}
        <SeasonSection />
        <TrophyCabinet trophies={trophies} />

        {/* Wave 4 W4a (docs/leaderboards.md): the boards, and an account's category boards ("Top Logic players"). */}
        <ProfileBoards
          onOpen={(to) => void router.navigate({ to, state: { fromPlayTab: true } as never } as never)}
        />

        <YourChallenges
          onOpen={(code) =>
            void router.navigate({ to: "/challenge", search: { code }, state: { fromPlayTab: true } as never } as never)
          }
          onNew={() => void router.navigate({ to: "/challenge", search: {}, state: { fromPlayTab: true } as never } as never)}
        />

        {bests.length > 0 ? (
          <section aria-label="Practice bests" className="pf-section">
            <SectionHeader
              title="Practice bests"
              right={
                <button type="button" onClick={openGames} className="pf-see press">
                  All {bests.length}
                </button>
              }
            />
            <ul className="jz-panel">
              {bests.slice(0, 3).map(({ type, best }) => (
                <li key={type} data-icon="game" className="jz-row">
                  <GameIcon type={type} size={40} />
                  <span data-ellipsis className="jz-row-title min-w-0 flex-1">
                    {PUZZLE_REGISTRY[type].name}
                  </span>
                  <span className="pf-row-figure">{best}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Practice challenges (wave 2 C1b): the count done and the next few closest. */}
        <ProfileChallenges onOpen={openGames} />

        {/* The note, and the beta's Send feedback link on its right (nothing while TALLY_URL is empty). */}
        <div data-profile-footer className="flex min-h-11 items-center justify-between gap-3">
          <p className="ap-faint min-w-0 text-[13px] leading-snug">
            Saved on this phone. Sign-in after the beta will keep it all.
          </p>
          <FeedbackLink />
        </div>
      </div>
      {settings ? (
        <SettingsSheet
          onClose={() => setSettings(false)}
          onHowItWorks={() => {
            setSettings(false);
            setIntro(true);
          }}
          onTerms={() => {
            setSettings(false);
            void router.navigate({ to: "/terms" });
          }}
        />
      ) : null}
    </PhoneShell>
  );
}
