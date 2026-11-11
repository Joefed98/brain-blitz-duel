/**
 * practice-challenge-fit-check (wave 2 C1b; Joe's condition on the 64-character goals, 11 Nov 2026): every challenge's
 * goal fits the narrowest supported phone without truncation.
 *
 * Headless Chromium draws one Practice challenge row per challenge (all 261, longest first) with the app's own
 * stylesheets (tokens, components, app pages, practice goals) and its Archivo font, in a page column as wide as a
 * 320 px and a 375 px phone's (16 px gutters, as the tab pages), and fails unless every goal is shown whole: no
 * horizontal overflow, no ellipsis or clipping, at most three lines, and the row's reward never overlaps it. The
 * Profile's rows use the same classes. ~10 s.
 *
 *   bun scripts/practice-challenge-fit-check.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { chromium } from "playwright";

import { PRACTICE_CHALLENGES } from "../src/lib/duel/practiceChallenges";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

const css = ["src/design/tokens.css", "src/design/components.css", "src/polish-layout/app-pages.css", "src/polish-layout/practice-goals.css"]
  .map((f) => readFileSync(f, "utf8"))
  .join("\n")
  ;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const sorted = [...PRACTICE_CHALLENGES].sort((a, b) => b.text.length - a.text.length);
const longest = sorted[0]!;
check(longest.text.length <= 64, `the longest goal is ${longest.text.length} characters: "${longest.text}"`);
const rows = sorted
  .map(
    (c) => `<div class="jz-row pc-row" data-id="${c.id}">
  <span style="width:44px;height:44px;flex:none;border-radius:10px;background:#222"></span>
  <span class="pc-body"><span class="pc-name">Integer Pyramid · ${esc(c.name)}</span><span class="pc-goal">${esc(c.text)}</span>
  <span class="pc-bar"><span class="pc-progress" style="height:6px;background:#333"></span><span class="pc-figure">999 / 999</span></span></span>
  <span class="pc-reward">${c.coins ? `<span style="width:14px;height:14px;display:inline-block;background:#E2C07A;border-radius:50%"></span>+${c.coins}` : `<span class="pc-icon"></span>Badge`}</span>
</div>`,
  )
  .join("\n");
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${css}
*,*::before,*::after{box-sizing:border-box} /* Tailwind's preflight, as in the app */
html,body{margin:0;background:var(--jz-bg);color:var(--jz-text);font-family:"Archivo",sans-serif}
.col{box-sizing:border-box;padding:0 16px}</style></head>
<body><div class="col"><section class="ap-section"><div class="jz-panel">${rows}</div></section></div></body></html>`;

const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
try {
  for (const width of [320, 375]) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
    // Served from an http origin (the font is fetched as the app fetches it, from /fonts).
    await page.route("http://joulz.test/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/fonts/")) return route.fulfill({ body: readFileSync(resolve("public", url.pathname.slice(1))), contentType: "font/woff2" });
      return route.fulfill({ body: html, contentType: "text/html" });
    });
    await page.goto("http://joulz.test/", { waitUntil: "load" });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    const font = await page.evaluate(() => document.fonts.check('15px "Archivo"') && [...document.fonts].some((f) => f.family.replace(/"/g, "") === "Archivo" && f.status === "loaded"));
    check(font, `${width} px: the Archivo font is loaded (the goals measured in the app's own face)`);
    const report = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>(".pc-row")].map((row) => {
        const goal = row.querySelector<HTMLElement>(".pc-goal")!;
        const reward = row.querySelector<HTMLElement>(".pc-reward")!;
        const g = goal.getBoundingClientRect();
        const r = reward.getBoundingClientRect();
        const cs = getComputedStyle(goal);
        const lineH = parseFloat(cs.lineHeight);
        return {
          id: row.dataset["id"]!,
          overflow: goal.scrollWidth > goal.clientWidth + 0.5,
          clipped: cs.textOverflow === "ellipsis" || cs.whiteSpace === "nowrap" || cs.overflow === "hidden",
          lines: Math.round(g.height / lineH),
          overlaps: g.right > r.left + 0.5 && g.bottom > r.top && g.top < r.bottom,
          pageOverflow: document.documentElement.scrollWidth > window.innerWidth,
          wide: [...row.querySelectorAll<HTMLElement>("*")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 0.5).map((e) => e.className).join(" "),
        };
      }),
    );
    check(report.length === PRACTICE_CHALLENGES.length, `${width} px: ${report.length} rows drawn`);
    for (const r of report) {
      check(!r.overflow && !r.clipped, `${width} px: ${r.id}'s goal is shown whole (no overflow, ellipsis or clipping)`);
      check(r.lines >= 1 && r.lines <= 3, `${width} px: ${r.id}'s goal takes ${r.lines} line(s), at most 3`);
      check(!r.overlaps, `${width} px: ${r.id}'s reward doesn't overlap its goal`);
    }
    check(!report.some((r) => r.pageOverflow), `${width} px: no horizontal page scroll${report.find((r) => r.wide) ? ` (${report.find((r) => r.wide)!.id}: ${report.find((r) => r.wide)!.wide})` : ""}`);
    const worst = report.find((r) => r.id === longest.id)!;
    console.log(`  ${width} px: the longest goal (${longest.id}) takes ${worst.lines} line(s)`);
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(`practice-challenge-fit-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: every goal fits the narrowest phone whole.");
