import { useRouter } from "@tanstack/react-router";
import type { MouseEvent } from "react";

import { TabBar, TAB_PATHS, type AppTab } from "@/design/components/TabBar";

import { PassLevelNotice } from "@/components/pass/PassLevelNotice";
import { ShopBackNotice } from "@/components/shop/ShopBackNotice";
import { useShopOn } from "@/lib/identity/shopSwitch";
import { shopDotFor, useShopStatus } from "@/lib/shop/shopStatus";
import { unlockAudio } from "@/lib/sound";
import { scrollToNav, setPendingNavScroll } from "@/components/nav/navigation";

/**
 * The bottom tab bar (18 Oct 2026; rebuilt in the navigation step, phase 2 step 1, 14 Nov 2026): Home, Games,
 * Tournaments, Shop (where its switch is on) and More, each a 3D art-kit icon over its label, the current one in
 * champagne gold. Drawn by PhoneShell's `tabs` on phones and upright tablets (a computer or a sideways tablet has the
 * rail instead); never on a room, a round or a game. It sits above the home bar and Android's gesture bar (the
 * safe-area inset under it, polish-layout/nav.css).
 *
 * Back: Home is the root. A tab opened from Home is pushed (marked fromPlayTab), tabs opened from another tab replace
 * it, and Home from a tab that came from Home goes back, so Back always returns to Home once and then leaves, never
 * cycling through every tab (navigation.ts's useHomeBeneath covers a tab opened directly).
 */
export { TAB_PATHS, type AppTab };

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
    replace: from !== "play" && from !== "profile",
    state: { fromPlayTab: from === "play" || !!state.fromPlayTab, ...(navScroll ? { navScroll } : {}) } as never,
  });
}

export function AppTabBar({ current }: { current: AppTab }) {
  const router = useRouter();
  const shop = useShopOn();
  const status = useShopStatus();
  const dot = shop && current !== "shop" && shopDotFor(status);
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
        <TabBar variant="bar" current={current === "profile" ? undefined : current} shop={shop} shopDot={dot} onOpen={open} />
      </div>
      {shop && current !== "shop" ? <ShopBackNotice status={status} onOpen={() => goToTab(router, current, "shop")} /> : null}
      {/* The pass's level-up notice (wave 2 D2): tab pages only, where the Shop (and so the pass) is on. */}
      {shop ? <PassLevelNotice onOpen={() => void router.navigate({ to: "/shop", search: { part: "pass" } })} /> : null}
    </nav>
  );
}
