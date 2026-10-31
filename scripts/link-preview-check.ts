/**
 * Link previews (Prompt Q, 23 Oct 2026): the root route's head carries the Open Graph and Twitter
 * card tags from LINK_PREVIEW (src/lib/brand.ts), every URL absolute on the published site, and
 * public/og-image.png (scripts/og-image.ts) is a 1200 × 630 PNG.
 *
 *   bun scripts/link-preview-check.ts
 */
import { readFileSync } from "node:fs";

import { APP_URL, LINK_PREVIEW } from "../src/lib/brand";

let failures = 0;
const ok = (cond: unknown, msg: string) => {
  if (!cond) {
    failures++;
    console.log(`FAIL ${msg}`);
  }
};

ok(LINK_PREVIEW.title === "Joulz", `title "Joulz" (${LINK_PREVIEW.title})`);
ok(
  LINK_PREVIEW.description === "Live brain games with friends. Same games, same moment, highest score wins.",
  "the description line",
);
ok(/^https:\/\/[^/]+$/.test(APP_URL), `APP_URL is an https origin (${APP_URL})`);
for (const url of [LINK_PREVIEW.url, LINK_PREVIEW.image]) ok(url.startsWith(`${APP_URL}/`), `${url} is absolute on the site`);

const root = readFileSync("src/routes/__root.tsx", "utf8");
for (const [attr, key, value] of [
  ["property", "og:title", "LINK_PREVIEW.title"],
  ["property", "og:description", "LINK_PREVIEW.description"],
  ["property", "og:url", "LINK_PREVIEW.url"],
  ["property", "og:image", "LINK_PREVIEW.image"],
  ["property", "og:image:width", "String(LINK_PREVIEW.imageWidth)"],
  ["property", "og:image:height", "String(LINK_PREVIEW.imageHeight)"],
  ["name", "twitter:card", '"summary_large_image"'],
  ["name", "twitter:title", "LINK_PREVIEW.title"],
  ["name", "twitter:description", "LINK_PREVIEW.description"],
  ["name", "twitter:image", "LINK_PREVIEW.image"],
] as const)
  ok(root.includes(`{ ${attr}: "${key}", content: ${value} }`), `the root head sets ${key}`);

const tool = readFileSync("scripts/og-image.ts", "utf8");
ok(
  (tool.match(/stroke-width="\$\{LOGO_HAIRLINE_PX\}" stroke-linecap="round" vector-effect="non-scaling-stroke"/g) ?? []).length === 2,
  "the preview's speed lines are hairlines",
);

const png = readFileSync("public/og-image.png");
ok(png.subarray(1, 4).toString("latin1") === "PNG", "og-image.png is a PNG");
const w = png.readUInt32BE(16);
const h = png.readUInt32BE(20);
ok(w === 1200 && h === 630 && LINK_PREVIEW.imageWidth === 1200 && LINK_PREVIEW.imageHeight === 630, `1200×630 (${w}×${h})`);
ok(png.length < 300_000, `under 300 KB (${png.length} bytes)`);

if (failures) {
  console.log(`FAIL: ${failures} problem(s)`);
  process.exit(1);
}
console.log(`PASS: link preview tags (Open Graph, Twitter large card) with absolute URLs on ${APP_URL}; og-image.png ${w}×${h}.`);
