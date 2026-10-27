# Joe's phone-test notes: eight arcade games (27 Oct 2026)

Joe's notes from the iPhone 11 home-screen app (414×896), applied to Breaker, Rally, Tempo, Meteor, High Rise, Coral
Pop, Slice and Swish. Each game's own file in this folder says what changed, the judgement calls and the checks it
ran; this page has the summary, the before/after medians and the screenshots.

## Summary

| Game | Stamp | Gameplay / scoring (new stamp only) | Look and sound (every revision, no stamp) |
|---|---|---|---|
| Breaker | brkRev 9 → 10 | Gold bricks break after any 4 hits; a second double-ball brick in rows 8–11 (seeded); curve refitted so the extra brick doesn't inflate scores | Power-up bricks show their effect (two balls, three rising balls, a laser beam; Fireball unchanged); no "+10" / "GOLD +10" pops |
| Rally | rallyRev 10 → 11 | Spin comes from the paddle's speed and curves the ball for about 2/3 s (up to ~30°); gold targets stay 5 s (was 4) | Ball warms white → orange (10 returns) → red (20); a curving ball leaves a longer trail |
| Tempo | beatRev 9 → 10 | Wider hit windows (4/8/13 ticks, was 3/7/12), a lighter chart, lightest from the 5th lane (40 s on); same curve, so scores rise | Music decoded during the intro, starts on the first frame, loops the main groove (the file's quiet 8 s intro skipped), louder (0.9 → 1.0, was 0.5 → 0.9) |
| Meteor | snakeRev 9 → 10 | Gold stars 5 s (was 3.5; the extra time pays 1); a third wormhole pair; a second vertical speed lane; five seeded 2×2 rocks; a played run never scores 0 | The comet: dark rock core #5A2A12, #FF7A2E → #FFB347 flame, white-hot streaming trail cooling to embers and smoke along the whole body |
| High Rise | skylineRev 7 → 8 | rev 7's play on a gentler curve (78/107/127/177/192/200, was 72/99/118/168/185/200) | The old every-10-floors crane bell now plays on a perfect drop; the gust whoosh every 10 floors |
| Coral Pop | bubbleRev 9 → 10 | The mine clears two hex rings (up to 18 bubbles, was 6) | Creature symbols at 82 % |
| Slice | sliceRev 9 → 10 | Onion and golden fruit 1.2× (radius 17 and 12 px, was 14 and 10) | The onion is light green, #CFEDE6 |
| Swish | binRev 7 → 8 | The +9 far bucket's mouth is 60 % (half-width 17.3 px, was 28.9); a throw that only just misses a bucket counts 1 unit | A clearer ball (halo, dark and cream rings); wind is a small waving flag flying the wind's way with the strength on it |

Every new stamp draws its predecessor's seeded stream first and adds its new features after, so a room deals the same
features at the same places and times to every player, and older stamps replay and score exactly as before (each
game's own check proves it on fixtures recorded on main). All eight intro demos stay stopped until re-recorded on the
new stamps.

## Medians by level

`bun scripts/arcade-skill-bands.ts breaker rally beat snake skyline bubble slice bintoss --rev=now --levels=all
--seeds=60 --jobs=2` on main (before) and on this branch (after), and the same with `--from=10000 --seeds=200`. Only
the server replay's score counts.

### Tuning seeds (room samples 0–59)

Median score, before → after (the same seeds and bots for every level).

| Game | Stamp | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|---|
| Breaker | brkRev 9 → 10 | 67 → **66** | 75 → **76.5** | 107 → **114.5** | 138.5 → **141.5** | 165.5 → **172** | 177.5 → **180** | 179 → **182** |
| Rally | rallyRev 10 → 11 | 45.5 → **57** | 85.5 → **84** | 115 → **124.5** | 140.5 → **137** | 169.5 → **170** | 174.5 → **177** | 182 → **184** |
| Tempo | beatRev 9 → 10 | 27 → **42.5** | 68 → **85** | 101 → **114** | 138 → **147.5** | 171.5 → **175.5** | 180 → **179** | 200 → **200** |
| Meteor | snakeRev 9 → 10 | 44.5 → **49.5** | 82 → **72** | 101 → **112.5** | 143.5 → **140** | 167 → **172** | 178.5 → **186** | 182 → **190** |
| High Rise | skylineRev 7 → 8 | 54 → **59** | 72 → **78** | 99 → **107** | 115.5 → **124.5** | 168 → **177** | 184.5 → **191.5** | 200 → **200** |
| Coral Pop | bubbleRev 9 → 10 | 40.5 → **42** | 72.5 → **75** | 97 → **101** | 124 → **124.5** | 166.5 → **171.5** | 182.5 → **179** | 188.5 → **187** |
| Slice | sliceRev 9 → 10 | 36.5 → **36** | 71 → **70** | 126 → **118.5** | 174.5 → **174** | 181 → **179** | 181 → **181** | 184 → **182** |
| Swish | binRev 7 → 8 | 66.5 → **62.5** | 80 → **83** | 110 → **106** | 157 → **131** | 187 → **175** | 200 → **185** | 200 → **200** |

### Fresh seeds (room samples 10000–10199)

Median score, before → after (the same seeds and bots for every level).

| Game | Stamp | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|---|
| Breaker | brkRev 9 → 10 | 68 → **67** | 81 → **81** | 111.5 → **101.5** | 144 → **157.5** | 169 → **179** | 177 → **179** | 180 → **185** |
| Rally | rallyRev 10 → 11 | 45 → **58** | 79 → **79** | 113.5 → **124** | 147 → **154** | 164 → **170** | 173 → **178.5** | 182 → **185** |
| Tempo | beatRev 9 → 10 | 27 → **41** | 68 → **82** | 101 → **112** | 134.5 → **146** | 171 → **174** | 179 → **191** | 200 → **200** |
| Meteor | snakeRev 9 → 10 | 43.5 → **47.5** | 80 → **77** | 107.5 → **102** | 141.5 → **139** | 163 → **163** | 178 → **185** | 185 → **192** |
| High Rise | skylineRev 7 → 8 | 56 → **61** | 70 → **76** | 97 → **105** | 115 → **124** | 168 → **177** | 185 → **192** | 200 → **200** |
| Coral Pop | bubbleRev 9 → 10 | 37.5 → **42** | 79 → **79** | 104 → **105** | 128 → **128** | 168 → **169** | 183 → **182** | 190 → **190** |
| Slice | sliceRev 9 → 10 | 37 → **39** | 70 → **70** | 113.5 → **114** | 175 → **174** | 183 → **181.5** | 182.5 → **181** | 182 → **180** |
| Swish | binRev 7 → 8 | 56 → **59** | 80 → **80** | 115 → **106** | 166 → **144** | 187 → **175** | 200 → **185** | 200 → **200** |

**Zeros:** no played run scores 0 after the change (before: one Slice weak run on the tuning seeds and one Meteor
average run on the fresh seeds). No run was flagged and no replay mismatched.

**Against Joe's bar** (good < great < elite; an ordinary player steady unless asked to rise):

- Every game still rises good → great → elite on both seed sets.
- Tempo and High Rise were asked to rise: good +11–13 and +8.
- Rally's good level rises about 10: the 5 s targets get struck more often (the curve is unchanged).
- Breaker's good level moves +7 on the tuning seeds and −10 on the fresh ones (its curve was refitted for the second
  double-ball brick; without the refit good would have been about 130).
- **Swish is harder at the top, as asked:** good −4 to −9, but great −22 to −26 and elite 200 → 185, because a missed
  far try now also loses the basket. Brilliant players still beat great ones by 40+ points. Worth Joe's eye on a phone.
- Slice's changes are within seed noise: the bots aim at centres, so a bigger onion rarely changes their cuts.

## Screenshots (414×896)

Before (main) beside after (this branch), each drawn by the game's real renderer from the same skill-band bot run on
the stamp rooms deal: `bun scripts/shots/phone-notes-shots.ts` (run it in a main worktree for the before frames).
In `screenshots/phone-notes-oct-2026/`; `features/` has after-only frames of the new features (a landed 2×2 rock and
its shadow, gold-brick cracks, the mine's two-ring blast) from `scripts/shots/meteor-rev10-frames.ts` and
`scripts/shots/phone-notes-brk-bub-shots.ts`. Tempo and High Rise's changes are sound and scoring, so their frames
look the same.

## Assumptions

- "+10 pop-ups and skill-point pop-ups" (Breaker): every points pop is gone; the "GOLD BRICK!" and "COMBO ×2" banners
  stay (they drive moment sounds and replay moments).
- "60 % of its current size" (Swish): the mouth width (and its rim and walls); the bucket's height is unchanged.
- "Bigger blast" (Coral Pop): one hex ring more (the next step up on a hex grid).
- "Bigger gold stars stay a little longer" (Meteor): the existing gold stars, 3.5 → 5 s.
- "The whoosh" (High Rise): the wind gust, High Rise's only whoosh.
- Two small additions to keep Joe's "anyone who plays scores above 0": Meteor's played run scores at least 1, and
  Swish counts a close miss as 1 unit (no pop for it yet).
- Meteor's tail no longer changes colour every 5 stars: the whole body is the comet's trail.
