/**
 * The phone's shop calls (wave 2, session D1): thin wrappers over shop.functions.ts. Each purchase carries a request
 * id made once per confirmation, so a retried or double-tapped Buy pays once. After coins move, the identity copy
 * (coin counter, owned items) is read again.
 */
import { refreshIdentity } from "@/lib/identity/identityApi";

import type { BuyResult, PackId, ShopClosed, ShopView } from "./types";

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

const FAILED: BuyResult = { ok: false, reason: "error", message: "Something went wrong. Try again." };

export async function loadShop(section?: string): Promise<ShopView | ShopClosed | null> {
  try {
    const { getShopFn } = await import("./shop.functions");
    return (await getShopFn({ data: section ? { section } : {} })) as ShopView | ShopClosed;
  } catch {
    return null;
  }
}

async function after(result: BuyResult): Promise<BuyResult> {
  if (result.ok) void refreshIdentity();
  return result;
}

export async function buyItem(itemId: string, requestId: string): Promise<BuyResult> {
  try {
    const { buyItemFn } = await import("./shop.functions");
    return after((await buyItemFn({ data: { itemId, requestId } })) as BuyResult);
  } catch {
    return FAILED;
  }
}

export async function buyBundle(requestId: string): Promise<BuyResult> {
  try {
    const { buyBundleFn } = await import("./shop.functions");
    return after((await buyBundleFn({ data: { requestId } })) as BuyResult);
  } catch {
    return FAILED;
  }
}

export async function testPack(pack: PackId, requestId: string): Promise<BuyResult> {
  try {
    const { testPackFn } = await import("./shop.functions");
    return after((await testPackFn({ data: { pack, requestId } })) as BuyResult);
  } catch {
    return FAILED;
  }
}

export async function setWish(itemId: string, on: boolean): Promise<boolean | null> {
  try {
    const { wishlistFn } = await import("./shop.functions");
    const out = (await wishlistFn({ data: { itemId, on } })) as { ok: boolean; wished: boolean };
    return out.ok ? out.wished : null;
  } catch {
    return null;
  }
}
