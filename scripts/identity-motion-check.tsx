/**
 * identity-motion-check (wave 2, session A2; headless Chromium, ~1 min): the player card drawn in a real browser.
 *
 *  1. Every card art, frame and name colour in the catalogue matches its approved still
 *     (docs/art/wave-2/items/<kind>/<name>.png, the item under Reduce Motion at 2×): the card is drawn with the
 *     sample player's layout (SkyRacer, Logician, the Apex avatar) and compared pixel by pixel everywhere but the
 *     pill (the sample's tier and rating, which no card shows before wave 3); the mean difference must stay under
 *     MAX_MEAN_DIFF.
 *  2. Under prefers-reduced-motion no animation runs on any card (document.getAnimations()); without it, the
 *     animated items (the Legendaries, the Neon Circuit frame, Founding and Top 500) do move.
 *  3. No page error or console error.
 *
 *   bun scripts/identity-motion-check.tsx [--shots=<dir>]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createCanvas, loadImage } from "@napi-rs/canvas";
import { chromium } from "playwright";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { PlayerCard } from "../src/design/identity/PlayerCard";
import { ANIMATED_ITEMS, CARD_CHROME_CSS, CARD_MOTION_CSS } from "../src/design/identity/playerCardArt.data";

const MAX_MEAN_DIFF = 10;
const shots = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);
if (shots) mkdirSync(shots, { recursive: true });

const failures: string[] = [];
let checks = 0;
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
};

type Raw = { id: string; kind: string; png: string | null; dir: string };
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
// Both catalogue files (wave 2's, then wave 4's W4d Season 1 frames), each still relative to its own file. W4c's
// Championship frame has no still yet (placeholder art until drawn): there is nothing to compare it with, and
// identity-screens-check proves it draws the Plain frame's card.
const { catalogueItems } = await import("./catalogue-files");
const items = catalogueItems<Raw>().filter((r) =>
  ["card-art", "frame", "name-colour"].includes(r.kind) && r.png !== null && (!only || r.id === only),
);

const card = (r: Raw) =>
  renderToStaticMarkup(
    createElement(PlayerCard, {
      look: {
        cardArt: r.kind === "card-art" ? r.id : null,
        frame: r.kind === "frame" ? r.id : null,
        nameColour: r.kind === "name-colour" ? r.id : null,
        // The sample's Apex in its own colours (colour -1: the drawing's default).
        avatar: { id: "apex", colour: -1, gem: null },
      },
      name: "SkyRacer",
      title: "Logician",
      playerNumber: 42,
    }),
  );

const page_ = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Archivo";font-style:normal;font-weight:100 900;font-stretch:62% 125%;src:url("/fonts/archivo-var-latin.woff2") format("woff2")}
body{margin:0;padding:48px;background:#06080F;color:#EEF2FF;font-family:Archivo,system-ui,sans-serif}
.slot{width:300px;margin:0 0 140px 0}
${CARD_CHROME_CSS}
${CARD_MOTION_CSS}
</style></head><body>${body}</body></html>`;

// The pre-installed Chromium where the package's own copy isn't (as account-flow-check).
const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const errors: string[] = [];
try {
  const context = await browser.newContext({ viewport: { width: 420, height: 400 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  await context.route("http://card.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/fonts/")) return route.fulfill({ body: readFileSync(join("public", url.pathname)), contentType: "font/woff2" });
    return route.fulfill({ body: (globalThis as { __page?: string }).__page ?? "", contentType: "text/html" });
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  /* 1. the stills */
  for (const r of items) {
    (globalThis as { __page?: string }).__page = page_(`<div class="slot">${card(r)}</div>`);
    await page.goto("http://card.test/");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(50);
    const box = (await page.locator("[data-player-card]").boundingBox())!;
    const png = await loadImage(readFileSync(join(r.dir, r.png!)));
    // The still's margin round the card (wider for glowing frames): try every offset that fits, keep the best.
    const pad = 40;
    const mine = await loadImage(await page.screenshot({ clip: { x: box.x - pad, y: box.y - pad, width: 300 + 2 * pad, height: 112 + 2 * pad } }));
    const a = createCanvas(mine.width, mine.height).getContext("2d");
    a.drawImage(mine, 0, 0);
    const A = Uint8Array.from(a.getImageData(0, 0, mine.width, mine.height).data);
    const b = createCanvas(png.width, png.height).getContext("2d");
    b.drawImage(png, 0, 0);
    const B = Uint8Array.from(b.getImageData(0, 0, png.width, png.height).data);
    // Compared: the card (600 × 224 device px) less the title and the pill (x 80–200, y 44–100 card px): the
    // sample's own title and tier and rating, which differ between stills (tier cards: "S1 Storm", "Storm I 2,310").
    const P = 2 * pad;
    const inPill = (x: number, y: number) => x >= 160 && x < 400 && y >= 88 && y < 200;
    const meanAt = (ox: number, oy: number, step: number) => {
      let sum = 0;
      let n = 0;
      for (let y = 0; y < 224; y += step)
        for (let x = 0; x < 600; x += step) {
          if (inPill(x, y)) continue;
          const bx = x + ox;
          const by = y + oy;
          // Two stills are cropped short of the card's bottom: what isn't in the still isn't compared.
          if (bx < 0 || by < 0 || bx >= png.width || by >= png.height) continue;
          const i = ((y + P) * mine.width + (x + P)) * 4;
          const j = (by * png.width + bx) * 4;
          sum += (Math.abs(A[i]! - B[j]!) + Math.abs(A[i + 1]! - B[j + 1]!) + Math.abs(A[i + 2]! - B[j + 2]!)) / 3;
          n++;
        }
      return n ? sum / n : 255;
    };
    // Coarse to fine: the still is the card somewhere on a dark canvas (often wider, for glows and boards).
    let best = { d: Infinity, ox: 0, oy: 0 };
    for (let oy = 0; oy <= Math.max(0, png.height - 200); oy += 4)
      for (let ox = 0; ox <= Math.max(0, png.width - 600); ox += 4) {
        const d = meanAt(ox, oy, 24);
        if (d < best.d) best = { d, ox, oy };
      }
    // Refined round the coarse best and round the still's centre (big flat areas can fool the coarse pass).
    // (32, 32): the exporter’s usual 16 px margin at 2×.
    const seeds = [best, { d: 0, ox: Math.max(0, Math.round((png.width - 600) / 2)), oy: Math.max(0, Math.round((png.height - 224) / 2)) }, { d: 0, ox: 32, oy: 32 }];
    best = { d: Infinity, ox: 0, oy: 0 };
    for (const around of seeds)
      for (let oy = Math.max(0, around.oy - 8); oy <= around.oy + 8; oy += 2)
        for (let ox = Math.max(0, around.ox - 8); ox <= around.ox + 8; ox += 2) {
          const d = meanAt(ox, oy, 6);
          if (d < best.d) best = { d, ox, oy };
        }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) {
      const d = meanAt(best.ox + dx, best.oy + dy, 4);
      if (d < best.d) best = { d, ox: best.ox + dx, oy: best.oy + dy };
    }
    const exact = meanAt(best.ox, best.oy, 1);
    check(exact < MAX_MEAN_DIFF, `${r.id}: matches its approved still (mean difference ${exact.toFixed(1)}, at ${best.ox},${best.oy})`);
    if (shots) {
      writeFileSync(join(shots, `${r.id}.png`), await page.screenshot({ clip: { x: box.x - pad, y: box.y - pad, width: 300 + 2 * pad, height: 112 + 2 * pad } }));
    }
    if (process.env["VERBOSE"]) console.log(`${r.id} ${exact.toFixed(1)}`);
  }

  /* 2. motion */
  (globalThis as { __page?: string }).__page = page_(items.map((r) => `<div class="slot" data-item="${r.id}">${card(r)}</div>`).join(""));
  await page.goto("http://card.test/");
  await page.waitForTimeout(400);
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);
  check(running === 0, `reduced motion: no animation runs on any card (${running} running)`);
  const moving = await browser.newContext({ viewport: { width: 420, height: 400 }, reducedMotion: "no-preference" });
  await moving.route("http://card.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/fonts/")) return route.fulfill({ body: readFileSync(join("public", url.pathname)), contentType: "font/woff2" });
    return route.fulfill({ body: (globalThis as { __page?: string }).__page ?? "", contentType: "text/html" });
  });
  const p2 = await moving.newPage();
  p2.on("pageerror", (e) => errors.push(String(e)));
  await p2.goto("http://card.test/");
  await p2.waitForTimeout(400);
  const movingIds = await p2.evaluate(() => {
    const out = new Set<string>();
    for (const a of document.getAnimations()) {
      const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
      const slot = target?.closest("[data-item]");
      if (a.playState === "running" && slot) out.add(slot.getAttribute("data-item")!);
    }
    return [...out];
  });
  const want = [...ANIMATED_ITEMS, "frame.neon-circuit"];
  const still = want.filter((id) => !movingIds.includes(id));
  check(still.length === 0, `without reduced motion the animated items move (still: ${still.join(", ") || "none"})`);
  const extra = movingIds.filter((id) => !want.includes(id));
  check(extra.length === 0, `nothing else moves (${extra.join(", ") || "none"})`);
  await moving.close();
} finally {
  await browser.close();
}
check(errors.length === 0, `no page or console errors (${errors.slice(0, 3).join(" | ")})`);

const passed = checks - failures.length;
console.log(`identity-motion-check: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);
