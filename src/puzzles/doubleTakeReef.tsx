/**
 * Double Take picture 2, the rock pool (spotRev 1, 14 Oct 2026): presentation only.
 *
 * Fairness, as for the sweet shop (doubleTakeArt.tsx): both panels are drawn by exactly
 * this code. The pool backdrop takes no input, so it is identical in both panels; each
 * creature is drawn only from its stored kind, colour, turn and flip, so nothing here can
 * add, alter or hide a difference. The same six shape kinds as the shop, drawn as sea
 * creatures; the kinds that turn (triangle, arrow) are the seahorse and the fish, whose
 * facing reads at a glance.
 */
import { memo } from "react";

import type { SpotShapeKind } from "@/lib/duel/types";

const GLOSS = "var(--dt-gloss)";
const SHADE = "var(--dt-shade)";
const EYE = "var(--reef-eye)";
const EDGE = { stroke: "var(--reef-outline)", strokeWidth: 1.1, strokeLinejoin: "round" as const };

export const REEF_NAMES: Record<SpotShapeKind, string> = {
  circle: "pufferfish",
  square: "crab",
  triangle: "seahorse",
  star: "starfish",
  hexagon: "shell",
  arrow: "fish",
};

/** Translate a stored (generic) label for the rock pool at display time; never rewrites the stored text. */
export function reefLabel(label: string): string {
  return label
    .replace(
      /\b(circle|square|triangle|star|hexagon|arrow)\b/g,
      (kind) => REEF_NAMES[kind as SpotShapeKind],
    )
    .replace("A shape", "A creature");
}

/** One creature in its 40-unit box, the same box and transforms the sweets use. */
export function ReefArt({ kind, fill }: { kind: SpotShapeKind; fill: string }) {
  switch (kind) {
    case "circle": // pufferfish, facing right
      return (
        <g>
          <path d="M6 20 1 13v14z" fill={fill} {...EDGE} />
          <path
            d="M20 4.5l1.6 3M27.5 7.5l-.6 3.2M33.5 13.5l-2.8 1.4M12.5 7.5l.6 3.2M33.5 26.5l-2.8-1.4M20 35.5l1.6-3M12.5 32.5l.6-3.2M27.5 32.5l-.6-3.2"
            stroke={fill}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx="21" cy="20" r="13" fill={fill} {...EDGE} />
          <path
            d="M31 24a12 12 0 0 1-15 7.5"
            fill="none"
            stroke={SHADE}
            strokeOpacity=".25"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="27" cy="16" r="3" fill={GLOSS} />
          <circle cx="27.8" cy="16.2" r="1.6" fill={EYE} />
          <path
            d="M31.5 22.5q2 1 0 2"
            fill="none"
            stroke={EYE}
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          <ellipse
            cx="16"
            cy="12"
            rx="3.6"
            ry="2"
            transform="rotate(-30 16 12)"
            fill={GLOSS}
            opacity=".45"
          />
        </g>
      );
    case "square": // crab
      return (
        <g>
          <path
            d="M9 26l-6 5M10 29l-4 7M31 26l6 5M30 29l4 7"
            stroke={fill}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path d="M11 16 6 10M29 16l5-6" stroke={fill} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M2 9c0-5 7-7 9-3l-3 2 3 2c-2 4-9 3-9-1z" fill={fill} {...EDGE} />
          <path d="M38 9c0-5-7-7-9-3l3 2-3 2c2 4 9 3 9-1z" fill={fill} {...EDGE} />
          <ellipse cx="20" cy="23" rx="13" ry="9.5" fill={fill} {...EDGE} />
          <path
            d="M9 26c6 4 16 4 22 0"
            fill="none"
            stroke={SHADE}
            strokeOpacity=".25"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path d="M16 14v-4M24 14v-4" stroke={fill} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="16" cy="9.5" r="2.2" fill={GLOSS} />
          <circle cx="24" cy="9.5" r="2.2" fill={GLOSS} />
          <circle cx="16" cy="9.5" r="1.1" fill={EYE} />
          <circle cx="24" cy="9.5" r="1.1" fill={EYE} />
          <ellipse cx="15" cy="19" rx="3.4" ry="1.6" fill={GLOSS} opacity=".4" />
        </g>
      );
    case "triangle": // seahorse, snout to the right, tail curling left
      return (
        <g>
          <path
            d="M19 3c5 0 8 3 8 6l9 1-1 4-8-1c0 4-2 7-4 9 3 3 3 8 0 11-3 3-8 3-10 0-2-2-1-5 2-5 2 0 3 2 2 3 2 0 3-2 2-4-2-3-6-5-6-11 0-4 2-6 2-8-2-1-3-3-1-5z"
            fill={fill}
            {...EDGE}
          />
          <path
            d="M14 13l-4 1 3 2-3 2 4 1"
            fill="none"
            stroke={fill}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M18 14c0 3 1 5 3 7"
            fill="none"
            stroke={SHADE}
            strokeOpacity=".28"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="22" cy="7.5" r="2.2" fill={GLOSS} />
          <circle cx="22.6" cy="7.6" r="1.1" fill={EYE} />
          <path
            d="M17 26h4M16 23h4"
            stroke={SHADE}
            strokeOpacity=".22"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
      );
    case "star": // starfish
      return (
        <g>
          <path
            d="M20 2.5l4.6 10.4 11.4 1.2-8.6 7.7 2.5 11.2-9.9-5.8-9.9 5.8 2.5-11.2L3.9 14.1l11.4-1.2z"
            fill={fill}
            {...EDGE}
          />
          <path
            d="M20 9v8M30 15.5l-7 3.5M26.5 29l-5-6M13.5 29l5-6M10 15.5l7 3.5"
            stroke={SHADE}
            strokeOpacity=".22"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="20" cy="20" r="2" fill={GLOSS} opacity=".55" />
          <circle cx="20" cy="11" r="1" fill={GLOSS} opacity=".6" />
          <circle cx="27" cy="16.5" r="1" fill={GLOSS} opacity=".6" />
          <circle cx="13" cy="16.5" r="1" fill={GLOSS} opacity=".6" />
          <circle cx="24.5" cy="25" r="1" fill={GLOSS} opacity=".6" />
          <circle cx="15.5" cy="25" r="1" fill={GLOSS} opacity=".6" />
        </g>
      );
    case "hexagon": // scallop shell
      return (
        <g>
          <path d="M15 33h10l-1 4h-8z" fill={fill} {...EDGE} />
          <path d="M20 34 3 17C4 8 11 3 20 3s16 5 17 14z" fill={fill} {...EDGE} />
          <path
            d="M20 33 8 9M20 33 14 5M20 33V4M20 33 26 5M20 33 32 9"
            fill="none"
            stroke={SHADE}
            strokeOpacity=".3"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M8 12c3-5 7-6.5 12-6.5"
            fill="none"
            stroke={GLOSS}
            strokeOpacity=".5"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>
      );
    case "arrow": // fish, facing right
      return (
        <g>
          <path d="M11 20 1 10v20z" fill={fill} {...EDGE} />
          <path d="M17 9c3-4 8-5 11-3l-2 4z" fill={fill} {...EDGE} />
          <path
            d="M9 20c4-9 13-12 20-10 6 2 10 6 10 10s-4 8-10 10c-7 2-16-1-20-10z"
            fill={fill}
            {...EDGE}
          />
          <path
            d="M14 24c6 4 15 5 22 0"
            fill="none"
            stroke={SHADE}
            strokeOpacity=".25"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
          <path
            d="M26 12.5c-2 4-2 11 0 15"
            fill="none"
            stroke={SHADE}
            strokeOpacity=".3"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="32.5" cy="17.5" r="2.4" fill={GLOSS} />
          <circle cx="33.1" cy="17.6" r="1.2" fill={EYE} />
          <ellipse
            cx="20"
            cy="14"
            rx="4"
            ry="1.6"
            transform="rotate(-12 20 14)"
            fill={GLOSS}
            opacity=".4"
          />
        </g>
      );
  }
}

/**
 * Rock-pool backdrop: deep water, a sandy ledge under each row and a pale pebble ring
 * behind every cell. It takes no input, so it is the same in both pictures.
 */
export const ReefBackdrop = memo(function ReefBackdrop({
  cols,
  rows,
  cell,
}: {
  cols: number;
  rows: number;
  cell: number;
}) {
  const width = cols * cell;
  const height = rows * cell;
  return (
    <g aria-hidden="true" pointerEvents="none">
      <defs>
        <linearGradient id="reef-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--reef-water-top)" />
          <stop offset="1" stopColor="var(--reef-water-deep)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="url(#reef-water)" />
      {/* Light shafts: fixed positions, the same in both pictures. */}
      {[0.12, 0.42, 0.74].map((f, i) => (
        <path
          key={`r${i}`}
          d={`M${f * width} 0h${cell * 0.7}l${cell * 0.9} ${height}h-${cell * 0.7}z`}
          fill="var(--reef-ray)"
        />
      ))}
      {Array.from({ length: rows * cols }, (_, i) => {
        const x = (i % cols) * cell;
        const y = Math.floor(i / cols) * cell;
        return (
          <ellipse
            key={`p${i}`}
            cx={x + cell / 2}
            cy={y + cell / 2 + 2}
            rx={cell / 2 - 4}
            ry={cell / 2 - 7}
            fill="var(--reef-niche)"
          />
        );
      })}
      {Array.from({ length: rows }, (_, row) => {
        const top = row * cell + cell - 5;
        return (
          <g key={row}>
            <rect x="0" y={top} width={width} height="5" fill="var(--reef-sand)" />
            <rect x="0" y={top} width={width} height="1.2" fill="var(--reef-sand-top)" />
          </g>
        );
      })}
    </g>
  );
});
