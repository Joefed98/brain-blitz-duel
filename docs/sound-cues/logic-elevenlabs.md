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
