/**
 * Contact sheets from scripts/shots/capture.ts frames: one sheet per game and viewport,
 * one row per tag (e.g. before / after), one column per phase in capture order. Not a check.
 *
 *   bun scripts/shots/sheets.ts --in=<frames dir> --out=<sheet dir> [--tags=before,after]
 *       [--phases=intro,play,solve2,reveal] [--scale=0.5] [--format=jpg|png]
 *
 * Frames are <game>-<w>x<h>-<phase>-<tag>.png; a missing frame shows as an empty box.
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { gameDisplayName } from "../../src/lib/duel/gameNames";
import type { PuzzleType } from "../../src/lib/duel/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const IN = opt("in") ?? "/tmp/duelz-shots";
const OUT = opt("out") ?? join(IN, "sheets");
const SCALE = Number(opt("scale") ?? 1);
const FORMAT = opt("format") === "png" ? "png" : "jpg";
/** Capture order; solve frames and anything else follow in name order. */
const ORDER = ["intro", "play", "solve1", "solve2", "solve3", "fx", "reveal", "timeout", "full"];
const LABEL: Record<string, string> = {
  play: "mid-play",
  fx: "completion",
  solve1: "solve 1",
  solve2: "solve 2",
  solve3: "solve 3",
  timeout: "timed out",
  full: "full answer",
};

const FRAME = /^([a-z0-9]+)-(\d+x\d+)-([a-z0-9]+)-([A-Za-z0-9_]+)\.png$/;
const frames = readdirSync(IN).flatMap((name) => {
  const m = FRAME.exec(name);
  return m ? [{ name, game: m[1]!, size: m[2]!, phase: m[3]!, tag: m[4]! }] : [];
});
const pick = (list: string | undefined, found: string[]) => (list ? list.split(",") : found);
const tags = pick(
  opt("tags"),
  [...new Set(frames.map((f) => f.tag))].sort((a, b) =>
    a === "before" ? -1 : b === "before" ? 1 : a.localeCompare(b),
  ),
);
const rank = (p: string) => (ORDER.includes(p) ? ORDER.indexOf(p) : ORDER.length);
mkdirSync(OUT, { recursive: true });

for (const key of [...new Set(frames.map((f) => `${f.game}|${f.size}`))].sort()) {
  const [game, size] = key.split("|") as [string, string];
  const [w, h] = size.split("x").map((n) => Math.round(Number(n) * SCALE)) as [number, number];
  const mine = frames.filter((f) => f.game === game && f.size === size);
  const phases = pick(
    opt("phases"),
    [...new Set(mine.map((f) => f.phase))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)),
  );
  const pad = 12,
    label = 26,
    head = 34;
  const canvas = createCanvas(
    pad + phases.length * (w + pad),
    head + tags.length * (label + h + pad),
  );
  const c = canvas.getContext("2d");
  c.fillStyle = "#16161c";
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = "#f4f4f6";
  c.font = "bold 20px sans-serif";
  let name = game;
  try {
    name = `${gameDisplayName(game as PuzzleType)} (${game})`;
  } catch {
    /* unknown id: keep it */
  }
  c.fillText(`${name} · ${size}`, pad, 24);
  for (const [row, tag] of tags.entries()) {
    const y0 = head + row * (label + h + pad);
    for (const [col, phase] of phases.entries()) {
      const x0 = pad + col * (w + pad);
      c.fillStyle = "#c9c9d2";
      c.font = "15px sans-serif";
      c.fillText(`${tag} · ${LABEL[phase] ?? phase}`, x0, y0 + 18);
      const frame = mine.find((f) => f.tag === tag && f.phase === phase);
      if (frame)
        c.drawImage(await loadImage(readFileSync(join(IN, frame.name))), x0, y0 + label, w, h);
      else {
        c.strokeStyle = "#555";
        c.strokeRect(x0, y0 + label, w, h);
        c.fillText("not captured", x0 + 12, y0 + label + 24);
      }
    }
  }
  const out = join(OUT, `${game}-${size}.${FORMAT}`);
  writeFileSync(
    out,
    FORMAT === "png" ? await canvas.encode("png") : await canvas.encode("jpeg", 82),
  );
  console.log(out);
}
