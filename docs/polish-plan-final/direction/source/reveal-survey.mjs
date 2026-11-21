// Measures an answer reveal in a real browser: how much of the stage's content is hidden, per game and phone size.
// Written on 21 Nov 2026 for the reveal template's handover to P2 (docs/polish-plan-final.md, section 2.1).
//   1. start a dev server:   npx vite dev --port 5193 --host 127.0.0.1 --strictPort
//   2. node docs/polish-plan-final/direction/source/reveal-survey.mjs swing orbit minigolf ...   (game ids)
// Each game is opened in practice, left untouched until the clock runs out, and its reveal is measured at 375 x 667
// and 390 x 844. One JSON line a game and size goes to SURVEY_OUT/survey.jsonl (default: a folder in the system temp
// directory, never the repository) with a screenshot beside it. "stageOverflowPx" is the height hidden below the
// stage box; "cut" names the pieces that run past it. SURVEY_ORIGIN changes the server address.
import { createRequire } from "node:module";
import { appendFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const origin = process.env.SURVEY_ORIGIN ?? "http://127.0.0.1:5193";
const games = process.argv.slice(2);
const sizes = [[375, 667], [390, 844]];
const REVEAL = "[data-reveal-score], [data-arcade-reveal]";
const OUT = join(process.env.SURVEY_OUT ?? join(tmpdir(), "reveal-survey"), "/");
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const game of games) for (const [w, h] of sizes) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message ?? e).split("\n")[0]));
  let out = null, fail = null;
  try {
    await page.clock.install();
    await page.goto(`${origin}/practice?game=${game}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /^Ready/ }).first().waitFor({ timeout: 90_000 });
    await page.getByRole("button", { name: /^Ready/ }).first().click();
    await page.locator("[data-game-stage]").first().waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1200);
    await page.clock.fastForward(200_000);
    for (let i = 0; i < 400 && !(await page.locator(REVEAL).count()); i++) await page.clock.runFor(500);
    await page.locator(REVEAL).first().waitFor({ timeout: 60_000 });
    await page.clock.runFor(2500);
    await page.waitForTimeout(1200);
    out = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const R = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), width: Math.round(b.width), height: Math.round(b.height) }; };
      const stage = q('[data-reveal-slot="stage"]');
      const sr = stage?.getBoundingClientRect();
      const name = (el) => [...el.attributes].filter((a) => a.name.startsWith("data-") && a.name !== "data-tsd-source").map((a) => a.name).join(" ") || el.tagName.toLowerCase() + "." + String(el.className?.baseVal ?? el.className ?? "").split(" ").slice(0, 2).join(".");
      let deepest = sr ? sr.top : 0; const cut = [];
      if (stage) for (const el of stage.querySelectorAll("*")) {
        if (el.closest("[hidden]")) continue;
        const scroller = el.parentElement?.closest(".answer-reveal-content");
        if (scroller) continue; // inside the puzzle card's own scroller: reachable by scrolling
        const b = el.getBoundingClientRect();
        if (b.width < 1 || b.height < 1) continue;
        if (b.bottom > deepest) deepest = b.bottom;
      }
      const pic = q("[data-reveal-picture]");
      if (pic && sr) for (const el of pic.querySelectorAll(":scope > *, :scope > * > *")) {
        const b = el.getBoundingClientRect();
        if (b.width < 1 || b.height < 1) continue;
        if (b.bottom > sr.bottom + 1) cut.push(`${name(el)} ${Math.round(b.top)}-${Math.round(b.bottom)}`);
      }
      const content = q(".answer-reveal-content");
      const col = q("[data-reveal-screen-template]");
      const bd = q('[data-reveal-slot="breakdown"]');
      const actions = q("[data-practice-reveal-actions]");
      return {
        template: col?.getAttribute("data-reveal-screen-template") ?? null,
        stage: R(stage), score: R(q('[data-reveal-slot="score"]')), column: R(col), actions: R(actions),
        stageOverflowPx: sr ? Math.round(deepest - sr.bottom) : null, cut: cut.slice(0, 8),
        content: content ? { ...R(content), scrollH: content.scrollHeight, clientH: content.clientHeight, inner: R(content.querySelector(":scope > :not([data-reveal-tray])")) } : null,
        columnScroll: col ? [col.scrollHeight, col.clientHeight] : null,
        breakdown: bd ? { ...R(bd), scrollH: bd.scrollHeight, clientH: bd.clientHeight } : null,
        actionsOnScreen: actions ? actions.getBoundingClientRect().bottom <= innerHeight + 0.5 : null,
        page: [document.scrollingElement.scrollWidth, document.scrollingElement.scrollHeight, innerWidth, innerHeight],
      };
    });
    await page.screenshot({ path: `${OUT}${game}-${w}x${h}.png` });
  } catch (e) { fail = String(e.message ?? e).split("\n")[0]; }
  appendFileSync(`${OUT}survey.jsonl`, JSON.stringify({ game, size: [w, h], fail, errors, ...out }) + "\n");
  await context.close();
}
await browser.close();
console.log(`wrote ${OUT}survey.jsonl`);
