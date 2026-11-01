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
- **rotate** (top-down arcade games): the identical world drawn turned 90° clockwise into landscape in a rotor
  (`ArcadeArenaSlot`, `data-arena-rotor`), so the world's up points right. Pointer positions map back through
  the inverse turn (`tapMapping.ts` `arenaPointer`, `unrotatePoint`), swipes through `arenaDelta`, canvases
  size from the arena's own box (`arenaSize`), and a game whose keys are screen directions has them turned
  (`desktopPresentation.ts` `rotatedKey`: Jaywalk, Meteor and Tilt arrows and WASD, Curl Champ's arrows; the
  intro's key line and the hint name them as they work on screen). The game's scenery is painted through the
  same turn; a turned world has no moving fill. Orbit's SET CHECKPOINT turns with the world (it stays in its
  reserved corner; C sets a checkpoint from the keyboard).
- **tall** (side-on and behind-camera games): the world scales to the full height of a column up to 760 px; the
  game's own scenery runs out to both sides under a static fade at the rail and panel edges (`data-dk-fade`);
  the HUD stays in the play column.
- All: canvases sized by their box within the pixel-ratio cap of 2.

Active games (84): wide 54, rotate 7, tall 23.

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
| Apex | `racing` | Arcade · Sports | **tall** |  | behind-camera view: full height, scenery out to both sides |
| Ball Tracker | `balltrack` | Arcade · Action | **tall** |  | cups and marbles read top to bottom: kept upright |
| Breaker | `breaker` | Arcade · Retro | **tall** |  | portrait play with controls at the bottom (paddle, flippers, launcher): kept upright |
| Coral Pop | `bubble` | Arcade · Action | **tall** |  | shooter aiming up from the bottom: kept upright |
| Crazy Golf | `minigolf` | Arcade · Sports | **rotate** |  | top-down course: turned to landscape (arrows turn the aim, the same way on screen) |
| Cue Ball | `pool` | Arcade · Sports | **rotate** |  | top-down table: turned to landscape (aim and spin are not screen directions) |
| Curl Champ | `curling` | Arcade · Sports | **rotate** | arrows turn | top-down sheet: turned so stones travel left to right; the broom arrows turn with it |
| Fission | `burst` | Arcade · Retro | **tall** |  | portrait play with controls at the bottom (paddle, flippers, launcher): kept upright |
| Five Hands | `fivehands` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Flightpath | `bullseye` | Arcade · Sports | **tall** |  | behind-camera view: full height, scenery out to both sides |
| Free Cell | `freecell` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Full House | `pokersquares` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Gemstone | `matchup` | Arcade · Action | **wide** |  | match-three board, no physics world: scaled up in a wide column |
| Grappler | `swing` | Arcade · Action | **tall** |  | side-on world: full height, scenery out to both sides |
| High Rise | `skyline` | Arcade · Action | **tall** |  | side-on world: full height, scenery out to both sides |
| Home Run | `homerun` | Arcade · Sports | **tall** |  | behind-camera view: full height, scenery out to both sides |
| Hover | `hover` | Arcade · Retro | **tall** |  | side-on world: full height, scenery out to both sides |
| Jaywalk | `cross` | Arcade · Retro | **rotate** | arrows and WASD turn | top-down road: turned so the walker crosses left to right; swipes and arrows / WASD turn with it |
| Mahjong Solitaire | `mahjong` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Meteor | `snake` | Arcade · Retro | **rotate** | arrows and WASD turn | top-down grid: turned to landscape; swipes and arrows / WASD turn with it |
| Minefield | `minesweeper` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Orbit | `orbit` | Arcade · Retro | **rotate** |  | top-down space flight: turned so the rocket flies left to right |
| Pinball | `pinball` | Arcade · Retro | **tall** |  | portrait play with controls at the bottom (paddle, flippers, launcher): kept upright |
| Rainbow Bridge | `inkbridge` | Arcade · Action | **tall** |  | side-on world: full height, scenery out to both sides |
| Rally | `rally` | Arcade · Retro | **tall** |  | portrait play with controls at the bottom (paddle, flippers, launcher): kept upright |
| Roofbound | `flip` | Arcade · Action | **tall** |  | side-on world: full height, scenery out to both sides |
| Slice | `slice` | Arcade · Action | **tall** |  | side-on world: full height, scenery out to both sides |
| Summit | `tripeaks` | Arcade · Cards & Board | **wide** |  | card / board layout, no physics world: scaled up in a wide column |
| Swish | `bintoss` | Arcade · Sports | **tall** |  | side-on world: full height, scenery out to both sides |
| Tempo | `beat` | Arcade · Retro | **tall** |  | notes fall down lanes to the bottom: kept upright |
| Tilt | `tilt` | Arcade · Action | **rotate** | arrows and WASD turn | top-down maze: turned to landscape; the drag and arrows / A D turn with it |
| Top Bins | `freekick` | Arcade · Sports | **tall** |  | behind-camera view: full height, scenery out to both sides |
| Wavefront | `wavefront` | Arcade · Retro | **tall** |  | portrait play with controls at the bottom (paddle, flippers, launcher): kept upright |

Retired to practice (11):

| Game | Id | Category | Desktop mode | Keys | Why |
| --- | --- | --- | --- | --- | --- |
| Letterfall | `wordfall` | Word | **tall** |  | falling-letter engine game (practice only): kept upright |
| Dig | `dig` | Logic | **wide** |  | puzzle board: re-flows into the wider column |
| Bastion | `bastion` | Arcade | **tall** |  | practice only, defended from the bottom: kept upright |
| Dual | `dual` | Arcade | **tall** |  | practice only: kept upright |
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

- **desktop-layout-check** (thirds, `play21`/`play22`): shell and rails, banner slot (and never in rooms),
  pages and their right column, Practice's tools row and 3–5 card grid, the room panel with 16 players in the
  lobby, results, standings, a live round and a reveal, at 1440×900, 1920×1080 and 1024×768; every active
  game's desktop mode at 1440×900 (one of each mode at every size) without overflow, in the centre, crisp;
  phones (414×896 home-screen app, 375×667) unchanged; a 1440×900 touch screen on the tablet layout.
- **desktop-fairness-check** (`play21`): the mapping round trip, keys and swipes on a turned world, no sim,
  replay or grader reading the presentation, real gestures on Cue Ball (rotate), Apex (tall) and Free Cell
  (wide) reaching the stage as the same world points and payloads at both desktop sizes, and the same payloads
  ending in the same sim state, score and checksum.
- **arcade-play-check --desktop** (`arcade-play-desktop-check`, halves on `play23`/`play24`): every arcade game
  at 1440×900 and 1920×1080 in its desktop mode, live, error-free, crisp, at 60 fps.
- desktop-geometry-check now proves the new columns (its 17 Oct assertions kept where the brief did not change
  them).
- Review shots: `bun scripts/shots/desktop-layout-shots.ts` (`screenshots/desktop-layout-oct-2026/`).
