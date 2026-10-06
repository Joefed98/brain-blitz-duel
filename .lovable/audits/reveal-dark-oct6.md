# Reveal markers and dark Wordsmith

## Drawing-path audit

All 26 registered engine reveal paths were reviewed. Hover's own renderer supplied the red crashed saucer and full-screen tint; it was not the shared finish/crash ring. Reveal-only draw variants now omit Hover's crash colours/tint, Cross's hit circle/tint, Junction's crash star/flash, Rally's crash ball colour/tint and Skyline's miss tint. Live games and recorded intro demos retain their original death art. Other reviewed paths contain player/death art rather than a separate crash-position marker; that art remains unchanged. Swerve is not registered in the shared reveal map. The shared gold finish ring remains unchanged.

## Wordsmith

The shared live/intro/reveal octagon now uses near-black wedges, thin light outlines, white letters, gold selected wedges with dark letters and the accent-coloured centre with a white letter. Font sizes doubled from 52/32px to 104/64px. Geometry, letter inputs, Clear/Enter, accepted-word slot, dropdown and scoring are unchanged.

## Non-browser verification

- Five affected reveal variants tested at 382px and 367px board widths (390px and 375px screens minus the existing 8px safety margin): crash indicators absent in reveal, present in live drawing, state immutable.
- Demo explicitly chooses live drawing; shared gold finish condition checked.
- 14 source/SSR geometry checks, 60 input/phase audits, 336 shared-surface checks and shared FX checks passed.
- 211 protected source fingerprints unchanged; only arcade architecture notes changed in the protected baseline.
- No browser tests, simulation identity proofs or generator/grader/scoring edits.

Actual text fit, native appearance and no-scroll at 390×700 and 375×667 await the user's device checks. Existing long Wordsmith reveal lists retain their internal scrolling.