# Rainbow Bridge: phone notes (inkRev 11)

27 Oct 2026, from Joe's phone test (iPhone 11 home-screen app). Gameplay change on a new stamp: rooms deal
**inkRev 11** (`INK_REV_SPREAD`, `src/lib/arcade/inkBridge.ts`). Every older stamp (unstamped, inkRev 2–10) builds,
replays and scores exactly as before.

## What changed

| | inkRev 10 (before) | inkRev 11 (now) |
|---|---|---|
| Wind zones | 3 levels | **none** (those levels are plain) |
| Silver coins | 3 a level, 24 a run | **2 a level, 16 a run** (`INK_V11_SILVER_PER_LEVEL`) |
| Pickups from the easy route | ≥ 18 px | **≥ 30 px** (`INK_V11_PICKUP_OFF_ROUTE`) |
| Plain level's star from the easy route | ≥ 40 px | **≥ 52 px** (`INK_V11_STAR_OFF_ROUTE`) |
| Star, silver coins, shamrock apart | ≥ 24 px; the shamrock ≥ 40 px from the star | **≥ 52 px**; the shamrock **≥ 64 px** from the star |
| How the pickups are placed | silver at even steps along the bonus line | **farthest first**: each pickup at the point of the bonus line farthest from the route and from every pickup placed (the star included) |
| Skill pay | `INK_V10_SKILL_PAY`, 50 at raw 128 | `INK_V11_SKILL_PAY`: the same shape on the smaller raw maximum, 50 at raw 112 (`INK_V11_FEATURE_RAW_MAX`) |

Kept: the 390 × 674 world, gravity, ink, levels 9–10 (live, with their hand-drawn strokes), level 1 the warm-up,
4 bounce clouds with trick shots, 8 ink stars, one shamrock, the base curve (`INK_V10_BAND_CURVE`) and the speed
bonus, 200 at most. The cloud levels' stars stay at the top of the bounce (unchanged rule).

Measured on the four check seeds (32 levels): the nearest pickup to the easy route went from 44 px to 73 px on
average, and the nearest two pickups from 49 px to 80 px apart (ink-v11-check prints it).

**Room identity / the arcade rule.** Everything is still built at init from the seed (the same feature stream; with
no wind kinds, the cloud levels are the ones inkRev 10 picks). The counts never vary: 4 clouds, 8 stars, 16 silver,
1 shamrock on every seed. Every bonus line is proved as a phone draws it, taking every pickup on its stored release.

**The perfect-play ceiling is 200 on all 260 skill-band seeds** (`bun scripts/ink-x200-oracle.ts 0 260 11`:
lowest 200, none below).

## Text, demo

- Help (`instructions.ts`): the Wind line is gone; "2 silver coins spread out along a harder route, well away from
  the easy one"; the skill-pay line quotes `INK_V11_SKILL_PAY`. The intro text names no counts and is unchanged.
- The intro demo: only a demo recorded on inkRev 11 plays (`introDemo.functions.ts`); the still shows until one is.
- Art: no change. A wind zone is drawn only where a level has one, so inkRev 11 shows none.

## Before and after (skill-band bots with the fixes, paired seeds, the server's replay)

Before = inkRev 10, after = inkRev 11. Medians (p90).

Tuning seeds (n = 0–59). Before from `bun scripts/arcade-skill-bands.ts inkbridge --rev=now --levels=all --seeds=60`
on unmodified main; after from `bun scripts/ink-x200-bands.ts --from=0 --seeds=60 --revs=11` (the same bots and replay;
the flawless level is the oracle, 200 on every seed).

| Level | Before | After |
|---|---|---|
| Weak | 36 (56) | 36 (66) |
| Average | 47.5 (85) | 38 (74) |
| Good | 70 (108) | 72.5 (113) |
| Great | 112 (156) | 112.5 (163) |
| Near-perfect | 172 (184) | 174.5 (186) |
| Elite | 183 (200) | 183.5 (200) |
| Flawless | 200 | 200 |

Average's median sits on a level boundary (half its runs pot two levels, half three: 36 or 54); its mean is
48.4 → 46.1 and its mean levels 2.85 → 2.67. Means for the other levels: weak 37.5 → 39.9, good 69.1 → 69.8,
great 108.7 → 110.5, near 161.5 → 158.8, elite 175.0 → 176.6.

Fresh seeds (n = 10000–10049; cut from 200 to 50 for time on the shared machine), both revisions in one run of
`bun scripts/ink-x200-bands.ts --from=10000 --seeds=50 --revs=10,11`:

| Level | Before | After | Feature raw median before → after (of 128 → 112) |
|---|---|---|---|
| Weak | 36 (54) | 36 (54) | 0 → 0 |
| Average | 54 (85) | 54 (85) | 0 → 0 |
| Good | 66.5 (113) | 74 (128) | 3 → 4 |
| Great | 103.5 (155) | 105 (160) | 16 → 22 |
| Near-perfect | 164 (187) | 172.5 (186) | 80.5 → 72 |
| Elite | 187 (200) | 185 (200) | 115 → 98 |
| Flawless | 200 | 200 | 128 → 112 |

No run that plays scores 0 on either set (the lowest is 22, level 1). Every level's median rises weak → elite on
both sets, and the good-level median moves by 2–8 points: within the bots' level-boundary noise.

## Choices and assumptions

- "Fewer silver coins": two a level (from three). "Spread out more": further from the easy route and from each
  other, so a line that takes them all must swing wider; the pay curve is rescaled to the smaller raw maximum so the
  full 50 still means every bonus, and scores stay where they were (Joe asked for harder pickups, not lower scores).
- The bots plan their bonus lines from the level, so the top bots still take most pickups; the spread mostly shows
  in the lines a person has to draw.
- inkRev 10's wind code and art stay for stored rounds.

## Checks

ink-v11-check (new, ~40 s): rooms deal inkRev 11, older stamps replay unchanged, no wind, fixed and proved
features, the spread rules, the 200 ceiling on sample seeds, 14 recorded inkRev 11 runs
(`scripts/fixtures/ink-v11-runs.json.gz`, `bun scripts/ink-x200-record.ts 11`), the scoring and room identity.
ink-x200-check keeps proving inkRev 10 in full. arcade-self-replay-check gains an `ink/v11` entry (appended);
replay-check gains an inkRev 11 run (`bun scripts/replay-fixtures.ts --add=inkbridge`); room identity measures the
dealt stamp.
