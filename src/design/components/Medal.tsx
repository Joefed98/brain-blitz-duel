import { MedalArt } from "@/design/art/Art";

/** The medal art's widths: S 22, M 36, L 64 (DESIGN.md section 5, docs/art/README.md). */
export const MEDAL_PX = { s: 22, m: 36, l: 64 } as const;
const METAL = { 1: "gold", 2: "silver", 3: "bronze" } as const;
const ORDINAL = { 1: "1st", 2: "2nd", 3: "3rd" } as const;

/**
 * A place medal (DESIGN.md section 5): the approved gold, silver and bronze medal art for 1st to 3rd
 * (design foundation F5, docs/art/svg/medal-*.svg; no numbers on it), the plain number in a disc from
 * 4th down (outlined at M and L). Sizes S 22, M 36, L 64 wide. A shared place (tieDisplay.ts) keeps its
 * medal with a small "=" tag on it, and reads "Joint 1st".
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
  const art = place === 1 || place === 2 || place === 3;
  if (art) {
    const ordinal = ORDINAL[place];
    return (
      <span
        data-jz="medal"
        data-medal={place}
        data-shared={shared ? "" : undefined}
        data-size={size === "s" ? undefined : size}
        role="img"
        aria-label={shared ? `Joint ${ordinal}` : ordinal}
        className={`jz-medal${className ? ` ${className}` : ""}`}
      >
        <MedalArt metal={METAL[place]} size={MEDAL_PX[size]} />
        {shared && (
          <span className="jz-medal-tie" aria-hidden="true">
            =
          </span>
        )}
      </span>
    );
  }
  return (
    <span
      data-jz="medal"
      data-shared={shared ? "" : undefined}
      data-size={size === "s" ? undefined : size}
      aria-label={shared ? `Joint ${place}` : undefined}
      className={`jz-medal${className ? ` ${className}` : ""}`}
    >
      {shared ? `=${place}` : place}
    </span>
  );
}
