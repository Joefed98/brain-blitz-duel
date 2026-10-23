import { useId } from "react";

import { LOGO_BOX, LOGO_COLOURS, LOGO_HAIRLINE_PX, LOGO_LEAD, LOGO_PATHS, LOGO_TRAIL } from "./logoGeometry";

function Stops({ colours }: { colours: readonly string[] }) {
  return (
    <>
      {colours.map((colour, i) => (
        <stop key={i} offset={colours.length === 1 ? 0 : i / (colours.length - 1)} stopColor={colour} />
      ))}
    </>
  );
}

/**
 * The logo mark (logoGeometry.ts): gold on dark for the app header; `inverted` draws it dark, for
 * use on the gold shine (the app icons and the share card draw that version from the same geometry).
 * Every instance has its own gradient ids (useId), so two marks on one page never share them.
 *
 * The speed lines are hairlines at any size (a non-scaling stroke, `lineWidth` screen px): by default
 * min(LOGO_HAIRLINE_PX, the mark's px per box unit from `height`), so the header's 22 px mark draws them
 * exactly as its 1-unit strokes did. A mark sized by CSS rather than `height` passes `lineWidth`.
 */
export function LogoMark({
  variant = "gold",
  width = 17,
  height = 22,
  className,
  viewBox = "0 0 26 34",
  lineWidth,
}: {
  variant?: "gold" | "inverted";
  width?: number;
  height?: number;
  className?: string;
  /** A crop of the 26 × 34 box (Prepare to Duel fits the bolt alone); overflow stays visible. */
  viewBox?: string;
  /** The speed lines' thickness on screen, px (default: see above). */
  lineWidth?: number;
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
      className={className}
    >
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <Stops colours={look.upper} />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <Stops colours={look.lower} />
        </linearGradient>
        {line("t", LOGO_TRAIL.from, LOGO_TRAIL.to)}
        {line("l", LOGO_LEAD.from, LOGO_LEAD.to)}
      </defs>
      <path d={LOGO_PATHS.upper} fill={`url(#${id}-a)`} />
      <path d={LOGO_PATHS.lower} fill={`url(#${id}-b)`} />
      <path
        d={LOGO_PATHS.trail}
        stroke={`url(#${id}-t)`}
        strokeWidth={hairline}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        data-logo-line=""
      />
      <path
        d={LOGO_PATHS.lead}
        stroke={`url(#${id}-l)`}
        strokeWidth={hairline}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        data-logo-line=""
      />
    </svg>
  );
}
