# Blockfall and Alley Roll (1 Nov 2026)

Both games play the existing library only: every moment in `gameSounds.ts` (`blockfallSounds`, `alleyRollSounds`) is a
slot with no file of its own yet (`url: null`), so it plays the shared sound named in `arcade.md`; replay moments use
`replay.moment.mp3`; the beds borrow Fission's Retro track and Swish's fairground track (`music.md`). Haptics fire only
at the main moments: three or four rows cleared at once, a 100 pocket, and the buzzer (`arcadeFeedback`).

## Loops

| Cue | Game | When | Plays today | Per run | Length |
| --- | --- | --- | --- | --- | --- |
| `alleyroll.rolling` | Alley Roll | While a ball rolls up the lane (0.32) | `minigolf_roll_loop.mp3` (Crazy Golf's roll) | loop | loop |

## Slots that deserve their own recording (a later ElevenLabs batch)

- `blockfall.clear`, `blockfall.bigClear`: a glassy neon chime for a row, a rising four-note sweep for three or four.
- `blockfall.lock`: a soft glass tap; `blockfall.turn`: a tiny click.
- `blockfall.topOut`: a short descending neon buzz.
- `alleyroll.roll` and `alleyroll.rolling`: a wooden ball released and rumbling up a wooden lane.
- `alleyroll.ramp`: the hop off the ramp's lip.
- `alleyroll.ring`, `alleyroll.fifty`, `alleyroll.pocket`: a ball dropping into a ring cup (a hollow clunk), the 50's
  bell, the pocket's jackpot ding with a ticket-counter rattle.
- `alleyroll.gutter`: a dull thunk into the return trough.
- `music_blockfall`, `music_alleyroll`: beds of their own (a cool synth loop; a warm arcade-floor loop).
