/**
 * The redrawn avatar finishes, accessory, reaction packs, celebrations and tile style (phase 2 step 4), in the shapes
 * scripts/cosmetics-art.ts cuts from the approved sources (cosmeticsArt.data.ts), so cosmetics.ts applies them
 * unchanged. The art kit's finish: the accessory, every emote and the podium are 3D pieces from the kit's raymarcher
 * (docs/design/cosmetics-redraws/source); finishes are paints any of the 32 avatars takes, lit from the top left,
 * each with a polished rim round the avatar's circle so the finish reads at the card's size (the review: a finish
 * changed only a small helmet). Every motion is scoped to `.jzc` and stops under prefers-reduced-motion.
 */
import type { FinishArt } from "../../src/design/identity/cosmeticsArt.data";

const IMG = (piece: string) => `/cosmetics/redrawn/${piece}.webp`;

/* A polished rim on the avatar's circle (r 48): a band in the finish's own paint, its top-left lit. */
function rim(id: string, paint: string): string {
  return (
    `<circle cx="50" cy="50" r="49" fill="none" stroke="#06080F" stroke-width="5.5"></circle>` +
    `<circle cx="50" cy="50" r="49" fill="none" stroke="${paint}" stroke-width="3.6"></circle>` +
    `<circle cx="50" cy="50" r="49" fill="none" stroke="url(#{{p}}${id}rl)" stroke-width="3.6"></circle>`
  );
}
const RIM_LIGHT = (id: string) =>
  `<linearGradient id="{{p}}${id}rl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.8"></stop><stop offset="0.35" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="1" stop-color="#000000" stop-opacity="0.35"></stop></linearGradient>`;
/* The gloss on the finish's shapes: one broad highlight from the top left, a tight white one, shade bottom right. */
const GLOSS =
  `<ellipse cx="38" cy="42" rx="16" ry="9" fill="#FFFFFF" opacity="0.22" transform="rotate(-25 38 42)"></ellipse>` +
  `<ellipse cx="36" cy="40" rx="5" ry="2.4" fill="#FFFFFF" opacity="0.75" transform="rotate(-25 36 40)"></ellipse>`;

const finishes: Record<string, FinishArt> = {
  "avatar-finish.chrome": {
    paint: "url(#{{p}}rdch)",
    defs:
      `<linearGradient id="{{p}}rdch" x1="0" y1="0" x2="0.25" y2="1"><stop offset="0" stop-color="#FFFFFF"></stop><stop offset="0.32" stop-color="#DCE4F2"></stop><stop offset="0.47" stop-color="#8994AE"></stop><stop offset="0.5" stop-color="#2E364A"></stop><stop offset="0.62" stop-color="#6F7B96"></stop><stop offset="0.85" stop-color="#C9D3EA"></stop><stop offset="1" stop-color="#F4F7FD"></stop></linearGradient>` +
      RIM_LIGHT("ch"),
    stroke: null,
    shadow: false,
    overlay: GLOSS,
    filter: null,
    outer: rim("ch", "url(#{{p}}rdch)"),
    wire: false,
  },
  "avatar-finish.carbon": {
    paint: "url(#{{p}}rdcb)",
    defs:
      `<pattern id="{{p}}rdcb" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#15181F"></rect><rect width="2.5" height="5" fill="url(#{{p}}rdcbt)"></rect><rect x="2.5" width="2.5" height="5" fill="url(#{{p}}rdcbu)"></rect></pattern>` +
      `<linearGradient id="{{p}}rdcbt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4A5366"></stop><stop offset="1" stop-color="#1A1E27"></stop></linearGradient>` +
      `<linearGradient id="{{p}}rdcbu" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3A4252"></stop><stop offset="1" stop-color="#14171E"></stop></linearGradient>` +
      `<linearGradient id="{{p}}rdcbr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5A6478"></stop><stop offset="0.5" stop-color="#1A1E27"></stop><stop offset="1" stop-color="#3A4252"></stop></linearGradient>` +
      RIM_LIGHT("cb"),
    stroke: null,
    shadow: false,
    // A clear coat: the gloss, and a long reflection across the weave.
    overlay: `<path d="M18 46 Q50 30 84 40" stroke="#FFFFFF" stroke-width="5" opacity="0.18" fill="none" stroke-linecap="round"></path>` + GLOSS,
    filter: null,
    outer: rim("cb", "url(#{{p}}rdcbr)"),
    wire: false,
  },
  "avatar-finish.holographic": {
    paint: "url(#{{p}}rdho)",
    defs:
      `<linearGradient id="{{p}}rdho" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9FF3FF"></stop><stop offset="0.25" stop-color="#C9B4FF"></stop><stop offset="0.5" stop-color="#FFB4E8"></stop><stop offset="0.75" stop-color="#FFE7A6"></stop><stop offset="1" stop-color="#A6FFD9"></stop></linearGradient>` +
      `<linearGradient id="{{p}}rdhs" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0"></stop><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.55"></stop><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"></stop></linearGradient>` +
      RIM_LIGHT("ho"),
    stroke: null,
    shadow: false,
    overlay:
      `<g class="rd-holo"><rect x="10" y="10" width="14" height="90" fill="url(#{{p}}rdhs)" transform="rotate(28 50 50)"></rect><rect x="44" y="10" width="7" height="90" fill="url(#{{p}}rdhs)" transform="rotate(28 50 50)"></rect></g>` + GLOSS,
    filter: null,
    outer: rim("ho", "url(#{{p}}rdho)"),
    wire: false,
  },
  "avatar-finish.neon-glow": {
    // The player's own colour kept, lit as a tube: a bright core line on every main shape, a soft halo round the
    // figure in the player's colour, and a ring of the same light on the circle.
    paint: null,
    defs: RIM_LIGHT("ng"),
    stroke: { colour: "#FFFFFF", width: 1.4 },
    shadow: false,
    overlay: GLOSS,
    filter: "drop-shadow(0 0 2px {{m1}}) drop-shadow(0 0 5px {{m1}})",
    outer:
      `<circle cx="50" cy="50" r="49" fill="none" stroke="#06080F" stroke-width="5.5"></circle>` +
      `<circle cx="50" cy="50" r="49" fill="none" stroke="{{m1}}" stroke-width="3" style="filter: drop-shadow(0 0 3px {{m1}})"></circle>` +
      `<circle cx="50" cy="50" r="49" fill="none" stroke="#FFFFFF" stroke-opacity="0.85" stroke-width="1"></circle>`,
    wire: false,
  },
};

const accessories: Record<string, string> = {
  // The bolt as a 3D piece above the circle, standing on a short stem.
  "avatar-accessory.neon-bolt": `<path d="M50 6 V0" stroke="#06080F" stroke-width="3"></path><image href="${IMG("acc.neon-bolt")}" x="35" y="-27" width="30" height="30"></image>`,
};

/* ---------------------------------------------------------------- emotes (each at its pack's own size) */

const svgOf = (w: number, h: number, inner: string) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${inner}</svg>`;
const imgOf = (piece: string, w: number, h: number) => `<image href="${IMG(piece)}" x="0" y="0" width="${w}" height="${h}"></image>`;
/** One line of bold words centred on the piece's face, sized to fit (Archivo 900 ≈ 0.62 em a capital). */
function word(text: string, w: number, h: number, faceW: number, cy: number, fill: string, maxSize: number, stroke?: string): string {
  const size = Math.min(maxSize, Math.floor((faceW / (text.length * 0.6)) * 10) / 10);
  return `<text x="${(w / 2).toFixed(1)}" y="${cy.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-family="Archivo, system-ui, sans-serif" font-weight="900" font-size="${size}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${(size / 6).toFixed(1)}" paint-order="stroke" stroke-linejoin="round"` : ""}>${text}</text>`;
}
const HEART = `<path d="M30 42 C18 34 13 28 13 22 C13 17 17 14 21 14 C25 14 28 16 30 19 C32 16 35 14 39 14 C43 14 47 17 47 22 C47 28 42 34 30 42 Z" fill="#FF4D6D" stroke="#121218" stroke-width="2.2" stroke-linejoin="round"></path><ellipse cx="22" cy="20" rx="4" ry="2.4" fill="#FFFFFF" opacity="0.7" transform="rotate(-30 22 20)"></ellipse>`;
const SIGN_INK = ["#FF9BE3", "#8AF3FF", "#FFB070", "#DFFF8A"];
const CALLS = ["Was that luck?", "My thumb slipped", "Rematch. Now.", "Who taught you that?!"];
const CALL_W = [102, 114, 96, 144];
const SIGNS = ["UNREAL", "OOPS", "BRB CRYING", "SHEESH"];
const SIGN_W = [74, 64, 114, 74];
const reactions: Record<string, { svg: string; label: string }[]> = {
  "reaction.spark": [{ svg: svgOf(76, 76, imgOf("emote.spark", 76, 76)), label: "Spark" }],
  "reaction.zap": [{ svg: svgOf(80, 76, `<image href="${IMG("emote.zap")}" x="2" y="0" width="76" height="76"></image>`), label: "Zap" }],
  "reaction.clutch": [{ svg: svgOf(118, 48, imgOf("emote.clutch", 118, 48) + word("CLUTCH!", 118, 48, 74, 23.5, "#3A2406", 17)), label: "CLUTCH!" }],
  "reaction.captains-calls": CALLS.map((t, i) => ({ svg: svgOf(CALL_W[i]!, 46, imgOf(`emote.bubble-${i}`, CALL_W[i]!, 46) + word(t, CALL_W[i]!, 46, CALL_W[i]! - 34, 20, "#121218", 12.5)), label: t })),
  "reaction.retro-arcade": [
    { svg: svgOf(60, 60, imgOf("emote.key-0", 60, 60) + `<g transform="translate(0 1)">${HEART}</g>`), label: "Retro Arcade" },
    ...["1UP", "LAG!!", "GLHF"].map((t, i) => ({ svg: svgOf(60, 60, imgOf(`emote.key-${i + 1}`, 60, 60) + word(t, 60, 60, 34, 29.5, "#FFFFFF", 16, "#121218")), label: t })),
  ],
  "reaction.neon-signs": SIGNS.map((t, i) => ({ svg: svgOf(SIGN_W[i]!, 40, imgOf(`emote.sign-${i}`, SIGN_W[i]!, 40) + word(t, SIGN_W[i]!, 40, SIGN_W[i]! - 30, 20, SIGN_INK[i]!, 13, "#06080F")), label: t })),
};

/* ---------------------------------------------------------------- celebrations (240 × 150) */

const GOLD_GRAD = `<linearGradient id="{{p}}rdg" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#FFF3C4"></stop><stop offset="0.35" stop-color="#EDB43E"></stop><stop offset="0.7" stop-color="#B07A1E"></stop><stop offset="1" stop-color="#FFE08A"></stop></linearGradient>`;
function scene(id: string, defs: string, back: string, front: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 150" width="100%" height="100%" style="display: block" aria-hidden="true">` +
    `<defs><clipPath id="{{p}}rdc"><rect width="240" height="150" rx="10"></rect></clipPath>${GOLD_GRAD}` +
    `<radialGradient id="{{p}}rdk" cx="0.15" cy="0" r="1"><stop offset="0" stop-color="#2A3558"></stop><stop offset="1" stop-color="#0B0F1C"></stop></radialGradient>${defs}</defs>` +
    `<g clip-path="url(#{{p}}rdc)"><rect width="240" height="150" fill="url(#{{p}}rdk)"></rect>${back}` +
    // The podium drum (3D piece) with the place on its front, the winner's avatar on top.
    `<image href="${IMG("cel.podium")}" x="66" y="78" width="108" height="72"></image>` +
    `<text x="120" y="130" text-anchor="middle" font-family="Archivo, system-ui, sans-serif" font-weight="900" font-size="17" fill="url(#{{p}}rdg)" stroke="#06080F" stroke-width="2.4" paint-order="stroke">{{place}}</text>` +
    `{{avatar}}${front}</g>` +
    `<rect x="1" y="1" width="238" height="148" rx="10" fill="none" stroke="#2A3352" stroke-width="2"></rect></svg>`
  );
}
const SAMPLE =
  `<circle cx="120" cy="74" r="18" fill="#1E2640" stroke="#06080F" stroke-width="2"></circle><path d="M108 78c0-8 5-13 12-13s12 5 12 13c0 6-4 9-12 11-8-2-12-5-12-11z" fill="#FF6BD6" stroke="#06080F" stroke-width="1.5"></path><path d="M111 74h18l-2 5-4-2-3 3-3-3-4 2z" fill="#22E4FF"></path>`;

const beam = (x: number, cls: string) =>
  `<g class="${cls}" style="transform-origin: ${x}px -10px"><path d="M${x - 9} -10 L${x + 9} -10 L${120 + (x < 120 ? 30 : -30)} 132 L${120 + (x < 120 ? -14 : 14)} 132 Z" fill="url(#{{p}}rdb)"></path></g>`;
const celebrations: Record<string, { svg: string; sample: string }> = {
  "celebration.spotlight": {
    svg: scene(
      "spotlight",
      `<linearGradient id="{{p}}rdb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6DA" stop-opacity="0.75"></stop><stop offset="1" stop-color="#FFE6A0" stop-opacity="0.08"></stop></linearGradient>` +
        `<radialGradient id="{{p}}rdpool"><stop offset="0" stop-color="#FFE6A0" stop-opacity="0.55"></stop><stop offset="1" stop-color="#FFE6A0" stop-opacity="0"></stop></radialGradient>`,
      beam(46, "rd-swayL") + beam(194, "rd-swayR") + `<ellipse cx="120" cy="100" rx="70" ry="20" fill="url(#{{p}}rdpool)"></ellipse>`,
      "",
    ),
    sample: SAMPLE,
  },
  "celebration.shockwave": {
    svg: scene(
      "shockwave",
      `<linearGradient id="{{p}}rdw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"></stop><stop offset="0.4" stop-color="#8AF3FF"></stop><stop offset="1" stop-color="#2D6BFF"></stop></linearGradient>`,
      [0, 1, 2]
        .map((i) => `<ellipse class="rd-wave rd-wave${i}" cx="120" cy="96" rx="40" ry="13" fill="none" stroke="url(#{{p}}rdw)" stroke-width="5" style="transform-origin: 120px 96px"></ellipse>`)
        .join(""),
      "",
    ),
    sample: SAMPLE,
  },
  "celebration.circuit-overload": {
    svg: scene(
      "circuit",
      `<linearGradient id="{{p}}rdt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7A4E10"></stop><stop offset="0.5" stop-color="#EDB43E"></stop><stop offset="1" stop-color="#7A4E10"></stop></linearGradient>`,
      ["M0 40 H40 L58 58 H90", "M240 40 H200 L182 58 H150", "M0 112 H50 L64 98", "M240 112 H190 L176 98"]
        .map(
          (d) =>
            `<path d="${d}" fill="none" stroke="#06080F" stroke-width="6" stroke-linejoin="round"></path><path d="${d}" fill="none" stroke="url(#{{p}}rdt)" stroke-width="3.4" stroke-linejoin="round"></path><path class="rd-pulse" d="${d}" fill="none" stroke="#FFF6DA" stroke-width="2.2" stroke-linecap="round" pathLength="100"></path>`,
        )
        .join("") +
        `<image href="${IMG("cel.bolt")}" x="22" y="10" width="26" height="26"></image><image href="${IMG("cel.bolt")}" x="192" y="10" width="26" height="26"></image>`,
      "",
    ),
    sample: SAMPLE,
  },
};

/* ---------------------------------------------------------------- the tile style (90 × 90) */

const TRACES = ["M10 70 H26 L32 64 H44", "M80 20 H64 L58 26 H48", "M14 18 V30 L22 38", "M76 72 V60 L68 52"];
const tiles: Record<string, { back: string; front: string; sample: string }> = {
  "tile-style.circuit-trace": {
    back:
      `<defs><linearGradient id="{{p}}rdtb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1A2A2A"></stop><stop offset="1" stop-color="#08100F"></stop></linearGradient>` +
      `<linearGradient id="{{p}}rdtt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF3C4"></stop><stop offset="0.4" stop-color="#EDB43E"></stop><stop offset="1" stop-color="#8A5A14"></stop></linearGradient></defs>` +
      `<rect x="3" y="3" width="84" height="84" rx="18" fill="url(#{{p}}rdtb)" stroke="#3B6B5E" stroke-width="2"></rect>` +
      TRACES.map(
        (d) =>
          `<path d="${d}" fill="none" stroke="#000000" stroke-opacity="0.55" stroke-width="3.6" transform="translate(0.8 1.2)"></path><path d="${d}" fill="none" stroke="url(#{{p}}rdtt)" stroke-width="2.6" stroke-linejoin="round"></path>`,
      ).join("") +
      [
        [44, 64],
        [48, 26],
        [22, 38],
        [68, 52],
      ]
        .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="url(#{{p}}rdtt)" stroke="#06080F" stroke-width="0.8"></circle><circle cx="${x! - 1}" cy="${y! - 1}" r="0.9" fill="#FFFFFF"></circle>`)
        .join(""),
    front: `<rect x="3" y="3" width="84" height="42" rx="18" fill="#FFFFFF" opacity="0.05"></rect>`,
    sample: "",
  },
};

const MOTION: Record<string, string> = {
  "avatar-finish.holographic": `.jzc .rd-holo{animation:jzc-rdHolo 4.5s ease-in-out infinite}
@keyframes jzc-rdHolo{0%{transform:translateX(-40px)}60%,100%{transform:translateX(60px)}}
@media (prefers-reduced-motion: reduce){.jzc .rd-holo{animation:none}}`,
  "celebration.spotlight": `.jzc .rd-swayL{animation:jzc-rdSwayL 3.2s ease-in-out infinite alternate}.jzc .rd-swayR{animation:jzc-rdSwayR 3.2s ease-in-out infinite alternate}
@keyframes jzc-rdSwayL{from{transform:rotate(-6deg)}to{transform:rotate(5deg)}}
@keyframes jzc-rdSwayR{from{transform:rotate(6deg)}to{transform:rotate(-5deg)}}
@media (prefers-reduced-motion: reduce){.jzc .rd-swayL,.jzc .rd-swayR{animation:none}}`,
  "celebration.shockwave": `.jzc .rd-wave{animation:jzc-rdWave 2.4s cubic-bezier(.2,.7,.3,1) infinite}.jzc .rd-wave1{animation-delay:.8s}.jzc .rd-wave2{animation-delay:1.6s}
@keyframes jzc-rdWave{0%{transform:scale(.6);opacity:0}15%{opacity:1}100%{transform:scale(2.6);opacity:0}}
@media (prefers-reduced-motion: reduce){.jzc .rd-wave{animation:none;opacity:.7}.jzc .rd-wave1{transform:scale(1.6);opacity:.45}.jzc .rd-wave2{transform:scale(2.2);opacity:.25}}`,
  "celebration.circuit-overload": `.jzc .rd-pulse{stroke-dasharray:14 86;animation:jzc-rdPulse 1.6s linear infinite}
@keyframes jzc-rdPulse{from{stroke-dashoffset:100}to{stroke-dashoffset:0}}
@media (prefers-reduced-motion: reduce){.jzc .rd-pulse{animation:none;opacity:0}}`,
};

export function buildCosmetics() {
  const images = new Set<string>(["acc.neon-bolt", "cel.podium", "cel.bolt", "emote.spark", "emote.zap", "emote.clutch"]);
  for (let i = 0; i < 4; i++) for (const k of ["key", "sign", "bubble"]) images.add(`emote.${k}-${i}`);
  return { finishes, accessories, reactions, celebrations, tiles, css: MOTION, images: [...images] };
}
