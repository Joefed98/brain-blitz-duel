/**
 * The identity screens' one way to the coins-and-items server (wave 2, train A; Session A1 provides it). Every
 * screen in this session (the Shop shell's coin counter, Profile's card, Customise) reads and writes through here and
 * nowhere else, so A1's exact shapes are fitted in one place (`normalise*` below), and nothing builds a second path.
 *
 * A1's interface (src/lib/economy/economy.functions.ts, types in src/lib/data/economy.ts): getCatalogue(),
 * getMyWallet(), getMyInventory(), getMyLoadout(), getAvatarOptions(), equip({ data: { slot, itemId } }),
 * setAvatar({ data: { avatarId, colour, accent, feature, accessory, background, gem } }), getPublicCard({ data:
 * { playerId } }). `a1Binding.ts` is the one place that calls them; if it can't load, `identityBackend()` answers null
 * and the screens show only what needs no server (the guest card, no coins; Customise says it opens soon).
 *
 * Checks stand in for A1 with `setIdentityBackend(fake)` (scripts/identity-screens-check.tsx).
 */

import { SKIN_GAME_NAMES, type SkinnableGame } from "@/lib/arcade/skins/look";

/** The rarity ladder (docs/art/wave-2/README.md): Common bronze, Rare silver, Epic gold, Elite obsidian, Legendary diamond. */
export type Rarity = "common" | "rare" | "epic" | "elite" | "legendary";

/** Where an item comes from (catalogue.json `source`). */
export type ItemSource =
  | "free-starter"
  | "shop"
  | "pass-free"
  | "pass-premium"
  | "earned-season-peak-tier"
  | "earned-founding-player"
  | "earned-top-500"
  | string;

export interface CatalogueItem {
  id: string;
  name: string;
  /** card-art, frame, name-colour, avatar-finish, avatar-accessory, avatar-special-edition, … */
  kind: string;
  rarity: Rarity | null;
  source: ItemSource;
  passLevel: number | null;
  shopPrice: number | null;
  animated: boolean;
  /** Withdrawn (13 Nov 2026, docs/cosmetics-review): not offered anywhere; an owner still has it. */
  withdrawn?: boolean;
}

/** The slots Customise equips (A1's `equip(slot, …)`). */
export type LoadoutSlot =
  | "card-art"
  | "frame"
  | "name-colour"
  | "avatar-finish"
  | "avatar-accessory"
  | "avatar-special-edition"
  // Wave 2 E2: the win celebration, the podium entrance, the Practice tile style and the four reaction slots.
  | "celebration"
  | "podium-entrance"
  | "tile-style"
  | "reaction-1"
  | "reaction-2"
  | "reaction-3"
  | "reaction-4";
export const LOADOUT_SLOTS: readonly LoadoutSlot[] = [
  "card-art",
  "frame",
  "name-colour",
  "avatar-finish",
  "avatar-accessory",
  "avatar-special-edition",
  "celebration",
  "podium-entrance",
  "tile-style",
  "reaction-1",
  "reaction-2",
  "reaction-3",
  "reaction-4",
];

/**
 * The game-look slots Customise's Games tab equips (12 Nov 2026): the account's one `card-back`, and per skinnable game
 * `game-skin:<game>` and `world-theme:<game>` (src/lib/economy/slots.ts LOADOUT_SLOTS). A1's equip() takes them as it
 * takes the card slots; the server checks the item is owned and belongs in that slot.
 */
export type LookSlot = "card-back" | `game-skin:${string}` | `world-theme:${string}`;
export const isLookSlot = (slot: string): slot is LookSlot => /^(game-skin|world-theme):[a-z]+$|^card-back$/.test(slot);
/** Every game-look slot: the card back, then each skinnable game's skin and world theme. */
export const LOOK_SLOTS: readonly LookSlot[] = [
  "card-back",
  ...(Object.keys(SKIN_GAME_NAMES) as SkinnableGame[]).flatMap((g): LookSlot[] => [`game-skin:${g}`, `world-theme:${g}`]),
];
/** Any slot Customise saves through equip(). */
export type EquipSlot = LoadoutSlot | LookSlot;

/** The avatar builder's own options (A1's AvatarChoices), separate from the catalogue's avatar items. */
export const AVATAR_OPTION_KINDS = ["accent", "feature", "accessory", "background"] as const;
export type AvatarOptionKind = (typeof AVATAR_OPTION_KINDS)[number];
export type AvatarOptionChoices = Record<AvatarOptionKind, string | null>;
export const NO_CHOICES: AvatarOptionChoices = { accent: null, feature: null, accessory: null, background: null };

export interface AvatarChoice {
  /** One of the 32 game avatars (docs/art/avatars, its slug). */
  id: string;
  /** An index into the 32 player colours. */
  colour: number;
  /** A gem colour's id, or null (gems unlock with C1). */
  gem: string | null;
  /** The builder's options (null: the avatar's default). */
  choices?: AvatarOptionChoices;
}

export interface Loadout {
  slots: Partial<Record<LoadoutSlot, string | null>>;
  /**
   * The look slots (wave 2 E1, skins): `game-skin:<game>`, `world-theme:<game>` and `card-back` → the equipped item's
   * id or null. Only items the account owns can sit in a slot (A1's database refuses any other), so these are owned.
   */
  gameLooks?: Record<string, string | null>;
  avatar: AvatarChoice | null;
  /** Gems this account may use (none until C1). */
  unlockedGems?: string[];
}

/** getAvatarOptions: each avatar's options per kind. */
export type AvatarOptions = Record<string, Partial<Record<AvatarOptionKind, { options: string[]; default: string | null }>>>;

/** What another player's card shows (A1's getPublicCard). */
export interface PublicCard {
  username: string;
  playerNumber: number;
  founding: boolean;
  loadout: Loadout;
}

export type Refusal = { ok: false; reason: string; message: string };
export type Saved = { ok: true; loadout: Loadout | null };

/** A1's interface, as the screens use it. */
export interface IdentityBackend {
  getCatalogue(): Promise<CatalogueItem[]>;
  getMyWallet(): Promise<{ coins: number } | null>;
  getMyInventory(): Promise<string[]>;
  getMyLoadout(): Promise<Loadout | null>;
  getAvatarOptions(): Promise<AvatarOptions>;
  equip(slot: EquipSlot, itemId: string | null): Promise<Saved | Refusal>;
  setAvatar(choice: AvatarChoice): Promise<Saved | Refusal>;
  getPublicCard(playerId: string): Promise<PublicCard | null>;
}

let override: IdentityBackend | null | undefined;
let loaded: Promise<IdentityBackend | null> | null = null;

/** Checks only: stands in for A1 (null: no backend). */
export function setIdentityBackend(backend: IdentityBackend | null | undefined): void {
  override = backend;
  loaded = null;
}

/** A1's functions behind this interface (a1Binding.ts), or null if they can't load. */
export function identityBackend(): Promise<IdentityBackend | null> {
  if (override !== undefined) return Promise.resolve(override);
  loaded ??= import("./a1Binding").then((m) => m.bindA1()).catch(() => null);
  return loaded;
}

/* ------------------------------------------------------------------ fitting A1's answers */

const RARITIES = new Set<Rarity>(["common", "rare", "epic", "elite", "legendary"]);

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** One catalogue record, from A1's row (camelCase or the catalogue's snake_case). */
export function normaliseItem(raw: unknown): CatalogueItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r["id"] !== "string" || typeof r["kind"] !== "string") return null;
  const rarity = typeof r["rarity"] === "string" ? (r["rarity"].toLowerCase() as Rarity) : null;
  return {
    id: r["id"],
    name: typeof r["name"] === "string" ? r["name"] : r["id"],
    kind: r["kind"],
    rarity: rarity && RARITIES.has(rarity) ? rarity : null,
    source: typeof r["source"] === "string" ? r["source"] : "shop",
    passLevel: num(r["passLevel"] ?? r["pass_level"]),
    shopPrice: num(r["priceCoins"] ?? r["shopPrice"] ?? r["shop_price_coins"]),
    animated: r["animated"] === true,
    withdrawn: r["withdrawn"] === true,
  };
}

/**
 * A loadout, from A1's answer: `slots` by name, the avatar as `avatarId`, `colour`, `gem` and `avatar` (the builder's
 * choices) at the top level (src/lib/data/economy.ts Loadout); a nested `avatar: { id, colour, gem }` is read too.
 */
export function normaliseLoadout(raw: unknown): Loadout | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const slotsRaw = (r["slots"] && typeof r["slots"] === "object" ? r["slots"] : r) as Record<string, unknown>;
  const slots: Loadout["slots"] = {};
  for (const slot of LOADOUT_SLOTS) {
    const v = slotsRaw[slot];
    if (typeof v === "string" || v === null) slots[slot] = v;
  }
  const nested = r["avatar"] && typeof r["avatar"] === "object" ? (r["avatar"] as Record<string, unknown>) : null;
  const id = typeof r["avatarId"] === "string" ? r["avatarId"] : typeof nested?.["id"] === "string" ? (nested["id"] as string) : null;
  const choices: AvatarOptionChoices = { ...NO_CHOICES };
  for (const kind of AVATAR_OPTION_KINDS) {
    const v = nested?.[kind];
    if (typeof v === "string") choices[kind] = v;
  }
  const avatar = id
    ? {
        id,
        colour: num(r["colour"]) ?? num(nested?.["colour"]) ?? 0,
        gem: typeof r["gem"] === "string" ? r["gem"] : typeof nested?.["gem"] === "string" ? (nested["gem"] as string) : null,
        choices,
      }
    : null;
  const gameLooks: Record<string, string | null> = {};
  for (const [slot, v] of Object.entries(slotsRaw)) {
    if (!isLookSlot(slot)) continue;
    if (typeof v === "string" && v.startsWith(`${slot.split(":")[0]}.`)) gameLooks[slot] = v;
    else if (v === null) gameLooks[slot] = null;
  }
  const unlocked = Array.isArray(r["unlockedGems"]) ? (r["unlockedGems"] as unknown[]).filter((g): g is string => typeof g === "string") : [];
  return { slots, avatar, unlockedGems: unlocked, gameLooks };
}

/**
 * Another player's card, from A1's getPublicCard: its flat shape (`username`, `playerNumber`, `founding`, `avatarId`,
 * `colour`, `gem`, `avatar` choices, `cardArt`, `frame`, `nameColour`) read into a loadout. Until 11 Nov 2026 this
 * answer was passed on as it came, so `loadout` was missing and a friend's profile drew the default card (Joe's phone
 * check). A guest's default card (`account: false`) reads as null: guests show their colour and initial.
 */
export function normalisePublicCard(raw: unknown): PublicCard | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r["account"] === false || typeof r["username"] !== "string") return null;
  const loadout = normaliseLoadout({
    slots: { "card-art": r["cardArt"] ?? null, frame: r["frame"] ?? null, "name-colour": r["nameColour"] ?? null },
    avatarId: r["avatarId"],
    colour: r["colour"],
    gem: r["gem"],
    avatar: r["avatar"],
  });
  if (!loadout) return null;
  return { username: r["username"], playerNumber: num(r["playerNumber"]) ?? 0, founding: r["founding"] === true, loadout };
}

/** The option rows worth drawing for an avatar: only kinds with more than one choice (never an empty or single picker). */
export function optionRows(options: AvatarOptions, avatarId: string): { kind: AvatarOptionKind; options: string[]; default: string | null }[] {
  const mine = options[avatarId] ?? {};
  return AVATAR_OPTION_KINDS.flatMap((kind) => {
    const row = mine[kind];
    return row && Array.isArray(row.options) && row.options.length > 1 ? [{ kind, options: row.options, default: row.default ?? null }] : [];
  });
}

/** A refusal's plain message (A1's own when it sends one). */
export function refusalOf(raw: unknown): Refusal | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r["ok"] !== false) return null;
  return {
    ok: false,
    reason: typeof r["reason"] === "string" && /^[a-z0-9_]{1,40}$/.test(r["reason"]) ? r["reason"] : "refused",
    message: typeof r["message"] === "string" && r["message"] ? r["message"] : "That didn’t save. Try again.",
  };
}
