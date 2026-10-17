/**
 * room-extras-check (17 Oct 2026, display only): the room's live "finished" pings and the arcade
 * reveal's score chart, drawn with the real room screen (src/routes/duel.$code.tsx) through
 * scripts/safe-area-harness.tsx (network edge stubbed, scripts/safe-area-server.ts).
 *
 *  1. Pings: an arcade round (Hover), a puzzle round (Box Six) and a board without a score strip
 *     (Double Take), in 2- and 4-player rooms, as an iPhone 11 home-screen app (414x896, 48/34 px
 *     insets) and at 390x844 (47/34 px insets). Other players finish mid-round; the strip must
 *     appear, name them ("Ali and Jo finished"), sit below the notch, and never overlap the play
 *     area, the timer, "?", sound, Leave or any control, and the play area must not move when it
 *     appears or when it clears (about 3 s later). It never shows a score.
 *  2. The chart: Hover's room reveal at 414x896 (the home-screen app) with 2, 6 and 10 players,
 *     in both looks (`?chart=snake`, `?chart=rows`): two players three points apart and a tie
 *     among them. Every marker sits on its score's row, no two overlap, "You" is ringed, the
 *     labels are drawn, and the whole chart is on screen, unclipped, above the home bar.
 *
 *   bun scripts/room-extras-check.ts [--verbose] [--shots=<dir>]   (screenshots for review)
 */
import { existsSync, mkdirSync } from "node:fs";
import type { Browser, Page } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { gotoRetried, warmUp } from "./browser-load";
import { DEVICE_INIT, IPHONE11_APP, emulateDevice, type DeviceConfig } from "./device-emulation";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { chartRow } from "../src/lib/duel/arcadeChart";
import type { PuzzleData } from "../src/lib/duel/types";

const VERBOSE = process.argv.includes("--verbose");
const SHOTS = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
if (!CHROMIUM) {
  console.log("FAIL: environment: no Chromium (set PLAYWRIGHT_CHROMIUM)");
  process.exit(1);
}

const PHONE_390: DeviceConfig = { key: "390x844", label: "390x844", w: 390, h: 844, screenH: 844, top: 47, bottom: 34, standalone: false };
const SIZES = [IPHONE11_APP, PHONE_390];
const NAMES = ["Me", "Ali", "Jo", "Priyanka", "Kwame", "Lena", "Tom", "Mia", "Zed", "Christopher"];
const iso = (ms: number) => new Date(ms).toISOString();
const puzzleOf = (type: string) => splitPuzzle(withSeededRandom(41, () => generatePuzzle(type as never))).pub as PuzzleData;

function room(type: string, puzzle: PuzzleData, players: number, phase: string, scores: number[] = []) {
  const now = Date.now();
  return {
    duel: {
      id: "duel-safe",
      room_code: "SAFE",
      status: "in_progress",
      selected_categories: [],
      tournament_history: [],
      disbanded_at: null,
      host_user_id: "u1",
      max_players: 10,
      round_count: 6,
      round_order: Array.from({ length: 6 }, () => type),
      no_maths: false,
      puzzles_public: Array.from({ length: 6 }, () => puzzle),
      current_round: 2,
      phase,
      phase_started_at: iso(now + 500),
      round_started_at: iso(now + 500),
      next_duel_id: null,
      created_at: iso(now - 60_000),
    },
    players: Array.from({ length: players }, (_, i) => ({
      id: `p${i + 1}`,
      duel_id: "duel-safe",
      player_slot: i + 1,
      display_name: NAMES[i]!,
      user_id: `u${i + 1}`,
      ready_round: 2,
      intro_ready_round: 2,
      muted_by_host: false,
      last_reaction_at: null,
      last_seen_at: iso(now),
      status: "active",
      joined_at: iso(now - 60_000),
      submitted_round: 1,
      colour: i,
      icon: null,
    })),
    results: scores.map((score, i) => ({
      id: `r${i + 1}`,
      duel_id: "duel-safe",
      player_slot: i + 1,
      round_number: 2,
      answer: "",
      is_correct: false,
      ms_remaining: 0,
      reaction_avg_ms: null,
      correct_count: null,
      errors: null,
      extra: {
        reveal: {
          axis: { value: Math.round(score / 10), max: 15, label: "Barriers passed" },
          lines: [`${Math.round(score / 10)} / 15 barriers → ${score}`],
          tiles: [{ label: "Survived", value: "60 s" }],
          outcome: "time",
        },
      },
      score,
      submitted_at: iso(now - 5_000),
    })),
  };
}

async function open(browser: Browser, device: DeviceConfig, r: unknown, query = ""): Promise<{ page: Page; close: () => Promise<void>; errors: string[] }> {
  const context = await browser.newContext({ viewport: { width: device.w, height: device.screenH } });
  await context.addInitScript(DEVICE_INIT);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message.split("\n")[0]!));
  await page.addInitScript((rr) => {
    (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 150 }, latencyMs: 50, submissions: [], verdictAt: null, room: rr };
  }, r);
  await gotoRetried(page, `${origin}/safe-area.html?mode=room${query}`, "room");
  await emulateDevice(page, device);
  await page.evaluate(() => document.fonts.ready);
  return { page, close: () => context.close(), errors };
}

type Box = { x: number; y: number; w: number; h: number; what: string };
function geometry() {
  const box = (el: Element, what: string) => {
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, what };
  };
  const ping = document.querySelector("[data-finished-ping]");
  const keep: Box[] = [];
  const region = document.querySelector("[data-game-region]");
  if (region) keep.push(box(region, "play area"));
  for (const el of document.querySelectorAll("[role='timer'], [data-arcade-timer]")) keep.push(box(el, "timer"));
  for (const el of document.querySelectorAll("button, [role='button'], [data-sound-controls]"))
    if (!ping?.contains(el)) keep.push(box(el, (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim().slice(0, 20) || "control"));
  const stage = document.querySelector("[data-game-stage]");
  return {
    ping: ping ? { ...box(ping, "ping"), text: ping.textContent ?? "" } : null,
    keep: keep.filter((b) => b.w > 0 && b.h > 0),
    stage: stage ? box(stage, "stage") : null,
  };
}
const overlap = (a: Box, b: Box) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const same = (a: Box | null, b: Box | null) => !!a && !!b && ["x", "y", "w", "h"].every((k) => Math.abs(a[k as "x"] - b[k as "x"]) < 0.5);

const failures: string[] = [];
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-room-extras", buildId: "room-extras-check" });
const origin = server.origin;
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  await warmUp(browser, `${origin}/safe-area.html?mode=home`, (p) => p.waitForSelector("#root *", { timeout: 120_000 }), {
    init: () => {
      (window as unknown as { __harness: unknown }).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 0 }, latencyMs: 0, submissions: [], verdictAt: null, room: null };
    },
    verbose: VERBOSE,
  });

  /* 1. Pings. */
  const CASES = [
    { name: "arcade Hover", type: "hover" },
    { name: "puzzle Box Six", type: "sudoku" },
    { name: "Double Take (no score strip)", type: "spotdiff" },
  ];
  for (const device of SIZES) {
    for (const c of CASES) {
      for (const players of [2, 4]) {
        const where = `ping ${c.name}, ${players} players, ${device.key}`;
        const fails: string[] = [];
        const { page, close, errors } = await open(browser, device, room(c.type, puzzleOf(c.type), players, "puzzle"));
        try {
          await page.waitForSelector("[data-game-stage]", { timeout: 60_000 });
          await page.waitForTimeout(1200);
          const before = await page.evaluate(geometry);
          if (before.ping) fails.push("a ping showed before anyone finished this round");
          // Others finish (one in a 2-player room, two together in a 4-player room).
          await page.evaluate((n) => {
            const H = (window as unknown as { __harness: { update: (f: (r: { players: { player_slot: number; submitted_round: number }[] }) => void) => void } }).__harness;
            H.update((r) => {
              r.players = r.players.map((p) => (p.player_slot >= 2 && p.player_slot <= 1 + n ? { ...p, submitted_round: 2 } : p));
            });
          }, players === 2 ? 1 : 2);
          await page.waitForSelector("[data-finished-ping]", { timeout: 5_000 });
          await page.waitForTimeout(350);
          const shown = await page.evaluate(geometry);
          const want = players === 2 ? "Ali finished" : "Ali and Jo finished";
          if (!shown.ping) fails.push("no ping");
          else {
            if (!shown.ping.text.includes(want)) fails.push(`ping reads "${shown.ping.text}", want "${want}"`);
            if (/\d/.test(shown.ping.text)) fails.push(`ping shows a number: "${shown.ping.text}"`);
            if (shown.ping.y < device.top - 0.5) fails.push(`ping under the notch (y ${shown.ping.y})`);
            for (const k of shown.keep) if (overlap(shown.ping, k)) fails.push(`ping overlaps ${k.what} (${JSON.stringify(k)})`);
          }
          if (!same(before.stage, shown.stage)) fails.push(`the play area moved when the ping appeared (${JSON.stringify(before.stage)} → ${JSON.stringify(shown.stage)})`);
          if (SHOTS) await page.screenshot({ path: `${SHOTS}/ping-${c.type}-${players}p-${device.key}.png`, clip: { x: 0, y: 0, width: device.w, height: 200 } });
          await page.waitForTimeout(3600);
          const after = await page.evaluate(geometry);
          if (after.ping) fails.push("the ping did not clear");
          if (!same(before.stage, after.stage)) fails.push("the play area moved when the ping cleared");
          if (errors.length) fails.push(`page errors: ${[...new Set(errors)].slice(0, 2).join(" | ")}`);
        } catch (error) {
          fails.push(String((error as Error).message ?? error).split("\n")[0]!);
        } finally {
          await close();
        }
        for (const f of fails) failures.push(`${where}: ${f}`);
        console.log(`${fails.length ? "FAIL" : "PASS"} ${where}${fails.length ? `: ${fails[0]}` : ""}`);
      }
    }
  }

  /* 2. The chart. */
  const hover = puzzleOf("hover");
  const ROOMS: Record<number, number[]> = {
    2: [132, 135],
    6: [12, 47, 51, 88, 88, 131],
    10: [3, 27, 50, 64, 64, 99, 101, 118, 121, 150],
  };
  for (const style of ["snake", "rows"]) {
    for (const [n, scores] of Object.entries(ROOMS)) {
      const where = `chart ${style}, ${n} players, ${IPHONE11_APP.key}`;
      const fails: string[] = [];
      const { page, close, errors } = await open(browser, IPHONE11_APP, room("hover", hover, Number(n), "reveal", scores), `&chart=${style}`);
      try {
        await page.waitForSelector("[data-chart-marker]", { timeout: 60_000 });
        await page.waitForTimeout(1500);
        const g = await page.evaluate(() => {
          const box = (el: Element) => {
            const r = el.getBoundingClientRect();
            return { x: r.left, y: r.top, w: r.width, h: r.height };
          };
          const chart = document.querySelector("[data-arcade-chart]")!;
          const clips: { by: string; bottom: number; right: number; left: number; top: number }[] = [];
          for (let el = chart.parentElement; el; el = el.parentElement) {
            const cs = getComputedStyle(el);
            if (cs.overflowY !== "visible" || cs.overflowX !== "visible") {
              const r = el.getBoundingClientRect();
              clips.push({ by: el.className.toString().slice(0, 40), top: r.top, bottom: r.bottom, left: r.left, right: r.right });
            }
          }
          return {
            style: chart.getAttribute("data-arcade-chart"),
            chart: box(chart),
            clips,
            markers: Array.from(document.querySelectorAll<HTMLElement>("[data-chart-marker]")).map((el) => ({
              slot: Number(el.dataset["chartMarker"]),
              row: Number(el.dataset["chartRow"]),
              score: Number(el.dataset["chartScore"]),
              you: el.dataset["chartYou"] !== undefined,
              ring: getComputedStyle(el.firstElementChild!).boxShadow,
              text: el.textContent ?? "",
              ...box(el),
            })),
            labels: Array.from(document.querySelectorAll("[data-chart-label]")).map((el) => el.textContent),
            viewH: window.innerHeight,
          };
        });
        if (g.style !== style) fails.push(`drew the ${g.style} look`);
        if (g.markers.length !== scores.length) fails.push(`${g.markers.length} markers for ${scores.length} players`);
        for (const m of g.markers) {
          const score = scores[m.slot - 1]!;
          if (m.score !== score || m.row !== chartRow(score)) fails.push(`slot ${m.slot} (${score}) on row ${m.row}`);
          if (!m.text.includes(String(score))) fails.push(`slot ${m.slot}'s marker doesn't show ${score}`);
          if (m.you !== (m.slot === 1)) fails.push(`slot ${m.slot}: You marked wrongly`);
          if (m.you && (!/0px 0px 0px 4px/.test(m.ring) || !/You\d/.test(m.text))) fails.push(`You has no ring or label (${m.ring}, "${m.text}")`);
          if (m.x < 0 || m.x + m.w > 414) fails.push(`slot ${m.slot}'s marker off screen`);
        }
        for (const a of g.markers)
          for (const b of g.markers)
            if (a.slot < b.slot && overlap({ ...a, what: "" }, { ...b, what: "" })) fails.push(`markers ${a.slot} and ${b.slot} overlap`);
        const wantLabels = style === "snake" ? ["0", "50", "100", "150"] : ["0", "50", "50", "100", "100", "150"];
        if (JSON.stringify(g.labels) !== JSON.stringify(wantLabels)) fails.push(`labels ${g.labels}`);
        const bottom = g.chart.y + g.chart.h;
        if (bottom > IPHONE11_APP.screenH - IPHONE11_APP.bottom) fails.push(`chart ends at ${bottom}, under the home bar`);
        for (const c of g.clips) if (bottom > c.bottom + 0.5 || g.chart.y < c.top - 0.5) fails.push(`chart clipped by ${c.by} (${c.top}–${c.bottom})`);
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/chart-${style}-${n}p-414x896.png` });
        if (errors.length) fails.push(`page errors: ${[...new Set(errors)].slice(0, 2).join(" | ")}`);
        if (VERBOSE) console.log(`  ${where}: chart ${Math.round(g.chart.y)}–${Math.round(bottom)} px`);
      } catch (error) {
        fails.push(String((error as Error).message ?? error).split("\n")[0]!);
      } finally {
        await close();
      }
      for (const f of fails) failures.push(`${where}: ${f}`);
      console.log(`${fails.length ? "FAIL" : "PASS"} ${where}${fails.length ? `: ${fails[0]}` : ""}`);
    }
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  process.exit(1);
}
console.log("PASS: pings sit clear of the play area, timer and controls without moving anything, and the chart places every marker on its row, unclipped, in both looks");
