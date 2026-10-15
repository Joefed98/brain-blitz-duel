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
 * Since 15 Oct 2026 (arcade play screen) the engine games on the arcade stage draw in the
 * same slot (Tenfall, Pull!, Bonk, Mixed Signals), so their taps are proved here too.
 *
 * Arena scenes (15 Oct 2026): for the ten ARENA_SCENE_GAMES it also taps, long-presses and
 * drags in the scene below the world (390x844, a 47 px notch and 34 px home bar emulated)
 * and proves nothing is recorded: the scene takes no touches.
 *
 *   bun scripts/arcade-input-identity-proof.ts [--url=http://127.0.0.1:5173] [--no-scene] [games...]
 */
import { spawn, type ChildProcess } from "node:child_process";

import { ARCADE_FX_SPECS } from "../src/lib/arcade/arcadeFxGames.renderer";
import { TD_H, TD_W } from "../src/lib/arcade/tenDrop";
import { CLAY_H, CLAY_W } from "../src/lib/arcade/clayShoot";
import { CLASH_WORLD_H, CLASH_WORLD_W } from "../src/lib/arcade/colourClash";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { ARENA_SCENE_GAMES } from "../src/lib/arcade/arenaScene.renderer";

const args = process.argv.slice(2);
const URL_ARG = args.find((a) => a.startsWith("--url="))?.slice(6);
const ONLY = args.filter((a) => !a.startsWith("--"));
const SCENE = !args.includes("--no-scene");
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5183;
const VIEWPORTS: [number, number][] = [[375, 667], [430, 932], [1280, 800]];

/** World (view) sizes of the engine games in the shared slot; Bonk's world is its square board (0–1). */
const ENGINE_WORLDS: Record<string, { width: number; height: number }> = {
  tendrop: { width: TD_W, height: TD_H },
  clayshoot: { width: CLAY_W, height: CLAY_H },
  stroop: { width: CLASH_WORLD_W, height: CLASH_WORLD_H },
  whack: { width: 1, height: 1 },
};

type Step = { kind: "down" | "move" | "up"; x: number; y: number } | { kind: "wait"; ms: number };
const tap = (x: number, y: number, waitAfter = 300): Step[] => [
  { kind: "down", x, y }, { kind: "wait", ms: 60 }, { kind: "up", x, y }, { kind: "wait", ms: waitAfter },
];
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
  // Engine games (15 Oct 2026): Tenfall's column taps (tdView), Pull!'s shots (clayTapWorld),
  // Mixed Signals' lane taps (the shared stage), Bonk's hole taps (gridCellAt on the board).
  tendrop: [...tap(45, 200), ...tap(135, 260), ...tap(225, 320), ...tap(315, 380)],
  clayshoot: [...tap(60, 80), ...tap(180, 200), ...tap(300, 320)],
  stroop: [...tap(65, 300, 500), ...tap(195, 300, 500), ...tap(325, 300, 500)],
  whack: [...tap(0.125, 0.125), ...tap(0.625, 0.375), ...tap(0.875, 0.875)],
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
  const spec = ({ ...(ARCADE_FX_SPECS as Record<string, { width: number; height: number }>), ...ENGINE_WORLDS })[game]!;
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

/** Opens a game's live practice round at w x h with recordInput instrumented (as run does). */
async function openLive(browser: import("playwright").Browser, origin: string, game: string, [w, h]: [number, number]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.route(/\/src\/lib\/arcade\/engine\.ts(\?.*)?$/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({ response, body: body.replace("log.push(recorded);", `log.push(recorded); ${INSTRUMENT}`) });
  });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { top: 47, bottom: 34, left: 0, right: 0 } } as never);
  await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
  const button = page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first();
  await button.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await button.click();
  const ready = page.getByRole("button", { name: /^Ready/ });
  await ready.waitFor({ timeout: 60_000 });
  await ready.click();
  await page.locator("[data-game-region] [data-arena-slot] > [data-game-arena]").first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(800);
  return page;
}

/** Taps, a long press and drags in the arena scene below the world: nothing may be recorded. */
async function sceneRun(browser: import("playwright").Browser, origin: string, game: string) {
  const page = await openLive(browser, origin, game, [390, 844]);
  try {
    const log = () => page.evaluate(() => ((globalThis as { __inputLog?: unknown[] }).__inputLog ?? []).length);
    const clear = () => page.evaluate(() => { (globalThis as { __inputLog?: unknown[] }).__inputLog = []; });
    const slot = (await page.locator("[data-game-region] [data-arena-slot]").first().boundingBox())!;
    const arena = (await page.locator("[data-game-region] [data-arena-slot] > [data-game-arena]").first().boundingBox())!;
    const scene = await page.locator("[data-game-region] [data-arena-slot] > [data-arena-scene]").first().boundingBox();
    const top = arena.y + arena.height + 3, bottom = slot.y + slot.height - 3;
    // Control: the same time with no touches (a game recording on its own would show here).
    await clear();
    await page.waitForTimeout(2600);
    const idle = await log();
    await clear();
    const ys = [top, (top + bottom) / 2, bottom];
    for (const y of ys)
      for (const fx of [0.1, 0.5, 0.9]) {
        await page.mouse.move(slot.x + slot.width * fx, y);
        await page.mouse.down();
        await page.waitForTimeout(60);
        await page.mouse.up();
        await page.waitForTimeout(120);
      }
    await page.mouse.move(slot.x + slot.width / 2, ys[1]!);
    await page.mouse.down();
    await page.waitForTimeout(500);
    await page.mouse.up();
    for (const [x0, x1] of [[0.1, 0.9], [0.9, 0.1]]) {
      await page.mouse.move(slot.x + slot.width * x0!, ys[1]!);
      await page.mouse.down();
      for (let k = 1; k <= 8; k++) {
        await page.mouse.move(slot.x + slot.width * (x0! + ((x1! - x0!) * k) / 8), ys[1]! + (k % 2 ? -6 : 6));
        await page.waitForTimeout(40);
      }
      await page.mouse.up();
      await page.waitForTimeout(150);
    }
    await page.waitForTimeout(300);
    const touched = await log();
    return { slot, arena, scene, band: bottom - top + 6, idle, touched };
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
  let sceneFailed = 0;
  const sceneGames = SCENE ? ARENA_SCENE_GAMES.filter((g) => ONLY.length === 0 || ONLY.includes(g)) : [];
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
    for (const game of sceneGames) {
      const r = await sceneRun(browser, origin, game);
      const ok = r.scene !== null && r.band > 20 && r.touched === 0 && r.idle === 0;
      if (!ok) sceneFailed++;
      console.log(`${ok ? "PASS" : "FAIL"} ${game.padEnd(10)} scene below the world (${r.band.toFixed(0)} px band, scene ${r.scene ? `${r.scene.width.toFixed(0)}x${r.scene.height.toFixed(0)}` : "missing"}): 9 taps, a long press and 2 drags recorded ${r.touched} inputs (idle control ${r.idle})`);
    }
  } finally {
    await browser.close();
    if (proc?.pid) try { process.kill(-proc.pid); } catch { /* already gone */ }
  }
  if (sceneFailed) {
    console.log(`FAIL: ${sceneFailed} of ${sceneGames.length} games recorded input from a touch in the arena scene`);
    process.exit(1);
  }
  if (failed) {
    console.log(`FAIL: ${failed} of ${games.length} games recorded different inputs at different sizes`);
    process.exit(1);
  }
  console.log(`PASS input identity: ${games.length} games record the same input payloads at ${VIEWPORTS.map((v) => v.join("x")).join(", ")}${sceneGames.length ? `; touches in the arena scene of ${sceneGames.length} games record nothing` : ""}`);
}

await main();
