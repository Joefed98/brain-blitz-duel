/**
 * Builds the remaining wave 2 cosmetics' art (session E2) from the approved sources, exactly as drawn:
 * docs/art/wave-2/items/{avatar-finish, avatar-accessory, avatar-special-edition, reaction, celebration,
 * tile-style}/<name>.html → src/design/identity/cosmeticsArt.data.ts.
 *
 * Every finish, the accessory and the special edition are drawn on the board on Captain Joulz (ids hvN…); the build
 * splits each into the parts that apply to ANY of the 32 avatars (cosmetics.ts applies them):
 *   - `paint`: what the avatar's main colour becomes (a gradient or pattern of the finish's own, a flat colour, or
 *     null: the player's colour kept, as Neon Glow does);
 *   - `defs`: the finish's own gradients and patterns;
 *   - `stroke`: the main shapes' outline when the finish changes it (Comic Ink's thick ink, Wireframe's cyan line);
 *   - `shadow`: Comic Ink's offset ink shadow under the main shapes;
 *   - `overlay`: the texture drawn over the main shapes and clipped to them (Carbon's sheen, Comic Ink's halftone,
 *     Holographic's foil stripes, Wireframe's grid);
 *   - `filter`: the glow on the whole figure;
 *   - `outer`: what sits outside the avatar's circle (Lightning Core's ring and arcs, the Neon Bolt);
 *   - `wire`: Wireframe draws the figure's other shapes as outlines.
 * Reactions: each pack's emotes (one svg each). Celebrations: the 240 × 150 scene with the sample podium avatar kept
 * as `sample` and its place a token, so the app can draw the winner's own avatar and place in it. Tile styles: the
 * tile's own background (`back`) and the sample game glyph (`sample`), so Practice draws the game's own scene where
 * the glyph was. Ids become `{{p}}<id>` (one prefix per drawing). The motion rules (`.lg-*`, `.cl-*`) are scoped to
 * `.jzc` with keyframes `jzc-…`, every one stopping under prefers-reduced-motion as the sources say.
 *
 *   bun scripts/cosmetics-art.ts           writes the data file
 *   bun scripts/cosmetics-art.ts --check   fails if the file is not what the sources build
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..");
const OUT = join(ROOT, "src/design/identity/cosmeticsArt.data.ts");
const KINDS = ["avatar-finish", "avatar-accessory", "avatar-special-edition", "reaction", "celebration", "tile-style"] as const;

type Record_ = { id: string; name: string; kind: string; html: string; png: string; animated: boolean; rarity: string | null; finish_or_note: string | null };
const catalogue = (JSON.parse(readFileSync(join(ROOT, "docs/art/wave-2/catalogue.json"), "utf8")) as { items: Record_[] }).items;

function fail(message: string): never {
  console.error(`cosmetics-art: ${message}`);
  process.exit(1);
}

/** The item's drawing: the inside of its board tile (`<div … data-item="N">…</div>`). */
function itemBody(html: string, file: string): { wrapper: string; inner: string } {
  const m = /(<div style="[^"]*" data-item="\d+">)([\s\S]*)<\/div>\s*<\/body>/.exec(html);
  if (!m) fail(`${file}: no item tile`);
  return { wrapper: m[1]!, inner: m[2]! };
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

/** The board's helmet path (Captain Joulz's main shape): the finishes' main shape and clip. */
const HELMET = "M28 54c0-15 9-26 22-26s22 11 22 26c0 11-8 18-22 21-14-3-22-10-22-21z";
const WASH = '<circle cx="50" cy="52" r="38" fill="#06080F" opacity="0.25"></circle>';

interface Finish {
  paint: string | null;
  defs: string;
  stroke: { colour: string; width: number } | null;
  shadow: boolean;
  overlay: string | null;
  filter: string | null;
  outer: string;
  wire: boolean;
}

/** Splits a board avatar (finish, accessory) into its parts. */
function splitBoardAvatar(svg: string, file: string): { extraDefs: string; figureStyle: string; figure: string; outer: string; n: string } {
  const head = /^<svg width="104" height="104" viewBox="0 0 100 100" role="img" aria-label="avatar" style="overflow: visible"><defs>([\s\S]*?)<\/defs>/.exec(svg);
  if (!head) fail(`${file}: not a board avatar`);
  const n = /id="hv(\d+)c"/.exec(head[1]!)?.[1];
  if (!n) fail(`${file}: no hv id`);
  const standard =
    `<clipPath id="hv${n}c"><circle cx="50" cy="50" r="48"></circle></clipPath>` +
    `<clipPath id="hv${n}b"><path d="${HELMET}"></path></clipPath>` +
    `<linearGradient id="hv${n}m" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#FFA3E5"></stop><stop offset="0.5" stop-color="#FF6BD6"></stop><stop offset="1" stop-color="#B74D9A"></stop></linearGradient>`;
  if (!head[1]!.startsWith(standard)) fail(`${file}: unexpected defs`);
  const extraDefs = head[1]!.slice(standard.length);
  const washAt = svg.indexOf(WASH);
  if (washAt < 0) fail(`${file}: no wash circle`);
  const after = svg.slice(washAt + WASH.length);
  const fig = /^<g style="([^"]*)">([\s\S]*?)<\/g><\/g>([\s\S]*)<\/svg>$/.exec(after);
  if (!fig) fail(`${file}: no figure group`);
  return { extraDefs, figureStyle: fig[1]!, figure: fig[2]!, outer: fig[3]!, n };
}

const VISOR = '<path d="M34 47h32l-3 9-8-3-5 6-5-6-8 3z" fill="#22E4FF" stroke="#06080F" stroke-width="2" stroke-linejoin="round"></path>';
const VISOR_WIRE = '<path d="M34 47h32l-3 9-8-3-5 6-5-6-8 3z" fill="none" stroke="#22E4FF" stroke-width="2" stroke-linejoin="round"></path>';
const ANTENNAE = '<path d="M44 33v8M50 30v10M56 33v8" stroke="#22E4FF" stroke-opacity="0.5" stroke-width="2" stroke-linecap="round"></path>';

function filterOf(style: string, file: string): string | null {
  if (!style) return null;
  const m = /^filter: (.+)$/.exec(style);
  if (!m) fail(`${file}: unexpected figure style "${style}"`);
  return m[1]!;
}

function buildFinish(svg: string, file: string): Finish {
  const { extraDefs, figureStyle, figure, outer, n } = splitBoardAvatar(svg, file);
  // The figure: [shadow] main [overlay] visor antennae.
  const tail = figure.endsWith(VISOR + ANTENNAE) ? VISOR + ANTENNAE : figure.endsWith(VISOR_WIRE + ANTENNAE) ? VISOR_WIRE + ANTENNAE : null;
  if (!tail) fail(`${file}: the figure does not end on the visor and antennae`);
  let rest = figure.slice(0, -tail.length);
  const shadowPath = `<path d="${HELMET}" fill="#06080F" transform="translate(3 3)"></path>`;
  const shadow = rest.startsWith(shadowPath);
  if (shadow) rest = rest.slice(shadowPath.length);
  const main = new RegExp(`^<path d="${HELMET.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" fill="([^"]+)" stroke="([^"]+)" stroke-width="([\\d.]+)"></path>`).exec(rest);
  if (!main) fail(`${file}: no main shape`);
  rest = rest.slice(main[0].length);
  let overlay: string | null = null;
  if (rest) {
    const o = new RegExp(`^<g clip-path="url\\(#hv${n}b\\)">([\\s\\S]*)</g>$`).exec(rest);
    if (!o) fail(`${file}: unexpected figure part`);
    overlay = o[1]!;
  }
  const fill = main[1]!;
  const paint = fill === `url(#hv${n}m)` ? null : fill;
  const stroke = main[2] === "#06080F" && main[3] === "3" ? null : { colour: main[2]!, width: Number(main[3]) };
  // The finish's own ids get a stable name of their own (fxN…), independent of the board's numbering.
  const rename = (markup: string) =>
    markup
      .replace(new RegExp(`hv${n}`, "g"), "fx")
      .replace(/\sid="fx/g, ' id="{{p}}fx')
      .replace(/url\(#fx/g, "url(#{{p}}fx");
  // A glow in the board's sample colour (#FF6BD6, Captain Joulz's own pink) follows the player's main colour.
  const filter = filterOf(figureStyle, file);
  return {
    paint: paint ? rename(paint) : null,
    defs: rename(extraDefs),
    stroke,
    shadow,
    overlay: overlay ? rename(overlay) : null,
    filter: filter ? filter.replaceAll("#FF6BD6", "{{m1}}") : null,
    outer: rename(outer),
    wire: tail.startsWith(VISOR_WIRE),
  };
}

const finishes: Record<string, Finish> = {};
const accessories: Record<string, string> = {};
const specials: Record<string, string> = {};
const reactions: Record<string, { svg: string; label: string }[]> = {};
const celebrations: Record<string, { svg: string; sample: string }> = {};
const tiles: Record<string, { back: string; front: string; sample: string }> = {};
const wrappers: Record<string, string> = {};
const animated: string[] = [];

for (const item of catalogue.filter((i) => (KINDS as readonly string[]).includes(i.kind))) {
  const file = join("docs/art/wave-2", item.html);
  const html = readFileSync(join(ROOT, file), "utf8");
  const { wrapper, inner } = itemBody(html, file);
  wrappers[item.id] = wrapper;
  if (item.animated || /class="(lg|cl)-/.test(inner)) animated.push(item.id);
  if (item.kind === "avatar-finish") {
    finishes[item.id] = buildFinish(inner, file);
  } else if (item.kind === "avatar-accessory") {
    const { figure, outer } = splitBoardAvatar(inner, file);
    if (figure !== `<path d="${HELMET}" fill="url(#hv9m)" stroke="#06080F" stroke-width="3"></path>${VISOR}${ANTENNAE}`)
      fail(`${file}: the accessory's avatar is not the plain helmet`);
    accessories[item.id] = prefixIds(outer);
  } else if (item.kind === "avatar-special-edition") {
    // A whole avatar of its own: the outer element sized by the component, its ids prefixed.
    const svg = inner.replace(
      /^<svg width="104" height="104" viewBox="0 0 100 100" role="img" aria-label="avatar" style="overflow: visible">/,
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style="overflow: visible" aria-hidden="true">',
    );
    if (svg === inner) fail(`${file}: not a board avatar`);
    specials[item.id] = prefixIds(svg);
  } else if (item.kind === "reaction") {
    const emotes = [...inner.matchAll(/<svg [\s\S]*?<\/svg>/g)].map((m) => m[0]);
    if (!emotes.length) fail(`${file}: no emotes`);
    reactions[item.id] = emotes.map((svg) => {
      // The emote's words (its text elements), or the pack's name for a drawn one: the button's accessible name.
      const words = [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((t) => t[1]!.trim()).filter(Boolean);
      return { svg: prefixIds(svg), label: words.join(" ") || item.name };
    });
  } else if (item.kind === "celebration") {
    // The sample podium's avatar (a circle, a helmet and a visor round (120, 74)) and its "1st".
    const sample =
      '<circle cx="120" cy="74" r="18" fill="#1E2640" stroke="#06080F" stroke-width="2"></circle>' +
      '<path d="M108 78c0-8 5-13 12-13s12 5 12 13c0 6-4 9-12 11-8-2-12-5-12-11z" fill="#FF6BD6" stroke="#06080F" stroke-width="1.5"></path>' +
      '<path d="M111 74h18l-2 5-4-2-3 3-3-3-4 2z" fill="#22E4FF"></path>';
    if (!inner.includes(sample)) fail(`${file}: no sample podium avatar`);
    if ((inner.match(/>1st</g) ?? []).length !== 1) fail(`${file}: not one "1st"`);
    const svg = inner
      .replace(/^<svg width="240" height="150" viewBox="0 0 240 150" role="img" aria-label="celebration" style="display: block">/, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150" width="100%" height="100%" style="display: block" aria-hidden="true">')
      .replace(sample, "{{avatar}}")
      .replace(">1st<", ">{{place}}<");
    if (!svg.startsWith('<svg xmlns=')) fail(`${file}: not a celebration scene`);
    celebrations[item.id] = { svg: prefixIds(svg), sample };
  } else if (item.kind === "tile-style") {
    const m = /^<svg width="90" height="90" viewBox="0 0 90 90" aria-hidden="true" style="overflow: visible">([\s\S]*)<\/svg>$/.exec(inner);
    if (!m) fail(`${file}: not a 90 × 90 tile`);
    // The sample game glyph: the 3 × 3 grid of 9 px squares at 29, 41 and 53. What the board draws after it (Blueprint's
    // "A-01") stays on top of the game's scene.
    const glyph = /(?:<rect x="(?:29|41|53)" y="(?:29|41|53)" width="9" height="9"[^>]*><\/rect>){9}/.exec(m[1]!);
    if (!glyph) fail(`${file}: no 3 × 3 sample glyph`);
    const at = glyph.index;
    tiles[item.id] = {
      back: prefixIds(m[1]!.slice(0, at)),
      front: prefixIds(m[1]!.slice(at + glyph[0].length)),
      sample: glyph[0],
    };
  }
}

/* The motion: the sources' own rules, scoped to the cosmetic's wrapper `.jzc`. */
const firstHtml = readFileSync(join(ROOT, "docs/art/wave-2", catalogue.find((i) => i.kind === "reaction")!.html), "utf8");
const css = /<style>([\s\S]*?)<\/style>/.exec(firstHtml)![1]!;
const motionCss = css
  .split("\n")
  .filter((line) => /\.(lg|cl)-|@keyframes (lg|cl)/.test(line))
  .join("\n")
  .replace(/@keyframes (\w+)/g, "@keyframes jzc-$1")
  .replace(/animation:([^;}]+)/g, (_, v: string) => `animation:${v.replace(/\b(lg|cl)([A-Z]\w*)/g, "jzc-$1$2")}`)
  .replace(/(^|[{}])\s*((?:\.[\w-]+(?:\.[\w-]+)*\s*,?\s*)+)\{/gm, (_, lead: string, sel: string) =>
    `${lead}${sel
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => `.jzc ${s}`)
      .join(",")}{`,
  );
if (!/prefers-reduced-motion/.test(motionCss)) fail("no reduced-motion rules kept");
// A cosmetic that has played its moment (a celebration after its few seconds) rests on its still, as Reduce Motion.
const restCss = `.jzc[data-rest] *{animation:none !important}.jzc[data-rest] .lg-zap{opacity:.8}`;

const banner = `/* Generated by scripts/cosmetics-art.ts from docs/art/wave-2/items. Do not edit. */\n`;
const text =
  banner +
  `export interface FinishArt {\n  paint: string | null;\n  defs: string;\n  stroke: { colour: string; width: number } | null;\n  shadow: boolean;\n  overlay: string | null;\n  filter: string | null;\n  outer: string;\n  wire: boolean;\n}\n\n` +
  `/** Avatar finishes, as parts any avatar can take (cosmetics.ts). */\n` +
  `export const FINISHES: Record<string, FinishArt> = ${JSON.stringify(finishes, null, 1)};\n\n` +
  `/** Avatar accessories: drawn outside the avatar's circle. */\n` +
  `export const ACCESSORIES: Record<string, string> = ${JSON.stringify(accessories, null, 1)};\n\n` +
  `/** Special-edition avatars: a whole drawing in place of the avatar. */\n` +
  `export const SPECIAL_EDITIONS: Record<string, string> = ${JSON.stringify(specials, null, 1)};\n\n` +
  `/** Reaction packs: their emotes, each an svg and its words. */\n` +
  `export const REACTIONS: Record<string, readonly { svg: string; label: string }[]> = ${JSON.stringify(reactions, null, 1)};\n\n` +
  `/** Celebrations: the 240 × 150 scene, {{avatar}} where the podium's avatar goes, {{place}} its place; the board's sample avatar. */\n` +
  `export const CELEBRATIONS: Record<string, { svg: string; sample: string }> = ${JSON.stringify(celebrations, null, 1)};\n\n` +
  `/** Tile styles: the 90 × 90 tile's background, what it draws over the game, and the board's sample game glyph. */\n` +
  `export const TILE_STYLES: Record<string, { back: string; front: string; sample: string }> = ${JSON.stringify(tiles, null, 1)};\n\n` +
  `/** Each item's board tile (its wrapper div), for the checks' side-by-side with the approved stills. */\n` +
  `export const BOARD_WRAPPERS: Record<string, string> = ${JSON.stringify(wrappers, null, 1)};\n\n` +
  `/** Celebrations that are podium entrances (catalogue "podium entrance"; their own loadout slot). */\n` +
  `export const PODIUM_ENTRANCES: readonly string[] = ${JSON.stringify(catalogue.filter((i) => i.kind === "celebration" && i.finish_or_note === "podium entrance").map((i) => i.id))};\n\n` +
  `/** Items that move (catalogue "animated", or drawn with a motion class). */\n` +
  `export const ANIMATED_COSMETICS: readonly string[] = ${JSON.stringify(animated)};\n\n` +
  `/** The items' motion, scoped to .jzc; every rule stops under prefers-reduced-motion. */\n` +
  `export const COSMETICS_MOTION_CSS = ${JSON.stringify(`${motionCss}\n${restCss}`)};\n`;

if (process.argv.includes("--check")) {
  if (readFileSync(OUT, "utf8") !== text) fail(`${OUT} is not what the sources build: run bun scripts/cosmetics-art.ts`);
  console.log("cosmetics-art: up to date");
} else {
  writeFileSync(OUT, text);
  console.log(
    `cosmetics-art: ${Object.keys(finishes).length} finishes, ${Object.keys(accessories).length} accessory, ${Object.keys(specials).length} special edition, ${Object.keys(reactions).length} reaction packs, ${Object.keys(celebrations).length} celebrations, ${Object.keys(tiles).length} tile styles → ${OUT}`,
  );
}
