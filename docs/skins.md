# Game skins and world themes (wave 2, E1)

11 Nov 2026. The 23 game skins and 4 world themes from `docs/art/wave-2/items/game-skin/` and `items/world-theme/`,
drawn in the seven skinnable games. Display only: no game's rules, physics, timing, hit areas, deal, stamps or scoring
changed, and nothing here is read by a sim, a grader, a replay or a deal.

## How it works

- **The look.** `src/lib/arcade/skins/look.ts`: a `GameLook` is `{ skin, world }`, two catalogue ids (or null) for one
  game. `NO_LOOK` is the default. The ids each game draws, the animated ones, the contrast helpers and the motion clock
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
  | Free Cell, Full House (`freecell`, `pokersquares`) | `withCardsLook(look, draw)`, `freecellArtGame` / `pokerSquaresArtGame(view, rev, look)`, `cardsFillFor(look)` | `skins/cards.skins.ts` |

  Scenes keep their own signature (the arena hands them the state as a third argument); a looked scene comes from the
  `…SceneFor(look)` factory, and the stage passes `sceneKey` so the scene repaints when the look arrives.
- **Who sees what.** `src/lib/skins/equipped.ts` (`useGameLook`, `useGameLookRef`): the live stage of each game reads the
  player's own equipped `game-skin:<game>` and `world-theme:<game>` slots and passes them to its renderer through a
  ref (a look arriving never rebuilds the game). The slots come from A1's loadout through the identity backend
  (`src/lib/identity/gameLooks.ts`, installed once by the root; `normaliseLoadout` now keeps the per-game slots as
  `gameLooks`). A1's database lets only owned items sit in a slot; the phone then keeps a slot only if it names an item
  of that game. A guest, a failed read or an unknown item draws the default. The equipped store never imports the
  coins-and-items code (economy-neutral-check walks `src/puzzles`).
- **Motion.** The animated looks are the catalogue's animated items, all Legendaries: Molten Gold (a shine sweeps the
  car, sparkles twinkle), Neon Night (the kerbs chase cyan and pink, the stars twinkle) and Neon Course (the cup's ring
  pulses; its windmill turns only as the sim's own sails do). They read `skinTime()`, which is 0 (the PNG's still)
  under `prefers-reduced-motion`.

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
  their red). Neon Rink: dark ice with neon rings, a glowing pink hog line, a neon city over the far boards, the house
  inset to match, and lit stones (yours cyan, theirs pink).
- **Apex.** Racing Stripes, Molten Gold, Neon paint: the player's car only (ghosts keep the default). Neon Night: night
  sky, a neon city on the far strip, dark hills and trees with cyan rims, the circuit in night colours, chasing
  cyan/pink kerbs, pink and cyan tyre belts, a grandstand with a pink roof edge and gold lights, twinkling stars.
- **Top Bins.** Comet, Retro Leather, Neon football: the ball from its source at the default ball's size and spin.
- **Full House.** Midnight Felt, Crimson Velvet, Neon felt: the table (rail, lit felt, nap, Neon felt's cyan edge) and
  the screen fill round it.
- **Free Cell.** Royal Damask, Holo Foil, Neon card back: every face-down card. **A Free Cell deal is all face up, so
  these backs are never seen in play today** (the open question in the PR).

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

- `skins-default-check` (~5 s), `skins-check` (~25 s), `skins-replay-check` (~45 s); no browser.
- `bun scripts/skins/preview.ts <game…> [--out=<dir>] [--only=<frame>]`: review frames of every look.
- `bun scripts/skins/record-default.ts` (the default digests, recorded on main before the hook; never re-record) and
  `bun scripts/skins/record-runs.ts` (the replay runs).
