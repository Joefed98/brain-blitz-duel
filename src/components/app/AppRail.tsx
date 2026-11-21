import { useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";

import { SaveProgressOffer } from "@/components/account/SaveProgress";
import { LogoMark } from "@/components/brand/LogoMark";
import { AvatarButton } from "@/components/nav/AvatarButton";
import { NavArt } from "@/components/nav/NavArt";
import type { NavArtName } from "@/components/nav/navArt.data";
import { CoinCounter } from "@/components/app/CoinCounter";
import { goToTab, tabShown, TAB_PATHS, useShopTabDot, type AppTab } from "@/components/app/AppTabBar";
import { useHeroPlay } from "@/components/home/PlayerBanner";
import { useAccount } from "@/lib/account/accountApi";
import { useDailyRecord } from "@/lib/badges/badgesApi";
import { ukDayKey } from "@/lib/duel/daily";
import { dailyStreak, readDailyRecord } from "@/lib/duel/dailyRecord";
import { useWaitingRequests } from "@/lib/friends/friendsApi";
import { useShopOn } from "@/lib/identity/shopSwitch";
import { unlockAudio } from "@/lib/sound";
import { Icon, Input, TabBar, type IconName } from "@/design/components";

/**
 * The left navigation rail (31 Oct 2026, presentation only; docs/desktop-layout.md; rebuilt in the navigation step,
 * 14 Nov 2026; P1, 21 Nov 2026: plan section 7 and earlier row B5, with Joe's rows of 20 Nov; mockup
 * docs/polish-plan-final/direction/pages/home-mixed-desktop). Drawn by PhoneShell where the rail is the navigation
 * (navigation.ts useNavPlacement: a computer, or a tablet turned sideways on its main screens), never on a phone or an
 * upright tablet.
 *
 * - `full` (240 px, the main screens): the nameplate (the avatar and name, opening You, with the Daily streak and an
 *   account's coins under it), the gold Play (it starts what Home's player banner starts: Find a match where rated
 *   play is open, else the game of the day), then Home, Games, Compete, Shop (with its switch) and You with their 3D
 *   icons and labels; under a "More" label Daily, Leaderboards, Friends, Challenges, Badges and Notifications (with
 *   its count); at the foot the search (it opens Games with the words typed), the Joulz mark (Home) and Settings.
 *   It replaces the bottom tab bar.
 * - `compact` (76 px, rooms and games on a computer): the logo mark, the avatar, Play and the five tabs' icons with
 *   their names as tooltips. Every item is a link or button in order, so it works by keyboard, with a visible focus
 *   ring (the gold Play button's is a cut frame, polish-layout/nav.css).
 *
 * The main tabs carry `data-rail-tab`; the More rows `data-rail-more`, so the five destinations stay one list
 * (TabBar's TABS) on the bar and the rail.
 */
export function AppRail({
  current: own,
  compact = false,
}: {
  current?: AppTab | undefined;
  compact?: boolean;
}) {
  const router = useRouter();
  const shop = useShopOn();
  const current = tabShown(own);
  const shopDot = useShopTabDot(current, shop);
  const play = useHeroPlay();

  const open = (tab: AppTab) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    unlockAudio();
    if (tab === current) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (current) goToTab(router, current, tab);
    else void router.navigate({ to: TAB_PATHS[tab] });
  };

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    void router.navigate({ to: "/practice", search: (q ? { q } : {}) as never });
  };

  return (
    <nav aria-label="Main" data-app-rail={compact ? "compact" : "full"} className="dk-rail jz-nav jz-nav-rail">
      {compact ? (
        <a href="/" onClick={open("play")} aria-label="Joulz home" data-rail-logo className="dk-rail-logo press">
          <LogoMark width={26} height={34} />
        </a>
      ) : null}
      <div className="jz-rail-plate" data-rail-plate>
        <AvatarButton size={compact ? 32 : 36} showName={!compact} data={{ "data-rail-account": "" }} className="dk-rail-account" />
        {compact ? null : <PlateMeta />}
      </div>
      <button
        type="button"
        onClick={() => {
          unlockAudio();
          play();
        }}
        aria-label={compact ? "Play" : undefined}
        title={compact ? "Play" : undefined}
        data-nav-play="rail"
        data-compact={compact ? "" : undefined}
        className="jz-nav-play jz-nav-play-rail"
      >
        <span className="jz-nav-play-face">{compact ? <PlayGlyph /> : "Play"}</span>
      </button>
      <div className="dk-rail-tabs">
        <TabBar variant="rail" current={current} compact={compact} shop={shop} shopDot={shopDot} onOpen={open} />
      </div>
      {compact ? null : <RailMore />}
      <div className="dk-rail-foot">
        {compact ? null : (
          <form role="search" onSubmit={search} className="dk-rail-search">
            <Icon name="search" size={18} className="dk-rail-search-icon" />
            <Input
              name="q"
              type="search"
              placeholder="Search games"
              aria-label="Search games"
              autoComplete="off"
              spellCheck={false}
            />
          </form>
        )}
        <div className="dk-rail-tools">
          <button
            type="button"
            data-rail-settings
            aria-label="Settings"
            title={compact ? "Settings" : undefined}
            onClick={() => {
              unlockAudio();
              void router.navigate({ to: "/settings" });
            }}
            className={compact ? "dk-rail-icon press" : "jz-rail-settings press"}
          >
            <Icon name="settings" size={20} />
            {compact ? null : <span>Settings</span>}
          </button>
          {compact ? null : (
            <a href="/" onClick={open("play")} aria-label="Joulz home" data-rail-logo className="jz-rail-mark press">
              <LogoMark width={17} height={22} />
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}

/** The nameplate's second line: the Daily streak (when there is one) and an account's coins. */
function PlateMeta() {
  const view = useDailyRecord();
  const [streak, setStreak] = useState(0);
  useEffect(() => setStreak(dailyStreak(readDailyRecord().days, ukDayKey(Date.now()))), []);
  const days = view?.source === "server" ? view.streak : streak;
  return (
    <div className="jz-rail-meta">
      {days > 0 ? (
        <span className="jz-rail-streak" aria-label={`Daily streak: ${days} ${days === 1 ? "day" : "days"}`} data-rail-streak={days}>
          <Icon name="streak" size={18} tone="gold" />
          {days}
        </span>
      ) : null}
      <CoinCounter place="rail" />
    </div>
  );
}

type MoreRow = { key: string; label: string; to: string; search?: Record<string, string>; art?: NavArtName; icon?: IconName };

/** Joe's rows of 20 Nov 2026, under "More". */
const MORE: readonly MoreRow[] = [
  { key: "daily", label: "Daily", to: "/daily", search: { kind: "puzzle" }, art: "daily" },
  { key: "leaderboards", label: "Leaderboards", to: "/leaderboards", art: "leaderboards" },
  { key: "friends", label: "Friends", to: "/friends", art: "friends" },
  { key: "challenges", label: "Challenges", to: "/challenges", art: "challenges" },
  { key: "badges", label: "Badges", to: "/badges", icon: "rewards" },
  { key: "notifications", label: "Notifications", to: "/settings", search: { section: "notifications" }, icon: "notifications" },
];

/**
 * The second level. Notifications has no inbox yet: it opens Settings' notifications, and its count is what is
 * waiting for the player today (friend requests). A guest's Friends offers the save-your-progress sheet, as Profile's
 * Friends button does.
 */
function RailMore() {
  const router = useRouter();
  const account = useAccount();
  const signedIn = account.kind === "account";
  const waiting = useWaitingRequests(signedIn);
  const [offer, setOffer] = useState(false);
  const [path, setPath] = useState("");
  useEffect(() => setPath(window.location.pathname), []);
  const row = (r: MoreRow): ReactNode => {
    const count = r.key === "notifications" && signedIn && waiting > 0 ? waiting : 0;
    const href = r.search ? `${r.to}?${new URLSearchParams(r.search).toString()}` : r.to;
    return (
      <li key={r.key}>
        <a
          href={href}
          data-rail-more={r.key}
          aria-current={path === r.to && r.key !== "notifications" ? "page" : undefined}
          aria-label={count ? `${r.label}, ${count} new` : undefined}
          className="jz-rail-more-row press"
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            unlockAudio();
            if (r.key === "friends" && !signedIn) return setOffer(true);
            void router.navigate({ to: r.to as never, ...(r.search ? { search: r.search as never } : {}), state: { fromPlayTab: true } as never });
          }}
        >
          {r.art ? <NavArt name={r.art} size={24} /> : <Icon name={r.icon ?? "more"} size={22} className="jz-rail-more-icon" />}
          <span data-ellipsis>{r.label}</span>
          {count ? (
            <span className="jz-rail-count" aria-hidden="true" data-rail-count>
              {count}
            </span>
          ) : null}
        </a>
      </li>
    );
  };
  return (
    <div className="jz-rail-more" data-rail-more-group>
      <p className="jz-rail-more-label">More</p>
      <ul>{MORE.map(row)}</ul>
      {offer ? <SaveProgressOffer onClose={() => setOffer(false)} /> : null}
    </div>
  );
}

/** The compact rail's Play: a solid triangle (a small control glyph, not art). */
function PlayGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M5 3.2v11.6L14.6 9z" fill="currentColor" />
    </svg>
  );
}
