# Sound cues

Every new effect, animation or feature moment announces itself with a **named sound cue**, so a later sound pass can attach audio without touching the game again. No audio is attached to these cues yet.

## The convention (every session uses it)

Dispatch one window event at the moment the effect starts:

```ts
window.dispatchEvent(new CustomEvent("duelz-sound", { detail: { cue: "<gameId>.<event>" } }));
```

or, from app code, the shared helper (same event, safe on the server):

```ts
import { soundCue } from "@/lib/fx/soundCues";
soundCue("tower.stackShine");
```

- **Name:** `<gameId>.<event>`. `<gameId>` is the game's `PuzzleType` id (`tower`, `wordsmith`, `snip`…), never its display name, so a rename never changes a cue. Shared moments (screens and effects every game uses) use `shared.<event>`; the room's big moments (Prepare to Duel, round titles, Final Round, the winner reveal) use `room.<event>`. `<event>` is lower camelCase, optionally dotted for a family (`shared.signature.solve`, `shared.signature.fast`).
- **When:** once, at the frame the effect starts (not when it is scheduled). A repeating effect dispatches once per repeat.
- **Presentation only:** a cue never reads or writes game state, recorded time, inputs or scores, and is never dispatched from inside an arcade sim (`src/lib/arcade/<game>.ts`); renderers, stages and shared effects dispatch it.
- **Demos stay silent:** don't dispatch from intro demos (check `demoHushed()` from `@/lib/sound` when the code also runs in a demo).
- **List your cues:** each session lists the cues it adds, with trigger and length, in `docs/sound-cues/<area>.md` (`shared.md` for shared screens and effects, `<gameId>.md` or a group file such as `pattern.md` for games) and in its PR.

## Seeing cues while developing

Open the app with `?dev=1` (for example `/practice?dev=1`): a dev-only listener (`installSoundCueLogger`, mounted with the effects layer on every screen) logs each cue to the console as `[duelz-sound] <cue> @ <ms since page load> ms`. Without `?dev=1` nothing is logged.

## Files

- `src/lib/fx/soundCues.ts`: `SOUND_CUE_EVENT`, `soundCue()`, `installSoundCueLogger()`.
- `docs/sound-cues/shared.md`: the shared cues.
- `docs/sound-cues/room.md`: the room's big-moment cues (`room.prepare`, `room.round.1`–`6`, `room.finalRound`, `room.winner`…).
- `docs/sound-cues/word.md`: the Word games' cues (Nucleus to Letterfall).
