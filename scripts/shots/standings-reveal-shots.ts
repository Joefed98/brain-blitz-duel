/**
 * Review frames for the broadcast reveal (7 Nov 2026): the standings of a 10-player room after a round that
 * reshuffles the order, and the 10-player podium, at 390×844 (DPR 2), each recorded from the screen's first
 * frame through Chromium's screencast. Writes a frame every ~150 ms (`<screen>-NNNNms.png`), a contact sheet
 * and an MP4 of each (ffmpeg, when installed). A design tool, not a check. Drawn through the safe-area
 * harness (the real routes, network stubbed) on the fixed clock.
 *
 *   bun scripts/shots/standings-reveal-shots.ts [--out=screenshots/standings-reveal-nov-2026]
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

import { startSafeAreaServer } from "../safe-area-server";
import { CHROMIUM_PATHS, fixThemeClock, openThemeScreen, room, type ThemeScreen, type ThemeViewport } from "../theme-screens";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "screenshots/standings-reveal-nov-2026";
mkdirSync(out, { recursive: true });
const VIEWPORT: ThemeViewport = { name: "390x844", w: 390, h: 844, scale: 2 };
const RECORD_MS = 3600;
const STEP_MS = 150;

const standings10 = () => {
  const r = room("in_progress", "standings", { players: 10, rounds: 2 })();
  r.results = r.results.map((row) => (row.round_number === 2 ? { ...row, score: 40 + row.player_slot * 14 } : row));
  return r;
};
const SCREENS: { key: string; screen: ThemeScreen; ready: string }[] = [
  { key: "standings-10", screen: { name: "standings, 10 players", mode: "room", room: standings10, waitMs: 0 }, ready: "ul li .th-name" },
  { key: "podium-10", screen: { name: "podium, 10 players", mode: "room", room: room("finished", "result", { players: 10, rounds: 6 }), waitMs: 0 }, ready: "[data-podium-place]" },
];

const hasFfmpeg = (() => {
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-standings-reveal", buildId: "standings-reveal-shots" });
fixThemeClock();
const { chromium } = await import("playwright");
const browser = await chromium.launch({ executablePath: CHROMIUM_PATHS.find((p) => p && existsSync(p)) });
try {
  for (const { key, screen, ready } of SCREENS) {
    // Record from the page's first load (the harness's room state is set for that open): the screencast starts
    // as the page is created and the page notes, on the real clock, when the screen first shows.
    const frames: { t: number; data: string }[] = [];
    let stop: (() => Promise<void>) | null = null;
    const { context, page } = await openThemeScreen(browser, server.origin, screen, VIEWPORT, async (ctx) => {
      await ctx.addInitScript((sel) => {
        const note = () => {
          if ((window as unknown as { __shownAt?: number }).__shownAt) return;
          if (document.querySelector(sel)) (window as unknown as { __shownAt: number }).__shownAt = performance.timeOrigin + performance.now();
          else requestAnimationFrame(note);
        };
        requestAnimationFrame(note);
      }, ready);
      ctx.on("page", (p) => {
        void (async () => {
          const cdp = await ctx.newCDPSession(p);
          cdp.on("Page.screencastFrame", (frame: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
            frames.push({ t: (frame.metadata.timestamp ?? (performance.timeOrigin + performance.now()) / 1000) * 1000, data: frame.data });
            void cdp.send("Page.screencastFrameAck", { sessionId: frame.sessionId }).catch(() => {});
          });
          await cdp.send("Page.startScreencast", { format: "png", maxWidth: VIEWPORT.w * 2, maxHeight: VIEWPORT.h * 2, everyNthFrame: 1 });
          stop = async () => void (await cdp.send("Page.stopScreencast").catch(() => {}));
        })();
      });
    });
    const shownAt = await page.evaluate(() => (window as unknown as { __shownAt?: number }).__shownAt ?? 0);
    const left = Math.max(0, shownAt + RECORD_MS - (performance.timeOrigin + performance.now()));
    await page.waitForTimeout(Math.min(RECORD_MS, left + 200));
    await (stop as (() => Promise<void>) | null)?.();
    await context.close();
    const t0 = shownAt || frames[0]!.t;
    const kept = frames.filter((f) => f.t >= t0 - 50);
    frames.length = 0;
    frames.push(...kept);
    if (!frames.length) throw new Error(`${key}: no frames`);
    const dir = `${out}/${key}`;
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    // Every frame for the video (each held until the next), one every STEP_MS for the stills.
    const raw = `${out}/.raw-${key}`;
    rmSync(raw, { recursive: true, force: true });
    mkdirSync(raw, { recursive: true });
    const list: string[] = [];
    frames.forEach((frame, i) => {
      const file = `${raw}/${String(i).padStart(4, "0")}.png`;
      writeFileSync(file, Buffer.from(frame.data, "base64"));
      const next = frames[i + 1]?.t ?? frame.t + 100;
      list.push(`file '${file.split("/").pop()}'`, `duration ${Math.max(0.001, (next - frame.t) / 1000).toFixed(3)}`);
    });
    let at = 0;
    const stills: string[] = [];
    for (let target = 0; target <= RECORD_MS; target += STEP_MS) {
      while (at + 1 < frames.length && frames[at + 1]!.t - t0 <= target) at++;
      const file = `${dir}/${key}-${String(target).padStart(4, "0")}ms.png`;
      writeFileSync(file, Buffer.from(frames[at]!.data, "base64"));
      stills.push(file);
    }
    console.log(`${key}: ${frames.length} frames, ${stills.length} stills in ${dir}`);
    if (hasFfmpeg) {
      writeFileSync(`${raw}/list.txt`, list.join("\n") + "\n");
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${raw}/list.txt`, "-vf", "fps=30,scale=390:-2,format=yuv420p", "-c:v", "libx264", "-crf", "26", `${out}/${key}.mp4`]);
      // A contact sheet: every other still, six across, at half size.
      const picks = stills.filter((_, i) => i % 2 === 0);
      const args = picks.flatMap((file) => ["-i", file]);
      const cols = 6;
      const rows = Math.ceil(picks.length / cols);
      const layout = picks.map((_, i) => `${(i % cols) * 390}_${Math.floor(i / cols) * 844}`).join("|");
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args, "-filter_complex", `${picks.map((_, i) => `[${i}:v]scale=390:844[s${i}]`).join(";")};${picks.map((_, i) => `[s${i}]`).join("")}xstack=inputs=${picks.length}:layout=${layout}:fill=black[v]`, "-map", "[v]", "-frames:v", "1", `${out}/${key}-sheet.png`]);
      console.log(`${out}/${key}.mp4, ${out}/${key}-sheet.png (${rows} rows)`);
    }
    rmSync(raw, { recursive: true, force: true });
  }
} finally {
  await browser.close();
  await server.close();
}
