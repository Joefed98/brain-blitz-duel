# Sound cues

Every new effect, animation or feature moment announces itself with a **named sound cue**, so a sound can be attached without touching the game again. Every cue has a slot in the sound manifest; most are still silent. [cue-sheet.md](cue-sheet.md) (and [cue-sheet.csv](cue-sheet.csv)) lists every cue, what plays today and what is missing; [Adding a recorded file](#adding-a-recorded-file) says how to fill a slot.

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
- **List your cues:** each session lists the cues it adds, with trigger and length, in `docs/sound-cues/<area>.md` (`shared.md` for shared screens and effects, `<gameId>.md` or a group file such as `pattern.md` for games) and in its PR, then runs `bun scripts/sound-cue-sheet.ts --slots` and pastes the printed slot lines into the manifest (`sound-manifest-check` fails on a cue without a slot).

## Seeing cues while developing

Open the app with `?dev=1` (for example `/practice?dev=1`): a dev-only listener (`installSoundCueLogger`, mounted with the effects layer on every screen) logs each cue to the console as `[duelz-sound] <cue> @ <ms since page load> ms`. Without `?dev=1` nothing is logged.

## Adding a recorded file

There is one loading system (`src/lib/sound.ts`, Web Audio, unlocked by the first tap) and one list of
files: `src/lib/fx/manifest.ts`. Every cue in [cue-sheet.md](cue-sheet.md) already has an entry there
(its **manifest slot**) with `url: null`. Giving a cue a sound means setting that one `url`; nothing else
changes.

1. **Make the file.** MP3 (music must be MP3: its loop points are found by trimming the encoder's
   silence; looping effects marked `loop: true` are trimmed the same way). Cut it to about the
   **suggested length** in the sheet. Music beds are seamless loops.
2. **Name it after the slot:** `<slot>.mp3`, exactly as the sheet's manifest slot column spells it, for
   example `pinball.bumperHit.mp3`, `shared.signature.solve.mp3`, `room.finalRound.mp3`,
   `music_pinball.mp3`, `music_pattern_tiles.mp3`. That is how every existing file is named
   (`correct.mp3`, `music_rally.mp3`…).
3. **Put it where the existing files are:** upload it to the Lovable project's assets, as every existing
   file was. Lovable serves it at `/__l5e/assets-v1/<id>/<slot>.mp3`. (If a file has to come in through
   git instead, put it in `public/sounds/<slot>.mp3` and use the URL `/sounds/<slot>.mp3`; the same loader
   fetches it, and `sound-manifest-check` fails on any audio file in the repo that no slot uses.)
4. **Set the slot's `url`** in `src/lib/fx/manifest.ts` to that URL, and its `ms` to the file's length
   in milliseconds (used for ducking music before the file has decoded).
5. **Set its volume** on the same entry if it needs one: `volume: 0.7` (0–1, default 1). It multiplies
   the game's own volume for that moment and the player's Effects or Music slider (Sound settings).
   Channels: effects and voice follow the Effects slider, music the Music slider.
6. Run `bun scripts/sound-cue-sheet.ts` to refresh the sheet (it keeps the CSV's **new file** column),
   and `bun scripts/sound-manifest-check.ts`.

What each kind of slot does once it has a file:

- **Named cues** (`shared.*`, `room.*`, replay cues, `<gameId>.<event>` from the polish passes): played by
  one listener on the `duelz-sound` event (`installSoundCueBridge`, mounted in `src/routes/__root.tsx`),
  on top of any generic sound the moment already plays (for example `correct`). Replay cues named
  `<gameId>.final-second` and `<gameId>.final` use the shared `*.final-second` / `*.final` slots unless a
  game gets its own (`hover.final-second`).
- **Arcade moments** ([arcade.md](arcade.md)): the file replaces the shared sound the moment plays today
  (`playSlotOr` in `gameSounds.ts`), at normal speed; loops (`orbit.ambience`, `tilt.roll`…) replace the
  shared loop.
- **Placeholders**: a file on `chain.linkTone` / `chain.breakTone` replaces Don't Break the Chain's
  synthesised tones (the link tone keeps its climbing pitch).
- **Music**: `music_<gameId>` (arcade) or `music_<category>_<gameId>` (puzzle) replaces the shared or
  borrowed bed for that game (`roundMusicFor`); the screen slots `music_home`, `music_practice`,
  `music_prepare`, `music_round_title`, `music_reveal` and `music_winner` start playing on their screens.
- **Replacing an existing recording**: change the `url` of its own entry (`correct`, `arc_retro_hit`…).
- **A game's own completion cue** (`strikeout.finish`, `codeword.finish`, `swapword.finish`, `wordfall.finish`,
  `stroop.gatesFlash`, `tendrop.solve`, `whack.finale`, `clayshoot.finalBurst`): these fire at the same moment as the
  generic `complete` sound, so once the cue's file has loaded the generic sound is left out there (`completeFx` in
  `src/lib/fx/index.ts`; the burst still shows). Every other completion cue plays on its own, so nothing else changes.
- **Git-route files** live in `public/sounds/<slot>.mp3`; the shared replay slots `*.final-second` and `*.final` use
  `any.final-second.mp3` and `any.final.mp3`, since `*` cannot be in a filename on Windows.

Without a file every slot keeps today's behaviour exactly: named cues stay silent, arcade moments play
their shared sound, the chain keeps its tones, games keep their shared bed and the screens stay silent.
A file that fails to load (missing, 404, undecodable) logs one `[sound]` warning and the cue falls back
the same way; a game's own music bed that fails leaves that round without music. Slots have
`frequency: 0`, so a missing file never beeps. Intro demos stay silent (`demoHushed()`).

Not a file swap: Tempo's backing beat is synthesised step by step against the chart (`playBeatStep`), so a
recording would need to be locked to the chart's ticks; the `tension_loop` bed is registered but not
placed on any screen.

## Files

- `src/lib/fx/soundCues.ts`: `SOUND_CUE_EVENT`, `soundCue()`, `installSoundCueLogger()`.
- `src/lib/fx/manifest.ts`: every file and every empty slot.
- `src/lib/sound.ts`: the loader and players; `installSoundCueBridge`, `playCueSlot`, `playSlotOr`, `screenMusic`.
- `src/lib/fx/gameSounds.ts`: the arcade observers.
- `docs/sound-cues/cue-sheet.md`, `cue-sheet.csv`: every cue (generated: `bun scripts/sound-cue-sheet.ts`).
- `docs/sound-cues/shared.md`: the shared cues.
- `docs/sound-cues/room.md`: the room's big-moment cues (`room.prepare`, `room.round.1`–`6`, `room.finalRound`, `room.winner`…).
- `docs/sound-cues/word.md`, `number.md`, `speed-attention.md`, `pattern.md`, `logic.md`: the puzzle polish cues.
- `docs/sound-cues/replays.md`: replay cues.
- `docs/sound-cues/arcade.md`: the arcade games' live sounds and their slots.
- `docs/sound-cues/core.md`: the app's own recorded sounds, voice lines and the synthesised placeholders.
- `docs/sound-cues/music.md`: music per screen and per game.
- `scripts/sound-manifest-check.ts`: proves the manifest, the sheet and the players agree.
