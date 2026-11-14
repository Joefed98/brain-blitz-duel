import type { MouseEvent } from "react";

import { NavArt } from "@/components/nav/NavArt";
import type { NavArtName } from "@/components/nav/navArt.data";

/**
 * The app's main destinations, from one list (DESIGN.md section 5; the navigation rebuild, phase 2 step 1, 14 Nov 2026,
 * docs/design/style-guide): the phone's and portrait tablet's bottom bar (AppTabBar) and the rail (AppRail: computers
 * and landscape tablets) both draw TabBar, so a destination is added, renamed or re-iconed in one place.
 * - `bar`: the 3D art-kit icon over its label, the current one in champagne gold with a bold label;
 * - `rail`: icon and label in a row (`compact`: the icon alone, its name as the tooltip and label).
 *
 * Home · Games · Tournaments · Shop · More. There is no Play tab (the gold Play bar on Home and Games) and no Profile
 * tab (the avatar top left, and More). The ids keep their old names so stored back-state and links carry on: `play`
 * is Home ("/"), `practice` is Games ("/practice"). The Shop is drawn only where its switch is on for this device
 * (src/config/shopConfig.ts, useShopOn); Tournaments is always drawn (a coming-soon page for players without them).
 */
export type AppTab = "play" | "practice" | "tournaments" | "shop" | "more" | "profile";

export type TabPath = "/" | "/practice" | "/tournaments" | "/shop" | "/more" | "/profile";

export const TAB_PATHS: Record<AppTab, TabPath> = {
  play: "/",
  practice: "/practice",
  tournaments: "/tournaments",
  shop: "/shop",
  more: "/more",
  profile: "/profile",
};

/** The main destinations in order (Profile is reached from the avatar and More, so it is not one). */
export const TABS: readonly { tab: AppTab; label: string; art: NavArtName }[] = [
  { tab: "play", label: "Home", art: "home" },
  { tab: "practice", label: "Games", art: "games" },
  { tab: "tournaments", label: "Tournaments", art: "tournaments" },
  { tab: "shop", label: "Shop", art: "shop" },
  { tab: "more", label: "More", art: "more" },
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
  /** Wave 2 D1: the Shop tab's one badge, a dot while a wishlisted item is back and the shop not opened today. */
  shopDot?: boolean;
  onOpen: (tab: AppTab) => (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <>
      {tabsFor(shop).map(({ tab, label, art }) => {
        const here = tab === current;
        const dot = shopDot && tab === "shop" ? <span className="jz-tab-dot" data-shop-dot aria-hidden="true" /> : null;
        const named = dot ? `${label}, an item you wanted is back` : undefined;
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
