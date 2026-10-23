/**
 * The app icons (Prompt R, 23 Oct 2026; a one-off tool, not a check): the inverted logo mark (dark on
 * the gold shine, src/components/brand/logoGeometry.ts) drawn by the pre-installed Chromium and saved
 * as PNGs in public/: the home-screen app icon (apple-touch-icon, 180, full bleed: iOS rounds it), the
 * manifest's 192 and 512 (a rounded square) and maskable 512 (full bleed, the mark inside the safe
 * zone), and the browser tab's favicons (32 and 16). No new dependency. Re-run after a logo change:
 *
 *   bun scripts/brand-icons.ts
 */
import { existsSync } from "node:fs";

import { chromium } from "playwright";

import { GOLD_SHINE_STOPS, LOGO_COLOURS, LOGO_LEAD, LOGO_PATHS, LOGO_TRAIL } from "../src/components/brand/logoGeometry";
import { APP_ICONS } from "../src/lib/brand";

const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);

/** One icon as SVG: `bleed` fills the square (iOS and maskable round or crop it), else a rounded square. */
function iconSvg(size: number, { bleed, mark }: { bleed: boolean; mark: number }): string {
  const look = LOGO_COLOURS.inverted;
  const h = size * mark;
  const k = h / 34;
  const x = (size - 26 * k) / 2;
  const y = (size - 34 * k) / 2;
  const r = bleed ? 0 : size * 0.225;
  const stops = (colours: readonly string[]) =>
    colours.map((c, i) => `<stop offset="${i / (colours.length - 1)}" stop-color="${c}"/>`).join("");
  const line = (id: string, from: number, to: number) =>
    `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${from}" y1="0" x2="${to}" y2="0"><stop offset="0" stop-color="${look.line}" stop-opacity="${look.lineOpacity}"/><stop offset="1" stop-color="${look.line}" stop-opacity="0"/></linearGradient>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">${GOLD_SHINE_STOPS.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("")}</linearGradient>
    <linearGradient id="hi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="a" x1="0" y1="0" x2="0" y2="1">${stops(look.upper)}</linearGradient>
    <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">${stops(look.lower)}</linearGradient>
    ${line("t", LOGO_TRAIL.from, LOGO_TRAIL.to)}
    ${line("l", LOGO_LEAD.from, LOGO_LEAD.to)}
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#shine)"/>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#hi)"/>
  <g transform="translate(${x} ${y}) scale(${k})">
    <path d="${LOGO_PATHS.upper}" fill="url(#a)"/>
    <path d="${LOGO_PATHS.lower}" fill="url(#b)"/>
    <path d="${LOGO_PATHS.trail}" stroke="url(#t)" stroke-width="1" stroke-linecap="round"/>
    <path d="${LOGO_PATHS.lead}" stroke="url(#l)" stroke-width="1" stroke-linecap="round"/>
  </g>
</svg>`;
}

const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const icon of APP_ICONS) {
    const context = await browser.newContext({ viewport: { width: icon.size, height: icon.size }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${iconSvg(icon.size, { bleed: icon.bleed, mark: icon.mark })}</body></html>`,
    );
    await page.locator("svg").screenshot({ path: `public${icon.href}`, omitBackground: true });
    await context.close();
    console.log(`public${icon.href} (${icon.size}×${icon.size}${icon.bleed ? ", full bleed" : ""})`);
  }
} finally {
  await browser.close();
}
