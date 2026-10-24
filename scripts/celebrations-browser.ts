/**
 * celebrations-check's browser pass (Prompt P, 23 Oct 2026): the real screens through
 * scripts/safe-area-harness.tsx (network stubbed) at 414x896 as an iPhone 11 home-screen app.
 *
 *  - When: the podium's hero and burst (and "You win!" with the zap only on the winner's phone),
 *    the hero run on a stored 150 and not 149, the lobby meter (3/10 and 10/10, reserved from the
 *    first frame, a join's crackle), GO's strike and zap on the countdown and none on Prepare to
 *    Duel, Create a room's zap, the logo's charge-in.
 *  - Nothing shifts layout: from the screen's first frame to the end of every effect, every element's
 *    layout box (offset, so a FLIP slide's transform is not a shift) stays put; inside counting rows
 *    only vertical positions are judged (a total's digits widen it).
 *  - Taps go through: while the banner and hero are up, the layer is never what is under a point
 *    and a tap on a podium row opens it.
 *  - The count-up ends on the server's numbers in the server's order: standings and the podium
 *    read the same as with celebrations switched off.
 *  - Reduced motion: no sparks or run; the totals final from the first frame; banner and hero calm.
 *  - Switched off: no layer, no meter, no requests, and each screen's markup the same as today's
 *    (scripts/fixtures/celebrations-off.json, recorded on main with --record-off).
 *
 *   bun scripts/celebrations-browser.ts [--shots=<dir>] [--record-off]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { Browser, BrowserContext, Page } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { CHROMIUM_PATHS, openThemeScreen, room, type ThemeScreen, type ThemeViewport } from "./theme-screens";
import { IPHONE11_APP } from "./device-emulation";
import { INTRO_MS } from "../src/lib/duel/types";

const FIXTURE = "scripts/fixtures/celebrations-off.json";
const RECORD = process.argv.includes("--record-off");
const SHOTS = process.argv.find((a) => a.startsWith("--shots="))?.slice(8) ?? null;
const CHROMIUM = CHROMIUM_PATHS.find((p) => p && existsSync(p));
const APP: ThemeViewport = { name: "414x896 home-screen app", w: IPHONE11_APP.w, h: IPHONE11_APP.h, app: true, scale: 2 };

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

type Room = ReturnType<ReturnType<typeof room>>;
const fixture = (make: () => Room, change: (r: Room) => void) => () => {
  const r = make();
  change(r);
  return r;
};
/** A reveal with this player's stored score for the round (the hero run's line). */
const revealWith = (score: number) =>
  fixture(room("in_progress", "result", { players: 4 }), (r) => {
    r.duel.phase = "reveal";
    r.results = r.results.map((row) => (row.player_slot === 1 ? { ...row, score } : row));
  });
/** The podium with another player first. */
const podiumLost = fixture(room("finished", "result", { players: 10, rounds: 6 }), (r) => {
  r.results = r.results.map((row) => (row.player_slot === 1 ? { ...row, score: 40 } : row));
});
/** Standings after round 2 where round 2 reshuffles the order (climbs). */
const standingsShuffle = fixture(room("in_progress", "standings", { players: 10, rounds: 2 }), (r) => {
  r.results = r.results.map((row) => (row.round_number === 2 ? { ...row, score: 40 + row.player_slot * 14 } : row));
});
/** The countdown, GO `goInMs` from the page's open. */
const countdown = (goInMs: number) =>
  fixture(room("in_progress", "intro"), (r) => {
    const start = Date.now() - (INTRO_MS - goInMs);
    r.duel.phase_started_at = new Date(start).toISOString();
    r.duel.round_started_at = new Date(start).toISOString();
    r.results = [];
  });

interface Screen extends ThemeScreen {
  /** Where layout sampling starts: the screen's own first frame. */
  ready: string;
}
const SCREENS: Record<string, Screen> = {
  podium: { name: "podium, 10 players", mode: "room", room: room("finished", "result", { players: 10, rounds: 6 }), ready: "[data-podium-place]", waitMs: 2400 },
  podiumLost: { name: "podium, 10 players, not first", mode: "room", room: podiumLost, ready: "[data-podium-place]", waitMs: 2400 },
  standings: { name: "standings, 10 players", mode: "room", room: standingsShuffle, ready: "ul li .th-name", waitMs: 2400 },
  final2: { name: "final results, 2 players", mode: "room", room: room("finished", "result", { rounds: 6 }), ready: ".th-score", waitMs: 2400 },
  lobby3: { name: "lobby, 3 players", mode: "room", room: room("waiting", "starting", { players: 3 }), ready: "[data-host-label], [data-look-hint], ul li", waitMs: 600 },
  lobby10: { name: "lobby, 10 players", mode: "room", room: room("waiting", "starting", { players: 10 }), ready: "[data-host-label], [data-look-hint], ul li", waitMs: 1400 },
  reveal150: { name: "answer reveal, 150", mode: "room", room: revealWith(150), ready: "[data-reveal-score]", waitMs: 2600, plain: true },
  reveal149: { name: "answer reveal, 149", mode: "room", room: revealWith(149), ready: "[data-reveal-score]", waitMs: 2600, plain: true },
  prepare: { name: "prepare to duel", mode: "room", room: room("in_progress", "starting"), ready: "#root *", waitMs: 2500, plain: true },
  home: { name: "play", mode: "home", ready: "[data-app-wordmark]", waitMs: 400 },
};

/** Before the page: the log, the switch, and a sampler of every element's layout box from the screen's first frame. */
async function prepare(context: BrowserContext, on: boolean | null, ready: string) {
  await context.addInitScript(
    ({ on, ready }) => {
      const w = window as unknown as Record<string, unknown>;
      w.__DUELZ_CELEBRATION_LOG__ = [];
      if (on !== null) w.__DUELZ_BETA_CONFIG__ = { ...((w.__DUELZ_BETA_CONFIG__ as object) ?? {}), FX_CELEBRATIONS: on };
      const ids = new WeakMap<Element, number>();
      let next = 1;
      const samples: { t: number; geo: string; boxes: Record<number, [number, number, number, number, number, number]>; scores: string[]; meter: boolean; list: boolean }[] = [];
      // The device's geometry (viewport and insets): the emulated home-screen app's insets arrive after
      // the page draws, and only samples under the final geometry are judged.
      let probe: HTMLElement | null = null;
      const geometry = () => {
        if (!probe) {
          probe = document.createElement("div");
          probe.style.cssText = "position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
          document.body.appendChild(probe);
        }
        const cs = getComputedStyle(probe);
        return `${innerWidth}x${innerHeight}:${cs.paddingTop},${cs.paddingBottom}:${document.documentElement.style.cssText}`;
      };
      w.__celSamples = samples;
      const names: Record<number, string> = {};
      w.__celNames = names;
      let started = 0;
      const take = () => {
        const root = document.getElementById("root");
        if (!root) return;
        const boxes: Record<number, [number, number, number, number, number, number]> = {};
        for (const el of Array.from(root.querySelectorAll("*")) as HTMLElement[]) {
          // The celebrations' own overlay is fixed over the screen and takes no layout space.
          if (!(el instanceof HTMLElement) || el.closest("[data-celebration-layer]")) continue;
          let id = ids.get(el);
          if (!id) {
            ids.set(el, (id = next++));
            names[id] = `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} "${(el.textContent ?? "").slice(0, 30)}"`;
          }
          // Vertical-only inside a counting row or plinth: a total's digits may widen it.
          const row = el.closest("li, [data-podium-place]") ? 1 : 0;
          const text = el.textContent ?? "";
          let top = 0;
          let left = 0;
          for (let n: HTMLElement | null = el; n; n = n.offsetParent as HTMLElement | null) {
            top += n.offsetTop;
            left += n.offsetLeft;
          }
          let hash = 0;
          for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0;
          boxes[id] = [top, left, el.offsetWidth, el.offsetHeight, row, hash];
        }
        samples.push({
          t: performance.now() - started,
          geo: geometry(),
          boxes,
          scores: Array.from(root.querySelectorAll(".th-score")).map((e) => e.textContent ?? ""),
          meter: !!root.querySelector("[data-charge-meter]"),
          list: !!root.querySelector("ul li"),
        });
      };
      const tick = () => {
        if (!started && document.querySelector(ready)) started = performance.now();
        if (started) {
          const age = performance.now() - started;
          if (age > 3200) return;
          if (samples.length === 0 || age - samples[samples.length - 1]!.t >= 90) take();
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    { on, ready },
  );
}

interface Opened {
  page: Page;
  close: () => Promise<void>;
  log: () => Promise<{ kind: string; text?: string; at: number }[]>;
}
async function open(browser: Browser, origin: string, key: string, on: boolean | null, opts: { reduced?: boolean } = {}): Promise<Opened> {
  const screen = SCREENS[key]!;
  const { context, page } = await openThemeScreen(browser, origin, screen, APP, async (ctx) => {
    await prepare(ctx, on, screen.ready);
    if (opts.reduced) await ctx.addInitScript(() => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => (/prefers-reduced-motion:\s*reduce/.test(q) ? ({ ...real(q), matches: true, media: q } as MediaQueryList) : real(q));
    });
  });
  if (opts.reduced) await page.emulateMedia({ reducedMotion: "reduce" });
  return {
    page,
    close: () => context.close(),
    log: () => page.evaluate(() => (window as unknown as { __DUELZ_CELEBRATION_LOG__: { kind: string; text?: string; at: number }[] }).__DUELZ_CELEBRATION_LOG__ ?? []),
  };
}

async function samples(page: Page) {
  return page.evaluate(() => (window as unknown as { __celSamples: { t: number; geo: string; boxes: Record<number, number[]>; scores: string[]; meter: boolean; list: boolean }[] }).__celSamples);
}

/** Every element's layout box from the screen's first frame to the end, against the last frame. */
async function judgeLayout(page: Page, where: string) {
  const list = await samples(page);
  const names = await page.evaluate(() => (window as unknown as { __celNames: Record<number, string> }).__celNames);
  check(list.length >= 10, `${where}: only ${list.length} layout samples`);
  const last = list[list.length - 1];
  if (!last) return;
  const settled = list.filter((sample) => sample.geo === last.geo);
  check(settled.length >= 8, `${where}: only ${settled.length} samples under the final geometry`);
  let worst = 0;
  let what = "";
  for (const sample of settled) {
    for (const [id, box] of Object.entries(sample.boxes)) {
      const end = last.boxes[Number(id)];
      if (!end) continue;
      const dy = Math.max(Math.abs(box[0]! - end[0]!), Math.abs(box[3]! - end[3]!));
      // A clock's own text ("Next round in 7s") changes its width: that is the screen, not a shift.
      const dx = box[4] || box[5] !== end[5] ? 0 : Math.max(Math.abs(box[1]! - end[1]!), Math.abs(box[2]! - end[2]!));
      const d = Math.max(dx, dy);
      if (d > worst) {
        worst = d;
        what = `element ${id} ${names[Number(id)] ?? ""} at ${Math.round(sample.t)} ms: ${box.slice(0, 4).join(",")} → ${end.slice(0, 4).join(",")}`;
      }
    }
  }
  check(worst <= 0.5, `${where}: layout shifted ${worst} px (${what})`);
}

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/${name}.jpg`, type: "jpeg", quality: 82 });
}

/** Calls the page's own celebrations module (the app's instance, through Vite). */
async function fire(page: Page, body: string) {
  await page.evaluate(`import("/src/lib/fx/celebrations.ts").then((C) => { const scope = C.celebrationScope(); ${body} })`);
}

/** The screen's markup, with the clock's own figures taken out (both runs draw them at different moments). */
async function markup(page: Page): Promise<string> {
  const html = await page.evaluate(() => document.getElementById("root")?.innerHTML ?? "");
  return html
    .replace(/\d+(\.\d+)?\s?s\b/g, "#s")
    .replace(/(in |closes in )\d+[^<]*/g, "$1#")
    .replace(/\d{1,2}:\d{2}/g, "#:#")
    .replace(/ style="[^"]*transform[^"]*"/g, "")
    .replace(/(:r[0-9a-z]+:|«r[0-9a-z]+»|r[0-9a-z]+-[a-z])/g, "#id");
}

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-celebrations", buildId: "celebrations-check" });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  if (RECORD) {
    // On main (today's screens): the markup each screen settles on.
    const out: Record<string, string> = {};
    for (const key of ["podium", "standings", "final2", "lobby3", "reveal150", "home"]) {
      const o = await open(browser, server.origin, key, null);
      out[key] = await markup(o.page);
      await o.close();
    }
    mkdirSync("scripts/fixtures", { recursive: true });
    writeFileSync(FIXTURE, `${JSON.stringify(out, null, 1)}\n`);
    console.log(`PASS: recorded ${Object.keys(out).length} screens to ${FIXTURE}`);
    process.exit(0);
  }

  const before = existsSync(FIXTURE) ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, string>) : null;
  check(!!before, `${FIXTURE} missing (record it on main with --record-off)`);

  // Switched off: no layer, meter, charge or request, and today's markup.
  const offFinal: Record<string, string[]> = {};
  for (const key of ["podium", "standings", "final2", "lobby3", "reveal150", "home"]) {
    const o = await open(browser, server.origin, key, false);
    check(!(await o.page.$("[data-celebration-layer]")), `off, ${key}: the layer is mounted`);
    check(!(await o.page.$("[data-charge-meter], [data-logo-charge]")), `off, ${key}: a meter or logo charge`);
    if (key === "home") {
      await o.page.getByRole("button", { name: "Create a room" }).click();
      await o.page.waitForTimeout(300);
    }
    check((await o.log()).length === 0, `off, ${key}: celebration requests ${(await o.log()).map((e) => e.kind).join(",")}`);
    if (before && key !== "home") check((await markup(o.page)) === before[key], `off, ${key}: the screen's markup differs from today's`);
    if (before && key === "home") check(true, "home markup is compared before Create");
    offFinal[key] = await o.page.evaluate(() => [
      ...Array.from(document.querySelectorAll("#root .th-score")).map((e) => e.textContent ?? ""),
      "|",
      ...Array.from(document.querySelectorAll("#root .th-name")).map((e) => e.textContent ?? ""),
    ]);
    await o.close();
  }
  {
    // The home screen's markup before any tap.
    const o = await open(browser, server.origin, "home", false);
    if (before) check((await markup(o.page)) === before.home, "off, home: the screen's markup differs from today's");
    await o.close();
  }

  // On: the podium.
  {
    const o = await open(browser, server.origin, "podium", true);
    const log = await o.log();
    check(log.some((e) => e.kind === "podiumHero"), "podium: no hero");
    check(log.some((e) => e.kind === "burst"), "podium: no burst");
    check(log.some((e) => e.kind === "banner" && e.text === "You win!") && log.some((e) => e.kind === "sound:zap"), "podium, winner: no You win! and zap");
    await judgeLayout(o.page, "podium");
    const final = await o.page.evaluate(() => [
      ...Array.from(document.querySelectorAll("#root .th-score")).map((e) => e.textContent ?? ""),
      "|",
      ...Array.from(document.querySelectorAll("#root .th-name")).map((e) => e.textContent ?? ""),
    ]);
    check(JSON.stringify(final) === JSON.stringify(offFinal.podium), `podium: the count-up ends on ${final.join(" ")}, the server's ${offFinal.podium?.join(" ")}`);
    // Taps through the layer while the banner and the hero are up.
    await fire(o.page, `C.showBanner(scope, "You win!", { burst: true });`);
    await o.page.waitForTimeout(250);
    const under = await o.page.evaluate(() => {
      const banner = document.querySelector("[data-celebration-banner]")!.getBoundingClientRect();
      const step = document.querySelector('[data-podium-step="1"]')!.getBoundingClientRect();
      return [
        document.elementFromPoint(banner.left + banner.width / 2, banner.top + banner.height / 2),
        document.elementFromPoint(step.right - 17, step.bottom - 25),
      ].map((el) => (el ? el.closest("[data-celebration-layer]") !== null : true));
    });
    check(under.every((x) => !x), "podium: the layer is what is under the banner or hero");
    await shot(o.page, "podium-hero-you-win");
    const row = o.page.locator("ul li button").first();
    await row.tap();
    check((await row.getAttribute("aria-expanded")) === "true", "podium: a tap under the layer does not reach the row");
    await o.close();
  }
  {
    const o = await open(browser, server.origin, "podiumLost", true);
    const log = await o.log();
    check(log.some((e) => e.kind === "podiumHero") && !log.some((e) => e.kind === "banner") && !log.some((e) => e.kind === "sound:zap"), `podium, not first: ${log.map((e) => e.kind).join(",")}`);
    await o.page.waitForTimeout(200);
    await fire(o.page, `C.podiumHero(scope, document.querySelector('[data-podium-step="1"]')); const b = document.querySelector('[data-podium-step="1"]').getBoundingClientRect(); C.sparkBurst(scope, b.right - 17, b.bottom - 30, { count: 44 });`);
    await o.page.waitForTimeout(220);
    await shot(o.page, "podium-hero");
    await o.close();
  }

  // On: standings count up, slide and spark; the final numbers and order are the server's.
  {
    const o = await open(browser, server.origin, "standings", true);
    const list = await samples(o.page);
    const first = list[0]?.scores ?? [];
    const end = list[list.length - 1]?.scores ?? [];
    check(first.join() !== end.join(), "standings: no count-up from the first frame");
    await judgeLayout(o.page, "standings");
    const final = await o.page.evaluate(() => [
      ...Array.from(document.querySelectorAll("#root .th-score")).map((e) => e.textContent ?? ""),
      "|",
      ...Array.from(document.querySelectorAll("#root .th-name")).map((e) => e.textContent ?? ""),
    ]);
    check(JSON.stringify(final) === JSON.stringify(offFinal.standings), `standings: the count-up ends on ${final.join(" ")}, the server's ${offFinal.standings?.join(" ")}`);
    check((await o.log()).some((e) => e.kind === "burst"), "standings: a climb has no sparks");
    await o.close();
  }
  {
    const o = await open(browser, server.origin, "final2", true);
    const final = await o.page.evaluate(() => [
      ...Array.from(document.querySelectorAll("#root .th-score")).map((e) => e.textContent ?? ""),
      "|",
      ...Array.from(document.querySelectorAll("#root .th-name")).map((e) => e.textContent ?? ""),
    ]);
    check(JSON.stringify(final) === JSON.stringify(offFinal.final2), `final results: the count-up ends on ${final.join(" ")}, the server's ${offFinal.final2?.join(" ")}`);
    await judgeLayout(o.page, "final results");
    await o.close();
  }

  // On: the lobby meter, reserved from the first frame; a join crackles; 10/10.
  {
    const o = await open(browser, server.origin, "lobby3", true);
    const list = await samples(o.page);
    check(list.length > 0 && list.filter((s) => s.list).every((s) => s.meter), "lobby: the meter is not there from the list's first frame");
    const placed = await o.page.evaluate(() => {
      const meter = document.querySelector("[data-charge-meter]") as HTMLElement | null;
      const line = meter?.previousElementSibling as HTMLElement | null;
      if (!meter || !line) return null;
      return { line: line.textContent, own: meter.textContent, gap: meter.getBoundingClientRect().top - line.getBoundingClientRect().bottom, h: meter.getBoundingClientRect().height };
    });
    check(placed?.line === "3 of 10 players" && placed.own === "" && placed.gap >= 0 && placed.gap <= 8 && placed.h === 20, `lobby: the meter is not directly under "3 of 10 players" with no label of its own (${JSON.stringify(placed)})`);
    await judgeLayout(o.page, "lobby");
    await shot(o.page, "lobby-meter-3-of-10");
    await o.page.evaluate(() => {
      const h = (window as unknown as { __harness: { update: (f: (r: { players: Record<string, unknown>[] }) => void) => void } }).__harness;
      h.update((r) => {
        const p = r.players[0]!;
        r.players.push({ ...p, id: "p4", player_slot: 4, user_id: "u4", display_name: "Jordan" });
      });
    });
    await o.page.waitForTimeout(300);
    check((await o.log()).some((e) => e.kind === "sound:crackle"), "lobby: a join does not crackle");
    check((await o.page.getAttribute("[data-charge-meter]", "data-charge-meter")) === "4" && (await o.page.evaluate(() => document.querySelector("[data-charge-meter]")?.previousElementSibling?.textContent)) === "4 of 10 players", "lobby: the meter or its line after a join");
    await o.close();
  }
  {
    const o = await open(browser, server.origin, "lobby10", true);
    check((await o.page.getAttribute("[data-charge-meter]", "data-charge-meter")) === "10", "lobby: meter at 10");
    await fire(o.page, `C.sparkBurstOn(scope, document.querySelector(".charge-meter-track"), { row: true, count: 60 });`);
    await o.page.evaluate(() => document.querySelector("[data-charge-meter]")?.scrollIntoView({ block: "center" }));
    await o.page.waitForTimeout(160);
    await shot(o.page, "lobby-meter-10-of-10");
    await o.close();
  }

  // On: the hero run at 150, never at 149.
  {
    const o = await open(browser, server.origin, "reveal150", true);
    check((await o.log()).filter((e) => e.kind === "heroRun").length === 1, `reveal 150: hero runs ${(await o.log()).filter((e) => e.kind === "heroRun").length} times`);
    await judgeLayout(o.page, "reveal");
    await fire(o.page, `C.heroRun(scope);`);
    await o.page.waitForTimeout(700);
    await shot(o.page, "hero-run");
    await o.close();
    const p = await open(browser, server.origin, "reveal149", true);
    check(!(await p.log()).some((e) => e.kind === "heroRun"), "reveal 149: the hero runs");
    await p.close();
  }

  // On: GO's strike and zap, and none on Prepare to Duel.
  {
    const o = await open(browser, server.origin, "prepare", true);
    check(!(await o.log()).some((e) => e.kind === "strike" || e.kind === "sound:zap"), "Prepare to Duel: a strike or zap");
    await o.close();
    const screen = SCREENS.prepare!;
    SCREENS.go = { ...screen, name: "countdown", room: countdown(4200), ready: "#root *", waitMs: 0 };
    const g = await open(browser, server.origin, "go", true);
    const goAt = await g.page.evaluate(() => Date.now());
    await g.page.waitForTimeout(4200);
    const log = await g.log();
    const strike = log.find((e) => e.kind === "strike");
    check(!!strike && log.some((e) => e.kind === "sound:zap"), `GO: ${log.map((e) => e.kind).join(",") || "nothing"}`);
    check(log.filter((e) => e.kind === "strike").length === 1, "GO: more than one strike");
    if (strike) check(Math.abs(strike.at - goAt) < 4200, "GO: the strike is not on GO");
    await fire(g.page, `C.goStrike();`);
    await g.page.waitForTimeout(140);
    await shot(g.page, "go-lightning");
    await g.close();
  }

  // On: Create a room's zap; the logo's charge-in.
  {
    const o = await open(browser, server.origin, "home", true);
    check(!!(await o.page.$("[data-app-wordmark] [data-logo-charge]")), "home: the first logo does not charge in");
    await o.page.getByRole("button", { name: "Create a room" }).click();
    await o.page.waitForTimeout(300);
    check((await o.log()).some((e) => e.kind === "sound:zap"), "Create a room: no zap");
    await o.close();
    if (SHOTS) {
      // The charge-in part-way: the logo's SMIL clock paused at 0.3 s.
      const c = await open(browser, server.origin, "home", true);
      await c.page.evaluate(() => {
        const svg = document.querySelector("[data-logo-charge]") as SVGSVGElement | null;
        svg?.pauseAnimations();
        svg?.setCurrentTime(0.3);
      });
      const box = await c.page.locator("[data-app-wordmark]").boundingBox();
      if (box) await c.page.screenshot({ path: `${SHOTS}/logo-charge-in.jpg`, type: "jpeg", quality: 90, clip: { x: Math.max(0, box.x - 12), y: Math.max(0, box.y - 10), width: box.width + 24, height: box.height + 20 } });
      await c.close();
    }
  }

  // Banners mid-animation (the moments that need a finished practice run or a daily streak).
  if (SHOTS) {
    const o = await open(browser, server.origin, "reveal150", true);
    await fire(o.page, `C.showBanner(scope, "New best!", { burst: true });`);
    await o.page.waitForTimeout(260);
    await shot(o.page, "practice-new-best");
    await o.close();
    const d = await open(browser, server.origin, "final2", true);
    await fire(d.page, `C.showBanner(scope, C.streakBannerText(7), { burst: true });`);
    await d.page.waitForTimeout(260);
    await shot(d.page, "daily-7-day-streak");
    await d.close();
    // The count-up part-way: the round's scores land again (the totals count to them), caught at 0.45 s.
    const s = await open(browser, server.origin, "standings", true);
    await s.page.evaluate(() => {
      const h = (window as unknown as { __harness: { update: (f: (r: { results: { player_slot: number; round_number: number; score: number }[] }) => void) => void } }).__harness;
      h.update((r) => {
        for (const row of r.results) if (row.round_number === 2) row.score += 20 + (10 - row.player_slot) * 9;
      });
    });
    await s.page.waitForTimeout(450);
    await shot(s.page, "standings-count-up");
    await s.close();
  }

  // Reduced motion: final totals from the first frame, no sparks or run, the hero calm.
  {
    const o = await open(browser, server.origin, "podium", true, { reduced: true });
    const log = await o.log();
    check(log.some((e) => e.kind === "podiumHero") && !log.some((e) => e.kind === "burst"), `reduced motion, podium: ${log.map((e) => e.kind).join(",")}`);
    check(log.some((e) => e.kind === "sound:zap"), "reduced motion: the sounds stop");
    const list = await samples(o.page);
    const first = list.find((s) => s.scores.length)?.scores ?? [];
    const end = list[list.length - 1]?.scores ?? [];
    check(first.length > 0 && first.join() === end.join(), `reduced motion, podium: totals count (${first.join(",")} → ${end.join(",")})`);
    await o.close();
    const r = await open(browser, server.origin, "reveal150", true, { reduced: true });
    check(!(await r.log()).some((e) => e.kind === "heroRun"), "reduced motion: the hero runs");
    await r.close();
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} browser checks failed`);
  process.exit(1);
}
console.log(`PASS: ${passes} browser checks`);
process.exit(0);
