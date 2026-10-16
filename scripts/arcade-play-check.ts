/**
 * Arcade play check: every active arcade game, played for real in headless Chromium.
 *
 * For each of the 22 active arcade games (Pinball dealt in rooms since 14 Oct 2026; Junction is practice only since Tuning C), plus the engine games of other categories
 * that draw in an arcade world (ENGINE_GAME_WORLDS: Letterfall) and the engine games that draw their own
 * board (ENGINE_PLAY_GAMES: Tenfall, Mixed Signals, Bonk, Pull!), it opens /practice at 390 × 700, starts
 * the run and feeds seeded taps and swipes until 15 s of LIVE play are covered: a run
 * that ends early by game-over is restarted (a fresh practice run) and play continues.
 * It fails if:
 *  - the sim tick stops advancing for a second while a run is live (seen through the
 *    arcadeFeedback test hook, called once per drawn frame), or advances under half
 *    speed; time after game-over never counts;
 *  - the HUD timer can't be read (or reads NaN) while a run is live, or doesn't count
 *    down with live play (judged over the span the HUD was actually sampled: a run whose
 *    samples cover 3 s or more without the seconds dropping fails);
 *  - fewer than 15 s of live play could be covered (30 restarts at most);
 *  - any uncaught page error, or any console error that is not known
 *    environment noise (asset 404s from the Lovable CDN, unreachable Supabase);
 *  - the average frame time is far above the game's baseline recorded from main
 *    (scripts/fixtures/arcade-play-baseline.json, requestAnimationFrame gaps over the
 *    15 s, recorded from main with --record: more than 1.5 × baseline + 4 ms),
 *    or above 33.4 ms (under 30 fps) whatever the baseline says;
 *  - a tracked drawn object moves further between two frames than it physically can
 *    (per-game px-per-tick limits; respawns, new throws/levels and other listed
 *    resets are exempt);
 *  - the arcade play screen (15 Oct 2026, polish-layout/bottom.css) is wrong at any of
 *    375 × 667, 390 × 700, 390 × 844, 430 × 932 or a 1280 × 800 laptop window (checked once
 *    per game on its own practice run with the clock frozen, as bottom-clearance-check, so a
 *    game that dies in seconds without input, Hover, stays on its play screen, and no played
 *    run loses its first seconds to the proof): READY off screen or the page scrolls; the compact header not
 *    one 44 px row 4 px from the top (its timer centred, its text 12 px or more); the box
 *    (arena slot) not the full screen width or not starting 4 px under the header (below
 *    the game's own HUD rows, ABOVE); the arena not the game's world aspect (within 1 px),
 *    not the largest uniform fit of its box, not top-anchored (Tilt, since 15 Oct 2026:
 *    centred vertically, data-arena-centred) and centred across, or its top moving between
 *    sizes (centred worlds excepted); the box or the space below the arena not the screen edge's
 *    black (#070709), or the page behind not that black; the column not ending 16 px
 *    above the bottom, or the lowest control not exactly 16 px above it, whatever the
 *    home-bar inset (at 390x844 also with a 34 px home bar emulated, where the arena must
 *    keep its no-inset size, and with a 47 px notch, where the header must sit just under
 *    the inset and the arena directly under it); a control below the arena under 44 px or
 *    off screen; the play column or the arena canvas not touch-action: none (engine games);
 *    and, as an iPhone 11 home-screen app (fix-up, 15 Oct 2026; scripts/device-emulation.ts:
 *    414 × 896 with 48 / 34 px insets, laid out in WebKit's 848 px viewport, navigator.standalone
 *    and display-mode: standalone), the column and the lowest control (or the box) not ending
 *    16 px above the screen's bottom, the arena not the same size as in Safari on that phone, the
 *    page scrolled, or the box, the world or a control cut short by any clipping ancestor (html
 *    and body included);
 *  - Letterfall: its word list was not cached on the device (IndexedDB) after play.
 *
 * It starts its own Vite dev server unless --url=<origin> is given.
 *
 * --part=k/n plays one of n disjoint groups of games, balanced by how long each
 * game took on a CI runner (CI_SECONDS). CI runs the parts as separate jobs, each
 * still playing one game at a time in its own browser, so every game runs under
 * the same conditions as the recorded baseline (and as a whole run).
 *
 *   bun scripts/arcade-play-check.ts                 # all 22 games (and Letterfall)
 *   bun scripts/arcade-play-check.ts cross flip      # only these game ids
 *   bun scripts/arcade-play-check.ts --part=2/5      # the second of five groups
 *   bun scripts/arcade-play-check.ts --record        # play the same way, judge liveness, rewrite the frame-time baseline
 *   bun scripts/arcade-play-check.ts --url=http://127.0.0.1:5174
 *
 * Needs the pre-installed Chromium (/opt/pw-browsers/chromium, or PLAYWRIGHT_CHROMIUM);
 * a missing browser is an environment problem, reported as such.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import { ACTIVE_ARCADE_GAMES, ARCADE_FX_SPECS, ENGINE_FX_SPECS, ENGINE_GAME_WORLDS } from "../src/lib/arcade/arcadeFxGames.renderer";
import { PINBALL_IN_ROOMS } from "../src/lib/arcade/pinball";
import { TD_H, TD_W } from "../src/lib/arcade/tenDrop";
import { CLAY_H, CLAY_W } from "../src/lib/arcade/clayShoot";
import { CLASH_WORLD_H, CLASH_WORLD_W } from "../src/lib/arcade/colourClash";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { WORDFALL_META } from "../src/lib/arcade/wordfallWords.meta";
import { gotoRetried, warmUp } from "./browser-load";
import { BROWSER, DEVICE_INIT, IPHONE11_APP, emulateDevice, type Clip } from "./device-emulation";

const args = process.argv.slice(2);
const RECORD = args.includes("--record");
const URL_ARG = args.find((a) => a.startsWith("--url="))?.slice(6);
const PART_ARG = args.find((a) => a.startsWith("--part="))?.slice(7);
/**
 * Engine games of other categories that draw in their own canvas or board rather than an
 * arcade world (Tenfall, Mixed Signals, Bonk, Pull!). They run on the same engine and feed
 * the same per-frame probe (arcadeFeedback), so every play rule applies (sim tick and HUD
 * timer advance, no errors, frame time, READY on screen), and since 15 Oct 2026 their
 * board sits in the shared arena slot, so the layout proof applies too (ENGINE_PLAY_WORLDS).
 */
const ENGINE_PLAY_GAMES = ["tendrop", "stroop", "whack", "clayshoot"] as const;
/** Their world (view) sizes; Bonk's world is its square board. */
const ENGINE_PLAY_WORLDS: Record<(typeof ENGINE_PLAY_GAMES)[number], { width: number; height: number }> = {
  tendrop: { width: TD_W, height: TD_H },
  stroop: { width: CLASH_WORLD_W, height: CLASH_WORLD_H },
  whack: { width: 1, height: 1 },
  clayshoot: { width: CLAY_W, height: CLAY_H },
};
/**
 * New arcade games still practice only (not yet dealt in rooms), played with every rule,
 * the arena-layout proof included: Pinball until PINBALL_IN_ROOMS (then it is in ACTIVE_ARCADE_GAMES).
 */
const PRACTICE_PLAY_GAMES: string[] = PINBALL_IN_ROOMS ? [] : ["pinball"];
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
 * Seconds each game took on a CI runner (baseline record run of 12 Oct 2026, page load
 * and restarts included), used only to balance --part groups. Unlisted games count 25.
 */
const CI_SECONDS: Record<string, number> = {
  hover: 21, breaker: 21, rally: 32, beat: 21, snake: 46, burst: 21, wavefront: 20, orbit: 35,
  skyline: 56, cross: 24, junction: 24, inkbridge: 21, slice: 22, bintoss: 24, bullseye: 24,
  bubble: 21, flip: 35, swing: 46, snip: 21, tilt: 21, balltrack: 21, matchup: 21,
};

/** Game group k of n (1-based): longest game first onto the lightest group, ties by name. */
function partOf(games: string[], k: number, n: number): string[] {
  const load = Array.from({ length: n }, () => 0);
  const groups: string[][] = Array.from({ length: n }, () => []);
  const cost = (g: string) => CI_SECONDS[g] ?? 25;
  for (const g of [...games].sort((a, b) => cost(b) - cost(a) || a.localeCompare(b))) {
    const i = load.indexOf(Math.min(...load));
    load[i] += cost(g);
    groups[i]!.push(g);
  }
  const order = new Map(games.map((g, i) => [g, i]));
  return groups[k - 1]!.sort((a, b) => order.get(a)! - order.get(b)!);
}

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
    // Pinball: the ball; a drain puts it back in the shooter lane (a reset).
    case "pinball": P.push(["ball", fp(s.x), fp(s.y)]); reset = s.lost + ":" + s.live; break;
    case "burst": P.push(["player", fp(s.x), 0]); s.balls.forEach((b, i) => P.push(["ball" + i, fp(b.x), fp(b.y)])); reset = s.balls.length + ":" + s.wave + ":" + s.lives; break;
    // The ship is finger-driven (see breaker) and invaders step on a grid; wavRev 2 divers and the boss fly.
    case "wavefront":
      (s.divers ?? []).forEach((d) => P.push(["diver" + d.cell, fp(d.x), fp(d.y)]));
      if (s.boss) P.push(["boss", s.boss.x, 0]);
      reset = s.wave + ":" + (s.divers ?? []).map((d) => d.cell + (d.t > 150 ? "h" : "d")).join(",");
      break;
    case "orbit": P.push(["rocket", fp(s.x), fp(s.y)]); reset = s.respawns + ":" + s.checkpoint + ":" + s.cur; break;
    case "skyline": P.push(["block", fp(s.x), 0]); reset = s.placed; break;
    case "inkbridge": if (s.ball) P.push(["ball", fp(s.ball.x), fp(s.ball.y)]); reset = s.level + ":" + s.levels + ":" + s.fails + ":" + s.dropping; break;
    case "bintoss": P.push(["ball", fp(s.x), fp(s.y)]); reset = s.throwIndex + ":" + s.phase; break;
    case "bubble": if (s.flightColour) P.push(["shot", fp(s.x), fp(s.y)]); reset = s.shots + ":" + s.descents + ":" + s.flightColour; break;
    case "swing":
      P.push(["player", fp(s.x), fp(s.y)]);
      // swingRev 4: the chasing dragon and falling stalactites.
      if (s.chaseX) P.push(["dragon", fp(s.chaseX), fp(s.chaseY)]);
      (s.rocks ?? []).forEach((r, i) => { if (r.phase === 2) P.push(["rock" + i, fp(r.x), fp(r.y)]); });
      reset = s.ended + ":" + (s.rocks ?? []).map((r) => r.phase).join("");
      break;
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
    // Letterfall: every tile, falling or settled (drops enter from above the well; ids are stable).
    case "wordfall": s.well.forEach((stack, c) => stack.forEach((t) => P.push(["t" + t.id, c * 60, fp(t.y)]))); reset = s.words + ":" + s.over; break;
    case "balltrack": for (const b of s.balls) if (b.cell >= 0 && b.from >= 0) { const p = m.bt.btArtBallPoint(s, b, m.btRot); P.push(["m" + b.id, p.x, p.y]); } break;
    // Tenfall: every falling tile (ids are stable; a new target clears the lanes).
    case "tendrop": s.tiles.forEach((t) => P.push(["t" + t.id, t.col * 90, fp(t.y)])); reset = s.stage; break;
    default: break; // beat, bullseye, matchup: no continuous movers
  }
  return { P, reset: String(reset) };
}`;

const INIT = String.raw`
window.__arcadeLog = null;
// Frame sampler independent of the game's probe hook (frame times come from here, the sim tick from the probe).
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
  let games = [...ACTIVE_ARCADE_GAMES, ...PRACTICE_PLAY_GAMES, ...Object.keys(ENGINE_GAME_WORLDS), ...ENGINE_PLAY_GAMES].filter((g) => ONLY.length === 0 || ONLY.includes(g));
  if (PART_ARG) {
    const [k, n] = PART_ARG.split("/").map(Number) as [number, number];
    if (!(n >= 1 && k >= 1 && k <= n)) {
      console.log(`FAIL: bad --part=${PART_ARG} (expected k/n with 1 <= k <= n)`);
      process.exit(1);
    }
    games = partOf(games, k, n);
    console.log(`part ${k}/${n}: ${games.join(", ")}`);
  }
  const baseline: Record<string, number> = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : {};
  const { origin, proc } = await startServer();
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const results: Result[] = [];
  try {
    // Compile the app once, unmeasured, so the first game's load does not race the cold dev server.
    if (games.length)
      await warmUp(browser, `${origin}/practice`, (page) =>
        page.getByRole("button", { name: gameDisplayName(games[0] as never), exact: true }).first().waitFor({ timeout: 180_000 }));
    for (const [index, game] of games.entries()) {
      const r = await playOne(browser, origin, game, baseline[game]);
      results.push(r);
      // Progress as each game finishes (the full summary follows at the end).
      console.log(`[${index + 1}/${games.length}] ${r.ok ? "ok  " : "FAIL"} ${game}${r.problems.length ? `: ${r.problems[0]}` : ""}`);
    }
  } finally {
    await browser.close();
    if (proc?.pid) try { process.kill(-proc.pid); } catch { /* already gone */ }
  }
  for (const r of results) {
    console.log(`${r.ok ? "ok  " : "FAIL"} ${r.game.padEnd(10)} runs ${String((r as Result & { runs?: number }).runs ?? 0).padStart(2)} · ticks ${String(r.ticks).padStart(4)} · timer ${r.timer[0]}→${r.timer[1]} s · frame ${r.meanFrameMs.toFixed(1)} ms (baseline ${baseline[r.game]?.toFixed(1) ?? "—"}) · max step ${r.maxStep.toFixed(1)} px/tick${r.maxStepAt ? ` (${r.maxStepAt})` : ""}${r.problems.length ? `\n       ${r.problems.join("\n       ")}` : ""}`);
  }
  if (RECORD && results.some((r) => !r.ok)) {
    console.log(`FAIL: not recording the frame-time baseline: ${results.filter((r) => !r.ok).map((r) => r.game).join(", ")} failed (a baseline needs every game live)`);
  } else if (RECORD) {
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
  console.log(`Arcade play: ${results.length} of ${results.length} games covered 15 s of live play, advanced, timed, error-free, within frame-time and movement limits`);
}

/** Px from the bottom of the visible screen to the end of an arcade play column and its lowest control (15 Oct 2026). */
const ARCADE_BOTTOM_PX = 16;
/** The compact header: 4 px from the top (or the notch's inset), one 44 px row, 4 px to the box. */
const HEADER_TOP_PX = 4;
const HEADER_ROW_PX = 44;
/** The game's own HUD rows between the header and the box (presentation-geometry-check's ABOVE). */
const ABOVE_PX: Record<string, number> = { snip: 24, tendrop: 56, whack: 10 + 36 * 1.1 + 10 + 4 + 8 + 20 + 8, clayshoot: 26 };
/** The screen edge's black (--screen-edge), every gap on an arcade play screen. */
const EDGE_RGB = "rgb(7, 7, 9)";

/** Viewports the arena layout is proved at: four phones and a laptop window. */
const LAYOUT_VIEWPORTS: [number, number][] = [[375, 667], [390, 700], [390, 844], [430, 932], [1280, 800]];

/**
 * Let a resized layout settle: a few frames of the draw loop, which sizes the canvas to its box.
 * The layout page's clock is frozen (page.clock.pauseAt), which also holds requestAnimationFrame,
 * so the frames are run by hand: 40 ms of fake time, two or three frames and sim ticks a pass,
 * under half a second of play over the whole proof, so even Hover (which crashes within 1.5 s
 * without input) stays on its play screen.
 */
const nextFrames = async (page: import("playwright").Page) => {
  await page.clock.runFor(40);
  await page.waitForTimeout(60);
};

/** READY must be on screen without scrolling at every layout viewport. */
async function readyFits(page: import("playwright").Page, problems: string[]): Promise<void> {
  for (const [w, h] of LAYOUT_VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    await nextFrames(page);
    const box = await page.getByRole("button", { name: /^Ready/ }).boundingBox();
    if (!box || box.y < 0 || box.y + box.height > h + 0.5) problems.push(`layout ${w}x${h}: READY not fully on screen`);
  }
  await page.setViewportSize({ width: 390, height: 700 });
  await nextFrames(page);
}

/** In-page: the play screen's header, box, arena, controls and colours. */
function playScreen() {
  const box = (el: Element | null) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  };
  const stage = document.querySelector("[data-game-stage]");
  const slot = stage?.querySelector("[data-arena-slot]") ?? null;
  const arena = slot?.querySelector(":scope > [data-game-arena]") ?? null;
  const canvas = arena ? (arena instanceof HTMLCanvasElement ? arena : arena.querySelector("canvas")) : null;
  const below = slot ? [...(stage?.querySelectorAll("button, [data-game-controls]") ?? [])].filter((b) => slot.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING && !slot.contains(b) && b.getBoundingClientRect().height > 0) : [];
  const column = document.querySelector("[data-game-column]");
  const pad = column ? Number.parseFloat(getComputedStyle(column).paddingBottom) : 0;
  const header = document.querySelector("[data-arcade-header]");
  const timer = header?.querySelector("[role='timer']") ?? null;
  const texts = header ? [...header.querySelectorAll("*")].filter((el) => [...el.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim())) : [];
  const doc = document.scrollingElement!;
  const shell = document.querySelector("[data-arcade-play]");
  // The box, the world and every control, each with the lowest point a clipping ancestor lets it draw to.
  const clipBottom = (window as unknown as { __clipBottom: (el: Element) => Clip }).__clipBottom;
  const clips: { what: string; bottom: number; clip: Clip }[] = [];
  if (slot) clips.push({ what: "arena box", bottom: slot.getBoundingClientRect().bottom, clip: clipBottom(slot) });
  if (arena) clips.push({ what: "world", bottom: arena.getBoundingClientRect().bottom, clip: clipBottom(arena) });
  for (const b of below) clips.push({ what: `control "${b.getAttribute("aria-label") ?? b.getAttribute("data-game-controls") ?? (b.textContent ?? "").trim().slice(0, 24)}"`, bottom: b.getBoundingClientRect().bottom, clip: clipBottom(b) });
  return {
    clips,
    scrolled: doc.scrollTop,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone === true,
    displayMode: matchMedia("(display-mode: standalone)").matches ? "standalone" : "browser",
    slot: box(slot), arena: box(arena), canvas: box(canvas), slots: stage?.querySelectorAll("[data-arena-slot]").length ?? 0,
    header: box(header), timer: box(timer), smallestText: Math.min(...texts.map((el) => Number.parseFloat(getComputedStyle(el).fontSize))),
    colours: {
      slot: slot ? getComputedStyle(slot).backgroundColor : "",
      below: slot ? getComputedStyle(slot, "::after").backgroundColor : "",
      shell: shell ? getComputedStyle(shell).backgroundColor : "missing",
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
    },
    fillW: slot ? Number.parseFloat(getComputedStyle(slot, "::after").width) : 0,
    columnEnd: column ? column.getBoundingClientRect().bottom - pad : 0, pad,
    controls: below.filter((b) => b.tagName === "BUTTON").map((b) => box(b)!),
    lowest: Math.max(0, ...below.map((b) => b.getBoundingClientRect().bottom)),
    scroll: doc.scrollHeight - doc.clientHeight,
    // Only elements that take touches count (Tenfall, Pull! and Bonk draw on a pointer-events: none canvas).
    touch: [canvas, stage?.querySelector("[data-play-area]") ?? arena?.querySelector(".puzzle-board") ?? null].filter((el) => !el || getComputedStyle(el).pointerEvents !== "none").map((el) => (el ? getComputedStyle(el).touchAction : "missing")),
  };
}

/** Games whose world is centred vertically in its box (ArcadeCanvasStage centreWorld). */
const CENTRED_WORLDS = new Set(["tilt"]);

/**
 * The live arcade play screen at every layout viewport: the compact header, the edge-to-edge
 * box, the world's aspect at the largest uniform scale that fits it, top-anchored at a fixed
 * edge, every gap black, the column and the lowest control 16 px up, controls 44 px or more.
 */
async function arenaFits(page: import("playwright").Page, game: string, problems: string[]): Promise<void> {
  const spec = ({ ...ARCADE_FX_SPECS, ...ENGINE_FX_SPECS, ...ENGINE_PLAY_WORLDS } as Record<string, { width: number; height: number }>)[game];
  if (!spec) {
    problems.push(`layout: no world size for ${game}`);
    return;
  }
  const engine = game in ENGINE_GAME_WORLDS || (ENGINE_PLAY_GAMES as readonly string[]).includes(game);
  const tops: number[] = [];
  /** Tilt's world sits centred vertically in its box (data-arena-centred, 15 Oct 2026); every other world is top-anchored. */
  const centred = CENTRED_WORLDS.has(game);
  for (const [w, h] of LAYOUT_VIEWPORTS) {
    await page.setViewportSize({ width: w, height: h });
    await nextFrames(page);
    const m = await page.evaluate(playScreen);
    const at = `layout ${w}x${h}`;
    if (m.slots !== 1 || !m.slot || !m.arena) {
      problems.push(`${at}: expected one arena slot holding the arena (slots ${m.slots})`);
      continue;
    }
    const { slot, arena } = m;
    if (m.scroll > 0) problems.push(`${at}: page scrolls by ${m.scroll} px`);
    if (!m.header || Math.abs(m.header.y - HEADER_TOP_PX) > 0.5 || Math.abs(m.header.h - HEADER_ROW_PX) > 0.5) problems.push(`${at}: header ${m.header ? `${m.header.h.toFixed(1)} px tall at ${m.header.y.toFixed(1)}` : "missing"}, want one ${HEADER_ROW_PX} px row ${HEADER_TOP_PX} px down`);
    if (!m.timer || Math.abs(m.timer.x + m.timer.w / 2 - w / 2) > 1) problems.push(`${at}: header timer not centred`);
    if (!(m.smallestText >= 12)) problems.push(`${at}: header text ${m.smallestText} px, want 12 px or more`);
    const boxTop = HEADER_TOP_PX + HEADER_ROW_PX + 4 + (ABOVE_PX[game] ?? 0);
    if (Math.abs(slot.y - boxTop) > 0.5) problems.push(`${at}: box starts at ${slot.y.toFixed(1)} px, want ${boxTop.toFixed(1)} (4 px under the header${ABOVE_PX[game] ? " and the game's HUD" : ""})`);
    if (Math.abs(slot.x) > 0.5 || Math.abs(slot.w - w) > 0.5) problems.push(`${at}: box ${slot.x.toFixed(1)}..${(slot.x + slot.w).toFixed(1)} px, want the full ${w} px width`);
    if (engine && m.touch.some((t) => t !== "none")) problems.push(`${at}: arena canvas / play area touch-action ${m.touch.join(" / ")}, want none`);
    if (Math.abs(arena.h - (arena.w * spec.height) / spec.width) > 1) problems.push(`${at}: arena ${arena.w.toFixed(1)}x${arena.h.toFixed(1)} is not the ${spec.width}:${spec.height} world aspect`);
    if (arena.w > slot.w + 0.5 || arena.h > slot.h + 0.5) problems.push(`${at}: arena overflows its slot`);
    if (arena.w < slot.w - 1 && arena.h < slot.h - 1) problems.push(`${at}: arena ${arena.w.toFixed(1)}x${arena.h.toFixed(1)} is not the largest fit in ${slot.w.toFixed(1)}x${slot.h.toFixed(1)}`);
    if (centred) {
      if (Math.abs(arena.y - slot.y - (slot.h - arena.h) / 2) > 0.5) problems.push(`${at}: arena not centred vertically in its slot`);
    } else if (Math.abs(arena.y - slot.y) > 0.5) problems.push(`${at}: arena not top-anchored in its slot`);
    if (Math.abs(arena.x - slot.x - (slot.w - arena.w) / 2) > 0.5) problems.push(`${at}: arena not centred across its slot`);
    if (m.canvas && (Math.abs(m.canvas.w - arena.w) > 1 || Math.abs(m.canvas.h - arena.h) > 1)) problems.push(`${at}: canvas does not fill the arena`);
    for (const [where, colour] of Object.entries(m.colours))
      if (colour !== EDGE_RGB) problems.push(`${at}: ${where} painted ${colour}, not the screen edge's black ${EDGE_RGB}`);
    if (Math.abs(m.fillW - arena.w) > 1) problems.push(`${at}: black below the arena is ${m.fillW.toFixed(1)} px wide, not the arena's ${arena.w.toFixed(1)}`);
    const gap = h - m.columnEnd;
    if (Math.abs(gap - ARCADE_BOTTOM_PX) > 0.5) problems.push(`${at}: play column ends ${gap.toFixed(1)} px above the bottom (want ${ARCADE_BOTTOM_PX})`);
    if (m.lowest > 0 && Math.abs(h - m.lowest - ARCADE_BOTTOM_PX) > 0.5) problems.push(`${at}: lowest control ends ${(h - m.lowest).toFixed(1)} px above the bottom (want exactly ${ARCADE_BOTTOM_PX})`);
    for (const c of m.controls) {
      if (Math.min(c.w, c.h) < 44) problems.push(`${at}: control ${c.w.toFixed(0)}x${c.h.toFixed(0)} under 44 px`);
      if (c.y < slot.y + slot.h - 0.5 || c.y + c.h > h + 0.5) problems.push(`${at}: control not between the arena and the bottom edge`);
    }
    if (!centred) tops.push(arena.y);
  }
  if (tops.length && Math.max(...tops) - Math.min(...tops) > 0.5) problems.push(`layout: arena top moves between sizes (${tops.map((t) => t.toFixed(1)).join(", ")})`);
  // A 34 px home bar (CDP safe-area emulation) must not shrink the arena or move the column's end;
  // a 47 px notch puts the header just under it and the box directly under the header.
  await page.setViewportSize({ width: 390, height: 844 });
  await nextFrames(page);
  const plain = await page.evaluate(playScreen);
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { top: 0, bottom: 34, left: 0, right: 0 } } as never);
    await nextFrames(page);
    const inset = await page.evaluate(playScreen);
    if (!plain.arena || !inset.arena || Math.abs(inset.arena.w - plain.arena.w) > 0.5 || Math.abs(inset.arena.h - plain.arena.h) > 0.5) problems.push(`layout 390x844 with a 34 px home bar: arena ${inset.arena?.w.toFixed(1)}x${inset.arena?.h.toFixed(1)}, not its no-inset ${plain.arena?.w.toFixed(1)}x${plain.arena?.h.toFixed(1)}`);
    if (Math.abs(inset.pad - ARCADE_BOTTOM_PX) > 0.5) problems.push(`layout 390x844 with a 34 px home bar: play column padded ${inset.pad} px at the bottom (want ${ARCADE_BOTTOM_PX})`);
    if (inset.lowest > 0 && Math.abs(844 - inset.lowest - ARCADE_BOTTOM_PX) > 0.5) problems.push(`layout 390x844 with a 34 px home bar: lowest control ${(844 - inset.lowest).toFixed(1)} px above the bottom (want ${ARCADE_BOTTOM_PX})`);
    await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { top: 47, bottom: 34, left: 0, right: 0 } } as never);
    await nextFrames(page);
    const notch = await page.evaluate(playScreen);
    if (!notch.header || Math.abs(notch.header.y - 47) > 0.5) problems.push(`layout 390x844 with a 47 px notch: header at ${notch.header?.y.toFixed(1)} px, want just under the inset (47)`);
    const notchTop = 47 + HEADER_ROW_PX + 4 + (ABOVE_PX[game] ?? 0);
    if (!notch.slot || Math.abs(notch.slot.y - notchTop) > 0.5) problems.push(`layout 390x844 with a 47 px notch: box at ${notch.slot?.y.toFixed(1)} px, want ${notchTop.toFixed(1)} (directly under the header)`);
    for (const [where, colour] of Object.entries(notch.colours))
      if (colour !== EDGE_RGB) problems.push(`layout 390x844 with a notch and home bar: ${where} painted ${colour}, not ${EDGE_RGB}`);
  } finally {
    await cdp.send("Emulation.setSafeAreaInsetsOverride" as never, { insets: { top: 0, bottom: 0, left: 0, right: 0 } } as never).catch(() => {});
    await cdp.detach().catch(() => {});
  }
  // An iPhone 11 home-screen app (fix-up, 15 Oct 2026): laid out 48 px short of its 896 px screen, the play
  // screen adds the shortfall, so the column and the lowest control (or box) end 16 px above the screen's
  // bottom, the arena is the size Safari shows on that phone, and nothing (html and body included) clips
  // the box, the world or a control.
  const at = `layout ${IPHONE11_APP.label}`;
  try {
    await emulateDevice(page, { ...IPHONE11_APP, key: "iphone11-safari", standalone: false, h: IPHONE11_APP.screenH });
    await nextFrames(page);
    const safari = await page.evaluate(playScreen);
    await emulateDevice(page, IPHONE11_APP);
    await nextFrames(page);
    const app = await page.evaluate(playScreen);
    if (app.slots !== 1 || !app.slot || !app.arena) {
      problems.push(`${at}: no arcade play screen (slots ${app.slots}): the run ended before it was measured?`);
      return;
    }
    if (!app.standalone || app.displayMode !== "standalone") problems.push(`${at}: home-screen app emulation not applied (standalone ${app.standalone}, display-mode ${app.displayMode})`);
    if (app.scrolled) problems.push(`${at}: page scrolled by ${app.scrolled} px`);
    if (!app.header || Math.abs(app.header.y - IPHONE11_APP.top) > 0.5) problems.push(`${at}: header at ${app.header?.y.toFixed(1)} px, want just under the inset (${IPHONE11_APP.top})`);
    const screenGap = IPHONE11_APP.screenH - app.columnEnd;
    if (Math.abs(screenGap - ARCADE_BOTTOM_PX) > 0.5) problems.push(`${at}: play column ends ${screenGap.toFixed(1)} px above the bottom of the screen (want ${ARCADE_BOTTOM_PX})`);
    const lowest = app.lowest > 0 ? app.lowest : app.slot ? app.slot.y + app.slot.h : 0;
    if (Math.abs(IPHONE11_APP.screenH - lowest - ARCADE_BOTTOM_PX) > 0.5) problems.push(`${at}: ${app.lowest > 0 ? "lowest control" : "arena box"} ends ${(IPHONE11_APP.screenH - lowest).toFixed(1)} px above the bottom of the screen (want exactly ${ARCADE_BOTTOM_PX})`);
    if (!safari.arena || !app.arena || Math.abs(app.arena.w - safari.arena.w) > 0.5 || Math.abs(app.arena.h - safari.arena.h) > 0.5) problems.push(`${at}: arena ${app.arena?.w.toFixed(1)}x${app.arena?.h.toFixed(1)}, not Safari's ${safari.arena?.w.toFixed(1)}x${safari.arena?.h.toFixed(1)} on the same phone`);
    for (const c of app.clips)
      if (c.clip.bottom < c.bottom - 0.5) problems.push(`${at}: ${c.what} (ends ${c.bottom.toFixed(1)} px down) is cut ${(c.bottom - c.clip.bottom).toFixed(1)} px short by ${c.clip.by} (ends ${c.clip.bottom.toFixed(1)} px down)`);
  } finally {
    await emulateDevice(page, BROWSER);
  }
  await page.setViewportSize({ width: 390, height: 700 });
  await nextFrames(page);
}

/**
 * The layout proof (READY on screen, then the live play screen at every size and as an iPhone 11
 * home-screen app) on its own practice run, with the clock frozen once the run is live, so the
 * run cannot end while it is measured and no played run loses time to it.
 */
async function layoutProof(browser: import("playwright").Browser, origin: string, game: string, problems: string[]): Promise<void> {
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
  page.on("pageerror", (e) => problems.push(`page error (layout): ${String(e.message ?? e).slice(0, 200)}`));
  await page.addInitScript(DEVICE_INIT);
  await page.clock.install();
  try {
    await gotoRetried(page, `${origin}/practice`, game, { waitUntil: "domcontentloaded" });
    const button = page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first();
    await button.waitFor({ timeout: 60_000 });
    await page.waitForTimeout(1500); // hydration
    await button.click();
    const ready = page.getByRole("button", { name: /^Ready/ });
    await ready.waitFor({ timeout: 60_000 });
    await readyFits(page, problems);
    await ready.click();
    await page.locator("[data-arcade-play] [data-game-stage]").first().waitFor({ timeout: 30_000 });
    // Freeze the run where it stands (Hover can crash within 1.5 s without input).
    await page.clock.pauseAt(Date.now() + 200);
    await page.waitForTimeout(600);
    await arenaFits(page, game, problems);
  } catch (e) {
    problems.push(`layout harness: ${String((e as Error).message ?? e).split("\n")[0]}`);
  } finally {
    await page.close();
  }
}

/** How long a live run may go without its sim tick changing before it counts as frozen. */
const FROZEN_MS = 1000;
/** Give up topping up play after this many restarts (a game that dies every second). */
const MAX_SEGMENTS = 30;

/** timer: the HUD's seconds at each sample while the run was live; timerAt: when (ms) each was read. */
interface Segment { frames: Frame[]; gaps: number[]; liveMs: number; timer: number[]; timerAt: number[]; ended: boolean }

/**
 * One game: plays segments (a fresh practice run each) until PLAY_MS of live play is
 * covered. A run that ends early by game-over is restarted; time after game-over
 * never counts as play, and freezes are judged only while a run is live.
 */
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
  await page.addInitScript(DEVICE_INIT);
  const result: Result = { game, ok: false, problems, ticks: 0, timer: [Number.NaN, Number.NaN], meanFrameMs: 0, maxStep: 0, maxStepAt: "" };
  const rand = seeded(game.length * 7919 + 17);
  const segments: Segment[] = [];
  const timerOf = async () => {
    const label = await page.locator('[aria-label$="seconds remaining"]').first().getAttribute("aria-label", { timeout: 1500 }).catch(() => null);
    return label ? Number.parseInt(label, 10) : Number.NaN;
  };
  const lastFrame = () => page.evaluate(() => {
    const log = (window as unknown as { __arcadeLog: { frames: Frame[] } | null }).__arcadeLog;
    const f = log?.frames[log.frames.length - 1];
    return f ? { tick: f.tick, over: f.over, n: log!.frames.length } : null;
  });
  let liveTotal = 0;
  try {
    await layoutProof(browser, origin, game, problems);
    for (let segment = 0; segment < MAX_SEGMENTS && liveTotal < PLAY_MS; segment++) {
      await gotoRetried(page, `${origin}/practice`, game, { waitUntil: "domcontentloaded" });
      const button = page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first();
      await button.waitFor({ timeout: 60_000 });
      await page.waitForTimeout(1500); // hydration
      await button.click();
      const ready = page.getByRole("button", { name: /^Ready/ });
      await ready.waitFor({ timeout: 60_000 });
      await page.evaluate(async ({ src, g }) => {
        const w = window as unknown as Record<string, unknown>;
        w.__extract = (0, eval)(src);
        const imp = (p: string) => import(/* @vite-ignore */ p);
        const [cross, slice, flip, snake, bt] = await Promise.all([
          imp("/src/lib/arcade/cross.ts"), imp("/src/lib/arcade/slice.ts"), imp("/src/lib/arcade/flip.ts"),
          imp("/src/lib/arcade/snake.ts"), imp("/src/lib/arcade/ballTrackArt.renderer.ts"),
        ]);
        // Only turned tiles (state.turned) can swing a marble, so every cell may count as rotatable here.
        w.__mods = { cross, slice, flip, snake, bt, btRot: { has: () => true } };
        w.__arcadeLog = { game: g, frames: [], errors: [] };
        w.__frameGaps = [];
      }, { src: EXTRACT, g: game });
      await ready.click();
      await page.waitForTimeout(400);
      // The first run's frame gaps count from here, as they did after the layout proof's last resize.
      if (segment === 0) await page.evaluate(() => { (window as unknown as { __frameGaps: number[] }).__frameGaps = []; });
      const seg: Segment = { frames: [], gaps: [], liveMs: 0, timer: [], timerAt: [], ended: false };
      const startAt = Date.now();
      const arena = await page.locator("[data-game-arena]").first().boundingBox();
      // Play until the run ends or the game's 15 s of live play are covered.
      for (;;) {
        const live = await lastFrame();
        if (live?.over) {
          seg.ended = true;
          break;
        }
        const t = await timerOf();
        const stillLive = !(await lastFrame())?.over;
        if (stillLive) {
          if (!Number.isFinite(t)) problems.push(`HUD timer unreadable while the run is live (segment ${segment + 1}, ${((Date.now() - startAt) / 1000).toFixed(1)} s in)`);
          else {
            seg.timer.push(t);
            seg.timerAt.push(Date.now());
          }
        }
        if (liveTotal + (Date.now() - startAt) >= PLAY_MS) break;
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
        await page.waitForTimeout(150 + Math.floor(rand() * 200));
      }
      const log = (await page.evaluate(() => (window as unknown as { __arcadeLog: unknown }).__arcadeLog)) as { frames: Frame[]; errors: string[] };
      seg.gaps = (await page.evaluate(() => (window as unknown as { __frameGaps: number[] }).__frameGaps)) ?? [];
      for (const e of log.errors.slice(0, 3)) problems.push(`probe: ${e}`);
      seg.frames = log.frames;
      const firstOver = seg.frames.find((f) => f.over);
      const first = seg.frames[0];
      // Live play: from the first drawn frame to game-over (or the end of input).
      seg.liveMs = first ? (firstOver ?? seg.frames[seg.frames.length - 1]!).t - first.t : 0;
      if (seg.frames.length < 2) {
        problems.push(`segment ${segment + 1}: no frames observed: the game's draw loop never ran`);
        break;
      }
      if (seg.frames.length && seg.liveMs < 50 && !seg.ended) {
        problems.push(`segment ${segment + 1}: run never went live`);
        break;
      }
      liveTotal += Math.max(seg.liveMs, 1);
      segments.push(seg);
    }
    if (game === "wordfall") {
      // The word list loaded for play must now sit in the device cache, keyed by its version.
      const version = await page.evaluate(() => new Promise<string | null>((done) => {
        const open = indexedDB.open("duelz-wordfall", 1);
        open.onerror = () => done(null);
        open.onsuccess = () => {
          try {
            const get = open.result.transaction("words", "readonly").objectStore("words").get("packed");
            get.onsuccess = () => done((get.result as { version?: string } | undefined)?.version ?? null);
            get.onerror = () => done(null);
          } catch { done(null); }
        };
      }));
      const want = `${WORDFALL_META.hash}:${WORDFALL_META.count}`;
      if (version !== want) problems.push(`word list not cached on the device (IndexedDB version ${version}, want ${want})`);
    }
    result.meanFrameMs = mean(segments.flatMap((sg) => sg.gaps));
    judge(result, segments, liveTotal, base, game);
  } catch (e) {
    problems.push(`harness: ${String((e as Error).message ?? e).split("\n")[0]}`);
  } finally {
    await page.close();
  }
  result.ok = problems.length === 0;
  return result;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function judge(result: Result, segments: Segment[], liveTotal: number, base: number | undefined, game: string): void {
  const problems = result.problems;
  if (liveTotal < PLAY_MS) problems.push(`only ${(liveTotal / 1000).toFixed(1)} s of live play covered in ${segments.length} runs`);
  let timerDrop = 0;
  const limit = SPEED_LIMIT[game] ?? DEFAULT_LIMIT;
  segments.forEach((seg, index) => {
    const live = seg.frames.filter((f) => !f.over);
    if (live.length >= 2) {
      const ticks = live[live.length - 1]!.tick - live[0]!.tick;
      result.ticks += ticks;
      const liveS = (live[live.length - 1]!.t - live[0]!.t) / 1000;
      if (ticks < 0.5 * 60 * liveS) problems.push(`run ${index + 1}: sim tick advanced only ${ticks} ticks in ${liveS.toFixed(1)} s of live play`);
      // Frozen: the tick stops changing while the run is live.
      let since = live[0]!;
      for (const f of live) {
        if (f.tick !== since.tick) since = f;
        else if (f.t - since.t >= FROZEN_MS) {
          problems.push(`run ${index + 1}: frozen at tick ${f.tick} for ${((f.t - since.t) / 1000).toFixed(1)} s while live`);
          break;
        }
      }
    }
    const [t0, t1] = [seg.timer[0], seg.timer[seg.timer.length - 1]];
    if (Number.isFinite(t0) && Number.isFinite(t1)) timerDrop += t0! - t1!;
    if (index === 0) result.timer = [t0 ?? Number.NaN, t1 ?? Number.NaN];
    else result.timer[1] = t1 ?? result.timer[1];
    // Movement: per tracked id, distance between consecutive frames per sim tick advanced.
    for (let i = 1; i < seg.frames.length; i++) {
      const a = seg.frames[i - 1]!, b = seg.frames[i]!;
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
  });
  // The HUD counts down with live play: every run live for 3 s or more shows it dropping, and in
  // total by at least half a second per live second beyond each run's first two (its read cadence).
  let required = 0;
  segments.forEach((seg, index) => {
    const liveS = seg.liveMs / 1000;
    const drop = (seg.timer[0] ?? Number.NaN) - (seg.timer[seg.timer.length - 1] ?? Number.NaN);
    // Judged over the span the HUD was sampled (from the first read to the last while live), not the run's
    // frame span: a run that ends soon after sampling began has shown nothing, and a frozen HUD still fails.
    const sampledS = seg.timerAt.length ? (seg.timerAt[seg.timerAt.length - 1]! - seg.timerAt[0]!) / 1000 : 0;
    if (sampledS >= 3 && !(drop >= 1)) problems.push(`run ${index + 1}: HUD timer did not count down (${seg.timer[0]} → ${seg.timer[seg.timer.length - 1]}) over ${sampledS.toFixed(1)} s sampled (${liveS.toFixed(1)} s live)`);
    required += Math.max(0, Math.floor(liveS) - 2);
  });
  if (timerDrop < Math.floor(required / 2))
    problems.push(`HUD timer counted down only ${timerDrop} s over ${(liveTotal / 1000).toFixed(1)} s of live play`);
  (result as Result & { runs: number }).runs = segments.length;
  // Recording measures frame times (and movement) without judging them; every liveness rule above still applies.
  if (RECORD) return;
  if (result.meanFrameMs > 33.4) problems.push(`average frame ${result.meanFrameMs.toFixed(1)} ms (under 30 fps)`);
  if (base !== undefined && result.meanFrameMs > base * 1.5 + 4)
    problems.push(`average frame ${result.meanFrameMs.toFixed(1)} ms vs baseline ${base.toFixed(1)} ms`);
  if (result.maxStep > limit) problems.push(`${result.maxStepAt} moved ${result.maxStep.toFixed(1)} px in one tick (limit ${limit})`);
}

await main();
