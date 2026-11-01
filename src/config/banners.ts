/**
 * The desktop banner slot (31 Oct 2026, the computer layout; docs/desktop-layout.md): a 112 px strip at
 * the top of Play, Practice and Tournaments on screens 1024 px wide and up. It shows house promotions
 * only: the next public game from the schedule (src/config/publicGames.ts, automatically) and any
 * entries Joe adds here. With nothing to show the slot is hidden (no empty strip).
 *
 *   id      a short unique name ("halloween-cup")
 *   title   the headline, one line
 *   line    one short line under it
 *   action  the button's words ("See the schedule")
 *   to      where the button goes: an app path ("/tournaments", "/practice?game=pool") or a full URL
 *   from    optional first UK day it shows, "YYYY-MM-DD"
 *   until   optional last UK day it shows, "YYYY-MM-DD"
 *   pages   optional pages it shows on ("play", "practice", "tournaments"); all three when left out
 *
 * Example (remove the leading // to use it):
 *   { id: "cup", title: "The Halloween Cup", line: "Six rounds, Saturday 7 pm", action: "See the schedule", to: "/tournaments" },
 *
 * Never ads here. If the slot ever carries ads, they must never appear in rooms, rounds, reveals or
 * standings: the slot is drawn only on these three tab pages (PhoneShell, desktop layout only), and
 * desktop-layout-check fails if it shows anywhere else.
 */
export type BannerPage = "play" | "practice" | "tournaments";

export interface HouseBanner {
  id: string;
  title: string;
  line: string;
  action: string;
  to: string;
  from?: string;
  until?: string;
  pages?: BannerPage[];
}

export const HOUSE_BANNERS: HouseBanner[] = [];
