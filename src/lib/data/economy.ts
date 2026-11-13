/**
 * Coins and items: the types the screens and the server share (wave 2 A1; docs/economy/README.md). Types only, so a
 * phone module can name them without reaching server code. The calls are the server functions in
 * src/lib/economy/economy.functions.ts (getCatalogue, getMyWallet, getMyInventory, getMyLoadout, equip, setAvatar,
 * getPublicCard); the database is supabase/migrations/20261110160000_economy.sql.
 */

import type { AvatarId, AvatarOptionKind, ConsumableKind, GemId, ItemKind, ItemSource, Rarity } from "@/lib/economy/slots";

export type { AvatarId, AvatarOptionKind, ConsumableKind, GemId, ItemKind, ItemSource, Rarity };

/** One catalogue item (public.catalogue_items), as getCatalogue sends it. */
export interface CatalogueItem {
  /** Stable, exactly as in docs/art/wave-2/catalogue.json, e.g. "card-art.neon-skyline". */
  id: string;
  name: string;
  kind: ItemKind;
  /** Where it is equipped (src/lib/economy/slots.ts): the kind, "game-skin:<game>", "world-theme:<game>", "reaction" (any reaction-<n>) or "podium-entrance". */
  slot: string;
  /** Skins and world themes: the game's display name ("Apex") and its PuzzleType id ("racing"). */
  game: string | null;
  gameType: string | null;
  /** None for free and earned items. */
  rarity: Rarity | null;
  source: ItemSource;
  passLevel: number | null;
  /** Shop items only (Epic 1,000, Elite 1,600, Legendary 2,800). Not shown to players in this wave's first session. */
  priceCoins: number | null;
  bundle: string | null;
  animated: boolean;
  /** Never sold: everything not from the shop. */
  exclusive: boolean;
  /** The catalogue's "exclusive forever" (Season 1's pass and the earned items). */
  exclusiveForever: boolean;
  note: string | null;
  /** Paths under docs/art/wave-2/ (the still and the drawn source). */
  png: string | null;
  html: string | null;
  /**
   * Withdrawn (13 Nov 2026, docs/cosmetics-review): not sold, not given as a reward or starter until redrawn and
   * approved. Owners keep it, and it draws for them as before.
   */
  withdrawn: boolean;
}

export interface ConsumableCounts {
  streak_freeze: number;
  ticket_score_attack: number;
  ticket_category_cup: number;
}

/** One coin ledger line, as the player sees their own. */
export interface CoinLine {
  id: number;
  amount: number;
  reason: string;
  refKind: string | null;
  refId: string | null;
  balanceAfter: number;
  at: string;
}

/** getMyWallet: an account's balance and consumables; a guest has none. */
export type Wallet =
  | { account: false; balance: null; consumables: null; recent: [] }
  | { account: true; balance: number; consumables: ConsumableCounts; recent: CoinLine[] };

/** How an owned item was got. */
export type AcquiredHow = "starter" | "shop" | "pass" | "earned" | "grant";

export interface InventoryItem extends CatalogueItem {
  how: AcquiredHow;
  acquiredAt: string;
  /** The coin line that paid for it (shop items). */
  ledgerId: number | null;
}

/** The equipped look. `slots` names every slot in LOADOUT_SLOTS: the equipped item id, or the slot's default (null: nothing). */
export interface Loadout {
  avatarId: AvatarId;
  /** The avatar's main colour: the profile's colour, one of the 32 (src/lib/duel/playerLook.ts PLAYER_COLOURS). */
  colour: number;
  /** The avatar builder's choices (option ids from getAvatarOptions); null: the avatar's default. */
  avatar: AvatarChoices;
  gem: GemId | null;
  slots: Record<string, string | null>;
  /** The slots holding a chosen item (not a default). */
  equipped: Record<string, string>;
  /** Gems this account may use (none until C1 adds the mastery unlocks). */
  unlockedGems: GemId[];
}

/** One avatar's builder choices; null: that avatar's default. Separate from the catalogue's avatar items (finish, accessory such as Neon Bolt, special edition), which are loadout slots. */
export interface AvatarChoices {
  accent: string | null;
  feature: string | null;
  accessory: string | null;
  background: string | null;
}

/** getAvatarOptions: every avatar's options per kind, and its default for each kind (null: none defined yet). */
export type AvatarOptions = Record<
  AvatarId,
  Record<AvatarOptionKind, { options: string[]; default: string | null }>
>;

/** Why an equip or avatar change was refused. */
export type EquipRefusal =
  | "guest"
  | "not_owned"
  | "wrong_slot"
  | "unknown_slot"
  | "unknown_item"
  | "bad_avatar"
  | "bad_colour"
  | "bad_option"
  | "gem_locked"
  | "busy"
  | "error";

export type LoadoutResult = { ok: true; loadout: Loadout } | { ok: false; reason: EquipRefusal; message: string };

/**
 * What anyone may see of a player (profiles, rooms, friends). A guest gets the default card: no avatar, no colour and
 * no name of their own (the screen keeps today's room colour plus initial).
 */
export interface PublicCard {
  playerId: string;
  account: boolean;
  /** Null for a guest (the screen shows the room's own name). */
  username: string | null;
  playerNumber: number | null;
  founding: boolean;
  /** Null for a guest (colour plus initial). */
  avatarId: AvatarId | null;
  /** The avatar's choices (all null for a guest). */
  avatar: AvatarChoices;
  /** Null for a guest (the room's colour). */
  colour: number | null;
  gem: GemId | null;
  cardArt: string;
  frame: string;
  nameColour: string | null;
}
