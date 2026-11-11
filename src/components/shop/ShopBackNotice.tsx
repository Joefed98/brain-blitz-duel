import { useEffect, useState } from "react";

import { Toast } from "@/design/components";
import { takeBackNotice, type PhoneShopStatus } from "@/lib/shop/shopStatus";

/**
 * The in-app notice when a wishlisted item comes back (wave 2, D1): a toast above the tab bar, once per item per day
 * it is back, gone after a few seconds or on a tap (which opens the Shop). Nothing is drawn otherwise.
 */
const SHOW_MS = 6_000;

export function ShopBackNotice({ status, onOpen }: { status: PhoneShopStatus; onOpen: () => void }) {
  const [items, setItems] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const fresh = takeBackNotice(status);
    if (fresh.length) setItems(fresh);
  }, [status]);
  useEffect(() => {
    if (!items.length) return;
    const timer = window.setTimeout(() => setItems([]), SHOW_MS);
    return () => window.clearTimeout(timer);
  }, [items]);
  if (!items.length) return null;
  const text =
    items.length === 1 ? `${items[0]!.name} is back in the shop today.` : `${items.length} items on your wishlist are back in the shop today.`;
  return (
    <Toast
      as="button"
      tone="live"
      className="shop-back-toast"
      data-shop-back-notice=""
      onClick={() => {
        setItems([]);
        onOpen();
      }}
    >
      {text}
    </Toast>
  );
}
