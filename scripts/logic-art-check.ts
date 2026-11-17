/**
 * logic-art-check (~2 s): the Logic overhaul's Blender pieces on disk (public/logic-art/, src/puzzles/logicArt.data.ts)
 * match what scripts/logic-art.ts cuts from docs/design/logic-art/source (re-run it after a render changes).
 */
import { spawnSync } from "node:child_process";

const run = spawnSync("bun", ["scripts/logic-art.ts", "--check"], { stdio: "inherit" });
if (run.status !== 0) {
  console.log("logic-art-check: FAIL");
  process.exit(1);
}
console.log("logic-art-check: 1 passed, 0 failed");
