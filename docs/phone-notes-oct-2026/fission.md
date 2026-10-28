# Fission: Joe's phone-test notes (`burstRev 9`)

27 Oct 2026. Gameplay change on a new stamp: rooms deal `burstRev 9` (`BURST_REV_CARRY`); every older stamp
(unstamped to `burstRev 8`) replays and scores exactly as before (expansion-e9-check, arcade-tuning-g1-check,
arcade-batch3-check, replay-check, arcade-self-replay-check, arcade-score-bands-check).

## What changed

`burstRev 8`'s arena, waves, lives, DOUBLE and FREEZE are kept. Four changes (`src/lib/arcade/burst.ts`,
"Phone-test notes"):

1. **Power-ups drop from atoms as they split.** At init the room seed marks carrier atoms (`burstScheduleV9`, a
   stream of its own): one in wave 1, two in each of waves 2–5 (the waves nearly every player meets), one in every
   later wave, picked among each wave's atoms that split (L, M and S; the smallest only pops). An atom is known by
   its wave, its place in the wave and its split path (`burstAtomId`), so the same atom carries the same power-up
   for every player and the server; nothing is rolled at the hit. The kinds take turns from a seeded start
   (DOUBLE, BURST, FREEZE). A carrier drops its icon where it splits; the icon falls as before and is caught by
   walking under it. Nothing falls from the top any more. Carrier atoms show their power-up small in the nucleus
   (display only, inside the disc).
2. **The golden atom bounces** like the other atoms: it appears at its seeded moment and spot (burstRev 8's
   windows, six a run), sets off to a seeded side and bounces with an S atom's bounce and speed in its own 9 px
   disc, walls, floor and ceiling. It is up for 5 s (was 4 s still; a moving target gets a second more), FREEZE
   stops it too, and it never costs a life. Any shot (beam, double beam or BURST shot) reaching it takes it: +6.
3. **BURST shots are back** as the third carried power-up: for 8 s each tap fires three short shots from head
   height, 16 ticks apart (burstRev 2's BURST). Catching DOUBLE or BURST ends the other one; a lost life ends both.
4. **Wave-clear time bonus in place of the clean-wave bonus.** The clean-wave (no-miss) bonus and its counter
   are gone, and so is burstRev 8's fast-wave bonus (3/2/1 within 5/8/12 s, which almost no wave earned: a
   wave takes 8–25 s). Each cleared wave pays up to **5**: the full 5 within its quick time (1 s plus 0.6 s for
   every atom the wave holds, its splits included, so a big wave gets longer), then one less every 2 s after it
   (`burstV9ClearPoints`). Capped at 25 a run. HUD: "CLEAR +n" top right, counting down; "CLEAR +n" pops on
   the clear.

Score: atoms hit less 5 a life lost (never below a quarter of the atoms hit) on `BURST_V9_BAND_CURVE`, 10 for
lasting the 90 s, golden atoms (+6, up to 36) and the wave-clear bonus (up to 25), at most 200. BURST shots and
the carried power-ups let the same players hit a few more atoms, so the curve's middle knots moved up by about the
units they gained (refitted so the good median holds).

Texts: the "?" help, the intro line ("quick wave clears add") and the reveal ("n quick waves · golden · bonus")
say the new rules. The intro demo stays stopped until one is recorded on `burstRev 9`
(`introDemo.functions.ts`). The shared effects layer counts quick waves where it counted clean waves.

## Choices and assumptions

- The clean-wave bonus and the fast-wave bonus are both replaced by the one wave-clear time bonus (the brief:
  "replace the clean-wave bonus with a wave-clear time bonus"; burstRev 8's fast-wave tiers were too short to earn).
  Worth 5 a wave, 25 at most: about what clean waves plus fast waves paid before (good 13, elite 19 a run).
- BURST is timed (8 s, like DOUBLE) rather than lasting until a life is lost as on burstRev 2, so one early
  catch can't carry a whole run.
- The golden atom is a prize, not a hazard: it passes through the ship. It lives 5 s now that it moves.
- How many power-ups a player meets depends on how far they get, like the atoms themselves; what each atom
  carries never depends on the player.

## Medians by level, before (`burstRev 8`) and after (`burstRev 9`)

`bun scripts/arcade-skill-bands.ts burst --rev=now --levels=all --seeds=60 --jobs=1` (tuning seeds, n = 0–59) and
`--from=10000 --seeds=200` (fresh seeds), the fixed bots, every level on the same seeds, the server replay's
score. Median (10th–90th percentile).

| Seeds | Rev | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|---|
| Tuning (60) | 8 | 20 (7–52) | 88 (30–133) | 136 (53–162) | 163 (118–175) | 172 (152–186) | 177 (160–190) | 177 (157–194) |
| Tuning (60) | 9 | 25 (10–49) | 77 (16–124) | 139 (70–170) | 161 (123–179) | 176 (151–192) | 182 (152–197) | 186 (164–195) |
| Fresh (200) | 8 | 22 (10–55) | 85 (35–125) | 142 (75–164) | 160 (138–176) | 171 (152–186) | 179 (161–191) | – |
| Fresh (200) | 9 | 23 (8–55) | 81 (37–119) | 141 (82–168) | 165 (112–185) | 171 (148–190) | 181 (158–196) | 185 (168–199) |

Good → great → elite rise on both seed sets; the good median holds (136 → 139, 142 → 141); no played run scores 0
(weak and average included, 1,844 runs).

## Checks

fission-carry-check (new, ~1 min): rooms deal burstRev 9; a weak bot, an elite bot and random input on 8 seeds
start from the same state with the seed's own carriers and golden atoms, which never change; every icon that
appears drops on the tick and at the spot a carrier of that kind split, each carrier at most once, nothing else
drops; the golden atom moves, bounces, stays in the arena, freezes, never costs a life and pays +6; BURST's three
short shots, its 8 s and DOUBLE ending it; the wave-clear bonus; doing nothing scores 0, every run that hits
scores, the server replay agrees, weak < good < great < elite.
