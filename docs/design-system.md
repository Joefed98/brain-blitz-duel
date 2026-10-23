# Joulz design system

The look rules for every screen outside a game's own art (23 Oct 2026, Prompt Q). Follow these
when you add or change a screen; the sources named here are the truth, and this page says how to use
them. Game worlds (arcade art, puzzle boards) keep their own look and are not covered here.

There are two screen families:

- **Tab pages** (Play, Practice, Tournaments, Profile; `data-app-page`, `src/polish-layout/app-pages.css`):
  flat panels of divided rows, the gold shine, Archivo.
- **Skinned screens** (lobby, round leaderboard, reveal, standings, results and podium, daily and
  challenge play, dialogs and sheets; `data-skin`, `src/polish-layout/theme.css`, `src/lib/theme.ts`):
  the `--th-*` tokens, Saira / Manrope / Duelz Mono.

Game screens, round intros and room moments (Prepare to Duel, round titles, the winner reveal) are
neither; they use the app tokens in `src/styles.css` (`--background` #0B0B0F, `--primary` #F5B82E).

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
