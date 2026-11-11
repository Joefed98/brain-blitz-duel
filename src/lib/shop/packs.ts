/**
 * Coin packs and the money line (wave 2, session D1). Shared by the phone and the server; the server decides.
 *
 * There is no payment code yet: on tester accounts a pack's "Test purchase" credits its coins with no payment, as a
 * ledger line marked as a test (reason test_purchase), which Joe can remove (shop.remove_test_purchase).
 *
 * The age rule: on the web, coin packs are for accounts 18 and over (`packAllowed`). The app stores' own rules can
 * be added per platform when the apps exist.
 */

export interface CoinPack {
  id: "starter" | "standard" | "multipack" | "mega";
  coins: number;
  /** In pence. */
  pence: number;
  name: string;
  note?: string;
}

export const COIN_PACKS: readonly CoinPack[] = [
  { id: "starter", coins: 500, pence: 99, name: "Starter" },
  { id: "standard", coins: 1_000, pence: 179, name: "Standard" },
  { id: "multipack", coins: 3_000, pence: 499, name: "Multipack" },
  { id: "mega", coins: 10_000, pence: 1_499, name: "Mega Pack", note: "best value" },
];

export type PackId = CoinPack["id"];

export function packById(id: unknown): CoinPack | null {
  return COIN_PACKS.find((p) => p.id === id) ?? null;
}

/** The real-money value of coins at the Starter pack's rate (500 coins for £0.99: about 505 coins per £1), in pence. */
export function coinsToPence(coins: number): number {
  const starter = COIN_PACKS[0]!;
  return Math.round((coins * starter.pence) / starter.coins);
}

/** "£5.54". */
export function formatPounds(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/** "2,800". */
export function formatCoins(coins: number): string {
  return coins.toLocaleString("en-GB");
}

/**
 * The confirmation's question, the ONE place an item's or bundle's real-money value is shown:
 * "Buy for 2,800 coins (≈ £5.54)?". Cards show coin prices only.
 */
export function confirmLine(coins: number): string {
  return `Buy for ${formatCoins(coins)} coins (≈ ${formatPounds(coinsToPence(coins))})?`;
}

/** Where a pack is bought. Only the web today. */
export type PackPlatform = "web";
export const PACK_PLATFORM: PackPlatform = "web";
/** The youngest age that may buy coin packs on each platform. */
export const PACK_MIN_AGE: Readonly<Record<PackPlatform, number>> = { web: 18 };

/** Whether an account of this age may buy packs on this platform (unknown age: no). */
export function packAllowed(age: number | null, platform: PackPlatform = PACK_PLATFORM): boolean {
  return age !== null && age >= PACK_MIN_AGE[platform];
}

export const PACK_AGE_MESSAGE = "Coin packs are for players 18 and over.";
