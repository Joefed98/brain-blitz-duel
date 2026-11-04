# Retro arcade polish (3 Nov 2026, Joe's audit)

Display, sound and room grouping only. No sim, hit box, rule, timing or scoring changed, so no version stamps: every
older round replays and scores exactly as before (the games' own checks, arcade-self-replay, replay).

## 1. One Retro HUD

`retroHud(ctx, worldW, main, side[], opts)` in `src/lib/arcade/retro.renderer.ts`: the pixel arcade font, the main count
top left (14 px, glowing; Meteor passes `glow: 0`, its frame keeps no live text blur), one or two secondary counts top
right (10 px), at most two rows. Sizes step down (right to 8 px, then left to 10 px) until the two columns stay 10 px
apart (`retroHudLayout`). No "1UP" anywhere (`retroReadout` is deleted) and no "·" chains.

| Game | Top left | Top right |
| --- | --- | --- |
| Hover | BARRIERS n/m | STARS n/m · CHAINS n/m (two rows; TIGHT and CENTRE left the HUD, they stay in the reveal) |
| Breaker | BRICKS n/m | GOLD n/m (or SKILL) · FIREBALL s (the drain bar is gone) |
| Rally | GOLD n (rallyRev 10+), else RALLY n | PADS n · TARGETS n/6 (or GOLD · PADS, or GOLD · n PTS on the oldest rounds) |
| Tempo | COMBO n | BONUS +n; the fever bar is the strip's second row, full width |
| Meteor | STARS n | COMBO xn while it scores, else BONUS +n · ROCKS n / warnings |
| Fission | WAVE n OF 5 (burstRev 10; WAVE n before), lives under it | ATOMS LEFT n (every piece the on-screen atoms will split into) · the live power-up, CLEAR +n or CLEAN n/m |
| Wavefront | WAVE n OF 5 (or BOSS / GUNSHIP), lives under it | the power-up held · STREAK n (wavRev 10) |
| Blockzone | LINES n | PIECES n (SPEED on blockfallRev 1) · MULTI-CLEARS n (2-, 3- and 4-line clears; was "MULTI", the points) |
| Pinball | points | BALL n/3 · MULTIBALL s / n LOCKED / LOCK LIT |
| Spacewalk | CROSSINGS n, helmets for lives under it | NO-STOP xn (crossRev 11) or COINS n/20 · STREAK xn |

The score itself is no longer in Fission's and Wavefront's HUD (Joe read "WAVE 2 27" and "Wave 1 · 3" as counts); it is
the reveal's number, as on the other Retro games.

## 2. Game by game (look only)

- **Hover**: the craft fills more of its round collision disc (a taller hull, a larger dome, still inside the radius).
- **Breaker**: no 1UP.
- **Pinball**: LOCK, the ramp inserts, JACKPOT, the multipliers, the lane letters and HOLD drawn larger or brighter,
  each inside its insert.
- **Blockzone**: seven pieces in seven clearly different hues of our own neon palette (magenta bar, lime square, amber
  tee, cyan and coral steps, violet and pearl hooks; not the familiar falling-block colours or mapping); the ghost at
  twice the tint with a full-strength rim; the Next boxes lit, the first framed in its piece's colour. **Hard-drop spam**
  (`bun scripts/blockzone-spam-measure.ts --seeds=40`): a DROP every 6, 12 or 30 ticks tops out after a median 11
  pieces, scoring 11 (pieces part 11, max 13); the bots' pieces part is weak 44, average 58, good and up 65, totals weak
  60 … flawless 200. Spam scores far under a weak player, so no stamp.
- **Rally**: a hard court in deep teal-blue inside the walls with its own lines, a soft neon glow along every wall's
  inner edge; the pink pads twice as deep and brighter (their width is the scoring span, unchanged).
- **Tempo**: the fever bar is the HUD strip's second row, full width: a bright pink frame round a dark well, filling cyan
  to gold, pink while fever drains, glowing once full.
- **Meteor**: stars 18 px across with a pixel light round the cell, background stars brighter; wormholes a 9 px mouth
  and 12 px rings (inside the cell plus 2 px); the comet's body 11 px tapering to 6 (was 9 to 4).
- **Wavefront**: enemy hulls drawn 2 px past each side of their 28 px cell (`WAV_HULL_BLEED`), the most the bounds rule
  allows. **Not done:** larger hit cells and a wider formation change the hit boxes, so they need a new `wavRev`, the
  bands re-measured and every dealt seed re-proved at 200.
- **Fission**: the arrows slim and translucent in the game's cyan (a thin neon frame, the pixel font's arrows), the same
  76 px row. **Not done:** larger atoms (they already fill their collision discs; a larger disc is a new `burstRev`).

## 3. Spacewalk (was Jaywalk)

Display name only for `cross` (`gameNames.ts`; `docs/ip-names.md`). `src/lib/arcade/spacewalk.renderer.ts` paints every
revision: deep space round the board, station decks for the kerbs, dark space lanes with beacon dots, magenta plasma
lanes for the cyclist and motorbike lanes, an amber freight lane, the docking platform for crossRev 9's island; cars are
small ships, buses long cargo freighters, bikes and motorbikes comets, cones and barriers drifting debris (live, inside
the closed columns' span), each inside the box the sim collides with; the walker a pixel astronaut at most
`crossPlayerR` either side (26 px wide on today's stamps, 37 px tall). Its effects take the Retro world ("PAST THE
COMETS!", "THROUGH THE DEBRIS!", "DOCKED!"); the fill below the world drifts maintenance drones over the deck; the help
text speaks of freighters, comets, debris, decks and the docking platform. Sounds from the library: `cross.traffic` →
`bastion.drone.mp3` (loop), `cross.pastBikes` → `orbit.shootingStar.mp3`, `cross.pastRoadworks` → `hover.slipPast.mp3`;
the road recordings `cross.traffic.mp3`, `cross.bikeBell.mp3` and `cross.cones.mp3` are deleted (no slot used them).

## 4. Orbit in Action

`arcadeGroups.ts`: Orbit leaves Retro for Action (tile border, intro tint, Practice list and the room pool follow the
map). As with High Rise's move the same day, a saved room's picks are unchanged and Orbit now deals under Action. Its
HUD is Action's pills (`drawHudPillRow`, `src/lib/arcade/hudPills.renderer.ts`): Planets and the checkpoint, then Dust,
Sling, Thread and Perfect, fitted between the left edge and SET CHECKPOINT's corner. The fuel meter sits 30 px in from
the right and 64 px up (`ORBIT_FUEL_METER`) on a near-opaque framed backing. The orbitRev 14 still camera
(`clearTopEdge` in `orbitCamera.ts`, display only) moves a framing that would leave a coming planet cut off under the
HUD or the drawn top edge so the planet sits whole below the HUD, or wholly out of view above when that would take the
current orbit out of its safe box.
