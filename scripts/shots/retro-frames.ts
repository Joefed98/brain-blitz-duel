/**
 * Retro overhaul frames (15 Nov 2026, a design tool, not a check): each Retro game's arena drawn by its own renderer in
 * Node (@napi-rs/canvas, as tap-mapping-check does), at the room-dealt stamp, the skill-band bot's Near-perfect log
 * played to a fixed share of the run. The same script run on main (a git worktree) and on the branch gives the gallery's
 * "today" and "new" frames from identical runs: docs/design/pages-review/retro/GALLERY.md.
 *
 *   bun scripts/shots/retro-frames.ts --out=<dir> [--tag=new] [--at=0.5] [games…]
 *
 * The pixel HUD font (Press Start 2P) is loaded from Google Fonts in the app; here it falls back to a monospace face.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => 10_000 } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    devicePixelRatio: 2,
    location: { pathname: "/", search: "", href: "http://localhost/" },
    addEventListener() {},
    removeEventListener() {},
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

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = opt("out") ?? ".shots/retro";
const TAG = opt("tag") ?? "new";
const AT = opt("at") ? Number(opt("at")) : null;
/** Where each game's frame is taken (a share of the run) and by which bot level, so the frame shows the game in full play. */
const FRAME_AT: Record<string, number> = { breaker: 0.12, blockfall: 0.5, hover: 0.4 };
const LEVEL: Record<string, string> = { hover: "elite" };
const ALL = ["hover", "breaker", "rally", "wavefront", "burst", "beat", "snake", "cross", "pinball", "blockfall"] as const;
const games = args.filter((a) => !a.startsWith("--"));
const list = (games.length ? games : ALL) as readonly string[];

const { GAME_BY_TYPE } = await import("../arcade-skill-bands/games");
const { Human } = await import("../arcade-skill-bands/human");
const { generatePuzzle } = await import("../../src/lib/duel/generate.server");

/** Each game's dealt-stamp field and the draw for any of its states. */
async function artFor(type: string, rev: number): Promise<(ctx: CanvasRenderingContext2D, state: unknown, size: { width: number; height: number }) => void> {
  const r = async (path: string) => (await import(path)) as Record<string, any>;
  switch (type) {
    case "hover": return (await r("../../src/lib/arcade/hover.renderer")).hoverArtGame.draw;
    case "breaker": return (await r("../../src/lib/arcade/breaker.renderer")).breakerArtGameFor(rev).draw;
    case "rally": return (await r("../../src/lib/arcade/rally.renderer")).rallyArtGame.draw;
    case "wavefront": return (await r("../../src/lib/arcade/wavefront.renderer")).wavefrontArtGameFor(rev).draw;
    case "burst": return (await r("../../src/lib/arcade/burst.renderer")).burstArtGameFor(rev).draw;
    case "beat": return (await r("../../src/lib/arcade/beat.renderer")).beatArtGame.draw;
    case "snake": return (await r("../../src/lib/arcade/snake.renderer")).snakeArtGame.draw;
    case "cross": return (await r("../../src/lib/arcade/cross.renderer")).crossArtGameFor(rev).draw;
    case "pinball": return (await r("../../src/lib/arcade/pinball4.renderer")).pinballArtGameForAny(rev).draw;
    case "blockfall": return (await r("../../src/lib/arcade/blockfall.renderer")).blockfallArtGame(undefined, rev).draw;
  }
  throw new Error(`no art for ${type}`);
}

const FIELDS: Record<string, string> = { hover: "hoverRev", breaker: "brkRev", rally: "rallyRev", wavefront: "wavRev", burst: "burstRev", beat: "beatRev", snake: "snakeRev", cross: "crossRev", pinball: "pinRev", blockfall: "blockfallRev" };

mkdirSync(OUT, { recursive: true });
for (const type of list) {
  const spec = GAME_BY_TYPE.get(type as never)!;
  const puzzle = generatePuzzle(type as never) as unknown as Record<string, number>;
  const rev = puzzle[FIELDS[type]!]!;
  const seed = spec.seedFor(0);
  const game = spec.gameFor(rev, seed);
  const { bot } = (await import(`../arcade-skill-bands/bots/${type}`)) as { bot: (ctx: unknown) => { events?: { t: number }[]; taps?: number[] } };
  const out = bot({ game, seed, rev, human: new Human(type as never, seed, (LEVEL[type] ?? "near") as never), fixes: true });
  const by = new Map((out.events ?? []).map((e) => [e.t, e]));
  let s = game.init(seed);
  const stop = Math.round(game.runTicks * (AT ?? FRAME_AT[type] ?? 0.5));
  // Hover's bot plays taps (a tap set by tick, as the skill-band tool steps it); every other bot an event log.
  const taps = new Set(out.taps ?? []);
  while (!game.isOver(s) && s.tick < stop) s = game.step(s, (spec.taps ? taps.has(s.tick + 1) : (by.get(s.tick + 1) ?? null)) as never);
  const draw = await artFor(type, rev);
  const W = 390;
  const DPR = 2;
  // Each renderer fits its own world into the canvas it is given; a 390 × 760 box suits every Retro world.
  const H = 760;
  const canvas = createCanvas(W * DPR, H * DPR);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W * DPR, H * DPR);
  ctx.scale(DPR, DPR);
  draw(ctx, s, { width: W, height: H });
  const file = join(OUT, `${type}-${TAG}.webp`);
  writeFileSync(file, canvas.toBuffer("image/webp", 82));
  console.log(`${type} rev ${rev}: tick ${(s as { tick: number }).tick} → ${file}`);
}
