# Joulz style guide · round 2 (proposal)

14 Nov 2026 · for Joe’s approval · nothing in the app changes until it is approved. Pictures:
[GALLERY.md](GALLERY.md). Tokens as CSS: [tokens.proposed.css](tokens.proposed.css). Sources and renderer:
[source/](source/).

## The direction in one line

**Joulz’s own look, chess.com’s use of space.** Joulz keeps its black, navy and champagne gold, the bolt, the
nameplates, cards, tiers and Joules. From chess.com and the other references it takes only flow, layout and
spacing: chunky raised buttons, clean rows, a hero card, one Play bar, choices in bottom sheets, a left rail with
labels on a computer. The art is one 3D kit in a glossy material.

## Principles

1. **One purpose a section.** Every screen is split into short sections with one job each and a plain heading.
2. **Each feature in one obvious home.** Friends, leaderboards, tournaments, challenges, Plus and settings live in
   More; practice lives in Games; buying lives only in the Shop.
3. **Generous but efficient.** 16 px phone gutter, 24 px between sections, 12 px between cards; nothing crammed,
   nothing padded for its own sake.
4. **Gold means act, you or first place.** At most one gold button a screen.
5. **The play area dominates.** Game screens carry the two players, the game number, the stakes and the controls a
   game needs, nothing else.
6. **Show the action physically.** What a player does looks like the real thing happening, without costing time or
   hiding information.
7. **No pressure.** No “best value” or “% more” labels, no countdowns, no ads or pop-ups; purchases only in the Shop.

## Tokens

All values are in [tokens.proposed.css](tokens.proposed.css) and on the [tokens sheet](tokens.png).

### Colour

| Token | Dark | Light | Use |
|---|---|---|---|
| bg | `#06080F` | `#F3F4F8` | Page |
| raised | `#0B0F1C` | `#FFFFFF` | Tab bar, rail, sheets |
| surface | `#0F1424` | `#FFFFFF` | Panels, rows, tiles |
| surface 2 | `#1E2640` | `#E4E7F0` | Secondary buttons, tracks |
| surface 3 | `#28335A` | `#D6DBE8` | Pressed and selected (new) |
| line | `#1E2640` | `#DCE0EA` | Hairlines between rows |
| ledge 2 | `#03050A` | `#BFC6D6` | Secondary button ledge |
| text | `#EEF2FF` | `#0B1020` | Text |
| text 2 | `#B5C6DD` | `#39425F` | Secondary text |
| text 3 | `#8F9BBF` | `#59617F` | Captions |
| gold | `#E2C07A` | `#E2C07A` | Act, you, first place (fills) |
| gold ink | `#E2C07A` | `#7A5C1C` | Gold as text or an icon (new for light) |
| gold metal | `165deg #FBEDC4 → #E6C67E → #D2AC5E → #EED79C` | same | Gold buttons, medals, emblems only |
| gold ledge | `#A8843E` | `#A8843E` | Gold button ledge |
| on gold | `#06080F` | `#06080F` | Text on gold |
| live | `#22E4FF` | `#006A7A` | Live, focus ring |
| win | `#16C35B` | `#0B6F33` | Wins, rating up |
| loss | `#FF5A6E` | `#B81C33` | Losses, rating down (dark changed from `#E5243F`, 4.2 : 1) |
| Joules | `#C6FF3D` | `#456B00` | Joules, always with the bolt |
| scrim | `rgb(3 4 8 / .72)` | `rgb(11 16 32 / .45)` | Behind sheets and dialogs |

Contrast: every text colour (text, text 2, captions, gold ink, live, win, loss, Joules) is at least 4.5 : 1 on bg,
surface and surface 2 in both themes, and on-gold text is at least 4.5 : 1 on the gold metal’s darkest stop. The
renderer checks all 50 pairs each time the sheet is drawn. Category and arcade group colours are unchanged.

### Type: Archivo, six sizes

| Role | Size / line | Weight | Use |
|---|---|---|---|
| Display | 32 / 38 | 800 | Win moment, page heroes |
| Title | 24 / 30 | 800 | Screen titles |
| Heading | 20 / 26 | 800 | Section and card titles |
| Body | 17 / 22 | 700 | Buttons, row titles |
| Label | 15 / 20 | 600 | Secondary lines |
| Caption | 13 / 18 | 600 | Meta and counts; never smaller |

Numbers tabular. Sentence case; capitals only for the JOULZ wordmark and room codes.

### Space, radii, elevation

- Spacing: 4 · 8 · 12 · 16 · 24 · 32 · 40. Phone gutter 16, sections 24 (phone) or 32 (computer), cards 12.
- Radii: 8 avatars and tags · 12 rows, mode buttons and buttons · 16 panels and tiles · 20 a sheet’s top corners.
  These replace today’s angled cuts.
- Elevation, three levels and no glows: **0** panel (surface on the page, no shadow, no border); **1** raised (buttons:
  a 4 px solid ledge, a 1 px top highlight); **2** overlay (sheets, dialogs, toasts over the scrim).

## Components

Every component and state is on the [components sheet](components.png).

- **Button**, one style: gold (metal face, the one big action), secondary (surface 2), quiet (text only), icon.
  Heights 60 / 48 / 36; every target at least 44 × 44. States: default; pressed (sinks 4 px onto its ledge in
  70 ms, fires on release); focus (3 px live ring, 3 px out); disabled (no ledge, caption colour).
- **Mode button**: secondary, 64 px, art icon 44, label, a quiet detail on the right, a chevron.
- **Segmented control** for two to three views of one screen; **chips** for filters (a category dot, white when on).
- **Row**: chess.com’s clean row, 60 px or more, hairline between rows, the whole row the target.
- **Challenge row**: a tick (done) or ring, the goal, a thin progress bar with the best so far, the reward on the right.
- **Game tile**: key art on the game’s own colour, the name bottom left, mastery stars small bottom right. Nothing else.
- **Rating tile**, **award toast**, **sheet** (a grab handle, ✕ and a title), **input** (a sunk well; focus live,
  error loss with one line under it).
- **Tab bar**: Home · Games · Shop · Profile · More, art-kit icons, the current tab in colour with a bold label.
  **No Play tab**: the full-width gold Play bar sits above the tabs on Home and Games.
- **Rail** (computer): the wordmark, the Play button, the four tabs, More’s items under a quiet heading, Settings
  and Support at the foot; it slims to icons during a game.
- **Kept**: NameplateStrip and PlayerCard (avatar, name, title, number, tier and badges), tiers, Joules.

## Motion

Timings and frame strips are on the [motion sheet](motion.png).

| Name | Time | Easing | What |
|---|---|---|---|
| press / release | 70 / 160 ms | ease-out / spring | Button sinks onto its ledge; fires on release |
| select | 120 ms | ease-out | Chips, segmented control, tabs |
| sheet in / out | 280 / 200 ms | `cubic-bezier(.2,.9,.25,1)` / ease-in | Sheet slides up, scrim fades to 72 % |
| page | 220 ms | same | Push: slides 24 px and fades |
| reward land | 420 ms | drop 16 px, squash 1.08 → 1 | Coins, Joules and stars land where they are counted |
| count up | 600 ms | ease-out | Scores and ratings |
| reveal stagger | 60 ms a row, 900 ms at most | ease-out | Results rows |
| win moment | 900 ms | scale 0.9 → 1, fade | Over the frozen play area, never over a score |
| toast | 240 in · 3 s · 200 out | ease-out | Quiet award toast, never over controls |
| physical action | 900 ms at most | per game | The thing happens; the next input is taken at once |
| reduce motion | 120 ms | crossfade | Every movement becomes a fade to its final state |

Polypotions’ pour: lift 120, tilt 160, pour 300–500 by amount, settle 220, return 180. A tap during it is queued
and starts as soon as the flask is back.

## Art kit

The [art kit sheet](artkit.png) shows every icon and the key art. Every icon and piece of key art is a small 3D
scene rendered in code (`../directions/source/art.html`; cameras and colours in `source/art2.mjs`): rounded shapes,
**one gloss material**, **one key light from the top left**, a soft contact shadow. Colours come from the categories’
and groups’ hues plus cream, navy, ink and an art gold (`#EDB43E`, richer than the interface’s champagne so metal reads
as gold). The Joulz coin keeps its black bolt. Icons render at 192 px, key art at 640 × 400 on the game’s own colour.
A new icon is a new scene, never a drawing.

## Don’t

No emoji as icons · no decorative glow or neon · no cards inside cards · no helper text where a label will do · no
one-off art, buttons or colours outside the kit · no countdowns or value labels in the Shop · no effect over a board
while a game runs.

## What changes from today’s DESIGN.md

The palette and gold rule stay. Changes: rounded radii and raised 4 px ledges replace angled cuts; a light theme;
surface 3 and gold ink; loss text `#FF5A6E`; five tabs with More and no Play tab; a full-width Play bar; 3D art-kit
icons replace line icons in tabs, rails, rows and tiles (line icons stay for small controls such as back, close,
chevrons and search).
