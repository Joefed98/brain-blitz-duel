# Withdrawn cosmetics (13 Nov 2026)

Joe's rule: Joulz is premium, so every cosmetic offered anywhere must look premium and beautiful; anything that
doesn't is improved or withdrawn, never offered as it stands. The cosmetics review (draft PR #389,
`docs/cosmetics-review/`, never merged; its verdicts here as `docs/cosmetics-review/verdicts.json`) marked 46 of the
118 catalogue items Keep. The other 72 were withdrawn by `supabase/migrations/20261116600000_catalogue_withdrawn.sql`;
Joe restored the three card backs the same day (`20261116600200_restore_card_backs.sql`), as they now show in live
games. 69 stay withdrawn until redrawn and approved.

## What withdrawn means

- `public.catalogue_items.withdrawn_at` (and `withdrawn_note`). The catalogue still lists the item; the server's
  `CatalogueItem` carries `withdrawn`.
- **Never sold:** the shop query (`catalogue_shop`) leaves it out, so every purchase, the daily picks
  (`sellable`) and recording a day or week refuse it. A day recorded before the withdrawal shows the day's next
  backup in its slot. **A bundle holding a withdrawn item isn't sold that week** (`ensureShopWeek`: no partial
  bundles; Joe, 13 Nov 2026); it sells again, at its own price, once every item is back.
- **Never given:** `economy.add_item` answers `withdrawn` for a pass, earned or starter grant (only Joe's own
  `economy.grant_item` still gives one). So pass levels (shown as "Being redrawn", not claimable), badge rewards (the
  Founding frame), season rewards (Season 1 frames and tier card arts), the Championship frame and the starter set
  skip it. A new account's starters are those not withdrawn.
- **Owners keep it:** inventory, equipped slots and every drawing are unchanged; Customise lists a withdrawn item only
  for its owner.

## Bringing one back (one line)

```sql
SELECT economy.restore_item('card-art.lava', 'redrawn, approved 20 Nov');
```

In a new migration or the dashboard's SQL editor. Logged in `economy.admin_log`. It also gives the item to everyone it
was owed to while withdrawn: a starter to every account, a season reward to every `season_rewards` row naming it, the
Championship frame to every recorded winner, the Top 500 frame to every holder of the Top 500 badge. A withdrawn pass
level becomes claimable as usual; the Founding frame is settled on the player's next visit.
`economy.withdraw_item(id, note)` takes one away the same way.

## The Top 500 frame (Joe, 13 Nov 2026)

Given permanently the first time a player's shown tier becomes Top 500, at the same moment as the Top 500 badge
(`grantTop500Frame` in `src/lib/rated/rewards.server.ts`, called where the rated badges are awarded). Dormant while the
frame is withdrawn; restoring it gives it to every badge holder. The plaque reads "TOP 500"; the player's own place
waits for the overhaul (it needs PlayerCard and CardStrip to receive the place).

## Gaps today (to refill in the overhaul with redrawn items)

- **Pass (Season 1):** free levels 6, 10, 14, 16, 22, 26, 36, 50, 60; premium levels 3, 8, 12, 14, 18, 22, 24, 25,
  28, 32, 35, 40, 42, 45, 52, 58 (premium 4, the Neon card back, came back with the backs).
- **Bundles:** Frozen Lake, Black and Gold, Retro Arcade, Sports Day, Hologram, Big Night and City Lights each hold a
  withdrawn item, so their weeks have no bundle. Card Table (Proposal A: Holo Foil and Royal Damask backs, Aurora,
  Crimson, Emerald, 5,500) sells.

## Checks

cosmetics-withdrawn-check (PostgreSQL, ~10 s) proves all of the above. The six checks that prove the whole catalogue's
machinery (economy, shop, pass, badges, seasons, tournament events) make every item live in their own test database
first (Joe's approval, 13 Nov 2026).
