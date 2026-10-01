# Attention and Pattern changes

## What will change

### Colour Clash
- Keep the existing Colour Clash identity and Attention category, but replace the twelve-prompt round with a deterministic 45-second arcade-engine sorting stream.
- Generate the full seeded course: about 36 colour-word items, eight colours, accelerating spawn gaps, seeded rule flips with a 500 ms banner flash, and seeded gate-colour changes every eight seconds.
- Add left/right swipe sorting, then enable the down-swipe middle gate after 20 seconds. Items that reach the bottom become misses without ending the run.
- Replay the submitted swipe log on the server, score from replayed correct/wrong/total values, and update the intro, live counters, summaries, and reveal to the requested wording.

### Intruder Detection
- Generate five boards at 4×4, 5×5, 5×5, 6×6, and 6×6 with one, one, two, two, and two changed cells.
- Store every changed cell privately. Boards 4–5 will also store a seeded half-cell display offset so the second view is visually shifted while taps still map to the correct logical cells.
- Give boards 1–2 the 5 s / 1 s / 3 s sequence and boards 3–5 the 7 s / 1 s / 5 s sequence, with one or two taps as appropriate and a 65-second round limit.
- Grade each board as fully correct, partly correct, or missed; apply the requested base points and clean-sweep time bonus. Make the five before/after reveal pairs vertically scrollable.

### Count Up
- Replace the regular grid with three stored dense scenes containing 50, 80, and 110 overlapping shapes across the available play area.
- Add hexagons, varied 28–64 px sizes, rotations, depth order, and overlap-aware placement. The generator will reject scenes where a counted target has less than 50% visible area.
- Keep colour-and-shape questions, force answers into 6–14, retain the compact keypad and existing three-stage scoring, and change the shared total timer to 45 seconds.
- Keep the scene and private counts together so server grading derives the trusted count from the stored scene rather than accepting a device-provided count.

### Rotating Rings
- Measure the available play area and size the outer ring to the smaller of the width allowance and the height remaining after the 28 px legend, 52 px controls, and required gaps.
- Replace the multi-line legend with one compact icon row above the rings.
- Put Undo, Reset, anticlockwise, and clockwise controls into one fixed 52 px row below the rings without changing ring replay or scoring.
- Add a static layout check for 375×667 and 390×700; no browser or device test will be run.

### Laser and Mirrors
- Extend the shared beam tracer to branch at 1–2 fixed splitters. Each branch will independently reflect, light gems, hit bombs, terminate at blocks/edges, and avoid infinite loops.
- Store two directional gems with required entry directions and render their arrows. A gem will light only when a branch enters from its required side.
- Update the generator so the stored nine-mirror solution lights all six gems, at least one gem is reachable only through a split branch, and every placed mirror remains necessary under the splitter-aware search.
- Update beam animation/rendering for multiple branches, occupied-cell placement rules, help copy, reveal data, and the existing three-shot server verification. Scoring remains unchanged.

## Verification
- Add Colour Clash to the shared arcade self-replay suite and run 200 seeded phone/server identity replays for that game.
- Update and run focused generator checks for Intruder Detection, Count Up, Rotating Rings, and Laser and Mirrors, including changed-cell counts, shifted-board mapping, target visibility/count accuracy, short-screen geometry, splitter necessity, directional-gem entry, and nine-mirror necessity.
- Run the TypeScript check and inspect the latest preview build diagnostics.
- Do not run browser tests, per request; on-screen feel and device rendering will remain for device testing.

## Technical notes
- Colour Clash will retain the `stroop` type key for room compatibility at the registry level, but its payload becomes seed-based and its definition opts into the arcade clock while remaining in Attention.
- Intruder answers will become per-board arrays rather than one cell, and boards will carry their own timing and display-offset metadata.
- Count Up scene items will carry size, rotation, and layer information instead of grid coordinates.
- Laser traces will represent multiple beam paths plus entry-aware lit gems; the same pure tracer will be used by rendering, grading, shortcut search, and generator proofs.
