/**
 * Flightpath: the dart is drawn exactly where it scored (phone-test notes, 27 Oct 2026; display only).
 *
 * A dart is scored against its own board where that board is when it lands (`hit.x − hit.tdx` on that dart's
 * board centre and size). The renderer used to replace that board with the next dart's (another distance, height
 * and size on bullRev 8) the moment the dart landed, and to leave the dart at its old screen point while a drifting
 * board moved on, so the drawn dart sat in a ring it hadn't scored. bullseyeView now holds the landed dart's own
 * board and draws the dart riding its drift.
 *
 * For every revision (unstamped to bullRev 8) on 24 seeds, every dart is thrown at a seeded point on or near its
 * board (all five bullRev 8 distances, drifting and shuffled boards, every wind):
 *  1. Geometry, every tick of the hold after landing (42 ticks of drift): the board bullseyeView
 *     shows is the dart's own, and the drawn tip falls in the scored ring (and the inner bull and dead-centre ring
 *     exactly when the hit was scored in them), measured on the drawn board's centre and size.
 *  2. Pixels: the real drawBullseye frame (@napi-rs/canvas, 414 × 760 and 375 × 600 in turn) 600 ms after landing (score pop
 *     gone, board held): the pixel just above the drawn tip matches the scored dart's own board painted alone at its
 *     drawn place (within 24 per channel), wherever that point sits at least 3 px inside the scored ring.
 *  3. The hold ends: 800 ms after landing the next dart's board is shown and no old dart is drawn; the last dart's
 *     board stays for good.
 *
 *   bun scripts/flightpath-hit-check.ts
 */
import { createCanvas, Path2D as NapiPath2D } from "@napi-rs/canvas";

let clock = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    devicePixelRatio: 1,
    getComputedStyle: (el: { style?: Record<string, string> }) => el.style ?? {},
  },
});
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined")
  Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });

const B = await import("../src/lib/arcade/bullseye");
const R = await import("../src/lib/arcade/bullseye.renderer");
const { fairTransform } = await import("../src/lib/arcade/fairground.renderer");
const { rngBelow } = await import("../src/lib/arcade/engine");
type State = import("../src/lib/arcade/bullseye").BullseyeState;

const REVS: (number | undefined)[] = [undefined, B.BULLSEYE_REV, B.BULLSEYE_REV_BAND, B.BULLSEYE_REV_TUNED, B.BULLSEYE_REV_TARGET, B.BULLSEYE_REV_STRICT, B.BULLSEYE_REV_EXPAND];
const SEEDS = Number(process.env.FP_SEEDS ?? 24);
let throwCount = 0;
const SIZES = [{ width: 414, height: 760 }, { width: 375, height: 600 }];

let failures = 0;
let geometryFrames = 0;
let pixelSamples = 0;
let holdChecks = 0;
const fail = (message: string) => {
  failures += 1;
  if (failures <= 25) console.log(`FAIL ${message}`);
};

/** Which ring a point is in on a dart's drawn board, plus the inner bull and dead centre (the sim's own tests). */
function drawnRing(state: State, arrow: number, dx: number, x: number, y: number) {
  const board = B.bullseyeBoard(state, arrow);
  const values = B.bullseyeRingValues(state, arrow);
  const lx = x - dx;
  return {
    ring: B.bullseyeRingAt(lx, y, board.scalePct, board.cy),
    bull: B.bullseyeInInnerBull(lx, y, board.scalePct, values, board.cy),
    dead: B.bullseyeInDeadCentre(lx, y, board.scalePct, values, board.cy),
  };
}

/** Distance from (x, y) to the nearest ring edge of the drawn board, world px. */
function edgeGap(state: State, arrow: number, dx: number, x: number, y: number): number {
  const board = B.bullseyeBoard(state, arrow);
  const d = Math.hypot(x - dx - B.BULLSEYE_CX, y - board.cy);
  let gap = Infinity;
  for (let ring = 1; ring <= B.BULLSEYE_RINGS; ring++) gap = Math.min(gap, Math.abs(d - (B.BULLSEYE_RING_STEP * ring * board.scalePct) / 100));
  return gap;
}

/** A throw aimed at a seeded point within 1.2 board radii of the dart's board centre (before sway and wind). */
function throwAt(state: State, rng: number): { input: { t: number; k: number; a: number; b: number; c: number; d: number }; rng: number } {
  const arrow = state.arrowIndex;
  const board = B.bullseyeBoard(state, arrow);
  const outer = (B.BULLSEYE_OUTER_R * board.scalePct) / 100;
  const a = rngBelow(rng, 360);
  const r = rngBelow(a.state, 120);
  const angle = (a.value * Math.PI) / 180;
  const dist = (outer * r.value) / 100;
  const tx = B.BULLSEYE_CX + Math.cos(angle) * dist - B.bullseyeWindShiftFor(state, arrow, state.winds[arrow] ?? 0);
  const ty = board.cy + Math.sin(angle) * dist;
  const num = state.expand === B.BULLSEYE_EXPAND ? B.BULLSEYE_V8_FLIGHT_NUM : B.BULLSEYE_FLIGHT_NUM;
  const vx = Math.round(((tx - B.BULLSEYE_BOW_X) * B.BULLSEYE_FLIGHT_DEN) / num);
  const vy = -Math.round(((B.BULLSEYE_BOW_Y - ty) * B.BULLSEYE_FLIGHT_DEN) / num);
  return { input: { t: state.tick + 1, k: B.BULLSEYE_INPUT_SHOT, a: vx, b: Math.min(-1, vy), c: 0, d: 0 }, rng: r.state };
}

function pixelAt(ctx: CanvasRenderingContext2D, x: number, y: number): [number, number, number] {
  const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
  return [d[0]!, d[1]!, d[2]!];
}

for (const rev of REVS) {
  const game = B.bullseyeGameFor(rev);
  for (let seed = 1; seed <= SEEDS; seed++) {
    let state = B.bullseyeInitFor(seed * 7919, undefined, rev);
    let rng = seed * 31 + (rev ?? 0);
    const label = `rev ${rev ?? "unstamped"} seed ${seed}`;
    while (!game.isOver(state)) {
      // Wait a seeded 10–40 ticks before each throw (the board drifts meanwhile).
      const wait = rngBelow(rng, 31);
      rng = wait.state;
      for (let i = 0; i < 10 + wait.value && !game.isOver(state); i++) state = game.step(state, null);
      if (game.isOver(state)) break;
      const shot = throwAt(state, rng);
      rng = shot.rng;
      state = game.step(state, shot.input as never);
      const hit = state.hits[state.hits.length - 1]!;
      // Fly in, recording a flight frame on each canvas so the landing starts its presentation clock.
      // One canvas a throw, the sizes taking turns.
      const pick = SIZES[throwCount++ % SIZES.length]!;
      const canvases = [{ size: pick, canvas: createCanvas(pick.width, pick.height) }];
      const ctxs = canvases.map((c) => c.canvas.getContext("2d") as unknown as CanvasRenderingContext2D);
      clock += 1_000;
      ctxs.forEach((ctx, i) => R.drawBullseye(ctx, state, canvases[i]!.size));
      while (state.flightTick > 0) state = game.step(state, null);
      ctxs.forEach((ctx, i) => R.drawBullseye(ctx, state, canvases[i]!.size));
      const landedAt = clock;
      const where = `${label} dart ${hit.arrow + 1}`;
      // 1. Geometry, every tick until the next throw (the board drifting on).
      let probe = state;
      for (let t = 0; (t * 1000) / 60 < R.BULLSEYE_LAND_HOLD_MS && !game.isOver(probe); t++) {
        const view = R.bullseyeView(probe, (t * 1000) / 60);
        geometryFrames += 1;
        if (view.arrow !== hit.arrow) fail(`${where}: the view shows dart ${view.arrow + 1}'s board ${t} ticks after landing`);
        if (!view.dart) { fail(`${where}: no landed dart drawn ${t} ticks after landing`); break; }
        // Rev 2: a balloon took the dart (scored off the board, no dart drawn).
        if (hit.pop === 1 && probe.tune !== B.BULLSEYE_TUNE) { probe = game.step(probe, null); continue; }
        const drawn = drawnRing(probe, view.arrow, view.dx, view.dart.x, view.dart.y);
        if (drawn.ring !== hit.ring) fail(`${where} +${t} ticks: drawn in ring ${drawn.ring}, scored ring ${hit.ring}`);
        if ((rev === B.BULLSEYE_REV || (rev ?? 0) >= B.BULLSEYE_REV_BAND) && drawn.bull !== (hit.bull === 1)) fail(`${where} +${t}: inner bull drawn ${drawn.bull}, scored ${hit.bull}`);
        if (rev === B.BULLSEYE_REV_EXPAND && drawn.dead !== (hit.dc === 1)) fail(`${where} +${t}: dead centre drawn ${drawn.dead}, scored ${hit.dc ?? 0}`);
        probe = game.step(probe, null);
      }
      // 2. Pixels just above the tip, 600 ms after landing (the board held, the score pop gone): the frame's board
      //    there matches the scored dart's own board painted alone at its drawn place (paintBoard, the sprite's art).
      const value = B.bullseyeRingValue(hit.ring, B.bullseyeRingValues(state, hit.arrow)) - (hit.bal ?? 0);
      if (hit.ring >= 0 && hit.pop !== 1 && value < 10) {
        clock = landedAt + 600;
        canvases.forEach(({ size }, i) => {
          const ctx = ctxs[i]!;
          R.drawBullseye(ctx, state, size);
          const view = R.bullseyeView(state, 600);
          if (!view.dart) return;
          const board = B.bullseyeBoard(state, view.arrow);
          const cx = B.BULLSEYE_CX + view.dx;
          const sx = view.dart.x;
          const sy = view.dart.y - 3;
          const sample = drawnRing(state, view.arrow, view.dx, sx, sy);
          if (sample.ring !== hit.ring || sample.bull || sample.dead || edgeGap(state, view.arrow, view.dx, sx, sy) < 3) return;
          // Not on the live ring labels (straight up from the centre) or under a floating balloon.
          if (Math.abs(sx - cx) < 14 && sy < board.cy) return;
          const balloon = B.bullseyeBalloonPos(state, view.arrow, state.tick);
          if (balloon && Math.hypot(balloon.x - sx, balloon.y - sy) < B.BULLSEYE_BALLOON_R + 8) return;
          // The frame's own map from the range's px to the canvas (3 Nov 2026: bullRev 8+ draws the darts stall's
          // zoomed view, the fairground's fit before), so the reference board is painted exactly where the frame put it.
          const map = R.bullseyeCanvasMap(state, size, 600);
          const ref = createCanvas(size.width, size.height);
          const rc = ref.getContext("2d") as unknown as CanvasRenderingContext2D;
          rc.translate(map.ox, map.oy);
          rc.scale(map.a, map.a);
          R.paintBoard(rc, cx, board.cy, board.scalePct, B.bullseyeRingValues(state, view.arrow));
          const px = map.ox + sx * map.a;
          const py = map.oy + sy * map.a;
          const got = pixelAt(ctx, px, py);
          const want = pixelAt(rc, px, py);
          pixelSamples += 1;
          const diff = Math.max(...got.map((v, k) => Math.abs(v - want[k]!)));
          if (diff > 24) fail(`${where} ${size.width}×${size.height}: the frame under the tip is rgb(${got}), dart ${hit.arrow + 1}'s board (ring ${value}) is rgb(${want}) there`);
        });
      }
      // 3. The hold ends (unless it was the last dart).
      const after = R.bullseyeView(state, R.BULLSEYE_LAND_HOLD_MS + 100);
      holdChecks += 1;
      if (state.arrowIndex < B.BULLSEYE_ARROWS) {
        if (after.arrow !== state.arrowIndex || after.dart) fail(`${where}: after the hold the view is dart ${after.arrow + 1}'s board${after.dart ? " with the old dart" : ""}`);
      } else if (after.arrow !== hit.arrow || !after.dart) fail(`${where}: the last dart's board isn't held`);
    }
  }
}

console.log(`${geometryFrames} geometry frames, ${pixelSamples} pixel samples, ${holdChecks} holds over ${REVS.length} revisions × ${SEEDS} seeds`);
if (pixelSamples < (SEEDS * REVS.length * 3) / 2) fail(`only ${pixelSamples} pixel samples`);
if (failures > 0) {
  console.log(`FAIL flightpath-hit-check: ${failures} failure(s)`);
  process.exit(1);
}
console.log("PASS flightpath-hit-check");
