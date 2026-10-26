import { useId } from "react";

import "./depth4.css";

/**
 * Skid's ice gems (slideRev 1, depth batch 4; docs/depth/d4-pattern.md): faceted ice-blue gems sitting on
 * the ice, placed with the board's own cell formula (the ice-fall's). A collected gem pops once and stays as
 * a faint frosted outline, so the count reads at a glance. Display only: which gems are collected is the
 * shared replay's (iceGems.ts), the same the server counts.
 */
export function IceGems({ gems, collected, cols }: { gems: readonly number[]; collected: number; cols: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <>
      {gems.map((cell, i) => {
        const got = (collected & (1 << i)) !== 0;
        const col = cell % cols;
        const row = Math.floor(cell / cols);
        return (
          <span
            key={cell}
            className="d4-gem"
            data-got={got ? "" : undefined}
            data-d4-gem={cell}
            aria-label={got ? "Gem collected" : "Ice gem"}
            style={{
              left: `calc((100% - 22px) * ${(col + 0.5) / cols} + ${col * 2}px)`,
              top: `calc((100% - 22px) * ${(row + 0.5) / cols} + ${row * 2}px)`,
              width: `calc((100% - 22px) * ${0.7 / cols})`,
              height: `calc((100% - 22px) * ${0.7 / cols})`,
            }}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <defs>
                <linearGradient id={`${id}-g${i}`} x1="0" y1="0" x2="0.4" y2="1">
                  <stop offset="0" stopColor="#F2FDFF" />
                  <stop offset="0.45" stopColor="#7FE3FF" />
                  <stop offset="1" stopColor="#1C9BD6" />
                </linearGradient>
              </defs>
              <path className="d4-gem-body" d="M10 1.5 L18 7.5 L10 18.5 L2 7.5 Z" fill={`url(#${id}-g${i})`} />
              <path className="d4-gem-facet" d="M2 7.5 H18 M6.5 7.5 L10 1.5 L13.5 7.5 L10 18.5 L6.5 7.5" fill="none" />
            </svg>
          </span>
        );
      })}
    </>
  );
}
