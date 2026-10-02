# Unify play timers and full-width arenas

## What will change
- Replace the shared circular/compact timer with one thin, full-width top bar used by every timed live round in duel and practice.
- Drain the bar from right to left, colour it green/orange/red by elapsed thirds, show small JetBrains Mono seconds at its right edge, and pulse both once per second during the final ten seconds.
- Remove timer-specific sizing and compact-mode branches so all screens reclaim that vertical space; retain the shared countdown sound and end-of-round music behavior.
- Make live arenas span the phone viewport minus an 8 px safe margin, removing the centred 430 px play-screen cap and inherited horizontal padding while preserving safe-area handling outside active play.
- Update arcade canvas fitting so width drives the arena and height adapts, rather than preserving a fixed world aspect ratio by shrinking width when vertical space is tight.
- Audit puzzle-specific centred widths and height-fitted aspect ratios, adjusting live stage wrappers where they prevent the arena from using the available width.
- Keep reveal screens fixed and no-scroll at 390×700 and 375×667, with no overlap.

## Verification
- Source-audit all registered puzzle stages and both duel/practice live-round hosts for old circular, boxed, or duplicated countdown displays.
- Check all changed layouts mathematically at 390×700 and 375×667 without running browser tests.
- Run focused checks and TypeScript validation, then inspect the preview build diagnostics.
- Report why screens were narrow and list every screen changed.

## Technical details
- Keep one shared timer component and one shared timer-slot contract in the duel and practice hosts; puzzle-internal phase/progress indicators remain only when they are not the round countdown.
- Preserve deterministic arcade world coordinates by changing only render and pointer transforms; simulation units, input logs, and server replay remain unchanged.
- Record the shared timer and play-width ownership rules in the project architecture notes.
