/**
 * Records the default frames' digests (scripts/fixtures/skins-default-frames.json) from the renderers as they are on
 * main, before any skin hook: one child process per game (@napi-rs/canvas returns its memory only on exit).
 *   bun scripts/skins/record-default.ts            (all games)
 */
import { writeFileSync } from "node:fs";
import { SKIN_GAMES, drawFrames, digest, type SkinGame } from "./frames";

const one = process.argv.find((a) => a.startsWith("--game="))?.slice(7) as SkinGame | undefined;
if (one) {
  const frames = await drawFrames(one, undefined);
  console.log("JSON " + JSON.stringify(Object.fromEntries(frames.map((f) => [f.name, digest(f)]))));
  process.exit(0);
}
const out: Record<string, Record<string, string>> = {};
for (const g of SKIN_GAMES) {
  const child = Bun.spawnSync(["bun", import.meta.path, `--game=${g}`], { stdout: "pipe", stderr: "inherit" });
  const line = child.stdout.toString().split("\n").find((l) => l.startsWith("JSON "));
  if (child.exitCode !== 0 || !line) throw new Error(`${g} failed`);
  out[g] = JSON.parse(line.slice(5));
  console.log(g, Object.keys(out[g]!).length, "frames");
}
writeFileSync("scripts/fixtures/skins-default-frames.json", JSON.stringify(out, null, 1) + "\n");
