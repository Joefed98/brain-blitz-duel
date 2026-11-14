/**
 * home-art-check (phase 2 step 3, 14 Nov 2026): Home and Play's art-kit images (public/home/, homeArt.data.ts) are
 * exactly what scripts/home-art.ts builds from docs/design/style-guide/art (~2 s, no browser).
 *
 *   bun scripts/home-art-check.ts
 */
import { spawnSync } from "node:child_process";

const run = spawnSync("bun", ["scripts/home-art.ts", "--check"], { stdio: "inherit" });
process.exit(run.status ?? 1);
