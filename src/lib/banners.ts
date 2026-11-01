import { HOUSE_BANNERS, type BannerPage, type HouseBanner } from "@/config/banners";
import { ukDayKey } from "@/lib/duel/daily";
import { publicGameWhen } from "@/components/app/PublicGameCard";
import { scheduledGames, upcomingGames } from "@/lib/publicSchedule";

/**
 * What the desktop banner slot shows on a page now (src/config/banners.ts): the next public game first
 * (from the schedule), then Joe's house banners in their order; the first one wins. Checks stand in their
 * own list through `window.__DUELZ_BANNERS__` (as betaConfig's `__DUELZ_BETA_CONFIG__`).
 */
export function bannerFor(page: BannerPage, now: number): HouseBanner | null {
  const next = upcomingGames(now, scheduledGames())[0];
  if (next) {
    return {
      id: `public-${next.roomCode}-${next.startsAt}`,
      title: next.title ?? "Next public game",
      line: `${publicGameWhen(next)} · ${next.rounds} rounds · room ${next.roomCode}`,
      action: "See the schedule",
      to: "/tournaments",
    };
  }
  const injected = typeof window !== "undefined" ? (window as unknown as { __DUELZ_BANNERS__?: HouseBanner[] }).__DUELZ_BANNERS__ : undefined;
  const list = Array.isArray(injected) ? injected : HOUSE_BANNERS;
  const today = ukDayKey(now);
  return (
    list.find(
      (b) =>
        (!b.pages || b.pages.includes(page)) &&
        (!b.from || today >= b.from) &&
        (!b.until || today <= b.until),
    ) ?? null
  );
}
