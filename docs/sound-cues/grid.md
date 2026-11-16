# Sound cues: Loopline, Regions and Island Link (1 Nov 2026; shown as Fences, Fillomino and Bridges until 3 Nov 2026)

The three Logic grid puzzles born on the scoring standard. Like the other Logic games they dispatch named cues through
`soundCue()` and `useSolveFx` (`src/puzzles/logicFx.ts`); each slot plays one of the library's existing recordings
(`src/lib/fx/manifest.ts`), and every `<game>.solve` fires once at the solve moment, its effect at most 1.2 s. Kakuro's
cues are in number.md. Haptics come only from the shared puzzle signals (a correct answer, the finish).

| Cue | Fires when | Animation |
| --- | --- | --- |
| `fences.draw` | A line is drawn on an edge (tap or drag) | The line draws in |
| `fences.cross` | An edge is marked ✕ | — |
| `fences.clear` | An edge's ✕ is cleared by a tap, or lines are erased by a drag (15 Nov 2026; it played `fences.cross`) | — |
| `fences.solve` | The lines are one closed loop meeting every number | ≤1.2 s: the loop lights up around the board |
| fences.numberMet | A number's count of lines is newly met (15 Nov 2026, the Logic overhaul) | The number turns gold and pops |
| fences.over | A number newly has too many lines | The number turns red and shakes |
| fences.loopWrong | The lines close into one loop that is not the answer | The loop flashes once, failing numbers glow red (650 ms) |
| fences.undo | Undo | — |
| fences.reset | Reset | — |
| `fillomino.place` | A number is entered or painted on a square | — |
| `fillomino.region` | A region reaches its size (N squares of N) | The region tints |
| `fillomino.solve` | Every region is complete and no equal regions touch | ≤1.2 s: regions flash in turn |
| fillomino.stroke | A drag paints its second square or later, rising a step a square (15 Nov 2026, the Logic overhaul) | — |
| fillomino.over | A group newly grows past its number | Its squares pulse red |
| fillomino.erase | A square is cleared | — |
| fillomino.undo | Undo | — |
| fillomino.reset | Reset | — |
| fillomino.pick | A number or the eraser is picked on the pad | — |
| `bridges.build` | A bridge is built or doubled | The bridge draws in |
| `bridges.remove` | A pair's bridges are removed | — |
| `bridges.solve` | Every island has its bridges, none cross, all joined | ≤1.2 s: bridges light island to island |
| bridges.double | A bridge is doubled (15 Nov 2026, the Logic overhaul) | Both planks lay from island to island (200 ms) |
| bridges.islandMet | An island newly has its number of bridges | The coin turns gold and pops |
| bridges.snapBack | A drag stops short of halfway | The preview snaps back |
| bridges.undo | Undo | — |
| bridges.reset | Reset | — |
