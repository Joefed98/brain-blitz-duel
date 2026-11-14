import { SHOP_KIT_ART, type ShopKitArtName } from "./shopKitArt.data";

/**
 * One of the Shop pages' 3D art-kit images (scripts/shop-art.ts: the coin, Plus and Joules renders at 1x, 2x and 3x).
 * Decorative: the tile or row it sits in carries the words.
 */
export function KitArt({ name, size, className }: { name: ShopKitArtName; size?: number; className?: string }) {
  const art = SHOP_KIT_ART[name];
  const px = size ?? art.px;
  return (
    <img
      src={art.urls[0]}
      srcSet={art.urls.map((url, i) => `${url} ${i + 1}x`).join(", ")}
      width={px}
      height={px}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      data-shop-kit-art={name}
      className={className ? `shop-kit-art ${className}` : "shop-kit-art"}
    />
  );
}
