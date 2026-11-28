/**
 * The runs and draws hud-bands-check measures (P4 desktop size PR 1, 28 Nov 2026): for each game with a HUD band
 * (src/lib/gameFrame/hudBands.ts), its recorded runs on the stamps it is dealt on, replayed through its own sim, and
 * skill-band bot runs on fresh deals at every level; each run's states drawn by the game's own renderer with the HUD in
 * the side panel (as the arena draws it), at the size the arena draws its world on a sideways tablet (1180x820) and a
 * computer (1440x900), with every draw's box recorded (draw-bounds-lib.ts).
 *
 * Import retro-render-lib before any renderer (its browser globals): this file does.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

import { createCanvas, retroArtFor, retroWorldSize, type RetroType } from "./retro-render-lib";
import { recordDrawBoxes, type DrawBox } from "./draw-bounds-lib";

type Any = any;
export type Draw = (ctx: CanvasRenderingContext2D, state: unknown, size: { width: number; height: number }) => void;

/**
 * The arena's world box: as wide as the world fits in the column (at most 640 px), as tall as the screen gives once
 * the band is cut (ArcadeArenaSlot's crop: game-fx.css `--crop-k`). The heights are the arena's measured space under
 * the screen tools (28 Nov 2026, the same on every game): 803 px on the tablet, 884 px on the computer.
 */
export const LAYOUTS = [
  { name: "sideways tablet 1180x820", width: 640, height: 803, ratio: 2 },
  { name: "computer 1440x900", width: 640, height: 884, ratio: 1 },
] as const;

/** Stages that run their own frame loop: drawn at the canvas's CSS size (their renderer fits the world); the rest are
 * drawn at the world's size under ArcadeCanvasStage's scale. Tilt's stage draws at its canvas size too. */
const OWN_LOOP = new Set(["breaker", "beat", "rally", "snake", "pinball", "cross", "bubble", "matchup", "tilt"]);

const RETRO = new Set<string>(["breaker", "rally", "beat", "snake", "cross", "pinball", "blockfall"]);

export interface Art {
  draw: Draw;
  world: (state: unknown) => { width: number; height: number } | Promise<{ width: number; height: number }>;
}

/** The game's own live draw and world size for a dealt puzzle (as its stage builds them). */
export async function artFor(type: string, puzzle: Any): Promise<Art> {
  const level = puzzle.level ?? null;
  const m = async (p: string) => (await import(`../src/lib/arcade/${p}`)) as Any;
  if (RETRO.has(type)) {
    const field = (await import("./retro-render-lib")).RETRO_FIELDS[type as RetroType];
    const draw = await retroArtFor(type as RetroType, puzzle[field]);
    return { draw, world: (state) => retroWorldSize(type as RetroType, state) };
  }
  switch (type) {
    case "bubble": {
      const b = await m("bubble");
      const r = await m("bubble.renderer");
      return { draw: r.drawBubbleArt, world: () => ({ width: b.BUB_WORLD_W, height: b.bubbleWorldHFor(puzzle.bubbleRev) }) };
    }
    case "matchup": {
      const g = await m("matchup");
      const r = await m("matchup.renderer");
      return { draw: r.drawMatchupArt, world: () => ({ width: g.MATCHUP_WORLD_W, height: g.matchupWorldHFor(puzzle.matchupRev) }) };
    }
    case "tilt": {
      const g = await m("tilt");
      const r = await m("tiltArt.renderer");
      return { draw: r.tiltArtGameFor(puzzle.tiltRev, level).draw, world: () => ({ width: g.TILT_WORLD_W, height: g.tiltWorldHFor(puzzle.tiltRev) }) };
    }
    case "flip": {
      const g = await m("flip");
      const r = await m("flipArt.renderer");
      return { draw: r.flipArtGameFor(puzzle.flipRev, level).draw, world: () => ({ width: g.FLIP_WORLD_W, height: g.flipWorldHFor(puzzle.flipRev) }) };
    }
    case "swing": {
      const g = await m("swing");
      const r = await m("swing.renderer");
      return { draw: r.swingArtGameFor(puzzle.swingRev, level).draw, world: () => ({ width: g.swingWorldWFor(puzzle.swingRev), height: g.swingWorldHFor(puzzle.swingRev) }) };
    }
    case "minesweeper": {
      const g = await m("minesweeper");
      const r = await m("minesweeper.renderer");
      const geo = g.minesGeoFor(puzzle.minesRev);
      return { draw: r.minesweeperArtGameFor(puzzle.minesRev).draw, world: () => ({ width: geo.worldW, height: geo.worldH }) };
    }
    case "mahjong": {
      const g = await m("mahjong");
      const r = await m("mahjong.renderer");
      return { draw: r.mahjongArtGameFor(puzzle.mahjongRev, undefined, level).draw, world: () => ({ width: g.MAHJONG_WORLD_W, height: g.MAHJONG_WORLD_H }) };
    }
    case "freecell": {
      const r = await m("cards/freecell.renderer");
      return { draw: r.freecellArtGame(undefined, puzzle.freecellRev, level).draw, world: () => ({ width: r.FC_WORLD_W, height: r.FC_WORLD_H }) };
    }
    case "tripeaks": {
      const r = await m("cards/tripeaks.renderer");
      return { draw: r.tripeaksArtGame(undefined, puzzle.tripeaksRev, level).draw, world: () => ({ width: r.TP_WORLD_W, height: r.TP_WORLD_H }) };
    }
    case "fivehands": {
      const r = await m("cards/fiveHands.renderer");
      return { draw: r.fiveHandsArtGame(undefined, puzzle.fiveHandsRev, level).draw, world: () => ({ width: r.FH_WORLD_W, height: r.FH_WORLD_H }) };
    }
    case "pyramid": {
      const r = await m("cards/pyramid.renderer");
      return { draw: r.pyramidArtGame(undefined, puzzle.pyramidRev, level).draw, world: () => ({ width: r.PY_WORLD_W, height: r.PY_WORLD_H }) };
    }
  }
  throw new Error(`${type}: no renderer listed in hud-bands-lib.ts`);
}

export interface Run {
  /** Where the run came from (a fixture's name, or the bot, its skill and the deal's level). */
  source: string;
  puzzle: Any;
  states: unknown[];
}

const parseJson = (path: string): Any => JSON.parse(path.endsWith(".gz") ? gunzipSync(readFileSync(path)).toString("utf8") : readFileSync(path, "utf8"));

/** Every recorded run of `type` in the fixtures, on one of `revs` of its stamp `field`: [puzzle, wire run, source]. */
export function recordedRuns(type: string, field: string, revs: readonly number[]): { puzzle: Any; run: string; source: string }[] {
  const out: { puzzle: Any; run: string; source: string }[] = [];
  const take = (puzzle: Any, run: unknown, source: string) => {
    if (puzzle?.type === type && revs.includes(puzzle[field]) && typeof run === "string") out.push({ puzzle, run, source });
  };
  const replay = parseJson("scripts/fixtures/replay-runs.json");
  for (const r of replay.runs) take(r.puzzle, r.answer, `replay-runs.json "${r.label}"`);
  for (const d of parseJson("scripts/retro-demos.json").demos) take(d.puzzle, d.run, "retro-demos.json");
  for (const f of ["scripts/fixtures/strategy-demos.json", "scripts/fixtures/cards-demos.json"])
    for (const d of parseJson(f)) take(d.puzzle, d.run, f.split("/").at(-1)!);
  for (const d of Object.values(parseJson("scripts/fixtures/action-demos.json").demos) as Any[]) take(d.puzzle, d.run, "action-demos.json");
  const logic = parseJson("scripts/fixtures/logic-demos.json");
  for (const d of logic.rows ?? []) take(d.puzzle, d.input_log?.run, "logic-demos.json");
  return out;
}

/** A recorded run replayed through the game's own sim: its states every `every` ticks, and the score it reaches. */
export async function replayStates(type: string, puzzle: Any, wire: string, every: number): Promise<{ states: unknown[]; score: number; stored: number }> {
  const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
  const { checkInputEvents, decodeInputEvents } = await import("../src/lib/arcade/engine");
  const spec = GAME_BY_TYPE.get(type as never)!;
  const [seedText, scoreText, events] = wire.split("|");
  const seed = Number(seedText);
  const field = Object.keys(puzzle).find((k) => /Rev$/.test(k) && k !== "puzzleScoreRev");
  const game = spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(field ? puzzle[field] : null, seed);
  // As the server's replay does: the log checked against the game's input ranges, one event a tick (the last).
  const log = new Map<number, unknown>();
  const decoded = decodeInputEvents(events ?? "");
  for (const e of game.inputRanges ? checkInputEvents(decoded, game.runTicks, game.inputRanges).events : decoded) log.set(e.t, e);
  let s = game.init(seed) as { tick: number };
  const states: unknown[] = [s];
  while (!game.isOver(s as never) && s.tick < game.runTicks) {
    s = game.step(s as never, (log.get(s.tick + 1) ?? null) as never) as { tick: number };
    if (s.tick % every === 0) states.push(s);
  }
  states.push(s);
  return { states, score: game.score(s as never), stored: Number(scoreText) };
}

/** The values of `field` the game is dealt on at each level today (Normal first). */
export async function dealtStamps(type: string, field: string): Promise<Record<string, number>> {
  const { generatePuzzle } = await import("../src/lib/duel/generate.server");
  const { withSeededRandom } = await import("../src/lib/duel/random");
  const out: Record<string, number> = {};
  for (const level of LEVELS) {
    const puzzle = withSeededRandom(11, () => generatePuzzle(type as never, (level === "normal" ? {} : { level }) as never)) as Any;
    out[level] = puzzle[field];
  }
  return out;
}

/** The levels a game is offered at (a game with none deals Normal for each). */
export const LEVELS = ["normal", "easy", "hard", "expert"] as const;

/** A skill-band bot's run on a fresh deal at `level`: its states every `every` ticks. */
export async function botStates(type: string, field: string, level: string, skill: string, n: number, every: number): Promise<Run> {
  const { GAME_BY_TYPE, roomSeed } = await import("./arcade-skill-bands/games");
  const { Human } = await import("./arcade-skill-bands/human");
  const { generatePuzzle } = await import("../src/lib/duel/generate.server");
  const { withSeededRandom } = await import("../src/lib/duel/random");
  const spec = GAME_BY_TYPE.get(type as never)!;
  const dealSeed = roomSeed(n);
  const puzzle = withSeededRandom(dealSeed, () => generatePuzzle(type as never, { bankSeed: dealSeed, ...(level !== "normal" ? { level } : {}) } as never)) as Any;
  const seed = Number(puzzle.seed ?? 0);
  const rev = typeof puzzle[field] === "number" ? puzzle[field] : null;
  const game = spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(rev, seed);
  const { bot } = (await import(`./arcade-skill-bands/bots/${type}`)) as { bot: (ctx: unknown) => { events?: { t: number }[]; taps?: number[] } };
  const out = bot({ game, seed, rev, human: new Human(type as never, seed, skill as never), fixes: true });
  const by = new Map((out.events ?? []).map((e) => [e.t, e]));
  let s = game.init(seed) as { tick: number };
  const states: unknown[] = [s];
  while (!game.isOver(s as never) && s.tick < game.runTicks) {
    s = game.step(s as never, (by.get(s.tick + 1) ?? null) as never) as { tick: number };
    if (s.tick % every === 0) states.push(s);
  }
  states.push(s);
  return { source: `${skill} bot, ${level} deal ${n}`, puzzle, states };
}

/**
 * The presentation clock every renderer reads (performance.now, which retro-render-lib fixes): set for each draw to the
 * drawn state's own time, so effects start, move and fade as they do on screen at that moment of the run.
 */
const CLOCK = { ms: 0 };
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => CLOCK.ms } });

/** The clock for a state of the n-th run measured: its tick's time, runs a day apart (no effect outlives one). */
export const clockFor = (runIndex: number, tick: number): number => runIndex * 86_400_000 + (tick * 1000) / 60;

export interface Reach {
  /** The highest any counted draw reaches (world units from the top), and the draw. */
  top: number;
  topBy: DrawBox | null;
  /** The lowest any counted draw reaches (world units from the top), and the draw. */
  bottom: number;
  bottomBy: DrawBox | null;
  /** Draws across the whole width (not counted) that reached into a band. */
  wide: number;
}

/**
 * Draws one state at a layout with the HUD in the side panel and returns how far up and down the game's draws reach,
 * in world units. A draw spanning 95 % or more of the world's width is the backdrop or the world's frame and is not
 * counted (it is listed in `wide`).
 */
export async function measureState(
  type: string,
  art: Art,
  state: unknown,
  layout: (typeof LAYOUTS)[number],
  band: { top: number; bottom?: number },
  /** The run's own canvases (its effects' memory lives on its canvas, so each run starts with none). */
  canvases: Map<string, ReturnType<typeof createCanvas>>,
  /** The presentation clock for this draw: a run's states are drawn in order on their own ticks' time. */
  clockMs: number,
): Promise<Reach> {
  const { withHudInWorld, takeHud } = await import("../src/lib/arcade/hudPlacement");
  const world = await art.world(state);
  const cut = band.top + (band.bottom ?? 0);
  const k = Math.min(layout.width / world.width, layout.height / (world.height - cut));
  const cssW = Math.round(world.width * k);
  const cssH = Math.round(world.height * k);
  const W = Math.round(cssW * layout.ratio);
  const H = Math.round(cssH * layout.ratio);
  // One canvas per run and size, cleared for each frame (native canvases are freed late, so not one a frame).
  const key = `${W}x${H}`;
  let canvas = canvases.get(key);
  if (!canvas) canvases.set(key, (canvas = createCanvas(W, H)));
  canvas.width = W;
  const ctx = canvas.getContext("2d") as Any;
  CLOCK.ms = clockMs;
  const unit = layout.ratio * k;
  const reach: Reach = { top: Infinity, topBy: null, bottom: -Infinity, bottomBy: null, wide: 0 };
  const stop = recordDrawBoxes(ctx, W, H, (box) => {
    const y0 = box.y0 / unit;
    const y1 = box.y1 / unit;
    const inBand = y0 < band.top || (band.bottom !== undefined && y1 > world.height - band.bottom);
    if (box.x1 - box.x0 >= 0.95 * W) {
      if (inBand) reach.wide++;
      return;
    }
    if (process.env.HUD_DEBUG && inBand && y0 < Number(process.env.HUD_DEBUG)) console.log("DEBUG", box.op, y0.toFixed(1), y1.toFixed(1), (box.x0 / unit).toFixed(0), (box.x1 / unit).toFixed(0), (new Error().stack ?? "").split("\n").slice(4, 8).map((l) => l.trim().replace(/.*\/src\/lib\/arcade\//, "").replace(/\)$/, "")).join(" < "));
    if (y0 < reach.top) {
      reach.top = y0;
      reach.topBy = box;
    }
    if (y1 > reach.bottom) {
      reach.bottom = y1;
      reach.bottomBy = box;
    }
  });
  const { withArcadeFxInset } = await import("../src/lib/arcade/arcadeFx.renderer");
  try {
    // As the arena draws it: the HUD in the panel, the success layer's frame effects on the visible edge.
    withHudInWorld(false, () => withArcadeFxInset(band.top, band.bottom ?? 0, () => {
      ctx.setTransform(layout.ratio, 0, 0, layout.ratio, 0, 0);
      ctx.save();
      if (OWN_LOOP.has(type)) art.draw(ctx, state, { width: cssW, height: cssH });
      else {
        ctx.scale(cssW / world.width, cssH / world.height);
        art.draw(ctx, state, world);
      }
      ctx.restore();
    }));
  } finally {
    stop();
    takeHud();
  }
  return reach;
}
