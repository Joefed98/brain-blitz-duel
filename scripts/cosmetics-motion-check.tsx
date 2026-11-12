/**
 * cosmetics-motion-check (wave 2, session E2; headless Chromium, ~1 min): the remaining wave 2 cosmetics drawn in a
 * real browser, as the app draws them.
 *
 *  1. Each avatar finish, the Neon Bolt, Neon Captain Joulz, every reaction pack, every celebration and every tile
 *     style matches its approved still (docs/art/wave-2/items/<kind>/<name>.png: the board tile under Reduce Motion at
 *     2×). The app's own drawing (avatarMarkup on Captain Joulz in his own colours, the emotes, the scene with its
 *     sample podium avatar, the tile style with its sample glyph) is put in the board's tile on the board's page and
 *     compared pixel by pixel; the mean difference must stay under MAX_MEAN_DIFF. (The finishes' board drew Captain
 *     Joulz without his scene's faint bolt; the app keeps the avatar's scene, inside the tolerance.)
 *  2. Under prefers-reduced-motion no animation runs on any item, nor on the final screen's celebrations or a styled
 *     tile; without it the animated items move.
 *  3. With nothing equipped the screens' own markup is unchanged: GameIcon without a style, PodiumCelebrations with
 *     none equipped (nothing), the Avatar component.
 *  4. No page error or console error.
 *
 *   bun scripts/cosmetics-motion-check.tsx [--shots=<dir>] [--only=<id>]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createCanvas, loadImage } from "@napi-rs/canvas";
import { chromium } from "playwright";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { avatarMarkup } from "../src/design/identity/avatars";
import { ANIMATED_COSMETICS, BOARD_WRAPPERS, CELEBRATIONS, COSMETICS_MOTION_CSS, REACTIONS, TILE_STYLES } from "../src/design/identity/cosmeticsArt.data";
import { celebrationScene } from "../src/design/identity/cosmetics";
import { GameIcon } from "../src/components/app/GameIcon";
import { PodiumCelebrations } from "../src/components/duel/PodiumCelebrations";
import { NO_COSMETICS } from "../src/lib/cosmetics/types";

const MAX_MEAN_DIFF = 8;
const shots = process.argv.find((a) => a.startsWith("--shots="))?.slice(8);
if (shots) mkdirSync(shots, { recursive: true });
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

const failures: string[] = [];
let checks = 0;
const check = (ok: boolean, message: string) => {
  checks++;
  if (!ok) {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
};

type Raw = { id: string; kind: string; png: string };
const KINDS = ["avatar-finish", "avatar-accessory", "avatar-special-edition", "reaction", "celebration", "tile-style"];
const items = (JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as { items: Raw[] }).items.filter(
  (r) => KINDS.includes(r.kind) && (!only || r.id === only),
);

/** The app's drawing of one item, as the board shows it (its sample player kept where the board has one). */
function drawing(r: Raw, n: number): string {
  const p = `i${n}-`;
  const avatar = (look: Parameters<typeof avatarMarkup>[0]) =>
    `<span class="jzc" style="display:inline-block;width:104px;height:104px">${avatarMarkup(look, p)}</span>`;
  if (r.kind === "avatar-finish") return avatar({ id: "captain-joulz", colour: -1, gem: null, finish: r.id });
  if (r.kind === "avatar-accessory") return avatar({ id: "captain-joulz", colour: -1, gem: null, accessory: r.id });
  if (r.kind === "avatar-special-edition") return avatar({ id: "captain-joulz", colour: -1, gem: null, special: r.id });
  if (r.kind === "reaction") return `<span class="jzc" style="display:contents">${REACTIONS[r.id]!.map((e) => e.svg.replaceAll("{{p}}", p)).join("")}</span>`;
  if (r.kind === "celebration")
    return `<span class="jzc" style="display:inline-block;width:240px;height:150px">${celebrationScene(r.id, p, null, "1st")}</span>`;
  const t = TILE_STYLES[r.id]!;
  return `<span class="jzc" style="display:contents"><svg width="90" height="90" viewBox="0 0 90 90" aria-hidden="true" style="overflow: visible">${t.back.replaceAll("{{p}}", p)}${t.sample}${t.front.replaceAll("{{p}}", p)}</svg></span>`;
}

const page_ = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Archivo";font-style:normal;font-weight:100 900;font-stretch:62% 125%;src:url("/fonts/archivo-var-latin.woff2") format("woff2")}
@font-face{font-family:"Silkscreen";font-style:normal;font-weight:700;src:url("/fonts/silkscreen-700-latin.woff2") format("woff2")}
body{margin:0;padding:16px;background:#06080F;color:#EEF2FF;font-family:'Archivo',system-ui,sans-serif}
${COSMETICS_MOTION_CSS}
</style></head><body>${body}</body></html>`;

const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const errors: string[] = [];
const serve = async (context: Awaited<ReturnType<typeof browser.newContext>>) =>
  context.route("http://cosmetics.test/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/fonts/")) return route.fulfill({ body: readFileSync(join("public", url.pathname)), contentType: "font/woff2" });
    if (url.pathname.startsWith("/tiles/")) return route.fulfill({ body: readFileSync(join("public", url.pathname)), contentType: "image/webp" });
    return route.fulfill({ body: (globalThis as { __page?: string }).__page ?? "", contentType: "text/html" });
  });

try {
  /* 1. the stills */
  let n = 0;
  for (const r of items) {
    const png = await loadImage(readFileSync(join("docs/art/wave-2", r.png)));
    const context = await browser.newContext({ viewport: { width: png.width / 2, height: png.height / 2 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
    await serve(context);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    (globalThis as { __page?: string }).__page = page_(`${BOARD_WRAPPERS[r.id]}${drawing(r, n++)}</div>`);
    await page.goto("http://cosmetics.test/");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(80);
    const mine = await loadImage(await page.screenshot({ clip: { x: 0, y: 0, width: png.width / 2, height: png.height / 2 } }));
    const a = createCanvas(mine.width, mine.height).getContext("2d");
    a.drawImage(mine, 0, 0);
    const A = Uint8Array.from(a.getImageData(0, 0, mine.width, mine.height).data);
    const b = createCanvas(png.width, png.height).getContext("2d");
    b.drawImage(png, 0, 0);
    const B = Uint8Array.from(b.getImageData(0, 0, png.width, png.height).data);
    const meanAt = (ox: number, oy: number, step: number) => {
      let sum = 0;
      let count = 0;
      for (let y = 0; y < png.height; y += step)
        for (let x = 0; x < png.width; x += step) {
          const ax = x + ox;
          const ay = y + oy;
          if (ax < 0 || ay < 0 || ax >= mine.width || ay >= mine.height) continue;
          const i = (ay * mine.width + ax) * 4;
          const j = (y * png.width + x) * 4;
          sum += (Math.abs(A[i]! - B[j]!) + Math.abs(A[i + 1]! - B[j + 1]!) + Math.abs(A[i + 2]! - B[j + 2]!)) / 3;
          count++;
        }
      return count ? sum / count : 255;
    };
    // A few stills were exported with empty board space above the tile (the scene's falling coins' room): the
    // drawing is found at whatever height the still holds it, then refined to the pixel.
    let best = { d: Infinity, ox: 0, oy: 0 };
    for (let oy = -png.height + 40; oy <= 40; oy += 4)
      for (let ox = -8; ox <= 8; ox += 8) {
        const d = meanAt(ox, oy, 16);
        if (d < best.d) best = { d, ox, oy };
      }
    const coarse = best;
    for (let oy = coarse.oy - 4; oy <= coarse.oy + 4; oy++)
      for (let ox = coarse.ox - 4; ox <= coarse.ox + 4; ox++) {
        const d = meanAt(ox, oy, 3);
        if (d < best.d) best = { d, ox, oy };
      }
    const exact = meanAt(best.ox, best.oy, 1);
    check(exact < MAX_MEAN_DIFF, `${r.id}: matches its approved still (mean difference ${exact.toFixed(2)})`);
    if (process.env["VERBOSE"]) console.log(`${r.id} ${exact.toFixed(2)}`);
    if (shots) writeFileSync(join(shots, `${r.id}.png`), await page.screenshot({ fullPage: true }));
    await context.close();
  }

  /* 2. motion */
  const all = items.map((r, i) => `<div data-item="${r.id}">${drawing(r, 1000 + i)}</div>`).join("");
  const podium = renderToStaticMarkup(
    createElement(PodiumCelebrations, {
      entries: [
        { slot: 0, place: 1, name: "Ana", cosmetics: { ...NO_COSMETICS, avatar: { id: "orbit", colour: 3, gem: null }, finish: "avatar-finish.lightning-core", celebration: "celebration.power-surge", entrance: "celebration.circuit-overload" } },
        { slot: 1, place: 2, name: "Bo", cosmetics: { ...NO_COSMETICS, avatar: { id: "apex", colour: 5, gem: null }, entrance: "celebration.circuit-overload" } },
      ],
    }),
  );
  const tile = renderToStaticMarkup(createElement(GameIcon, { type: "unblock", size: 52, tileStyle: "tile-style.neon-grid" }));
  check(/data-podium-celebrations="3"/.test(podium) && podium.includes("jz-celebration"), "the final screen draws the winner's celebration and both entrances");
  check(/data-tile-style="tile-style.neon-grid"/.test(tile), "a styled tile");
  for (const reduced of [true, false]) {
    const context = await browser.newContext({ viewport: { width: 420, height: 800 }, reducedMotion: reduced ? "reduce" : "no-preference" });
    await serve(context);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    (globalThis as { __page?: string }).__page = page_(`${all}<div data-item="podium">${podium}</div><div data-item="tile">${tile}</div>`);
    await page.goto("http://cosmetics.test/");
    await page.waitForTimeout(400);
    const moving = await page.evaluate(() => {
      const out = new Set<string>();
      for (const a of document.getAnimations()) {
        const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
        const slot = target?.closest("[data-item]");
        if (a.playState === "running" && slot) out.add(slot.getAttribute("data-item")!);
      }
      return [...out];
    });
    if (reduced) check(moving.length === 0, `reduced motion: nothing moves (${moving.join(", ") || "none"})`);
    else {
      const still = ANIMATED_COSMETICS.filter((id) => items.some((r) => r.id === id) && !moving.includes(id));
      check(still.length === 0, `without reduced motion the animated items move (still: ${still.join(", ") || "none"})`);
      check(moving.includes("podium"), "the final screen's celebration plays");
    }
    await context.close();
  }

  /* 3. nothing equipped: unchanged */
  const plain = renderToStaticMarkup(createElement(GameIcon, { type: "unblock", size: 52 }));
  const nullStyle = renderToStaticMarkup(createElement(GameIcon, { type: "unblock", size: 52, tileStyle: null }));
  check(plain === nullStyle && !plain.includes("data-tile-style") && plain.includes('class="game-icon"'), "a tile with no style is exactly as before");
  check(renderToStaticMarkup(createElement(PodiumCelebrations, { entries: [{ slot: 0, place: 1, name: "Ana", cosmetics: NO_COSMETICS }] })) === "", "no celebrations equipped: the final screen draws nothing extra");
  check(
    renderToStaticMarkup(createElement(PodiumCelebrations, { entries: [{ slot: 2, place: 4, name: "Cy", cosmetics: { ...NO_COSMETICS, celebration: "celebration.gold-rush", entrance: "celebration.circuit-overload" } }] })) === "",
    "a player off the podium shows none",
  );
  check(
    !renderToStaticMarkup(createElement(PodiumCelebrations, { entries: [{ slot: 1, place: 2, name: "Bo", cosmetics: { ...NO_COSMETICS, celebration: "celebration.gold-rush" } }] })),
    "a win celebration only for the winner",
  );
} finally {
  await browser.close();
}
check(errors.length === 0, `no page or console errors (${errors.slice(0, 3).join(" | ")})`);
check(Object.keys(CELEBRATIONS).length === 7, "seven celebrations checked");

const passed = checks - failures.length;
console.log(`cosmetics-motion-check: ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
process.exit(0);
