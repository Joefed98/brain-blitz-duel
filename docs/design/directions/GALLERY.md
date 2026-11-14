# Joulz style guide · round 1: three directions

> **Round 2 is ready:** [the style guide and its mockups](../style-guide/GALLERY.md) on the chosen direction.

Three ways for Joulz to look built by a professional team, all inside the brief: chess.com's warm dark charcoal
and chunky raised buttons, one Joulz accent as the primary button, colourful 3D icons, dark first. Each direction
shows its palette and type, Home, the Play page and one game screen (Cue Ball, a rated match) on a phone
(390 × 844) and a computer (1440 × 900), next to the reference it answers.

**Pick one** (or a mix, such as "A's palette with B's art"). Round 2 then builds the full style guide on it:
tokens, every component with its states, motion, the art kit, and mockups of Home, Play, a puzzle, an arcade game,
the catalogue, Profile, the Shop, a list screen and a bottom sheet. Nothing in the app changes until you approve.

## What all three share

- **Navigation.** Phone: five tabs, Home · Games · Play · Shop · Profile, with Play always one tap away (A and C:
  a full-width Play bar above the tabs on Home, as chess.com; B: a raised Play button in the middle of the bar).
  Computer: a left rail with labels, collapsing to icons during a game.
- **Home** follows chess.com: a hero card with a peeking second card, Recommended match, rating tiles, then Plato's
  Recently played row, the weekly-challenges quest card and Friends.
- **Play** follows chess.com's Play page: one illustration, a format selector (it opens a bottom sheet, as chess.com's
  Choose Time), one big primary button with the stakes under it, then chunky mode buttons (Arena, Rooms, Practice,
  Daily).
- **Game screens** follow 8 Ball Pool: the play area dominant, both players and the stakes (Win +8 · Lose −8) at
  the top, minimal chrome, a big win moment and a quiet award toast. On a computer Cue Ball turns landscape, as it
  already does in the app.
- **Identity stays:** the Joulz name and gold bolt, the approved avatars (drawn as each player's nameplate), the
  rating and tier system, Joules in lime with the bolt.
- **The art kit.** Every icon and piece of key art is a small 3D scene rendered in code (soft shapes, one key light
  from the top left, a soft contact shadow), so they all look like one artist made them. The directions differ only
  in the material: A clay, B gloss, C toon. Source: `source/art.html`.
- **Contrast.** Every text pair in every palette, dark and light, is at least 4.5 : 1 (printed on each palette sheet).

The references are redrawn as labelled layout wireframes rather than screenshots, so no other company's art and
none of your personal photos go into the repo. Your screenshots were the source for each one.

---

## A · Forge

Closest to chess.com. Warm charcoal, Joulz gold as the one action colour, matte clay 3D art, normal-width type,
a full-width Play bar above the tabs.

<img src="forge/palette.png" width="780" alt="Forge palette, type, buttons and art kit">

| Reference | Forge |
|---|---|
| <img src="reference/home-phone.png" width="300"> | <img src="forge/home-phone.png" width="300"> |
| <img src="reference/play-phone.png" width="300"> | <img src="forge/play-phone.png" width="300"> |
| <img src="reference/game-phone.png" width="300"> | <img src="forge/game-phone.png" width="300"> |

Home scrolled, and Home in the light theme:

| Scrolled | Light |
|---|---|
| <img src="forge/home-phone-scrolled.png" width="300"> | <img src="forge/home-phone-light.png" width="300"> |

Computer (reference above each):

<img src="reference/home-desktop.png" width="480"><br><img src="forge/home-desktop.png" width="900">

<img src="reference/play-desktop.png" width="480"><br><img src="forge/play-desktop.png" width="900">

<img src="reference/game-desktop.png" width="480"><br><img src="forge/game-desktop.png" width="900">

---

## B · Volt

Sportier and louder. Ember orange as the action colour, glossy vinyl-toy 3D art, expanded heavy headings, pill
buttons, a raised Play button in the middle of the tab bar.

<img src="volt/palette.png" width="780" alt="Volt palette, type, buttons and art kit">

| Reference | Volt |
|---|---|
| <img src="reference/home-phone.png" width="300"> | <img src="volt/home-phone.png" width="300"> |
| <img src="reference/play-phone.png" width="300"> | <img src="volt/play-phone.png" width="300"> |
| <img src="reference/game-phone.png" width="300"> | <img src="volt/game-phone.png" width="300"> |

| Scrolled | Light |
|---|---|
| <img src="volt/home-phone-scrolled.png" width="300"> | <img src="volt/home-phone-light.png" width="300"> |

<img src="reference/home-desktop.png" width="480"><br><img src="volt/home-desktop.png" width="900">

<img src="reference/play-desktop.png" width="480"><br><img src="volt/play-desktop.png" width="900">

<img src="reference/game-desktop.png" width="480"><br><img src="volt/game-desktop.png" width="900">

---

## C · Studio

Crisper and more compact. Electric teal as the action colour (gold kept for first place and the bolt), outlined
toon-shaded 3D art, condensed headings, tighter corners and a deeper 6 px ledge.

<img src="studio/palette.png" width="780" alt="Studio palette, type, buttons and art kit">

| Reference | Studio |
|---|---|
| <img src="reference/home-phone.png" width="300"> | <img src="studio/home-phone.png" width="300"> |
| <img src="reference/play-phone.png" width="300"> | <img src="studio/play-phone.png" width="300"> |
| <img src="reference/game-phone.png" width="300"> | <img src="studio/game-phone.png" width="300"> |

| Scrolled | Light |
|---|---|
| <img src="studio/home-phone-scrolled.png" width="300"> | <img src="studio/home-phone-light.png" width="300"> |

<img src="reference/home-desktop.png" width="480"><br><img src="studio/home-desktop.png" width="900">

<img src="reference/play-desktop.png" width="480"><br><img src="studio/play-desktop.png" width="900">

<img src="reference/game-desktop.png" width="480"><br><img src="studio/game-desktop.png" width="900">

---

## Side by side

| | A · Forge | B · Volt | C · Studio |
|---|---|---|---|
| Action colour | Joulz gold `#F4B63F` | Ember orange `#FF8F3A` | Electric teal `#33D1BE` |
| Background | `#262320` | `#201D1B` | `#272523` |
| 3D material | Clay (matte, soft) | Gloss (vinyl toy) | Toon (stepped, outlined) |
| Headings | Archivo, normal width | Archivo, expanded 118 %, black | Archivo, condensed 82 % |
| Corners | 8 / 12 / 16 | 12 / 18 / 24, pill buttons | 6 / 10 / 12 |
| Button ledge | 4 px | 4 px | 6 px |
| Phone Play button | Bar above the tabs | Raised in the tab bar | Bar above the tabs |
| Home hero | Panel with art | Full-bleed art card | Split card |

## Not in round 1

The catalogue, Shop, Profile, lists, bottom sheets and motion come in round 2 on the chosen direction. Two things
to know now: the Home tab needs a new line icon (the approved set has none; the mockups draw a stand-in), and the
key art for every game will be rendered in the kit (round 1 shows four: Cue Ball, Polypotions, Gemstone, Blockzone).

To re-render: `node docs/design/directions/source/render.mjs [forge|volt|studio] [--no-art]` from the repo root.
