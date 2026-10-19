/**
 * touch-highlight-check (18 Oct 2026, presentation only): no blue boxes on touch. On a phone, no
 * game or room screen shows a tap highlight, the browser's focus outline, a focus ring left by a
 * tap or a programmatic focus, or a text-selection box on a long press (styles.css "No blue boxes,
 * ever"); with a mouse or trackpad, keyboard focus still shows a ring.
 *
 * Headless Chromium as a touch phone (390×844, hasTouch, isMobile: no hover, a coarse pointer)
 * draws the real screens through scripts/safe-area-harness.tsx (network stubbed): the practice
 * list, a practice round intro and live puzzle board (Box Six), and a room's lobby, live puzzle
 * round, live arcade round (Gemstone), round result, standings and final results. On each:
 *  - every element's computed -webkit-tap-highlight-color is fully transparent;
 *  - every visible focusable element (buttons, links, inputs, [tabindex], [role=button]), focused
 *    as a keyboard would (focusVisible) and as a tap does, draws no outline and changes no
 *    box-shadow (no ring);
 *  - every element except where text is typed (inputs, text areas, editable text) has
 *    user-select none, so a long press selects nothing;
 *  - real taps (touchscreen) on the screen's first few buttons leave no outline or ring, and nor
 *    does real keyboard focus (Tab) on the touch device.
 * Then as a desktop browser (1366×768, mouse): Tab to the first button on the practice list and a
 * room lobby must show a visible focus ring (outline or ring shadow).
 *
 *   bun scripts/touch-highlight-check.tsx [screen name filter…]
 */
import { existsSync } from "node:fs";
import type { Page } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { DEVICE_INIT } from "./device-emulation";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData } from "../src/lib/duel/types";

const ONLY = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

const PUZZLE = splitPuzzle(withSeededRandom(41, () => generatePuzzle("sudoku"))).pub as PuzzleData;
const ARCADE = splitPuzzle(withSeededRandom(41, () => generatePuzzle("matchup"))).pub as PuzzleData;
const iso = (ms: number) => new Date(ms).toISOString();

function roomNow(status: "waiting" | "in_progress" | "finished", phase: string, opts: { players?: number; arcade?: boolean } = {}) {
  const now = Date.now();
  const count = opts.players ?? 3;
  const player = (slot: number) => ({
    id: `p${slot}`, duel_id: "duel-touch", player_slot: slot, display_name: ["Me", "Sam", "Priya", "Jo"][slot - 1] ?? `P${slot}`,
    user_id: `u${slot}`, ready_round: 1, intro_ready_round: 0, muted_by_host: false, last_reaction_at: null,
    last_seen_at: iso(now), status: "active", joined_at: iso(now - 60_000),
  });
  const result = (slot: number) => ({
    id: `r${slot}`, duel_id: "duel-touch", player_slot: slot, round_number: 1, answer: "", is_correct: slot !== 3,
    ms_remaining: 20_000 - slot * 900, reaction_avg_ms: null, correct_count: null, errors: null, extra: null,
    score: 150 - slot * 13, submitted_at: iso(now - 5_000),
  });
  const scored = status === "finished" || ["result", "standings"].includes(phase);
  const players = Array.from({ length: count }, (_, i) => player(i + 1));
  return {
    duel: {
      id: "duel-touch", room_code: "TOUCH", status, selected_categories: [], tournament_history: [], disbanded_at: null,
      host_user_id: "u1", max_players: 10, round_count: 1, round_order: [opts.arcade ? "matchup" : "sudoku"], no_maths: false,
      puzzles_public: [opts.arcade ? ARCADE : PUZZLE], current_round: status === "waiting" ? 0 : 1, phase,
      phase_started_at: iso(now + (phase === "puzzle" ? -2_000 : 500)), round_started_at: iso(now - 2_000),
      next_duel_id: null, created_at: iso(now - 60_000),
    },
    players,
    results: scored ? players.map((p) => result(p.player_slot)) : [],
  };
}

interface Screen {
  name: string;
  mode: "practice" | "room";
  room?: () => ReturnType<typeof roomNow>;
  go?: (page: Page) => Promise<void>;
  waitMs?: number;
}
const openIntro = async (page: Page) => {
  await page.getByRole("button", { name: "Box Six", exact: true }).first().click();
  await page.getByRole("button", { name: /^Ready/ }).first().waitFor({ timeout: 30_000 });
};
const openBoard = async (page: Page) => {
  await openIntro(page);
  await page.getByRole("button", { name: /^Ready/ }).first().click();
  await page.waitForSelector("[data-game-stage]", { timeout: 30_000 });
};
const ALL: Screen[] = [
  { name: "practice list", mode: "practice" },
  { name: "practice round intro", mode: "practice", go: openIntro },
  { name: "practice puzzle board", mode: "practice", go: openBoard, waitMs: 1500 },
  { name: "room lobby", mode: "room", room: () => roomNow("waiting", "starting") },
  { name: "room live puzzle round", mode: "room", room: () => roomNow("in_progress", "puzzle"), waitMs: 1500 },
  { name: "room live arcade round", mode: "room", room: () => roomNow("in_progress", "puzzle", { arcade: true }), waitMs: 1500 },
  { name: "room round result", mode: "room", room: () => roomNow("in_progress", "result"), waitMs: 2000 },
  { name: "room standings", mode: "room", room: () => roomNow("in_progress", "standings"), waitMs: 2000 },
  { name: "room final results", mode: "room", room: () => roomNow("finished", "result"), waitMs: 2500 },
];
const SCREENS = ONLY.length ? ALL.filter((s) => ONLY.some((o) => s.name.includes(o))) : ALL;

/** In-page: every tap highlight, selectable element and focus ring on touch. */
function touchProbe() {
  const problems: string[] = [];
  // The box-shadow layers that draw anything: a colour with alpha and a non-zero offset, blur or spread.
  const visible = (shadow: string) =>
    shadow === "none" ? "" : shadow.split(/,(?![^(]*\))/).map((x) => x.trim()).filter((x) => {
      const alpha = /rgba\([^)]*,\s*0\s*\)/.test(x) ? 0 : 1;
      return alpha > 0 && /(?:^|\s)-?[1-9][\d.]*px/.test(x.replace(/rgba?\([^)]*\)/g, ""));
    }).join(", ");

  const label = (el: Element) => {
    const h = el as HTMLElement;
    const name = h.getAttribute("aria-label") ?? h.textContent?.trim().slice(0, 24) ?? "";
    return `<${el.tagName.toLowerCase()}${h.className && typeof h.className === "string" ? ` .${h.className.split(" ")[0]}` : ""}>${name ? ` "${name}"` : ""}`;
  };
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) problems.push("not emulating a touch device (hover and a fine pointer match)");
  const transparent = (c: string) => c === "transparent" || /rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c);
  const typed = (el: Element) => el.matches("input, textarea, [contenteditable], [contenteditable] *");
  const all = [document.documentElement, ...Array.from(document.querySelectorAll("body, body *"))];
  let highlight = 0;
  let selectable = 0;
  for (const el of all) {
    const style = getComputedStyle(el);
    const tap = (style as unknown as { webkitTapHighlightColor?: string }).webkitTapHighlightColor ?? "";
    if (!transparent(tap) && highlight++ < 3) problems.push(`tap highlight ${tap} on ${label(el)}`);
    if (!typed(el) && style.userSelect !== "none" && (style as unknown as { webkitUserSelect?: string }).webkitUserSelect !== "none" && selectable++ < 3)
      problems.push(`text selectable (user-select ${style.userSelect}) on ${label(el)}`);
  }
  if (highlight > 3) problems.push(`…and ${highlight - 3} more tap highlights`);
  if (selectable > 3) problems.push(`…and ${selectable - 3} more selectable elements`);
  const focusables = Array.from(
    document.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex], [role=button]"),
  ).filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !(el as HTMLButtonElement).disabled && getComputedStyle(el).visibility !== "hidden";
  });
  let rings = 0;
  for (const el of focusables) {
    const before = visible(getComputedStyle(el).boxShadow);
    for (const focusVisible of [true, false]) {
      el.focus({ preventScroll: true, focusVisible } as FocusOptions);
      if (document.activeElement !== el) continue;
      const style = getComputedStyle(el);
      const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
      const after = visible(style.boxShadow);
      if ((outline || after !== before) && rings++ < 4)
        problems.push(`focus ${focusVisible ? "(keyboard-style)" : "(tap-style)"} draws ${outline ? `an outline ${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}` : `a ring ${after}`} on ${label(el)}`);
      el.blur();
    }
  }
  if (rings > 4) problems.push(`…and ${rings - 4} more focus rings`);
  return { problems, elements: all.length, focusables: focusables.length };
}

/** In-page: the focused element's outline or ring after real taps. */
function activeRing() {
  // The box-shadow layers that draw anything: a colour with alpha and a non-zero offset, blur or spread.
  const visible = (shadow: string) =>
    shadow === "none" ? "" : shadow.split(/,(?![^(]*\))/).map((x) => x.trim()).filter((x) => {
      const alpha = /rgba\([^)]*,\s*0\s*\)/.test(x) ? 0 : 1;
      return alpha > 0 && /(?:^|\s)-?[1-9][\d.]*px/.test(x.replace(/rgba?\([^)]*\)/g, ""));
    }).join(", ");
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return null;
  const style = getComputedStyle(el);
  const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
  // A ring is a shadow the focus adds: compare with the same element unfocused.
  const focused = visible(style.boxShadow);
  el.blur();
  const resting = visible(getComputedStyle(el).boxShadow);
  const ring = focused !== resting ? focused : "";
  return { outline, ring, tag: el.tagName, name: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 24) ?? "" };
}

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-touch-highlight", buildId: "touch-highlight-check" });
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
const failures: string[] = [];
const checked: string[] = [];

async function open(screen: Screen, touch: boolean) {
  const context = await browser.newContext(
    touch
      ? { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
      : { viewport: { width: 1366, height: 768 } },
  );
  await context.addInitScript(DEVICE_INIT);
  await context.addInitScript(
    (r) => {
      (window as unknown as { __harness: unknown }).__harness = {
        puzzles: { sudoku: r.puzzle }, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room: r.room,
      };
      try {
        localStorage.setItem(r.key, "1");
      } catch {
        /* ignore */
      }
    },
    { room: screen.room?.() ?? null, puzzle: PUZZLE, key: ONBOARDING_KEY },
  );
  const page = await context.newPage();
  const url = `${server.origin}/safe-area.html?mode=${screen.mode}`;
  try {
    await page.goto(url, { timeout: 180_000 });
  } catch (error) {
    if (!/Timeout \d+ms exceeded/.test(String((error as Error).message))) throw error;
    await page.goto(url, { timeout: 90_000 });
  }
  if (screen.mode === "practice") await page.getByRole("button", { name: "Box Six", exact: true }).first().waitFor({ timeout: 60_000 });
  else await page.waitForSelector("#root *", { timeout: 60_000 });
  await page.waitForTimeout(600);
  if (screen.go) await screen.go(page);
  await page.waitForTimeout(screen.waitMs ?? 600);
  return { context, page };
}

try {
  for (const screen of SCREENS) {
    const where = `${screen.name} (390x844 touch)`;
    const problems: string[] = [];
    let note = "";
    const { context, page } = await open(screen, true);
    try {
      const probe = await page.evaluate(touchProbe);
      problems.push(...probe.problems);
      // Real taps on the first few harmless buttons (never Leave, Ready or a submit).
      const buttons = await page.$$("button:not([disabled])");
      let tapped = 0;
      for (const button of buttons) {
        if (tapped >= 3) break;
        const name = ((await button.getAttribute("aria-label")) ?? (await button.textContent()) ?? "").trim();
        if (/leave|ready|submit|continue|play|create|join|send|report|mute|close|replay|again/i.test(name)) continue;
        const box = await button.boundingBox();
        if (!box || box.width < 4 || box.y < 0 || box.y > 830) continue;
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(120);
        const ring = await page.evaluate(activeRing);
        if (ring && (ring.outline || ring.ring)) problems.push(`a tap on "${name}" left ${ring.outline ? "an outline" : `a ring ${ring.ring}`} on <${ring.tag}> "${ring.name}"`);
        tapped++;
      }
      // Keyboard-style focus (:focus-visible) on a touch device: a paired keyboard, or a focus the
      // browser treats as one. Still no ring on touch.
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      let tabbed = 0;
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        const ring = await page.evaluate(activeRing);
        if (!ring) continue;
        tabbed++;
        if (ring.outline || ring.ring) {
          problems.push(`keyboard focus on a touch device drew ${ring.outline ? "an outline" : `a ring ${ring.ring}`} on <${ring.tag}> "${ring.name}"`);
          break;
        }
      }
      note = `${probe.elements} elements, ${probe.focusables} focusable, ${tapped} tapped, ${tabbed} tabbed`;
    } catch (error) {
      problems.push(String((error as Error).message ?? error).split("\n")[0]!);
    } finally {
      await context.close();
    }
    for (const p of problems) failures.push(`${where}: ${p}`);
    checked.push(screen.name);
    console.log(`${problems.length ? "FAIL" : "PASS"} ${where}: ${problems.length ? problems[0] : note}`);
  }

  // Desktop: keyboard focus keeps a visible ring.
  for (const screen of ALL.filter((s) => s.name === "practice list" || s.name === "room lobby")) {
    if (ONLY.length && !ONLY.some((o) => screen.name.includes(o))) continue;
    const where = `${screen.name} (1366x768 desktop, keyboard)`;
    const { context, page } = await open(screen, false);
    let shown: string | null = null;
    try {
      for (let i = 0; i < 12 && !shown; i++) {
        await page.keyboard.press("Tab");
        const ring = await page.evaluate(activeRing);
        if (ring && (ring.outline || ring.ring)) shown = `${ring.outline ? "outline" : "ring"} on <${ring.tag}> "${ring.name}"`;
      }
    } finally {
      await context.close();
    }
    if (!shown) failures.push(`${where}: no visible focus ring after up to 12 Tab presses`);
    console.log(`${shown ? "PASS" : "FAIL"} ${where}: ${shown ?? "no focus ring"}`);
  }
} finally {
  await browser.close();
  await server.close();
}

for (const f of failures) console.log(`  ${f}`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} problem(s): a tap highlight, touch focus ring or selection box on a game or room screen`);
  process.exit(1);
}
console.log(`PASS: no tap highlight, touch focus ring or text selection on ${checked.length} screens (${checked.join("; ")}); keyboard focus rings kept on desktop`);
