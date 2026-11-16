import { startSafeAreaServer } from "./safe-area-server";
import { chromium } from "playwright";
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-number-demos", buildId: "nd" });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const game of ["balance", "numline", "numpyramid"]) {
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const harness = { puzzles: {}, verdict: { isCorrect: true, score: 200 }, latencyMs: 0, submissions: [], verdictAt: null, room: null, search: { game }, demos: {} };
await ctx.addInitScript((h) => { (window as any).__harness = JSON.parse(h); }, JSON.stringify(harness));
const p = await ctx.newPage();
await p.goto(`${server.origin}/safe-area.html?mode=practice`, { timeout: 180000 });
await p.locator("[data-intro-stage]").first().waitFor({ timeout: 120000 }).catch(() => undefined);
await p.waitForTimeout(1500);
console.log(game, await p.evaluate(() => { const r = document.querySelector("[data-intro-stage]")?.getBoundingClientRect(); return r ? [r.width, r.height] : null; }));
await ctx.close();
}
await b.close(); await server.close();
