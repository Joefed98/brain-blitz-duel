# Wavefront: Joe's phone notes (wavRev 11)

27 Oct 2026. Gameplay and scoring change, new stamp **`wavRev 11`** (`WAV_REV_PHONE` in `src/lib/arcade/wavefront.ts`),
dealt by `generateWavefront` and practice's definition. Every older stamp (unstamped, 2–8, 10) plays and scores exactly
as before: the new rules are gated on the state's `r11` marker inside wavRev 10's `stepX`, and wavRev 10's recorded runs,
its 260 oracle runs and the 32-run legacy fixture replay unchanged (wavefront-expand-check).

## What changed

| Joe's note | wavRev 11 |
|---|---|
| Power-ups drop from destroyed enemy ships, not from the top | Every formation wave has **two carriers** (one SPREAD, one SHIELD) at slots drawn from the seed's own stream for that wave (`wavCarriers(seed, wave)`), so the same ship carries the same power-up for every player in a room. A carrier glows with a small diamond in its power-up's colour (green spread, cyan shield). Shot down (in the formation or mid-dive), it drops the power-up where it was; it falls at 4 px a tick and is caught as before. A carrier that rams the ship takes its power-up with it. Nothing falls from the top (`wavPlan`'s drops are not used). |
| Destroying the saucer drops the purple laser | A saucer shot down drops the laser (5 piercing shots) where it was hit. Saucers still fly every 15 s, their sides from the seeded plan. |
| The final boss only after the penultimate wave is destroyed | wavRev 10's "mothership by 78 s at the latest" is gone: the mothership flies in only once wave 5 is destroyed (after waves 1–3, the gunship, waves 4 and 5). |
| Remove the hit-streak multiplier | No streak, no ×2/×3, no streak points, no STREAK HUD. |
| Scores are very low: lift them clearly | A new base curve `WAV_V11_BAND_CURVE` (a steady rise in place of wavRev 10's flat 250–300 units = 53–67 points) and skill pay `WAV_R11_SKILL_PAY` on the skill points without the streak (2 a power-up, 3 a saucer, 8 a cannon, 2 an open-core hit, 2 a precision point). Base units, the kill bonus and the 200 cap are wavRev 10's. |
| Enemy ships slicker in silver, black and grey, no red dots; the boss black and silver | Display only, every revision: the three hulls keep their outlines and 28 px cells, now polished silver, steel grey or black chrome (the old colour picks the finish), dark glass canopies with a silver glint in place of the red eyes, cool white engine glints; the gunship graphite, the mothership black with silver edges and panel lines, its open core white and ice blue, its health bar silver. The intro still shows grey craft. |

Help ("?"), intro score line and the intro still's caption follow the new rules (`instructions.ts`, `introScore.ts`,
`src/puzzles/wavefront.tsx`). The intro demo stays stopped until one is recorded on wavRev 11
(`introDemo.functions.ts`). A power-up starting to fall plays the existing `wavefront.laserDrop` cue.

## Choices and assumptions

- **Carriers per wave:** two (one of each kind), so a run deals ten carried power-ups and five saucer lasers (wavRev 10
  dealt nine from the top). The laser comes only from saucers, as the note asks for the saucer's drop.
- **"Penultimate wave":** read as wave 5, the last formation before the mothership (the gunship after wave 3 stays).
- **The boss's arrival now depends on how fast the player clears the waves** (it did before too, up to the 78 s
  limit). What every player meets is the same: the same waves, carriers, gunship and mothership, and the cores open on
  the run clock. Weak players who never clear wave 5 no longer get a few seconds at the mothership; the lifted curve
  more than makes up for it.
- **Bursts** (the explosion rings) keep their colours; only the ships changed.
- **Saucer laser position:** clamped to 40–350 px across, like wavRev 10's planned drops, so it never falls off the edge.

## Medians by level (paired seeds, every score the server replay's)

`bun scripts/arcade-skill-bands.ts wavefront --rev=now --levels=all --seeds=60` (tuning seeds, n = 0–59) and
`--from=10000 --seeds=100` (fresh seeds; 100 rather than 200 because the machine was shared). Before = wavRev 10 on the
commit before this one, after = wavRev 11. Median (p10–p90).

| Level | Tuning before | Tuning after | Fresh before | Fresh after |
|---|---|---|---|---|
| Weak | 59 (46–89) | 78 (61–90) | 64 (45–85) | 80 (62–103) |
| Average | 75 (55–126) | 114 (88–164) | 76 (55–137) | 111 (82–159) |
| Good | 126 (84–160) | 158 (97–166) | 117 (71–151) | 158 (106–166) |
| Great | 137 (87–168) | 168 (111–179) | 144 (98–168) | 163 (126–175) |
| Near-perfect | 169 (135–187) | 183 (169–192) | 169 (134–187) | 180 (167–195) |
| Elite | 187 (151–198) | 188 (174–200) | 173 (142–197) | 185 (171–200) |
| Flawless | 187 (162–200) | 197 (184–200) | 187 (159–200) | 199 (183–200) |

The curves were fitted on 40 of the tuning seeds only (`bun scripts/wavefront-phone-bands.ts --from=0 --seeds=40`);
the fresh seeds were measured once on the final constants. Every level still rises weak → flawless; good gains about
30 points, weak and average 20–40; elite and flawless move little (they already sat near the top). No played run scored
0: the lowest after is 59 on the tuning seeds and 55 on the fresh ones (no run flagged).

## Checks

- **wavefront-phone-check** (new): dealing; 28 recorded wavRev 11 runs (`scripts/fixtures/wavefront-phone-runs.json.gz`,
  `bun scripts/wavefront-phone-bands.ts --record`) replay to their stored scores; on all 260 band seeds every wave has one
  SPREAD and one SHIELD carrier, never armour; idle, random, weak-bot and elite-bot logs see the same ships and carriers in
  every wave they reach, every falling power-up is a just-shot carrier's or saucer's, nothing falls from the top, and the
  mothership arrives only after the gunship and five waves; the rules on hand-built states; the scoring (lifted above
  wavRev 10's flat stretch, 200 at the top, 0 for no input).
- wavefront-expand-check keeps every wavRev 10 assertion (its room-identity logs now come from wavRev 10's own bots);
  the dealing lines in arcade-batch3, arcade-tuning-a, arcade-tuning-c and arcade-tuning-g1 checks follow the new stamp.
- `scripts/room-identity/wavefront.ts` plays wavRev 11 (wave 1's carriers and the saucers on the schedule).
- `scripts/fixtures/replay-runs.json`: one wavRev 11 run appended (replay-check's today's revision).

## Screenshots

`screenshots/phone-notes-oct-2026/wavefront/`: `before-*` from `scripts/shots/x200-wavefront-shots.ts` on the commit
before, `after-*` from `bun scripts/shots/wavefront-phone-shots.ts` (the 414 × 896 play box, real renderer).
