/** What everyone may see of a player's equipped cosmetics (wave 2 E2; src/lib/cosmetics/cosmetics.server.ts). */
export interface PublicCosmetics {
  /** The id the player was asked for by: their public id from a phone (Security C1b), the account id on the server. */
  userId: string;
  /** The avatar as the player's card draws it (null: none known). */
  avatar: { id: string; colour: number; gem: string | null } | null;
  finish: string | null;
  accessory: string | null;
  special: string | null;
  /** The win celebration (shown on a room win) and the podium entrance. */
  celebration: string | null;
  entrance: string | null;
  /** The equipped reaction packs, in slot order (up to four). */
  reactions: string[];
  /** The gold PLUS chip: only when its owner has Plus and turned it on. */
  plusMark: boolean;
}

export const NO_COSMETICS: Omit<PublicCosmetics, "userId"> = {
  avatar: null,
  finish: null,
  accessory: null,
  special: null,
  celebration: null,
  entrance: null,
  reactions: [],
  plusMark: false,
};
