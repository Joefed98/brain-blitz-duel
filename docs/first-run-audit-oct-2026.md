# First-run player experience audit (11 Oct 2026)

A read-only walk through the code path a brand-new player takes on a phone, from opening
the link to leaving after their first room. No app code was changed. The findings come
from reading the code; nothing here was tested on a device (Joe does phone testing).

## Assumptions

- The player is a stranger who has never seen Duelz, on a phone browser, and reads
  English. They arrive either at `/` (link to the app) or at `/duel/ABCD` (a link a
  friend shared from the lobby).
- "First visit" means no `duelz_display_name` in localStorage, no Supabase anonymous
  session and no audio unlocked yet. "Returning" means those exist.
- Timings come from `src/lib/duel/types.ts` and `startPresentation.ts`: start sting 6 s,
  round title 3 s, intro up to 33 s (30 s reading + 3-2-1), puzzle 20–123 s depending on
  the game, reveal 5 s (8 s for long-reveal types), round results 8 s, standings 10 s,
  winner reveal 6.3 s.
- A standard room is 6 rounds, one per category in `STANDARD_CATEGORIES`. With intros,
  puzzles and results, a room lasts roughly 10–15 minutes. The app never says this.
- Two different result paths exist: 2 players (`RoundResult`, `DuelOverall`,
  `FinalResult`) and 3+ players (`RoundResultsTable`, `Standings`, `Podium`). Both are
  covered.
- I assumed `ssr: false` on `/duel/$code` means a link preview in a chat app may show
  the root-route meta rather than the room meta. I did not check this.

---

## 1. Home screen (`src/routes/index.tsx`)

**Sees:** Mute toggle (top right), "Duelz" wordmark, the line "Up to 10 players. One
round per category. Fastest brain wins.", a mono caption "N puzzle games · M arcade
games", and two buttons: **Create room** (primary, with a sheen animation) and **Join
room**.

**Must understand:** that this is a multiplayer game that needs friends; that "room" is
the unit of play; what "category" means.

**Taps:** Create room or Join room.

**Friction:**
- No way to play alone. Practice (`/practice`) exists but nothing on the home screen
  links to it, so a stranger with no friends online has nothing to do.
- No "how it works" or example. "One round per category" assumes the player knows what
  the categories are and how many there are.
- Nothing says how long a game lasts (about 10–15 minutes).
- Page metadata disagrees with itself. The home route says "six timed puzzles" and
  "2–10 players"; the root route and `manifest.webmanifest` still say "1v1 Puzzle
  Duels" and "Three puzzles. Thirty seconds each." The installed app name and some link
  previews will show the old pitch.
- `twitter:card` on the root route is `summary_large_image`, but there is no `og:image`,
  so shared links get no picture.

**First vs returning:** none on this screen. Returning players get no "Rejoin your
room" shortcut even if they still belong to a live room.

## 2. Create room (home, `mode === "create"`)

**Sees:** a "Display name" field (autofocus, 14 characters max, placeholder "Your name"),
**Create room**, **Back**.

**Taps:** type a name, tap Create room (or press Enter).

**Friction:**
- An empty name gives "Enter a display name." with a shake and buzz. It's clear, but
  there's no hint before tapping that a name is needed.
- **Wait with little feedback:** the button shows "Please wait…" while the server
  creates the room. On a first visit this also waits on anonymous sign-in
  (`ensureSession`). If sign-in fails, the error is "Couldn't start a session on this
  device. Please try again." It doesn't say why (for example, private browsing or
  blocked storage).
- Server errors pass `error.message` straight through (`duel.functions.ts`, for example
  `throw new Error(error.message)`), so a stranger may see raw database text.

**First vs returning:** a returning player's name is pre-filled from localStorage.
A first-time player types it.

## 3. Join by code (home, `mode === "join"`)

**Sees:** Display name, then "Room code" shown as four large letter boxes over a hidden
input, **Join room**, **Back**.

**Taps:** name, then tap the boxes to type four letters (Enter in the name field moves
focus to the code).

**Friction:**
- The four boxes are drawn over a transparent `<input>`. If autofocus lands on the name
  field and the player taps a box, the keyboard appears. But the boxes don't look like a
  text field, and the caret is hidden (`caret-transparent`), so it's unclear whether
  typing is going anywhere until a letter appears.
- Pasting a full link or a code with a space or digit: everything that isn't a letter is
  stripped. A pasted link like `https://…/duel/ABCD` becomes letters from the URL, and
  the 4-letter cap keeps "HTTP", which gives "No room found with that code."
- Errors: "Room codes are 4 letters.", "No room found with that code.", "Game already
  started.", "That room is full (10 players).", "This room has been disbanded." All are
  short and clear. "Game already started" gives no way forward (spectate, wait, or ask
  the host for a rematch).

**First vs returning:** same as create.

## 4. Arriving by a shared link (`/duel/$code`, not yet in the room)

This is how most friends arrive: the host taps **Share link** in the lobby, which sends
"Join my Duelz room — code ABCD — https://…/duel/ABCD".

**Sees:** "Loading room…", then, because the visitor isn't a player yet (`!me`):

> **You're not in this room**
> Head back home and join with the room code.
> [Back to home]

**Friction (severe):**
- The link doesn't join. The visitor has to remember the code, tap Back to home, tap Join
  room, type a name, then type the code again. The code isn't pre-filled.
- The wording sounds like a refusal ("You're not in this room"), not an invitation.
- On a first visit the anonymous sign-in happens here as well, so "Loading room" can
  take noticeably long before this dead end appears.
- If the room has already started, they only find out after the detour through Join.

**Returning:** a player who already belongs to the room (same device) goes straight into
the lobby or the current phase. That path works well.

## 5. Lobby (`duel.$code.tsx` waiting branch + `RoomLobby.tsx`)

**Sees (everyone):** "Room code" label, a huge four-letter code, **Copy code** and (where
`navigator.share` exists) **Share link**, "N of 10 players", one card per player (crown
icon next to the host, "You" on your own card), a "Categories" heading, then a chat bar
at the bottom (`RoomChat`, labelled "Lobby").

**Host also sees:** three presets (**Standard**, **Arcade only**, **Puzzles only**), one
toggle chip per category, **Start game** (or a disabled "Need 2 players"), and a
**Disband room** link. Each other player's card has 🔊/🔇 (mute for everyone) and ×
(remove), with no confirmation.

**Non-host sees:** "Categories: Logic · Pattern · Speed · …" and "Waiting for host to
start…".

**Must understand:** that they're the host (creator) or a guest; that only the host
starts; what the categories mean; that they must invite people.

**Friction:**
- **The host role is never named.** The only sign is a small crown icon. Guests see
  "Waiting for host to start" with no idea who the host is unless they spot the crown.
- **The host isn't told what to do next.** The screen doesn't say "Share this code with
  friends, then press Start." "Need 2 players" on a disabled button is the only hint.
- **Copy code copies only the four letters, not the link.** A friend who receives just
  "ABCD" has to find the site first. **Share link** is missing on browsers without
  `navigator.share` (most desktop browsers, some Android webviews), leaving Copy code as
  the only option.
- **Category controls assume knowledge.** "Standard", "Arcade only" and "Puzzles only"
  aren't explained. Category chips use internal names (logic, pattern, speed, attention,
  word, number, arcade) with no example games. The number of rounds and the expected
  length aren't shown. Greyed-out chips explain themselves only through `title`, which
  phones don't show.
- **Guests have no Leave button.** Only the host has an exit (Disband). A guest who wants
  out must use the browser's Back button. That doesn't call `leaveRoom`, so they stay
  listed as active.
- **No way home.** The top-bar wordmark isn't a link.
- **The × remove button has no confirmation.** It's easy to remove a friend by mistake
  with a stray tap next to 🔊.
- 🔊/🔇 means "mute this player's chat for everyone", but it looks like a sound control.
- "Previous tournaments" (after a rematch) uses the word "tournament", which appears
  nowhere else.

**First vs returning:** a returning host gets the same lobby. Nothing remembers their
last category choice.

## 6. Start sting and round title (`DuelStart`, `RoundTitle`)

**Sees:** a full-screen animated bolt for 6 s with the voice line "prepare to duel",
then "ROUND 1" / the category name in capitals for 3 s.

**Taps:** nothing. There are no controls.

**Friction:**
- 9 seconds with no explanation of what's about to happen. For a first-timer this is
  mostly fine as a moment of drama, but the category word (for example "PATTERN") means
  little yet.
- Sound only plays if audio was unlocked by an earlier tap. A guest who arrived through
  Join has tapped; one who reloaded may hear nothing.

## 7. Round intro (`RoundIntro.tsx` + `PuzzleInstructions`)

**Sees:** "Round 1 of 6 · <category>", "auto-start in 27s", round pips, the game name in
large type, then a scrolling area with **Goal**, **How** (bold verb plus detail lines),
an animated demo or a static example, **Score**, an optional puzzle-specific line, and
"You have N seconds". A sticky **Ready** button sits at the bottom, with "k of n ready"
or "Waiting for opponent…" under it. In the last 3 s, a huge 3-2-1 countdown replaces
everything.

**Must understand:** how to play a game they've never seen, in under 30 seconds, while
others may already be tapping Ready.

**Taps:** Ready (optional; the round auto-starts).

**Friction:**
- **Score text is long and full of scoring terms.** `INTRO_SCORE` lines often run three
  to five lines on a phone, for example: "Make all five rows words: 100 points, plus up
  to 20 for using few moves and up to 30 for speed: the full 30 if you finish with at
  least half the time left. Not finished: 22 points for each row that is a word."
  Terms like "word points", "stages", "links", "par" and "speed bonus" assume the
  scoring model.
- **The How lines plus the demo can exceed the screen,** so the Score block needs a
  scroll, and the scroll area isn't marked as scrollable.
- **Ready pressure.** "k of n ready" is visible. When everyone else is ready, the round
  starts as soon as the last person taps. A careful reader feels rushed, and nothing
  says "take your time, the round waits up to 30 s."
- **"auto-start in Ns"** sits in small mono text at the top. It's easy to miss that the
  game will start without them.
- The Ready button turns into "Ready ✓" in the opponent colour, which may read as
  disabled or as belonging to someone else.
- Chat is available here but closes for the countdown. A first-timer may open chat and
  lose reading time.

**First vs returning:** identical every time. A returning player who knows the game
still sits through (or skips with Ready) the same full card, and a first-timer gets no
extra help. Nothing records which games this device has seen.

## 8. Puzzle (`GameLayout` + the game's `Stage`)

**Sees:** a top bar with their name, total and position (`SoloScoreStrip`, or both
players' totals in a 2-player duel; hidden for spotdiff/blockparty), "Round 1 of 6",
the game name, a **?** help button, round pips, a timer bar (most games), and the board.

**Taps:** the game's own controls. Many games finish on submit or completion; when time
runs out the server records whatever draft was saved.

**Friction:**
- **The ? help opens over the board while the clock keeps running** (in rooms the timer
  is shared, so it can't pause). Nothing says the clock is still running.
- **Score in the header from round 1.** "0 · 1st of 4" before anyone has scored can
  confuse.
- After submitting: the board dims, "LOCKED" stamps in, and the text reads "Waiting for
  other players…". In a 3+ room with a 120 s game, a fast finisher can wait more than a
  minute with nothing to do. Chat is turned off during play, so there's nothing else to
  look at.
- Per-game input conventions (drag vs tap, whether a Submit button exists) differ from
  game to game. Only the intro and ? explain them.

## 9. Reveal (`AnswerReveal`, `ArcadeReveal`)

**Sees:** "Round 1 of 6", game name, a seconds countdown, a ✓ or ✗ verdict circle, "The
answer was" (or the game's own heading), the stored score ("Scoring…" until it arrives),
and the solved board. Arcade games show a progress track with each player's marker.

**Taps:** nothing. 5–8 s.

**Friction:**
- **Partial credit with a red ✗.** A player who scored 88 of 150 sees the same ✗ as
  someone who scored 0. "Correct" here means "fully solved", and that isn't explained.
- "Scoring…" with dots can hang briefly with no reason given. Arcade replays are graded
  on the server.
- The countdown is tiny (top right). The screen changes on its own with no warning.

## 10. Round results (`RoundResultsTable` for 3+, `RoundResult` for 2 players)

**Sees (3+):** "ROUND RESULTS", "Round 1 · <game> · <answer>", "1 of 2" in the corner,
rows with position, name, a 7-px "ROUND WON" badge, elapsed time, a one-line summary
(for example "4/6 words · near miss…"), and the round score. The host gets **Next (8s)**;
everyone else gets "Standings in 8s".

**Sees (2 players):** both players side by side with score, summary and time. The host
gets **Next (8s)**.

**Friction:**
- **"1 of 2" means "screen 1 of 2 between rounds".** Strangers will read it as "round 1
  of 2" or "position 1 of 2".
- **Rows can be tapped to expand the full detail, but nothing shows this** (no chevron;
  the Podium uses +/− but this table doesn't).
- Badge and summary text at 7–9 px is hard to read on a phone.
- **Host-only Next.** The host may not realise they're holding up (or rushing) everyone.
  Guests don't know why the host has a button they lack.
- The final round hides positions to keep the winner secret. That's a nice touch, but
  unexplained: the numbers just disappear.

## 11. Overall standings (`Standings` for 3+, `DuelOverall` for 2)

**Sees:** "OVERALL STANDINGS", "After round 1 of 6", "2 of 2", rows with position, a
▲/▼ arrow or –, name, "+round score" and the running total, sliding into order. The host
gets **Next round (10s)**; guests see "Next round in 10s".

**Friction:**
- "2 of 2" again.
- Arrows and "+N" are unlabelled. They're fine for gamers, unclear for others.
- Two results screens back to back (18 s) after every round. With six rounds that adds
  nearly two minutes, and first-timers can't tell why there are two.

## 12. Winner reveal and podium / final (`WinnerReveal`, `Podium`, `FinalResult`)

**Sees:** "AND THE WINNER IS…" with a drumroll for 6.3 s. Then, in 3+ rooms: "1st" or "You
finished 3rd of 5", a three-step podium, an expandable list (+/− for each player's
per-round scores by game), and **Play again** (host) or "Waiting for host…" (guests),
plus **Leave**. In 2-player rooms: a large WIN / LOSS / DRAW, the totals, a per-round
breakdown, Play again (host) and a home button.

**Friction:**
- **Guests can't ask for a rematch.** "Waiting for host…" gives no sense of whether the
  host will press anything. If the host has left, guests wait with no feedback.
- **Play again keeps the same code and lobby,** but nothing tells guests they'll be
  pulled into the next game automatically if they stay.
- No prompt to share, invite more people, or try Practice.
- The breakdown uses game display names that a first-timer saw once, briefly.

## 13. Leaving

- From the podium: **Leave** calls `leaveRoom`, then goes home. That's clear.
- **Mid-game there's no leave control at all.** Browser Back leaves the player "active".
  In a 2-player room, the other player sees "Opponent disconnected — <name> dropped out
  of the duel" after 15 s, with only **Back to home**. The scores so far are lost from
  view, and there's no "keep playing alone" option.
- From a disbanded room: "Room disbanded — The host closed this room." plus Back to home.
  That's fine.

## 14. Practice (`src/routes/practice.tsx`)

**How players reach it:** only by typing `/practice`. No link exists anywhere in the UI.

**Sees:** "Practice", "One puzzle at a time. Personal bests stay on this device.", then
every category with every game as a full-width button showing only the game's name.
That's about 68 buttons in one long scroll, followed by a "Retired (N)" disclosure.

**Then:** "Making a puzzle…", then the same RoundIntro (with ← Back, "Best: — · this
device"; the timer starts only on **Ready**), then the puzzle, the reveal, and a result
card (big score, best, "Correct"/"Not quite" with time) with **Play again** and **Back**.

**Friction:**
- Hard to find (see above).
- **No way home from the practice list.** There's no Back or Home button, and the
  wordmark isn't a link.
- Game names alone ("Bang On", "Ascend", "Flash"…) don't help a stranger choose.
  There's no description, no category explanation, and no "Random" or "Try a mix" option.
- "Retired" games are shown to players with no explanation.
- "Not quite" covers both partial and zero scores.

**First vs returning:** "Best: —" on first visit, then the stored best. That's the only
difference.

---

## Cross-cutting

- **Audio:** sound needs a first tap (`installSoundUnlock`). Arriving by link and
  reloading mid-room can mean silence during the start sting. The mute toggle is always
  visible, which is good.
- **Waits with no player action:** start sting (6 s), title (3 s), reveal (5–8 s),
  results (8 s), standings (10 s) and winner (6.3 s) add up to about 32 s per round, about
  3 minutes per room. Only the host can shorten results and standings.
- **The host role** decides start, categories, Next and Play again, but nothing ever
  explains it, and the host can't hand it over.
- **The 2-player and 3+ paths look different** (WIN/LOSS vs podium). A group that grows
  from 2 to 3 in the lobby switches layouts with no explanation. Both are reasonable on
  their own.
- **Words a stranger has to decode:** room, host, category, Standard, tournament,
  Locked, par, speed bonus, word points, stages, links, "1 of 2", ▲/▼, near miss.

---

## Top 15 friction points, ranked by how likely they are to make someone give up

| # | Friction | Where | Fix | Type |
|---|---|---|---|---|
| 1 | A shared room link lands on "You're not in this room. Head back home and join with the room code." The link doesn't join, and the code isn't carried over. | `duel.$code.tsx` `!me` branch | When `!me` and the room is `waiting`, show an inline join card on that page: "Join ABCD", name field pre-filled from localStorage, one **Join** button calling `joinRoomByCode`. If the room has started, say so and offer "Watch for the rematch" or "Back home". At minimum, link to `/?join=ABCD` with the code pre-filled. | Flow |
| 2 | Nothing to do alone: Practice isn't linked anywhere. | `index.tsx` | Add a third home button, **Practice solo**, linking to `/practice`. Add a back/home control on the practice list. | Layout |
| 3 | The host isn't told what to do: no "share the code, then Start", and Start is disabled with only "Need 2 players". | Lobby | One line under the code for the host while alone: "Send this code to friends. Start when everyone's in." Make the disabled button read "Waiting for 1 more player". | Text |
| 4 | **Copy code** copies only "ABCD", and **Share link** is missing where `navigator.share` doesn't exist. | `LobbyActions` | Copy the full invitation ("Join my Duelz room: https://…/duel/ABCD (code ABCD)"). Always show a share/copy-link button, falling back to the clipboard. | Flow |
| 5 | Score text in the intro is long (3–5 lines) and full of scoring terms, and competes with the How lines inside a 30 s window. | `introScore.ts`, `PuzzleInstructions` | Cut the intro Score line to one short sentence ("Finish fast for the most points" / "More words = more points") and keep the exact formula behind ?. | Text |
| 6 | Guests can't leave the lobby or a game, and browser Back leaves them "active", which stalls others and later shows "Opponent disconnected". | Lobby, `GameLayout` | Add **Leave room** for guests in the lobby, and a small leave control (with a confirm) in the game top bar that calls `leaveRoom`. | Layout |
| 7 | The host role is never named, and guests see "Waiting for host" with only a crown icon. | `RoomLobby` | Label the host's card "Host". For guests: "Waiting for <name> (host) to start". On the host's screen: "You're the host: you choose categories and start". | Text |
| 8 | The ? help opens over the live board while the clock keeps running, with no warning. | `PuzzleHelp` | Add "The clock is still running" to the help card in rooms, or show the timer bar above the overlay. (The clock can't pause in rooms.) | Text |
| 9 | The 2-player "Opponent disconnected" screen is a dead end that hides the scores. | `duel.$code.tsx` | Show the scores so far, "<name> left. You win by default" (or "Game ended"), and offer **Play again** or **New room**. | Flow |
| 10 | No sense of length or structure: "6 rounds, about 10–15 minutes, one game per category" appears nowhere before Start. | Home, lobby | Under the category chips: "6 rounds · about 12 min". On home: "Play 6 quick brain games against friends". | Text |
| 11 | A red ✗ on partial credit ("Not quite" in practice) feels like failure even when the player scored well. | `AnswerReveal`, practice result | Show ✗ only for 0 points. Use a neutral or amber "Partly solved" mark for partial scores. | Layout |
| 12 | Cryptic results chrome: "1 of 2" / "2 of 2", ▲/▼ with no labels, 7–9 px badges, tap-to-expand rows with no hint. | `RoundResultsTable`, `Standings`, `RoundResult` | Replace "1 of 2" with "This round" / "Overall". Add a chevron to expandable rows. Raise badge and summary text to at least 11 px. | Text / layout |
| 13 | Category presets and chips (Standard / Arcade only / Puzzles only; logic, pattern…) are unexplained, and the disabled-chip reason is only in `title`, which phones don't show. | `RoomLobby` | One-line description under each preset ("Standard: one game from each category"). Tap a chip to see two example games. Explain disabled chips inline. | Text |
| 14 | Long fixed waits after every round (reveal + results + standings ≈ 23–26 s), with guests unable to skip and fast finishers idle while locked. | Phase timings | Merge results and standings into one screen with two tabs, or let the server advance once every active player taps "Next". Show the other players' locked or still-playing status while waiting. (Timing changes are presentation flow, not scoring, but still check rule 5: every device must see the same schedule.) | Flow |
| 15 | Mixed pitch: the manifest, root meta and installed app name still say "1v1 Puzzle Duels" and "Three puzzles. Thirty seconds each", and shared links have no preview image. | `manifest.webmanifest`, `__root.tsx` | Align all copy with "Up to 10 players · 6 timed rounds", and add an `og:image` (1200×630) so shared room links look like an invitation. | Text |

### Honourable mentions (not ranked)

- The code-entry boxes hide the caret, and pasting a full URL keeps the letters "HTTP".
  Fix: when the pasted text contains `/duel/`, take the four letters after it.
- Raw server error text can reach the home screen (`throw new Error(error.message)`).
  Map it to "Something went wrong. Try again."
- The × remove-player button needs a confirm. 🔊/🔇 should read "Mute chat".
- The practice list has about 68 unlabelled buttons and exposes "Retired" games. Add
  one-line descriptions, a **Random game** button, and hide Retired unless a dev key is
  present.
- Remember which games this device has seen. Show a shorter intro for games already
  played and the full card the first time. This is presentation only, so no stamp is
  needed.
- The home screen could offer "Rejoin ABCD" when this device still belongs to a live
  room.

## Notes for whoever picks this up

- All the fixes above are presentation, copy or room flow. None changes grading, puzzle
  generation or scoring, so no version stamp is needed. The exceptions are #14 if it
  changes stored phase timings, and #9 if it changes how a forfeited duel is scored;
  those touch room rules and need Joe's call.
- Fix #1 must keep rule 5: joining from the link page has to go through the same
  `joinRoomByCode` server function. Nothing gets generated per device.
- Device behaviour (keyboard focus on the code boxes, `navigator.share` support, audio
  unlock) needs Joe's phone testing to confirm.
