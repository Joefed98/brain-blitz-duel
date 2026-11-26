import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { HomeScreenHint } from "@/components/beta/HomeScreenHint";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { TermsScreen } from "@/components/beta/TermsScreen";
import { goToTab } from "@/components/app/AppTabBar";
import { shownDailyStatus, useDailyStatus } from "@/components/daily/DailyCard";
import { PlaySlot } from "@/components/app/PlaySlot";
import { ShareWelcomeCard } from "@/components/share/ShareWelcomeCard";
import { WeekPanel } from "@/components/app/PageAside";
import { HeaderLead } from "@/components/app/AppHeader";
import { useClock } from "@/components/app/useClock";
import { useNavPlacement } from "@/components/nav/navigation";
import { DailyHero, FriendsRow, PlayFriends, RecentlyPlayed, WeeklyCard, openFromHome } from "@/components/home/HomeSections";
import { PlayerBanner, RatingChips, useHero } from "@/components/home/PlayerBanner";
import { Icon } from "@/design/components";
import { OnlineOnly } from "@/components/offline/OnlineOnly";
import { markOnboardingSeen, onboardingSeen } from "@/lib/onboarding";
import { isShareRef } from "@/lib/share/shareRef";
import { isPlayable } from "@/lib/duel/catalogue";
import { recentPracticeTypes, warmUpTypes } from "@/lib/duel/practiceRecent";
import { useLayoutMode } from "@/lib/layoutMode";
import { useDailyRecord } from "@/lib/badges/badgesApi";
import { dailyStreak, readDailyRecord } from "@/lib/duel/dailyRecord";
import { ukDayKey } from "@/lib/duel/daily";
import { scheduledGames, upcomingGames, type PublicGame } from "@/lib/publicSchedule";
import { screenMusic, unlockAudio } from "@/lib/sound";
import type { PuzzleType } from "@/lib/duel/types";
import { APP_DESCRIPTION, APP_TITLE } from "@/lib/brand";
import { useHomeBed } from "@/lib/useScreenMusic";
import { useAccount, useAccountName } from "@/lib/account/accountApi";
import { getStoredName } from "@/lib/duel/session";
import { useRoomStart } from "@/lib/home/useRoomStart";
import { celebrationSound, celebrationsOn } from "@/lib/fx/celebrations";
import { useShopOn } from "@/lib/identity/shopSwitch";
import { friendsByRecent, useFriendsOverview } from "@/lib/home/homeData";
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

/** How many games Jump back in shows: 4 on phones and tablets, a row of 6 on a computer (P4, Joe 22 Nov 2026). */
const RECENT_MAX = 4;
const RECENT_MAX_DESKTOP = 6;

/**
 * Home (phase 2 step 3, 14 Nov 2026; P1, 21 Nov 2026: Joe's mix of H1 and H2, plan sections 2.1 and 3.3, mockups
 * docs/polish-plan-final/direction/pages/home-mixed-*), in this order with nothing shown twice:
 *
 * 1. the top line (AppHeader): the avatar, the name and the Daily streak; an account's coins on the right where the
 *    Shop is on; no rating;
 * 2. the player banner (PlayerBanner.tsx), the page's one hero and its one gold button, in three states of one height;
 * 3. placed players only: the Puzzles and Arcade ratings as two small chips (each opens Compete);
 * 4. Daily Puzzle and Daily Arcade side by side;
 * 5. Play friends: Create and Join, one tap each;
 * 6. Jump back in: this device's last four games.
 *
 * The share welcome and the Add to Home Screen hint keep their PlaySlots (playCards.ts); every section is reserved
 * before the first paint (the banner from its record, the chips' slot by the boot script, the dailies' slot as before,
 * Jump back in from device storage before paint), so nothing pops in. On a computer the side column has This week and
 * Friends. "How it works" lives in Settings.
 */
function Home() {
  const router = useRouter();
  const account = useAccount();
  const shopOn = useShopOn();
  const placement = useNavPlacement();
  const accountName = useAccountName();
  const [streak, setStreak] = useState(0);
  const dailyView = useDailyRecord();
  const [homeHint, setHomeHint] = useState<"show" | "hide">("show");
  const [recent, setRecent] = useState<PuzzleType[]>([]);
  const [games, setGames] = useState<PublicGame[]>([]);
  const [welcome, setWelcome] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);
  const [guestName, setGuestName] = useState("");
  const { hero, status } = useHero();
  const room = useRoomStart();
  const layoutMode = useLayoutMode();

  useBeforePaint(() => {
    const played = recentPracticeTypes();
    setRecent(played.filter((t): t is PuzzleType => isPlayable(t)).slice(0, RECENT_MAX_DESKTOP));
    setStreak(dailyStreak(readDailyRecord().days, ukDayKey(Date.now())));
    setGames(scheduledGames());
    setGuestName(getStoredName());
    setMounted(true);
  }, []);
  useEffect(() => {
    // The first-time intro (lib/onboarding.ts): a device that has been Home has seen the app (a shared link's welcome
    // stands in for it), so the first-open rules treat it as not new.
    if (isShareRef(window.location.search)) markOnboardingSeen();
    else if (!onboardingSeen()) markOnboardingSeen();
  }, []);
  // The app-wide home bed (docs/sound-cues/music.md): held here, carried on unbroken to the other tabs and the lobby.
  useHomeBed(true, screenMusic("music_home"));

  const daily = useDailyStatus();
  const dailyShown = useMemo(() => (mounted ? shownDailyStatus(daily) : shownDailyStatus({ status: daily.status }, Date.now(), false)), [daily, mounted]);
  const accountId = account.kind === "account" ? account.userId : null;
  const overview = useFriendsOverview(accountId);
  const friends = useMemo(() => friendsByRecent(overview?.friends ?? []), [overview]);
  const playerNumber = account.kind === "account" ? account.playerNumber : null;
  const passAsk = shopOn || cachedPass(playerNumber);
  const now = useClock(games.flatMap((g) => [g.lobbyAt, g.startsAt]));
  const nextGame = upcomingGames(now, games)[0] ?? null;
  const streakNow = dailyView?.source === "server" ? dailyView.streak : streak;
  const warmUp = recent[0] ?? warmUpTypes([])[0] ?? null;
  const name = accountName ?? guestName;

  if (room.termsFor) return <TermsScreen onAgree={room.agree} />;

  const practiceFirst = () => {
    unlockAudio();
    goToTab(router, "play", "practice", warmUp ? { game: warmUp } : undefined);
  };
  const createRoom = () => {
    if (celebrationsOn()) {
      unlockAudio();
      celebrationSound("zap");
    }
    // No name yet: the Rooms page, where the name is asked for beside Create a room.
    if (!name.trim()) return openFromHome(router, "/rooms");
    void room.start("create", name, "", () => openFromHome(router, "/rooms"));
  };

  const streakChip =
    streakNow > 0 ? (
      <button type="button" className="hp-streak press" onClick={() => openFromHome(router, "/daily")} aria-label={`Daily streak: ${streakNow} ${streakNow === 1 ? "day" : "days"}`} data-hp-streak={streakNow}>
        <Icon name="streak" size={20} tone="gold" />
        <span>{streakNow}</span>
      </button>
    ) : null;
  const lead = (
    <>
      {name ? (
        <span data-ellipsis className="hp-name" data-hp-name>
          {name}
        </span>
      ) : null}
      {streakChip}
    </>
  );

  return (
    <HeaderLead.Provider value={placement === "bar" ? lead : null}>
    <PhoneShell
      tabs="play"
      aside={
        <aside aria-label="More" data-page-aside className="dk-aside hp-aside">
          <FriendsRow friends={friends} />
          <WeeklyCard eligible={passAsk} />
          {/* Your week in practice, the column's existing panel, under them (and alone for a guest). */}
          <WeekPanel />
        </aside>
      }
    >
      <div className="ap-stack hp-home" data-home>
        <PlayerBanner hero={hero} status={status} />

        <PlaySlot id="chips" state={hero === null ? "pending" : hero.state === "placed" ? "show" : "hide"}>
          <RatingChips hero={hero} />
        </PlaySlot>

        <PlaySlot id="welcome" state={slotState(welcome !== null, welcome === true)}>
          <ShareWelcomeCard assumeDue onDue={setWelcome} nextGame={nextGame} now={now} onPractice={practiceFirst} onPublic={() => goToTab(router, "play", "tournaments")} />
        </PlaySlot>

        {/* Today's dailies, side by side. */}
        <PlaySlot id="daily" state={slotState(daily.settled, !!daily.status?.available)}>
          <DailyHero
            status={dailyShown}
            onOpen={(kind) => {
              unlockAudio();
              void router.navigate({ to: "/daily", search: { kind }, state: { fromPlayTab: true } as never });
            }}
          />
        </PlaySlot>

        <PlayFriends onCreate={createRoom} onJoin={() => openFromHome(router, "/rooms")} busy={room.busy === "create"} error={room.error} />

        <RecentlyPlayed types={recent.slice(0, layoutMode === "desktop" ? RECENT_MAX_DESKTOP : RECENT_MAX)} />

        <PlaySlot id="homescreen" state={homeHint}>
          <HomeScreenHint onDismiss={() => setHomeHint("hide")} />
        </PlaySlot>
      </div>
    </PhoneShell>
    </HeaderLead.Provider>
  );
}
