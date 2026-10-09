# Orbit — scrolling camera (orbitRev 3), plan only

No code changes in this step. Today Orbit already scrolls upward (the view keeps the rocket near a fixed height) inside a 390-wide world, so every planet is centred-ish and the route is almost a straight line up. Rev 3 makes the world wider and lets the camera move sideways as well as up.

## 1. World, camera and layout generator

**World**
- Width goes from 390 to about 1,000 world units, with no limit on height (as today). The phone arena becomes a 390 × 620 window onto it.
- The sim keeps whole-number fixed-point positions only. The camera is drawing-only and never changes the sim, inputs or server replay, like Skyline and Scrumper.

**Layout generator (seeded from the room seed)**
- The route is still 40 planets. Each new planet is placed relative to the one before it:
  - a vertical step, as today;
  - a sideways step of up to about 260 units, pushing left or right;
  - after 2–3 steps in the same direction it must turn back, so the route zig-zags;
  - every planet stays at least one ring radius inside the world's side edges.
- Ring sizes, orbit shapes (circle → ellipse → figure-eight), lap speeds and planet 31+ belts follow today's schedule, so difficulty still rises the same way.
- Every candidate planet is checked by the reachability test below. If it fails, the generator tries the next seeded candidate, and after 8 failures falls back to a straight-up step that is always reachable. The same seed always gives the same 40 planets.

**Camera (drawing only)**
- It aims at the point 35% of the way from the rocket to the next planet, with the rocket held inside a central safe box (inset 70 units from each side and 120 from top and bottom). The rocket can never leave the screen.
- It eases with a critically-damped spring worked out from the sim tick, not the frame clock, so it moves the same on every phone and in replays. Motion is capped at 6 units per tick, and the spring removes jitter from 60/120 Hz frame differences.
- While the rocket is in flight the camera locks to it, so a fast hop never outruns the view.
- When the next planet's ring is more than 30% off screen, a small gold arrow at the screen edge points at it, with the distance shown as a faint tick.
- With reduced motion turned on, the camera only re-centres while the rocket is orbiting, using a short 250 ms slide, and holds still during flight.

**Two example layouts (sketch)**

```text
 Layout A (seed …1)            Layout B (seed …2)
 world x: 0 ......... 1000     world x: 0 ......... 1000
 P6            (o)             P6  (o)
 P5      (o)                   P5        (o)
 P4 (o)                        P4              (o)   <- ring half off-screen
 P3      (o)       [view]      P3                 (o)  ^ gold edge arrow
 P2            (o) [390w ]     P2           (o)
 P1       (o)      [     ]     P1     (o)
 SUN     (*)                   SUN  (*)
```

I can also make two real mock screenshots from the generator once you approve; they aren't made yet because this step is plan only.

## 2. Guaranteeing every layout is completable

- **Per-hop exact check:** for each planet pair, sample every release tick across one full lap of the current orbit (110 ticks at most). Run the real flight sim, including belts at that tick's rotation, and record which release windows reach the next ring. A hop is accepted only if it has at least 2 separate windows, each at least 4 ticks wide, so a phone tap is never a pixel-perfect gamble.
- **Whole-run proof:** chain the 40 hops with the real sim. A bot taps in the middle of the earliest valid window and must reach planet 40 inside 90 s with time to spare. The time-to-spare limit is the current par plus 20%, so human players have slack.
- **Cost estimate:** about 40 hops × about 110 release ticks × at most 150 flight ticks ≈ 660k integer steps. That is about 15–40 ms per layout on a server and about 60–120 ms on a phone. Rejected candidates add perhaps 2–3× in the worst case.
- **Server bank:** like Grappler, build about 500 proved layouts that only the server holds, chosen by room seed. A start then costs about 1 ms, and the live proof is used only as a fallback.

## 3. Checks

- **orbit-checkpoint-check:** stays as it is for rev 1/2. I'll add a rev 3 pass that checks checkpoint selection and respawn on zig-zag layouts.
- **orbit-outside-belt-check:** this times out because it brute-forces many seeds over full belt rotations. I'll split it into a fast fixed-seed regression check (under 60 s) and an optional deep run given 1,800 s in the check runner. Legacy cases stay unchanged.
- **New checks:**
  - `orbit-rev3-proof`: every bank layout is proved, and 200 random seeds pass the live proof.
  - `orbit-rev3-replay`: client sim vs server replay on 100 recorded bot runs gives identical scores and counters.
  - `orbit-legacy-replay`: stored rev 1/2 runs are re-scored and must match exactly.
  - `orbit-camera-check`: the rocket is always inside the safe box, the next planet is always visible or has an arrow, camera speed stays under the cap, and the same tick gives the same camera on two clocks.
  - `orbit-bounds-check`: ring, belt and rocket art stays within 2 px of the collision geometry at camera offsets.

## 4. Risks

- **Frame rate:** a wider world means more off-screen planets. Only planets inside the view plus a 1-ring margin are drawn. Pre-rendered ring, belt and planet sprites are reused, with one glow pass per layer and the existing particle caps. The `?dev=1` frame-time readout gets camera on/off and visible-planet counts. The target is under 4 ms at the 90th percentile on a mid-range phone.
- **Motion sickness:** the risks are sideways swings and fast flights. To limit them: the speed cap, the spring with no overshoot, the camera holding still while orbiting until the next planet is at least 60% visible, a static starfield parallax at 0.3×, and the reduced-motion mode above.
- **Input feel:** taps stay full-screen and timing-only, so the camera does not affect input mapping. The risk is that aiming at an off-screen planet feels blind. The edge arrow plus the camera biasing toward the target deals with this. The minimum release-window width in the proof sets how hard it can get.
- **Reveal and demo:** the camera works from the sim tick, so the reveal's final frame and intro demos (run-at-tick) rebuild it exactly. The current saved Orbit demo will be rejected by the version check and needs re-recording after build. Reveals of old rev 1/2 results keep the old fixed view.
- **Legacy:** rev 1/2 sim code paths stay byte-identical; the new behaviour only runs for rounds stamped orbitRev 3.

## 5. Scoring and timing

- I'd keep the formula and the 90 s run. The proof ties each layout's bot completion time to today's distribution, so scores stay comparable.
- One possible change: sideways hops are longer, so the flight cap of 150 ticks may need to rise to about 190 so far hops are possible. This is a sim constant, not scoring, and is versioned. If you'd rather keep 150, the generator will instead limit sideways steps to what 150 ticks can reach. That gives a gentler zig-zag.
- No other change is needed.

## Technical notes
- New `ORBIT_REV = 3` stamp on the puzzle. If it's missing, the rev 1/2 path runs.
- Generator, proof and camera function live with the shared sim. The camera is a pure `(state, tick) → offset` used by play, reveal and demo renderers.
- The bank is a server-only module selected by seed, as Grappler does.
