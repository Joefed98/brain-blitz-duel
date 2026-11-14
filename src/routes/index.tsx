import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { HomeScreenHint } from "@/components/beta/HomeScreenHint";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { Onboarding } from "@/components/duel/Onboarding";
import { goToTab } from "@/components/app/AppTabBar";
import { shownDailyStatus, useDailyStatus } from "@/components/daily/DailyCard";
import { PlaySlot } from "@/components/app/PlaySlot";
import { IntroCard } from "@/components/app/IntroCard";
import { SettingsSheet } from "@/components/app/SettingsSheet";
import { ShareWelcomeCard } from "@/components/share/ShareWelcomeCard";
import { WeekPanel } from "@/components/app/PageAside";
import { useClock } from "@/components/app/useClock";
import { useNavPlacement } from "@/components/nav/navigation";
import { DailyHero, FriendsRow, NextMatch, RatingTiles, RecentlyPlayed, WeeklyCard, openFromHome } from "@/components/home/HomeSections";
import { Icon } from "@/design/components";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { pushForPlayer, pushPublicKey } from "@/config/pushConfig";
import { releaseSlot } from "@/lib/playCards";
import { markOnboardingSeen, onboardingSeen } from "@/lib/onboarding";
import { isShareRef } from "@/lib/share/shareRef";
import { isPlayable } from "@/lib/duel/catalogue";
import { recentPracticeTypes, warmUpTypes } from "@/lib/duel/practiceRecent";
import { useDailyRecord } from "@/lib/badges/badgesApi";
import { bestOf } from "@/lib/practice/progress";
import { usePracticeProgress } from "@/lib/practice/useProgress";
import { dailyStreak, readDailyRecord } from "@/lib/duel/dailyRecord";
import { ukDayKey } from "@/lib/duel/daily";
import { scheduledGames, upcomingGames, type PublicGame } from "@/lib/publicSchedule";
import { screenMusic, unlockAudio } from "@/lib/sound";
import type { PuzzleType } from "@/lib/duel/types";
import { APP_DESCRIPTION, APP_TITLE } from "@/lib/brand";
import { useHomeBed } from "@/lib/useScreenMusic";
import { useAccount } from "@/lib/account/accountApi";
import { useShopOn } from "@/lib/identity/shopSwitch";
import { useRatedStatus } from "@/lib/rated/ratedApi";
import { defaultPick } from "@/lib/rated/rules";
import type { RatedPick } from "@/lib/rated/backend";
import { friendsByRecent, useDailyPlayedToday, useFriendsOverview } from "@/lib/home/homeData";
import { cachedPass } from "@/lib/pass/passApi";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: APP_TITLE },
      {
        name: "description",
        content: APP_DESCRIPTION,
      },
      { property: "og:title", content: APP_TITLE },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: APP_DESCRIPTION,
      },
      { name: "twitter:description", content: APP_DESCRIPTION },
    ],
  }),
  component: OfflineHome,
});

/** Offline practice (31 Oct 2026): with no connection, the offline state and a way to Practice. */
function OfflineHome() {
  return (
    <OnlineOnly tabs="play" live body="Rooms and the daily need a connection. Practice games are saved on this phone, so they still work.">
      <Home />
    </OnlineOnly>
  );
}

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

const slotState = (settled: boolean, show: boolean) => (!settled ? "pending" : show ? "show" : "hide");

/** How many games Recently played shows. */
const RECENT_MAX = 8;
const PICK_KEY = "duelz-rated-pick:v1";

/** The rated pick this device last played (RatedHome's key), read only. */
function lastPick(): RatedPick | null {
  try {
    return (localStorage.getItem(PICK_KEY) as RatedPick | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * Home (phase 2 step 3, 14 Nov 2026; docs/design/style-guide/phone/home.png, home-scrolled.png, desktop/home.png):
 * the avatar, the Daily streak, coins and notifications in the header; the Daily hero; Your next match; Ratings (rated
 * play only); Recently played; This week (the pass); Friends. Rooms (create, join, rejoin, public games, Challenge a
 * friend) live on the Rooms page, reached from Play; the gold Play bar opens Play. The first-time intro card, the share
 * welcome and the Add to Home Screen hint keep their PlaySlots (playCards.ts), reserved before the first paint.
 */
function Home() {
  const router = useRouter();
  const account = useAccount();
  const shopOn = useShopOn();
  const placement = useNavPlacement();
  // The first-time intro's three panels (Onboarding), from "How it works".
  const [intro, setIntro] = useState(false);
  const [settings, setSettings] = useState(false);
  const [introCard, setIntroCard] = useState<"pending" | "show" | "hide">("pending");
  const progress = usePracticeProgress();
  const [streak, setStreak] = useState(0);
  const dailyView = useDailyRecord();
  const [homeHint, setHomeHint] = useState<"show" | "hide">("show");
  const [recent, setRecent] = useState<PuzzleType[]>([]);
  const [warm, setWarm] = useState<PuzzleType[]>([]);
  const [games, setGames] = useState<PublicGame[]>([]);
  const [welcome, setWelcome] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [pick, setPick] = useState<RatedPick | null>(null);

  useBeforePaint(() => {
    const played = recentPracticeTypes();
    setRecent(played.filter((t): t is PuzzleType => isPlayable(t)).slice(0, RECENT_MAX));
    setWarm(warmUpTypes(played));
    setStreak(dailyStreak(readDailyRecord().days, ukDayKey(Date.now())));
    setGames(scheduledGames());
    setMounted(true);
  }, []);
  useEffect(() => {
    // Shown once on a plain visit: seen as soon as it is up, so leaving without closing it still counts.
    const fresh = !isShareRef(window.location.search) && !onboardingSeen();
    if (isShareRef(window.location.search)) markOnboardingSeen();
    else if (fresh) markOnboardingSeen();
    setIntroCard(fresh ? "show" : "hide");
    return () => releaseSlot("intro");
  }, []);
  // The app-wide home bed (docs/sound-cues/music.md): held here, carried on unbroken to the other tabs and the lobby.
  useHomeBed(true, screenMusic("music_home"));

  const daily = useDailyStatus();
  const dailyShown = useMemo(() => (mounted ? shownDailyStatus(daily) : shownDailyStatus({ status: daily.status }, Date.now(), false)), [daily, mounted]);
  const counts = useDailyPlayedToday();
  const rated = useRatedStatus();
  useEffect(() => {
    if (rated) setPick(defaultPick(rated.options, lastPick()));
  }, [rated]);
  const accountId = account.kind === "account" ? account.userId : null;
  const overview = useFriendsOverview(accountId);
  const friends = useMemo(() => friendsByRecent(overview?.friends ?? []), [overview]);
  const playerNumber = account.kind === "account" ? account.playerNumber : null;
  const passAsk = shopOn || cachedPass(playerNumber);
  const now = useClock(games.flatMap((g) => [g.lobbyAt, g.startsAt]));
  const nextGame = upcomingGames(now, games)[0] ?? null;
  const streakNow = dailyView?.source === "server" ? dailyView.streak : streak;
  const bell = !!pushPublicKey() && account.kind === "account" && pushForPlayer(account.playerNumber);
  const warmUp = warm[0] ?? null;

  if (intro) return <Onboarding onDone={() => setIntro(false)} />;

  const practiceFirst = () => {
    unlockAudio();
    goToTab(router, "play", "practice", warmUp ? { game: warmUp } : undefined);
  };

  const streakChip =
    streakNow > 0 ? (
      <button type="button" className="hp-streak press" onClick={() => openFromHome(router, "/daily")} aria-label={`Daily streak: ${streakNow} ${streakNow === 1 ? "day" : "days"}`} data-hp-streak={streakNow}>
        <Icon name="streak" size={20} tone="gold" />
        <span>{streakNow}</span>
      </button>
    ) : null;
  const bellButton = bell ? (
    <button type="button" className="hp-bell press" aria-label="Notifications" onClick={() => setSettings(true)} data-hp-bell>
      <Icon name="notifications" size={22} />
    </button>
  ) : null;

  return (
    <PhoneShell
      tabs="play"
      headerLead={placement === "bar" ? streakChip : undefined}
      headerAction={placement === "bar" ? bellButton : undefined}
      aside={
        <aside aria-label="More" data-page-aside className="dk-aside hp-aside">
          <WeeklyCard eligible={passAsk} />
          <FriendsRow friends={friends} />
          {/* Your week in practice, the column's existing panel, under them (and alone for a guest). */}
          <WeekPanel />
        </aside>
      }
    >
      <div className="ap-stack hp-home" data-home>
        {placement === "rail" && (streakChip || bellButton) ? (
          <div className="hp-railhead">
            {streakChip}
            {bellButton}
          </div>
        ) : null}
        <PlaySlot id="intro" state={introCard}>
          <IntroCard
            onClose={() => setIntroCard("hide")}
            onPractice={practiceFirst}
            onHowItWorks={() => {
              unlockAudio();
              setIntro(true);
            }}
          />
        </PlaySlot>
        <PlaySlot id="welcome" state={slotState(welcome !== null, welcome === true)}>
          <ShareWelcomeCard assumeDue onDue={setWelcome} nextGame={nextGame} now={now} onPractice={practiceFirst} onPublic={() => goToTab(router, "play", "tournaments")} />
        </PlaySlot>

        {/* Today's dailies: the hero carousel. */}
        <PlaySlot id="daily" state={slotState(daily.settled, !!daily.status?.available)}>
          <DailyHero
            status={dailyShown}
            counts={counts}
            onOpen={(kind) => {
              unlockAudio();
              void router.navigate({ to: "/daily", search: { kind }, state: { fromPlayTab: true } as never });
            }}
          />
        </PlaySlot>

        <NextMatch rated={rated} pick={pick} friend={friends[0] ?? null} practice={warmUp} practiceBest={warmUp ? bestOf(progress, warmUp) : null} nowMs={now} />

        {rated ? <RatingTiles status={rated} /> : null}

        <RecentlyPlayed types={recent} />

        <PlaySlot id="homescreen" state={homeHint}>
          <HomeScreenHint onDismiss={() => setHomeHint("hide")} />
        </PlaySlot>

        {/* On a phone the pass's weekly challenges and friends follow here; wider screens draw them in the side column. */}
        <div className="hp-narrow">
          <WeeklyCard eligible={passAsk} />
          <FriendsRow friends={friends} />
        </div>

        <div className="flex justify-center pb-1">
          <button
            type="button"
            data-how-it-works
            onClick={() => {
              unlockAudio();
              setIntro(true);
            }}
            className="ap-link-quiet press tap-target px-3"
          >
            How it works
          </button>
        </div>
      </div>
      {settings ? (
        <SettingsSheet
          onClose={() => setSettings(false)}
          onHowItWorks={() => {
            setSettings(false);
            setIntro(true);
          }}
        />
      ) : null}
    </PhoneShell>
  );
}
