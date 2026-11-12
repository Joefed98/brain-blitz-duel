/**
 * Coins and items: the server's rules (wave 2 A1; docs/economy/README.md). Server only. The screens reach the reads
 * and the two look changes through economy.functions.ts; coins and items are credited, spent and granted only by
 * later server code calling the helpers at the bottom (never from the phone): the sign-up reward (C2), challenges,
 * the pass, the shop. Each helper records its analytics event (src/lib/data/events.server.ts).
 *
 * Nothing here is read by scoring, grading, replay, matchmaking or timing code (economy-neutral-check).
 */

import type {
  AcquiredHow,
  AvatarChoices,
  AvatarOptions,
  CatalogueItem,
  CoinLine,
  ConsumableCounts,
  EquipRefusal,
  InventoryItem,
  Loadout,
  LoadoutResult,
  PublicCard,
  Wallet,
} from "@/lib/data/economy";
import {
  type CatalogueRow,
  type CoinOutcome,
  type ConsumableOutcome,
  type GrantItemStatus,
  type LedgerRef,
  creditCoinsRpc,
  equipRpc,
  grantItemRpc,
  postConsumableRpc,
  purchaseItemRpc,
  readAvatarOptions,
  readCatalogue,
  readCoinBalance,
  readCoinLines,
  readConsumables,
  readGemUnlocks,
  readInventory,
  readLoadoutRow,
  readLoadoutSlots,
  readPublicCards,
  refundCoinsRpc,
  setAvatarRpc,
  spendCoinsRpc,
} from "@/lib/data/economy.server";
import type { Db } from "@/lib/data/db.server";
import { recordEvents } from "@/lib/data/events.server";
import { readProfile } from "@/lib/data/profiles.server";

import {
  AVATAR_IDS,
  AVATAR_OPTION_KINDS,
  CONSUMABLE_KINDS,
  DEFAULT_AVATAR,
  GEM_IDS,
  LOADOUT_SLOTS,
  SLOT_DEFAULTS,
  isLoadoutSlot,
  type AvatarId,
  type GemId,
  type ItemKind,
  type ItemSource,
  type Rarity,
} from "./slots";

/** How many of the latest coin lines getMyWallet sends. */
export const WALLET_RECENT_LINES = 50;
/** How long the server keeps the catalogue in memory (it changes only with a migration). */
export const CATALOGUE_CACHE_MS = 5 * 60 * 1000;

const MESSAGES: Record<EquipRefusal, string> = {
  guest: "Make an account to keep items and change your look.",
  not_owned: "You don’t own that item yet.",
  wrong_slot: "That item doesn’t go there.",
  unknown_slot: "That slot doesn’t exist.",
  unknown_item: "That item doesn’t exist.",
  bad_avatar: "That avatar doesn’t exist.",
  bad_colour: "That colour doesn’t exist.",
  bad_option: "That option isn’t one of this avatar’s.",
  gem_locked: "That gem isn’t unlocked yet.",
  busy: "That’s a lot of changes. Give it a few minutes.",
  error: "Something went wrong. Try again.",
};

export function refusal(reason: EquipRefusal): { ok: false; reason: EquipRefusal; message: string } {
  return { ok: false, reason, message: MESSAGES[reason] };
}

/* ------------------------------------------------------------------ the catalogue */

export function toCatalogueItem(row: CatalogueRow): CatalogueItem {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as ItemKind,
    slot: row.slot,
    game: row.game,
    gameType: row.game_type,
    rarity: row.rarity as Rarity | null,
    source: row.source as ItemSource,
    passLevel: row.pass_level,
    priceCoins: row.price_coins,
    bundle: row.bundle,
    animated: row.animated,
    exclusive: row.exclusive,
    exclusiveForever: row.exclusive_forever,
    note: row.note,
    png: row.png_path,
    html: row.html_path,
  };
}

let catalogueCache: { at: number; items: CatalogueItem[] } | null = null;

/** Every item (the same for everyone), from memory for CATALOGUE_CACHE_MS. */
export async function catalogue(client: Db, nowMs: number = Date.now()): Promise<CatalogueItem[]> {
  if (catalogueCache && nowMs - catalogueCache.at < CATALOGUE_CACHE_MS) return catalogueCache.items;
  const { data, error } = await readCatalogue(client);
  if (error) throw new Error(`catalogue: ${error.message}`);
  const items = data.map(toCatalogueItem);
  if (items.length) catalogueCache = { at: nowMs, items };
  return items;
}

/** Drops the in-memory catalogue (checks). */
export function forgetCatalogueCache(): void {
  catalogueCache = null;
}

async function isAccount(client: Db, userId: string): Promise<boolean> {
  const { data, error } = await readProfile(client, userId);
  if (error) throw new Error(`economy: ${error.message}`);
  return data !== null;
}

/** Every avatar's builder options per kind, with its default (the same for everyone). */
export async function avatarOptions(client: Db): Promise<AvatarOptions> {
  const { data, error } = await readAvatarOptions(client);
  if (error) throw new Error(`avatar options: ${error.message}`);
  const out = {} as AvatarOptions;
  for (const avatar of AVATAR_IDS)
    out[avatar] = Object.fromEntries(
      AVATAR_OPTION_KINDS.map((k) => [k, { options: [] as string[], default: null as string | null }]),
    ) as AvatarOptions[AvatarId];
  for (const row of data) {
    const kind = row.kind as (typeof AVATAR_OPTION_KINDS)[number];
    const entry = out[row.avatar_id as AvatarId]?.[kind];
    if (!entry) continue;
    entry.options.push(row.option_id);
    if (row.is_default) entry.default = row.option_id;
  }
  return out;
}

const NO_CHOICES: AvatarChoices = { accent: null, feature: null, accessory: null, background: null };

/* ------------------------------------------------------------------ the player's own */

const NO_WALLET: Wallet = { account: false, balance: null, consumables: null, recent: [] };

export async function walletFor(client: Db, userId: string): Promise<Wallet> {
  if (!(await isAccount(client, userId))) return NO_WALLET;
  const [balance, consumables, lines] = await Promise.all([
    readCoinBalance(client, userId),
    readConsumables(client, userId),
    readCoinLines(client, userId, WALLET_RECENT_LINES),
  ]);
  const failed = balance.error ?? consumables.error ?? lines.error;
  if (failed) throw new Error(`wallet: ${failed.message}`);
  const counts = Object.fromEntries(CONSUMABLE_KINDS.map((k) => [k, 0])) as unknown as ConsumableCounts;
  for (const row of consumables.data)
    if ((CONSUMABLE_KINDS as readonly string[]).includes(row.kind)) counts[row.kind as keyof ConsumableCounts] = row.count;
  const recent: CoinLine[] = lines.data.map((l) => ({
    id: l.id,
    amount: l.amount,
    reason: l.reason,
    refKind: l.ref_kind,
    refId: l.ref_id,
    balanceAfter: l.balance_after,
    at: l.created_at,
  }));
  return { account: true, balance: balance.data ?? 0, consumables: counts, recent };
}

/** Owned items with their catalogue fields (a guest owns nothing). */
export async function inventoryFor(client: Db, userId: string): Promise<InventoryItem[]> {
  const { data, error } = await readInventory(client, userId);
  if (error) throw new Error(`inventory: ${error.message}`);
  if (!data.length) return [];
  const byId = new Map((await catalogue(client)).map((item) => [item.id, item]));
  return data.flatMap((row) => {
    const item = byId.get(row.item_id);
    return item ? [{ ...item, how: row.how as AcquiredHow, acquiredAt: row.acquired_at, ledgerId: row.ledger_id }] : [];
  });
}

/** The loadout of an account, every slot named (its item, its default or null); null for a guest. */
export async function loadoutFor(client: Db, userId: string): Promise<Loadout | null> {
  const profile = await readProfile(client, userId);
  if (profile.error) throw new Error(`loadout: ${profile.error.message}`);
  if (!profile.data) return null;
  const [row, slots, gems] = await Promise.all([
    readLoadoutRow(client, userId),
    readLoadoutSlots(client, userId),
    readGemUnlocks(client, userId),
  ]);
  const failed = row.error ?? slots.error ?? gems.error;
  if (failed) throw new Error(`loadout: ${failed.message}`);
  const equipped = Object.fromEntries(slots.data.map((s) => [s.slot, s.item_id]));
  const all: Record<string, string | null> = {};
  for (const slot of LOADOUT_SLOTS) all[slot] = equipped[slot] ?? SLOT_DEFAULTS[slot] ?? null;
  return {
    avatarId: ((row.data?.avatar_id as AvatarId | undefined) ?? DEFAULT_AVATAR),
    colour: profile.data.colour,
    avatar: {
      accent: row.data?.accent ?? null,
      feature: row.data?.feature ?? null,
      accessory: row.data?.accessory ?? null,
      background: row.data?.background ?? null,
    },
    gem: (row.data?.gem as GemId | null | undefined) ?? null,
    slots: all,
    equipped,
    unlockedGems: gems.data.filter((g): g is GemId => (GEM_IDS as readonly string[]).includes(g)),
  };
}

/** Equips an owned item in a slot, or (null) returns the slot to its default. */
export async function equipItem(client: Db, userId: string, slot: unknown, itemId: unknown): Promise<LoadoutResult> {
  if (!isLoadoutSlot(slot)) return refusal("unknown_slot");
  if (itemId !== null && (typeof itemId !== "string" || !itemId || itemId.length > 80)) return refusal("unknown_item");
  if (!(await isAccount(client, userId))) return refusal("guest");
  const { data, error } = await equipRpc(client, { userId, slot, itemId });
  if (error || !data) return refusal("error");
  if (data === "no_account") return refusal("guest");
  if (data !== "equipped" && data !== "unequipped") return refusal(data);
  if (data === "equipped" && itemId) {
    const item = (await catalogue(client)).find((i) => i.id === itemId);
    recordEvents({ event: "item_equipped", playerId: userId, props: { kind: item?.kind ?? null } });
  }
  const loadout = await loadoutFor(client, userId);
  return loadout ? { ok: true, loadout } : refusal("guest");
}

/**
 * Sets the avatar (one of the 32), its main colour (one of the 32: the profile's colour), its accent, feature,
 * accessory and background (each null for the avatar's default, or one of that avatar's options) and the gem (an
 * unlocked one). Every field is set at once.
 */
export async function setAvatar(
  client: Db,
  userId: string,
  input: {
    avatarId?: unknown;
    colour?: unknown;
    accent?: unknown;
    feature?: unknown;
    accessory?: unknown;
    background?: unknown;
    gem?: unknown;
  },
): Promise<LoadoutResult> {
  const { avatarId, colour, gem } = input;
  const choices: Record<string, string | null> = {};
  for (const kind of AVATAR_OPTION_KINDS) {
    const value = input[kind];
    if (value === undefined || value === null) choices[kind] = null;
    else if (typeof value === "string" && value.length > 0 && value.length <= 40) choices[kind] = value;
    else return refusal("bad_option");
  }
  if (typeof avatarId !== "string" || !(AVATAR_IDS as readonly string[]).includes(avatarId)) return refusal("bad_avatar");
  if (typeof colour !== "number" || !Number.isInteger(colour) || colour < 0 || colour > 31) return refusal("bad_colour");
  if (gem !== null && gem !== undefined && (typeof gem !== "string" || !(GEM_IDS as readonly string[]).includes(gem)))
    return refusal("gem_locked");
  if (!(await isAccount(client, userId))) return refusal("guest");
  const { data, error } = await setAvatarRpc(client, {
    userId,
    avatarId,
    colour,
    accent: choices["accent"] ?? null,
    feature: choices["feature"] ?? null,
    accessory: choices["accessory"] ?? null,
    background: choices["background"] ?? null,
    gem: (gem as string | null) ?? null,
  });
  if (error || !data) return refusal("error");
  if (data === "no_account") return refusal("guest");
  if (data !== "set") return refusal(data);
  const loadout = await loadoutFor(client, userId);
  return loadout ? { ok: true, loadout } : refusal("guest");
}

/* ------------------------------------------------------------------ what anyone may see */

export function defaultCard(playerId: string): PublicCard {
  return {
    playerId,
    account: false,
    username: null,
    playerNumber: null,
    founding: false,
    avatarId: null,
    avatar: NO_CHOICES,
    colour: null,
    gem: null,
    cardArt: SLOT_DEFAULTS["card-art"]!,
    frame: SLOT_DEFAULTS["frame"]!,
    nameColour: null,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PublicCardRow = Awaited<ReturnType<typeof readPublicCards>>["data"][number];

function cardFromRow(playerId: string, row: PublicCardRow): PublicCard {
  return {
    playerId,
    account: true,
    username: row.username,
    playerNumber: row.player_number,
    founding: row.founding,
    avatarId: (AVATAR_IDS as readonly string[]).includes(row.avatar_id) ? (row.avatar_id as AvatarId) : DEFAULT_AVATAR,
    avatar: { accent: row.accent, feature: row.feature, accessory: row.accessory, background: row.background },
    colour: row.colour,
    gem: row.gem && (GEM_IDS as readonly string[]).includes(row.gem) ? (row.gem as GemId) : null,
    cardArt: row.card_art ?? SLOT_DEFAULTS["card-art"]!,
    frame: row.frame ?? SLOT_DEFAULTS["frame"]!,
    nameColour: row.name_colour,
  };
}

/** Any player's public card (a guest, an unknown id or an account waiting for deletion: the default card, colour plus initial). */
export async function publicCardFor(client: Db, playerId: unknown): Promise<PublicCard | null> {
  if (typeof playerId !== "string" || !UUID_RE.test(playerId)) return null;
  const { data, error } = await readPublicCards(client, [playerId]);
  if (error) throw new Error(`public card: ${error.message}`);
  const row = data[0];
  return row ? cardFromRow(playerId, row) : defaultCard(playerId);
}

/**
 * Many players' public cards in as few reads as the database allows (100 ids a read, in parallel): the friends list's
 * cards in one go. Only accounts come back (a guest, an unknown id or an account waiting for deletion is left out).
 */
export async function publicCardsFor(client: Db, playerIds: readonly string[]): Promise<Map<string, PublicCard>> {
  const ids = [...new Set(playerIds.filter((id) => UUID_RE.test(id)))];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));
  const reads = await Promise.all(chunks.map((chunk) => readPublicCards(client, chunk)));
  const out = new Map<string, PublicCard>();
  for (const { data, error } of reads) {
    if (error) throw new Error(`public cards: ${error.message}`);
    for (const row of data) out.set(row.user_id, cardFromRow(row.user_id, row));
  }
  return out;
}

/* ------------------------------------------------------------------ for later server code (never the phone) */

function coinError(message: string): CoinOutcome {
  throw new Error(`economy: ${message}`);
}

/**
 * Credits coins to an account once per `key` (e.g. `signup_reward:<user id>`). A guest gets nothing
 * (`no_account`). Records coins_credited.
 */
export async function creditCoins(
  client: Db,
  input: { userId: string; amount: number; reason: string; ref?: LedgerRef; key: string },
): Promise<CoinOutcome> {
  const { data, error } = await creditCoinsRpc(client, input);
  if (error || !data) return coinError(error?.message ?? "no answer");
  if (data.status === "credited")
    recordEvents({ event: "coins_credited", playerId: input.userId, props: { reason: input.reason, amount: input.amount } });
  return data;
}

/** Spends coins once per `key`, never below zero. Records coins_spent. */
export async function spendCoins(
  client: Db,
  input: { userId: string; amount: number; reason: string; ref?: LedgerRef; key: string },
): Promise<CoinOutcome> {
  const { data, error } = await spendCoinsRpc(client, input);
  if (error || !data) return coinError(error?.message ?? "no answer");
  if (data.status === "spent")
    recordEvents({ event: "coins_spent", playerId: input.userId, props: { reason: input.reason, amount: input.amount } });
  return data;
}

/** Refunds one spend line (once); an item it bought is taken back. Records coins_credited (reason refund). */
export async function refundCoins(client: Db, userId: string, lineId: number): Promise<CoinOutcome> {
  const { data, error } = await refundCoinsRpc(client, userId, lineId);
  if (error || !data) return coinError(error?.message ?? "no answer");
  if (data.status === "refunded")
    recordEvents({ event: "coins_credited", playerId: userId, props: { reason: "refund", amount: data.amount ?? null } });
  return data;
}

/** Buys a shop item at its catalogue price, once per `key`. Records coins_spent and item_granted. */
export async function purchaseItem(
  client: Db,
  input: { userId: string; itemId: string; key: string },
): Promise<CoinOutcome> {
  const { data, error } = await purchaseItemRpc(client, input);
  if (error || !data) return coinError(error?.message ?? "no answer");
  if (data.status === "purchased") {
    const item = (await catalogue(client)).find((i) => i.id === input.itemId);
    recordEvents([
      { event: "coins_spent", playerId: input.userId, props: { reason: "shop_purchase", amount: data.price ?? null } },
      {
        event: "item_granted",
        playerId: input.userId,
        props: { kind: item?.kind ?? null, rarity: item?.rarity ?? null, source: item?.source ?? null },
      },
    ]);
  }
  return data;
}

/** Grants an item without coins (pass, earned, grant). Records item_granted. */
export async function grantItem(
  client: Db,
  input: { userId: string; itemId: string; how: "pass" | "earned" | "grant" },
): Promise<GrantItemStatus> {
  const { data, error } = await grantItemRpc(client, input);
  if (error || !data) throw new Error(`economy: ${error?.message ?? "no answer"}`);
  if (data === "granted") {
    const item = (await catalogue(client)).find((i) => i.id === input.itemId);
    recordEvents({
      event: "item_granted",
      playerId: input.userId,
      props: { kind: item?.kind ?? null, rarity: item?.rarity ?? null, source: item?.source ?? null },
    });
  }
  return data;
}

/** Grants consumables (streak freezes, tickets) once per `key`. */
export async function grantConsumable(
  client: Db,
  input: { userId: string; kind: string; amount: number; reason: string; ref?: LedgerRef; key: string },
): Promise<ConsumableOutcome> {
  const { data, error } = await postConsumableRpc(client, { ...input, use: false });
  if (error || !data) throw new Error(`economy: ${error?.message ?? "no answer"}`);
  return data;
}

/** Uses consumables once per `key`, never below zero (wired where the feature lives: tickets in wave 4). */
export async function useConsumable(
  client: Db,
  input: { userId: string; kind: string; amount: number; reason: string; ref?: LedgerRef; key: string },
): Promise<ConsumableOutcome> {
  const { data, error } = await postConsumableRpc(client, { ...input, use: true });
  if (error || !data) throw new Error(`economy: ${error?.message ?? "no answer"}`);
  return data;
}
