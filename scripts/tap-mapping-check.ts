/**
 * Tap mapping: a tap on a drawn target's centre hits it, and a tap 3 px past its drawn
 * edge misses (#48's rule for the canvas tap-target games).
 *
 * For each game the real renderer draws a frame with @napi-rs/canvas at a phone-sized
 * box, and the target's drawn pixels are found from the picture itself (the frame
 * diffed against the same frame without that target, or the target's own colour).
 * Taps then go through the phone's own mapping (src/components/puzzles/tapMapping.ts,
 * GridDrag's gridCellAt) into the real sim on the next tick, exactly as a phone
 * applies them. A tap outside the tapped element never reaches its handler, so it
 * misses by construction.
 *
 *  - Pull! (clayshoot): flying orange and gold clays (their drawn shot zone) and flying
 *    birds (their drawn no-shoot zone), all four sides; hit = that clay is HIT / that
 *    bird is startled on the next tick.
 *  - Mixed Signals (stroop): every lane's drawn gate, left and right (the lane
 *    pick is by x alone), in the starting and the widened lane counts; hit = the
 *    sim moves the word into that lane.
 *  - Tempo (beat): every lane's drawn lane flash, left and right (lane by x
 *    alone); hit = the tap lands in that lane.
 *
 * Reported, not enforced (printed with how often and how far a tap past the edge still hits):
 *  - Bonk (whack), by design: taps snap to the nearer hole across the 8 px gaps and
 *    35 % of a cell past the board's outer edge, so a tap well past a target still hits
 *    its hole. That forgiving whole-cell tap box is the game's intended rule (a rule
 *    change would need its own stamp), so Bonk is measured but never fails the check.
 *
 * Targets are only judged where they stand clear of every other target (8 px past
 * both shot zones) and of the canvas edge, so a miss can't be another target's hit.
 *
 *   bun scripts/tap-mapping-check.ts
 */
import { createCanvas, Path2D as NapiPath2D, type Canvas } from "@napi-rs/canvas";

Object.defineProperty(globalThis, "performance", {
  configurable: true,
  value: { now: () => 10_000 },
});
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

const clay = await import("../src/lib/arcade/clayShoot");
const { drawClayArt } = await import("../src/lib/arcade/clayShootArt.renderer");
const clash = await import("../src/lib/arcade/colourClash");
const { colourClashArtGameFor, clashGateRect } =
  await import("../src/lib/arcade/colourClash.renderer");
const beat = await import("../src/lib/arcade/beat");
const { beatArtGame } = await import("../src/lib/arcade/beat.renderer");
const whack = await import("../src/lib/arcade/whack");
const { whackArtGame } = await import("../src/lib/arcade/whack.renderer");
const { gridCellAt } = await import("../src/components/puzzles/GridDrag");
const { arcadeWorldPoint, beatLaneAt, clashTapPayload, clayTapWorld } =
  await import("../src/components/puzzles/tapMapping");

type Ctx = CanvasRenderingContext2D;
type Point = { x: number; y: number };
type Side = "left" | "right" | "top" | "bottom";
interface Mask {
  w: number;
  h: number;
  on: Uint8Array;
}

const PAST = 3;
const failures: string[] = [];
let probes = 0;

function render(w: number, h: number, paint: (ctx: Ctx) => void): Uint8ClampedArray {
  const canvas: Canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  paint(ctx);
  return ctx.getImageData(0, 0, w, h).data;
}

/** Pixels that differ between two frames by more than `threshold` on any channel. */
function diffMask(
  a: Uint8ClampedArray,
  b: Uint8ClampedArray,
  w: number,
  h: number,
  threshold = 24,
): Mask {
  const on = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const k = i * 4;
    if (
      Math.max(
        Math.abs(a[k]! - b[k]!),
        Math.abs(a[k + 1]! - b[k + 1]!),
        Math.abs(a[k + 2]! - b[k + 2]!),
      ) > threshold
    )
      on[i] = 1;
  }
  return { w, h, on };
}

/** Centroid of the mask, then the drawn extent along the row and column through it. */
function extent(
  mask: Mask,
): { centre: Point; left: number; right: number; top: number; bottom: number } | null {
  let n = 0,
    sx = 0,
    sy = 0;
  for (let y = 0; y < mask.h; y++)
    for (let x = 0; x < mask.w; x++)
      if (mask.on[y * mask.w + x]) {
        n++;
        sx += x + 0.5;
        sy += y + 0.5;
      }
  if (!n) return null;
  const centre = { x: sx / n, y: sy / n };
  const row = Math.floor(centre.y),
    col = Math.floor(centre.x);
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity;
  for (let x = 0; x < mask.w; x++)
    if (mask.on[row * mask.w + x]) {
      left = Math.min(left, x);
      right = Math.max(right, x + 1);
    }
  for (let y = 0; y < mask.h; y++)
    if (mask.on[y * mask.w + col]) {
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
    }
  if (!Number.isFinite(left) || !Number.isFinite(top)) return null;
  return { centre, left, right, top, bottom };
}

/** Reported-only targets: how often each side breaks the rule, and how far past the edge a tap still hit. */
const reported = new Map<
  string,
  { probes: number; sides: Map<Side, { count: number; worst: number }> }
>();

/**
 * Taps at the centre and 3 px past each named side. `hits` gets element-box px, or null
 * outside the element. An enforced target fails the check; a reported one (`report` =
 * its group name) is tallied for the summary instead.
 */
function probe(
  name: string,
  mask: Mask,
  sides: Side[],
  hits: (p: Point) => boolean,
  report?: string,
): void {
  const e = extent(mask);
  if (!e) {
    failures.push(`${name}: nothing drawn`);
    return;
  }
  probes++;
  const group = report ? (reported.get(report) ?? { probes: 0, sides: new Map() }) : null;
  if (group && report) {
    group.probes++;
    reported.set(report, group);
  }
  if (!hits(e.centre))
    failures.push(
      `${name}: tap on the drawn centre (${e.centre.x.toFixed(1)}, ${e.centre.y.toFixed(1)}) misses`,
    );
  const past = (side: Side, d: number): Point =>
    side === "left"
      ? { x: e.left - d, y: e.centre.y }
      : side === "right"
        ? { x: e.right + d, y: e.centre.y }
        : side === "top"
          ? { x: e.centre.x, y: e.top - d }
          : { x: e.centre.x, y: e.bottom + d };
  for (const side of sides) {
    const p = past(side, PAST);
    if (!hits(p)) continue;
    if (!group) {
      failures.push(
        `${name}: tap ${PAST} px past the drawn ${side} edge (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) still hits`,
      );
      continue;
    }
    let d = PAST;
    while (d < 60 && hits(past(side, d + 1))) d++;
    const tally = group.sides.get(side) ?? { count: 0, worst: 0 };
    tally.count++;
    tally.worst = Math.max(tally.worst, d);
    group.sides.set(side, tally);
  }
}

const inside = (p: Point, w: number, h: number) => p.x >= 0 && p.y >= 0 && p.x < w && p.y < h;

/* ------------------------------------------------------------------ Pull! */

function clayShoot(): void {
  type S = ReturnType<typeof clay.clayRev3Game.init>;
  const game = clay.clayGameFor(clay.CLAY_REV);
  const SIZES = [
    [360, 400],
    [390, 433],
  ] as const;
  const zone = (s: S, i: number) =>
    s.schedule.kind[i] === clay.CLAY_KIND_GOLD
      ? clay.CLAY_CONFIG.goldHitRadius
      : clay.CLAY_CONFIG.orangeHitRadius;
  /** Where the next tick judges clay i / bird j (world px). */
  const clayAt = (s: S, i: number): Point => ({
    x: (s.x[i]! + s.schedule.vx[i]!) / 256,
    y: (s.y[i]! + s.vy[i]! + clay.CLAY_CONFIG.gravity) / 256,
  });
  const birdAt = (s: S, j: number): Point => ({
    x: (s.birdX![j]! + s.birds!.vx[j]!) / 256,
    y: (s.birdY![j]! + s.birds!.vy[j]!) / 256,
  });
  let clays = 0,
    golds = 0,
    birds = 0;
  for (const seed of [11, 202, 3003, 40004, 500005, 6000006]) {
    let s = game.init(seed) as S;
    let lastClay = -999,
      lastBird = -999;
    for (let t = 0; t < clay.CLAY_RUN_TICKS && !game.isOver(s); t++) {
      const objects: { kind: "clay" | "bird"; i: number; at: Point; r: number }[] = [];
      for (let i = 0; i < s.status.length; i++)
        if (s.status[i] === clay.CLAY_FLYING)
          objects.push({ kind: "clay", i, at: clayAt(s, i), r: zone(s, i) });
      for (let j = 0; j < (s.birdStatus?.length ?? 0); j++)
        if (s.birdStatus![j] === clay.CLAY_BIRD_FLYING)
          objects.push({ kind: "bird", i: j, at: birdAt(s, j), r: clay.CLAY_BIRD_RX + 2 });
      for (const o of objects) {
        if (o.kind === "clay" ? t - lastClay < 40 : t - lastBird < 40) continue;
        const clear = objects.every(
          (p) => p === o || Math.hypot(p.at.x - o.at.x, p.at.y - o.at.y) > p.r + o.r + 2 * PAST + 8,
        );
        const margin = o.r + PAST + 6;
        if (
          !clear ||
          o.at.x < margin ||
          o.at.x > clay.CLAY_W - margin ||
          o.at.y < margin ||
          o.at.y > clay.CLAY_H - margin
        )
          continue;
        const without = structuredClone(s);
        if (o.kind === "clay") without.status[o.i] = clay.CLAY_WAITING;
        else without.birdStatus![o.i] = clay.CLAY_BIRD_GONE;
        for (const [w, h] of SIZES) {
          const a = render(w, h, (ctx) => drawClayArt(ctx, s, { width: w, height: h }));
          const b = render(w, h, (ctx) => drawClayArt(ctx, without, { width: w, height: h }));
          const box = { left: 0, top: 0, width: w, height: h };
          const label = `Pull! seed ${seed} tick ${s.tick} ${o.kind === "clay" ? (s.schedule.kind[o.i] === clay.CLAY_KIND_GOLD ? "gold clay" : "orange clay") : "bird"} ${o.i} at ${w}x${h}`;
          probe(
            label,
            diffMask(a, b, w, h, 4),
            ["left", "right", "top", "bottom"],
            (p) => {
              if (!inside(p, w, h)) return false;
              const shot = clayTapWorld(box, p.x, p.y);
              if (!shot) return false;
              const next = game.step(s, {
                t: s.tick + 1,
                k: clay.CLAY_INPUT_SHOT,
                a: shot.wx,
                b: shot.wy,
                c: 0,
                d: 0,
              }) as S;
              return o.kind === "clay"
                ? next.status[o.i] === clay.CLAY_HIT
                : next.birdStatus![o.i] === clay.CLAY_BIRD_STARTLED;
            },
          );
        }
        if (o.kind === "clay") {
          lastClay = t;
          if (s.schedule.kind[o.i] === clay.CLAY_KIND_GOLD) golds++;
          else clays++;
        } else {
          lastBird = t;
          birds++;
        }
      }
      s = game.step(s, null) as S;
    }
  }
  if (clays < 20 || golds < 3 || birds < 10)
    failures.push(
      `Pull!: too few clear targets sampled (${clays} orange, ${golds} gold, ${birds} birds)`,
    );
  console.log(
    `Pull!: ${clays} orange clays, ${golds} gold clays, ${birds} birds, each at ${SIZES.map(([w, h]) => `${w}x${h}`).join(" and ")}`,
  );
}

/* ---------------------------------------------------------- Mixed Signals */

function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixedSignals(): void {
  type S = ReturnType<typeof clash.colourClashRev4Game.init>;
  const variant = 4;
  const game = colourClashArtGameFor(variant);
  const W = clash.CLASH_WORLD_W,
    H = clash.CLASH_WORLD_H;
  const SIZES = [
    [390, 560],
    [358, 514],
  ] as const;
  let gates = 0;
  const seen = new Set<number>();
  for (const seed of [7, 77, 777]) {
    let s = game.init(seed) as S;
    for (let t = 0; t < 120 * 60 && !game.isOver(s); t++) {
      const lanes = clash.clashLaneCount(s.tick + 1);
      const item = s.items.at(-1);
      // One frame per lane count, once a word is falling (the sim only steers a falling word).
      if (
        item &&
        item.spawn <= s.tick &&
        !seen.has(lanes * 1000 + seed) &&
        clash.clashLaneCount(s.tick) === lanes
      ) {
        seen.add(lanes * 1000 + seed);
        const colours = clash.clashGatesAt(s, s.tick);
        for (const [w, h] of SIZES) {
          const sx = w / W,
            sy = h / H;
          const px = render(w, h, (ctx) => {
            ctx.scale(sx, sy);
            game.draw(ctx, s, { width: W, height: H });
          });
          for (let lane = 0; lane < lanes; lane++) {
            const rect = clashGateRect(lane, lanes);
            // The gate bar: pixels in the gate band whose colour is nearer this gate's than any
            // neighbouring gate's or the dark sockets' (a neighbour's glow tints the bar's ends).
            const own = hexRgb(clash.CLASH_COLOURS[colours[lane]!]!);
            const others = [
              ...[lane - 1, lane + 1]
                .filter((k) => k >= 0 && k < lanes)
                .map((k) => hexRgb(clash.CLASH_COLOURS[colours[k]!]!)),
              hexRgb("#020205"),
              hexRgb("#07070D"),
            ];
            const dist = (k: number, [r, g, b]: [number, number, number]) =>
              Math.abs(px[k]! - r) + Math.abs(px[k + 1]! - g) + Math.abs(px[k + 2]! - b);
            const on = new Uint8Array(w * h);
            const y0 = Math.floor(rect.y * sy),
              y1 = Math.ceil((rect.y + rect.h) * sy);
            for (let y = y0; y < y1; y++)
              for (let x = 0; x < w; x++) {
                const k = (y * w + x) * 4;
                const mine = dist(k, own);
                if (others.every((c) => mine <= dist(k, c))) on[y * w + x] = 1;
              }
            // Keep only the run under this lane's gate centre.
            const cx = Math.floor((rect.x + rect.w / 2) * sx);
            for (let y = y0; y < y1; y++) {
              let l = cx,
                rr = cx;
              if (!on[y * w + cx]) {
                for (let x = 0; x < w; x++) on[y * w + x] = 0;
                continue;
              }
              while (l > 0 && on[y * w + l - 1]) l--;
              while (rr < w - 1 && on[y * w + rr + 1]) rr++;
              for (let x = 0; x < w; x++) if (x < l || x > rr) on[y * w + x] = 0;
            }
            const box = { left: 0, top: 0, width: w, height: h };
            probe(
              `Mixed Signals seed ${seed} tick ${s.tick} ${lanes} lanes, gate ${lane} at ${w}x${h}`,
              { w, h, on },
              ["left", "right"],
              (p) => {
                if (!inside(p, w, h)) return false;
                const at = arcadeWorldPoint(box, p.x, p.y, W, H, false);
                if (!at) return false;
                const pay = clashTapPayload(at, at);
                const next = game.step(s, {
                  t: s.tick + 1,
                  k: pay.k,
                  a: pay.a,
                  b: pay.b,
                  c: pay.c,
                  d: 0,
                }) as S;
                return next.lane === lane;
              },
            );
            gates++;
          }
        }
      }
      s = game.step(s, null) as S;
    }
  }
  const counts = new Set([...seen].map((k) => Math.floor(k / 1000)));
  if (counts.size < 2)
    failures.push(`Mixed Signals: only lane counts ${[...counts].join(", ")} sampled`);
  console.log(
    `Mixed Signals: ${gates} gates over lane counts ${[...counts].sort().join(" and ")}, each at ${SIZES.map(([w, h]) => `${w}x${h}`).join(" and ")}`,
  );
}

/* ------------------------------------------------------------------ Tempo */

function tempo(): void {
  type S = ReturnType<typeof beat.beatGame.init>;
  const W = beat.BEAT_WORLD_W,
    H = beat.BEAT_WORLD_H;
  const SIZES = [
    [W, H],
    [375, Math.round((375 * H) / W)],
  ] as const;
  let s = beatArtGame.init(5) as S;
  for (let t = 0; t < 300; t++) s = beatArtGame.step(s, null) as S;
  let lanes = 0;
  for (const [w, h] of SIZES) {
    for (let lane = 0; lane < beat.BEAT_LANES; lane++) {
      // The lane flash a judged hit draws (the whole lane, hit line to top), against no flash.
      const lit = { ...s, lastJudge: 1, judgeAge: 0, lastLane: lane } as S;
      const dark = { ...s, lastJudge: 0, judgeAge: 99, lastLane: -1 } as S;
      const a = render(w, h, (ctx) => beatArtGame.draw(ctx, lit, { width: w, height: h }));
      const b = render(w, h, (ctx) => beatArtGame.draw(ctx, dark, { width: w, height: h }));
      const box = { left: 0, top: 0, width: w, height: h };
      probe(
        `Tempo lane ${lane} at ${w}x${h}`,
        diffMask(a, b, w, h, 8),
        ["left", "right"],
        (p) => inside(p, w, h) && beatLaneAt(box, p.x) === lane,
      );
      lanes++;
    }
  }
  console.log(`Tempo: ${lanes} lanes`);
}

/* ------------------------------------------------------------------- Bonk */

function bonk(): void {
  type S = ReturnType<typeof whack.whackGame.init>;
  const size = 358;
  const element = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: size, height: size }),
    offsetWidth: size,
    offsetHeight: size,
    clientWidth: size,
    clientHeight: size,
    style: {
      paddingLeft: "0",
      paddingTop: "0",
      paddingRight: "0",
      paddingBottom: "0",
      borderLeftWidth: "0",
      borderTopWidth: "0",
      columnGap: `${whack.WHACK_GAP_PX}px`,
      rowGap: `${whack.WHACK_GAP_PX}px`,
    },
  } as unknown as HTMLElement;
  const holeAt = (p: Point) =>
    inside(p, size, size)
      ? gridCellAt(element, p.x, p.y, whack.WHACK_COLS, whack.WHACK_COLS)
      : null;
  let s = whackArtGame.init(9) as S;
  const done = new Set<number>();
  for (let t = 0; t < whack.WHACK_RUN_TICKS && done.size < whack.WHACK_HOLES; t++) {
    s = whackArtGame.step(s, null) as S;
    for (let i = 0; i < s.next; i++) {
      const hole = s.schedule.hole[i]!;
      // A fully risen target (it grows over 7 ticks).
      if (done.has(hole) || s.status[i] !== whack.WHACK_STATUS_UP || s.tick - s.schedule.at[i]! < 8)
        continue;
      done.add(hole);
      const without = {
        ...s,
        status: s.status.map((v, k) => (k === i ? whack.WHACK_STATUS_WAITING : v)),
      } as S;
      const a = render(size, size, (ctx) =>
        whackArtGame.draw(ctx, s, { width: size, height: size }),
      );
      const b = render(size, size, (ctx) =>
        whackArtGame.draw(ctx, without, { width: size, height: size }),
      );
      probe(
        `Bonk hole ${hole}`,
        diffMask(a, b, size, size),
        ["left", "right", "top", "bottom"],
        (p) => holeAt(p) === hole,
        "Bonk targets (intended: whole-cell tap box)",
      );
    }
  }
  console.log(`Bonk: ${done.size} holes (reported only: the whole-cell tap box is intended)`);
}

clayShoot();
mixedSignals();
tempo();
bonk();

for (const [group, tally] of reported) {
  const sides = [...tally.sides].map(
    ([side, t]) => `${side} ${t.count}/${tally.probes} (still hits up to ${t.worst} px past)`,
  );
  console.log(
    `reported, not enforced: ${group}: ${sides.length ? sides.join(", ") : "meets the rule"}`,
  );
}
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`  ${f}`);
  if (failures.length > 40) console.log(`  … and ${failures.length - 40} more`);
  console.log(`FAIL tap-mapping-check: ${failures.length} of ${probes} targets break the rule`);
  process.exit(1);
}
console.log(
  `PASS tap-mapping-check: ${probes} drawn targets (${[...reported.values()].reduce((n, g) => n + g.probes, 0)} reported only); every enforced centre tap hits and every tap ${PAST} px past a drawn edge misses`,
);
