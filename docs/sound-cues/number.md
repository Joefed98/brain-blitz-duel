# Sound cues: Number games (13 Oct 2026)

Number polish added visual moments only. No audio is attached yet: each moment dispatches a named cue that a
sound layer can pick up later. Cue names are `<gameId>.<event>` (the `PuzzleType` id), so they never change
when a display name does.

```ts
window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue: "target.solve" } }));
```

The helper is `soundCue(cue)` in `src/components/puzzles/numberPolish.tsx`. Solve cues go through
`useSolveFx`, which fires once, at the solve moment (the same handler or render that submits), and never on a
remount of a round that is already finished. Lengths are the visual moment the cue belongs to; with
prefers-reduced-motion the same cues fire and the visuals are static.

No `shared.*` cues were added: the shared solve beat (gold flash and logo burst, ~1.0 s after every solve)
belongs to Rotation and shared screens.

| Cue | Trigger | Length |
|---|---|---|
| target.select | a tile becomes selected (lift) | 150 ms |
| target.combine | a valid combine (pop, sink, history line) | 240 ms |
| target.solve | exact hit: flight, pulse, rings | 1150 ms |
| equation.drop | an operator drops into a slot | 200 ms |
| equation.correct | a stage is held as correct (green glow) | ~1000 ms (existing hold) |
| equation.advance | the next stage slides in | 240 ms |
| equation.solve | all four right: equations tick green in turn | 1200 ms |
| checkout.aim | a wedge or bull is selected | 140 ms |
| checkout.thud | a ring button adds a dart | 230 ms (+260 ms impact ring) |
| checkout.tick | the remaining score changes (dart or Undo) | 220 ms |
| checkout.stage | a board checks out, round not finished | ~560 ms + 230 ms sweep |
| checkout.solve | the final board checks out | ~1150 ms |
| measure.select | a jug is tapped to select it | 150 ms lift |
| measure.pour | a pour that changes the jugs | 320 ms stream, 260 ms level ease |
| measure.fill | Fill applied | 320 ms tap stream, 260 ms ease |
| measure.empty | Empty applied | 260 ms ease |
| measure.reject | a refused pour, fill or empty | 320 ms (existing shake) |
| measure.reset | Reset applied | 260 ms ease |
| measure.solve | the last board is solved | 1100 ms |
| numpyramid.place | a block is placed in a cell (tap or drag) | 210 ms |
| numpyramid.solve | the final board is solved | 1100 ms |
| trail.step | the path gains a step | 190–200 ms |
| trail.solve | the trail is complete | 1150 ms |
| numline.place | every Place | 220 ms drop |
| numline.line | a new line starts (lines 2 and 3) | 220 ms slide |
| numline.solve | the 15th Place | ~1100 ms |
| numline.sweepTick | ×5, as the glint passes each marker on line 3 | 260 ms tick, 380 ms ring |
| kakuro.place | a digit is entered in a square (not pencil marks, not clearing) | the digit pops in |
| kakuro.run | a run is full and adds to its clue with no repeat | the run glows |
| kakuro.solve | every run is right | ≤1.2 s: runs light up one by one |
| balance.select | a weight is selected | 140 ms |
| balance.drop | a weight is hung on a notch | 230 ms |
| balance.lift | double-tap returns a weight to the tray | 260 ms |
| balance.level | a non-final scale balances (until 15 Nov 2026; the Number overhaul plays balance.stageClear instead, older rounds included) | 760 ms |
| balance.solve | the final scale balances | 1100 ms |
| tendrop.apply | a tap applies a tile without hitting the target | 200 ms pop |
| tendrop.clear | a target is cleared | 360 ms ring, plus the 0.5 s hold glow |
| tendrop.reset | the total overshoots and resets | 360 ms ring, 24-tick frame flash |
| tendrop.refused | a ÷ or − tile is refused | 18-tick shake |
| tendrop.solve | all ten targets cleared: last target bursts, remaining tiles shimmer | 1200 ms |

## The Number overhaul's stage moments (15 Nov 2026)

One "stage complete" moment for the six stage games (`src/components/puzzles/number/overhaul.tsx`): the finished
stage lifts and slides away with a rising two-note, and the stage pip fills. Skip and fail have their own, clearly
different sounds. Each plays a library stand-in until Joe's ElevenLabs file (docs/sound-cues/number-elevenlabs.md)
takes the slot's name.

| Cue | Trigger | Length |
|---|---|---|
| balance.stageClear | a scale balances (not the last): the stage lifts and slides away, the stage pip fills | 160 ms rising two-note |
| balance.skip | kept for a skip this game may get: the stage slides away | 528 ms flat swish |
| balance.fail | out of hangs: the scale greys and slides away: the stage slides away | 90 ms dull thunk |
| equation.stageClear | an equation comes out true (not the last): the stage lifts and slides away, the stage pip fills | 160 ms rising two-note |
| equation.skip | Next skips an equation: the stage slides away | 528 ms flat swish |
| equation.fail | an equation runs out of tries: the stage slides away | 90 ms dull thunk |
| numpyramid.stageClear | a pyramid is complete and right (not the last): the stage lifts and slides away, the stage pip fills | 160 ms rising two-note |
| numpyramid.skip | Skip moves on from a pyramid: the stage slides away | 528 ms flat swish |
| numpyramid.fail | kept for a failed stage this game may get: the stage slides away | 90 ms dull thunk |
| measure.stageClear | a jug reaches its target (not the last board): the stage lifts and slides away, the stage pip fills | 160 ms rising two-note |
| measure.skip | kept for a skip this game may get: the stage slides away | 528 ms flat swish |
| measure.fail | a board runs out of moves: the stage slides away | 90 ms dull thunk |
| checkout.stageClear | a board checks out (not the last): the stage lifts and slides away, the stage pip fills | 160 ms rising two-note |
| checkout.skip | kept for a skip this game may get: the stage slides away | 528 ms flat swish |
| checkout.fail | a dart busts the board (checkoutRev 3): the stage slides away | 90 ms dull thunk |
| numline.stageClear | a line of five is placed (not the last): the stage lifts and slides away, the stage pip fills | 160 ms rising two-note |
| numline.skip | kept for a skip this game may get: the stage slides away | 528 ms flat swish |
| numline.fail | kept for a failed stage this game may get: the stage slides away | 90 ms dull thunk |

### Counterweight (Number overhaul)

| Cue | Trigger | Length |
|---|---|---|
| balance.pickup | balanceRev 4: one tap picks a hung kettlebell up off its notch | 150 ms |
| balance.nudge | a free notch tapped with no weight picked: the tray nudges, "Pick a weight first" | 300 ms nudge |

### Exact (Number overhaul)

| Cue | Trigger | Length |
|---|---|---|
| target.operator | an operator key picked, or the picked one tapped again to drop it | 120 ms |
| target.undo | Undo takes the last step back | 200 ms |
| target.reset | Reset puts every number back | 300 ms |
| target.lock | Lock pressed with a step made (not the exact hit, which plays target.solve) | 400 ms stamp |

### Ballpark (Number overhaul)

| Cue | Trigger | Length |
|---|---|---|
| numline.edge | a touch or drag past an end of the line: a short stop shows at that end (the marker clamps there) | 320 ms bump |

### Checkout (Number overhaul)

| Cue | Trigger | Length |
|---|---|---|
| checkout.bust | a dart busts the board (checkoutRev 3): "Bust", the darts drop out | 250 ms |
| checkout.undo | Undo pulls the last dart: a light tug | 528 ms |
| checkout.nudge | a ring is tapped before a wedge is picked: "Pick a wedge first" | 486 ms |
| checkout.switch | another board's tab is chosen | 486 ms |
| checkout.bigFinish | a board checks out on a big finish that pays: the crowd's "oh!" | 600 ms |

### Kakuro (Number overhaul)

| Cue | Trigger | Length |
|---|---|---|
| kakuro.select | another square is tapped | 486 ms |
| kakuro.pencil | a pencil mark is set or taken off | 486 ms |
| kakuro.clear | Clear empties a square that held a digit or marks | 528 ms |
| kakuro.broken | a run newly breaks a rule (a repeat, past its clue, out of reach): its clue turns red | 250 ms low tick |
| kakuro.combo | one digit completes two runs at once (in place of kakuro.run) | 600 ms |
