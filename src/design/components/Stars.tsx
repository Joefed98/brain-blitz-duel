/**
 * Mastery stars (practice goals, 6 Nov 2026): three stars, bronze, silver and gold in their metals when earned
 * (practiceGoals.ts: a practice best of 120, 160 and 190), the empty step's surface when not. Sizes S 12 (a
 * Practice row, the intro) and M 16. Read as "2 of 3 stars"; `label={false}` leaves the name to the row round it.
 */
export function Stars({
  tier,
  size = "s",
  label = true,
  className,
}: {
  tier: number;
  size?: "s" | "m";
  label?: boolean;
  className?: string;
}) {
  const earned = Math.max(0, Math.min(3, Math.floor(tier)));
  return (
    <span
      data-jz="stars"
      data-stars={earned}
      data-size={size === "s" ? undefined : size}
      role={label ? "img" : undefined}
      aria-label={label ? `${earned} of 3 stars` : undefined}
      aria-hidden={label ? undefined : true}
      className={`jz-stars${className ? ` ${className}` : ""}`}
    >
      {(["bronze", "silver", "gold"] as const).map((metal, i) => (
        <span key={metal} data-metal={metal} data-on={i < earned ? "" : undefined} />
      ))}
    </span>
  );
}
