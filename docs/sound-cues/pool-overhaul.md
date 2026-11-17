# Sound cues: Cue Ball, the Sports overhaul (stage 2)

The moments the overhaul's effects add to Cue Ball (`src/lib/fx/gameSounds.ts` `poolSounds`, read off the sim by
`src/lib/arcade/poolFx.ts`). Each slot is in the manifest with no file yet; Joe's prompts are in
[sports-elevenlabs.md](sports-elevenlabs.md). The jaw rattle, which falls back to a shared sound, is listed in
[arcade.md](arcade.md).

| Cue | Game | Trigger | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `pool.cueCrack` | Cue Ball | The cue strikes the cue ball (with its file it replaces the soft or hard strike) | `pool.cueSoft` / `pool.cueHard` | 5–20 | 300 ms |
| `pool.rackRoll` | Cue Ball | A potted ball of your set lands in the rack at the top | silent | 0–7 | 800 ms |
| `pool.blackUnlock` | Cue Ball | Your seven are down: the black unlocks | silent | 0–1 | 700 ms |
| `pool.streakUp` | Cue Ball | The "IN A ROW" count grows | silent | 0–6 | 400 ms |
