/**
 * A player's nameplate strip on a board, standings or bracket row (Joe, 11 Nov 2026: a player's card, avatar and frame
 * show wherever they appear). Shared by the server, which builds it from A1's public cards in one batch read
 * (`playerStrips`, playerStrip.server.ts), and the phone, which draws it (`PlayerStrip`, src/design/identity).
 *
 * - `account`: the avatar in its colour, the card art and frame behind the name area only, the name in its name colour;
 * - `guest`: colour and initial (avatars and cards come with an account);
 * - `hidden`: "Hidden player", no colour, avatar or cosmetics (an under-18 where a page is open to anyone);
 * - `deleted`: "Deleted player", as hidden.
 * Places, scores, records and points are never part of the strip: rows draw them outside it.
 */
export type PlayerStripKind = "account" | "guest" | "hidden" | "deleted";

export interface PlayerStripLook {
  kind: PlayerStripKind;
  name: string;
  /** The player colour index (the avatar's colour, or a guest's initial disc); -1 for hidden and deleted. */
  colour: number;
  /** An account's avatar; null for everyone else. */
  avatar: { id: string; gem: string | null } | null;
  cardArt: string | null;
  frame: string | null;
  nameColour: string | null;
}

export const HIDDEN_PLAYER = "Hidden player";
export const DELETED_PLAYER = "Deleted player";

export function hiddenStrip(): PlayerStripLook {
  return { kind: "hidden", name: HIDDEN_PLAYER, colour: -1, avatar: null, cardArt: null, frame: null, nameColour: null };
}

export function deletedStrip(): PlayerStripLook {
  return { kind: "deleted", name: DELETED_PLAYER, colour: -1, avatar: null, cardArt: null, frame: null, nameColour: null };
}

export function guestStrip(name: string, colour: number): PlayerStripLook {
  return { kind: "guest", name, colour, avatar: null, cardArt: null, frame: null, nameColour: null };
}

/** The strip for one of A1's public card rows (economy_public_cards). */
export function accountStrip(card: {
  username: string;
  colour: number | null;
  avatar_id: string | null;
  gem: string | null;
  card_art: string | null;
  frame: string | null;
  name_colour: string | null;
}): PlayerStripLook {
  return {
    kind: "account",
    name: card.username,
    colour: card.colour ?? 0,
    avatar: { id: card.avatar_id ?? "captain-joulz", gem: card.gem },
    cardArt: card.card_art,
    frame: card.frame,
    nameColour: card.name_colour,
  };
}
