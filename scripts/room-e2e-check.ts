/**
 * room-e2e-check (14 Nov 2026, Security C1a; headless Chromium, ~3 min): two phones play a room on the app's own dev
 * server against the real server functions and every migration on a local PostgreSQL 16 (scripts/server-fn-harness.ts's
 * PostgREST / GoTrue stand-in, which the browser calls as it calls Supabase). Every response either phone receives is
 * kept, and the check reads what reached the phones:
 *
 * - the host creates a room and a guest joins by its link; the host's Start deals it;
 * - before round 1's intro begins, no response to either phone holds any round's puzzle (its seed);
 * - from round 1's intro, the phones hold round 1's puzzle and show its intro (RoundIntro draws only with its puzzle),
 *   while rounds 2 and 3 never reach them;
 * - once the room finishes, the phones read every round (a finished room reads in full).
 *
 * Needs Chromium and the PostgreSQL 16 binaries (preinstalled on GitHub's runners); without PostgreSQL it fails on CI
 * and prints a NOTE locally.
 *
 *   bun scripts/room-e2e-check.ts
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

import type { Browser, Page } from "playwright";

import { ANON_KEY, postgresBin, SERVICE_KEY, startLocalDb, startRestServer, type LocalDb, type RestServer } from "./server-fn-harness";

const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (p): p is string => Boolean(p && existsSync(p)),
);

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

if (!postgresBin()) {
  if (process.env["CI"]) {
    console.log("room-e2e-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: not run (CI runs it)");
  console.log("room-e2e-check: 0 passed, 0 failed");
  process.exit(0);
}

let db: LocalDb | null = null;
let rest: RestServer | null = null;
let proc: ChildProcess | null = null;
let browser: Browser | null = null;
try {
  db = startLocalDb("room-e2e-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  const origin = await startDevServer(rest.url);
  const { chromium } = await import("playwright");
  browser = await chromium.launch({ executablePath: CHROMIUM });
  await flow(browser, origin, db);
} catch (err) {
  check(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
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

console.log(`room-e2e-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: two phones on the real app get each round's puzzle only from its intro, never a later round's, and the whole list once the room finishes.");
process.exit(0);

async function startDevServer(restUrl: string): Promise<string> {
  const port = 5900 + Math.floor(Math.random() * 300);
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
      const r = await fetch(`${origin}/terms`);
      if (r.ok) return origin;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

async function flow(browser: Browser, origin: string, db: LocalDb): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  /** Every response body a phone received, with when it arrived (ms since the epoch). */
  const seen: { at: number; who: string; body: string }[] = [];
  const open = async (who: string, path: string): Promise<Page> => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
    await context.addInitScript(() => {
      try {
        localStorage.setItem("duelz-terms:v1", JSON.stringify({ version: 1, agreedAt: "2026-10-20T12:00:00.000Z" }));
        localStorage.setItem("duelz-onboarding:v1", "1");
        localStorage.setItem("duelz_onboarding_seen", "1");
      } catch {
        /* ignore */
      }
    });
    const page = await context.newPage();
    page.on("response", (r) => {
      const url = r.url();
      if (!url.startsWith(origin) && !url.includes("127.0.0.1")) return;
      if (/\.(js|css|woff2?|png|webp|svg|mp3|ts|tsx)(\?|$)/.test(url) || url.includes("/@") || url.includes("/node_modules/")) return;
      void r.text().then(
        (body) => seen.push({ at: Date.now(), who, body }),
        () => undefined,
      );
    });
    await page.goto(`${origin}${path}`, { timeout: 180_000, waitUntil: "load" });
    return page;
  };
  const ready = async (page: Page, sel: string, timeout = 120_000) => {
    await page.waitForFunction(
      (s) => {
        const el = document.querySelector(s);
        return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
      },
      sel,
      { timeout },
    );
  };
  const waitFor = async (what: () => boolean, ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (what()) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return what();
  };

  // The host creates a room; a guest joins by its link.
  const ali = await open("ali", "/");
  await ready(ali, "#name");
  await ali.fill("#name", "Ali");
  await ali.getByRole("button", { name: "Create a room" }).click();
  await ali.waitForURL(/\/duel\//, { timeout: 120_000 });
  const code = ali.url().split("/duel/")[1]!.slice(0, 4);
  const roomId = q(`SELECT id FROM public.duels WHERE room_code = '${code}'`);
  check(roomId.length > 0, `the host's room exists (${code})`);
  // Retro only, three rounds (arcade deals are quick).
  q(`UPDATE public.duels SET selected_categories = '["retro","rounds:3"]'::jsonb WHERE id = '${roomId}'`);
  const bo = await open("bo", `/duel/${code}`);
  await ready(bo, "#link-name");
  await bo.fill("#link-name", "Bo");
  await bo.getByRole("button", { name: "Join room" }).click();
  check(await waitFor(() => q(`SELECT count(*) FROM public.duel_players WHERE duel_id = '${roomId}'`) === "2", 60_000), "the guest joins by the room's link");

  // Start, as the host taps it.
  await ali.reload({ waitUntil: "load" });
  await ali.getByRole("button", { name: "Start game" }).waitFor({ timeout: 120_000 });
  await ready(ali, "[data-room-settings]", 120_000);
  await ali.getByRole("button", { name: "Start game" }).click();
  check(await waitFor(() => q(`SELECT status FROM public.duels WHERE id = '${roomId}'`) === "in_progress", 60_000), "the host's Start deals the room");
  const held = JSON.parse(q(`SELECT puzzles_public::text FROM public.duel_secrets WHERE duel_id = '${roomId}'`)) as { seed?: number; type: string }[];
  check(held.length === 3 && held.every((p) => typeof p.seed === "number"), `three dealt rounds, each with its seed (${held.map((p) => p.type).join(", ")})`);
  // A round's seed in any form a response carries it: JSON ("seed":123) or a server function's serialised answer (seed:123).
  const tokens = held.map((p) => new RegExp(`seed"?\\s*:\\s*${p.seed}(?![0-9])`));
  const holds = (from: number, to: number, round: number) => seen.some((s) => s.at >= from && s.at < to && tokens[round - 1]!.test(s.body));

  // Round 1's intro: the phones advance the room themselves (Prepare to Duel, then the title).
  const introBegan = await waitFor(() => q(`SELECT current_round || ':' || phase FROM public.duels WHERE id = '${roomId}'`) === "1:intro", 120_000);
  const introAt = Date.now();
  check(introBegan, "the phones move the room on to round 1's intro");
  check(!holds(0, introAt - 1_500, 1) && !holds(0, introAt - 1_500, 2) && !holds(0, introAt - 1_500, 3), "before round 1's intro, no response to either phone holds any round's puzzle");
  const shown = await bo.locator(".round-intro").waitFor({ timeout: 30_000 }).then(() => true, () => false);
  check(shown, "the guest's phone gets round 1's puzzle and shows its intro");
  check(holds(introAt - 1_500, Date.now() + 1, 1), "round 1's puzzle reaches the phones from its intro");
  await ali.waitForTimeout(3_000);
  check(!holds(0, Date.now() + 1, 2) && !holds(0, Date.now() + 1, 3), "rounds 2 and 3 never reach the phones while round 1 plays");

  // The room finishes: every round is readable.
  const finishedAt = Date.now();
  q(`UPDATE public.duels SET status = 'finished', phase = 'finished', current_round = round_count, phase_started_at = now() WHERE id = '${roomId}'`);
  await bo.reload({ waitUntil: "load" });
  const all = await waitFor(() => holds(finishedAt, Date.now() + 1, 2) && holds(finishedAt, Date.now() + 1, 3), 60_000);
  check(all, "once the room finishes, the phones read every round");
}
