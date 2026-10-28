# Sound batch 5: 8-bit notes and a new Gemstone bed (28 Oct 2026)

Joe's iPhone 11 notes, presentation only (no stamps; the chart, judging, input log and score never read sound).
Both files are synthesised by `bun scripts/chiptune-sounds.ts` (deterministic: seeded noise, bit-exact ffmpeg
encode, 48 kHz stereo MP3 at 192 kb/s like the library) and levelled to the library.

- **beat.note8bit.mp3**, slot `beat.note` (was `beat.noteHit.mp3`, removed): one NES-style 25 % pulse note on C5,
  140 ms: a 2 ms attack, a 15 ms octave-up "ping", then a stepped 16-level decay. The observer pitches it per lane up
  the major pentatonic scale C D E G A (`BEAT_LANE_RATES` in `src/lib/fx/gameSounds.ts`: 0, 2, 4, 7, 9 semitones), so
  each lane is higher than the one to its left; beatRev 9's fifth lane has its own pitch (it used to repeat the first
  lane's). Peak matched to `beat.noteHit.mp3` (-2.4 dBFS), volume 0.8.
- **music_matchup2.mp3**, slot `music_matchup` (Gemstone's round bed; the Oct 7 Lovable-hosted track is no longer
  used): an energetic chiptune loop, 150 BPM, A minor, Am F C G, 32 bars (51.2 s). Four-on-the-floor kick, noise snare
  on 2 and 4, eighth hats (open off-beats after bar 8), triangle bass pumping root and octave, a 12.5 % pulse sixteenth
  arpeggio, and a 25 % pulse lead in bars 9–16 and (an octave up) 25–32; the last bar's tails are folded onto the start
  so the loop has no seam. -20 LUFS integrated (the music library's level), peak -9 dBFS.

Tempo's recorded track (`music_beat`) is also louder: its manifest volume goes 0.8 → 1 (+2 dB) and the tick-locked
player multiplies its gain by `BEAT_TRACK_BOOST` (1.6, about +4 dB) on top of the level ramp (0.9 → 1). The file peaks
at -7.6 dBFS, so at full volume it peaks under -1.5 dBFS. sound-manifest-check proves the volume and boost.
