# Season 1 Monday bundles (approved by Joe, 11 Nov 2026)

Wave 2, session D1, 11 Nov 2026. One themed bundle every Monday (UK; the day the weekly challenges reset), cycling
small, medium and large, always 20–30 % off the items' separate prices. Each week's items can also be bought one by
one that week at full price. Only shop items (52 in the catalogue) are used; pass, free and earned items never are.

**The schedule is data:** `src/lib/shop/bundles.ts` (`BUNDLES`, `BUNDLE_SCHEDULE_START`). A change is an edit there:
names, items, prices or order. `shop-check` refuses a bundle with a non-shop item, an item twice, a price outside its
size's band, or a discount outside 20–30 %, and the database refuses to record a week more than 30 % off. A week already
on sale is recorded (`public.shop_weeks`) and never changes, even if the file is edited mid-week. After week 8 the list
starts again; add weeks 9 onwards to the same list.

Week 1 is `BUNDLE_SCHEDULE_START` (set to Monday 9 Nov 2026 so testers see the schedule now). **At launch, set it to
Season 1's first Monday** so Frozen Lake is the opening week.

Sizes and their price bands (from the brief): small about 3,400 (2,800–3,600), medium about 5,500 (5,000–6,000),
large 10,000. The brief's small example (four Epics, 4,000 separately, for about 3,400) is 15 % off, under the
20–30 % rule; the rule wins, so four Epics are 3,100 (22.5 % off).

| Week | Size | Bundle | Items (rarity) | Separately | Bundle | Off |
|---|---|---|---|---|---|---|
| 1 | Small | **Frozen Lake** | Curl Champ Glacier stones (Epic), Curl Champ Aurora stones (Elite), Frost card art (Elite) | 4,200 | 3,200 | 23.8 % |
| 2 | Medium | **Card Table** | Aurora card art (Legendary); Holo Foil card back (Elite, `card-back.holo-foil`); Royal Damask card back (`card-back.royal-damask`), Crimson and Emerald card arts (Epic). Joe, 13 Nov 2026: the Full House felts left (Full House is retired) and Aurora took their place and Royal's (docs/cosmetics-review, Proposal A) | 7,400 | 5,500 | 25.7 % |
| 3 | Large | **Black and Gold** | Gold Rush celebration (Legendary, centrepiece); Gold Circuit card art, Obsidian frame, Obsidian Glass tiles, Fireworks, Shockwave (Elite); Gold frame, Gold Leaf name colour, Brushed Gold tiles (Epic) | 13,800 | 10,000 | 27.5 % |
| 4 | Small | **Retro Arcade** | Retro Arcade reactions, Blueprint tiles, Sapphire name colour, Comic Ink finish (four Epics) | 4,000 | 3,100 | 22.5 % |
| 5 | Medium | **Sports Day** | Cue Ball Galaxy Set (Elite); Cue Ball Pixel Pool, Crazy Golf Watermelon and Disco, Top Bins Comet and Retro Leather, Apex Racing Stripes (Epic) | 7,600 | 5,500 | 27.6 % |
| 6 | Large | **Hologram** | Diamond frame (Legendary, centrepiece), Prism name colour (Legendary); Holographic and Wireframe finishes, Holo Stickers, Amethyst name colour (Elite); Chrome name colour, Carbon finish (Epic) | 14,000 | 10,000 | 28.6 % |
| 7 | Small | **Big Night** | Confetti Pop, Spotlight, Banter reactions, Captain's Calls reactions (four Epics) | 4,000 | 3,100 | 22.5 % |
| 8 | Medium | **City Lights** | Neon City card art, Emerald Glow name colour (Elite); Sunset, Galaxy and Lava card arts, Chrome finish (Epic) | 7,200 | 5,500 | 23.6 % |

Every one of the 52 shop items is in one of the eight weeks except the Aurora and Diamond Plate card arts, the Molten
Gold Apex skin and the Lightning Core finish (Legendaries left for the daily shop and later large bundles). No item is
in two bundles.

Joe's decisions (11 Nov 2026): the eight weeks approved as listed; small bundles at 3,100 (the 20–30 % rule kept);
Hologram with two Legendaries; Frozen Lake with three items. Week 2's two card backs (Royal Damask, Holo Foil) were
Free Cell skins until E1 made them account-wide card backs (12 Nov 2026, `card-back.royal-damask`, `card-back.holo-foil`;
`20261112090000_card_back_slot.sql`); the bundle uses the new ids, prices unchanged.

The points as raised:

- **Hologram has two Legendaries.** A large bundle at 10,000 needs 12,500–14,285 of items separately; with one
  Legendary that takes five Elites and three Epics, and after weeks 1–5 too few Elites are left. The alternative is a
  repeat of an earlier bundle's Elites.
- **The mockup's Frozen Lake** shows five items (adding an Icicle name colour and an Ice Shard reaction pack, Epics);
  neither is in the catalogue, so week 1 has the three the brief names. If they are drawn and added later, the bundle
  becomes 6,200 separately and should be priced as a medium (about 4,600, as the mockup shows: 25.8 % off).
- **A part-owned bundle**: a player who already owns some of a week's items pays the bundle's price for the rest, at
  the same share off (rounded down to 10 coins); owning all of them shows Owned.

## Withdrawn items (13 Nov 2026)

Every item the cosmetics review didn't mark Keep is withdrawn (`catalogue_items.withdrawn_at`,
`supabase/migrations/20261116800000_catalogue_withdrawn.sql`) until it is redrawn and Joe restores it. A bundle holding a
withdrawn item isn't sold that week (`ensureShopWeek`: a bundle is all or nothing); it returns at its own price once
every item is back. The weeks with a gap today are listed in the PR that added the column.

