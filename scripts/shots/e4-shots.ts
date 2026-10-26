/**
 * Review screenshots for expansion E4 (25 Oct 2026, docs/expansions/e4.md; a design tool, not a check):
 * High Rise (skylineRev 7) and Pinball (pinRev 4) mid-play at 414×896 (2×), each frame showing the new
 * features. It opens the real practice play screen (the game frame, the arena box and its scene fill),
 * stops the stage's own frame loop, and draws states from a skill-band bot's run (the same sim the stage
 * runs, played by scripts/arcade-skill-bands/bots) onto the stage's own canvas with the game's real renderer,
 * a couple of seconds of frames up to each moment so the camera and the success layer are where play puts them.
 *
 *   bun scripts/shots/e4-shots.ts --url=<origin> [--out=screenshots/expansion-e4-oct-2026] [skyline] [pinball]
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import type { PuzzleType } from "../../src/lib/duel/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const ORIGIN = (opt("url") ?? "http://127.0.0.1:5191").replace(/\/$/, "");
const OUT = opt("out") ?? "screenshots/expansion-e4-oct-2026";
const ONLY = args.filter((a) => !a.startsWith("--"));
mkdirSync(OUT, { recursive: true });

async function open(page: Page, game: PuzzleType): Promise<void> {
  await page.goto(`${ORIGIN}/practice`, { waitUntil: "domcontentloaded", timeout: 240_000 });
  const button = page.getByRole("button", { name: gameDisplayName(game), exact: true }).first();
  await button.waitFor({ timeout: 120_000 });
  await page.waitForTimeout(1500);
  await button.click();
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 90_000 });
  await page.locator("[data-game-stage] canvas.puzzle-board").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1800);
  // Stop the stage's own loop: every later frame is drawn by this tool.
  await page.evaluate(() => {
    (window as unknown as { requestAnimationFrame: unknown }).requestAnimationFrame = () => 0;
  });
  await page.waitForTimeout(200);
}

/** A moment to photograph: the file name and the tick to draw up to (picked in the page from the run's states). */
interface Moment {
  name: string;
  pick: string;
}

const GAMES: Record<string, { type: PuzzleType; sim: string; art: string; draw: string; game: string; seed: number; level: string; moments: Moment[] }> = {
  skyline: {
    type: "skyline",
    sim: "/src/lib/arcade/skyline.ts",
    art: "/src/lib/arcade/skyline.renderer.ts",
    draw: "drawSkylineArt",
    game: "skylineExpandGame",
    seed: 12345,
    level: "near",
    moments: [
      // A gold block sliding in on a streak of three or more (×2+), the preview showing the next block.
      { name: "gold-streak", pick: "(s, p) => s.expandRev && s.kinds[s.placed] === 1 && (s.streak ?? 0) >= 3 && s.tick - (p.lastDrop ?? 0) > 18" },
      // Just after a gold block landed perfectly (the GOLD BONUS pop).
      { name: "gold-landed", pick: "(s) => s.lastKind === 1 && s.lastPerfect > 0 && s.tick - s.lastPerfect === 16" },
      // A narrow block sliding (hazard band), a wide one in the preview or next.
      { name: "narrow", pick: "(s, p) => s.kinds[s.placed] === 2 && s.tick - (p.lastDrop ?? 0) > 18" },
      { name: "wide", pick: "(s, p) => s.kinds[s.placed] === 3 && s.tick - (p.lastDrop ?? 0) > 18" },
      // A height milestone: the banner and the camera pulled back to show the city (floor 20 and 30).
      { name: "milestone-20", pick: "(s) => s.milestones === 2 && s.tick - s.milestoneTick === 45" },
      { name: "milestone-30", pick: "(s) => s.milestones === 3 && s.tick - s.milestoneTick === 45" },
    ],
  },
  pinball: {
    type: "pinball",
    sim: "/src/lib/arcade/pinball4.ts",
    art: "/src/lib/arcade/pinball4.renderer.ts",
    draw: "drawPinballAny",
    game: "pinball4Game",
    seed: 12345,
    level: "near",
    moments: [
      // The plunger's power meter charging, the skill shot's letter flashing.
      { name: "plunge-meter", pick: "(s) => !s.live && s.charge >= 9 && s.launched >= 1" },
      // A skill shot: the ball has dropped into the flashing letter.
      { name: "skill-shot", pick: "(s) => s.skills > 0 && s.tick - s.skillAt === 14" },
      // A ball riding a ramp (and the lock lit or a combo on).
      { name: "ramp-ride", pick: "(s) => s.ride === 1 && s.rideT === 26 && s.ramps >= 2" },
      { name: "lock-lit", pick: "(s) => s.lockLit && s.locked >= 1 && s.live && !s.ride && s.y < 600 * 256" },
      // Multiball: three balls out, the jackpot lit.
      { name: "multiball", pick: "(s) => s.extras.length >= 2 && s.tick < s.mbUntil && s.tick - (s.mbUntil - 1200) === 110" },
      { name: "jackpot", pick: "(s) => s.jackpots > 0 && s.tick - s.jackpotAt === 10" },
      { name: "joulz", pick: "(s) => s.laneSets > 0 && s.tick - s.joulzAt === 12" },
    ],
  },
};

async function shoot(page: Page, key: string): Promise<void> {
  const g = GAMES[key]!;
  await open(page, g.type);
  for (const m of g.moments) {
    const found = await page.evaluate(
      async ({ g, pick }) => {
        const sim = await import(/* @vite-ignore */ g.sim);
        const art = await import(/* @vite-ignore */ g.art);
        const { Human } = await import(/* @vite-ignore */ "/scripts/arcade-skill-bands/human.ts");
        const { bot } = await import(/* @vite-ignore */ `/scripts/arcade-skill-bands/bots/${g.type}.ts`);
        const game = sim[g.game];
        const test = new Function(`return ${pick}`)() as (s: unknown, p: Record<string, number>) => boolean;
        // The first of a few seeds whose run has the moment.
        let states: unknown[] = [];
        let at = -1;
        for (let k = 0; k < 12 && at < 0; k++) {
          const seed = g.seed + k * 7919;
          const human = new Human(g.type, seed, g.level);
          const out = bot({ game, seed, rev: null, human });
          const taps = new Set<number>(out.taps ?? []);
          const events = new Map<number, unknown>((out.events ?? []).map((e: { t: number }) => [e.t, e]));
          states = [];
          let s = game.init(seed);
          states.push(s);
          while (!game.isOver(s) && s.tick < game.runTicks) {
            const t = s.tick + 1;
            s = game.step(s, out.taps ? taps.has(t) : (events.get(t) ?? null));
            states.push(s);
          }
          const memo: Record<string, number> = {};
          for (let i = 0; i < states.length; i++) {
            const st = states[i] as { placed?: number; tick: number };
            const prev = states[i - 1] as { placed?: number } | undefined;
            if (prev && st.placed !== undefined && st.placed !== prev.placed) memo.lastDrop = st.tick;
            if (test(st, memo)) {
              at = i;
              break;
            }
          }
        }
        if (at < 0) return false;
        const canvas = document.querySelector("[data-game-stage] canvas.puzzle-board") as HTMLCanvasElement;
        const ctx = canvas.getContext("2d")!;
        const ratio = canvas.width / canvas.clientWidth;
        const size = { width: canvas.clientWidth, height: canvas.clientHeight };
        for (let i = Math.max(0, at - 150); i <= at; i++) {
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
          art[g.draw](ctx, states[i], size);
        }
        return true;
      },
      { g, pick: m.pick },
    );
    if (!found) {
      console.log(`${key}: no "${m.name}" moment in the run`);
      continue;
    }
    await page.waitForTimeout(60);
    const file = join(OUT, `${key}-414x896-${m.name}.png`);
    await page.screenshot({ path: file });
    console.log(`wrote ${file}`);
  }
}

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
try {
  for (const key of ONLY.length ? ONLY : Object.keys(GAMES)) {
    const context = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log(`[page] ${e.message}`));
    await shoot(page, key);
    await context.close();
  }
} finally {
  await browser.close();
}
