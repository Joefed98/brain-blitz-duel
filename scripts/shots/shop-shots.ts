/**
 * The shop's review screenshots (wave 2, session D1): the real /shop page on the app's dev server, against the real
 * server functions and every migration on a local PostgreSQL (scripts/server-fn-harness.ts), as a tester with coins:
 * Featured, Daily, Coins, the bundle sheet, a confirmation, the bought state, and an under-18 tester's Coins. A tool,
 * not a check (shop-check proves the rules).
 *
 *   bun scripts/shots/shop-shots.ts [--out=screenshots/shop-nov-2026] [--sizes=390x844,375x667]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

import type { Browser, Page } from "playwright";

import { ANON_KEY, postgresBin, SERVICE_KEY, startLocalDb, startRestServer, type LocalDb, type RestServer } from "../server-fn-harness";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/shop-nov-2026";
const SIZES = (process.argv.find((a) => a.startsWith("--sizes="))?.slice(8) ?? "390x844,375x667").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (p): p is string => Boolean(p && existsSync(p)),
);

if (!postgresBin()) {
  console.log("shop-shots: no PostgreSQL binaries");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

let db: LocalDb | null = null;
let rest: RestServer | null = null;
let proc: ChildProcess | null = null;
let browser: Browser | null = null;
try {
  db = startLocalDb("shop-shots-");
  if (db.failed) throw new Error(`migrations: ${db.failed.file}`);
  rest = await startRestServer(db.socketDir);
  const origin = await startDevServer(rest.url);
  const { chromium } = await import("playwright");
  browser = await chromium.launch({ executablePath: CHROMIUM });
  await shots(browser, origin, db);
} finally {
  await browser?.close().catch(() => undefined);
  if (proc?.pid) {
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      /* gone */
    }
  }
  await rest?.stop();
  db?.stop();
}
console.log(`shop-shots: written to ${OUT}`);
process.exit(0);

async function startDevServer(restUrl: string): Promise<string> {
  const port = 5600 + Math.floor(Math.random() * 300);
  proc = spawn("npx", ["vite", "dev", "--port", String(port), "--host", "127.0.0.1", "--strictPort"], {
    stdio: "ignore",
    detached: true,
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env["NODE_OPTIONS"] ?? ""} --max-old-space-size=4096`.trim(),
      VITE_SUPABASE_URL: restUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
      SUPABASE_URL: restUrl,
      SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    },
  });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 180; i++) {
    try {
      if ((await fetch(`${origin}/terms`)).ok) return origin;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

async function shots(browser: Browser, origin: string, db: LocalDb): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  let n = 0;
  for (const [w, h] of SIZES) {
    for (const who of ["adult", "teen"] as const) {
      if (who === "teen" && w !== SIZES[0]![0]) continue;
      const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, deviceScaleFactor: 2 });
      await context.addInitScript(() => {
        try {
          localStorage.setItem("duelz-terms:v1", JSON.stringify({ version: 1, agreedAt: "2026-10-20T12:00:00.000Z" }));
          localStorage.setItem("duelz-onboarding:v1", "1");
          localStorage.setItem("duelz_onboarding_seen", "1");
        } catch {
          /* ignore */
        }
        (window as unknown as { __DUELZ_ALLOW_SHOP__: boolean }).__DUELZ_ALLOW_SHOP__ = true;
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => console.log(`  page error: ${e.message.split("\n")[0]}`));
      await page.goto(`${origin}/profile`, { timeout: 180_000, waitUntil: "load" });
      let id: string | null = null;
      for (let i = 0; i < 120 && !id; i++) {
        id = await page.evaluate(() => {
          for (let k = 0; k < localStorage.length; k++) {
            const key = localStorage.key(k)!;
            if (/^sb-.*-auth-token$/.test(key)) return (JSON.parse(localStorage.getItem(key)!) as { user?: { id?: string } }).user?.id ?? null;
          }
          return null;
        });
        if (!id) await page.waitForTimeout(500);
      }
      if (!id) throw new Error("no device session");
      n++;
      const name = `Shopper_${n}`;
      const dob = who === "adult" ? "1990-04-04" : "2010-04-04";
      q(`UPDATE auth.users SET is_anonymous = false, email = '${name.toLowerCase()}@example.com' WHERE id = '${id}'`);
      q(`SELECT public.create_profile('${id}', '${name}', 4::smallint, DATE '${dob}', 'GB')`);
      q(`SELECT shop.add_tester('${name}', 'shots')`);
      q(`SELECT economy.grant_coins('${name}', 6200, 'shots')`);
      // The device's stored session still says anonymous: mark it as the account it now is (as a sign-up's refresh would).
      await page.evaluate(() => {
        for (let k = 0; k < localStorage.length; k++) {
          const key = localStorage.key(k)!;
          if (!/^sb-.*-auth-token$/.test(key)) continue;
          const s = JSON.parse(localStorage.getItem(key)!) as { user: { is_anonymous: boolean } };
          s.user.is_anonymous = false;
          localStorage.setItem(key, JSON.stringify(s));
        }
      });
      const snap = async (label: string) => {
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${OUT}/${label}-${w}x${h}.png`, fullPage: label.startsWith("shop-") });
      };
      await page.goto(`${origin}/shop?part=shop&section=featured`, { waitUntil: "load" });
      try {
        await page.waitForSelector("[data-shop-today]", { timeout: 120_000 });
      } catch (err) {
        await page.screenshot({ path: `${OUT}/debug-${w}x${h}.png` });
        console.log(`  no shop at ${page.url()}: ${(await page.evaluate(() => document.body.innerText)).slice(0, 300)}`);
        throw err;
      }
      if (who === "teen") {
        await page.click("[data-shop-section='coins']");
        await page.waitForSelector("[data-shop-pack-age]");
        await snap("shop-coins-under18");
        await context.close();
        continue;
      }
      await snap("shop-featured");
      await page.click("[data-shop-section='daily']");
      await page.waitForSelector("[data-shop-front='daily'] [data-shop-today]");
      await snap("shop-daily");
      await page.click("[data-shop-section='coins']");
      await page.waitForSelector("[data-shop-packs]");
      await snap("shop-coins");
      await page.click("[data-shop-section='featured']");
      await page.waitForSelector("[data-shop-view-bundle]");
      await page.click("[data-shop-view-bundle]");
      await page.waitForSelector("[data-shop-bundle-sheet]");
      await snap("sheet-bundle");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      const first = page.locator("[data-shop-item] .shop-item-face").first();
      await first.click();
      await page.waitForSelector("[data-shop-confirm-line]");
      await snap("sheet-confirm");
      await page.click("[data-shop-buy]");
      await page.waitForSelector("[data-shop-said]");
      await snap("shop-bought");
      await context.close();
    }
  }
}
