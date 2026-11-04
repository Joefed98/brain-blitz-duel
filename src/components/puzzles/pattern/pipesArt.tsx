/**
 * Pipeline art (Pattern polish, 13 Oct 2026). Presentation only: metal tubes,
 * flanges and rivets drawn from a tile's side-set, water in the connected
 * network and the solve-time rush. Nothing here reads or changes what the
 * stage grades; water directions come from the presentation-only BFS.
 */
import { memo, useLayoutEffect, useRef, type CSSProperties } from "react";

import { PIPE_E, PIPE_N, PIPE_S, PIPE_W } from "@/lib/duel/logic";

/** Each open side, as a rotation of the canonical north arm. */
export const PIPE_ARMS: { bit: number; turn: number; dx: number; dy: number }[] = [
  { bit: PIPE_N, turn: 0, dx: 0, dy: -1 },
  { bit: PIPE_E, turn: 90, dx: 1, dy: 0 },
  { bit: PIPE_S, turn: 180, dx: 0, dy: 1 },
  { bit: PIPE_W, turn: 270, dx: -1, dy: 0 },
];

/** Shared gradients and the channel clip, drawn once per board. */
export function PipeDefs({ id }: { id: string }) {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className="pointer-events-none absolute">
      <defs>
        {/* Puzzle polish (3 Nov 2026): brighter steel, so a dry pipe reads on the dark board. */}
        <linearGradient id={`${id}-tube`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#56606e" />
          <stop offset="0.22" stopColor="#adb8c5" />
          <stop offset="0.42" stopColor="#f6f9fc" />
          <stop offset="0.6" stopColor="#c8d1db" />
          <stop offset="1" stopColor="#5e6876" />
        </linearGradient>
        {/* A pipe the water reaches: the tube itself turns blue, so the connected network is plainly lit. */}
        <linearGradient id={`${id}-tube-wet`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0d4f86" />
          <stop offset="0.22" stopColor="#2f9be6" />
          <stop offset="0.42" stopColor="#d4f2ff" />
          <stop offset="0.6" stopColor="#66c4f5" />
          <stop offset="1" stopColor="#11568f" />
        </linearGradient>
        <linearGradient id={`${id}-flange`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c9d2dc" />
          <stop offset="0.55" stopColor="#8a95a3" />
          <stop offset="1" stopColor="#4a525e" />
        </linearGradient>
        <radialGradient id={`${id}-hub`} cx="0.4" cy="0.36" r="0.7">
          <stop offset="0" stopColor="#f1f5f9" />
          <stop offset="0.45" stopColor="#9ba7b5" />
          <stop offset="1" stopColor="#3b434e" />
        </radialGradient>
        <radialGradient id={`${id}-pump`} cx="0.4" cy="0.35" r="0.72">
          <stop offset="0" stopColor="#ffb39a" />
          <stop offset="0.5" stopColor="#e2483a" />
          <stop offset="1" stopColor="#7c1d18" />
        </radialGradient>
        <linearGradient id={`${id}-water`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1f86e0" />
          <stop offset="0.45" stopColor="#6fd8ff" />
          <stop offset="0.6" stopColor="#b5ecff" />
          <stop offset="1" stopColor="#1f86e0" />
        </linearGradient>
        <clipPath id={`${id}-channel`} clipPathUnits="userSpaceOnUse">
          <rect x="41" y="0" width="18" height="50" />
        </clipPath>
      </defs>
    </svg>
  );
}

/**
 * One tile's pipework. `inflow` holds the arms water enters through (towards
 * the source); every other wet arm carries water away from the centre.
 * Memoised on its primitive props: a board is 49 of these (about 2,300 SVG nodes), and the
 * practice and room clocks re-render the stage ten times a second.
 */
export const PipeArt = memo(function PipeArt({
  id,
  mask,
  wet,
  source,
  inflow,
  turnKey,
}: {
  id: string;
  mask: number;
  wet: boolean;
  source: boolean;
  inflow: number;
  /** Changes on every tap; plays the quarter-turn. */
  turnKey: number;
}) {
  const turnRef = useRef<SVGGElement>(null);
  const waterRef = useRef<SVGGElement>(null);
  const lastTurn = useRef(turnKey);
  const wasWet = useRef(wet);

  useLayoutEffect(() => {
    if (turnKey === lastTurn.current) return;
    lastTurn.current = turnKey;
    const node = turnRef.current;
    if (!node?.animate || reducedMotion()) return;
    node.animate([{ transform: "rotate(-90deg)" }, { transform: "rotate(0deg)" }], {
      duration: 170,
      easing: "cubic-bezier(.2,.9,.3,1.15)",
    });
  }, [turnKey]);

  useLayoutEffect(() => {
    if (wet && !wasWet.current) {
      waterRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: reducedMotion() ? 1 : 220, easing: "ease-out" });
    }
    wasWet.current = wet;
  }, [wet]);

  const arms = PIPE_ARMS.filter((arm) => mask & arm.bit);
  return (
    <svg viewBox="0 0 100 100" className="pipe-art h-full w-full" aria-hidden="true">
      <g ref={turnRef} className="pipe-turn">
        {arms.map((arm) => (
          <g key={arm.bit} transform={`rotate(${arm.turn} 50 50)`}>
            <rect x="31" y="0" width="38" height="52" fill={`url(#${id}-${wet ? "tube-wet" : "tube"})`} />
            <rect x="41" y="0" width="18" height="50" className="pipe-channel" />
          </g>
        ))}
        <g ref={waterRef} className={wet ? "pipe-water" : "pipe-water pipe-water-off"}>
          {arms.map((arm) => (
            <g key={arm.bit} transform={`rotate(${arm.turn} 50 50)`}>
              <rect x="41" y="0" width="18" height="50" fill={`url(#${id}-water)`} />
              <g clipPath={`url(#${id}-channel)`}>
                <g className={inflow & arm.bit ? "pipe-ripple pipe-ripple-in" : "pipe-ripple"}>
                  {[-12, 0, 12, 24, 36, 48, 60].map((y) => (
                    <rect key={y} x="47" y={y} width="6" height="5" rx="2.5" className="pipe-ripple-dot" />
                  ))}
                </g>
              </g>
            </g>
          ))}
        </g>
        {arms.map((arm) => (
          <g key={arm.bit} transform={`rotate(${arm.turn} 50 50)`}>
            <rect x="26" y="0.5" width="48" height="8" rx="1.6" fill={`url(#${id}-flange)`} stroke="#2a3039" strokeWidth="1" />
            <circle cx="30.5" cy="4.5" r="1.9" className="pipe-rivet" />
            <circle cx="69.5" cy="4.5" r="1.9" className="pipe-rivet" />
          </g>
        ))}
        {source ? (
          <g>
            <circle cx="50" cy="50" r="27" fill={`url(#${id}-pump)`} stroke="#4a1210" strokeWidth="1.6" />
            {[0, 60, 120].map((turn) => (
              <rect key={turn} x="47.5" y="27" width="5" height="46" rx="2.5" transform={`rotate(${turn} 50 50)`} className="pipe-spoke" />
            ))}
            <circle cx="50" cy="50" r="10" fill={`url(#${id}-hub)`} stroke="#2a3039" strokeWidth="1.2" />
            <circle cx="50" cy="50" r="5" className="pipe-water-eye" />
          </g>
        ) : (
          arms.length > 0 && (
            <g>
              <circle cx="50" cy="50" r="20" fill={`url(#${id}-hub)`} stroke="#262c34" strokeWidth="1.4" />
              {[45, 135, 225, 315].map((turn) => (
                <circle key={turn} cx="50" cy="35.5" r="2" transform={`rotate(${turn} 50 50)`} className="pipe-rivet" />
              ))}
              <circle cx="50" cy="50" r="8.5" className={wet ? "pipe-hub-eye pipe-hub-eye-wet" : "pipe-hub-eye"} />
            </g>
          )
        )}
      </g>
    </svg>
  );
});

/** The solve-time rush through one tile: in through its inflow arms, out of the rest. */
export function PipeSurge({
  mask,
  inflow,
  delay,
  step,
}: {
  mask: number;
  inflow: number;
  delay: number;
  step: number;
}) {
  const half = step / 2;
  return (
    <svg viewBox="0 0 100 100" className="pipe-surge pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {PIPE_ARMS.filter((arm) => mask & arm.bit).map((arm) => {
        const into = Boolean(inflow & arm.bit);
        const style = {
          "--surge-delay": `${Math.round(into ? delay : delay + half)}ms`,
          "--surge-ms": `${Math.max(30, Math.round(half))}ms`,
        } as CSSProperties;
        return (
          <line
            key={arm.bit}
            transform={`rotate(${arm.turn} 50 50)`}
            x1="50"
            y1={into ? 0 : 50}
            x2="50"
            y2={into ? 50 : 0}
            pathLength={1}
            strokeDasharray="1 1"
            className="pipe-surge-line"
            style={style}
          />
        );
      })}
      <circle
        cx="50"
        cy="50"
        r="12"
        className="pipe-surge-hub"
        style={{ "--surge-delay": `${Math.round(delay + half * 0.8)}ms` } as CSSProperties}
      />
    </svg>
  );
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
