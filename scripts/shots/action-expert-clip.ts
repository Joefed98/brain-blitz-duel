/**
 * An Action game's gallery clip at a level (the Action overhaul, docs/design/pages-review/action/GALLERY.md): the
 * Elite skill-band bot under the human limits (scripts/action-levels-bands.ts) plays the course a seed deals at the
 * level, graded by the server (the same path as the bands tool); the game's own renderer draws a window of the run
 * through @napi-rs/canvas, and ffmpeg (libwebp_anim) makes a small animated WebP. A tool, not a check.
 *
 *   bun scripts/shots/action-expert-clip.ts <game> <seed> [--level=expert] [--out=<file.webp>] [--from=<tick>]
 *     [--secs=5] [--fps=8] [--width=195] [--quality=40] [--skill=elite]
 *
 * `--from` is the first tick drawn (default: 60 % of the run, where the later settings show). Frames are drawn at real
 * speed (one every 60 / fps ticks). A game joins by adding a line to ART (its art game for a stamp and level, and its
 * world size).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createCanvas } from "@napi-rs/canvas";

import type { PuzzleType } from "../../src/lib/duel/types";
import { gradeAnswer } from "../../src/lib/duel/generate.server";
import { LIVE_BANDS } from "../../src/lib/arcade/liveBands";
import { appendClientCounters, arcadeCounters } from "../../src/lib/arcade/diagnostics";
import { swingArtGameFor } from "../../src/lib/arcade/swing.renderer";
import { SWING_WORLD_W, swingWorldHFor } from "../../src/lib/arcade/swing";
import { GAME_BY_TYPE } from "../arcade-skill-bands/games";
import type { SkillBot } from "../arcade-skill-bands/bot";
import type { SkillLevel } from "../arcade-skill-bands/human";
import { limitedHuman } from "../action-levels-bands";
import { dealAt } from "../level-tune";
import type { Level } from "../../src/lib/levels/levels";

/** Each game's art for a dealt puzzle (stamp and level) and its world size. */
const ART: Record<string, (rev: number | null, level: unknown) => { art: any; w: number; h: number }> = {
  swing: (rev, level) => ({ art: swingArtGameFor(rev ?? undefined, level), w: SWING_WORLD_W, h: swingWorldHFor(rev) }),
};

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const [type, seedArg] = args.filter((a) => !a.startsWith("--")) as [PuzzleType, string];
if (!type || !seedArg || !ART[type]) throw new Error(`usage: bun scripts/shots/action-expert-clip.ts <${Object.keys(ART).join("|")}> <seed> [--level=expert] …`);
const level = (opt("level") ?? "expert") as Level;
const seed = Number(seedArg);
const skill = (opt("skill") ?? "elite") as SkillLevel;
const fps = Number(opt("fps") ?? 8);
const secs = Number(opt("secs") ?? 5);
const width = Number(opt("width") ?? 195);
const quality = Number(opt("quality") ?? 40);
const out = opt("out") ?? `.shots/${type}-${level}-${seed}.webp`;

// The puzzle the level deals, on this seed (the deal's stamps and level, the seed given).
const puzzle = { ...(dealAt(type, level, 0) as any), seed };
const spec = GAME_BY_TYPE.get(type)!;
const field = LIVE_BANDS[type as keyof typeof LIVE_BANDS]?.field;
const rev = field && typeof puzzle[field] === "number" ? (puzzle[field] as number) : null;
const game = spec.gameForPuzzle ? spec.gameForPuzzle(puzzle) : spec.gameFor(rev, seed);
const bot = ((await import(`../arcade-skill-bands/bots/${type}.ts`)) as { bot: SkillBot }).bot;
const events = bot({ game, seed, rev, human: limitedHuman(type, seed, skill), fixes: true }).events ?? [];
const byTick = new Map(events.map((e: any) => [e.t, e]));

// The whole run, its states kept for the window, then the server's grade.
const from = Number(opt("from") ?? Math.round(game.runTicks * 0.6));
const step = Math.max(1, Math.round(60 / fps));
const wanted = new Set(Array.from({ length: Math.round(secs * fps) }, (_, i) => from + i * step));
const states: any[] = [];
let state = game.init(seed);
const checkpoints: unknown[] = [];
while (!game.isOver(state) && state.tick < game.runTicks) {
  state = game.step(state, byTick.get(state.tick + 1) ?? null);
  if (state.tick % 300 === 0) checkpoints.push(spec.checkpoint(state));
  if (wanted.has(state.tick)) states.push(state);
}
const claimed = game.score(state);
const raw = appendClientCounters(spec.encode({ seed, claimedScore: claimed, events, inputs: [], taps: [], endTick: state.tick, checkpoints } as never, rev, seed), arcadeCounters(type, state, claimed));
const graded = gradeAnswer(puzzle, raw, 0);

const { art, w, h } = ART[type]!(rev, puzzle.level);
const height = Math.round((width * h) / w / 2) * 2;
const dir = mkdtempSync(join(tmpdir(), "action-clip-"));
states.forEach((s, i) => {
  const c = createCanvas(width, height);
  const ctx = c.getContext("2d") as unknown as CanvasRenderingContext2D;
  art.draw(ctx, s, { width, height });
  writeFileSync(join(dir, `f${String(i).padStart(3, "0")}.png`), c.toBuffer("image/png"));
});
mkdirSync(join(out, ".."), { recursive: true });
const ff = spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", join(dir, "f%03d.png"), "-c:v", "libwebp_anim", "-lossless", "0", "-q:v", String(quality), "-compression_level", "6", "-loop", "0", out], { stdio: "inherit" });
rmSync(dir, { recursive: true, force: true });
if (ff.status !== 0) throw new Error("ffmpeg failed");
console.log(`${type} ${level} seed ${seed}: ${skill} scored ${graded.score} (server)${(graded.extra as any)?.flagged ? " FLAGGED" : ""}; ${states.length} frames ${width}×${height} from tick ${from}; ${out} ${Math.round(statSync(out).size / 1024)} KB`);
