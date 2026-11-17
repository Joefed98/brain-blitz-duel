# Sound cues: Home Run's innings and Top Bins' layered kicks (15 Nov 2026)

The Home Run and Top Bins overhaul (homerunRev 5, freekickRev 5) adds the moments below. Each slot is in
`src/lib/fx/manifest.ts` with `url: null` until Joe's recording is set, and the observers are in
`src/lib/fx/gameSounds.ts` (`inningsSound`, `layeredSound`). Moments that play through `sfx` sound a library stand-in
until the file arrives ([arcade.md](arcade.md) lists them); the ones below play their own file only (`effectCue` /
`loopCue`) and stay silent without it. Loops fade in over 500 ms and out when they stop or the run ends.

| Cue | Game | Trigger | File | Per round | Length |
|---|---|---|---|---|---|
| `homerun.umpStrike` | Home Run | homerunRev 5: strike one or two (swinging or looking): the umpire's call | none yet | 0–30 | 700 ms |
| `homerun.umpBall` | Home Run | homerunRev 5: a pitch outside the zone left alone (ball one to three) | none yet | 0–15 | 600 ms |
| `homerun.footsteps` | Home Run | homerunRev 5: a hit or fielder's choice, as the runners set off | none yet | 0–25 | 900 ms |
| `homerun.aimThunk` | Home Run | homerunRev 5: the swipe's aim line drops onto the field as the swing starts | none yet | 0–30 | 250 ms |
| `homerun.inningsEnd` | Home Run | homerunRev 5: the third out or the clock (the innings summary appears) | none yet | 1 | 2500 ms |
| `freekick.windFlag` | Top Bins | freekickRev 5: a loop under a kick being set when there is wind (louder with it) | none yet | 0–10 | 3000 ms loop |
| `freekick.bendWhistle` | Top Bins | freekickRev 5: a loop while the drawn stroke bends, its pitch rising with the bend | none yet | 0–10 | 1200 ms loop |
| `freekick.powerTone` | Top Bins | freekickRev 5: a loop while the power bar is held, its pitch rising with the bar | none yet | 0–10 | 1600 ms loop |
| `freekick.wallJump` | Top Bins | freekickRev 5: the wall jumps (its kicks only) | none yet | 0–6 | 500 ms |
| `freekick.dive` | Top Bins | freekickRev 5: the keeper sets off on his dive | none yet | 0–10 | 600 ms |
| `freekick.spill` | Top Bins | freekickRev 5: a save, the ball spilling from the keeper's hands | none yet | 0–10 | 500 ms |
| `freekick.chant` | Top Bins | freekickRev 5: the fifth goal in a row (the crowd chants) | none yet | 0–1 | 4000 ms |
| `freekick.hoopShrink` | Top Bins | freekickRev 5: the next kick's corner hoop appears, smaller | none yet | 0–4 | 600 ms |

## ElevenLabs one-liners (one recording a slot)

Joe records these in ElevenLabs Sound Effects; each line is the prompt. Effects mono, under the length shown; loops
seamless.

- `homerun.umpStrike`: "Baseball umpire's sharp shouted call 'Strike!', single voice, outdoor stadium, short, 0.7 seconds."
- `homerun.umpBall`: "Baseball umpire calling 'Ball' calmly, single voice, outdoor stadium, 0.6 seconds."
- `homerun.umpOut`: "Baseball umpire's emphatic 'You're out!' with a punch, outdoor stadium, 0.7 seconds."
- `homerun.strikeout`: "Umpire's dramatic 'Strike three!' call with a crowd's 'ooh' behind it, 1 second."
- `homerun.walk`: "Light ballpark organ two-note jingle for a walk, cheerful, 0.7 seconds."
- `homerun.footsteps`: "Baseball cleats sprinting on dirt base path, quick rhythmic steps, 0.9 seconds."
- `homerun.slide`: "Baseball player sliding feet-first into a base, dirt scrape and puff, 0.6 seconds."
- `homerun.runScores`: "Small crowd cheer swell as a run scores at a ballpark, short, 0.8 seconds."
- `homerun.perfect`: "Single bright marimba note, clean and short, 0.4 seconds." (played higher with each perfect swing)
- `homerun.aimThunk`: "Soft muted wooden thunk, like a marker set on a table, 0.25 seconds."
- `homerun.inningsEnd`: "Ballpark organ end-of-inning flourish with crowd applause fading, 2.5 seconds."
- `homerun.swing`: "Wooden baseball bat whoosh through the air, fast swing, no impact, 0.12 seconds."
- `freekick.windFlag`: "Corner flag rippling in steady wind at a stadium, seamless loop, 3 seconds."
- `freekick.bendWhistle`: "Soft airy rising whistle, like wind through a gap, gentle, seamless loop, 1.2 seconds."
- `freekick.powerTone`: "Smooth rising synth tone building tension, clean sine, seamless loop, 1.6 seconds."
- `freekick.goldTick`: "Tiny bright digital tick, crisp, 0.12 seconds."
- `freekick.dive`: "Goalkeeper diving full stretch, body thud on grass and a grunt, 0.6 seconds."
- `freekick.spill`: "Football spilling from a goalkeeper's gloves and bouncing on grass, 0.5 seconds."
- `freekick.wallJump`: "Several footballers jumping together in a defensive wall, boots leaving grass, 0.5 seconds."
- `freekick.chant`: "Football stadium crowd chanting rhythmically after a goal streak, four seconds."
- `freekick.hoopShrink`: "Short descending magical shimmer, tightening, 0.6 seconds."
