# Arcade display and wording fixes: before and after (13 Oct 2026)

Before = `main` at 0e58fcc, after = this branch. Captured with Playwright on the pre-installed Chromium at device scale 1, at 375x667 and 390x844, from a local `vite dev` per tree.

- **Reveals** (`reveal-*`): AnswerReveal fed with the stored fixture runs (`scripts/fixtures/replay-runs.json`) graded by `gradeSubmission`, so the score, lines and tiles are the stored breakdown; a four-player track. A temporary dev page (not committed) rendered them.
- **Intro demos** (`intro-demo-*`): IntroDemo on the same puzzles. Supabase is unreachable from the container, so the demo shows the app's fallback (the start frame).
- **Play and intros** (`play-*`, `arena-no-fill-*`, `intro-score*`): `/practice`, the RoundIntro about 2.5 s in, then about 2 s after Ready.
- **Wavefront** (`wavefront-saucer-text.png`): the real renderer through the shared effects layer on a Node canvas, a saucer hit at the left edge (top) and right edge (bottom); before left, after right.

Measured at both sizes for all 21 active arcade games, Junction, Letterfall, Tenfall, Mixed Signals, Bonk and Pull!: before, 13 games wrapped a tile label at 375x667 (Jaywalk's "Crossings completed", Slice's "Ketchup / mustard" on three lines…); after, every reveal label is 12 px or larger, on one line, unclipped, and no reveal overflows.
