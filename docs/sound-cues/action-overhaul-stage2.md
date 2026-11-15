# Action overhaul: slots waiting for stage 2

Slots the Action overhaul (phase 2 step 4, 15 Nov 2026) registers now for effects that arrive with the shared effects
kit in stage 2. Nothing fires them yet; each moves to its game's section of `arcade-effects.md` when its effect is wired.
The sounds to generate for them are in `action-elevenlabs.md`.

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `ricochet.scrollTally` | Moon Climb (ricoRev 3): a taken scroll lands on the HUD's SCROLLS count | The scroll flies up into the count | none yet (silent until it has a file) | 0–3 | 400 ms |
| `ricochet.lanternSway` | Moon Climb (ricoRev 3): a sky lantern brightens and sways as the ninja grabs it | The lantern flares and swings under the ninja's hands | none yet (silent until it has a file) | 0–6 | 500 ms |
| `flip.nearMiss` | The runner passes a spike within a few pixels (stage 2) | A white glint on the spike | none yet (silent until it has a file) | 0–10 | 250 ms |
| `flip.sweetGold` | A sweet-spot landing's gold dust puff (stage 2; the chime stays `flip.sweetLanding`) | A gold puff at the landing spot | none yet (silent until it has a file) | 0–8 | 350 ms |
| `flip.flowCount` | The end card's flow best counting up (stage 2) | SURVIVED! with the flow best counting up | none yet (silent until it has a file) | 0–1 | 800 ms |
