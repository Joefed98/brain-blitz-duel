/**
 * How a player is drawn as a nameplate strip on any list of players (first used by the tournament boards, standings and
 * bracket rows) (Joe's rule of 11 Nov 2026: a player's card,
 * avatar and frame show wherever they appear). The server decides each row's plate (plates.server.ts) and sends it with
 * the board, so a page costs one call; the phone draws it with TournamentPlate, the nameplate strip from A2's player
 * card (the card art band, the avatar with the frame, the name colour, the rated emblem and the card's badges, all inside
 * the name area, never behind a score or a place), and a tap opens the full card (PlayerCard) from the same plate.
 *
 *  - `card`: an account: its card art, frame, avatar, name colour, emblem, badges and title, under its username.
 *  - `guest`: no account: the room colour and initial, as rooms show them.
 *  - `hidden`: an under-18 account seen by anyone but themselves: "Hidden player" on a plain neutral disc (Joe, 12 Nov
 *    2026): no initial, no colour from their account, no cosmetics, emblem or badges. Nothing identifying is sent.
 */
import type { Tier } from "@/design/art/markup";

export const HIDDEN_PLAYER_NAME = "Hidden player";

/** The rated emblem as Emblem draws it (Top 500 is the Lightning shield with its number). */
export interface PlateEmblem {
  tier: Tier;
  division?: 1 | 2 | 3;
  rank?: number;
  label: string;
}

export interface PlateCardLook {
  avatarId: string;
  colour: number;
  gem: string | null;
  cardArt: string;
  frame: string;
  nameColour: string | null;
  playerNumber: number | null;
  /** The equipped title's name (Rookie by default), for the full card. */
  title: string | null;
  /** Up to three badge slugs, in the card's order. */
  badges: string[];
  /** Null while in placement or before a rated match. */
  emblem: PlateEmblem | null;
}

export type PlateView =
  | { kind: "card"; name: string; look: PlateCardLook }
  | { kind: "guest"; name: string; colour: number }
  | { kind: "hidden"; name: typeof HIDDEN_PLAYER_NAME };

/** A hidden player's plate: the same for everyone, carrying nothing of the account. Also what a row draws when nothing could be read. */
export const HIDDEN_PLATE: PlateView = { kind: "hidden", name: HIDDEN_PLAYER_NAME };
export const UNKNOWN_PLATE: PlateView = HIDDEN_PLATE;

/** The disc's letter for a guest's plate (a hidden player's disc has none). */
export function plateInitial(plate: PlateView): string {
  if (plate.kind === "hidden") return "";
  return (Array.from(plate.name.trim())[0] ?? "?").toLocaleUpperCase();
}

const DIVISION_NUMBER = { III: 3, II: 2, I: 1 } as const;

/** W3a's shown tier as an emblem (null: no emblem). */
export function plateEmblemOf(view: { tier: string; division: "III" | "II" | "I" | null; rank: number | null; label: string } | null | undefined): PlateEmblem | null {
  if (!view) return null;
  if (view.tier === "top500") return { tier: "lightning", ...(view.rank !== null ? { rank: view.rank } : {}), label: view.label };
  const tiers: readonly string[] = ["spark", "charge", "volt", "surge", "storm", "lightning"];
  if (!tiers.includes(view.tier)) return null;
  return { tier: view.tier as Tier, ...(view.division ? { division: DIVISION_NUMBER[view.division] } : {}), label: view.label };
}
