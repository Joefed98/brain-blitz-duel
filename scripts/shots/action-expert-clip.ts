/**
 * The Action overhaul's Expert clips (16 Nov 2026, docs/design/pages-review/action/GALLERY.md, each game's "Stage 3"): one
 * real Expert run per game, played by the human-limited elite bot the level tuning used, graded by the server replay on
 * the dealt puzzle (`gradeAnswer`), and drawn frame by frame by the game's own renderer through @napi-rs/canvas (every
 * tick drawn, so effects see every frame; a chosen stretch kept at a few frames a second), with a caption strip under the
 * world: the level, the seed and the server's final score. Made into an animated WebP by ffmpeg (libwebp_anim). A design
 * tool, not a check.
 *
 *   bun scripts/shots/action-expert-clip.ts <game> <seed> [--from=<s>] [--secs=<n>] [--out=<path>]
 *       [--width=180] [--fps=5] [--q=30] [--max=80000] [--hold=1.2] [--frames=<dir>]
 *
 * The world is scaled to --width; the quality steps down from --q by 5 until the file fits --max bytes (the gallery's
 * budget); a stretch reaching the run's end holds the last state --hold seconds for the end card. --frames keeps the PNGs.
 * <seed> is what each game's "Levels" section lists (docs/arcade-standard/<game>.md): Roofbound a room seed n
 * (`dealAt` n, scripts/flip-skyline-levels-bands.ts), Moon Climb a dealt tower seed (found among the first 64 Expert
 * deals), Orbit an Expert bank entry (the first deal whose seed picks that entry, `seed mod bank length`). One row per
 * game in GAMES below: other games add their own row.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCanvas, GlobalFonts, loadImage, Path2D as NapiPath2D } from "@napi-rs/canvas";

let clockMs = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clockMs } });
const g = globalThis as Record<string, unknown>;
g.document = { createElement: () => createCanvas(1, 1), fonts: { load: async () => [], check: () => true }, documentElement: { dataset: {}, classList: { contains: () => false } }, hidden: false, addEventListener() {} };
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
g.window = {
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  devicePixelRatio: 1,
  location: { pathname: "/", search: "", href: "http://localhost/" },
  getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {},
  addEventListener() {},
  removeEventListener() {},
};
g.matchMedia = (g.window as { matchMedia: unknown }).matchMedia;
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof g.Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");

const { gradeAnswer } = await import("../../src/lib/duel/generate.server");
const { appendClientCounters, arcadeCounters } = await import("../../src/lib/arcade/diagnostics");
const { GAME_BY_TYPE } = await import("../arcade-skill-bands/games");
const { dealAt } = await import("../level-tune");

type Ctx = CanvasRenderingContext2D;
interface Clip {
  /** Every state of the run, tick 0 first. */
  states: any[];
  score: number;
  label: string;
  /** The world's size (CSS px) and how to draw one state into it. */
  w: number;
  h: number;
  draw: (ctx: Ctx, state: any) => void;
}

/** The skill-band bots, loaded before a run (Orbit's human limits wrap the run itself, which must stay synchronous). */
const BOTS = new Map<string, any>();
async function loadBot(type: string): Promise<void> {
  BOTS.set(type, ((await import(`../arcade-skill-bands/bots/${type}.ts`)) as { bot: any }).bot);
}
/** Plays a bot's run tick by tick (every state kept) as the phone records it, and grades it through the server replay. */
function playAndGrade(type: string, puzzle: any, rev: number | null, human: any): { states: any[]; score: number; flagged: boolean } {
  const spec: any = GAME_BY_TYPE.get(type as never)!;
  const game = spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(rev, puzzle.seed);
  const bot = BOTS.get(type)!;
  const seed = Number(puzzle.seed);
  const out = bot({ game, seed, rev, human, fixes: true });
  const events = out.events ?? [];
  const taps = new Set<number>(out.taps ?? []);
  const byTick = new Map(events.map((e: any) => [e.t, e]));
  let state = game.init(seed);
  const states = [state];
  const checkpoints: unknown[] = [];
  while (!game.isOver(state) && state.tick < game.runTicks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? taps.has(t) : (byTick.get(t) ?? null));
    states.push(state);
    if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  }
  const claimed = game.score(state);
  const body = { seed, claimedScore: claimed, events, inputs: out.taps ?? [], taps: [], endTick: state.tick, checkpoints };
  const raw = appendClientCounters(spec.encode(body, rev, seed), arcadeCounters(type as never, state, claimed));
  const graded = gradeAnswer(puzzle, raw, 0);
  return { states, score: graded.score, flagged: Boolean((graded.extra as any)?.flagged) };
}

/** One row per game: deal the Expert puzzle for the doc's seed, play the limited elite, draw with the game's renderer. */
const GAMES: Record<string, (seed: number) => Promise<Clip>> = {
  /** Roofbound: room seed n (flip-skyline-levels-bands.ts), the limited elite (humanLimits.ts). */
  flip: async (n) => {
    await loadBot("flip");
    const { limitedElite } = await import("../arcade-skill-bands/humanLimits");
    const { flipArtGameFor } = await import("../../src/lib/arcade/flipArt.renderer");
    const { flipWorldH, FLIP_WORLD_W } = await import("../../src/lib/arcade/flip");
    const puzzle = dealAt("flip" as never, "expert", n) as any;
    const r = playAndGrade("flip", puzzle, puzzle.flipRev, limitedElite("flip", puzzle.seed));
    if (r.flagged) throw new Error("flagged");
    const art = flipArtGameFor(puzzle.flipRev, puzzle.level);
    const h = flipWorldH(r.states[0]);
    return { states: r.states, score: r.score, label: `room seed ${n}`, w: FLIP_WORLD_W, h, draw: (ctx, s) => art.draw(ctx, s, { width: FLIP_WORLD_W, height: h }) };
  },
  /** Moon Climb: the dealt tower seed (action-levels-bands.ts --each), the elite under human limits. */
  ricochet: async (towerSeed) => {
    await loadBot("ricochet");
    const { limitedHuman } = await import("../action-levels-bands");
    const { drawNinjaFrame } = await import("../../src/lib/arcade/ricochetNinja.renderer");
    const { NINJA_WORLD_W, NINJA_WORLD_H } = await import("../../src/lib/arcade/ricochetNinja");
    let puzzle: any = null;
    for (let n = 0; n < 64 && !puzzle; n++) {
      const p = dealAt("ricochet" as never, "expert", n) as any;
      if (p.seed === towerSeed) puzzle = p;
    }
    if (!puzzle) throw new Error(`no Expert deal with tower seed ${towerSeed} in the first 64`);
    const r = playAndGrade("ricochet", puzzle, puzzle.ricoRev, limitedHuman("ricochet", puzzle.seed, "elite"));
    if (r.flagged) throw new Error("flagged");
    return { states: r.states, score: r.score, label: `tower ${towerSeed}`, w: NINJA_WORLD_W, h: NINJA_WORLD_H, draw: (ctx, s) => drawNinjaFrame(ctx, s, { width: NINJA_WORLD_W, height: NINJA_WORLD_H }) };
  },
  /** Orbit: Expert bank entry (a deal takes entry seed mod 31), the elite under ORBIT_HUMAN_LIMITS. */
  orbit: async (entry) => {
    await loadBot("orbit");
    const { withHumanLimits } = await import("../orbit-level-bands");
    const { Human } = await import("../arcade-skill-bands/human");
    const art = await import("../../src/lib/arcade/orbit.renderer");
    const planetsR = await import("../../src/lib/arcade/orbitPlanets.renderer");
    const { ORBIT_PLANET_MAPS } = await import("../../src/lib/arcade/orbitPlanetMaps.data");
    for (const [name, m] of Object.entries(ORBIT_PLANET_MAPS)) {
      for (const [key, file] of [[name, `${name}.webp`], ...((m as any).height ? [[`${name}-h`, `${name}-h.webp`]] : [])] as [string, string][]) {
        const img = await loadImage(`public/orbit/planets/${file}`);
        const c = createCanvas(img.width, img.height);
        const x = c.getContext("2d");
        x.drawImage(img, 0, 0);
        planetsR.setOrbitPlanetMap(key as never, { w: img.width, h: img.height, data: x.getImageData(0, 0, img.width, img.height).data as never });
      }
    }
    const { ORBIT_FUEL_BANK_EXPERT: bank } = await import("../../src/lib/duel/orbitFuelBankExpert.server");
    const L = bank.length;
    let n = 0;
    let puzzle: any = null;
    for (; n < 500 && !puzzle; n++) {
      const p = dealAt("orbit" as never, "expert", n) as any;
      if (((p.seed % L) + L) % L === entry) puzzle = p;
    }
    n--;
    if (!puzzle || JSON.stringify(puzzle.planets) !== JSON.stringify(bank[entry]!.planets)) throw new Error(`no Expert deal on bank entry ${entry}`);
    const r = withHumanLimits(true, () => playAndGrade("orbit", puzzle, puzzle.orbitRev, new Human("orbit", puzzle.seed, "elite")));
    if (r.flagged) throw new Error("flagged");
    const W = 450;
    const H = art.orbitDrawHFor(puzzle.orbitRev);
    return { states: r.states, score: r.score, label: `bank entry ${entry} (bank seed ${bank[entry]!.seed}; room seed n=${n})`, w: W, h: H, draw: (ctx, s) => art.orbitRev3ArtGame.draw(ctx, s, { width: W, height: H }) };
  },
};

const args = process.argv.slice(2);
const opt = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const [type, seedArg] = args.filter((a) => !a.startsWith("--"));
if (!type || !GAMES[type] || seedArg === undefined) throw new Error(`usage: bun scripts/shots/action-expert-clip.ts <${Object.keys(GAMES).join("|")}> <seed> [--from=<s>] [--secs=<n>] [--out=<path>]`);
const clip = await GAMES[type]!(Number(seedArg));
const fromS = Number(opt("from") ?? 0);
const secs = Number(opt("secs") ?? 5);
const fps = Number(opt("fps") ?? 5);
const outW = Number(opt("width") ?? 180);
const q0 = Number(opt("q") ?? 30);
/** The gallery's budget: the quality steps down by 5 (to 5 at least) until the clip fits --max bytes (default 80,000). */
const maxBytes = Number(opt("max") ?? 80_000);
const out = opt("out") ?? `.shots/action-expert/${type}-expert-clip.webp`;
const every = Math.round(60 / fps);
const fromT = Math.round(fromS * 60);
const toT = Math.min(clip.states.length - 1, fromT + Math.round(secs * 60));

// Every tick from a second before the stretch is drawn on one world canvas (so effects see each frame); kept frames are
// scaled to outW with a caption strip under them.
const world = createCanvas(clip.w, clip.h);
const wctx = world.getContext("2d") as unknown as Ctx;
const scale = outW / clip.w;
const worldH = Math.round(clip.h * scale);
const CAP = 18;
const frames = opt("frames") ?? mkdtempSync(join(tmpdir(), "expert-clip-"));
mkdirSync(frames, { recursive: true });
// A stretch that reaches the run's end holds its last state for --hold seconds (default 1.2), so the end card counts up.
const holdT = toT === clip.states.length - 1 ? Math.round(Number(opt("hold") ?? 1.2) * 60) : 0;
let k = 0;
for (let t = Math.max(0, fromT - 60); t <= toT + holdT; t++) {
  clockMs += 1000 / 60;
  clip.draw(wctx, clip.states[Math.min(t, toT)]);
  if (t < fromT || (t - fromT) % every !== 0) continue;
  const f = createCanvas(outW, worldH + CAP);
  const c = f.getContext("2d");
  c.fillStyle = "#070709";
  c.fillRect(0, 0, f.width, f.height);
  c.drawImage(world, 0, 0, outW, worldH);
  c.fillStyle = "#F3F1EC";
  c.font = "700 11px Archivo";
  c.textBaseline = "middle";
  c.fillText(`Expert · ${(Math.min(t, toT) / 60).toFixed(0)} s`, 6, worldH + CAP / 2);
  c.textAlign = "right";
  c.fillStyle = "#F2C75C";
  c.fillText(`final ${clip.score}`, outW - 6, worldH + CAP / 2);
  writeFileSync(join(frames, `f${String(k++).padStart(4, "0")}.png`), f.toBuffer("image/png"));
}
mkdirSync(join(out, ".."), { recursive: true });
let q = q0;
for (;;) {
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(frames, "f%04d.png"), "-c:v", "libwebp_anim", "-lossless", "0", "-q:v", String(q), "-compression_level", "6", "-loop", "0", out]);
  if (statSync(out).size <= maxBytes || q <= 5) break;
  q = Math.max(5, q - 5);
}
if (!opt("frames")) rmSync(frames, { recursive: true, force: true });
const last = clip.states[clip.states.length - 1];
console.log(`${type} Expert ${clip.label}: server score ${clip.score}, run ended at ${(last.tick / 60).toFixed(1)} s; clip ${fromS}–${(toT / 60).toFixed(1)} s, ${k} frames, ${out} ${statSync(out).size} bytes at quality ${q}`);
