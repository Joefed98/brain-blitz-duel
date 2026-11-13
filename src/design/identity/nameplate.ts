/**
 * The nameplate's data (Joe's rule, 11 Nov 2026: a player's card, avatar and frame show wherever they appear), shared by
 * every list that draws a player in a row: W4a's leaderboards, W4b's tournament boards, W4c's brackets. Pure: no React,
 * no server. The server builds these with `nameplatesFor` (src/lib/identity/nameplates.server.ts) in the list's own
 * call; the phone draws them with `NameplateStrip` (docs/nameplate.md).
 */
import type { PlayerIconId } from "@/lib/duel/playerLook";

import type { CardLook } from "./PlayerCard";

/** A player's card as a row draws it: A1's public card plus C2's badges and title. */
export interface NameplateCard {
  avatarId: string;
  /** The avatar's colour (the account's colour). */
  colour: number;
  gem: string | null;
  cardArt: string | null;
  frame: string | null;
  nameColour: string | null;
  /** C2's badges on the card (up to three slugs, in order) and the equipped title's id. */
  badges: string[];
  title: string | null;
}

/**
 * Who a row shows:
 * - `card`: a visible account with its card (the strip; a tap may open the full card);
 * - `plain`: a visible player with no card (a guest, or a card that failed to load): colour and initial (in a room,
 *   their room icon in the initial's place when they chose one);
 * - `hidden`: a hidden player (an under-18 by default, an adult who opted out, an account waiting for deletion) or a
 *   deleted account: a plain neutral disc, no initial or colour, "Hidden player" (or "Deleted player"), nothing to open.
 */
export type NameplatePlayer =
  | { kind: "card"; name: string; card: NameplateCard; playerNumber?: number | null; tier?: string | null }
  | { kind: "plain"; name: string; colour: number | null; icon?: PlayerIconId | null }
  | { kind: "hidden"; deleted?: boolean };

export const HIDDEN_PLAYER_NAME = "Hidden player";
export const DELETED_PLAYER_NAME = "Deleted player";

/** The name a nameplate writes (a hidden player's is always "Hidden player", whatever the row was given). */
export function nameplateName(p: NameplatePlayer): string {
  if (p.kind === "hidden") return p.deleted ? DELETED_PLAYER_NAME : HIDDEN_PLAYER_NAME;
  return p.name;
}

/** Whether a tap may open the player's full card: only a visible player with a card. */
export function nameplateOpens(p: NameplatePlayer | null | undefined): p is Extract<NameplatePlayer, { kind: "card" }> {
  return !!p && p.kind === "card";
}

/** A nameplate card as A2's card look (the avatar in the account's colour). */
export function nameplateLook(card: NameplateCard): CardLook {
  return {
    cardArt: card.cardArt,
    frame: card.frame,
    nameColour: card.nameColour,
    avatar: { id: card.avatarId, colour: card.colour, gem: card.gem },
  };
}
