/**
 * Retro overhaul frames (15 Nov 2026, a design tool, not a check): each Retro game's arena drawn by its own renderer in
 * Node (@napi-rs/canvas, as tap-mapping-check does), at the room-dealt stamp, the skill-band bot's Near-perfect log
 * played to a fixed share of the run. The same script run on main (a git worktree) and on the branch gives the gallery's
 * "today" and "new" frames from identical runs: docs/design/pages-review/retro/GALLERY.md.
 *
 *   bun scripts/shots/retro-frames.ts --out=<dir> [--tag=new] [--at=0.5] [games…]
 *
 * The pixel HUD font (Press Start 2P) is loaded from Google Fonts in the app; here it falls back to a monospace face.
 * The Node canvas set-up and the bot runs are scripts/retro-render-lib.ts, shared with retro-overhaul-check.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createCanvas, retroArtFor, retroRun, type RetroType } from "../retro-render-lib";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = opt("out") ?? ".shots/retro";
const TAG = opt("tag") ?? "new";
const AT = opt("at") ? Number(opt("at")) : null;
/** Where each game's frame is taken (a share of the run) and by which bot level, so the frame shows the game in full play. */
const FRAME_AT: Record<string, number> = { breaker: 0.12, blockfall: 0.5, hover: 0.4 };
const LEVEL: Record<string, string> = { hover: "elite" };
const ALL = ["hover", "breaker", "rally", "wavefront", "burst", "beat", "snake", "cross", "pinball", "blockfall"] as const;
const games = args.filter((a) => !a.startsWith("--"));
const list = (games.length ? games : ALL) as readonly string[];

mkdirSync(OUT, { recursive: true });
for (const type of list as RetroType[]) {
  const run = await retroRun(type, { level: LEVEL[type] ?? "near", until: AT ?? FRAME_AT[type] ?? 0.5 });
  const s = run.states.at(-1)!;
  const draw = await retroArtFor(type, run.rev);
  const W = 390;
  const DPR = 2;
  // Each renderer fits its own world into the canvas it is given; a 390 × 760 box suits every Retro world.
  const H = 760;
  const canvas = createCanvas(W * DPR, H * DPR);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;
  ctx.fillStyle = "#070709";
  ctx.fillRect(0, 0, W * DPR, H * DPR);
  ctx.scale(DPR, DPR);
  draw(ctx, s, { width: W, height: H });
  const file = join(OUT, `${type}-${TAG}.webp`);
  writeFileSync(file, canvas.toBuffer("image/webp", 82));
  console.log(`${type} rev ${run.rev}: tick ${s.tick} → ${file}`);
}
