/**
 * first-impressions-screens-check (wave 1, first impressions, 10 Nov 2026; headless Chromium, ~3 min): every
 * new empty and error state, and the first-open onboarding's three screens, drawn through the shared screen
 * harness (scripts/theme-screens.ts WAVE1_SCREENS: the real routes, network stubbed; theme-check and
 * no-wrap-check judge the same screens for fonts, contrast, targets and wrapping) at 390×844, 375×667, the
 * 1440×900 desktop layout and the iPhone 11 home-screen app (414×896). On each it fails unless:
 *  - the screen's own state is drawn (the empty cards, the not-found, offline and error screens, the
 *    onboarding's screen n) with Captain Joulz's picture loaded inside the screen's width;
 *  - nothing scrolls sideways, and every button is at least 44 px tall;
 *  - on a whole-screen state (not-found, offline, error, onboarding) the title and every action are on screen
 *    with no scrolling, not under the tab bar or the home bar, and actually reachable by a tap;
 *  - the onboarding's Skip is on screen on each of its three screens.
 *
 *   bun scripts/first-impressions-screens-check.ts [screen name filter…] [--shots=<dir>]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, VIEWPORTS, WAVE1_SCREENS, fixThemeClock, openThemeScreen, type ThemeViewport } from "./theme-screens";

const args = process.argv.slice(2);
const ONLY = args.filter((a) => !a.startsWith("--"));
const SHOTS = args.find((a) => a.startsWith("--shots="))?.slice(8);
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

const SIZES: ThemeViewport[] = [{ name: "390x844", w: 390, h: 844 }, ...VIEWPORTS];

/** What each screen must draw, and whether it is a whole-screen state. */
const EXPECT: Record<string, { selectors: string[]; whole: boolean; captains: number }> = {
  "profile, new player, empty states": { selectors: ["[data-recent-rooms-empty]", "[data-your-challenges-empty]"], whole: false, captains: 2 },
  "tournaments, nothing played, empty states": { selectors: ["[data-public-results-empty]", "[data-public-none]"], whole: false, captains: 2 },
  "not found": { selectors: ["[data-error-screen]"], whole: true, captains: 1 },
  "room not found": { selectors: ["[data-error-screen]", "[data-error-screen] input"], whole: true, captains: 1 },
  "challenge not found": { selectors: ["[data-error-screen]"], whole: true, captains: 1 },
  "challenge ended": { selectors: ["[data-error-screen]", "[data-challenge-state='closed']"], whole: true, captains: 1 },
  "offline, play": { selectors: ["[data-offline-state]", "[data-offline-practice]"], whole: true, captains: 1 },
  "error boundary": { selectors: ["[data-error-boundary]", "[data-error-refresh]", "[data-error-home]"], whole: true, captains: 1 },
  "first open, screen 1": { selectors: ["[data-first-open-screen='1']", "[data-first-open-next]"], whole: true, captains: 1 },
  "first open, screen 2": { selectors: ["[data-first-open-screen='2']", "[data-first-open-next]"], whole: true, captains: 0 },
  "first open, screen 3": { selectors: ["[data-first-open-screen='3']", "[data-first-open-play]", "[data-first-open-friends]"], whole: true, captains: 1 },
};

const failures: string[] = [];
let checks = 0;
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
};

const screens = WAVE1_SCREENS().filter((s) => !ONLY.length || ONLY.some((o) => s.name.includes(o)));
check(
  WAVE1_SCREENS().every((s) => EXPECT[s.name]),
  "every wave 1 screen in the harness has its expectations here",
);

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-first-impressions", buildId: "first-impressions" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
try {
  for (const screen of screens) {
    const want = EXPECT[screen.name]!;
    for (const size of SIZES) {
      const where = `${screen.name} (${size.name})`;
      const { context, page } = await openThemeScreen(browser, server.origin, screen, size);
      try {
        for (const sel of want.selectors)
          check(await page.locator(sel).first().waitFor({ timeout: 15_000 }).then(() => true, () => false), `${where}: ${sel} drawn`);
        await page.waitForTimeout(300);
        if (SHOTS) writeFileSync(`${SHOTS}/${screen.name.replace(/\W+/g, "-")}-${size.name.replace(/\W+/g, "-")}.png`, await page.screenshot());
        const probe = await page.evaluate(
          ({ whole, wholeSel }) => {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const shown = (el: Element) => {
              const r = el.getBoundingClientRect();
              if (r.width < 1 || r.height < 1) return false;
              for (let n: Element | null = el; n; n = n.parentElement) {
                const cs = getComputedStyle(n);
                if (cs.display === "none" || cs.visibility === "hidden") return false;
              }
              return true;
            };
            // The home bar's inset and the tab bar: nothing to tap may sit under them.
            const probeEl = document.createElement("div");
            probeEl.style.cssText = "position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);width:1px;";
            document.body.appendChild(probeEl);
            const inset = probeEl.getBoundingClientRect().height;
            probeEl.remove();
            const tabBar = document.querySelector("[data-app-tabbar]");
            const tabTop = tabBar && shown(tabBar) && getComputedStyle(tabBar).position === "fixed" ? tabBar.getBoundingClientRect().top : vh;
            const floor = Math.min(vh - inset, tabTop);
            const captains = [...document.querySelectorAll("img[data-captain]")].filter(shown) as HTMLImageElement[];
            const buttons = [...document.querySelectorAll("[data-empty-state] button, [data-empty-state] a, [data-first-open] button")].filter(shown);
            const scope = document.querySelector(wholeSel);
            const actions = scope ? [...scope.querySelectorAll("button, a")].filter(shown) : [];
            const titles = scope ? [...scope.querySelectorAll("h1, h2")].filter(shown) : [];
            return {
              sideways: document.documentElement.scrollWidth - vw,
              scrolled: Math.round(document.scrollingElement?.scrollTop ?? 0),
              captains: captains.map((img) => {
                const r = img.getBoundingClientRect();
                return { loaded: img.complete && img.naturalWidth > 0, inside: r.left >= -0.5 && r.right <= vw + 0.5 };
              }),
              small: buttons
                .map((b) => ({ name: (b.textContent ?? "").trim().slice(0, 24), h: b.getBoundingClientRect().height }))
                .filter((b) => b.h < 43.5),
              offscreen: whole
                ? [...actions, ...titles]
                    .map((el) => {
                      const r = el.getBoundingClientRect();
                      const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 24);
                      const reachable =
                        el.tagName === "H1" || el.tagName === "H2"
                          ? true
                          : (() => {
                              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                              return !!hit && (hit === el || el.contains(hit));
                            })();
                      return { name, ok: r.top >= 0 && r.bottom <= floor + 0.5 && r.left >= 0 && r.right <= vw + 0.5 && reachable };
                    })
                    .filter((x) => !x.ok)
                    .map((x) => x.name)
                : [],
            };
          },
          {
            whole: want.whole,
            wholeSel: screen.mode === "firstopen" ? "[data-first-open]" : (want.selectors[0] ?? "body"),
          },
        );
        check(probe.sideways <= 1, `${where}: no sideways scroll (${probe.sideways}px)`);
        check(probe.captains.length >= want.captains, `${where}: Captain Joulz drawn (${probe.captains.length} of ${want.captains})`);
        check(probe.captains.every((c) => c.loaded), `${where}: Captain Joulz's picture loaded`);
        check(probe.captains.every((c) => c.inside), `${where}: Captain Joulz inside the screen's width`);
        check(probe.small.length === 0, `${where}: buttons at least 44 px tall (${JSON.stringify(probe.small)})`);
        if (want.whole) {
          check(probe.scrolled === 0, `${where}: no scrolling`);
          check(probe.offscreen.length === 0, `${where}: title and actions on screen and tappable (${probe.offscreen.join(" | ")})`);
        }
        if (screen.mode === "firstopen") {
          check(await page.locator("[data-first-open-skip]").isVisible(), `${where}: Skip on screen`);
          // The screen fits its space: nothing in it clipped by the swipe track.
          const clipped = await page.evaluate(() => {
            const track = document.querySelector("[data-first-open-track]")!.getBoundingClientRect();
            const current = document.querySelector("[data-first-open-screen]:not([aria-hidden='true'])")!;
            return [...current.querySelectorAll("*")]
              .filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0 && (r.top < track.top - 0.5 || r.bottom > track.bottom + 0.5);
              })
              .map((el) => (el.textContent ?? el.tagName).trim().slice(0, 24));
          });
          check(clipped.length === 0, `${where}: the whole screen fits without scrolling (${clipped.slice(0, 3).join(" | ")})`);
        }
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${checks} first-impressions screen check(s)`);
  process.exit(1);
}
console.log(
  `PASS: ${checks} checks: ${screens.length} wave 1 screens (the empty cards on Profile and Tournaments, not found, room not found, challenge not found and ended, offline, the error boundary, the onboarding's three screens) at 390×844, 375×667, the desktop layout and the iPhone 11 app: drawn with Captain Joulz, no sideways scroll, 44 px buttons, whole-screen states on screen and tappable without scrolling`,
);
process.exit(0);
