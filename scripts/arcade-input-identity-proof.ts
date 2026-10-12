/**
 * Arcade input identity proof (run on demand; not a routine check, it needs Chromium).
 *
 * The fitted arena (ArcadeArenaSlot) changes only how large the world is drawn. This
 * proves the input side: the same gesture, given in world coordinates and placed on
 * screen through the arena box at very different scales, records exactly the same
 * input payloads (k, a, b, c, d) at every viewport, so input logs, server replays and
 * scores cannot depend on the phone.
 *
 * The engine's recordInput is observed by rewriting the dev server's module response
 * in the browser (test-only instrumentation; app code is untouched). Gestures move in
 * single steps with a pause of several sim ticks, so each point is sampled once.
 *
 *   bun scripts/arcade-input-identity-proof.ts [--url=http://127.0.0.1:5173] [games...]
 */
import { spawn, type ChildProcess } from "node:child_process";

import { ARCADE_FX_SPECS } from "../src/lib/arcade/arcadeFxGames.renderer";
import { gameDisplayName } from "../src/lib/duel/gameNames";

const args = process.argv.slice(2);
const URL_ARG = args.find((a) => a.startsWith("--url="))?.slice(6);
const ONLY = args.filter((a) => !a.startsWith("--"));
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5183;
const VIEWPORTS: [number, number][] = [[375, 667], [430, 932], [1280, 800]];

type Step = { kind: "down" | "move" | "up"; x: number; y: number } | { kind: "wait"; ms: number };
const drag = (points: [number, number][], waitAfter = 400): Step[] => [
  { kind: "down", x: points[0]![0], y: points[0]![1] },
  { kind: "wait", ms: 90 },
  ...points.slice(1).flatMap(([x, y]): Step[] => [{ kind: "move", x, y }, { kind: "wait", ms: 90 }]),
  { kind: "up", x: points[points.length - 1]![0], y: points[points.length - 1]![1] },
  { kind: "wait", ms: waitAfter },
];

/** World-space gestures per game: the shared ArcadeCanvasStage path plus each own-transform family. */
const GESTURES: Record<string, Step[]> = {
  // ArcadeCanvasStage (shared by Fission, Wavefront, Orbit, Junction, Roofbound, Grappler, Tilt).
  inkbridge: [...drag([[90, 300], [130, 312], [170, 324], [210, 336], [250, 348]]), ...drag([[120, 420], [180, 410], [240, 400]])],
  // Fit transform (letterboxed before): a drag-and-release throw, twice.
  bintoss: [...drag([[195, 300], [180, 340], [160, 380], [150, 420]], 3500), ...drag([[195, 300], [205, 350], [215, 400]], 500)],
  // Stretch transform (distorted before): swipes across the board.
  slice: [...drag([[40, 300], [110, 310], [180, 320], [250, 330], [320, 340]]), ...drag([[60, 480], [160, 440], [260, 400]])],
  // Stretch transform with a camera offset. Its camera is an eased render-only follow on
  // the wall clock, so absolute x depends on when a swipe lands, never on screen size:
  // it is compared without the camera (each cut's y values and its x extent).
  snip: drag([[90, 200], [140, 210], [190, 220], [240, 230]]),
  // Fit transform (letterboxed before): a second drag-to-aim game, one dart.
  bullseye: drag([[195, 420], [185, 450], [175, 480], [170, 500]], 500),
};

const INSTRUMENT = "(globalThis.__inputLog ??= []).push(recorded);";

async function startServer(): Promise<{ origin: string; proc: ChildProcess | null }> {
  if (URL_ARG) return { origin: URL_ARG.replace(/\/$/, ""), proc: null };
  const proc = spawn("npx", ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore", detached: true });
  const origin = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${origin}/practice`)).ok) return { origin, proc };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

async function run(browser: import("playwright").Browser, origin: string, game: string, [w, h]: [number, number]) {
  const spec = (ARCADE_FX_SPECS as Record<string, { width: number; height: number }>)[game]!;
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.route(/\/src\/lib\/arcade\/engine\.ts(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    if (!body.includes("log.push(recorded);")) throw new Error("engine.ts: recordInput push not found");
    await route.fulfill({ response, body: body.replace("log.push(recorded);", `log.push(recorded); ${INSTRUMENT}`) });
  });
  try {
    await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first();
    await button.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    await button.click();
    const ready = page.getByRole("button", { name: /^Ready/ });
    await ready.waitFor({ timeout: 60_000 });
    await ready.click();
    const arenaLocator = page.locator("[data-game-region] [data-arena-slot] > [data-game-arena]").first();
    await arenaLocator.waitFor({ timeout: 10_000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => { (globalThis as { __inputLog?: unknown[] }).__inputLog = []; });
    const box = (await arenaLocator.boundingBox())!;
    const scale = box.width / spec.width;
    const at = (x: number, y: number) => [box.x + x * scale, box.y + y * scale] as const;
    for (const step of GESTURES[game]!) {
      if (step.kind === "wait") await page.waitForTimeout(step.ms);
      else {
        const [cx, cy] = at(step.x, step.y);
        await page.mouse.move(cx, cy);
        if (step.kind === "down") await page.mouse.down();
        if (step.kind === "up") await page.mouse.up();
      }
    }
    const log = (await page.evaluate(() => (globalThis as { __inputLog?: { k: number; a: number; b: number; c: number; d: number }[] }).__inputLog ?? [])) ?? [];
    const payload = (e: { k: number; a: number; b: number; c: number; d: number }) =>
      game === "snip" ? [e.k, `dx${e.c - e.a}`, e.b, e.d].join(",") : [e.k, e.a, e.b, e.c, e.d].join(",");
    return { scale, box, payloads: log.map(payload) };
  } finally {
    await page.close();
  }
}

async function main() {
  const { chromium } = await import("playwright");
  const games = Object.keys(GESTURES).filter((g) => ONLY.length === 0 || ONLY.includes(g));
  const { origin, proc } = await startServer();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  let failed = 0;
  try {
    for (const game of games) {
      const runs = [];
      for (const vp of VIEWPORTS) runs.push(await run(browser, origin, game, vp));
      const base = runs[0]!.payloads;
      const same = base.length > 0 && runs.every((r) => r.payloads.join("|") === base.join("|"));
      if (!same) failed++;
      const sizes = runs.map((r, i) => `${VIEWPORTS[i]!.join("x")}: ${r.box.width.toFixed(0)}x${r.box.height.toFixed(0)} (${r.scale.toFixed(3)}x)`).join(", ");
      console.log(`${same ? "PASS" : "FAIL"} ${game.padEnd(10)} ${base.length} recorded inputs identical across ${sizes}`);
      if (!same) runs.forEach((r, i) => console.log(`       ${VIEWPORTS[i]!.join("x")}: ${r.payloads.join(" | ") || "(none)"}`));
      else console.log(`       ${base.join(" | ")}`);
    }
  } finally {
    await browser.close();
    if (proc?.pid) try { process.kill(-proc.pid); } catch { /* already gone */ }
  }
  if (failed) {
    console.log(`FAIL: ${failed} of ${games.length} games recorded different inputs at different sizes`);
    process.exit(1);
  }
  console.log(`PASS input identity: ${games.length} games record the same input payloads at ${VIEWPORTS.map((v) => v.join("x")).join(", ")}`);
}

await main();
