# Puzzle action log (`alog1:`), 13 Oct 2026

One shared, timestamped answer format for puzzles: the phone sends every action
the player took, each with its time on the round clock, and the server replays
the log against the stored puzzle to work out the result. The phone's own
summary (a final layout, a shot count, a time) is never read.

Lightbender (`laser`) is the first game on it. The remaining puzzles are wired
to it in a later session; Replays will use it for puzzle time-lapses.

Code: `src/lib/duel/actionLog.ts` (format, reading and repair, shared by phone
and server), `src/lib/duel/laserLog.ts` (Lightbender's verbs and replay),
`src/lib/duel/grade.ts` case "laser". Proof: `scripts/laser-log-check.tsx`.

## Versioning

- A puzzle opts in with the stamp `alogRev: 1` (`ACTION_LOG_REV`), set by its
  generator on every new puzzle. Stored puzzles without the stamp keep their
  old answer format and grade exactly as before; nothing stored is rewritten.
- The answer itself carries the format version in its prefix, `alog1:`
  (`ACTION_LOG_PREFIX`). An answer without the prefix is not read as a log at
  all, so an old-format claim on a stamped puzzle scores as an empty log.
- A future, incompatible format gets a new prefix (`alog2:`) and a new stamp
  value; a game's own verbs change only with a new game stamp.

## Format

```
alog1:<action>@<t>,<action>@<t>,…
```

- `<action>`: a lower-case letter, then up to 23 lower-case letters, digits or
  hyphens (`/^[a-z][a-z0-9-]{0,23}$/`). The first letter is the verb; each game
  defines its own verbs and arguments. No commas, `@` or spaces, so the log is
  plain ASCII and safe in a URL or JSON.
- `<t>`: whole milliseconds on the **round clock**: ms since the puzzle phase
  started, `serverNow() - phaseStartedAt` on the phone. This is the same clock
  as the tap logs (`tapLog.ts`). For a puzzle with preparation time
  (`puzzlePrepMs`) the clock includes the preparation.
- Actions are listed in the order they happened. The phone keeps times strictly
  rising (`appendAction`: each time is at least the previous + 1 ms), so an
  honest log is always in order and never has two actions at the same time.
- Limits: at most 1,500 actions (`ACTION_LOG_MAX`; the phone stops logging
  there) and 24,000 characters (`ACTION_LOG_ANSWER_CAP`; the server reads no
  further).
- The log is the whole answer: the draft the phone keeps for the buzzer and the
  answer it sends on finishing are the same log.

## Reading and repair (server)

`decodeActionLog(answer, latestMs)` repairs a bad log rather than rejecting it,
and counts every repair, as the tap logs and the arcade engine do:

| Problem | Repair | Reason recorded |
|---|---|---|
| no `alog1:` prefix | nothing is read (one item, dropped) | `not an action log` |
| unreadable item (bad action, missing `@`, time not an integer) | dropped | `unreadable action` |
| time below 0 | dropped | `action before the round` |
| time after `latestMs` | dropped | `action after the round` |
| beyond 1,500 actions | dropped | `beyond the action cap` |
| out of time order | kept, and the log is replayed in time order (a stable sort) | `action out of order` |

`latestMs` is the end of the round, or in a room the server's own receipt time
plus the 1.5 s network allowance (`grade.ts latestTapMs`, shared with the tap
logs): an action the phone claims after it sent the answer never happened.

Why sort rather than move a late item up to the one before (the tap logs' rule):
moving items up lets a shuffled log put a change made after a FIRE in front of
it. Sorting replays a shuffled log exactly as it was played, so reordering can
never help; only editing the times can, and edited times describe a different
run the phone could have played (see below).

The game's replay then applies the actions to the stored puzzle under the
phone's own rules and ignores, and counts as dropped, any action the board does
not allow. The round stores the counts in `extra`: `actions` (items received),
`repaired` (`clamped` + `dropped`), `clamped`, `dropped`, and `reason` (the
first repair).

## Grading

- The score comes only from the server's replay of the log on the stored
  puzzle; correctness, counts and partial credit likewise.
- Time left stays the phone's receipt-checked claim (`trustedMsRemaining`), but
  never more than the log's own finishing action allows (as Ascend's finishing
  tap). A run that never finishes keeps the claim (0 at the buzzer).
- The reveal replays the same log with the same shared code (`laserLog.ts` for
  Lightbender), so it shows what the server scored.

## Lightbender (`laser`, `alogRev: 1`)

Verbs (cells 0–99; piece kinds `s` = `/`, `b` = `\`, `v` = `S|`, `h` = `S-`):

| Action | Meaning | Example |
|---|---|---|
| `p<cell><kind>` | place a piece from the tray | `p23s@4120` |
| `r<cell>` | turn the piece on a cell (a tap on it) | `r23@4810` |
| `m<from>-<to>` | move a piece to an empty cell | `m23-45@6002` |
| `x<cell>` | take a piece back to the tray (dragged off the board, or Undo) | `x45@7330` |
| `c` | Reset: every piece back to the tray | `c@9001` |
| `f` | FIRE | `f@12040` |

Replay (`replayLaserActions`):

- The board starts empty. A piece placed on the source, a gem, a bomb, a block,
  a fixed splitter or an occupied cell, or beyond its tray (mirrors, splitter),
  is ignored; so is a turn, move or removal of a cell with no piece.
- The server counts the FIREs itself; a FIRE after the third is ignored. Each
  FIRE is traced (`verifyLaser`) on the layout at that moment.
- A FIRE that lights all six gems without a bomb is the solve; nothing after it
  counts.
- Score: `scoreLaser(solved, gems, shot, timeLeft)`, the existing formula, with
  the server's shot count (the solving shot's number). Without a solve, the
  final layout's lit gems earn the unfinished credit; the shot argument is
  `max(1, shots)`, as the old buzzer draft claimed, so a solving layout that was
  never fired earns 15 per gem (90), not a solve.
- Time left: the claim, never more than `limit − t` of the solving FIRE.

## What stays the phone's word

The log can't be invented into a better score: the phone can't claim a solve,
a shot number or a layout, only actions. But the actions are still its own:

- **Timing.** Every time comes from the phone's server-synced clock. The server
  holds the log to the round and to its receipt time + 1.5 s; it can't tell a
  real time from a plausible faked one.
- **Omission.** A modified phone can leave an action out. The server then
  grades the run the remaining actions describe, which the player could have
  played. For Lightbender that includes a missed FIRE: the board is public, so a
  phone can trace the beam without firing anyway, and the shot count rewards the
  player who didn't need the extra shot. `laser-log-check` asserts such a log
  grades exactly as that legal run. Server-witnessed actions would need them
  streamed live, as for tap timing, before money play.

## Wiring another puzzle

1. Stamp the generator's output `alogRev: ACTION_LOG_REV`.
2. Define the game's verbs (a lower-case first letter; no `,` `@` or space) and a
   replay `replay<Game>Actions(puzzle, actions, diag)` in a shared (not
   `.server`) module, holding the board to the phone's rules and calling
   `noteRepair(diag, "dropped", reason)` for anything it refuses.
3. On the phone, keep the log in `useStageState` (so it survives a remount),
   append with `appendAction(log, action, serverNow() - phaseStartedAt)` at the
   moment each action is applied, and send `encodeActionLog(log)` as both the
   draft and the answer. Keep the old answer for unstamped puzzles.
4. In `grade.ts`, branch on `usesActionLog(puzzle)`: decode with
   `latestTapMs(timeLimitMs, receivedMsRemaining)`, replay, score with the
   game's existing scorer, store the repair counts.
5. Prove it like `laser-log-check`: honest runs (the real Stage in happy-dom)
   grade as before on unstamped puzzles and identically from the log on stamped
   ones; tampered logs never beat the honest run.
