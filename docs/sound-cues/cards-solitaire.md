# Pyramid, Golf Solitaire and Muggins (1 Nov 2026)

Three Cards & Board games born on the arcade scoring standard. No recordings of their own yet: every slot points at an
existing card or tile recording (batch 6, `batch6-mapping.csv` lists each slot under its file). Undo and Reset play
Mahjong's sounds (`tick`, `shared.celebrate.zap`). The game-event cues (`sfx`) are in `arcade.md`; these are the
renderer effects (`effectCue`).

| Cue | Game | Moment | File | Per run | Length |
| --- | --- | --- | --- | --- | --- |
| `pyramid.shuffle` | Pyramid | The run starts | `cards_shuffle.mp3` | 1 | 1093 ms |
| `pyramid.select` | Pyramid | A card chosen as the first of a pair | `cards_pick.mp3` | 10–30 | 334 ms |
| `pyramid.turn` | Pyramid | The empty stock turns the waste back over (passes 2 and 3) | `cards_shuffle.mp3` | 0–2 | 1093 ms |
| `golfsol.shuffle` | Golf Solitaire | The run starts | `cards_shuffle.mp3` | 1 | 1093 ms |
| `muggins.shuffle` | Muggins | The run starts | `mahjong_shuffle.mp3` | 1 | 1043 ms |

## Wanted from ElevenLabs

Slots that deserve a sound of their own (each plays a borrowed file today):

- `muggins.place`: a domino laid on the line, a short wooden **clack** (today Mahjong's tile match).
- `muggins.score` / `muggins.big`: a scoring play, a bright tally tick and a bigger chime for 15 or 20 (today the poker
  hand stings).
- `muggins.draw`: a tile slid from the boneyard (today Mahjong's select click).
- `pyramid.pair`: two cards swept off the pyramid together (today Free Cell's card home).
- `golfsol.run`: a run of five landing (today Summit's peak sting).
