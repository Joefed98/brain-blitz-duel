/**
 * The Joulz hero for review (Prompt H, 23 Oct 2026; a design tool, not a check): simple bots play
 * today's dealt revision of Grappler, Jaywalk and Roofbound, and the real renderers draw chosen
 * frames at 414 px wide (the iPhone 11's width), 2×: standing, moving fast and (Grappler) swinging,
 * each with a 4× close-up of the hero. A few frames before each are drawn first, with the clock
 * moving, so the cape's eased angle is the one play would show.
 *
 *   bun scripts/shots/hero-shots.ts [--out=screenshots/hero-oct-2026]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

const OUT =
  process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/hero-oct-2026";
mkdirSync(OUT, { recursive: true });

// The browser globals the renderers read (as arcade-fx-check).
let clock = 10_000;
Object.defineProperty(globalThis, "performance", {
  configurable: true,
  value: { now: () => clock },
});
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    devicePixelRatio: 2,
  },
});
Object.defineProperty(globalThis, "OffscreenCanvas", {
  configurable: true,
  value: class {
    constructor(w: number, h: number) {
      return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
    }
  },
});
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined")
  Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const { generateSwing, generateCross, generateFlip } =
  await import("../../src/lib/duel/arcade.server");
const { swingArtGameFor } = await import("../../src/lib/arcade/swing.renderer");
const { swingWorldH, SWING_WORLD_W, SWING_INPUT_HOLD } = await import("../../src/lib/arcade/swing");
const { ANG_PER_RAD } = await import("../../src/lib/arcade/trig");
const { crossArtGameFor } = await import("../../src/lib/arcade/cross.renderer");
const { CROSS_WORLD_W, CROSS_INPUT_MOVE, CROSS_HOP_TICKS, crossColumnCentreFp, crossLaneCentre } =
  await import("../../src/lib/arcade/cross");
const { px } = await import("../../src/lib/arcade/engine");
const { flipArtGameFor } = await import("../../src/lib/arcade/flipArt.renderer");
const { FLIP_WORLD_W, FLIP_INPUT_TAP } = await import("../../src/lib/arcade/flip");

type Ev = { t: number; k: number; a: number; b: number; c: number; d: number };
const ev = (t: number, k: number, a: number): Ev => ({ t, k, a, b: 0, c: 0, d: 0 });
const W = 414;

interface Shot {
  name: string;
  /** The hero's centre in world px, for the close-up. */
  at: (s: never) => { x: number; y: number };
}

/** Draws the frames leading up to `states[i]` (clock moving), then that state, whole and close up. */
function shoot(
  game: {
    draw: (
      ctx: CanvasRenderingContext2D,
      s: never,
      size: { width: number; height: number },
    ) => void;
  },
  states: unknown[],
  i: number,
  worldW: number,
  worldH: number,
  shot: Shot,
): void {
  const H = Math.round((W * worldH) / worldW);
  const canvas = createCanvas(W * 2, H * 2);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(2, 2);
  for (let k = Math.max(0, i - 20); k <= i; k++) {
    clock += 1000 / 60;
    game.draw(ctx, states[k] as never, { width: W, height: H });
  }
  writeFileSync(join(OUT, `${shot.name}-414w.png`), canvas.toBuffer("image/png"));
  const { x, y } = shot.at(states[i] as never);
  const k = (2 * W) / worldW;
  const box = 60;
  const zoom = createCanvas(box * 8, box * 8);
  const z = zoom.getContext("2d");
  z.imageSmoothingEnabled = true;
  z.drawImage(
    canvas,
    (x - box / 2) * k,
    (y - box / 2) * k,
    box * k,
    box * k,
    0,
    0,
    box * 8,
    box * 8,
  );
  writeFileSync(join(OUT, `${shot.name}-closeup.png`), zoom.toBuffer("image/png"));
  console.log(`${OUT}/${shot.name}-414w.png (+ close-up)`);
}

/* Grappler: grab, ride the swing down and up, let go rising, grab again 20 ticks later. */
{
  const deal = generateSwing();
  const game = swingArtGameFor(deal.swingRev);
  let s = game.init(deal.seed);
  const states: (typeof s)[] = [s];
  let flying = -1;
  // Velocity in px a tick (on a rope, the swing's tangent from the angular rate, as the renderer works it out).
  const vel = (q: typeof s) => {
    if (q.rope < 0) return { vx: q.vx / 256, vy: q.vy / 256 };
    const a = q.anchors[q.rope]!;
    const turn = q.om / (16 * ANG_PER_RAD);
    return { vx: ((q.y - a.y) / 256) * turn, vy: (-(q.x - a.x) / 256) * turn };
  };
  s = game.step(s, ev(1, SWING_INPUT_HOLD, 1) as never);
  states.push(s);
  while (!game.isOver(s) && s.tick < 900) {
    let input: Ev | null = null;
    const v = vel(s);
    if (s.rope >= 0 && v.vx > 0 && v.vy < -0.8 && s.tick - s.grabTick > 30) {
      input = ev(s.tick + 1, SWING_INPUT_HOLD, 0);
      flying = s.tick;
    } else if (s.rope < 0 && flying >= 0 && s.tick - flying >= 20) {
      input = ev(s.tick + 1, SWING_INPUT_HOLD, 1);
      flying = -1;
    }
    s = game.step(s, input as never);
    states.push(s);
  }
  const speed = (q: typeof s) => Math.hypot(vel(q).vx, vel(q).vy);
  const FP = 256;
  const camAt = (q: typeof s) => ({ x: (q.x - q.camX) / FP, y: q.y / FP });
  const worldH = swingWorldH(states[0]!);
  const pick = (ok: (q: typeof s) => boolean) => {
    let best = -1;
    states.forEach((q, i) => {
      if (i > 40 && q.ended === 0 && ok(q) && (best < 0 || speed(q) > speed(states[best]!)))
        best = i;
    });
    return best;
  };
  const start = 1;
  const swinging = pick((q) => q.rope >= 0);
  const flyingFast = pick((q) => q.rope < 0);
  // Grappler is never still: its start (hanging from the first anchor) is the standing frame.
  for (const [name, i] of [
    ["grappler-start", start],
    ["grappler-swinging", swinging],
    ["grappler-flying-fast", flyingFast],
  ] as const) {
    if (i < 0) throw new Error(`Grappler: no ${name} frame`);
    shoot(game as never, states, i, SWING_WORLD_W, worldH, { name, at: camAt as never });
  }
}

/* Jaywalk: wait on the kerb, then hop up; a sideways step faces the hero right. */
{
  const deal = generateCross();
  const game = crossArtGameFor(deal.crossRev);
  let s = game.init(deal.seed);
  const states: (typeof s)[] = [s];
  const moves = new Map<number, number>([
    [150, 3],
    [190, 0],
  ]);
  while (!game.isOver(s) && s.tick < 200) {
    const m = moves.get(s.tick + 1);
    s = game.step(s, m === undefined ? null : (ev(s.tick + 1, CROSS_INPUT_MOVE, m) as never));
    states.push(s);
  }
  const worldH = 580;
  const standing = 170;
  const hopping = 190 + Math.ceil(CROSS_HOP_TICKS / 2);
  // The hero's place, as the renderer works it out (lane centre, eased mid-hop; column centre).
  const find = (i: number) => {
    const q = states[i]!;
    const from = crossLaneCentre(q.lane);
    const to = crossLaneCentre(q.lane + q.hopDir);
    const done = q.hop > 0 ? (CROSS_HOP_TICKS - q.hop) / CROSS_HOP_TICKS : 0;
    return { x: px(crossColumnCentreFp(q.col)), y: q.hop > 0 ? from + (to - from) * done : from };
  };
  for (const [name, i] of [
    ["jaywalk-standing", standing],
    ["jaywalk-hopping", hopping],
  ] as const) {
    const where = find(i);
    shoot(game as never, states, i, CROSS_WORLD_W, worldH, { name, at: () => where });
  }
}

/* Roofbound: run (standing on the floor, tube at full speed later) and one flip mid-arc. */
{
  const deal = generateFlip();
  const game = flipArtGameFor(deal.flipRev);
  let s = game.init(deal.seed);
  const states: (typeof s)[] = [s];
  while (!game.isOver(s) && s.tick < 260) {
    s = game.step(s, s.tick + 1 === 240 ? (ev(s.tick + 1, FLIP_INPUT_TAP, 0) as never) : null);
    states.push(s);
  }
  const worldH = 620;
  const at = (q: typeof s) => {
    // The runner stands at x 90 (RUNNER_X); its height is the centre of the gold drawn in that column.
    const H = Math.round((W * worldH) / FLIP_WORLD_W);
    const c = createCanvas(W, H);
    game.draw(c.getContext("2d") as unknown as CanvasRenderingContext2D, q, {
      width: W,
      height: H,
    });
    const data = c.getContext("2d").getImageData(0, 0, W, H).data;
    const col = Math.round((90 * W) / FLIP_WORLD_W);
    let sy = 0;
    let n = 0;
    for (let y = 0; y < H; y++)
      for (let x = col - 12; x <= col + 12; x++) {
        const o = (y * W + x) * 4;
        if (data[o]! > 230 && data[o + 1]! > 170 && data[o + 1]! < 215 && data[o + 2]! < 80) {
          sy += y;
          n++;
        }
      }
    return { x: 90, y: n ? ((sy / n) * FLIP_WORLD_W) / W : 300 };
  };
  const ended = states.findIndex((q) => q.ended !== 0);
  const last = ended < 0 ? states.length - 1 : ended - 1;
  for (const [name, i] of [
    ["roofbound-running", Math.min(60, last)],
    ["roofbound-flipping", Math.min(243, last)],
  ] as const) {
    const where = at(states[i]!);
    shoot(game as never, states, i, FLIP_WORLD_W, worldH, { name, at: () => where });
  }
}
