import type { ButtonHTMLAttributes, ReactNode } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import type { PuzzleType } from "@/lib/duel/types";

import { Stars } from "./Stars";

/**
 * A game's tile (DESIGN.md section 5): its tile scene in the 3 px category border (GameIcon), at S 56,
 * M 100 or L (full width: the icon at 56 beside the name). Optional `name`, `best` (a score line) and
 * `charge` (0–1, a thin gold bar under it). With `onClick` it is a button named exactly the game's name.
 *
 * `size="card"` (style guide round 2, 14 Nov 2026): the guide's game tile, the art filling a 16 px-cornered square,
 * the name bottom left and the mastery stars (`stars`) small bottom right; nothing else. Today's tile art stands in
 * until step 4's key art.
 */
const PX = { s: 56, m: 100, l: 56, card: 160 } as const;

export function GameTile({
  type,
  size = "s",
  name,
  best,
  charge,
  iconSize,
  tileStyle,
  stars,
  className,
  ...rest
}: {
  type: PuzzleType;
  size?: "s" | "m" | "l" | "card";
  /** The card's mastery stars by level. */
  stars?: { easy: boolean; classic: boolean; hard: boolean };
  name?: ReactNode;
  best?: ReactNode;
  charge?: number;
  /** An exact icon size where a screen keeps its own (44 on Practice rows). */
  iconSize?: number;
  /** Wave 2 E2: the player's equipped tile style (Practice only); none draws the tile exactly as before. */
  tileStyle?: string | null;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "name">) {
  if (size === "card") {
    const card = (
      <>
        <GameIcon type={type} size={iconSize ?? 160} tileStyle={tileStyle ?? null} />
        <span className="jz-tile-card-foot">
          {name !== undefined ? <span className="jz-tile-name">{name}</span> : null}
          {stars ? <Stars levels={stars} /> : null}
        </span>
      </>
    );
    if (rest.onClick)
      return (
        <button type="button" data-jz="game-tile" data-size="card" data-interactive="" className={`jz-tile${className ? ` ${className}` : ""}`} {...rest}>
          {card}
        </button>
      );
    return (
      <span data-jz="game-tile" data-size="card" className={`jz-tile${className ? ` ${className}` : ""}`}>
        {card}
      </span>
    );
  }
  const body = (
    <>
      <GameIcon type={type} size={iconSize ?? PX[size]} tileStyle={tileStyle ?? null} />
      {name !== undefined || best !== undefined || charge !== undefined ? (
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          {name !== undefined ? <span className="jz-tile-name">{name}</span> : null}
          {best !== undefined ? <span className="jz-tile-best">{best}</span> : null}
          {charge !== undefined ? (
            <span aria-hidden="true" className="jz-tile-charge">
              <span style={{ width: `${Math.round(Math.max(0, Math.min(1, charge)) * 100)}%` }} />
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
  if (rest.onClick)
    return (
      <button type="button" data-jz="game-tile" data-size={size} data-interactive="" className={`jz-tile${className ? ` ${className}` : ""}`} {...rest}>
        {body}
      </button>
    );
  return (
    <span data-jz="game-tile" data-size={size} className={`jz-tile${className ? ` ${className}` : ""}`}>
      {body}
    </span>
  );
}
