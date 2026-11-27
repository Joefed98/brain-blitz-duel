/**
 * The Pattern and Logic levels' square sizes on a phone (D4, 22 Nov 2026; Joe: bigger boards keep cells at 36 px or
 * more on a 375 × 667 phone). A design tool, not a check: opens each asked game at each asked level in practice (a real
 * deal at that level, the player's choice set on the device as the level picker sets it), waits for the live round,
 * measures the board's squares and saves a screenshot.
 *
 *   bun scripts/shots/pattern-logic-cells.ts --url=<origin> [--out=<dir>] [--size=375x667] game:level[,…]
 *
 * The squares are found by shape: the most common near-square box inside the live stage, at least as many of them as
 * the board has squares (`cells` below), so the number is the board's own square, never a guess from a width.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { practiceGameUrl } from "../practice-side-lib";

const args = process.argv.slice(2);
const opt = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const origin = opt("url") ?? "http://127.0.0.1:5191";
const out = opt("out") ?? ".shots/pattern-logic-cells";
const [w, h] = (opt("size") ?? "375x667").split("x").map(Number) as [number, number];
const asked = (args.find((a) => !a.startsWith("--")) ?? "").split(",").filter(Boolean);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env["PLAYWRIGHT_CHROMIUM"] ?? "/opt/pw-browsers/chromium" });
const rows: Record<string, unknown>[] = [];
for (const item of asked) {
  const [game, level = "normal", cells = "0", selector = ""] = item.split(":");
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await context.addInitScript(`try { localStorage.setItem("duelz-levels:v1", JSON.stringify({ catalogue: ${JSON.stringify(level)}, games: {} })); localStorage.setItem("duelz-terms:v1", JSON.stringify({ agreed: true, at: Date.now() })); } catch {}`);
  const page = await context.newPage();
  try {
    await page.goto(practiceGameUrl(origin, game!), { waitUntil: "domcontentloaded", timeout: 120_000 });
    // The intro's Ready, or (if the route shows the game's page first) its Play, which opens the intro counting down.
    const ready = page.getByRole("button", { name: /^ready$/i });
    const play = page.locator(`[data-game-page-play="${game}"]`);
    await Promise.race([ready.waitFor({ timeout: 180_000 }), play.waitFor({ timeout: 180_000 })]).catch(() => undefined);
    if (await play.isVisible().catch(() => false)) await play.click();
    else if (await ready.isVisible().catch(() => false)) await ready.click();
    // Only the live round is measured: a puzzle's play screen (data-puzzle-play) or an arcade stage on its play screen.
    await page.waitForSelector("[data-puzzle-play] [data-game-stage], [data-arcade-play] [data-game-stage]", { timeout: 120_000 });
    await page.waitForTimeout(5_000);
    const want = Number(cells);
    const found = await page.evaluate(({ want, selector }: { want: number; selector: string }) => {
      const stage = document.querySelector("[data-puzzle-play] [data-game-stage], [data-arcade-play] [data-game-stage]");
      if (!stage) return null;
      // A named piece (Hanoi's rings, Safe Cracker's dials): its smallest width and height.
      if (selector) {
        const boxes = Array.from(stage.querySelectorAll(selector)).map((el) => (el as HTMLElement).getBoundingClientRect());
        return { square: boxes.length ? Math.round(Math.min(...boxes.map((r) => r.width)) * 2) / 2 : null, height: boxes.length ? Math.round(Math.min(...boxes.map((r) => r.height)) * 2) / 2 : null, count: boxes.length, scroll: document.scrollingElement!.scrollHeight - innerHeight };
      }
      // Trail's squares are drawn up to a third taller than wide: its own cells, by their width.
      const trail = Array.from(stage.querySelectorAll("[data-trail-cell]")).map((el) => (el as HTMLElement).getBoundingClientRect());
      if (trail.length) return { square: Math.round(Math.min(...trail.map((r) => r.width)) * 2) / 2, count: trail.length, scroll: document.scrollingElement!.scrollHeight - innerHeight };
      const sizes = new Map<number, number>();
      for (const el of Array.from(stage.querySelectorAll("*"))) {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.width < 12 || r.width > 140 || Math.abs(r.width - r.height) > Math.max(2, r.width * 0.15)) continue;
        const k = Math.round(r.width * 2) / 2;
        sizes.set(k, (sizes.get(k) ?? 0) + 1);
      }
      const ok = [...sizes.entries()].filter(([, n]) => n >= Math.max(4, want * 0.9)).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
      return { square: ok[0]?.[0] ?? null, count: ok[0]?.[1] ?? 0, scroll: document.scrollingElement!.scrollHeight - innerHeight };
    }, { want, selector });
    const shot = `${out}/${game}-${level}-${w}x${h}.png`;
    await page.screenshot({ path: shot });
    rows.push({ game, level, size: `${w}x${h}`, ...found, shot });
    console.log(`${game.padEnd(11)} ${level.padEnd(7)} square ${found?.square ?? "?"} px${(found as { height?: number } | null)?.height ? ` × ${(found as { height?: number }).height} px` : ""} (${found?.count ?? 0} of them)  page scroll ${found?.scroll ?? "?"} px  ${shot}`);
  } catch (e) {
    console.log(`${game} ${level}: ${String(e).split("\n")[0]}`);
  } finally {
    await context.close();
  }
}
await browser.close();
writeFileSync(`${out}/report-${w}x${h}.json`, JSON.stringify(rows, null, 2) + "\n");
