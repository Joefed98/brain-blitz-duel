# Sports overhaul: sounds to generate in ElevenLabs

The Sports overhaul (phase 2, step 4) for Cue Ball, Curl Champ and Apex. Sports already has the strongest sound set in
the app (batch 6), and every existing file is kept. Each line below is one new or better sound for a moment the
overhaul adds or that today falls back to a library sound. Until a file arrives, the moment plays its current sound or
stays silent, as the slot's manifest entry says (`src/lib/fx/manifest.ts`).

For each line: generate it, trim it, level it as `docs/sound-cues/levels-nov-2026.md` describes, save it as
`public/sounds/<slot>.mp3`, and point the slot's manifest entry at it.

## Cue Ball (`pool`)

| Slot | Moment | ElevenLabs prompt |
|---|---|---|
| `pool.cueCrack` | The cue strikes the cue ball | A crisp, short pool cue tip striking a resin cue ball, one clean bright crack, close-miked, no room echo, 0.3 s. |
| `pool.jawRattle` | A ball rattles in a pocket's jaws and stays out | A pool ball rattling twice between the leather-lined jaws of a pocket and stopping on the lip, wood and rubber knocks, 0.6 s. |
| `pool.rackRoll` | A potted ball flies to the rack at the top | A resin pool ball rolling down a short wooden ball return and knocking softly into other balls at the end, 0.8 s. |
| `pool.blackUnlock` | Your seven are down: the black unlocks | A soft brass latch clicking open, then a single warm low chime, subtle, 0.7 s. |
| `pool.streakUp` | The "IN A ROW" count grows | A short rising two-note felt-mallet marimba flourish, warm and quiet, 0.4 s. |

## Curl Champ (`curling`)

CURLING_LINES

## Apex (`racing`)

| Slot | Moment | ElevenLabs prompt |
|---|---|---|
| `racing.sector` | A clean sector (today a library coin) | Short bright two-tone electronic timing beep, F1 pit-wall style, crisp, 0.3 s, no reverb. |
| `racing.kerb` | Running over a kerb (a better rumble) | Race car tyres drumming over red-and-white rumble strips at speed, rhythmic thud, seamless loop, 1 s. |
| `racing.scrape` | Scraping along a wall without stopping | Carbon race car sliding along a tyre barrier, gritty scrape with plastic thumps, 0.8 s. |
| `racing.grass` | Running onto grass or gravel (a better one) | Race car running onto gravel trap, tyres crunching stones and spraying grit, 1 s, fades. |
| `racing.chequer` | Crossing the line: the chequered flag | Crowd cheer swelling with a single air horn as a race car crosses the finish line, 2.5 s. |
| `racing.speedRush` | Speed lines above 200 km/h | Wind rushing past an open cockpit at high speed, airy whoosh, seamless loop, 1.5 s. |
