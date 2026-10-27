# High Rise: Joe's phone notes (27 Oct 2026)

> "Use the current every-10-blocks sound for a 'perfect' placement instead, and play the whoosh every 10 blocks.
> Scores feel slightly low: lift them a little."

## 1. Sounds (presentation only, no stamp)

| Moment | Before | After |
|---|---|---|
| A perfect drop (`skyline.perfect`, and `skyline.windPerfect` in a gust) | `skyline.perfectFit.mp3` (clunk and ping) | `skyline.floors.mp3`, the crane bell, ratchet and clank that was the every-10-floors sound (volume 0.8) |
| Every 10th floor (`skyline.floorsStreak`, via the shared success layer, momentCues.ts) | `skyline.floors.mp3`, plus `shared.celebrate.zap` on skylineRev 7 | the whoosh, `sky.gust.mp3`, alone (the zap no longer stacks on it) |

- Files: `src/lib/fx/manifest.ts` (three slots), `src/lib/fx/gameSounds.ts` (the rev-7 milestone zap removed),
  `docs/sound-cues/arcade.md`, `docs/sound-cues/arcade-effects.md`, the three rows of `cue-sheet.md` / `.csv` (lengths).
- `public/sounds/skyline.perfectFit.mp3` was no longer used by any slot, so it is deleted (sound-manifest-check fails on an
  unused audio file); it stays in git history if Joe wants it back.
- Judgement call: "the whoosh" is taken to be the wind gust recording (`sky.gust.mp3`), the only whoosh High Rise plays
  today. The gust itself keeps the same file. The zap (an electric crack) was dropped from the milestone so the whoosh is
  heard on its own; the gold-block chime and the multiplier-tier ding are unchanged.
- The replay cues (`skyline.perfect-drop`, `skyline.floors`) and the batch-4 docs (a historical record) are unchanged.

## 2. Scores: `skylineRev 8` (a gentler curve, same play)

`skylineRev 8` (`SKYLINE_REV_LIFT`, `skylineLiftGame` in `src/lib/arcade/skyline.ts`) plays exactly as skylineRev 7: the
same step, blocks, kinds, streak multiplier, milestones and `skylineV7Units`. Only the curve changes:
`SKYLINE_V8_BAND_CURVE`, the same unit knots `[0, 129, 203, 326, 613, 900, 1100]` with points
`[0, 78, 107, 127, 177, 192, 200]` (rev 7: `[0, 72, 99, 118, 168, 185, 200]`). Each knot below the top is about 7–8 %
higher; 200 still needs 1,100 units. The state carries `expandRev: 8` (folded into the checkpoint checksum exactly as rev 7's 7);
the renderer, sounds and help treat it as rev 7.

Wired: `arcade.server.ts` deals it; `liveBands.ts` (rev 8, its curve, so the "?" help's numbers follow); `grade.ts` stores
the rev-7 extras for rev 8 too; `skylineWorldHFor(8)` = 735; `roundMax.ts` comment; the puzzle module's intro example;
the intro demo guard now wants a skylineRev 8 demo (`introDemo.functions.ts`). Intro and help text need no change (no
rule or figure in them changed; the help's "good run" units come from the curve).

### Medians (skill-band bots, `--rev=now`, `--levels=all`)

Tuning seeds 0–59 (60 per level). Before = skylineRev 7 (matches the coordinator's main `before.json` for good–elite
exactly; weak and average are rev 7's curve on the same runs' units, which is the same play).

| Level | Before (rev 7) | After (rev 8) |
|---|---|---|
| Weak | 54 | 59 |
| Average | 72 | 78 |
| Good | 99 | 107 |
| Great | 116 | 125 |
| Near-perfect | 168 | 177 |
| Elite | 185 | 192 |
| Flawless | 200 | 200 |

Fresh seeds 10000–10099 (100 per level): weak 58 → 63, average 70 → 76, good 94 → 102, great 115 → 124, near 169 → 177,
elite 185 → 192, flawless 200 → 200. No played run scores 0 (0 of 60 / 0 of 100 at every level); levels stay ordered.

## Checks run

| Check | Result |
|---|---|
| e4-expansion-check (adds section 3b: rev 8 = rev 7's play on 40 seeds, scores never lower, knots ≤ +10 %, the 200 ceiling, rev 7's recorded runs rescored) | PASS |
| arcade-batch4-check | PASS |
| arcade-tuning-a-check (wiring: rooms deal skylineRev 8) | PASS |
| arcade-tuning-e-check (wiring: rooms deal skylineRev 8) | PASS |
| six-game-scoring-check (demo guard on skylineRev 8) | PASS |
| reveal-marker-check | PASS |
| scoring-targets-check | PASS |
| arcade-check | PASS |
| sound-manifest-check | PASS |

Common checks (both games, run once on the branch with both changes): round-max-check PASS, scoring-bands-check PASS,
arcade-score-bands-check PASS, arcade-help-bands-check PASS, intro-score-text-check PASS, reveal-score-check PASS,
arcade-self-replay-check PASS, arcade-room-schedule-check PASS, arcade-fx-check PASS, sound-manifest-check PASS,
intro-demo-check PASS, arcade-room-identity-check PASS, `tsc --noEmit` clean on the touched files.
Expected failures for the coordinator: replay-check (2 of 7294: "no stored run on the revision rooms stamp today" for
skylineRev 8 and sliceRev 10; `scripts/fixtures/replay-runs.json`) and practice-bests-check
(`practiceStamps.data.ts` out of date: `bun scripts/practice-stamps.ts`).
