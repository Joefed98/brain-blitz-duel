/**
 * Stars. Since wave 2 C1a (11 Nov 2026) a game's stars are one per level, Easy, Classic and Hard, each earned by a
 * score of 175 or more on that level (src/lib/practice/progressRules.ts) and drawn in gold when earned (`levels`).
 * The retired three-metal tiers (bronze, silver and gold at a practice best of 120, 160 and 190, practiceGoals.ts) are
 * still drawn from `tier` where a screen asks for them. Sizes S 12 (a Practice row, the intro) and M 16. Read as
 * "1 of 3 stars"; `label={false}` leaves the name to the row round it.
 */
export function Stars({
  tier = 0,
  levels,
  size = "s",
  label = true,
  className,
}: {
  tier?: number;
  /** A game's stars by level (gold when earned); takes the place of `tier`. */
  levels?: { easy: boolean; classic: boolean; hard: boolean };
  size?: "s" | "m";
  label?: boolean;
  className?: string;
}) {
  const earned = levels
    ? Number(levels.easy) + Number(levels.classic) + Number(levels.hard)
    : Math.max(0, Math.min(3, Math.floor(tier)));
  return (
    <span
      data-jz="stars"
      data-stars={earned}
      data-kind={levels ? "levels" : undefined}
      data-size={size === "s" ? undefined : size}
      role={label ? "img" : undefined}
      aria-label={label ? `${earned} of 3 stars` : undefined}
      aria-hidden={label ? undefined : true}
      className={`jz-stars${className ? ` ${className}` : ""}`}
    >
      {levels
        ? (["easy", "classic", "hard"] as const).map((level) => (
            <span key={level} data-level={level} data-on={levels[level] ? "" : undefined} />
          ))
        : (["bronze", "silver", "gold"] as const).map((metal, i) => (
            <span key={metal} data-metal={metal} data-on={i < earned ? "" : undefined} />
          ))}
    </span>
  );
}
