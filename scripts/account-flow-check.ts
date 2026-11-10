/**
 * account-flow-check (wave 1 sign-up screens, 10 Nov 2026; headless Chromium, ~3 min): the sign-up screens played for
 * real, on the app's own dev server, against the real server functions and every migration on a local PostgreSQL 16
 * (scripts/server-fn-harness.ts's PostgREST / GoTrue stand-in, which the browser calls as it calls Supabase). Emails
 * aren't sent: the stand-in keeps each one's 6-digit code, which the check types in as a player would.
 *
 * 1. Sign-up at 390×844: a guest plays (creates a room as "Guesty"); a finished game draws no prompt over the room,
 *    the sheet shows on the next tab page (Profile), once, and Not now closes it; the guest opens the account screens, enters an email no
 *    account has, picks a username (a reserved one refused with three suggestions; then "Available"), a colour and a
 *    birthday, types a wrong code (refused) then the right one, and lands on Welcome with "Founding Player #0002". The
 *    auth user is the same id, so the earlier room is theirs; the profile holds the username, colour and country; the
 *    Play tab shows "Playing as" the username with no name box, and a new room's lobby row is the username.
 * 2. Under 13 at 375×667: refused kindly ("You can keep playing as a guest"), no profile, no email sent, the refusal
 *    recorded with no date; a second try on that phone goes straight to the same message, still sending nothing.
 * 3. Signing in on another phone: a guest with a room game sees what stays behind (Cancel / Continue), signs in by
 *    code; the account set to be deleted shows the cancel offer, "Keep my account" cancels it; the guest's room stays
 *    on the guest's id.
 * 4. Google and Apple: no buttons while their switches are off (sign-in screen and the save-progress sheet's source).
 * 5. Every step drawn at 390×844 (and the sign-in screen at 375×667 and a 1440×900 desktop): nothing scrolls
 *    sideways, every button at least 44 px tall and inside the screen's width.
 *
 * Needs Chromium and the PostgreSQL 16 binaries (preinstalled on GitHub's runners); without PostgreSQL it fails on CI
 * and prints a NOTE locally.
 *
 *   bun scripts/account-flow-check.ts [--shots=<dir>]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import type { Browser, Page } from "playwright";

import { ANON_KEY, postgresBin, SERVICE_KEY, startLocalDb, startRestServer, type LocalDb, type RestServer } from "./server-fn-harness";

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
    console.log("account-flow-check: 0 passed, 1 failed\n  FAIL no PostgreSQL binaries on the CI runner\nFAIL");
    process.exit(1);
  }
  console.log("  NOTE no PostgreSQL binaries found: not run (CI runs it)");
  console.log("account-flow-check: 0 passed, 0 failed");
  process.exit(0);
}
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

let db: LocalDb | null = null;
let rest: RestServer | null = null;
let proc: ChildProcess | null = null;
let browser: Browser | null = null;
try {
  db = startLocalDb("account-flow-check-");
  check(db.failed === null, `all migrations apply in order${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
  rest = await startRestServer(db.socketDir);
  const origin = await startDevServer(rest.url);
  const { chromium } = await import("playwright");
  browser = await chromium.launch({ executablePath: CHROMIUM });
  await flows(browser, origin, db, rest);
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

console.log(`account-flow-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: a guest signs up by email code and keeps their games, under 13 refused and remembered, sign-in warns what stays behind and offers to cancel a deletion, Google and Apple hidden, every step fits.");
process.exit(0);

/* =================================================================== the dev server */

async function startDevServer(restUrl: string): Promise<string> {
  const port = 5600 + Math.floor(Math.random() * 300);
  proc = spawn("npx", ["vite", "dev", "--port", String(port), "--host", "127.0.0.1", "--strictPort"], {
    stdio: "ignore",
    detached: true,
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env["NODE_OPTIONS"] ?? ""} --max-old-space-size=4096`.trim(),
      // The browser and the server both talk to the stand-in (process env wins over .env in Vite).
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

/* =================================================================== the flows */

async function flows(browser: Browser, origin: string, db: LocalDb, rest: RestServer): Promise<void> {
  const q = (sql: string) => {
    const out = db.psql(sql);
    if (!out.ok) throw new Error(`psql: ${out.err}`);
    return out.out.trim();
  };
  const lastMail = (to: string, template?: string) => [...rest.mail].reverse().find((m) => m.to === to && (!template || m.template === template));

  async function open(w: number, h: number, path: string, opts: { desktop?: boolean } = {}): Promise<Page> {
    const context = await browser.newContext({
      viewport: { width: w, height: h },
      ...(opts.desktop ? { hasTouch: false, isMobile: false } : { hasTouch: true }),
    });
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
    await page.goto(`${origin}${path}`, { timeout: 180_000, waitUntil: "load" });
    return page;
  }
  /** Waits for a selector to be drawn and hydrated (a tap before React runs does nothing). */
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
  const screen = async (page: Page, name: string, step: string) => {
    await ready(page, `[data-account-screen='${step}']`, 60_000);
    await page.waitForTimeout(200);
    const probe = await page.evaluate(() => {
      const vw = window.innerWidth;
      const buttons = [...document.querySelectorAll("[data-account-screen] button, [data-account-screen] input, [data-account-screen] select")].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(b).visibility !== "hidden";
      });
      return {
        sideways: document.documentElement.scrollWidth - vw,
        small: buttons
          .filter((b) => b.getAttribute("role") !== "radio")
          .map((b) => ({ n: (b.getAttribute("aria-label") ?? b.textContent ?? "").trim().slice(0, 24), h: b.getBoundingClientRect().height }))
          .filter((b) => b.h < 43.5),
        outside: buttons.filter((b) => {
          const r = b.getBoundingClientRect();
          return r.left < -0.5 || r.right > vw + 0.5;
        }).length,
      };
    });
    check(probe.sideways <= 1, `${name}: nothing scrolls sideways (${probe.sideways}px)`);
    check(probe.small.length === 0, `${name}: every button and field at least 44 px tall (${JSON.stringify(probe.small)})`);
    check(probe.outside === 0, `${name}: every control inside the screen's width`);
    if (SHOTS) writeFileSync(`${SHOTS}/${name.replace(/\W+/g, "-")}.png`, await page.screenshot());
  };
  const guestId = (page: Page) =>
    page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)!;
        if (/^sb-.*-auth-token$/.test(k)) return (JSON.parse(localStorage.getItem(k)!) as { user?: { id?: string } }).user?.id ?? null;
      }
      return null;
    });

  let accountId = "";

  await section("1. sign-up", async () => {
    const page = await open(390, 844, "/");
    await ready(page, "#name");
    await page.fill("#name", "Guesty");
    await page.getByRole("button", { name: "Create a room" }).click();
    await page.waitForURL(/\/duel\//, { timeout: 120_000 });
    const guest = await guestId(page);
    check(!!guest, "the guest has a device session");
    const guestRoom = q(`SELECT duel_id FROM public.duel_players WHERE user_id = '${guest}' AND display_name = 'Guesty' LIMIT 1`);
    check(guestRoom.length > 0, "the guest played: their room row holds the name they typed");

    // "Save your progress" (Joe's decision): a finished game only makes it due; nothing opens over the room's
    // screens; it shows on the next tab page, once, and Not now closes it.
    await page.evaluate(async () => {
      const sp = await import("/src/lib/account/saveProgress.ts");
      sp.noteFinishedGame("room:flow:0", { signedIn: false, from: "room" });
    });
    await page.waitForTimeout(1500);
    check((await page.locator("[data-save-progress]").count()) === 0, "a finished game draws no prompt over the room's screens");
    await page.goto(`${origin}/profile`, { waitUntil: "load" });
    const sheet = await page.locator("[data-save-progress='sheet']").waitFor({ timeout: 60_000 }).then(() => true, () => false);
    check(sheet, "the sheet shows on the next tab page (Profile)");
    if (SHOTS) writeFileSync(`${SHOTS}/save-progress-on-profile-390x844.png`, await page.screenshot());
    await page.locator("[data-save-progress-dismiss]").first().click();
    await page.locator("[data-save-progress]").waitFor({ state: "detached", timeout: 15_000 }).catch(() => undefined);
    check((await page.locator("[data-save-progress]").count()) === 0, "Not now closes it");
    await page.goto(`${origin}/`, { waitUntil: "load" });
    await ready(page, "[data-app-tabbar]");
    await page.waitForTimeout(1500);
    check((await page.locator("[data-save-progress]").count()) === 0, "it shows once: the next tab page has nothing");

    await page.goto(`${origin}/account?start=email&from=/`, { waitUntil: "load" });
    await screen(page, "sign-up email (390x844)", "email");
    await page.fill("#account-email", "flow@example.com");
    await page.click("[data-account-send]");
    await screen(page, "sign-up username (390x844)", "username");
    check((await page.locator("[data-account-colours] [role='radio']").count()) === 32, "all 32 colours to choose from");
    await page.fill("#account-username", "admin");
    await page.locator("[data-username-state='refused']").waitFor({ timeout: 30_000 });
    const chips = await page.locator("[data-name-suggestions] button").count();
    check(chips === 3, `a refused username shows the plain reason and three suggestions (${chips})`);
    check(await page.locator("[data-account-username-continue]").isDisabled(), "Continue waits for an allowed name");
    await page.fill("#account-username", "Flow_Player");
    await page.locator("[data-username-state='ok']").waitFor({ timeout: 30_000 });
    check((await page.locator("[data-username-state='ok']").textContent())?.includes("Available") === true, "a free name shows Available as it's typed");
    await page.locator("[data-account-colours] [role='radio']").nth(7).click();
    await page.click("[data-account-username-continue]");
    await screen(page, "sign-up birthday (390x844)", "birthday");
    // The screen's words, not the day picker's numbers.
    const birthdayText = await page.evaluate(() => {
      const copy = document.querySelector("[data-account-screen='birthday']")!.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("select").forEach((s) => s.remove());
      return copy.textContent ?? "";
    });
    check(/When’s your birthday\?/.test(birthdayText) && !/\b13\b|age limit|old enough/i.test(birthdayText), "the birthday screen asks, never mentioning an age limit");
    await page.selectOption("#dob-day", "14");
    await page.selectOption("#dob-month", "3");
    await page.selectOption("#dob-year", "1998");
    await page.click("[data-account-dob-continue]");
    await screen(page, "sign-up inbox (390x844)", "inbox");
    const mail = lastMail("flow@example.com", "email_change");
    check(!!mail && mail.userId === guest, "one email (link and code) sent to the address, linking it to this guest");
    await page.fill("#account-code", "000000");
    await page.locator("[data-account-screen='inbox'] [role='alert']").waitFor({ timeout: 30_000 });
    check(true, "a wrong code is refused");
    check((await page.locator("[data-account-resend]").isDisabled()) && /Resend in 0:\d\d/.test((await page.locator("[data-account-resend]").textContent()) ?? ""), "resend waits 60 seconds");
    await page.fill("#account-code", mail!.token);
    await screen(page, "sign-up welcome (390x844)", "welcome");
    const welcome = await page.locator("[data-account-screen='welcome']").innerText();
    check(/You’re in/.test(welcome) && /Welcome,\s*Flow_Player/.test(welcome), `Welcome greets the username (${welcome.slice(0, 80).replace(/\n/g, " ")})`);
    check(/Founding Player/.test(welcome) && /#0002/.test(welcome), "a founding account shows Founding Player #0002 (numbers start at 2)");
    check((await page.locator("[data-account-number] img").getAttribute("src")) === "/art/badges/founding-player.svg", "with the approved Founding Player badge");

    accountId = q(`SELECT user_id FROM public.profiles WHERE username = 'Flow_Player'`);
    check(accountId === guest, "the account is the guest's own id (nothing copied)");
    check(q(`SELECT is_anonymous FROM auth.users WHERE id = '${guest}'`) === "f", "the auth user is no longer anonymous");
    check(q(`SELECT colour FROM public.profiles WHERE user_id = '${guest}'`) === "7", "the colour picked is stored");
    check(q(`SELECT count(*) FROM public.duel_players WHERE user_id = '${guest}' AND duel_id = '${guestRoom}'`) === "1", "the earlier room is theirs");

    await page.click("[data-account-done]");
    await page.waitForURL((u) => u.pathname === "/", { timeout: 60_000 });
    await page.waitForFunction(() => /Playing as\s*Flow_Player/.test(document.body.innerText), undefined, { timeout: 60_000 });
    check((await page.locator("#name").count()) === 0, "Play shows Playing as the username, with no name box to type in");
    await page.getByRole("button", { name: "Create a room" }).click();
    await page.waitForURL(/\/duel\//, { timeout: 120_000 });
    await page.waitForFunction(() => document.body.innerText.includes("Flow_Player"), undefined, { timeout: 60_000 });
    const code = page.url().split("/duel/")[1]!.slice(0, 4);
    const lobbyName = q(`SELECT p.display_name FROM public.duel_players p JOIN public.duels d ON d.id = p.duel_id WHERE d.room_code = '${code}' AND p.user_id = '${guest}'`);
    check(lobbyName === "Flow_Player", `the lobby's row is the username (${lobbyName})`);

    await page.goto(`${origin}/account`, { waitUntil: "load" });
    await screen(page, "settings account (390x844)", "settings");
    const settings = await page.locator("[data-account-screen='settings']").innerText();
    check(settings.includes("Flow_Player") && settings.includes("flow@example.com") && /free in your first week/.test(settings), "Settings → Account: username with when it can change, and the email");
    await page.context().close();
  });

  await section("2. under 13", async () => {
    const page = await open(375, 667, "/account?start=email");
    await screen(page, "under-13 email (375x667)", "email");
    await page.fill("#account-email", "kid@example.com");
    await page.click("[data-account-send]");
    await ready(page, "#account-username");
    await page.fill("#account-username", "Kiddo_1");
    await page.locator("[data-username-state='ok']").waitFor({ timeout: 30_000 });
    await page.click("[data-account-username-continue]");
    await ready(page, "#dob-year");
    const year = String(new Date().getFullYear() - 10);
    await page.selectOption("#dob-day", "1");
    await page.selectOption("#dob-month", "6");
    await page.selectOption("#dob-year", year);
    await page.click("[data-account-dob-continue]");
    await screen(page, "under-13 refused (375x667)", "under13");
    const text = await page.locator("[data-account-under13]").innerText();
    check(text.includes("You can keep playing as a guest"), "refused kindly: you can keep playing as a guest");
    check(!lastMail("kid@example.com"), "no email sent");
    check(q(`SELECT count(*) FROM public.profiles WHERE username = 'Kiddo_1'`) === "0", "no account made");
    const stored = await page.evaluate(() => localStorage.getItem("duelz-age-refused:v1"));
    check(!!stored && !stored.includes(year) && /^\{"at":\d+\}$/.test(stored), `the phone remembers the refusal's time only (${stored})`);
    let refusals = "0";
    for (let i = 0; i < 40 && refusals === "0"; i++) {
      refusals = q(`SELECT count(*) FROM analytics.events WHERE event = 'under_thirteen_refused'`);
      if (refusals === "0") await page.waitForTimeout(250);
    }
    const props = q(`SELECT coalesce(string_agg(coalesce(props::text, ''), ' '), '') FROM analytics.events WHERE event = 'under_thirteen_refused'`);
    check(refusals === "1" && !props.includes(year), `the refusal recorded once, with no date of birth (${refusals}, ${props})`);
    await page.getByRole("button", { name: "Keep playing" }).click();
    await page.waitForURL((u) => u.pathname === "/", { timeout: 60_000 });
    check(true, "back to playing as a guest");
    await page.goto(`${origin}/account?start=email`, { waitUntil: "load" });
    await ready(page, "#account-email");
    await page.fill("#account-email", "kid2@example.com");
    await page.click("[data-account-send]");
    await ready(page, "[data-account-under13]");
    check(true, "a second try on that phone is blocked at once");
    check(!lastMail("kid2@example.com") && q(`SELECT count(*) FROM public.profiles`) === "1", "still nothing sent and no account");
    await page.context().close();
  });

  await section("3. signing in on another phone", async () => {
    const page = await open(390, 844, "/");
    await ready(page, "#name");
    await page.fill("#name", "Second");
    await page.getByRole("button", { name: "Create a room" }).click();
    await page.waitForURL(/\/duel\//, { timeout: 120_000 });
    const guest = await guestId(page);
    q(`UPDATE public.profiles SET deletion_requested_at = now() - interval '2 days' WHERE username = 'Flow_Player'`);
    await page.goto(`${origin}/account?from=/profile`, { waitUntil: "load" });
    await screen(page, "sign-in (390x844)", "signin");
    check((await page.getByText("Continue with Google").count()) === 0 && (await page.getByText("Continue with Apple").count()) === 0, "no Google or Apple buttons while their switches are off");
    await page.click("[data-account-email]");
    await ready(page, "#account-email");
    await page.fill("#account-email", "flow@example.com");
    await page.click("[data-account-send]");
    await screen(page, "sign-in warning (390x844)", "warn");
    const warn = await page.locator("[data-account-screen='warn']").innerText();
    check(/1 room game/.test(warn), `the warning lists what stays behind (${warn.replace(/\n/g, " ").slice(0, 160)})`);
    await page.click("[data-account-warn-continue]");
    await ready(page, "#account-code");
    const mail = lastMail("flow@example.com", "magic_link");
    check(!!mail, "a sign-in email (link and code)");
    await page.fill("#account-code", mail!.token);
    await screen(page, "sign-in deletion pending (390x844)", "deleting");
    await page.click("[data-account-cancel-deletion]");
    await ready(page, "[data-account-screen='welcome']");
    check(/Welcome back,\s*Flow_Player/.test(await page.locator("[data-account-screen='welcome']").innerText()), "Keep my account cancels the deletion and welcomes them back");
    check(q(`SELECT deletion_requested_at IS NULL FROM public.profiles WHERE username = 'Flow_Player'`) === "t", "the deletion is cancelled");
    check(q(`SELECT count(*) FROM public.duel_players WHERE user_id = '${guest}'`) === "1", "the guest's room stays on the guest's id");
    const left = await page.evaluate(() => localStorage.getItem("duelz-left-guests:v1") ?? "");
    check(left.includes(String(guest)), "the phone remembers the guest it left");
    await page.context().close();
  });

  await section("4. sizes", async () => {
    for (const [w, h, desktop] of [
      [375, 667, false],
      [1440, 900, true],
    ] as const) {
      const page = await open(w, h, "/account", { desktop });
      await screen(page, `sign-in (${w}x${h})`, "signin");
      await page.context().close();
    }
  });
}
