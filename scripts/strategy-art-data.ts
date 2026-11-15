/**
 * Writes src/lib/arcade/strategyArt.data.ts: each rendered Strategy image in public/strategy/ (from
 * docs/design/cosmetics-redraws/blender/strategy_art.py) with its content hash, put on its URL so a redrawn image is
 * never served from an old cache.
 *
 *   bun scripts/strategy-art-data.ts [--check]
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

const DIR = "public/strategy";
const OUT = "src/lib/arcade/strategyArt.data.ts";
const files = readdirSync(DIR).filter((f) => f.endsWith(".webp")).sort();
const rows = files.map((f) => `  "${f.replace(/\.webp$/, "")}": "${createHash("sha256").update(readFileSync(`${DIR}/${f}`)).digest("hex").slice(0, 10)}",`);
const text = `/**
 * The Strategy games' rendered materials (built by \`bun scripts/strategy-art-data.ts\`, do not edit): each image in
 * public/strategy/ and its content hash.
 */
export const STRATEGY_ART = {
${rows.join("\n")}
} as const;
`;
if (process.argv.includes("--check")) {
  if (!existsSync(OUT) || readFileSync(OUT, "utf8") !== text) {
    console.log(`FAIL ${OUT} is out of date (bun scripts/strategy-art-data.ts)`);
    process.exit(1);
  }
  console.log(`ok: ${files.length} images`);
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${files.length} images`);
}
