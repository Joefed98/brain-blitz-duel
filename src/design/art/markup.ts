/**
 * The approved reward art (Joulz art v1, docs/art/; design foundation F5, 6 Nov 2026): a line-for-line port of
 * docs/art/source/gen.py's builders (defs, emblem, pips, medal, trophy, hexpath, wreath, banner, badge), so the
 * components draw exactly the geometry of docs/art/svg/. Every colour is a token read through var()
 * (src/design/tokens.css: the five metals' stops, their inks, the glow, the sheen and the outline), so nothing
 * here is a colour value.
 *
 * SVG presentation attributes don't take var(), so the builders write `fill='var(…)'` the way gen.py writes a
 * hex and `styled()` moves every var() attribute of a tag into one style attribute. `pfx` keeps one piece's
 * gradient and clip ids apart from another's on the same page.
 */

export type Metal = "bronze" | "silver" | "gold" | "platinum" | "obsidian";
export type Tier = "spark" | "charge" | "volt" | "surge" | "storm" | "lightning";
export type TrophyKind = "bronze" | "silver" | "gold" | "championship";
export type BadgeKind = "winner" | "arena" | "club" | "founder";
export type MedalMetal = "gold" | "silver" | "bronze";

/** gen.py's short material keys and the tokens' names. */
type Key = "bronze" | "silver" | "gold" | "plat" | "obsid";
const KEYS: Key[] = ["bronze", "silver", "gold", "plat", "obsid"];
const NAME: Record<Key, Metal> = { bronze: "bronze", silver: "silver", gold: "gold", plat: "platinum", obsid: "obsidian" };
const keyOf = (m: Metal): Key => (m === "platinum" ? "plat" : m === "obsidian" ? "obsid" : m);

const stop = (m: Key, i: number) => `var(--jz-metal-${NAME[m]}-${i})`;
const INK = (m: Key) => `var(--jz-ink-${NAME[m]})`;
const EDGE = "var(--jz-art-edge)";
const SHEEN = "var(--jz-art-sheen)";
const GLOW = "var(--jz-glow)";
const SURFACE = "var(--jz-surface)";
const SURFACE_2 = "var(--jz-surface-2)";
const CYAN = "var(--jz-cyan)";
const CYAN_PANEL = "var(--jz-cyan-panel)";
const GOLD_DEEP = "var(--jz-art-gold-deep)";
const GOLD_TEXT = "var(--jz-gold)";
const FONT = "var(--jz-font)";

const f1 = (n: number) => n.toFixed(1);
const f0 = (n: number) => n.toFixed(0);
const rad = (deg: number) => (deg * Math.PI) / 180;
const range = (from: number, to: number, step: number): number[] => {
  const out: number[] = [];
  if (step > 0) for (let v = from; v < to; v += step) out.push(v);
  else for (let v = from; v > to; v += step) out.push(v);
  return out;
};

/* ------------------------------------------------------------------ defs */

export function defs(pfx: string): string {
  const out: string[] = [];
  for (const k of KEYS) {
    out.push(
      `<linearGradient id='${pfx}${k}A' x1='0' y1='0' x2='0.35' y2='1'><stop offset='0' stop-color='${stop(k, 1)}'></stop><stop offset='0.34' stop-color='${stop(k, 2)}'></stop><stop offset='0.7' stop-color='${stop(k, 3)}'></stop><stop offset='1' stop-color='${stop(k, 4)}'></stop></linearGradient>`,
    );
    out.push(
      `<linearGradient id='${pfx}${k}B' x1='0.2' y1='1' x2='0' y2='0'><stop offset='0' stop-color='${stop(k, 1)}'></stop><stop offset='0.4' stop-color='${stop(k, 2)}'></stop><stop offset='0.75' stop-color='${stop(k, 3)}'></stop><stop offset='1' stop-color='${stop(k, 4)}'></stop></linearGradient>`,
    );
  }
  out.push(
    `<linearGradient id='${pfx}sheen' x1='0' y1='0' x2='1' y2='1'><stop offset='0.3' stop-color='${SHEEN}' stop-opacity='0'></stop><stop offset='0.45' stop-color='${SHEEN}' stop-opacity='0.55'></stop><stop offset='0.55' stop-color='${SHEEN}' stop-opacity='0'></stop></linearGradient>`,
  );
  out.push(
    `<radialGradient id='${pfx}cyglow' cx='0.5' cy='0.5' r='0.5'><stop offset='0' stop-color='${GLOW}' stop-opacity='0.5'></stop><stop offset='1' stop-color='${GLOW}' stop-opacity='0'></stop></radialGradient>`,
  );
  return "<defs>" + out.join("") + "</defs>";
}

/* ------------------------------------------------------------------ rank emblems */

const SHIELD = "M60 8 L106 24 V68 C106 100 86 122 60 132 C34 122 14 100 14 68 V24 Z";
const inner = (scale = 0.8) =>
  `<path d='${SHIELD}' transform='translate(${f1(60 * (1 - scale))} ${f1(70 * (1 - scale))}) scale(${scale})'`;
export const BOLT = "M66 34 L44 74 H58 L52 104 L78 60 H63 Z";

const TIER_METAL: Record<Tier, Key> = { spark: "bronze", charge: "silver", volt: "gold", surge: "plat", storm: "obsid", lightning: "gold" };

export function emblem(pfx: string, tier: Tier): string {
  const m = TIER_METAL[tier];
  const ink = INK(m);
  const A = `url(#${pfx}${m}A)`;
  const B = `url(#${pfx}${m}B)`;
  const g: string[] = [];
  if (tier === "lightning") {
    g.push(`<circle cx='60' cy='70' r='64' fill='url(#${pfx}cyglow)'></circle>`);
    for (const a of range(0, 360, 30))
      g.push(`<path d='M54 70 L66 70 L60 -6 Z' fill='${A}' transform='rotate(${a} 60 70)'></path>`);
  }
  if (tier === "surge" || tier === "storm" || tier === "lightning") {
    const wm = tier !== "surge" ? "gold" : "plat";
    for (const sx of [1, -1]) {
      const tr = sx === 1 ? "" : "transform='translate(120 0) scale(-1 1)'";
      g.push(
        `<g ${tr}><path d='M100 40 L128 30 L118 46 L132 44 L118 60 L128 62 L104 78 Z' fill='url(#${pfx}${wm}A)' stroke='${EDGE}' stroke-width='2' stroke-linejoin='round'></path></g>`,
      );
    }
  }
  if (tier === "storm" || tier === "lightning") {
    for (const [x, top, sc] of [
      [36, 2, 0.34],
      [60, -12, 0.46],
      [84, 2, 0.34],
    ] as const)
      g.push(
        `<path d='${BOLT}' fill='url(#${pfx}goldA)' stroke='${EDGE}' stroke-width='${f1(2 / sc)}' stroke-linejoin='round' transform='translate(${f1(x - 61 * sc)} ${f1(top - 34 * sc)}) scale(${sc})'></path>`,
      );
  }
  g.push(`<path d='${SHIELD}' fill='${A}' stroke='${EDGE}' stroke-width='2.5' stroke-linejoin='round'></path>`);
  if (m === "obsid")
    g.push(`<path d='${SHIELD}' fill='none' stroke='url(#${pfx}goldA)' stroke-width='3' transform='translate(6 7) scale(0.9)'></path>`);
  g.push(inner(0.8) + ` fill='${B}'></path>`);
  g.push(inner(0.8) + ` fill='url(#${pfx}sheen)' opacity='0.8'></path>`);
  if (tier === "spark") {
    g.push(`<path d='${BOLT}' fill='none' stroke='${ink}' stroke-width='4' stroke-linejoin='round'></path>`);
  } else if (tier === "charge") {
    g.push(`<defs><clipPath id='${pfx}half'><rect x='30' y='72' width='60' height='40'></rect></clipPath></defs>`);
    g.push(`<path d='${BOLT}' fill='${ink}' clip-path='url(#${pfx}half)'></path>`);
    g.push(`<path d='${BOLT}' fill='none' stroke='${ink}' stroke-width='4' stroke-linejoin='round'></path>`);
  } else {
    const bf = m === "obsid" ? `url(#${pfx}goldA)` : ink;
    g.push(`<path d='${BOLT}' fill='${bf}' stroke='${m === "obsid" ? EDGE : "none"}' stroke-width='1.5' stroke-linejoin='round'></path>`);
    if (tier === "surge")
      g.push(`<path d='M30 60 H42 M28 70 H40 M30 80 H42' stroke='${ink}' stroke-width='4' stroke-linecap='round'></path>`);
  }
  return g.join("");
}

/** The division diamonds: `n` of them centred on cx, the first `filled` in gold (earned). */
export function pips(pfx: string, n: number, filled: number, cx: number, y: number): string {
  const out: string[] = [];
  const x0 = cx - (n - 1) * 9;
  for (let i = 0; i < n; i++) {
    const f = i < filled ? `url(#${pfx}goldA)` : SURFACE_2;
    out.push(`<path d='M${x0 + i * 18} ${y - 6} l6 6 l-6 6 l-6 -6 z' fill='${f}'></path>`);
  }
  return out.join("");
}

/* ------------------------------------------------------------------ medals */

export function medal(pfx: string, metal: MedalMetal): string {
  const m = keyOf(metal);
  const A = `url(#${pfx}${m}A)`;
  const B = `url(#${pfx}${m}B)`;
  const ink = INK(m);
  const leaves = [...range(116, 250, 26), ...range(-64, 65, 26)]
    .map((a) => {
      const x = f1(60 + 22 * Math.cos(rad(a)));
      const y = f1(86 + 22 * Math.sin(rad(a)));
      return `<ellipse cx='${x}' cy='${y}' rx='2.6' ry='6' fill='${ink}' fill-opacity='0.5' transform='rotate(${a + 90 + (a > 90 && a < 270 ? 30 : -30)} ${x} ${y})'></ellipse>`;
    })
    .join("");
  return (
    `<path d='M38 4 H54 L66 46 H50 Z' fill='${CYAN_PANEL}' stroke='${EDGE}' stroke-width='2'></path><path d='M82 4 H66 L54 46 H70 Z' fill='${SURFACE_2}' stroke='${EDGE}' stroke-width='2'></path>` +
    `<path d='M44 4 L56 46' stroke='${CYAN}' stroke-width='3'></path><path d='M76 4 L64 46' stroke='${A}' stroke-width='3'></path>` +
    `<circle cx='60' cy='86' r='40' fill='${A}' stroke='${EDGE}' stroke-width='2.5'></circle>` +
    `<circle cx='60' cy='86' r='31' fill='${B}'></circle><circle cx='60' cy='86' r='31' fill='url(#${pfx}sheen)' opacity='0.8'></circle>` +
    `<circle cx='60' cy='86' r='26' fill='none' stroke='${ink}' stroke-opacity='0.4' stroke-width='1.2'></circle>` +
    leaves +
    `<circle cx='60' cy='86' r='15' fill='${A}' stroke='${ink}' stroke-opacity='0.5' stroke-width='1.2'></circle>` +
    `<path d='M63 72 L53 90 H59 L56 101 L67 82 H61 Z' fill='${ink}'></path>`
  );
}

/* ------------------------------------------------------------------ trophies */

/** level 0 bronze cup, 1 silver, 2 gold, 3 championship. */
export function trophy(pfx: string, metal: MedalMetal, level: 0 | 1 | 2 | 3): string {
  const m = keyOf(metal);
  const A = `url(#${pfx}${m}A)`;
  const B = `url(#${pfx}${m}B)`;
  const ink = INK(m);
  const g: string[] = [];
  if (level === 3) {
    g.push(`<circle cx='60' cy='56' r='86' fill='url(#${pfx}cyglow)'></circle>`);
    for (const a of range(-80, 81, 20))
      g.push(`<path d='M55 60 L65 60 L60 -38 Z' fill='${A}' opacity='0.55' transform='rotate(${a} 60 60)'></path>`);
  }
  const hw = 6 + (level >= 2 ? 2 : 0);
  for (const d of ["M32 30 C8 30 8 66 40 70", "M88 30 C112 30 112 66 80 70"])
    g.push(
      `<path d='${d}' fill='none' stroke='${EDGE}' stroke-width='${hw + 5}' stroke-linecap='round'></path><path d='${d}' fill='none' stroke='${A}' stroke-width='${hw}' stroke-linecap='round'></path>`,
    );
  if (level === 3) {
    for (const sx of [1, -1]) {
      const tr = sx === 1 ? "" : "transform='translate(120 0) scale(-1 1)'";
      g.push(
        `<g ${tr}><path d='M104 30 L132 18 L124 32 L140 30 L124 44 L136 46 L110 60 Z' fill='${A}' stroke='${EDGE}' stroke-width='2' stroke-linejoin='round'></path></g>`,
      );
    }
  }
  if (level >= 2) {
    g.push(`<path d='M30 18 C30 2 90 2 90 18 Z' fill='${A}' stroke='${EDGE}' stroke-width='2.5'></path>`);
    if (level === 2) {
      g.push(`<path d='M63 -16 L52 4 H59 L56 16 L69 -6 H62 Z' fill='${A}' stroke='${EDGE}' stroke-width='2' stroke-linejoin='round'></path>`);
    } else {
      for (const [x, bot, sc] of [
        [38, 12, 0.42],
        [60, 8, 0.6],
        [82, 12, 0.42],
      ] as const)
        g.push(
          `<path d='${BOLT}' fill='${A}' stroke='${EDGE}' stroke-width='${f1(2 / sc)}' stroke-linejoin='round' transform='translate(${f1(x - 61 * sc)} ${f1(bot - 104 * sc)}) scale(${sc})'></path>`,
        );
    }
  }
  g.push(`<path d='M28 18 H92 V40 C92 66 78 80 60 82 C42 80 28 66 28 40 Z' fill='${A}' stroke='${EDGE}' stroke-width='2.5' stroke-linejoin='round'></path>`);
  g.push(
    `<path d='M34 22 H86 V40 C86 62 74 74 60 76 C46 74 34 62 34 40 Z' fill='${B}'></path><path d='M34 22 H86 V40 C86 62 74 74 60 76 C46 74 34 62 34 40 Z' fill='url(#${pfx}sheen)' opacity='0.85'></path>`,
  );
  if (level >= 1) g.push(`<path d='M34 30 H86' stroke='${ink}' stroke-opacity='0.35' stroke-width='1.5'></path>`);
  if (level >= 2) {
    for (const sx of [1, -1]) {
      for (let i = 0; i < 4; i++) {
        const y = 40 + i * 8;
        const x = 60 + sx * (18 - i * 1.5);
        g.push(`<ellipse cx='${f1(x)}' cy='${y}' rx='2.4' ry='5' fill='${ink}' fill-opacity='0.45' transform='rotate(${sx * 35} ${f1(x)} ${y})'></ellipse>`);
      }
    }
  }
  g.push(`<path d='M63 30 L52 50 H59 L56 66 L69 44 H62 Z' fill='${ink}'></path>`);
  g.push(
    `<rect x='54' y='82' width='12' height='16' fill='${A}' stroke='${EDGE}' stroke-width='2'></rect><ellipse cx='60' cy='90' rx='10' ry='4' fill='${A}' stroke='${EDGE}' stroke-width='2'></ellipse>`,
  );
  g.push(`<path d='M40 98 H80 L86 112 H34 Z' fill='${A}' stroke='${EDGE}' stroke-width='2.5' stroke-linejoin='round'></path>`);
  if (level === 0) {
    g.push(
      `<rect x='28' y='112' width='64' height='24' rx='3' fill='${SURFACE_2}' stroke='${EDGE}' stroke-width='2.5'></rect><rect x='42' y='119' width='36' height='10' rx='1.5' fill='${A}'></rect>`,
    );
  } else if (level < 3) {
    g.push(
      `<rect x='26' y='112' width='68' height='22' rx='3' fill='${SURFACE_2}' stroke='${EDGE}' stroke-width='2.5'></rect><rect x='40' y='118' width='40' height='10' rx='1.5' fill='${A}'></rect>`,
    );
    g.push(`<rect x='20' y='134' width='80' height='10' rx='3' fill='${A}' stroke='${EDGE}' stroke-width='2.5'></rect>`);
  } else {
    g.push(
      `<rect x='22' y='112' width='76' height='26' rx='3' fill='${SURFACE_2}' stroke='${EDGE}' stroke-width='2.5'></rect><rect x='34' y='118' width='52' height='14' rx='1.5' fill='${A}'></rect>`,
    );
    g.push(
      `<text x='60' y='128.5' text-anchor='middle' font-family='${FONT}' font-weight='800' font-size='8' letter-spacing='0.6' fill='${INK("gold")}'>CHAMPION</text>`,
    );
    g.push(
      `<rect x='14' y='138' width='92' height='10' rx='3' fill='${A}' stroke='${EDGE}' stroke-width='2.5'></rect><rect x='6' y='148' width='108' height='12' rx='3' fill='${SURFACE_2}' stroke='${EDGE}' stroke-width='2.5'></rect>`,
    );
  }
  return g.join("");
}

/* ------------------------------------------------------------------ badges */

function hexpath(cx: number, cy: number, r: number): string {
  const pts = Array.from({ length: 6 }, (_, i) => [cx + r * Math.cos(rad(60 * i + 30)), cy + r * Math.sin(rad(60 * i + 30))] as const);
  return "M" + pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(" L") + " Z";
}

function wreath(pfx: string, cx: number, cy: number, r: number): string {
  const out: string[] = [];
  for (const side of [1, -1]) {
    const [a0, a1] = side === 1 ? [100, 236] : [80, -56];
    const n = 7;
    const pts: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const ar = rad(a0 + ((a1 - a0) * i) / (n - 1));
      pts.push([cx + r * Math.cos(ar), cy + r * Math.sin(ar)]);
    }
    const d = "M" + pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join(" L");
    out.push(`<path d='${d}' fill='none' stroke='url(#${pfx}goldA)' stroke-width='2'></path>`);
    for (let i = 1; i < n; i++) {
      const a = a0 + ((a1 - a0) * i) / (n - 1);
      const ar = rad(a);
      for (const [k, off] of [
        [0, 4],
        [1, -4],
      ] as const) {
        const x = cx + (r + off) * Math.cos(ar);
        const y = cy + (r + off) * Math.sin(ar);
        const rot = a + (side === 1 ? 25 : -25) * (k === 0 ? 1 : -1);
        out.push(
          `<ellipse cx='${f1(x)}' cy='${f1(y)}' rx='3' ry='7' fill='url(#${pfx}goldA)' stroke='${EDGE}' stroke-width='0.8' transform='rotate(${f0(rot)} ${f1(x)} ${f1(y)})'></ellipse>`,
        );
      }
    }
  }
  return out.join("");
}

function banner(pfx: string, y: number, text: string, w = 84): string {
  // gen.py's x0 / x1 are Python floats (printed "10.0"); y stays an int.
  const fl = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));
  const x0 = 60 - w / 2;
  const x1 = 60 + w / 2;
  const f = `url(#${pfx}goldA)`;
  return (
    `<path d='M${fl(x0 - 8)} ${y + 3} H${fl(x0 + 6)} V${y + 15} H${fl(x0 - 8)} L${fl(x0 - 3)} ${y + 9} Z' fill='${GOLD_DEEP}' stroke='${EDGE}' stroke-width='1.5' stroke-linejoin='round'></path>` +
    `<path d='M${fl(x1 + 8)} ${y + 3} H${fl(x1 - 6)} V${y + 15} H${fl(x1 + 8)} L${fl(x1 + 3)} ${y + 9} Z' fill='${GOLD_DEEP}' stroke='${EDGE}' stroke-width='1.5' stroke-linejoin='round'></path>` +
    `<rect x='${fl(x0)}' y='${y}' width='${w}' height='15' fill='${f}' stroke='${EDGE}' stroke-width='1.8'></rect>` +
    `<text x='60' y='${y + 11}' text-anchor='middle' font-family='${FONT}' font-weight='900' font-size='9.5' letter-spacing='1.2' fill='${INK("gold")}'>${text}</text>`
  );
}

const GLYPH2 = "M3 0 H22 L19 14 L8 28 H19 L17 36 H0 L2 28 L13 14 L14 8 H2 Z";
const GLYPH0 = "M7 0 H24 L22 12 L25 14 L20 36 H3 L5 24 L2 22 Z M11 7 L9 29 H15 L17 7 Z";

/** The founder badge's player number as the art writes it: "#0042". */
export const founderNumber = (n: number) => `#${String(Math.max(0, Math.floor(n))).padStart(4, "0")}`;

const escapeText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function badge(pfx: string, kind: BadgeKind, founder = 42): string {
  const g: string[] = [];
  const G = `url(#${pfx}goldA)`;
  if (kind === "winner") {
    g.push(wreath(pfx, 60, 58, 44));
    g.push(
      `<path d='${hexpath(60, 56, 32)}' fill='${G}' stroke='${EDGE}' stroke-width='2.5' stroke-linejoin='round'></path><path d='${hexpath(60, 56, 26)}' fill='${SURFACE}'></path><path d='${hexpath(60, 56, 26)}' fill='none' stroke='${G}' stroke-width='1' stroke-opacity='0.6' transform='translate(4.4 4.1) scale(0.92)'></path>`,
    );
    g.push(`<g transform='translate(43 37) scale(0.29)'>${trophy(pfx, "gold", 2)}</g>`);
    g.push(
      `<path d='M60 4 l2.4 5 5.4 .6 -4 3.7 1.1 5.3 -4.9 -2.7 -4.9 2.7 1.1 -5.3 -4 -3.7 5.4 -.6 z' fill='${G}' stroke='${EDGE}' stroke-width='1'></path>`,
    );
    g.push(banner(pfx, 86, "WINNER"));
  } else if (kind === "founder") {
    g.push(
      `<circle cx='60' cy='56' r='44' fill='${G}' stroke='${EDGE}' stroke-width='2.5'></circle><circle cx='60' cy='56' r='38' fill='${SURFACE}'></circle><circle cx='60' cy='56' r='34' fill='none' stroke='${G}' stroke-width='1' stroke-dasharray='1 4' stroke-linecap='round'></circle>`,
    );
    g.push(`<path d='M64 24 L52 44 H59 L56 56 L69 36 H61 Z' fill='${G}' stroke='${EDGE}' stroke-width='1.5' stroke-linejoin='round'></path>`);
    g.push(banner(pfx, 57, "FOUNDER", 88));
    g.push(
      `<text x='60' y='88' text-anchor='middle' font-family='${FONT}' font-stretch='110%' font-weight='900' font-size='12' fill='${GOLD_TEXT}'>${escapeText(founderNumber(founder))}</text>`,
    );
  } else if (kind === "club") {
    for (const a of range(0, 360, 30))
      g.push(`<path d='M57 56 L63 56 L60 4 Z' fill='${G}' opacity='0.6' transform='rotate(${a} 60 56)'></path>`);
    g.push(`<circle cx='60' cy='56' r='40' fill='${G}' stroke='${EDGE}' stroke-width='2.5'></circle><circle cx='60' cy='56' r='33' fill='${SURFACE}'></circle>`);
    for (const [gl, x] of [
      [GLYPH2, 27],
      [GLYPH0, 45],
      [GLYPH0, 64],
    ] as const)
      g.push(
        `<path d='${gl}' fill-rule='evenodd' fill='${G}' stroke='${EDGE}' stroke-width='1.5' stroke-linejoin='round' transform='translate(${x + 4} 40) skewX(-8) scale(0.85)'></path>`,
      );
    g.push(`<path d='M44 77 L50 74 L54 78 L60 74 L66 78 L70 74 L76 77' fill='none' stroke='${G}' stroke-width='1.6' stroke-linejoin='round'></path>`);
    g.push(banner(pfx, 90, "CLUB", 52));
  } else {
    for (const a of range(0, 360, 45))
      g.push(`<path d='M57 58 L63 58 L60 8 Z' fill='${CYAN}' opacity='0.35' transform='rotate(${a + 22} 60 58)'></path>`);
    g.push(
      `<path d='${hexpath(60, 58, 40)}' fill='${G}' stroke='${EDGE}' stroke-width='2.5' stroke-linejoin='round'></path><path d='${hexpath(60, 58, 34)}' fill='${CYAN_PANEL}'></path>`,
    );
    g.push(
      `<path d='M50 30 L38 58 H48 L42 86 L62 50 H52 Z' fill='${CYAN}' stroke='${EDGE}' stroke-width='1.5' stroke-linejoin='round'></path><path d='M76 30 L64 58 H74 L68 86 L88 50 H78 Z' fill='${G}' stroke='${EDGE}' stroke-width='1.5' stroke-linejoin='round' transform='translate(-6 0)'></path>`,
    );
    g.push(banner(pfx, 88, "ARENA", 60));
  }
  return g.join("");
}

/* ------------------------------------------------------------------ boxes */

/** Each piece's viewBox, as the approved boards draw it (docs/art/svg/). */
export const EMBLEM_BOX = { x: -10, y: -14, w: 140, h: 164 } as const;
export const PIPS_BOX = { x: 0, y: -7, w: 120, h: 14 } as const;
export const MEDAL_BOX = { x: 0, y: 0, w: 120, h: 140 } as const;
export const BADGE_BOX = { x: 0, y: 0, w: 120, h: 120 } as const;
export const TROPHY_BOX: Record<TrophyKind, { x: number; y: number; w: number; h: number }> = {
  bronze: { x: 0, y: -4, w: 120, h: 144 },
  silver: { x: 0, y: -4, w: 120, h: 152 },
  gold: { x: 0, y: -22, w: 120, h: 170 },
  championship: { x: -26, y: -44, w: 172, h: 210 },
};
export const TROPHY_LEVEL: Record<TrophyKind, { metal: MedalMetal; level: 0 | 1 | 2 | 3 }> = {
  bronze: { metal: "bronze", level: 0 },
  silver: { metal: "silver", level: 1 },
  gold: { metal: "gold", level: 2 },
  championship: { metal: "gold", level: 3 },
};

/* ------------------------------------------------------------------ var() attributes into style */

const VAR_ATTR = /\s(fill|stroke|stop-color|font-family)='(var\(--[a-z0-9-]+\))'/g;

/**
 * Moves every `attr='var(--…)'` of each tag into one style attribute (presentation attributes don't resolve
 * var(); a style declaration does). Run once per piece, not per frame.
 */
export function styled(markup: string): string {
  return markup.replace(/<([a-zA-Z]+)((?:\s[^<>]*?)?)(\/?)>/g, (whole, tag: string, attrs: string, close: string) => {
    const decl: string[] = [];
    const rest = attrs.replace(VAR_ATTR, (_m, name: string, value: string) => {
      decl.push(`${name}:${value}`);
      return "";
    });
    if (!decl.length) return whole;
    return `<${tag}${rest} style='${decl.join(";")}'${close}>`;
  });
}

/**
 * The same markup with every var(--…) replaced by `read(name)` (a canvas image of the art can't see the page's
 * CSS: the share card resolves the tokens from the document first).
 */
export function resolved(markup: string, read: (name: string) => string): string {
  return markup.replace(/var\((--[a-z0-9-]+)\)/g, (_m, name: string) => read(name).trim() || "currentColor");
}

/** A self-standing SVG document of one piece (the share card draws it as an image). */
export function svgDocument(box: { x: number; y: number; w: number; h: number }, width: number, height: number, inside: string): string {
  return `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='${box.x} ${box.y} ${box.w} ${box.h}'>${inside}</svg>`;
}

/** A gradient id prefix from React's useId (letters, digits, _ and - only). */
export const idPrefix = (id: string) => "jz" + id.replace(/[^a-zA-Z0-9_-]/g, "") + "_";
