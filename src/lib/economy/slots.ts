/**
 * The loadout's slots and defaults (wave 2 A1; docs/economy/README.md): the ONE config for what can be equipped where,
 * shared by the server and the screens. The database holds the same item → slot mapping (public.catalogue_items.slot,
 * seeded by supabase/migrations/20261110160100_economy_catalogue.sql) and checks every equip against it; economy-check
 * proves the two agree.
 *
 * Presentation only: nothing here is read by scoring, grading, replay, matchmaking or timing code
 * (economy-neutral-check).
 */

/** The catalogue's item kinds (docs/art/wave-2/catalogue.json). */
export const ITEM_KINDS = [
  "card-art",
  "frame",
  "name-colour",
  "avatar-special-edition",
  "avatar-finish",
  "avatar-accessory",
  "reaction",
  "celebration",
  "tile-style",
  "game-skin",
  "world-theme",
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

export const RARITIES = ["common", "rare", "epic", "elite", "legendary"] as const;
export type Rarity = (typeof RARITIES)[number];

/** Where an item comes from. 'tournament' is reserved for wave 4's prizes (no item has it yet). */
export const ITEM_SOURCES = [
  "shop",
  "pass-free",
  "pass-premium",
  "free-starter",
  "earned-season-peak-tier",
  "earned-founding-player",
  "earned-top-500",
  "tournament",
] as const;
export type ItemSource = (typeof ITEM_SOURCES)[number];

/** Shop prices by rarity (Common and Rare are never sold). The database refuses any other price. */
export const SHOP_PRICES: Readonly<Record<"epic" | "elite" | "legendary", number>> = {
  epic: 1000,
  elite: 1600,
  legendary: 2800,
};

/** The skinnable games: the catalogue's display name → the game's PuzzleType id. */
export const GAME_TYPE_BY_NAME: Readonly<Record<string, string>> = {
  Apex: "racing",
  "Crazy Golf": "minigolf",
  "Cue Ball": "pool",
  "Curl Champ": "curling",
  "Free Cell": "freecell",
  "Full House": "pokersquares",
  "Top Bins": "freekick",
};
export const SKINNABLE_GAMES: readonly string[] = Object.values(GAME_TYPE_BY_NAME);

/**
 * How many reactions are equipped at once (the reaction set): slots `reaction-1` … `reaction-<n>`. The one place this
 * limit lives; the database accepts a reaction in any `reaction-<1–9>` slot the server names.
 */
export const REACTION_SLOTS = 4;

/** The single-item slots, then the per-game ones, then the reaction set. */
export const SINGLE_SLOTS = [
  "card-art",
  "frame",
  "name-colour",
  "avatar-special-edition",
  "avatar-finish",
  "avatar-accessory",
  "celebration",
  "podium-entrance",
  "tile-style",
] as const;

export const LOADOUT_SLOTS: readonly string[] = [
  ...SINGLE_SLOTS,
  ...SKINNABLE_GAMES.flatMap((game) => [`game-skin:${game}`, `world-theme:${game}`]),
  ...Array.from({ length: REACTION_SLOTS }, (_, i) => `reaction-${i + 1}`),
];

export function isLoadoutSlot(slot: unknown): slot is string {
  return typeof slot === "string" && LOADOUT_SLOTS.includes(slot);
}

/**
 * The slot an item is equipped in, from its catalogue record (the seed migration computes the same): its kind; per
 * game for skins and world themes; 'reaction' for reactions (any reaction-<n> slot); the celebration the catalogue
 * notes as a podium entrance goes in 'podium-entrance'.
 */
export function itemSlot(item: { kind: string; game: string | null; finish_or_note?: string | null }): string {
  if (item.kind === "game-skin" || item.kind === "world-theme") {
    const type = item.game ? GAME_TYPE_BY_NAME[item.game] : undefined;
    if (!type) throw new Error(`no game type for ${item.game}`);
    return `${item.kind}:${type}`;
  }
  if (item.kind === "celebration" && item.finish_or_note === "podium entrance") return "podium-entrance";
  return item.kind;
}

/** Whether an item whose catalogue slot is `itemSlotName` may sit in `slot`. */
export function slotAccepts(slot: string, itemSlotName: string): boolean {
  if (itemSlotName === "reaction") return /^reaction-\d+$/.test(slot) && isLoadoutSlot(slot);
  return slot === itemSlotName;
}

/** What an empty slot shows: the starter card art and the Plain frame; nothing for the rest. */
export const SLOT_DEFAULTS: Readonly<Record<string, string>> = {
  "card-art": "card-art.joulz-navy",
  frame: "frame.plain",
};

/** The 32 free game avatars (docs/art/avatars/avatars.json slugs), the first the default. */
export const AVATAR_IDS = [
  "captain-joulz",
  "gemstone",
  "hover",
  "apex",
  "pinball",
  "crazy-golf",
  "iron-wall",
  "wavefront",
  "breaker",
  "fission",
  "tempo",
  "nucleus",
  "blackout",
  "hanoi",
  "polypotions",
  "safe-cracker",
  "coral-pop",
  "swish",
  "flightpath",
  "home-run",
  "cue-ball",
  "blockzone",
  "spacewalk",
  "meteor",
  "moon-climb",
  "curl-champ",
  "top-bins",
  "lightbender",
  "cryptogrid",
  "high-rise",
  "rainbow-bridge",
  "orbit",
] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];
export const DEFAULT_AVATAR: AvatarId = "captain-joulz";

/** The avatar builder's option kinds (public.avatar_options): main colour aside (the 32 player colours). */
export const AVATAR_OPTION_KINDS = ["accent", "feature", "accessory", "background"] as const;
export type AvatarOptionKind = (typeof AVATAR_OPTION_KINDS)[number];
/** The one background the approved art draws: the avatar's own game scene on the #1E2640 backdrop (avatars.py). */
export const AVATAR_SCENE_BACKGROUND = "scene";

/** The gem colours (docs/art/avatars/avatars.json `gems`, slugged), unlocked by mastery stars (C1), never sold. */
export const GEM_IDS = [
  "amber",
  "rose-quartz",
  "ruby",
  "jade",
  "amethyst",
  "aquamarine",
  "sapphire",
  "pearl",
  "obsidian",
  "diamond",
] as const;
export type GemId = (typeof GEM_IDS)[number];

/** The consumables (public.consumable_kinds). */
export const CONSUMABLE_KINDS = ["streak_freeze", "ticket_score_attack", "ticket_category_cup"] as const;
export type ConsumableKind = (typeof CONSUMABLE_KINDS)[number];

/** Why coins or consumables change (public.economy_reasons). Later sessions add theirs here and in a migration. */
export const ECONOMY_REASONS = [
  "signup_reward",
  "challenge_reward",
  "badge_reward",
  "pass_reward",
  "plus_monthly",
  "ad_reward",
  "shop_purchase",
  "bundle_purchase",
  "pack_purchase",
  "refund",
  "admin_adjustment",
  // The shop (wave 2, session D1; supabase/migrations/20261112120000_shop.sql).
  "test_purchase",
  "test_purchase_removed",
] as const;
export type EconomyReason = (typeof ECONOMY_REASONS)[number];
