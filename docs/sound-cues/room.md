# Room sound cues

Cues for the room's big moments (lobby → Prepare to Duel → round titles → rounds → winner reveal). Convention: [README.md](README.md). No audio is attached yet; the existing voice lines and drum roll on these screens are unchanged and separate.

The visual effects behind them are display only (`src/lib/fx/roomMoments.ts`, `src/components/duel/RoomMomentFx.tsx`, `rfx-*` in `src/styles.css`). Each cue fires once on the shared clock, so every phone fires it at the same moment; a player who arrives (or reloads) more than 0.4 s after a cue's time skips it.

| Cue | Trigger | Length |
|---|---|---|
| `room.prepare` | The Prepare to Duel screen starts (phase start): gold glow builds behind the bolt; rings pulse out from 2.0 s (on the voice line), light streaks converge from 3.8 s. | 6.0 s (whole screen) |
| `room.prepare.flash` | Prepare to Duel, 5.55 s: the gold flash as the bolt fills the screen, leading into Round 1. | 0.45 s |
| `room.round.1` | Round 1 title starts: a hairline draws out under the title. | 2.85 s |
| `room.round.2` | Round 2 title starts: a soft sheen passes across the title, a short rule settles beneath. | 2.85 s |
| `room.round.3` | Round 3 title starts: four corner brackets close in to frame the title. | 2.85 s |
| `room.round.4` | Round 4 title starts: two thin halo rings breathe out behind the title. | 2.75 s |
| `room.round.5` | Round 5 title starts: two hairlines slide in from opposite edges, above and below. | 2.85 s |
| `room.round.6` | Round 6 title starts (only in 7-round rooms; in 6-round rooms round 6 is the final): a ring of fine ticks turns into place. | 2.85 s |
| `room.finalRound` | The last round's title starts (replaces `room.round.N` for that round): gold edge glow, two shock rings, gold rails shooting in, the title punches in. | 2.9 s |
| `room.winner` | "And the winner is…" starts: a slow ray wheel turns behind the line. | 6.3 s (whole screen) |
| `room.winner.lock` | Winner reveal, 5.8 s (the drum roll's cut, `WINNER_ROLL_END_MS`): the two sweeping spotlights lock onto the line, the edges are dimmed and a gold spot holds through the silence before the podium. | 0.5 s |

Under prefers-reduced-motion the cues still fire; the effects become a calm fade in place.

Where they fire: `src/lib/fx/useRoomMoments.ts` (`useRoomMomentCues`, called by `src/components/duel/RoomMomentFx.tsx`), mounted by `DuelStart.tsx`, `RoundTitle.tsx` and `WinnerReveal.tsx`.
