# Tune four word games

## Scope

- Update Wordsmith scoring to `min(150, floor(2.5 × word points))`, including the intro SCORE copy, the personal reveal, and shared round summaries.
- Remove only the in-game `(par …)` label from Word Slide; keep its moves counter, reveal, scoring, and par logic unchanged.
- Change Word Search to 20 points per found word, with a perfect six-word score of `120 + round(30 × time remaining / 90,000)`, capped at 150. Wrong drags will still shake but will not lower the score or appear as a penalty in results.
- Rename vague Word Search headings to specific labels that accurately describe their lists, then rebuild all 500 prechecked boards from the edited category source.
- Add tap-to-build input to Letter Wheel while preserving drag-to-submit. Tapped words will be confirmed with a Submit control or by tapping the displayed word, and both input methods will produce the same submitted word list.
- Regenerate all 300 Letter Wheel boards with at least three crossword words of 4+ letters and no more than three 3-letter crossword words.
- Change Letter Wheel scoring to 11 points per crossword word plus 2 per bonus word, with `round(50 × time remaining / time limit)` added only when the crossword is complete; cap the total at 150.

## Presentation and fit

- Enlarge Letter Wheel crossword cells toward 40 px at 375 px width while preserving the wheel’s usable size and no-scroll play area.
- Statically audit the complete active-round layout at 390×700 and 375×667. If the larger crossword cannot coexist with the current timer, give Letter Wheel a compact rectangular timer strip rather than reducing the wheel.
- Update Letter Wheel GOAL / HOW / SCORE copy and reveal details to match tapping and the new point rules.

## Validation

- Add or update focused scoring checks for Wordsmith, Word Search, and Letter Wheel boundary cases and caps.
- Re-run both bank generators and their structural checks, including the new Letter Wheel word-length distribution rules and the renamed Word Search categories.
- Run TypeScript validation and inspect the preview build diagnostics. Per request, do not run browser tests or open the game screens.

## Technical details

- Keep all grading authoritative on the server; clients continue to submit only selections or word lists, never scores.
- Keep generated banks server-only and update their source scripts before regenerating the derived bank files.
- Preserve existing live word validation, duplicate handling, shuffle behavior, practice availability, and room-category selection.
