/**
 * The binding to Session A1's coins-and-items server functions (wave 2, train A; src/lib/economy/economy.functions.ts,
 * types in src/lib/data/economy.ts): the one place that calls them, each answer fitted through backend.ts's
 * normalise* / refusalOf. Their one argument is `{ data }`. A rate-limited read (`{ busy: true }`) reads as nothing.
 */
import type { IdentityBackend } from "./backend";

const busy = (v: unknown): boolean => !!v && typeof v === "object" && (v as { busy?: unknown }).busy === true;

export async function bindA1(): Promise<IdentityBackend | null> {
  const fns = await import("@/lib/economy/economy.functions");
  return {
    getCatalogue: async () => {
      const items = await fns.getCatalogue();
      return items as never;
    },
    getMyWallet: async () => {
      const w = await fns.getMyWallet();
      if (busy(w)) return null;
      const wallet = w as { account: boolean; balance: number | null };
      return wallet.account && typeof wallet.balance === "number" ? { coins: wallet.balance } : null;
    },
    getMyInventory: async () => {
      const inv = await fns.getMyInventory();
      return Array.isArray(inv) ? inv.map((i) => i.id) : [];
    },
    getMyLoadout: async () => {
      const l = await fns.getMyLoadout();
      return busy(l) ? null : (l as never);
    },
    getAvatarOptions: async () => (await fns.getAvatarOptions()) as never,
    equip: async (slot, itemId) => (await fns.equip({ data: { slot, itemId } })) as never,
    setAvatar: async (choice) =>
      (await fns.setAvatar({
        data: {
          avatarId: choice.id,
          colour: choice.colour,
          gem: choice.gem,
          accent: choice.choices?.accent ?? null,
          feature: choice.choices?.feature ?? null,
          accessory: choice.choices?.accessory ?? null,
          background: choice.choices?.background ?? null,
        },
      })) as never,
    getPublicCard: async (playerId) => {
      const c = await fns.getPublicCard({ data: { playerId } });
      return busy(c) ? null : (c as never);
    },
  };
}
