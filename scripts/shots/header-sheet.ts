/**
 * The game header contact sheet (31 Oct 2026, the header-name fit): crops every game's live-round header out of the
 * capture tool's play frames and lays them out one sheet per size, each labelled with the name's drawn size and lines
 * (the report's `frameName`, which capture.ts records on its play phase). A design tool, not a check.
 *
 *   bun scripts/shots/capture.ts --all --sizes=414x896,375x667 --phases=play --out=<dir> --tag=<tag>
 *   bun scripts/shots/header-sheet.ts --in=<dir> [--tag=<tag>] [--out=<dir>, default <in>/sheets]
 *
 * Prints any name that is cut (an ellipsis) or takes two lines, and exits 1 if a name is cut.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createCanvas, loadImage } from "@napi-rs/canvas";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const IN = opt("in") ?? ".shots";
const TAG = opt("tag") ?? "after";
const OUT = opt("out") ?? join(IN, "sheets");

interface FrameName {
  text: string;
  size: number;
  lines: number;
  cut: boolean;
  header: { x: number; y: number; w: number; h: number };
}
const report = JSON.parse(readFileSync(join(IN, `report-${TAG}.json`), "utf8")) as Record<string, { frameName?: FrameName | null; error?: string }>;

mkdirSync(OUT, { recursive: true });
const bySize = new Map<string, { game: string; name: FrameName }[]>();
for (const [key, entry] of Object.entries(report)) {
  const [game = "", size = ""] = key.split("@");
  if (!entry?.frameName) {
    console.log(`no header ${key}${entry?.error ? `: ${entry.error}` : ""}`);
    continue;
  }
  if (!bySize.has(size)) bySize.set(size, []);
  bySize.get(size)!.push({ game, name: entry.frameName });
}

let cut = 0;
for (const [size, rows] of bySize) {
  rows.sort((a, b) => b.name.text.length - a.name.text.length || a.name.text.localeCompare(b.name.text));
  const w = Math.max(...rows.map((r) => r.name.header.w));
  const cols = 2;
  const label = 22;
  const cellH = Math.max(...rows.map((r) => r.name.header.h)) + label + 8;
  const cellW = w + 16;
  const canvas = createCanvas(cellW * cols + 16, cellH * Math.ceil(rows.length / cols) + 56);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#16161c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#f3f1ec";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(`Game header names at ${size} (${rows.length} games, longest first)`, 16, 32);
  for (let i = 0; i < rows.length; i++) {
    const { game, name } = rows[i]!;
    const x = 8 + (i % cols) * cellW;
    const y = 48 + Math.floor(i / cols) * cellH;
    const img = await loadImage(readFileSync(join(IN, `${game}-${size}-play-${TAG}.png`)));
    const h = name.header;
    ctx.drawImage(img, h.x, h.y, h.w, h.h, x + 8, y + label, h.w, h.h);
    ctx.fillStyle = name.cut ? "#ff6b5a" : name.lines > 1 ? "#f2c75c" : "#a09da6";
    ctx.font = "13px sans-serif";
    ctx.fillText(`${name.text} · ${name.size}px · ${name.lines} line${name.lines === 1 ? "" : "s"}${name.cut ? " · CUT" : ""} (${game})`, x + 8, y + 16);
    if (name.cut) {
      cut++;
      console.log(`CUT ${size} ${game}: "${name.text}" at ${name.size}px`);
    } else if (name.lines > 1) console.log(`two lines ${size} ${game}: "${name.text}" at ${name.size}px`);
  }
  const file = join(OUT, `header-names-${size}.png`);
  writeFileSync(file, canvas.toBuffer("image/png"));
  const sizes = rows.map((r) => r.name.size);
  console.log(`wrote ${file}: ${rows.length} names, ${Math.min(...sizes)}–${Math.max(...sizes)}px`);
}
process.exit(cut ? 1 : 0);
