import type { ReactNode } from "react";

import { PlayerBadge } from "@/components/duel/PlayerBadge";
import type { PlayerLook } from "@/lib/duel/playerLook";

/**
 * A player's name with their avatar disc inside (DESIGN.md section 5; the disc is PlayerBadge, colour
 * never alone: the name is always beside it).
 * - `strip`: one line for lists (standings, lobby), disc 28;
 * - `full`: the disc large over the name (a winner, a head-to-head), disc 64;
 * - `mini`: inline in a line of text or a chip, disc 20.
 * `you` adds "(you)" after the name; `meta` a quiet line or value after it.
 */
const DISC = { strip: 28, full: 64, mini: 20 } as const;

export function Nameplate({
  look,
  name,
  kind = "strip",
  you = false,
  meta,
  disc,
  className,
}: {
  look: PlayerLook | undefined;
  name: string;
  kind?: "strip" | "full" | "mini";
  you?: boolean;
  meta?: ReactNode;
  /** The disc's size where a screen keeps its own. */
  disc?: number;
  className?: string;
}) {
  return (
    <span data-jz="nameplate" data-kind={kind} className={`jz-plate${className ? ` ${className}` : ""}`}>
      <PlayerBadge look={look} name={name} size={disc ?? DISC[kind]} />
      <span className="flex min-w-0 items-baseline gap-1">
        <span data-ellipsis className="jz-plate-name rs-name th-name">
          {name}
        </span>
        {you ? <span className="rs-you jz-plate-you shrink-0">(you)</span> : null}
      </span>
      {meta !== undefined ? <span className="jz-plate-meta">{meta}</span> : null}
    </span>
  );
}
