/**
 * Level frames for the Strategy overhaul's stage 3 (derived from strategy-fx-clips.ts) (15 Nov 2026) for the gallery: each game's intro deal played by its
 * skill-band bot at the Near-perfect level (as the intro stills are), the run searched for the tick where each effect
 * fires, then every tick round it drawn by the game's own renderer on a Node canvas (@napi-rs/canvas) with the rendered
 * materials loaded, every second frame kept, a crop round the moment saved as PNG frames in --out (default
 * .shots/strategy-fx/<game>-<effect>-<n>.png). scripts/shots/strategy-gallery.py joins them into animated WebPs.
 *
 *   bun scripts/shots/strategy-fx-clips.ts [--out=<dir>]
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createCanvas, loadImage, Path2D as NapiPath2D } from "@napi-rs/canvas";

let clock = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    devicePixelRatio: 1,
    location: { pathname: "/", search: "", hash: "", href: "http://localhost/" },
    addEventListener() {},
    removeEventListener() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {},
  },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/strategy-levels";
mkdirSync(out, { recursive: true });

const { GAMES } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { exampleFor } = await import("./examples");
const { dealAt } = await import("../level-tune");
const { LIVE_BANDS } = await import("../../src/lib/arcade/liveBands");
const { makeBallTrackGame } = await import("../../src/lib/arcade/ballTrack");
const { STRATEGY_ART } = await import("../../src/lib/arcade/strategyArt.data");
const { setStrategyImageForShots } = await import("../../src/lib/arcade/strategyArt");
for (const name of Object.keys(STRATEGY_ART) as (keyof typeof STRATEGY_ART)[]) setStrategyImageForShots(name, await loadImage(readFileSync(`public/strategy/${name}.webp`)));
const { tiltPitLip } = await import("../../src/lib/arcade/tiltLip");
const { bubbleNearLine } = await import("../../src/lib/arcade/strategyFx");

type Run = { type: string; states: any[]; draw: (ctx: CanvasRenderingContext2D, s: any) => void; w: number; h: (s: any) => number; puzzle: any };

async function play(type: string, ticks: number, level = "near", difficulty: "easy" | "normal" | "hard" | "expert" = "normal"): Promise<Run> {
  const spec = GAMES.find((g) => g.type === type)!;
  const bot = ((await import(`../arcade-skill-bands/bots/${type}.ts`)) as { bot: any }).bot;
  const puzzle = (difficulty === "normal" ? exampleFor(type as any) : dealAt(type as any, difficulty, 3)) as Record<string, unknown>;
  const seed = Number(puzzle.seed);
  const field = (LIVE_BANDS as Record<string, { field: string } | undefined>)[type]!.field;
  const rev = typeof puzzle[field] === "number" ? (puzzle[field] as number) : null;
  const game: any = type === "balltrack" && puzzle.course ? makeBallTrackGame(puzzle.course as any, rev) : spec.gameFor(rev, seed);
  const res = bot({ game, seed, rev, human: new Human(type, seed, level as any), fixes: true });
  const byTick = new Map<number, unknown>((res.events ?? []).map((e: { t: number }) => [e.t, e]));
  const taps = new Set<number>(res.taps ?? []);
  let state = game.init(seed);
  const states = [state];
  while (!game.isOver(state) && state.tick < ticks) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? taps.has(t) : (byTick.get(t) ?? null));
    states.push(state);
  }
  let draw: Run["draw"];
  let w = 390;
  let h: Run["h"] = () => 730;
  if (type === "tilt") {
    const art = await import("../../src/lib/arcade/tiltArt.renderer");
    const t = await import("../../src/lib/arcade/tilt");
    w = t.TILT_X_W;
    h = () => t.TILT_X_H;
    draw = (ctx, s) => art.tiltArtGameFor(rev).draw(ctx, s, { width: w, height: t.TILT_X_H });
  } else if (type === "matchup") {
    const art = await import("../../src/lib/arcade/matchup.renderer");
    const m = await import("../../src/lib/arcade/matchup");
    w = m.MATCHUP_WORLD_W;
    h = (s) => m.matchupWorldH(s);
    draw = (ctx, s) => art.drawMatchupArt(ctx, s, { width: w, height: m.matchupWorldH(s) });
  } else if (type === "bubble") {
    const art = await import("../../src/lib/arcade/bubble.renderer");
    const b = await import("../../src/lib/arcade/bubble");
    w = b.BUB_WORLD_W;
    h = (s) => b.bubWorldH(s);
    draw = (ctx, s) => art.drawBubbleArt(ctx, s, { width: w, height: b.bubWorldH(s) });
  } else if (type === "inkbridge") {
    const art = await import("../../src/lib/arcade/inkBridge.renderer");
    const k = await import("../../src/lib/arcade/inkBridge");
    w = k.INK_WORLD_W;
    h = (s) => k.inkWorldH(s);
    draw = (ctx, s) => art.inkBridgeArtGameFor(rev).draw(ctx, s, { width: w, height: k.inkWorldH(s) });
  } else {
    const art = await import("../../src/lib/arcade/ballTrackArt.renderer");
    const bt = await import("../../src/lib/arcade/ballTrack");
    w = bt.BT_W;
    h = (s) => bt.btWorldH(s);
    draw = (ctx, s) => art.btArtDraw(ctx, puzzle.course as any, s);
  }
  return { type, states, draw, w, h, puzzle };
}


/** One frame of each game at each level, at tick `at` of the Near-perfect bot's run, as PNG. */
for (const type of ["tilt", "matchup", "bubble", "inkbridge", "balltrack"]) {
  for (const difficulty of ["easy", "normal", "hard", "expert"] as const) {
    const at = type === "tilt" ? 700 : type === "inkbridge" ? 900 : 1500;
    const run = await play(type, at, "near", difficulty);
    const i = Math.min(at, run.states.length - 1);
    const H = run.h(run.states[i]);
    const canvas = createCanvas(run.w * 2, H * 2);
    const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
    for (let k = Math.max(0, i - 30); k <= i; k++) {
      clock = 10_000 + (k * 1000) / 60;
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.clearRect(0, 0, run.w, H);
      run.draw(ctx, run.states[k]);
    }
    writeFileSync(`${out}/${type}-${difficulty}.png`, canvas.toBuffer("image/png"));
    console.log(`${type} ${difficulty}: tick ${i}`);
  }
}
