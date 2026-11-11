/**
 * The seven Season 1 card frames' PLACEHOLDER art (wave 4 W4d, docs/seasons/README.md), until the real frames are
 * drawn. Writes docs/art/wave-4/placeholders/frame/s1-<tier>.html (the Silver frame's source with its border swapped
 * for a double border in the tier's metal and a "SEASON 1" plate; Storm, Lightning and Top 500 glow with the art board's
 * own `lg-glow` motion, which stops under prefers-reduced-motion) and each one's still, s1-<tier>.png, a 2× screenshot
 * of the source with the exporter's 16 px margin, reduced motion on (as the approved stills are).
 *
 *   bun scripts/season-frame-placeholders.ts          writes the sources and stills
 *   bun scripts/season-frame-placeholders.ts --check  fails if a source differs from what this script writes
 *
 * Then `bun scripts/player-card-art.ts` cuts them into the player card's data like every other frame. When the real
 * art arrives, replace the catalogue's png / html paths for these seven ids and delete the placeholders.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const OUT = join(ROOT, "docs/art/wave-4/placeholders/frame");
const TEMPLATE = join(ROOT, "docs/art/wave-2/items/frame/silver.html");

export const SEASON_FRAME_TIERS = [
  // id suffix, name, metal stops (the art README's materials), glow. Every plate reads "SEASON 1": the tier is the
  // frame's metal (a card never spells a tier or rating out: identity-screens-check).
  { tier: "spark", plate: "S1 SPARK", stops: ["#F6D2AE", "#D49461", "#9A5E30", "#E2AB76"], glow: false },
  { tier: "charge", plate: "S1 CHARGE", stops: ["#FFFFFF", "#D3DCEF", "#97A4C0", "#E6ECF8"], glow: false },
  { tier: "volt", plate: "S1 VOLT", stops: ["#FBEDC4", "#E6C67E", "#D2AC5E", "#EED79C"], glow: false },
  { tier: "surge", plate: "S1 SURGE", stops: ["#F2FCFF", "#AEEAF7", "#62B9CE", "#D6F7FF"], glow: false },
  { tier: "storm", plate: "S1 STORM", stops: ["#4A5680", "#1E2640", "#0B0F1C", "#36406A"], glow: true },
  { tier: "lightning", plate: "S1 LIGHTNING", stops: ["#FBEDC4", "#E6C67E", "#D2AC5E", "#EED79C"], glow: true },
  { tier: "top-500", plate: "S1 TOP 500", stops: ["#22E4FF", "#C79BFF", "#FF8FD6", "#F2C14E"], glow: true },
] as const;

const OLD_BORDER = '<rect x="1.5" y="1.5" width="297" height="109" rx="10" fill="none" stroke="#C9D3E6" stroke-width="3"></rect>';

function frameMarkup(t: (typeof SEASON_FRAME_TIERS)[number]): string {
  const id = `s1f${t.tier.replace(/-/g, "")}`;
  const grad =
    `<defs><linearGradient id="${id}g" x1="0" y1="0" x2="0.4" y2="1">` +
    t.stops.map((c, i) => `<stop offset="${[0, 0.35, 0.7, 1][i]}" stop-color="${c}"></stop>`).join("") +
    `</linearGradient></defs>`;
  // The edge for obsidian (Storm) is gold, as its emblem's inner edge.
  const inner = t.tier === "storm" ? "#E6C67E" : `url(#${id}g)`;
  const border =
    `<rect x="2" y="2" width="296" height="108" rx="10" fill="none" stroke="url(#${id}g)" stroke-width="4"></rect>` +
    `<rect x="7.5" y="7.5" width="285" height="97" rx="6" fill="none" stroke="${inner}" stroke-width="1.5"></rect>`;
  const glow = t.glow
    ? `<g class="lg-glow"><rect x="0" y="0" width="300" height="112" rx="11" fill="none" stroke="url(#${id}g)" stroke-width="2" opacity="0.8"></rect></g>`
    : "";
  const label = "SEASON 1";
  const plateW = 14 + label.length * 7;
  const plate =
    `<rect x="${150 - plateW / 2}" y="98" width="${plateW}" height="14" rx="4" fill="#06080F" stroke="${inner}" stroke-width="1.5"></rect>` +
    `<text x="150" y="108.5" text-anchor="middle" font-family="Archivo, system-ui, sans-serif" font-weight="900" font-size="8.5" letter-spacing="0.8" fill="#FFFFFF">${label}</text>`;
  return grad + glow + border + plate;
}

function source(t: (typeof SEASON_FRAME_TIERS)[number]): string {
  const template = readFileSync(TEMPLATE, "utf8");
  if (!template.includes(OLD_BORDER)) throw new Error("season-frame-placeholders: the Silver source's border moved");
  const name = `Season 1 ${t.plate.slice(3).replace(/\b([A-Z])([A-Z]+)/g, (_, a: string, b: string) => a + b.toLowerCase())}`;
  return template
    .replace("<title>Silver (frame)</title>", `<title>${name} (frame, placeholder)</title>`)
    .replace(
      /<!-- Joulz wave 2 art: Silver\.[^>]*-->/,
      `<!-- PLACEHOLDER (wave 4 W4d): ${name}, made by scripts/season-frame-placeholders.ts until the real frame is drawn. Motion stops under prefers-reduced-motion. -->`,
    )
    .replace(OLD_BORDER, frameMarkup(t));
}

const check = process.argv.includes("--check");
mkdirSync(OUT, { recursive: true });
const bad: string[] = [];
for (const t of SEASON_FRAME_TIERS) {
  const file = join(OUT, `s1-${t.tier}.html`);
  const text = source(t);
  if (check) {
    if (!existsSync(file) || readFileSync(file, "utf8") !== text) bad.push(file);
    if (!existsSync(file.replace(/\.html$/, ".png"))) bad.push(file.replace(/\.html$/, ".png"));
  } else writeFileSync(file, text);
}
if (check) {
  if (bad.length) {
    console.error(`season-frame-placeholders: out of date: ${bad.join(", ")}`);
    process.exit(1);
  }
  console.log("season-frame-placeholders: up to date");
  process.exit(0);
}

// The stills: each source drawn at 2×, reduced motion, cut to the card plus a 16 px margin.
const { chromium } = await import("playwright");
const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
try {
  const page = await browser.newPage({ viewport: { width: 420, height: 300 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  await page.route("https://fonts.googleapis.com/**", (r) => r.fulfill({ body: "", contentType: "text/css" }));
  for (const t of SEASON_FRAME_TIERS) {
    const html = readFileSync(join(OUT, `s1-${t.tier}.html`), "utf8").replace(
      "<style>",
      `<style>@font-face{font-family:"Archivo";font-weight:100 900;font-stretch:62% 125%;src:url("data:font/woff2;base64,${readFileSync(join(ROOT, "public/fonts/archivo-var-latin.woff2")).toString("base64")}") format("woff2")}\nbody{padding:40px}`,
    );
    await page.setContent(html);
    await page.evaluate(() => document.fonts.ready);
    const box = (await page.locator("[data-item]").first().boundingBox())!;
    await page.screenshot({ path: join(OUT, `s1-${t.tier}.png`), clip: { x: box.x - 16, y: box.y - 16, width: 332, height: 144 } });
  }
} finally {
  await browser.close();
}
console.log(`season-frame-placeholders: ${SEASON_FRAME_TIERS.length} sources and stills → ${OUT}`);
