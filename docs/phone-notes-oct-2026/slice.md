# Slice: Joe's phone notes (27 Oct 2026)

> "Onion and golden fruit 1.2× bigger; the onion becomes light green (about #CFEDE6, as in Claude's mockup)."

## 1. Bigger onions and golden fruit: `sliceRev 10`

A bigger target is a bigger hit circle, so this is a gameplay change on a new stamp. `sliceRev 10` (`SLICE_REV_BIG`,
`sliceBigGame` in `src/lib/arcade/slice.ts`) is sliceRev 9 exactly (the 430 × 805 board, the schedule, values, golden
fruit, tickets, dodges, bonus and `SLICE_V9_BAND_CURVE`) with `SLICE_V10_RADIUS = [26, 20, 17, 20, 12]`: the onion 17 px
(14 × 1.2 = 16.8, rounded to whole px) and the golden fruit 12 px (10 × 1.2). Bread, cabbage, meat, chillies and bottles
keep their sizes. The radii are written into the objects (frenzy batches included) after sliceRev 9's schedule is built,
so every seeded draw (places, times, kinds, tickets) is unchanged; the state adds `v10: 1`, folded into the checkpoint
checksum last. Every older stamp plays and scores as before (sliceRev 9 never carries `v10`).

The art follows: every food is drawn at its object's own `r` (`sliceRadius`), so the outer circle is still the exact
collision circle (bounds rule) and old rounds draw at their stored size.

Wired: `arcade.server.ts` deals it; `liveBands.ts` (rev 10, rev 9's curve); `sliceWorldHFor` / `sliceWorldWFor` and the
reveal renderer's height treat 10 like 9; `roundMax.ts` comment; the intro demo guard wants a sliceRev 10 demo. Help and
intro text unchanged: the onion (17 px) and golden fruit (12 px) are still smaller than the other foods, so "Small is
worth more" and "onions small, golden fruit tiny" stay true. Review shots: `scripts/shots/e5-shots.ts` now plays sliceRev 10.

## 2. The onion's colour (look only)

`K.onion` in `src/lib/arcade/slice.renderer.ts` is `#CFEDE6` (was `#EAF3D8`), on every revision: the whole skin, the
ticket icon, the particles and the game icon (all from `paintFood`). The green rib lines, the tip and the cut face are
unchanged. The kitchen art pilot has no bundled onion sprite, so the code art is what players see.

## Medians (skill-band bots, `--levels=all`, paired runs)

Before = sliceRev 9 (measured with the same bots on the same seeds; good–elite match the coordinator's main `before.json`
to within a point: 126 / 175 / 181 / 181). Median, then the paired mean difference.

| Level | Tuning 0–59: rev 9 → rev 10 | mean Δ | Fresh 10000–10099: rev 9 → rev 10 | mean Δ |
|---|---|---|---|---|
| Weak | 36.5 → 36 | +1.5 | 37 → 38.5 | +2.9 |
| Average | 71 → 70 | +0.1 | 68 → 70 | +2.4 |
| Good | 126 → 118.5 | −4.2 | 113.5 → 113.5 | +1.1 |
| Great | 174.5 → 174 | −3.1 | 174.5 → 174.5 | +3.4 |
| Near-perfect | 181 → 179 | −0.8 | 183 → 180 | −0.3 |
| Elite | 181 → 181 | −1.1 | 184 → 181.5 | −2.1 |
| Flawless | 184 → 182 | −0.7 | 182 → 180 | −2.0 |

No played run scores 0 on rev 10 (rev 9 had one weak zero on the tuning seeds). The differences are within the bots'
run-to-run noise (about as many runs go up as down at every level; the curve has a steep step between 643 and 704 units,
which makes the good level's median jumpy): the bots aim at centres, so a bigger circle rarely changes what they cut.
Human players, who miss by more, should gain a little on those two foods. Levels stay ordered (good < great < near ≤
elite). No curve change was made.

## Checks run

| Check | Result |
|---|---|
| expansion-e5-check (adds "Slice sliceRev 10": rev 9's schedule on 200 seeds but the radii, every food's rev-10 size, chillies and bottles unchanged, no input scores 0, bot runs on rev 10 replay through the server to their scores, 1–200; wiring: rooms deal sliceRev 10) | PASS |
| arcade-tuning-g2-check (wiring) | PASS |
| arcade-tuning-c-check (wiring) | PASS |
| arcade-tuning-f2-check (wiring) | PASS |
| slice-kitchen-check | PASS |
| arcade-slice-bubble-beat-check | PASS |
| arcade-batch1-check | PASS |
| arcade-correction-check | PASS |
| arcade-fixes-check | PASS |

Common checks (both games, run once on the branch with both changes): round-max-check PASS, scoring-bands-check PASS,
arcade-score-bands-check PASS, arcade-help-bands-check PASS, intro-score-text-check PASS, reveal-score-check PASS,
arcade-self-replay-check PASS, arcade-room-schedule-check PASS, arcade-fx-check PASS, sound-manifest-check PASS,
intro-demo-check PASS, arcade-room-identity-check PASS, `tsc --noEmit` clean on the touched files.
Expected failures for the coordinator: replay-check (2 of 7294: "no stored run on the revision rooms stamp today" for
skylineRev 8 and sliceRev 10; `scripts/fixtures/replay-runs.json`) and practice-bests-check
(`practiceStamps.data.ts` out of date: `bun scripts/practice-stamps.ts`).
