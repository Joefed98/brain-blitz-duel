# Action overhaul: slots waiting for stage 2

Slots the Action overhaul (phase 2 step 4, 15 Nov 2026) registers now for effects that arrive with the shared effects
kit in stage 2. Nothing fires them yet; each moves to its game's section of `arcade-effects.md` when its effect is wired.
The sounds to generate for them are in `action-elevenlabs.md`.

| Cue | Trigger | Looks like | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `swing.streakMeter` | Action overhaul (stage 2): each clean grab filling the streak meter | The streak meter's arc filling | none yet (silent until it has a file) | 0–60 | 120 ms |
| `swing.outOfReach` | Action overhaul (stage 2): a press with the nearest vine just out of reach | The vine glowing red for a beat | none yet (silent until it has a file) | 0–20 | 300 ms |
| `swing.pteroShadow` | Action overhaul (stage 2): the pterodactyl's shadow sweeping across before it appears | A shadow crossing the screen | none yet (silent until it has a file) | 0–1 | 1200 ms |
| `swing.stretchTally` | Action overhaul (stage 2): the end screen counting the stretches up | The stretch count ticking up | none yet (silent until it has a file) | 0–51 | 90 ms |
| `flip.nearMiss` | The runner passes a spike within a few pixels (stage 2) | A white glint on the spike | none yet (silent until it has a file) | 0–10 | 250 ms |
| `flip.sweetGold` | A sweet-spot landing's gold dust puff (stage 2; the chime stays `flip.sweetLanding`) | A gold puff at the landing spot | none yet (silent until it has a file) | 0–8 | 350 ms |
| `flip.flowCount` | The end card's flow best counting up (stage 2) | SURVIVED! with the flow best counting up | none yet (silent until it has a file) | 0–1 | 800 ms |
