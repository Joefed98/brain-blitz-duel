import { chromium } from "playwright";
const OUT = process.argv[2]!;
const origin = "http://127.0.0.1:5190";
const games = ["balance", "target", "equation", "numpyramid", "measure", "checkout", "numline", "kakuro"];
const levels = ["easy", "normal", "hard", "expert"];
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const sizes: string[] = [];
async function shot(game: string, level: string, w: number, h: number, file: string | null) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript((l) => { try { localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: l, games: {} })); } catch {} }, level);
  const page = await ctx.newPage();
  await page.routeWebSocket(() => true, () => undefined);
  try {
    await page.goto(`${origin}/practice?game=${game}`, { waitUntil: "domcontentloaded" });
    const start = page.getByRole("button", { name: /^(Ready|Play)$/ }).first();
    await start.waitFor({ timeout: 240_000 });
    await page.waitForTimeout(1200);
    await start.click();
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 60_000 });
    await page.waitForTimeout(4500);
    if (file) await page.screenshot({ path: file });
    else {
      const sel = game === "kakuro" ? "[data-kakuro-cell]" : "[data-np-cell]";
      const r = await page.evaluate((s) => { const els = [...document.querySelectorAll(s)].map((e) => e.getBoundingClientRect()).filter((b) => b.width > 0); return els.length ? { n: els.length, w: Math.min(...els.map((b) => b.width)), h: Math.min(...els.map((b) => b.height)) } : null; }, sel);
      sizes.push(`${game} expert ${w}x${h}: ${JSON.stringify(r)}`);
    }
    console.log("ok", game, level, w, h);
  } catch (e) { console.log("FAIL", game, level, (e as Error).message.split("\n")[0]); }
  await ctx.close();
}
const only = process.argv[3]?.split(",");
for (const g of games) for (const l of levels) if (!only || only.includes(g)) await shot(g, l, 390, 844, `${OUT}/${g}-${l}.png`);
for (const g of ["kakuro", "numpyramid"]) if (!only || only.includes(g)) await shot(g, "expert", 375, 667, null);
console.log(sizes.join("\n"));
await browser.close();
