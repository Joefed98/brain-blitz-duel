import { Target, Trophy, UserRound, Zap, type LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";

/**
 * The app's four tabs, from one list (DESIGN.md section 5): the phone's bottom bar (AppTabBar) and the
 * desktop rail (AppRail) both draw TabBar, so a tab is added, renamed or re-iconed in one place.
 * - `bar`: icon over label, the current tab gold;
 * - `rail`: icon and label in a row (`compact`: the icon alone, its name as the tooltip and label).
 * Navigation (the back behaviour) is the caller's `onOpen`.
 */
export type AppTab = "play" | "practice" | "tournaments" | "profile";

export const TAB_PATHS: Record<AppTab, "/" | "/practice" | "/tournaments" | "/profile"> = {
  play: "/",
  practice: "/practice",
  tournaments: "/tournaments",
  profile: "/profile",
};

export const TABS: readonly { tab: AppTab; label: string; Icon: LucideIcon }[] = [
  { tab: "play", label: "Play", Icon: Zap },
  { tab: "practice", label: "Practice", Icon: Target },
  { tab: "tournaments", label: "Tournaments", Icon: Trophy },
  { tab: "profile", label: "Profile", Icon: UserRound },
];

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
      {TABS.map(({ tab, label, Icon }) => {
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
              <Icon aria-hidden="true" strokeWidth={1.9} />
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
            <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={1.9} />
            {compact ? null : <span>{label}</span>}
          </a>
        );
      })}
    </>
  );
}
