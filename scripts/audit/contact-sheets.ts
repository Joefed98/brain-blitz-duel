/**
 * Contact sheets for the audit screenshots (scripts/audit/audit-capture.ts): one sheet per puzzle category and per
 * arcade group, each game a row of intro / mid-round / reveal with its display name as the row label, split into
 * balanced parts of at most --per games. The approach of scripts/shots/sheets.ts (@napi-rs/canvas). Not a check.
 *
 *   bun scripts/audit/contact-sheets.ts [--in=screenshots/audit-nov-2026-final] [--out=<same>] [--per=8] [--scale=0.5]
 *       [--captured]   only the games with a frame in --in (a re-capture of a few games), no empty sheets
 *
 * Writes <out>/sheet-<category>[-<n>].jpg.
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ARCADE_GROUPS } from "../../src/lib/duel/arcadeGroups";
import { gameDisplayName } from "../../src/lib/duel/gameNames";
import { ACTIVE_PUZZLE_TYPES, puzzleDef } from "../../src/lib/duel/registry";
import type { PuzzleType } from "../../src/lib/duel/types";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const IN = opt("in") ?? "screenshots/audit-nov-2026-final";
const OUT = opt("out") ?? IN;
const PER = Number(opt("per") ?? 8);
const SCALE = Number(opt("scale") ?? 0.5);
const W = Math.round(414 * SCALE);
const H = Math.round(896 * SCALE);
const PHASES = [
  ["intro", "Intro"],
  ["mid", "Mid-round"],
  ["reveal", "Reveal"],
] as const;

const groups: { key: string; title: string; games: PuzzleType[] }[] = [];
for (const cat of ["word", "number", "speed", "attention", "pattern", "logic"]) {
  groups.push({
    key: cat,
    title: cat[0]!.toUpperCase() + cat.slice(1),
    games: ACTIVE_PUZZLE_TYPES.filter((t) => puzzleDef(t).category === cat),
  });
}
for (const g of ARCADE_GROUPS) {
  groups.push({
    key: `arcade-${g.id}`,
    title: `Arcade · ${g.label}`,
    games: ACTIVE_PUZZLE_TYPES.filter((t) => puzzleDef(t).category === "arcade" && g.games.includes(t)),
  });
}

if (args.includes("--captured")) {
  for (const g of groups) g.games = g.games.filter((t) => PHASES.some(([phase]) => existsSync(join(IN, g.key, `${t}-${phase}.png`))));
}

mkdirSync(OUT, { recursive: true });
const pad = 14;
const label = 210;
const head = 44;
const colHead = 24;
for (const g of groups) {
  if (!g.games.length) continue;
  const parts = Math.max(1, Math.ceil(g.games.length / PER));
  for (let p = 0; p < parts; p++) {
    const size = Math.ceil(g.games.length / parts); // balanced parts (9 games: 5 + 4)
    const games = g.games.slice(p * size, (p + 1) * size);
    const canvas = createCanvas(pad + label + PHASES.length * (W + pad), head + colHead + games.length * (H + pad));
    const c = canvas.getContext("2d");
    c.fillStyle = "#16161c";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = "#f4f4f6";
    c.font = "bold 24px sans-serif";
    c.fillText(`${g.title}${parts > 1 ? ` (${p + 1} of ${parts})` : ""} · 414×896 practice`, pad, 30);
    c.font = "15px sans-serif";
    c.fillStyle = "#c9c9d2";
    for (const [i, [, name]] of PHASES.entries()) c.fillText(name, pad + label + i * (W + pad), head + 16);
    for (const [row, game] of games.entries()) {
      const y0 = head + colHead + row * (H + pad);
      c.fillStyle = "#f4f4f6";
      c.font = "bold 18px sans-serif";
      const name = gameDisplayName(game);
      // Wrap a long name over two lines.
      const words = name.split(" ");
      let line = "";
      let ly = y0 + 22;
      for (const w of words) {
        const next = line ? `${line} ${w}` : w;
        if (c.measureText(next).width > label - 16 && line) {
          c.fillText(line, pad, ly);
          ly += 22;
          line = w;
        } else line = next;
      }
      c.fillText(line, pad, ly);
      c.fillStyle = "#9a9aa8";
      c.font = "14px sans-serif";
      c.fillText(game, pad, ly + 20);
      for (const [col, [phase]] of PHASES.entries()) {
        const x0 = pad + label + col * (W + pad);
        const f = join(IN, g.key, `${game}-${phase}.png`);
        if (existsSync(f)) c.drawImage(await loadImage(readFileSync(f)), x0, y0, W, H);
        else {
          c.strokeStyle = "#555";
          c.strokeRect(x0, y0, W, H);
          c.fillStyle = "#c9c9d2";
          c.fillText("not captured", x0 + 12, y0 + 24);
        }
      }
    }
    const out = join(OUT, `sheet-${g.key}${parts > 1 ? `-${p + 1}` : ""}.jpg`);
    writeFileSync(out, await canvas.encode("jpeg", 82));
    console.log(`${out}: ${games.length} games`);
  }
}
