/**
 * sports-sprites-check (the Sports overhaul, phase 2 step 4; display only, no browser, ~1 s): the rendered sprites
 * (docs/design/game-art/sports/render_sports.py → public/sports/<game>/, anchors in src/lib/arcade/sportsSprites.data.ts)
 * are all there at the sizes the data file records, every WebP is a real image, and each game's new art stays inside
 * Joe's image budget (about 400 KB a game, 15 Nov 2026), so the offline pack stays reasonable. Also proves the loader
 * draws the painted fallback where there is no Image (every check in Bun) and hands a script's image back.
 *
 *   bun scripts/sports-sprites-check.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadImage } from "@napi-rs/canvas";

import { SPORTS_SPRITES, clearSportsSpritesForShots, setSportsSpriteForShots, sportsSprite } from "../src/lib/arcade/sportsSprites";

const BUDGET_KB = 400;
const failures: string[] = [];
let passes = 0;
const ok = (cond: boolean, line: string) => {
  if (cond) {
    passes++;
    console.log(`  ok ${line}`);
  } else {
    failures.push(line);
    console.log(`  FAIL ${line}`);
  }
};

function sizeOf(buf: Buffer): { w: number; h: number } | null {
  // RIFF....WEBP then VP8 / VP8L / VP8X.
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const kind = buf.toString("ascii", 12, 16);
  if (kind === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  if (kind === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) };
  }
  if (kind === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  return null;
}

const ROOT = "public/sports";
type Entry = { w: number; h: number };
const expected: Record<string, Record<string, Entry>> = {};
const data = SPORTS_SPRITES as unknown as Record<string, Record<string, unknown>>;
for (const [game, set] of Object.entries(data)) {
  expected[game] = {};
  for (const [name, v] of Object.entries(set)) {
    if (name === "frames" && Array.isArray(v)) {
      // Apex: each yaw's car, brake and paint-mask frames share one size.
      (v as Entry[]).forEach((f, i) => {
        for (const variant of ["car", "brake", "mask"]) expected[game]![`${variant}-${i}`] = { w: f.w, h: f.h };
      });
    } else if (v && typeof v === "object" && "w" in (v as object)) expected[game]![name] = v as Entry;
  }
}

for (const game of Object.keys(expected)) {
  const dir = join(ROOT, game);
  ok(existsSync(dir), `${game}: public/sports/${game} exists`);
  if (!existsSync(dir)) continue;
  let total = 0;
  let bad = 0;
  const files = readdirSync(dir).filter((f) => f.endsWith(".webp"));
  for (const f of files) total += statSync(join(dir, f)).size;
  for (const [name, e] of Object.entries(expected[game]!)) {
    const path = join(dir, `${name}.webp`);
    if (!existsSync(path)) {
      bad++;
      failures.push(`${game}/${name}.webp missing`);
      continue;
    }
    const s = sizeOf(readFileSync(path));
    if (!s || s.w !== e.w || s.h !== e.h) {
      bad++;
      failures.push(`${game}/${name}.webp is ${s ? `${s.w}×${s.h}` : "not a WebP"}, the data file says ${e.w}×${e.h}`);
    }
  }
  ok(bad === 0, `${game}: ${Object.keys(expected[game]!).length} sprites present at their recorded sizes`);
  ok(files.length === Object.keys(expected[game]!).length, `${game}: no stray images (${files.length} files)`);
  ok(total / 1024 <= BUDGET_KB, `${game}: ${(total / 1024).toFixed(1)} KB of images, within the ${BUDGET_KB} KB budget`);
}

// The loader: no Image in Bun → null (the painted fallback), and a script's image is handed back.
clearSportsSpritesForShots();
ok(sportsSprite("pool", "arm", true) === null, "the loader answers null where there is no Image (the painted fallback is drawn)");
const img = await loadImage(readFileSync(join(ROOT, "pool/arm.webp")));
setSportsSpriteForShots("pool", "arm", img);
ok(sportsSprite("pool", "arm", true) === (img as unknown), "a script's image is handed back to the renderer");
clearSportsSpritesForShots();

if (failures.length) {
  console.log(`FAIL sports-sprites-check: ${failures.length} failure(s), ${passes} passed`);
  process.exit(1);
}
console.log(`PASS sports-sprites-check: ${passes} checks`);
