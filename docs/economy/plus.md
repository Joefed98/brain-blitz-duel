# Joulz Plus and the remaining wave 2 cosmetics (wave 2, train E, session E2)

13 November 2026. Rules and amounts from `docs/economy/economy-design.md` ("Joulz Plus" and the item tables); art from
`docs/art/wave-2/items` and the Joulz Plus board (`docs/art/wave-2/boards/joulz-plus-screens.png`). No gameplay,
scoring, stamp, timing or room-flow change.

## Cosmetics where they belong

Every item is drawn from its approved `.html` source, cut by `bun scripts/cosmetics-art.ts` into
`src/design/identity/cosmeticsArt.data.ts` (`--check` proves the file is what the sources build). Applied by
`src/design/identity/cosmetics.ts`. Only the owner's choice shows (A1's loadout: an item must be owned to be equipped),
and everyone sees it on that player (`public.cosmetics_public`, read through `getPublicCosmeticsFn`).

| Item | Where | How |
| --- | --- | --- |
| Avatar finishes (7) | Every avatar drawing (`avatarMarkup`, so the player card, Customise, the podium scenes) | The board drew each on Captain Joulz; the build splits it into parts any of the 32 avatars can take: the main colour's paint, the outline, the texture clipped to the main shapes, the glow and the art outside the circle. Neon Glow's glow follows the player's colour. |
| Neon Bolt (accessory) | The same | Drawn above the avatar's circle. |
| Neon Captain Joulz (special edition) | The same | Drawn in the avatar's place (the finish is not applied to it; the accessory is). |
| Reactions (9 packs) | Room chat | The four reaction slots are the packs a player can send, under today's six emoji. An emote's code is `<pack>#<n>`. `allowReactionFn` keeps every existing rule (one a second, host mute, moderation) and adds one: the pack must be in the sender's reaction slots. Receivers show an emote only from a sender known to have equipped its pack. |
| Win celebration | The room's final screen (Podium, FinalResult) | The winner's scene with their own avatar and place, in a strip under the heading. |
| Podium entrance (Circuit Overload) | The Podium | The same strip, for any top-three player who equipped it (at most three scenes). |
| Tile styles (6) | The player's own game tiles in Practice | The style's tile, with the game's tile scene where the board drew its sample glyph. |

Celebrations play for 3 s and then rest on their still; they never cover a score, place or name and change no timer.
Every animation stops under Reduce Motion (the sources' own rules, scoped to `.jzc`). With nothing equipped every
screen is exactly as before (the markup is unchanged; cosmetics-art-check and cosmetics-motion-check prove it).

**How each compares with its art** (cosmetics-motion-check, the app's drawing in the board's tile against the
approved PNG at 2×, mean per-pixel difference out of 255): finishes 0.04–0.07 (the board's Captain Joulz has no faint
scene bolt; the app keeps the avatar's scene), Neon Bolt 0.06, Neon Captain Joulz 0.00, reactions 0.00–2.6,
celebrations and tile styles 0.00–0.1 with their sample avatar and glyph. In use, a celebration shows the winner's own
avatar and a tile style the game's own scene, by design.

## Joulz Plus

Test purchases only until real payments exist. Plus is visible to the shop's testers only (D1's one list,
`shop.testers`) until Season 1: `PLUS_FOR_EVERYONE` in `src/config/plusConfig.ts`.

- **Test purchase** (Shop › Plus, testers only): monthly or yearly, no payment, stored with `test = true`.
- **Perks now**, granted per membership month (month n starts n calendar months after the start, UTC, clamped to the
  month's end), the first time the server is asked in that month and for any months missed: 200 coins (reason
  `plus_monthly`, key `plus_monthly:<membership>:<month>`), 2 streak freezes (key `plus_freezes:<membership>:<month>`),
  and the current season's premium pass through D2's function (see below). The ledgers' keys make every month pay once.
- **Daily archive** (`/daily-archive`): any past Daily Puzzle or Daily Arcade of the last 30 days, replayed in its own
  async room (kind `daily_archive`) with that day's stored rounds. Unrated: never on a board, never in the streak
  (`daily_history`), never a badge (`badge_facts` leaves the kind out) and never Joules; its solutions are not locked.
- **Early access**: a game marked with `plus.mark_early_access` is playable in Practice only by members until the end of
  that UK day (the practice deal and offline packs refuse it; the list hides it). Nothing is marked.
- **PLUS chip**: an optional gold chip under the profile card, off by default; others see it through
  `cosmetics_public` only while its owner has Plus and turned it on.
- **Later, not now**: full stats and rating history, the weekly report and drills, replay review and ghost races
  (listed on the offer, marked "Arrives with rated play"). **Never in Plus**: anything that affects scores, ratings or
  matchmaking (plus-check walks the import graph).

### The premium pass (D2)

D2's pass wasn't in the tree when Plus was built. `src/lib/plus/passBinding.server.ts` is the one place to wire it:
`bindPremiumPass({ grantPremiumPass(client, { userId, membershipId }) })` with D2's function; until then the premium
pass is reported as not yet given and nothing is recorded for it. The database also offers D2 `public.plus_is_member(user)`.

### Joe's functions (Supabase SQL editor; logged in `plus.admin_log`, a note required)

```sql
SELECT plus.start_test('TheirUsername', 'yearly', 'testing Plus before Season 1');   -- a tester only
SELECT plus.remove_test_purchase('TheirUsername', 'testing finished');               -- ends a test membership
SELECT * FROM plus.list_members();
SELECT plus.mark_early_access('blockfall', '2027-02-08', 'new game week');
SELECT plus.clear_early_access('blockfall', 'open to everyone now');
SELECT at, by_role, action, user_id, detail, note FROM plus.admin_log ORDER BY at DESC;
```

Coins and freezes a test membership granted stay when it ends; take coins back with `economy.adjust_coins`.

### Switching Plus on for everyone

Set `PLUS_FOR_EVERYONE = true` in `src/config/plusConfig.ts` and merge to main. Everyone then sees Plus in the Shop
(where the Shop tab shows: `SHOP_TAB_ENABLED`); a test purchase stays testers only, so everyone else sees the price
and "Coming soon" until real payments exist.

## Analytics

`plus_bought` (props.plan, props.test), `plus_perk_granted` (props.perk coins | freezes, props.month, props.amount),
`daily_archive_played` (props.kind, props.day); migration `20261113200100_analytics_plus_events.sql` adds them to the
list as it stands.

## Migrations

- `20261113200000_joulz_plus.sql`: the Plus tables and functions, early access, `cosmetics_public`, the
  `daily_archive` room kind, `badge_facts` with the archive left out, Joe's `plus` functions.
- `20261113200100_analytics_plus_events.sql`: the three events.

## Checks

plus-check (PostgreSQL, ~20 s), cosmetics-art-check (~2 s), cosmetics-screens-check (happy-dom, ~5 s),
cosmetics-motion-check (Chromium, ~80 s).
