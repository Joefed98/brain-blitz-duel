/**
 * The Strategy games' intro stills (the Strategy overhaul, 15 Nov 2026; Joe: "real frames of today's games, not the old
 * abstract drawings"). Each still is a real frame: the intro example's deal (scripts/shots/examples.ts, the round the
 * intro and audit show) played by the game's skill-band bot at the Near-perfect level for a few seconds, then drawn by
 * the game's own renderer on a Node canvas (@napi-rs/canvas) at 2× the 210 px the intro shows, and encoded as WebP
 * under STILL_MAX_BYTES into public/intro/<type>.webp, with src/components/puzzles/strategyStills.data.ts holding each
 * file's content hash (put on its URL, as the tile scenes do). Deterministic: the same bytes every run.
 *
 *   bun scripts/shots/strategy-stills.ts [types…] [--check]
 *
 * `--check` re-renders and fails unless every file and hash is what is written.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, loadImage, Path2D as NapiPath2D } from "@napi-rs/canvas";

Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
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

const { GAMES } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { exampleFor } = await import("./examples");
const { LIVE_BANDS } = await import("../../src/lib/arcade/liveBands");
const { makeBallTrackGame } = await import("../../src/lib/arcade/ballTrack");
// The rendered materials (stage 2, public/strategy/): handed to the renderers as the app's loader would.
{
  const { STRATEGY_ART } = await import("../../src/lib/arcade/strategyArt.data");
  const { setStrategyImageForShots } = await import("../../src/lib/arcade/strategyArt");
  for (const name of Object.keys(STRATEGY_ART) as (keyof typeof STRATEGY_ART)[]) {
    setStrategyImageForShots(name, await loadImage(readFileSync(`public/strategy/${name}.webp`)));
  }
}

export const STILL_TYPES = ["tilt", "matchup", "bubble", "inkbridge", "balltrack"] as const;
/** The intro shows a still 210 px wide; the file is 2× that. */
export const STILL_W = 420;
export const STILL_MAX_BYTES = 60_000;
/** How far into the bot's round each still is taken (ticks). */
const AT: Record<(typeof STILL_TYPES)[number], number> = { tilt: 900, matchup: 1500, bubble: 1500, inkbridge: 900, balltrack: 1200 };
const OUT_DIR = "public/intro";
const DATA = "src/components/puzzles/strategyStills.data.ts";

async function renderStill(type: (typeof STILL_TYPES)[number]): Promise<Buffer> {
  const spec = GAMES.find((g) => g.type === type)!;
  const bot = ((await import(`../arcade-skill-bands/bots/${type}.ts`)) as { bot: any }).bot;
  const puzzle = exampleFor(type as any) as Record<string, unknown>;
  const seed = Number(puzzle.seed);
  const field = (LIVE_BANDS as Record<string, { field: string } | undefined>)[type]!.field;
  const rev = typeof puzzle[field] === "number" ? (puzzle[field] as number) : null;
  const game: any = type === "balltrack" && puzzle.course ? makeBallTrackGame(puzzle.course as any, rev) : spec.gameFor(rev, seed);
  const out = bot({ game, seed, rev, human: new Human(type, seed, "near"), fixes: true });
  const byTick = new Map<number, unknown>((out.events ?? []).map((e: { t: number }) => [e.t, e]));
  const taps = new Set<number>(out.taps ?? []);
  let state = game.init(seed);
  while (!game.isOver(state) && state.tick < AT[type]) {
    const t = state.tick + 1;
    state = game.step(state, spec.taps ? taps.has(t) : (byTick.get(t) ?? null));
  }
  // The game's own art, at its world size, scaled to the still's width.
  let worldW = 390;
  let worldH = 730;
  let draw: (ctx: CanvasRenderingContext2D) => void;
  if (type === "tilt") {
    const art = await import("../../src/lib/arcade/tiltArt.renderer");
    const { TILT_X_W, TILT_X_H } = await import("../../src/lib/arcade/tilt");
    worldW = TILT_X_W;
    worldH = TILT_X_H;
    draw = (ctx) => art.tiltArtGameFor(rev).draw(ctx, state, { width: worldW, height: worldH });
  } else if (type === "matchup") {
    const art = await import("../../src/lib/arcade/matchup.renderer");
    const m = await import("../../src/lib/arcade/matchup");
    worldW = m.MATCHUP_WORLD_W;
    worldH = m.matchupWorldH(state);
    draw = (ctx) => art.drawMatchupArt(ctx, state, { width: worldW, height: worldH });
  } else if (type === "bubble") {
    const art = await import("../../src/lib/arcade/bubble.renderer");
    const b = await import("../../src/lib/arcade/bubble");
    worldW = b.BUB_WORLD_W;
    worldH = b.bubWorldH(state);
    draw = (ctx) => art.drawBubbleArt(ctx, state, { width: worldW, height: worldH });
  } else if (type === "inkbridge") {
    const art = await import("../../src/lib/arcade/inkBridge.renderer");
    const k = await import("../../src/lib/arcade/inkBridge");
    worldW = k.INK_WORLD_W;
    worldH = k.inkWorldH(state);
    draw = (ctx) => art.inkBridgeArtGameFor(rev).draw(ctx, state, { width: worldW, height: worldH });
  } else {
    const art = await import("../../src/lib/arcade/ballTrackArt.renderer");
    const bt = await import("../../src/lib/arcade/ballTrack");
    worldW = bt.BT_W;
    worldH = bt.btWorldH(state);
    draw = (ctx) => art.btArtDraw(ctx, puzzle.course as any, state);
  }
  const scale = STILL_W / worldW;
  const canvas = createCanvas(STILL_W, Math.round(worldH * scale));
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(scale, scale);
  draw(ctx);
  let webp: Buffer | null = null;
  for (let q = 82; q >= 40; q -= 6) {
    webp = await canvas.encode("webp", q);
    if (webp.length <= STILL_MAX_BYTES) break;
  }
  return webp!;
}

if (import.meta.main) {
  const check = process.argv.includes("--check");
  const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const types = STILL_TYPES.filter((t) => !only.length || only.includes(t));
  mkdirSync(OUT_DIR, { recursive: true });
  let bad = 0;
  for (const type of types) {
    const bytes = await renderStill(type);
    const path = join(OUT_DIR, `${type}.webp`);
    if (check) {
      if (!existsSync(path) || !readFileSync(path).equals(bytes)) {
        console.log(`FAIL ${path}: not what the renderer draws now (re-run bun scripts/shots/strategy-stills.ts)`);
        bad++;
      }
    } else writeFileSync(path, bytes);
    console.log(`${type}: ${bytes.length} bytes`);
  }
  const hashes = STILL_TYPES.map((t) => {
    const p = join(OUT_DIR, `${t}.webp`);
    return `  ${t}: "${existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex").slice(0, 10) : ""}",`;
  }).join("\n");
  const data = `/**
 * The Strategy games' intro stills (built by \`bun scripts/shots/strategy-stills.ts\`, do not edit): each file's content
 * hash, put on its URL so a redrawn still is never served from an old cache.
 */
export const STRATEGY_STILLS: Record<"tilt" | "matchup" | "bubble" | "inkbridge" | "balltrack", string> = {
${hashes}
};
`;
  if (check) {
    if (!existsSync(DATA) || readFileSync(DATA, "utf8") !== data) {
      console.log(`FAIL ${DATA}: hashes out of date`);
      bad++;
    }
  } else writeFileSync(DATA, data);
  if (bad) process.exit(1);
}
