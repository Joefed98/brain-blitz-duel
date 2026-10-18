/**
 * arcade-room-practice-check (18 Oct 2026, display only): in a room, every arcade play screen is
 * laid out exactly as in practice, as an iPhone 11 home-screen app (414×896, 48/34 px insets, laid
 * out 848 px short, navigator.standalone).
 *
 * Joe saw Rainbow Bridge's and Mixed Signals' bottom buttons cut off in rooms, fine in practice.
 * The shared cause: the play screen grew by a 48 px shortfall measured once per screen size, so
 * whenever WebKit laid the app out differently after that measurement (taller after the keyboard
 * a room's name and chat fields raise, after a few rounds, or once its bug is fixed) the play
 * screen, html and body went 48 px past the screen's bottom and its lowest row was cut. The
 * play screen is now min(100dvh + inset, screen) and html min(100% + inset, screen)
 * (PhoneShell's --standalone-short / --standalone-screen, polish-layout/bottom.css), which no
 * layout change can push past the screen.
 *
 * For each of the active arcade play-screen games (the 22 arcade games and Letterfall, Tenfall,
 * Bonk, Pull!, Mixed Signals), practice (list → Ready) and a room (round intro with its chat bar →
 * the server moves the round live) are drawn through the real routes (safe-area-harness.tsx), and
 * measured three times: as laid out (848), with the layout viewport grown to the whole screen
 * (896) and back to 848. Each time html, body and the play screen must be 896 px, the column and
 * the lowest control must end 16 px above the bottom, nothing may clip above that, and the room's
 * arena slot, world and every control under it must sit exactly where practice has them.
 *
 *   bun scripts/arcade-room-practice-check.ts [game ids…] [--part=k/n]
 */
import { chromium } from "playwright";

import { freezeClock } from "./browser-load";
import { startSafeAreaServer } from "./safe-area-server";
import { chromiumPath, harnessPage, judge, layoutViewport, measure, puzzleFor, sameBoxes, startPractice, startRoom, type Geometry } from "./arcade-viewport-lib";
import { ACTIVE_PUZZLE_TYPES, puzzleDef } from "../src/lib/duel/registry";

const args = process.argv.slice(2);
const part = /^--part=(\d+)\/(\d+)$/.exec(args.find((a) => a.startsWith("--part=")) ?? "");
const named = args.filter((a) => !a.startsWith("--"));
const ALL = (ACTIVE_PUZZLE_TYPES as string[]).filter((type) => {
  const def = puzzleDef(type as never);
  return def.category === "arcade" || !!(def as { arcadeRun?: unknown }).arcadeRun;
});
let games = named.length ? ALL.filter((g) => named.includes(g)) : ALL;
if (part) {
  const [k, n] = [Number(part[1]), Number(part[2])];
  games = games.filter((_, i) => i % n === k - 1);
}

const STATES = [
  ["as laid out (848)", 848],
  ["layout grown to the screen (896)", 896],
  ["short again (848)", 848],
] as const;

const failures: string[] = [];
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-arcade-room-practice", buildId: "arcade-room-practice" });
const browser = await chromium.launch({ executablePath: chromiumPath() });
let measured = 0;

async function run(type: string, mode: "practice" | "room"): Promise<Geometry[] | null> {
  const puzzle = puzzleFor(type);
  const page = await harnessPage(browser, server.origin, mode, type, puzzle);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message.split("\n")[0]!));
  try {
    if (mode === "practice") await startPractice(page, type);
    else await startRoom(page);
    // Frozen as soon as the round is live: the layout is judged, not the run.
    await freezeClock(page);
    await page.clock.runFor(200);
    await page.waitForTimeout(300);
    const out: Geometry[] = [];
    for (const [label, height] of STATES) {
      if (out.length) await layoutViewport(page, height);
      const g = await measure(page);
      measured++;
      for (const problem of judge(g)) failures.push(`${type} ${mode}, ${label}: ${problem}`);
      out.push(g);
    }
    if (errors.length) failures.push(`${type} ${mode}: page error ${errors[0]}`);
    return out;
  } catch (error) {
    failures.push(`${type} ${mode}: ${(error as Error).message.split("\n")[0]}`);
    return null;
  } finally {
    await page.context().close();
  }
}

// Warm the cold dev server once, unmeasured.
await run(games[0] ?? "burst", "practice").catch(() => null);
failures.length = 0;
measured = 0;

const lines: string[] = [];
const queue = [...games];
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let type = queue.shift(); type; type = queue.shift()) {
      const practice = await run(type, "practice");
      const room = await run(type, "room");
      if (!practice || !room) continue;
      STATES.forEach(([label], i) => {
        if (!sameBoxes(practice[i]!.boxes, room[i]!.boxes))
          failures.push(`${type}, ${label}: the room differs from practice\n      practice ${practice[i]!.boxes.join(" | ")}\n      room     ${room[i]!.boxes.join(" | ")}`);
      });
      lines.push(`${type}: ${practice[0]!.lowest === null ? "no controls under the arena" : `lowest control ends at ${practice[0]!.lowest}`}, room = practice`);
    }
  }),
);

await browser.close();
await server.close();
for (const line of lines.sort()) console.log(line);
console.log(`${games.length} games × practice and room × ${STATES.length} layouts: ${measured} play screens measured as an iPhone 11 home-screen app`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} problems`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log("PASS: every arcade play screen sits exactly as in practice, its controls 16px above the screen's bottom");
process.exit(0);
