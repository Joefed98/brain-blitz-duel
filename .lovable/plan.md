# Replace Odd-Word-Out with Groups

## What will change
- Replace the existing Odd-Word-Out registry slot with Groups, keeping its word-category position.
- Add a curated bank of at least 80 unambiguous two-group puzzles, each with deliberate cross-theme red herrings, and shuffle each generated board once for synchronized play.
- Build the two-step selection flow: choose four, submit, lock correct groups into coloured bands, shake incorrect selections, allow shuffle of remaining tiles, and auto-submit after both groups are found.
- Add the fixed intro example and compact eight-second answer reveal.

## Security and scoring
- Keep group themes and memberships private until reveal.
- Re-check submitted group selections against the stored private partition on the server; never accept client-reported correctness.
- Score both groups with the standard 100-point base plus the 60-second speed bonus, one group at timeout for 50 points, otherwise zero.
- Add Groups-specific standings summaries and reveal labels.

## Verification
- Validate all bank entries for eight unique words, two groups of four, distinct themes, and explicit red-herring notes.
- Play Groups through `/practice` at 390px width, including a wrong submission, both correct submissions, auto-lock, reveal, and no scrolling.
- Confirm typecheck and the preview build remain clean.
