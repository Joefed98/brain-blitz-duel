/**
 * play-tab-shift-check (22 Oct 2026): the Play tab never jumps (src/lib/playCards.ts, PlaySlot,
 * src/routes/index.tsx). The real Play tab in the screen harness (scripts/safe-area-harness.tsx, the
 * network stubbed, its server answering after 1.5 s) at 414x896 as an iPhone 11 home-screen app
 * (48/34 px insets), recording every frame from the first: Quick play, the share welcome card, Rejoin
 * your last room, Daily challenge, Challenge a friend, Next public game and Warm up.
 *
 *  1. Fresh device, a last room, everything available: from the first frame every card is where it
 *     ends up (within 2 px) and none appears later.
 *  2. Returning device (a stored name, today's daily done, the room cached): the same, and the daily
 *     card shows the remembered "694 4TH" from the first frame.
 *  3. Arriving from a shared link (?ref=share): the welcome card is there from the first frame.
 *  4. The server says no (dailies and challenges not migrated, the room closed): the reserved cards
 *     collapse smoothly (nothing below moves more than 40 px in a frame, nothing ever moves down)
 *     and are gone; Quick play never moves.
 *  5. The next visit on that device reserves none of them: nothing moves at all.
 *  6. The real app, server-rendered (vite dev, no database: the server says no to the dailies,
 *     challenges and the room): its first paint is the server's HTML with the reserved cards, then
 *     they collapse smoothly; nothing ever moves down and Quick play never moves.
 *  7. The boot script's keys are the ones the app writes, and the inline script agrees with
 *     playCardTokens on every storage case.
 *
 *   bun scripts/play-tab-shift-check.ts
 */
import { existsSync, readFileSync } from "node:fs";

import { chromium, type Browser } from "playwright";

import { DEVICE_INIT, IPHONE11_APP } from "./device-emulation";
import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS } from "./theme-screens";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { ukDayKey, ukDayWindow, type DailyStatus } from "../src/lib/duel/daily";
import { ARRIVAL_KEY, HOME_HINT_KEY, LAST_ROOM_KEY, NAME_KEY, PLAY_CARDS_BOOT, PLAY_CARDS_KEY, applyTokens, playCardTokens, type BootDevice } from "../src/lib/playCards";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string) {
  if (ok) passes++;
  else {
    failures.push(message);
    console.log(`  FAIL ${message}`);
  }
}

const SLOW_MS = 1500;
const ITEMS: Record<string, string> = {
  quickPlay: '[aria-label="Quick play"]',
  welcome: "[data-share-welcome]",
  rejoin: "[data-rejoin-room]",
  daily: "[data-daily-card]",
  challenge: "[data-challenge-card]",
  publicGame: "[data-public-game]",
  warmUp: '[aria-label="Warm up"]',
};
const day = ukDayKey(Date.now());
const status = (available: boolean, done = false): DailyStatus => ({
  available,
  day,
  closesAt: ukDayWindow(day).closesAt,
  puzzle: done ? { state: "done", total: 694, rank: 4, count: null } : { state: "play" },
  arcade: { state: "play" },
});
const inTwoDays = () => {
  const d = new Date(Date.now() + 2 * 86_400_000);
  return d.toISOString().slice(0, 10);
};

type Frame = { t: number; items: Record<string, number | null>; daily: string };
interface Scenario {
  name: string;
  storage: Record<string, string>;
  query?: string;
  server: { daily: boolean; done?: boolean; challenges: boolean; rejoin: "open" | "closed" | null };
  expect: "stable" | "collapse";
}

async function run(browser: Browser, origin: string, s: Scenario): Promise<{ frames: Frame[]; storage: Record<string, string>; nameRow: { natural: number; reserved: number } }> {
  const context = await browser.newContext({ viewport: { width: IPHONE11_APP.w, height: IPHONE11_APP.h }, hasTouch: true, isMobile: true });
  await context.addInitScript(DEVICE_INIT);
  await context.addInitScript(
    ({ storage, harness, items, onboarding, games }) => {
      try {
        localStorage.setItem(onboarding, "1");
        for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
      } catch {
        /* ignore */
      }
      (window as unknown as { __DUELZ_PUBLIC_GAMES__: unknown }).__DUELZ_PUBLIC_GAMES__ = games;
      (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room: null, ...harness };
      const frames: unknown[] = [];
      (window as unknown as { __frames: unknown[] }).__frames = frames;
      const start = performance.now();
      const tick = () => {
        const out: Record<string, number | null> = {};
        for (const [key, sel] of Object.entries(items)) {
          const el = document.querySelector(sel);
          const r = el?.getBoundingClientRect();
          out[key] = r && r.height > 0 ? r.top + window.scrollY : null;
        }
        frames.push({ t: performance.now() - start, items: out, daily: document.querySelector("[data-daily-card]")?.textContent ?? "" });
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    {
      storage: s.storage,
      items: ITEMS,
      onboarding: ONBOARDING_KEY,
      games: [{ date: inTwoDays(), time: "19:00", lobbyOpens: "18:45", rounds: 6, roomCode: "PLAY", title: "Saturday night quiz" }],
      harness: {
        slowMs: SLOW_MS,
        daily: { status: status(s.server.daily, s.server.done), boards: {}, view: null, reveals: [] },
        challengesAvailable: s.server.challenges,
        rejoin: s.server.rejoin ? { code: "ABCD", status: s.server.rejoin === "open" ? "waiting" : "finished", players: 3 } : undefined,
      },
    },
  );
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { top: IPHONE11_APP.top, bottom: IPHONE11_APP.bottom, left: 0, right: 0 } } as never);
  await page.goto(`${origin}/safe-area.html?mode=home${s.query ? `&${s.query}` : ""}`, { timeout: 180_000 });
  await page.waitForSelector('[aria-label="Quick play"]', { timeout: 60_000 });
  await page.waitForTimeout(SLOW_MS + 1500);
  const frames = (await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames)) as Frame[];
  const storage = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k) ?? ""])));
  // The name row's height before the page is up (what a server-rendered first paint shows) against its own.
  const nameRow = await page.evaluate(() => {
    const row = document.querySelector("[data-name-row]") as HTMLElement;
    const natural = row.getBoundingClientRect().height;
    const editing = row.getAttribute("data-editing");
    row.removeAttribute("data-editing");
    const reserved = row.getBoundingClientRect().height;
    if (editing !== null) row.setAttribute("data-editing", editing);
    return { natural, reserved };
  });
  await context.close();
  return { frames, storage, nameRow };
}

function judge(s: Scenario, frames: Frame[]) {
  const from = frames.findIndex((f) => f.items["quickPlay"] !== null);
  const seen = frames.slice(from);
  const final = seen[seen.length - 1]!;
  const where = s.name;
  if (from < 0 || !seen.length) return check(false, `${where}: the Play tab never drew`);
  const present = Object.keys(ITEMS).filter((k) => final.items[k] !== null);
  console.log(`  ${where}: ${seen.length} frames from the first; at the end ${present.join(", ")}`);
  const qp = seen.map((f) => f.items["quickPlay"]!);
  check(Math.max(...qp) - Math.min(...qp) <= 2, `${where}: Quick play moved ${Math.max(...qp) - Math.min(...qp)} px`);
  if (s.expect === "stable") {
    for (const key of Object.keys(ITEMS)) {
      const bad = seen.find((f) => (f.items[key] === null) !== (final.items[key] === null) || (f.items[key] !== null && Math.abs(f.items[key]! - final.items[key]!) > 2));
      check(!bad, `${where}: ${key} ${bad ? `was at ${bad.items[key]} in a frame at ${bad.t.toFixed(0)} ms, ends at ${final.items[key]}` : ""}`);
    }
  } else {
    for (const key of present) {
      let worst = 0;
      let down = 0;
      for (let i = 1; i < seen.length; i++) {
        const a = seen[i - 1]!.items[key];
        const b = seen[i]!.items[key];
        if (a === null || b === null) continue;
        worst = Math.max(worst, Math.abs(b - a));
        down = Math.max(down, b - a);
      }
      check(worst <= 40 && down <= 2, `${where}: ${key} jumped ${worst.toFixed(0)} px in a frame (moved down ${down.toFixed(0)} px)`);
      check(seen[0]!.items[key] !== null, `${where}: ${key} was not there from the first frame`);
    }
  }
  return seen;
}

const CHROMIUM = CHROMIUM_PATHS.find((path): path is string => Boolean(path && existsSync(path)));
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-play-tab-shift", buildId: "play-tab-shift" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const lastRoom = { [LAST_ROOM_KEY]: JSON.stringify({ code: "ABCD", at: Date.now() - 60_000 }) };
  const all = { daily: true, challenges: true, rejoin: "open" as const };

  const fresh = await run(browser, server.origin, { name: "fresh device", storage: lastRoom, server: all, expect: "stable" });
  check(Math.abs(fresh.nameRow.natural - fresh.nameRow.reserved) <= 0.5, `no stored name: the name row reserved ${fresh.nameRow.reserved} px before the page is up, ${fresh.nameRow.natural} px after`);
  const freshSeen = judge({ name: "fresh device", storage: {}, server: all, expect: "stable" }, fresh.frames);
  check(!!freshSeen && ["rejoin", "daily", "challenge", "publicGame"].every((k) => freshSeen[freshSeen.length - 1]!.items[k] !== null), "fresh device: Rejoin, Daily, Challenge and Next public game all show");

  const returning: Scenario = {
    name: "returning device",
    storage: {
      ...lastRoom,
      [NAME_KEY]: "Joe",
      [PLAY_CARDS_KEY]: JSON.stringify({ daily: status(true, true), challenges: true, rejoin: { code: "ABCD", open: { code: "ABCD", players: 3, lobby: true } } }),
    },
    server: { ...all, done: true },
    expect: "stable",
  };
  const back = await run(browser, server.origin, returning);
  check(Math.abs(back.nameRow.natural - back.nameRow.reserved) <= 0.5, `a stored name: the name row reserved ${back.nameRow.reserved} px before the page is up, ${back.nameRow.natural} px after`);
  const backSeen = judge(returning, back.frames);
  const firstDaily = backSeen?.find((f) => f.items["daily"] !== null)?.daily ?? "";
  check(/694/.test(firstDaily) && /4th/i.test(firstDaily), `returning device: the daily card's first frame shows the remembered score (${firstDaily})`);

  const arrival: Scenario = { name: "arrival from a shared link", storage: {}, query: "ref=share", server: all, expect: "stable" };
  const arrived = await run(browser, server.origin, arrival);
  const arrivedSeen = judge(arrival, arrived.frames);
  check(!!arrivedSeen && arrivedSeen[0]!.items["welcome"] !== null, "arrival: the welcome card is there from the first frame");

  const no: Scenario = { name: "server says no", storage: lastRoom, server: { daily: false, challenges: false, rejoin: "closed" }, expect: "collapse" };
  const said = await run(browser, server.origin, no);
  const saidSeen = judge(no, said.frames);
  const end = saidSeen?.[saidSeen.length - 1];
  check(!!end && end.items["daily"] === null && end.items["challenge"] === null && end.items["rejoin"] === null, "server says no: the three cards collapse away");
  check(!!saidSeen && saidSeen[0]!.items["daily"] !== null, "server says no: the daily card was reserved at first (then collapsed)");

  const next: Scenario = { name: "next visit after a no", storage: said.storage, server: no.server, expect: "stable" };
  const nextVisit = await run(browser, server.origin, next);
  const nextSeen = judge(next, nextVisit.frames);
  check(!!nextSeen && nextSeen.every((f) => f.items["daily"] === null && f.items["challenge"] === null && f.items["rejoin"] === null), "next visit: nothing reserved, nothing pops in");
  // 6: the real app, server-rendered.
  const { spawn } = await import("node:child_process");
  const port = 5393;
  const dev = spawn("npx", ["vite", "dev", "--port", String(port), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore", detached: true });
  try {
    const origin = `http://127.0.0.1:${port}`;
    let up = false;
    for (let i = 0; i < 150 && !up; i++) {
      try {
        up = (await fetch(`${origin}/practice`)).ok;
      } catch {
        /* not yet */
      }
      if (!up) await new Promise((r) => setTimeout(r, 1000));
    }
    if (!up) check(false, "the real app's dev server did not start");
    else {
      const html = await (await fetch(`${origin}/`)).text();
      check(html.includes('data-play-slot="daily"') && html.includes("data-name-row") && html.includes('data-play-cards",t.join'), "the server-rendered Play tab carries the slots and the boot script");
      // Warm the dev server once (its first page load compiles everything), unmeasured.
      const warm = await browser.newPage();
      await warm.goto(`${origin}/`, { timeout: 240_000 }).catch(() => undefined);
      await warm.waitForTimeout(4000);
      await warm.close();
      const context = await browser.newContext({ viewport: { width: IPHONE11_APP.w, height: IPHONE11_APP.h }, hasTouch: true, isMobile: true });
      await context.addInitScript(DEVICE_INIT);
      const errors: string[] = [];
      await context.addInitScript(
        ({ storage, items, onboarding }) => {
          try {
            localStorage.setItem(onboarding, "1");
            for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
          } catch {
            /* ignore */
          }
          const frames: unknown[] = [];
          (window as unknown as { __frames: unknown[] }).__frames = frames;
          const start = performance.now();
          const tick = () => {
            const out: Record<string, number | null> = {};
            for (const [key, sel] of Object.entries(items)) {
              const el = document.querySelector(sel);
              const r = el?.getBoundingClientRect();
              out[key] = r && r.height > 0 ? r.top + window.scrollY : null;
            }
            frames.push({ t: performance.now() - start, items: out, daily: "" });
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        },
        { storage: { [LAST_ROOM_KEY]: JSON.stringify({ code: "ABCD", at: Date.now() }) }, items: ITEMS, onboarding: ONBOARDING_KEY },
      );
      const page = await context.newPage();
      page.on("console", (m) => {
        if (m.type() === "error" && /hydrat/i.test(m.text())) errors.push(m.text().split("\n")[0]!);
      });
      page.on("pageerror", (e) => {
        if (/hydrat/i.test(e.message)) errors.push(e.message.split("\n")[0]!);
      });
      await page.goto(`${origin}/`, { timeout: 180_000 });
      await page.waitForTimeout(6000);
      const frames = (await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames)) as Frame[];
      await context.close();
      judge({ name: "the real app (server-rendered)", storage: {}, server: { daily: false, challenges: false, rejoin: "closed" }, expect: "collapse" }, frames);
      const firstPaint = frames.find((f) => f.items["quickPlay"] !== null);
      check(!!firstPaint && firstPaint.items["daily"] !== null && firstPaint.items["challenge"] !== null && firstPaint.items["rejoin"] !== null, "the real app: the reserved cards are in its first paint");
      check(errors.length === 0, `the real app hydrates without a mismatch (${errors.join("; ")})`);
    }
  } finally {
    try {
      process.kill(-dev.pid!);
    } catch {
      /* gone */
    }
  }
} finally {
  await browser.close();
  await server.close();
}

// 6: the boot script reads the keys the app writes.
check(readFileSync("src/lib/duel/session.ts", "utf8").includes(`"${NAME_KEY}"`), "the name key differs from session.ts");
check(readFileSync("src/lib/duel/deviceHistory.ts", "utf8").includes(`"${LAST_ROOM_KEY}"`), "the last-room key differs from deviceHistory.ts");
check(readFileSync("src/lib/share/shareRef.ts", "utf8").includes(`"${ARRIVAL_KEY}"`), "the arrival key differs from shareRef.ts");
const src = readFileSync("src/lib/playCards.ts", "utf8");
const body = src.slice(src.indexOf("export function playCardTokens"), src.indexOf("/** The inline script"));
check([NAME_KEY, LAST_ROOM_KEY, ARRIVAL_KEY, PLAY_CARDS_KEY, HOME_HINT_KEY].every((k) => body.includes(`"${k}"`)), "the boot script doesn't read every key it should");
check(readFileSync("src/components/beta/HomeScreenHint.tsx", "utf8").includes("HOME_HINT_KEY"), "the hint doesn't mark the key the boot script reads");
const mem = (o: Record<string, string>) => ({ getItem: (k: string) => o[k] ?? null });
check(playCardTokens(mem({}), "", null, []).join() === "daily,challenge", `fresh tokens ${playCardTokens(mem({}), "", null, []).join()}`);
check(playCardTokens(mem({ [PLAY_CARDS_KEY]: JSON.stringify({ daily: { available: false }, challenges: false }) }), "?ref=share", null, []).join() === "welcome", "remembered no's and a share arrival");
// A configured public game still to come reserves its card on a device with no height cached (the
// server-rendered page can't draw it: it depends on the phone's clock); a cached height wins; none once it has started.
{
  const starts: [number, number][] = [[Date.UTC(2026, 9, 27, 20), 238], [Date.UTC(2026, 9, 29, 20), 216]];
  const before = Date.UTC(2026, 9, 26);
  check(playCardTokens(mem({}), "", null, starts, before).includes("public:238"), "a fresh device reserves the next public game's card");
  check(playCardTokens(mem({}), "", null, starts, Date.UTC(2026, 9, 28)).includes("public:216"), "after the first game, the next one's card");
  check(playCardTokens(mem({ [PLAY_CARDS_KEY]: JSON.stringify({ publicH: 0 }) }), "", null, starts, before).includes("public:238"), "a device that saw no card last time still reserves a scheduled one");
  check(playCardTokens(mem({ [PLAY_CARDS_KEY]: JSON.stringify({ publicH: 241 }) }), "", null, starts, before).includes("public:241"), "a cached height wins");
  check(!playCardTokens(mem({}), "", null, starts, Date.UTC(2026, 9, 30)).some((t) => t.startsWith("public")), "nothing reserved once every game has started");
}
check(/__html: PLAY_CARDS_BOOT/.test(readFileSync("src/routes/__root.tsx", "utf8")), "the root doesn't run the boot script before the first paint");
const bootFn = new Function("window", "location", "document", PLAY_CARDS_BOOT);
const attrs: Record<string, string> = {};
const props: Record<string, string> = {};
bootFn(
  { localStorage: mem({ [NAME_KEY]: "Jo", [PLAY_CARDS_KEY]: JSON.stringify({ publicH: 212 }) }) },
  { search: "" },
  { documentElement: { setAttribute: (k: string, v: string) => void (attrs[k] = v), style: { setProperty: (k: string, v: string) => void (props[k] = v) } } },
);
check(attrs["data-play-cards"] === "named daily challenge public" && props["--play-public-h"] === "212px", `the inline boot script runs on its own (${attrs["data-play-cards"]}, ${props["--play-public-h"]})`);
// The inline script (a fixed string) gives the same tokens as playCardTokens + applyTokens in every case.
{
  const cases: [Record<string, string>, string, BootDevice | null][] = [];
  // The Add to Home Screen hint (22 Oct 2026): iPhone Safari outside a home-screen app, once per device.
  const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
  const devices: (BootDevice | null)[] = [
    null,
    { ua: SAFARI, standalone: false },
    { ua: SAFARI, standalone: true },
    { ua: SAFARI.replace("Version/18.6", "CriOS/141.0.7390.96"), standalone: false },
    { ua: `${SAFARI} [FBAN/FBIOS;FBAV/530.0]`, standalone: false },
    { ua: "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36", standalone: false },
    { ua: "Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1", standalone: false },
  ];
  const caches = [undefined, "{}", JSON.stringify({ daily: { available: false } }), JSON.stringify({ daily: { available: true }, challenges: false }), JSON.stringify({ rejoin: { code: "ABCD", open: null } }), JSON.stringify({ rejoin: { code: "WXYZ", open: null }, publicH: 230.4 }), JSON.stringify({ publicH: 0 }), "not json"];
  for (const cache of caches)
    for (const name of [undefined, "", "  ", "Jo"])
      for (const last of [undefined, JSON.stringify({ code: "ABCD" }), JSON.stringify({ code: "abcd" })])
        for (const arrival of [undefined, JSON.stringify({ at: 1 })])
          for (const search of ["", "?ref=share", "?mode=home&ref=share&room=ABCD", "?ref=sharex"])
            for (const device of devices)
              for (const hinted of [undefined, "", JSON.stringify({ shownAt: "2026-10-22T20:00:00Z" })]) {
                const store: Record<string, string> = {};
                if (cache !== undefined) store[PLAY_CARDS_KEY] = cache;
                if (name !== undefined) store[NAME_KEY] = name;
                if (last !== undefined) store[LAST_ROOM_KEY] = last;
                if (arrival !== undefined) store[ARRIVAL_KEY] = arrival;
                if (hinted !== undefined) store[HOME_HINT_KEY] = hinted;
                cases.push([store, search, device]);
              }
  let differ = 0;
  let hints = 0;
  for (const [store, search, device] of cases) {
    const a: Record<string, string> = {};
    const p: Record<string, string> = {};
    const win = device
      ? { localStorage: mem(store), navigator: { userAgent: device.ua, standalone: device.standalone }, matchMedia: () => ({ matches: false }) }
      : { localStorage: mem(store) };
    bootFn(win, { search }, { documentElement: { setAttribute: (k: string, v: string) => void (a[k] = v), style: { setProperty: (k: string, v: string) => void (p[k] = v) } } });
    const b: Record<string, string> = {};
    const q: Record<string, string> = {};
    applyTokens({ setAttribute: (k: string, v: string) => void (b[k] = v), style: { setProperty: (k: string, v: string) => void (q[k] = v) } } as never, playCardTokens(mem(store), search, device));
    if (JSON.stringify([a, p]) !== JSON.stringify([b, q])) differ++;
    const hinted = (b["data-play-cards"] ?? "").split(" ").includes("homescreen");
    if (hinted) hints++;
    // Only iPhone Safari outside a home-screen app, and only before the device was shown it.
    if (hinted !== (device === devices[1] && store[HOME_HINT_KEY] === undefined)) differ++;
  }
  check(hints > 0, `the home-screen hint is reserved for iPhone Safari on a first visit (${hints} cases)`);
  check(differ === 0, `the inline boot script and playCardTokens agree on ${cases.length} storage cases (${differ} differ)`);
}

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks`);
  process.exit(1);
}
console.log(`PASS: ${passes} checks: the Play tab holds its layout from the first frame at 414x896 (a slow server, fresh and returning devices, a share arrival), collapses refused cards smoothly and reserves nothing it was told no`);
