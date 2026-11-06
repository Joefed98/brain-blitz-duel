/**
 * The app's brand images (Prompt R, 23 Oct 2026; design foundation F4, 6 Nov 2026; a one-off tool, not a
 * check), drawn by the pre-installed Chromium from src/components/brand/logoGeometry.ts and saved as PNGs
 * in public/. No new dependency. Re-run after a logo or token change:
 *
 *   bun scripts/brand-icons.ts
 *
 * - The app icons (APP_ICONS): the black mark (LOGO_COLOURS.inverted) on the ring-gold metal
 *   (RING_GOLD, --jz-gold-metal at its 165° angle): the home-screen app icon (apple-touch-icon, 180,
 *   full bleed: iOS rounds it), the manifest's 192 and 512 (a rounded square) and maskable 512 (full
 *   bleed, the mark inside the safe zone), and the browser tab's favicons (32 and 16).
 * - The solve burst's logo (APP_LOGO_URL, 512): the bolt in the ring-gold metal on --jz-bg.
 * - The iPhone launch screens (APP_SPLASHES): the gold bolt (LOGO_COLOURS.gold) centred on --jz-bg.
 */
import { existsSync, mkdirSync } from "node:fs";

import { chromium } from "playwright";

import {
  BRAND_INK,
  cssGradientLine,
  LOGO_COLOURS,
  LOGO_LEAD,
  LOGO_PATHS,
  LOGO_TRAIL,
  RING_GOLD,
} from "../src/components/brand/logoGeometry";
import { APP_ICONS, APP_LOGO_URL, APP_SPLASH_MARK, APP_SPLASHES } from "../src/lib/brand";

const CHROMIUM = [process.env.PLAYWRIGHT_CHROMIUM, "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find(
  (path): path is string => Boolean(path && existsSync(path)),
);

/** The ring-gold metal as an SVG gradient over a w × h box (in the user space it is used in), as the CSS token draws it. */
function ringGold(id: string, w: number, h: number): string {
  const { x1, y1, x2, y2 } = cssGradientLine(RING_GOLD.angle, w, h);
  const stops = RING_GOLD.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("");
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
}

/** A speed line's fade in the mark's own colour. */
function fade(id: string, from: number, to: number, colour: string, opacity: number): string {
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${from}" y1="0" x2="${to}" y2="0"><stop offset="0" stop-color="${colour}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${colour}" stop-opacity="0"/></linearGradient>`;
}

/**
 * The mark `h` px tall centred in a w × h box. `fill` paints the bolt; the speed lines fade from
 * `line` (1 box unit thick, or `lineWidth` screen px where given).
 */
function mark(w: number, boxH: number, h: number, fill: string, line: { colour: string; opacity: number }, lineWidth?: number): string {
  const k = h / 34;
  const x = (w - 26 * k) / 2;
  const y = (boxH - 34 * k) / 2;
  const stroke = lineWidth ? `stroke-width="${lineWidth}" vector-effect="non-scaling-stroke"` : `stroke-width="1"`;
  return `<defs>${fade("t", LOGO_TRAIL.from, LOGO_TRAIL.to, line.colour, line.opacity)}${fade("l", LOGO_LEAD.from, LOGO_LEAD.to, line.colour, line.opacity)}</defs>
  <g transform="translate(${x} ${y}) scale(${k})">
    <path d="${LOGO_PATHS.bolt}" fill="${fill}"/>
    <path d="${LOGO_PATHS.trail}" stroke="url(#t)" ${stroke} stroke-linecap="round"/>
    <path d="${LOGO_PATHS.lead}" stroke="url(#l)" ${stroke} stroke-linecap="round"/>
  </g>`;
}

/** One app icon: `bleed` fills the square (iOS and maskable round or crop it), else a rounded square. */
function iconSvg(size: number, { bleed, mark: share }: { bleed: boolean; mark: number }): string {
  const look = LOGO_COLOURS.inverted;
  const r = bleed ? 0 : size * 0.225;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${ringGold("metal", size, size)}</defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#metal)"/>
  ${mark(size, size, size * share, look.upper[0]!, { colour: look.line, opacity: look.lineOpacity })}
</svg>`;
}

/** The solve burst's logo: the bolt in the ring-gold metal (its own box's gradient) on --jz-bg. */
function burstSvg(size: number): string {
  const look = LOGO_COLOURS.gold;
  const h = size * 0.62;
  // The metal over the mark's own 26 × 34 box (the bolt's paths are drawn in those units).
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>${ringGold("metal", 26, 34)}</defs>
  <rect width="${size}" height="${size}" fill="${BRAND_INK}"/>
  ${mark(size, size, h, "url(#metal)", { colour: look.line, opacity: look.lineOpacity })}
</svg>`;
}

/** A launch screen, w × h device px: the gold bolt centred on --jz-bg. */
function splashSvg(w: number, h: number, dpr: number): string {
  const look = LOGO_COLOURS.gold;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BRAND_INK}"/>
  ${mark(w, h, w * APP_SPLASH_MARK, look.upper[0]!, { colour: look.line, opacity: look.lineOpacity }, 1.5 * dpr)}
</svg>`;
}

const jobs: { path: string; w: number; h: number; svg: string; note: string }[] = [
  ...APP_ICONS.map((icon) => ({
    path: `public${icon.href}`,
    w: icon.size,
    h: icon.size,
    svg: iconSvg(icon.size, { bleed: icon.bleed, mark: icon.mark }),
    note: icon.bleed ? "full bleed" : "rounded",
  })),
  { path: `public${APP_LOGO_URL}`, w: 512, h: 512, svg: burstSvg(512), note: "solve burst" },
  ...APP_SPLASHES.map((s) => ({
    path: `public${s.href}`,
    w: s.w * s.dpr,
    h: s.h * s.dpr,
    svg: splashSvg(s.w * s.dpr, s.h * s.dpr, s.dpr),
    note: `launch screen, ${s.w}×${s.h} @${s.dpr}x`,
  })),
];

mkdirSync("public/splash", { recursive: true });
const browser = await chromium.launch({ executablePath: CHROMIUM });
try {
  for (const job of jobs) {
    const context = await browser.newContext({ viewport: { width: job.w, height: job.h }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.setContent(`<html><body style="margin:0;background:transparent">${job.svg}</body></html>`);
    await page.locator("svg").screenshot({ path: job.path, omitBackground: true });
    await context.close();
    console.log(`${job.path} (${job.w}×${job.h}, ${job.note})`);
  }
} finally {
  await browser.close();
}
