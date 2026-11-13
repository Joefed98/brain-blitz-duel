# Game skins and world themes (wave 2, E1)

11 Nov 2026. The 20 game skins, 3 card backs and 4 world themes from `docs/art/wave-2/items/game-skin/`,
`items/card-back/` and `items/world-theme/`, drawn in six games (Free Cell has none: its deal is face up). Display only: no game's rules, physics, timing, hit areas, deal, stamps or scoring
changed, and nothing here is read by a sim, a grader, a replay or a deal.

## How it works

- **The look.** `src/lib/arcade/skins/look.ts`: a `GameLook` is `{ skin, world, back }`, catalogue ids (or null) for one
  game; `back` is the account's card back, kept only on a game with a face-down deck (`CARD_BACK_GAMES`: Full House). `NO_LOOK` is the default. The ids each game draws, the animated ones, the contrast helpers and the motion clock
  live there.
- **The hook, once per game.** Each renderer takes an optional look on its public draw calls and keeps it in a
  module variable for the length of that call only (reset in a `finally`), so every other caller (replays, reveals,
  intro demos, tiles, the share card, other players' ghost cars) draws the default without passing anything. The
  default theme is the renderer's own code path, untouched: `skins-default-check` proves 56 frames of the seven games
  pixel for pixel against digests recorded on main before any renderer changed (with no look argument and with the
  default look).

  | Game | Renderer entry points | Skin painters |
  | --- | --- | --- |
  | Cue Ball (`pool`) | `drawPool(…, look)`, `drawPoolHud(…, look)`, `poolSceneFor(look)` | `skins/pool.skins.ts` |
  | Crazy Golf (`minigolf`) | `drawMinigolfCourse(…, look)`, `drawMinigolfPlay(…, viewH, look)`, `minigolfSceneFor(look)` | `skins/minigolf.skins.ts`, `skins/ballArt.ts` |
  | Curl Champ (`curling`) | `drawCurling(…, look)`, `curlingScene(…, rev, look)` | `skins/curling.skins.ts` |
  | Apex (`racing`) | `drawRacingArt` / `drawRacingPlay(…, look)`, `racingSceneFor(look)` (the view beyond the world follows the play frame's look) | `skins/racing.skins.ts` |
  | Top Bins (`freekick`) | `withFreekickLook(look, draw)`, `freekickArtGameFor(rev, look)` | `skins/freekick.skins.ts`, `skins/ballArt.ts` |
  | Full House (`pokersquares`) | `withCardsLook(look, draw)`, `pokerSquaresArtGame(view, rev, look)`, `cardsFillFor(look)` | `skins/cards.skins.ts` |

  Scenes keep their own signature (the arena hands them the state as a third argument); a looked scene comes from the
  `…SceneFor(look)` factory, and the stage passes `sceneKey` so the scene repaints when the look arrives.
- **Who sees what.** `src/lib/skins/equipped.ts` (`useGameLook`, `useGameLookRef`): the live stage of each game reads the
  player's own equipped `game-skin:<game>`, `world-theme:<game>` and (Full House) `card-back` slots and passes them to its renderer through a
  ref (a look arriving never rebuilds the game). The slots come from A1's loadout through the identity backend
  (`src/lib/identity/gameLooks.ts`, installed once by the root; `normaliseLoadout` now keeps the per-game slots as
  `gameLooks`). A1's database lets only owned items sit in a slot; the phone then keeps a slot only if it names an item
  of that game. A guest, a failed read or an unknown item draws the default. The equipped store never imports the
  coins-and-items code (economy-neutral-check walks `src/puzzles`).
- **Motion.** The animated looks are the catalogue's animated items, all Legendaries: Molten Gold (a shine sweeps the
  car, sparkles twinkle), Neon Night (the kerbs chase cyan and pink, the stars twinkle) and Neon Course (the cup's ring
  pulses; its windmill turns only as the sim's own sails do). They read `skinTime()` (`motion.renderer.ts`, the only
  place that reads `prefers-reduced-motion`: game code under `src/lib/arcade` may not read the screen), which is 0 (the
  PNG's still) under it.

## Equipping (Customise → Games, 12 Nov 2026)

Customise has a fourth tab, **Games** (`src/routes/customise.tsx` `GameLooks`, rules `gameLookRows` / `lookItemName` in
`src/lib/identity/customise.ts`): first the account's **Card back** (the `card-back` slot, drawn on every card game's
face-down deck; Full House today), then a section for each skinnable game the player owns a look for, with a **Skin**
row (`game-skin:<game>`) and, where the game has world themes, a **World** row (`world-theme:<game>`). Owned items only;
each row starts with the game's default ("Classic", "Standard skin", "Standard world"), which is always there and saves
an empty slot. Each choice shows its picture: the item's approved still (`public/looks/<id>.webp`, built by
`bun scripts/look-previews.ts [--check]` with `src/lib/skins/lookPreviews.data.ts`; every look item, pass ones included,
so it never depends on the shop's own pictures) or, for the default, the game's tile. Save goes through A1's `equip()`
like the card slots (`saveSlot` takes the look slots, `EquipSlot`), so the server checks the item is owned and belongs
in that slot; a refusal shows its message, puts the choice back and records `equip_refused` with the look slot (the look
slots are fixed words in `EQUIP_SLOTS`). A saved look drops the stages' last read (`forgetGameLooks`), so the next round
draws it; another device reads it on its next round (the stage's read is kept at most 20 s).

**Fix, 12 Nov 2026:** `installGameLookSource` read a `gameLooks` field from A1's loadout, which A1 never sends (it names
every slot in `slots`); the field is made by `normaliseLoadout`. So from E1's merge until this fix every live game drew
its default whatever was equipped. It now reads `normaliseLoadout(loadout).gameLooks` (customise-looks-check and
customise-looks-db-check prove the path with A1's real shape).

## What each look draws

- **Cue Ball.** Pixel Pool: a 10 × 10 pixel disc per ball (the art's mask), a white 4 × 4 spot, 3 × 5 pixel numbers,
  stripes as a white band. Galaxy Set: lavender cue, a black 8 with a gold rim and gold spot, every other ball the
  nebula with stars and a white spot or band. Neon 8-ball: the 8 alone, dark with a cyan rim and number. Neon ball
  set: every ball dark with a neon rim and number in its own hue (stripes a neon band). Neon Table: a black table with a
  faint cyan grid, cyan rails, pink-ringed pockets, the jaws in cyan, a gold cue with a cyan tip, and (without a skin)
  the art's balls. Spots and stripes stay distinct in every look.
- **Crazy Golf.** Watermelon, Disco, Neon Glow, Plasma: the ball drawn from its source inside the ball's draw radius.
  Neon Course: night violet with specks, dark turf with faint lines, glowing green rails, every hazard outlined in pink
  over its own art, the ramps sunk into the night, a neon windmill (dark sails, gold slats, cyan arm and feet), a
  pulsing cyan cup and a pink flag.
- **Curl Champ.** Glacier, Aurora, Neon stones: the player's own stones (top, inner disc, handle; the opponents keep
  their red). Neon Rink: dark ice with neon rings, a glowing pink hog line, the dark ice carried up over the far boards (no city: the approved art draws none), the house
  inset to match, and lit stones (yours cyan, theirs pink).
- **Apex.** Racing Stripes, Molten Gold, Neon paint: the player's car only (ghosts keep the default). Neon Night: night
  sky, a neon city on the far strip, dark hills and trees with cyan rims, the circuit in night colours, chasing
  cyan/pink kerbs, pink and cyan tyre belts, a grandstand with a pink roof edge and gold lights, twinkling stars.
- **Top Bins.** Comet, Retro Leather, Neon football: the ball from its source at the default ball's size and spin.
- **Full House.** Midnight Felt, Crimson Velvet, Neon felt: the table (rail, lit felt, nap, Neon felt's cyan edge) and
  the screen fill round it. The card back: the deck's strip behind Next card, and the whole back while the next card
  is dragged (hidden on the last card, as today).

## Card backs

Joe's decision, 11 Nov 2026: the three Free Cell skins (Royal Damask, Holo Foil, Neon card back) are one account-wide
card back, catalogue kind and slot `card-back`, drawn wherever a game shows a face-down card (today: Full House's deck).

| Old id | New id | Name | Source |
| --- | --- | --- | --- |
| `game-skin.free-cell.royal-damask` | `card-back.royal-damask` | Royal Damask | shop, Epic, 1,000 |
| `game-skin.free-cell.holo-foil` | `card-back.holo-foil` | Holo Foil | shop, Elite, 1,600 |
| `game-skin.free-cell.neon-card-back` | `card-back.neon` | Neon card back | premium pass, level 4 |

`supabase/migrations/20261112090000_card_back_slot.sql` adds the kind, moves the catalogue rows (every other field
unchanged), owners (each inventory row moved in place, so its `how`, time and spend line stay) and equipped slots, records the old ids in
`public.catalogue_renamed`, and a trigger keeps an old id from ever being inserted again (the seed migration applied
again adds nothing). Append-only history keeps the id of its time: a purchase's coin-ledger line (`ref_id`) and
Joe's admin log; nothing reads them to find an item (a refund goes by the line's id, and still removes the renamed
item). `skins-db-check` sweeps every table for an old id after the move. The art moved to `docs/art/wave-2/items/card-back/`; catalogue.json and the art README say the same.
Free Cell keeps no slot (`slots.ts`).

**Card backs in more games (13 Nov 2026, Joe; docs/cosmetics-review):** the back now also draws on Summit's covered
peak cards and stock, Thirteen's stock and Five Hands' deck (`CARD_BACK_GAMES`, `isCardBackGame`, `backLookFor` in
`look.ts`; the three stages draw their art game inside `withCardsLook` with `useGameLookRef`; replays draw the
player's stored back, `playback.renderer.ts`). These three have no skins or world themes, so they are not in
`SKIN_GAME_NAMES`. Faces are never touched: skins-check section 7 proves all 52 faces pixel-identical with any back.
A result in those games stores the back (`20261116600100_card_back_games.sql`). skins-default-check, skins-check and
skins-replay-check cover them (their default digests and 12 runs appended to the fixtures, earlier entries
byte-identical). Still not built: Golf Solitaire (retired) and Matchmaker (CSS backs).

**Other games with face-down cards** (as first listed, 11 Nov 2026): Five Hands (the deck behind Next card,
`fiveHands.renderer.ts:206`); Summit (the covered peak cards, `tripeaks.renderer.ts:127`, and the stock pile, `:149`);
Thirteen (the stock pile, `pyramid.renderer.ts:139`); Golf Solitaire, retired to practice (the stock pile,
`golfSol.renderer.ts:166`); Matchmaker, an Attention puzzle (all 30 cards face down until turned, CSS
`.pairmatch-card-back` in `src/puzzles/pairMatch.tsx` and `src/polish-speed/batch-s.css:366`). Summit's tile scene also
draws a face-down card (`scripts/shots/tile-scenes/arcade.tsx:475`), but tiles always draw the default.

## Replays and ghosts

Each result remembers the look its player had equipped (Joe, 11 Nov 2026), so a replay shows the player's real skin:

- **Stored by the database.** `supabase/migrations/20261112090100_result_looks.sql` adds `look jsonb` to
  `round_results` and `async_results`, filled by BEFORE INSERT triggers from the player's loadout (only owned items can
  sit there) for the round's game: `{skin, world, back}` with absent keys for the default, NULL for a guest, nothing
  equipped or a game without skins. A look sent with a row is overwritten; the trigger can never fail an insert. No
  phone call changed, and nothing reads `look` to grade, score, rank, time or deal. Play again's archive keeps each result's look (`20261112090200_archive_result_look.sql`: the
  archive's `look` column, filled by a trigger from the result row being archived; `restart_duel_room` unchanged).
- **Replays** (play of the game, round highlights, the Daily's and challenges' reveals): the winner's stored look
  (`replay.server.ts` `ReplayWinner.look`, `asyncRoundReveal`'s `look`) through `lookFromStored`, drawn as
  `playerLookIn(player, viewer)`: the player's skin and card back, the viewer's own world theme (the scenery is always
  the viewer's). `makePlaybackDrawer(puzzle, look)` passes it to the same renderer entry points the stage uses.
- **Ghosts** (Apex): `roomGameLooksFn` (`src/lib/identity/roomLooks.functions.ts`, a player of the room only) reads
  `public.room_game_looks` (service role only) for the room's players still in it; `setRaceGhostSkins` hands each slot's
  paint to the ghost broadcast, and `paintRacingCar` draws a ghost in its owner's paint (no sparkles; your own car keeps
  them). Ghosts stay display only: no collisions, no points.

## Fairness

- Sizes and hit areas: every ball paints inside the default ball's draw radius, every stone and car inside the
  default's box; tables, rails, pockets, cups, rings and lines stay on the default's geometry (`skins-check`).
- Contrast: each look's ball, stone, car or card reaches 3:1 against what it is played on (the default passes the same
  check). On the default green cloth the Neon ball set uses lifted tints of the art's hues (`POOL_NEON_ON_CLOTH`);
  on the Neon Table's dark cloth it uses the art's exact colours.
- Scores: `skins-replay-check` replays 28 recorded runs (`scripts/fixtures/skins-replay-runs.json`, oldest and dealt
  stamp of each game) in every skin, every theme and a skin with its theme, drawing frozen copies of the state through
  the live stage's draw, and fails unless the score equals the recorded and server-replayed score and the states and
  checkpoints equal the default's. It also proves no sim, server replay or deal bank imports a skin module, and that no
  renderer reads who has what equipped.
- Deal and stamps: no file that deals, stamps, grades or replays changed (`deal-identity-check` against main,
  `practice-bests-check`).

## Checks and tools

- customise-looks-check (happy-dom, ~2 s): the Games tab lists owned items only with their pictures; equip, a reload,
  a second device and unequip for each kind, as the stages read it; a refused item.
- customise-looks-db-check (~5 s, PostgreSQL, shard `e`): A1's real `equip` and `getMyLoadout` for each kind, unowned
  items, another game's slot and a guest refused, a second device, and the renderers drawing the look (and the default
  again after unequipping).

- **Main drawn live** (Joe, 11 Nov 2026): the canvas library rasterises differently by CPU (Skia picks its path by
  CPU), so digests recorded in one container don't hold on GitHub's runners. skins-default-check and skins-check's deck
  test draw main's own renderers in the same run on the same machine (`scripts/skins/base.ts`): main is the merge base
  of the branch head (the PR's head commit on CI) and main; a shallow checkout fetches the head and main at depth 64
  (deepened ×4 up to 4,096 until git names the merge base; no tags, never the full history; only objects and
  `refs/remotes/origin/main` are added); the base's `src/`, `tsconfig.json` and `package.json` are extracted (git
  archive, ~25 MB) to a temp folder and drawn there, cached for the second check. Any pixel difference fails. The stored
  digests stay untouched as this container's record, asserted too whenever main draws them exactly (here: all 61
  frames and 16 deck frames); elsewhere a NOTE says the rasteriser differs. It adds one fetch and ~4 s of drawing per
  run (`SKINS_BASE=<sha>` names the commit by hand).
- `skins-default-check` (~10 s), `skins-check` (~25 s; with Full House's deck: no back draws main's 16 deck frames
  exactly, `scripts/fixtures/skins-deck-frames.json`, recorded on main af70c5f by `scripts/skins/record-deck.ts`; each
  back changes every deck frame inside the deck card's box; the card-back slot's ownership; stored and replay looks),
  `skins-replay-check` (~45 s; every look, card backs included), `skins-db-check` (~10 s, PostgreSQL: the card-back
  move with owners, the result-look triggers, scores and every other column unchanged, the ghost function's refusals);
  no browser.
- `bun scripts/skins/preview.ts <game…> [--out=<dir>] [--only=<frame>]`: review frames of every look.
- `bun scripts/skins/compare-art.ts [--out=<dir>]`: each ball, stone, card back and felt painted by the game's own
  painter at its swatch's size over the approved PNG, compared inside the object; the car paints and world themes by
  palette. Sheets: `docs/skins-nov-2026/skins-vs-art.png` (approved PNG | our painter | difference) and
  `world-themes-vs-art.png` (the theme board beside the game's frame).
- `bun scripts/skins/record-default.ts` (the default digests, recorded on main before the hook; never re-record) and
  `bun scripts/skins/record-runs.ts` (the replay runs).
