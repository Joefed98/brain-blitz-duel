# Coins and items (wave 2, train A, session A1)

10 Nov 2026. The server side of the wave 2 economy: one catalogue of every item, a coin ledger nobody can tamper
with, consumables, what each account owns, and what it has equipped. No rewards are paid and no shop is shown yet:
later sessions do that through what is here (C2 pays the sign-up reward, the shop session sells, the pass grants).
Screens are A2's.

Accounts only. A guest (an auth user with no `public.profiles` row) has no wallet, no lines, no items and no loadout;
the database refuses a line for a user without a profile (every economy table keys on `profiles.user_id`).

## Files

| Piece | File |
| --- | --- |
| Migration: tables, rules, ledger, server and admin functions, the four events | `supabase/migrations/20261110160000_economy.sql` |
| Migration: the 110 items (catalogue.json verbatim), the avatar options, the backfill for existing accounts | `supabase/migrations/20261110160100_economy_catalogue.sql`, written by `bun scripts/economy-catalogue-sql.ts` |
| Shared types (phone and server) | `src/lib/data/economy.ts` |
| Data layer (server) | `src/lib/data/economy.server.ts` |
| Slots, defaults, avatars, gems, consumables, reasons: the one config | `src/lib/economy/slots.ts` |
| Rules, and the credit / spend / grant helpers for later server code | `src/lib/economy/economy.server.ts` |
| Server functions (the interface below) | `src/lib/economy/economy.functions.ts` |
| Checks | `scripts/economy-check.ts` (shard `e`, ~8 s, PostgreSQL), `scripts/economy-neutral-check.ts` (~1 s) |

## Interface (what A2 builds on)

All in `src/lib/economy/economy.functions.ts`; types in `src/lib/data/economy.ts`. None credits, spends or grants
anything.

| Call | Answers |
| --- | --- |
| `getCatalogue()` | `CatalogueItem[]`: every item with its catalogue fields, the file's order. No sign-in; the same for everyone (the server caches it 5 minutes). |
| `getAvatarOptions()` | `AvatarOptions`: for each of the 32 avatars, its `accent`, `feature`, `accessory` and `background` options and default. No sign-in. |
| `getMyWallet()` | `Wallet`: `{ account: true, balance, consumables: { streak_freeze, ticket_score_attack, ticket_category_cup }, recent: CoinLine[] }` (the latest 50 lines), or for a guest `{ account: false, balance: null, consumables: null, recent: [] }`. |
| `getMyInventory()` | `InventoryItem[]`: owned items with their catalogue fields plus `how`, `acquiredAt`, `ledgerId`. A guest: `[]`. |
| `getMyLoadout()` | `Loadout \| null`: `avatarId`, `colour`, `avatar: { accent, feature, accessory, background }`, `gem`, `slots` (every slot: its item, its default or null), `equipped` (chosen items only), `unlockedGems`. A guest: `null`. |
| `equip({ data: { slot, itemId } })` | `LoadoutResult`: `{ ok: true, loadout }` or `{ ok: false, reason, message }`, reason `guest`, `not_owned`, `wrong_slot`, `unknown_slot`, `unknown_item`, `busy` or `error`. `itemId: null` returns the slot to its default. |
| `setAvatar({ data: { avatarId, colour, accent?, feature?, accessory?, background?, gem } })` | `LoadoutResult`; reasons `guest`, `bad_avatar`, `bad_colour`, `bad_option`, `gem_locked`. Every field is set at once; an option left out or null is the avatar's default. |
| `getPublicCard({ data: { playerId } })` | `PublicCard \| null`: `account`, `username`, `playerNumber`, `founding`, `avatarId`, `avatar`, `colour`, `gem`, `cardArt`, `frame`, `nameColour`. A guest, an unknown id or an account waiting for deletion: the default card (`account: false`, `avatarId`, `colour` and `username` null, so the screen keeps colour plus initial; the default card art and frame). A malformed id: `null`. |

Reads and changes are rate limited per user (`ECONOMY_LIMIT` 240 per 10 minutes, `PUBLIC_CARD_LIMIT` 600); over it
the reads answer `{ busy: true }` and the changes `reason: "busy"`.

### Slots

`LOADOUT_SLOTS` (`slots.ts`): `card-art`, `frame`, `name-colour`, `avatar-special-edition`, `avatar-finish`,
`avatar-accessory`, `celebration`, `podium-entrance`, `tile-style`; `game-skin:<game>` and `world-theme:<game>` for each
skinnable game (`racing`, `minigolf`, `pool`, `curling`, `freecell`, `pokersquares`, `freekick`); and the reaction set,
`reaction-1` to `reaction-4` (`REACTION_SLOTS`, the one limit). Each item's `slot` in the catalogue says where it goes;
a reaction fits any reaction slot, and one item sits in one slot at a time. Defaults: `card-art.joulz-navy` and
`frame.plain`; the rest default to nothing. Badges and title slots come in C2.

The avatar's own accessory option (the builder's `accessory`) is separate from the catalogue's avatar-accessory items
(Neon Bolt), which are equipped in the `avatar-accessory` slot.

## The database

- `public.catalogue_items`: id (exactly as in catalogue.json), name, kind, slot, game and game_type (skins and world
  themes), rarity (`common`…`legendary`, none for free and earned items), source (the seven of catalogue.json plus
  `tournament`, reserved for wave 4), pass_level, price_coins, bundle, animated, exclusive, exclusive_forever (as the
  file has it), note (`finish_or_note`), png_path / html_path (under `docs/art/wave-2/`), sort_order. Constraints:
  only the shop is priced; shop prices by rarity (Epic 1,000, Elite 1,600, Legendary 2,800; Common and Rare never
  sold); every Legendary animates; `exclusive` exactly when the source isn't the shop; pass items have a level; free and
  earned items have no rarity; the slot follows the kind. Anyone may read it.
- `public.catalogue_shop`: the one shop query (`source = 'shop' AND NOT exclusive AND price_coins IS NOT NULL`).
- `public.coin_ledger`: one line per change (account, amount ±, reason, ref_kind / ref_id, idempotency key, balance
  after, time), unique per account and key, append-only (a trigger refuses any update, and any delete while the account
  exists). `public.coin_wallets`: the cached balance, changed only in the same transaction as its line, never below 0.
- `public.economy_reasons`: the reasons (signup_reward, challenge_reward, badge_reward, pass_reward, plus_monthly,
  ad_reward, shop_purchase, bundle_purchase, pack_purchase, refund, admin_adjustment). **A later session adds its own
  reason with an `INSERT INTO public.economy_reasons` in its migration** (and a line in `ECONOMY_REASONS`).
- `public.consumable_kinds` (streak_freeze, ticket_score_attack, ticket_category_cup), `public.consumable_balances`,
  `public.consumable_ledger`: counted the same way as coins. There was no Daily streak freeze in the code before
  (the Daily streak is device-only, `dailyRecord.ts`), so this is the only one; wiring its use is the Daily's later work.
- `public.inventory_items`: account, item, how (`starter`, `shop`, `pass`, `earned`, `grant`), when, and the spend line
  (`ledger_id`, shop items only). Each item at most once.
- `public.loadouts` (avatar, its options, gem), `public.loadout_slots` (one item per slot; its foreign key on the
  inventory means only an owned item can sit there and removing an item unequips it), `public.gem_unlocks` (written by
  C1; none yet: the loadout's foreign key refuses a gem not unlocked), `public.avatar_options`.
- **Who can write**: nobody through the API. anon, authenticated and service_role have no INSERT, UPDATE or DELETE on
  any economy table; a signed-in player reads only their own rows (RLS). The server writes only through the
  service-role functions `public.economy_credit`, `economy_spend`, `economy_refund`, `economy_purchase_item`,
  `economy_grant_item`, `economy_grant_consumable`, `economy_use_consumable`, `economy_equip`, `economy_set_avatar`;
  `economy_public_cards` is readable by any signed-in device.
- **Races**: every coin (or consumable) change locks the account's wallet (or count) row first, so two changes to one
  account run one after the other: a spend is checked against the balance it will change, and the same key never pays
  twice (economy-check fires two spends of 700 on 1,000 at once, ten of 150, and one key twice).
- **New accounts**: a trigger on `public.profiles` gives every new profile its wallet (0), its loadout (Captain Joulz,
  in the profile's colour) and the starter items (every `free-starter` item: the 8 free card arts and the Plain frame),
  with one `item_granted` event each. The seed migration backfills the same for every existing account.
- **Removal**: `accounts.forget_user` deletes the profile; every economy row goes with it (ON DELETE CASCADE), and Joe's
  log lines about the account keep what was done without its id.

### For later server code

`src/lib/economy/economy.server.ts`: `creditCoins`, `spendCoins`, `refundCoins`, `purchaseItem`, `grantItem`,
`grantConsumable`, `useConsumable`. Each takes the service-role client, records its analytics event and answers the
database's status (`credited`, `spent`, `refunded`, `purchased`, `granted`, `used`, `duplicate`, `insufficient`,
`no_account`, `bad_reason`, `not_for_sale`, `owned`, `not_a_spend`, `bad_kind`). Pick an idempotency key that names the
reward once, e.g. `signup_reward:<user id>`, `pass:s1:<level>:<track>`, `plus:<yyyy-mm>`. A refund's key is fixed
(`refund:<line id>`); refunding a purchase takes the item back too.

## The sign-up reward (how wave 1 left it)

Wave 1 recorded nothing for it: no table, column, flag or event holds a pending reward. `docs/accounts/README.md`
says "Sign-up reward: nothing paid now. Wave 2's coin ledger can credit 1,000 to every row of `public.profiles`; the
row's existence and `created_at` are all it needs", and the Founding Player's 250 coins come "from this flag"
(`profiles.founding`). So C2 pays it as one `creditCoins` per profile with reason `signup_reward` and key
`signup_reward:<user id>` (and the founding coins with their own key): new accounts at sign-up, existing ones once by a
backfill; the key makes both safe to repeat. Nothing in this session pays it.

## Avatar options: the gap

Joe's addendum: every avatar has a main colour (the 32 player colours), an accent colour, one feature, an accessory
and a background, with the options in `docs/art/avatars/`. What those files state, and what this session seeded into
`public.avatar_options`:

- **Main colour**: any of the 32 (the README, avatars.py's `main`). Stored as the profile's colour.
- **Accent**: one per avatar, `avatars.json` `accent` (e.g. Captain Joulz `#22e4ff`), seeded as that avatar's only
  accent option and its default. No list of other accents exists.
- **Background**: avatars.py draws one backdrop (`bg='#1E2640'`) with the avatar's own game scene (scenes.py); seeded
  as one option, `scene`, the default for every avatar. No other backgrounds exist.
- **Feature** and **accessory**: the files define none (no names, no drawings, no per-avatar lists). Nothing seeded;
  `setAvatar` refuses any value until rows exist.

When Joe supplies the lists, a new migration inserts rows into `public.avatar_options` (avatar, kind, option id,
default, order); `setAvatar` and `getAvatarOptions` need no change.

## Joe's tools (Supabase SQL editor)

In the `economy` schema, which anon, authenticated and the service role can't reach (no schema usage, no function
execute). Every change writes one `economy.admin_log` line (who: the session's database user; what; when; about whom;
the note, required) and its analytics event; coin and consumable changes are ledger lines (reason
`admin_adjustment` unless given, ref `admin` / the log line's id, key `admin:<log id>`). A player can be named by
username (any capitals) or user id; a guest is refused.

```sql
-- Credit coins (a positive amount), reason admin_adjustment unless you give one.
SELECT economy.grant_coins('TheirUsername', 500, 'make-good for the outage on 12 Nov');
SELECT economy.grant_coins('TheirUsername', 1000, 'missed sign-up reward', 'signup_reward');

-- Move coins up or down; never below zero (it refuses and changes nothing).
SELECT economy.adjust_coins('TheirUsername', -200, 'duplicate grant on 12 Nov');

-- Give an item (how = 'grant'); answers granted or owned.
SELECT economy.grant_item('TheirUsername', 'frame.gold', 'competition prize');

-- Take an item away (and out of its slot). Starter items stay. Coins spent on it are not given back.
SELECT economy.remove_item('TheirUsername', 'frame.gold', 'granted by mistake');

-- Give (or, negative, take) consumables: streak_freeze, ticket_score_attack, ticket_category_cup.
SELECT economy.grant_consumable('TheirUsername', 'streak_freeze', 2, 'lost streak in the outage');

-- One account at a glance: balance, the lines' sum, consumables, items, the latest 20 lines.
SELECT economy.account_summary('TheirUsername');

-- The log.
SELECT at, by_role, action, user_id, detail, note FROM economy.admin_log ORDER BY at DESC;
```

## Nothing coins buy helps win

`scripts/economy-neutral-check.ts` walks the import graph from every file under `src/lib/arcade`, `src/lib/round`,
`src/lib/replay` and `src/puzzles`, and every `src/lib/duel` file whose name says it grades, scores, deals, ranks,
matches, replays or times, and fails if it reaches an economy module (`src/lib/economy/**`, `src/lib/data/economy*`)
or names an economy table or function. Skins and world themes stay presentation only.
