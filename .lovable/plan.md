# Shared puzzle polish

## Build
- Introduce one shared presentation layer for active non-engine puzzles, applied centrally to live play, recorded intro examples and reveals.
- Standardise dark cells, accent active states, lighter givens, existing red errors, gold selection, existing drag ghosts/drop feedback, puzzle actions, mono numbers and clue typography.
- Standardise player-drawn paths without changing their coordinates, meaningful colours or input handling.
- Preserve all board dimensions, controls, layouts, generators, grading and scoring.

## Safety and exceptions
- Preserve meaningful colour fills, Sudoku box boundaries and specialised objects such as rings, tubes and balance beams.
- Expand isolated small controls invisibly where safe. Dense grid cells cannot all have independent 44px targets without overlapping adjacent cells; report these rather than change input ownership.
- Do not add drag behaviour or error/drop feedback to games that do not already have it.

## Audit
- Audit all active non-engine games at 390×700 and 375×667 using source, server-rendered markup and geometry checks only; no browser tests.
- Produce a per-game report stating shared-style coverage, exceptions and any sizing risks. Actual rendered no-scroll behaviour and touch/audio appearance remain unverified until your device checks.
- Check protected gameplay fingerprints and existing presentation checks.

## Technical approach
- Use semantic CSS tokens and a central, layout-neutral puzzle presentation adapter; keep rules and event handlers untouched.
- Keep the audit repeatable in a project script and document the shared presentation boundary.