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
  orbitCameraArrow,
  orbitCameraResetCache,
  ORBIT_CAM_VIEW_W,
  ORBIT_CAM_VIEW_H,
} from "../src/lib/arcade/orbitCamera";
import { ORBIT_INPUT_TAP } from "../src/lib/arcade/orbit";

const OUT_DIR = "/mnt/documents/orbit-rev3";
mkdirSync(OUT_DIR, { recursive: true });

const FP = 256;
const SHOT_W = 360;
const SHOT_H = 572;

function tapInput(tick: number) {
  return { t: tick, k: ORBIT_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 } as const;
}

function scan() {
  let totalTicksScanned = 0;
  let ticksWithArrow = 0;

  for (let seed = 1; seed <= 40; seed++) {
    process.stdout.write(`Scanning seed ${seed}... `);
    const { planets } = buildCourse3(seed);
    const { taps } = runRev3BotWithTaps(planets, ORBIT_REV3_WORLD_W);
    const tapSet = new Set(taps);
    orbitCameraResetCache();
    let state: OrbitRev3State = initRev3From(planets, ORBIT_REV3_WORLD_W);
    
    let seedTicks = 0;
    while (state.ended === 0) {
      const cam = orbitCamera(state, { reducedMotion: false });
      const arrow = orbitCameraArrow(state, cam);
      
      totalTicksScanned++;
      seedTicks++;
      if (arrow) {
        ticksWithArrow++;
        process.stdout.write(`Found arrow at tick ${state.tick}!\n`);
        render(seed, state, planets, "b");
        return;
      }
      
      const t = state.tick + 1;
      const input = tapSet.has(t) ? tapInput(t) : null;
      state = orbitRev3Game.step(state, input) as OrbitRev3State;
      
      if (state.tick > 20000) break;
    }
    process.stdout.write(`Done (${seedTicks} ticks)\n`);
  }
  
  const fraction = totalTicksScanned > 0 ? ticksWithArrow / totalTicksScanned : 0;
  console.log(`No arrow found in seeds 1..40. Scanned ${totalTicksScanned} ticks. Fraction with arrow: ${ticksWithArrow}/${totalTicksScanned} (${fraction})`);
}

function render(seed: number, state: OrbitRev3State, planets: OrbitRev3State["planets"], label: string) {
  const { canvas, ctx } = ctxFor(SHOT_W, SHOT_H);
  orbitRev3ArtGame.draw(ctx, state, { width: SHOT_W, height: SHOT_H });
  writeFileSync(`${OUT_DIR}/layout-${label}.png`, canvas.toBuffer("image/png"));
  
  saveRouteOverview(seed, planets, state, `${OUT_DIR}/route-${label}.png`);
}

function ctxFor(w: number, h: number) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  return { canvas, ctx };
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
  const toY = (y: number) => pad + (maxY - y) * scale;

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  planets.forEach((p, i) => {
    const x = toX(p.x / FP), y = toY(p.y / FP);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  planets.forEach((p, i) => {
    const x = toX(p.x / FP), y = toY(p.y / FP);
    const r = Math.max(2, (p.r / FP) * scale);
    ctx.fillStyle = i === planets.length - 1 ? "#F5B82E" : i === state.cur ? "#FF4D5E" : "#4D8CFF";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  });

  const cam = orbitCamera(state, { reducedMotion: false });
  const vx = toX(cam.x);
  const vy = toY(cam.y + ORBIT_CAM_VIEW_H);
  const vw = ORBIT_CAM_VIEW_W * scale;
  const vh = ORBIT_CAM_VIEW_H * scale;
  ctx.strokeStyle = "#F5B82E";
  ctx.lineWidth = 2;
  ctx.strokeRect(vx, vy, vw, vh);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "14px sans-serif";
  ctx.fillText(`seed ${seed} — route overview, tick ${state.tick}, cur ${state.cur}/${planets.length - 1}`, 10, 18);

  writeFileSync(file, canvas.toBuffer("image/png"));
}

scan();
