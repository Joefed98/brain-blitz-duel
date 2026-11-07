import { useId, type ReactNode } from "react";

import { LOGO_BOX, LOGO_COLOURS, LOGO_HAIRLINE_PX, LOGO_LEAD, LOGO_PATHS, LOGO_TRAIL } from "./logoGeometry";

/**
 * The charge-in (celebrations, LOGO_CHARGE_MS in src/lib/fx/celebrations.ts): the facets fill top to
 * bottom over the first 0.45 s, then each speed line streaks out from its strong end over 0.3 s. Both
 * are clips that grow (SMIL) round the mark's own paths, so the paths are drawn exactly as without it.
 */
const CHARGE_FILL_S = 0.45;
const CHARGE_LINE_AT_S = 0.3;
const CHARGE_LINE_S = 0.3;

/** A clip rect that grows from `from` (x or y) to cover `to`, keyed by the axis it grows along. */
function ChargeClip({ id, x, y, w, h, axis, begin, dur }: { id: string; x: number; y: number; w: number; h: number; axis: "down" | "left" | "right"; begin: number; dur: number }) {
  const size = axis === "down" ? h : w;
  return (
    <clipPath id={id}>
      <rect x={axis === "left" ? x + w : x} y={y} width={axis === "down" ? w : 0} height={axis === "down" ? 0 : h}>
        <animate
          attributeName={axis === "down" ? "height" : "width"}
          values={`0;${size}`}
          begin={`${begin}s`}
          dur={`${dur}s`}
          calcMode="spline"
          keyTimes="0;1"
          keySplines="0.35 0 0.25 1"
          fill="freeze"
        />
        {axis === "left" ? (
          <animate attributeName="x" values={`${x + w};${x}`} begin={`${begin}s`} dur={`${dur}s`} calcMode="spline" keyTimes="0;1" keySplines="0.35 0 0.25 1" fill="freeze" />
        ) : null}
      </rect>
    </clipPath>
  );
}

/** The charge-in's clipped group; without it, the paths alone (the mark's own markup, unchanged). */
function clipped(charge: boolean, clip: string, paths: ReactNode) {
  return charge ? <g className="logo-charge-clip" clipPath={`url(#${clip})`}>{paths}</g> : paths;
}

/**
 * The logo mark (logoGeometry.ts): the bolt in flat --jz-gold on dark (the wordmark; design foundation
 * F4), its two halves one path so their shared edge leaves no seam; `inverted` draws it black, as the
 * app icons draw it on the ring-gold metal (scripts/brand-icons.ts, from the same geometry).
 * Every instance has its own gradient ids (useId), so two marks on one page never share them.
 *
 * The speed lines are hairlines at any size (a non-scaling stroke, `lineWidth` screen px): by default
 * min(LOGO_HAIRLINE_PX, the mark's px per box unit from `height`), so the header's 22 px mark draws them
 * exactly as its 1-unit strokes did. A mark sized by CSS rather than `height` passes `lineWidth`.
 *
 * `charge` (celebrations; the app header's first mark per app open): the mark charges in (see
 * ChargeClip). The caller draws it without `charge` once the charge-in has ended. Reduced motion shows
 * the finished mark (polish-layout/celebrations.css).
 */
export function LogoMark({
  variant = "gold",
  width = 17,
  height = 22,
  className,
  viewBox = "0 0 26 34",
  lineWidth,
  charge = false,
}: {
  variant?: "gold" | "inverted";
  width?: number;
  height?: number;
  className?: string;
  /** A crop of the 26 × 34 box (Prepare to Duel fits the bolt alone); overflow stays visible. */
  viewBox?: string;
  /** The speed lines' thickness on screen, px (default: see above). */
  lineWidth?: number;
  /** Celebrations' charge-in (see above). */
  charge?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const look = LOGO_COLOURS[variant];
  const hairline = lineWidth ?? Math.min(LOGO_HAIRLINE_PX, height / LOGO_BOX.h);
  const line = (key: string, x1: number, x2: number) => (
    <linearGradient id={`${id}-${key}`} gradientUnits="userSpaceOnUse" x1={x1} y1="0" x2={x2} y2="0">
      <stop offset="0" stopColor={look.line} stopOpacity={look.lineOpacity} />
      <stop offset="1" stopColor={look.line} stopOpacity="0" />
    </linearGradient>
  );
  return (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      style={{ overflow: "visible" }}
      aria-hidden="true"
      focusable="false"
      data-logo-mark={variant}
      data-logo-charge={charge ? "" : undefined}
      className={className}
    >
      <defs>
        {line("t", LOGO_TRAIL.from, LOGO_TRAIL.to)}
        {line("l", LOGO_LEAD.from, LOGO_LEAD.to)}
        {charge ? (
          <>
            <ChargeClip id={`${id}-cf`} x={-2} y={0} w={30} h={34} axis="down" begin={0} dur={CHARGE_FILL_S} />
            <ChargeClip id={`${id}-ct`} x={0} y={LOGO_TRAIL.y - 2} w={LOGO_TRAIL.from + 1} h={4} axis="left" begin={CHARGE_LINE_AT_S} dur={CHARGE_LINE_S} />
            <ChargeClip id={`${id}-cl`} x={LOGO_LEAD.from - 1} y={LOGO_LEAD.y - 2} w={26 - LOGO_LEAD.from + 1} h={4} axis="right" begin={CHARGE_LINE_AT_S} dur={CHARGE_LINE_S} />
          </>
        ) : null}
      </defs>
      {clipped(
        charge,
        `${id}-cf`,
        <path d={LOGO_PATHS.bolt} fill={look.upper[0]} />,
      )}
      {clipped(
        charge,
        `${id}-ct`,
        <path
          d={LOGO_PATHS.trail}
          stroke={`url(#${id}-t)`}
          strokeWidth={hairline}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          data-logo-line=""
        />,
      )}
      {clipped(
        charge,
        `${id}-cl`,
        <path
          d={LOGO_PATHS.lead}
          stroke={`url(#${id}-l)`}
          strokeWidth={hairline}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          data-logo-line=""
        />,
      )}
    </svg>
  );
}
