# Arcade second-pass tuning

- Remove native tap highlights, selection and touch callouts across arcade canvases and controls, including Beat and Burst.
- Create Matchup specials on every resolution stage and update its four-line star.
- Give Breaker two double-ball bricks, white power-up stars and blue HP shades with accumulated cracks.
- Add road details to Cross start/finish lanes and halve sideways swipe travel.
- Raise Wavefront’s ship, smooth Flip into larger slow arcs, restore Burst to three lives and draw Tilt spikes as six-pointed stars.

## Verification
Run 200 self-replay runs each for Matchup, Breaker, Cross, Wavefront, Flip and Burst only, plus focused rule checks. Inspect preview diagnostics. No browser tests.

## Technical details
Keep simulation changes in the existing shared arcade modules so phone and server replay use identical rules. Cross’s passability search will use the same half-column movement as play.
