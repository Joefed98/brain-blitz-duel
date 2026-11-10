/**
 * chat-report-check (safety fix-up, 10 Nov 2026; headless Chromium, ~2 min; docs/moderation.md "Reports"): reporting
 * a chat message, played for real on the app's own dev server against the real server functions and every migration
 * on a local PostgreSQL 16 (scripts/server-fn-harness.ts's stand-in, as account-flow-check).
 *
 * The bug it pins (Joe's iPhone, 10 Nov 2026): the message menu is drawn beside the chat sheet, a modal that turns
 * pointer events off outside itself, so the reasons showed but a tap on one did nothing. happy-dom (moderation-ui-check)
 * doesn't hit-test, so only a real browser shows it.
 *
 * At 390×844 and 375×667 (touch screens): a guest makes a room, another player's two messages are stored, the guest
 * opens the chat, taps a message (the menu with three reasons), and reports it: one message with a touch tap, the
 * other with a mouse click. Each time the reason is what the browser hit-tests at its centre, the tap files the report
 * (a stored room_reports row with the message, its text, the sender, the reporter and the reason), the menu shows the
 * thank-you the lobby's name report shows, then closes by itself, and the chat sheet stays open.
 *
 *   bun scripts/chat-report-check.ts [--shots=<dir>]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import type { Browser, Page } from "playwright";

import { ANON_KEY, postgresBin, SERVICE_KEY, startLocalDb, startRestServer, type LocalDb, type RestServer } from "./server-fn-harness";
import { REPORT_THANKS } from "../src/lib/safety/reports";

const SHOTS = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);
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
async function section(name: string, body: () => Promise<void>): Promise<void> {
  try {
    await body();
  } catch (err) {
    check(false, `${name}: threw ${err instanceof Error ? (err.stack ?? err.message).split("\n").slice(0, 3).join(" | ") : String(err)}`);
  }
}

if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}
if (!postgresBin()) {
  if (process.env["CI"]) {
    console.log("chat-report-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: not run (CI runs it)");
  console.log("chat-report-check: 0 passed, 0 failed");
  process.exit(0);
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let db: LocalDb | null = null;
let rest: RestServer | null = null;
let proc: ChildProcess | null = null;
let browser: Browser | null = null;
try {
  db = startLocalDb("chat-report-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  const origin = await startDevServer(rest.url);
  const { chromium } = await import("playwright");
  browser = await chromium.launch({ executablePath: CHROMIUM });
  for (const [w, h] of [
    [390, 844],
    [375, 667],
  ] as const) {
    await section(`${w}x${h}`, () => flow(browser!, origin, db!, w, h));
  }
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

console.log(`chat-report-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: a chat message is reported with a touch tap and a mouse click at 390x844 and 375x667: the reason is hit, the report is stored with its reason, the thank-you shows and the menu closes, the chat stays open.");
process.exit(0);

/* =================================================================== the dev server */

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

/* =================================================================== the flow */

async function flow(browser: Browser, origin: string, db: LocalDb, w: number, h: number): Promise<void> {
  const size = `${w}x${h}`;
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const context = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
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
  page.on("pageerror", (e) => console.log(`  NOTE page error: ${e.message.split("\n")[0]}`));
  const ready = (sel: string, timeout = 120_000) =>
    page.waitForFunction(
      (s) => {
        const el = document.querySelector(s);
        return !!el && Object.keys(el).some((k) => k.startsWith("__react"));
      },
      sel,
      { timeout },
    );

  await page.goto(`${origin}/`, { timeout: 180_000, waitUntil: "load" });
  await ready("#name");
  const me = `Rep${w}`;
  await page.fill("#name", me);
  await page.getByRole("button", { name: "Create a room" }).click();
  await page.waitForURL(/\/duel\//, { timeout: 120_000 });
  const reporter = q(`SELECT user_id FROM public.duel_players WHERE display_name = '${me}' ORDER BY created_at DESC LIMIT 1`);
  const room = q(`SELECT duel_id FROM public.duel_players WHERE display_name = '${me}' ORDER BY created_at DESC LIMIT 1`);
  check(/^[0-9a-f-]{36}$/.test(room) && /^[0-9a-f-]{36}$/.test(reporter), `${size}: the guest made a room`);

  // Another player's two messages (as the chat server function would have stored them).
  const ben = crypto.randomUUID();
  q(`INSERT INTO auth.users (id, is_anonymous, last_sign_in_at) VALUES ('${ben}', true, now())`);
  const tapped = q(`INSERT INTO public.room_messages (duel_id, sender_user_id, sender_name, text, created_at) VALUES ('${room}', '${ben}', 'Benny', 'first words ${w}', now() - interval '20 seconds') RETURNING id`);
  const clicked = q(`INSERT INTO public.room_messages (duel_id, sender_user_id, sender_name, text, created_at) VALUES ('${room}', '${ben}', 'Benny', 'second words ${w}', now() - interval '10 seconds') RETURNING id`);
  await page.reload({ waitUntil: "load" });
  await ready("[data-room-chat-button]");
  await page.locator("[data-room-chat-button]").first().tap();
  await page.locator("[data-room-chat-sheet]").waitFor({ timeout: 30_000 });
  await page.getByText(`second words ${w}`).waitFor({ timeout: 30_000 });

  for (const [how, id, text, reason] of [
    ["touch tap", tapped, `first words ${w}`, "abusive_chat"],
    ["mouse click", clicked, `second words ${w}`, "cheating"],
  ] as const) {
    const label = `${size} ${how}`;
    const row = page.locator("li", { hasText: text }).first();
    if (how === "touch tap") await row.tap();
    else await row.click();
    // The menu by what it holds (the reasons), so the check reads the same on the tree before the fix.
    const menu = page.locator("div.fixed:has([data-report-reasons]), [data-chat-message-menu]").first();
    await menu.waitFor({ timeout: 10_000 });
    check((await menu.locator("[data-report-reason]").count()) === 3, `${label}: tapping the message shows the three reasons`);
    const target = menu.locator(`[data-report-reason='${reason}']`);
    const hit = await target.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!top && (top === el || el.contains(top));
    });
    check(hit, `${label}: the reason is what the browser hits at its centre (nothing over it, pointer events on)`);
    if (SHOTS) writeFileSync(`${SHOTS}/chat-report-${size}-${how.replace(" ", "-")}-menu.png`, await page.screenshot());
    let acted = true;
    try {
      if (how === "touch tap") await target.tap({ timeout: 5000 });
      else await target.click({ timeout: 5000 });
    } catch {
      acted = false;
    }
    check(acted, `${label}: the reason takes the ${how}`);
    const thanks = await menu
      .locator("[data-report-thanks]")
      .waitFor({ timeout: 5000 })
      .then(async () => (await menu.locator("[data-report-thanks]").textContent())?.trim() ?? "", () => "");
    check(thanks === REPORT_THANKS, `${label}: the menu shows the thank-you, as the name report does ("${thanks}")`);
    if (SHOTS) writeFileSync(`${SHOTS}/chat-report-${size}-${how.replace(" ", "-")}-thanks.png`, await page.screenshot());
    let stored = "";
    for (let i = 0; i < 40 && !stored; i++) {
      stored = q(
        `SELECT reason || '|' || reporter_user_id || '|' || reported_user_id || '|' || coalesce(message_text, '') || '|' || coalesce(reported_name, '') FROM public.room_reports WHERE message_id = '${id}'`,
      );
      if (!stored) await page.waitForTimeout(250);
    }
    check(
      stored === `${reason}|${reporter}|${ben}|${text}|Benny`,
      `${label}: the report is stored with its reason, the reporter, the sender, the message and the name (${stored || "no row"})`,
    );
    const closed = await page
      .waitForFunction(() => !document.querySelector("[data-chat-message-menu], [data-report-reasons]"), undefined, { timeout: 5000 })
      .then(() => true, () => false);
    check(closed, `${label}: the menu closes by itself after the thank-you`);
    check(await page.locator("[data-room-chat-sheet]").isVisible(), `${label}: the chat sheet stays open`);
  }
  check(q(`SELECT count(*) FROM public.room_reports WHERE duel_id = '${room}'`) === "2", `${size}: exactly the two reports, one each`);
  // The menu's other buttons sat under the same modal: Cancel takes a touch tap too and files nothing.
  await page.locator("li", { hasText: `first words ${w}` }).first().tap();
  await page.locator("[data-chat-menu-cancel]").waitFor({ timeout: 10_000 });
  const cancelled = await page
    .locator("[data-chat-menu-cancel]")
    .tap({ timeout: 5000 })
    .then(() => page.waitForFunction(() => !document.querySelector("[data-chat-message-menu]"), undefined, { timeout: 5000 }))
    .then(() => true, () => false);
  check(cancelled && (await page.locator("[data-room-chat-sheet]").isVisible()), `${size}: Cancel takes a touch tap and closes the menu, the chat stays open`);
  check(q(`SELECT count(*) FROM public.room_reports WHERE duel_id = '${room}'`) === "2", `${size}: Cancel files nothing`);
  await context.close();
}
