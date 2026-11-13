/**
 * Run by scripts/skins/base.ts inside the extracted base commit (cwd = that folder): prints one part's default digests
 * as drawn by the base's own renderers, exactly as main's stage calls them (no look argument).
 *   bun scripts/skins/dump-base.ts --part=<game>|deck
 */
import { deckFrames } from "./deck-frames";
import { drawFrames, digest, type SkinGame } from "./frames";

const part = process.argv.find((a) => a.startsWith("--part="))?.slice(7);
if (!part) throw new Error("--part=<game>|deck is required");
if (part === "deck") {
  const frames = await deckFrames(process.cwd(), undefined);
  console.log("JSON " + JSON.stringify(Object.fromEntries(frames.map((f) => [f.name, f.digest]))));
} else {
  const frames = await drawFrames(part as SkinGame, undefined);
  console.log("JSON " + JSON.stringify(Object.fromEntries(frames.map((f) => [f.name, digest(f)]))));
}
process.exit(0);
