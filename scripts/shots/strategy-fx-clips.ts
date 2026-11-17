/**
 * Clips of the Strategy overhaul's stage-2 effects (15 Nov 2026) for the gallery: each game's intro deal played by its
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

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots/strategy-fx";
mkdirSync(out, { recursive: true });

const { GAMES } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { exampleFor } = await import("./examples");
const { LIVE_BANDS } = await import("../../src/lib/arcade/liveBands");
const { makeBallTrackGame } = await import("../../src/lib/arcade/ballTrack");
const { STRATEGY_ART } = await import("../../src/lib/arcade/strategyArt.data");
const { setStrategyImageForShots } = await import("../../src/lib/arcade/strategyArt");
for (const name of Object.keys(STRATEGY_ART) as (keyof typeof STRATEGY_ART)[]) setStrategyImageForShots(name, await loadImage(readFileSync(`public/strategy/${name}.webp`)));
const { tiltPitLip } = await import("../../src/lib/arcade/tiltLip");
const { bubbleNearLine } = await import("../../src/lib/arcade/strategyFx");

type Run = { type: string; states: any[]; draw: (ctx: CanvasRenderingContext2D, s: any) => void; w: number; h: (s: any) => number; puzzle: any };

async function play(type: string, ticks: number, level = "near"): Promise<Run> {
  const spec = GAMES.find((g) => g.type === type)!;
  const bot = ((await import(`../arcade-skill-bands/bots/${type}.ts`)) as { bot: any }).bot;
  const puzzle = exampleFor(type as any) as Record<string, unknown>;
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

/** The first tick (after `from`) where `when(prev, now)` holds. */
function first(run: Run, when: (a: any, b: any) => boolean, from = 30): number {
  for (let i = Math.max(1, from); i < run.states.length; i++) if (when(run.states[i - 1], run.states[i])) return i;
  return -1;
}

/** Draws ticks t0−10 … t0+span (memory warmed), keeping every second frame from t0−2, cropped to `crop` (world px). */
function clip(run: Run, name: string, t0: number, span: number, crop: [number, number, number, number] | null): number {
  if (t0 < 0) {
    console.log(`${run.type} ${name}: no moment found`);
    return 0;
  }
  const H = run.h(run.states[t0]);
  const scale = 2;
  const canvas = createCanvas(run.w * scale, H * scale);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  let n = 0;
  for (let i = Math.max(0, t0 - 10); i <= Math.min(run.states.length - 1, t0 + span); i++) {
    clock = 10_000 + (i * 1000) / 60;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, run.w, H);
    run.draw(ctx, run.states[i]);
    if (i < t0 - 2 || (i - t0) % 2) continue;
    const [x, y, cw, ch] = crop ?? [0, 0, run.w, H];
    const frame = createCanvas(cw * scale, ch * scale);
    frame.getContext("2d").drawImage(canvas as any, x * scale, y * scale, cw * scale, ch * scale, 0, 0, cw * scale, ch * scale);
    writeFileSync(`${out}/${run.type}-${name}-${String(n++).padStart(2, "0")}.png`, frame.toBuffer("image/png"));
  }
  console.log(`${run.type} ${name}: tick ${t0}, ${n} frames`);
  return n;
}

{
  const run = await play("tilt", 5400);
  const t = await import("../../src/lib/arcade/tilt");
  const mazeOf = (s: any) => s.list[Math.min(s.level, s.list.length - 1)];
  clip(run, "knock", first(run, (a, b) => b.level === a.level && ((Math.abs(a.vx) > 100 && b.vx === 0) || (Math.abs(a.vy) > 100 && b.vy === 0))), 16, null);
  const weak = await play("tilt", 5400, "weak");
  clip(weak, "lip", first(weak, (a, b) => { const m = mazeOf(b); const o = (m.n * m.cs) / 512; return !b.aHome && tiltPitLip(m, b.x / 256 - o, b.y / 256 - o, m.br / 256) >= 0 && tiltPitLip(m, a.x / 256 - o, a.y / 256 - o, m.br / 256) < 0; }), 24, null);
  clip(run, "maze-swap", first(run, (a, b) => b.mazes > a.mazes), 34, null);
  void t;
}
{
  const run = await play("matchup", 5400);
  clip(run, "goal-spark", first(run, (a, b) => b.six && (b.goalLeft ?? []).reduce((x: number, y: number) => x + y, 0) < (a.goalLeft ?? []).reduce((x: number, y: number) => x + y, 0), 60), 28, null);
  clip(run, "ice-crack", first(run, (a, b) => (b.iceBroken ?? 0) > (a.iceBroken ?? 0)), 22, null);
}
{
  const run = await play("bubble", 5400);
  clip(run, "stick-squash", first(run, (a, b) => a.flightColour && !b.flightColour && b.popped === a.popped && b.dropped === a.dropped), 12, null);
  clip(run, "reef-rumble", first(run, (a, b) => b.descents > a.descents), 18, null);
  const weak = await play("bubble", 5400, "weak");
  clip(weak, "warning", first(weak, (a, b) => bubbleNearLine(b) && !bubbleNearLine(a)), 40, null);
}
{
  const run = await play("inkbridge", 5400);
  clip(run, "coin-wobble", first(run, (a, b) => b.dropping && !a.dropping), 18, null);
  const lvl = (s: any) => s.list[Math.min(s.level, s.list.length - 1)];
  clip(run, "bird-flap", first(run, (a, b) => b.dropping && lvl(b).blocks.some((bl: any) => bl.h && Math.abs(b.ball.x / 256 - (bl.x0 + bl.x1) / 2) < (bl.x1 - bl.x0) / 2 + 26 && Math.abs(b.ball.y / 256 - bl.y) < 30)), 36, null);
  const weak = await play("inkbridge", 5400, "weak");
  clip(weak, "miss-fall", first(weak, (a, b) => b.dropping && b.ball.y / 256 > lvl(b).bucketY + 40 && a.ball.y / 256 <= lvl(b).bucketY + 40), 20, null);
  clip(run, "pot-captain", first(run, (a, b) => b.flashKind === 1 && b.flashTick === b.tick), 40, null);
}
{
  const run = await play("balltrack", 4800);
  const course = run.puzzle.course;
  const weak = await play("balltrack", 4800, "weak");
  clip(weak, "carry", first(weak, (a, b) => b.actions > a.actions && b.balls.some((x: any) => x.cell >= 0 && (b.turned?.[x.cell] ?? -1) === b.tick)), 12, null);
  clip(run, "booster", first(run, (a, b) => (course.boost ?? []).length > 0 && b.balls.some((x: any) => (course.boost ?? []).includes(x.cell))), 14, null);
  clip(run, "combo", first(run, (a, b) => (b.streak ?? 0) > (a.streak ?? 0) && (b.streak ?? 0) >= 3), 40, null);
  clip(run, "wrong-cup", first(run, (a, b) => b.wrong > a.wrong), 24, null);
  clip(run, "cup-pulse", course.relay.tick - 60, 70, null);
}
