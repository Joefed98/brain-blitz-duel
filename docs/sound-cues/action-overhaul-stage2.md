# Action overhaul: stage-2 sound slots (not fired yet)

Slots for the Action overhaul's stage-2 effects (the shared effects kit), named now so Joe's ElevenLabs files
(`docs/sound-cues/action-elevenlabs.md`) have their names. Nothing fires them yet; each is wired into the manifest and its
game's observer with stage 2.

| Cue | When | What you see | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `flip.nearMiss` | The runner passes a spike within a few pixels (stage 2) | A white glint on the spike | none yet (silent until it has a file) | 0–10 | 250 ms |
| `flip.sweetGold` | A sweet-spot landing's gold dust puff (stage 2; the chime stays `flip.sweetLanding`) | A gold puff at the landing spot | none yet (silent until it has a file) | 0–8 | 350 ms |
| `flip.flowCount` | The end card's flow best counting up (stage 2) | SURVIVED! with the flow best counting up | none yet (silent until it has a file) | 0–1 | 800 ms |
