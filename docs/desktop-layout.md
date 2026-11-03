# The computer layout, chess.com style (31 Oct 2026)

Presentation and input mapping only, plus recording how each result was played. No game's world, rules,
simulation, scoring, grading or version stamps changed; no stored data is touched. **Phones look and behave
exactly as before**: every new element renders nothing under 700 px, and the phone markup is byte-identical
(celebrations-check's recorded markup and desktop-layout-check's phone pass prove it).

## Fairness rule

Every game's world, rules and simulation are identical on every device. The desktop changes only how a world
is drawn (scale, rotation, layout, scenery) and how mouse and keys reach the same inputs. The sim receives
exactly what a phone would give it, so a run replays identically. `desktop-fairness-check` proves it (below).

## Breakpoints (`src/lib/layoutMode.ts`)

| Layout | When | What changes |
| --- | --- | --- |
| Desktop | 1024 px wide and up, 500 px tall and up, **with a mouse or trackpad** (hover, fine pointer) | Left rail, banner slot, right columns, room panel, each game's desktop mode, controls hint |
| Tablet | 700 px wide and up otherwise (any touch screen that wide) | Tab pages in two columns (page + side column); header and bottom tab bar kept; **game screens exactly as a phone's** |
| Phone | Under 700 px (or under 500 px tall: a phone in landscape) | Nothing |

**Assumption:** the desktop layout also needs a mouse or trackpad. The brief gives width breakpoints; the
existing checks (arcade-play-check's 1280×800 touch laptop, desktop-geometry-check's 1440×900 touch screen)
require that a touch screen keeps the phone's game screens, and a rail with hover tooltips, keys and a
rotated world are mouse-and-keyboard features. So a 1024×768 iPad gets the tablet layout and a 1024×768
window with a mouse gets the desktop layout (its narrowest size). PhoneShell marks the screen `data-layout`
(never on a phone); every rule in `polish-layout/desktop-layout.css` is scoped to it.

## App shell

- **Rail** (`AppRail`, 240 px): the Joulz wordmark, Play, Practice, Tournaments, Profile; at the bottom a
  search (opens Practice with the words typed, `/practice?q=`), the account (this device's name and badge, to
  Profile), settings (Profile's sheet) and sound. It replaces the bottom tab bar and the phone header.
- **Icon rail** (76 px) on rooms, rounds, results and games: the mark and the four icons with tooltips.
- **Banner slot** (`BannerSlot`, 112 px) at the top of Play, Practice and Tournaments, fed by
  `src/config/banners.ts` (house promotions only; the next scheduled public game comes first, automatically).
  Nothing to show: no slot at all. It is drawn by PhoneShell on those three tab pages only, so it can never
  appear in rooms, rounds, reveals or standings; desktop-layout-check fails if it does. Ads are not part of
  this work.

## Pages

- **Practice**: the Puzzles | Arcade switch, the search and the group chips in one row; each section's games a
  grid of large cards (the tile, name and best), 3 to 5 across; a 320 px right column (`PageAside`): the next
  public room, today's Daily Puzzle and Daily Arcade (when the dailies are live), and *Your week* (rooms, wins,
  practice games and the daily streak from this device's own records, `practiceRecent.ts` `practiceThisWeek`).
- **Play, Tournaments, Profile**: the page and the same style of right column.

## Rooms

- Centre: the lobby or the game. The lobby's players four across; its settings line uses the width.
- **Room panel** (`RoomPanel`, 380 px, through PhoneShell's `RoomPanelSlot`): the room code; "Round x of y"
  over a bar of one segment a round in that round's category colour (an arcade round its group's); live
  standings for up to 16 (badge with initial, name, status: *playing* / *finished ✓* from the live
  "finished" column and its buzzer rule, *left*, and the total through the last round everyone has seen,
  never the round being played); the chat between rounds (the room's own chat), "Chat opens between rounds"
  during a round. Full-screen moments (Prepare to Duel, round titles, the winner reveal) stay full screen.

## Games on a wide screen (`src/lib/duel/desktopModes.ts`, `desktop` on every registry entry)

- **wide** (puzzles, card and board games): puzzles get a column up to 760 × 1100 px and their boards re-flow
  into it; canvas card games keep their world and scale up in a column up to 960 px.
- **rotate** (Cue Ball only; Joe, 31 Oct 2026): the identical table drawn turned 90° clockwise into landscape in a
  rotor (`ArcadeArenaSlot`, `data-arena-rotor`). Pointer positions map back through the inverse turn
  (`tapMapping.ts` `arenaPointer`, `unrotatePoint`) and the canvas sizes from the arena's own box (`arenaSize`).
  **Only the table and balls turn**: the HUD chips are drawn upright on their own strip above the table
  (ArcadeCanvasStage `hud`, `data-arena-hud`, `drawPoolHud`), ball numbers and effect pop-ups are drawn turned
  back so they read upright (`drawPool(…, turned)`, `setArcadeTextTurn`), and the power meter and spin button
  sit under the table, upright. **No text is ever drawn rotated** (desktop-fairness-check spies on every
  `fillText` on the turned table; desktop-layout-check fails on any DOM text inside a rotor). The rotor is
  capped at 1,000 px across so its canvas holds 60 fps. (`arenaDelta` and `rotatedKey` stay as tested
  helpers; no game uses them today.)
- **Apex on desktop** (1 Nov 2026): its world is capped at **340 × 634** (`APEX_DESKTOP_WORLD_W`,
  `maxWorldWidth` in `desktopModes.ts`; the arena slot no wider, the world centred down its column) with its own
  static backdrop (sky, grass, tarmac; `racingScene`) beside it instead of the moving view carried on past the world
  (`setRacingLargeScreen`). Joe's order was optimise first, then cap. The optimisation that held: the near grass's
  full-width bands are no longer filled where the haze under the road is already exactly that colour, pixel for pixel
  the same on every screen (racing-render-check). Tried and dropped (no measurable gain in headless Chromium's CPU
  raster): batching the tyre walls, a narrower or slower moving side band, drawing the road once into both canvases,
  and a phone-sized canvas scaled up (the compositor's upscale cost as much as it saved). Measured with
  `arcade-play-check --desktop racing` (mean frame, limit 18.3 ms): full height 538 × 1003 ~21 ms; 430 × 802 18.0–19.4;
  380 × 709 17.7–18.3; **340 × 634 17.3 ms on three runs**. Apex's own phone pass on the same machine averages ~21 ms
  (the phone check's floor is 30 fps).
- **tall** (every other arcade game: side-on, behind-camera and the top-down Crazy Golf, Orbit, Meteor, Tilt,
  Jaywalk and Curl Champ, upright): the world scales to the full height of a column up to 640 px; the
  game's own scenery runs out to both sides under a static fade at the rail and panel edges (`data-dk-fade`);
  the HUD stays in the play column.
- All: canvases sized by their box within the pixel-ratio cap of 2.

Active games (83): wide 53, rotate 1, tall 29.

| Game | Id | Category | Desktop mode | Keys | Why |
| --- | --- | --- | --- | --- | --- |
| Cryptogrid | `codeword` | Word | **wide** |  | puzzle board: re-flows into the wider column |
| Forage | `wordhunt` | Word | **wide** |  | puzzle board: re-flows into the wider column |
| Interlock | `tilegrid` | Word | **wide** |  | puzzle board: re-flows into the wider column |
| Lookout | `wordsearch` | Word | **wide** |  | puzzle board: re-flows into the wider column |
| Nucleus | `wordsmith` | Word | **wide** |  | puzzle board: re-flows into the wider column |
| Roundabout | `letterwheel` | Word | **wide** |  | puzzle board: re-flows into the wider column |
| Slider | `wordslide` | Word | **wide** |  | puzzle board: re-flows into the wider column |
| Strikeout | `strikeout` | Word | **wide** |  | puzzle board: re-flows into the wider column |
| Swapword | `swapword` | Word | **wide** |  | puzzle board: re-flows into the wider column |
| Ballpark | `numline` | Number | **wide** |  | puzzle board: re-flows into the wider column |
| Brimful | `measure` | Number | **wide** |  | puzzle board: re-flows into the wider column |
| Checkout | `checkout` | Number | **wide** |  | puzzle board: re-flows into the wider column |
| Counterweight | `balance` | Number | **wide** |  | puzzle board: re-flows into the wider column |
| Exact | `target` | Number | **wide** |  | puzzle board: re-flows into the wider column |
| Integer Pyramid | `numpyramid` | Number | **wide** |  | puzzle board: re-flows into the wider column |
| Operator | `equation` | Number | **wide** |  | puzzle board: re-flows into the wider column |
| Tenfall | `tendrop` | Number | **tall** |  | falling-number engine game: things fall down the screen, kept upright |
| Ascend | `numhunt` | Speed | **wide** |  | puzzle board: re-flows into the wider column |
| Bang On | `stopwatch` | Speed | **wide** |  | puzzle board: re-flows into the wider column |
| Bonk | `whack` | Speed | **tall** |  | Bonk's meadow is a side-on scene: full height |
| Don't Break the Chain | `chain` | Speed | **wide** |  | puzzle board: re-flows into the wider column |
| Flash | `reaction` | Speed | **wide** |  | puzzle board: re-flows into the wider column |
| Pull! | `clayshoot` | Speed | **tall** |  | side-on sky: full height, scenery out to both sides |
| Double Take | `spotdiff` | Attention | **wide** |  | puzzle board: re-flows into the wider column |
| Eagle Eye | `symscan` | Attention | **wide** |  | puzzle board: re-flows into the wider column |
| Labyrinth | `maze` | Attention | **wide** |  | puzzle board: re-flows into the wider column |
| Matchmaker | `pairmatch` | Attention | **wide** |  | puzzle board: re-flows into the wider column |
| Mixed Signals | `stroop` | Attention | **tall** |  | lanes falling down the screen: kept upright |
| Tally | `countup` | Attention | **wide** |  | puzzle board: re-flows into the wider column |
| Chroma Lines | `flow` | Pattern | **wide** |  | puzzle board: re-flows into the wider column |
| Gradient | `tiles` | Pattern | **wide** |  | puzzle board: re-flows into the wider column |
| Gridlock | `unblock` | Pattern | **wide** |  | puzzle board: re-flows into the wider column |
| Heave | `push` | Pattern | **wide** |  | puzzle board: re-flows into the wider column |
| Lightbender | `laser` | Pattern | **wide** |  | puzzle board: re-flows into the wider column |
| Pipeline | `pipes` | Pattern | **wide** |  | puzzle board: re-flows into the wider column |
| Skid | `iceslide` | Pattern | **wide** |  | puzzle board: re-flows into the wider column |
| Tessellate | `blockparty` | Pattern | **wide** |  | puzzle board: re-flows into the wider column |
| Topsy-Turvy | `gravity` | Pattern | **wide** |  | puzzle board: re-flows into the wider column |
| Turntable | `rings` | Pattern | **wide** |  | puzzle board: re-flows into the wider column |
| Blackout | `lightsout` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Bomb Defusal | `bomb` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Box Six | `sudoku` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Colour Flood | `flood` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Hanoi | `tower` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Lamplighter | `lightup` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Mosaic | `nonogram` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Polypotions | `tubes` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Safe Cracker | `safe` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Shikaku | `shikaku` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Tents and Trees | `tents` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Trail | `trail` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Ringer | `alleyroll` | Arcade · Sports | **tall** |  | the funfair lane seen from the player's end: kept upright at full height, the alley carried to the sides |
| Apex | `racing` | Arcade · Sports | **tall** |  | behind-camera view; on desktop its world capped at 340×634, centred, with its static backdrop beside it, for 60 fps |
| Ball Tracker | `balltrack` | Arcade · Strategy | **tall** |  | cups and marbles read top to bottom: kept upright |
| Blockfall | `blockfall` | Arcade · Retro | **tall** |  | a tall well of falling pieces: kept upright at full height, the cabinet glow carried to the sides |
| Breaker | `breaker` | Arcade · Retro | **tall** |  | portrait play with controls at the bottom (paddle, flippers, launcher): kept upright |
| Coral Pop | `bubble` | Arcade · Strategy | **tall** |  | shooter aiming up from the bottom: kept upright |
| Crazy Golf | `minigolf` | Arcade · Sports | **tall** |  | top-down course, kept upright at full height |
| Cue Ball | `pool` | Arcade · Sports | **rotate** |  | top-down table: turned to landscape, only the table and balls (HUD, power meter and spin upright) |
| Curl Champ | `curling` | Arcade · Sports | **tall** |  | top-down sheet, kept upright at full height |
| Fission | `burst` | Arcade · Retro | **tall** |  | portrait play with controls at the bottom (paddle, flippers, launcher): kept upright |
| Five Hands | `fivehands` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Flightpath | `bullseye` | Arcade · Sports | **tall** |  | behind-camera view: full height, scenery out to both sides |
| Free Cell | `freecell` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Gemstone | `matchup` | Arcade · Strategy | **wide** |  | match-three board, no physics world: scaled up in a wide column |
| Grappler | `swing` | Arcade · Action | **tall** |  | side-on world: full height, scenery out to both sides |
| High Rise | `skyline` | Arcade · Strategy | **tall** |  | side-on world: full height, scenery out to both sides |
| Home Run | `homerun` | Arcade · Sports | **tall** |  | behind-camera view: full height, scenery out to both sides |
| Hover | `hover` | Arcade · Retro | **tall** |  | side-on world: full height, scenery out to both sides |
| Jaywalk | `cross` | Arcade · Retro | **tall** |  | top-down road, kept upright at full height |
| Mahjong Solitaire | `mahjong` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Meteor | `snake` | Arcade · Retro | **tall** |  | top-down grid, kept upright at full height |
| Minefield | `minesweeper` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Orbit | `orbit` | Arcade · Retro | **tall** |  | top-down space flight, kept upright at full height |
| Pinball | `pinball` | Arcade · Retro | **tall** |  | portrait play with controls at the bottom (paddle, flippers, launcher): kept upright |
| Rainbow Bridge | `inkbridge` | Arcade · Strategy | **tall** |  | side-on world: full height, scenery out to both sides |
| Rally | `rally` | Arcade · Retro | **tall** |  | portrait play with controls at the bottom (paddle, flippers, launcher): kept upright |
| Roofbound | `flip` | Arcade · Action | **tall** |  | side-on world: full height, scenery out to both sides |
| Slice | `slice` | Arcade · Action | **tall** |  | side-on world: full height, scenery out to both sides |
| Summit | `tripeaks` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Swish | `bintoss` | Arcade · Sports | **tall** |  | side-on world: full height, scenery out to both sides |
| Tempo | `beat` | Arcade · Retro | **tall** |  | notes fall down lanes to the bottom: kept upright |
| Tilt | `tilt` | Arcade · Strategy | **tall** |  | top-down maze, kept upright at full height |
| Top Bins | `freekick` | Arcade · Sports | **tall** |  | behind-camera view: full height, scenery out to both sides |
| Wavefront | `wavefront` | Arcade · Retro | **tall** |  | portrait play with controls at the bottom (paddle, flippers, launcher): kept upright |

Retired to practice (12):

| Game | Id | Category | Desktop mode | Keys | Why |
| --- | --- | --- | --- | --- | --- |
| Letterfall | `wordfall` | Word | **tall** |  | falling-letter engine game (practice only): kept upright |
| Dig | `dig` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Iron Wall (was Bastion) | `bastion` | Arcade | **tall** |  | the tank-defence shooter, kept upright; the dusk, field and lane-edge scenery carried out to the sides |
| Dual | `dual` | Arcade | **tall** |  | practice only: kept upright |
| Full House | `pokersquares` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Hot Floor | `hotfloor` | Arcade | **tall** |  | practice only: kept upright |
| Junction | `junction` | Arcade | **tall** |  | practice only: kept upright |
| Ricochet | `ricochet` | Arcade | **tall** |  | practice only, a launcher at the bottom: kept upright |
| Rooftop Run | `rooftop` | Arcade | **tall** |  | side-on world: full height, scenery out to both sides |
| Scrumper | `snip` | Arcade | **tall** |  | practice only, hanging fruit falls down: kept upright |
| Steady | `steady` | Arcade | **tall** |  | practice only: kept upright |
| Swerve | `swerve` | Arcade | **tall** |  | practice only, a lane runner: kept upright |

`bun scripts/desktop-modes-table.ts` prints this table from the registry.

## Keyboard and mouse

- Mouse drag is touch drag (pointer events); keys go through `useGameKeys` into the same queues as taps
  (`docs/desktop-support.md` has each game's control map). On a rotated game the direction keys turn with the
  world. A short controls hint (`DesktopControlsHint`) shows the game's keys and how the mouse plays for 8 s at
  the start of every live round, with a mouse only.
- **Input type with every result** (`src/lib/inputType.ts`): each stage notes, from its mount, whether it was
  played by touch, mouse or keyboard (or a mix, "mouse+keyboard"); rooms (`round_results`), dailies and
  challenges (`async_results`) and practice (`practice_plays`) store it in `input_type`, best effort, after
  the result itself (`inputType.server.ts`). Grading never reads it. Migration
  `supabase/migrations/20261031170000_result_input_type.sql` is **written but not applied**: until it is, the
  writes fail quietly and nothing else changes.

## Checks

- **desktop-layout-check** (thirds, `play22`/`play23`): shell and rails, banner slot (and never in rooms),
  pages and their right column, Practice's tools row and 3–5 card grid, the room panel with 16 players in the
  lobby, results, standings, a live round and a reveal, at 1440×900, 1920×1080 and 1024×768; every active
  game's desktop mode at 1440×900 (one of each mode at every size) without overflow, in the centre, crisp;
  phones (414×896 home-screen app, 375×667) unchanged; a 1440×900 touch screen on the tablet layout.
- **desktop-fairness-check** (`play22`): the mapping round trip, keys and swipes on a turned world, upright text on Cue Ball's turned table, no sim,
  replay or grader reading the presentation, real gestures on Cue Ball (rotate), Apex (tall) and Free Cell
  (wide; Cue Ball's shot pulled on its upright power control) reaching the stage as the same world points and payloads at both desktop sizes, and the same payloads
  ending in the same sim state, score and checksum.
- **arcade-play-check --desktop** (`arcade-play-desktop-check`, halves on `play24`/`play25`): every arcade game
  at 1440×900 and 1920×1080 in its desktop mode, live, error-free, crisp, at 60 fps.
- **racing-render-check** (fast shard): Apex's grass saving draws exactly the same pixels, world and beyond, on 1,080
  frames across whole races (six seeds, racingRev 1 and 2, three world sizes).
- **beta-recording-check**: Play again's archive keeps `input_type` (the same migration redefines `restart_duel_room`,
  its archive insert the previous one plus that column; checked as text and on a local PostgreSQL).
- desktop-geometry-check now proves the new columns (its 17 Oct assertions kept where the brief did not change
  them).
- Review shots: `bun scripts/shots/desktop-layout-shots.ts` (`screenshots/desktop-layout-oct-2026/`).
