# Sound cues: the Sports overhaul's effects (phase 2 step 4, stage 2)

The moments the overhaul's effects add to Cue Ball, Curl Champ and Apex, each with its manifest slot
(`src/lib/fx/manifest.ts`). Until Joe's recordings arrive (prompts in [sports-elevenlabs.md](sports-elevenlabs.md)), a slot
plays the stand-in named in its row, or nothing. The in-play sounds come from each game's observer in
`src/lib/fx/gameSounds.ts`; the power bar's notch and the end's count from the stage (`src/puzzles/<game>.tsx`).

## Curl Champ (`curling`)

The near-miss rule is `curlShortBy` in `src/lib/arcade/curlingFx.ts`: a stone in play that scored nothing but would have
scored had it come to rest 25 cm (`NEAR_MISS_CM`) nearer the button.

| Cue | Game | Trigger | File | Per round | Length |
|---|---|---|---|---|---|
| `curling.powerNotch` | Curl Champ | The power bar's marker clicks into place (curlRev 4: a tap or the end of a drag on the bar, each − / +), outside the gold HOUSE zone; the marker snaps (without its file: `tick`, 0.55) | none yet | 8–20 | 80 ms |
| `curling.powerNotchHouse` | Curl Champ | The same, with the marker in the gold HOUSE zone (without its file: `tick`, full and a third higher) | none yet | 4–16 | 150 ms |
| `curling.clack` | Curl Champ | Stone on stone, with a ring opening at the contact point (without its file: `curling.hit`, as before) | none yet | 0–15 | 300 ms |
| `curling.ooh` | Curl Champ | A red knocked out of the house, as it goes (a dashed red ring marks where it left; silent until its file, the applause still plays as the stone comes to rest) | none yet | 0–3 | 1200 ms |
| `curling.aw` | Curl Champ | A thrown stone comes to rest a near miss (a grey ring on it) | `sports_crowd_groan.mp3` (stand-in, 0.45) | 0–8 | 1995 ms |
| `curling.countTick` | Curl Champ | The end (curlRev 4): the house view zooms to the middle and each counting stone lights, one tick each, a step higher each time (without its file: `tick`, 0.7) | none yet | 0–8 | 100 ms |
