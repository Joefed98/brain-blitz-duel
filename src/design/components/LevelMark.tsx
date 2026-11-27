/**
 * The level mark (the polish plan's section 6.1, P2, 22 Nov 2026): one shared sign for a difficulty level, a colour and
 * one to four bars (Easy one, Normal two, Hard three, Expert four), never the colour alone. Drawn on a game's page, the
 * round intro, the reveal, room settings' level row and the frame header beside the round label. `label` adds the
 * level's name after the bars ("Normal"); without it the mark is decorative unless `title` names it for screen readers.
 */
import { LEVEL_LABEL, LEVELS, type Level } from "@/lib/levels/levels";

const BARS: Readonly<Record<Level, number>> = { easy: 1, normal: 2, hard: 3, expert: 4 };

export function LevelMark({
  level,
  label = false,
  size = "s",
  title,
  className,
}: {
  level: Level;
  /** Draw the level's name after the bars. */
  label?: boolean;
  /** S 14 px tall (rows, headers), M 18 px (a game page's large level). */
  size?: "s" | "m";
  /** A name for screen readers when the mark stands alone (no visible label). */
  title?: string;
  className?: string;
}) {
  const named = label || !!title;
  return (
    <span
      data-jz="level-mark"
      data-level-mark={level}
      data-size={size === "s" ? undefined : size}
      role={named && !label ? "img" : undefined}
      aria-label={!label && title ? title : undefined}
      aria-hidden={named ? undefined : true}
      className={`jz-level-mark${className ? ` ${className}` : ""}`}
    >
      <span aria-hidden="true" className="jz-level-bars">
        {LEVELS.map((l, i) => (
          <span key={l} data-on={i < BARS[level] ? "" : undefined} />
        ))}
      </span>
      {label ? <span className="jz-level-name">{LEVEL_LABEL[level]}</span> : null}
    </span>
  );
}

/** The crown that marks an Expert result where the other levels show a star (175 or more). */
export function LevelCrown({ on, size = 16 }: { on: boolean; size?: number }) {
  return (
    <svg
      data-jz="level-crown"
      data-on={on ? "" : undefined}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className="jz-level-crown"
    >
      <path d="M3 18 L4.5 7.5 L9 12 L12 5 L15 12 L19.5 7.5 L21 18 Z" fill="currentColor" />
    </svg>
  );
}
