import { readFixture } from "./number-demos-record";
import { startSafeAreaServer } from "./safe-area-server";
import { chromium } from "playwright";
const game = process.argv[2]!;
const d = readFixture()[game]!;
const server = await startSafeAreaServer({ cacheDir: "node_modules/.vite-number-demos", buildId: "nd" });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b.newContext({ viewport: { width: 420, height: 800 } });
await ctx.addInitScript(() => { (window as any).__harness = { puzzles: {}, verdict: { isCorrect: true, score: 0 }, latencyMs: 0, submissions: [], verdictAt: null, room: null }; });
const p = await ctx.newPage();
p.on("pageerror", (e) => console.log("ERR", e.message));
await p.goto(`${server.origin}/safe-area.html?mode=home`, { timeout: 180000 });
await p.waitForSelector("#root *", { timeout: 180000 });
await p.evaluate(async ({ puzzle, log }) => { const m = await import("/scripts/shots/demo-mount.tsx" as string); m.mountDemo(puzzle, log, 390); }, { puzzle: d.puzzle, log: d.log });
for (const t of [3000, 8000, 14000]) { await p.waitForTimeout(t === 3000 ? 3000 : 5500); await p.screenshot({ path: `/tmp/nd-view-${game}-${t}.png` }); }
await b.close(); await server.close();
