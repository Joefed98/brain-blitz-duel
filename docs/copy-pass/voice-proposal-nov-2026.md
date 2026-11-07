# Copy pass 2: voice proposal (7 Nov 2026)

**A proposal only; nothing is changed yet.** These are 60 player-facing strings that don't match DESIGN.md section 10:
short, dry, a bit cheeky, British, no "Oops", and no exclamation marks except "You win!". They come from
`docs/design-audit/strings.csv`, cross-checked against the current code on main (`file:line` is main's). Mark each
row ✓, ✗ or with your own wording, and I'll apply the approved rows in one PR. Any check that asserts a string I
change will be listed for your approval first, as in copy pass 1.

How the rows were picked:
- every exclamation mark outside "You win!";
- every "Please", "Could not", "Unknown", "invalid" and other stiff or system-sounding line;
- wording that's wrong today (room codes have had digits since the room-code change, and "Duelz Plus");
- typed capitals, which DESIGN.md section 11 says come from CSS;
- places where we know a name or number but don't use it.

Legal text (the beta terms) is left alone; that's for your adviser.

## Celebrations and moments (exclamation marks)

| # | Screen | Where | Current | Proposed |
|---|---|---|---|---|
| 1 | Practice reveal, New best moment | `components/duel/NewBestMoment.tsx:37` (and the banner text at :60) | New best! | New best |
| 2 | Arcade results headline | `components/duel/ArcadeCelebration.tsx:10` | Full clear! | Full clear |
| 3 | Arcade results headline | `components/duel/ArcadeCelebration.tsx:11` | New personal best! | New best |
| 4 | Arcade results headline | `components/duel/ArcadeCelebration.tsx:12` | Full clear, new best! (after copy pass 1) | Full clear, new best |
| 5 | Podium, a shared first place | `components/duel/Podium.tsx:214` | Joint winner! | You share the win |
| 6 | Daily results, streak banner | `lib/fx/celebrations.ts:95` | 7-day streak! | 7 days running |
| 7 | Prepare for the winner (room) | `components/duel/WinnerReveal.tsx:80` | AND THE WINNER IS… (typed in capitals) | And the winner is… (capitals from CSS, section 11) |
| 8 | Arcade play, the shared success layer | `lib/arcade/arcadeFx.renderer.ts:687` | FULL CLEAR! | FULL CLEAR |
| 9 | Arcade play, the shared success layer | `lib/arcade/arcadeFx.renderer.ts:305` | CLEAR! | CLEAR |
| 10 | Arcade play (Flightpath) | `lib/arcade/arcadeFxGames.renderer.ts:1161` | BULLSEYE! | BULLSEYE |
| 11 | Arcade play (Flightpath) | `lib/arcade/arcadeFxGames.renderer.ts:1184` | ALL TEN ON TARGET! | TEN FROM TEN |
| 12 | Arcade play (Coral Pop) | `lib/arcade/arcadeFxGames.renderer.ts:1219` | REEF CLEARED! | REEF CLEARED |
| 13 | Arcade play (Roofbound) | `lib/arcade/arcadeFxGames.renderer.ts:1251` | JUST IN TIME! | CUTTING IT FINE |
| 14 | Arcade play (Ringer) | `lib/arcade/alleyroll.renderer.ts:146` | FULL POINTS! | FULL MARKS |
| 15 | Arcade play, all other canvas banners | `lib/arcade/*.renderer.ts` (149 strings in all, e.g. "SAVED!", "BOING!", "TRICK SHOT!", `LEVEL ${n}!`) | trailing "!" | The same words, no "!" (one mechanical change; the canvas text is display only, no stamps) |
| 16 | Replay moment cards | `lib/replay/moments.ts:433`, `:452`, `:454` | CLEAR! / FULL CLEAR! | CLEAR / FULL CLEAR (matching 8–9) |
| 17 | Cryptogrid, solved | `puzzles/codeword.tsx:279` | Cracked! | Cracked it |
| 18 | Exact reveal | `puzzles/targetNumber.tsx:553` | Target hit! | Spot on |
| 19 | Checkout, the big-finish chip | `puzzles/checkout.tsx:746` | ★ Big finish! | ★ Big finish |
| 20 | Tempo help | `lib/duel/instructions.ts:1404` | FEVER doubles notes! | FEVER doubles your notes. |
| 21 | Rainbow Bridge help | `lib/duel/instructions.ts:1603` | The pot moves! Time your release so the coin rolls into it. | The pot moves. Time the release so the coin rolls in. |
| 22 | Meteor help | `lib/duel/instructions.ts:964` | a meteor shower drops 3 rocks! | a meteor shower drops 3 rocks. Duck. |

## Errors and refusals

| # | Screen | Where | Current | Proposed |
|---|---|---|---|---|
| 23 | Play, Create a room failing | `lib/duel/duel.functions.ts:230` | Could not create a room right now. Please try again. | Couldn’t make a room just now. Give it another go. |
| 24 | Any screen, first start | `lib/duel/session.ts:25` | Couldn’t start a session on this device. Please try again. | Couldn’t get started on this device. Try again. |
| 25 | Daily / challenge name | `lib/duel/boardName.server.ts:61` | That name can’t go on the leaderboards. Please pick another one. | That name can’t go on the board. Pick another. |
| 26 | Play, Create a room button while busy | `routes/index.tsx:371` | Please wait | Making your room |
| 27 | Play, Join | `routes/index.tsx:243` | Room codes are 4 letters. | Room codes are 4 characters. (new codes have digits since the room-code change) |
| 28 | Play, Join | `lib/duel/duel.functions.ts:409` | No room found with that code. | No room with that code. Check it with the host. |
| 29 | Play / link join | `routes/index.tsx:263`, `components/duel/JoinFromLink.tsx:80` | Something went wrong. Try again. | That didn’t work. Try again. |
| 30 | Play, Join | `lib/duel/duel.functions.ts:366` | Too many room lookups. Try again in a few minutes. | That’s a lot of codes. Give it a few minutes. |
| 31 | Join / challenge | `lib/duel/duel.functions.ts:401`, `challenge.functions.ts:81`, `:99` | Too many tries. Wait a few minutes and try again. | That’s a lot of tries. Give it a few minutes. |
| 32 | Link join | `lib/duel/duel.functions.ts:419`, `:434` | Game already started. | This game’s already started. |
| 33 | Room actions | `lib/duel/duel.functions.ts:561`, `:623`, `roomSettings.server.ts:35` | The game has already started. | This game’s already started. (one wording for 32 and 33) |
| 34 | Lobby, Start game | `lib/duel/duel.functions.ts:471` | You need at least two players. | You need at least two players. Rope someone in. |
| 35 | Lobby, Room settings (if Plus is ever on) | `lib/duel/roomSettings.server.ts:37` | Room settings are part of Duelz Plus. | Room settings are part of Joulz Plus. (old name) |
| 36 | Room settings sheet | `lib/duel/roomSettings.ts:221` | Choose at least one category. | Pick at least one category. (the sheet's own line says "Keep at least one category.") |
| 37 | Room settings sheet | `lib/duel/roomSettings.ts:227` | Choose valid categories. | Some of those categories don’t exist. |
| 38 | Room settings (server) | `lib/duel/roomSettings.server.ts` ("Choose at least one category with active games.") | Choose at least one category with active games. | Pick at least one category with games in it. |
| 39 | Lobby colour | `lib/duel/playerLook.server.ts:178` | That colour can’t be stored yet. | That colour isn’t ready yet. Pick another. |
| 40 | Link join, room full | `lib/duel/types.ts:605` | That room is full (16 players). | That room’s full. 16 is the most. |
| 41 | Link join button | `components/duel/JoinFromLink.tsx:176` | Room is full | Room’s full |
| 42 | Link join, finished game | `components/duel/JoinFromLink.tsx:118` | Ask the host to play again, then open the link again. | Ask the host to play again, then reopen the link. |
| 43 | Podium, Play again | `lib/duel/duel.functions.ts:1079` | Could not play again yet. | Can’t play again just yet. |
| 44 | Reveal / challenge board | `lib/duel/reveal.server.ts:60` | That round has not finished yet. | That round isn’t over yet. (asyncRoom and challenge say "isn’t finished yet"; one wording for all three) |
| 45 | Reveal / async rounds | `lib/duel/reveal.server.ts:63`, `asyncRoom.server.ts:503`, `:596` | Unknown round. | That round doesn’t exist. |
| 46 | Daily | `lib/duel/daily.functions.ts:59`, `:93` | Unknown daily. | That daily doesn’t exist. |
| 47 | Practice | `lib/duel/practice.functions.ts:25` | Practice is unavailable right now. | Practice is down for a moment. Try again shortly. |
| 48 | Practice | `lib/duel/practice.functions.ts:61`, `:148`, `:297` | Bad practice puzzle. | That puzzle didn’t load. Try another. |
| 49 | Any server call with a stale sign-in | `integrations/supabase/auth-middleware.ts:71`, `:90` | Unauthorized: Invalid token | Your session ran out. Reload to carry on. |
| 50 | Daily / challenge, no signal | `components/async/AsyncRun.tsx:193`, `ChallengeShare.tsx:185`, `routes/daily.tsx:228` | Couldn’t reach the server. Check your connection and try again. | Can’t reach us. Check your signal and try again. |
| 51 | Challenge loading | `components/async/AsyncRun.tsx:159` | This challenge couldn’t be loaded. Try again in a moment. | Couldn’t load the challenge. Try again in a moment. |
| 52 | 404 page | `routes/__root.tsx:47` | Page not found | Nothing here |
| 53 | Error page (and `lib/error-page.ts:22`) | `routes/__root.tsx:71` | Something went wrong on our end. You can try refreshing or head back home. | That one’s on us. Refresh, or head back home. |

## Waiting, empty and other lines

| # | Screen | Where | Current | Proposed |
|---|---|---|---|---|
| 54 | Room, two players, waiting | `routes/duel.$code.tsx:1316`, `components/duel/RoundIntro.tsx:358` | Waiting for opponent | Waiting for Sam (their name; section 10 says use it) |
| 55 | Podium, a guest | `components/duel/Podium.tsx:341` | Waiting for host… | Waiting for the host (as FinalResult says) |
| 56 | Answer reveal, first run | `components/duel/AnswerReveal.tsx:850`, `ArcadeReveal.tsx:341` | Your first score for this game | First go at this one |
| 57 | Results replay | `components/replay/ReplayPanels.tsx:522` | Replay not available for this game yet | No replay for this game yet |
| 58 | Daily board, nobody played | `components/daily/DailyBoard.tsx:96` | No one finished this day. | Nobody finished that day. |
| 59 | Practice search, no results | `routes/practice.tsx:858` | No games match | Nothing matches that |
| 60 | Chat, empty | `components/duel/RoomChat.tsx:364`, `RoomPanel.tsx:201` | No messages yet. | Quiet in here. |

## Left as they are (checked, already on voice)
"Quick games. Real rivals.", "Score big, win the room.", "Send the link to friends. Start when everyone’s in.",
"Until then, start a room with friends or sharpen up in Practice.", "You’ve made a lot of rooms. Try again later.",
"That’s a lot of challenges. Try again in a while.", "This challenge link doesn’t work. Check it with whoever sent it.",
the share texts ("I came 2nd in a 6-round Joulz room – 612 pts."), "You win!" (the one allowed exclamation) and
"Pull!" (a game name, section 8 of CLAUDE.md: names stay in gameNames.ts; flag it to your adviser rather than here).
