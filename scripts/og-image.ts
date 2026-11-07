/**
 * The link preview image (Prompt Q, 23 Oct 2026; a one-off tool, not a check): public/og-image.png,
 * 1200 × 630, what a shared link shows (LINK_PREVIEW in src/lib/brand.ts, set in the root route's
 * head). The one wordmark (design foundation F4, src/components/brand/wordmark.ts): JOULZ in Archivo
 * 900 at 118 % width, all white, then the bolt in --jz-gold (logoGeometry.ts, as LogoMark draws it),
 * the preview's line below in --jz-text-3 (Archivo), on --jz-bg; the speed lines are LogoMark's
 * hairlines (LOGO_HAIRLINE_PX). Drawn by the pre-installed Chromium with the app's own self-hosted
 * font; no new dependency.
 * Re-run after a logo, name or line change:
 *
 *   bun scripts/og-image.ts
 */
import { existsSync, readFileSync } from "node:fs";

import { chromium } from "playwright";

import { BRAND_INK, BRAND_TEXT_3, LOGO_COLOURS, LOGO_HAIRLINE_PX, LOGO_LEAD, LOGO_PATHS, LOGO_TRAIL } from "../src/components/brand/logoGeometry";
import {
  WORDMARK_GAP_EM,
  WORDMARK_LETTER_SPACING_EM,
  WORDMARK_MARK_EM,
  WORDMARK_STRETCH,
  WORDMARK_TEXT,
  WORDMARK_WEIGHT,
} from "../src/components/brand/wordmark";
import { LINK_PREVIEW } from "../src/lib/brand";

const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);
const OUT = "public/og-image.png";
const { imageWidth: W, imageHeight: H } = LINK_PREVIEW;

const font = (file: string) => `data:font/woff2;base64,${readFileSync(`public/fonts/${file}`).toString("base64")}`;

function markSvg(height: number): string {
  const look = LOGO_COLOURS.gold;
  const line = (id: string, from: number, to: number) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${from}" y1="0" x2="${to}" y2="0"><stop offset="0" stop-color="${look.line}" stop-opacity="${look.lineOpacity}"/><stop offset="1" stop-color="${look.line}" stop-opacity="0"/></linearGradient>`;
  return `<svg viewBox="0 0 26 34" width="${(height * 26) / 34}" height="${height}" style="overflow:visible;display:block">
  <defs>
    ${line("t", LOGO_TRAIL.from, LOGO_TRAIL.to)}
    ${line("l", LOGO_LEAD.from, LOGO_LEAD.to)}
  </defs>
  <path d="${LOGO_PATHS.bolt}" fill="${look.upper[0]}"/>
  <path d="${LOGO_PATHS.trail}" stroke="url(#t)" stroke-width="${LOGO_HAIRLINE_PX}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
  <path d="${LOGO_PATHS.lead}" stroke="url(#l)" stroke-width="${LOGO_HAIRLINE_PX}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
</svg>`;
}

const WORD_PX = 168;
const html = `<!doctype html><html><head><style>
@font-face { font-family: "Archivo"; src: url(${font("archivo-var-latin.woff2")}) format("woff2"); font-weight: 100 900; font-stretch: 62% 125%; }
html, body { margin: 0; width: ${W}px; height: ${H}px; background: ${BRAND_INK}; }
body { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 40px; }
.row { display: flex; align-items: center; gap: ${WORD_PX * WORDMARK_GAP_EM}px; }
.word { font-family: "Archivo"; font-weight: ${WORDMARK_WEIGHT}; font-stretch: ${WORDMARK_STRETCH}%; font-size: ${WORD_PX}px; line-height: 1; letter-spacing: ${WORDMARK_LETTER_SPACING_EM}em; color: #FFFFFF; white-space: nowrap; }
.line { font-family: "Archivo"; font-weight: 600; font-size: 38px; line-height: 1.3; color: ${BRAND_TEXT_3}; text-align: center; max-width: 1040px; }
</style></head><body>
  <div class="row"><div class="word">${WORDMARK_TEXT}</div>${markSvg(WORD_PX * WORDMARK_MARK_EM)}</div>
  <div class="line">${LINK_PREVIEW.description.replace(". ", ".<br>")}</div>
</body></html>`;

const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));
  if (!fonts.includes("Archivo")) throw new Error(`fonts not loaded (${fonts.join(", ")})`);
  await page.screenshot({ path: OUT, clip: { x: 0, y: 0, width: W, height: H } });
  console.log(`wrote ${OUT} (${W}×${H})`);
} finally {
  await browser.close();
}
