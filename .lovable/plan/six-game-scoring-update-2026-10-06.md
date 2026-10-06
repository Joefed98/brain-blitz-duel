# Six-game scoring update

- Apply the requested scoring formulas to Ball Track, Matchup, Junction, Rally, Skyline and Bullseye, without changing artwork.
- Ball Track: keep 60 seconds, release 30 balls at 103-tick intervals (last release at 49.8 seconds), regenerate its 400 proven courses and practice course, and reject its old saved intro demo.
- Refresh the six intro SCORE entries using shared scoring-shape templates and update their question-mark formulas and relevant reveal text.
- Preserve the other five saved demos because their simulation trajectories do not change.

## Verification
- Run Ball Track's 200-run identity proof and bank checks, plus the filtered 200-run proof for the other five games only.
- Check rounding, caps, Bullseye's four anchors, Ball Track timing and demo compatibility without browser tests.