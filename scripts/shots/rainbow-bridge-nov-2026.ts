/**
 * Review frames for Rainbow Bridge inkRev 13 (Nov 2026; docs/arcade-standard/inkbridge.md "inkRev 13"): the world drawn
 * by the game's own renderer on a 414 × 896 portrait frame (an iPhone 11's screen; the world fills the width below a
 * 60 px header band, as the play screen's arena does), from states the real sim reached playing the perfect run
 * (scripts/ink-x200-oracle.ts) and one over-par line drawn through the sim. Shows the extra birds, a clover, a cloud,
 * and the HUD's ink-par readout ("Ink 84 / par 90"; red over par). Not a check.
 *
 *   bun scripts/shots/rainbow-bridge-nov-2026.ts [--out=screenshots/rainbow-bridge-nov-2026]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { inkBridgeGameFor, INK_INPUT_STROKE, INK_REV_CLOVER, INK_WORLD_W, inkWorldH, type InkState } from "../../src/lib/arcade/inkBridge";
import { roomSeed } from "../arcade-skill-bands/games";
import { inkOracleRun } from "../ink-x200-oracle";

Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: false }) } });
class Surface {
  constructor(w: number, h: number) {
    return createCanvas(w, h);
  }
}
Object.defineProperty(globalThis, "OffscreenCanvas", { configurable: true, value: Surface });
try {
  GlobalFonts.registerFromPath("public/fonts/jetbrains-mono-600-700-latin.woff2", "JetBrains Mono");
} catch {
  /* the system monospace stands in */
}
const { drawInkBridgeArt, INK_ART_BG } = await import("../../src/lib/arcade/inkBridge.renderer");

const OUT = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/rainbow-bridge-nov-2026";
mkdirSync(OUT, { recursive: true });
const W = 414;
const H = 896;
const HEADER = 60;
const game = inkBridgeGameFor(INK_REV_CLOVER);

function frame(name: string, state: InkState, caption: string): void {
  const c = createCanvas(W * 2, H * 2);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.scale(2, 2);
  ctx.fillStyle = INK_ART_BG;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W, HEADER);
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "bold 16px sans-serif";
  ctx.fillText(`Rainbow Bridge · inkRev 13 · level ${state.level + 1}`, 14, 36);
  const worldH = (inkWorldH(state) * W) / INK_WORLD_W;
  ctx.save();
  ctx.translate(0, HEADER);
  drawInkBridgeArt(ctx, state, { width: W, height: worldH });
  ctx.restore();
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, HEADER + worldH, W, H - HEADER - worldH);
  ctx.fillStyle = "#F5F5F7";
  ctx.font = "14px sans-serif";
  const words = caption.split(" ");
  let line = "";
  let y = HEADER + worldH + 28;
  for (const w of words) {
    if (ctx.measureText(`${line} ${w}`).width > W - 28) {
      ctx.fillText(line, 14, y);
      y += 20;
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  ctx.fillText(line, 14, y);
  writeFileSync(`${OUT}/${name}.png`, c.toBuffer("image/png"));
  console.log(`${OUT}/${name}.png`);
}

/** The perfect run's state on each level just before RELEASE (the line drawn), and the coin in flight on clover levels. */
const seed = roomSeed(0);
const o = inkOracleRun(seed, INK_REV_CLOVER);
const byTick = new Map(o.events.map((e) => [e.t, e]));
let s = game.init(seed) as InkState;
const shot = new Set<string>();
while (!game.isOver(s) && s.tick < game.runTicks) {
  const ev = byTick.get(s.tick + 1) ?? null;
  const lvl = s.list[s.level]!;
  const key = `L${s.level + 1}`;
  if (ev && ev.k === 13 && !shot.has(key) && [1, 4, 6, 8, 9].includes(s.level)) {
    shot.add(key);
    const kind = lvl.liveHand ? "a live level" : lvl.clouds?.length ? "a cloud level" : lvl.shamrock ? "a clover level" : "a plain level";
    frame(`level-${s.level + 1}-drawn`, s, `Level ${s.level + 1}, ${kind}: ${lvl.blocks.length} birds. The proved line is drawn; the HUD reads its ink against the level's par (par ${lvl.inkPar}).`);
  }
  const prev = s;
  s = game.step(s, ev);
  if (prev.list[prev.level]!.shamrock && s.dropping && s.dropTicks === 40 && !shot.has(`${key}-fly`)) {
    shot.add(`${key}-fly`);
    frame(`level-${s.level + 1}-clover-flight`, s, `Level ${s.level + 1}: the coin rolls toward the clover, off the easy route (5 points once the coin is potted).`);
  }
}

/** An over-par line, drawn through the sim: a long zigzag on level 1 (the readout turns red). */
let z = game.init(seed) as InkState;
const pts: [number, number][] = [];
for (let i = 0; i < 26; i++) pts.push([40 + (i % 2) * 300, 120 + i * 12]);
pts.forEach(([x, y], i) => {
  z = game.step(z, { t: z.tick + 1, k: INK_INPUT_STROKE, a: x, b: y, c: i === 0 ? 1 : 0, d: 0 });
});
frame("level-1-over-par", z, `Level 1 with a long zigzag drawn: the readout turns red once the ink passes the par (par ${z.list[0]!.inkPar}). Potted at twice the par or more, the level pays no ink-par points.`);
