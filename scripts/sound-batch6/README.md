# Sound batch 6 tools (not checks, not app code)

How the batch-6 files in `public/sounds/` were made from Joe's raw uploads (branch `Joefed98-patch-1`, folder
`sound-uploads/`, not kept in the repo). Python 3 with numpy, and ffmpeg with libmp3lame, on the machine running them
only: neither is a project dependency.

    python3 -I scripts/sound-batch6/process.py <uploads dir> <out dir> <report.json>
    python3 -I scripts/sound-batch6/verify.py <out dir> <report.json> <verify.json>

`process.py` trims, loops, levels and encodes (the rules are in docs/sound-cues/batch6-sports-cards.md); `verify.py`
decodes each result and measures its lead silence, peak, loudness and, for loops, the join as `detectLoopPoints` in
`src/lib/sound.ts` loops it (no step at the join larger than the loop's 99.9th-percentile sample step, no level
change across it larger than the loop makes anywhere on a 5 ms grid). sound-batch6-check proves the committed files.
