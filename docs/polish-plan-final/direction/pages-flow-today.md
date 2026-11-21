# Joulz pages and flow, as built today (branch fable-polish-plan, 715d0a9e, read 20 Nov 2026)

Paths are under ``. Read-only survey; nothing run except two scratch word-count scripts.
**CLAUDE.md is behind the code in places** (flagged "≠ CLAUDE.md"). Live game count: 83 (51 puzzles, 32 arcade).

## 0. Switches (all live values)

| Switch | Value | File | Effect while off |
|---|---|---|---|
| `SHOP_TAB_ENABLED` | false | `src/config/shopConfig.ts:17` | Shop tab, `/shop`, coin counter only for accounts on `shop.testers` (`useShopOn`, `src/lib/identity/shopSwitch.ts:54`) |
| `PASS_FOR_EVERYONE` | false | `src/config/passConfig.ts:11` | pass (Shop → Pass, Home "This week", Joules lines) testers only |
| `PLUS_FOR_EVERYONE` | false | `src/config/plusConfig.ts:10` | Plus part, Daily archive, PLUS chip testers only |
| `RATED_PLAY_FOR_EVERYONE` | false | `src/config/ratedConfig.ts:15` | rated testers only; guests never (`useRatedStatus` returns null, `src/lib/rated/ratedApi.ts:76`) |
| `RATED_FORMATS_ON` | bo3 only | `src/config/matchmakingConfig.ts:13` | picks on: Mixed, All puzzles, All arcade (`RATED_CHOICES_ON` :22) |
| `TOURNAMENTS_FOR_EVERYONE` | false | `src/config/tournamentConfig.ts:15` | everyone else gets "Coming soon"; kinds on: arena, score_attack (:18) |
| `FIRST_OPEN_ONBOARDING` | false | `src/config/betaConfig.ts:76` | the three-screen FirstOpen overlay never shows (`__root.tsx:246–281`) |
| `HOME_BELL` | false | `src/config/homeConfig.ts:8` | no bell in Home's header |
| `PUSH_FOR_EVERYONE` | false (testers #1, #2) | `src/config/pushConfig.ts:23,26` | no notification ask |
| `PUBLIC_GAMES` / `HOUSE_BANNERS` | `[]` / `[]` | `src/config/publicGames.ts:42`, `banners.ts` | no public game card anywhere; desktop banner slot hidden |
| `GOOGLE_/APPLE_SIGN_IN_ENABLED` | false | `src/config/accountConfig.ts:8,11` | email code only |
| `TALLY_URL`, `DISCORD_URL` | "" | `betaConfig.ts:27,42` | no Send feedback link, no Discord button. `CONTACT_EMAIL` = support@joulz.uk (More → Support shows) |
| `FX_CELEBRATIONS` | true | `betaConfig.ts:51` | |
| `ARENA_CABINET_LEFT` | false | `src/lib/gameFrame/arena.ts:49` | the new left "Cabinet" panel skeleton is not drawn |

## 1. Route map (`src/routes/`, 29 routes + root)

| Path | What | Who | Reached from | Gate |
|---|---|---|---|---|
| `/` index.tsx | Home | all | Home tab, rail logo | none (offline: `OnlineOnly`) |
| `/play` play.tsx | Play hub: one gold action + 4 mode buttons | all | gold Play bar (Home, Games), rail Play | rated block only if rated status non-null |
| `/rooms` rooms.tsx | Create / join by code / rejoin / public game / Challenge a friend | all | **only** `/play` → Rooms (or Play's Create with no stored name, play.tsx:97) | beta terms on Create/Join |
| `/practice` practice.tsx | Games catalogue; `?page=<id>` game page; `?game=<id>` deal + full intro; also holds the practice round, reveal | all | Games tab; tiles; Home cards | none (no terms) |
| `/tournaments` | hub (testers) or Coming soon | all | Tournaments tab; Play → Arena | `TOURNAMENTS_FOR_EVERYONE` / tester (server `hub.open`) |
| `/tournament?id=` | one event; Score Attack run | testers | hub row | same |
| `/tournament-rules?kind=` | rules text | testers | event page | same |
| `/shop` (`?part=shop|pass|plus`, `?section=coins`) | Shop · Pass · Plus | testers | Shop tab, coin counter, Home "This week", More → Plus | `useShopOn`; others redirected to `/` (shop.tsx:65–67) |
| `/more` | grouped list | all | More tab | — |
| `/profile` | Profile (uses `tabs="profile"`: tab bar with nothing lit) | all | avatar (accounts only), More → Profile | — |
| `/card` | own card large + Customise | accounts (guest → `/profile`) | Profile card tap | account |
| `/customise` | Avatar / Card / Badges and title / Games tabs | accounts (guest → `/profile`) | Profile, `/card`, `/badges` | account |
| `/badges` | all badges | accounts (guest → `/profile`) | Profile badges row | account |
| `/friends` (`?player=`) | friends, requests, profile | accounts; guest sees `AccountGate` | More, Profile, Home friend cards | account |
| `/leaderboards` | rating, category boards, picker | all can look | More; Profile | none |
| `/daily-board` | Daily top 100 | all can look | Daily page "Leaderboard", Daily results, board picker | none |
| `/daily` (`?kind=`) | Daily page, run, results | all | Home hero, Play → Daily, More → Daily, Profile step, streak chip | **`TermsGate` wraps the whole page** (daily.tsx:87–92) |
| `/daily-archive` | past Dailies | Plus members | Shop → Plus → Daily archive only | Plus (server; others see "The Daily archive is part of Joulz Plus.") |
| `/challenges` | practice challenges: In progress / New / Done / Friends | all | More → Challenges only | none |
| `/challenge` (`?code=`) | make / play a friend challenge | all | Rooms page card, Challenges → Friends, podium, shared link | `TermsGate` (challenge.tsx:94) |
| `/duel/$code` | room: link join, lobby, rounds, results, podium | all | Create/Join, link, Rejoin, rated/arena match | `TermsGate` on link join only (duel.$code.tsx:916–923) |
| `/rated` (`?pick&format` / `?match=`) | search, VS, result, tier reveal | rated testers; others → `/` after 2.5 s | Home next-match card, Play → Find a match | rated status; **no terms gate** |
| `/tiers` | tier ladder | rated testers (guest → `/`) | Home Ratings "All ratings", Profile, rated result | rated |
| `/settings` (`?section=notifications`) | all settings on one page | all | More, Profile gear, rail gear | — |
| `/account` (`?from&start`) | guest: sign-in/up flow; account: Settings → Account | all | save-progress sheet, Settings | — |
| `/terms` | beta terms (I agree / agreed date) | all | Settings → Beta terms | — |
| `/replay-lab`, `/dev-crash`, `/dev-design` | dev tools | dev builds only (`import.meta.env.DEV`, else notFound) | — | — |

## 2. Navigation today

- **Tabs** (`src/design/components/TabBar.tsx:32–43`): Home · Games · Tournaments · [Shop] · More. Shop only where `useShopOn`: **4 tabs for everyone today**, 5 for testers. Ids keep old names (`play` = Home `/`, `practice` = Games).
- **Phone / upright tablet**: `AppTabBar` bottom bar (PhoneShell.tsx:643) on tab pages only. **Gold Play bar** (`src/components/nav/PlayBar.tsx:15–46`, one word "Play") fixed above the tab bar on Home and Games only (PhoneShell.tsx:642) → `/play`.
- **Header** (`src/components/app/AppHeader.tsx:41–59`): `AvatarButton` (36 px) left, page title h1 (Home passes **no title**), optional lead (Home's streak chip), right: `CoinCounter` (testers) + one action (Profile: settings gear; Games: star total + search; Tournaments testers: "Beta").
- **Avatar** (`AvatarButton.tsx:47–74`): account → `/profile`; **guest → the Save-your-progress sheet, not Profile** (label "Your avatar: save your progress").
- **Rail** (computer ≥ 1024 with mouse, or landscape tablet main screens; `src/components/app/AppRail.tsx:28–105`): wordmark, avatar + name, gold Play, the tabs, then "Search games" box (→ `/practice?q=`), coin counter, settings gear. Compact 76 px (icons only) on every non-tab page except those passing `railTab` (game page, `/challenges`).
- **More** (`src/routes/more.tsx:62–91`): "Friends and rivals": Profile, Friends (guest → save sheet; badge = waiting requests), Leaderboards · "Compete": Challenges, Daily ("Puzzle and Arcade") · "Joulz": Joulz Plus (testers), Settings, Support (mailto) · wordmark footer.
- **Back**: Home is the root; tabs opened from Home are pushed, tab→tab replaces (`AppTabBar.tsx:29–56`).
- **Two or more levels deep (from Home, phone)**: Create a room = Play bar → Create a room (2; 3 via Rooms when no name stored). **Join with a code = Play bar → Rooms → code (3)**. Challenge a friend = Play → Rooms → card (3). Guest's Profile = More → Profile (2). Badges = More → Profile → Badges (3). Customise = Profile → Customise (accounts). Settings = More → Settings (2); Beta terms = +1. Leaderboards = More (2); Daily top 100 = Daily page → Leaderboard, or Leaderboards → picker (3). Challenges list = More → Challenges (2). Daily archive = Shop → Plus → row (3). Tiers = Home Ratings link (testers).

## 3. Home (`/`) section by section (`src/routes/index.tsx:175–252`, `src/components/home/HomeSections.tsx`)

Order is fixed; each section draws nothing when it has nothing.

| # | Section (component) | Text | Tap |
|---|---|---|---|
| H | header | avatar; streak chip (number + flame) only if streak > 0 → `/daily`; coin counter (testers) → `/shop?section=coins` | |
| 1 | `IntroCard` (`src/components/app/IntroCard.tsx:27–53`), slot "intro", first plain visit only | "NEW HERE?" / "Quick-fire games, played live with friends" / 1 "Create a room and share the code" 2 "Everyone plays the same game at once" 3 "Up to 200 points a round; most wins" / "Try a practice game" / "How it works" / ✕ | Try → `/practice?game=<warm-up>` (full intro); How it works → `Onboarding` 3 panels |
| 2 | `ShareWelcomeCard` (only `?ref=share` arrivals) | "Your friend played Joulz" / "Quick multiplayer puzzle and arcade games." | practice / public game |
| 3 | `DailyHero` (HomeSections.tsx:65–98), slot "daily" | card 1 "Daily Puzzle" + "New today" / "694 played today" / "2 rounds played" / "Done · 742" + gold "Play" / "Continue" / "Results"; card 2 "Daily Arcade" same line, **no visible button** (whole card is the button) | → `/daily?kind=` |
| 4 | `NextMatch` "Your next match" (:144–217): rated → else newest friend → else practice | rated: "Rated · Mixed" / "Placement 1 of 5" or "Joulz Rating 1,234" / gold "Play". friend: name / status / tag "Friend" / icon button. practice: game name / "Practice · Not played yet" or "Practice · Best 132" / play-icon button | → `/rated?pick&format` · `/friends?player=` · game page |
| 5 | `RatingTiles` "Ratings" (:221–253), rated only | tiles "Joulz Rating", "Puzzles", "Arcade" (values or "–"); right: "Placement n of 5" or link "All ratings" | → `/tiers` |
| 6 | `RecentlyPlayed` (:257–295), device practice history, ≤ 8 | "Recently played" / "All games" / tile + name each | tile → game page; All games → Games |
| 7 | `HomeScreenHint` (iPhone Safari, not installed, once) | "Add to Home Screen" / "Tap Share then Add to Home Screen" / "Full screen, and your streak and history stay in the app." | ✕ |
| 8 | `WeeklyCard` (:300–334), pass testers | "This week" / "Resets on Monday" / 3 challenge texts, Joules, n/N bars | → `/shop?part=pass` |
| 9 | `FriendsRow` (:338–369), accounts with friends | "Friends" / "All friends" / ≤ 8 cards: name, status | → `/friends?player=` |
| 10 | link | "How it works" | → `Onboarding` |
| — | Play bar "Play"; tab bar | | → `/play` |

- **(a) New guest, first open**: H (avatar only) · 1 IntroCard · 3 Daily hero ("New today") · 4 practice card **"Gridlock / Practice · Not played yet"** (warm-up defaults `unblock, hover, sudoku`, `src/lib/duel/practiceRecent.ts:37`) · 7 hint (iPhone Safari) · 10. No FirstOpen overlay, no terms, no name asked. Heading "Your next match" sits over a practice suggestion.
- **(b) Returning guest**: H (+ streak chip) · 3 (Continue / Results) · 4 practice card with last game and best · 6 Recently played · 10. Save-your-progress sheet opens here on the first tab page after a finished room / Daily / challenge (pop-up once more after the third; `src/components/account/SaveProgress.tsx:54–100`); **a practice game never triggers it**.
- **(c) Account (not a tester)**: H (mini card → Profile, streak) · 3 · 4 friend card if any friend else practice · 6 · 9 Friends · 10. No Ratings, no This week, no coins. Badge / season notices may overlay tab pages.
- **(d) Tester (rated + shop)**: H (+ coins) · 3 · 4 rated card · 5 Ratings · 6 · 8 This week · 9 · 10; 5 tabs; Shop dot, `ShopBackNotice`, `PassLevelNotice` above the tab bar.
- Late pops (per `docs/polish-plan-final/ui-research.md` §B, verified in code): 4, 5, 8, 9 are outside the before-paint slot system and appear when their network call answers.

`/play` (play.tsx:103–157): header "Play" + Back; hero art; **not rated (everyone today)**: gold "Create a room" + "Invite friends with a code"; **rated**: selector "Mixed · Best of 3" + gold "Find a match" / "Placement n of 5" + "Win +N · Lose −N" or "Your rating shows after 5 matches"; then modes: Arena ("Coming soon" / "Tournaments" / "Next at 20:00" / "On now"), Rooms ("With friends"), Practice ("83 games"), Daily ("Puzzle and Arcade").

## 4. First-run flows (new phone, guest, portrait; taps before the first tap inside a game)

Common start: static iOS splash PNG (installed app only) → SSR page under `LaunchSplash` (bolt + wordmark, gone at hydration, no fixed time; `src/components/nav/LaunchSplash.tsx:16–27`) → Home. Nothing blocks Home.

**(i) Shortest to a game today: 2 taps, both paths.**
- Path A (IntroCard): tap 1 "Try a practice game" → `/practice?game=unblock` → "Making a puzzle" → **full round intro** (header, Goal, demo box, How, Score, "You have 120 seconds", 30 s auto-start ring, gold "Ready"; `src/components/duel/RoundIntro.tsx:315–440`) → tap 2 "Ready" → the game starts **at once** (practice's Ready calls `beginRound`, practice.tsx:875–879; no 3-2-1). Screens: Home, loading, intro, game.
- Path B (Next match card): tap 1 play button → **game page** `/practice?page=unblock` (art, name, tags, goal + how, challenges, level selector, first-time "Difficulty levels" panel, gold "Play") → tap 2 "Play" → loading → **3-2-1 (3 s)** → game (`load(type, true)`, practice.tsx:496, 750). Screens: Home, game page, loading, countdown, game.
- Via tabs: Games → tile → Play = 3 taps. Via Play bar: Play → Practice → tile → Play = 4 taps.
- No terms, no name, no account on any practice path. If the player waits on the intro it auto-starts after 30 s + 3-2-1.
**(ii) First result screen**: the same 2 taps. The practice reveal follows the game with no tap (puzzles hold briefly for the signature beat); it stays until "Back" or gold "Play again" (`AnswerReveal.tsx:120–137`). Play again → loading → 3-2-1 → game (no intro, no game page). Back → the game page (URL holds `?page=`), Back again → catalogue.

**Daily (new guest): 4 taps + typing a name.** Home hero "Play" (1) → `/daily` → **Beta terms** screen (≈150 words) "I agree" (2) → Daily page ("Daily challenge" / "Same games for everyone. One go each. New at midnight UK time." / Daily Puzzle | Daily Arcade / card "Today · Daily Puzzle · 6 rounds, one go" / **"Name on the leaderboard" input** / gold "Play" / "Leaderboard" section) → type name, "Play" (3) → loading → round 1 intro, **no auto-start, waits for "Ready"** (4) → 3-2-1 → game. Then per round: reveal (timed 5–8 s, no button) → next intro (Ready again) … after round 6 (Arcade: 3) → results. Returning player with a name and terms: 3 taps (Play, Play, Ready), 6 Ready taps over a Daily Puzzle.

**Friend's room link (`/duel/CODE?ref=share`, new guest): 2 taps + name.** Link → splash → **Beta terms** "I agree" (1) → `JoinFromLink` ("You’re invited to room" / CODE / "3 of 16 players" / "Display name" / gold "Join room" / "Home"; `src/components/duel/JoinFromLink.tsx:138–205`) → type name, "Join room" (2) → lobby ("Waiting for Sam (host) to start") → host starts → Prepare to Duel 6 s → round title 3 s → intro (Ready optional; starts when all are ready or after 30 s) → 3-2-1 → game. The room link also marks Home's intro card seen (duel.$code.tsx:320).

**Create a room (guest, first time)**: Play bar (1) → "Create a room" (2) → no name stored so pushed to `/rooms` → type name → "Create a room" (3) → Beta terms "I agree" (4) → lobby; **cannot start alone** (`MIN_PLAYERS` 2, `src/lib/duel/types.ts:647`): "Send the link to friends. Start when everyone’s in." / "Waiting for 1 more player to join".

**Rated (tester account): 1 tap.** Home card gold "Play" (1) → `/rated`: "Finding an opponent" (Cancel) → VS (3 s hold) → room route: Prepare to Duel 6 s → round title 3 s → intro ("Ready" optional, tap 2) → 3-2-1 → game. Between games: reveal → Round results ("Continue (8s)") → Standings ("Continue (10s)") with the rated match header. End: winner reveal 6.3 s → hand-off → `/rated?match=` "Your result" skeleton → result. Via Play bar: Play → "Find a match" (2 taps). No terms gate on rated.

**Beta terms gate, exactly**: `TermsScreen` (`src/components/beta/TermsScreen.tsx:92–141`) appears before (1) all of `/daily`, (2) all of `/challenge`, (3) a room link's join, (4) Create/Join after the name check (`src/lib/home/useRoomStart.ts:61–64`). Never on Home, Games, a game page, practice rounds, `/rated`, tournaments, the Daily archive, or inside a room the device is already in.

**Name entry exists in five places**: `/rooms`, `/daily`, `JoinFromLink`, `/challenge`, Profile (guest "Display name").

Timings: `INTRO_WAIT_MS` 30 s + `INTRO_COUNTDOWN_MS` 3 s, `REVEAL_MS` 5 s (6–8 s for some games), result auto 8 s, standings 10 s (`src/lib/duel/types.ts:657–666`); Prepare 6 s, round title 3 s, winner reveal 6.3 s (`src/lib/duel/startPresentation.ts`).

## 5. Words on screens (visible body words; counted from the components)

| Screen | Words | Notes |
|---|---|---|
| Home, new guest | ≈ 60 (≈ 85 with the iPhone hint) | 37 of them are the IntroCard |
| Games catalogue | ≈ 45 + 51 or 32 game names | first visit adds the 26-word "Difficulty levels" panel |
| Game page | ≈ 90–130 | guide averages 38 words (goal + ≤ 3 how lines run together as one paragraph) + challenge rows + level line |
| Round intro | avg 59 game words (39–113) + ≈ 15 chrome | Goal avg 8, How avg 36, Score avg 14 (scratch count over all 83 games) |
| "?" help sheet | avg 252, max Orbit 555, Wavefront 524, Grappler 511 | opened from the game menu's "How to play" |
| Practice reveal | ≈ 25–40 folded | verdict, heading, parts line, "Your best: N" / "First go at this one", facts, Back / Play again |
| Profile, new guest | ≈ 85 | |
| More | ≈ 17 | |
| Tournaments (coming soon) | ≈ 21 | |
| Play hub | ≈ 20 | |
| Lobby (host alone) | ≈ 30 | |
| Rated result | ≈ 35–45 | mostly labels and numbers |
| Beta terms | ≈ 150 | six sections |
| Shop → Plus (tester) | ≈ 90 | five perks with a sub-line each + a 20-word note |

Longest explanatory strings (cut candidates), file:line:
1. `src/routes/tournaments.tsx:137` (28 w) "New dates are posted here. Until then, start a room with friends or sharpen up in Practice." (testers' empty state)
2. `src/lib/levels/levelIntro.ts:16` (22 w) "Pick Easy, Normal, Hard or Expert. Each level keeps its own best and stars. Rated matches and the Daily are always Normal."
3. `src/components/duel/Onboarding.tsx:35` (22 w) "Games score up to 200. Faster and sharper scores higher. Most points across the rounds wins."; `:29` (18 w) "Create a room and share the code, or join a friend’s. Everyone plays the same game at once."; `:24` (13 w)
4. `src/components/account/SignUpFlow.tsx:477` (22+ w) "You’re signing in to an account you already have. What you played on this phone as a guest stays with the…"
5. `src/components/plus/PlusPart.tsx:124` (20+ w) "Cancel any time. Plus never helps you win: ratings, scores and matchmaking are the same for everyone, and rooms…"
6. `src/components/pass/PassScreen.tsx:258` (20 w) "Season 1 only: Neon Circuit items are never sold in the shop and can’t be earned after the season ends."; `:142` (16 w) "Joules come from the Dailies, rated matches, tournaments, weekly challenges, and stars and challenges in Practice."
7. `src/components/friends/FriendsScreens.tsx:285` (20 w) "Add friends by username or send them your invite link. Then you can see when they’re about and play together."; `:894` (19 w)
8. `src/components/rated/TierLadder.tsx:111` (19 w) "End-of-season rewards come from your peak tier: the season emblem, a card frame and a title like “S1 Storm”."
9. `src/components/shop/CoinPacks.tsx:63` (18 w) "No random boxes: you always see exactly what you get. Coins can’t be cashed out, traded or gifted."
10. `src/routes/profile.tsx:134` (17 w) "Pick your colour in any room’s lobby. Save your progress to choose a full card in Customise."
11. Offline bodies, same sentence five times (15–18 w): index.tsx:68, play.tsx:44, rooms.tsx:48, daily.tsx:80, tournaments.tsx:51 "… need a connection. Practice games are saved on this phone, so they still work."
12. `src/routes/tournaments.tsx:90` (15 w) "Arenas, daily Score Attacks and cups, with trophies for your Profile. They open here soon."
13. `src/components/duel/JoinFromLink.tsx:111` (14 w), `:122` (14 w) "You can join the next one if the host plays again from the lobby."
14. `src/components/duel/RoomSettingsSheet.tsx:222` (14 w) "Each round gives points by place. Most points wins; level, the higher total score."
15. `src/components/account/SaveProgress.tsx:88` (13 w); `src/routes/daily.tsx:375` (12 w); `src/components/rated/RatedHome.tsx:331` (12 w); `src/routes/tournaments.tsx:166` (12 w); `src/routes/profile.tsx:303` (11 w); `src/routes/practice.tsx:484` (13 w, offline level notice).
16. Intro text by game (`src/lib/duel/instructions.ts`, `introScore.ts`), longest intros: Cue Ball 113, Five Hands 111, Top Bins 107, Curl Champ 107, Free Cell 103, Iron Wall 102, Home Run 96, Moon Climb 95. Example How line (Cue Ball): "Your set: each table deals you spots or stripes; the banner and the top bar show which. The black stays locked until they’re down." (24 w).
17. Help sheet header: "The clock keeps running while this is open." + "Tap outside or × to close" (`PuzzleInstructions.tsx:190,205`).

## 6. Game play screen (`GameLayout`, `src/components/duel/PhoneShell.tsx:127–301`; `GameFrame.tsx`)

- **Header, 60 px, one row, 3 columns** (`data-game-frame-header`): left = own avatar (`FrameMe`) + game name (`FrameName`, 19→13 px, then two lines) + context "{Category}, Practice" / "Round 2 of 6" / "Daily" (+ round pips; a room's "finished" ping lies over this half); centre = timer; right = score block (`FrameScore`: practice "Best", room total + place, Daily total) + opponent mini card (1v1 rooms) + room "⋯" + game menu "⋮" (`GameMenu.tsx`: Sound effects, Music, direction controls, "How to play").
- **Timer** (`src/config/gameFrameConfig.ts`): player's choice in Settings → Appearance: **Bar** (default; gold bar on the header's bottom edge, no number until the last 10 s, then red with seconds), Ring, Chip.
- **Puzzles only**: `GoalLine` under the header (goal text left, progress right, stage bar for staged games; `GameFrame.tsx:357–385`, short goals :30–70); `PhoneStatus` panel in spare space above the board on phones/tablets when ≥ 72 px is free, mirroring the board's own progress and status pills (`ArenaGamePanel.tsx:277–`); board on its tray; **dock** = controls directly under the board, ≥ 52 px (`src/polish-layout/game-frame.css:454–462`). Arcade: the world directly under the header, HUD inside the canvas.
- **Desktop / landscape tablet ≥ 1024 ("arena")**: no header; `ArenaGamePanel` in a fixed 320 px right panel (`ARENA_PANEL_W`, arena.ts:37; PhoneShell.tsx:635–639): avatar, name, context, menu, timer (larger), score, best + stars, board status, goal, next challenges (practice), Controls tab. In a room it sits on top of the 380 px room panel.
- **Pinned by checks**: `presentation-geometry-check` (CSS regex: `.game-frame-header` grid `minmax(0,1fr) 48px minmax(0,1fr)`, `height: 60px`; ping inside the left half) · `room-practice-parity-check` (heading class is exactly `game-frame-header`; timer at `[data-frame-timer] [role=timer]`; goal line on every puzzle, none on arcade; room box = practice box) · `safe-area-screens-check` (header 60 px at the top inset at six sizes; context text fits) · `arcade-play-check` (header 60 px, arena directly under, text ≥ 12 px bar the 11 px score label) · `phone-gap-check` (board + controls together at the bottom; no empty band > 24 px; lowest control within 40 px of the bottom; status panel shows exactly the board's figures) · `bottom-clearance-check` (controls ≥ 12 px above the bottom; arcade's lowest control exactly 16 px) · `game-controls-check` (timer choices Bar/Ring/Chip, default Bar, seconds only in the last 10 s) · `first-paint-check` (board within 0.5 px from the first frame) · `arena-world-check` + `desktop-fairness-check` (same world on every device; panel never changes input) · `desktop-layout-check` (no frame header in the arena) · `demo-intro-check` (intro never shifts) · `theme-check` / `no-wrap-check`.

## 7. Reveal and result flow

| Mode | Sequence | Main button |
|---|---|---|
| Practice | game → reveal (stays; today's answer reveal: header row, score, the board or the run's picture, the breakdown, and in a room the chart; `src/components/duel/AnswerReveal.tsx` and `ArcadeReveal.tsx`. The one-template `RevealScreen` is P2's first job and is not on main) | gold "Play again" (deal → 3-2-1 → game); "Back" → game page. No next-game suggestion, no share |
| Room round | reveal (timed, no button; footer = who has finished + countdown) → "Round results" → "Standings" → round title 3 s → next intro | gold "Continue (8s)" then "Continue (10s)"; after tapping: "2 of 4 ready, Standings in 5s" (`ContinueFooter.tsx`) |
| Room end | final round: reveal → "Final round" results ("Continue", next = Winner) → winner reveal 6.3 s → Podium (3+ players) / FinalResult (2) | host: gold "Play again"; guests: text "Waiting for the host"; Share; "Challenge a friend"; Leave is in "⋯" (`Podium.tsx:376–398`) |
| Daily | per round: reveal (timed) → next intro (Ready) … → results: title "Daily Puzzle, results", total, place line, round rows (tap → detail, replay, "See the reveal") | secondary "Leaderboard" (→ `/daily-board`) + Share. **No Home / Done button** (`AsyncResults.tsx:242–255`) |
| Rated | room rounds as above with a match header → winner reveal → `/rated?match=`: "You win" / "{name} wins", score 2–0, rating panel, game rows, Joules, near miss | gold "Next match" (searches again) / "Play placement n" / "Reveal my tier"; "Rematch, 8 s"; "Challenge {friend}"; "See the tiers". **No Home button** (`RatedMatchScreens.tsx:331–360`) |

## 8. Money, coins, pass, Plus outside `/shop`

No pop-up sells anything and nothing outside the Shop takes payment. For non-testers today **none of these render**. What exists:
- **Links into the Shop**: header / rail `CoinCounter` (aria "N coins. Get coins" → `/shop?part=shop&section=coins`; `src/components/app/CoinCounter.tsx:37–46`) · Home `WeeklyCard` "This week" → `/shop?part=pass` (HomeSections.tsx:307) · More → "Joulz Plus" → `/shop?part=plus` (more.tsx:84) · `PassLevelNotice` and `ShopBackNotice` toasts above the tab bar on tab pages (`AppTabBar.tsx:78–80`) → Pass / Shop · the Shop tab's dot.
- **Mentions without a link**: "+N Joules" line on practice reveal, podium, final result, Daily results, rated result (`JoulesLine`; `AnswerReveal.tsx:148`, `Podium.tsx:363`, `FinalResult.tsx:217`, `AsyncResults.tsx:258`) · coin rewards on challenge rows ("+100", guest: "Unlocks with your account"; `src/components/games/ChallengeRows.tsx:66–88`, `PracticeChallenges.tsx:160–166`) and challenge Joules on the game page and arena panel · badge moment "Badge earned · +250 coins" (`BadgeMoment.tsx:46`) · Customise: coin balance in its header, locked items "Shop" / "Season 1 pass", empty lines "They come from the pass." and "Get them in the shop or the season pass." (`src/routes/customise.tsx:68,232–236,555,757`) · tournaments: entry "50 coins", prizes in coins (`TournamentHub.tsx:50–67`) · PLUS chip on Profile's card (`ProfileCard.tsx:108–112`) · `/daily-archive` "The Daily archive is part of Joulz Plus." · Tier ladder's end-of-season rewards line.
- The closest thing to pressure: the two tab-bar toasts and the Shop dot (testers only).

## 9. Desktop (≥ 1024 px, hover + fine pointer; `src/lib/layoutMode.ts:20–23`)

- **Every page**: left rail replaces the tab bar, Play bar and header avatar; header becomes the title alone. Full 240 px on tab pages, the game page and `/challenges`; 76 px icons elsewhere (PhoneShell.tsx:598).
- **Tab pages** (`src/polish-layout/desktop-layout.css:298–329`): grid `1fr + 320 px`, max 1240 px. Asides: Home = This week, Friends, "Your week" (Rooms, Wins, Practice, Daily streak; index.tsx:180–187); Games = "Next public room" ("None scheduled yet"), Daily, Your week (practice.tsx:763); Tournaments = Daily, Your week; Profile = the card column (drawn left). **Shop and More have no aside: the 320 px column is empty.** Home's phone-only stack (This week, Friends) is hidden and moved to the aside.
- **Banner slot** 112 px on Home / Games / Tournaments: hidden today (no banners, no public games).
- **Catalogue**: grid 3–5 columns; rail search opens Games with the words typed. Game page: two columns.
- **Non-tab pages** (Play, Rooms, Daily, Settings, Leaderboards, Friends, Customise, lobby, results): the phone column centred, max 760 px, beside the 76 px rail. Leaderboards adds a board list at the side.
- **Rooms**: fixed 380 px right `RoomPanel` (code, round progress by category, standings for 16 with playing / finished, chat between rounds).
- **Games**: arena panel 320 px (section 6); world at the largest uniform scale; modes wide / tall / rotate (`src/lib/duel/desktopModes.ts`); tall arcade worlds leave ~560 px of faded scenery at 1440×900 (`docs/polish-plan-final/desktop-research.md` §1, arithmetic re-checked against desktop-layout.css).
- **Tablet (≥ 700 px, touch)**: tab pages two columns (1fr + 280, max 980); games exactly the phone's; landscape ≥ 1024 gets the rail and the arena.

## 10. Redundant, duplicated, or dead ends

1. **Tournaments tab is a dead end for everyone but testers**: one panel ("Coming soon" / "Compete for trophies" / one line), no action, yet it holds a permanent tab; Play → Arena ("Coming soon") leads to the same page.
2. **Stale "play" targets after rooms moved to `/rooms`**: `goToTab(..., "play")` lands on Home, which no longer creates rooms: Profile "Start playing" and Get started "Play your first room" (profile.tsx:100, 209), Tournaments "Play with friends" (tournaments.tsx:167). Rated "Back to Play" buttons and the Daily page's back label "Play" also go to Home (rated.tsx:271, 292; daily.tsx:345).
3. **The first-time copy describes rooms, the button starts practice**: IntroCard's three steps and all three Onboarding panels are about rooms with friends; a solo newcomer who follows them reaches a lobby that cannot start alone.
4. **"How it works" three times**: IntroCard, Home's foot link, Settings.
5. **Goal / How shown twice** on some paths: game page then (via `?game=` links) the full intro; and the full 60–110-word intro before **every** room and Daily round, with a Ready tap each time.
6. **Two practice entry styles**: IntroCard → full intro + Ready (no countdown); everything else → game page + Play → 3-2-1. Recently played and Next match open the game page, never the game.
7. **Daily results and rated result have no way home** except system Back (section 7). Daily's whole page sits behind the terms gate, so a new guest cannot even look first.
8. **Guest avatar opens a sign-up sheet**, so the only route to a guest's Profile is More → Profile; Profile for a new guest is mostly empty states plus a second "Get started" list.
9. **Daily has five entrances** (Home hero, Play → Daily, More → Daily, Profile step, desktop aside) and Games four; **joining with a code has one, three levels down**.
10. `/play` for non-rated players offers "Create a room" and "Rooms" side by side (both lead to rooms).
11. **Difficulty set in two places** (catalogue switch for every game, per-game switch on the game page), each with the same first-time panel.
12. `PassHomeCard` (`src/components/pass/PassHomeCard.tsx`) is used by no page, only by `scripts/pass-screens-check.tsx`. Old Practice list CSS (`[data-practice-tools]`, desktop-layout.css:332–) targets markup that no longer exists.
13. ≠ CLAUDE.md: the Puzzles | Arcade switch is back on the catalogue (`GamesCatalogue.tsx:171–211`) with category tiles under it; `/play`, `/rooms`, `/settings`, `/card`, `/badges` exist and Home no longer holds Quick play, Rejoin, the public game card or Challenge a friend; Profile's "Your Joulz Rating arrives with rated play." line is gone.
