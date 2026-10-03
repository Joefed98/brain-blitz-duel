# Ball Track full rework (arcade engine)

Replace the current tap-to-rotate Ball Track with a real-time, seeded arcade sim. Name, category (Pattern) and registry slot stay the same.

## What the player sees
- 7×7 grid filling the arena width (tiles about 52 px at 375 wide), hopper above showing the next four balls, gold Release button under the hopper, a row of 7 slots below: 5 colour trays and 2 dark pits.
- Pieces look different at a glance: grey tube pipes, plain drop tiles (faint), flipper with a gold flap, slider with a rail and a sliding bar showing its open slot, wheel as a 2×2 disc with a visible pocket.
- Balls roll tile to tile (one tile per 20 ticks); a lost ball is drawn falling out of its tile; a ball in a pit or wrong tray flashes red.

## Rules (how I will interpret the spec)
- Balls drop from the hopper into the top of the centre column (column 4).
- Pipes (straight, corner, T): tap rotates 90° clockwise. A ball keeps its travel direction and follows the pipe's openings; a T sends a ball straight on if possible, otherwise to the side opening that turns downward (fixed rule, so it's deterministic). Entering through a closed side = lost.
- Flipper: a ball from the top exits bottom-left or bottom-right (into the next row, one column over). Tap toggles instantly.
- Slider: bar covers 2 tiles of a 3–4 tile track. Track tiles not under the bar are plain drops. Through the slot = straight down; on the solid half = rolls to the nearer bar end and drops off that end. Drag snaps to whole positions; the bar takes 10 ticks to move and its position is read on the tick a ball arrives.
- Wheel (2×2, one pocket in one of the four quarters): a ball enters only when the pocket is in a top quarter under it; otherwise it waits above. Tap turns 90° clockwise over 15 ticks. The ball drops out when the pocket reaches a bottom quarter, into the tile below that quarter. Holds one ball.
- One ball per tile; a ball whose next tile is occupied waits. Any number in flight.
- Round ends when all 15 balls are resolved or at 90 s.

## Scoring
- 15/15 home: 100 + round(50 × ms left ÷ 90 s), measured on the last landing; +20 if no ball ever hit a wrong tray or pit; cap 150.
- Otherwise: round(100 × correct ÷ 15) − 5 per wrong-tray ball, min 0, cap 90. (Pits cost nothing extra.)

## Generator and bank
- Offline script builds 400 courses: seeded tray/pit positions, 15-ball order (no three same colour in a row), pieces by tier (8–10 / 11–13 / 14–16, more wheels and sliders at higher tiers), then a playbook of timed piece actions that routes all 15 balls home, played through the real sim to prove it. Starting states are then scrambled; par = playbook action count.
- Bank is server-only; the device gets the course, not the playbook.

## Input and verification
- Events k=12 rotate (tile), 13 flip (tile), 14 slide (slider id, position), 15 wheel (wheel id), 16 release; recorded by tick, checkpoints every 300 ticks, full server replay stores its own score.
- Identity proof (200 seeds of self-replay) plus a bank check that every playbook scores 150 — Ball Track only. No browser tests.

## Intro and reveal
- Your GOAL / HOW / SCORE text verbatim; example 3×3 with a flipper, two trays and one ball mid-fall.
- Reveal: "13 / 15 home · 1 wrong" and "Same course for everyone".

## Technical details
- New sim `src/lib/arcade/ballTrack.ts` (integer state, config block, mulberry32), stage via ArcadeCanvasStage with discrete inputs and a footer Release button; slider drag and wheel/pipe taps mapped in `pointer`.
- Bank script `scripts/ball-track-bank.ts` rewritten; old 8×8 replay, bank and checks removed; grading moves to the arcade replay path; types, instructions, summaries, secrets and AGENTS.md updated.
- Rooms already mid-game on the old Ball Track will not be supported after the switch.
