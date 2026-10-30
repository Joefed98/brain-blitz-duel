/**
 * The game tile icons' contact sheet (27 Oct 2026; a design tool, not a check): every game's tile as
 * the app draws it (GameIcon, gameIcons/conceptIcons.tsx), taken from the real Practice page and laid
 * out by category on one page, at 414×896 as an iPhone 11 home-screen app and at 375×667, each at the
 * phone's pixel ratio (2). Each game shows its 64 px tile (Practice's shelves draw 104, its lists 40,
 * the results screens 34) and its 34 px tile beside it, so both ends of the range can be judged.
 *
 *   bun scripts/shots/tile-icons-sheet.ts [--out=screenshots/tile-icons-oct-2026]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { GAME_DISPLAY_NAMES } from "../../src/lib/duel/gameNames";
import { ARCADE_GROUPS, arcadeGroupOf, arcadeGroupTypes } from "../../src/lib/duel/arcadeGroups";
import { PUZZLE_REGISTRY } from "../../src/lib/duel/registry";
import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, openThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/tile-icons-oct-2026";
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

const ORDER = ["word", "number", "speed", "attention", "pattern", "logic"] as const;
const entry = (type: string) => ({
  type,
  name: GAME_DISPLAY_NAMES[type as keyof typeof GAME_DISPLAY_NAMES],
  retired: Boolean(PUZZLE_REGISTRY[type as keyof typeof PUZZLE_REGISTRY].retired),
});
// Puzzles by category; arcade games by their group (arcadeGroups.ts, 30 Oct 2026), then the retired arcade games.
const games = [
  ...ORDER.map((category) => ({
    title: category[0]!.toUpperCase() + category.slice(1),
    colour: `var(--category-${category})`,
    games: Object.entries(PUZZLE_REGISTRY)
      .filter(([, def]) => def.category === category)
      .map(([type]) => entry(type))
      .sort((a, b) => Number(a.retired) - Number(b.retired) || a.name.localeCompare(b.name)),
  })),
  ...ARCADE_GROUPS.map((group) => ({ title: `Arcade · ${group.label}`, colour: `var(--group-${group.id})`, games: arcadeGroupTypes(group.id).map(entry) })),
  {
    title: "Arcade · retired",
    colour: "var(--category-arcade)",
    games: Object.entries(PUZZLE_REGISTRY)
      .filter(([type, def]) => def.category === "arcade" && def.retired && !arcadeGroupOf(type))
      .map(([type]) => entry(type))
      .sort((a, b) => a.name.localeCompare(b.name)),
  },
].filter((g) => g.games.length > 0);

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-tile-icons-sheet", buildId: "tile-icons-sheet" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const practice = THEME_SCREENS.find((s) => s.name === "practice list")!;
  for (const vp of VIEWPORTS.filter((v) => !v.desktop)) {
    const viewport = { ...vp, scale: 2 };
    const { context, page } = await openThemeScreen(browser, server.origin, practice, viewport);
    try {
      await page.waitForSelector("[data-game-icon]");
      // Practice shows one side at a time (Puzzles | Arcade): keep a copy of the Arcade side's tiles.
      await page.locator("[data-practice-side='arcade']").click();
      await page.waitForTimeout(600);
      await page.evaluate(() => {
        (window as unknown as { __arcadeIcons: Element[] }).__arcadeIcons = Array.from(document.querySelectorAll("[data-game-icon]")).map((el) => el.cloneNode(true) as Element);
      });
      await page.locator("[data-practice-side='puzzles']").click();
      await page.waitForTimeout(600);
      const missing = await page.evaluate(({ groups, label }) => {
        const source = new Map<string, Element>();
        const arcade = (window as unknown as { __arcadeIcons: Element[] }).__arcadeIcons;
        for (const el of [...Array.from(document.querySelectorAll("[data-game-icon]")), ...arcade]) {
          const type = el.getAttribute("data-game-icon")!;
          if (!source.has(type)) source.set(type, el);
        }
        const lost: string[] = [];
        const sheet = document.createElement("div");
        sheet.setAttribute("data-icon-sheet", "");
        sheet.style.cssText =
          "position:absolute;left:0;top:0;width:100%;min-height:100%;background:#070709;color:#F5F5F7;font:600 11px/1.25 Manrope,system-ui,sans-serif;padding:16px 16px 40px;box-sizing:border-box;z-index:99999";
        const title = document.createElement("div");
        title.textContent = `Game tile icons · ${label}`;
        title.style.cssText = "font:800 16px Saira,system-ui,sans-serif;margin-bottom:4px";
        sheet.appendChild(title);
        const sub = document.createElement("div");
        sub.textContent = "Each game: the 64 px tile and the 34 px tile. Retired (practice only) games are marked.";
        sub.style.cssText = "color:#BDBDCC;font-weight:500;margin-bottom:10px";
        sheet.appendChild(sub);
        for (const { title: heading, colour, games: list } of groups) {
          const head = document.createElement("div");
          head.textContent = `${heading} · ${list.length}`;
          head.style.cssText = `font:800 13px Saira,system-ui,sans-serif;margin:14px 0 8px;color:${colour}`;
          sheet.appendChild(head);
          const grid = document.createElement("div");
          grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:12px 6px";
          for (const game of list) {
            const icon = source.get(game.type);
            const cell = document.createElement("div");
            cell.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0";
            const row = document.createElement("div");
            row.style.cssText = "display:flex;align-items:flex-end;gap:5px";
            if (!icon) lost.push(game.type);
            for (const size of [64, 34]) {
              if (!icon) continue;
              const copy = icon.cloneNode(true) as HTMLElement;
              copy.style.width = `${size}px`;
              copy.style.height = `${size}px`;
              copy.style.setProperty("--gi-border", `${Math.max(1.5, Math.round(size * 0.045 * 2) / 2)}px`);
              row.appendChild(copy);
            }
            cell.appendChild(row);
            const name = document.createElement("div");
            name.textContent = game.retired ? `${game.name} (retired)` : game.name;
            name.style.cssText = `text-align:center;max-width:100%;color:${game.retired ? "#8A8A99" : "#F5F5F7"}`;
            cell.appendChild(name);
            grid.appendChild(cell);
          }
          sheet.appendChild(grid);
        }
        document.body.appendChild(sheet);
        document.documentElement.style.overflow = "visible";
        document.body.style.overflow = "visible";
        window.scrollTo(0, 0);
        return lost;
      }, { groups: games, label: vp.name });
      if (missing.length) console.log(`NOTE: ${vp.name}: not on the Practice page: ${missing.join(", ")}`);
      await page.waitForTimeout(300);
      const sheet = page.locator("[data-icon-sheet]");
      const file = join(OUT, `tile-icons-${vp.name.split(" ")[0]}.png`);
      await sheet.screenshot({ path: file });
      console.log(`wrote ${file}`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(0);
