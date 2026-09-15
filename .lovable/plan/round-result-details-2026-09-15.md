# Round result details

## What will change
- Extend every registered puzzle definition with a server-built `roundSummary(result, puzzle)` that returns a concise line and optional expanded detail.
- Return the finished round’s puzzle, correct-answer heading, and every player’s summary from the existing authenticated reveal request. Refuse this data until the server confirms the round has ended.
- Attach the returned summaries to standings rows and the two-player result view without changing puzzle play, scoring, or any other round phase.
- Add a compact `Round N · Puzzle · Correct answer` heading above both result layouts.
- Make standings rows tappable and collapsed by default; expanded rows show longer answers such as Target Number steps and run item-by-item detail.
- Increase only 3+ player standings auto-advance from 10 to 12 seconds. Keep the host’s Next action unchanged.

## Display rules
- Single-answer puzzles show the submitted answer (or `No answer`), a wrong-answer mark when applicable, and elapsed time.
- Run puzzles show correct count and elapsed time, with their per-item results in expanded detail.
- Reaction Time and Stop Watch show their stored average.
- Number Hunt and Target Number use their requested custom wording and expanded details.
- The viewer’s summary line uses the existing muted gold treatment; other players use muted grey.

## Technical details
- Add typed summary/result payloads to the shared duel types and registry contract.
- Build summaries only in the authenticated server function after `roundHasEnded`; merge private puzzle data there so correct answers never enter the room payload early.
- Keep existing row-level policies unchanged and continue relying on them for direct result reads; the summary endpoint adds the same participant and ended-round checks.
- Preserve stored raw results and all current scoring formulas.

## Verification
- Validate every registry entry exposes a summary and exercise representative correct, wrong, timeout, run, reaction, Number Hunt, and Target Number results.
- Use three browser contexts to verify no other-player detail is available during play, summaries appear after the phase ends, rows expand, and the 12-second/host-skip behavior works.
- Check the two-player result screen and a 390px mobile viewport for fit.
