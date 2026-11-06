# Joulz design rules

Version 1 · 6 Nov 2026 · replaces `docs/design-system.md`

These rules are the single source for how Joulz looks. Every build session reads this file before touching UI.
If something you need isn't here, use the nearest rule and flag it in the PR; don't invent a new value.

The look in one line: **a live sports broadcast for brain games.** Navy-black, ring gold for winning and acting,
cyan for live, angled cuts, big confident numbers, calm everywhere except the moments that matter.

Settled 6 Nov: navy-black background, angled cuts on primary elements only, cyan as the one cool accent, category
colours kept on game screens, art drawn in-house (no paid commissions).

---

## 1. Hard rules for every session

1. **Tokens only.** No hex, rgb() or hsl() values outside `src/design/tokens.css`. No Tailwind arbitrary values
   (`text-[13px]`, `rounded-[14px]`, `h-[52px]`, `bg-[#…]`). Use the token or the component.
2. **Components first.** Use the shared components in `src/design/components/`. Never restyle a raw `<button>`,
   build a new card class, or copy a sheet.
3. **One font: Archivo.** In app screens and game chrome (intro, frame, reveal). Game art inside the play area
   is the exception (section 9): Press Start 2P for Retro art and JetBrains Mono where canvas art names it. No Space Grotesk, Inter, Saira, Manrope or JetBrains Mono in new work.
4. **Gold means act, you, or first place.** Nothing else is gold. At most one gold button per screen.
5. **Gradients only on metal.** Gold buttons, the podium, medals, trophies and rank emblems. No gradient text, no
   glow or sheen on app chrome. Game worlds may glow; the frame around them may not.
6. **Sentence case.** Capitals only for the JOULZ wordmark, room codes and the LIVE tag, set with
   `text-transform: uppercase` (not typed in capitals) so screen readers read words, not letters.
7. **Curly apostrophes and quotes** in every string players read: ’ “ ”.
8. **Every animation ends visible.** Under reduced motion, elements jump to their final visible state.
9. **No change to gameplay** in any design PR. Scores, timings, hit areas and seeds stay identical.

---

## 2. Colour

All values live in `src/design/tokens.css` as `--jz-*` custom properties. The old `--th-*`, `--ap-*` and
`--rs-*` sets become aliases of these during migration, then are deleted.

### Neutrals

| Token | Value | Use | Contrast on surface |
|---|---|---|---|
| `--jz-bg` | `#06080F` | Page background | — |
| `--jz-bg-raised` | `#0B0F1C` | Tab bar, sticky footers | — |
| `--jz-surface` | `#0F1424` | Panels, rows, cards, inputs | — |
| `--jz-surface-2` | `#1E2640` | Secondary buttons, empty progress, dividers that need weight | — |
| `--jz-line` | `#1E2640` | Hairlines and rules | — |
| `--jz-text` | `#EEF2FF` | Main text | 16.4:1 |
| `--jz-text-2` | `#B5C6DD` | Secondary text on tinted panels | 10.5:1 |
| `--jz-text-3` | `#8F9BBF` | Meta text, captions, inactive tabs | 6.6:1 |

### Accents

| Token | Value | Meaning |
|---|---|---|
| `--jz-gold` | `#E2C07A` | Gold text, icons, the bolt, active tab, scores you set |
| `--jz-gold-metal` | `linear-gradient(165deg, #FBEDC4 0%, #E6C67E 34%, #D2AC5E 68%, #EED79C 100%)` | Gold buttons, first place, medals |
| `--jz-on-gold` | `#06080F` | Text and icons on gold (9.3:1 at the darkest point) |
| `--jz-cyan` | `#22E4FF` | Live, info, links, correct, done, "up" movement (replaces the old teal `#2ED3B7`) |
| `--jz-cyan-panel` | `#112A3A` | Tinted panel for head-to-head and "next up" moments |
| `--jz-red` | `#FF3B5C` | LIVE tag, wrong, errors, "down" movement |
| `--jz-silver` / `--jz-bronze` | `#C9D3EA` / `#D9A066` | Second and third place numerals |

Colour is never the only signal: right and wrong also carry a tick or cross, up and down carry an arrow.

### Category and player colours

Keep the existing category accents (`--category-accent`) and the 32 player colours (`playerLook.ts`) exactly as
they are; only move their values into `tokens.css`. Category colour appears in three places only: the 3 px border
round a game tile, the diamond marker beside a category name, and the game screen's top tint (section 9).

---

## 3. Type

Archivo variable font, self-hosted (weights 400–900, widths 62–125 %).

| Role | Size / line | Weight | Width | Notes |
|---|---|---|---|---|
| Wordmark | 22 / 22 | 900 | 118 % | JOULZ, white, gold bolt after it |
| Display | 40 / 40 | 800 | 115 % | "You win!", the hero line on Play |
| Page title | 30 / 32 | 800 | 112 % | Practice, Profile, Tournaments |
| Screen title | 22 / 24 | 800 | 108 % | Standings, Final round |
| Section heading | 18 / 22 | 800 | 110 % | Today, Warm up; followed by a 2 px rule |
| Card title | 16 / 20 | 600 | 100 % | Daily Puzzle, game names |
| Body | 15 / 21 | 400 | 100 % | |
| Meta | 14 / 18 | 400 | 100 % | Times, counts, "6 rounds" |
| Label | 12 / 16 | 600 | 100 % | Captions, column heads |
| Tab label | 11 / 12 | 600 | 100 % | |
| Score S / M / L | 18 / 22 / 28 | 800 | 105 % | Always `tabular-nums` |

Weights in use: **400, 600, 800**, plus 900 for the wordmark only. Retire 450, 500, 550, 620, 650, 700 and 750.

---

## 4. Space and shape

**Spacing:** 4, 8, 12, 16, 20, 24, 32, 48. Page side padding 20. Gap between sections 24.

**The angled cut is the signature shape, kept for primary elements so it stays special.**

| Token | Shape | Use |
|---|---|---|
| `--jz-cut-lg` | 14 px angled corners, top-left and bottom-right | Gold and other primary buttons, feature cards (daily, challenge, head-to-head), game cards, the podium blocks |
| `--jz-cut-sm` | 8 px angled corners | Small primary buttons (Play on a daily card), the LIVE tag |
| `--jz-radius` | 8 px | Rows, list panels, chips, inputs, segmented switch, secondary buttons |
| `--jz-round` | 999 px | Avatars, medals, pills, status dots |
| `--jz-radius-tile` | 16 px | Game tile art inside its 3 px category border |
| `--jz-radius-sheet` | 20 px top corners | Bottom sheets |

Cuts are made with `clip-path` utilities `.jz-cut-lg` and `.jz-cut-sm`. Focus rings must still show: put the ring
on a wrapper, not the clipped element.

**Texture:** the diagonal stripe pattern (`.jz-stripes`) appears only behind the top of tab pages, behind the
standings header, and inside daily cards. Nowhere else.

**Elevation:** no drop shadows on dark UI. Sheets alone get one shadow (`--jz-shadow-sheet`). Depth comes from
surface steps and the gold button's ledge.

---

## 5. Components

Built once in `src/design/components/`, used everywhere. Each has a story in the component gallery page.

| Component | Variants | Replaces |
|---|---|---|
| `Button` | `gold` (56–68 px, metal fill, cut-lg), `secondary` (surface-2, 8 px radius), `quiet` (text only), `icon` (44 × 44) | `.th-btn-*`, `.ap-btn-*`, `.rs-btn*`, shadcn `Button` in app chrome |
| `Panel` / `Row` | panel, striped panel, row with divider | `.th-card`, `.ap-panel`, `.ap-row`, `ui/card` |
| `SectionHeader` | title + rule + right-hand meta or link | ad-hoc headers |
| `Chip` | default, selected, with category diamond | `.th-chip`, `.ap-chip*`, `.rs-cat`, `CategoryPill` |
| `Segmented` | 2–4 options, counts allowed | `.ap-switch`, `.rs-seg`, `SolutionSwitch` |
| `Input` / `CodeInput` | text, search; 4-box room code | `.th-input`, `.ap-input`, the long Tailwind strings |
| `Sheet` | drag to dismiss (vaul), follows the finger | `SettingsSheet`, `RoomSettingsSheet` and the chat sheet's custom portals |
| `Toast` | info, live, error | the four toast and banner patterns |
| `Skeleton` | text line, row, card, tile | `Dots` where a layout is known |
| `LiveTag` | LIVE (red), NEXT (cyan) | |
| `GameTile` | S 56, M 100, L full width; with best score and charge bar | Practice rows' icon, Warm up tiles |
| `Nameplate` | strip (standings, lobby), full, mini | `PlayerBadge` layouts (the avatar disc stays inside) |
| `Medal` | gold, silver, bronze; S 22, M 36, L 64 | `Medal.tsx` (temporary until the art arrives) |
| `TabBar` | phone bar and desktop rail from one list | the two copies in `AppTabBar` and `AppRail` |

Every interactive component has hover (fine pointer), pressed (scale 0.97, 120 ms) and focus-visible states.
Minimum target 44 × 44.

---

## 6. Icons

Until the custom set lands, app chrome uses `lucide-react` at 2 px stroke, 20 or 22 px, square caps. The
custom set (bolt-based, angled cuts) replaces the tab bar first, then headers and sheets. No emoji in app chrome;
emoji stay in chat reactions only.

---

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `--jz-fast` | 120 ms | Presses, toggles |
| `--jz-base` | 200 ms | Screen and sheet entrances |
| `--jz-slow` | 320 ms | Rows settling, numbers landing |
| `--jz-ease` | `cubic-bezier(.2, .8, .2, 1)` | Everything except the moments below |

Keep the existing signature solve burst and room moments (Prepare to Duel, round titles, winner reveal). They are
the only places motion gets theatrical. No bounce easing on app chrome. Reduced motion: hard rule 8.

---

## 8. Layout patterns

- **Header:** wordmark left, sound and music right, 48 px tall.
- **Tab pages:** page title, then sections separated by `SectionHeader`s.
- **Room screens:** no tab bar; footer with chat button and the gold action, on `--jz-bg-raised`.
- **Lists:** your row is pinned and outlined in gold; long lists show top rows, your row, then "See all".
- **Desktop:** the existing rail and right column; same tokens and components.

---

## 9. Game screens

- Intro, frame and reveal use Archivo and the type roles above.
- Category colour stays the game screens' identity, as today: the game title, section labels, timer ring, the
  tinted backdrop and the arcade reveal's colour gradient all keep their category colour. Only the base underneath
  changes to `--jz-bg`, and fonts and buttons follow these rules.
- Game art inside the play area is untouched.
- **Game art is exempt from the one-font rule** (hard rule 3). Canvas and board art keeps the faces it names:
  Press Start 2P (Retro games, Google Fonts) and JetBrains Mono (self-hosted in `public/fonts`, declared in
  `src/lib/arcade/gameArtFonts.css` and loaded only while a round's intro is up). Neither may appear in app chrome
  or game chrome (intro, frame, HUD pills, reveal), which are Archivo.
- Skins (later) never change sizes, hit areas, motion or contrast against the background.

---

## 10. Words

Short, dry, a bit cheeky. British spelling. Sentence case. Name the player and the number when we have them
("4 off your best on Apex", "Sam takes the round"). No exclamation marks except "You win!". No "Oops".

---

## 11. Accessibility

- Text contrast at least 4.5:1 (the theme check stays in CI).
- Focus-visible rings on every device with a keyboard, including iPad: 2 px `--jz-gold`, 2 px offset.
- Targets at least 44 × 44.
- Reduced motion respected, with every element ending visible.
- Capitals via CSS, never typed.

---

## 12. Enforcement

`scripts/design-lint.ts` runs in the fast CI checks. It fails a PR that adds, in changed lines: a hex or rgb()
colour outside `tokens.css`; a Tailwind arbitrary value; a `font-family` other than Archivo outside game art; a
new `@keyframes` without a reduced-motion end state. It warns (doesn't fail) on existing violations, which go down
PR by PR. Game art folders (`src/lib/arcade/*renderer*`, canvas code) are excluded.

---

## Decisions

All settled 6 Nov 2026:

1. **Background:** navy-black `#06080F` replaces `#0B0B0F`.
2. **Angled cuts:** primary buttons and feature cards only; rows, chips and inputs use an 8 px radius.
3. **One cool accent:** cyan `#22E4FF` for live, correct and done; the old teal is retired.
4. **Art:** made in-house, no paid commissions. Medals, trophies and rank emblems are drawn as vector (SVG) with
   the gold-metal finish, so they scale, animate and stay consistent. The Joulz Hero is redesigned on the canvas and
   rebuilt in its existing code renderer.
5. **Game screens keep their category colours** (title, labels, timer ring, backdrop tint, arcade reveal
   gradient). Only the base, fonts and buttons change.
