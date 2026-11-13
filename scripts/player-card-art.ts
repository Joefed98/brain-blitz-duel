/**
 * Builds the player card's art (wave 2, session A2) from the approved sources, exactly as drawn:
 *
 * - card arts, frames and name colours from docs/art/wave-2/items/<kind>/<name>.html (one 300 × 112 card each);
 * - the 32 game avatars from docs/art/avatars/svg/<slug>.svg (their main-colour gradient made a template);
 * - the motion rules from the items' own <style> block (scoped under `.pcard`, keyframes prefixed `pc-`).
 *
 * Every item source draws the card in the same three layers, which the build splits apart:
 *   1. the card's background (`<g clip-path="url(#pcNc)">…</g>`) and its art, then the plain border rect
 *      (`#2A3352`): the card art is everything but that border;
 *   2. a frame is everything in its svg after the plain background group (its own border, defs, glow filter
 *      and motion); its svg style (drop shadow, overflow) goes on the card's svg;
 *   3. a name colour is the name span's class and style; its pixel sizes become card units
 *      (`calc(N * var(--pc-u))`, one card pixel at any card width).
 * The sample player drawn on each item (SkyRacer, Logician, Storm II, 2,046, and the Founding frame's
 * "FOUNDER #0042") is not part of the item: the founding number becomes the token `{{founder}}`.
 *
 * Ids inside each piece become `{{p}}<id>` so every card on a page gets its own (PlayerCard fills `{{p}}`).
 *
 *   bun scripts/player-card-art.ts           writes src/design/identity/playerCardArt.data.ts
 *   bun scripts/player-card-art.ts --check   fails if the file is not what the sources build
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { catalogueItems } from "./catalogue-files";

const ROOT = join(import.meta.dir, "..");
const ITEMS = join(ROOT, "docs/art/wave-2/items");
const AVATARS = join(ROOT, "docs/art/avatars");
const OUT = join(ROOT, "src/design/identity/playerCardArt.data.ts");

type CatalogueRecord = { id: string; name: string; kind: string; html: string | null; animated: boolean };
// Both catalogue files (wave 2's, then wave 4's: W4d's Season 1 frames), each item's html relative to its own file.
// An item with no source yet (W4c's Championship frame, placeholder art until drawn) is left out: the card draws the
// Plain frame for it.
const catalogue = { items: catalogueItems<CatalogueRecord>(ROOT) };

const PLAIN_BORDER = '<rect x="1.0" y="1.0" width="298" height="110" rx="10" fill="none" stroke="#2A3352" stroke-width="2"></rect>';

function fail(message: string): never {
  console.error(`player-card-art: ${message}`);
  process.exit(1);
}

/** The card's svg (the first 300-wide svg in the item's body). */
function cardSvg(html: string, file: string): { style: string; inner: string } {
  const body = html.slice(html.indexOf("<body>"));
  const m = /<svg width="300" height="112" viewBox="0 0 300 112" role="img" aria-label="Player card" style="([^"]*)">([\s\S]*?)<\/svg><div style="position: absolute/.exec(body);
  if (!m) fail(`${file}: no card svg`);
  return { style: m[1]!.trim(), inner: m[2]! };
}

/** Splits the leading `<defs>` (the card's gradient and clip) and the plain background group off. */
function splitBackground(inner: string, file: string): { defs: string; background: string; rest: string } {
  const m = /^(<defs>[\s\S]*?<\/defs>)(<g clip-path="url\(#pc\d+c\)">[\s\S]*?<\/g>)/.exec(inner);
  if (!m) fail(`${file}: no background group`);
  return { defs: m[1]!, background: m[2]!, rest: inner.slice(m[0].length) };
}

/** Every id in a piece becomes `{{p}}<id>`, and every reference to it follows. */
function prefixIds(markup: string): string {
  const ids = [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
  let out = markup;
  for (const id of new Set(ids)) {
    const safe = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out
      .replace(new RegExp(`\\sid="${safe}"`, "g"), ` id="{{p}}${id}"`)
      .replace(new RegExp(`url\\(#${safe}\\)`, "g"), `url(#{{p}}${id})`)
      .replace(new RegExp(`href="#${safe}"`, "g"), `href="#{{p}}${id}"`);
  }
  return out;
}

/** CSS pixel lengths as card units (one card pixel = var(--pc-u)). */
function toUnits(css: string): string {
  return css.replace(/(-?\d*\.?\d+)px/g, (_, n: string) => `calc(${n} * var(--pc-u))`);
}

/** A style attribute as a React style object (camelCased keys; vendor prefixes kept as Webkit…). */
function styleObject(style: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of style.split(/;(?![^(]*\))/)) {
    const i = part.indexOf(":");
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    if (!key || !value) continue;
    const camel = key.replace(/^-webkit-/, "Webkit-").replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = value;
  }
  return out;
}

const cardArts: Record<string, string> = {};
const frames: Record<string, { markup: string; style: Record<string, string> }> = {};
const names: Record<string, { className: string; style: Record<string, string> }> = {};
const animated: string[] = [];
let css = "";

for (const item of catalogue.items) {
  if (!["card-art", "frame", "name-colour"].includes(item.kind) || !item.html) continue;
  const file = join(item.dir, item.html);
  const html = readFileSync(join(ROOT, file), "utf8");
  if (!css) css = /<style>([\s\S]*?)<\/style>/.exec(html)![1]!;
  if (item.animated) animated.push(item.id);
  const svg = cardSvg(html, file);
  const parts = splitBackground(svg.inner, file);
  if (item.kind === "card-art") {
    if (!parts.rest.endsWith(PLAIN_BORDER)) fail(`${file}: the card art does not end on the plain border`);
    if (svg.style !== "display: block") fail(`${file}: unexpected card-art svg style "${svg.style}"`);
    cardArts[item.id] = prefixIds(parts.defs + parts.background + parts.rest.slice(0, -PLAIN_BORDER.length));
  } else if (item.kind === "frame") {
    let markup = parts.defs + parts.rest;
    const founder = /FOUNDER #\d{4}/g;
    if (item.id === "frame.founding") {
      if (!founder.test(markup)) fail(`${file}: no "FOUNDER #nnnn" to make a token`);
      markup = markup.replace(founder, "FOUNDER {{founder}}");
    }
    const style = styleObject(svg.style);
    delete style["display"];
    frames[item.id] = { markup: prefixIds(markup), style };
  } else {
    const body = html.slice(html.indexOf("<body>"));
    const m = /flex-direction: column; gap: 1px">(<span(?: class="([^"]*)")? style="([^"]*)">)SkyRacer<\/span>/.exec(body);
    if (!m) fail(`${file}: no name span`);
    const style = styleObject(toUnits(m[3]!));
    names[item.id] = { className: m[2] ?? "", style };
  }
}

/* The motion: the card-art board's own rules, scoped to the card. */
function scopeCss(source: string): string {
  const keep = source
    .split("\n")
    .filter((line) => /\.(lg-|nc-)|@keyframes (lg|nc)/.test(line) || /prefers-reduced-motion[^{]*\{\.(lg|nc)-/.test(line))
    .join("\n");
  const scoped = keep
    // keyframe names
    .replace(/@keyframes (\w+)/g, "@keyframes pc-$1")
    .replace(/animation:([^;}]+)/g, (_, v: string) => `animation:${v.replace(/\b(lg|nc)([A-Z]\w*)/g, "pc-$1$2")}`)
    // selectors: every class selector list inside a rule head gets the card's scope
    .replace(/(^|[{}])\s*((?:\.[\w-]+(?:\.[\w-]+)*\s*,?\s*)+)\{/gm, (_, lead: string, sel: string) =>
      `${lead}${sel
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => `.pcard ${s}`)
        .join(",")}{`,
    );
  return scoped;
}
const motionCss = scopeCss(css);
if (!/prefers-reduced-motion/.test(motionCss)) fail("no reduced-motion rules kept");

/* Avatars: each svg's main gradient made a template (the three stops), its ids prefixed. */
type AvatarRecord = { slug: string; name: string; kind: string; defaultMain: string; accent: string };
const avatarList = JSON.parse(readFileSync(join(AVATARS, "avatars.json"), "utf8")) as {
  avatars: AvatarRecord[];
  gems: Record<string, { stars: number; stops: string[] }>;
};
const avatars: { id: string; name: string; defaultMain: string; svg: string }[] = [];
for (const a of avatarList.avatars) {
  const file = join("docs/art/avatars/svg", `${a.slug}.svg`);
  let svg = readFileSync(join(ROOT, file), "utf8").trim();
  const grad = /<linearGradient id='(av\d+m)'[^>]*><stop offset='0' stop-color='(#[0-9A-F]{6})'><\/stop><stop offset='0.5' stop-color='(#[0-9A-F]{6})'><\/stop><stop offset='1' stop-color='(#[0-9A-F]{6})'><\/stop><\/linearGradient>/i.exec(
    svg,
  );
  if (!grad) fail(`${file}: no main-colour gradient`);
  if (grad[3]!.toUpperCase() !== a.defaultMain.toUpperCase()) fail(`${file}: the gradient's middle stop is not its default main colour`);
  svg = svg.replace(grad[0], grad[0].replace(grad[2]!, "{{m0}}").replace(grad[3]!, "{{m1}}").replace(grad[4]!, "{{m2}}"));
  // The outer element's size comes from the component; the drawing keeps its viewBox.
  svg = svg.replace(/^<svg [^>]*?viewBox='([^']+)'[^>]*>/, (_, vb: string) => `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}' width='100%' height='100%' style='overflow: visible' aria-hidden='true'>`);
  svg = svg.replace(/'/g, '"');
  avatars.push({ id: a.slug, name: a.name, defaultMain: a.defaultMain, svg: prefixIds(svg) });
}
const gems = Object.entries(avatarList.gems).map(([name, g]) => ({
  id: name.toLowerCase().replace(/\s+/g, "-"),
  name,
  stops: g.stops,
}));

/*
 * The card's own chrome, copied from the sources' sample layout (the overlay div, the name and the pill) in card
 * units: the avatar 58 at 14 from the left, 12 apart, the name 18 / 800 white with its dark shadow, the dark pill
 * (rgba(6,8,15,0.72), a 12 % white edge). Silkscreen (Electric Orange's pixel face, OFL) is self-hosted in
 * public/fonts and asked for only by that name colour.
 */
const chromeCss = [
  `@font-face{font-family:"Silkscreen";font-style:normal;font-weight:700;font-display:swap;src:url("/fonts/silkscreen-700-latin.woff2") format("woff2")}`,
  `.pcard{position:relative;width:100%;aspect-ratio:300/112;container-type:inline-size;overflow:visible}`,
  `.pcard-in{position:absolute;inset:0;--pc-u:calc(100cqw / 300);font-family:Archivo,system-ui,sans-serif}`,
  `.pcard-svg{position:absolute;inset:0;display:block;width:100%;height:100%;overflow:visible}`,
  `.pcard-row{position:absolute;left:calc(14 * var(--pc-u));right:calc(14 * var(--pc-u));top:0;bottom:0;display:flex;align-items:center;gap:calc(12 * var(--pc-u))}`,
  `.pcard-av{flex:none;width:calc(58 * var(--pc-u));height:calc(58 * var(--pc-u))}`,
  `.pcard-av>svg{display:block;width:100%;height:100%;overflow:visible}`,
  `.pcard-initial{display:flex;align-items:center;justify-content:center;border-radius:999px;background:var(--pc-badge);color:#0B0B0F;font-weight:800;font-size:calc(28 * var(--pc-u));line-height:1;box-shadow:0 0 0 calc(3 * var(--pc-u)) #06080F}`,
  `.pcard-text{display:flex;min-width:0;flex-direction:column;gap:calc(1 * var(--pc-u))}`,
    // The name's box clips for the ellipsis, so it is padded by the widest glow (16 px) and pulled back by the same, with
  // a gradient name's background kept to its text box (background-origin), so glows and strokes are never cut.
  `.pcard-name{display:block;box-sizing:border-box;max-width:calc(100% + 36 * var(--pc-u));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;line-height:normal;padding:calc(18 * var(--pc-u));margin:calc(-18 * var(--pc-u));background-origin:content-box !important}`,
  `.pcard-name[data-plain]{font-weight:800;font-size:calc(18 * var(--pc-u));color:#FFFFFF;text-shadow:0 calc(1 * var(--pc-u)) calc(3 * var(--pc-u)) #000}`,
  `.pcard-title{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700;font-size:calc(12 * var(--pc-u));line-height:normal;color:#E2C07A;text-shadow:0 calc(1 * var(--pc-u)) calc(3 * var(--pc-u)) #000}`,
  `.pcard-pill{display:inline-flex;align-items:center;gap:calc(8 * var(--pc-u));margin-top:calc(3 * var(--pc-u));padding:calc(3 * var(--pc-u)) calc(9 * var(--pc-u)) calc(3 * var(--pc-u)) calc(8 * var(--pc-u));border-radius:999px;background:rgba(6,8,15,0.72);border:1px solid rgba(255,255,255,0.12);align-self:flex-start;white-space:nowrap}`,
  `.pcard-pill-value{font-weight:900;font-size:calc(15 * var(--pc-u));line-height:normal;color:#FFFFFF;font-variant-numeric:tabular-nums;letter-spacing:0.01em}`,
  `.pcard-pill-label{font-weight:800;font-size:calc(13 * var(--pc-u));line-height:1.2;color:#C79BFF}`,
].join("\n");

const banner = `/* Generated by scripts/player-card-art.ts from docs/art/wave-2/items and docs/art/avatars. Do not edit. */\n`;
const text =
  banner +
  `export const CARD_ARTS: Record<string, string> = ${JSON.stringify(cardArts, null, 1)};\n\n` +
  `export const FRAMES: Record<string, { markup: string; style: Record<string, string> }> = ${JSON.stringify(frames, null, 1)};\n\n` +
  `export const NAME_COLOURS: Record<string, { className: string; style: Record<string, string> }> = ${JSON.stringify(names, null, 1)};\n\n` +
  `/** Items that move (catalogue.json "animated"), plus the Neon Circuit frame (decided 10 Nov). */\n` +
  `export const ANIMATED_ITEMS: readonly string[] = ${JSON.stringify(animated)};\n\n` +
  `/** The 32 game avatars: their drawing with the main colour's three stops as {{m0}} {{m1}} {{m2}}. */\n` +
  `export const AVATARS: readonly { id: string; name: string; defaultMain: string; svg: string }[] = ${JSON.stringify(avatars, null, 1)};\n\n` +
  `/** The ten gem colours (earned with mastery stars; locked until C1 adds the unlocks). */\n` +
  `export const GEMS: readonly { id: string; name: string; stops: readonly string[] }[] = ${JSON.stringify(gems)};\n\n` +
  `/** The card's layout and pill, from the sources' sample layout (card units). */\n` +
  `export const CARD_CHROME_CSS = ${JSON.stringify(chromeCss)};\n\n` +
  `/** The items' motion, scoped to the card; every rule stops under prefers-reduced-motion. */\n` +
  `export const CARD_MOTION_CSS = ${JSON.stringify(motionCss)};\n`;

if (process.argv.includes("--check")) {
  const now = readFileSync(OUT, "utf8");
  if (now !== text) fail(`${OUT} is not what the sources build: run bun scripts/player-card-art.ts`);
  console.log("player-card-art: up to date");
} else {
  writeFileSync(OUT, text);
  console.log(
    `player-card-art: ${Object.keys(cardArts).length} card arts, ${Object.keys(frames).length} frames, ${Object.keys(names).length} name colours, ${avatars.length} avatars → ${OUT}`,
  );
}
