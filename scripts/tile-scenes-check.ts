/**
 * Game tile scenes (27 Oct 2026; ~1 s): the tile images GameIcon shows are what
 * `bun scripts/shots/tile-scenes.ts` made, and every active game has one.
 *
 *  - every entry in src/components/app/gameIcons/tileScenes.data.ts has public/tiles/<type>.webp
 *    whose content hash matches (a stale data file would serve a cached old picture), and every
 *    file in public/tiles is listed;
 *  - each image is a 208 × 208 WebP (2× the largest tile, Practice's 104 px shelf) of at most 16 KB;
 *  - every active game (and every listed retired one) has a scene in scripts/shots/tile-scenes/, so a
 *    regeneration remakes every image; a game without an image keeps its line drawing;
 *  - GameIcon draws the image (data-icon-art="img") for a game with one and the line drawing otherwise.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { loadImage } from "@napi-rs/canvas";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GameIcon } from "../src/components/app/GameIcon";
import { CONCEPT_ICONS } from "../src/components/app/gameIcons/conceptIcons";
import { TILE_SCENES } from "../src/components/app/gameIcons/tileScenes.data";
import { PUZZLE_REGISTRY } from "../src/lib/duel/registry";
import type { PuzzleType } from "../src/lib/duel/types";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

const DIR = "public/tiles";
const files = readdirSync(DIR).filter((f) => f.endsWith(".webp"));
const listed = Object.entries(TILE_SCENES) as [PuzzleType, string][];
check(files.length === listed.length, `${files.length} images in ${DIR}, ${listed.length} in tileScenes.data.ts`);

for (const [type, hash] of listed) {
  const file = join(DIR, `${type}.webp`);
  let bytes: Buffer;
  try {
    bytes = readFileSync(file);
  } catch {
    check(false, `${type}: ${file} missing`);
    continue;
  }
  check(createHash("sha256").update(bytes).digest("hex").slice(0, 10) === hash, `${type}: the image's hash is not the data file's (re-run bun scripts/shots/tile-scenes.ts)`);
  check(bytes.subarray(0, 4).toString("latin1") === "RIFF" && bytes.subarray(8, 12).toString("latin1") === "WEBP", `${type}: not a WebP`);
  check(bytes.length <= 16_384, `${type}: ${(bytes.length / 1024).toFixed(1)} KB, over 16 KB`);
  const img = await loadImage(bytes);
  check(img.width === 208 && img.height === 208, `${type}: ${img.width}×${img.height}, expected 208×208`);
}
for (const f of files) check(f.replace(/\.webp$/, "") in TILE_SCENES, `${f} is not in tileScenes.data.ts`);

// Every active game has an image and a scene that remakes it.
const sceneSrc = readdirSync("scripts/shots/tile-scenes")
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => readFileSync(join("scripts/shots/tile-scenes", f), "utf8"))
  .join("\n");
for (const [type, def] of Object.entries(PUZZLE_REGISTRY) as [PuzzleType, (typeof PUZZLE_REGISTRY)[PuzzleType]][]) {
  const has = type in TILE_SCENES;
  if (!def.retired) check(has, `${type} (${def.name}): no tile scene image`);
  if (has) check(new RegExp(`^\\s*${type}: (canvasScene|domScene)\\(`, "m").test(sceneSrc), `${type}: an image with no scene in scripts/shots/tile-scenes/`);
  if (!has) check(type in CONCEPT_ICONS, `${type}: neither a scene nor a line drawing`);
  const html = renderToStaticMarkup(createElement(GameIcon, { type, size: 64 }));
  if (has)
    check(
      html.includes('data-icon-art="img"') && html.includes(`src="/tiles/${type}.webp?v=${TILE_SCENES[type]}"`) && html.includes('alt=""'),
      `${type}: GameIcon does not draw its scene image`,
    );
  else check(html.includes('data-icon-art="svg"') && html.includes("<svg"), `${type}: GameIcon does not fall back to the line drawing`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS: tile-scenes-check, ${passes} checks (${listed.length} images)`);
