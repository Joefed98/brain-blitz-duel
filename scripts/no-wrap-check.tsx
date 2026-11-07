/**
 * No wrapping or overflow on the skinned screens (19 Oct 2026, display only; polish-layout/theme.css).
 *
 * Headless Chromium draws every screen in the page skin's scope (scripts/theme-screens.ts: the four
 * tab screens, the settings sheet, the lobby and its confirm dialog, link join, the answer reveal,
 * the round leaderboard, standings, final results and podium, with the longest player names) at
 * 414×896 as an iPhone 11 home-screen app, at 375×667, and on a 1440×900 desktop (#109's centred
 * column). In every [data-skin] screen, each piece of text whose element is a single-line element
 * (a heading, button, link, label, chip, category pill, kicker, player name, score, time, code,
 * tab, anything in the display or mono fonts) must:
 *  - sit on one line (its text's line boxes all on one line), and
 *  - not overflow: not clipped by its own box (scrollWidth past clientWidth), unless it is a
 *    player name (.th-name, or a line listing names, [data-names]) or a leaderboard row's
 *    time · verdict · summary line ([data-ellipsis]), which truncate with an ellipsis, and never
 *    past the screen's edge (but inside a horizontally scrolling row, [data-scroll-x], whose items
 *    scroll into view).
 * Body paragraphs (descriptions, notes) may wrap; text in a game's own art (data-skin-off) and the
 * tapped-open detail of a leaderboard row (whitespace-normal) are not judged.
 *
 *   bun scripts/no-wrap-check.tsx [screen name filter…] [--part=k/n] [--verbose]
 */
import { existsSync } from "node:fs";

import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, fixThemeClock, openThemeScreen, partOf } from "./theme-screens";

const args = process.argv.slice(2);
const VERBOSE = args.includes("--verbose");
const ONLY = args.filter((a) => !a.startsWith("--"));
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}
const SCREENS = ONLY.length
  ? THEME_SCREENS.filter((s) => ONLY.some((o) => s.name.includes(o)))
  : THEME_SCREENS;
const DRAWS = partOf(
  VIEWPORTS.flatMap((viewport) => SCREENS.map((screen) => ({ viewport, screen }))),
  args,
);

/** In-page: every single-line text that wraps or overflows. */
function wrapProbe() {
  const SINGLE =
    "h1, h2, h3, button, a, label, summary, [role='button'], .th-kicker, .th-pill, .th-name, .th-score, .jz-medal, .font-display, .font-mono, [data-practice-filter], [data-tab], [data-category-pill]";
  const NOT_JUDGED = "[data-skin-off], .whitespace-normal, .line-clamp-2, [data-wrap-ok], .sr-only"; // .sr-only: visually hidden, never seen (approved, 7 Nov 2026)
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0)
        return false;
    }
    return true;
  };
  const describe = (el: Element) => {
    const cls = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 4).join(".");
    return `<${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""}>`;
  };
  const problems: string[] = [];
  let judged = 0;
  const seen = new Set<Node>();
  for (const root of document.querySelectorAll("[data-skin]")) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (seen.has(node)) continue;
      seen.add(node);
      const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      const el = node.parentElement;
      if (!text || !el || el.closest(NOT_JUDGED)) continue;
      const owner = el.closest(SINGLE);
      if (!owner || !root.contains(owner) || !visible(el)) continue;
      judged++;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
      const tops: number[] = [];
      for (const r of rects) if (!tops.some((t) => Math.abs(t - r.top) < 4)) tops.push(r.top);
      if (tops.length > 1)
        problems.push(`"${text}" wraps onto ${tops.length} lines in ${describe(el)}`);
      // Clipped: the text's own box, up to its single-line element, cuts it.
      let clipped: Element | null = null;
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.overflowX !== "visible" && n.scrollWidth > n.clientWidth + 1) {
          clipped = n;
          break;
        }
        if (n === owner) break;
      }
      // Player names (and a line listing them, [data-names]) truncate with an ellipsis.
      if (
        clipped &&
        !clipped.closest(".th-name, [data-names], [data-ellipsis]") &&
        !clipped.querySelector?.(".th-name")
      )
        problems.push(
          `"${text}" is cut off by ${describe(clipped)} (${clipped.scrollWidth}px of text in ${clipped.clientWidth}px)`,
        );
      const right = Math.max(...rects.map((r) => r.right));
      const left = Math.min(...rects.map((r) => r.left));
      // A horizontally scrolling row ([data-scroll-x]: Practice's category chips, Prompt R) holds
      // whole one-line items past the screen's edge that scroll into view; wrapping and clipping
      // inside each item are still judged above.
      if (rects.length && !clipped && !el.closest("[data-scroll-x]") && (right > window.innerWidth + 0.5 || left < -0.5))
        problems.push(
          `"${text}" runs off the screen (${Math.round(left)}–${Math.round(right)}px of ${window.innerWidth}px)`,
        );
    }
  }
  return { problems, judged, skins: document.querySelectorAll("[data-skin]").length };
}

const server = await startSafeAreaServer({
  cacheDir: "node_modules/.vite-no-wrap",
  buildId: "no-wrap-check",
});
// A fixed clock (scripts/fixed-clock.ts): the Play tab's and Tournaments' dates, day names and lobby lines
// are the same text on any day, so a line that fits today can't wrap on a public-game day.
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const failures: string[] = [];
const passed: string[] = [];
try {
  for (const { viewport, screen } of DRAWS) {
    {
      const where = `${screen.name} (${viewport.name})`;
      let problems: string[] = [];
      let judged = 0;
      try {
        const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
        try {
          const result = await page.evaluate(wrapProbe);
          judged = result.judged;
          problems = result.problems;
          if (result.skins === 0) problems.push("no skinned screen ([data-skin]) drawn");
          if (judged === 0) problems.push("no single-line text found to judge");
        } finally {
          await context.close();
        }
      } catch (error) {
        problems.push(String((error as Error).message ?? error).split("\n")[0]!);
      }
      for (const p of problems) failures.push(`${where}: ${p}`);
      if (!problems.length) passed.push(where);
      console.log(
        `${problems.length ? "FAIL" : "PASS"} ${where}: ${problems.length ? `${problems.length} problem(s), first: ${problems[0]}` : `${judged} single-line texts on one line, none cut off`}`,
      );
      if (VERBOSE) for (const p of problems.slice(1)) console.log(`    ${p}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}

for (const f of failures.slice(0, 80)) console.log(`  ${f}`);
if (failures.length) {
  console.log(
    `FAIL: ${failures.length} single-line text(s) wrap or overflow on the skinned screens`,
  );
  process.exit(1);
}
console.log(
  `PASS: ${passed.length} screen draws (this run's share of ${SCREENS.length} screens × ${VIEWPORTS.length} viewports): every heading, button, label, chip, name, score and time on one line, nothing cut off but long names (ellipsis)`,
);
