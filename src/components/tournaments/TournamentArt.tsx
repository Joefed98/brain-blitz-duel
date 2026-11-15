import { TOURNAMENT_ART, type TournamentArtName } from "./tournamentArt.data";
import type { TournamentKind } from "@/lib/tournaments/rules";

/**
 * One of the Tournaments, Leaderboards and Daily pages' 3D art-kit images (scripts/tournament-art.ts). Decorative by
 * default: the row it sits in carries the name.
 */
export function TournamentArt({ name, size, className }: { name: TournamentArtName; size?: number; className?: string }) {
  const art = TOURNAMENT_ART[name];
  const px = size ?? art.px;
  return (
    <img
      src={art.urls[0]}
      srcSet={art.urls.map((url, i) => `${url} ${i + 1}x`).join(", ")}
      width={px}
      height={px}
      alt=""
      aria-hidden
      draggable={false}
      decoding="async"
      data-tn-art={name}
      className={className ? `tn-art ${className}` : "tn-art"}
    />
  );
}

/** Each event kind's icon (the style guide's list mockup): a stopwatch, a medal, a trophy, a podium. */
export const KIND_ART: Record<TournamentKind, TournamentArtName> = {
  arena: "arena",
  score_attack: "scoreAttack",
  category_cup: "cup",
  championship: "championship",
};
