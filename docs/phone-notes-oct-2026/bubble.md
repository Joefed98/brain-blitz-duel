# Coral Pop: Joe's phone notes (27 Oct 2026)

> "Make the symbols on the bubbles a little smaller; make the bomb/mine a bit stronger (bigger blast)."

## What changed

**New stamp `bubbleRev 10`** (`BUB_REV_BLAST` in `src/lib/arcade/bubble.ts`), dealt by rooms, practice, the daily
and challenges. It is bubbleRev 9 exactly (the deeper reef, queue, chests, bank shots, combos, burst credit, curves)
with one rule change:

- **The mine blasts two rings**: it clears every bubble within `BUB_V10_BOMB_RADIUS` = 2 hex steps of where it lands
  (up to 18 cells) instead of 1 (up to 6). Judgement call: on a hex grid the next step up is a whole ring; that is
  about three times the area at most, but the mine comes once in the first 60 shots (when the seed picks a mine
  rather than a torpedo), so the scores barely move (below). A chest the mine destroys still pays nothing.
- States carry `bombR: 2`, folded into the checkpoint checksum last; `bubBombRadius(state)` reads it. The queue is
  unchanged, so the mine comes at the same shot for every player. Older stamps keep `BUB_BOMB_RADIUS` = 1.
- Scored on bubbleRev 9's curves (`BUB_V8_BAND_CURVE`, the feature curve, the credit); no curve change.

**Display only, every revision** (`src/lib/arcade/bubble.renderer.ts`):

- The creatures inside the bubbles are drawn at 82 % of their old size (`BUB_CREATURE_FIT` 0.615, was 0.75 of the
  bubble's radius); the bubble (the collision circle) is unchanged. The specials (Joker, mine, torpedo) and chests
  keep their art. The game icon draws the same bubble art, so its creature is smaller too.
- The mine's blast ring reaches out over the second ring on bubbleRev 10 (3.6 rows, was 2.4).

Text: help (`instructions.ts`: "A mine clears every bubble within two rings of where it lands."). The intro demo stays
stopped until recorded on bubbleRev 10 (`introDemo.functions.ts`).

## Measurements (skill-band tool, tuning seeds 0–59, `--rev=now --levels=all`)

Before: main (bubbleRev 9), the coordinator's `before-all.json`. After: bubbleRev 10.

| Level | Before median | After median | Bubbles cleared (median) before → after | Zero-scoring played runs |
|---|---|---|---|---|
| Weak | 40.5 | 42 | 11.5 → 12 | 0 → 0 |
| Average | 72.5 | 75 | 22 → 24 | 0 → 0 |
| Good | 97 | 101 | 41 → 43.5 | 0 → 0 |
| Great | 124 | 124.5 | 61.5 → 63.5 | 0 → 0 |
| Near-perfect | 166.5 | 171.5 | 81.5 → 84.5 | 0 → 0 |
| Elite | 182.5 | 179 | 88 → 88 | 0 → 0 |
| Flawless | 188.5 | 187 | 92 → 95 | 0 → 0 |

Brilliant > great > good still holds; the good player's median moves +4. The elite dip is within seed noise (the
bubbles cleared are the same). Fresh seeds were not measured.

## Checks (run one at a time, non-browser)

| Check | Result |
|---|---|
| e6-check (old stamps replay; new section "Coral Pop bubbleRev 10": start identity, checksum, the mine clears two rings on a crafted reef, three bot runs through the server replay) | pass (2978) |
| bubble-rev4-check (wiring updated) | pass |
| arcade-tuning-f2-check (wiring updated) | pass |
| arcade-tuning-g2-check (wiring updated) | pass |
| arcade-batch2-check | pass |
| round-max-check, scoring-bands-check, arcade-score-bands-check, arcade-help-bands-check, intro-score-text-check | pass |
| reveal-score-check, arcade-self-replay-check, arcade-room-schedule-check, arcade-fx-check | pass |
| replay-check | fail, expected: no stored run on bubbleRev 10 in `scripts/fixtures/replay-runs.json` (coordinator) |
| practice-bests-check | fail, expected: `practiceStamps.data.ts` out of date (coordinator) |

Review frames: `bun scripts/shots/phone-notes-brk-bub-shots.ts [--out=<dir>]` (the reef's opening frame with the
smaller creatures, and a crafted five-row reef with the mine shot straight up, drawn mid-blast).
