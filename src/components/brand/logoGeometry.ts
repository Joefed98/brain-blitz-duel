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
} as const;

/** The two colourings: gold on dark (header), dark on the gold shine (icons, share card). */
export const LOGO_COLOURS = {
  gold: { upper: ["#FFEBA8", "#F7BF2F", "#C98A0E"], lower: ["#F0B634", "#A86F08"], line: "#F7BF2F", lineOpacity: 0.3 },
  inverted: { upper: ["#2A2A30", "#0D0D0F"], lower: ["#0D0D0F", "#000000"], line: "#0D0D0F", lineOpacity: 0.35 },
} as const;

/** The gold shine behind the inverted mark (the main gold buttons' gradient, top to bottom). */
export const GOLD_SHINE_STOPS: readonly (readonly [number, string])[] = [
  [0, "#FFE08A"],
  [0.4, "#F7BF2F"],
  [0.75, "#E0A116"],
  [1, "#C98A0E"],
];
