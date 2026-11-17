/**
 * The Attention overhaul's effect clips (stage 2; docs/design/pages-review/attention/GALLERY.md): each game's key
 * moments played on practice at 390 × 844, captured by Chrome's screencast (frames with their times) and encoded with the
 * system ffmpeg as H.264 MP4. A tool, not a check. Needs a dev server:  bun scripts/attention-art/effect-clips.ts --url=http://127.0.0.1:5317 --out=<dir> [games…]
 */
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium, type Page } from "playwright";

const opt = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const url = opt("url") ?? "http://127.0.0.1:5317";
const out = opt("out") ?? "/tmp/attention-clips";
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
mkdirSync(out, { recursive: true });
const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const wait = (p: Page, ms: number) => p.waitForTimeout(ms);

/** Eagles facing the target, read off the drawn grid (the sprite names its facing). */
async function eagleMatches(p: Page): Promise<number[]> {
  return p.evaluate(() => {
    const target = document.querySelector(".eye-target [data-eye-dir]")?.getAttribute("data-eye-dir");
    return Array.from(document.querySelectorAll(".eye-grid .eye-cell")).flatMap((cell, i) => (cell.querySelector("[data-eye-dir]")?.getAttribute("data-eye-dir") === target ? [i] : []));
  });
}

const PLAY: Record<string, (p: Page) => Promise<void>> = {
  symscan: async (p) => {
    const hits = await eagleMatches(p);
    for (const i of hits) {
      await p.locator(".eye-cell").nth(i).click();
      await wait(p, 260);
    }
    await wait(p, 500);
    await p.getByRole("button", { name: /submit/i }).click();
    await wait(p, 1600);
  },
  spotdiff: async (p) => {
    for (const i of [3, 4, 20, 21]) {
      await p.locator("[data-dt-panel] rect[role=button]").nth(i).click({ force: true });
      await wait(p, 450);
    }
    await p.getByRole("button", { name: /next picture/i }).click().catch(() => undefined);
    await wait(p, 1200);
  },
  countup: async (p) => {
    for (const i of [0, 3, 7, 12]) {
      await p.locator("[data-tally-shape]").nth(i).click();
      await wait(p, 300);
    }
    for (const k of ["1", "2"]) {
      await p.getByRole("button", { name: k, exact: true }).first().dispatchEvent("pointerdown");
      await wait(p, 200);
    }
    await p.getByRole("button", { name: /enter/i }).first().dispatchEvent("pointerdown");
    await wait(p, 1200);
  },
  maze: async (p) => {
    for (let i = 0; i < 10; i++) {
      await p.keyboard.press(i % 2 ? "ArrowDown" : "ArrowRight");
      await wait(p, 180);
    }
    for (let i = 0; i < 3; i++) {
      await p.keyboard.press("ArrowUp");
      await wait(p, 220);
    }
    await wait(p, 600);
  },
  bomb: async (p) => {
    for (const r of [2, 4]) {
      await p.locator(`[data-bomb-wire-row='${r}']`).click();
      await wait(p, 500);
    }
    await p.getByRole("button", { name: /^Button A,/ }).click();
    await wait(p, 900);
  },
  pairmatch: async (p) => {
    const cards = p.locator("[data-pair-card]");
    const keys = await p.evaluate(() => (window as unknown as { __pairKeys?: string[] }).__pairKeys ?? null);
    void keys;
    for (const [a, b] of [[0, 1], [2, 3], [4, 9], [5, 6]]) {
      await cards.nth(a!).dispatchEvent("pointerdown");
      await wait(p, 300);
      await cards.nth(b!).dispatchEvent("pointerdown");
      await wait(p, 900);
    }
  },
};

for (const game of Object.keys(PLAY).filter((g) => only.length === 0 || only.includes(g))) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("duelz-terms:v1", JSON.stringify({ at: Date.now() }));
    } catch {
      /* fine */
    }
  });
  const page = await ctx.newPage();
  const frames: { file: string; t: number }[] = [];
  const dir = `${out}/${game}-frames`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  try {
    await page.goto(`${url}/practice?game=${game}`, { waitUntil: "networkidle", timeout: 120_000 });
    await wait(page, 1200);
    await page.getByRole("button", { name: /ready/i }).first().click();
    await wait(page, 4300);
    const cdp = await ctx.newCDPSession(page);
    cdp.on("Page.screencastFrame", (f: { data: string; sessionId: number; metadata: { timestamp: number } }) => {
      const file = `${dir}/${String(frames.length).padStart(4, "0")}.jpg`;
      writeFileSync(file, Buffer.from(f.data, "base64"));
      frames.push({ file, t: f.metadata.timestamp });
      void cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => undefined);
    });
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 80, everyNthFrame: 1 });
    await wait(page, 300);
    await PLAY[game]!(page);
    await cdp.send("Page.stopScreencast");
  } catch (e) {
    console.log("FAILED", game, String(e).split("\n")[0]);
  }
  await ctx.close();
  if (frames.length > 2) {
    // ffmpeg's concat list: each frame held until the next one's time.
    const lines = frames.map((f, i) => `file '${f.file}'\nduration ${Math.max(0.001, ((frames[i + 1]?.t ?? f.t + 0.04) - f.t)).toFixed(4)}`);
    writeFileSync(`${dir}/list.txt`, `${lines.join("\n")}\nfile '${frames.at(-1)!.file}'\n`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", `${dir}/list.txt`, "-vf", "fps=30,scale=390:-2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "30", "-movflags", "+faststart", `${out}/${game}.mp4`]);
    rmSync(dir, { recursive: true, force: true });
    console.log("saved", game, frames.length, "frames");
  }
}
await browser.close();
