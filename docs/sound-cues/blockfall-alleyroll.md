# Blockfall and Ringer (Alley Roll; 1 Nov 2026, Ringer 3 Nov 2026)

Both games play the existing library only: every moment in `gameSounds.ts` (`blockfallSounds`, `alleyRollSounds`) is a
slot with no file of its own yet (`url: null`), so it plays the shared sound named in `arcade.md`; replay moments use
`replay.moment.mp3`; the beds borrow Fission's Retro track and Swish's fairground track (`music.md`). Haptics fire only
at the main moments: three or four rows cleared at once, a 100 pocket, Ringer's gold cup, and the buzzer
(`arcadeFeedback`). Ringer's slots are exactly: `alleyroll.roll`, `alleyroll.rolling` (loop), `alleyroll.ramp`,
`alleyroll.ring`, `alleyroll.pocket`, `alleyroll.goldCup`, `alleyroll.gutter`, `alleyroll.streak` and `music_alleyroll`
(`alleyroll.fifty` and `alleyroll.rail` were removed with the redesign).

## Loops

| Cue | Game | When | Plays today | Per run | Length |
| --- | --- | --- | --- | --- | --- |
| `alleyroll.rolling` | Ringer | While a ball rolls up the lane (0.32) | `minigolf_roll_loop.mp3` (Crazy Golf's roll) | loop | loop |

## Slots that deserve their own recording (a later ElevenLabs batch)

- `blockfall.clear`, `blockfall.bigClear`: a glassy neon chime for a row, a rising four-note sweep for three or four.
- `blockfall.lock`: a soft glass tap; `blockfall.turn`: a tiny click.
- `blockfall.topOut`: a short descending neon buzz.
- `alleyroll.roll` and `alleyroll.rolling`: a wooden ball released and rumbling up a wooden lane.
- `alleyroll.ramp`: the hop off the ramp's lip.
- `alleyroll.ring`, `alleyroll.pocket`: a ball dropping into a raised cup (a hollow clunk), the pocket's jackpot ding
  with a ticket-counter rattle.
- `alleyroll.goldCup`: the gold cup's 150, a bright bell with a coin shower.
- `alleyroll.streak`: a short rising chime as the roll streak grows.
- `alleyroll.gutter`: a dull thunk into the return trough.
- `music_blockfall`, `music_alleyroll`: beds of their own (a cool synth loop; a warm funfair loop).
