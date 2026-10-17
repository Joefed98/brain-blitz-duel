import type { ReactNode } from "react";

import type { PlayerIconId } from "@/lib/duel/playerLook";

/**
 * The sixteen player icons (17 Oct 2026): original line drawings on a 24 px grid, 2 px round
 * strokes like the app's other glyphs, drawn in currentColor. Some shapes fill a part solid for
 * weight at badge size; `--badge-bg` (the badge's own colour) hides a line passing behind a shape.
 * Drawn for this app; no icon library or third-party artwork.
 */
export const PLAYER_ICON_ART: Record<PlayerIconId, { label: string; art: ReactNode }> = {
  bolt: {
    label: "Bolt",
    art: <path d="M13.5 2.5 5.5 13.5h6l-1 8 8-11h-6z" fill="currentColor" strokeLinejoin="round" />,
  },
  flame: {
    label: "Flame",
    art: (
      <>
        <path d="M12 2.5c.6 3.6 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.6 1.3-4.3 2.8-5.4.1 2 .9 3.1 2 3.7-.6-3.4.1-6.5.7-9.3z" />
        <path d="M12 21c-1.5 0-2.5-1.1-2.5-2.6 0-1.6 1.3-2.4 2.5-3.9 1.2 1.5 2.5 2.3 2.5 3.9 0 1.5-1 2.6-2.5 2.6z" fill="currentColor" />
      </>
    ),
  },
  star: {
    label: "Star",
    art: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  },
  spark: {
    label: "Spark",
    art: (
      <>
        <path d="M10 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5z" fill="currentColor" />
        <path d="M18 14.5c.3 2 1.1 2.7 3 3-1.9.3-2.7 1.1-3 3-.3-1.9-1-2.7-3-3 2-.3 2.7-1 3-3z" fill="currentColor" />
      </>
    ),
  },
  comet: {
    label: "Comet",
    art: (
      <>
        <circle cx="16.5" cy="7.5" r="3.5" fill="currentColor" />
        <path d="M13.2 10.8 3.5 20.5M15.6 12.6 10.5 17.7M11.4 6.4 6.3 11.5" />
      </>
    ),
  },
  moon: {
    label: "Moon",
    art: <path d="M19.5 15.2A8.5 8.5 0 1 1 8.8 3.5a7 7 0 0 0 10.7 11.7z" />,
  },
  planet: {
    label: "Planet",
    art: (
      <>
        <ellipse cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-22 12 12)" />
        <circle cx="12" cy="12" r="5.5" fill="var(--badge-bg, none)" />
        <path d="M2.73 15.75A10 3.6 -22 0 0 21.27 8.25" />
      </>
    ),
  },
  rocket: {
    label: "Rocket",
    art: (
      <>
        <path d="M12 2.5c2.9 2 4.3 5.2 4.3 9.2L14.5 15h-5l-1.8-3.3c0-4 1.4-7.2 4.3-9.2z" />
        <circle cx="12" cy="9" r="1.6" fill="currentColor" stroke="none" />
        <path d="M7.9 12.2 5 15.5l.5 3 3.5-1.8M16.1 12.2l2.9 3.3-.5 3-3.5-1.8M10.5 18.5 12 21.5l1.5-3" />
      </>
    ),
  },
  gem: {
    label: "Gem",
    art: (
      <>
        <path d="M7 4h10l4 5-9 11.5L3 9z" />
        <path d="M3 9h18M9.5 4 8 9l4 11.5L16 9l-1.5-5" />
      </>
    ),
  },
  target: {
    label: "Target",
    art: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5.2" />
        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      </>
    ),
  },
  compass: {
    label: "Compass",
    art: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m16.6 7.4-2.9 6.3-6.3 2.9 2.9-6.3z" />
        <path d="m16.6 7.4-6.3 2.9 3.4 3.4z" fill="currentColor" />
      </>
    ),
  },
  wave: {
    label: "Wave",
    art: (
      <>
        <path d="M3 19.5c2.2 0 3-1.5 4.5-1.5s2.3 1.5 4.5 1.5 3-1.5 4.5-1.5 2.3 1.5 4.5 1.5" />
        <path d="M3.5 14.5C4 8.4 8 4.5 13.4 4.5c3.3 0 5.6 2 5.6 4.6 0 2-1.5 3.4-3.4 3.4-1.6 0-2.7-1-2.7-2.4 0-1 .6-1.7 1.4-2" />
      </>
    ),
  },
  peak: {
    label: "Peak",
    art: (
      <>
        <path d="M2.5 20 9.5 7l4 7.4L16 10.5l5.5 9.5z" />
        <path d="M7.4 10.9 9.5 12l2-1" />
      </>
    ),
  },
  leaf: {
    label: "Leaf",
    art: (
      <>
        <path d="M4.5 19.5C4.5 10.5 10 4 20 4c0 9.5-5.5 15.5-14 15.5" />
        <path d="M4.5 19.5 14 10" />
      </>
    ),
  },
  anchor: {
    label: "Anchor",
    art: (
      <>
        <circle cx="12" cy="5" r="2.2" />
        <path d="M12 7.2V21M8 10.5h8M4.5 13a7.5 7.5 0 0 0 15 0M4.5 13l-1.3 2M4.5 13l2.2.6M19.5 13l1.3 2M19.5 13l-2.2.6" />
      </>
    ),
  },
  shield: {
    label: "Shield",
    art: (
      <>
        <path d="M12 2.8 19.5 6v5.6c0 4.6-3.1 8.2-7.5 9.6-4.4-1.4-7.5-5-7.5-9.6V6z" />
        <path d="M12 2.8v18.4c-4.4-1.4-7.5-5-7.5-9.6V6z" fill="currentColor" />
      </>
    ),
  },
};

/** One icon as an inline SVG in currentColor. */
export function PlayerIconSvg({ icon, size, className }: { icon: PlayerIconId; size: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PLAYER_ICON_ART[icon].art}
    </svg>
  );
}
