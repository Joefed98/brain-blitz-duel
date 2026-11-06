/**
 * A place medal (DESIGN.md section 5): gold, silver and bronze metal discs for 1st to 3rd, the plain
 * number below them (outlined at M and L). Sizes S 22, M 36, L 64. A shared place (tieDisplay.ts)
 * reads "=1" on the same medal. Temporary until the drawn medal art arrives.
 */
export function Medal({
  place,
  shared = false,
  size = "s",
  className,
}: {
  place: number;
  shared?: boolean | undefined;
  size?: "s" | "m" | "l";
  className?: string;
}) {
  return (
    <span
      data-jz="medal"
      data-medal={place <= 3 ? place : undefined}
      data-shared={shared ? "" : undefined}
      data-size={size === "s" ? undefined : size}
      aria-label={shared ? `Joint ${place}` : undefined}
      className={`jz-medal${className ? ` ${className}` : ""}`}
    >
      {shared ? `=${place}` : place}
    </span>
  );
}
