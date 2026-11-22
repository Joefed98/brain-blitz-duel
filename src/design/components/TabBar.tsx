import type { MouseEvent } from "react";

import { NavArt } from "@/components/nav/NavArt";
import type { NavArtName } from "@/components/nav/navArt.data";

/**
 * The app's main destinations, from one list (DESIGN.md section 5; the navigation rebuild, phase 2 step 1, 14 Nov 2026,
 * docs/design/style-guide; the polish plan's section 3.2, P1, 21 Nov 2026): the phone's and portrait tablet's bottom bar
 * (AppTabBar) and the rail (AppRail: computers and landscape tablets) both draw TabBar, so a destination is added,
 * renamed or re-iconed in one place.
 * - `bar`: the 3D art-kit icon over its label, the current one in champagne gold with a bold label;
 * - `rail`: icon and label in a row (`compact`: the icon alone, its name as the tooltip and label).
 *
 * Home · Games · Compete · Shop · You (Joe, 20 Nov 2026, plan decision 3: N1). There is no Play tab and no floating Play
 * bar: Home's player banner is the play action, Games' tiles are. The ids keep their old names so stored back-state
 * and links carry on: `play` is Home ("/"), `practice` is Games ("/practice"), `tournaments` is Compete
 * ("/tournaments"); `you` is the player's own page, Profile ("/profile"), which More folded into. `profile` (the
 * Profile route's own tab id) and `more` (kept for links and back-state written before 21 Nov 2026) both mean You.
 * The Shop is drawn only where its switch is on for this device (src/config/shopConfig.ts, useShopOn).
 */
export type AppTab = "play" | "practice" | "tournaments" | "shop" | "you" | "more" | "profile";

export type TabPath = "/" | "/practice" | "/tournaments" | "/shop" | "/profile";

export const TAB_PATHS: Record<AppTab, TabPath> = {
  play: "/",
  practice: "/practice",
  tournaments: "/tournaments",
  shop: "/shop",
  you: "/profile",
  more: "/profile",
  profile: "/profile",
};

/** The tab a screen's own id is drawn as: Profile (and the old More) are You. */
export function tabShown(tab: AppTab | undefined): AppTab | undefined {
  return tab === "profile" || tab === "more" ? "you" : tab;
}

/** The main destinations in order. */
export const TABS: readonly { tab: AppTab; label: string; art: NavArtName }[] = [
  { tab: "play", label: "Home", art: "home" },
  { tab: "practice", label: "Games", art: "games" },
  { tab: "tournaments", label: "Compete", art: "tournaments" },
  { tab: "shop", label: "Shop", art: "shop" },
  { tab: "you", label: "You", art: "profile" },
];

/** The destinations a device sees: five with the Shop switch on, four with it off. */
export function tabsFor(shop: boolean): readonly { tab: AppTab; label: string; art: NavArtName }[] {
  return shop ? TABS : TABS.filter((t) => t.tab !== "shop");
}

export function TabBar({
  current,
  variant,
  compact = false,
  shop = false,
  shopDot = false,
  onOpen,
}: {
  current: AppTab | undefined;
  variant: "bar" | "rail";
  compact?: boolean;
  /** The Shop switch for this device (useShopOn): five tabs, else four. */
  shop?: boolean;
  /** The Shop tab's one badge (useShopTabDot): a wishlisted item back today, or a pass level reached and not yet seen. */
  shopDot?: boolean;
  onOpen: (tab: AppTab) => (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  const shown = tabShown(current);
  return (
    <>
      {tabsFor(shop).map(({ tab, label, art }) => {
        const here = tab === shown;
        const dot = shopDot && tab === "shop" ? <span className="jz-tab-dot" data-shop-dot aria-hidden="true" /> : null;
        const named = dot ? `${label}, something new` : undefined;
        if (variant === "bar")
          return (
            <a
              key={tab}
              href={TAB_PATHS[tab]}
              onClick={onOpen(tab)}
              aria-current={here ? "page" : undefined}
              aria-label={named}
              data-tab={tab}
              data-jz="tab"
              className="jz-tab jz-nav-tab min-w-0"
            >
              <NavArt name={art} size={28} />
              <span>{label}</span>
              {dot}
            </a>
          );
        return (
          <a
            key={tab}
            href={TAB_PATHS[tab]}
            onClick={onOpen(tab)}
            aria-current={here ? "page" : undefined}
            aria-label={named ?? (compact ? label : undefined)}
            title={compact ? label : undefined}
            data-rail-tab={tab}
            data-jz="tab"
            className="dk-rail-tab jz-nav-rail-tab"
          >
            <NavArt name={art} size={28} />
            {compact ? null : <span>{label}</span>}
            {dot}
          </a>
        );
      })}
    </>
  );
}
