/**
 * The frames the skins checks draw (wave 2, E1): for each of the seven skinnable games, a fixed set of states from
 * the game's own sim (seeds, idle ticks, both the dealt and the oldest stamp), drawn through the very functions the
 * live stage calls, plus the stage's scene (the fill round the world), through @napi-rs/canvas.
 *
 *   drawFrames(game, look) → [{ name, w, h, data }]
 *
 * `look` is undefined for the call exactly as main's stage made it (no look argument at all), or a GameLook.
 * Used by skins-default-check (default look = main's pixels) and skins-check (every skin and theme draws).
 */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { createHash } from "node:crypto";

(globalThis as unknown as { Path2D: unknown }).Path2D = NapiPath2D;
// The cards' sprite caches use OffscreenCanvas where there is one.
(globalThis as unknown as { OffscreenCanvas: unknown }).OffscreenCanvas = class {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, w), Math.max(1, h));
  }
};

export const SKIN_GAMES = ["pool", "minigolf", "curling", "racing", "freekick", "freecell", "pokersquares"] as const;
export type SkinGame = (typeof SKIN_GAMES)[number];

export interface Frame {
  name: string;
  w: number;
  h: number;
  data: Uint8ClampedArray;
}

type Ctx = CanvasRenderingContext2D;
type Look = { skin: string | null; world: string | null } | undefined;
type Idle = { step: (s: never, i: null) => unknown; init: (seed: number) => unknown };

function run<S>(game: Idle, seed: number, ticks: number): S {
  let s = game.init(seed) as S;
  for (let t = 0; t < ticks; t++) s = game.step(s as never, null) as S;
  return s;
}

function paint(name: string, w: number, h: number, scale: number, draw: (ctx: Ctx) => void): Frame {
  const c = createCanvas(Math.round(w * scale), Math.round(h * scale));
  const ctx = c.getContext("2d") as unknown as Ctx;
  ctx.scale(scale, scale);
  draw(ctx);
  const data = c.getContext("2d").getImageData(0, 0, c.width, c.height).data as unknown as Uint8ClampedArray;
  return { name, w: c.width, h: c.height, data };
}

/** A scene view round a world of w × h: a band above and below and the sides (the play screen's fill). */
function viewFor(w: number, h: number, scale: number) {
  return { worldW: w, worldH: h, left: -40, right: w + 40, top: -60, bottom: h + 120, scale, boxTop: 0 };
}

function scene(name: string, w: number, h: number, scale: number, draw: (ctx: Ctx, view: ReturnType<typeof viewFor>) => void): Frame {
  const view = viewFor(w, h, scale);
  return paint(name, view.right - view.left, view.bottom - view.top, scale, (ctx) => {
    ctx.translate(-view.left, -view.top);
    draw(ctx, view);
  });
}

export async function drawFrames(game: SkinGame, look: Look): Promise<Frame[]> {
  const out: Frame[] = [];
  const has = look !== undefined;
  if (game === "pool") {
    const R = await import("../../src/lib/arcade/pool.renderer");
    const P = await import("../../src/lib/arcade/pool");
    for (const rev of [1, P.POOL_REV]) {
      for (const [seed, ticks] of [[3, 0], [11, 200]] as const) {
        const s = run<Parameters<typeof R.drawPool>[1]>(P.poolGameFor(rev) as unknown as Idle, seed, ticks);
        const aim = { dx: 0.6, dy: -0.8, power: 0.4, spinX: 20, spinY: -30 };
        for (const scale of [1, 2]) {
          out.push(paint(`r${rev}-s${seed}-t${ticks}@${scale}`, P.POOL_W, P.POOL_H, scale, (ctx) => (has ? R.drawPool(ctx, s, aim, false, look) : R.drawPool(ctx, s, aim, false))));
        }
        out.push(paint(`r${rev}-s${seed}-turned`, P.POOL_W, P.POOL_H, 1, (ctx) => (has ? R.drawPool(ctx, s, null, true, look) : R.drawPool(ctx, s, null, true))));
      }
    }
    out.push(scene("scene", P.POOL_W, P.POOL_H, 1, (ctx, v) => (has ? R.poolSceneFor(look)(ctx, v) : R.poolScene(ctx, v))));
  } else if (game === "minigolf") {
    const R = await import("../../src/lib/arcade/minigolf.renderer");
    const M = await import("../../src/lib/arcade/minigolf");
    for (const rev of [M.MINIGOLF_REV_CLASSIC, M.MINIGOLF_REV]) {
      for (const [seed, ticks] of [[5, 0], [9, 300]] as const) {
        const s = run<Parameters<typeof R.drawMinigolfCourse>[1]>(M.minigolfGameFor(undefined, rev) as unknown as Idle, seed, ticks);
        const aim = { dx: -30, dy: -60 } as unknown as Parameters<typeof R.drawMinigolfCourse>[2];
        for (const scale of [1, 2]) {
          out.push(
            paint(`r${rev}-s${seed}-t${ticks}@${scale}`, M.MINIGOLF_W, R.MINIGOLF_VIEW_H, scale, (ctx) =>
              has
                ? R.drawMinigolfPlay(ctx, s, () => R.drawMinigolfCourse(ctx, s, aim, look), R.MINIGOLF_VIEW_H, look)
                : R.drawMinigolfPlay(ctx, s, () => R.drawMinigolfCourse(ctx, s, aim)),
            ),
          );
        }
      }
    }
    out.push(scene("scene", M.MINIGOLF_W, R.MINIGOLF_VIEW_H, 1, (ctx, v) => (has ? R.minigolfSceneFor(look)(ctx, v) : R.minigolfScene(ctx, v))));
  } else if (game === "curling") {
    const R = await import("../../src/lib/arcade/curling.renderer");
    const C = await import("../../src/lib/arcade/curling");
    for (const rev of [1, C.CURLING_REV]) {
      const v = R.curlViewFor(rev);
      for (const [seed, ticks] of [[2, 0], [8, 260]] as const) {
        const s = run<Parameters<typeof R.drawCurling>[1]>(C.curlingGameFor(rev) as unknown as Idle, seed, ticks);
        for (const scale of [1, 2]) {
          out.push(paint(`r${rev}-s${seed}-t${ticks}@${scale}`, C.CURLING_W, v.h, scale, (ctx) => (has ? R.drawCurling(ctx, s, null, look) : R.drawCurling(ctx, s, null))));
        }
      }
      out.push(scene(`scene-r${rev}`, C.CURLING_W, v.h, 1, (ctx, view) => (has ? R.curlingScene(ctx, view, rev, look) : R.curlingScene(ctx, view, rev))));
    }
  } else if (game === "racing") {
    const R = await import("../../src/lib/arcade/racing.renderer");
    const G = await import("../../src/lib/arcade/racing");
    for (const rev of [1, G.RACING_REV_DEALT]) {
      for (const [seed, ticks] of [[4, 0], [6, 900]] as const) {
        const game = G.racingGameFor(rev);
        let s = game.init(seed) as Parameters<typeof R.drawRacingPlay>[1];
        for (let t = 0; t < ticks; t++) s = game.step(s, (t >= 340 ? { t: s.tick + 1, k: 7, a: Math.round(40 * Math.sin(t / 90)), b: 0, c: 0, d: 0 } : null) as never) as typeof s;
        const size = { width: G.RACING_WORLD_W, height: G.RACING_WORLD_H };
        out.push(paint(`r${rev}-s${seed}-t${ticks}`, G.RACING_WORLD_W, G.RACING_WORLD_H, 1, (ctx) => (has ? R.drawRacingPlay(ctx, s, size, look) : R.drawRacingPlay(ctx, s, size))));
      }
    }
    out.push(scene("scene", G.RACING_WORLD_W, G.RACING_WORLD_H, 1, (ctx, v) => (has ? R.racingSceneFor(look)(ctx, v) : R.racingScene(ctx, v))));
  } else if (game === "freekick") {
    const R = await import("../../src/lib/arcade/freekick.renderer");
    const F = await import("../../src/lib/arcade/freekick");
    for (const rev of [1, F.FREEKICK_REV_DEALT]) {
      const art = has ? R.freekickArtGameFor(rev, look) : R.freekickArtGameFor(rev);
      for (const [seed, ticks] of [[1, 0], [7, 240]] as const) {
        const s = run<Parameters<typeof art.draw>[1]>(F.freekickGameFor(rev) as unknown as Idle, seed, ticks);
        const size = { width: F.FREEKICK_WORLD_W, height: F.FREEKICK_WORLD_H };
        out.push(paint(`r${rev}-s${seed}-t${ticks}`, F.FREEKICK_WORLD_W, F.FREEKICK_WORLD_H, 1, (ctx) => art.draw(ctx, s, size)));
      }
      const s0 = run<Parameters<typeof art.draw>[1]>(F.freekickGameFor(rev) as unknown as Idle, 1, 0);
      out.push(scene(`scene-r${rev}`, F.FREEKICK_WORLD_W, F.FREEKICK_WORLD_H, 1, (ctx, v) => R.freekickScene(ctx, v, s0)));
    }
  } else if (game === "freecell") {
    const R = await import("../../src/lib/arcade/cards/freecell.renderer");
    const FC = await import("../../src/lib/arcade/cards/freecell");
    const fill = await import("../../src/lib/arcade/cards/cardsFill.renderer");
    for (const rev of [1, FC.FC_REV]) {
      const art = has ? R.freecellArtGame(undefined, rev, look) : R.freecellArtGame(undefined, rev);
      for (const [seed, ticks] of [[0, 0], [12, 100]] as const) {
        const s = run<Parameters<typeof art.draw>[1]>(art as unknown as Idle, seed, ticks);
        for (const scale of [1, 2]) out.push(paint(`r${rev}-s${seed}-t${ticks}@${scale}`, R.FC_WORLD_W, R.FC_WORLD_H, scale, (ctx) => art.draw(ctx, s, { width: R.FC_WORLD_W, height: R.FC_WORLD_H })));
      }
    }
    out.push(scene("scene", R.FC_WORLD_W, R.FC_WORLD_H, 1, (ctx, v) => (has ? fill.cardsFillFor(look)(ctx, v) : fill.cardsFill(ctx, v))));
  } else if (game === "pokersquares") {
    const R = await import("../../src/lib/arcade/cards/pokerSquares.renderer");
    const fill = await import("../../src/lib/arcade/cards/cardsFill.renderer");
    for (const rev of [1, 2]) {
      const art = has ? R.pokerSquaresArtGame(undefined, rev, look) : R.pokerSquaresArtGame(undefined, rev);
      for (const [seed, ticks] of [[0, 0], [21, 150]] as const) {
        const s = run<Parameters<typeof art.draw>[1]>(art as unknown as Idle, seed, ticks);
        for (const scale of [1, 2]) out.push(paint(`r${rev}-s${seed}-t${ticks}@${scale}`, R.PS_WORLD_W, R.PS_WORLD_H, scale, (ctx) => art.draw(ctx, s, { width: R.PS_WORLD_W, height: R.PS_WORLD_H })));
      }
    }
    out.push(scene("scene", R.PS_WORLD_W, R.PS_WORLD_H, 1, (ctx, v) => (has ? fill.cardsFillFor(look)(ctx, v) : fill.cardsFill(ctx, v))));
  }
  return out;
}

export const digest = (f: Frame): string => createHash("sha256").update(f.data).digest("hex").slice(0, 24);
