/**
 * Cosmetics review (13 Nov 2026), a review tool, not a check and not app code: every identity cosmetic drawn by the
 * app's own components (PlayerCard, CardStrip, MiniCard, avatarMarkup, Emote art, celebration scenes, GameIcon tile
 * styles, the badge SVGs, Trophy, Emblem) into a static page in headless Chromium, under Reduce Motion (the still
 * the approved PNGs show), at two sizes:
 *
 *   phone   — 390 px wide screen, DPR 2: the Profile card is 358 px wide (the page's 16 px gutters).
 *   desktop — 1440 × 900, DPR 1: the Profile card fills the tab page's main column, 784 px wide
 *             (1440 − 240 rail − 2 × 32 padding − 32 gap − 320 aside; desktop-layout.css).
 *
 *   bun docs/cosmetics-review/tools/render-identity.tsx        writes docs/cosmetics-review/png/…
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { chromium } from "playwright";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CardStrip, MiniCard, PlayerCard, type CardLook } from "../../../src/design/identity/PlayerCard";
import { avatarMarkup } from "../../../src/design/identity/avatars";
import { AVATARS, CARD_CHROME_CSS, CARD_MOTION_CSS, GEMS } from "../../../src/design/identity/playerCardArt.data";
import { CELEBRATIONS, COSMETICS_MOTION_CSS, REACTIONS } from "../../../src/design/identity/cosmeticsArt.data";
import { celebrationScene } from "../../../src/design/identity/cosmetics";
import { GameIcon } from "../../../src/components/app/GameIcon";
import { Emblem, MedalArt, Trophy } from "../../../src/design/art";
import { BADGES } from "../../../src/lib/badges/catalogue";

const OUT = "docs/cosmetics-review/png";
const ROOT = "docs/cosmetics-review";
const css = (f: string) => readFileSync(f, "utf8");
const BASE_CSS = [css("src/design/tokens.css"), css("src/design/components.css"), css("src/polish-layout/identity.css"), css("src/polish-layout/cosmetics.css"), css("src/polish-layout/seasons.css")].join("\n");

type Raw = { id: string; kind: string; name: string; png: string | null; dir: string };
const { catalogueItems } = await import("../../../scripts/catalogue-files");
const items = catalogueItems<Raw>();

const NAME = "SkyRacer";
const card = (look: Partial<CardLook>, extra: Record<string, unknown> = {}) =>
  createElement(PlayerCard, {
    look: { cardArt: null, frame: null, nameColour: null, avatar: { id: "captain-joulz", colour: 4, gem: null }, ...look } as CardLook,
    name: NAME,
    title: "Rookie",
    playerNumber: 42,
    ...extra,
  });
const strip = (look: Partial<CardLook>) =>
  createElement(CardStrip, { look: { cardArt: null, frame: null, nameColour: null, avatar: { id: "captain-joulz", colour: 4, gem: null }, ...look } as CardLook, name: NAME, playerNumber: 42 });
const mini = (look: Partial<CardLook>) =>
  createElement(MiniCard, { look: { cardArt: null, frame: null, nameColour: null, avatar: { id: "captain-joulz", colour: 4, gem: null }, ...look } as CardLook, size: 48 });

const html = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:"Archivo";font-style:normal;font-weight:100 900;font-stretch:62% 125%;src:url("/fonts/archivo-var-latin.woff2") format("woff2")}
@font-face{font-family:"Silkscreen";font-style:normal;font-weight:700;src:url("/fonts/silkscreen-700-latin.woff2") format("woff2")}
${BASE_CSS}
${CARD_CHROME_CSS}
${CARD_MOTION_CSS}
${COSMETICS_MOTION_CSS}
body{margin:0;padding:16px;background:#07070A;color:#F5F5F7;font-family:Archivo,system-ui,sans-serif}
.shot{display:inline-flex;flex-direction:column;gap:14px;padding:16px;background:#07070A}
.row{display:flex;gap:12px;align-items:center}
.plate{display:flex;align-items:center;gap:10px;height:56px;padding:0 12px;border-radius:10px;background:#11131A}
.plate .place{width:22px;font-weight:800;color:#BDBDCC}
.plate .score{margin-left:auto;font-weight:800}
.plate .pcard-strip{flex:1;min-width:0}
</style></head><body><div class="shot" id="shot">${body}</div></body></html>`;

const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const errors: string[] = [];
const SIZES = {
  phone: { viewport: { width: 390, height: 844 }, dpr: 2, card: 358, strip: 260, unit: 1 },
  desktop: { viewport: { width: 1440, height: 900 }, dpr: 1, card: 784, strip: 420, unit: 1 },
} as const;
type Size = keyof typeof SIZES;
const contexts: Record<Size, Awaited<ReturnType<typeof browser.newContext>>> = {} as never;
for (const s of Object.keys(SIZES) as Size[]) {
  const c = await browser.newContext({ viewport: SIZES[s].viewport, deviceScaleFactor: SIZES[s].dpr, reducedMotion: "reduce" });
  await c.route("http://review.test/**", async (route) => {
    const url = new URL(route.request().url());
    const file = join("public", decodeURIComponent(url.pathname));
    if (url.pathname !== "/" && existsSync(file)) {
      const ext = file.split(".").pop()!;
      const type = { woff2: "font/woff2", svg: "image/svg+xml", webp: "image/webp", png: "image/png" }[ext] ?? "application/octet-stream";
      return route.fulfill({ body: readFileSync(file), contentType: type });
    }
    return route.fulfill({ body: (globalThis as { __page?: string }).__page ?? "", contentType: "text/html" });
  });
  contexts[s] = c;
}

const written: Record<string, string[]> = {};
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
async function shot(section: string, id: string, build: (s: (typeof SIZES)[Size]) => string): Promise<void> {
  if (ONLY && !ONLY.includes(section)) return;
  mkdirSync(join(OUT, section), { recursive: true });
  for (const size of Object.keys(SIZES) as Size[]) {
    (globalThis as { __page?: string }).__page = html(build(SIZES[size]));
    const page = await contexts[size].newPage();
    page.on("pageerror", (e) => errors.push(`${id}: ${String(e)}`));
    await page.goto("http://review.test/");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(40);
    const file = join(OUT, section, `${id}--${size}.png`);
    await page.locator("#shot").screenshot({ path: file });
    (written[section] ??= []).push(file);
    await page.close();
  }
}
const m = (el: ReactElement) => renderToStaticMarkup(el);
const w = (px: number, inner: string) => `<div style="width:${px}px">${inner}</div>`;

/* Card art, frames, name colours, season and championship frames: the Profile card, the nameplate strip in a board row
 * and the Friends list's mini card. */
for (const it of items.filter((i) => ["card-art", "frame", "name-colour"].includes(i.kind))) {
  const look: Partial<CardLook> =
    it.kind === "card-art" ? { cardArt: it.id } : it.kind === "frame" ? { frame: it.id } : { nameColour: it.id };
  await shot(it.kind, it.id, (s) =>
    w(s.card, m(card(look))) +
    `<div class="row" style="width:${s.card}px"><div class="plate" style="flex:1"><span class="place">3</span>${m(strip(look))}<span class="score">1,842</span></div>${m(mini(look))}</div>`,
  );
}

/* Avatars: all 32 in their default colour, on the card (the size players see them) — one sheet; gems on Captain Joulz. */
await shot("avatar", "all-32", (s) => {
  const size = Math.round((58 * s.card) / 300);
  return `<div style="display:grid;grid-template-columns:repeat(8,${size}px);gap:10px">${AVATARS.map((a, i) => `<span title="${a.id}" style="width:${size}px;height:${size}px;display:block">${avatarMarkup({ id: a.id, colour: -1, gem: null }, `av${i}-`)}</span>`).join("")}</div>`;
});
for (const g of GEMS)
  await shot("gem", `gem.${g.id}`, (s) => w(s.card, m(card({ avatar: { id: "captain-joulz", colour: 4, gem: g.id } }))));

/* Avatar finishes, the accessory and the special edition, on the card and on the nameplate strip. */
for (const it of items.filter((i) => i.kind.startsWith("avatar-"))) {
  const extra = it.kind === "avatar-finish" ? { finish: it.id } : it.kind === "avatar-accessory" ? { accessory: it.id } : { special: it.id };
  const avatar = { id: "captain-joulz", colour: 4, gem: null, ...extra } as CardLook["avatar"];
  await shot(it.kind, it.id, (s) =>
    w(s.card, m(card({ avatar }))) +
    `<div class="row" style="width:${s.card}px"><div class="plate" style="flex:1"><span class="place">1</span>${m(strip({ avatar }))}<span class="score">2,046</span></div>${m(mini({ avatar }))}</div>`,
  );
}

/* Reactions: each pack's emotes at chat size (34 px tall, RoomChat). */
for (const it of items.filter((i) => i.kind === "reaction")) {
  await shot("reaction", it.id, () =>
    `<div class="row" style="flex-wrap:wrap;max-width:360px">${REACTIONS[it.id]!.map((e, i) => `<span class="jzc jz-emote" style="height:34px">${e.svg.replaceAll("{{p}}", `e${i}-`)}</span>`).join("")}</div>`,
  );
}

/* Celebrations: the final screen's strip scene (240 × 150, PodiumCelebrations). */
for (const it of items.filter((i) => i.kind === "celebration")) {
  if (!CELEBRATIONS[it.id]) continue;
  await shot("celebration", it.id, () => `<span class="jzc" style="display:inline-block;width:240px;height:150px">${celebrationScene(it.id, "c-", avatarMarkup({ id: "captain-joulz", colour: 4, gem: null }, "cv-"), "1st")}</span>`);
}

/* Tile styles: the player's own Practice shelf tiles (104 px), three games, beside the plain tile. */
for (const it of items.filter((i) => i.kind === "tile-style")) {
  await shot("tile-style", it.id, () =>
    `<div class="row">${["unblock", "pool", "freecell"].map((t) => m(createElement(GameIcon, { type: t as never, size: 104, tileStyle: it.id }))).join("")}<span style="width:16px"></span>${m(createElement(GameIcon, { type: "unblock" as never, size: 104 }))}</div>`,
  );
}

/* Badge art: every badge at collection size (56) and as it sits on the card (bottom right). */
await shot("badge", "all-54", () =>
  `<div style="display:grid;grid-template-columns:repeat(9,56px);gap:12px">${BADGES.map((b) => `<img title="${b.slug}" src="/art/badges/${b.slug}.svg" width="56" height="56">`).join("")}</div>`,
);
await shot("badge", "on-card", (s) => w(s.card, m(card({}, { badges: ["founding-player", "first-star", "friendly"] }))));

/* Trophies, medals and tier emblems (src/design/art). */
await shot("trophy", "trophies", () =>
  `<div class="row" style="align-items:flex-end">${(["bronze", "silver", "gold", "championship"] as const).map((k) => m(createElement(Trophy, { kind: k }))).join("")}</div>` +
  `<div class="row">${(["gold", "silver", "bronze"] as const).map((k) => m(createElement(MedalArt, { metal: k, size: 56 }))).join("")}</div>` +
  `<div class="row">${(["spark", "charge", "volt", "surge", "storm", "lightning"] as const).map((t) => m(createElement(Emblem, { tier: t, size: 56, marker: false }))).join("")}</div>`,
);

await browser.close();
if (errors.length) console.log(`page errors:\n${errors.slice(0, 20).join("\n")}`);
console.log(`render-identity: ${Object.values(written).flat().length} PNGs`);
