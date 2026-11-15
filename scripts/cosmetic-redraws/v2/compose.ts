/**
 * The second pass's card compositions (docs/design/cosmetics-redraws/ART-DIRECTION.md): every card art and frame is a
 * Blender render (docs/design/cosmetics-redraws/blender/<script>.py → public/cosmetics/redrawn/<id>.webp) placed in
 * the card's svg by these two composers, so every item follows the same rules:
 *
 * - a card art is the whole scene across the card, the name side darkened gently, and a strip veil
 *   (`pc-strip-veil`, drawn only on the leaderboard strip, where the whole card is squeezed into one row and the
 *   name runs most of its width) darkening everything under the name;
 * - a frame is its render laid over the card (a 10-unit margin for its shadow and ornaments), with optional live
 *   plaque text (`pc-full-only`, the full card's only: never on the strip) and an optional glint masked to the metal.
 *
 * Each kind's items are listed in their own file (card-arts.ts, frames.ts), merged by registry.ts.
 */

export interface V2Art {
  /** How dark the name side is at the far left (0–1); the falloff reaches 0 by `shadeTo` of the card's width. */
  shade?: number;
  shadeTo?: number;
  /** A slow light sweep across the card (prestige only). */
  sweep?: boolean;
  /** A slow flash over the whole card (a storm's lightning, prestige only), its colour. */
  flash?: string;
}

export interface V2Frame {
  /** Live words on the frame's plaque, drawn on the full card only: [text, x, y, size, colour]. `{{founder}}` = the player's number. */
  plaque?: readonly [string, number, number, number, string][];
  /** A light running over the metal (the frame's own alpha masks it). */
  glint?: boolean;
  /** Twinkling sparkles on the frame's gems (15 Nov 2026, Joe: the special frames sparkle): [x, y, size] in card units. */
  twinkle?: readonly [number, number, number][];
}

const IMG = (piece: string) => `/cosmetics/redrawn/${piece}.webp`;

/** The strip rules every v2 card piece shares (added with any switched-on piece). */
export const STRIP_CSS = `.pcard .pc-strip-veil{display:none}.pcard.pcard-strip .pc-strip-veil{display:inline}.pcard.pcard-strip .pc-full-only{display:none}`;

export function v2ArtMarkup(id: string, d: V2Art): string {
  const p = "{{p}}";
  const shade = d.shade ?? 0.55;
  const to = d.shadeTo ?? 0.62;
  return (
    `<defs><clipPath id="${p}c"><rect width="300" height="112" rx="10"></rect></clipPath>` +
    `<linearGradient id="${p}sh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#06080F" stop-opacity="${shade}"></stop><stop offset="${(to * 0.55).toFixed(2)}" stop-color="#06080F" stop-opacity="${(shade * 0.55).toFixed(2)}"></stop><stop offset="${to}" stop-color="#06080F" stop-opacity="0"></stop></linearGradient>` +
    `<linearGradient id="${p}veil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#06080F" stop-opacity="0.72"></stop><stop offset="0.72" stop-color="#06080F" stop-opacity="0.66"></stop><stop offset="0.92" stop-color="#06080F" stop-opacity="0.25"></stop><stop offset="1" stop-color="#06080F" stop-opacity="0.1"></stop></linearGradient>` +
    (d.sweep ? `<linearGradient id="${p}sw" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.16"></stop><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"></stop></linearGradient>` : "") +
    `</defs><g clip-path="url(#${p}c)">` +
    `<image href="${IMG(id)}" x="0" y="0" width="300" height="112" preserveAspectRatio="xMidYMid slice"></image>` +
    `<rect width="300" height="112" fill="url(#${p}sh)"></rect>` +
    (d.flash ? `<rect class="rd2-flash" width="300" height="112" fill="${d.flash}" opacity="0"></rect>` : "") +
    (d.sweep ? `<g class="rd2-sweep"><rect x="-60" y="-20" width="46" height="160" fill="url(#${p}sw)" transform="skewX(-22)"></rect></g>` : "") +
    `<rect class="pc-strip-veil" width="300" height="112" fill="url(#${p}veil)"></rect>` +
    `</g>`
  );
}

export function v2ArtCss(d: V2Art): string {
  return [
    STRIP_CSS,
    d.sweep
      ? `.pcard .rd2-sweep{animation:pc-rd2Sweep 6s ease-in-out infinite}@keyframes pc-rd2Sweep{0%{transform:translateX(-60px)}60%,100%{transform:translateX(480px)}}@media (prefers-reduced-motion: reduce){.pcard .rd2-sweep{animation:none;opacity:0}}`
      : "",
    d.flash
      ? `.pcard .rd2-flash{animation:pc-rd2Flash 7s linear infinite}@keyframes pc-rd2Flash{0%,90%,100%{opacity:0}91%{opacity:.22}92%{opacity:.04}93.5%{opacity:.16}96%{opacity:0}}@media (prefers-reduced-motion: reduce){.pcard .rd2-flash{animation:none;opacity:0}}`
      : "",
  ].join("");
}

export function v2FrameMarkup(id: string, d: V2Frame): string {
  const p = "{{p}}";
  const img = `<image href="${IMG(id)}" x="-10" y="-10" width="320" height="132"></image>`;
  const plaque = (d.plaque ?? [])
    .map(
      ([t, x, y, size, colour]) =>
        `<text class="pc-full-only" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Archivo, system-ui, sans-serif" font-weight="800" font-size="${size}" letter-spacing="0.08em" fill="${colour}">${t}</text>`,
    )
    .join("");
  const glint = d.glint
    ? `<defs><mask id="${p}fm" style="mask-type: alpha">${img}</mask><linearGradient id="${p}gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="0.5" stop-color="#FFF6DA" stop-opacity="0.95"></stop><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"></stop></linearGradient></defs><g mask="url(#${p}fm)"><g class="rd2-glint"><rect x="-40" y="-20" width="40" height="160" fill="url(#${p}gl)" transform="skewX(-20)"></rect></g></g>`
    : "";
  const twinkle = (d.twinkle ?? [])
    .map(([x, y, r], i) => {
      const q = r * 0.22;
      return `<path class="rd2-tw" style="animation-delay:${((i * 0.73) % 2.9).toFixed(2)}s;transform-origin:${x}px ${y}px" d="M${x} ${y - r}L${x + q} ${y - q}L${x + r} ${y}L${x + q} ${y + q}L${x} ${y + r}L${x - q} ${y + q}L${x - r} ${y}L${x - q} ${y - q}Z" fill="#FFF8E6"></path>`;
    })
    .join("");
  return img + glint + twinkle + plaque;
}

export function v2FrameCss(d: V2Frame): string {
  return [
    STRIP_CSS,
    d.glint
      ? `.pcard .rd2-glint{animation:pc-rd2Glint 4.6s ease-in-out infinite}@keyframes pc-rd2Glint{0%{transform:translateX(-40px)}55%,100%{transform:translateX(420px)}}@media (prefers-reduced-motion: reduce){.pcard .rd2-glint{animation:none;opacity:0}}`
      : "",
    d.twinkle?.length
      ? `.pcard .rd2-tw{opacity:0;animation:pc-rd2Tw 2.9s ease-in-out infinite}@keyframes pc-rd2Tw{0%,62%,100%{opacity:0;transform:scale(.3) rotate(0deg)}74%{opacity:1;transform:scale(1) rotate(22deg)}86%{opacity:0;transform:scale(.4) rotate(45deg)}}@media (prefers-reduced-motion: reduce){.pcard .rd2-tw{animation:none;opacity:0}}`
      : "",
  ].join("");
}
