# Minefield's Logic overhaul cues (15 Nov 2026)

Minefield is a Logic game played on the arcade stage, so its moments fire from its sound observer in
`src/lib/fx/gameSounds.ts` (`minesweeperSounds`), not from a puzzle file: they are listed here rather than in
[logic.md](logic.md), whose table lists exactly the cues the Logic puzzle files fire. Each slot has a placeholder file
(`newGameSounds.data.ts`) until a recording replaces it ([logic-elevenlabs.md](logic-elevenlabs.md)).

| Cue | Trigger | Visual length |
|---|---|---|
| `minesweeper.cascadeTick` | Minefield: a cascade opens; up to 8 ticks, 45 ms apart, rising in pitch | — |
| `minesweeper.defuse` | Minefield: each mine still hidden at the clear, one by one | a gold ring fading on the mine |
| `minesweeper.tapNumber` | Minefield: a number tapped before its flags add up | 18-tick shake of the number |
