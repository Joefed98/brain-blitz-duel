import { useRouter } from "@tanstack/react-router";
import { useEffect, type MouseEvent } from "react";

import { TabBar, TAB_PATHS, tabShown, type AppTab } from "@/design/components/TabBar";

import { useShopOn } from "@/lib/identity/shopSwitch";
import { markLevelSeen, usePass } from "@/lib/pass/passApi";
import { shopDotFor, useShopStatus } from "@/lib/shop/shopStatus";
import { unlockAudio } from "@/lib/sound";
import { scrollToNav, setPendingNavScroll } from "@/components/nav/navigation";

/**
 * The bottom tab bar (18 Oct 2026; rebuilt in the navigation step, phase 2 step 1, 14 Nov 2026; P1, 21 Nov 2026): Home,
 * Games, Compete, Shop (where its switch is on) and You, each a 3D art-kit icon over its label, the current one in
 * champagne gold. The Shop's news (an item wanted is back, a pass level reached) is the Shop tab's dot only: no toast
 * sits above the bar (plan section 3.6). Drawn by PhoneShell's `tabs` on phones and upright tablets (a computer or a sideways tablet has the
 * rail instead); never on a room, a round or a game. It sits above the home bar and Android's gesture bar (the
 * safe-area inset under it, polish-layout/nav.css).
 *
 * Back: Home is the root. A tab opened from Home is pushed (marked fromPlayTab), tabs opened from another tab replace
 * it, and Home from a tab that came from Home goes back, so Back always returns to Home once and then leaves, never
 * cycling through every tab (navigation.ts's useHomeBeneath covers a tab opened directly).
 */
export { TAB_PATHS, tabShown, type AppTab };

type TabRouter = ReturnType<typeof useRouter>;

/** Goes to a main screen (optionally with practice's ?game=, or a `navScroll` target) with the back behaviour above. */
export function goToTab(
  router: TabRouter,
  from: AppTab,
  to: AppTab,
  search?: { game?: string },
  navScroll?: string,
): void {
  const state = (router.history?.location?.state ?? {}) as { fromPlayTab?: boolean };
  from = tabShown(from) ?? from;
  to = tabShown(to) ?? to;
  if (to === "play") {
    if (navScroll) {
      // The Play bar: Home's play section (scrolled to once Home has drawn it).
      if (from === "play") {
        scrollToNav(navScroll);
        return;
      }
      setPendingNavScroll(navScroll);
    }
    if (state.fromPlayTab) router.history.back();
    else void router.navigate({ to: "/", replace: true });
    return;
  }
  void router.navigate({
    to: TAB_PATHS[to],
    ...(search ? { search: search as never } : {}),
    replace: from !== "play",
    state: { fromPlayTab: from === "play" || !!state.fromPlayTab, ...(navScroll ? { navScroll } : {}) } as never,
  });
}

/**
 * The Shop tab's one dot (plan section 3.6, P1, 21 Nov 2026): an item the player wanted is back today (wave 2 D1), or a
 * pass level was reached and not yet seen (wave 2 D2; it was a toast above the tab bar). Opening the Shop clears both:
 * the shop-back dot by the Shop's own "opened today" record, the pass level here (markLevelSeen). Reads the pass only
 * where it is already known (no request of its own).
 */
export function useShopTabDot(current: AppTab | undefined, shop: boolean): boolean {
  const status = useShopStatus();
  const pass = usePass(false);
  const level = shop && pass.state === "open" ? pass.view.levelNotice : null;
  const here = tabShown(current) === "shop";
  useEffect(() => {
    if (here && level !== null) void markLevelSeen(level);
  }, [here, level]);
  return shop && !here && (shopDotFor(status) || level !== null);
}

export function AppTabBar({ current: own }: { current: AppTab }) {
  const router = useRouter();
  const shop = useShopOn();
  const current = tabShown(own) ?? own;
  const dot = useShopTabDot(current, shop);
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
    <nav aria-label="Main" data-app-tabbar className="app-tabbar jz-nav jz-nav-bar">
      <div className="app-tabbar-row">
        <TabBar variant="bar" current={current} shop={shop} shopDot={dot} onOpen={open} />
      </div>
    </nav>
  );
}
