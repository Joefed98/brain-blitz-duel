# Joulz design system

The look rules for every screen outside a game's own art (23 Oct 2026, Prompt Q). Follow these
when you add or change a screen; the sources named here are the truth, and this page says how to use
them. Game worlds (arcade art, puzzle boards) keep their own look; the frame round them is "Game screens" below.

There are two screen families:

- **Tab pages** (Play, Practice, Tournaments, Profile; `data-app-page`, `src/polish-layout/app-pages.css`):
  flat panels of divided rows, the gold shine, Archivo.
- **Skinned screens** (lobby, round leaderboard, reveal, standings, results and podium, daily and
  challenge play, dialogs and sheets; `data-skin`, `src/polish-layout/theme.css`, `src/lib/theme.ts`):
  the `--th-*` tokens, Saira / Manrope / Duelz Mono.

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
3. the selected chip (the Practice category chip);
4. the logo mark and the wordmark's last letter (the Z).

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
- **Game icon tiles** (`.game-icon[data-cat]`, `GameIcon`): a glossy gradient from `--cat` to `--cat-lo`
  (darkened), a white top gloss, a 1 px inner rim, a soft drop shadow. The art is the game's own (arcade
  icons painted by the game's renderer at the icon's real pixel size, never an enlarged sprite; puzzle
  icons as SVG). No text in an icon.
- **Row icon squares** on the tab pages (`.ap-icon-sq`, 40 px, radius 11) take a tone from `data-tone`:
  puzzle #1A2236 / #7FA6F5, arcade #3A1E22 / #F08A6E, challenge #271F3A / #B79BF2; neutral without one.

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
Roofbound and draws their game icons.

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

### The header (all 73 games)

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

Every puzzle board sits on a tray: the game's own arena box (`data-game-arena`) dressed with a 26 px
radius, 14 px padding, `linear-gradient(180deg, {cat}14, rgba(255,255,255,.02))`, a 1 px `{cat}2E` border
and `inset 0 1px 0 rgba(255,255,255,.08), inset 0 -10px 30px rgba(0,0,0,.35), 0 18px 40px rgba(0,0,0,.45)`.
The arena's height cap is lifted, so the tray fills the space between the goal line and the dock, with
16 px side margins; the board inside keeps its aspect ratio and is never cropped or under the dock,
because it sizes from the tray's content box as it sized from the arena. This is all in the shared layout
(`game-frame.css`); no game's code changed. Games whose board doesn't size from its arena keep today's
size and no tray (`TRAY_SKIP` in `GameFrame.tsx`, each with its reason): Slider, Counterweight, Tally,
Trail and Ballpark size their boards from the whole column, so the tray's padding would push them past
it. The category batches move them onto the tray in their own code. `bun scripts/shots/frame-probe.ts`
reports any board past its tray, cut header text and short dock targets at 414 × 896 and 375 × 667.

### The control dock

A game's controls (keypads, number chips, arrows, Submit, Reset) follow the tray and so sit at the
bottom, above the home-bar inset plus 16 px. Every button after the tray is at least 52 px tall
(`game-frame.css`, "the dock"), except Cryptogrid's clue strip and keypad, a dense board of their own. A one-line live summary may sit just above the dock
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
