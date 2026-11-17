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
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { chromium, type Page } from "playwright";

import { ARCADE_GROUPS, arcadeGroupOf, arcadeGroupTypes, isRegisteredType } from "../src/lib/duel/arcadeGroups";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { alsoInOf, typesAlsoIn } from "../src/lib/duel/alsoIn";
import { ACTIVE_PUZZLE_TYPES, PUZZLE_REGISTRY, gameCounts, typesInCategory } from "../src/lib/duel/registry";
import { practiceSideCounts } from "../src/lib/duel/practiceSide";
import { dealOne } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { GAME_LEVELS, offersLevel } from "../src/lib/levels/gameLevels";
import { puzzleLevel } from "../src/lib/levels/levels";
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
// today's Puzzles | Arcade switch"): the switch was replaced by chips.
// Changed with Joe's approval, 15 Nov 2026 (difficulty framework): the Games page's top is, in this order, the
// Puzzles | Arcade switch restored, the switch's categories as colour tiles in one sideways-scrolling row (replacing
// the All / category chips), then the difficulty switch. The browser half now proves: the switch (Puzzles first, the
// counts from the registry, the side remembered across a reload); the tiles are exactly the switch's side's live
// categories or groups, in order, each in its colour, in one row that scrolls inside itself; with no tile chosen the
// side lists exactly its active games once; each tile lists exactly its category's or group's games (and the games
// listed also in it), a second tap shows the side again; arcade tiles keep their group's border and Retro's glow; the
// difficulty switch (Easy · Normal · Hard · Expert, Normal by default) sets every tile's level, a game without the
// level is marked Normal, and the choice is remembered; the search finds games by name on both sides; no sideways page
// scrolling. The data half above is unchanged.
const listed = (page: Page) => page.locator("[data-practice-game]").evaluateAll((els) => els.map((el) => el.getAttribute("data-practice-game")!));
const settle = (page: Page) => page.waitForTimeout(350);
const isArcade = (t: string) => PUZZLE_REGISTRY[t as keyof typeof PUZZLE_REGISTRY]?.category === "arcade";
const CATEGORIES = ["word", "number", "speed", "attention", "pattern", "logic"].filter((c) => typesInCategory(c as never).length > 0);
const GROUPS = ARCADE_GROUPS.filter((g) => groupRows(g.id).length > 0);
const shelfOf = (id: string) => (CATEGORIES.includes(id) ? [...typesInCategory(id as never), ...typesAlsoIn(id as never)] : groupRows(id as never));
const sideGames = (side: "puzzles" | "arcade") => ACTIVE_PUZZLE_TYPES.filter((t) => isArcade(t) === (side === "arcade"));
const labelOf = (id: string) => ARCADE_GROUPS.find((g) => g.id === id)?.label ?? id.charAt(0).toUpperCase() + id.slice(1);
const rgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`;
const tiles = (page: Page) =>
  page.locator("[data-games-category-tiles] [data-practice-filter]").evaluateAll((els) =>
    els.map((el) => ({ id: el.getAttribute("data-practice-filter")!, name: (el.querySelector(".gm-cat-tile-name")?.textContent ?? "").trim(), pressed: el.getAttribute("aria-pressed"), cat: el.getAttribute("data-cat"), bg: getComputedStyle(el).borderTopColor })),
  );
const sidePressed = (page: Page, side: string) => page.locator(`[data-practice-side='${side}']`).getAttribute("aria-pressed");
/**
 * The stand-in's test-only game without Hard (section 3): the first arcade game, Hover today. Approved by Joe, 17 Nov
 * 2026, on condition the stand-in level list is used only by this check and the real Hover keeps Hard (both asserted).
 */
const TEST_NO_HARD = ACTIVE_PUZZLE_TYPES.filter((t) => PUZZLE_REGISTRY[t].category === "arcade")[0]!;
/** Each tile's game, the level it plays at (the wrapper's and the label's) and whether it is marked as falling back. */
const levelTiles = (page: Page) =>
  page.locator("[data-practice-game]").evaluateAll((els) =>
    els.map((el) => {
      const label = el.querySelector("[data-tile-level]");
      return { type: el.getAttribute("data-practice-game")!, level: el.getAttribute("data-level"), plays: label?.getAttribute("data-tile-level") ?? null, fallback: !!label?.hasAttribute("data-level-fallback") };
    }),
  );

fixThemeClock();
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-practice-switch", buildId: "practice-switch-check" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const screen = THEME_SCREENS.find((s) => s.name === "practice list")!;
  for (const viewport of VIEWPORTS.filter((v) => !v.desktop)) {
    const at = viewport.name;
    const { context, page } = await openThemeScreen(browser, server.origin, screen, viewport);
    try {
      // The order of the top: switch, tiles, difficulty switch, then the grid.
      const order = await page.evaluate(() => {
        const at = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().top ?? -1;
        return [at("[data-practice-switch]"), at("[data-games-category-tiles]"), at("[data-catalogue-level]"), at("[data-games-grid]")];
      });
      check(order.every((y) => y >= 0) && order[0]! < order[1]! && order[1]! < order[2]! && order[2]! < order[3]!, `${at}: the top is the switch, the category tiles, the difficulty switch, then the games (${order.map(Math.round).join(" < ")})`);
      check((await page.locator("[data-practice-filter='all']").count()) === 0, `${at}: no All chip (the tiles replace the chips)`);
      // The switch.
      check((await sidePressed(page, "puzzles")) === "true" && (await sidePressed(page, "arcade")) === "false", `${at}: a new visit opens on Puzzles`);
      const shownCounts = await page.locator("[data-practice-side] .jz-seg-count").allTextContents();
      check(JSON.stringify(shownCounts.map(Number)) === JSON.stringify([counts.puzzles, counts.arcade]), `${at}: the switch's counts are the registry's (${shownCounts.join(" | ")})`);
      for (const side of ["puzzles", "arcade"] as const) {
        if (side === "arcade") {
          await page.locator("[data-practice-side='arcade']").click();
          await settle(page);
          check((await sidePressed(page, "arcade")) === "true", `${at}: the switch flips to Arcade`);
        }
        const want = side === "puzzles" ? CATEGORIES : GROUPS.map((g) => g.id);
        const row = await tiles(page);
        check(JSON.stringify(row.map((t) => t.id)) === JSON.stringify(want), `${at} ${side}: the tiles are the side's live ${side === "puzzles" ? "categories" : "groups"} in order (${row.map((t) => t.id).join(",")})`);
        check(row.every((t) => t.name === labelOf(t.id) && t.cat === t.id && t.pressed === "false"), `${at} ${side}: each tile shows today's name and its colour, none chosen`);
        const groupBorders = row.filter((t) => ARCADE_GROUPS.some((g) => g.id === t.id && g.id !== "action"));
        check(groupBorders.every((t) => t.bg === rgb(ARCADE_GROUPS.find((g) => g.id === t.id)!.colour)), `${at} ${side}: arcade group tiles are drawn in their group's colour`);
        const oneRow = await page.locator("[data-games-category-tiles]").evaluate((el) => {
          const tops = [...el.children].map((c) => Math.round(c.getBoundingClientRect().top));
          return { rows: new Set(tops).size, scrolls: getComputedStyle(el).overflowX };
        });
        check(oneRow.rows === 1 && oneRow.scrolls === "auto", `${at} ${side}: the tiles are one row that scrolls sideways inside itself`);
        const rows = await listed(page);
        check(new Set(rows).size === rows.length && JSON.stringify([...rows].sort()) === JSON.stringify([...sideGames(side)].sort()), `${at} ${side}: with no tile chosen, the side lists exactly its ${sideGames(side).length} active games once (${rows.length})`);
        for (const id of want) {
          await page.locator(`[data-practice-filter='${id}']`).click();
          await settle(page);
          const shown = await listed(page);
          const games = shelfOf(id);
          check(JSON.stringify([...shown].sort()) === JSON.stringify([...new Set(games)].sort()), `${at}: the ${labelOf(id)} tile lists exactly its ${games.length} games`);
          check((await page.locator(`[data-practice-filter='${id}']`).getAttribute("aria-pressed")) === "true", `${at}: the ${labelOf(id)} tile shows as chosen`);
          if (id === "sports") check(shown.includes("clayshoot"), `${at}: Pull! is listed under Sports too`);
        }
        await page.locator(`[data-practice-filter='${want.at(-1)}']`).click();
        await settle(page);
        check((await listed(page)).length === sideGames(side).length, `${at} ${side}: a second tap on the chosen tile shows the whole side again`);
        if (side === "arcade") {
          const borders = await page.locator("[data-practice-game] [data-game-icon]").evaluateAll((els) =>
            els.map((el) => [el.getAttribute("data-game-icon"), el.getAttribute("data-group"), getComputedStyle(el).borderTopColor]),
          );
          const badBorder = borders.filter(([t, g, colour]) => {
            if (!isArcade(t!)) return false;
            const info = ARCADE_GROUPS.find((x) => x.id === g);
            return !info || info.id !== arcadeGroupOf(t!) || colour !== rgb(info.colour);
          });
          check(badBorder.length === 0, `${at}: every arcade tile's border is its group's colour${badBorder.length ? `: ${badBorder.map((b) => b.join(" ")).join("; ")}` : ""}`);
          const retroGlow = await page.locator("[data-practice-game] [data-group='retro']").first().evaluate((el) => getComputedStyle(el).boxShadow);
          check(/54, 226, 245/.test(retroGlow), `${at}: Retro tiles carry the cyan glow`);
        }
      }
      // The first-time explanation of levels (Joe, 15 Nov 2026): on a new device's first look at the selector.
      const introText = (await page.locator("[data-level-intro]").textContent()) ?? "";
      check(/Rated matches and the Daily are always Normal/.test(introText), `${at}: a first visit explains the levels, rated and the Daily always Normal`);
      // The difficulty switch: four levels, Normal first chosen.
      const levelOptions = await page.locator("[data-catalogue-level] [data-level-option]").evaluateAll((els) => els.map((el) => [el.getAttribute("data-level-option"), el.textContent?.trim(), el.getAttribute("aria-pressed")]));
      check(JSON.stringify(levelOptions.map((o) => o[1])) === JSON.stringify(["Easy", "Normal", "Hard", "Expert"]) && levelOptions.find((o) => o[0] === "normal")?.[2] === "true", `${at}: the difficulty switch is Easy · Normal · Hard · Expert, on Normal`);
      const atLevel = () => page.locator("[data-practice-game]").evaluateAll((els) => els.map((el) => [el.getAttribute("data-level"), el.querySelector("[data-tile-level]")?.hasAttribute("data-level-fallback")]));
      check((await atLevel()).every(([l, f]) => l === "normal" && !f), `${at}: on Normal every tile plays Normal`);
      await page.locator("[data-catalogue-level] [data-level-option='hard']").click();
      await settle(page);
      // Changed with Joe's approval, 16 Nov 2026 (games now have levels): was "No game has Hard yet (15 Nov 2026): every
      // tile plays Normal and says so". Now a game with Hard plays Hard (its tile here; the dealt round carries the Hard
      // level, section 3) and a game without Hard plays Normal and is marked Normal (here, and in section 3 on a stand-in
      // registry's test-only game, since every arcade game has Hard today).
      const hard = await levelTiles(page);
      const hardOnes = hard.filter((t) => offersLevel(t.type, "hard"));
      const normalOnes = hard.filter((t) => !offersLevel(t.type, "hard"));
      check(
        hardOnes.length > 0 && hardOnes.every((t) => t.level === "hard" && t.plays === "hard" && !t.fallback),
        `${at}: on Hard, a game with Hard plays Hard (${hardOnes.length} tiles)${hardOnes.filter((t) => t.level !== "hard" || t.plays !== "hard" || t.fallback).map((t) => ` ${t.type}`).join("")}`,
      );
      const realTest = hard.filter((t) => t.type === TEST_NO_HARD);
      check(
        realTest.length === 1 && realTest.every((t) => t.level === "hard" && t.plays === "hard" && !t.fallback),
        `${at}: in the live catalogue (no stand-in) the stand-in's test-only game ${TEST_NO_HARD} plays Hard (${JSON.stringify(realTest)})`,
      );
      check(
        normalOnes.every((t) => t.level === "normal" && t.plays === "normal" && t.fallback),
        `${at}: on Hard, a game without Hard plays Normal and is marked Normal (${normalOnes.length} tiles here${normalOnes.length ? "" : "; the stand-in's test-only game in section 3"})`,
      );
      // The side and the level are remembered across a reload.
      await page.reload();
      await page.locator("[data-games-catalogue][data-hydrated]").waitFor({ timeout: 20_000 });
      await settle(page);
      check((await sidePressed(page, "arcade")) === "true", `${at}: the side is remembered on this device`);
      check((await page.locator("[data-catalogue-level] [data-level-option='hard']").getAttribute("aria-pressed")) === "true", `${at}: the level is remembered on this device`);
      check((await page.locator("[data-level-intro]").count()) === 0, `${at}: the explanation is shown only once`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(overflow <= 0, `${at}: no sideways page scrolling (${overflow})`);
      // The search: by name only, on both sides.
      await page.locator("[data-games-search-toggle]").click();
      const search = page.locator("#games-search");
      check((await search.getAttribute("placeholder")) === "Search games" && (await search.getAttribute("aria-label")) === "Search games", `${at}: the search is "Search games"`);
      await search.fill("ball");
      await settle(page);
      const ball = await listed(page);
      const wantBall = ACTIVE_PUZZLE_TYPES.filter((t) => PUZZLE_REGISTRY[t].name.toLowerCase().includes("ball"));
      check(JSON.stringify([...ball].sort()) === JSON.stringify([...wantBall].sort()), `${at}: "ball" finds exactly the names with "ball", on both sides (${ball.join(",")})`);
      await search.fill("logic");
      await settle(page);
      const byCategory = await listed(page);
      check(byCategory.every((t) => PUZZLE_REGISTRY[t as keyof typeof PUZZLE_REGISTRY].name.toLowerCase().includes("logic")), `${at}: the search reads names only, not categories (${byCategory.length})`);
      await search.fill("");
      await settle(page);
      check((await listed(page)).length === sideGames("arcade").length, `${at}: an empty search lists the side's games again`);
    } finally {
      await context.close();
    }
  }

  /* ---------------------------------------------- 3. the level a round is dealt at */
  // Changed with Joe's approval, 16 Nov 2026 (games now have levels). A game with Hard: its game page at the catalogue's
  // Hard asks the server for a Hard deal, and the server's own deal (dealOne, as practiceGenerateFn deals it) carries the
  // Hard level, for every arcade game with Hard. A game without Hard: every arcade game has Hard today, so a stand-in
  // registry (the check-only __DUELZ_GAME_LEVELS__) gives every arcade game Hard but one test-only game, which must play
  // Normal, be marked Normal and ask for a Normal deal (no level), while every other tile plays Hard.
  const arcadeTypes = sideGames("arcade");
  const withHard = arcadeTypes.filter((t) => offersLevel(t, "hard"));
  const undealt = withHard.filter((t) => puzzleLevel(dealOne(t, { unblockRow: null as never, bankSeed: 4242, level: "hard" })) !== "hard");
  check(withHard.length > 0 && undealt.length === 0, `the server's Hard deal carries the Hard level for every arcade game with Hard (${withHard.length})${undealt.length ? `: not ${undealt.join(", ")}` : ""}`);
  check(puzzleLevel(dealOne(withHard[0]!, { unblockRow: null as never, bankSeed: 4242 })) === "normal", `a deal with no level is Normal (${withHard[0]})`);
  // Joe's conditions (17 Nov 2026): the real Hover keeps Hard, and the stand-in list is used only by this check, set
  // only through the check-only __DUELZ_GAME_LEVELS__ hook, which a production build never reads.
  check(TEST_NO_HARD === arcadeTypes[0] && GAME_LEVELS[TEST_NO_HARD]?.levels.hard !== undefined && offersLevel(TEST_NO_HARD, "hard"), `the real registry (GAME_LEVELS) gives the stand-in's test-only game ${TEST_NO_HARD} Hard`);
  const hookUses = execSync("git grep -n __DUELZ_GAME_LEVELS__ -- src", { encoding: "utf8" }).trim().split("\n").filter(Boolean);
  const hookRead = hookUses.filter((l) => l.startsWith("src/lib/levels/gameLevels.ts:") && /checkOverride<[^>]*>+\("__DUELZ_GAME_LEVELS__"\)/.test(l));
  const hookOther = hookUses.filter((l) => !l.startsWith("src/lib/levels/gameLevels.ts:") && !l.startsWith("src/lib/checkOverride.ts:"));
  check(hookRead.length === 1 && hookOther.length === 0, `the app reads __DUELZ_GAME_LEVELS__ in one place only, gameLevels.ts through checkOverride (${hookUses.length} mentions in src${hookOther.length ? `; elsewhere: ${hookOther.join(" | ")}` : ""})`);
  check(/if \(import\.meta\.env\.PROD\) return undefined;/.test(readFileSync("src/lib/checkOverride.ts", "utf8")), "checkOverride answers nothing in a production build, so the stand-in list can't reach the live app");
  const STAND_IN = Object.fromEntries(
    arcadeTypes.filter((t) => t !== TEST_NO_HARD).map((t) => [t, { levels: { hard: { settings: {}, oneSolution: { open: "practice-switch-check stand-in" } } } }]),
  );
  const atHard = async (page: Page) => {
    await page.evaluate(() => localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: "hard", games: {} })));
    await page.reload();
  };
  /** The deal requests a game page's Play sends at the catalogue's Hard. */
  const playRequests = async (viewport: (typeof VIEWPORTS)[number], type: string, globals: Record<string, unknown>, level?: "hard") => {
    const { context, page } = await openThemeScreen(browser, server.origin, { name: `game page ${type}`, mode: "practice", search: { page: type }, globals }, viewport);
    try {
      await atHard(page);
      // The stubbed server answers with a real public half (at the level it is asked for), so the round opens cleanly.
      const pub = splitPuzzle(dealOne(type as never, { unblockRow: null as never, bankSeed: 4242, ...(level ? { level } : {}) })).pub;
      await page.evaluate(([t, p]) => {
        (window as unknown as { __harness: { puzzles: Record<string, unknown> } }).__harness.puzzles[t as string] = p;
      }, [type, pub] as const);
      await page.locator(`[data-game-page-play='${type}']`).click({ timeout: 20_000 });
      await page.waitForFunction(() => ((window as unknown as { __harness: { generated?: unknown[] } }).__harness.generated ?? []).length > 0, null, { timeout: 20_000 });
      return await page.evaluate(() => (window as unknown as { __harness: { generated?: { type: string; level?: string }[] } }).__harness.generated ?? []);
    } finally {
      await context.close();
    }
  };
  for (const viewport of VIEWPORTS.filter((v) => !v.desktop)) {
    const at = viewport.name;
    const hardAsk = await playRequests(viewport, withHard[0]!, screen.globals ?? {}, "hard");
    check(hardAsk.length === 1 && hardAsk[0]!.type === withHard[0] && hardAsk[0]!.level === "hard", `${at}: Play on ${withHard[0]}'s page at Hard asks for a Hard deal (${JSON.stringify(hardAsk)})`);
    const standIn = { ...(screen.globals ?? {}), __DUELZ_GAME_LEVELS__: STAND_IN };
    const { context, page } = await openThemeScreen(browser, server.origin, { ...screen, globals: standIn }, viewport);
    try {
      await page.locator("[data-practice-side='arcade']").click();
      await settle(page);
      await page.locator("[data-catalogue-level] [data-level-option='hard']").click();
      await settle(page);
      const stood = await levelTiles(page);
      const test = stood.filter((t) => t.type === TEST_NO_HARD);
      const others = stood.filter((t) => t.type !== TEST_NO_HARD);
      check(test.length === 1 && test.every((t) => t.level === "normal" && t.plays === "normal" && t.fallback), `${at}: on Hard, the stand-in's test-only game without Hard (${TEST_NO_HARD}) plays Normal and is marked Normal (${JSON.stringify(test)})`);
      check(others.length === arcadeTypes.length - 1 && others.every((t) => t.level === "hard" && t.plays === "hard" && !t.fallback), `${at}: on Hard, every stand-in game with Hard plays Hard (${others.length} tiles)`);
    } finally {
      await context.close();
    }
    check(offersLevel(TEST_NO_HARD, "hard"), `${at}: after the stand-in pages, the real registry still gives ${TEST_NO_HARD} Hard`);
    const normalAsk = await playRequests(viewport, TEST_NO_HARD, standIn);
    check(normalAsk.length === 1 && normalAsk[0]!.type === TEST_NO_HARD && normalAsk[0]!.level === undefined, `${at}: Play on the test-only game's page at Hard asks for a Normal deal, no level (${JSON.stringify(normalAsk)})`);
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(`\n${failures === 0 ? "PASS" : "FAIL"}: practice-switch-check, ${passes} passed, ${failures} failed`);
process.exit(failures === 0 ? 0 : 1);
