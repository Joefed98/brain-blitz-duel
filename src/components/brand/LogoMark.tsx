import { useId } from "react";

import { LOGO_COLOURS, LOGO_LEAD, LOGO_PATHS, LOGO_TRAIL } from "./logoGeometry";

/** The charge-in (LOGO_CHARGE_MS): the facets fill over the first 0.45 s, the lines streak out after. */
const CHARGE_FILL_S = 0.45;
const CHARGE_LINE_AT_S = 0.3;
const CHARGE_LINE_S = 0.3;
const CHARGE_LINE_LENGTH = 16;

function ChargeLine({ d, stroke }: { d: string; stroke: string }) {
  return (
    <path
      className="logo-charge-line"
      d={d}
      stroke={stroke}
      strokeWidth="1"
      strokeLinecap="round"
      strokeDasharray={CHARGE_LINE_LENGTH}
      strokeDashoffset={CHARGE_LINE_LENGTH}
    >
      <animate
        attributeName="stroke-dashoffset"
        values={`${CHARGE_LINE_LENGTH};0`}
        begin={`${CHARGE_LINE_AT_S}s`}
        dur={`${CHARGE_LINE_S}s`}
        fill="freeze"
      />
    </path>
  );
}

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
 * `charge` (celebrations, src/lib/fx/celebrations.ts; the app's first screen only): the mark
 * "charges in" over LOGO_CHARGE_MS, both facets filling top to bottom and the faint lines streaking
 * out. SMIL on the server-rendered markup, so it plays while the app loads and never holds it up;
 * reduced motion shows the finished mark (polish-layout/celebrations.css).
 */
export function LogoMark({
  variant = "gold",
  width = 17,
  height = 22,
  className,
  charge = false,
}: {
  variant?: "gold" | "inverted";
  width?: number;
  height?: number;
  className?: string;
  charge?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const look = LOGO_COLOURS[variant];
  const line = (key: string, x1: number, x2: number) => (
    <linearGradient id={`${id}-${key}`} gradientUnits="userSpaceOnUse" x1={x1} y1="0" x2={x2} y2="0">
      <stop offset="0" stopColor={look.line} stopOpacity={look.lineOpacity} />
      <stop offset="1" stopColor={look.line} stopOpacity="0" />
    </linearGradient>
  );
  return (
    <svg
      viewBox="0 0 26 34"
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
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <Stops colours={look.upper} />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1">
          <Stops colours={look.lower} />
        </linearGradient>
        {line("t", LOGO_TRAIL.from, LOGO_TRAIL.to)}
        {line("l", LOGO_LEAD.from, LOGO_LEAD.to)}
        {charge ? (
          <clipPath id={`${id}-c`}>
            <rect x="-2" y="0" width="30" height="0">
              <animate
                attributeName="height"
                values="0;34"
                keyTimes="0;1"
                calcMode="spline"
                keySplines="0.35 0 0.25 1"
                dur={`${CHARGE_FILL_S}s`}
                fill="freeze"
              />
            </rect>
          </clipPath>
        ) : null}
      </defs>
      {charge ? (
        <>
          <g className="logo-charge-clip" clipPath={`url(#${id}-c)`}>
            <path d={LOGO_PATHS.upper} fill={`url(#${id}-a)`} />
            <path d={LOGO_PATHS.lower} fill={`url(#${id}-b)`} />
          </g>
          <ChargeLine d={LOGO_PATHS.trail} stroke={`url(#${id}-t)`} />
          <ChargeLine d={LOGO_PATHS.lead} stroke={`url(#${id}-l)`} />
        </>
      ) : (
        <>
          <path d={LOGO_PATHS.upper} fill={`url(#${id}-a)`} />
          <path d={LOGO_PATHS.lower} fill={`url(#${id}-b)`} />
          <path d={LOGO_PATHS.trail} stroke={`url(#${id}-t)`} strokeWidth="1" strokeLinecap="round" />
          <path d={LOGO_PATHS.lead} stroke={`url(#${id}-l)`} strokeWidth="1" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
