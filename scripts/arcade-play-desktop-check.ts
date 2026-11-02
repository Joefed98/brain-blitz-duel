/**
 * arcade-play-check's desktop pass (31 Oct 2026, the computer layout; docs/desktop-layout.md): every
 * arcade game's live round at 1440×900 and 1920×1080 with a mouse, in its desktop mode (desktopModes.ts),
 * live, error-free, crisp within the pixel-ratio cap of 2, at 60 fps. The pass itself is
 * `bun scripts/arcade-play-check.ts --desktop` (see DESKTOP there); this file runs it as its own check so CI
 * can give it its own jobs, `--part=k/n` passed through, the phone passes and their baselines untouched.
 *
 *   bun scripts/arcade-play-desktop-check.ts [--part=k/n] [game ids…]
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("bun", ["scripts/arcade-play-check.ts", "--desktop", ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
