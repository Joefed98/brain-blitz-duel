# Joe's iPhone 11 notes, eight arcade games (28 Oct 2026)

Look and sound only: no stamps, no scoring, play or sim changes; every revision draws the new look (older rounds
replay and score exactly as before, since nothing here is read by a sim, the server or a grader). Before/after
frames at 414 px (the iPhone 11 home-screen width, 2× pixels), drawn by the real renderers from skill-band bot runs
on the revisions rooms deal: `screenshots/arcade-notes-oct28/` (`bun scripts/shots/arcade-notes-oct28-shots.ts
--out=<dir> --tag=after`, and `--tag=before` in a main worktree with the file copied in).

1. **Hover** (`hover.renderer.ts`): only the gold stars in a barrier's gap are drawn 1.2× (8.4 px on the 7 px
   pickup, `STAR_DRAW_SCALE`); chain stars are back at their collection radius (`CHAIN_STAR_DRAW_SCALE` 1).
2. **Breaker** (`breaker.renderer.ts`, `arcadeFxGames.renderer.ts`): no gold combo text above the paddle: the HUD's
   "COMBO ×n · chain" / "n IN A ROW" line and the deep spec's "COMBO ×n" pop are gone. The chain still scores as
   before and its step still sounds (`breaker.powerUp` in gameSounds).
3. **Tempo** (sound): the note hit is a synthesised 8-bit pulse note, `beat.note8bit.mp3`, pitched lane by lane up a
   major pentatonic scale (C D E G A, `BEAT_LANE_RATES`; beatRev 9's fifth lane used to repeat the first lane's pitch).
   The recorded track is louder: manifest volume 0.8 → 1 and `BEAT_TRACK_BOOST` 1.6 (about +6 dB in all; the file
   peaks at -7.6 dBFS). `docs/sound-cues/batch5-chiptune.md`.
4. **Meteor** (`snake.renderer.ts`): the comet as in Joe's mockup: a glowing white-gold head (white core, gold rim,
   a soft gold glow) and round glowing segments that shrink (9 → 4 px), fade and darken towards the tip, with no
   line between them and no eyes. Each segment is a cached sprite in half-pixel squares, inside its 24 px cell
   (the bounds rule; the head's glow reaches 18 px, like the stars' glows). The tail's colours change every 5 stars
   (`cometTail`, `COMET_TAILS`): gold to ember (the mockup), ice blue, pink, violet, mint, then round again.
5. **Wavefront** (`wavefront.renderer.ts`): about 3 ships in 16 wear dark maroon, navy or dark red metal
   (`wavHullTint`, a hash of the ship's cell and the wave, so the same for every player); the rest stay silver, grey
   and black chrome. Bosses and the armoured ship unchanged.
6. **Orbit** (`orbit.renderer.ts`): each planet's atmosphere glow is full, slight (0.35) or none, about a third each
   (`orbitGlowStrength`, a hash of the planet's index and stored place: the same for everyone).
7. **Swish** (`binTossArt.renderer.ts`): no glow round the ball; it is a white baseball with two red stitched seams
   (it still spins), a thin dark edge line so it reads against the sunset, and a pale trail.
8. **Gemstone** (sound): a new energetic round bed, `music_matchup2.mp3` (150 BPM chiptune in A minor, 51.2 s
   loop, -20 LUFS like the library), synthesised by `bun scripts/chiptune-sounds.ts`; the Oct 7 Lovable-hosted
   track is no longer used.

Tile icons for Meteor and Swish re-exported (`bun scripts/shots/tile-scenes.ts snake bintoss`).

Checks changed with the look (each old-look assertion replaced by one as strict for the new look, none dropped
without a replacement): snake-renderer-check (head core, gold rim and halo, gold-to-ember segments, the tail
changing every 5 stars, no line between segments; the reduced-motion count of 2 × 2 squares is now 0, since the eyes
were the only two and are gone, and the death frame's limit is 32 instead of 34 for the same reason);
arcade-fx-check (Breaker's combo-pop bump removed with the event it bumped; "one bump per declared event" still
holds); sound-manifest-check (adds the louder Tempo track).
