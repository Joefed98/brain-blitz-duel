import { useRouter } from "@tanstack/react-router";
import type { MouseEvent } from "react";

import { TabBar, TAB_PATHS, type AppTab } from "@/design/components/TabBar";

import { unlockAudio } from "@/lib/sound";

/**
 * The app shell's bottom tab bar (18 Oct 2026, presentation only): Play, Practice, Tournaments and
 * Profile. Drawn by PhoneShell's `tabs` on those four screens only (the practice list, never a
 * practice round); the lobby, rounds, results, podium and every game have no tab bar.
 *
 * Back: the Play tab is the root. A tab opened from Play is pushed (marked fromPlayTab), tabs
 * opened from another tab replace it, and Play from a tab that came from Play goes back, so the
 * back button always returns to Play once and then leaves, never cycling through every tab.
 */
export { TAB_PATHS, type AppTab };

type TabRouter = ReturnType<typeof useRouter>;

/** Goes to a tab screen (optionally with practice's ?game=) with the back behaviour above. */
export function goToTab(
  router: TabRouter,
  from: AppTab,
  to: AppTab,
  search?: { game?: string },
): void {
  const state = (router.history?.location?.state ?? {}) as { fromPlayTab?: boolean };
  if (to === "play") {
    if (state.fromPlayTab) router.history.back();
    else void router.navigate({ to: "/", replace: true });
    return;
  }
  void router.navigate({
    to: TAB_PATHS[to],
    ...(search ? { search: search as never } : {}),
    replace: from !== "play",
    state: { fromPlayTab: from === "play" || !!state.fromPlayTab } as never,
  });
}

export function AppTabBar({ current }: { current: AppTab }) {
  const router = useRouter();
  const open = (tab: AppTab) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    unlockAudio();
    if (tab === current) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    goToTab(router, current, tab);
  };
  return (
    <nav aria-label="Main" data-app-tabbar className="app-tabbar">
      <div className="app-tabbar-row">
        <TabBar variant="bar" current={current} onOpen={open} />
      </div>
    </nav>
  );
}
