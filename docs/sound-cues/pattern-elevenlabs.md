# Pattern overhaul: sounds for Joe to generate (ElevenLabs)

Phase 2 step 4 (15 Nov 2026). One line per sound: the slot it fills, what it is, the material, the feel and the
length. Generate each, name the file `<slot>.mp3` and drop it in `public/sounds/`; the slot already plays a
placeholder (the November set behind `NEW_GAME_SOUNDS` in `src/config/soundConfig.ts`, or the library sound named),
so a file with the slot's name replaces it with no code change. Sounds the games already have and that work are
listed as **keep** and need nothing.

The house levels (docs/sound-cues/levels-nov-2026.md) are applied when a file is wired: generate at any level, short
effects with no lead-in silence.

<!-- Each game's section is between its own markers; per-game work edits only its own section. -->

<!-- gridlock:start -->
## Gridlock
<!-- gridlock:end -->

<!-- tessellate:start -->
## Tessellate
<!-- tessellate:end -->

<!-- pipeline:start -->
## Pipeline
<!-- pipeline:end -->

<!-- chroma:start -->
## Chroma Lines
- `flow.draw` — the line grows one square: a single soft liquid "bloop", like a drop of thick paint pushed through a glass tube; round, warm, no click at the start; the game plays it a little higher with every square, so record it at a low-middle pitch; 120–150 ms.
- `flow.cut` — drawing over another colour cuts that line back: a quick soft snip of a rubber tube, wet and short, a little lower than the draw tone, never harsh; 150–200 ms.
- `flow.connect` — a pair joined (the one sound for it; today's file is a placeholder): a glass marble settling into a cup with a short liquid "plip" rising a fifth, satisfying and clean; 400–500 ms.
- `flow.nearMiss` — the board is one pair short (or every pair joined with squares empty): a gentle two-note hint, a soft glassy "almost", the second note left unresolved, quiet; 500–700 ms.
- `flow.solve` — every square filled: liquid colour rushing through every tube at once, then a bright glass-marble chime chord that blooms and fades; 1.0–1.2 s.
<!-- chroma:end -->

<!-- skid:start -->
## Skid
<!-- skid:end -->

<!-- heave:start -->
## Heave
<!-- heave:end -->

<!-- lightbender:start -->
## Lightbender
<!-- lightbender:end -->

<!-- topsy:start -->
## Topsy-Turvy
<!-- topsy:end -->
