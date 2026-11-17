# Strategy overhaul: sounds for Joe to generate (ElevenLabs)

The Strategy overhaul (phase 2, step 4, 15 Nov 2026) asks for real recordings on the most-heard moments of Tilt,
Gemstone, Coral Pop, Rainbow Bridge and Ball Tracker. This list covers **every action that needs a new or better
sound**. Each numbered line is one prompt for ElevenLabs' sound-effects generator; the slot is where the file goes
(`public/sounds/<slot>.mp3`, then the slot's `url` in `src/lib/fx/manifest.ts`, as in `docs/sound-cues/README.md`).
Length is the target after trimming. Keep each one dry (no reverb tail), mono, original (no recognisable product or
game sound).

**Checked first and kept** (already recorded, good): Gemstone's swap, refuse, pick, hint glint, line of five, jackpot
and par smashed; Coral Pop's mine, torpedo, joker, rush, stick and descent; Rainbow Bridge's cloud bounce, release, coin
landing and roll, live-level warning and ink out; Ball Tracker's home streak, shuffle and countdown; Tilt's gold star.
The slots below either have **no file** today (`url: null`, so they fall back to a generic library sound) or are new.

## Most-heard moments (no file today: highest priority)

| # | Slot | Length | Prompt |
|---|---|---|---|
| 1 | `tilt.roll` (loop) | 3 s loop | A glass marble rolling steadily on a polished lacquered wooden board, soft continuous low rumble, seamless loop, no clicks |
| 2 | `tilt.knock` | 0.1 s | A single glass marble tapping a small brass-capped wooden wall, short soft knock, bright but gentle |
| 3 | `tilt.cup` | 0.4 s | A glass marble spiralling into a small enamel cup and settling with a clear high clink, satisfying, short |
| 4 | `tilt.mazeDone` | 0.6 s | A wooden disc puzzle finished: a soft wooden spin-whoosh ending in a warm two-note chime, light and premium |
| 5 | `tilt.gate` | 0.3 s | A tiny brass latch clicking open and a small wooden gate swinging, crisp mechanical click then a soft creak |
| 6 | `tilt.caught` | 0.3 s | A marble dropping into a small dark hole, a hollow wooden thunk with a short descending tone |
| 7 | `bubble.load` | 0.2 s | A soft underwater bubble being loaded into a launcher, gentle glossy plop with a hint of water |
| 8 | `bubble.pop` | 0.12 s | A single glossy bubble popping underwater, crisp light pop, cute but not cartoonish (played up to 8 times in a row, pitch raised each step) |
| 9 | `bubble.waves` (loop) | 6 s loop | Calm sunlit shallow sea ambience from just under the surface, soft gentle water movement, very quiet, seamless loop |
| 10 | `inkbridge.draw` | 0.9 s | A soft rising magical shimmer like a rainbow being painted in the air, airy glissando of light bells, gentle |
| 11 | `inkbridge.pot` | 1.0 s | A gold coin dropping into a cast-iron pot of gold, a bright jingle of coins and a short happy sparkle |
| 12 | `inkbridge.bump` | 0.2 s | A small coin bouncing off a soft feathered bird, light thud with a tiny flutter |
| 13 | `balltrack.roll` (loop) | 3 s loop | Several small glass marbles rolling along a smooth wooden channel, warm continuous rumble, seamless loop |
| 14 | `balltrack.marbleHome` | 0.3 s | A glass marble dropping into a small enamel cup with a clear bell-like ding (pitched per colour in the app) |
| 15 | `balltrack.wrong` | 0.3 s | A marble bouncing out of the wrong cup, a dull wooden clack followed by a soft low buzz |
| 16 | `balltrack.switch` | 0.12 s | A brass tube on a wooden track turning a quarter turn, quick ratchet click, crisp and mechanical |

## New actions from the overhaul (no slot sound yet)

| # | Slot | Length | Prompt |
|---|---|---|---|
| 17 | `tilt.rimTick` | 0.05 s | A single fine tick of a turning brass dial, very short and quiet (repeats as the disc turns) |
| 18 | `tilt.pitWobble` | 0.4 s | A glass marble teetering on the lip of a small hole, a quick wobbling rattle that settles |
| 19 | `tilt.discSwap` | 0.8 s | A wooden disc spinning away and a new one dropping onto a felt table, whoosh then a soft wooden thump |
| 20 | `matchup.shatter` | 0.3 s | A small faceted gemstone shattering into glittering shards, bright crystalline crack, short, no harshness |
| 21 | `matchup.goalSpark` | 0.2 s | A tiny magical spark flying to a goal bar and landing, soft rising twinkle |
| 22 | `matchup.iceCrack` | 0.3 s | A thin sheet of ice cracking under a tap, first a light crack (two-hit ice: crack, then break) |
| 23 | `matchup.chestGlint` | 0.4 s | A small gold-banded treasure chest glinting, a soft sparkle shimmer, quiet |
| 24 | `matchup.chestHome` | 0.7 s | A treasure chest landing on the bottom of a board and a few gold coins tumbling out, warm jingle |
| 25 | `matchup.goalTick` | 0.25 s | A soft confirming tick-chime for each goal ticked off at the end of a round, clean and light |
| 26 | `bubble.wallBlip` | 0.08 s | A bubble glancing off a smooth glass wall underwater, a soft short blip |
| 27 | `bubble.fallSplash` | 0.4 s | A cluster of small bubbles wobbling down and splashing softly into sand on the seabed |
| 28 | `bubble.chestOpen` | 0.7 s | A small wooden treasure chest falling and popping open underwater, creak then a sparkle |
| 29 | `bubble.thup` | 0.15 s | A bubble sticking to a reef without popping, a dull soft "thup" with a slight squash |
| 30 | `bubble.reefRumble` | 0.6 s | A whole coral reef shifting down a notch underwater, low muffled rumble |
| 31 | `bubble.warning` | 0.5 s | A gentle underwater warning pulse as danger gets close, two low soft beeps |
| 32 | `bubble.fastShot` | 0.3 s | A bubble fired fast from a launcher underwater, a quick pressurised whoosh |
| 33 | `inkbridge.coinWobble` | 0.3 s | A gold coin wobbling on its edge for a moment before falling, quick metallic wobble |
| 34 | `inkbridge.birdFlap` | 0.4 s | A small seabird flapping away in surprise, a short flutter of wings |
| 35 | `inkbridge.birdScatter` | 0.5 s | A small flock of birds scattering, several quick wing flaps |
| 36 | `inkbridge.missWhistle` | 0.8 s | A coin falling off a cliff, a descending cartoon-free whistle fading away |
| 37 | `inkbridge.parFlourish` | 0.5 s | A small extra flourish of rising bells for a level finished within ink par |
| 38 | `balltrack.booster` | 0.2 s | A marble speeding over a booster strip, quick rising whoosh with a light zip |
| 39 | `balltrack.cupPulse` | 0.4 s | Cups about to move: a soft warning pulse, two light wooden knocks |
| 40 | `balltrack.combo` | 0.2 s | A small counter stepping up, a short bright tick with a rising pitch |

**Count:** 16 most-heard slots without a file today, 24 new actions: 40 prompts in all. Until each file lands, the
16 most-heard moments play the library sound they play today. The 24 new actions are wired with their effects in the
overhaul's second stage (the effects kit, PR #422, once it is on main); each stays silent until its file lands.

## Wired in stage 2 (15 Nov 2026)

The new actions now fire their own slots from each game's sound observer (`src/lib/fx/gameSounds.ts`, Gemstone's from
its stage); each is silent until its file lands, except the ice crack, which plays today's crackle until then.
`bubble.thup` is not wired: the squash plays the kept stick recording (`bubble.stick`), so a second sound would double it.

| Cue | Game | Trigger | Plays today | Per round | Length |
|---|---|---|---|---|---|
| `tilt.rimTick` | Tilt | The disc's rim passes one of its 48 notches (at most one per 45 ms) | silent until recorded | 50–300 | 40 ms |
| `tilt.pitWobble` | Tilt | A marble arrives on a black hole's lip | silent until recorded | 0–15 | 250 ms |
| `tilt.discSwap` | Tilt | A maze is finished; it spins away as the next drops in | silent until recorded | 3–4 | 800 ms |
| `matchup.goalSpark` | Gemstone | A clear counts towards a colour goal (sparks fly to it) | silent until recorded | 20–60 | 300 ms |
| `matchup.iceCrack` | Gemstone | An ice cell cracks and shatters | `shared.celebrate.crackle2` (0.55) | 0–10 | 300 ms |
| `bubble.reefRumble` | Coral Pop | The reef shifts down a row | silent until recorded | 5–12 | 600 ms |
| `bubble.warning` | Coral Pop | The reef's lowest row comes within two rows of the line (at most every 1.5 s) | silent until recorded | 0–5 | 500 ms |
| `inkbridge.coinWobble` | Rainbow Bridge | The coin is released and wobbles | silent until recorded | 10–20 | 300 ms |
| `inkbridge.birdFlap` | Rainbow Bridge | The coin passes close to a flock | silent until recorded | 0–20 | 400 ms |
| `inkbridge.missWhistle` | Rainbow Bridge | The coin falls past the pot's rim (a miss) | silent until recorded | 0–10 | 900 ms |
| `balltrack.booster` | Ball Tracker | A marble rolls onto a booster | silent until recorded | 5–20 | 200 ms |
| `balltrack.combo` | Ball Tracker | The home-in-a-row combo steps up (a step higher each time) | silent until recorded | 0–30 | 300 ms |
| `balltrack.cupPulse` | Ball Tracker | One second before the cups move | silent until recorded | 2 | 400 ms |
