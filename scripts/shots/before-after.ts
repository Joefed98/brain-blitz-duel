/**
 * Before and after (Polish 2, 24 Oct 2026): main beside this branch, one mid-play frame per game at
 * 414×896 (Joe's iPhone 11), as side-by-side sheets. A design tool, not a check (CI never runs it).
 *
 *   bun scripts/shots/before-after.ts [games…] [--main=<origin>] [--branch=<origin>]
 *       [--out=screenshots/before-after] [--work=.shots/before-after] [--ref=origin/main]
 *       [--reuse] [--sheets-only] [--pairs=<game,game…>]
 *
 * Frames come from scripts/shots/contact-sheet.ts (its practice setup, the fixed intro example,
 * `Math.random` seeded, its game drivers and seeded taps), run once against each tree:
 * - "before": --main=<origin>, or else a git worktree of --ref (default origin/main) in <work>/main-tree
 *   (node_modules linked from this tree) served on port 5291;
 * - "after": --branch=<origin>, or else this tree served on port 5391.
 * Both dev servers point Supabase at a closed port, as the contact sheet's does, so server calls fail
 * fast. --reuse keeps frames already in <work>/before and <work>/after; --sheets-only only redraws.
 *
 * Writes <out>/<game>.png (before | after, full size, labelled; every game, or only those named in
 * --pairs) and <out>/overview.png (every captured pair at a quarter size, in category order).
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import { ACTIVE_PUZZLE_TYPES, puzzleDef } from "../../src/lib/duel/registry";
import type { PuzzleType } from "../../src/lib/duel/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OUT = opt("out") ?? "screenshots/before-after";
const WORK = opt("work") ?? ".shots/before-after";
const REF = opt("ref") ?? "origin/main";
const W = 414;
const H = 896;
const CATEGORIES = ["word", "number", "speed", "attention", "pattern", "logic", "arcade"] as const;
const BG = "#070709";
const TEXT = "#F5F5F7";
const MUTED = "#BDBDCC";

const servers: ChildProcess[] = [];

async function serve(dir: string, port: number): Promise<string> {
  const proc = spawn("npx", ["vite", "dev", "--port", String(port), "--host", "127.0.0.1", "--strictPort"], {
    cwd: dir,
    stdio: "ignore",
    detached: true,
    env: { ...process.env, SUPABASE_URL: "http://127.0.0.1:9", SUPABASE_SERVICE_ROLE_KEY: "offline" },
  });
  servers.push(proc);
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${origin}/practice`)).ok) return origin;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`dev server in ${dir} did not start`);
}

function mainTree(): string {
  const tree = resolve(WORK, "main-tree");
  if (!existsSync(tree)) {
    mkdirSync(WORK, { recursive: true });
    const made = spawnSync("git", ["worktree", "add", "--detach", tree, REF], { stdio: "inherit" });
    if (made.status !== 0) throw new Error(`git worktree add ${REF} failed`);
  }
  if (!existsSync(join(tree, "node_modules"))) symlinkSync(resolve("node_modules"), join(tree, "node_modules"));
  return tree;
}

/** One contact-sheet run (this tree's script, so both sides get the same drivers and taps). */
function capture(origin: string, out: string, games: string[]) {
  const run = spawnSync("bun", ["scripts/shots/contact-sheet.ts", ...games, `--url=${origin}`, `--out=${out}`], {
    stdio: "inherit",
  });
  if (run.status !== 0) throw new Error(`capture against ${origin} failed`);
}

const frame = (side: string, game: PuzzleType) => join(WORK, side, puzzleDef(game).category, `${game}.png`);
const load = async (file: string): Promise<Image | null> => (existsSync(file) ? loadImage(file) : null);

/** One game: before | after at full size, with the game's name over them. */
async function pair(game: PuzzleType) {
  const gap = 24;
  const head = 56;
  const canvas = createCanvas(W * 2 + gap * 3, H + head + gap);
  const g = canvas.getContext("2d");
  g.fillStyle = BG;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = TEXT;
  g.font = "bold 22px sans-serif";
  g.textBaseline = "middle";
  g.fillText(`${gameDisplayName(game)} (${game})`, gap, 22);
  g.font = "15px sans-serif";
  g.fillStyle = MUTED;
  for (const [i, side] of (["before", "after"] as const).entries()) {
    const x = gap + i * (W + gap);
    g.fillText(side === "before" ? "Before (main)" : "After (this branch)", x, 46);
    const img = await load(frame(side, game));
    g.strokeStyle = "#2a2a33";
    g.strokeRect(x - 0.5, head - 0.5, W + 1, H + 1);
    if (img) g.drawImage(img, x, head, W, H);
  }
  writeFileSync(join(OUT, `${game}.png`), canvas.toBuffer("image/png"));
}

/** Every pair at a quarter size, in category order, six pairs a row. */
async function overview(games: PuzzleType[]) {
  const scale = 0.25;
  const tw = Math.round(W * scale);
  const th = Math.round(H * scale);
  const cols = 6;
  const pad = 12;
  const label = 30;
  const head = 48;
  const cw = tw * 2 + 4 + pad;
  const ch = th + label + pad;
  const rows = Math.ceil(games.length / cols);
  const canvas = createCanvas(pad + cols * cw, head + rows * ch + pad);
  const g = canvas.getContext("2d");
  g.fillStyle = BG;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = TEXT;
  g.font = "bold 20px sans-serif";
  g.textBaseline = "middle";
  g.fillText(`Before (left of each pair) and after: ${games.length} games, ${W}×${H} mid-play, practice`, pad, head / 2);
  for (const [i, game] of games.entries()) {
    const x = pad + (i % cols) * cw;
    const y = head + Math.floor(i / cols) * ch;
    for (const [k, side] of (["before", "after"] as const).entries()) {
      const img = await load(frame(side, game));
      const px = x + k * (tw + 4);
      g.strokeStyle = "#2a2a33";
      g.strokeRect(px - 0.5, y - 0.5, tw + 1, th + 1);
      if (img) g.drawImage(img, px, y, tw, th);
    }
    g.textAlign = "center";
    g.fillStyle = TEXT;
    g.font = "bold 11px sans-serif";
    g.fillText(gameDisplayName(game), x + tw + 2, y + th + 10);
    g.fillStyle = MUTED;
    g.font = "9px sans-serif";
    g.fillText(`${game} · ${puzzleDef(game).category}`, x + tw + 2, y + th + 22);
    g.textAlign = "left";
  }
  writeFileSync(join(OUT, "overview.png"), canvas.toBuffer("image/png"));
}

async function main() {
  const named = args.filter((a) => !a.startsWith("--")) as PuzzleType[];
  const ordered = CATEGORIES.flatMap((c) => ACTIVE_PUZZLE_TYPES.filter((t) => puzzleDef(t).category === c));
  const games = named.length ? ordered.filter((t) => named.includes(t)) : ordered;
  mkdirSync(OUT, { recursive: true });
  try {
    if (!args.includes("--sheets-only")) {
      const reuse = args.includes("--reuse");
      for (const side of ["before", "after"] as const) {
        const missing = reuse ? games.filter((t) => !existsSync(frame(side, t))) : games;
        if (!missing.length) continue;
        const given = opt(side === "before" ? "main" : "branch");
        const origin = given ?? (side === "before" ? await serve(mainTree(), 5291) : await serve(".", 5391));
        capture(origin, join(WORK, side), missing);
      }
    }
    const pairs = opt("pairs")?.split(",").filter(Boolean);
    for (const game of games) if (!pairs || pairs.includes(game)) await pair(game);
    if (!named.length) await overview(games);
    console.log(`${pairs ? games.filter((t) => pairs.includes(t)).length : games.length} full-size sheet(s) in ${OUT}${named.length ? "" : `, and overview.png with all ${games.length} games`}`);
  } finally {
    for (const proc of servers) if (proc.pid) process.kill(-proc.pid);
  }
}

await main();
