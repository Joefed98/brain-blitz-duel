/**
 * The Shop, Pass and Plus pages (phase 2 step 3, the Shop pages session, 14 Nov 2026; docs/design/style-guide phone/
 * and desktop/shop.png): the /shop route as the app draws it (harness mode "shop"), each part from its stand-in
 * (scripts/shop-fixture.ts, scripts/pass-fixture.ts), at every size and the sideways tablet, dark and light, with the
 * confirm and bundle sheets open. Appended last to THEME_SCREENS (theme-check, no-wrap-check), so every earlier draw
 * keeps its place in the parts.
 */
import type { Page } from "playwright";

import { passFixture } from "../pass-fixture";
import { plusFixture, shopFixture } from "../shop-fixture";
import { ALL_SIZES, NAV_SIZES, type ThemeScreen } from "../theme-screens";

const shopOn = { __DUELZ_SHOP_TAB__: true };
const light = { __harnessTheme: "light" };

async function openSheet(page: Page, selector: string) {
  await page.locator(selector).first().click();
  await page.locator("[data-jz='sheet'], [role='dialog']").first().waitFor({ timeout: 10_000 });
  await page.waitForTimeout(500);
}

export const SHOP_SCREENS = (): ThemeScreen[] => {
  const shop = { ...shopOn, __harnessShop: shopFixture() };
  const pass = { ...shopOn, __harnessShop: shopFixture(), __harnessPass: passFixture() };
  return [
    { name: "shop page: bundle, today and coins", mode: "shop", plain: true, globals: shop, search: { part: "shop" }, waitMs: 800, sizes: NAV_SIZES },
    { name: "shop page: no bundle this week, under 18", mode: "shop", plain: true, globals: { ...shopOn, __harnessShop: shopFixture({ bundle: false, teen: true }) }, search: { part: "shop" }, waitMs: 800, sizes: ALL_SIZES },
    { name: "shop page: bundle owned", mode: "shop", plain: true, globals: { ...shopOn, __harnessShop: shopFixture({ ownedBundle: true }) }, search: { part: "shop" }, waitMs: 800, sizes: ALL_SIZES },
    {
      name: "shop page: confirm an item",
      mode: "shop",
      plain: true,
      globals: shop,
      search: { part: "shop" },
      sizes: ALL_SIZES,
      go: (page) => openSheet(page, "[data-shop-item-buy='name-colour.sapphire']"),
    },
    {
      name: "shop page: the bundle's items",
      mode: "shop",
      plain: true,
      globals: shop,
      search: { part: "shop" },
      sizes: ALL_SIZES,
      go: (page) => openSheet(page, "[data-shop-bundle-buy]"),
    },
    { name: "shop page: pass", mode: "shop", plain: true, globals: pass, search: { part: "pass" }, waitMs: 800, sizes: NAV_SIZES },
    { name: "shop page: plus offer", mode: "shop", plain: true, globals: { ...shop, __harnessPlus: plusFixture() }, search: { part: "plus" }, waitMs: 800, sizes: NAV_SIZES },
    { name: "shop page: plus member", mode: "shop", plain: true, globals: { ...shop, __harnessPlus: plusFixture({ member: true }) }, search: { part: "plus" }, waitMs: 800, sizes: ALL_SIZES },
    { name: "shop page light: shop", mode: "shop", plain: true, globals: { ...shop, ...light }, search: { part: "shop" }, waitMs: 800, sizes: NAV_SIZES },
    { name: "shop page light: pass", mode: "shop", plain: true, globals: { ...pass, ...light }, search: { part: "pass" }, waitMs: 800, sizes: NAV_SIZES },
    { name: "shop page light: plus", mode: "shop", plain: true, globals: { ...shop, ...light, __harnessPlus: plusFixture() }, search: { part: "plus" }, waitMs: 800, sizes: NAV_SIZES },
  ];
};
