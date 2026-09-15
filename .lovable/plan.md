# Replace Missing Letters and Number Span

## Scope
- Replace the existing Missing Letters registry slot with **Word Ladder** (`word`, 60 seconds, 8-second reveal).
- Replace the existing Number Span registry slot with **Number Climb** (`memory`, 45 seconds, 5-second reveal).
- Preserve every other puzzle and all shared room/practice screens.

## Word Ladder
- Add a server-only generator built on the existing cached dictionary and common-word list.
- Build a four-letter-word adjacency graph and use breadth-first search to choose everyday start/target pairs whose shortest path is 4–6 changes; store the shortest distance and one shortest path privately.
- Expose a narrow server check for proposed rungs so invalid words and invalid one-letter changes can be rejected without revealing solutions.
- Revalidate the complete submitted ladder server-side, calculate solved/partial scores, and store rungs used plus shortest length in round detail.
- Implement the vertical ladder, keyboard and A–Z input, invalid shake, Undo, automatic target lock, fixed intro, compact reveal, and standings summary.

## Number Climb
- Generate a stored 12-digit sequence satisfying the repetition, run, and unique-group constraints.
- Show it for exactly six seconds using the shared phase timestamp, then begin the 45-second play clock.
- Grade only the longest correct prefix server-side, apply full/partial scoring, and store the span in round detail.
- Implement grouped digits, six-second progress bar, numeric entry with Enter/button submission, fixed intro, coloured reveal, and standings summary.

## Security and verification
- Keep Word Ladder paths and Number Climb answers in private puzzle data until reveal; public room payloads contain only playable prompts.
- Verify generated ladders have the stored shortest distance, dictionary rejection and one-letter validation work, and target completion auto-locks.
- Verify Number Climb generation constraints, exact six-second display, deliberate fifth-digit mismatch scoring, and full-score behavior.
- Play both in `/practice` at 390×700 and confirm both play and reveal screens fit without page scrolling; confirm Groups remains live and old puzzle names are absent.
- Run type checks and confirm the automatic build succeeds.
