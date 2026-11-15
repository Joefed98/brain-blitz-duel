# Logic overhaul 2: gallery

Tents and Trees, Shikaku, Lamplighter, Trail, Loopline, Regions and Island Link (phase 2 step 4, 15 Nov 2026). Each
picture is **before | after** at 390 × 844 (practice, the fixed intro example), mid-play and on the answer reveal.

## Stage 1: the new look and the game changes

Every piece and surface is a Blender render (`scripts/logic-art/render.py`, cut by `bun scripts/logic-art.ts` to
`public/logic-art/`, 35 images, about 150 KB): matte and satin materials under even studio light, with no clear coat,
glare or reflection across a tile, panel or number (Joe, 15 Nov 2026). Every number is drawn flat and bold by the game
over the pieces. Each game keeps its own background colours. Controls are navy with champagne gold, never teal.

### Tents and Trees

![Tents and Trees, play](img/tents-play.webp)
![Tents and Trees, reveal](img/tents-reveal.webp)

Pine and broadleaf trees, canvas tents (lanterns lit on the solve), turf tiles, wooden signposts that turn to a gold
plaque when their count is met; bigger, bolder counts; a red ring and a line under the board for a tent with no tree
beside it; the pill reads "Tents 6 / 12"; the help explains the "?" signposts.

### Shikaku

![Shikaku, play](img/shikaku-play.webp)
![Shikaku, reveal](img/shikaku-reveal.webp)
![Shikaku, intro](img/shikaku-intro.webp)

Glass panes in four jewels (sapphire, emerald, amber, ruby), never two alike side by side; the reveal draws each
rectangle in its own colour; a real 6 × 6 intro board with one solution; larger, bolder numbers; the drag outline turns
green when its area matches the number inside; the help says a tap removes a rectangle.

### Lamplighter

![Lamplighter, play](img/lightup-play.webp)
![Lamplighter, reveal](img/lightup-reveal.webp)

Lit squares fill with warm amber light (the beams stay, quieter), brass bulbs, raised black walls with bold numbers; a
0 is ticked only once every square beside it is lit or dotted; "N squares dark" once six or fewer are left.

### Trail

![Trail, play](img/trail-play.webp)
![Trail, reveal](img/trail-reveal.webp)

Fixed numbers on gold-edged stone tiles, ceramic path stones, bigger bold numbers; on a phone the squares grow up to a
third taller into the empty band above the controls (up to 90 px a square where there is room). Scoring: each undo
costs 2.5 of the clean bonus (`depthRev 3`).

### Loopline

![Loopline, play](img/fences-play.webp)

Black slate, silver pegs, a champagne-gold loop; numbers larger and bold; a met number turns gold (it dimmed before).

### Regions

![Regions, play](img/fillomino-play.webp)

Enamel tiles tinted by region size (two same-size regions can never touch, so neighbours always differ), a finished
region's sides thicker and gold, bold numbers, navy keys with the picked one ringed in gold. Scoring: one drag stroke over
wrong squares is one mistake (`fillominoRev 2`).

### Island Link

![Island Link, play](img/bridges-play.webp)
![Island Link, reveal](img/bridges-reveal.webp)

Black enamel coins in silver bezels that turn gold when met, gold rods on today's navy, numbers flat and bold; a tap on a
bridge cycles it (one, two, none); the help says "drag towards an island".

## The answer reveals

Each game's own reveal (`src/puzzles/logic2Reveal.tsx`, inside the shared reveal layout): one large board at a time.
"Your answer" opens first, marked against the solution: wrong pieces ringed red and missed ones as faint dashed ghosts.
A switch shows the clean "Solution". A solved round shows "Your solution" with no switch. A Daily or challenge whose
solution is still locked shows only your board. Under the board, a bar and legend in place of a line of text ("6 of 12
tents right", wrong, missed), then plain number chips that explain the score (signs met, squares lit, numbers met,
islands met, the path right up to step N, mistakes, undos). Each picture is **before | after**: a half-played round that
ran out of time, then a solved one.

| Game | Timed out (your answer) | Solved |
|---|---|---|
| Tents and Trees | ![](img/reveal-tents-timeout.webp) | ![](img/reveal-tents-reveal.webp) |
| Shikaku | ![](img/reveal-shikaku-timeout.webp) | ![](img/reveal-shikaku-reveal.webp) |
| Lamplighter | ![](img/reveal-lightup-timeout.webp) | ![](img/reveal-lightup-reveal.webp) |
| Trail | ![](img/reveal-trail-timeout.webp) | ![](img/reveal-trail-reveal.webp) |
| Loopline | ![](img/reveal-fences-timeout.webp) | ![](img/reveal-fences-reveal.webp) |
| Regions | ![](img/reveal-fillomino-timeout.webp) | ![](img/reveal-fillomino-reveal.webp) |
| Island Link | ![](img/reveal-bridges-timeout.webp) | ![](img/reveal-bridges-reveal.webp) |

## Image budget

Each game's Blender art plus its tile (WebP, 128 px pieces for 2x boards, 640 px slates): Tents and Trees 20 KB, Shikaku 14 KB, Lamplighter 12 KB, Trail 13 KB, Loopline 9 KB, Regions 25 KB, Island Link 14 KB (about 105 KB for all
seven), well under the 400 KB a game Joe set; logic-overhaul-2-check fails any game over it.

## Stage 2: effects

Waiting for the effects kit (#422) on main.

## Stage 3: levels

Waiting for the difficulty framework on main. Expert boards will be kept only when a person-style solver (every step
deducible, no guessing) completes them and the elite bot finishes most of them (Joe, 15 Nov 2026).

Grids grown downwards so no square falls below about 40 px on a 375 px phone (Joe, 15 Nov 2026), planned and to be
measured when the levels are built: Tents and Trees Expert 8 × 13 (was 10 × 10), Shikaku Expert 9 × 16 (was 12 × 12),
Lamplighter Expert 9 × 14 (was 11 × 11), Island Link Expert 8 × 11 (was 9 × 9). Trail 7 × 7, Loopline 8 × 8 and Regions
8 × 8 fit as they are.
