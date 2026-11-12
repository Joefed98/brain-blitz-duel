/**
 * Records the default deck frames' digests from a checkout of main (before the card back):
 *   git worktree add /tmp/main-af70c5f af70c5f && ln -s "$PWD/node_modules" /tmp/main-af70c5f/node_modules
 *   bun scripts/skins/record-deck.ts --root=/tmp/main-af70c5f
 * writes scripts/fixtures/skins-deck-frames.json.
 */
import { writeFileSync } from "node:fs";
import { deckFrames } from "./deck-frames";

const root = process.argv.find((a) => a.startsWith("--root="))?.slice(7);
if (!root) throw new Error("--root=<checkout of main> is required");
const frames = await deckFrames(root, undefined);
writeFileSync("scripts/fixtures/skins-deck-frames.json", JSON.stringify({ recorded: "main af70c5f (before the card back)", frames: Object.fromEntries(frames.map((f) => [f.name, f.digest])) }, null, 1) + "\n");
console.log(`recorded ${frames.length} deck frames from ${root}`);
