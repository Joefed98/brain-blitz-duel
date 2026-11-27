# Desktop support: PC and laptop browsers (17 Oct 2026)

> **31 Oct 2026:** the layout described here is superseded by the computer layout (`docs/desktop-layout.md`): the
> desktop layout now starts at 1024 px wide (a mouse or trackpad still required), with a left rail, page columns,
> a room panel and each game's desktop mode. The control map below still holds (only Cue Ball is drawn rotated, and
> it has no direction keys).

Joulz now works in PC and laptop browsers with a mouse, trackpad and keyboard. **Phones and tablets
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
- **Every game has keys** (Joe, 20 Nov 2026; built 21 Nov 2026). The board games whose stage takes only taps and
  drags (Counterweight, Tessellate, Don't Break the Chain, Chroma Lines, Lamplighter, Mosaic, Ascend, Matchmaker,
  Pipeline, Shikaku, Swapword, Tents and Trees, Lookout, and Bonk, Pull! and Flash) read their keys through one piece,
  `BoardKeys` (`src/components/puzzles/KeyCursor.tsx`, spec per game `BOARD_KEYS` in `src/lib/desktopKeys.ts`, engine
  `src/lib/gameFrame/boardKeys.ts`): the arrows move a white ring between the board's own pieces (spatial navigation:
  the nearest piece that way), and Space presses there with the very pointer and click events a mouse sends at that
  spot, so the board's own handlers run as for a click; held Space is a held button (a drag as the ring moves; gold
  while held). Bonk presses the centre of a hole's cell, Pull! at a crosshair, Flash its one target. Tenfall and Cue
  Ball need their run's state, so their stages pass their own queue or `send` to `src/lib/gameFrame/stageKeys.ts`
  (Tenfall one `useGameKeys` line in `src/puzzles/tenDrop.tsx`, Cue Ball the `keys` prop in `src/puzzles/pool.tsx`).
  Nothing listens until the game's controls are Keyboard (the default on a computer; Mouse turns it off), and a
  locked board takes no press (it takes no pointer).

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
| Home Run (`homerun`) | homerunRev 4 (3 Nov 2026): click a spot on the field before the pitch, then click anywhere to swing as the ring closes on the ball (rev 1–3: drag through the ball; rev 3 also Contact or Power) | Space = swing (homerunRev 4; the spot stays a click); rev 3: C or 1 = Contact, P or 2 = Power, the swing a mouse drag |
| Spacewalk (`cross`; was Jaywalk) | Drag-flick up, down, left or right | ← → ↑ ↓ / WASD step |
| Meteor (`snake`) | Drag-flick to turn | ← → ↑ ↓ / WASD turn |
| Orbit (`orbit`) | Click to release; SET CHECKPOINT button | Space releases; C sets a checkpoint (when the button shows) |
| Pinball (`pinball`) | Hold the left or right half (one flipper at a time) | ← or Z left flipper, → or M right flipper, both at once (existing) |
| Rainbow Bridge (`inkbridge`) | Drag to draw; the four buttons | Mouse draws. Enter or Space = Release, Z or Backspace = Undo, R = Reset, D = Drop again |
| Rally (`rally`) | Drag (or hover) to move the paddle | ← → / A D move the paddle (7 px a tick) |
| Roofbound (`flip`) | Click to flip | Space, ↑ or W flips |
| Scrumper (`snip`) | Drag across a rope to cut | None: cutting is an aimed stroke, and a key cut would be aim assist |
| Slice (`slice`) | Drag across the discs | None: a slice is an aimed freehand stroke |
| Swish (`bintoss`) | Drag to aim, release to throw (release on the bottom strip cancels) | Arrows / WASD aim (Shift: fine); Space or Enter throws; Esc hides the aim |
| Tempo (`beat`) | Click a lane (hold for hold notes; flick sideways on swipe notes) | D F J K the lanes (D F Space J K on five; hold a key for a hold note), ← → flick the lane last pressed, Enter fever (Joe, 16 Nov 2026) |
| Tilt (`tilt`) | Drag sideways to tilt | ← → / A D tilt (a virtual drag, 4 px a tick) |
| Top Bins (`freekick`, freekickRev 4) | Drag from the ball with the mouse to draw the shot (where it ends is the target, its bend the curl), hold the power bar and let go to strike | ← → ↑ ↓ nudge the drawn shot's target (20 cm, Shift 5 cm; with nothing drawn the first press aims at the goal's centre); A D its curl left / right (10 a press); hold Space for the power meter, let go to strike. freekickRev 3: click the goal to aim, drag sideways to curl, the same keys. Revisions 1–2 (a drawn stroke): mouse only |
| Wavefront (`wavefront`) | Drag in the bottom quarter to move | ← → / A D move (6 px a tick) |
| Curl Champ (`curling`) | Drag the target; drag the stone sideways to slide it; In / Out buttons; curlRev 4: click or drag on the power bar (right) to set the weight, then the Throw button (curlRev 1–3: drag up to throw, its speed the weight); rub left or right of a moving stone to brush | ← → ↑ ↓ move the target (Shift: further); A D slide the stone; I / O the turn; − / + set the weight on the power bar (from the draw zone's mark the first time; Shift: 50; curlRev 3 the meter), Enter throws it (curlRev 1 and 2: Enter throws a draw weight); while a stone travels ← → brush its left / right, S carries it |
| Cue Ball (`pool`) | Drag anywhere to turn the cue; pull the power bar left and let go; the spin ball | ← → turn the aim (Shift: a tenth as far); ↑ ↓ set the power on the bar; W A S D move the spin dot; Space shoots (Joe, 21 Nov 2026) |
| Iron Wall (`bastion`; was Bastion) | Drag to aim (the crosshair 120 px above the thumb), lift to fire, swipe down to reload, tap for the fast reload | the mouse aims, click fires, R reloads, Space is the fast-reload tap (unstamped rounds: ← → / A D rotate) |
| Dual (`dual`, practice) | Click the left or right half | ← / A / F left, → / D / J right |
| Hot Floor (`hotfloor`, practice) | Click tiles and the drawn buttons | Mouse for tiles. Enter or G = Go, Z or Backspace = Undo, C or Esc = Clear |
| Junction (`junction`, practice) | Click an approach | Rev 1: ← → ↑ ↓ / WASD. Rev 2: 1–8 for the eight lights, once built |
| Moon Climb (`ricochet`) | Click to leap (on a lantern, the side clicked) | Space, ↑ or W; ← / A and → / D leap off a lantern that way |
| Rooftop Run (`rooftop`, practice) | Drag-flick | ← → ↑ ↓ / WASD |
| Steady (`steady`, practice) | Press and drag | Hold ← → / A D to steer (4 px a tick) |
| Swerve (`swerve`, practice) | Click the left or right half | ← → / A D |

### Engine games on the arcade stage

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Letterfall (`wordfall`, Word) | Click tiles; Enter box/button | Mouse for tiles. Enter or Space = Enter. Typing letters is not mapped, because several touching tiles can share a letter |
| Mixed Signals (`stroop`, Attention) | Click a lane, flick down to drop; ◀ ▼ ▶ pad | ← → / A D move, ↓ / S drops (the pad's own buttons) |
| Bonk (`whack`, Speed) | Click a hole | 1 2 3 4 / Q W E R / A S D F / Z X C V: one key a hole, row by row (Joe, 21 Nov 2026) |
| Pull! (`clayshoot`, Speed) | Click a clay | ← → ↑ ↓ / WASD move a crosshair (held keys speed up); Space or Enter shoots at it (Joe, 21 Nov 2026) |
| Tenfall (`tendrop`, Speed) | Click a falling tile | 1 2 3 4 tap that column's lowest tile (21 Nov 2026) |

### Word

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Cryptogrid (`codeword`) | Click a square, then a letter | A–Z type the letter; Backspace or Delete = Clear; Enter = Next empty |
| Forage (`wordhunt`) | Drag or click a path | A–Z add the first touching cell with that letter (anywhere to start); Backspace steps back; Enter submits |
| Interlock (`tilegrid`) | Click a tray tile, then a cell | A–Z pick or unpick the first tray tile with that letter (click a cell to place it); Enter = Done |
| Lookout (`wordsearch`) | Drag a line | ← → ↑ ↓ / WASD move the board cursor; hold Space and move to trace a word, let go to check it; Enter = Done |
| Nucleus (`wordsmith`) | Click tiles; Shuffle / Clear / Enter | A–Z tap the first unused tile with that letter; Backspace takes the last off; Esc clears; Enter enters |
| Roundabout (`letterwheel`) | Drag or click wheel letters | A–Z add the first unused letter; Backspace steps back; Esc clears; Enter checks the word; Space shuffles |
| Slider (`wordslide`) | Drag a row or column; the padlock | Z or Backspace = Undo, R = Reset |
| Strikeout (`strikeout`) | Click keypad letters | A–Z press the letter; Backspace = Delete/Back; Enter = Solve |
| Swapword (`swapword`) | Click two tiles, or drag one onto another | ← → ↑ ↓ / WASD move the board cursor; Space picks a tile, Space on another swaps |

### Number

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Ballpark (`numline`) | Drag or click the line; Place | ← → / A D move the marker 1 % of the line (Shift: 0.1 %); the first press centres it; Enter = Place |
| Brimful (`measure`) | Click jugs; Fill/Empty; Reset | 1–9 pick jug n; F = Fill, E = Empty; R = Reset |
| Checkout (`checkout`) | Click wedges and ring buttons; Undo; Throw | Z or Backspace = Undo; Enter = Throw (wedges and rings by mouse) |
| Counterweight (`balance`) | Click a weight, then a notch | ← → ↑ ↓ / WASD move between the weights and the notches; Space picks, Space places |
| Exact (`target`) | Click tiles and operators; Undo / Reset / Lock | 1–6 pick tile n; + − × ÷ (also * x /) the operator; Z or Backspace = Undo; R = Reset; Enter = Lock |
| Integer Pyramid (`numpyramid`) | Drag or click tiles to cells; double-click sends one back | Enter = Skip |
| Operator (`equation`) | Click operators and slots; Next | + − × ÷ (also * x /) fill the next slot; Backspace clears the last slot; Enter = Next/Submit |
| Trail (`trail`) | Drag or click the path; Undo / Reset | Z or Backspace = Undo; R = Reset |
| Tenfall (`tendrop`) | See the engine games | |

### Speed

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Ascend (`numhunt`) | Click the numbers in order | ← → ↑ ↓ / WASD move a ring to the nearest disc that way; Space taps it (no key taps "the next number": finding it stays the game; Joe, 21 Nov 2026) |
| Bang On (`stopwatch`) | Click to stop | None: a decision for Joe (below) |
| Don't Break the Chain (`chain`) | Click the nodes | ← → ↑ ↓ / WASD move the board cursor; Space taps |
| Flash (`reaction`) | Click the arena | Space or Enter taps (Joe, 21 Nov 2026) |
| Bonk, Pull! | See the engine games | |

### Attention

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Double Take (`spotdiff`) | Click differences; Next picture | Enter or N = Next picture |
| Eagle Eye (`symscan`) | Click cells; Submit | Enter = Submit |
| Labyrinth (`maze`) | Drag on the board, or the arrow pad | ← → ↑ ↓ / WASD press the pad's arrows (held keys repeat as a held button does) |
| Matchmaker (`pairmatch`) | Click cards | ← → ↑ ↓ / WASD move the board cursor; Space turns a card |
| Tally (`countup`) | Click the keypad | 0–9 type; Backspace deletes; Enter enters |
| Mixed Signals | See the engine games | |

### Pattern

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Chroma Lines (`flow`) | Drag paths | ← → ↑ ↓ / WASD move the board cursor; hold Space on a dot (or a line's end) and move to draw |
| Gridlock (`unblock`) | Drag blocks; Undo / Reset | Z or Backspace = Undo; R = Reset |
| Heave (`push`) | Drag-flick, or the arrow pad | ← → ↑ ↓ / WASD the pad's arrows; Z or Backspace = Undo; R = Reset |
| Gradient (`tiles`; Jumbled until 27 Oct 2026) | Click two tiles to swap them, or drag one onto the other (tilesRev 4+; older rounds slid a tile into the gap) | Esc lets go of a picked tile (`DESKTOP_KEYS`); the old slide keys (← → ↑ ↓ / WASD, Z or Backspace = Undo, R = Reset) were for the slide rounds |
| Lightbender (`laser`) | Click to place/flip, drag to move; tray; Fire | M / S pick mirror / splitter; Enter or Space = Fire; Z or Backspace = Undo; R = Reset |
| Pipeline (`pipes`) | Click a tile to turn it (right-click turns back) | ← → ↑ ↓ / WASD move the board cursor; Space turns, Shift + Space turns back |
| Skid (`iceslide`) | Drag-flick, or the arrow pad | ← → ↑ ↓ / WASD the pad's arrows; Z or Backspace = Undo; R = Reset |
| Tessellate (`blockparty`) | Drag pieces; click rotates; double-click flips | ← → ↑ ↓ / WASD move between the tray's pieces and the board's squares; Space turns (twice quickly: flips); hold Space and move to carry a piece, let go to drop it; Z undo, R reset |
| Topsy-Turvy (`gravity`) | The arrow pad | ← → ↑ ↓ / WASD the pad's arrows; Z or Backspace = Undo; R = Reset |
| Turntable (`rings`) | Click a ring; ↺ ↻ | ↑ ↓ / W S select a ring; ← → / A D turn it |

### Logic

| Game (id) | Mouse | Keys |
| --- | --- | --- |
| Blackout (`lightsout`) | Click cells; Undo / Reset | Z or Backspace = Undo; R = Reset |
| Bomb Defusal (`bomb`) | Click wires and buttons; Defuse / Reset | 1–9 cut wire n; A / B the buttons; Enter = Defuse; R = Reset |
| Box Six (`sudoku`) | Click a cell, then a digit; Pencil; Clear | ← → ↑ ↓ / WASD move the selection; 1–6 the digit; Backspace or Delete = Clear; P = Pencil |
| Loopline (`fences`) | Click an edge: line, ✕, clear; drag along edges to draw several | Mouse only (wide layout) |
| Regions (`fillomino`) | Click a number on the pad, then click or drag squares; the eraser clears | 1–9 pick the number; 0, E, Backspace or Delete the eraser; ← → ↑ ↓ move a cursor, Enter or Space apply |
| Island Link (`bridges`) | Drag from island to island: one bridge, two, none | Mouse only (wide layout) |
| Kakuro (`kakuro`) | Click a square, then a digit; Pencil; Clear | ← → ↑ ↓ move between white squares; 1–9 the digit; Backspace or Delete = Clear; P = Pencil |
| Colour Flood (`flood`) | Click a colour pot | 1–5 the pots, left to right |
| Hanoi (`tower`) | Click pegs; Undo / Reset | 1–3 the pegs; Z or Backspace = Undo; R = Reset |
| Lamplighter (`lightup`) | Click cells | ← → ↑ ↓ / WASD move the board cursor; Space places, marks, clears |
| Mosaic (`nonogram`) | Click cells | ← → ↑ ↓ / WASD move the board cursor; Space fills, crosses, clears; hold Space and move to paint |
| Polypotions (`tubes`) | Click flasks; Undo / Reset | 1–9 and 0 the ten flasks; Z or Backspace = Undo; R = Reset |
| Safe Cracker (`safe`) | ▲ ▼ buttons or flicks; Try | ← → / A D pick a drum (outlined); ↑ ↓ / W S turn it; Enter = Try |
| Shikaku (`shikaku`) | Drag rectangles | ← → ↑ ↓ / WASD move the board cursor; hold Space and move to draw a rectangle; Space on one removes it |
| Tents and Trees (`tents`) | Click cells | ← → ↑ ↓ / WASD move the board cursor; Space places a tent, grass, clears |
| Dig (`dig`, practice) | Drag to dig | None |

## The Cabinet (polish plan B1, 21 Nov 2026)

A computer's live arcade round outside a room (`ARENA_CABINET_LEFT`, `src/lib/gameFrame/arena.ts`; off until Joe
approves desktop-geometry-check's K18 lines): the identical world at its largest uniform scale, centred between two
panels that open onto the game's own scenery (no fade). Left (`[data-arena-panel-left]`, 280 px): the game's head, the
big score (this run's own running score, the sim's, read through `src/lib/rated/liveScore.ts` once a second), the
timer, the best and stars, and "This run" (the board's DOM status pills, where it has them). Right (`[data-arena-panel]`,
320 px): the goal, the next challenges (practice) and the controls as key chips with the Keyboard / Mouse choice. Navy
cards (`.cab-card`) with one edge in the game's arcade group colour (`--cab-edge`; cyan for the engine games). Sideways
tablets, rooms (the room panel is the right panel there) and Cue Ball's turned table keep the one panel, and so does
any window where the left panel would draw the world smaller than the single panel does (`cabinetFits`, Joe 22 Nov
2026: the Cabinet never draws a game smaller than before; read before paint and on every resize). Nothing here
reaches a sim, an input or a score.

Not built (Joe, 22 Nov 2026): **Blockzone's own cabinet** (the plan's B2: Next and the stats beside the well, drawn as
scene) is dropped for now: it needs `blockfallScene` and the world's own drawing changed, not only `bfLayout`.
**Puzzles in two columns** (B3) waits: a right controls column inside today's puzzle column (at most 960 px; 765 px at
900 px tall, pinned by desktop-geometry-check) would make every board smaller, so puzzles keep one column on computers.

### The canvas HUD in the panel (`ARENA_HUD_IN_PANEL`, on since 27 Nov 2026)

The HUD painters already skip drawing when `hudInWorld()` is false (`src/lib/arcade/hudPlacement.ts`), but nothing
carries their values to the panel, so the flag stays off (Joe, 21 Nov 2026) until this channel is in:

1. `hudPlacement.ts`: a per-draw list, `noteHud(item: { label: string; value: string; gold?: boolean; main?: boolean })`,
   cleared by `withHudInWorld` at the start of each draw and read after it with `takeHud()`.
2. Each painter records before it returns early when `!hudInWorld()`:
   - `retroHud(ctx, worldW, main, side)`: `main` as `{ label: "", value: main.text, main: true }`, each side item as
     `{ label: "", value: item.text }` (Retro readouts are one string, e.g. "WAVE 2 OF 5");
   - `drawActionHud(ctx, width, rows)`: every chip of every row, `{ label: chip.label, value: chip.value, gold: chip.gold }`;
   - `drawHudPillRow` and `drawHudTextPillRow`: each pill `{ label, value }`;
   - the cards' `drawChip(ctx, x, y, label, value, { gold })`: `{ label, value, gold }`;
   - `drawHudPill` (single pill: Ball Tracker, Coral Pop, Rainbow Bridge, Gemstone, Orbit, Tilt call it directly) does
     not honour the flag today; it needs the same early return and record.
3. `ArcadeCanvasStage`, after its `withHudInWorld(false, draw)`: publish `takeHud()` to a tiny store beside
   `liveScore.ts` (at most 4 times a second, only when the list changed).
4. `ArenaGamePanel`'s "This run" card (P4's) lists the store's items (label left, value right; `main` items as the big
   line), then the flag goes on in a small follow-up PR.

Done (27 Nov 2026, P4): A3's channel (items 1–3) is in; the panel lists the store's items (`HudRows` in
`ArenaGamePanel.tsx`: the Cabinet's "This run" card, and the single panel's status block, in a room too; the run's
main count first and larger, a Retro readout on its own line, gold values in gold), only while the flag is on, so each
value shows once. Eleven active arcade stages run their own frame loop rather than ArcadeCanvasStage's (Breaker, Tempo,
Hover, Rally, Meteor, Pinball, Spacewalk, High Rise, Coral Pop, Gemstone, Ball Tracker); each wraps its world's draw in
`useArenaHudDraw()` (`src/lib/gameFrame/arenaHud.ts`), which does what ArcadeCanvasStage does round its draw: the
painters skip the world on the arena only, and the values go to the store. Phones, tablets upright, intro demos,
reveals, replays and every check's render draw exactly as before (the flag is read only inside a live stage's draw on
the arena). Since the desktop size PR 1 (27 Nov 2026) Ball Tracker's strip above its board, Blockzone's speed and
Gemstone's goals panel go to the side panel too (below).

Games whose HUD is drawn some other way and would keep it in the world: Rainbow Bridge, Curl Champ, Top Bins, Home Run,
Crazy Golf, Cue Ball (its upright strip), Apex; Tenfall, Bonk and Pull! have DOM HUDs, already mirrored in "This run".

## Desktop size, PR 1 (27 Nov 2026): full screen, hidden panels, the HUD row given back

### Full screen and hiding the panels (`src/lib/gameFrame/screenMode.ts`, `ArenaScreenTools.tsx`)

- **Full screen**: on the arena's live round (a computer, or a sideways tablet), a button in the screen's top right corner
  and the **F** key; **Esc** leaves it (the browser's own). The browser's Fullscreen API on the whole page, offered
  wherever the browser has one and never on an iPhone (its Safari has no page full screen); Android phones have it as a
  "Full screen" switch in the game menu. Remembered on the device (`duelz-fullscreen:v1`): a player who left it on is
  put back into full screen by their next click or key on a game screen (browsers allow it from one only); leaving it
  any way turns the choice off.
- **Hidden panels**: the **H** key and the "Hide panels" button hide the rail and every side panel (the Cabinet's two,
  the single panel, a room's panel) during play; the same key or button brings them back (kept for the visit). With
  them hidden the world takes the whole screen at its largest uniform scale, each game draws its own HUD in the world
  again (the panel that listed it is gone) and the timer moves to the corner beside the buttons.
- F and H are shortcuts only where the game doesn't use the letter: checked after the game's own key listeners have run
  (`defaultPrevented`), so Minefield's F (Reveal / Flag), Tempo's F lane and the six word games that type letters keep
  them (the buttons work there). DesktopControlsHint names F and H only where they work.

### The HUD row given back (`src/lib/gameFrame/hudBands.ts`)

With the HUD's values in the panel, the strip each arcade game kept for its HUD holds only backdrop on a computer.
ArcadeArenaSlot sizes the world as if that strip were not there and draws it that much higher, the strip above the
slot's clip, so the board grows; the world, its drawing and its pointer mapping (the arena element's own box) are
unchanged. Only the arena's live round, with the panels showing (hidden panels draw the whole world, HUD and all).
Phones, tablets upright, intros, demos, reveals and replays draw the whole world as before.

| Game | Cut from the top (world units) | Cut from the foot | What stays |
|---|---|---|---|
| Meteor | 44 | | the board from 44 |
| Breaker | 50 | | the top wall at 50 |
| Rally | 28 | | the lives balls (29..39), the pads' glow |
| Tempo | 20 | | the fever meter (a tap target, 22..42) |
| Pinball | 36 | | the table's arch |
| Spacewalk | 22 | | the helmets (23..33), the astronaut's head on the goal deck |
| Blockzone | 36 | | the well's glow |
| Coral Pop | 64 | | the rock ledge |
| Gemstone | 26 | 95 | the board's tray, the GOAL! / TREASURE! banners (its goals panel goes to the side panel) |
| Tilt | 118 | 175 | the words strip (140) and the disc with its ticks |
| Roofbound | 150 | | the cave's roof (never above 152.5) |
| Grappler | 36 | | the cave's ceiling and its lit lip |
| Minefield | 44 | | the board's frame |
| Mahjong | 48 | | the top layer and a matched pair's lift |
| Free Cell, Five Hands | 44 | | the top row |
| Summit | 54 | | the peaks |
| Thirteen | 46 | | the pyramid |

None for Hover, Wavefront, Orbit, Rainbow Bridge and Moon Climb (play reaches the world's top), High Rise (its crane's
cable), Iron Wall (the crosshair goes anywhere), Fission (its lives ships at the very top) and Ball Tracker's world (its
marble queue); Ball Tracker's strip above the board goes instead. Each band names the stamp it was measured on and
hud-bands-check fails when a game is dealt on another, so a new stamp is measured again before it can be cut.

Into the panel too: **Ball Tracker's strip** (not drawn; its pills note their figures inside the frame's draw, the
board taking its 36 px), **Blockzone's speed** ("Speed 1/6"; it sits beside the well, so the board gains no height from
it) and **Gemstone's goals panel** (Ice, Treasure, Big lines and each goal by its gem's shape, its count or a tick; its
strip under the board given back). A long list (Gemstone's) is two columns of smaller rows.

## Decisions for Joe

*21 Nov 2026: superseded for Flash, Bonk, Tenfall, Pull!, Ascend and Cue Ball, which now have keys (Joe: every game
playable from the keyboard on a computer). The notes below are the October reasoning, kept for the record.*

Each of these games was left exactly as it was: mouse only, no keys added.

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
5. **Swipe-direction games** (Meteor, Spacewalk, and Rooftop Run in practice). An arrow key replaces a
   short flick anywhere on the screen. Both reach the sim on the next tick and neither needs aim, so they
   were judged equal and given keys. Say if you'd rather treat them like Bonk.

## Checks

- **hud-bands-check** (desktop size PR 1; ~5 s, no browser): every band belongs to a live game measured on its dealt
  stamp; only the arena's live arcade round is cut; Blockzone's speed and Gemstone's goals are noted for the panel out
  of the world and drawn exactly as before in it.

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
