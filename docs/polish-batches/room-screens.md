# Polish batch R: room and other screens (25 Oct 2026)

Presentation only. No scoring, ranking logic, round flow, timers, server calls, data, routes, storage
keys or version stamps changed. Game play screens, the game frame (GameFrame, game-frame.css, PhoneShell's
frame code), the toolkit, game code and the four tab pages are untouched (seven parallel PRs own them).
Everything was drawn in headless Chromium and measured in code; Joe does all device testing.

Before-and-after overview sheets: `screenshots/polish-batch-r/` (before = main's `screenshots/screen-audit/`,
after = this branch, the same `scripts/shots/screen-audit-shots.ts` states at 414×896 and 375×667).

## What changed

### One look for every non-tab skinned screen
`src/polish-layout/room-screens.css`. Every `[data-skin]` screen that is not a tab page (lobby, link join,
round results, standings, podium and final results, the answer reveal's chrome, daily and challenge
screens, terms, the settings sheet, the chat sheet and confirm dialogs, the first-time intro) now resolves
the page and skin tokens to the tab pages' palette and Archivo:

- sentence case everywhere (the copy is written that way; the old `uppercase` / Saira kickers are turned
  off in this scope); headings Archivo 800;
- the skin's glass cards (`th-card`, `data-tint`) are flat `#17171B` panels; lists are `.rs-list` panels of
  divided `.rs-row`s;
- `--primary` is neutral (#F3F1EC): every old gold accent (`text-primary`, `bg-primary`, gold outlines,
  the gold top score, the gold "me" border) turns the page's light text. Gold is only on the actions that
  play, which carry the gold shine explicitly (`th-btn-gold` / `ap-btn-gold`): Start game, Ready,
  Continue, Play again, Join room, the daily and challenge Play / Continue, Create a room, I agree,
  Let's play. Teal and gold-outline buttons (Share, Copy link, Challenge someone else, Your results,
  Leaderboard…) are neutral outlines;
- "You": a 3 px left bar in your own player colour (`data-you`, `--you`) and "(you)" after the name;
- the tab pages' tap feedback (`.press`) and a flat `#0D0D0F` page behind, the home-bar strip still
  `--screen-edge`.
- `data-skin-off` (a game's own art inside a reveal or replay) is unchanged.

### Wordmark
`AppWordmark` (JOULZ, gold Z, logo mark) in PhoneShell's non-play top bar, the first-time intro and the
404 page. `src/components/duel/Wordmark.tsx` is deleted (no users left).

### Room footer and header menu
`src/components/duel/RoomFooter.tsx`. Every room screen has one 68 px footer row (102 px with a 34 px home
bar): the 52 px chat button (`RoomChatButton`, a small light unread badge with the count, never gold)
and the screen's main action (and Share where there is one). The room route hands the chat button down
(`RoomChatSlot`); RoomChat keeps the sheet, toast and reactions (`bar={false}`), and the emoji reactions
moved into the messages sheet under the composer, so the input is never truncated ("Chat…" fits).
Disband room (host) and Leave room / Leave (guests, finished games) are in a "⋯" menu (`RoomMenu`) in the
header; each still goes through its confirm. A list that can still scroll fades at its bottom (`.rs-scroll`
with `data-more`, and the footer's 16 px fade).

### Screens
1. **Lobby**: "Room code" over the code in white, Copy link and Share as secondary buttons beside it;
   "Players" with "n of 10" and a neutral meter (the celebrations charge meter, now neutral); one panel of
   players, "Host" as a neutral pill on the host's row; my row "(you)" with "Tap to change your colour" and
   "Change ▾"; each other player's row (host's view) has one "⋯" button (Mute … for everyone, Remove …,
   which now confirms in the shared dialog). "Game mix": a neutral segmented control (Standard / Arcade
   only / Puzzles only) and category chips in their own colours (tinted when on, grey when off).
   The permanent "🔊 Chat · ×" caption and "You're the host" pill are gone (the row menu and Host pill say it).
2. **Game intros** (RoundIntro): the game frame's 60 px header (back in practice, the name over the
   category dot and "{Category} · Practice / Round n of N", "No best yet" or "Best 132", the room's "⋯"
   menu, the sound button), the play screen's category gradient behind, the still or demo in a tray that
   hugs it (IntroStage measures what it draws; still and demo trays cross-fade, nothing moves), and the
   auto-start countdown as a 44 px ring in the category colour beside a gold Ready (with the chat button
   in a room). The big title line is gone (the header carries the name), which gives the demo box more
   height at 375×667.
3. **Answer reveal**: 16 px gutters; a verdict row (tick in the category colour or cross, "Solved in
   53.2 s" in sentence case, the score in white); the board in a tray placed on its drawn box
   (`useRevealTray`, the game frame's `boardBox`; the board's own layout is untouched); in a room a row of
   avatars with "n of N finished · results in Xs". Arcade: the chart in a `#17171B` panel over a darker
   backdrop, names on pills in each player's colour (text still #F3F1EC), the score in white.
4. **Standings**: one title line ("Standings" and "After round n of N"); the OVERALL duplicate and the
   legend line are gone; rows with medal, movement (▲ green, ▼ red, – grey), avatar, name, +points and the
   total in white; above Continue a round-winner card and, before the last round, the next round's game
   (icon tile, name, category). Two-player standings use the same rows.
5. **Ties** (below).
6. **Podium and final**: a compact podium (flat steps with medals), the hero larger (60 px) standing on the
   top step's right end, the winner's name and total kept clear of it; all six rows (48 px) fit at
   375×667; round breakdowns with game icon tiles. Footer: chat, Share (secondary), Play again (gold).
   Two-player final: "You win!" / "Priya wins" / "Draw" large in white, each score underlined in the
   player's own colour, rounds as rows with each game's icon tile, the winning score bright and the
   losing one grey.
7. **Settings sheet**: tab-page panels: switches for Sound effects and Music, one Volume row (sets both
   channels), a neutral Arrows / Joystick segmented control, rows for How it works, Beta terms and Send
   feedback (when TALLY_URL is set).
8. **Daily results, board, challenge, terms, first-time intro**: the same rules; the daily's segmented
   tabs are neutral; Leaderboard and Share are secondary; the terms are plain readable text (15 px,
   #D6D3DC) with no gold-bordered card; the first-time intro uses AppWordmark, the logo mark between A and
   B, a neutral Next and a gold "Let's play".
9. **Errors**: one layout (`src/components/app/ErrorState.tsx`) for the 404 page (replacing the starter
   template), room not found (with a room-code box to try again) and challenge not found: a dimmed logo
   mark in a rounded square, a title, a plain explanation, Back to Play (secondary) and one gold action
   (Create a room, which opens Play where the room is made; Make your own challenge).
10. **Small fixes**: lobby row controls are one labelled 44 px "⋯" button; the chat placeholder is never
    truncated; row chevrons are 20 px and visible; Join now before the lobby opens says "Opens 7:45 pm"
    (its accessible name stays "Join now (opens 7:45 pm)").

## Ties: which case applies

The ranking code already breaks ties. Rooms rank by total points, then the total time used
(`rank` in `src/lib/duel/scoring.ts`, the tie-break time of `src/lib/duel/tieBreak.ts`); players level on
both share a position. The daily board ranks the same way (`rankBoard` in `src/lib/duel/daily.ts`). So the
order is kept, and the display (`src/lib/duel/tieDisplay.ts`, display only) explains it:

- level on points but placed apart by time: "Level on 230 · ahead on time" on the best placed of the level
  group, "Level on 230 · behind on time" on the others;
- level on points and time: the place is shared ("=1"), the same medal, and "Level on 230";
- level on 0 shares the place without a note.

Applied to standings (and two-player standings), round results (the round's order is round score then
time used, `roundResultOrder`; its places now come from the same rule, `roundPlaces`, so a dead heat
shares a medal instead of being split by slot), the podium list and steps, and the daily board.
The final round's results still show no places (unchanged). `tie-display-check` proves it.

## Checks changed (each encodes the old look; no scoring, ranking or "nothing moves" rule loosened)

- `theme-check`: the non-tab skinned screens expect the room look's tokens (#0D0D0F, #F3F1EC, a neutral
  --primary) and Archivo for headings, body and numbers; the tab pages keep their expectations; the
  room footer counts as a fade like the old sticky footer; `.rs-list`, the error layout and the terms
  page count as the screen's panels.
- `chat-notice-check`: the composer (and its "Chat…" placeholder) is read with the messages sheet open,
  since the footer now holds only the chat button.
- `link-join-check`: the lobby's Leave room is checked in the route's "⋯" menu, still behind its confirm.
- `replay-flow-check`: Leave is no longer inside Podium (it is the route's header menu, now checked there).
- `celebrations-check` / `celebrations-browser`: the lobby meter sits under the "Players · n of 10" row;
  the "off" fixture (`scripts/fixtures/celebrations-off.json`) was re-recorded on this branch with the
  switch off, because every redesigned screen's markup changed (the comparison still proves the switch
  adds nothing).
- `scripts/theme-screens.ts` (theme-check's and no-wrap-check's screens): the standings are found by their
  one title ("Standings"), and the lobby's confirm dialog is opened through the header's "⋯" menu.
- `share-check`: Share is beside (after) Play again in the room footer and is the room look's
  sentence-case secondary button (it still carries `th-btn-teal`), not the old uppercase teal button.
- `celebrations-browser`: the off-markup comparison ignores the reveal and intro trays' measured inline
  position (display only), and the off recording now sets the switch off explicitly (the switch's default is on).
- New: `tie-display-check` (~1 s).

See the PR for each check's result.

## Assumptions

- "You win!" keeps its size but is sentence case; a shared first place reads "Joint winner!".
- The Volume row sets effects and music together; each channel's own level is still in the header's sound
  popover.
- The error screens' "Create a room" opens Play (where a room is made with a name), since making one needs
  the name field.
- The next-round preview names the next game during the standings (the round title then announces it as
  before).
- Category chips wrap onto three rows at 375 px; with a full lobby the page scrolls under the footer's fade.

## Shared requests (for the owners of the shared pieces)

- `src/components/duel/PhoneShell.tsx`: only the non-play top bar's wordmark changed (`AppWordmark` in
  place of the old `Wordmark`); the frame code is untouched.
- `src/lib/fx/celebrationCanvas.ts`: the podium hero is 60 px (was 46) and stands on the top step.
- `src/components/app/PublicGameCard.tsx` (shared by Play and Tournaments): only Join now's closed label.
- Game reveals draw their own "✓ SOLVED · 53.2S" lines inside `data-skin-off` (lightUp, shikaku, swapword,
  wordSlide…): the category batches may want to drop them now that the reveal's verdict row says it.
- `GameFrame`'s `CATEGORY_NAMES` and the frame's name / context classes are reused (read only) by the intro
  header; if the frame renames them, the intro follows.
