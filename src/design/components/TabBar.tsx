import type { MouseEvent } from "react";

import { Icon } from "./Icon";

/**
 * The app's four tabs, from one list (DESIGN.md section 5): the phone's bottom bar (AppTabBar) and the
 * desktop rail (AppRail) both draw TabBar, so a tab is added, renamed or re-iconed in one place.
 * - `bar`: icon over label, the current tab gold;
 * - `rail`: icon and label in a row (`compact`: the icon alone, its name as the tooltip and label).
 * Navigation (the back behaviour) is the caller's `onOpen`.
 * Icons (docs/icons/README.md): the tab's outline icon in --jz-text-3, its filled `-on` icon in --jz-gold when current.
 */
export type AppTab = "play" | "practice" | "tournaments" | "profile";

export const TAB_PATHS: Record<AppTab, "/" | "/practice" | "/tournaments" | "/profile"> = {
  play: "/",
  practice: "/practice",
  tournaments: "/tournaments",
  profile: "/profile",
};

export const TABS: readonly { tab: AppTab; label: string }[] = [
  { tab: "play", label: "Play" },
  { tab: "practice", label: "Practice" },
  { tab: "tournaments", label: "Tournaments" },
  { tab: "profile", label: "Profile" },
];

function TabIcon({ tab, here }: { tab: AppTab; here: boolean }) {
  return <Icon name={here ? `${tab}-on` : tab} size={24} tone={here ? "gold" : "text-3"} />;
}

export function TabBar({
  current,
  variant,
  compact = false,
  onOpen,
}: {
  current: AppTab | undefined;
  variant: "bar" | "rail";
  compact?: boolean;
  onOpen: (tab: AppTab) => (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <>
      {TABS.map(({ tab, label }) => {
        const here = tab === current;
        if (variant === "bar")
          return (
            <a
              key={tab}
              href={TAB_PATHS[tab]}
              onClick={onOpen(tab)}
              aria-current={here ? "page" : undefined}
              data-tab={tab}
              data-jz="tab"
              className="jz-tab min-w-0"
            >
              <TabIcon tab={tab} here={here} />
              <span>{label}</span>
            </a>
          );
        return (
          <a
            key={tab}
            href={TAB_PATHS[tab]}
            onClick={onOpen(tab)}
            aria-current={here ? "page" : undefined}
            aria-label={compact ? label : undefined}
            title={compact ? label : undefined}
            data-rail-tab={tab}
            data-jz="tab"
            className="dk-rail-tab"
          >
            <TabIcon tab={tab} here={here} />
            {compact ? null : <span>{label}</span>}
          </a>
        );
      })}
    </>
  );
}
