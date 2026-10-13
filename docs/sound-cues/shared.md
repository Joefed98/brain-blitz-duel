# Shared sound cues

Cues for moments every game shares. Convention: [README.md](README.md). No audio is attached yet.

| Cue | Trigger | Length |
|---|---|---|
| `shared.signature.solve` | The signature beat starts: 1.0 s after a puzzle's solve moment (verdict solved); after a non-arcade game with no finish state ends its run on 120 or more; 1.0 s after an arcade finish game reaches its finish; 1.0 s after an open arcade game ends a run of 120 or more on the phone's sim. | 0.6 s |
| `shared.signature.fast` | As `shared.signature.solve`, for a solve or finish with at least half the time left (the full speed part); the beat is a little bigger. Replaces the solve cue (one or the other, never both). | 0.6 s |
| `shared.perfect` | The reveal shows a stored score of 150: a short gold burst on the score (puzzle and arcade reveals). | 0.5 s |
| `shared.help.open` | An in-game "?" help sheet opens. | instant |
| `shared.help.close` | An in-game "?" help sheet closes (close button, tap outside or Escape). | instant |

Where they fire: `src/lib/fx/signature.ts` (beat and perfect burst), `src/lib/fx/useSignature.ts` (the rooms and practice verdict point), `src/lib/fx/arcade.ts` (the arcade run-end point), `src/components/duel/PuzzleInstructions.tsx` (help sheet).
