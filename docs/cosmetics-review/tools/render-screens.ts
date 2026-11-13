/**
 * Cosmetics review (13 Nov 2026), a tool, not a check; adapted from scripts/shots/shop-shots.ts. The shop's review screenshots (wave 2, session D1): the real /shop page on the app's dev server, against the real
 * server functions and every migration on a local PostgreSQL (scripts/server-fn-harness.ts), as a tester with coins:
 * Featured, Daily, Coins, the bundle sheet, a confirmation, the bought state, and an under-18 tester's Coins. A tool,
 * not a check (shop-check proves the rules).
 *
 *   bun scripts/shots/render-screens.ts [--out=docs/cosmetics-review/png/screens] [--sizes=390x844,375x667]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";

import type { Browser, Page } from "playwright";

import { ANON_KEY, postgresBin, SERVICE_KEY, startLocalDb, startRestServer, type LocalDb, type RestServer } from "../../../scripts/server-fn-harness";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "docs/cosmetics-review/png/screens";
const SIZES = (process.argv.find((a) => a.startsWith("--sizes="))?.slice(8) ?? "390x844,1440x900").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (p): p is string => Boolean(p && existsSync(p)),
);

if (!postgresBin()) {
  console.log("render-screens: no PostgreSQL binaries");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

let db: LocalDb | null = null;
let rest: RestServer | null = null;
let proc: ChildProcess | null = null;
let browser: Browser | null = null;
try {
  db = startLocalDb("render-screens-");
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
console.log(`render-screens: written to ${OUT}`);
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
  const all = q("SELECT string_agg(id, ',') FROM public.catalogue_items").split(",");
  let n = 0;
  for (const [w, h] of SIZES) {
    const desktop = w >= 1024;
    const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: !desktop, deviceScaleFactor: desktop ? 1 : 2, reducedMotion: "reduce" });
    await context.addInitScript(() => {
      try {
        localStorage.setItem("duelz-terms:v1", JSON.stringify({ version: 1, agreedAt: "2026-10-20T12:00:00.000Z" }));
        localStorage.setItem("duelz-onboarding:v1", "1");
        localStorage.setItem("duelz_onboarding_seen", "1");
      } catch {
        /* ignore */
      }
      for (const k of ["__DUELZ_ALLOW_SHOP__", "__DUELZ_ALLOW_PASS__", "__DUELZ_ALLOW_BADGES__", "__DUELZ_ALLOW_SEASONS__", "__DUELZ_ALLOW_TOURNAMENTS__"]) (window as unknown as Record<string, boolean>)[k] = true;
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
    const name = `SkyRacer${n}`;
    q(`UPDATE auth.users SET is_anonymous = false, email = '${name.toLowerCase()}@example.com' WHERE id = '${id}'`);
    q(`SELECT public.create_profile('${id}', '${name}', 4::smallint, DATE '1990-04-04', 'GB')`);
    q(`SELECT shop.add_tester('${name}', 'review')`);
    q(`SELECT economy.grant_coins('${name}', 9000, 'review')`);
    for (const item of all) q(`SELECT economy.grant_item('${name}', '${item}', 'review')`);
    const equip = (slot: string, item: string) => q(`SELECT public.economy_equip('${id}', '${slot}', '${item}')`);
    equip("card-art", "card-art.neon-city");
    equip("frame", "frame.gold");
    equip("name-colour", "name-colour.prism");
    try { q("SELECT pass.start_test_season('review')"); } catch (e) { console.log(`  pass: ${String(e).slice(0, 120)}`); }
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
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${label}-${w}x${h}.png`, fullPage: !desktop });
      console.log(`  ${label}-${w}x${h}`);
    };
    const visit = async (url: string, label: string, wait?: string) => {
      try {
        await page.goto(`${origin}${url}`, { waitUntil: "load" });
        if (wait) await page.waitForSelector(wait, { timeout: 60_000 });
        await snap(label);
      } catch (err) {
        console.log(`  ${label}: ${String(err).split("\n")[0]}`);
        await snap(`${label}-incomplete`);
      }
    };
    await visit("/profile", "profile", "[data-profile-card='account']");
    for (const tab of ["avatar", "card", "games", "badges"]) {
      await visit("/customise", `customise-${tab}`, "[data-customise-tab]");
      await page.click(`[data-customise-tab='${tab}']`).catch(() => undefined);
      await snap(`customise-${tab}`);
    }
    await visit("/shop?part=shop&section=featured", "shop-featured", "[data-shop-today]");
    await visit("/shop?part=shop&section=daily", "shop-daily", "[data-shop-today]");
    await visit("/shop?part=pass", "shop-pass");
    await visit("/shop?part=plus", "shop-plus");
    await visit("/practice", "practice");
    await context.close();
  }
}
