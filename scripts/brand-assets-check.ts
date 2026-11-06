/**
 * Brand assets (design foundation F4, 6 Nov 2026; fast, no browser):
 *
 * - the brand colours canvases and the asset scripts read (logoGeometry.ts: BRAND_GOLD, BRAND_INK,
 *   BRAND_TEXT_3, RING_GOLD) are the values of --jz-gold, --jz-bg, --jz-on-gold, --jz-text-3 and
 *   --jz-gold-metal in src/design/tokens.css, and the bolt is one flat colour in both colourings;
 * - the one wordmark: AppWordmark has no gold last letter, its CSS is Archivo 900 at 118 % in --jz-white
 *   with capitals by CSS, and the share card, link preview and update overlay all draw it;
 * - the PNGs scripts/brand-icons.ts and og-image.ts write exist at their sizes (the app icons, the solve
 *   burst's logo, one launch screen per APP_SPLASHES entry, the link preview);
 * - the manifest's background colour is --jz-bg; the root head links every launch screen with its media
 *   query; the offline worker doesn't keep them.
 *
 *   bun scripts/brand-assets-check.ts
 */
import { existsSync, readFileSync } from "node:fs";

import { BRAND_GOLD, BRAND_INK, BRAND_TEXT_3, LOGO_COLOURS, RING_GOLD } from "../src/components/brand/logoGeometry";
import { WORDMARK_STRETCH, WORDMARK_WEIGHT } from "../src/components/brand/wordmark";
import { APP_ICONS, APP_LOGO_URL, APP_SPLASHES } from "../src/lib/brand";
import { keepPublicFile } from "../src/lib/offline/assets";

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  if (!cond) {
    failures++;
    console.log(`FAIL ${msg}`);
  }
};

const tokens = readFileSync("src/design/tokens.css", "utf8");
const token = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(tokens)?.[1]?.trim();
const same = (a: string | undefined, b: string) => (a ?? "").toUpperCase() === b.toUpperCase();

ok(same(token("--jz-gold"), BRAND_GOLD), `BRAND_GOLD ${BRAND_GOLD} is --jz-gold (${token("--jz-gold")})`);
ok(same(token("--jz-bg"), BRAND_INK), `BRAND_INK ${BRAND_INK} is --jz-bg (${token("--jz-bg")})`);
ok(same(token("--jz-on-gold"), BRAND_INK), `BRAND_INK ${BRAND_INK} is --jz-on-gold (${token("--jz-on-gold")})`);
ok(same(token("--jz-text-3"), BRAND_TEXT_3), `BRAND_TEXT_3 ${BRAND_TEXT_3} is --jz-text-3 (${token("--jz-text-3")})`);
const metal = `linear-gradient(${RING_GOLD.angle}deg, ${RING_GOLD.stops.map(([o, c]) => `${c} ${Math.round(o * 100)}%`).join(", ")})`;
ok(same(token("--jz-gold-metal"), metal), `RING_GOLD is --jz-gold-metal (${metal} vs ${token("--jz-gold-metal")})`);
ok(same(token("--jz-white"), "#FFFFFF"), "--jz-white is white");
for (const [name, look] of Object.entries(LOGO_COLOURS)) {
  const colours = new Set([...look.upper, ...look.lower, look.line]);
  ok(colours.size === 1, `the ${name} bolt is one flat colour (${[...colours].join(", ")})`);
}
ok(LOGO_COLOURS.gold.upper[0] === BRAND_GOLD && LOGO_COLOURS.inverted.upper[0] === BRAND_INK, "gold bolt in --jz-gold, black bolt in --jz-on-gold");

// The one wordmark.
const wordmark = readFileSync("src/components/brand/AppWordmark.tsx", "utf8");
ok(!/wordmark-last|slice\(-1\)/.test(wordmark), "AppWordmark has no separately coloured last letter");
const css = readFileSync("src/polish-layout/app-pages.css", "utf8");
const rule = /\.ap-wordmark-text \{([^}]*)\}/.exec(css)?.[1] ?? "";
ok(
  /font-weight: var\(--jz-weight-black\)/.test(rule) && rule.includes(`font-stretch: ${WORDMARK_STRETCH}%`) && /text-transform: uppercase/.test(rule) && /color: var\(--jz-white\)/.test(rule),
  "the header wordmark: Archivo 900, 118 %, white, capitals by CSS",
);
ok(WORDMARK_WEIGHT === 900 && WORDMARK_STRETCH === 118, "wordmark.ts: 900 at 118 %");
ok(!/\.ap-wordmark-last/.test(css), "no gold last letter in app-pages.css");
const card = readFileSync("src/lib/share/resultCard.ts", "utf8");
ok(/wordmarkCanvasFont\(/.test(card) && /WORDMARK_TEXT/.test(card) && /loadWordmarkFace\(\)/.test(card) && !/APP_NAME\.slice/.test(card), "the share card draws the one wordmark");
const og = readFileSync("scripts/og-image.ts", "utf8");
ok(/WORDMARK_TEXT/.test(og) && /WORDMARK_STRETCH/.test(og) && !/class="last"/.test(og), "the link preview draws the one wordmark");
ok(/<AppWordmark still \/>/.test(readFileSync("src/components/app/AppUpdateOverlay.tsx", "utf8")), "the update overlay draws the one wordmark");

// The images.
function pngSize(path: string): { w: number; h: number } | null {
  if (!existsSync(path)) return null;
  const png = readFileSync(path);
  if (png.subarray(1, 4).toString("latin1") !== "PNG") return null;
  return { w: png.readUInt32BE(16), h: png.readUInt32BE(20) };
}
for (const icon of APP_ICONS) {
  const size = pngSize(`public${icon.href}`);
  ok(size?.w === icon.size && size.h === icon.size, `${icon.href} is ${icon.size}×${icon.size} (${size ? `${size.w}×${size.h}` : "missing"})`);
}
const burst = pngSize(`public${APP_LOGO_URL}`);
ok(burst?.w === 512 && burst.h === 512, `${APP_LOGO_URL} is 512×512`);
ok(APP_SPLASHES.length >= 10 && new Set(APP_SPLASHES.map((s) => s.href)).size === APP_SPLASHES.length, "one launch screen per iPhone screen, no two sharing a file");
for (const s of APP_SPLASHES) {
  const size = pngSize(`public${s.href}`);
  ok(size?.w === s.w * s.dpr && size.h === s.h * s.dpr, `${s.href} is ${s.w * s.dpr}×${s.h * s.dpr}`);
  ok((size ? readFileSync(`public${s.href}`).length : 0) < 60_000, `${s.href} is under 60 KB`);
  ok(!keepPublicFile(s.href), `${s.href} is not kept by the offline worker`);
  ok(s.media.includes(`(device-width: ${s.w}px)`) && s.media.includes(`(device-height: ${s.h}px)`) && s.media.includes(`(-webkit-device-pixel-ratio: ${s.dpr})`), `${s.href}'s media query names its screen`);
}
const og2 = pngSize("public/og-image.png");
ok(og2?.w === 1200 && og2.h === 630, "og-image.png is 1200×630");

// The manifest and the head.
const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8"));
ok(same(manifest.background_color, BRAND_INK), `manifest background_color is --jz-bg (${manifest.background_color})`);
const root = readFileSync("src/routes/__root.tsx", "utf8");
ok(/APP_SPLASHES\.map\(\(splash\) => \(\{ rel: "apple-touch-startup-image", href: splash\.href, media: splash\.media \}\)\)/.test(root), "the root head links every launch screen");
ok(/apple-mobile-web-app-capable/.test(root), "the head marks the page a home-screen app (iOS reads launch screens only then)");

if (failures) {
  console.log(`FAIL: ${failures} brand asset problem(s)`);
  process.exit(1);
}
console.log(
  `PASS: brand colours mirror the tokens; one wordmark on the header, share card, link preview and update overlay; ${APP_ICONS.length} app icons, the burst logo and ${APP_SPLASHES.length} launch screens at their sizes; manifest on --jz-bg.`,
);
