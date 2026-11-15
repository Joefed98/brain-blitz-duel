/**
 * The Retro overhaul's Node renderer kit (15 Nov 2026): each Retro game's arena drawn by its own renderer in Node
 * (@napi-rs/canvas, as tap-mapping-check does) from a skill-band bot's run at the room-dealt stamp. Used by the gallery's
 * frames (scripts/shots/retro-frames.ts) and retro-overhaul-check's text-floor section, so both see identical runs.
 *
 * Import this before any renderer: it installs the browser globals the renderers read (window, OffscreenCanvas, Path2D,
 * a fixed performance clock).
 */
import { createCanvas, GlobalFonts, Path2D as NapiPath2D } from "@napi-rs/canvas";

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

export { createCanvas };

/**
 * The pixel font for pictures (optional): set RETRO_PIXEL_FONT to a Press Start 2P file (OFL; for example the
 * @fontsource/press-start-2p package's latin woff2) so the frames draw the app's font. The text-floor check measures
 * font sizes, so it needs none.
 */
if (process.env.RETRO_PIXEL_FONT) GlobalFonts.registerFromPath(process.env.RETRO_PIXEL_FONT, "Press Start 2P");

/** The ten Retro games, in the review's order. */
export const RETRO_TYPES = ["hover", "breaker", "rally", "wavefront", "burst", "beat", "snake", "cross", "pinball", "blockfall"] as const;
export type RetroType = (typeof RETRO_TYPES)[number];

/** Each game's dealt-stamp field. */
export const RETRO_FIELDS: Record<RetroType, string> = {
  hover: "hoverRev",
  breaker: "brkRev",
  rally: "rallyRev",
  wavefront: "wavRev",
  burst: "burstRev",
  beat: "beatRev",
  snake: "snakeRev",
  cross: "crossRev",
  pinball: "pinRev",
  blockfall: "blockfallRev",
};

export type RetroDraw = (ctx: CanvasRenderingContext2D, state: unknown, size: { width: number; height: number }) => void;

/** The live draw for a game's revision (its own renderer, as the arcade stage calls it). */
export async function retroArtFor(type: RetroType, rev: number): Promise<RetroDraw> {
  const r = async (path: string) => (await import(path)) as Record<string, any>;
  switch (type) {
    case "hover": return (await r("../src/lib/arcade/hover.renderer")).hoverArtGame.draw;
    case "breaker": return (await r("../src/lib/arcade/breaker.renderer")).breakerArtGameFor(rev).draw;
    case "rally": return (await r("../src/lib/arcade/rally.renderer")).rallyArtGame.draw;
    case "wavefront": return (await r("../src/lib/arcade/wavefront.renderer")).wavefrontArtGameFor(rev).draw;
    case "burst": return (await r("../src/lib/arcade/burst.renderer")).burstArtGameFor(rev).draw;
    case "beat": return (await r("../src/lib/arcade/beat.renderer")).beatArtGame.draw;
    case "snake": return (await r("../src/lib/arcade/snake.renderer")).snakeArtGame.draw;
    case "cross": return (await r("../src/lib/arcade/cross.renderer")).crossArtGameFor(rev).draw;
    case "pinball": return (await r("../src/lib/arcade/pinball4.renderer")).pinballArtGameForAny(rev).draw;
    case "blockfall": return (await r("../src/lib/arcade/blockfall.renderer")).blockfallArtGame(undefined, rev).draw;
  }
}

export interface RetroRun {
  type: RetroType;
  rev: number;
  seed: number;
  /** The run's states, one every `every` ticks (the first and the last included). */
  states: { tick: number }[];
  runTicks: number;
}

/**
 * A skill-band bot's run at the room-dealt stamp on room seed `seedIndex`, its states sampled every `every` ticks up to
 * `until` (a share of the run).
 */
export async function retroRun(type: RetroType, opts: { level?: string; seedIndex?: number; every?: number; until?: number } = {}): Promise<RetroRun> {
  const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
  const { Human } = await import("./arcade-skill-bands/human");
  const { generatePuzzle } = await import("../src/lib/duel/generate.server");
  const spec = GAME_BY_TYPE.get(type as never)!;
  const puzzle = generatePuzzle(type as never) as unknown as Record<string, number>;
  const rev = puzzle[RETRO_FIELDS[type]]!;
  const seed = spec.seedFor(opts.seedIndex ?? 0);
  const game = spec.gameFor(rev, seed);
  const { bot } = (await import(`./arcade-skill-bands/bots/${type}`)) as { bot: (ctx: unknown) => { events?: { t: number }[]; taps?: number[] } };
  const out = bot({ game, seed, rev, human: new Human(type as never, seed, (opts.level ?? "near") as never), fixes: true });
  const by = new Map((out.events ?? []).map((e) => [e.t, e]));
  // Hover's bot plays taps (a tap set by tick, as the skill-band tool steps it); every other bot an event log.
  const taps = new Set(out.taps ?? []);
  const every = opts.every ?? 1_000_000;
  const stop = Math.round(game.runTicks * (opts.until ?? 1));
  let s = game.init(seed) as { tick: number };
  const states = [s];
  while (!game.isOver(s as never) && s.tick < stop) {
    s = game.step(s as never, (spec.taps ? taps.has(s.tick + 1) : (by.get(s.tick + 1) ?? null)) as never) as { tick: number };
    if (s.tick % every === 0) states.push(s);
  }
  if (states.at(-1) !== s) states.push(s);
  return { type, rev, seed, states, runTicks: game.runTicks };
}

/**
 * Every text draw a renderer makes (fillText and strokeText, on any canvas including cached layers), with the font's
 * size in the units the renderer draws in (its world pixels). Call `start()` before drawing and `stop()` after.
 */
export function textRecorder(): { start(): void; stop(): { text: string; px: number }[] } {
  const proto = Object.getPrototypeOf(createCanvas(1, 1).getContext("2d")) as Record<string, (...a: unknown[]) => unknown>;
  const fill = proto.fillText!;
  const stroke = proto.strokeText!;
  let seen: { text: string; px: number }[] = [];
  const size = (font: string) => Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? NaN);
  return {
    start() {
      seen = [];
      proto.fillText = function (this: { font: string }, ...a: unknown[]) {
        seen.push({ text: String(a[0]), px: size(this.font) });
        return fill.apply(this, a);
      };
      proto.strokeText = function (this: { font: string }, ...a: unknown[]) {
        seen.push({ text: String(a[0]), px: size(this.font) });
        return stroke.apply(this, a);
      };
    },
    stop() {
      proto.fillText = fill;
      proto.strokeText = stroke;
      return seen;
    },
  };
}
