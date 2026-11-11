import type { MouseEvent } from "react";

import { Icon } from "./Icon";

/**
 * The app's tabs, from one list (DESIGN.md section 5): the phone's bottom bar (AppTabBar) and the
 * desktop rail (AppRail) both draw TabBar, so a tab is added, renamed or re-iconed in one place.
 * - `bar`: icon over label, the current tab gold;
 * - `rail`: icon and label in a row (`compact`: the icon alone, its name as the tooltip and label).
 * Navigation (the back behaviour) is the caller's `onOpen`.
 * Icons (docs/icons/README.md): the tab's outline icon in --jz-text-3, its filled `-on` icon in --jz-gold when current
 * (the Shop has one drawing: its outline, gold when current).
 *
 * Shop (wave 2): Play · Practice · Tournaments · Shop · Profile, but only where the Shop switch is on for this device
 * (src/config/shopConfig.ts, useShopOn); everywhere else the four tabs exactly as before. The caller passes `shop`.
 */
export type AppTab = "play" | "practice" | "tournaments" | "shop" | "profile";

export const TAB_PATHS: Record<AppTab, "/" | "/practice" | "/tournaments" | "/shop" | "/profile"> = {
  play: "/",
  practice: "/practice",
  tournaments: "/tournaments",
  shop: "/shop",
  profile: "/profile",
};

/** Every tab in order; the Shop is drawn only with the switch on (`tabsFor`). */
export const TABS: readonly { tab: AppTab; label: string }[] = [
  { tab: "play", label: "Play" },
  { tab: "practice", label: "Practice" },
  { tab: "tournaments", label: "Tournaments" },
  { tab: "shop", label: "Shop" },
  { tab: "profile", label: "Profile" },
];

/** The tabs a device sees: five with the Shop switch on, today's four with it off. */
export function tabsFor(shop: boolean): readonly { tab: AppTab; label: string }[] {
  return shop ? TABS : TABS.filter((t) => t.tab !== "shop");
}

function TabIcon({ tab, here }: { tab: AppTab; here: boolean }) {
  const name = tab === "shop" ? "shop" : here ? (`${tab}-on` as const) : tab;
  return <Icon name={name} size={24} tone={here ? "gold" : "text-3"} />;
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
      {tabsFor(shop).map(({ tab, label }) => {
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
              className="jz-tab min-w-0"
            >
              <TabIcon tab={tab} here={here} />
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
            className="dk-rail-tab"
          >
            <TabIcon tab={tab} here={here} />
            {compact ? null : <span>{label}</span>}
            {dot}
          </a>
        );
      })}
    </>
  );
}
