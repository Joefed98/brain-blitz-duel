/**
 * tournament-art-check (~2 s): the Tournaments, Leaderboards and Daily pages' art on disk matches what
 * scripts/tournament-art.ts builds from docs/design/style-guide/art (re-run it after changing an art-kit source).
 */
import { spawnSync } from "node:child_process";

const run = spawnSync("bun", ["scripts/tournament-art.ts", "--check"], { stdio: "inherit" });
if (run.status !== 0) {
  console.log("tournament-art-check: FAIL");
  process.exit(1);
}
console.log("tournament-art-check: 1 passed, 0 failed");
