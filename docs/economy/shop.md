# The shop (wave 2, train D, session D1)

11 Nov 2026. The shop working end to end for Joe and testers, with real coins (A1's ledger) and test purchases, ready
to switch on for everyone when Season 1 starts. Mockup: `docs/art/wave-2/screens/shop.png`. Nothing in the shop helps
anyone win: no file under `src/lib/shop` is read by scoring, grading, replay, matchmaking or timing
(economy-neutral-check), and no gameplay, scoring, stamp or timing changed.

## Files

| Piece | File |
| --- | --- |
| Migration: testers and Joe's log, recorded days and weeks, the wishlist, the bundle purchase, test packs, Joe's functions | `supabase/migrations/20261112120000_shop.sql` |
| Migration: the five analytics events | `supabase/migrations/20261112120100_analytics_shop_events.sql` |
| The daily shop's picks (pure) | `src/lib/shop/dailyShop.ts` |
| The Monday bundles: the schedule as data | `src/lib/shop/bundles.ts` (proposal: `docs/economy/bundles-season-1.md`) |
| Coin packs, the £ line, the age rule | `src/lib/shop/packs.ts` |
| Calendar days (midnight UK) | `src/lib/shop/days.ts` |
| Server rules | `src/lib/shop/shop.server.ts` |
| Server functions | `src/lib/shop/shop.functions.ts` |
| Data layer | `src/lib/data/shop.server.ts` |
| Phone calls, status (tester, wishlist back, the dot) | `src/lib/shop/shopApi.ts`, `src/lib/shop/shopStatus.ts` |
| Screens | `src/routes/shop.tsx` (A2's shell), `src/components/shop/*`, `src/polish-layout/shop.css` |
| Item pictures | `public/shop/<id>.webp` and `src/lib/shop/shopPreviews.data.ts`, from `bun scripts/shop-previews.ts` |
| Check | `scripts/shop-check.ts` (shard `e`, ~15 s, PostgreSQL) |
| Review screenshots (a tool) | `bun scripts/shots/shop-shots.ts` (`docs/economy/shop-screenshots/`) |

## Who sees it

- **Testers only, for now: one list.** `SHOP_TAB_ENABLED` (`src/config/shopConfig.ts`) stays false. `shop.testers` is
  the only list (A2's static preview list is gone): Joe manages it (below), the migration puts #0001 on it, and a
  trigger (`shop.on_player_one`) adds any account that becomes #0001 later. A tester Joe adds both sees the Shop tab and
  can use it: the phone asks `shopStatusFn` once per app open, shows the tab from the answer (`useShopOn` →
  `shopOnFor` with `knownTesters()`), and keeps it per player number (`duelz-shop-tester:v1`) so the fifth tab is
  there at first paint next time. A tester removed loses the tab on their next app open (the server refuses their
  shop calls at once).
- **The server decides.** Every shop function (`getShopFn`, `buyItemFn`, `buyBundleFn`, `testPackFn`, `wishlistFn`,
  `shopStatusFn`) checks `shopAccess`: an account in `shop.testers`, or any account once the switch is on. Anyone else
  gets "not_tester" and nothing changes. Test purchases are testers only even with the switch on, and the database's
  own `shop_test_pack` checks the tester list again.

### Switching the shop on for everyone (at Season 1's launch)

1. `src/config/shopConfig.ts`: `SHOP_TAB_ENABLED = true`.
2. `src/lib/shop/bundles.ts`: `BUNDLE_SCHEDULE_START` = Season 1's first Monday (Frozen Lake that week).
3. Merge to main (the deploy ships it). Testers keep their test-pack button; everyone else sees the packs' prices
   (real payments come later; until then a non-tester has no pack button).

identity-screens-check pins `SHOP_TAB_ENABLED === false` today; the switch-on PR updates that assertion with Joe's
approval.

## The daily shop

- Four items a day, the same for everyone, chosen by the server the first time anyone opens the shop after midnight
  UK (`ensureShopDay`) and recorded in `public.shop_days` (never changed). If nobody opened it for a few days, those
  days are filled in too (up to 14 back), so the rules always see every day.
- Slots 1 and 2 Epic, slot 3 Elite, slot 4 Epic, Elite or Legendary. A Legendary on exactly two days of every week
  (one of Monday–Wednesday, the second three or four days later), so each of the seven Legendaries returns every 22–27
  days.
- Nothing shown in the 7 days before is shown again. Within a rarity the items not shown for longest come first.
- Only the shop query's items (`public.catalogue_shop`): pass, free and earned items can never appear; the database
  refuses to record one.
- A player who owns one of the four sees the day's next unowned item of that rarity in its place (the day's recorded
  backups), or, when they own all of those too, the pick marked Owned. An item bought today stays in its slot, Owned.
- "New items at midnight" only: no countdowns, no "only 3 left", no random boxes.

## The Monday bundle

See `docs/economy/bundles-season-1.md`. Recorded per week in `public.shop_weeks`. Bought through
`public.shop_purchase_bundle`: one transaction, the wallet locked first, one spend line per item (reason
`bundle_purchase`, ref `bundle` / `<id>:<week>`, the price split by separate price), each item against its line, so a
refund of one line gives back that item's share. A part-owned bundle costs the bundle price for the rest at the same
share off. The week's items can be bought one by one at full price.

## Buying

- Coins only. Cards and the bundle show coin prices only; the confirmation shows the real-money value once, at the
  Starter pack's rate (500 for £0.99: about 505 coins per £1): "Buy for 2,800 coins (≈ £5.54)?" (`confirmLine`).
- A single item goes through A1's `economy_purchase_item` (the spend and the item in one transaction), once the server
  has checked it is on sale today for this player. Each confirmation carries a request id: the same purchase twice pays
  once (`duplicate`); an owned item is refused; too few coins is refused with nothing changed. The card shows a plain
  "Get coins" button beside the price when the balance is short (no pop-up); it opens Shop > Coins.

## Coins

- Packs: 500 for £0.99 (Starter), 1,000 for £1.79, 3,000 for £4.99, 10,000 for £14.99 (Mega Pack, best value).
- No payment code yet. On a tester account the pack's button opens "Test purchase": the coins are credited with no
  payment as a line with reason **`test_purchase`** (ref `test_pack` / the pack id). Joe removes one with
  `shop.remove_test_purchase`, which adds a line of its own (reason `test_purchase_removed`); ledger lines are never
  changed.
- **Age rule:** on the web, coin packs are for accounts 18 and over (`packAllowed`, `PACK_MIN_AGE`); a younger
  account sees the packs with "Coin packs are for players 18 and over." and no buttons; the server and the database
  refuse it too.

## Wishlist

A heart on every item (and in the bundle). Rows in `public.shop_wishlist` (a player reads only their own; the server
writes through `shop_wishlist_set`). When a wishlisted item comes back (hearted on an earlier day, on sale today in the
four or this week's bundle, not owned), the app shows a notice above the tab bar once per item per day
(`ShopBackNotice`), and the Shop tab gets its only dot until the shop is opened that day.

## Joe's functions (Supabase SQL editor)

In the `shop` schema, unreachable from the app and the API. A player is named by username (any capitals) or user id;
guests are refused. Every change writes a `shop.admin_log` line (who, what, when, about whom, the note, required).

```sql
-- Testers.
SELECT shop.add_tester('TheirUsername', 'testing the shop before launch');   -- added | already_tester
SELECT shop.remove_tester('TheirUsername', 'testing finished');              -- removed | not_a_tester
SELECT * FROM shop.list_testers();

-- Test purchases, and taking one back (refuses if the coins were spent, unless the third argument is true).
SELECT * FROM shop.test_purchases();
SELECT * FROM shop.test_purchases('TheirUsername');
SELECT shop.remove_test_purchase(1234, 'end of the test round');
SELECT shop.remove_test_purchase(1234, 'end of the test round', true);

-- What the shop showed on a day (the four, the backups, that week's bundle).
SELECT shop.day('2026-11-12');

-- The log.
SELECT at, by_role, action, user_id, detail, note FROM shop.admin_log ORDER BY at DESC;

-- Coins for a tester to spend (A1's function).
SELECT economy.grant_coins('TheirUsername', 5000, 'shop testing');
```

## Analytics

Through `recordEvents` (`src/lib/data/events.server.ts`): `shop_viewed` (section), `item_bought` (coins, item,
rarity), `bundle_bought` (bundle, coins, items), `pack_bought` (pack, coins, test), `wishlist_added` (item). A1's
`coins_spent`, `coins_credited` and `item_granted` are recorded alongside, as A1's helpers do.
