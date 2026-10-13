/**
 * Replay playback in headless Chromium (docs/replays.md), the replay player's
 * counterpart to arcade-play-check: five stored fixture runs (Wavefront,
 * Gemstone, Orbit, Scrumper, Letterfall by default) open in the replay lab's
 * full-run player at 390 × 700 and play for real. It fails if:
 *  - the replayed run's final score is not the stored score;
 *  - the playback tick doesn't advance at about real time at 1x, or isn't
 *    faster at 2x, or a seek doesn't land where it was asked;
 *  - the average frame time is above 33.4 ms (under 30 fps);
 *  - any page error, or a console error that isn't known environment noise
 *    (blocked network, asset 404s);
 * and, on the results and podium screens with their replay panels playing,
 * if Continue / Play again is not on screen and the topmost element at its
 * centre (so a panel never covers or pushes it away).
 *
 * Needs the pre-installed Chromium (/opt/pw-browsers/chromium or
 * PLAYWRIGHT_CHROMIUM). Starts its own Vite dev server unless --url=<origin>.
 * Not run in CI (no browser on the check shards): run-checks lists it as
 * optional; run it locally after a replay change.
 *
 *   bun scripts/replay-play-check.ts [game ids…] [--url=http://127.0.0.1:5181]
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const URL_ARG = args.find((a) => a.startsWith("--url="))?.slice(6);
const GAMES = args.filter((a) => !a.startsWith("--"));
const PLAY = GAMES.length ? GAMES : ["wavefront", "matchup", "orbit", "snip", "wordfall"];
const CHROMIUM = process.env["PLAYWRIGHT_CHROMIUM"] ?? "/opt/pw-browsers/chromium";
const PORT = 5183;
const NOISE =
  /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|ERR_CONNECTION_REFUSED|status of 404|Failed to load resource/;

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};

if (!existsSync(CHROMIUM)) {
  console.log(`FAIL: no Chromium at ${CHROMIUM} (an environment problem, not a replay result)`);
  process.exit(1);
}

let server: ChildProcess | null = null;
async function origin(): Promise<string> {
  if (URL_ARG) return URL_ARG;
  server = spawn(
    "npx",
    ["vite", "dev", "--port", String(PORT), "--host", "127.0.0.1", "--strictPort"],
    { stdio: "ignore", detached: true },
  );
  const base = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${base}/replay-lab`)).ok) return base;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("dev server did not start");
}

const { chromium } = await import("playwright");
const base = await origin();
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const game of PLAY) {
    const page = await browser.newPage({ viewport: { width: 390, height: 700 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !NOISE.test(m.text()))
        errors.push(`console: ${m.text().slice(0, 200)}`);
    });
    await page.goto(`${base}/replay-lab?view=player&game=${game}`);
    await page
      .waitForFunction(() => window.__replayLab?.ready === true, undefined, { timeout: 90_000 })
      .catch(() => undefined);
    const lab = await page.evaluate(() => window.__replayLab);
    ok(Boolean(lab?.ready), `${game}: the replay never got ready`);
    if (!lab?.ready) {
      failures.push(...errors.map((e) => `${game}: ${e}`));
      await page.close();
      continue;
    }
    ok(
      lab.finalScore === lab.storedScore,
      `${game}: replay ends on ${lab.finalScore}, stored ${lab.storedScore}`,
    );
    // Frame gaps over the 1x stretch.
    await page.evaluate(() => {
      const w = window as unknown as { __gaps: number[] };
      w.__gaps = [];
      let last = performance.now();
      const loop = (now: number) => {
        w.__gaps.push(now - last);
        last = now;
        if (w.__gaps.length < 100_000) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    const t0 = await page.evaluate(() =>
      Number((document.querySelector("[data-replay-seek]") as HTMLInputElement).value),
    );
    await page.waitForTimeout(6000);
    const t1 = await page.evaluate(() =>
      Number((document.querySelector("[data-replay-seek]") as HTMLInputElement).value),
    );
    const end = lab.endTick;
    const rate1 = (t1 - t0) / 6;
    ok(
      t1 >= end || (rate1 > 45 && rate1 < 75),
      `${game}: 1x plays ${rate1.toFixed(0)} ticks a second (60 expected)`,
    );
    const gaps = await page.evaluate(() =>
      (window as unknown as { __gaps: number[] }).__gaps.slice(5),
    );
    const avg = gaps.reduce((s, g) => s + g, 0) / Math.max(1, gaps.length);
    ok(avg <= 33.4, `${game}: average frame ${avg.toFixed(1)} ms (under 30 fps)`);
    // Seek to the middle, then play at 2x.
    const mid = Math.floor(end / 2);
    await page.evaluate((to) => {
      const input = document.querySelector("[data-replay-seek]") as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, String(to));
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }, mid);
    await page.waitForTimeout(300);
    const afterSeek = await page.evaluate(() =>
      Number((document.querySelector("[data-replay-seek]") as HTMLInputElement).value),
    );
    ok(Math.abs(afterSeek - mid) <= 40, `${game}: seek to ${mid} landed on ${afterSeek}`);
    await page.click('[data-replay-speed="2"]');
    const s0 = await page.evaluate(() =>
      Number((document.querySelector("[data-replay-seek]") as HTMLInputElement).value),
    );
    await page.waitForTimeout(2000);
    const s1 = await page.evaluate(() =>
      Number((document.querySelector("[data-replay-seek]") as HTMLInputElement).value),
    );
    const rate2 = (s1 - s0) / 2;
    ok(
      s1 >= end || rate2 > 90,
      `${game}: 2x plays ${rate2.toFixed(0)} ticks a second (120 expected)`,
    );
    failures.push(...errors.map((e) => `${game}: ${e}`));
    console.log(
      `${game.padEnd(10)} score ${lab.finalScore}/${lab.storedScore}  1x ${rate1.toFixed(0)} t/s  2x ${rate2.toFixed(0)} t/s  frame ${avg.toFixed(1)} ms`,
    );
    await page.close();
  }

  // The panels never cover or push away the room's own controls.
  for (const [view, button, size] of [
    ["results&game=wavefront", "Continue", [375, 667]],
    ["results&game=hover&players=10", "Continue", [375, 667]],
    ["timelapse&game=unblock", "Continue", [390, 700]],
    ["podium&game=matchup", "Play again", [390, 700]],
  ] as const) {
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] } });
    await page.goto(`${base}/replay-lab?view=${view}`);
    await page.waitForSelector("[data-replay-panel]", { timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(2500);
    const seen = await page.evaluate((label) => {
      const target = [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.trim().toLowerCase().startsWith(label.toLowerCase()),
      );
      if (!target) return { found: false, inView: false, top: false };
      const r = target.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return {
        found: true,
        inView: r.top >= 0 && r.bottom <= window.innerHeight,
        top: hit === target || target.contains(hit),
      };
    }, button);
    const panel = await page.$("[data-replay-panel]");
    ok(panel !== null, `${view}: no replay panel`);
    ok(
      seen.found && seen.inView && seen.top,
      `${view}: ${button} ${!seen.found ? "missing" : !seen.inView ? "off screen" : "covered"} with the replay panel up`,
    );
    await page.close();
  }
} finally {
  await browser.close();
  if (server) {
    try {
      process.kill(-(server as ChildProcess).pid!, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} replay playback checks`);
  process.exit(1);
}
console.log(
  `Replay playback: ${checks} checks passed — ${PLAY.join(", ")} replay in Chromium to their stored scores at real time, 2x and after a seek, under 33.4 ms a frame; Continue and Play again stay on screen and on top with the panels up`,
);
