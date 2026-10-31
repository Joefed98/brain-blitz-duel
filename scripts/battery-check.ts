/**
 * Battery (31 Oct 2026, presentation, sound and network timing only; no game, stamp or score changed):
 * proves the app stops drawing, ticking and sounding when nothing changes.
 *
 * Headless Chromium as an iPhone 11 home-screen app (scripts/device-emulation.ts) draws the real
 * screens through scripts/safe-area-harness.tsx (network stubbed) and, after each settles, samples
 * them for 5 s (scripts/battery-probe.ts):
 *  - idle screens (Play, Practice, Tournaments, Profile, the lobby, round result, standings, the podium
 *    and a puzzle between moves): frames in which a requestAnimationFrame callback ran, frames the
 *    compositor drew (DrawFrame trace events) and running animations, all about 0 (a puzzle's timer
 *    ring and the results screens' countdowns step once a second, so at most ~1.5 drawn frames a second);
 *  - hidden: with the page hidden (visibilitychange), no requestAnimationFrame callback runs, the
 *    screen clock stops and the AudioContext is suspended; on return it ticks and resumes;
 *  - the pixel-ratio cap: at a device pixel ratio of 3, every canvas's backing store is at most 2× its
 *    CSS size (canvasRatio, src/lib/battery.ts);
 *  - sound: the AudioContext is suspended about 5 s after the last sound and running again for the next.
 *
 *   bun scripts/battery-check.ts [screen filter…] [--report]   (--report prints every figure)
 */
import { existsSync } from "node:fs";
import type { Browser, BrowserContext, Page } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { DEVICE_INIT, IPHONE11_APP, emulateDevice } from "./device-emulation";
import { FIXED_SCHEDULE, fixClock } from "./fixed-clock";
import { PROBE_INIT, measureIdle, type IdleFigures } from "./battery-probe";
import { showPracticeSide } from "./practice-side-lib";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { ONBOARDING_KEY } from "../src/lib/onboarding";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import type { PuzzleData } from "../src/lib/duel/types";

const args = process.argv.slice(2);
const REPORT = args.includes("--report");
/** --arcade=a,b,c: also report the average main-thread CPU time per frame while playing these games (practice). */
const ARCADE_REPORT = (args.find((a) => a.startsWith("--arcade="))?.slice(9) ?? "").split(",").filter(Boolean);
const ONLY = args.filter((a) => !a.startsWith("--"));
const ARCADE_ONLY = args.includes("--arcade-only");
/** --dpr=3: the device pixel ratio the arcade report plays at (default 2, an iPhone 11). */
const REPORT_DPR = Number(args.find((a) => a.startsWith("--dpr="))?.slice(6) ?? 2);
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}
const DEVICE = IPHONE11_APP;
const SAMPLE_MS = 5000;
/** Idle: no requestAnimationFrame loop (at most a stray frame a second) and no running animation. */
const IDLE_RAF_FPS = 1;
/** Drawn frames a second on an idle screen: a once-a-second countdown or timer ring is allowed. */
const IDLE_DRAWN_FPS = 1.5;
/** A screen waiting on other players: its dots step 2.5 times a second (styles.css dot-bounce) over an arena parked at 1 frame a second. */
const WAITING_DRAWN_FPS = 4;

/* ---------------------------------------------------------------- the room states */

const PUZZLE = splitPuzzle(withSeededRandom(41, () => generatePuzzle("sudoku"))).pub as PuzzleData;
const pub = (type: string) => splitPuzzle(withSeededRandom(41, () => generatePuzzle(type as never))).pub as PuzzleData;
const ARCADE_PUZZLES = Object.fromEntries([...new Set(["breaker", ...ARCADE_REPORT])].map((t) => [t, pub(t)]));
/** The arcade game the hidden, parked and pixel-ratio passes play (not one the T1–T4 tunings change). */
const LOOP_GAME = "breaker";
const iso = (ms: number) => new Date(ms).toISOString();

function roomNow(status: "waiting" | "in_progress" | "finished", phase: string, count = 4) {
  const now = Date.now();
  const players = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    duel_id: "duel-battery",
    player_slot: i + 1,
    display_name: ["Me", "Sam", "Priya", "Jordan", "Alex", "Robin"][i] ?? `Player ${i + 1}`,
    user_id: `u${i + 1}`,
    ready_round: 1,
    intro_ready_round: 0,
    muted_by_host: false,
    last_reaction_at: null,
    last_seen_at: iso(now),
    status: "active",
    joined_at: iso(now - 60_000),
  }));
  const scored = status === "finished" || ["result", "standings"].includes(phase);
  return {
    duel: {
      id: "duel-battery",
      room_code: "SAFE",
      status,
      selected_categories: [],
      tournament_history: [],
      disbanded_at: null,
      host_user_id: "u1",
      max_players: 10,
      round_count: 2,
      round_order: ["sudoku", "sudoku"],
      no_maths: false,
      puzzles_public: [PUZZLE, PUZZLE],
      current_round: status === "waiting" ? 0 : 1,
      phase,
      phase_started_at: iso(now),
      round_started_at: iso(now),
      next_duel_id: null,
      created_at: iso(now - 60_000),
    },
    players,
    results: scored
      ? players.map((p) => ({
          id: `r${p.player_slot}`,
          duel_id: "duel-battery",
          player_slot: p.player_slot,
          round_number: 1,
          answer: "",
          is_correct: true,
          ms_remaining: 20_000 - p.player_slot * 900,
          reaction_avg_ms: null,
          correct_count: null,
          errors: null,
          extra: null,
          score: 150 - p.player_slot * 13,
          submitted_at: iso(now - 5_000),
        }))
      : [],
  };
}

interface Screen {
  name: string;
  mode: "home" | "practice" | "tournaments" | "profile" | "room";
  room?: () => ReturnType<typeof roomNow>;
  go?: (page: Page) => Promise<void>;
  /** How long its entrance animations take to finish (ms) before it is idle. */
  settleMs: number;
  /** A live round: its timer ring steps once a second (drawn frames allowed up to IDLE_DRAWN_FPS). */
  timer?: boolean;
}

const playPuzzle = async (page: Page) => {
  await page.getByRole("button", { name: "Box Six", exact: true }).first().click();
  await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 30_000 });
  await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
};

const SCREENS: Screen[] = [
  { name: "Play tab", mode: "home", settleMs: 3500 },
  { name: "Practice list", mode: "practice", settleMs: 2500 },
  { name: "Tournaments", mode: "tournaments", settleMs: 2500 },
  { name: "Profile", mode: "profile", settleMs: 2500 },
  { name: "room lobby", mode: "room", room: () => roomNow("waiting", "starting"), settleMs: 3000 },
  { name: "round result", mode: "room", room: () => roomNow("in_progress", "result"), settleMs: 4500 },
  { name: "standings", mode: "room", room: () => roomNow("in_progress", "standings"), settleMs: 4500 },
  { name: "podium", mode: "room", room: () => roomNow("finished", "result"), settleMs: 8000 },
  { name: "puzzle between moves (Box Six)", mode: "practice", go: playPuzzle, settleMs: 2500, timer: true },
].filter((s) => !ARCADE_ONLY && (!ONLY.length || ONLY.some((o) => s.name.includes(o))));

/* ---------------------------------------------------------------- the run */

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-battery", buildId: "battery-check" });
const pageClock = fixClock();
const { chromium } = await import("playwright");
const browser: Browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--autoplay-policy=no-user-gesture-required"] });
const failures: string[] = [];
const lines: string[] = [];

async function open(screen: { mode: Screen["mode"]; room?: () => unknown }, dpr = 2): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: { width: DEVICE.w, height: DEVICE.h }, deviceScaleFactor: dpr, hasTouch: true });
  await context.addInitScript(pageClock.script, pageClock.arg);
  await context.addInitScript(DEVICE_INIT);
  await context.addInitScript(PROBE_INIT);
  await context.addInitScript(
    (r) => {
      (window as unknown as { __DUELZ_PUBLIC_GAMES__: unknown }).__DUELZ_PUBLIC_GAMES__ = r.schedule;
      (window as unknown as { __harness: unknown }).__harness = {
        puzzles: { sudoku: r.puzzle, ...r.arcade },
        verdict: { isCorrect: true, score: 150 },
        latencyMs: 50,
        submissions: [],
        verdictAt: null,
        room: r.room,
      };
      try {
        localStorage.setItem(r.key, "1");
      } catch {
        /* ignore */
      }
    },
    { room: screen.room?.() ?? null, puzzle: PUZZLE, arcade: ARCADE_PUZZLES, key: ONBOARDING_KEY, schedule: FIXED_SCHEDULE },
  );
  const page = await context.newPage();
  page.on("pageerror", (e) => failures.push(`page error: ${String(e.message).split("\n")[0]}`));
  await page.goto(`${server.origin}/safe-area.html?mode=${screen.mode}`, { timeout: 180_000 });
  if (screen.mode === "practice")
    await page.getByRole("button", { name: "Box Six", exact: true }).first().waitFor({ timeout: 60_000 });
  else await page.waitForSelector("#root *", { timeout: 60_000 });
  await emulateDevice(page, DEVICE);
  return { context, page };
}

const fmt = (f: IdleFigures) =>
  `${f.rafFps.toFixed(1)} rAF fps, ${f.drawnFps.toFixed(1)} drawn fps, ${f.mutationsPerS.toFixed(1)} DOM changes/s, ${f.taskMsPerS.toFixed(0)} ms task time/s`;

/** Fires visibilitychange as if the app went to the background (or came back). */
async function setHidden(page: Page, hidden: boolean): Promise<void> {
  await page.evaluate((h) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    document.dispatchEvent(new Event("visibilitychange"));
    if (h) window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    else window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  }, hidden);
}

try {
  /* Idle screens. */
  for (const screen of SCREENS) {
    const { context, page } = await open(screen);
    try {
      if (screen.go) await screen.go(page);
      await page.waitForTimeout(screen.settleMs);
      const f = await measureIdle(page, SAMPLE_MS);
      const problems: string[] = [];
      if (f.rafFps > IDLE_RAF_FPS) problems.push(`${f.rafFps.toFixed(1)} requestAnimationFrame frames a second (at most ${IDLE_RAF_FPS})`);
      if (f.drawnFps > IDLE_DRAWN_FPS) problems.push(`${f.drawnFps.toFixed(1)} drawn frames a second (at most ${IDLE_DRAWN_FPS})`);
      if (f.running.length) problems.push(`${f.running.length} running animation(s): ${f.running.slice(0, 4).join("; ")}`);
      lines.push(`${screen.name}: ${fmt(f)}`);
      if (problems.length) failures.push(`${screen.name} idle: ${problems.join("; ")}`);
      console.log(`${problems.length ? "FAIL" : "PASS"} idle ${screen.name}: ${fmt(f)}${problems.length ? ` — ${problems.join("; ")}` : ""}`);
      if (REPORT && f.running.length) console.log(`  running: ${f.running.join("; ")}`);
    } finally {
      await context.close();
    }
  }
  /* Arcade loops: the pixel-ratio cap, hidden and back, parked once locked; and the AudioContext. */
  if (!ARCADE_ONLY && (!ONLY.length || ONLY.includes("loops"))) {
    const rafCount = (page: Page) =>
      page.evaluate(() => (window as unknown as { __battery: { rafFrames: number } }).__battery.rafFrames);
    const framesOver = async (page: Page, ms: number) => {
      const a = await rafCount(page);
      await page.waitForTimeout(ms);
      return ((await rafCount(page)) - a) / (ms / 1000);
    };
    const play = async (page: Page, game: string) => {
      await showPracticeSide(page, game);
      await page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first().click();
      await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 30_000 });
      await page.locator("[data-arcade-play] canvas").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(1500);
    };

    // A 3× phone: every canvas's backing store at most 2× its CSS size, while Breaker plays.
    {
      const { context, page } = await open({ mode: "practice" }, 3);
      try {
        await play(page, LOOP_GAME);
        const canvases = await page.evaluate(() =>
          [...document.querySelectorAll("canvas")]
            .filter((c) => c.clientWidth > 0 && c.clientHeight > 0)
            .map((c) => ({ ratio: Math.max(c.width / c.clientWidth, c.height / c.clientHeight), what: c.dataset["arenaScene"] !== undefined ? "scene" : c.className || "canvas" })),
        );
        const over = canvases.filter((c) => c.ratio > 2.02);
        const note = `${canvases.length} canvases at DPR 3, largest ratio ${Math.max(0, ...canvases.map((c) => c.ratio)).toFixed(2)}`;
        if (!canvases.length) failures.push("pixel-ratio cap: no canvas drawn while Breaker plays");
        if (over.length) failures.push(`pixel-ratio cap: ${over.length} canvas(es) over 2×: ${over.map((c) => `${c.what} ${c.ratio.toFixed(2)}`).join(", ")}`);
        console.log(`${over.length || !canvases.length ? "FAIL" : "PASS"} pixel-ratio cap: ${note}`);
        lines.push(`pixel ratio: ${note}`);

        // Hidden: no frame runs; back: the loop draws again.
        const playing = await framesOver(page, 1500);
        await setHidden(page, true);
        await page.waitForTimeout(300);
        const hidden = await framesOver(page, 2000);
        await setHidden(page, false);
        await page.waitForTimeout(300);
        const back = await framesOver(page, 1500);
        const ok = playing > 30 && hidden === 0 && back > 30;
        if (!ok) failures.push(`hidden: Breaker drew ${playing.toFixed(0)} fps playing, ${hidden.toFixed(1)} hidden (want 0), ${back.toFixed(0)} back (want > 30)`);
        console.log(`${ok ? "PASS" : "FAIL"} hidden: Breaker ${playing.toFixed(0)} fps playing, ${hidden.toFixed(1)} fps hidden, ${back.toFixed(0)} fps on return`);
        lines.push(`hidden: ${playing.toFixed(0)} → ${hidden.toFixed(1)} → ${back.toFixed(0)} fps`);
      } finally {
        await context.close();
      }
    }

    // Parked: a room round whose answer is stored ("Waiting for other players") stops drawing.
    {
      const room = () => {
        const r = roomNow("in_progress", "puzzle", 4);
        const breaker = ARCADE_PUZZLES[LOOP_GAME]!;
        r.duel.round_count = 1;
        r.duel.round_order = [LOOP_GAME];
        r.duel.puzzles_public = [breaker, breaker];
        r.duel.phase_started_at = iso(Date.now() - 5_000);
        r.duel.round_started_at = r.duel.phase_started_at;
        r.results = [
          { id: "r1", duel_id: "duel-battery", player_slot: 1, round_number: 1, answer: "", is_correct: true, ms_remaining: 40_000, reaction_avg_ms: null, correct_count: null, errors: null, extra: null, score: 120, submitted_at: iso(Date.now() - 1_000) },
        ];
        return r;
      };
      const { context, page } = await open({ mode: "room", room }, 2);
      try {
        await page.locator("[data-game-arena] canvas").first().waitFor({ timeout: 30_000 });
        await page.waitForTimeout(3500);
        const f = await measureIdle(page, SAMPLE_MS);
        // The waiting dots' step animation (styles.css dot-bounce) is the one allowed: it draws only at its steps.
        const endless = f.running.filter((r) => !r.startsWith("dot-bounce "));
        const ok = f.rafFps <= IDLE_RAF_FPS + 0.5 && f.drawnFps <= WAITING_DRAWN_FPS && !endless.length;
        if (REPORT && f.running.length) console.log(`  running: ${f.running.join("; ")}`);
        if (!ok) failures.push(`parked: a locked room arena still drew ${f.rafFps.toFixed(1)} rAF frames and ${f.drawnFps.toFixed(1)} frames a second (at most ${IDLE_RAF_FPS + 0.5} and ${WAITING_DRAWN_FPS}); other running animations: ${endless.join("; ") || "none"}`);
        console.log(`${ok ? "PASS" : "FAIL"} parked: locked room arena (Waiting for other players): ${fmt(f)}`);
        lines.push(`locked room arena: ${fmt(f)}`);
      } finally {
        await context.close();
      }
    }

    // Sound: suspended about 5 s after the last sound, running again for the next; suspended while hidden.
    {
      const { context, page } = await open({ mode: "practice" }, 2);
      try {
        await page.mouse.click(5, 5);
        type Sound = typeof import("../src/lib/sound");
        const state = () =>
          page.evaluate(async () => {
            const m = (await import("/src/lib/sound.ts" as string)) as Sound;
            return m.audioPowerState();
          });
        await page.evaluate(async () => {
          const m = (await import("/src/lib/sound.ts" as string)) as Sound;
          m.unlockAudio();
        });
        await page.waitForTimeout(400);
        const start = await state();
        // The list's own menu music is a sound (never silent while it plays): stopped for this pass.
        const track = await page.evaluate(async () => {
          const m = (await import("/src/lib/sound.ts" as string)) as Sound;
          const name = m.soundDiagnostics().currentTrack;
          m.setMusicMuted(true);
          m.stopMusic(0);
          m.playTone(660, 120);
          return name;
        });
        await page.waitForTimeout(3000);
        const early = await state();
        await page.waitForTimeout(3200);
        const quiet = await state();
        const woke = await page.evaluate(async () => {
          const m = (await import("/src/lib/sound.ts" as string)) as Sound;
          m.playTone(660, 120);
          const t0 = performance.now();
          while (m.audioPowerState().state !== "running" && performance.now() - t0 < 1000) await new Promise((r) => setTimeout(r, 5));
          return { ...m.audioPowerState(), ms: Math.round(performance.now() - t0) };
        });
        // A long sound keeps it running through a hide; the return resumes it.
        await page.evaluate(async () => {
          const m = (await import("/src/lib/sound.ts" as string)) as Sound;
          m.playTone(330, 4000, "sine", 0.01);
        });
        await setHidden(page, true);
        await page.waitForTimeout(300);
        const hidden = await state();
        await setHidden(page, false);
        await page.waitForTimeout(300);
        const back = await state();
        const ok =
          start.state === "running" &&
          early.state === "running" &&
          quiet.state === "suspended" &&
          quiet.idle &&
          woke.state === "running" &&
          woke.live > 0 &&
          hidden.state === "suspended" &&
          back.state === "running";
        const note = `${track ? `menu music (${track}) stopped; ` : ""}running after unlock (${start.state}), still running 3 s after a sound (${early.state}), ${quiet.state} after ~6 s of silence (${quiet.live} sources live), ${woke.state} ${woke.ms} ms after the next sound with it playing, ${hidden.state} hidden, ${back.state} on return`;
        if (!ok) failures.push(`sound: ${note}`);
        console.log(`${ok ? "PASS" : "FAIL"} sound: ${note}`);
        lines.push(`sound: ${note}`);
      } finally {
        await context.close();
      }
    }
  }
  /* Arcade: CPU time per frame while playing (a report, not judged). */
  for (const game of ARCADE_REPORT) {
    const { context, page } = await open({ mode: "practice" }, REPORT_DPR);
    try {
      await showPracticeSide(page, game);
      await page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first().click();
      await page.getByRole("button", { name: /^Ready/ }).first().click({ timeout: 30_000 });
      await page.locator("[data-arcade-play] canvas").first().waitFor({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      const box = (await page.locator("[data-game-arena]").first().boundingBox())!;
      let taps = 0;
      const tapper = setInterval(() => {
        const x = box.x + box.width * (0.3 + 0.4 * ((taps * 37) % 10) / 10);
        const y = box.y + box.height * (0.4 + 0.4 * ((taps * 53) % 10) / 10);
        taps++;
        void page.mouse.click(x, y).catch(() => undefined);
      }, 400);
      const f = await measureIdle(page, SAMPLE_MS);
      clearInterval(tapper);
      const perFrame = f.rafFps > 0 ? f.taskMsPerS / f.rafFps : 0;
      lines.push(`${game}: ${f.rafFps.toFixed(0)} fps, ${perFrame.toFixed(2)} ms CPU a frame`);
      console.log(`REPORT arcade ${game}: ${f.rafFps.toFixed(0)} fps, ${perFrame.toFixed(2)} ms main-thread CPU a frame (${f.taskMsPerS.toFixed(0)} ms/s)`);
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
  await server.close();
}

for (const f of failures) console.log(`  ${f}`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} problem(s)`);
  process.exit(1);
}
console.log(`PASS: battery: ${lines.join("; ")}`);
