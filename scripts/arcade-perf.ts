/**
 * Arcade frame-time profiler (a design tool, not a check; low-end performance, 16 Oct 2026).
 *
 * Plays each arcade-stage game (the 22 active arcade games, Letterfall, Tenfall, Bonk, Pull! and
 * Mixed Signals) in practice in headless Chromium with the CPU slowed through CDP
 * (Emulation.setCPUThrottlingRate), feeding seeded taps and swipes as arcade-play-check does, and
 * reports the mean requestAnimationFrame gap (frame ms and fps) over the measured span of live play.
 * A run that ends early is restarted. Headless Chromium rasterises canvases in software on the
 * renderer's main thread, so fill area (canvas size × pixel ratio) costs frame time as script does.
 *
 *   bun scripts/arcade-perf.ts                          # every game at 1×, 4× and 6×
 *   bun scripts/arcade-perf.ts swing orbit --rates=6    # only these games and rates
 *   bun scripts/arcade-perf.ts --size=390x844 --dpr=2   # viewport and device pixel ratio (default 390x844, DPR 1)
 *   bun scripts/arcade-perf.ts --seconds=8              # measured play per game and rate (default 8)
 *   bun scripts/arcade-perf.ts --profile                # a CPU profile per run: self time by file and by
 *                                                       # category (sim, scenery, sprites, effects, text, browser)
 *   bun scripts/arcade-perf.ts --raster                 # canvases forced to immediate software raster
 *                                                       # (willReadFrequently) and every draw call timed: where raster
 *                                                       # time goes, by call and by the renderer line that made it (slows play)
 *   PERF_FUNCS=1 bun scripts/arcade-perf.ts swing --profile   # also the 40 costliest functions by self time
 *   bun scripts/arcade-perf.ts --warmup=4000            # live play before the first run is measured (default 400 ms)
 *   bun scripts/arcade-perf.ts --raf30                  # a screen capped at 30 Hz (rAF on every other vsync)
 *   bun scripts/arcade-perf.ts --stall=500              # one 500 ms main-thread stall 2.5 s into the first run
 *   bun scripts/arcade-perf.ts --effects=full           # pin reduced effects (full: never; 1 or 2: that level)
 *   bun scripts/arcade-perf.ts --json=<path>            # save the results
 *   bun scripts/arcade-perf.ts --url=http://127.0.0.1:5174
 *
 * Presentation only: it reads frame gaps, the canvases' sizes and a sampled profile, and never
 * writes to a sim or a run.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

import { ACTIVE_ARCADE_GAMES, ENGINE_GAME_WORLDS } from "../src/lib/arcade/arcadeFxGames.renderer";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import { gotoRetried, warmUp } from "./browser-load";
import { SETTLE_MS, SLOW_WORK_MS, STALL_MS, WINDOW_MS } from "../src/lib/fx/lowEnd";

export const ARCADE_STAGE_GAMES = [...ACTIVE_ARCADE_GAMES, ...Object.keys(ENGINE_GAME_WORLDS), "tendrop", "stroop", "whack", "clayshoot"] as string[];

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const RATES = (opt("rates") ?? "1,4,6").split(",").map(Number);
const [VW, VH] = (opt("size") ?? "390x844").split("x").map(Number) as [number, number];
const DPR = Number(opt("dpr") ?? 1);
const SECONDS = Number(opt("seconds") ?? 8);
const PROFILE = args.includes("--profile");
const JSON_PATH = opt("json");
const RASTER = args.includes("--raster");
const WARMUP = Number(opt("warmup") ?? 400);
const RAF30 = args.includes("--raf30");
const STALL = Number(opt("stall") ?? 0) || 0;
const EFFECTS_ARG = opt("effects");
/** --effects=full|1|2: pin the reduced-effects level (lib/fx/lowEnd.ts) instead of letting it adapt. */
const EFFECTS = EFFECTS_ARG === "full" ? "full" : EFFECTS_ARG === "1" ? 1 : EFFECTS_ARG === "2" ? 2 : undefined;
const URL_ARG = opt("url");
const ONLY = args.filter((a) => !a.startsWith("--"));
const CHROMIUM = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const PORT = 5183;

const INIT = String.raw`
window.__perf = { gaps: null, work: null, over: false, frames: 0, live: false };
// Each frame's own work, measured as the governor does (src/lib/fx/lowEnd.ts): from the frame's
// timestamp to a message posted from its callback, which runs once the frame's work is done.
const workChannel = new MessageChannel();
workChannel.port1.onmessage = (e) => { const p = window.__perf; if (p.work && !p.over && p.live) p.work.push(performance.now() - e.data); };
(function sample(last) {
  // Only gaps between two frames of live play count (the probe runs once per drawn arcade frame).
  requestAnimationFrame((t) => { const p = window.__perf; if (p.gaps && !p.over && p.live) p.gaps.push(t - last); p.live = p.frames > 0 && !p.over; workChannel.port2.postMessage(t); sample(t); });
})(performance.now());
window.__arcadeProbe = (state, over) => { const p = window.__perf; p.over = over; p.frames++; };
// When the governor steps down (page time, ms), for checks that judge what the machine was doing then.
window.__perf.reducedAt = null;
new MutationObserver(() => {
  if (window.__perf.reducedAt === null && document.querySelector("[data-reduced-effects]")) window.__perf.reducedAt = performance.now();
}).observe(document, { attributes: true, subtree: true, attributeFilter: ["data-reduced-effects"] });
`;

/**
 * MeasureOptions.stallProbe: while a run plays, the CPU time every process outside the browser used
 * (the dev server, this script, anything else on the machine, and time the VM's host stole) on the
 * CPUs this script may run on, read from Linux's /proc every 100 ms. None of the page's work is in
 * it, so a busy spell there means the machine itself was short of CPU (a CI runner), not that the
 * page's frames got heavier. Where /proc is missing it records nothing. Samples are [epoch ms,
 * CPU-seconds used by others so far].
 */
const CLK_TCK = 100;
/** The CPUs this process may run on (its affinity, which the browser inherits), or null for all. */
function allowedCpus(): Set<number> | null {
  try {
    const list = /Cpus_allowed_list:\s*(\S+)/.exec(readFileSync("/proc/self/status", "utf8"))?.[1];
    if (!list) return null;
    const out = new Set<number>();
    for (const part of list.split(",")) {
      const [a, b] = part.split("-").map(Number) as [number, number | undefined];
      for (let c = a; c <= (b ?? a); c++) out.add(c);
    }
    return out;
  } catch {
    return null;
  }
}
const CPUS = allowedCpus();
function procCpu(): { others: number } | null {
  try {
    // Busy time on the CPUs this script and the browser may use: user nice system irq softirq steal
    // (everything but idle and iowait; steal is time the VM's host took).
    let busy = 0;
    for (const line of readFileSync("/proc/stat", "utf8").split("\n")) {
      const m = /^cpu(\d+)\s+(.*)$/.exec(line);
      if (!m || (CPUS && !CPUS.has(Number(m[1])))) continue;
      busy += m[2]!.split(/\s+/).map(Number).reduce((a, b, i) => (i === 3 || i === 4 || i > 7 ? a : a + b), 0);
    }
    let browser = 0;
    for (const pid of readdirSync("/proc")) {
      if (!/^\d+$/.test(pid)) continue;
      try {
        const cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8");
        if (!/chrom|headless_shell/i.test(cmd.split("\0")[0] ?? "")) continue;
        const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
        const f = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
        browser += Number(f[11]) + Number(f[12]);
      } catch { /* exited */ }
    }
    return { others: (busy - browser) / CLK_TCK };
  } catch {
    return null;
  }
}

/** --raster: time every draw call on an immediately rasterised canvas, by method and by caller. */
const RASTER_INIT = String.raw`
(() => {
  const get = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, opts) {
    return kind === "2d" ? get.call(this, kind, { ...(opts || {}), willReadFrequently: true }) : get.call(this, kind, opts);
  };
  const r = window.__raster = { on: false, byMethod: {}, byCaller: {} };
  const P = CanvasRenderingContext2D.prototype;
  const gid = P.getImageData;
  for (const name of ["fill", "stroke", "fillRect", "strokeRect", "clearRect", "drawImage", "fillText", "strokeText", "putImageData", "clip"]) {
    const f = P[name];
    P[name] = function (...a) {
      if (!r.on || !this.canvas || !this.canvas.width) return f.apply(this, a);
      // Flush what is pending (untimed), then time this call and its flush (a 1 px read forces raster).
      gid.call(this, 0, 0, 1, 1);
      const t = performance.now();
      const out = f.apply(this, a);
      gid.call(this, 0, 0, 1, 1);
      const ms = performance.now() - t;
      const key = name + (name === "drawImage" ? "(" + (a[0] && a[0].width) + "x" + (a[0] && a[0].height) + ")" : "") + (this.shadowBlur ? " +shadow" : "") + (this.globalCompositeOperation !== "source-over" ? " " + this.globalCompositeOperation : "");
      r.byMethod[key] = (r.byMethod[key] || 0) + ms;
      if (ms > 0.02) {
        const line = (new Error().stack || "").split("\n")[2] || "";
        const m = line.match(/at (\S+) \(.*\/(src\/[^?:]+)(?:\?[^:]*)?:(\d+)/) || line.match(/at .*\/(src\/[^?:]+)(?:\?[^:]*)?:(\d+)/);
        const caller = m ? (m.length === 4 ? m[1] + " " + m[2] + ":" + m[3] : m[1] + ":" + m[2]) : line.trim().slice(0, 80);
        r.byCaller[caller + " " + name] = (r.byCaller[caller + " " + name] || 0) + ms;
      }
      return out;
    };
  }
})();
`;

/**
 * --raf30: requestAnimationFrame callbacks run on every other real frame (with that frame's
 * timestamp), as on a screen capped at 30 Hz. Installed before any page script.
 */
const RAF30_INIT = String.raw`
(() => {
  const real = window.requestAnimationFrame.bind(window);
  let pending = new Map(), next = 1, odd = false;
  const tick = (t) => {
    real(tick);
    odd = !odd;
    if (odd) return;
    const run = pending;
    pending = new Map();
    for (const cb of run.values()) cb(t);
  };
  real(tick);
  window.requestAnimationFrame = (cb) => { const id = next++; pending.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { pending.delete(id); };
})();
`;

export interface PerfResult {
  game: string;
  rate: number;
  frameMs: number;
  p95Ms: number;
  fps: number;
  frames: number;
  runs: number;
  canvases: string[];
  reduced: string | null;
  /** Each live frame's own work (the governor's measure): median, the share over SLOW_WORK_MS (stalls aside), the longest. */
  workMedianMs: number;
  workSlowShare: number;
  workMaxMs: number;
  /** The first step down seen (with stallProbe, the probe around it); null when effects stayed full. */
  stepDown?: StepDown | null;
  /** With stallProbe: cores' worth of CPU used outside the browser over the whole measure (context for a log line). */
  otherCores?: number;
  categories?: Record<string, number>;
  files?: [string, number][];
  /** --raster: draw-call ms per frame, by method and by caller. */
  raster?: { perFrameMs: number; byMethod: [string, number][]; byCaller: [string, number][] };
}

const top = (m: Record<string, number>, frames: number, n: number): [string, number][] =>
  Object.entries(m).map(([k, v]) => [k, v / Math.max(1, frames)] as [string, number]).sort((a, b) => b[1] - a[1]).slice(0, n);

function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function startServer(url: string | undefined, port: number): Promise<{ origin: string; proc: ChildProcess | null }> {
  if (url) return { origin: url.replace(/\/$/, ""), proc: null };
  const proc = spawn("npx", ["vite", "dev", "--port", String(port), "--host", "127.0.0.1", "--strictPort"], { stdio: "ignore", detached: true });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${origin}/practice`);
      if (r.ok) return { origin, proc };
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

/** Self time (ms) of one CPU profile, by source file and by category. */
function attribute(profile: { nodes: { id: number; callFrame: { functionName: string; url: string }; children?: number[] }[]; samples: number[]; timeDeltas: number[] }) {
  const parent = new Map<number, number>();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map<number, number>();
  profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000));
  const file = (url: string) => url.replace(/^https?:\/\/[^/]+\//, "").replace(/\?.*$/, "");
  /** The nearest caller with a source file (a native canvas call is charged to its renderer). */
  const owner = (id: number): string => {
    for (let at: number | undefined = id; at !== undefined; at = parent.get(at)) {
      const url = byId.get(at)!.callFrame.url;
      if (url) return file(url);
    }
    return "";
  };
  const files = new Map<string, number>();
  const cats: Record<string, number> = {};
  for (const [id, ms] of self) {
    const { functionName, url } = byId.get(id)!.callFrame;
    let where = url ? file(url) : owner(id);
    if (!where) where = functionName || "(native)";
    files.set(where, (files.get(where) ?? 0) + ms);
    const name = functionName.toLowerCase();
    let cat: string;
    if (functionName === "(idle)") cat = "idle";
    else if (functionName === "(program)" || functionName === "(garbage collector)" || !where.includes("/")) cat = "browser (raster, style, GC)";
    else if (!url && /text/.test(name)) cat = "text";
    else if (!url && /drawimage|putimage/.test(name)) cat = "sprites / layers";
    else if (/arcadeFx|successFx|momentFx|fx\//i.test(where)) cat = "effects";
    else if (/arenaScene|scene/i.test(where)) cat = "scenery";
    else if (/renderer|Art|art\./.test(where)) cat = "game art";
    else if (/src\/lib\/arcade\/[^/]+\.ts$/.test(where)) cat = "sim";
    else if (/node_modules|@vite|react/i.test(where)) cat = "framework";
    else cat = "app";
    cats[cat] = (cats[cat] ?? 0) + ms;
  }
  if (process.env.PERF_FUNCS) {
    const fns = new Map<string, number>();
    for (const [id, ms] of self) {
      const { functionName, url, lineNumber } = byId.get(id)!.callFrame as { functionName: string; url: string; lineNumber?: number };
      const k = `${functionName || "(anon)"} ${file(url)}:${(lineNumber ?? 0) + 1}`;
      fns.set(k, (fns.get(k) ?? 0) + ms);
    }
    for (const [k, v] of [...fns].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(`        fn ${v.toFixed(0).padStart(6)} ms ${k}`);
  }
  return { files: [...files].sort((a, b) => b[1] - a[1]).slice(0, 12), cats };
}

export interface MeasureOptions {
  width: number;
  height: number;
  dpr: number;
  seconds: number;
  profile?: boolean;
  raster?: boolean;
  /** window.__duelzEffects before the page loads (lib/fx/lowEnd.ts): "full", 1 or 2. */
  effects?: "full" | 1 | 2;
  /** Live play before the first run's measurement starts (the governor settling), ms; default 400. */
  warmupMs?: number;
  /** A display capped at 30 Hz (iPhone Low Power Mode, Android battery saver): requestAnimationFrame fires every other vsync. */
  raf30?: boolean;
  /** One main-thread stall of this many ms, 2.5 s into the first run's play (after the governor's 1 s settle). */
  stallMs?: number;
  /** Sample the CPU used outside the browser (procCpu) and return it around a step down. */
  stallProbe?: boolean;
}

/**
 * Where the governor stepped down in a run, with the CPU the rest of the machine used (procCpu) around
 * it: from SETTLE_MS before the governor's WINDOW_MS judging window to the step down.
 */
export interface StepDown {
  /** Epoch ms of the step down. */
  at: number;
  /** procCpu samples from at − WINDOW_MS − SETTLE_MS to at: [epoch ms, CPU-seconds used by others so far]. */
  probe: [number, number][];
}

/** One game at one CPU slowdown: the mean frame gap over `seconds` of live play (restarting runs that end). */
export async function measure(browser: import("playwright").Browser, origin: string, game: string, rate: number, o: MeasureOptions): Promise<PerfResult> {
  const PROFILE = !!o.profile;
  const SECONDS = o.seconds;
  const context = await browser.newContext({ viewport: { width: o.width, height: o.height }, deviceScaleFactor: o.dpr });
  const page = await context.newPage();
  if (o.effects !== undefined) await page.addInitScript(`window.__duelzEffects = ${JSON.stringify(o.effects)};`);
  if (o.raf30) await page.addInitScript(RAF30_INIT);
  await page.addInitScript(INIT);
  if (o.raster) await page.addInitScript(RASTER_INIT);
  const cdp = await context.newCDPSession(page);
  if (rate > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  const rand = seeded(game.length * 7919 + 17);
  const gaps: number[] = [];
  let runs = 0;
  let canvases: string[] = [];
  let reduced: string | null = null;
  let profileOut: ReturnType<typeof attribute> | undefined;
  const work: number[] = [];
  let raster: { byMethod: Record<string, number>; byCaller: Record<string, number> } | undefined;
  let stepDown: StepDown | null = null;
  const probe: [number, number][] = [];
  const sampleCpu = () => { const c = procCpu(); if (c) probe.push([Date.now(), c.others]); };
  const sampler = o.stallProbe ? setInterval(sampleCpu, 100) : null;
  if (o.stallProbe) sampleCpu();
  const wantMs = SECONDS * 1000;
  try {
    while (gaps.reduce((a, b) => a + b, 0) < wantMs && runs < 12) {
      runs++;
      await gotoRetried(page, `${origin}/practice`, game, { waitUntil: "domcontentloaded" });
      const button = page.getByRole("button", { name: gameDisplayName(game as never), exact: true }).first();
      await button.waitFor({ timeout: 90_000 });
      await page.waitForTimeout(1500);
      await button.click();
      const ready = page.getByRole("button", { name: /^Ready/ });
      await ready.waitFor({ timeout: 90_000 });
      await ready.click();
      if (o.stallMs && runs === 1)
        await page.evaluate((ms) => {
          setTimeout(() => {
            const end = performance.now() + ms;
            while (performance.now() < end) { /* the injected stall */ }
          }, 2500);
        }, o.stallMs);
      // Settle (first frames, lazy sprite caches; with warmupMs, the governor too), then measure.
      await page.waitForTimeout(runs === 1 ? (o.warmupMs ?? 400) : 400);
      await page.evaluate(() => {
        const w = window as never as { __perf: { gaps: number[] | null }; __raster?: { on: boolean } };
        w.__perf.gaps = [];
        (w.__perf as { work?: number[] }).work = [];
        if (w.__raster) w.__raster.on = true;
      });
      if (PROFILE) {
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
        await cdp.send("Profiler.start");
      }
      const arena = await page.locator("[data-game-arena]").first().boundingBox({ timeout: 5000 }).catch(() => null);
      const started = Date.now();
      const have = gaps.reduce((a, b) => a + b, 0);
      while (Date.now() - started < wantMs - have + 200) {
        if (await page.evaluate(() => (window as never as { __perf: { over: boolean } }).__perf.over)) break;
        if (gaps.reduce((a, b) => a + b, 0) + (await page.evaluate(() => (window as never as { __perf: { gaps: number[] } }).__perf.gaps.reduce((a, b) => a + b, 0))) >= wantMs) break;
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
      const got = await page.evaluate(() => {
        const p = (window as never as { __perf: { gaps: number[]; work: number[] } }).__perf;
        const g = p.gaps;
        const work = p.work ?? [];
        p.gaps = null as never;
        p.work = null as never;
        return {
          gaps: g,
          work,
          canvases: [...document.querySelectorAll("[data-game-stage] canvas")].map((c) => {
            const el = c as HTMLCanvasElement;
            return `${el.width}x${el.height}${el.hasAttribute("data-arena-scene") ? " scene" : ""}`;
          }),
          raster: (window as never as { __raster?: { byMethod: Record<string, number>; byCaller: Record<string, number> } }).__raster,
          reduced: document.querySelector("[data-reduced-effects]")?.getAttribute("data-reduced-effects") ?? null,
          reducedAt: (window as never as { __perf: { reducedAt: number | null } }).__perf.reducedAt,
          timeOrigin: performance.timeOrigin,
        };
      });
      if (got.reducedAt !== null && !stepDown) stepDown = { at: got.timeOrigin + got.reducedAt, probe: [] };
      gaps.push(...got.gaps);
      work.push(...got.work);
      if (got.raster) {
        raster ??= { byMethod: {}, byCaller: {} };
        for (const [k, v] of Object.entries(got.raster.byMethod)) raster.byMethod[k] = (raster.byMethod[k] ?? 0) + v;
        for (const [k, v] of Object.entries(got.raster.byCaller)) raster.byCaller[k] = (raster.byCaller[k] ?? 0) + v;
      }
      if (got.canvases.length) canvases = got.canvases;
      reduced = got.reduced ?? reduced;
      if (PROFILE) {
        const { profile } = (await cdp.send("Profiler.stop")) as never as { profile: Parameters<typeof attribute>[0] };
        const one = attribute(profile);
        if (!profileOut) profileOut = { files: [], cats: {} };
        const files = new Map(profileOut.files);
        for (const [f, ms] of one.files) files.set(f, (files.get(f) ?? 0) + ms);
        profileOut.files = [...files].sort((a, b) => b[1] - a[1]);
        for (const [k, v] of Object.entries(one.cats)) profileOut.cats[k] = (profileOut.cats[k] ?? 0) + v;
      }
    }
  } finally {
    if (sampler) clearInterval(sampler);
    await context.close();
  }
  if (stepDown) {
    const from = stepDown.at - WINDOW_MS - SETTLE_MS;
    stepDown.probe = probe.filter(([at]) => at >= from - 200 && at <= stepDown!.at + 200);
  }
  const sum = gaps.reduce((a, b) => a + b, 0);
  const sorted = [...gaps].sort((a, b) => a - b);
  const workSorted = [...work].sort((a, b) => a - b);
  const frameMs = gaps.length ? sum / gaps.length : 0;
  return {
    game, rate, frameMs, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? 0, fps: frameMs ? 1000 / frameMs : 0,
    frames: gaps.length, runs, canvases, reduced,
    workMedianMs: workSorted[Math.floor(workSorted.length / 2)] ?? 0,
    workSlowShare: work.length ? work.filter((w) => w > SLOW_WORK_MS && w <= STALL_MS).length / work.length : 0,
    workMaxMs: workSorted[workSorted.length - 1] ?? 0,
    stepDown,
    ...(o.stallProbe && probe.length > 1 ? { otherCores: (probe.at(-1)![1] - probe[0]![1]) / ((probe.at(-1)![0] - probe[0]![0]) / 1000) } : {}),
    ...(profileOut ? { categories: profileOut.cats, files: profileOut.files } : {}),
    ...(raster ? { raster: { perFrameMs: Object.values(raster.byMethod).reduce((a, b) => a + b, 0) / Math.max(1, gaps.length), byMethod: top(raster.byMethod, gaps.length, 12), byCaller: top(raster.byCaller, gaps.length, 16) } } : {}),
  };
}

async function main() {
  if (!existsSync(CHROMIUM)) {
    console.log(`FAIL: environment: no Chromium at ${CHROMIUM}`);
    process.exit(1);
  }
  const { chromium } = await import("playwright");
  const games = ARCADE_STAGE_GAMES.filter((g) => ONLY.length === 0 || ONLY.includes(g));
  const { origin, proc } = await startServer(URL_ARG, PORT);
  const browser = await chromium.launch({ executablePath: CHROMIUM });
  const results: PerfResult[] = [];
  try {
    await warmUp(browser, `${origin}/practice`, (page) => page.getByRole("button", { name: gameDisplayName(games[0] as never), exact: true }).first().waitFor({ timeout: 180_000 }));
    for (const game of games) {
      for (const rate of RATES) {
        const r = await measure(browser, origin, game, rate, { width: VW, height: VH, dpr: DPR, seconds: SECONDS, profile: PROFILE, raster: RASTER, warmupMs: WARMUP, raf30: RAF30, stallMs: STALL, ...(EFFECTS ? { effects: EFFECTS } : {}) });
        results.push(r);
        const cats = r.categories ? " · " + Object.entries(r.categories).filter(([k]) => k !== "idle").sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(", ") : "";
        console.log(`${game.padEnd(10)} ${String(rate).padStart(2)}× ${r.frameMs.toFixed(1).padStart(6)} ms ${r.fps.toFixed(1).padStart(5)} fps p95 ${r.p95Ms.toFixed(1).padStart(6)} · ${r.frames} frames ${r.runs} runs · ${r.canvases.join(", ")}${` · work median ${r.workMedianMs.toFixed(1)} ms, ${(r.workSlowShare * 100).toFixed(0)} % slow, max ${r.workMaxMs.toFixed(0)} ms`}${r.reduced ? ` · reduced ${r.reduced}` : " · full effects"}${cats}`);
        if (r.raster) {
          console.log(`      raster ${r.raster.perFrameMs.toFixed(2)} ms a frame`);
          for (const [k, ms] of r.raster.byMethod) console.log(`      ${ms.toFixed(3).padStart(7)}  ${k}`);
          for (const [k, ms] of r.raster.byCaller) console.log(`      ${ms.toFixed(3).padStart(7)}  ${k}`);
        }
        if (r.files) for (const [f, ms] of r.files.slice(0, 8)) console.log(`      ${ms.toFixed(0).padStart(6)} ms  ${f}`);
      }
    }
  } finally {
    await browser.close();
    if (proc?.pid) try { process.kill(-proc.pid); } catch { /* gone */ }
  }
  if (JSON_PATH) writeFileSync(JSON_PATH, JSON.stringify({ size: `${VW}x${VH}`, dpr: DPR, seconds: SECONDS, results }, null, 1) + "\n");
}

if (import.meta.main) await main();
