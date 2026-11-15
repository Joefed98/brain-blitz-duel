# The Retro overhaul (phase 2, step 4)

Joe reviewed every Retro game (docs/design/game-reviews/retro.md) and agreed this overhaul for all ten: Hover, Breaker,
Rally, Wavefront, Fission, Tempo, Meteor, Spacewalk, Pinball and Blockzone. It lands in three stages:

1. **The look and the game changes** (this branch now).
2. **The effects** with the shared effects kit (PR #422, `src/lib/fx/kit.ts`), once it is on main.
3. **The levels** (Easy, Normal, Hard, Expert) with the difficulty framework's level registry and bot tuning script,
   once it is on main.

Standing rules for every Retro game (the brief): unmistakably retro (pixel fonts, pixel art, neon, arcade character),
made premium; clarity first; minimal glow except Blockzone; counters never below 11 px; controls in champagne gold and
navy; edge to edge with the playing area's fair shape kept; no run ends on the first miss at Normal; intro stills from a
real frame; the most-heard sounds recorded (docs/sound-cues/retro-elevenlabs.md); rated rooms on Normal; older stamps
replay exactly; at most 120 s at every level.

## Stage 1 status

| Game | Done on this branch | Still to do in stage 1 |
|---|---|---|
| Tempo | **beatRev 12**: a missed note scores 0, not −2 (docs/arcade-standard/beat.md) | Concept A's cleaner lanes and big tap buttons on the line |
| Rally | **rallyRev 13**: 2 lives (a missed blue ball serves again after 1.5 s), spin shots (+2 each, up to 10), the intro teaches the swipe (docs/arcade-standard/rally.md) | Crisper court art, keeping its pink and green neon |
| Fission | **burstRev 12**: the wave-clear bonus runs out at three times the quick time, not twice (docs/arcade-standard/burst.md); its slim HUD band at 11 px | Bigger, bolder atoms (a stamp: the hit circles grow) |
| All ten | The shared Retro HUD never draws a count under 11 px (`RETRO_HUD_MIN_PX`; side counts were 10 stepping to 8, Fission's band 10 and 8) | Intro stills from real frames; edge-to-edge backgrounds where a border shows (Wavefront) |
| Hover | (stage 3 gives the shields) | Concept B's deep-space starfield behind today's pixel style |
| Breaker | | A clearable wall at Normal (about 9 rows, faster ball, special bricks lower, stronger multi-ball; a stamp); special bricks with their own icon and shine |
| Wavefront | | The charged shot (hold to charge, release a heavy blast; a stamp); concept A's purple nebula; a new enemy palette with no pink |
| Meteor | | Wrap-around edges at Easy and Normal (a stamp); varied rock sizes; the core spread so skill shows; concepts A/B's glowing tail |
| Spacewalk | | A richer starfield, a bigger astronaut |
| Pinball | | Tuned so a great game reaches 200 (a stamp) |
| Blockzone | | Solid chunky blocks with the emphasised glow (Blockzone's exception) |

Every new stamp is dealt by rooms and practice; checks written for the stamps before it pin `preRetro`
(`src/lib/duel/dealEra.ts`), which deals Tempo beatRev 11, Rally rallyRev 12 and Fission burstRev 11.
`scripts/retro-overhaul-check.ts` proves each stamp (wiring, same play, grace, never a lower score where the play is
the same, the server replay, the 120 s rule) and the HUD floor; `scripts/screens/retro.ts` draws each Retro game's page
for theme-check and no-wrap-check.

## Levers for the levels (stage 3)

What each level will turn, from the brief (Normal is today's game unless the brief says otherwise; every level's
lever goes on a new stamp, dealt by the level registry):

| Game | Levers |
|---|---|
| Hover | gap start → minimum (Easy 180 → 130, Normal 150 → 100, Hard 140 → 90, Expert 130 → 85 px); shields (3, 2, 2, 1 plus a respawn); a crash costs a shield |
| Breaker | rows (7, about 9, 10, 12); ball speed; paddle (100, 84, 76, 68 px); tough bricks |
| Rally | paddle start → minimum (140 → 60, 120 → 40, 110 → 40, 100 → 36 px); ball cap (× 1.9, 2.2, 2.4, 2.6); bumpers from (45, 30, 20, 15 s); lives (3, 2, 2, 1) |
| Wavefront | lives (4, 3, 3, 2); enemy bolt speed; divers from (wave 4, 3, 2, 1); boss strength |
| Fission | lives (4, 3, 3, 2); atom size (+25 % at Easy); quick-clear time per atom (0.9, 0.6, 0.5, 0.45 s); free wasted beams (40, 20, 15, 10); bounce speed (Expert faster) |
| Tempo | hit windows (widest → tightest); fall time (110, 90, 75, 60 ticks); lanes (4; 4 → 5 at 40 s; 5 from 20 s; 5); swipes and holds |
| Meteor | step speed; rocks (6, 11, 14, 16) and sizes; warning (3, 2, 1.6, 1.3 s); shower (none, 20, 15, 12 stars); wrap (Easy, Normal) or walls (Hard, Expert) |
| Spacewalk | traffic density (thin, lighter than today, today's, densest); lives (4, 3, 3, 2); hit cost (small, generous, today's, larger); scoring (today's is Hard) |
| Pinball | balls (4 + ball save, 3, 3, 2); table speed; multiball at (25, 20, 18, 15 s) |
| Blockzone | fall speed; lock delay (longest, today's, shorter, shortest); previews (5, 3, 3, 2); scoring (today's is Hard) |

Targets: the elite bot (under human limits: about 0.25 s to react, 0.15 s to move, no superhuman accuracy) averages
about 198 at Normal, 160 at Hard and 140 at Expert; Easy gives an average player a real shot at a star (175+); 200 stays
reachable at every level; Expert must be humanly possible under its actual settings.

## Measured on this branch

Skill-band medians (p10–p90) on 20 room seeds, `bun scripts/arcade-skill-bands.ts rally beat burst --rev=now
--seeds=20 --levels=all` (the skill-band bots, not yet the human-limit tuning of stage 3):

| Game (stamp) | Weak | Average | Good | Great | Near-perfect | Elite | Flawless |
|---|---|---|---|---|---|---|---|
| Rally (rallyRev 13) | 89 (50–118) | 135 (88–148) | 144 (95–164) | 162 (98–180) | 168 (131–183) | 169 (141–188) | 177 (151–190) |
| Tempo (beatRev 12) | 71 (66–78) | 110 (103–117) | 138 (132–148) | 161 (155–167) | 186 (178–193) | 192 (182–195) | 198 (195–200) |
| Fission (burstRev 12) | 23 (10–52) | 82 (29–125) | 147 (74–174) | 159 (115–182) | 181 (145–188) | 181 (162–189) | 188 (181–193) |

For comparison, rallyRev 12's tuning-seed medians were 74 / 110 / 140 / 165 / 175 / 178 / 185 (docs/arcade-standard/rally.md):
the lives lift the weaker levels most (a weak player's first miss no longer ends the minute). The bots never swipe for
spin, so no bot run here earns a spin shot. The level tuning (stage 3) re-measures every game under human limits.

## For Joe

- **Rally's lives** are 2 at Normal (the brief's table), so the second miss ends the run. The lost ball serves again from
  mid-court after 1.5 s at the speed it had; a miss costs no points, only the time.
- **Rally's spin bonus**: "gold scored with spin" is read as a curling ball (any ball, still curving from a swiped
  return) that strikes a pink pad or a gold target: 2 points each, up to 10, taken from the core (130, was 140).
- **Fission's wave clears**: Normal's quick time stays 0.6 s an atom (the level table keeps it), so the tuning is the
  tail: the bonus now runs out at three times the quick time instead of twice.
- **Tempo's misses** score 0 (the review's "never under 0 per note"); taps on no note still cost nothing.
- **Table and lane labels** on Pinball's inserts, Tempo's FEVER bar and Blockzone's NEXT are labels, not counters, and
  stay at their sizes (8–10 px) where the art leaves no room; every counter is at least 11 px.
- **Intro demos**: Tempo and Fission demos recorded on the previous stamp still play (the same play); Rally's rule still
  plays rallyRev 12 demos until one is recorded on rallyRev 13 (it plays the same until the first miss).
