/**
 * The wave 2 cosmetics drawn on the art they belong to (session E2), from the approved sources cut by
 * scripts/cosmetics-art.ts (cosmeticsArt.data.ts):
 *
 * - an avatar finish on any of the 32 avatars: its main colour becomes the finish's paint, its outline and texture
 *   follow the finish, and the whole figure takes the finish's glow (`withFinish`);
 * - the accessory (Neon Bolt) above the avatar's circle; the special edition (Neon Captain Joulz) in the avatar's place;
 * - a reaction pack's emotes, a celebration's scene with the winner's own avatar and place, a tile style round a
 *   game's tile scene.
 *
 * Presentation only: nothing here is read by scoring, grading, replay, matchmaking or timing code. With nothing
 * equipped every function returns the avatar exactly as before. Every motion (`lg-*`, `cl-*`) is scoped to `.jzc` and
 * stops under prefers-reduced-motion (the sources' own rules, COSMETICS_MOTION_CSS).
 */
import {
  ACCESSORIES,
  CELEBRATIONS,
  COSMETICS_MOTION_CSS,
  FINISHES,
  REACTIONS,
  SPECIAL_EDITIONS,
  TILE_STYLES,
  type FinishArt,
} from "./cosmeticsArt.data";

export { ACCESSORIES, CELEBRATIONS, FINISHES, REACTIONS, SPECIAL_EDITIONS, TILE_STYLES };

/** What an avatar wears on top of its look: each an item id, or null. */
export interface AvatarCosmetics {
  finish?: string | null;
  accessory?: string | null;
  special?: string | null;
}

/** Whether any cosmetic here has art (an unknown id draws nothing, never an error). */
export function hasCosmetics(c: AvatarCosmetics | null | undefined): boolean {
  return !!c && (!!(c.finish && FINISHES[c.finish]) || !!(c.accessory && ACCESSORIES[c.accessory]) || !!(c.special && SPECIAL_EDITIONS[c.special]));
}

/* One <style> for every cosmetic on the page, added once. */
const STYLE_ID = "jz-cosmetics-css";
export function ensureCosmeticStyles(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = COSMETICS_MOTION_CSS;
  document.head.appendChild(el);
}

/* The approved art's own colours (docs/art/wave-2, docs/art/avatars): its ink and the Wireframe finish's line. */
const INK = "#06080F"; // design-lint-ignore: game avatar art, not page chrome
const WIRE = "#22E4FF"; // design-lint-ignore: game avatar art, not page chrome
const WASH = `<circle cx="50" cy="52" r="38" fill="${INK}" opacity="0.25"></circle>`;
const SHAPE = /<(path|circle|rect|ellipse|polygon|polyline|line)\b([^>]*)>(?:<\/\1>)?/g;

function setAttr(attrs: string, name: string, value: string): string {
  const re = new RegExp(`\\s${name}="[^"]*"`);
  return re.test(attrs) ? attrs.replace(re, ` ${name}="${value}"`) : `${attrs} ${name}="${value}"`;
}
function dropAttr(attrs: string, name: string): string {
  return attrs.replace(new RegExp(`\\s${name}="[^"]*"`, "g"), "");
}

/**
 * An avatar's filled svg with a finish applied. `prefix` is the drawing's id prefix; `m1` its main colour (a glow in
 * the board's sample pink follows it).
 */
export function withFinish(svg: string, finish: FinishArt, prefix: string, m1: string): string {
  const main = /\sid="([^"]*av\d+m)"/.exec(svg)?.[1];
  const washAt = svg.indexOf(WASH);
  const end = svg.lastIndexOf("</g></svg>");
  if (!main || washAt < 0 || end < washAt) return svg;
  const ref = `url(#${main})`;
  const p = (s: string) => s.replaceAll("{{p}}", prefix).replaceAll("{{m1}}", m1);
  const paint = finish.paint ? p(finish.paint) : null;
  const figure = svg.slice(washAt + WASH.length, end);
  const clipShapes: string[] = [];
  let lastMain = -1;
  let out = "";
  let at = 0;
  for (const m of figure.matchAll(SHAPE)) {
    const [whole, tag, rawAttrs] = m as unknown as [string, string, string];
    out += figure.slice(at, m.index);
    at = m.index! + whole.length;
    let attrs = rawAttrs;
    const mainFill = attrs.includes(`fill="${ref}"`);
    const mainStroke = attrs.includes(`stroke="${ref}"`);
    if (mainFill) {
      clipShapes.push(`<${tag}${dropAttr(dropAttr(dropAttr(dropAttr(attrs, "fill"), "stroke"), "stroke-width"), "opacity")}></${tag}>`);
      if (finish.shadow)
        out += `<g transform="translate(3 3)"><${tag}${setAttr(dropAttr(dropAttr(attrs, "stroke"), "stroke-width"), "fill", INK)}></${tag}></g>`;
      if (finish.stroke) attrs = setAttr(setAttr(attrs, "stroke", finish.stroke.colour), "stroke-width", String(finish.stroke.width));
    } else if (finish.wire) {
      const fill = /\sfill="([^"]*)"/.exec(attrs)?.[1];
      if (fill && fill !== "none" && !mainStroke) {
        attrs = setAttr(attrs, "fill", "none");
        attrs = setAttr(attrs, "stroke", WIRE);
        if (!/\sstroke-width="/.test(attrs)) attrs = setAttr(attrs, "stroke-width", "2");
      } else if (attrs.includes(` stroke="${INK}"`)) attrs = setAttr(attrs, "stroke", WIRE);
    }
    if (mainStroke) attrs = attrs.replace(`stroke="${ref}"`, `stroke="${finish.wire ? WIRE : (paint ?? ref)}"`);
    if (paint && mainFill) attrs = attrs.replace(`fill="${ref}"`, `fill="${paint}"`);
    out += `<${tag}${attrs}></${tag}>`;
    if (mainFill) lastMain = out.length;
  }
  out += figure.slice(at);
  if (finish.overlay && lastMain >= 0)
    out = `${out.slice(0, lastMain)}<g clip-path="url(#${prefix}fxb)">${p(finish.overlay)}</g>${out.slice(lastMain)}`;
  const body = finish.filter ? `<g style="filter: ${p(finish.filter)}">${out}</g>` : out;
  const clip = clipShapes.length ? `<clipPath id="${prefix}fxb">${clipShapes.join("")}</clipPath>` : "";
  const head = svg.slice(0, washAt + WASH.length).replace("</defs>", `${p(finish.defs)}${clip}</defs>`);
  return `${head}${body}</g>${p(finish.outer)}</svg>`;
}

/** The avatar's svg with its cosmetics on (the special edition in its place, the accessory above, the finish on it). */
export function dressAvatar(svg: string, cosmetics: AvatarCosmetics, prefix: string, m1: string): string {
  const special = cosmetics.special ? SPECIAL_EDITIONS[cosmetics.special] : undefined;
  let out = special ? special.replaceAll("{{p}}", `${prefix}se-`) : svg;
  const finish = !special && cosmetics.finish ? FINISHES[cosmetics.finish] : undefined;
  if (finish) out = withFinish(out, finish, `${prefix}`, m1);
  const accessory = cosmetics.accessory ? ACCESSORIES[cosmetics.accessory] : undefined;
  if (accessory) {
    const close = out.lastIndexOf("</svg>");
    out = `${out.slice(0, close)}${accessory.replaceAll("{{p}}", `${prefix}ac-`)}</svg>`;
  }
  return out;
}

/** A reaction pack's emotes (none for an unknown id). Emote code: `<pack id>#<index>`. */
export function reactionEmotes(packId: string): readonly { svg: string; label: string }[] {
  return REACTIONS[packId] ?? [];
}
export function emoteCode(packId: string, index: number): string {
  return `${packId}#${index}`;
}
/** An emote code's art, or null (not a pack, or past its emotes). */
export function emoteOf(code: string): { pack: string; index: number; svg: string; label: string } | null {
  const m = /^(reaction\.[a-z0-9-]+)#(\d)$/.exec(code);
  if (!m) return null;
  const e = REACTIONS[m[1]!]?.[Number(m[2])];
  return e ? { pack: m[1]!, index: Number(m[2]), ...e } : null;
}

/** A celebration's scene with this player's avatar (svg markup, drawn in the podium's 36 px circle) and place. */
export function celebrationScene(id: string, prefix: string, avatarSvg: string | null, place: string): string | null {
  const art = CELEBRATIONS[id];
  if (!art) return null;
  const avatar = avatarSvg
    ? `<svg x="102" y="56" width="36" height="36" viewBox="0 0 100 100" style="overflow: visible">${avatarSvg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</svg>`
    : art.sample;
  return art.svg.replaceAll("{{p}}", prefix).replace("{{avatar}}", avatar).replace("{{place}}", place);
}

/** A tile style round a game's tile scene: the 90 × 90 back, the scene where the sample glyph was, then the front. */
export function tileStyleArt(id: string, prefix: string): { back: string; front: string } | null {
  const art = TILE_STYLES[id];
  if (!art) return null;
  return { back: art.back.replaceAll("{{p}}", prefix), front: art.front.replaceAll("{{p}}", prefix) };
}
