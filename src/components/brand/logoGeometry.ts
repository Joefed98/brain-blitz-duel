/**
 * The logo mark (Prompt R, 23 Oct 2026): a two-part lightning bolt with two faint speed lines, in a
 * 26 × 34 box. One description for every place that draws it: LogoMark (SVG), the share card
 * (canvas, src/lib/share/resultCard.ts) and the app icons (scripts/brand-icons.ts).
 */
export const LOGO_BOX = { w: 26, h: 34 } as const;

/** The bolt's upper and lower halves as polygons (the SVG paths below, point by point). */
export const LOGO_UPPER: readonly (readonly [number, number])[] = [
  [19, 0.5],
  [7, 18.5],
  [13.5, 18.5],
  [14.2, 13.5],
];
export const LOGO_LOWER: readonly (readonly [number, number])[] = [
  [13.5, 18.5],
  [8, 33.5],
  [21, 13.5],
  [14.2, 13.5],
];
/** The speed lines: from where they are strongest to where they fade out. */
export const LOGO_TRAIL = { y: 7, from: 15.6, to: 1.5 } as const;
/**
 * The speed lines' thickness on screen, px: hairlines at every size (follow-up to #133). They are drawn
 * with a non-scaling stroke of min(LOGO_HAIRLINE_PX, px per box unit), so a header-sized mark (22 px tall,
 * 0.65 px per unit) keeps its 1-unit lines exactly and a large one never grows them into bands.
 */
export const LOGO_HAIRLINE_PX = 1.5;
export const LOGO_LEAD = { y: 27, from: 11.3, to: 24.5 } as const;

export const LOGO_PATHS = {
  upper: "M19 .5 7 18.5h6.5L14.2 13.5z",
  lower: "M13.5 18.5 8 33.5 21 13.5h-6.8z",
  trail: "M15.6 7H1.5",
  lead: "M11.3 27H24.5",
  /** Both halves as one path: the flat-coloured bolt is filled once, so their shared edge leaves no seam. */
  bolt: "M19 .5 7 18.5h6.5L14.2 13.5zM13.5 18.5 8 33.5 21 13.5h-6.8z",
} as const;

/**
 * The brand's colours (design foundation F4, 6 Nov 2026), the values of the tokens in src/design/tokens.css:
 * canvases and the asset scripts can't read a CSS custom property, so they read these, and
 * brand-assets-check fails if the two ever differ.
 */
/** --jz-gold: the bolt's one colour. */
export const BRAND_GOLD = "#E2C07A"; // design-lint-ignore: mirrors --jz-gold (brand-assets-check)
/** --jz-bg (and --jz-on-gold): the navy-black behind the gold bolt, and the bolt on the ring-gold metal. */
export const BRAND_INK = "#06080F"; // design-lint-ignore: mirrors --jz-bg (brand-assets-check)
/** --jz-text-3: the link preview's line. */
export const BRAND_TEXT_3 = "#8F9BBF"; // design-lint-ignore: mirrors --jz-text-3 (brand-assets-check)
/** --jz-gold-metal: the ring-gold metal, a CSS linear-gradient at `angle` degrees with these stops. */
export const RING_GOLD = {
  angle: 165,
  stops: [
    [0, "#FBEDC4"], // design-lint-ignore: mirrors --jz-gold-metal (brand-assets-check)
    [0.34, "#E6C67E"], // design-lint-ignore
    [0.68, "#D2AC5E"], // design-lint-ignore
    [1, "#EED79C"], // design-lint-ignore
  ] as readonly (readonly [number, string])[],
} as const;

/**
 * The ends of a CSS linear-gradient's line at `angle` degrees over a w × h box (CSS Images 3: through
 * the centre, long enough that the corners land on the first and last stops), so an SVG or canvas
 * gradient draws exactly what the CSS one does.
 */
export function cssGradientLine(angle: number, w: number, h: number): { x1: number; y1: number; x2: number; y2: number } {
  const a = (angle * Math.PI) / 180;
  const dx = Math.sin(a);
  const dy = -Math.cos(a);
  const half = (Math.abs(w * dx) + Math.abs(h * dy)) / 2;
  return { x1: w / 2 - dx * half, y1: h / 2 - dy * half, x2: w / 2 + dx * half, y2: h / 2 + dy * half };
}

/**
 * The two colourings: the gold bolt on dark (the wordmark, Prepare to Duel, the share card, the link
 * preview and the splash), one flat --jz-gold since F4; and the black bolt on the ring-gold metal (the
 * app icons and the solve burst's logo).
 */
export const LOGO_COLOURS = {
  gold: { upper: [BRAND_GOLD], lower: [BRAND_GOLD], line: BRAND_GOLD, lineOpacity: 0.3 },
  inverted: { upper: [BRAND_INK], lower: [BRAND_INK], line: BRAND_INK, lineOpacity: 0.35 },
} as const;
