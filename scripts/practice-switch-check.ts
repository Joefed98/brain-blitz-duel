/**
 * Practice's Puzzles | Arcade switch and the arcade groups (30 Oct 2026; presentation and device storage only).
 *
 * Proves, from the registry and src/lib/duel/arcadeGroups.ts:
 *  - the switch's counts are the registry's active games on each side (arcade category / every other one);
 *  - every active arcade game is in exactly one group, every group lists only arcade ids, the colours are
 *    the --group-* tokens in src/design/tokens.css, and ids the registry lacks (the new Sports and Cards & Board
 *    games) are skipped;
 * and in headless Chromium (the real Practice route through scripts/theme-screens.ts) at 414×896 as an
 * iPhone 11 home-screen app and at 375×667 (since 14 Nov 2026 the Games catalogue's chips, which replace the switch:
 * see the browser half; the list below is the switch's, kept as history):
 *  - the page opens on Puzzles, the switch flips sides (aria-pressed, the gold half) and back;
 *  - the side is remembered on this device across a reload;
 *  - the switch's counts on screen match the registry;
 *  - Puzzles lists only non-arcade games, its chips are All games and the six puzzle categories (no Arcade);
 *  - Arcade lists exactly each group's registered games, in the map's order, under its group's heading,
 *    with chips four across (All games, Retro, Sports, Action; Cards & Board and Strategy over two columns
 *    each; Strategy split from Action on 1 Nov 2026) and no sideways scrolling; a group with no registered games shows "coming soon" and no rows;
 *  - search is scoped to the side ("Search puzzles" / "Search arcade games"), and so is Recently played.
 *
 *   bun scripts/practice-switch-check.ts
 */
import { existsSync, readFileSync } from "node:fs";

import { chromium, type Page } from "playwright";

import { ARCADE_GROUPS, arcadeGroupOf, arcadeGroupTypes, isRegisteredType } from "../src/lib/duel/arcadeGroups";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { alsoInOf, typesAlsoIn } from "../src/lib/duel/alsoIn";
import { ACTIVE_PUZZLE_TYPES, PUZZLE_REGISTRY, gameCounts, typesInCategory } from "../src/lib/duel/registry";
import { practiceSideCounts } from "../src/lib/duel/practiceSide";
import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, fixThemeClock, openThemeScreen } from "./theme-screens";

let failures = 0;
let passes = 0;
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else failures++;
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}`);
}

/* ------------------------------------------------------------ 1. the data */

const counts = practiceSideCounts();
const arcadeActive = typesInCategory("arcade");
const puzzleActive = ACTIVE_PUZZLE_TYPES.filter((t) => PUZZLE_REGISTRY[t].category !== "arcade");
check(counts.arcade === arcadeActive.length && counts.arcade === gameCounts().arcade, `the Arcade count is the registry's active arcade games (${counts.arcade})`);
check(counts.puzzles === puzzleActive.length, `the Puzzles count is the registry's other active games (${counts.puzzles})`);
check(counts.puzzles + counts.arcade === ACTIVE_PUZZLE_TYPES.length, "the two sides hold every active game once");

// Each group's own games, then the games listed also in it (alsoIn.ts, 3 Nov 2026: Pull! in Sports).
const groupRows = (id: (typeof ARCADE_GROUPS)[number]["id"]) => [...arcadeGroupTypes(id), ...typesAlsoIn(id)];
const grouped = ARCADE_GROUPS.flatMap((g) => groupRows(g.id));
check(new Set(grouped).size === grouped.length, "no game is in two groups");
const ungrouped = arcadeActive.filter((t) => arcadeGroupOf(t) === null);
check(ungrouped.length === 0, `every active arcade game has a group${ungrouped.length ? `: missing ${ungrouped.join(", ")}` : ""}`);
// The groups list every active arcade game once, plus the games listed also in a group (alsoIn.ts; their own count stays on Puzzles).
const alsoListed = ARCADE_GROUPS.flatMap((g) => typesAlsoIn(g.id));
check(grouped.length === arcadeActive.length + alsoListed.length, `the groups list ${grouped.length} games, the registry ${arcadeActive.length} active arcade games and ${alsoListed.length} also listed`);
const wrongCategory = ARCADE_GROUPS.flatMap((g) => g.games).filter((t) => isRegisteredType(t) && PUZZLE_REGISTRY[t].category !== "arcade");
check(wrongCategory.length === 0, `every registered id in a group is an arcade game${wrongCategory.length ? `: ${wrongCategory.join(", ")}` : ""}`);
const unregistered = ARCADE_GROUPS.flatMap((g) => g.games).filter((t) => !isRegisteredType(t));
check(unregistered.every((t) => !grouped.includes(t as never)), `ids not registered are skipped (${unregistered.join(", ") || "none"})`);
// Every Sports and Cards & Board game is in (30 Oct 2026): no listed id is waiting to be registered.
check(unregistered.length === 0, `every id in a group is registered${unregistered.length ? `: waiting ${unregistered.join(", ")}` : ""}`);
// Changed with Joe's approval, 13 Nov 2026: Minefield moved to Logic, so it is in no arcade group (10 of the 11 new ids).
const NEW_IDS = ["minigolf", "pool", "curling", "homerun", "freekick", "racing", "freecell", "mahjong", "tripeaks", "pokersquares"];
check(NEW_IDS.every((t) => ARCADE_GROUPS.some((g) => g.games.includes(t))), "the 10 new ids still in arcade groups are in the map");
// The brief named games by their display names: the map's registered ids resolve to exactly those names.
const BRIEF: Record<string, string[]> = {
  // Blockfall joined Retro and Alley Roll Sports on 1 Nov 2026 (Blockfall shown as Blockzone and Alley Roll as Ringer since 3 Nov 2026).
  retro: ["Hover", "Breaker", "Rally", "Wavefront", "Fission", "Tempo", "Meteor", "Spacewalk", "Pinball", "Blockzone"],
  // Home Run Derby, Free Kick and Racing registered on 30 Oct 2026 (#203); renamed Home Run, Top Bins and Apex on 31 Oct 2026.
  // Minigolf, Speed Pool and Curling shown as Crazy Golf, Cue Ball and Curl Champ since 31 Oct 2026.
  // Changed with Joe's approval, 13 Nov 2026: Flightpath, Swish and Ringer retired.
  sports: ["Crazy Golf", "Cue Ball", "Curl Champ", "Home Run", "Top Bins", "Apex"],
  // Minesweeper and Mahjong Solitaire registered on 30 Oct 2026 (#205); the group's other ids join as they register.
  // Minesweeper shown as Minefield, and FreeCell, TriPeaks and Poker Squares as Free Cell, Summit and Full House, since
  // 31 Oct 2026 (ids unchanged); Five Hands added. Full House retired to practice on 1 Nov 2026 (Joe's decision): the
  // group's active games are the rest (it keeps its group border, under All games' Retired).
  // Pyramid and Golf Solitaire joined on 2 Nov 2026; Muggins registered but practice only (Joe's decision). Pyramid shown
  // as Thirteen and Golf Solitaire retired to practice on 3 Nov 2026 (the Cards & Board batch).
  // Changed with Joe's approval, 13 Nov 2026: Minefield moved to Logic.
  cards: ["Free Cell", "Mahjong Solitaire", "Summit", "Five Hands", "Thirteen"],
  // Strategy split from Action on 1 Nov 2026 (Coral Pop, Gemstone, Ball Tracker, Tilt, Rainbow Bridge, High Rise moved).
  // Ricochet back from retirement as the ninja wall-climb (ricoRev 2, 1 Nov 2026), and Bastion back in rooms (bastionRev 2), in Action.
  // Ricochet is shown as Moon Climb since 3 Nov 2026 (ricoRev 3), and Bastion as Iron Wall.
  // High Rise back from Strategy to Action on 3 Nov 2026 (Joe's decision).
  // Orbit moved from Retro to Action on 3 Nov 2026 (Joe's audit); Jaywalk is shown as Spacewalk.
  // Changed with Joe's approval, 13 Nov 2026: Slice retired.
  action: ["Roofbound", "Grappler", "Moon Climb", "Iron Wall", "High Rise", "Orbit"],
  strategy: ["Tilt", "Gemstone", "Coral Pop", "Rainbow Bridge", "Ball Tracker"],
};
check(ARCADE_GROUPS.map((g) => g.id).join() === "retro,sports,cards,action,strategy", "five groups: Retro, Sports, Cards & Board, Action, Strategy");
for (const g of ARCADE_GROUPS) {
  const names = arcadeGroupTypes(g.id).map((t) => gameDisplayName(t));
  check(JSON.stringify(names) === JSON.stringify(BRIEF[g.id]), `${g.label} lists ${names.join(", ") || "no registered games"}`);
}
// The group colours live in the design tokens since F1 (6 Nov 2026), values unchanged.
const css = readFileSync("src/design/tokens.css", "utf8");
for (const g of ARCADE_GROUPS) {
  const token = g.id === "action" ? null : new RegExp(`--group-${g.id}:\\s*(#[0-9A-Fa-f]{6})`).exec(css)?.[1];
  if (g.id === "action") check(/--group-action:\s*var\(--category-arcade\)/.test(css) && /--category-arcade:\s*#FF4D4D/.test(css) && g.colour === "#FF4D4D", "Action is the existing arcade colour (#FF4D4D)");
  else check(token?.toUpperCase() === g.colour.toUpperCase(), `--group-${g.id} is ${g.colour} (${token ?? "missing"})`);
}

/* ------------------------------------------------------------ 2. the screen */

const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}
// Changed with Joe's approval, 14 Nov 2026 (the Games catalogue, phase 2 step 3, Joe's brief: "category chips in place of
// today's Puzzles | Arcade switch"): the switch, its counts, its remembered side and the per-side search, chips grid
// and Recently played are gone, so this browser half proves the chips that replace them (the data half above is
// unchanged). What it proves now: the chips are All, each live puzzle category, then each live arcade group, with
// today's names and their colours; All lists every playable game once; each chip lists exactly its category's or
// group's games (and the games listed also in it); arcade tiles keep their group's border and Retro's glow; the search
// finds games by name only; no sideways page scrolling; and the chip chosen holds while browsing.
const listed = (page: Page) => page.locator("[data-practice-game]").evaluateAll((els) => els.map((el) => el.getAttribute("data-practice-game")!));
const settle = (page: Page) => page.waitForTimeout(350);
const isArcade = (t: string) => PUZZLE_REGISTRY[t as keyof typeof PUZZLE_REGISTRY]?.category === "arcade";
const CATEGORIES = ["word", "number", "speed", "attention", "pattern", "logic"].filter((c) => typesInCategory(c as never).length > 0);
const GROUPS = ARCADE_GROUPS.filter((g) => groupRows(g.id).length > 0);
const shelfOf = (id: string) => (CATEGORIES.includes(id) ? [...typesInCategory(id as never), ...typesAlsoIn(id as never)] : groupRows(id as never));

fixThemeClock();
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-practice-switch", buildId: "practice-switch-check" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const screen = THEME_SCREENS.find((s) => s.name === "practice list")!;
  for (const viewport of VIEWPORTS.filter((v) => !v.desktop)) {
    const at = viewport.name;
    const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
    try {
      check((await page.locator("[data-practice-switch], [data-practice-side]").count()) === 0, `${at}: no Puzzles | Arcade switch`);
      const chips = await page.locator("[data-practice-filter]").evaluateAll((els) =>
        els.map((el) => ({ id: el.getAttribute("data-practice-filter")!, text: (el.textContent ?? "").trim(), pressed: el.getAttribute("aria-pressed") })),
      );
      const wantIds = ["all", ...CATEGORIES, ...GROUPS.map((g) => g.id)];
      check(JSON.stringify(chips.map((c) => c.id)) === JSON.stringify(wantIds), `${at}: the chips are All, the live categories, then the live arcade groups (${chips.map((c) => c.id).join(",")})`);
      const labelOf = (id: string) => (id === "all" ? "All" : (ARCADE_GROUPS.find((g) => g.id === id)?.label ?? id.charAt(0).toUpperCase() + id.slice(1)));
      check(chips.every((c) => c.text === labelOf(c.id)), `${at}: each chip shows today's name (${chips.map((c) => c.text).join(", ")})`);
      check(chips[0]?.pressed === "true" && chips.slice(1).every((c) => c.pressed === "false"), `${at}: a new visit opens on All`);
      // Each chip's dot is its category's or group's colour.
      const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
      const dots = await page.locator("[data-practice-filter][data-cat]").evaluateAll((els) =>
        els.map((el) => [el.getAttribute("data-cat"), getComputedStyle(el).getPropertyValue("--cat").trim()]),
      );
      const badGroupDot = dots.filter(([id, cat]) => {
        const g = ARCADE_GROUPS.find((x) => x.id === id);
        return g ? g.id !== "action" && !cat.toUpperCase().includes(g.colour.toUpperCase()) && !cat.includes("--group-") : !cat;
      });
      check(dots.length === wantIds.length - 1 && badGroupDot.length === 0, `${at}: every chip but All carries its colour (${dots.length} dots)`);
      void rgb;
      // All: every playable game once.
      const allRows = await listed(page);
      check(new Set(allRows).size === allRows.length, `${at}: All lists each game once (${allRows.length})`);
      check(ACTIVE_PUZZLE_TYPES.every((t) => allRows.includes(t)) && allRows.every((t) => (ACTIVE_PUZZLE_TYPES as readonly string[]).includes(t)), `${at}: All lists every active game and nothing else`);
      // Group-coloured tile borders.
      const borders = await page.locator("[data-practice-game] [data-game-icon]").evaluateAll((els) =>
        els.map((el) => [el.getAttribute("data-game-icon"), el.getAttribute("data-group"), getComputedStyle(el).borderTopColor]),
      );
      const badBorder = borders.filter(([t, g, colour]) => {
        if (!isArcade(t!)) return g !== null;
        const info = ARCADE_GROUPS.find((x) => x.id === g);
        return !info || info.id !== arcadeGroupOf(t!) || colour !== rgb(info.colour);
      });
      check(badBorder.length === 0, `${at}: every arcade tile's border is its group's colour${badBorder.length ? `: ${badBorder.map((b) => b.join(" ")).join("; ")}` : ""}`);
      const retroGlow = await page.locator("[data-group='retro']").first().evaluate((el) => getComputedStyle(el).boxShadow);
      check(/54, 226, 245/.test(retroGlow), `${at}: Retro tiles carry the cyan glow`);
      // Each chip lists exactly its shelf.
      for (const id of wantIds.slice(1)) {
        await page.locator(`[data-practice-filter='${id}']`).click();
        await settle(page);
        const rows = await listed(page);
        const want = shelfOf(id);
        check(JSON.stringify([...rows].sort()) === JSON.stringify([...new Set(want)].sort()), `${at}: the ${labelOf(id)} chip lists exactly its ${want.length} games`);
        check((await page.locator(`[data-practice-filter='${id}']`).getAttribute("aria-pressed")) === "true", `${at}: the ${labelOf(id)} chip shows as chosen`);
        if (id === "sports") check(rows.includes("clayshoot"), `${at}: Pull! is listed under Sports too`);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 0, `${at}: no sideways page scrolling (${overflow})`);
      await page.locator("[data-practice-filter='all']").click();
      await settle(page);
      // The search: by name only.
      await page.locator("[data-games-search-toggle]").click();
      const search = page.locator("#games-search");
      check((await search.getAttribute("placeholder")) === "Search games" && (await search.getAttribute("aria-label")) === "Search games", `${at}: the search is "Search games"`);
      await search.fill("ball");
      await settle(page);
      const ball = await listed(page);
      check(ball.length > 0 && ball.every((t) => PUZZLE_REGISTRY[t as keyof typeof PUZZLE_REGISTRY].name.toLowerCase().includes("ball")), `${at}: "ball" finds only names with "ball" (${ball.join(",")})`);
      await search.fill("logic");
      await settle(page);
      const byCategory = await listed(page);
      check(byCategory.every((t) => PUZZLE_REGISTRY[t as keyof typeof PUZZLE_REGISTRY].name.toLowerCase().includes("logic")), `${at}: the search reads names only, not categories (${byCategory.length})`);
      await search.fill("");
      await settle(page);
      check((await listed(page)).length === allRows.length, `${at}: an empty search lists every game again`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: practice-switch-check, ${passes} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
