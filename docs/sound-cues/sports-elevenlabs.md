# Sports overhaul: sounds to generate in ElevenLabs

The Sports overhaul (phase 2, step 4) for Cue Ball, Curl Champ and Apex. Sports already has the strongest sound set in
the app (batch 6), and every existing file is kept. Each line below is one new or better sound for a moment the
overhaul adds or that today falls back to a library sound. Until a file arrives, the moment plays its current sound or
stays silent, as the slot's manifest entry says (`src/lib/fx/manifest.ts`).

The moment comes first in each table and the slot second (so the cue sheet, which reads tables whose first column is a
slot, doesn't count these slots twice). For each line: generate it, trim it, level it as `docs/sound-cues/levels-nov-2026.md` describes, save it as
`public/sounds/<slot>.mp3`, and point the slot's manifest entry at it.

## Cue Ball (`pool`)

| Moment | Slot | ElevenLabs prompt |
|---|---|---|
| The cue strikes the cue ball | `pool.cueCrack` | A crisp, short pool cue tip striking a resin cue ball, one clean bright crack, close-miked, no room echo, 0.3 s. |
| A ball rattles in a pocket's jaws and stays out | `pool.jawRattle` | A pool ball rattling twice between the leather-lined jaws of a pocket and stopping on the lip, wood and rubber knocks, 0.6 s. |
| A potted ball flies to the rack at the top | `pool.rackRoll` | A resin pool ball rolling down a short wooden ball return and knocking softly into other balls at the end, 0.8 s. |
| Your seven are down: the black unlocks | `pool.blackUnlock` | A soft brass latch clicking open, then a single warm low chime, subtle, 0.7 s. |
| The "IN A ROW" count grows | `pool.streakUp` | A short rising two-note felt-mallet marimba flourish, warm and quiet, 0.4 s. |

## Curl Champ (`curling`)

| Moment | Slot | ElevenLabs prompt |
|---|---|---|
| The power marker clicks into place | `curling.powerNotch` | A short, crisp mechanical notch click, like a dial locking into a detent, dry, 80 ms. |
| The marker set inside the gold HOUSE zone | `curling.powerNotchHouse` | The same detent click, slightly brighter and louder, with a tiny soft chime tail, 150 ms. |
| Stone on stone | `curling.clack` | Two heavy polished granite curling stones colliding on ice, a sharp hollow clack with a short ringing body, close mic, 300 ms. |
| A takeout: the red slides off | `curling.ooh` | An indoor arena crowd's rising impressed "oooh" as a stone is knocked away, a few hundred people, 1.2 s. |
| A stone stops just outside counting | `curling.aw` | A small indoor crowd's soft sympathetic "aww", gentle and brief, 0.9 s. |
| The end of the run: counting stones light one by one | `curling.countTick` | A light, warm wooden tick with a faint bell overtone, 100 ms. |

## Apex (`racing`)

| Moment | Slot | ElevenLabs prompt |
|---|---|---|
| A clean sector (today a library coin) | `racing.sector` | Short bright two-tone electronic timing beep, F1 pit-wall style, crisp, 0.3 s, no reverb. |
| Running over a kerb (a better rumble) | `racing.kerb` | Race car tyres drumming over red-and-white rumble strips at speed, rhythmic thud, seamless loop, 1 s. |
| Scraping along a wall without stopping | `racing.scrape` | Carbon race car sliding along a tyre barrier, gritty scrape with plastic thumps, 0.8 s. |
| Running onto grass or gravel (a better one) | `racing.grass` | Race car running onto gravel trap, tyres crunching stones and spraying grit, 1 s, fades. |
| Crossing the line: the chequered flag | `racing.chequer` | Crowd cheer swelling with a single air horn as a race car crosses the finish line, 2.5 s. |
| Speed lines above 200 km/h | `racing.speedRush` | Wind rushing past an open cockpit at high speed, airy whoosh, seamless loop, 1.5 s. |
