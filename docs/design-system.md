# Joulz design system

The look rules for every screen outside a game's own art (23 Oct 2026, Prompt Q). Follow these
when you add or change a screen; the sources named here are the truth, and this page says how to use
them. Game worlds (arcade art, puzzle boards) keep their own look; the frame round them is "Game screens" below.

There are two screen families:

- **Tab pages** (Play, Practice, Tournaments, Profile; `data-app-page`, `src/polish-layout/app-pages.css`):
  flat panels of divided rows, the gold shine, Archivo.
- **Skinned screens** (lobby, round leaderboard, reveal, standings, results and podium, daily and
  challenge play, dialogs and sheets; `data-skin`, `src/polish-layout/theme.css`, `src/lib/theme.ts`):
  since Polish batch R (25 Oct 2026, `src/polish-layout/room-screens.css`) every skinned screen that is not
  a tab page takes the tab pages' palette, Archivo in sentence case, flat `#17171B` panels of divided rows
  and a neutral `--primary`; see "Room and other screens" below. Saira / Manrope / Duelz Mono remain only
  on the Play tab's share welcome card.

Game screens, round intros and room moments (Prepare to Duel, round titles, the winner reveal) are
neither; they use the app tokens in `src/styles.css` (`--background` #0B0B0F, `--primary` #F5B82E). A game's
live round is drawn inside the game frame (see "Game screens" below).

## Colour tokens

### Tab pages (`:root` in app-pages.css)

| Token | Value | Use |
| --- | --- | --- |
| `--ap-bg` | #0D0D0F | page background |
| `--ap-panel` | #17171B | panels |
| `--ap-input` | #1A1A1F | inputs, search |
| `--ap-divider` | #26262C | row dividers |
| `--ap-outline` | #2E2E35 | outline buttons |
| `--ap-line` | #3A3A42 | rules, quiet borders |
| `--ap-text` | #F3F1EC | primary text |
| `--ap-text-2` | #A09DA6 | secondary text |
| `--ap-faint` | #8E8B94 | meta text, chevrons, disabled |
| `--ap-link` | #D6D3DC | links (neutral, never gold) |
| `--ap-gold` | #F7BF2F | gold text and marks (see the gold rule) |
| `--ap-gold-tint` | #2E2410 | gold-tinted backgrounds |
| `--ap-on-gold` | #241703 | text on gold |
| `--ap-done` | #23232A | a played daily's grey Done pill |
| `--ap-shine` | #FFE08A → #F7BF2F 40 % → #E0A116 75 % → #C98A0E | the gold shine (main gold buttons) |

### Skinned screens (`:root` in theme.css)

| Token | Value | Use |
| --- | --- | --- |
| `--th-bg` | #07070A | background |
| `--th-text` / `--th-text-2` | #F5F5F7 / #BDBDCC | text |
| `--th-gold-text` | #F2C75C | gold text |
| `--th-teal-text` | #2ED3B7 | teal text |
| `--th-ink` / `--th-teal-ink` | #120C02 / #04201B | text on gold / teal buttons |
| `--th-gold` | #FBE39A → #E9BB45 → #C8922E → #A87420 (135°) | metallic gold button (`th-btn-gold`) |
| `--th-teal` | #7FF5DF → #2ED3B7 → #179A83 (135°) | teal button (`th-btn-teal`, Share) |
| `--th-card` | #20202D → #111119 → #0D0D13 | cards (`th-card`, `data-tint` gold / teal / me) |
| `--th-medal-*` | gold, silver, bronze gradients | `Medal` discs |

### Everywhere

- `--screen-edge` #070709: what shows behind every page, below short pages and in the home-bar strip.
  Every screen's bottom 34 rows are this black where no content covers them (screen-bottom-check).
- Text contrast is at least 4.5:1 on its background (theme-check).
- Player colours are `PLAYER_COLOURS` (`src/lib/duel/playerLook.ts`); never show a player by colour alone.

## The gold rule

**Gold means "tap to play".** Use gold only for:

1. actions that start or join play: Create a room, the Daily Play and Continue pills, Join now,
   Ready, Play again;
2. the current tab in the tab bar;
3. the logo mark and the wordmark's last letter (the Z).

The selected Practice chip is a light fill with dark text (tab pages refresh, 26 Oct 2026), not gold.
Medal discs for 1st to 3rd (`PlaceDisc`, the room's `Medal`) are medals, not gold UI.

Everything else is neutral: links (`--ap-link`), secondary buttons (`ap-btn-outline`), scores, times,
headings, the Beta pill, icons in rows. A second gold thing on a screen should be a reason to look
again. Teal (`th-btn-teal`) is the secondary call to action on skinned screens (Share, challenge).

## Tile and category palette

Each category has one colour (`--category-*` in styles.css), used by its rounds, intros, round titles,
chips and game icon tiles:

| Category | Colour |
| --- | --- |
| Word | #4D8CFF |
| Number | #3DDC84 |
| Speed | #FF8A3D |
| Attention | #FF6BD6 |
| Pattern | #B26BFF |
| Logic | #2ED3B7 |
| Arcade | #FF4D4D |
| All (chip) | #E9BB45 |

- `data-cat` sets `--cat`, plus `--cat-hi` (62 % toward white, for text) and `--cat-lo` (62 % toward
  black, for gradients), mixed in oklab.
- **Game icon tiles** (`.game-icon[data-cat]`, `GameIcon`; 27 Oct 2026, backgrounds 30 Oct 2026): a border in the
  category's exact colour (`--cat`, the `--category-*` token; about 4.5 % of the tile, at least 1.5 px; an arcade
  game's border is its **group's** colour, `data-group`, and Retro's carries a soft cyan glow), the game's own
  background inside (see "Tile backgrounds" below), and a
  small scene of the game in its real look: a few of its own pieces (its renderer's sprites, its board components
  and CSS) in a hand-made state, composed for a square (Breaker's rainbow bricks, paddle and rising ball; Hanoi's
  posts and discs; Slider's letter rows and padlocks). Few bold pieces that read at 34 px; no HUD, timers, buttons or
  UI words (letters and digits that are game pieces stay). Scenes live in `scripts/shots/tile-scenes/` and are
  exported as 208 px WebPs (`public/tiles/`) by `bun scripts/shots/tile-scenes.ts`; re-run it when a game's look
  changes. A game without a scene shows its line drawing (`gameIcons/conceptIcons.tsx`). The share card draws the
  same image on the same tile.
- **Tile backgrounds** (30 Oct 2026; `scripts/shots/tile-scenes/backgrounds.ts`, painted under the scene into
  the same WebP): every tile's inside echoes its game's screen, its colours and design: Hover's synthwave
  sky and grid, Breaker's navy, Wavefront's purple nebula, Fission's green lab glow, Jaywalk's grass and
  road; a puzzle's play-screen gradient in its category's colours and its board's surface and cells.
  Rules for a new game's tile:
  - the background fills the whole square (104 CSS px, exported at 2× as 208 px; the border is drawn
    over its edge); start from the world's base colour or gradient, then one or two of its motifs
    (grid, stars, scanlines, court lines, road stripes, water, wood, cells) in large, low-contrast
    shapes that read at 34 px as texture, never as game pieces; no text, HUD or UI;
  - quieter than the game: `fade` darkens the whole background (0–1; about 0.15–0.35 for most, more
    for bright or busy worlds) and `spot` a soft disc behind the picture (0.3–0.6 when motifs run
    under the main pieces), so the scene's pieces always stand clear;
  - a bright world (Tilt's oak, Jaywalk's grass, a pale board) is darkened rather than recoloured, so
    the tile stays recognisably the game's;
  - seeded only (`rand(seed)`), no clock: the same image every build. Re-run
    `bun scripts/shots/tile-scenes.ts <type>` after changing a background or a game's look, and judge
    it at 104, 64 and 34 px (`--preview=<dir>`, `bun scripts/shots/tile-icons-sheet.ts`).
- **Row icon squares** on the tab pages (`.ap-icon-sq`, 40 px, radius 11) take a tone from `data-tone`:
  puzzle #1A2236 / #7FA6F5, arcade #3A1E22 / #F08A6E, challenge #271F3A / #B79BF2; neutral without one.
- **Play tab tiles** (`.ap-tile44`, `src/components/app/TabIcons.tsx`, 44 px, radius 12): glossy
  gradients with inline SVG art: Daily Puzzle blue (#6E9BFF → #2E57D6 → #1A2E80, a calendar of coloured
  tiles with three faint jigsaw pieces), Daily Arcade red (#FF8A5C → #E8443A → #7A1622, a black
  controller), Challenge a friend violet (#C084FF → #7A35E0 → #3A1680, green and pink badges, a yellow
  bolt, "VS").
- **Category dots** (`.ap-dot`, `data-dot`): 8 px (10 px on headings) in each category's light tint:
  Word #7FA6F5, Number #6FD99A, Speed #F5A25A, Attention #F08AC0, Pattern #B79BF2, Logic #5CD6C0,
  Arcade #F08A6E.

## Fonts and sizes

All fonts are self-hosted under `public/fonts` (OFL) and preloaded from the root route. Never load a
new font from a CDN.

| Where | Family | Notes |
| --- | --- | --- |
| Tab pages | Archivo (variable, 100–900, stretch 62–125 %) | `--ap-font`; body 15 px / 400, tabular numbers |
| Skinned headings, buttons | Saira 600–800 | `--th-font-head` |
| Skinned body, names | Manrope 500–800 | `--th-font-body` |
| Scores, times, codes | "Duelz Mono" (JetBrains Mono 600–700) | `--th-font-mono`; the games' own JetBrains Mono is separate |

Tab page type scale (app-pages.css):

| Class | Size / weight |
| --- | --- |
| `.ap-title` | 31 px / 800, stretch 112 %, −0.02em, line 1.08 |
| `.ap-section-title` | 18 px / 750, stretch 110 % |
| `.ap-row-title` | 16 px / 620, line 20 px |
| `.ap-sub`, `.ap-link` | 15 px |
| `.ap-row-sub` | 13.5 px / 450 |
| `.ap-meta`, `.ap-group-title` | 13 px |
| tab bar labels | 11 px / 600 |

No all-caps headings on the tab pages (the wordmark is the exception). Single-line text never wraps or
is cut off, except player names, which ellipsise (no-wrap-check).

## Radii and spacing

- Panels: radius 18. Gold buttons and outline buttons: 14. Inputs: 12. Row icon squares: 11.
  Pills and chips: 999 (fully round). Practice tiles: 16.
- Page stack gap 22 px; section gap 10 px; row gap 12 px; panel padding 16 px; the 16 px page gutter.
- Tap targets are at least 44 × 44 px (theme-check); text links drawn smaller get an invisible hit area
  (`.ap-hit`, `.th-hit`).
- Practice tiles are 104 px squares; shelves scroll sideways with 10 px gaps; grids are three across.

## Panels and rows

- A panel (`.ap-panel`) is flat #17171B: no glow, gradient border, dashed box or coloured pill.
- Rows (`.ap-row`) are at least 62 px tall, padded 9 × 16, left-aligned, with a 1 px `--ap-divider` line
  above every row but the first, starting after the row's icon (`data-icon="sq" | "44" | "date"` sets the
  inset), iPhone Settings style.
- A row holds: an optional icon, a text block (title, one-line subtitle, both ellipsised), then a value
  or chevron (`.ap-chevron`, `--ap-faint`).
- Skinned screens use `th-card` instead, with `data-tint` for gold, teal or "me".

## Tap feedback

- Every pressable thing on the tab pages carries `.press`: while pressed it sinks to 98 % and lightens
  (`brightness(1.12)`) over about 90 ms. Transform and filter only: nothing moves in layout.
- Pressed rows lighten their background to 3.5 % white.
- With reduced motion the lightening stays, the scale does not.
- No blue boxes: no tap highlight, focus outline or text selection on touch; keyboard focus rings only
  with hover and a fine pointer (`styles.css`, touch-highlight-check).

## The logo

- One geometry (`src/components/brand/logoGeometry.ts`, a 26 × 34 box): a two-part lightning bolt with
  two faint speed lines. Draw it with `LogoMark` (SVG), or from the same geometry in canvas (share card)
  and scripts (app icons, the link preview image).
- **Gold version on dark** (`LogoMark variant="gold"`, the default): upper half #FFEBA8 → #F7BF2F →
  #C98A0E, lower half #F0B634 → #A86F08, speed lines #F7BF2F at 30 % fading out. The speed lines are
  hairlines at any size (a non-scaling stroke of min(1.5 px, the mark's px per unit), `LOGO_HAIRLINE_PX`): the
  22 px header mark draws them exactly as before; a mark sized by CSS passes `lineWidth`. Use it on any dark
  background: the app header, Prepare to Duel, the link preview.
- **Inverted version** (`variant="inverted"`): the mark in near-black (#2A2A30 → #0D0D0F, #0D0D0F →
  #000) on the gold shine (`GOLD_SHINE_STOPS`). Only for the app icons (`scripts/brand-icons.ts`) and
  share cards.
- Never recolour, outline, stretch, rotate or add effects to the mark beyond a soft gold glow; never put
  the gold version on gold or the inverted version on dark. A crop (`viewBox`) is fine where a screen needs
  the bolt to fill a box (Prepare to Duel).
- The in-game logo (`APP_LOGO_URL`, the High Rise flag and burst) is a separate older file.

## The wordmark

- `AppWordmark`: `APP_NAME` uppercased (JOULZ) in Archivo 900 at 118 % stretch, every letter #FFFFFF but
  the last, which is the shiny gold gradient (#FFEBA8 → #F7BF2F → #C98A0E, clipped to the text), then the
  gold mark, 6 px apart.
- The name always comes from `APP_NAME` (`src/lib/brand.ts`); never type it into a component.
- The link preview (`public/og-image.png`, `bun scripts/og-image.ts`) draws the mark and wordmark the same
  way on #0D0D0F, with the line below in #A09DA6.

## The Joulz hero

The hero (`src/lib/arcade/hero.renderer.ts`) replaces the stick figures in Grappler, Jaywalk and
Roofbound (and appears in their tile scenes).

- Colours: black #0D0D0F (`HERO_BLACK`), gold #F7BF2F (`HERO_GOLD`), light gold #FFE08A, deep gold
  #C98A0E, cape edge #A86F08, the bolt's lower half #D99A14.
- Back to front: the cape (gold gradient, hung from the shoulders, trailing opposite the travel and
  lifting with speed); the gold outline of every limb and the torso; the black core of the same strokes
  (all outlines first, then all cores, so joints merge into one silhouette); the chest bolt; gold gloves
  and boots; the head (black, gold ring, gold mask band and two eye slits facing the travel side).
- It is drawn on the game's own joints and never changes a sim, hitbox or stamp (display only; the art
  stays within 2 px of the collision bounds).
- Widths are in px turned into pose units through `scale`; under 24 px tall (`HERO_DETAIL_MIN_PX`) the
  eye slits and chest bolt are left out. Icons pass `detailScale` (the icon's real px per unit) and draw
  as vectors at the icon's real size, each paint on a fresh pose.
- Reduced motion: the cape lifts only gently and snaps instead of easing.
- On the answer reveal (celebrations, 27 Oct 2026): 150–189 the run along the bottom; 190–199 the dance
  (`heroDancePose`, near the left edge, 1.5 s); 200 the lap with six gold fireworks (3 s). A tap anywhere skips it;
  reduced motion shows the hero standing still with a short gold glow.

## Motion and effects

- Every effect is display only and respects `prefers-reduced-motion` (a calm fade or a still frame) and
  the low-end reduced-effects level (`src/lib/fx/lowEnd.ts`).
- Flashes stay within WCAG 2.3.1: never more than three a second, no large full-screen white flash
  (Prepare to Duel's lightning: at most 2 strikes a second, each under 300 ms, a dim gold brightening;
  prepare-lightning-check).
- Effects animate transform and opacity (or draw on their own canvas layer), never layout.

## Game screens

The frame round every game's live round (Polish 2, 24 Oct 2026; `src/polish-layout/game-frame.css`,
`GameLayout` in `src/components/duel/PhoneShell.tsx`, `src/components/duel/GameFrame.tsx`). Intros,
reveals, results, the lobby, the podium and the tab pages are not game screens and do not change.

### The principle: same game, enhanced

Every game keeps its art style, characters, palette, layout logic and rules. The frame, the background,
the tray and the dock are shared and drawn round the game; per-game art changes come in category batches
using the toolkit below. Nothing in the frame touches scoring, rules, timing, seeds, hitboxes, physics,
server calls, stored data, routes, storage keys or version stamps.

### Category colours

The frame uses the app's category colours (`--category-*`, "Tile and category palette" above) through
`--category-accent`, which the game screen sets from its category (`data-category`). A game on the
arcade stage that belongs to another category (Tenfall, Bonk, Pull!, Mixed Signals) uses its own
category's colour.

### The header (all 72 games)

One 60 px header replaces the app header, the old PRACTICE/name row and the 52 px arcade header. On a
live round the Joulz app header is not drawn. It starts right under the notch (no extra margin) and runs
three columns, the timer exactly centred:

| Part | Look |
| --- | --- |
| Left, line 1 | The game's name: Archivo 800, 19 px, `font-stretch` 110 %, #F3F1EC. A long name steps down to fit its half (never under 14 px, `--name-len`; no measuring, so it is right from the first paint), then ellipsises. |
| Left, line 2 | A 7 px dot in the category colour, then "{Category} · Practice", "· Round {n} of {N}" (rooms and friend challenges) or "· Daily": 12 px, 600, #A09DA6. Where the half is narrow, a long line drops the category word (the dot stays). Round pips show after it only where the half is 240 px or wider. |
| Centre | The timer ring (`TimerBar`): 48 px, a 4 px #26262C track, the arc in the category colour with a round cap, the seconds inside in Archivo 800, 15 px, tabular. The last ten seconds still pulse and turn red, with the same ticks and voice. |
| Right | The score block (`FrameScore`): a label (11 px, #8E8B94) over the number (Archivo 800, 22 px, tabular), then the "?" and the sound button, each 36 × 44 px in #A09DA6. |

The score block shows the room total (with the place, "2nd of 6", or the opponent's total under it) in a
room, the total so far in the daily or a challenge, and this device's best ("Best") in practice, where
no live score exists. The room's unread-chat dot sits on the block's corner; the "finished" ping lies
over the left half, never over the timer, the score or the board. A guest's Leave (between rounds) sits
before the sound button. The sound button opens one popover with both channels' switches and sliders.

Arcade games keep their in-world HUD line ("1UP", "WAVE 1", "BRICKS 12/80") inside the arena, and their
world starts directly under the header, edge to edge.

### The goal line (puzzles)

Under the header, one 13 px, 600, #A09DA6 line (`GoalLine`): the game's goal on the left (its intro goal,
shortened in `frameGoal` where it would not fit at 375 px) and its progress on the right. A game with
stages publishes them with `useGoalProgress` (today: every `StageProgress` game: Operator, Tally, Integer
Pyramid, Brimful, Eagle Eye, Ballpark), which draws "Stage n of N" and a 6 px bar of pips in the category
colour, the done part with a soft glow, in place of the game's own bar. The line's height (18 px, or 28 px
with a bar, `GOAL_BAR_GAMES`) is fixed before the first paint, so nothing moves when progress arrives.

### The puzzle background

Puzzle game screens (`data-puzzle-play`) replace plain black with the category gradient:

```css
background:
  radial-gradient(130% 45% at 50% 0%, {cat}33, transparent 65%),
  radial-gradient(120% 40% at 50% 100%, {cat}24, transparent 70%),
  linear-gradient(180deg, {deep} 0%, #0D0D0F 45%, #0D0D0F 60%, {deep} 100%);
/* plus the vignette */
radial-gradient(140% 90% at 50% 50%, transparent 55%, rgba(0,0,0,.55) 100%);
```

`{cat}` is the category colour, `{deep}` that colour mixed 10 % into #0D0D0F. No patterns or textures, and
no drift. The top and bottom edge strips still fade to `--screen-edge`, so no seam shows at the notch or
home bar. Arcade backgrounds (their screen fills) are unchanged.

### The tray and the board's size (puzzles)

**Never smaller than main.** A puzzle's board keeps main's layout exactly: the same column (4 px sides),
the same arena and design caps, centred between the goal line and the dock by layout 2's auto margins.
The frame's top (60 px header and an 18 or 28 px goal line) is shorter than main's (top bar, heading and
timer row), so a height-limited board gets more room, never less. Two games whose content spreads over
their arena's height, Tally and Don't Break the Chain, lift the arena's cap and fill the whole height
(`BOARD_FILL` in `GameFrame.tsx`, `data-board-fill`); measured with every cap lifted, the other boards
that "grew" only grew an empty panel round a board of the same size, so they keep main's cap.

**The tray hugs the board.** The tray is its own layer (`[data-game-tray]`, `useBoardTray` in
`GameFrame.tsx`), drawn under the stage in the game region (isolated, pointer-events none), so the
board's layout, size and input are untouched. It is the board's box (`boardBox`, `src/lib/boardBox.ts`)
plus 10 px all round, 8 px clear of the screen's sides; beside a board too wide for that the side
padding shrinks to 4 px and then the margin to 0, so a full-width board keeps main's width and its tray
runs to the screen's edge. It is placed before the first paint and again whenever the board's box
changes size; it never follows a dragged piece (absolutely placed content is left out of the box).
Look: a 26 px radius, `linear-gradient(180deg, {cat}14, rgba(255,255,255,.02))`, a 1 px `{cat}2E`
border and `inset 0 1px 0 rgba(255,255,255,.08), inset 0 -10px 30px rgba(0,0,0,.35), 0 18px 40px
rgba(0,0,0,.45)`; a tray within 58 px of the game region's clipping bottom edge gets a short drop shadow
(`0 6px 12px -6px`), or the region would cut the long one in a faint line across the home-bar strip. On
puzzle play screens the notch strip fades over 24 px (0.5 rem elsewhere), because the header starts right
at the inset over the brighter category top.

**The board-size check.** `bun scripts/shots/frame-probe.ts --compare=scripts/fixtures/board-sizes-main.json`
opens every puzzle at 414 × 896 and 375 × 667 on the fixed intro example and fails unless each board's box
is at least main's width and height and the tray's empty space above and below the board is at most
24 px each (`--record` re-records main's sizes, run against main; `--fill` measures with every cap lifted).
It also reports cut header or goal-line text and dock buttons under 52 px.

**Small boards in a big space** need the game's own code to grow and are left for the category batches:
Strikeout's word row, Bang On's track, Hanoi's pegs, Roundabout's wheel and Safe Cracker's dials stay at
main's size, centred, with the tray round them.

### The control dock

A game's controls (keypads, number chips, arrows, Submit, Reset) follow the tray and so sit at the
bottom, above the home-bar inset plus 16 px. Every button after the tray is at least 52 px tall
(`game-frame.css`, "the dock"), except Cryptogrid's clue strip and keypad (a dense board of their own) and
Tally's number pad (its taller keys would take height from its board). A one-line live summary may sit just above the dock
where the game already has that information; the category batches add those.

### The toolkit (for the category batches)

Shared and documented, not yet applied game by game:

| Piece | Where | Look |
| --- | --- | --- |
| Glass piece | `.gf-glass`, `.gf-glass-cat` (tinted) | `linear-gradient(180deg, rgba(255,255,255,.12), rgba(255,255,255,.035))`, 1 px rgba(255,255,255,.11) border, `inset 0 1px 0 rgba(255,255,255,.2), 0 6px 14px rgba(0,0,0,.5)` |
| Well (empty slot) | `.gf-well` | rgba(0,0,0,.35) fill, 1 px rgba(255,255,255,.06) border, `inset 0 2px 6px rgba(0,0,0,.6)` |
| Glow | `.gf-glow` | a soft blurred copy of the piece's fill behind it (`--gf-glow-blur`, `--gf-glow-opacity`) |
| Alert ring | `.gf-alert` | a dashed red ring pulsing once a second (still under reduced motion) |
| Right move | `rightMoveFlash(el)` (`src/lib/fx/gameToolkit.ts`) | a 240 ms category-colour ring and glow |
| Wrong move | `wrongMoveFlash(el, sound)` | the shared ±3 px shake and 240 ms red outline (`puzzleReject`) |
| Arcade atmosphere | `ArcadeAtmosphere` (`src/components/arcade/ArcadeAtmosphere.tsx`) | a gradient, then a still seeded starfield or a soft top glow, a vignette, and optional scanlines for retro worlds; pointer-events none |

All of it is display only, respects mute (it plays nothing but `puzzleReject`'s existing cue), the
Effects slider and reduced motion, and animates nothing in layout.

### Seeing a change

`bun scripts/shots/before-after.ts [games…]` captures main and the branch at 414 × 896 with the contact
sheet's setup and drivers and writes side-by-side sheets to `screenshots/before-after/` (plus
`overview.png` for a full run).

## Room and other screens (Polish batch R, 25 Oct 2026)

`src/polish-layout/room-screens.css`, notes in `docs/polish-batches/room-screens.md`.

- **Scope**: `[data-skin]` without `[data-tab-screen]`: the lobby, link join, round results, standings,
  podium and final results, the answer reveal's chrome, the daily and challenge screens, terms, the first-time
  intro, the settings sheet, the chat sheet and confirm dialogs. The tokens resolve to the tab pages' (`--ap-*`);
  `--primary` is neutral #F3F1EC, so old gold accents read as light text.
- **Gold**: only the action that plays, drawn with `th-btn-gold` / `ap-btn-gold` (the gold shine): Start
  game, Ready, Continue, Play again, Join room, the daily and challenge Play / Continue, Create a room,
  I agree, Let's play. `th-btn-teal` and the gold outlines are neutral outlines (secondary).
- **You**: `data-you` with `--you` (the player's colour): a 3 px left bar, and "(you)" after the name.
- **Rows**: `.rs-list` panels of `.rs-row`s (48 px, divider inset 14 px); `.rs-total` scores in white;
  `.rs-move` ▲ green / ▼ red / – grey; medals for 1st–3rd only; a shared place reads "=1" (`Medal shared`).
- **Ties** (`src/lib/duel/tieDisplay.ts`): the ranking already breaks ties by time used; rows level on
  points say "Level on 230 · ahead on time" / "behind on time", rows level on points and time share the
  place and medal with "Level on 230".
- **Room footer** (`RoomFooter`): one 68 px row, the 52 px chat button then the main action (and Share);
  Disband and Leave in the header's "⋯" menu (`RoomMenu`).
- **Segmented controls** `.rs-seg` (selected = light fill, dark text); **category chips** `.rs-cat`
  (`data-cat`, tinted when on, grey when off); **pills** `.rs-pill` (neutral).
- **Intros**: the game frame's header, the category gradient, a tray hugging the still or demo, the
  auto-start ring in the category colour beside a gold Ready.
- **Errors**: `ErrorState` (dimmed mark, title, explanation, optional room-code box, Back to Play, one gold
  action) for the 404, room not found and challenge not found.

## Tab pages refresh (26 Oct 2026)

The design canvas's "Tab pages refresh" row (T-Play, T-PlayFirst, T-Practice, T-Tournaments,
T-TournamentsEmpty, T-Profile, T-ProfileNew), in `src/polish-layout/app-pages.css` ("tab pages refresh").
Presentation only; review shots `bun scripts/shots/tab-refresh-shots.ts --tag=after`
(`screenshots/tab-refresh-oct-2026/`, `--tag=before` on main).

- **Play**: the first visit's intro card (`IntroCard`, the "intro" Play slot reserved before the first
  paint; once per device, `lib/onboarding.ts`) stands in for the hero title; Quick play with the
  player's badge; Next public game (`PublicGameNext`: date tile, title, "Tonight · 8:00 pm UK · 6 rounds",
  a status line under a divider, then a quiet disabled "Opens 7:45 pm" with a lock beside Add to calendar,
  or from lobby time the teal "Lobby open · 9 players waiting · starts in 11 min" and a gold Join now;
  the same height in both states, `PUBLIC_CARD_H` 220); Today (Daily Puzzle and Daily Arcade, "Done"
  with a teal tick and the score once played; Challenge a friend joins the panel); Warm up (three games
  in one divided panel with "Best 171" or "Not played").
- **Practice**: All games and the seven categories in a 4 × 2 chip grid; Recently played (up to four,
  `practiceRecent.ts`); one list per category headed by its dot, name, count and a BEST label over a
  56 px right-aligned column (`.ap-best`, "–" unplayed). Since 30 Oct 2026 split by the Puzzles | Arcade
  switch (below).

## Practice: Puzzles | Arcade switch and arcade groups (30 Oct 2026)

- One Practice tab (the tab bar is unchanged). Under the title a two-part switch (`.ap-switch`, 52 px:
  two 44 px halves on a #17171B panel, radius 16 / 12): "Puzzles {n}" | "Arcade {n}", counts from the
  registry (`practiceSideCounts`, `src/lib/duel/practiceSide.ts`: active arcade-category games on Arcade,
  every other active game on Puzzles). The side shown takes the gold shine (an exception to the gold
  rule asked for by Joe: it is this tab's way into play); the other half is muted (`--ap-faint`, no fill).
  The device remembers the last side (`duelz-practice-side:v1`).
- Search ("Search puzzles" / "Search arcade games"), Recently played, the sections and Retired show only
  the side's games.
- **Puzzles**: as before minus the Arcade chip: All games and the six puzzle categories in the 4-column
  chip grid; one section per category.
- **Arcade**: chips three across with no sideways scrolling (`.ap-chip-grid[data-cols="3"]`): All games,
  Retro, Sports; Cards & Board over two columns (`data-span="2"`), Action. One section per group with
  games ("Retro", "10 games", BEST), in the same row style as the puzzle sections. A chosen group with no
  registered games yet says "{Group} games are coming soon".
- **Groups** (`src/lib/duel/arcadeGroups.ts`, one data file by registry id; ids the registry lacks are
  skipped, so a new game only needs registering): Retro `--group-retro` #36E2F5 (neon cyan, a soft glow on
  its dots and tile borders), Sports `--group-sports` #4CC24A, Cards & Board `--group-cards` #FF5C93,
  Action `--group-action` (the arcade colour #FF4D4D). Browsing and tile borders only: rooms, the room
  category picker, arcade rounds, the daily arcade and scoring keep Arcade as one category.
  practice-switch-check proves it.
- **Tournaments**: Next up (the card above), Coming up rows with a calendar icon button, Your results
  titled by the schedule's event name with a place disc (`.ap-place`: gold, silver, bronze, outlined
  otherwise), date, "2nd of 14" and points. Nothing scheduled: an empty card with "Open the beta
  Discord" (only when `DISCORD_URL` in `betaConfig.ts` is set) and Go to Practice; no results: three
  dashed discs and a line.
- **Profile**: the badge in the player's own colour, name, Beta player chip and Change; the stats strip
  in the same panel; Daily, Practice bests (BEST column) and Recent rooms (place discs) only once there
  is something in them. A new player sees "Choose your look" and Get started (play a room, today's daily,
  a practice best), each ticking off from the device's own records.
