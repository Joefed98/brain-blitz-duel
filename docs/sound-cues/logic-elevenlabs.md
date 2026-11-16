# Logic overhaul: sounds to generate in ElevenLabs

Session 1 of the Logic overhaul (Box Six, Polypotions, Hanoi, Safe Cracker, Mosaic, Colour Flood, Minefield; 15 Nov
2026). One line a sound: the slot it drops into (`public/sounds/<slot>.mp3`, set the slot's `url` in
`src/lib/fx/manifest.ts`), then what it is, its material, its feel and its length. Every slot below is already wired
and silent (or on today's sound) until its file arrives. Keep each effect inside its length; loops none here.

## Kept as they are

These existing files already suit the new look and stay: `tubes.cork` (cork pop), `safe.dialClick` (but now capped to
one per 60 ms), `mines_reveal`, `mines_cascade`, `mines_flag`, `mines_unflag`, the solve stingers (`done.corks`,
`done.glowSweep`, `done.tileFlip`, `done.rising`).

## Wanted

Every action in the seven games, game by game (Joe, 15 Nov 2026: none may be missed). An action marked *kept* stays on
today's file; every other line needs a new or better recording.

(A list, not a table, so the cue sheet does not read these as cues before their slots exist.)

- `sudoku.place`: A lacquered wooden tile set down on a hard board, one soft dry tap, 0.15 s
- `sudoku.pencil`: A pencil tip touching paper, very quiet single tick, 0.1 s
- `sudoku.clash`: A low muted wooden knock, slightly dissonant, short, 0.2 s
- `sudoku.line`: A gentle rising glass chime, two notes, bright but soft, 0.5 s (a row, column or box completed; stage 2)
- `sudoku.combo`: Three-note warm chime chord rising, soft mallets on glass, 0.8 s (several lines at once; stage 2)
- `tubes.lift`: A cork-stoppered glass vial lifted off a wooden rack, soft glassy clink, 0.3 s
- `tubes.pour`: Thick coloured liquid glugging from a thin glass tube into another, three short glugs, 0.45 s
- `tubes.undo`: A glass vial set back in a wooden rack, light clink, 0.2 s
- `tubes.wrong`: A glass tube tipped and righted on wood with nothing pouring, a hollow clink and wobble, 0.35 s
- `tubes.outOfPours`: An empty glass vial tapped twice with a fingernail, hollow and final, 0.6 s
- `tower.drop`: A turned oak ring dropped onto a wooden post, a warm wooden clunk, 0.25 s (pitched by ring size in the app)
- `tower.illegal`: A short low buzz with a wooden rattle, not harsh, 0.25 s
- `tower.glint`: A tiny bright metallic shimmer, like light catching gold, 0.4 s
- `safe.wrongTry`: A heavy steel safe handle jerked against a locked bolt, a dull clunk, 0.4 s
- `safe.solve`: Three steel bolts sliding back one by one, then a heavy door swinging on its hinge, 1.2 s
- `nonogram.fill`: A small glazed ceramic tile pressed into grout, a soft clay tap, 0.15 s
- `nonogram.paint`: A tiny dry ceramic tick, very short, made to repeat quickly, 0.08 s
- `nonogram.mark`: A soft pencil scratch, one stroke, 0.12 s
- `nonogram.line`: A small porcelain chime, one clear note, 0.4 s (a line turns gold; stage 2)
- `flood.spread`: A soft liquid whoosh of paint spreading over enamel, 0.3 s (stretched and pitched by squares taken)
- `flood.combo`: A sparkling glassy shimmer over a whoosh, 0.6 s (20+ squares in one move; stage 2)
- `minesweeper.hit`: A heavy muffled thud under stone, no explosion crackle, 0.45 s
- `minesweeper.defuse`: A soft mechanical click, like a spring-loaded pin locking, 0.15 s (each remaining mine defused at the clear)
- `minesweeper.tapNumber`: A tiny dull knock on stone, 0.1 s (an unsatisfied number tapped)
- `sudoku.check`: Two dry wooden ticks close together, like a pencil tapping a board twice, 0.2 s (Expert's Check with no clash; stage 3)
- `tubes.uncover`: A soft glassy shimmer, a veil lifting off coloured liquid, 0.3 s (a hidden layer uncovered on Expert; stage 3)
- `nonogram.autoCross`: A quick soft pencil flick across paper, 0.14 s (Easy crosses a matched line's gaps; stage 3)

### Every action, checked

- Box Six: select a cell (silent by design: selection is constant), digit placed (`sudoku.place`), same digit again
  clears (`sudoku.clear`: A tile lifted off a board, a soft dry tick, 0.12 s), pencil (`sudoku.pencil`), Clear button
  (`sudoku.clear`), clash (`sudoku.clash`), line done (`sudoku.line`), several lines (`sudoku.combo`), solve
  (`sudoku.solve`: Grid lines ringing into gold, a warm rising shimmer of small chimes outward from one point, 1.0 s).
- Polypotions: lift (`tubes.lift`), pour (`tubes.pour`), wrong flask (`tubes.wrong`), cork (`tubes.cork`, *kept*),
  two corks quickly (`tubes.combo`: Two quick cork pops then a bright glassy ting, 0.6 s), Undo (`tubes.undo`), Reset
  (`tubes.reset`: Several glass vials set back in a wooden rack at once, a soft clatter, 0.5 s), out of pours
  (`tubes.outOfPours`), solve (`tubes.solve`, *kept*: done.corks), each cork glinting at the end (`tubes.glint`: A tiny
  glass ting, very soft, 0.2 s).
- Hanoi: lift (`tower.lift`: A wooden ring lifted off a post, a light wooden scrape, 0.25 s), deselect
  (`tower.lower`: The same ring lowered back, a soft tap, 0.15 s), drop (`tower.drop`), illegal (`tower.illegal`), ring
  home in order on gold (`tower.glint`), Undo (`tower.undo`: A ring slid back onto a post, short wooden slide, 0.25 s),
  Reset (`tower.reset`: Several rings slid off posts together, a brief wooden clatter, 0.5 s), solve (`tower.solve`: A
  rising run of warm wood-block notes ending in a bright gold chime, 1.0 s), time-out near miss (`tower.near`: A soft
  falling two-note wooden tone, 0.4 s).
- Safe Cracker: dial step (`safe.click`, *kept*, capped to one per 60 ms), wrong try (`safe.wrongTry`), broken clues
  flashing (covered by `safe.wrongTry`), right try (`safe.solve`), drums locking in turn before the door
  (`safe.drumLock`: A single brass tumbler dropping into place, crisp metallic click, 0.15 s).
- Mosaic: fill (`nonogram.fill`), drag paint (`nonogram.paint`), × (`nonogram.mark`), clear (`nonogram.clear`, *kept*),
  line complete (`nonogram.line`), two lines at once (`nonogram.combo`: Two porcelain chime notes together, a small
  bright chord, 0.6 s), solve (`nonogram.solve`: Tiles flipping row by row, a quick cascade of light ceramic clicks into
  a soft chime, 1.0 s).
- Colour Flood: flood (`flood.spread`), 20+ squares (`flood.combo`), the current colour tapped (`flood.reject`: A dull
  glass marble bump, 0.15 s), near par counter glow (`flood.nearPar`: A soft low pulse, like a muted bell, 0.4 s), out of
  moves (`flood.outOfMoves`: A short descending glassy tone, final, 0.6 s), solve (`flood.solve`: One deep warm swell
  across the board, enamel shimmer, 1.0 s).
- Minefield: reveal (`minesweeper.reveal`, *kept*), cascade (`minesweeper.cascade`, *kept*, its ticks to be pitched
  rising: `minesweeper.cascadeTick`: A dry stone tick, very short, 0.05 s), flag and unflag (`minesweeper.flag`,
  `minesweeper.unflag`, *kept*), unsatisfied number tapped (`minesweeper.tapNumber`), mine (`minesweeper.hit`), clear
  (`minesweeper.clear`: Soft clicks of mines defusing one after another, ending on a calm low chime, 1.2 s), each mine
  defused (`minesweeper.defuse`).
