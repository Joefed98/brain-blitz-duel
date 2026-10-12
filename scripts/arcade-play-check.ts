/**
 * Arcade play check: every active arcade game, played for real in headless Chromium.
 *
 * For each of the 22 active arcade games it opens /practice at 390 × 700, starts
 * the run, feeds seeded taps and swipes for 15 s and fails if:
 *  - the sim tick does not advance (seen through the arcadeFeedback test hook,
 *    called once per drawn frame) or the HUD timer does not count down;
 *  - any uncaught page error, or any console error that is not known
 *    environment noise (asset 404s from the Lovable CDN, unreachable Supabase);
 *  - the average frame time is far above the game's baseline recorded from main
 *    (scripts/fixtures/arcade-play-baseline.json, requestAnimationFrame gaps over the
 *    15 s, recorded from main with --record: more than 1.5 × baseline + 4 ms),
 *    or above 33.4 ms (under 30 fps) whatever the baseline says;
 *  - a tracked drawn object moves further between two frames than it physically can
 *    (per-game px-per-tick limits; respawns, new throws/levels and other listed
 *    resets are exempt).
 *
 * It starts its own Vite dev server unless --url=<origin> is given.
 *
 *   bun scripts/arcade-play-check.ts                 # all 22 games
 *   bun scripts/arcade-play-check.ts cross flip      # only these game ids
 *   bun scripts/arcade-play-check.ts --record        # rewrite the frame-time baseline
 *   bun scripts/arcade-play-check.ts --url=http://127.0.0.1:5174
 *
 * Needs the pre-installed Chromium (/opt/pw-browsers/chromium, or PLAYWRIGHT_CHROMIUM);
 * a missing browser is an environment problem, reported as such.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { ARCADE_GAME_WORLDS } from "../src/lib/arcade/arcadeFxGames.renderer";
import { gameDisplayName } from "../src/lib/duel/gameNames";

const args = process.argv.slice(2);
const RECORD = args.includes("--record");
const URL_ARG = args.find((a) => a.startsWith("--url="))?.slice(6);
const ONLY = args.filter((a) => !a.startsWith("--"));
const BASELINE_PATH = new URL("./fixtures/arcade-play-baseline.json", import.meta.url).pathname;
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PLAY_MS = 15_000;
const PORT = 5179;

/** Max drawn movement per sim tick, px (world units), where the default (24) is too tight. */
// Jaywalk sidesteps are an instant 26 px column change; Meteor moves a whole cell per step.
const SPEED_LIMIT: Record<string, number> = { cross: 27, flip: 40, slice: 32, balltrack: 26.5, snake: 40, orbit: 40, swing: 40 };
const DEFAULT_LIMIT = 24;

/**
 * In-page extractors: sim state -> tracked drawn points [id, x, y] in world px, plus a
 * "reset" key whose change exempts that frame (respawn, new throw, new level, new crossing…).
 * Runs inside the page, so it is plain JS source; helpers come from window.__mods.
 */
const EXTRACT = String.raw`
(game, s, m) => {
  const P = [];
  const fp = (v) => v / 256;
  let reset = "";
  switch (game) {
    case "hover": P.push(["disc", 0, fp(s.y)]); reset = s.crashed; break;
    // Listed exception: finger-driven paddles and ships sit under the finger by design (the sim
    // sets them to the drag x, so a new touch elsewhere moves them at once); only physics bodies are tracked.
    case "breaker": s.balls.forEach((b, i) => P.push(["ball" + i, fp(b.x), fp(b.y)])); reset = s.balls.length + ":" + s.losses + ":" + s.pause; break;
    case "rally": P.push(["ball", fp(s.x), fp(s.y)]); reset = s.dead; break;
    case "burst": P.push(["player", fp(s.x), 0]); s.balls.forEach((b, i) => P.push(["ball" + i, fp(b.x), fp(b.y)])); reset = s.balls.length + ":" + s.wave + ":" + s.lives; break;
    case "wavefront": break; // the ship is finger-driven (see breaker); invaders step on a grid
    case "orbit": P.push(["rocket", fp(s.x), fp(s.y)]); reset = s.respawns + ":" + s.checkpoint + ":" + s.cur; break;
    case "skyline": P.push(["block", fp(s.x), 0]); reset = s.placed; break;
    case "inkbridge": if (s.ball) P.push(["ball", fp(s.ball.x), fp(s.ball.y)]); reset = s.level + ":" + s.levels + ":" + s.fails + ":" + s.dropping; break;
    case "bintoss": P.push(["ball", fp(s.x), fp(s.y)]); reset = s.throwIndex + ":" + s.phase; break;
    case "bubble": if (s.flightColour) P.push(["shot", fp(s.x), fp(s.y)]); reset = s.shots + ":" + s.descents + ":" + s.flightColour; break;
    case "swing": P.push(["player", fp(s.x), fp(s.y)]); reset = s.ended; break;
    case "snip": P.push(["candy", fp(s.sx), fp(s.sy)]); reset = s.eaten + ":" + s.level; break;
    case "tilt": P.push(["ball", fp(s.x), fp(s.y)]); reset = s.level + ":" + s.mazes + ":" + s.caught; break;
    case "snake": { const head = s.body[0] ?? 0; P.push(["head", m.snake.snakeCol(head) * m.snake.SNAKE_CELL, m.snake.snakeRow(head) * m.snake.SNAKE_CELL]); reset = s.dead; break; }
    case "junction": for (const c of s.cars) P.push(["car" + c.id, fp(c.s), 0]); break;
    case "cross": {
      const C = m.cross;
      const from = C.crossLaneCentre(s.lane), to = C.crossLaneCentre(s.lane + s.hopDir);
      const done = s.hop > 0 ? (C.CROSS_HOP_TICKS - s.hop) / C.CROSS_HOP_TICKS : 0;
      P.push(["walker", fp(C.crossColumnCentreFp(s.col)), s.hop > 0 ? from + (to - from) * done : from]);
      reset = s.crossings + ":" + s.hitTick;
      break;
    }
    case "slice": {
      s.objects.forEach((o, i) => {
        if (s.slicedAt[i] || m.slice.sliceSuppressed(s, o)) return;
        const at = m.slice.sliceObjectAt(o, s.tick, s.slowFrom, s.mayo ?? []);
        if (at) P.push(["o" + i, fp(at.x), fp(at.y)]);
      });
      break;
    }
    case "flip": {
      const lift = s.rev === 2 ? 18 : 14, F = m.flip;
      const target = s.side === 0 ? F.FLIP_FLOOR_Y - lift : F.FLIP_CEIL_Y + lift;
      let y = target;
      if (s.flipT > 0) { const from0 = s.side === 0 ? F.FLIP_CEIL_Y + lift : F.FLIP_FLOOR_Y - lift; const f = 1 - s.flipT / F.FLIP_ARC_TICKS; y = from0 + (target - from0) * f * f * (3 - 2 * f); }
      P.push(["runner", 0, y + s.warpY]);
      break;
    }
    case "balltrack": for (const b of s.balls) if (b.cell >= 0 && b.from >= 0) { const p = m.bt.btArtBallPoint(s, b, m.btRot); P.push(["m" + b.id, p.x, p.y]); } break;
    default: break; // beat, bullseye, matchup: no continuous movers
  }
  return { P, reset: String(reset) };
}`;

const INIT = String.raw`
window.__arcadeLog = null;
// Frame sampler independent of the game (works on code without the probe hook, e.g. main for --record).
window.__frameGaps = null;
(function sample(last) {
  requestAnimationFrame((t) => { if (window.__frameGaps) window.__frameGaps.push(t - last); sample(t); });
})(performance.now());
window.__arcadeProbe = (state, over) => {
  const log = window.__arcadeLog;
  if (!log) return;
  const now = performance.now();
  try {
    const x = window.__extract(log.game, state, window.__mods);
    log.frames.push({ t: now, tick: state.tick, over, P: x.P, reset: x.reset });
  } catch (e) { log.errors.push(String(e && e.stack || e).slice(0, 300)); }
};
`;

interface Frame { t: number; tick: number; over: boolean; P: [string, number, number][]; reset: string }
interface Result {
  game: string;
  ok: boolean;
  problems: string[];
  ticks: number;
  timer: [number, number];
  meanFrameMs: number;
  maxStep: number;
  maxStepAt: string;
}

const NOISE = [/Failed to load resource/i, /\[sound\]/i, /ERR_TUNNEL/i, /supabase/i, /intro demo/i, /fetch failed/i, /net::ERR/i, /WebSocket/i, /realtime/i];

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function startServer(): Promise<{ origin: string; proc: ChildProcess | null }> {
  if (URL_ARG) return { origin: URL_ARG.replace(/\/$/, ""), proc: null };
  const proc = spawn("npx", ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore", detached: true });
  const origin = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${origin}/practice`);
      if (r.ok) return { origin, proc };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

async function main() {
  if (!existsSync(CHROMIUM)) {
    console.log(`FAIL: environment: no Chromium at ${CHROMIUM} (set PLAYWRIGHT_CHROMIUM)`);
    process.exit(1);
  }
  const { chromium } = await import("playwright");
  const games = Object.keys(ARCADE_GAME_WORLDS).filter((g) => ONLY.length === 0 || ONLY.includes(g));
  const baseline: Record<string, number> = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};
  const { origin, proc } = await startServer();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const results: Result[] = [];
  try {
    for (const game of games) results.push(await playOne(browser, origin, game, baseline[game]));
  } finally {
    await browser.close();
    if (proc?.pid) try { process.kill(-proc.pid); } catch { /* already gone */ }
  }
  for (const r of results) {
    console.log(`${r.ok ? "ok  " : "FAIL"} ${r.game.padEnd(10)} ticks ${String(r.ticks).padStart(4)} · timer ${r.timer[0]}→${r.timer[1]} s · frame ${r.meanFrameMs.toFixed(1)} ms (baseline ${baseline[r.game]?.toFixed(1) ?? "—"}) · max step ${r.maxStep.toFixed(1)} px/tick${r.maxStepAt ? ` (${r.maxStepAt})` : ""}${r.problems.length ? `\n       ${r.problems.join("\n       ")}` : ""}`);
  }
  if (RECORD) {
    const next = { ...baseline };
    for (const r of results) next[r.game] = Math.round(r.meanFrameMs * 10) / 10;
    writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 1) + "\n");
    console.log(`recorded frame-time baseline for ${results.length} games -> ${BASELINE_PATH}`);
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log(`FAIL: ${failed.length} of ${results.length} arcade games: ${failed.map((r) => r.game).join(", ")}`);
    process.exit(1);
  }
  console.log(`Arcade play: ${results.length} of ${results.length} games advanced, error-free, within frame-time and movement limits`);
}

async function playOne(browser: import("playwright").Browser, origin: string, game: string, base: number | undefined): Promise<Result> {
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(`page error: ${String(e.message ?? e).slice(0, 200)}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (!NOISE.some((re) => re.test(text))) problems.push(`console error: ${text.slice(0, 200)}`);
  });
  await page.addInitScript(INIT);
  const result: Result = { game, ok: false, problems, ticks: 0, timer: [0, 0], meanFrameMs: 0, maxStep: 0, maxStepAt: "" };
  try {
    await page.goto(`${origin}/practice`, { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first();
    await button.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1500); // hydration
    await button.click();
    const ready = page.getByRole("button", { name: /^Ready/ });
    await ready.waitFor({ timeout: 60_000 });
    // Helpers for the extractors, from the same dev server modules the game uses.
    await page.evaluate(async (src) => {
      const w = window as unknown as Record<string, unknown>;
      w.__extract = (0, eval)(src);
      const imp = (p: string) => import(/* @vite-ignore */ p);
      const [cross, slice, flip, snake, bt] = await Promise.all([
        imp("/src/lib/arcade/cross.ts"), imp("/src/lib/arcade/slice.ts"), imp("/src/lib/arcade/flip.ts"),
        imp("/src/lib/arcade/snake.ts"), imp("/src/lib/arcade/ballTrackArt.renderer.ts"),
      ]);
      // Only turned tiles (state.turned) can swing a marble, so every cell may count as rotatable here.
      w.__mods = { cross, slice, flip, snake, bt, btRot: { has: () => true } };
    }, EXTRACT);
    await ready.click();
    await page.waitForTimeout(400);
    await page.evaluate((g) => {
      const w = window as unknown as Record<string, unknown>;
      w.__arcadeLog = { game: g, frames: [], errors: [] };
      w.__frameGaps = [];
    }, game);
    const timerOf = async () => {
      const label = await page.locator('[aria-label$="seconds remaining"]').first().getAttribute("aria-label", { timeout: 2000 }).catch(() => null);
      return label ? Number.parseInt(label, 10) : Number.NaN;
    };
    const t0 = await timerOf();
    const arena = await page.locator("[data-game-arena]").first().boundingBox();
    const rand = seeded(game.length * 7919 + 17);
    const until = Date.now() + PLAY_MS;
    while (Date.now() < until) {
      if (arena) {
        const x = arena.x + arena.width * (0.15 + rand() * 0.7);
        const y = arena.y + arena.height * (0.2 + rand() * 0.65);
        if (rand() < 0.5) await page.mouse.click(x, y);
        else {
          const angle = Math.floor(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.6;
          await page.mouse.move(x, y);
          await page.mouse.down();
          for (let k = 1; k <= 5; k++) await page.mouse.move(x + Math.cos(angle) * 16 * k, y + Math.sin(angle) * 16 * k);
          await page.mouse.up();
        }
      }
      await page.waitForTimeout(250 + Math.floor(rand() * 250));
    }
    const t1 = await timerOf();
    const log = (await page.evaluate(() => (window as unknown as { __arcadeLog: unknown }).__arcadeLog)) as { frames: Frame[]; errors: string[] };
    const gaps = (await page.evaluate(() => (window as unknown as { __frameGaps: number[] }).__frameGaps)) ?? [];
    result.meanFrameMs = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
    result.timer = [t0, t1];
    for (const e of log.errors.slice(0, 3)) problems.push(`probe: ${e}`);
    const frames = log.frames;
    if (RECORD) { /* baseline only: frame time, which needs no probe */ }
    else if (frames.length < 2) problems.push("no frames observed: the game's draw loop never ran");
    else {
      const first = frames[0]!, last = frames[frames.length - 1]!;
      result.ticks = last.tick - first.tick;
      const ended = last.over;
      if (result.ticks < 60) problems.push(`sim tick advanced only ${result.ticks} ticks in ${PLAY_MS / 1000} s`);
      if (!ended && !(Number.isFinite(t0) && Number.isFinite(t1) && t1 < t0)) problems.push(`HUD timer did not count down (${t0} → ${t1})`);
      if (!RECORD && result.meanFrameMs > 33.4) problems.push(`average frame ${result.meanFrameMs.toFixed(1)} ms (under 30 fps)`);
      if (!RECORD && base !== undefined && result.meanFrameMs > base * 1.5 + 4)
        problems.push(`average frame ${result.meanFrameMs.toFixed(1)} ms vs baseline ${base.toFixed(1)} ms`);
      // Movement: per tracked id, distance between consecutive frames per sim tick advanced.
      const limit = SPEED_LIMIT[game] ?? DEFAULT_LIMIT;
      for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1]!, b = frames[i]!;
        const dt = b.tick - a.tick;
        if (dt <= 0 || a.reset !== b.reset || b.over) continue;
        const prev = new Map(a.P.map(([id, x, y]) => [id, [x, y] as const]));
        for (const [id, x, y] of b.P) {
          const q = prev.get(id);
          if (!q) continue;
          const step = Math.hypot(x - q[0], y - q[1]) / dt;
          if (step > result.maxStep) {
            result.maxStep = step;
            result.maxStepAt = `${id} at tick ${b.tick}`;
          }
        }
      }
      if (result.maxStep > limit) problems.push(`${result.maxStepAt} moved ${result.maxStep.toFixed(1)} px in one tick (limit ${limit})`);
    }
  } catch (e) {
    problems.push(`harness: ${String((e as Error).message ?? e).split("\n")[0]}`);
  } finally {
    await page.close();
  }
  result.ok = problems.length === 0;
  return result;
}

await main();
