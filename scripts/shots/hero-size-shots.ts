/**
 * Captain Joulz's drawn size in Grappler (swingRev 17) and Roofbound (flipRev 12) at 390 × 844 (8 Nov 2026; a design
 * tool, not a check): each game's own renderer drawing states from a skill-band bot run on a room seed, in the play
 * screen's geometry (a 60 px header stand-in, the world at the largest uniform scale in the box above a 16 px strip),
 * at 2× device pixels, plus a 6× crop round the hero with its unchanged hit box outlined (Grappler's 10 px circle,
 * Roofbound's 32 × 36 box, collision along x only). `--root=<checkout>` draws another tree (e.g. main) for a before → after pair.
 *
 *   bun scripts/shots/hero-size-shots.ts [--root=<checkout>] [--tag=after] [--out=screenshots/hero-size-nov-2026]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createCanvas, GlobalFonts, Path2D as NapiPath2D } from "@napi-rs/canvas";
import { bot as swingBot } from "../arcade-skill-bands/bots/swing";
import { bot as flipBot } from "../arcade-skill-bands/bots/flip";
import { Human } from "../arcade-skill-bands/human";
import { roomSeed } from "../arcade-skill-bands/games";

let clock = 10_000;
Object.defineProperty(globalThis, "performance", { configurable: true, value: { now: () => clock } });
if (typeof (globalThis as { Path2D?: unknown }).Path2D === "undefined") Object.defineProperty(globalThis, "Path2D", { configurable: true, value: NapiPath2D });
GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");
GlobalFonts.registerFromPath("public/fonts/archivo-var-latin.woff2", "Archivo");
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const ROOT = resolve(arg("root") ?? ".");
const TAG = arg("tag") ?? "after";
const OUT = arg("out") ?? "screenshots/hero-size-nov-2026";
mkdirSync(OUT, { recursive: true });
const W = 390, H = 844, HEADER = 60, BOX = H - HEADER - 16, DPR = 2, ZOOM = 6;

const S = await import(`${ROOT}/src/lib/arcade/swing.ts`);
const SR = await import(`${ROOT}/src/lib/arcade/swing.renderer.ts`);
const F = await import(`${ROOT}/src/lib/arcade/flip.ts`);
const FR = await import(`${ROOT}/src/lib/arcade/flipArt.renderer.ts`);

type Mark = { x: number; y: number; draw: (c: CanvasRenderingContext2D) => void };
function shoot(name: string, title: string, worldW: number, worldH: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, mark: Mark): void {
  const scale = Math.min(W / worldW, BOX / worldH);
  const aw = worldW * scale, ah = worldH * scale, ax = (W - aw) / 2;
  const canvas = createCanvas(W * DPR, H * DPR);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(DPR, DPR);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(ax, HEADER);
  draw(ctx, aw, ah);
  ctx.restore();
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "700 16px Archivo";
  ctx.fillText(title, 14, 30);
  ctx.fillStyle = "#BDBDCC";
  ctx.font = "500 12px Archivo";
  ctx.fillText(TAG === "before" ? "Before (main)" : "After", 14, 48);
  writeFileSync(`${OUT}/${name}-390x844-${TAG}.png`, canvas.toBuffer("image/png"));
  // The crop: the same frame at 6× round the hero, with the hit box outlined (cyan, 1 px).
  const R = 30;
  const crop = createCanvas(R * 2 * ZOOM, R * 2 * ZOOM);
  const c = crop.getContext("2d") as unknown as CanvasRenderingContext2D;
  c.scale(ZOOM / scale, ZOOM / scale);
  c.translate(-(mark.x - R) * scale, -(mark.y - R) * scale);
  draw(c, aw, ah);
  c.setTransform(ZOOM, 0, 0, ZOOM, 0, 0);
  c.translate(R - mark.x, R - mark.y);
  c.strokeStyle = "#3DF5FF";
  c.lineWidth = 1 / ZOOM;
  mark.draw(c);
  writeFileSync(`${OUT}/${name}-crop-${TAG}.png`, crop.toBuffer("image/png"));
  console.log(`${OUT}/${name}-390x844-${TAG}.png (+ crop)`);
}

{
  const rev = S.SWING_REV_SLIDE;
  const game = S.swingGameFor(rev);
  const art = SR.swingArtGameFor(rev);
  const seed = roomSeed(3);
  const res = swingBot({ game, seed, rev, human: new Human("swing", seed, "elite" as never) });
  const by = new Map((res.events ?? []).map((e: { t: number }) => [e.t, e]));
  let s = game.init(seed);
  const picks: [string, (st: typeof s) => boolean][] = [
    ["grappler-swing", (st) => st.rope >= 0 && st.tick > 900],
    ["grappler-flight", (st) => st.rope < 0 && st.tick > 1500 && st.vy > 0],
    ["grappler-ledge", (st) => st.tick > 1500 && (st.ledgeOn ?? -1) >= 0 && st.vx === 0],
  ];
  let k = 0;
  while (!game.isOver(s) && k < picks.length) {
    s = game.step(s, by.get(s.tick + 1) ?? null);
    clock += 1000 / 60;
    if (picks[k]![1](s)) {
      const st = s;
      const fx = st.x / 256 - st.camX / 256, fy = st.y / 256;
      shoot(picks[k]![0], "Grappler", S.swingWorldW(st), S.swingWorldH(st), (c, w, h) => art.draw(c, st, { width: w, height: h }), {
        x: fx, y: fy, draw: (c) => { c.beginPath(); c.arc(fx, fy, 10, 0, Math.PI * 2); c.stroke(); },
      });
      k++;
    }
  }
}
{
  const rev = F.FLIP_REV_DEAL;
  const game = F.flipGameFor(rev);
  const art = FR.flipArtGameFor(rev);
  const s0 = (await import(`${ROOT}/src/lib/duel/flipDeal.server.ts`)).flipDealSeed(roomSeed(3));
  const res = flipBot({ game, seed: s0, rev, human: new Human("flip", s0, "elite" as never) });
  const by = new Map((res.events ?? []).map((e: { t: number }) => [e.t, e]));
  let s = game.init(s0);
  const picks: [string, (st: typeof s) => boolean][] = [
    ["roofbound-floor", (st) => st.tick > 600 && st.side === 0 && st.flipT === 0],
    ["roofbound-flip", (st) => st.tick > 900 && st.flipT > 0 && st.flipT === Math.round((st.arcN || 1) / 2)],
    ["roofbound-roof", (st) => st.tick > 1300 && st.side === 1 && st.flipT === 0],
  ];
  let k = 0;
  while (!game.isOver(s) && k < picks.length) {
    s = game.step(s, by.get(s.tick + 1) ?? null);
    clock += 1000 / 60;
    if (picks[k]![1](s)) {
      const st = s;
      const p = F.flipRunnerPoint(st);
      const worldH = F.flipWorldH(st);
      shoot(picks[k]![0], "Roofbound", F.FLIP_WORLD_W, worldH, (c, w, h) => art.draw(c, st, { width: w, height: h }), {
        x: p.x, y: p.y, draw: (c) => c.strokeRect(p.x - 16, p.y - 18, 32, 36),
      });
      k++;
    }
  }
}
