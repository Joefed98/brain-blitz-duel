/**
 * Practice's Puzzles | Arcade switch and the arcade groups (30 Oct 2026; presentation and device storage only).
 *
 * Proves, from the registry and src/lib/duel/arcadeGroups.ts:
 *  - the switch's counts are the registry's active games on each side (arcade category / every other one);
 *  - every active arcade game is in exactly one group, every group lists only arcade ids, the colours are
 *    the --group-* tokens in styles.css, and ids the registry lacks (the new Sports and Cards & Board
 *    games) are skipped;
 * and in headless Chromium (the real Practice route through scripts/theme-screens.ts) at 414×896 as an
 * iPhone 11 home-screen app and at 375×667:
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
import { ACTIVE_PUZZLE_TYPES, PUZZLE_REGISTRY, gameCounts, typesInCategory } from "../src/lib/duel/registry";
import { PRACTICE_SIDE_KEY, practiceSideCounts } from "../src/lib/duel/practiceSide";
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

const grouped = ARCADE_GROUPS.flatMap((g) => arcadeGroupTypes(g.id));
check(new Set(grouped).size === grouped.length, "no game is in two groups");
const ungrouped = arcadeActive.filter((t) => arcadeGroupOf(t) === null);
check(ungrouped.length === 0, `every active arcade game has a group${ungrouped.length ? `: missing ${ungrouped.join(", ")}` : ""}`);
check(grouped.length === arcadeActive.length, `the groups list ${grouped.length} games, the registry ${arcadeActive.length} active arcade games`);
const wrongCategory = ARCADE_GROUPS.flatMap((g) => g.games).filter((t) => isRegisteredType(t) && PUZZLE_REGISTRY[t].category !== "arcade");
check(wrongCategory.length === 0, `every registered id in a group is an arcade game${wrongCategory.length ? `: ${wrongCategory.join(", ")}` : ""}`);
const unregistered = ARCADE_GROUPS.flatMap((g) => g.games).filter((t) => !isRegisteredType(t));
check(unregistered.every((t) => !grouped.includes(t as never)), `ids not registered are skipped (${unregistered.join(", ") || "none"})`);
// Every Sports and Cards & Board game is in (30 Oct 2026): no listed id is waiting to be registered.
check(unregistered.length === 0, `every id in a group is registered${unregistered.length ? `: waiting ${unregistered.join(", ")}` : ""}`);
const NEW_IDS = ["minigolf", "pool", "curling", "homerun", "freekick", "racing", "minesweeper", "freecell", "mahjong", "tripeaks", "pokersquares"];
check(NEW_IDS.every((t) => ARCADE_GROUPS.some((g) => g.games.includes(t))), "the 11 new ids are in the map");
// The brief named games by their display names: the map's registered ids resolve to exactly those names.
const BRIEF: Record<string, string[]> = {
  retro: ["Hover", "Breaker", "Rally", "Wavefront", "Fission", "Tempo", "Meteor", "Orbit", "Jaywalk", "Pinball"],
  // Home Run Derby, Free Kick and Racing registered on 30 Oct 2026 (#203); renamed Home Run, Top Bins and Apex on 31 Oct 2026.
  // Minigolf, Speed Pool and Curling shown as Crazy Golf, Cue Ball and Curl Champ since 31 Oct 2026.
  sports: ["Flightpath", "Swish", "Crazy Golf", "Cue Ball", "Curl Champ", "Home Run", "Top Bins", "Apex"],
  // Minesweeper and Mahjong Solitaire registered on 30 Oct 2026 (#205); the group's other ids join as they register.
  // Minesweeper shown as Minefield, and FreeCell, TriPeaks and Poker Squares as Free Cell, Summit and Full House, since
  // 31 Oct 2026 (ids unchanged); Five Hands added. Full House retired to practice on 1 Nov 2026 (Joe's decision): the
  // group's active games are the rest (it keeps its group border, under All games' Retired).
  cards: ["Minefield", "Free Cell", "Mahjong Solitaire", "Summit", "Five Hands"],
  // Strategy split from Action on 1 Nov 2026 (Coral Pop, Gemstone, Ball Tracker, Tilt, Rainbow Bridge, High Rise moved).
  // Ricochet back from retirement as the ninja wall-climb (ricoRev 2, 1 Nov 2026), in Action.
  action: ["Slice", "Roofbound", "Grappler", "Ricochet"],
  strategy: ["Tilt", "Gemstone", "High Rise", "Coral Pop", "Rainbow Bridge", "Ball Tracker"],
};
check(ARCADE_GROUPS.map((g) => g.id).join() === "retro,sports,cards,action,strategy", "five groups: Retro, Sports, Cards & Board, Action, Strategy");
for (const g of ARCADE_GROUPS) {
  const names = arcadeGroupTypes(g.id).map((t) => gameDisplayName(t));
  check(JSON.stringify(names) === JSON.stringify(BRIEF[g.id]), `${g.label} lists ${names.join(", ") || "no registered games"}`);
}
const css = readFileSync("src/styles.css", "utf8");
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
const RECENT = ["hover", "unblock", "breaker", "lightsout", "matchup", "sudoku"];
const listed = (page: Page) => page.locator("[data-practice-game]").evaluateAll((els) => els.map((el) => el.getAttribute("data-practice-game")!));
const recent = (page: Page) => page.locator("[data-practice-recent]").evaluateAll((els) => els.map((el) => el.getAttribute("data-practice-recent")!));
const side = (page: Page) => page.locator("[data-practice-switch]").getAttribute("data-practice-switch");
const pressed = (page: Page, s: string) => page.locator(`[data-practice-side='${s}']`).getAttribute("aria-pressed");
const settle = (page: Page) => page.waitForTimeout(350);
const isArcade = (t: string) => PUZZLE_REGISTRY[t as keyof typeof PUZZLE_REGISTRY]?.category === "arcade";

fixThemeClock();
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-practice-switch", buildId: "practice-switch-check" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const screen = THEME_SCREENS.find((s) => s.name === "practice list")!;
  for (const viewport of VIEWPORTS.filter((v) => !v.desktop)) {
    const at = viewport.name;
    const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport, async (ctx) => {
      await ctx.addInitScript((r) => localStorage.setItem("duelz-practice-recent:v1", JSON.stringify(r)), RECENT);
    });
    try {
      // Puzzles first.
      check((await side(page)) === "puzzles" && (await pressed(page, "puzzles")) === "true" && (await pressed(page, "arcade")) === "false", `${at}: a new device opens on Puzzles`);
      const shownCounts = await page.locator("[data-practice-side]").evaluateAll((els) => els.map((el) => [el.getAttribute("data-practice-side"), (el.textContent ?? "").replace(/\s+/g, " ").trim()]));
      check(
        JSON.stringify(shownCounts) === JSON.stringify([["puzzles", `Puzzles ${counts.puzzles}`], ["arcade", `Arcade ${counts.arcade}`]]),
        `${at}: the switch reads "Puzzles ${counts.puzzles}" | "Arcade ${counts.arcade}" (${shownCounts.map((c) => c[1]).join(" | ")})`,
      );
      const gold = await page.locator("[data-practice-side]").evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundImage.includes("gradient")));
      check(gold[0] === true && gold[1] === false, `${at}: the active half has the gold shine, the other is plain`);
      const puzzleRows = await listed(page);
      check(puzzleRows.length > 0 && puzzleRows.every((t) => !isArcade(t)), `${at}: Puzzles lists no arcade game (${puzzleRows.length} rows)`);
      check(puzzleActive.every((t) => puzzleRows.includes(t)), `${at}: Puzzles lists every active puzzle`);
      const chips = await page.locator("[data-practice-filter]").evaluateAll((els) => els.map((el) => el.getAttribute("data-practice-filter")));
      check(JSON.stringify(chips) === JSON.stringify(["all", "word", "number", "speed", "attention", "pattern", "logic"]), `${at}: Puzzles' chips are All games and the six categories, no Arcade (${chips.join(",")})`);
      const puzzleGroups = await page.locator("[data-practice-group]").evaluateAll((els) => els.map((el) => el.getAttribute("data-practice-group")));
      check(!puzzleGroups.includes("arcade") && puzzleGroups.length === 6, `${at}: Puzzles has a section per puzzle category (${puzzleGroups.join(",")})`);
      check(JSON.stringify(await recent(page)) === JSON.stringify(["unblock", "lightsout", "sudoku"]), `${at}: Recently played on Puzzles shows only puzzles (${(await recent(page)).join(",")})`);
      const puzzleSearch = page.getByRole("searchbox", { name: "Search puzzles" });
      check((await puzzleSearch.count()) === 1 && (await puzzleSearch.getAttribute("placeholder")) === "Search puzzles", `${at}: Puzzles' search is "Search puzzles"`);
      await puzzleSearch.fill("r");
      await settle(page);
      const rSearch = await listed(page);
      check(rSearch.length > 0 && rSearch.every((t) => !isArcade(t)), `${at}: searching "r" on Puzzles finds no arcade game (${rSearch.length})`);
      await puzzleSearch.fill("Breaker");
      await settle(page);
      check((await listed(page)).length === 0, `${at}: searching an arcade game's name on Puzzles finds nothing`);
      await puzzleSearch.fill("");

      // Flip to Arcade.
      await page.locator("[data-practice-side='arcade']").click();
      await settle(page);
      check((await side(page)) === "arcade" && (await pressed(page, "arcade")) === "true" && (await pressed(page, "puzzles")) === "false", `${at}: the switch flips to Arcade`);
      const stored = await page.evaluate((k) => localStorage.getItem(k), PRACTICE_SIDE_KEY);
      check(stored === "arcade", `${at}: the side is stored on the device (${stored})`);
      const arcadeRows = await listed(page);
      const activeArcadeRows = arcadeRows.filter((t) => !PUZZLE_REGISTRY[t as keyof typeof PUZZLE_REGISTRY]?.retired);
      check(arcadeRows.every(isArcade), `${at}: Arcade lists only arcade games`);
      check(JSON.stringify(activeArcadeRows) === JSON.stringify(grouped), `${at}: Arcade's sections list exactly the mapped games in order`);
      const sections = await page.locator("[data-practice-group]").evaluateAll((els) =>
        els.map((el) => ({
          id: el.getAttribute("data-practice-group")!,
          title: el.querySelector("h2")?.textContent ?? "",
          meta: el.querySelector(".ap-meta")?.textContent ?? "",
          dot: el.querySelector(".ap-dot")?.getAttribute("data-dot") ?? "",
          games: [...el.querySelectorAll("[data-practice-game]")].map((b) => b.getAttribute("data-practice-game")),
        })),
      );
      const expected = ARCADE_GROUPS.filter((g) => arcadeGroupTypes(g.id).length > 0);
      check(
        JSON.stringify(sections.map((s) => s.id)) === JSON.stringify(expected.map((g) => g.id)),
        `${at}: one section per group with registered games (${sections.map((s) => s.id).join(",")})`,
      );
      for (const g of expected) {
        const s = sections.find((x) => x.id === g.id);
        const n = arcadeGroupTypes(g.id).length;
        check(
          !!s && s.title === g.label && s.meta === `${n} ${n === 1 ? "game" : "games"}` && s.dot === g.id && JSON.stringify(s.games) === JSON.stringify(arcadeGroupTypes(g.id)),
          `${at}: "${g.label} · ${n} games" lists exactly ${arcadeGroupTypes(g.id).join(", ")}`,
        );
      }
      // Group-coloured tile borders.
      const borders = await page.locator("[data-practice-group] [data-game-icon]").evaluateAll((els) =>
        els.map((el) => [el.getAttribute("data-game-icon"), el.getAttribute("data-group"), getComputedStyle(el).borderTopColor]),
      );
      const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
      const badBorder = borders.filter(([t, g, colour]) => {
        const info = ARCADE_GROUPS.find((x) => x.id === g);
        return !info || info.id !== arcadeGroupOf(t!) || colour !== rgb(info.colour);
      });
      check(badBorder.length === 0, `${at}: every arcade tile's border is its group's colour${badBorder.length ? `: ${badBorder.map((b) => b.join(" ")).join("; ")}` : ""}`);
      const retroGlow = await page.locator("[data-group='retro']").first().evaluate((el) => getComputedStyle(el).boxShadow);
      check(/54, 226, 245/.test(retroGlow), `${at}: Retro tiles carry the cyan glow`);
      // Chips: four across, Cards & Board and Strategy over two columns each, no sideways scrolling.
      const chipBoxes = await page.locator("[data-practice-filter]").evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect();
          return { id: el.getAttribute("data-practice-filter")!, text: (el.textContent ?? "").trim(), x: r.left, y: r.top, w: r.width, right: r.right };
        }),
      );
      check(
        JSON.stringify(chipBoxes.map((c) => c.text)) === JSON.stringify(["All games", "Retro", "Sports", "Action", "Cards & Board", "Strategy"]),
        `${at}: Arcade's chips are All games, Retro, Sports, Action, Cards & Board, Strategy (${chipBoxes.map((c) => c.text).join(", ")})`,
      );
      const [all, retro, sports, action, cards, strategy] = chipBoxes;
      const row1 =
        !!all && !!retro && !!sports && !!action &&
        [retro, sports, action].every((c) => Math.abs(c.y - all.y) < 1) && all.x < retro.x && retro.x < sports.x && sports.x < action.x;
      const row2 = !!cards && !!strategy && Math.abs(cards.y - strategy.y) < 1 && cards.y > all!.y + 10 && Math.abs(cards.x - all!.x) < 1 && Math.abs(strategy.x - sports!.x) < 1;
      const span = !!cards && !!all && cards.w > all.w * 1.9 && strategy!.w > all.w * 1.9 && Math.abs(strategy!.right - action!.right) < 1;
      check(row1 && row2 && span, `${at}: chips in a 4-column grid, Cards & Board and Strategy spanning two columns each`);
      const overflow = await page.evaluate(() => {
        const grid = document.querySelector("[data-practice-filter]")!.parentElement!;
        return { grid: grid.scrollWidth - grid.clientWidth, page: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      check(overflow.grid <= 0 && overflow.page <= 0 && chipBoxes.every((c) => c.right <= viewport.w), `${at}: no sideways scrolling on the Arcade side (grid ${overflow.grid}, page ${overflow.page})`);
      check(JSON.stringify(await recent(page)) === JSON.stringify(["hover", "breaker", "matchup"]), `${at}: Recently played on Arcade shows only arcade games (${(await recent(page)).join(",")})`);
      const arcadeSearch = page.getByRole("searchbox", { name: "Search arcade games" });
      check((await arcadeSearch.count()) === 1 && (await arcadeSearch.getAttribute("placeholder")) === "Search arcade games", `${at}: Arcade's search is "Search arcade games"`);
      await arcadeSearch.fill("r");
      await settle(page);
      const arSearch = await listed(page);
      check(arSearch.length > 0 && arSearch.every(isArcade), `${at}: searching "r" on Arcade finds only arcade games (${arSearch.length})`);
      check((await recent(page)).length === 0, `${at}: Recently played hides while searching`);
      await arcadeSearch.fill("Gridlock");
      await settle(page);
      check((await listed(page)).length === 0, `${at}: searching a puzzle's name on Arcade finds nothing`);
      await arcadeSearch.fill("");
      // Group chips.
      await page.locator("[data-practice-filter='retro']").click();
      await settle(page);
      check(JSON.stringify(await listed(page)) === JSON.stringify(arcadeGroupTypes("retro")), `${at}: the Retro chip shows only Retro's games`);
      await page.locator("[data-practice-filter='cards']").click();
      await settle(page);
      // A group with registered games lists exactly them; one with none yet shows "coming soon" and no rows.
      const cardsTypes = arcadeGroupTypes("cards");
      if (cardsTypes.length)
        check(JSON.stringify(await listed(page)) === JSON.stringify(cardsTypes) && (await page.locator("[data-practice-empty-group='cards']").count()) === 0, `${at}: the Cards & Board chip shows only its registered games (${cardsTypes.join(", ")})`);
      else
        check((await listed(page)).length === 0 && (await page.locator("[data-practice-empty-group='cards']").count()) === 1, `${at}: Cards & Board (no registered games yet) shows coming soon and no rows`);
      await page.locator("[data-practice-filter='all']").click();
      await settle(page);

      // Remembered across a reload.
      await page.reload();
      await page.locator("[data-practice-game]").first().waitFor({ timeout: 60_000 });
      await settle(page);
      check((await side(page)) === "arcade" && (await listed(page)).every(isArcade), `${at}: after a reload the device opens on Arcade again`);
      await page.locator("[data-practice-side='puzzles']").click();
      await settle(page);
      check((await side(page)) === "puzzles" && (await listed(page)).every((t) => !isArcade(t)), `${at}: the switch flips back to Puzzles`);
      await page.reload();
      await page.locator("[data-practice-game]").first().waitFor({ timeout: 60_000 });
      await settle(page);
      check((await side(page)) === "puzzles", `${at}: after a reload the device opens on Puzzles again`);
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
