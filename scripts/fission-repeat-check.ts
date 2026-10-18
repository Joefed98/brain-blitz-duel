/**
 * fission-repeat-check (18 Oct 2026, display only): Fission played four times in a row in practice
 * (Play again each time) as an iPhone 11 home-screen app (414×896, 48/34 px insets, laid out 848 px
 * short) keeps its arrow buttons exactly where they were on the first run, ending 16 px above the
 * screen's bottom, with nothing clipping them.
 *
 * Joe saw the arrows shift down and get cut off after a few runs. Nothing builds up between runs
 * (the root style, the scene canvas and the game locks are cleaned up each time); the cause was
 * the 48 px shortfall, measured once per screen size, staying on a layout viewport WebKit had since
 * grown to the whole screen, which put the play screen at 944 px and the arrows 48 px lower. The
 * play screen is now capped at the screen (PhoneShell, polish-layout/bottom.css), so on the third
 * run the layout viewport grows to 896 mid-run and shrinks back, and the arrows must not move.
 * Every arcade game shares that path; arcade-room-practice-check proves the same for all of them,
 * in practice and in rooms.
 *
 *   bun scripts/fission-repeat-check.ts
 */
import { chromium } from "playwright";

import { startSafeAreaServer } from "./safe-area-server";
import { harnessPage, judge, layoutViewport, measure, puzzleFor, sameBoxes, startPractice, type Geometry } from "./arcade-viewport-lib";

const RUNS = 4;
const failures: string[] = [];
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-fission-repeat", buildId: "fission-repeat" });
const browser = await chromium.launch({ executablePath: process.env["CHROMIUM_PATH"] ?? "/opt/pw-browsers/chromium" });
const page = await harnessPage(browser, server.origin, "practice", "burst", puzzleFor("burst"));
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(error.message.split("\n")[0]!));

const arrows = (g: Geometry) => g.boxes.filter((b) => /^Move (left|right) /.test(b));
let first: string[] | null = null;
const lines: string[] = [];
const look = (run: number, label: string, g: Geometry) => {
  for (const problem of judge(g)) failures.push(`run ${run}, ${label}: ${problem}`);
  const now = arrows(g);
  if (now.length !== 2) failures.push(`run ${run}, ${label}: ${now.length} arrow buttons, want 2`);
  if (!first) first = now;
  else if (!sameBoxes(first, now)) failures.push(`run ${run}, ${label}: the arrows moved (${first.join(" | ")} → ${now.join(" | ")})`);
  lines.push(`run ${run}, ${label}: ${now.join(" | ")}`);
};

try {
  for (let run = 1; run <= RUNS; run++) {
    await startPractice(page, "burst", run > 1);
    await page.clock.runFor(1500);
    await page.waitForTimeout(300);
    look(run, "live", await measure(page));
    if (run === 3) {
      // WebKit lays the app out the whole screen mid-run, then short again.
      await layoutViewport(page, 896);
      look(run, "layout grown to the screen", await measure(page));
      await layoutViewport(page, 848);
      look(run, "short again", await measure(page));
    }
    // Run the round out (no input): the run ends, then the reveal with Play again.
    const again = page.getByRole("button", { name: "Play again" });
    for (let s = 0; s < 150 && !(await again.count()); s++) await page.clock.runFor(1000);
    if (!(await again.count())) {
      failures.push(`run ${run}: no Play again after the round`);
      break;
    }
    const left = await page.evaluate(() => ({
      short: document.documentElement.style.getPropertyValue("--standalone-short"),
      screen: document.documentElement.style.getPropertyValue("--standalone-screen"),
      locks: document.documentElement.dataset["gameLocks"] ?? "0",
      scenes: document.querySelectorAll("[data-arena-scene]").length,
    }));
    if (left.short || left.screen || left.locks !== "0" || left.scenes)
      failures.push(`run ${run}: the play screen left state behind (${JSON.stringify(left)})`);
  }
} catch (error) {
  failures.push(`stopped: ${(error as Error).message.split("\n")[0]}`);
}
if (errors.length) failures.push(`page error: ${errors[0]}`);

await browser.close();
await server.close();
for (const line of lines) console.log(line);
if (failures.length) {
  console.log(`FAIL: ${failures.length} problems`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log(`PASS: Fission's arrows stayed put over ${RUNS} runs in a row (and a mid-run layout change), 16px above the screen's bottom`);
process.exit(0);
