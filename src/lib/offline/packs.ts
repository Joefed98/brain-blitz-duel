/**
 * Practice packs (offline practice, 31 Oct 2026): up to PACK_MAX_DEALS deals a game, downloaded while online
 * and played with no signal. A deal is what the phone needs to play (the public half: board, layout, seed,
 * stamps) plus the server's sealed token for grading (the private half encrypted with a key only the server
 * has, as every online practice round carries it); never a solution in the clear.
 *
 * A pack is tied to its game's stamps: when the build's stamps for a game change (practiceStamps), the next
 * top-up replaces the pack. Runs already queued keep their own deal, so they are still graded on the stamps
 * they were played on. Each deal is used once: taking it removes it from the pack, and top-ups refill.
 */
import { appUpdater } from "@/lib/appUpdate";
import { currentPracticeStamp, stampSignature } from "@/lib/duel/practiceStamps";
import { recentPracticeTypes } from "@/lib/duel/practiceRecent";
import { PUZZLE_TYPES } from "@/lib/duel/registry";
import type { PuzzleData, PuzzleType } from "@/lib/duel/types";

import { getAll, putOne, update } from "./db";
import { emitOfflineChange } from "./events";
import { isOnline } from "./online";
import { ONLINE_ONLY_TYPES, PACK_MAX_DEALS, PACK_MAX_TYPES } from "./offlineStatus";
import { meteredConnection, offlineDownloadsOn } from "./settings";

export interface PackDeal {
  /** The pack seed: the seed the server dealt this board from. */
  id: number;
  puzzle: PuzzleData;
  sealed: string;
}

export interface PracticePack {
  type: PuzzleType;
  /** The dealt puzzles' stamp signature (practiceStamps.stampSignature). */
  stamp: string;
  /** The build's own stamp for the game when the pack was filled (a change means a new pack). */
  builtFor: string;
  deals: PackDeal[];
  updatedAt: number;
}

/** Every game that can have a pack: every practice game but the online-only ones. */
export function packTypes(): PuzzleType[] {
  return PUZZLE_TYPES.filter((type) => !ONLINE_ONLY_TYPES.has(type));
}

export async function readPacks(): Promise<PracticePack[]> {
  try {
    return await getAll<PracticePack>("packs");
  } catch {
    return [];
  }
}

/** How many deals are left in each game's pack. */
export async function packCounts(): Promise<Partial<Record<PuzzleType, number>>> {
  const out: Partial<Record<PuzzleType, number>> = {};
  for (const pack of await readPacks()) out[pack.type] = pack.deals.length;
  return out;
}

/** Takes one deal of a game from its pack (null when the pack is empty or missing). */
export async function takePackDeal(type: PuzzleType): Promise<PackDeal | null> {
  let taken: PackDeal | null = null;
  try {
    await update<PracticePack>("packs", type, (pack) => {
      if (!pack || pack.deals.length === 0) return pack;
      const [first, ...rest] = pack.deals;
      taken = first ?? null;
      return { ...pack, deals: rest };
    });
  } catch {
    return null;
  }
  if (taken) emitOfflineChange();
  return taken;
}

/** What a top-up should ask the server for: each game short of a full pack, or whose stamps changed. */
export function packNeeds(packs: readonly PracticePack[], types: readonly PuzzleType[] = packTypes()): { type: PuzzleType; count: number }[] {
  const byType = new Map(packs.map((p) => [p.type, p]));
  const needs: { type: PuzzleType; count: number }[] = [];
  for (const type of types) {
    const pack = byType.get(type);
    if (!pack || pack.builtFor !== currentPracticeStamp(type)) needs.push({ type, count: PACK_MAX_DEALS });
    else if (pack.deals.length < PACK_MAX_DEALS) needs.push({ type, count: PACK_MAX_DEALS - pack.deals.length });
  }
  return needs;
}

/** Stores fresh deals: added to the pack when its stamps match, else the pack is replaced. */
export async function storeDeals(type: PuzzleType, deals: PackDeal[]): Promise<void> {
  if (deals.length === 0) return;
  const stamp = stampSignature(deals[0]!.puzzle);
  const builtFor = currentPracticeStamp(type);
  await update<PracticePack>("packs", type, (pack) => {
    const keep = pack && pack.stamp === stamp && pack.builtFor === builtFor ? pack.deals : [];
    const seen = new Set(keep.map((d) => d.id));
    const fresh = deals.filter((d) => stampSignature(d.puzzle) === stamp && !seen.has(d.id));
    return { type, stamp, builtFor, deals: [...keep, ...fresh].slice(0, PACK_MAX_DEALS), updatedAt: Date.now() };
  });
}

/** Replaces a game's pack outright (offline-check's stamp-change proof writes an older pack this way). */
export async function writePack(pack: PracticePack): Promise<void> {
  await putOne("packs", pack);
  emitOfflineChange();
}

let topping: Promise<void> | null = null;

export interface TopUpDeps {
  fetchPacks: (types: PuzzleType[], count: number) => Promise<{ type: PuzzleType; deals: PackDeal[] }[]>;
}

async function defaultFetch(types: PuzzleType[], count: number) {
  const { practicePackFn } = await import("@/lib/duel/practice.functions");
  const { packs } = await practicePackFn({ data: { types, count } });
  return packs as { type: PuzzleType; deals: PackDeal[] }[];
}

/**
 * A browser driven by automation (navigator.webdriver: the repo's browser checks) never tops up packs unless the page
 * opts in with `window.__DUELZ_ALLOW_PACKS__` (offline-check does). Each check context is a fresh device, and its
 * top-up dealt every offline game's packs on the checks' dev server: ~3 GB of server banks loaded and a busy CPU,
 * which ran the server out of memory and timed pages out (4 Nov 2026). Real devices never report webdriver.
 */
function automatedWithoutPacks(): boolean {
  try {
    return navigator.webdriver === true && (window as { __DUELZ_ALLOW_PACKS__?: boolean }).__DUELZ_ALLOW_PACKS__ !== true;
  } catch {
    return false;
  }
}

/** Whether a top-up may run now: online, downloads on, not metered, and no round on screen. */
export function topUpAllowed(): boolean {
  if (automatedWithoutPacks()) return false;
  if (!isOnline() || !offlineDownloadsOn() || meteredConnection()) return false;
  return appUpdater()?.gate() !== "hold";
}

/**
 * Fills every pack in the background, a few games a call, recently played games first. Stops quietly at the
 * first failure (no signal, server busy) or when a round starts; the next trigger carries on.
 */
export function topUpPacks(deps: TopUpDeps = { fetchPacks: defaultFetch }): Promise<void> {
  if (topping) return topping;
  if (!topUpAllowed()) return Promise.resolve();
  topping = (async () => {
    try {
      const recent = recentPracticeTypes();
      const order = (t: PuzzleType) => {
        const i = recent.indexOf(t);
        return i < 0 ? recent.length : i;
      };
      const needs = packNeeds(await readPacks()).sort((a, b) => order(a.type) - order(b.type));
      for (let i = 0; i < needs.length; i += PACK_MAX_TYPES) {
        if (!topUpAllowed()) return;
        const batch = needs.slice(i, i + PACK_MAX_TYPES);
        const count = Math.max(...batch.map((n) => n.count));
        let packs: { type: PuzzleType; deals: PackDeal[] }[];
        try {
          packs = await deps.fetchPacks(batch.map((n) => n.type), count);
        } catch {
          return;
        }
        for (const pack of packs) await storeDeals(pack.type, pack.deals);
        emitOfflineChange();
      }
    } finally {
      topping = null;
    }
  })();
  return topping;
}
