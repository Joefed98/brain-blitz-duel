import { SHOP_PREVIEWS } from "@/lib/shop/shopPreviews.data";

/** An item's approved still (public/shop/<id>.webp, scripts/shop-previews.ts), decorative: the card names the item. */
export function ShopArt({ id, className }: { id: string; className?: string }) {
  const hash = SHOP_PREVIEWS[id];
  if (!hash) return <span className={`shop-art shop-art-empty${className ? ` ${className}` : ""}`} aria-hidden="true" />;
  return (
    <img
      className={`shop-art${className ? ` ${className}` : ""}`}
      src={`/shop/${id}.webp?v=${hash}`}
      alt=""
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );
}

/** The heart: outlined, filled when wished. */
export function Heart({ on }: { on: boolean }) {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" className="shop-heart-icon" data-on={on ? "" : undefined}>
      <path d="M12 20.2 4.6 13a4.6 4.6 0 0 1 6.5-6.6l.9.9.9-.9A4.6 4.6 0 0 1 19.4 13z" />
    </svg>
  );
}

const RARITY_NAMES = { epic: "Epic", elite: "Elite", legendary: "Legendary" } as const;

export function RarityTag({ rarity }: { rarity: keyof typeof RARITY_NAMES }) {
  return (
    <span className="shop-rarity" data-rarity={rarity}>
      {RARITY_NAMES[rarity]}
    </span>
  );
}
