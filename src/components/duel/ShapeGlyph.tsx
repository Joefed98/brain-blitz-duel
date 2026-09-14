import type { GlyphColour, GlyphShape } from "@/lib/duel/types";

/** The Colour Clash palette, plus the app's gold, shared by every shape puzzle. */
export const GLYPH_COLOURS: Record<GlyphColour, string> = {
  RED: "#FF4D4D",
  BLUE: "#4D8CFF",
  GREEN: "#3DDC84",
  PURPLE: "#B26BFF",
  PINK: "#FF6BD6",
  GOLD: "#F5C64C",
};

const STAR_POINTS =
  "12,2 14.9,8.9 22.4,9.5 16.7,14.4 18.5,21.7 12,17.8 5.5,21.7 7.3,14.4 1.6,9.5 9.1,8.9";

interface ShapeGlyphProps {
  shape: GlyphShape;
  colour: GlyphColour;
  size?: number;
}

/** Every shape in the app is drawn inline — there are no image files. */
export function ShapeGlyph({ shape, colour, size = 28 }: ShapeGlyphProps) {
  const fill = GLYPH_COLOURS[colour];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="shrink-0"
    >
      {shape === "circle" && <circle cx="12" cy="12" r="9.5" fill={fill} />}
      {shape === "square" && <rect x="2.5" y="2.5" width="19" height="19" rx="2" fill={fill} />}
      {shape === "triangle" && <polygon points="12,2.5 22,21 2,21" fill={fill} />}
      {shape === "star" && <polygon points={STAR_POINTS} fill={fill} />}
    </svg>
  );
}
