# Offline practice (31 Oct 2026)

Practice works with no signal (planes, the underground). Rooms, tournaments, the daily and challenges stay
online only. No game's rules, scoring, grading or stamps changed.

## How it fits together

| Part | Where | What it does |
| --- | --- | --- |
| Service worker | `src/lib/offline/sw.template.js`, written per build to `/sw.js` by `swPlugin.ts` (vite.config.ts) | Keeps the app files, the kept pages (`/`, `/practice`, `/profile`, `/tournaments`), fonts, tile images, sounds and music. App files live in one cache per build (`joulz-app-<build id>`, the newest two kept); media in one shared cache (`joulz-media-v1`), so a new build only downloads what changed. Navigations go to the network first (4 s), then the kept page, then a small offline page with a button to Practice. Server calls are never touched. |
| Registration and updates | `src/lib/offline/serviceWorker.ts` | Registers `/sw.js` (production only). A new build's worker installs and waits; it is told to take over only while the app updater's gate is "now" (no round on screen), so a run is never interrupted. The updater's reload onto a new build now hands over to the new worker instead of unregistering it and deleting every cache. |
| Practice packs | `src/lib/offline/packs.ts`, `practicePackFn` | Up to 10 deals a game (`PACK_MAX_DEALS`), topped up in the background while online (6 games a call, recently played first), skipped with the Offline practice switch off, on a connection the browser reports as metered or data-saving, or while a round is on screen. Since 4 Nov 2026 (`packGrowth.ts`): nothing until the device's first finished practice round (the top-up starts back on the list), then 3 deals a game, the target growing 5, 7, 9, 10 over later visits (a device that already held packs keeps 10); also skipped with Battery saver on or a 2G-class connection. A new device's server deals went from 950 on app open to 0, then 285 after its first round. A deal is the public half the phone plays plus the server's sealed token (the private half encrypted with the server-only key, exactly what every online practice round already carries; never readable on the phone). The sealed half of a pack deal also holds its pack seed and a digest of the public half. Each pack is tied to its game's stamps; a stamp change replaces it at the next top-up. A deal is used once. |
| Run queue | `src/lib/offline/queue.ts`, `practiceGradeQueuedFn` | Every run played from a pack (or with no connection, or whose answer couldn't be sent) is stored in IndexedDB (`joulz-offline`): game, stamps, pack seed, the full answer (move list or input log) and when it was played. With a connection (on opening, on reconnecting, on returning to the app, every 5 minutes) the sign-in is refreshed first, then the queue is sent oldest first to the same grading practice uses. The server's score is the one kept; a run whose deal was changed on the phone, or whose seal doesn't open, is rejected and shows "Couldn't be confirmed". A run stays queued until the server has confirmed or rejected it. Confirmed runs update the device's practice best (practice bests only: no room, tournament, daily or challenge reads the queue). |
| Screens | `src/components/offline/` | The slim banner "You're offline. Practice still works." on page screens (CSS from `<html data-offline>`, set before the first paint by `OFFLINE_BOOT`); the offline state with Go to Practice on Play, Tournaments, rooms, the daily and challenges (`OnlineOnly`: Play and Tournaments follow the connection, the others decide on entry so a room in progress is never swapped out); the Practice tab's "Played offline" list and pending clocks; the result screen of a run played offline (provisional or pending, then confirmed or Couldn't be confirmed); "Online only" / "None saved" marks on the list with no connection; the install card (iPhone Safari outside a home-screen app, `<html data-offline-install>`); Settings' Offline practice row (storage used, downloads switch). |

## Each game's offline status (`src/lib/offline/offlineStatus.ts`)

- **Plays offline, provisional score shown at once** (the simulation runs on the phone; its own score, carried in the
  run's counters, shows as provisional until the server's replay confirms it): every arcade, card, board and sports
  game, and the engine games Bonk, Pull! and Tenfall; retired Bastion, Dual, Hot Floor, Junction, Letterfall,
  Ricochet, Rooftop Run, Scrumper, Steady and Swerve.
- **Plays offline, score pending until the server grades it**: every other puzzle (Number, Speed, Attention,
  Pattern and Logic), retired Dig, and Mixed Signals (its run carries no counters, so no provisional score).
  Unblock's deals come from the database's bank, as online.
- **Online only** (the stage asks the server during play: a word checked against the server's dictionary or a move
  replayed against the sealed answer): Nucleus, Forage, Interlock, Slider, Roundabout, Lookout, Strikeout,
  Cryptogrid, Swapword. They get no pack. offline-check proves this list is exactly the stages that ask.

## Storage

About 16 MB on a phone with every pack full (offline-check reports the browser's own figure): app files ~4.5 MB,
sounds and music ~8 MB, tile images, fonts and icons ~1.5 MB, ~760 deals ~1 MB. The budget is 60 MB.

## Proof

`offline-check` (headless Chromium on a production build, 414×896 and 375×667, shard `play20`, ~5 min).
