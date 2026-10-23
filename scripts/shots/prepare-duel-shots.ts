/**
 * Review screenshots of Prepare to Duel (Prompt Q, 23 Oct 2026; a design tool, not a check): the room's
 * real DuelStart through scripts/safe-area-harness.tsx as an iPhone 11 home-screen app (414 × 896),
 * once mid-strike (the page clock is stepped a frame at a time until a bolt is on the canvas, then held)
 * and once with prefers-reduced-motion (no strikes, the logo's static glow).
 *
 *   bun scripts/shots/prepare-duel-shots.ts [--out=screenshots/prepare-duel-oct-2026]
 */
import { existsSync, mkdirSync } from "node:fs";

import { chromium, type Page } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { DEVICE_INIT, IPHONE11_APP, emulateDevice } from "../device-emulation";
import { ONBOARDING_KEY } from "../../src/lib/onboarding";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/prepare-duel-oct-2026";
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
mkdirSync(OUT, { recursive: true });

function room(startedAt: number) {
  const iso = (ms: number) => new Date(ms).toISOString();
  const player = (slot: number) => ({
    id: `p${slot}`, duel_id: "duel-prep", player_slot: slot, display_name: `Player ${slot}`, user_id: `u${slot}`,
    ready_round: 1, intro_ready_round: 0, muted_by_host: false, last_reaction_at: null, last_seen_at: iso(startedAt),
    status: "active", joined_at: iso(startedAt - 60_000),
  });
  return {
    duel: {
      id: "duel-prep", room_code: "SAFE", status: "in_progress", selected_categories: [], tournament_history: [],
      disbanded_at: null, host_user_id: "u1", max_players: 10, round_count: 1, round_order: ["reaction"], no_maths: false,
      puzzles_public: [], current_round: 1, phase: "starting", phase_started_at: iso(startedAt),
      round_started_at: iso(startedAt), next_duel_id: null, created_at: iso(startedAt - 60_000),
    },
    players: [player(1), player(2)],
    results: [],
  };
}

const lit = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>("[data-prepare-lightning]");
    if (!c || !c.width) return 0;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 64) if (d[i]! > 200) n++;
    return n;
  });

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-prepare-shots", buildId: "prepare-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const reduced of [false, true]) {
    const context = await browser.newContext({
      viewport: { width: IPHONE11_APP.w, height: IPHONE11_APP.h },
      deviceScaleFactor: 2,
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await context.addInitScript(DEVICE_INIT);
    // The phase starts well after the load (DuelStart is up, the logo still tiny); once the page is
    // up its clock is held and the phase restarted 3.4 s before it: the logo has grown, strikes are under way.
    await context.addInitScript(
      (r) => {
        (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room: r.room };
        localStorage.setItem(r.key, "1");
      },
      { room: room(Date.now() + 600_000), key: ONBOARDING_KEY },
    );
    const page = await context.newPage();
    await page.clock.install();
    await page.goto(`${server.origin}/safe-area.html?mode=room`, { timeout: 180_000 });
    await page.locator(".duel-start-screen").waitFor({ timeout: 120_000 });
    await emulateDevice(page, IPHONE11_APP);
    const now = await page.evaluate(() => Date.now());
    await page.clock.pauseAt(now + 500);
    await page.evaluate((at) => {
      const h = (window as unknown as { __harness: { update: (f: (r: { duel: { phase_started_at: string } }) => void) => void } }).__harness;
      h.update((r) => {
        r.duel.phase_started_at = new Date(at).toISOString();
      });
    }, now + 500 - 3_400);
    await page.clock.runFor(100);
    let found = reduced;
    for (let step = 0; !found && step < 200; step++) {
      await page.clock.runFor(16);
      found = (await lit(page)) > 20;
    }
    if (!reduced && !found) throw new Error("no strike caught");
    if (reduced) await page.clock.runFor(200);
    const file = `${OUT}/prepare-to-duel-414x896-${reduced ? "reduced-motion" : "mid-strike"}.png`;
    await page.screenshot({ path: file });
    console.log(`wrote ${file}${reduced ? ` (lightning canvas: ${await page.locator("[data-prepare-lightning]").count()})` : ""}`);
    await context.close();
  }
} finally {
  await browser.close();
  await server.close();
}
