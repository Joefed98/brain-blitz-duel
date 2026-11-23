/**
 * The desktop session's page screens (P4, 21 Nov 2026; docs/polish-plan-final.md section 7, earlier plan B4) for
 * theme-check and no-wrap-check: Home with Jump back in filled (this device's recent practice games), which a computer
 * lays out as one row of equal tiles (desktop-layout.css). Drawn at every size; phones and tablets keep their scrolling
 * row. The live round's Cabinet is not a skinned page (game screens never carry data-skin), so it is judged by
 * desktop-geometry-check, not here.
 */
import { ALL_SIZES, type ThemeScreen } from "../theme-screens";

const RECENT_KEY = "duelz-practice-recent:v1";
const RECENT = ["breaker", "sudoku", "codeword", "tilt", "flow", "freecell"];

export default function desktopScreens(): ThemeScreen[] {
  return [
    {
      name: "desktop: home, jump back in",
      mode: "home",
      go: async (page) => {
        await page.evaluate(([key, value]) => localStorage.setItem(key, value), [RECENT_KEY, JSON.stringify(RECENT)] as const);
        await page.reload();
        await page.waitForSelector("[data-hp-recent]", { timeout: 60_000 });
        await page.waitForTimeout(600);
      },
      sizes: ALL_SIZES,
    },
  ];
}
