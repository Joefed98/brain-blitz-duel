# Desktop support: PC and laptop browsers (17 Oct 2026)

Duelz now works in PC and laptop browsers with a mouse, trackpad and keyboard. **Phones and tablets
are unchanged.** All of this is presentation and input only: no version stamps, no sim, scoring or
timing changes, and no stored data touched.

## Who gets what

| Device | Layout | Keys |
| --- | --- | --- |
| Phone or tablet (coarse pointer: touch) | Unchanged | None. No key listener is ever added. |
| Mouse or trackpad (hover and a fine pointer), window at least 1180×560 | Desktop layout | Yes |
| Mouse or trackpad, smaller window (e.g. 1024×768, or a window being shrunk) | The phone layout, as before | Yes |

The query lives in one place in code (`src/lib/desktop.ts`: `DESKTOP_QUERY` for the layout, `KEYS_QUERY`
for keys) and once in CSS (`src/polish-layout/desktop.css`). A phone never reports a fine pointer, so no
desktop rule can reach it whatever its size. A touch-screen laptop used by touch, or a large tablet,
keeps the phone layout. desktop-geometry-check proves this.

**Assumptions.** 1180 px is the narrowest desktop width, so 1024×768 windows and iPads keep the phone
layout. The 1280×720 window in the brief is taken as a 1280×720 viewport. Keys work in any window that
has a mouse or trackpad (no size rule), so shrinking a desktop window never takes them away.

## Layout (`src/polish-layout/desktop.css`)

- **Pages** (home, practice list, lobby, link join, round result, standings, podium, winner reveal):
  the phone column, centred, widened from 430 to 480 px.
- **Puzzle screens** (intro, live round, reveal): a centred column at most 560 × 1000 px, centred
  vertically. Boards size from the column as they do on a phone, so they grow with it and are never
  stretched. Text keeps its phone size, which is normal desktop reading size.
- **Arcade play screens** (the 22 arcade games and the five engine games on the arcade stage): a
  centred column at most 640 × 1120 px. The world keeps its phone shape at the largest uniform scale
  that fits (the same rule as on a phone), now on whole CSS pixels. Its canvas backing store is that
  box × the screen's pixel ratio (`arcadeCanvasRatio`, capped at 2), so it is drawn crisply rather than
  scaled up. The game's fill (#107, `arenaFills.renderer.ts`) still paints the whole screen round it. The
  header is 56 px (44 on phones), with a 28 px timer ring, 24 px seconds and 14 px labels.
- **Hover**: buttons get a pointer cursor and brighten slightly under the mouse. The rule needs only a
  fine pointer, which phones never have. It is never applied to a whole play area (Flash's arena, Bang
  On's screen), where colour is the signal.
- **Intro keys**: on desktop only, the round intro shows one line of key caps for the game
  (`DESKTOP_KEYS` in `src/lib/desktopKeys.ts`, `DesktopKeys` in RoundIntro). Phones never render it.

The canvas sizes, world aspect rule and pointer mapping are the same code as on phones. Pointer
coordinates go through the arena box (`arcadeWorldPoint`), so a bigger box maps to the same world.

## How the controls work

- **Mouse.** Every game already takes pointer events (taps are clicks, drags are mouse drags, swipes
  are a quick drag), so every game plays with a mouse alone. No game uses a long press. Double-tap
  (Tessellate's flip, Integer Pyramid's send-back) works as a double-click. The only multi-touch
  gestures are Pinball's two flippers (it already had keys) and Tempo's chords; see *Decisions for Joe*.
  Rally steers by hovering as well as dragging. That is existing behaviour, left as it is.
- **Keys** (`useGameKeys` in `src/lib/desktop.ts`) call the very handlers the on-screen controls and
  gestures call:
  - arcade keys push the same payloads into the same queue or "wanted" ref, which the 60 Hz loop records
    on the next tick, exactly as it does a tap;
  - held direction keys move a virtual finger a fixed number of world px a tick through the same
    absolute-position drag input (Breaker, Rally, Wavefront, Tilt, Steady);
  - aimed throws (Swish, Flightpath, Coral Pop) nudge a virtual drag vector, drawn by the same aim
    preview, and throw it through the same launch function as a lifted finger;
  - puzzles call the same button handlers (Undo, Reset, Enter, digit and letter keys), under the same
    disabled and locked guards.
  So timing, input logs, replays and scores are unchanged. Keys are ignored while typing in a text field
  (chat), with Ctrl, Alt or Cmd held, for synthetic events, and inside intro demos (`GameKeysOff`).
  Leaving the window releases any held key, so a key can't stick the way a finger never does.
- **Pause / Esc.** No game has a pause (the room clock is shared), so Esc pauses nothing. Where a game
  has a "clear" or "cancel" action, Esc does that instead (Nucleus, Roundabout, Gemstone, Swish, Hot Floor).
- **Cursors.** Gemstone and Ball Tracker show a white ring cursor (`KeyCursor`, display only) once an
  arrow key moves it, and Safe Cracker outlines the drum the arrows turn. None of these ever shows on a
  phone.

## Control map

*Mouse* says how each touch gesture is done. *Keys* is empty where the game is mouse-only, with the
reason given. "Practice" marks games retired to practice.

### Arcade

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Ball Tracker (`balltrack`) | Click a tile to turn it | ← → ↑ ↓ / WASD move a cursor; Space or Enter turns the tile |
| Breaker (`breaker`) | Drag the paddle; quick click fires a held power-up | ← → / A D move the paddle (7 px a tick); Space fires the power-up |
| Coral Pop (`bubble`) | Drag to aim, release to shoot | Arrows / WASD aim (Shift: fine); Space or Enter shoots |
| Fission (`burst`) | Click the arena to fire; hold the ◀ ▶ buttons | ← → / A D hold to move; Space fires |
| Flightpath (`bullseye`) | Drag to aim, release to shoot | Arrows / WASD aim (Shift: fine); Space or Enter shoots |
| Gemstone (`matchup`) | Click a gem then a neighbour, or drag onto it | Arrows / WASD move a cursor; Space or Enter picks; an arrow with a gem picked swaps it that way; Esc drops the pick |
| Grappler (`swing`) | Hold to grapple, release to let go; drag up or down while holding to reel | Hold Space to grapple, let go to release; ↑ ↓ / W S reel while held |
| High Rise (`skyline`) | Click to drop | Space, ↓ or S drops |
| Hover (`hover`) | Click to flap | Space, ↑ or W flaps |
| Jaywalk (`cross`) | Drag-flick up, down, left or right | ← → ↑ ↓ / WASD step |
| Meteor (`snake`) | Drag-flick to turn | ← → ↑ ↓ / WASD turn |
| Orbit (`orbit`) | Click to release; SET CHECKPOINT button | Space releases; C sets a checkpoint (when the button shows) |
| Pinball (`pinball`) | Hold the left or right half (one flipper at a time) | ← or Z left flipper, → or M right flipper, both at once (existing) |
| Rainbow Bridge (`inkbridge`) | Drag to draw; the four buttons | Mouse draws. Enter or Space = Release, Z or Backspace = Undo, R = Reset, D = Drop again |
| Rally (`rally`) | Drag (or hover) to move the paddle | ← → / A D move the paddle (7 px a tick) |
| Roofbound (`flip`) | Click to flip | Space, ↑ or W flips |
| Scrumper (`snip`) | Drag across a rope to cut | None: cutting is an aimed stroke, and a key cut would be aim assist |
| Slice (`slice`) | Drag across the discs | None: a slice is an aimed freehand stroke |
| Swish (`bintoss`) | Drag to aim, release to throw (release on the bottom strip cancels) | Arrows / WASD aim (Shift: fine); Space or Enter throws; Esc hides the aim |
| Tempo (`beat`) | Click a lane (hold for hold notes; flick sideways on swipe notes) | None: a decision for Joe (below) |
| Tilt (`tilt`) | Drag sideways to tilt | ← → / A D tilt (a virtual drag, 4 px a tick) |
| Wavefront (`wavefront`) | Drag in the bottom quarter to move | ← → / A D move (6 px a tick) |
| Bastion (`bastion`, practice) | Drag to aim, or the Arrows buttons | ← → / A D rotate |
| Dual (`dual`, practice) | Click the left or right half | ← / A / F left, → / D / J right |
| Hot Floor (`hotfloor`, practice) | Click tiles and the drawn buttons | Mouse for tiles. Enter or G = Go, Z or Backspace = Undo, C or Esc = Clear |
| Junction (`junction`, practice) | Click an approach | Rev 1: ← → ↑ ↓ / WASD. Rev 2: 1–8 for the eight lights, once built |
| Ricochet (`ricochet`, practice) | Click to leap | Space, ↑ or W |
| Rooftop Run (`rooftop`, practice) | Drag-flick | ← → ↑ ↓ / WASD |
| Steady (`steady`, practice) | Press and drag | Hold ← → / A D to steer (4 px a tick) |
| Swerve (`swerve`, practice) | Click the left or right half | ← → / A D |

### Engine games on the arcade stage

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Letterfall (`wordfall`, Word) | Click tiles; Enter box/button | Mouse for tiles. Enter or Space = Enter. Typing letters is not mapped, because several touching tiles can share a letter |
| Mixed Signals (`stroop`, Attention) | Click a lane, flick down to drop; ◀ ▼ ▶ pad | ← → / A D move, ↓ / S drops (the pad's own buttons) |
| Bonk (`whack`, Speed) | Click a hole | None: a decision for Joe (below) |
| Pull! (`clayshoot`, Speed) | Click a clay | None: keyboard aiming is slower than touch, and a snap-to-clay key would be aim assist |
| Tenfall (`tendrop`, Number) | Click a falling tile | None: a decision for Joe (below) |

### Word

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Cryptogrid (`codeword`) | Click a square, then a letter | A–Z type the letter; Backspace or Delete = Clear; Enter = Next empty |
| Forage (`wordhunt`) | Drag or click a path | A–Z add the first touching cell with that letter (anywhere to start); Backspace steps back; Enter submits |
| Interlock (`tilegrid`) | Click a tray tile, then a cell | A–Z pick or unpick the first tray tile with that letter (click a cell to place it); Enter = Done |
| Lookout (`wordsearch`) | Drag a line | None: drawing a line is the game |
| Nucleus (`wordsmith`) | Click tiles; Shuffle / Clear / Enter | A–Z tap the first unused tile with that letter; Backspace takes the last off; Esc clears; Enter enters |
| Roundabout (`letterwheel`) | Drag or click wheel letters | A–Z add the first unused letter; Backspace steps back; Esc clears; Enter checks the word; Space shuffles |
| Slider (`wordslide`) | Drag a row or column; the padlock | Z or Backspace = Undo, R = Reset |
| Strikeout (`strikeout`) | Click keypad letters | A–Z press the letter; Backspace = Delete/Back; Enter = Solve |
| Swapword (`swapword`) | Click two tiles, or drag one onto another | None: swaps are spatial |

### Number

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Ballpark (`numline`) | Drag or click the line; Place | ← → / A D move the marker 1 % of the line (Shift: 0.1 %); the first press centres it; Enter = Place |
| Brimful (`measure`) | Click jugs; Fill/Empty; Reset | 1–9 pick jug n; F = Fill, E = Empty; R = Reset |
| Checkout (`checkout`) | Click wedges and ring buttons; Undo; Throw | Z or Backspace = Undo; Enter = Throw (wedges and rings by mouse) |
| Counterweight (`balance`) | Click a weight, then a notch | None: placement is spatial |
| Exact (`target`) | Click tiles and operators; Undo / Reset / Lock | 1–6 pick tile n; + − × ÷ (also * x /) the operator; Z or Backspace = Undo; R = Reset; Enter = Lock |
| Integer Pyramid (`numpyramid`) | Drag or click tiles to cells; double-click sends one back | Enter = Skip |
| Operator (`equation`) | Click operators and slots; Next | + − × ÷ (also * x /) fill the next slot; Backspace clears the last slot; Enter = Next/Submit |
| Trail (`trail`) | Drag or click the path; Undo / Reset | Z or Backspace = Undo; R = Reset |
| Tenfall (`tendrop`) | See the engine games | |

### Speed

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Ascend (`numhunt`) | Click the numbers in order | None: finding them is the game |
| Bang On (`stopwatch`) | Click to stop | None: a decision for Joe (below) |
| Don't Break the Chain (`chain`) | Click the nodes | None: finding them is the game |
| Flash (`reaction`) | Click the arena | None: a decision for Joe (below) |
| Bonk, Pull! | See the engine games | |

### Attention

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Double Take (`spotdiff`) | Click differences; Next picture | Enter or N = Next picture |
| Eagle Eye (`symscan`) | Click cells; Submit | Enter = Submit |
| Labyrinth (`maze`) | Drag on the board, or the arrow pad | ← → ↑ ↓ / WASD press the pad's arrows (held keys repeat as a held button does) |
| Matchmaker (`pairmatch`) | Click cards | None: finding pairs is the game |
| Tally (`countup`) | Click the keypad | 0–9 type; Backspace deletes; Enter enters |
| Mixed Signals | See the engine games | |

### Pattern

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Chroma Lines (`flow`) | Drag paths | None: drawing paths is the game |
| Gridlock (`unblock`) | Drag blocks; Undo / Reset | Z or Backspace = Undo; R = Reset |
| Heave (`push`) | Drag-flick, or the arrow pad | ← → ↑ ↓ / WASD the pad's arrows; Z or Backspace = Undo; R = Reset |
| Jumbled (`tiles`) | Click a tile next to the gap | ← → ↑ ↓ / WASD slide the tile on that side of the gap into it; Z or Backspace = Undo; R = Reset |
| Lightbender (`laser`) | Click to place/flip, drag to move; tray; Fire | M / S pick mirror / splitter; Enter or Space = Fire; Z or Backspace = Undo; R = Reset |
| Pipeline (`pipes`) | Click a tile to turn it | None: picking the tile is the game |
| Skid (`iceslide`) | Drag-flick, or the arrow pad | ← → ↑ ↓ / WASD the pad's arrows; Z or Backspace = Undo; R = Reset |
| Tessellate (`blockparty`) | Drag pieces; click rotates; double-click flips | None: placement is spatial |
| Topsy-Turvy (`gravity`) | The arrow pad | ← → ↑ ↓ / WASD the pad's arrows; Z or Backspace = Undo; R = Reset |
| Turntable (`rings`) | Click a ring; ↺ ↻ | ↑ ↓ / W S select a ring; ← → / A D turn it |

### Logic

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Blackout (`lightsout`) | Click cells; Undo / Reset | Z or Backspace = Undo; R = Reset |
| Bomb Defusal (`bomb`) | Click wires and buttons; Defuse / Reset | 1–9 cut wire n; A / B the buttons; Enter = Defuse; R = Reset |
| Box Six (`sudoku`) | Click a cell, then a digit; Pencil; Clear | ← → ↑ ↓ / WASD move the selection; 1–6 the digit; Backspace or Delete = Clear; P = Pencil |
| Colour Flood (`flood`) | Click a colour pot | 1–5 the pots, left to right |
| Hanoi (`tower`) | Click pegs; Undo / Reset | 1–3 the pegs; Z or Backspace = Undo; R = Reset |
| Lamplighter (`lightup`) | Click cells | None: picking cells is the game |
| Mosaic (`nonogram`) | Click cells | None: picking cells is the game |
| Polypotions (`tubes`) | Click flasks; Undo / Reset | 1–9 and 0 the ten flasks; Z or Backspace = Undo; R = Reset |
| Safe Cracker (`safe`) | ▲ ▼ buttons or flicks; Try | ← → / A D pick a drum (outlined); ↑ ↓ / W S turn it; Enter = Try |
| Shikaku (`shikaku`) | Drag rectangles | None: drawing rectangles is the game |
| Tents and Trees (`tents`) | Click cells | None: picking cells is the game |
| Dig (`dig`, practice) | Drag to dig | None |

## Decisions for Joe

Each of these games is left exactly as it is: mouse only, no keys added.

1. **Flash (`reaction`) and Bang On (`stopwatch`).** These are pure reaction taps. A key (Space) under
   a resting finger is likely quicker and steadier than a thumb tapping glass, and a mouse button is
   similar. They have no keys. Mouse clicks work, as they did before this change. Should desktop
   players meet phone players in Speed rounds at all?
2. **Bonk (`whack`) and Tenfall (`tendrop`).** A key per hole or column needs no aim and no hand travel,
   so it would beat touch on a 0.6 s pop. No keys.
3. **Tempo (`beat`).** Lane keys (D F J K, the rhythm-game standard) would be natural and would let a
   desktop player hit the last twenty seconds' two-lane chords. A mouse can't press two lanes at once,
   so mouse-only desktop players miss chord notes. Keys, though, may beat tapping a phone. No keys for
   now; this needs a ruling either way.
4. **Mouse versus touch in general.** A mouse is more precise than a thumb for small aimed taps (Pull!,
   Ascend, Don't Break the Chain, Matchmaker) and lets Rally steer by hovering. That is a property of the
   device, not of anything added here, but it matters for real-money play.
5. **Swipe-direction games** (Meteor, Jaywalk, and Rooftop Run in practice). An arrow key replaces a
   short flick anywhere on the screen. Both reach the sim on the next tick and neither needs aim, so they
   were judged equal and given keys. Say if you'd rather treat them like Bonk.

## Checks

- **desktop-geometry-check** (new; headless Chromium, ~4 min). At 1366×768, 1440×900, 1920×1080 and
  1280×720 it checks the pages (centred column ≤ 480 px, no sideways scroll, text no smaller than the phone's 10 px).
  - It plays four puzzle rounds and checks each is a centred column ≤ 560 × 1000, with every control on
    screen.
  - It plays six arcade rounds at DPR 1 and 2. Each must be a centred column ≤ 640 × 1120 with a 56 px
    header and 28 px timer. The world must keep its phone shape at the largest fit, on whole pixels,
    with a crisp canvas, and the fill must cover the screen.
  - It resizes one arcade round through 13 steps, down to the phone layout at 1024×768 and back.
  - It checks that intros show the keys, and that a touch screen of the same size keeps the phone layout.
- **arcade-play-check**'s layout proof includes a 1280×800 window. That window is now proved as a
  touch-screen laptop (CDP touch emulation), which keeps the phone layout it checks. Its four phone
  sizes are unchanged.
- The phone checks (presentation-geometry, safe-area-screens, arcade-device-bottom, first-paint,
  screen-bottom, arcade-fill) run unchanged. None uses a viewport 1180 px or wider.
