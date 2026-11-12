/**
 * The phone's view of its coins, items and loadout (wave 2, session A2), read through A1's interface (backend.ts)
 * and shared by the coin counter, Profile and Customise. Accounts only: a guest has no wallet, inventory or loadout
 * (their card is the guest card). Nothing here decides a rule: equip() and setAvatar() are A1's, and their answer
 * (saved or refused) is what the screens show.
 */
import { useEffect, useState } from "react";

import { useAccount } from "@/lib/account/accountApi";
import { forgetGameLooks } from "@/lib/skins/equipped";

import {
  identityBackend,
  normaliseItem,
  normaliseLoadout,
  refusalOf,
  type AvatarChoice,
  type AvatarOptions,
  isLookSlot,
  type CatalogueItem,
  type EquipSlot,
  type Loadout,
  type Refusal,
} from "./backend";

export interface MyIdentity {
  /** Whether A1's server answered (false: no backend yet, or it failed). */
  live: boolean;
  catalogue: CatalogueItem[];
  owned: ReadonlySet<string>;
  loadout: Loadout | null;
  coins: number | null;
  /** Each avatar's builder options (getAvatarOptions). */
  avatarOptions: AvatarOptions;
}

const EMPTY: MyIdentity = { live: false, catalogue: [], owned: new Set(), loadout: null, coins: null, avatarOptions: {} };

let current: MyIdentity = EMPTY;
let loading: Promise<MyIdentity> | null = null;
const listeners = new Set<(v: MyIdentity) => void>();

function publish(next: MyIdentity): MyIdentity {
  current = next;
  for (const fn of listeners) fn(next);
  return next;
}

/** Reads the catalogue, wallet, inventory and loadout (one round of A1's calls). */
export function refreshIdentity(): Promise<MyIdentity> {
  loading = (async () => {
    const backend = await identityBackend();
    if (!backend) return publish(EMPTY);
    // C2: the rewards every account is owed (sign-up coins, a Founding Player's) are settled first, so the coin
    // counter's first balance includes them (badgesApi.ts; never longer than its short wait).
    await import("@/lib/badges/badgesApi").then((m) => m.rewardsSettled()).catch(() => undefined);
    try {
      const [catalogue, wallet, inventory, loadout, avatarOptions] = await Promise.all([
        backend.getCatalogue(),
        backend.getMyWallet(),
        backend.getMyInventory(),
        backend.getMyLoadout(),
        backend.getAvatarOptions().catch(() => ({}) as AvatarOptions),
      ]);
      return publish({
        live: true,
        catalogue: (catalogue ?? []).map(normaliseItem).filter((i): i is CatalogueItem => i !== null),
        owned: new Set(Array.isArray(inventory) ? inventory.filter((x): x is string => typeof x === "string") : []),
        loadout: normaliseLoadout(loadout),
        coins: wallet && typeof wallet.coins === "number" ? wallet.coins : null,
        avatarOptions: avatarOptions && typeof avatarOptions === "object" ? avatarOptions : {},
      });
    } catch {
      return publish(EMPTY);
    }
  })();
  return loading;
}

/** The identity of a signed-in device (EMPTY for a guest or before the account is known). */
export function useMyIdentity(): MyIdentity {
  const account = useAccount();
  const [state, setState] = useState<MyIdentity>(current);
  const isAccount = account.kind === "account";
  useEffect(() => {
    if (!isAccount) return;
    listeners.add(setState);
    if (!loading) void refreshIdentity();
    else setState(current);
    return () => {
      listeners.delete(setState);
    };
  }, [isAccount]);
  return isAccount ? state : EMPTY;
}

/** Forgets the cached identity (a sign-out, a check). */
export function resetIdentity(): void {
  loading = null;
  publish(EMPTY);
}

/**
 * Saves one slot; A1 answers saved (with the loadout) or refused. A game-look slot (card back, game skin, world theme)
 * also drops the live stages' last read (src/lib/skins/equipped.ts), so the next round draws the new look.
 */
export async function saveSlot(slot: EquipSlot, itemId: string | null): Promise<{ ok: true } | Refusal> {
  const backend = await identityBackend();
  if (!backend) return { ok: false, reason: "not_ready", message: "Saving your card isn’t ready yet. Try again soon." };
  try {
    const answer = await backend.equip(slot, itemId);
    const refused = refusalOf(answer);
    if (refused) return refused;
    const loadout = normaliseLoadout((answer as { loadout?: unknown }).loadout);
    const was = current.loadout;
    const fallback: Loadout = isLookSlot(slot)
      ? { ...was, slots: { ...was?.slots }, avatar: was?.avatar ?? null, gameLooks: { ...was?.gameLooks, [slot]: itemId } }
      : { ...was, slots: { ...was?.slots, [slot]: itemId }, avatar: was?.avatar ?? null };
    publish({ ...current, loadout: loadout ?? fallback });
    if (isLookSlot(slot)) forgetGameLooks();
    return { ok: true };
  } catch {
    return { ok: false, reason: "error", message: "That didn’t save. Check your connection and try again." };
  }
}

/** Saves the avatar (all three parts at once). */
export async function saveAvatar(choice: AvatarChoice): Promise<{ ok: true } | Refusal> {
  const backend = await identityBackend();
  if (!backend) return { ok: false, reason: "not_ready", message: "Saving your card isn’t ready yet. Try again soon." };
  try {
    const answer = await backend.setAvatar(choice);
    const refused = refusalOf(answer);
    if (refused) return refused;
    const loadout = normaliseLoadout((answer as { loadout?: unknown }).loadout);
    publish({ ...current, loadout: loadout ?? { slots: current.loadout?.slots ?? {}, avatar: choice } });
    return { ok: true };
  } catch {
    return { ok: false, reason: "error", message: "That didn’t save. Check your connection and try again." };
  }
}
