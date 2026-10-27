# Pinball: Joe's phone notes (27 Oct 2026)

Joe's notes from the iPhone 11 home-screen app: make Pinball a 90-second game; make the purple and blue tunnels
subtler, slicker and more tunnel-like with squared-off entrances; bring the look closer to Claude's mockup (deep
violet table, lavender guides, teal and gold accents, J-O-U-L-Z lanes, ramps and the lock).

## What changed

### `pinRev 5`: the 90-second table (gameplay)

- Rooms and practice deal **`pinRev 5`** (`PIN_REV_LONG`, `generatePinball` in `src/lib/duel/arcade.server.ts`):
  pinRev 4's taller table and rules exactly, run for **90 s** (`PIN_V5_RUN_TICKS`, 5,400 ticks) instead of 60. Still
  three balls; draining the third still ends the run early.
- The state carries `rev5: 1`; the run length, the end of the run and the checkpoint checksum (the flag folded in
  last) read it. pinRev 4 states have no `rev5`, so pinRev 4's game, checksum and scores are untouched.
- The server's replay (`replayPinballRun`) takes the run length from the stored revision's game (`game.runTicks`), so
  a pinRev 4 log stops at 60 s and a pinRev 5 one at 90 s. Checkpoints decode up to 18.
- **Clock:** the definition's `timeLimitMs` is 93 s (90 s plus the 3 s slack), the Tempo `beatRev 9` precedent: the
  round clock and the arcade header show 90 s. A pinRev 1–4 round (none is dealt any more) ends its run at 60 s and its
  clock shows the rest unused, as Tempo's older rounds do.
- **Scoring:** `PIN_V5_BAND_CURVE` (table points, multiplier included, to 200), pinRev 4's shape with the units
  stretched for the extra 30 s: `[0, 27000, 47500, 80000, 104000, 140000, 266000] → [0, 69, 98, 122, 168, 182, 200]`.
  The bots make about 1.9× the table points in 90 s; the knots were fitted on room seeds 0–59 so every level's median
  stays where it was on pinRev 4, and checked once on 100 fresh seeds (10000–10099).
- **Texts:** the help says "Three balls, 90 seconds"; "Pink pop bumpers" became "Pop bumpers" (they are violet now).
  The help's band numbers read the new curve through `LIVE_BANDS`. The intro score line is unchanged (still "Up to 200").
- **Intro demo:** pinRev 5 plays pinRev 4 tick for tick, so a demo recorded on either plays (`introDemo.functions.ts`).

### The violet table (look only, no stamp; pinRev 4 and 5 draw it)

`src/lib/arcade/pinball4.renderer.ts`, `src/lib/arcade/arenaFills.renderer.ts`:

- Playfield `#2A0E3A` → `#1A0E2A` → `#130A20`, a violet glow; lavender guides (`#E0D0FF`, a thin lit line in a soft
  body exactly the capsule's width); bumpers with a lavender-to-violet skirt and a teal star (the skirt's outer edge is
  the collision radius, as before); the shooter lane floor violet.
- J-O-U-L-Z letters light teal (`#3FF0D2`), the skill-shot lane gold (`#FFD27A`); the multiplier, spinner, lock, LOCK
  label, jackpot and the plunger meter in the gold and teal accents; MULTIBALL in lavender.
- **Tunnels (the ramps):** a smoked-glass tube on each ramp's path with a fine lit edge each side (teal on the left
  ramp, lavender on the right, about half the old strength), faint hoops every 18 px and a soft sheen; butt ends and a
  **square portal** at each entrance (and at the right ramp's exit into the left orbit). They have no collision (a ball
  on the playfield passes under them), so nothing collides differently.
- The screen fill round the table (`pinball4Fill`, `pinball4Ambient`) starts from the table's dark bottom edge and runs
  into deep violet with lamps in teal, gold and lavender. pinRev 1–3's table and fill are unchanged.
- Screenshots: `screenshots/phone-notes-oct-2026/pinball-table-before.png` and `-after.png` (the world at the 414 px
  width, 2× pixels, the same state).

## Medians by level, before (pinRev 4) and after (pinRev 5)

`bun scripts/pinball-90-bands.ts --levels=all --seeds=60` and `--from=10000 --seeds=100`: the skill-band bots (the
Oct 2026 fixed bots, as `arcade-skill-bands.ts` plays them) play the 90-second table; each log replays through the
server as pinRev 5 (after) and, cut at 60 s, as pinRev 4 (before), so before and after are the same player on the same
seed. On the tuning seeds `arcade-skill-bands.ts pinball --rev=now --levels=all --seeds=60` gave 60 / 68 / 99 / 118 /
170 / 175 / 189 (its medians interpolate; 42 of its 420 runs differ by a few points from the cut 90 s runs, where the
bot's last-second play sees the longer run).

| Level | Tuning 0–59: before → after (p90 after) | Fresh 10000–10099: before → after (p90 after) |
|---|---|---|
| Weak | 60 → 60 (102) | 53 → 58 (95) |
| Average | 68 → 66 (111) | 78 → 76 (113) |
| Good | 97 → 97 (123) | 98 → 106 (162) |
| Great | 118 → 123 (168) | 118 → 124 (170) |
| Near-perfect | 170 → 169 (184) | 170 → 163 (183) |
| Elite | 174 → 174 (192) | 172 → 176 (187) |
| Flawless | 189 → 196 (200) | 188 → 188 (200) |

- Rises weak → flawless at every step on both seed sets (brilliant > great > good).
- No played run scores 0 (lowest: 7 tuning, 3 fresh, both weak runs that drained early).
- The good median moves 0 (tuning) and +8 (fresh).
- Most runs still have a ball at 60 s (weak 50 of 60, good 55 of 60; great and above all), so the longer run is
  played, not just waited out.

## Assumptions

- Three balls stay three: Joe asked only for 90 s. A weak run that drains its third ball before 60 s scores a little
  less than before (it made the same points against a longer run's curve), while the level's median is unchanged.
- The round clock follows Tempo's precedent (the definition's limit, not a per-puzzle one); older stored pinRev 1–4
  rounds' leaderboard time is measured on the 93 s clock, as Tempo's older rounds are on 78 s.
- Pinball has no seeded features (the table is fixed, the skill lane comes from the seed at init), so there is no
  room-identity script for it.

## Checks

`scripts/pinball-90-check.ts` (new, ~1 min): older stamps keep their game, 60 s and state; recorded pinRev 4 runs
replay unchanged; pinRev 5 plays pinRev 4 tick for tick to 60 s and on to 90 s; rooms deal pinRev 5 on a 93 s clock;
eight recorded pinRev 5 runs (`scripts/fixtures/pinball-90-runs.json.gz`, `--record`) replay through the server and the
replay stepper; the curve. `pinball-check` and `e4-expansion-check` now assert that rooms deal pinRev 5;
`arcade-self-replay-check` gains `pinball/90` (appended); `scripts/fixtures/replay-runs.json` gains a pinRev 5 run
(`bun scripts/replay-fixtures.ts --add=pinball`).
