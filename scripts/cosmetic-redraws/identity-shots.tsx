/**
 * The cosmetics redraws' gallery pictures (a design tool, not a check): every redrawn identity item drawn by the app's
 * own components (PlayerCard, CardStrip, MiniCard, the emotes, the celebration scene, GameIcon's tile style) in
 * headless Chromium under Reduce Motion, before (today's art, every switch off) and after (the redraw in its place),
 * phone size (390 wide screen, DPR 1.5), as WebP in docs/design/cosmetics-redraws/gallery/<kind>/<id>--before|after.webp.
 *
 *   bun scripts/cosmetic-redraws/identity-shots.tsx [--only=<id,…>]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createCanvas, loadImage } from "@napi-rs/canvas";
import { chromium } from "playwright";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GameIcon } from "../../src/components/app/GameIcon";
import { REDRAWN_ART_ON } from "../../src/config/cosmeticRedraws";
import { CardStrip, MiniCard, PlayerCard, type CardLook } from "../../src/design/identity/PlayerCard";
import { avatarMarkup } from "../../src/design/identity/avatars";
import { celebrationScene } from "../../src/design/identity/cosmetics";
import * as live from "../../src/design/identity/liveArt";
import * as R from "../../src/design/identity/redrawnArt.data";

const ROOT = join(import.meta.dir, "../..");
const OUT = join(ROOT, "docs/design/cosmetics-redraws/gallery");
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const css = (f: string) => readFileSync(join(ROOT, f), "utf8");
const BASE_CSS = ["src/design/tokens.css", "src/design/components.css", "src/polish-layout/identity.css", "src/polish-layout/cosmetics.css"].map(css).join("\n");
const ALL_REDRAW_CSS = [...Object.values(R.REDRAWN_CARD_CSS), ...Object.values(R.REDRAWN_COSMETICS_CSS)].join("\n");

/* The maps a redraw swaps into (the live maps: with every switch off they are the approved maps themselves). */
const SLOTS: [Record<string, unknown>, Record<string, unknown>][] = [
  [live.CARD_ARTS, R.REDRAWN_CARD_ARTS],
  [live.FRAMES, R.REDRAWN_FRAMES],
  [live.NAME_COLOURS, R.REDRAWN_NAME_COLOURS],
  [live.FINISHES, R.REDRAWN_FINISHES],
  [live.ACCESSORIES, R.REDRAWN_ACCESSORIES],
  [live.REACTIONS, R.REDRAWN_REACTIONS],
  [live.CELEBRATIONS, R.REDRAWN_CELEBRATIONS],
  [live.TILE_STYLES, R.REDRAWN_TILE_STYLES],
];
const saved = new Map<string, [Record<string, unknown>, unknown]>();
for (const [map, red] of SLOTS) for (const id of Object.keys(red)) saved.set(id, [map, map[id]]);
function use(id: string, after: boolean): void {
  for (const [map, red] of SLOTS) {
    if (!(id in red)) continue;
    const before = saved.get(id)![1];
    if (after) map[id] = red[id];
    else if (before === undefined) delete map[id];
    else map[id] = before;
  }
}

const NAME = "SkyRacer";
const AV = { id: "captain-joulz", colour: 4, gem: null };
const look = (l: Partial<CardLook>): CardLook => ({ cardArt: null, frame: null, nameColour: null, avatar: AV, ...l });
const m = renderToStaticMarkup;
const cardRow = (l: Partial<CardLook>) =>
  `<div style="width:330px">${m(createElement(PlayerCard, { look: look(l), name: NAME, title: "Rookie", playerNumber: 42 }))}</div>` +
  `<div class="row" style="width:330px"><div class="plate" style="flex:1"><span class="place">3</span>${m(createElement(CardStrip, { look: look(l), name: NAME, playerNumber: 42 }))}<span class="score">1,842</span></div>${m(createElement(MiniCard, { look: look(l), size: 48 }))}</div>`;

function body(id: string): string {
  const kind = id.split(".")[0]!;
  if (kind === "card-art") return cardRow({ cardArt: id });
  if (kind === "frame") return cardRow({ frame: id });
  if (kind === "name-colour") return cardRow({ nameColour: id });
  if (kind === "avatar-finish") return cardRow({ avatar: { ...AV, finish: id } as CardLook["avatar"] });
  if (kind === "avatar-accessory") return cardRow({ avatar: { ...AV, accessory: id } as CardLook["avatar"] });
  if (kind === "reaction")
    return `<div class="row" style="flex-wrap:wrap;max-width:330px">${(live.REACTIONS[id] ?? []).map((e, i) => `<span class="jzc jz-emote" style="height:56px">${e.svg.replaceAll("{{p}}", `e${i}-`)}</span>`).join("")}</div>`;
  if (kind === "celebration")
    return `<span class="jzc" style="display:inline-block;width:300px;height:188px">${celebrationScene(id, "c-", avatarMarkup(AV, "cv-"), "1st")}</span>`;
  if (kind === "tile-style")
    return `<div class="row">${["unblock", "pool", "freecell"].map((t) => m(createElement(GameIcon, { type: t as never, size: 96, tileStyle: id }))).join("")}</div>`;
  throw new Error(`no shot for ${id}`);
}

const page = (inner: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Archivo";font-style:normal;font-weight:100 900;font-stretch:62% 125%;src:url("/fonts/archivo-var-latin.woff2") format("woff2")}
@font-face{font-family:"Silkscreen";font-style:normal;font-weight:700;src:url("/fonts/silkscreen-700-latin.woff2") format("woff2")}
${BASE_CSS}
${live.CARD_CHROME_CSS}
${live.CARD_MOTION_CSS}
${live.COSMETICS_MOTION_CSS}
${ALL_REDRAW_CSS}
body{margin:0;background:#07070A;color:#F5F5F7;font-family:Archivo,system-ui,sans-serif}
.shot{display:inline-flex;flex-direction:column;gap:12px;padding:14px;background:#07070A}
.row{display:flex;gap:10px;align-items:center}
.plate{display:flex;align-items:center;gap:10px;height:56px;padding:0 12px;border-radius:10px;background:#11131A}
.plate .place{width:18px;font-weight:800;color:#BDBDCC}.plate .score{margin-left:auto;font-weight:800}
.plate .pcard-strip{flex:1;min-width:0}
</style></head><body><div class="shot" id="shot">${inner}</div></body></html>`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1.5, reducedMotion: "reduce" });
let current = "";
await ctx.route("http://shots.test/**", async (route) => {
  const url = new URL(route.request().url());
  const file = join(ROOT, "public", decodeURIComponent(url.pathname));
  if (url.pathname !== "/" && existsSync(file)) {
    const ext = file.split(".").pop()!;
    const type = { woff2: "font/woff2", svg: "image/svg+xml", webp: "image/webp", png: "image/png" }[ext] ?? "application/octet-stream";
    return route.fulfill({ body: readFileSync(file), contentType: type });
  }
  return route.fulfill({ body: current, contentType: "text/html" });
});
const errors: string[] = [];
let bytes = 0;
const ids = Object.keys(REDRAWN_ART_ON).filter((id) => (only ? only.includes(id) : true) && SLOTS.some(([, red]) => id in red));
for (const id of ids) {
  const dir = join(OUT, id.split(".")[0]!);
  mkdirSync(dir, { recursive: true });
  for (const after of [false, true]) {
    use(id, after);
    current = page(body(id));
    const p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(`${id}: ${String(e)}`));
    await p.goto("http://shots.test/");
    await p.evaluate(() => document.fonts.ready);
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(60);
    const png = await p.locator("#shot").screenshot();
    await p.close();
    const img = await loadImage(png);
    const c = createCanvas(img.width, img.height);
    c.getContext("2d").drawImage(img, 0, 0);
    const webp = await c.encode("webp", 80);
    bytes += webp.length;
    writeFileSync(join(dir, `${id}--${after ? "after" : "before"}.webp`), webp);
  }
  use(id, false);
}
await browser.close();
if (errors.length) console.log(errors.join("\n"));
console.log(`identity-shots: ${ids.length} items, ${(bytes / 1024).toFixed(0)} KB`);
