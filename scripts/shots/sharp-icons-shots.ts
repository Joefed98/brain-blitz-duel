/**
 * The five sharpened arcade icons for review (Prompt Q, 23 Oct 2026; a design tool, not a check):
 * Practice's Arcade shelf at 414×896 as an iPhone 11 home-screen app, scrolled to each of Orbit,
 * Breaker, Gemstone, Meteor and Tempo, and a close-up of the five 104 px icons at the phone's pixel
 * ratio (2), before (the old painters: each game's small cached sprite enlarged, rebuilt here from the
 * same exported sprite getters) and after (ARCADE_ICON_PAINTERS), drawn in the browser by the real code.
 *
 *   bun scripts/shots/sharp-icons-shots.ts [--out=screenshots/sharp-icons-oct-2026]
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, THEME_SCREENS, VIEWPORTS, openThemeScreen } from "../theme-screens";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/sharp-icons-oct-2026";
const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
mkdirSync(OUT, { recursive: true });

const GAMES = ["orbit", "breaker", "matchup", "snake", "beat"] as const;
const viewport = { ...VIEWPORTS[0]!, scale: 2 };
const jpeg = { type: "jpeg" as const, quality: 85 };
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-sharp-icons-shots", buildId: "sharp-icons-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const practice = THEME_SCREENS.find((s) => s.name === "practice list")!;
  const { context, page } = await openThemeScreen(browser, server.origin, practice, viewport);
  try {
    for (const type of GAMES) {
      await page.evaluate((t) => {
        const icon = document.querySelector(`[data-practice-shelf='arcade'] [data-game-icon='${t}']`);
        const shelf = icon?.closest("[data-practice-shelf]") as HTMLElement | null;
        if (!icon || !shelf) return;
        const tile = icon.getBoundingClientRect();
        const box = shelf.getBoundingClientRect();
        shelf.scrollLeft += tile.left - box.left - (box.width - tile.width) / 2;
        window.scrollTo(0, box.top + window.scrollY - 300);
      }, type);
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, `practice-shelf-${type}-414x896.jpg`), ...jpeg });
    }

    // Before / after at 104 px, ratio 2, on the arcade tile's colour.
    const url = await page.evaluate(async (games) => {
      const { ARCADE_ICON_PAINTERS } = await import(/* @vite-ignore */ "/src/components/app/gameIcons/arcadeIcons.renderer.ts");
      const { drawMatchupGem } = await import(/* @vite-ignore */ "/src/lib/arcade/matchup.renderer.ts");
      const { getBrickSprite } = await import(/* @vite-ignore */ "/src/lib/arcade/breaker.renderer.ts");
      const { drawBar } = await import(/* @vite-ignore */ "/src/lib/arcade/beat.renderer.ts");
      const { BEAT_LANE_COLOURS } = await import(/* @vite-ignore */ "/src/lib/arcade/beat.ts");
      const { stamp } = await import(/* @vite-ignore */ "/src/lib/arcade/snake.renderer.ts");
      const { drawPlanet, getRocketSprite } = await import(/* @vite-ignore */ "/src/lib/arcade/orbit.renderer.ts");
      const { retroBall, retroNeon, retroPaddle } = await import(/* @vite-ignore */ "/src/lib/arcade/retro.renderer.ts");
      type C = CanvasRenderingContext2D;
      // The painters as they were before Prompt Q (enlarged cached sprites).
      const before: Record<string, (c: C) => void> = {
        matchup: (c) => drawMatchupGem(c, 3, 32, 32, 25),
        breaker: (c) => {
          const colours = ["#FF3B5C", "#FFD84A", "#3DFFE0", "#C59CFF"];
          c.save();
          c.translate(4, 6);
          c.scale(0.62, 0.62);
          for (let row = 0; row < 2; row++)
            for (let col = 0; col < 2; col++) {
              const brick = getBrickSprite(colours[row * 2 + col]!, 0, 0, 0);
              if (brick) c.drawImage(brick as CanvasImageSource, col * 46, row * 22, 44, 20);
            }
          c.restore();
          retroBall(c, 38, 40, 5, "#BFF6FF");
          retroPaddle(c, 16, 50, 32, 7, "#FFD84A", "#5A4510", 0);
        },
        beat: (c) =>
          (BEAT_LANE_COLOURS as string[]).forEach((colour, lane) =>
            drawBar(c, 4 + lane * 15, [36, 12, 44, 24][lane]!, 12, retroNeon(colour), 0),
          ),
        snake: (c) => {
          const draw = (kind: "bead" | "head" | "star", x: number, y: number) => {
            const art = stamp(kind, 0, 0);
            if (art) c.drawImage(art as CanvasImageSource, x - 10, y - 10, 20, 20);
          };
          draw("bead", 24, 52);
          draw("bead", 24, 36);
          draw("head", 24, 18);
          draw("star", 48, 22);
        },
        orbit: (c) => {
          drawPlanet(c, 25, 38, 15, { type: 1, colour: "#5AA9FF", ring: true, tilt: -0.35, h: 0x9e3779b1 });
          const rocket = getRocketSprite(false);
          if (rocket) {
            c.save();
            c.translate(46, 18);
            c.rotate(-Math.PI / 4);
            c.drawImage(rocket, -22, -22, 44, 44);
            c.restore();
          }
        },
      };
      const size = 104;
      const ratio = 2;
      const px = size * ratio;
      const gap = 24 * ratio;
      const label = 28 * ratio;
      const sheet = document.createElement("canvas");
      sheet.width = games.length * (px + gap) + gap;
      sheet.height = 2 * (px + gap) + label + gap;
      const s = sheet.getContext("2d")!;
      s.fillStyle = "#07070A";
      s.fillRect(0, 0, sheet.width, sheet.height);
      s.fillStyle = "#A09DA6";
      s.font = `${14 * ratio}px system-ui`;
      s.fillText("before (enlarged sprites)", gap, label - 6 * ratio);
      s.fillText("after (painted at the icon's size)", gap, label + px + gap - 6 * ratio);
      games.forEach((type, i) => {
        [before[type]!, ARCADE_ICON_PAINTERS[type]!].forEach((paint, row) => {
          const icon = document.createElement("canvas");
          icon.width = px;
          icon.height = px;
          const c = icon.getContext("2d")!;
          const g = c.createLinearGradient(0, 0, px, px);
          g.addColorStop(0, "#8A2A2A");
          g.addColorStop(1, "#3A1414");
          c.fillStyle = g;
          c.beginPath();
          c.roundRect(0, 0, px, px, 22 * ratio);
          c.fill();
          const k = px / 64;
          c.setTransform(k, 0, 0, k, 0, 0);
          c.imageSmoothingEnabled = true;
          paint(c, k);
          s.drawImage(icon, gap + i * (px + gap), label + row * (px + gap));
        });
      });
      return sheet.toDataURL("image/png");
    }, [...GAMES]);
    writeFileSync(join(OUT, "icons-before-after-104px-2x.png"), Buffer.from(url.split(",")[1]!, "base64"));
  } finally {
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`screenshots in ${OUT}`);
