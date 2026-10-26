/**
 * Before / after screenshots of the four tab pages' refresh (26 Oct 2026, a design tool, not a check):
 * the seven states drawn on the design canvas (T-Play, T-PlayFirst, T-Practice, T-Tournaments,
 * T-TournamentsEmpty, T-Profile, T-ProfileNew), each at 414×896 as an iPhone 11 home-screen app and
 * at 375×667 (the first screen, and scrolled to the end where the page scrolls), on the real screens through scripts/safe-area-harness.tsx (network stubbed).
 * Each state seeds this device's own records (name, look, practice bests and recent games, room
 * history, the daily record, a public-game schedule round the current time), so main and the branch
 * draw the same data: run it on each tree with a different --tag.
 *
 *   bun scripts/shots/tab-refresh-shots.ts [--out=screenshots/tab-refresh-oct-2026] [--tag=after] [--scale=2]
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium, type Browser } from "playwright";

import { startSafeAreaServer } from "../safe-area-server";
import { DEVICE_INIT, IPHONE11_APP, emulateDevice } from "../device-emulation";
import { dailyFixture } from "../daily-fixture";
import { ONBOARDING_KEY } from "../../src/lib/onboarding";
import { practiceBestKey } from "../../src/lib/duel/practiceBest";
import { currentPracticeStamp } from "../../src/lib/duel/practiceStamps";
import type { PuzzleType } from "../../src/lib/duel/types";

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/tab-refresh-oct-2026";
const TAG = process.argv.find((a) => a.startsWith("--tag="))?.slice(6) ?? "after";
const SCALE = Number(process.argv.find((a) => a.startsWith("--scale="))?.slice(8) ?? 2);
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
mkdirSync(OUT, { recursive: true });

/** A UK wall-clock date and time `offsetMin` minutes from now, rounded down to 5 minutes. */
function ukAt(offsetMin: number): { date: string; time: string } {
  const ms = Math.floor((Date.now() + offsetMin * 60_000) / 300_000) * 300_000;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}
const game = (startMin: number, lobbyMin: number, title: string) => {
  const start = ukAt(startMin);
  return { date: start.date, time: start.time, lobbyOpens: ukAt(lobbyMin).time, rounds: 6, roomCode: "JULZ", title };
};
const DAY = 24 * 60;
/** Tonight's game with its lobby opening in about 1 h 25 min, two later ones, and two past ones with results. */
const SCHEDULE = [
  game(-3 * DAY, -3 * DAY - 15, "Beta preview"),
  game(-DAY, -DAY - 15, "Launch night"),
  game(100, 85, "Thursday night game"),
  game(2 * DAY + 100, 2 * DAY + 85, "Tuesday night game"),
  game(4 * DAY + 100, 4 * DAY + 85, "Thursday night game"),
];
const BESTS: [PuzzleType, number][] = [
  ["unblock", 171],
  ["hover", 158],
  ["wordsmith", 164],
  ["slider", 141],
  ["wordhunt", 118],
  ["letterwheel", 152],
  ["sudoku", 96],
];

interface Seed {
  onboarded: boolean;
  name: string;
  look: { colour: number; icon: null } | null;
  bests: [string, number][];
  recent: string[];
  history: unknown[];
  dailyRecord: unknown;
  schedule: unknown[];
}

const FULL: Omit<Seed, "bests"> = {
  onboarded: true,
  name: "jfed2",
  look: { colour: 0, icon: null },
  recent: ["unblock", "hover", "wordhunt", "sudoku"],
  history: [
    { key: "a:1", code: "BLTZ", at: Date.now() - 20 * 3_600_000, players: 6, place: 1, points: 1036 },
    { key: "j:2", code: "JULZ", at: Date.now() - DAY * 60_000 + 30 * 60_000, players: 14, place: 2, points: 1082 },
    { key: "b:1", code: "QUIZ", at: Date.now() - 2 * DAY * 60_000, players: 5, place: 4, points: 788 },
    { key: "j:1", code: "JULZ", at: Date.now() - 3 * DAY * 60_000 + 30 * 60_000, players: 11, place: 3, points: 961 },
  ],
  dailyRecord: null,
  schedule: SCHEDULE,
};

const STATES: { file: string; mode: string; seed: Omit<Seed, "bests"> & { bests?: boolean }; dailies: boolean }[] = [
  { file: "t-play", mode: "home", seed: { ...FULL, bests: true }, dailies: true },
  {
    file: "t-play-first",
    mode: "home",
    seed: { onboarded: false, name: "", look: null, recent: [], history: [], dailyRecord: null, schedule: SCHEDULE.slice(2) },
    dailies: true,
  },
  { file: "t-practice", mode: "practice", seed: { ...FULL, bests: true }, dailies: false },
  { file: "t-tournaments", mode: "tournaments", seed: { ...FULL, bests: true }, dailies: false },
  {
    file: "t-tournaments-empty",
    mode: "tournaments",
    seed: { onboarded: true, name: "jfed2", look: null, recent: [], history: [], dailyRecord: null, schedule: [] },
    dailies: false,
  },
  { file: "t-profile", mode: "profile", seed: { ...FULL, bests: true }, dailies: true },
  {
    file: "t-profile-new",
    mode: "profile",
    seed: { onboarded: true, name: "", look: null, recent: [], history: [], dailyRecord: null, schedule: SCHEDULE.slice(2) },
    dailies: true,
  },
];

const VIEWPORTS = [
  { name: "414x896", w: IPHONE11_APP.w, h: IPHONE11_APP.h, app: true },
  { name: "375x667", w: 375, h: 667, app: false },
];

function seedDevice(s: Seed & { onboardingKey: string }) {
  try {
    (window as unknown as { __DUELZ_PUBLIC_GAMES__: unknown }).__DUELZ_PUBLIC_GAMES__ = s.schedule;
    if (s.onboarded) localStorage.setItem(s.onboardingKey, "1");
    if (s.name) localStorage.setItem("duelz_display_name", s.name);
    if (s.look) localStorage.setItem("duelz_player_look", JSON.stringify(s.look));
    if (s.recent.length) localStorage.setItem("duelz-practice-recent:v1", JSON.stringify(s.recent));
    if (s.history.length) localStorage.setItem("duelz-room-history:v1", JSON.stringify(s.history));
    for (const [key, best] of s.bests) localStorage.setItem(key, String(best));
    if (s.dailyRecord) localStorage.setItem("duelz.dailyRecord.v1", JSON.stringify(s.dailyRecord));
  } catch {
    /* ignore */
  }
}

async function shoot(browser: Browser, origin: string) {
  const fixture = dailyFixture();
  // The daily record: a three-day streak ending today, with bests (the Profile's Daily row).
  const today = fixture.after.status.day;
  const shift = (day: string, by: number) => new Date(Date.parse(`${day}T12:00:00Z`) + by * 86_400_000).toISOString().slice(0, 10);
  const record = { days: [shift(today, -2), shift(today, -1), today], best: { puzzle: 1104, arcade: 512 }, totals: {} };
  for (const state of STATES) {
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
        deviceScaleFactor: SCALE,
        hasTouch: true,
      });
      await context.addInitScript(DEVICE_INIT);
      await context.addInitScript(
        (r) => {
          (window as unknown as { __harness: unknown }).__harness = {
            puzzles: {},
            verdict: { isCorrect: true, score: 150 },
            latencyMs: 50,
            submissions: [],
            verdictAt: null,
            room: null,
            daily: r.daily ?? undefined,
            challengesAvailable: r.dailies,
            search: {},
          };
        },
        { daily: state.dailies ? fixture.after : null, dailies: state.dailies },
      );
      const seed: Seed & { onboardingKey: string } = {
        ...state.seed,
        dailyRecord: state.seed.history.length ? record : null,
        bests: state.seed.bests ? BESTS.map(([t, b]) => [practiceBestKey(t, currentPracticeStamp(t)), b]) : [],
        onboardingKey: ONBOARDING_KEY,
      };
      await context.addInitScript(seedDevice, seed);
      const page = await context.newPage();
      await page.goto(`${origin}/safe-area.html?mode=${state.mode}`, { timeout: 180_000 });
      await page.waitForSelector("#root *", { timeout: 60_000 });
      if (vp.app) await emulateDevice(page, IPHONE11_APP);
      await page.waitForTimeout(1800);
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      // The screen as first seen, then (when the page scrolls) scrolled to its end.
      const path = join(OUT, `${state.file}-${vp.name}-${TAG}.jpg`);
      await page.screenshot({ path, type: "jpeg", quality: 82 });
      console.log(`wrote ${path}`);
      const scrolls = await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        return window.scrollY > 0;
      });
      if (scrolls) {
        await page.waitForTimeout(400);
        const end = join(OUT, `${state.file}-${vp.name}-end-${TAG}.jpg`);
        await page.screenshot({ path: end, type: "jpeg", quality: 82 });
        console.log(`wrote ${end}`);
      }
      await context.close();
    }
  }
}

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-tab-refresh-shots", buildId: "tab-refresh-shots" });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  await shoot(browser, server.origin);
} finally {
  await browser.close();
  await server.close();
}
