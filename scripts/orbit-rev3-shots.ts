/**
 * Mock screenshots for Orbit rev3: builds a course with buildCourse3, gets
 * the proven tap log from runRev3BotWithTaps, then replays it tick-by-tick
 * through orbitRev3Game.step (never re-deriving taps live), warming the
 * orbitCamera spring every tick, up to ~1500 ticks. Renders with
 * orbitRev3ArtGame.draw (@napi-rs/canvas) at 360x572 (390x620 scaled), plus
 * a full-route overview PNG per seed (planet rings, zig-zag path, viewport
 * rectangle at the captured tick).
 */
import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  buildCourse3,
  initRev3From,
  runRev3BotWithTaps,
  orbitRev3Game,
  ORBIT_REV3_WORLD_W,
  type OrbitRev3State,
} from "../src/lib/arcade/orbitRev3";
import { orbitRev3ArtGame } from "../src/lib/arcade/orbit.renderer";
import {
  orbitCamera,
  orbitNextRingShare,
  orbitCameraResetCache,
  ORBIT_CAM_VIEW_W,
  ORBIT_CAM_VIEW_H,
} from "../src/lib/arcade/orbitCamera";
import { ORBIT_INPUT_TAP, ORBIT_TOTAL } from "../src/lib/arcade/orbit";

const OUT_DIR = "/mnt/documents/orbit-rev3";
mkdirSync(OUT_DIR, { recursive: true });

const FP = 256;
const TARGET_TICK = 1500;
const MAX_TICK = Number(process.env.MAX_TICK ?? 1500);
const SHOT_W = 360;
const SHOT_H = 572; // 360/390 * 620

function tapInput(tick: number) {
  return { t: tick, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } as const;
}

/**
 * Drives the real state forward tick by tick using the proven tap log
 * (taps[i] is the tick landed on right after a tap input is applied, per
 * runRev3BotWithTaps / stepRev3's `tick = state.tick + 1` convention), so
 * input.t == the tick being stepped into, matching the bot exactly. Warms
 * orbitCamera every tick so the spring is never cold at render time.
 */
function simulate(seed: number, maxTick: number) {
  const { planets } = buildCourse3(seed);
  const { taps, proof } = runRev3BotWithTaps(planets, ORBIT_REV3_WORLD_W);
  const tapSet = new Set(taps);
  orbitCameraResetCache();
  let state: OrbitRev3State = initRev3From(planets, ORBIT_REV3_WORLD_W);
  const states: OrbitRev3State[] = [state];
  const arrowTicks: number[] = [];
  const recordCamera = (s: OrbitRev3State) => {
    const cam = orbitCamera(s, { reducedMotion: false });
    if (!s.flying && orbitNextRingShare(s, cam) < .5) arrowTicks.push(s.tick);
  };
  recordCamera(state);
  for (let t = 1; t <= maxTick; t++) {
    if (state.ended !== 0) break;
    const input = tapSet.has(t) ? tapInput(t) : null;
    state = orbitRev3Game.step(state, input) as OrbitRev3State;
    states.push(state);
    recordCamera(state);
  }
  return { planets, states, arrowTicks, proof, tapsUsed: taps.filter((t) => t <= maxTick).length };
}

function ctxFor(w: number, h: number) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  return { canvas, ctx };
}

function saveLayoutShot(tick: number, states: OrbitRev3State[], file: string) {
  const state = states.find((s) => s.tick === tick) ?? states[states.length - 1]!;
  const { canvas, ctx } = ctxFor(SHOT_W, SHOT_H);
  orbitRev3ArtGame.draw(ctx, state, { width: SHOT_W, height: SHOT_H });
  writeFileSync(file, canvas.toBuffer("image/png"));
  return state;
}

function saveRouteOverview(seed: number, planets: OrbitRev3State["planets"], state: OrbitRev3State, file: string) {
  const minX = 0, maxX = ORBIT_REV3_WORLD_W;
  const ys = planets.map((p) => p.y / FP);
  const minY = Math.min(...ys) - 80;
  const maxY = Math.max(...ys) + 80;
  const worldH = maxY - minY;
  const pad = 20;
  const scale = Math.min((900 - pad * 2) / maxX, (1400 - pad * 2) / worldH);
  const W = Math.ceil(maxX * scale + pad * 2);
  const H = Math.ceil(worldH * scale + pad * 2);
  const { canvas, ctx } = ctxFor(W, H);
  ctx.fillStyle = "#06060F";
  ctx.fillRect(0, 0, W, H);
  const toX = (x: number) => pad + x * scale;
  const toY = (y: number) => pad + (maxY - y) * scale; // flip so higher tick (lower y) is up

  // Zig-zag path between consecutive planets.
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  planets.forEach((p, i) => {
    const x = toX(p.x / FP), y = toY(p.y / FP);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Planets as circles.
  planets.forEach((p, i) => {
    const x = toX(p.x / FP), y = toY(p.y / FP);
    const r = Math.max(2, (p.r / FP) * scale);
    ctx.fillStyle = i === ORBIT_TOTAL ? "#F5B82E" : i === state.cur ? "#FF4D5E" : "#4D8CFF";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Viewport rectangle at the captured tick.
  const cam = orbitCamera(state, { reducedMotion: false });
  const vx = toX(cam.x);
  const vy = toY(cam.y + ORBIT_CAM_VIEW_H); // top-left in flipped space
  const vw = ORBIT_CAM_VIEW_W * scale;
  const vh = ORBIT_CAM_VIEW_H * scale;
  ctx.strokeStyle = "#F5B82E";
  ctx.lineWidth = 2;
  ctx.strokeRect(vx, vy, vw, vh);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "14px sans-serif";
  ctx.fillText(`seed ${seed} — route overview, tick ${state.tick}, cur ${state.cur}/${ORBIT_TOTAL}`, 10, 18);

  writeFileSync(file, canvas.toBuffer("image/png"));
}

function run(seed: number, label: string, wantArrow: boolean) {
  const { planets, states, arrowTicks, proof, tapsUsed } = simulate(seed, MAX_TICK);
  let tick = TARGET_TICK;
  if (wantArrow) {
    if (arrowTicks.length === 0) {
      console.warn(`seed ${seed}: no arrow tick found within simulated range; using nearest state to tick ${TARGET_TICK}`);
      const nearest = states.reduce((best, s) => (Math.abs(s.tick - TARGET_TICK) < Math.abs(best.tick - TARGET_TICK) ? s : best));
      tick = nearest.tick;
    } else {
      tick = arrowTicks.reduce((best, t) => (Math.abs(t - TARGET_TICK) < Math.abs(best - TARGET_TICK) ? t : best), arrowTicks[0]!);
    }
  } else {
    const nearest = states.reduce((best, s) => (Math.abs(s.tick - TARGET_TICK) < Math.abs(best.tick - TARGET_TICK) ? s : best));
    tick = nearest.tick;
  }
  // Re-warm the camera spring up to exactly the chosen tick so the drawn frame matches it.
  const warm = simulate(seed, tick);
  const state = saveLayoutShot(tick, warm.states, `${OUT_DIR}/layout-${label}.png`);
  saveRouteOverview(seed, planets, state, `${OUT_DIR}/route-${label}.png`);
  const nextRingShare = orbitNextRingShare(state, orbitCamera(state, { reducedMotion: false }));
  console.log(
    `seed ${seed} (${label}): proof.ok=${proof.ok} taps used by tick ${MAX_TICK}=${tapsUsed} -> rendered tick ${state.tick}, cur ${state.cur}/${ORBIT_TOTAL}, next ring=${nextRingShare}, edge-framing samples=${arrowTicks.length}`,
  );
}

run(1001, "a", false);
for (const s of (process.env.ARROW_SEEDS ?? "2002").split(",").map(Number)) run(s, `b-${s}`, true);
