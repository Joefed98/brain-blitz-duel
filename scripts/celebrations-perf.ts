/**
 * Celebrations at 4× CPU slowdown (Prompt P, 23 Oct 2026; a measuring tool, not a check): a room
 * played through its screens in the harness (lobby, the countdown to GO, a 150 reveal with the
 * hero run, standings counting up, the podium with the hero) as an iPhone 11 home-screen app, with
 * celebrations on and then off, each under CDP CPU throttling. Prints each screen's frames per
 * second and worst frame over its first 2.5 s, on vs off.
 *
 *   bun scripts/celebrations-perf.ts [--rate=4]
 */
import { existsSync } from "node:fs";

import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, openThemeScreen, room, type ThemeScreen, type ThemeViewport } from "./theme-screens";
import { IPHONE11_APP } from "./device-emulation";
import { INTRO_MS } from "../src/lib/duel/types";

const RATE = Number(process.argv.find((a) => a.startsWith("--rate="))?.slice(7) ?? 4);
const APP: ThemeViewport = { name: "414x896 home-screen app", w: IPHONE11_APP.w, h: IPHONE11_APP.h, app: true };
type Room = ReturnType<ReturnType<typeof room>>;
const tweak = (make: () => Room, change: (r: Room) => void) => () => {
  const r = make();
  change(r);
  return r;
};

const SCREENS: (ThemeScreen & { label: string })[] = [
  { label: "lobby, 10 players", name: "lobby", mode: "room", room: room("waiting", "starting", { players: 10 }), waitMs: 0 },
  {
    label: "countdown to GO",
    name: "go",
    mode: "room",
    room: tweak(room("in_progress", "intro"), (r) => {
      const start = new Date(Date.now() - (INTRO_MS - 1500)).toISOString();
      r.duel.phase_started_at = start;
      r.duel.round_started_at = start;
      r.results = [];
    }),
    waitMs: 0,
  },
  {
    label: "reveal 150 (hero run)",
    name: "reveal",
    mode: "room",
    room: tweak(room("in_progress", "result", { players: 4 }), (r) => {
      r.duel.phase = "reveal";
      r.results = r.results.map((row) => (row.player_slot === 1 ? { ...row, score: 150 } : row));
    }),
    waitMs: 0,
    plain: true,
  },
  {
    label: "standings, 10 players",
    name: "standings",
    mode: "room",
    room: tweak(room("in_progress", "standings", { players: 10, rounds: 2 }), (r) => {
      r.results = r.results.map((row) => (row.round_number === 2 ? { ...row, score: 40 + row.player_slot * 14 } : row));
    }),
    waitMs: 0,
  },
  { label: "podium, 10 players", name: "podium", mode: "room", room: room("finished", "result", { players: 10, rounds: 6 }), waitMs: 0 },
];

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-celebrations", buildId: "celebrations-perf" });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p) => p && existsSync(p)) });
const rows: string[] = [];
try {
  for (const screen of SCREENS) {
    const line: string[] = [screen.label.padEnd(24)];
    for (const on of [true, false]) {
      const { context, page } = await openThemeScreen(browser, server.origin, screen, APP, async (ctx) => {
        await ctx.addInitScript((on) => {
          const w = window as unknown as Record<string, unknown>;
          w.__DUELZ_BETA_CONFIG__ = { FX_CELEBRATIONS: on };
          // Frame times from the first frame, kept in a preallocated array.
          const times = new Float64Array(2000);
          let n = 0;
          let last = 0;
          w.__frames = () => Array.from(times.subarray(0, n));
          w.__frameReset = () => {
            n = 0;
            last = 0;
          };
          const tick = (t: number) => {
            if (last && n < times.length) times[n++] = t - last;
            last = t;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }, on);
      });
      // The screen's moment again, under throttling from its first frame (the load itself was not throttled).
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
      await page.evaluate(() => (window as unknown as { __frameReset: () => void }).__frameReset());
      if (on)
        await page.evaluate(`import("/src/lib/fx/celebrations.ts").then((C) => {
          const s = C.celebrationScope();
          const step = document.querySelector('[data-podium-step="1"]');
          if (step) { C.podiumHero(s, step); const b = step.getBoundingClientRect(); C.sparkBurst(s, b.right - 15, b.top - 26, { count: 44 }); C.showBanner(s, "You win!", { burst: true }); }
          else if (document.querySelector("[data-charge-meter]")) C.sparkBurstOn(s, document.querySelector(".charge-meter-track"), { row: true, count: 60 });
          else if (document.querySelector("[data-reveal-score]")) C.heroRun(s);
          else if (document.querySelector("ul li")) for (const li of document.querySelectorAll("ul li")) C.sparkBurstOn(s, li, { row: true, count: 16 });
          else C.goStrike();
        })`);
      await page.waitForTimeout(2500);
      const frames = await page.evaluate(() => (window as unknown as { __frames: () => number[] }).__frames());
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      await context.close();
      const avg = frames.reduce((a, b) => a + b, 0) / Math.max(1, frames.length);
      const worst = Math.max(...frames);
      line.push(`${on ? "on " : "off"} ${(1000 / avg).toFixed(1).padStart(5)} fps, worst ${worst.toFixed(0).padStart(4)} ms`);
    }
    rows.push(line.join("  |  "));
  }
} finally {
  await browser.close();
  await server.close();
}
console.log(`Celebrations at ${RATE}x CPU slowdown, 414x896 home-screen app, first 2.5 s of each moment:`);
for (const row of rows) console.log(`  ${row}`);
process.exit(0);
