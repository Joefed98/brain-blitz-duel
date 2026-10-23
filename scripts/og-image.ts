/**
 * The link preview image (Prompt Q, 23 Oct 2026; a one-off tool, not a check): public/og-image.png,
 * 1200 × 630, what a shared link shows (LINK_PREVIEW in src/lib/brand.ts, set in the root route's
 * head). The gold logo mark (logoGeometry.ts, as LogoMark draws it) and the JOULZ wordmark with its
 * gold last letter (Archivo 900, as AppWordmark), the preview's line below in #A09DA6 (Manrope), on
 * #0D0D0F; the speed lines are LogoMark's hairlines (LOGO_HAIRLINE_PX). Drawn by the pre-installed Chromium with the app's own self-hosted fonts; no new dependency.
 * Re-run after a logo, name or line change:
 *
 *   bun scripts/og-image.ts
 */
import { existsSync, readFileSync } from "node:fs";

import { chromium } from "playwright";

import { LOGO_COLOURS, LOGO_HAIRLINE_PX, LOGO_LEAD, LOGO_PATHS, LOGO_TRAIL } from "../src/components/brand/logoGeometry";
import { APP_NAME, LINK_PREVIEW } from "../src/lib/brand";

const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
const OUT = "public/og-image.png";
const { imageWidth: W, imageHeight: H } = LINK_PREVIEW;

const font = (file: string) => `data:font/woff2;base64,${readFileSync(`public/fonts/${file}`).toString("base64")}`;

function markSvg(height: number): string {
  const look = LOGO_COLOURS.gold;
  const stops = (colours: readonly string[]) =>
    colours.map((c, i) => `<stop offset="${colours.length === 1 ? 0 : i / (colours.length - 1)}" stop-color="${c}"/>`).join("");
  const line = (id: string, from: number, to: number) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${from}" y1="0" x2="${to}" y2="0"><stop offset="0" stop-color="${look.line}" stop-opacity="${look.lineOpacity}"/><stop offset="1" stop-color="${look.line}" stop-opacity="0"/></linearGradient>`;
  return `<svg viewBox="0 0 26 34" width="${(height * 26) / 34}" height="${height}" style="overflow:visible;display:block">
  <defs>
    <linearGradient id="a" x1="0" y1="0" x2="0" y2="1">${stops(look.upper)}</linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">${stops(look.lower)}</linearGradient>
    ${line("t", LOGO_TRAIL.from, LOGO_TRAIL.to)}
    ${line("l", LOGO_LEAD.from, LOGO_LEAD.to)}
  </defs>
  <path d="${LOGO_PATHS.upper}" fill="url(#a)"/>
  <path d="${LOGO_PATHS.lower}" fill="url(#b)"/>
  <path d="${LOGO_PATHS.trail}" stroke="url(#t)" stroke-width="${LOGO_HAIRLINE_PX}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  <path d="${LOGO_PATHS.lead}" stroke="url(#l)" stroke-width="${LOGO_HAIRLINE_PX}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
</svg>`;
}

const name = APP_NAME.toUpperCase();
const html = `<!doctype html><html><head><style>
@font-face { font-family: "Archivo"; src: url(${font("archivo-var-latin.woff2")}) format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: "Manrope"; src: url(${font("manrope-500-800-latin.woff2")}) format("woff2"); font-weight: 500 800; }
html, body { margin: 0; width: ${W}px; height: ${H}px; background: #0D0D0F; }
body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 34px; }
.row { display: flex; align-items: center; gap: 30px; }
.word { font-family: "Archivo"; font-weight: 900; font-stretch: 118%; font-size: 168px; line-height: 1; letter-spacing: 0.01em; color: #FFFFFF; white-space: nowrap; }
.last { background: linear-gradient(180deg, #FFEBA8 0%, #F7BF2F 48%, #C98A0E 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.line { font-family: "Manrope"; font-weight: 600; font-size: 38px; line-height: 1.3; color: #A09DA6; text-align: center; max-width: 1040px; }
</style></head><body>
  <div class="row">${markSvg(176)}<div class="word">${name.slice(0, -1)}<span class="last">${name.slice(-1)}</span></div></div>
  <div class="line">${LINK_PREVIEW.description.replace(". ", ".<br>")}</div>
</body></html>`;

const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));
  if (!fonts.includes("Archivo") || !fonts.includes("Manrope")) throw new Error(`fonts not loaded (${fonts.join(", ")})`);
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: W, height: H } });
  console.log(`wrote ${OUT} (${W}×${H})`);
} finally {
  await browser.close();
}
