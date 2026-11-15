# Crazy Golf: sounds to record (ElevenLabs)

The Crazy Golf overhaul (golfRev 3, 15 Nov 2026) adds moments that play library stand-ins until these are recorded.
Each line is the one-line description to give ElevenLabs' sound effects generator, then the slot it fills
(`src/lib/fx/manifest.ts`) and the stand-in it replaces. Keep each under its length; the levelling pipeline in
`docs/sound-cues/levels-nov-2026.md` trims and levels them on the way in.

| Slot | One-line description | Length | Stand-in today |
|---|---|---|---|
| `minigolf.putt` | A short, clean "tock" of a putter's face striking a golf ball on short grass, close-up, dry, no reverb. | 0.3 s | its existing recording |
| `minigolf.chip` | A crisp, bright "click" of a wedge clipping a golf ball cleanly off tight turf, a tiny whoosh after it. | 0.35 s | `pool_ball_click.mp3` |
| `minigolf.land` | A soft, muffled thump of a golf ball landing on a mown green and checking up, outdoors, quiet. | 0.25 s | `move.softFall.mp3` |
| `minigolf.rattle` | A golf ball rattling round the metal rim of a putting cup and spinning out, quick light clinks. | 0.4 s | `arc_marble_clink.mp3` |
| `minigolf.plip` | A small "plip" of a golf ball dropping into a garden pond, a single droplet splash, close. | 0.3 s | `arc_sea_pop.mp3` |
| `minigolf.sand` | A soft puff of a golf ball dropping into fine dry bunker sand, a gentle hiss of grains. | 0.3 s | `move.softFall.mp3` |
| `minigolf.flag` | A light flagstick being lifted out of a putting cup, a soft metallic slide and a cloth flutter. | 0.4 s | (silent) |
| `minigolf.confetti` | A short cheerful party-popper pop with fluttering paper confetti, playful, not loud. | 0.6 s | (silent; `minigolf.birdie` plays) |
| `minigolf.aim` | A clean sine "tick" for an aim meter, one note, very short, to be played rising in pitch. | 0.05 s | synthesised tone (`playTone`) |

The aim's rising tone is synthesised today (240–860 Hz, one step every twelfth of the pull); a recording would be
pitched by the same steps. The rail bounce (`minigolf.bounce`), boulder knock (`minigolf.stone`), roll loop
(`minigolf.roll`), splash (`minigolf.water`), cup drop (`minigolf.holed`) and birdie bell (`minigolf.birdie`) keep
their recordings.
