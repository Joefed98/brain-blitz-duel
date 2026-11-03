# Sound cues: Loopline, Regions and Island Link (1 Nov 2026; shown as Fences, Fillomino and Bridges until 3 Nov 2026)

The three Logic grid puzzles born on the scoring standard. Like the other Logic games they dispatch named cues through
`soundCue()` and `useSolveFx` (`src/puzzles/logicFx.ts`); each slot plays one of the library's existing recordings
(`src/lib/fx/manifest.ts`), and every `<game>.solve` fires once at the solve moment, its effect at most 1.2 s. Kakuro's
cues are in number.md. Haptics come only from the shared puzzle signals (a correct answer, the finish).

| Cue | Fires when | Animation |
| --- | --- | --- |
| `fences.draw` | A line is drawn on an edge (tap or drag) | The line draws in |
| `fences.cross` | An edge is marked ✕ | — |
| `fences.solve` | The lines are one closed loop meeting every number | ≤1.2 s: the loop lights up around the board |
| `fillomino.place` | A number is entered or painted on a square | — |
| `fillomino.region` | A region reaches its size (N squares of N) | The region tints |
| `fillomino.solve` | Every region is complete and no equal regions touch | ≤1.2 s: regions flash in turn |
| `bridges.build` | A bridge is built or doubled | The bridge draws in |
| `bridges.remove` | A pair's bridges are removed | — |
| `bridges.solve` | Every island has its bridges, none cross, all joined | ≤1.2 s: bridges light island to island |
