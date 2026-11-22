/**
 * Tap sizes on Counterweight's notches and Operator's answer gaps (22 Nov 2026; a measuring tool, not a check).
 *
 * Headless Chromium on a `vite dev` server (or `--url`), the real practice flow: each level chosen through the device's
 * level choice (`duelz-levels:v1`), each round dealt by the server, Ready, then measured at 375×667 and 390×844 (touch).
 * Counterweight: every notch of the scale shown (a notch's width depends only on how many the scale has). Operator:
 * every answer gap of every equation, each reached through its chip; a gap's size is the smaller of its width and height.
 * Prints the smallest per game, level, notch count and size, and fails (exit 1) on anything under 36 px.
 *
 *   bun scripts/shots/tap-sizes.ts [--games=balance,equation] [--levels=…] [--deals=4] [--shots=<dir>]
 *     [--record=<file> | --replay=<file>] [--url=<origin>]
 *
 * `--shots` saves the 375×667 frame of each game and level's first deal (Operator: each equation). `--record` keeps the
 * server's deals in a file and `--replay` serves them again, so a run on another tree (main in a worktree, for the
 * before-and-after sheets) measures and draws the same boards.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Page } from "playwright";

import { levelsOf } from "../../src/lib/levels/gameLevels";
import type { Level } from "../../src/lib/levels/levels";
import { practiceGameUrl } from "../practice-side-lib";

const MIN_PX = 36;
const SIZES: [number, number][] = [
  [375, 667],
  [390, 844],
];
const PORT = 5296;
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DEALS = Number(arg("deals") ?? 4);
const SHOTS = arg("shots");
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
type Game = "balance" | "equation";
const GAMES = (arg("games")?.split(",") ?? ["balance", "equation"]) as Game[];
const LEVELS = arg("levels")?.split(",");
const RECORD = arg("record");
const REPLAY = arg("replay");
/** Each deal's server reply, by game, level and deal number (`--record` / `--replay`). */
const deals: Record<string, { status: number; contentType: string; body: string }> =
  REPLAY && existsSync(REPLAY) ? JSON.parse(readFileSync(REPLAY, "utf8")) : {};
if (REPLAY && !Object.keys(deals).length) throw new Error(`--replay: no deals in ${REPLAY}`);

/** A server function's name from its URL (the id is base64). */
function serverFnName(url: string): string {
  const id = url.split("/_serverFn/")[1]?.split("?")[0] ?? "";
  try {
    return Buffer.from(decodeURIComponent(id), "base64").toString("utf8");
  } catch {
    return id;
  }
}

async function startServer(): Promise<{ origin: string; proc: ChildProcess | null }> {
  const url = arg("url");
  if (url) return { origin: url.replace(/\/$/, ""), proc: null };
  const proc = spawn("npx", ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], {
    stdio: "ignore",
    detached: true,
    env: { ...process.env, NODE_OPTIONS: `${process.env["NODE_OPTIONS"] ?? ""} --max-old-space-size=5120`.trim() },
  });
  const origin = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${origin}/practice`)).ok) return { origin, proc };
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

interface Seen {
  ok: boolean;
  pegs: number;
  line: string;
  sizes: { w: number; h: number }[];
}

function probe(game: string): Seen {
  const root = document.querySelector("[data-puzzle-play]") ?? document;
  const targets = [...root.querySelectorAll<HTMLElement>(game === "balance" ? ".balance-notch" : ".opg-equation .opg-gap")];
  return {
    ok: targets.length > 0,
    pegs: game === "balance" ? targets.length : 0,
    line: (root.querySelector(".opg-equation")?.textContent ?? "").replace(/\s+/g, " ").trim(),
    sizes: targets.map((t) => {
      const r = t.getBoundingClientRect();
      return { w: r.width, h: r.height };
    }),
  };
}

const failures: string[] = [];
const missing = new Set<string>();
const worst = new Map<string, { px: number; where: string }>();
const { origin, proc } = await startServer();
const browser = await chromium
  .launch({ executablePath: process.env["PLAYWRIGHT_CHROMIUM"] ?? "/opt/pw-browsers/chromium" })
  .catch((e: unknown) => {
    if (proc?.pid) process.kill(-proc.pid);
    throw e;
  });
try {
  // Warm the cold dev server once per game, unmeasured: the first practice page compiles the app and the game's chunk.
  for (const game of GAMES) {
    const context = await browser.newContext({ viewport: { width: SIZES[0]![0], height: SIZES[0]![1] }, hasTouch: true });
    const page = await context.newPage();
    try {
      await page.goto(practiceGameUrl(origin, game), { waitUntil: "domcontentloaded", timeout: 180_000 });
      await page.getByRole("button", { name: /^Ready/ }).first().waitFor({ timeout: 180_000 });
    } catch {
      /* measured below, where a failure is reported */
    }
    await context.close();
  }
  for (const game of GAMES) {
    for (const level of (levelsOf(game) as Level[]).filter((l) => !LEVELS || LEVELS.includes(l))) {
      for (let d = 1; d <= DEALS; d++) {
        const [w0, h0] = SIZES[0]!;
        const context = await browser.newContext({ viewport: { width: w0, height: h0 }, hasTouch: true, isMobile: true });
        await context.addInitScript(
          ([g, l]) => {
            try {
              localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: "normal", games: { [g as string]: l } }));
            } catch {
              /* private mode */
            }
          },
          [game, level] as const,
        );
        const page: Page = await context.newPage();
        const name = `${game} ${level} deal ${d}`;
        const dealKey = `${game}:${level}:${d}`;
        if (RECORD || REPLAY)
          await page.route("**/_serverFn/**", async (route) => {
            if (!/practiceGenerate/.test(serverFnName(route.request().url()))) return route.continue();
            const kept = deals[dealKey];
            if (REPLAY) {
              // A deal missing from the record (its run failed there) is dealt afresh and named in the report.
              if (!kept) {
                missing.add(dealKey);
                return route.continue();
              }
              return route.fulfill({ status: kept.status, contentType: kept.contentType, body: kept.body });
            }
            const res = await route.fetch();
            const body = await res.text();
            deals[dealKey] = { status: res.status(), contentType: res.headers()["content-type"] ?? "application/json", body };
            return route.fulfill({ response: res, body });
          });
        try {
          await page.goto(practiceGameUrl(origin, game), { waitUntil: "domcontentloaded", timeout: 120_000 });
          await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 120_000 });
          await page.locator("[data-game-stage]").first().waitFor({ timeout: 60_000 });
          await page.waitForTimeout(1500);
        } catch (e) {
          failures.push(`${name}: harness: ${String((e as Error).message ?? e).split("\n")[0]}`);
          await context.close();
          continue;
        }
        for (const [w, h] of SIZES) {
          if (w !== w0 || h !== h0) {
            await page.setViewportSize({ width: w, height: h });
            await page.waitForTimeout(600);
          }
          const chips = game === "equation" ? await page.locator("[data-puzzle-play] [data-stage-chip]").count() : 0;
          for (let k = 0; k < Math.max(1, chips); k++) {
            if (chips > 0) {
              const chip = page.locator(`[data-puzzle-play] [data-stage-chip="${k}"]`);
              if (await chip.isEnabled()) {
                await chip.click();
                await page.waitForTimeout(500);
              }
            }
            const s = await page.evaluate(probe, game);
            const where = `${name}${game === "equation" ? `, line ${k + 1} "${s.line}"` : ` (${s.pegs} notches)`} at ${w}×${h}`;
            if (!s.ok) {
              failures.push(`${where}: no targets found`);
              continue;
            }
            const small = Math.min(...s.sizes.map((t) => Math.min(t.w, t.h)));
            const key = `${game} ${level}${game === "balance" ? ` ${s.pegs} notches` : ""} ${w}×${h}`;
            const prev = worst.get(key);
            if (!prev || small < prev.px) worst.set(key, { px: small, where });
            if (SHOTS && w === w0 && d === 1)
              await page.screenshot({ path: join(SHOTS, `${game}-${level}${game === "equation" ? `-line${k + 1}` : ""}.png`) });
            if (small < MIN_PX - 0.01) failures.push(`${where}: smallest target ${small.toFixed(1)} px`);
          }
          if (chips > 0) {
            const chip = page.locator(`[data-puzzle-play] [data-stage-chip="0"]`);
            if (await chip.isEnabled()) await chip.click();
            await page.waitForTimeout(300);
          }
        }
        await context.close();
      }
    }
  }
} finally {
  if (RECORD) writeFileSync(RECORD, JSON.stringify(deals));
  await browser.close();
  if (proc?.pid) {
    try {
      process.kill(-proc.pid);
    } catch {
      /* gone */
    }
  }
}

for (const [key, { px, where }] of [...worst].sort()) console.log(`  ${key}: smallest ${px.toFixed(1)} px (${where})`);
if (missing.size) console.log(`  dealt afresh (not in ${REPLAY}): ${[...missing].join(", ")}`);
if (failures.length) {
  for (const f of failures) console.log(`  under ${MIN_PX} px: ${f}`);
  console.log(`FAIL: tap-sizes: ${failures.length} under ${MIN_PX} px or not measured`);
  process.exit(1);
}
console.log(`PASS: tap-sizes: every notch and answer gap at least ${MIN_PX} px at ${SIZES.map(([w, h]) => `${w}×${h}`).join(" and ")}`);
process.exit(0);
