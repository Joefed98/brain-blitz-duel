# Flightpath: phone-test notes (27 Oct 2026)

Display only. No gameplay or scoring change, so **no new stamp**: rooms still deal `bullRev 8`, every stored round
replays and scores exactly as before, and the intro demo plays on.

## 1. "The dart lands exactly where it's drawn hitting"

**What was wrong (renderer, not the sim).** The sim scores a dart against *its own* board where that board is when
the dart lands: the landing point `hit.x − hit.tdx` on that dart's board centre and size (`bullseyeV8Shot`). The
scoring point is the dart's tip, and the flight animation ends exactly there, so at the instant of landing the
picture and the score agreed. The very next frame they didn't:

- The renderer picked the board to show from `arrowIndex`, which moves on as soon as the dart lands, so it swapped
  in the **next dart's board**: on `bullRev 8` another distance, height and size (on older revisions a slightly
  smaller board, and a drifting one in another place). The landed dart stayed at its old screen point, so it sat
  over whatever ring of the new board happened to be there, often a different ring, or off the board.
- On a drifting board (dart 4 on) the landed dart was drawn at its absolute world point while the board kept
  sliding, so even on the right board it drifted off the ring it scored.

**The fix** (`bullseyeView` in `src/lib/arcade/bullseye.renderer.ts`): after a dart lands its own board stays up for
`BULLSEYE_LAND_HOLD_MS` (700 ms, presentation clock; the score pop lasts 500 ms inside it), and the dart is drawn at
`hit.x − hit.tdx + dx(now)`, riding its board's drift. Then the next dart's board shows with no old dart on it. The
last dart's board stays for good. The aim line, the sway and the flight are unchanged (the aim line still predicts
the exact sim landing).

**Proof:** `scripts/flightpath-hit-check.ts` (~40 s, new, no browser). Every revision (unstamped to `bullRev 8`),
24 seeds, ten seeded throws each, all five `bullRev 8` distances, drifting and shuffled boards, every wind:

1. geometry on every tick of the hold (63,504 frames): the view shows the dart's own board and the drawn tip falls
   in the scored ring, and in the inner bull / dead-centre ring exactly when scored there;
2. pixels: the real `drawBullseye` frame (@napi-rs/canvas, 414 × 760 and 375 × 600) 600 ms after landing matches,
   just above the drawn tip, the scored dart's own board painted alone at its place (442 samples);
3. the hold ends: the next board shows with no old dart; the last dart's board is held.

With the old board choice put back (next dart's board, dart at its absolute point) the check fails 8,179 times on
2 seeds.

## 2. Look changes

- **Rings** (`flightpathPalette.renderer.ts`): the 9 and 8 are lighter golds stepping out from the gold 10
  (#F8CD66, #FBE2A4; were dark red and blue), the 2 and 1 lighter pinks stepping out from the pink 3 (#F1C6EA,
  #F9E3F5; were near-black and white). All ring numbers are dark ink. The dark ring edges still separate neighbouring
  rings wherever the shuffle (darts 7–10) puts them. Checkout borrowed this palette for its own dartboard; it now
  keeps the old colours inline, so Checkout's look is unchanged.
- **Dart** (`drawDart`): matte black with a thin light edge and the dart's colour as a stripe on black flights;
  a landed dart is drawn larger (0.6 of the resting size, was 0.45). The tip is still the scored point. The game
  icon (which uses `drawDart`) shows the black dart too. The landed score figure has a dark edge so it reads on the
  light rings.
- **Wind** (`drawWindFlag`): a small gold flag on a pole above the range, flying the way the wind blows, rippling
  harder the stronger it is, with the strength on it; no wind, a limp grey flag with 0. Static under reduced motion.
  It replaces the arrow, the "→ n" line and the canopy pennant.
- **Text:** the intro still shows the flag and a black dart; the "?" help's wind line now explains the flag. The
  score text is unchanged.

## Medians by level (skill-band tool, `--rev=now --levels=all`, `bullRev 8`)

Identical before and after (no sim or scoring change; the tool is deterministic). Median (10th–90th percentile).

| Seeds | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| Tuning 0–59, before | 56 (41–71) | 77 (60–100) | 103 (78–131) | 141 (111–165) | 172 (154–190) | 181 (162–200) | 200 |
| Tuning 0–59, after | 56 (41–71) | 77 (60–100) | 103 (78–131) | 141 (111–165) | 172 (154–190) | 181 (162–200) | 200 |
| Fresh 10000–10199, before | 57 (41–75) | 71 (55–100) | 106 (75–126) | 140 (116–167) | 170 (153–186) | 183 (167–200) | 200 |
| Fresh 10000–10199, after | 57 (41–75) | 71 (55–100) | 106 (75–126) | 140 (116–167) | 170 (153–186) | 183 (167–200) | 200 |

## Assumptions

- The offset Joe saw is the board swap / drift above: the sim's scoring point and the flight's end point already
  agreed (the tip, on the landing tick), so the fix is in the picture, not the score, and old rounds are untouched.
- The landed board is held 700 ms. A player who throws within that time throws at the next board as always (the sim
  never waits); the flight then shows the right board. Nobody aims that fast in practice, and the sim is unchanged.
- "Lighter pinks / golds" read as two light steps outward from each family's anchor colour; exact shades are a
  judgement call for Joe's phone test.
- The wind flag replaces the canopy pennant (two wind flags would be redundant).
