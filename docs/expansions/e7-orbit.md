# E7 · Orbit: world expansion (orbitRev 11, 25 Oct 2026)

Orbit's part of expansion session E7. Rooms and practice now deal **orbitRev 11**; every older revision replays
and scores exactly as before. Round maximum 200 (`ROUND_MAX.orbit`).

## What changed

- **More world.** The camera shows a 450 × 782 slice of space instead of 390 × 650 (about 40 % more area, the
  iPhone 11 home-screen box's own aspect, so the world fills the 414 × 720 arena). Usually one or two more
  planets are in view, and the course reads further ahead. The view rides in the state (`viewW`, `worldH`);
  the camera (`orbitCamera.ts`) frames the next planet 360 px from the bottom on rev 11.
- **Course.** Rev 11 keeps the proved 40-planet bank courses and black holes (rev 10's play). Rooms deal one of the
  371 bank courses that carry proved features (`src/lib/duel/orbitXpBank.server.ts`, built by
  `bun scripts/orbit-xp-bank.ts` with `scripts/orbit-xp-lib.ts`). Assumption: "more planets" means more planets in
  view, not a longer course. A longer course would need a new proved planet and hole bank, and would push the sun
  past the 90 s clock for most players.
- **Skill features.** They are drawn in the A4 Orbit style (sim geometry, same palette, glows skipped with reduced
  effects, still with reduced motion):
  - *Stardust trails*: 5 trails of 6 gold motes on a hop's best line. The rocket collects a mote it touches
    (10 px rocket plus 4 px mote).
  - *Slingshot moons* (gravity assist): 4 small moons, each with a dashed teal ring 44 px round it. A flight that
    passes through the ring and leaves it without touching the moon is flung on at 1.5× speed. Touching the moon
    (8 px body) is a crash.
  - *Asteroid fields*: 3 lines of rocks across a hop (6–7 px rocks, crash like belts, use the checkpoint), with a
    dotted gap line. Crossing the gap's line threads the field.
  - *Perfect orbits*: letting go during the first lap round a planet and landing (or entering a hole). A gold arc
    shows the rest of that first lap.
  - *Black holes* are unchanged.
- **Scoring.** The base is rev 10's score: the strict curve on planets reached (written out as
  `ORBIT_V11_BAND_CURVE`, the same knots), plus up to 10 for reaching the sun quickly; 150 at most. The bonus is
  1 per 2 motes (15), 4 per slingshot (16), 4 per field threaded (12) and 1 per 3 perfect orbits (7), so 50 at
  most. The total is capped at 200, and no input scores 0.
- **Proof.** Every bank entry stores a witness tap log that reaches the sun with every hole and feature taken and
  scores 200 through the server replay (orbit-rev11-check replays all 371). Each feature is placed on the
  witness release's own line and kept only if that release still lands and the hop keeps a 4-tick window.
- **Sounds** come from the existing set: a tick per mote, a zap per slingshot, a chime per threaded field and a
  ding per perfect orbit (`gameSounds.ts` orbitSounds). They follow mute and the Effects slider. No new files.
- **Texts.** The intro HOW lines are now "Tap to let go; the next orbit catches you." / "Grab stardust; sling
  through moon rings." / "Thread rock gaps; let go on the first lap." The checkpoint and black-hole lines moved
  to the help. SCORE: "Planets and the sun, plus stardust, slingshots, fields and perfect orbits: up to {max}."
  The help explains each feature and its points. The intro still is updated.
- **Intro demo: needs re-recording.** Only a demo recorded on orbitRev 11 plays (`introDemo.functions.ts`), so
  the intro shows its still until Joe records one.

## Tuning: old (orbitRev 10) vs new (orbitRev 11)

The skill-band bots (`bun scripts/arcade-skill-bands.ts orbit --rev=now --seeds=30`) ran on the same 30 room
seeds per level. The bot aims at features more often the better the level (25 / 50 / 75 / 90 %), only where a
near miss would still land, and better levels insist more on first-lap releases.

The new runs were measured before rooms switched to feature-bank courses only. 4 of the 30 seeds have no
features and were measured on rev 10, which slightly understates the new figures.

| Level | Old median | Old p90 (top 10 %) | Old best | New median | New p90 | New best |
|---|---|---|---|---|---|---|
| Average | 81 | 117 | 131 | 76 | 105 | 124 |
| Good | 100 | 117 | 131 | 101 | 130 | 135 |
| Great | 128 | 148 | 150 | 130 | 157 | 176 |
| Near-perfect | 139 | 150 | 150 | 177 | 190 | 191 |

The skill-band tool's own table gives the median and p10–p90 for each level:

| Level | Old | New |
|---|---|---|
| Average | 76 (0–106) | 70 (10–104) |
| Good | 100 (29–115) | 99 (38–129) |
| Great | 124 (96–148) | 126 (30–155) |
| Near-perfect | 139 (117–150) | 177 (141–187) |

Average, good and great land within about ±10 % of today. Only near-perfect feature play reaches 190+, and the
witness runs prove 200 on every course. The average level reaches about 3 fewer planets, because rocks are a new
hazard; feature points make most of that up.

## Checks (local)

| Check | Result |
|---|---|
| orbit-rev11-check (new) | pass |
| orbit-legacy-replay-check | pass |
| orbit-camera-check | pass |
| orbit-outside-belt-check | pass |
| orbit-checkpoint-check | pass |
| orbit-rev3-replay-check | pass |
| arcade-tuning-a-check | pass |
| arcade-tuning-f-check | pass |
| arcade-tuning-g3-check | pass |
| arcade-batch5-check | pass |
| arcade-self-replay-check (with the new `orbit/xp` entry) | pass |
| arcade-fx-check | pass |
| reveal-score-check | pass |
| arcade-chart-check | pass |
| scoring-bands-check | pass |
| scoring-targets-check | pass |
| arcade-score-bands-check | pass |
| arcade-help-bands-check | pass |
| intro-score-text-check | pass |
| intro-demo-check | pass |
| four-tuning-check | pass |
| signature-beat-check | pass |
| six-game-scoring-check | pass |
| sound-manifest-check | pass |
| arcade-play-check orbit | pass (frame 17.2 ms, baseline 17.1) |
| arcade-fill-check orbit | pass |
| arcade-lowend-check orbit | pass (4×: 49.7 fps, was 46.7) |
| bottom-clearance-check orbit | pass |
| demo-intro-check orbit | pass |
| first-paint-check orbit | fail (see below) |
| replay-check | fail (see below) |
| round-max-check | fail (see below) |
| practice-bests-check | fail (see below) |

The four failing checks:

- **first-paint-check orbit.** The main and room passes pass. The "standalone late" pass fails the same way for
  Tilt, which this change does not touch. The geometry hold only covers puzzle screens and arcade games are not in
  the check's lists, so this is pre-existing.
- **replay-check** passed with a rev-11 run in `scripts/fixtures/replay-runs.json`. That fixture was reverted at
  the parent's request: the parent re-runs `bun scripts/replay-fixtures.ts --add=orbit` after merging.
- **round-max-check** fails as expected: orbit is now 200 and the parent updates the check.
- **practice-bests-check** fails as expected: the stamp changed and the parent re-runs
  `bun scripts/practice-stamps.ts`.

## Shared files touched (Orbit lines only)

- `arcadeFxGames.renderer.ts` (orbit spec sizes)
- `gameSounds.ts` (orbitSounds)
- `revealRenderers.ts`, `replay/steppers.ts`, `grade.ts`, `types.ts` (pass `extras`)
- `instructions.ts`, `introScore.ts`, `introDemo.functions.ts`, `liveBands.ts`, `roundMax.ts`
- skill-band `games.ts` and the orbit bot
- `replay-server-table.ts`, `intro-demo-check.ts` (pass `extras`)
- `arcade-self-replay-check.ts` (appended `orbit/xp`)

## Shared requests

- `scripts/scoring-targets-revs.ts`: this branch adds `EXPANSION_REVS` (`orbit: [11, 10]`) and
  `expansionBaseOf()`. Please fold `orbit: 10` into the parent's `EXPANDED_FROM` and keep an equivalent of
  `expansionBaseOf`. These checks use it to map an expanded revision back to the one they pin:
  - arcade-tuning-a-check
  - arcade-tuning-f-check
  - arcade-tuning-g3-check
  - arcade-batch5-check

  arcade-tuning-g3-check also accepts the demo gate on `ORBIT_REV_XP`.
- `scoring-bands-check` / `scoring-targets-check` / `arcade-help-bands-check`: this branch made small edits
  (compare the curve by fingerprint for an expanded game, accept the expansion revision as dealt, "Up to {the
  game's max}"). Take the parent's versions where they already cover this.
- `arcade-batch5-check`: its Orbit intro test now reads `up to ${roundMaxFor("orbit")}`.
