# Check assertions this plan needs changed

Companion to `docs/polish-plan-final.md` section 10. The house rule: **no session loosens, retargets or deletes an assertion without Joe's approval typed in that session**, and each changed line gets the note "Changed with Joe's approval, DD Mon YYYY" beside it. This file is the list, with exact lines, read from the files on branch `fable-polish-plan` on 20 Nov 2026 (main f3016234 merged in). Line numbers move: each session re-verifies its own rows before showing them to Joe.

It has two parts, each written from a read of every check that could notice the planned change:

- **Part 1, pages and chrome** (sessions P1 to P4): the navy token values, navigation, Home, the first open, the Games page, the round intro, the game frame's paint, the rated screens, You, the Shop. Its "Can be avoided" section matters most: about twenty-five keep-this-attribute choices remove over half the rows, and the plan asks every session to take them.
- **Part 2, games** (sessions A1 to A3 and D1 to D6): Part A is each family's look pins, classed 1 (a line must change), 2 (a documented script re-records data) or 3 (keeps passing if names, sizes and budgets are kept); Part B is each game's level pins, including the six "today's game is Hard" identities the new ladders break. It ends with the earlier plan's K1 to K14 re-verified.

## Who shows Joe which rows

| Session | Rows |
|---|---|
| P1 Navigation and Home | Part 1: 1 (navy), 3 (navigation), 4 (Home), and the `celebrations-off.json` re-record |
| P2 Games, intro, first open | Part 1: 5, 6, 7 |
| P3 Compete, You, Shop, rated | Part 1: 9, 10, 11 |
| P4 Desktop | The earlier K18 (three `desktop-geometry-check` lines for the Cabinet's left panel) and Part 1's desktop-layout rows |
| A1, A2, A3 | Part 2A, their families (class 1 rows only; class 2 is a routine re-run named beside each) |
| D1 to D6 | Part 2B, their games; plus `practice-challenge-numbers` goal texts that quote a changed level |

## Things the plan changed because of this list

- **The VS screen keeps each player's full `PlayerCard`** inside its half (`[data-vs-side] [data-player-card]`), so the rated screens' identity rows stay green; the mockup's large avatars are the card's own avatar drawn large.
- **The rated result's title stays "You win"** (no exclamation mark), which two rows pin.
- **`/more` and `/play` stay as files that redirect**, because the screen harness imports both routes.
- **The first open never fires on a `?game=` link or under automation**, because five real-app checks open practice games on fresh storage.
- **The game frame's stage tint fades to the page colour before the notch and home-bar strips**, so the seam rule holds without a change.
- **Grappler's grab ring keeps its 14 px radius** (redrawn, not resized), so its three rows stay green.
- **Reward art gets its own surface tokens** before the navy values move, so the ten approved reward SVGs stay byte for byte.

---

# Part 1. Pages and chrome

Branch `fable-polish-plan`, read 20 Nov 2026. Read-only research: nothing was run, built or edited. Every line number below was read in the file on this branch.

Scope, after the owner's change of 20 Nov: changes 1 and 2 (bright colour tokens, rounded shapes) are dropped. Change 1 is kept only as the small navy deepening. Changes 3 to 11 stand as structure and layout changes in today's style.

How to read the tables: a row is an assertion that **fails, or stops meaning what it says**, if the change is built the obvious way. "If …" in the Needs column means the row fails only under that build choice. The "Can be avoided" section lists the build choices that keep rows green.

Two things apply to every change and are not repeated in each table:

- `scripts/theme-screens.ts` `THEME_SCREENS` is a closed list (CLAUDE.md "Page screens and their checks"). Rows that edit it need the owner's approval like any assertion.
- A screen file's `go` step that clicks or waits for a selector fails its draw in **both** theme-check and no-wrap-check when the selector is gone, so those rows count as pins.

---

### 1. Colour tokens (navy deepening only)

`--jz-bg` #06080F → #04060C, `--jz-surface` #0F1424 → #101A33, `--jz-surface-2` #1E2640 → #1C2A52, `--jz-surface-3` #28335A → #26376B, `--jz-line` → #223058, `--jz-navy` → #142454, `--jz-navy-edge` → #2F4A94. Gold, text and `--screen-edge` unchanged.

| Check | Lines | Asserts today (quote) | Needs |
|---|---|---|---|
| `scripts/nav-check.ts` | 75 | `["--jz-surface-3", "#28335A"]` | `#26376B` |
| `scripts/nav-check.ts` | 85–88 | `["--jz-bg", "#06080F"] … ["--jz-surface", "#0F1424"]`, "existing token … still" | `#04060C`, `#101A33` (the gold entry on the same line stays) |
| `scripts/theme-check.tsx` | 292, 297 | `["--background", "#06080F"]` on every dark skinned screen (room and tab) | `#04060C`. Comment on line 16 names the old value too |
| `scripts/appearance-check.tsx` | 135 | `{ bg: "#06080F", text: "#EEF2FF", theme: null }` | `bg: "#04060C"` |
| `scripts/appearance-check.tsx` | 162 | `got.bg === "#06080F" && … got.edge === "#070709"` (a game screen stays dark in light) | `#04060C`; the `:root[data-theme="light"] :is(.game-screen, [data-skin-off], .pcard)` block in tokens.css must be moved with it |
| `scripts/brand-assets-check.ts` | 37–38 | `BRAND_INK … is --jz-bg` and `BRAND_INK … is --jz-on-gold` (one constant, two tokens) | Passes unchanged only if `--jz-on-gold` moves to #04060C with `--jz-bg`. If on-gold stays #06080F, one of the two lines needs its own constant |
| `scripts/art-check.tsx` | 62 | `A.resolved(mine, token) === ref` "the art's markup differs from docs/art/svg/<name>.svg" | Fails for 10 of the 20 approved SVGs: the art draws `var(--jz-surface)` (badge-club, badge-founder, badge-winner) and `var(--jz-surface-2)` (three medals, four trophies, badge-winner). See "Can be avoided" |

Not pinned: `--jz-line`, `--jz-navy`, `--jz-navy-edge` (no check names #1B2644 or #2E3B63; the `#1E2640` on `art-check.tsx:70` is `--jz-metal-obsidian-2`, a different token). `brand-assets-check.ts:97–98` (manifest colours) compare against `BRAND_INK`, so they pass once the manifest is regenerated. `art-check.tsx:79` pins `--jz-art-edge` #06080F: leave that token alone. theme-check's token pairs (lines 108–122) are computed and pass on the new values (lowest: text-3 on surface 6.25:1).

### 2. Shapes

Dropped by the owner. Nothing to change. (For the record: `nav-check.ts:77–78` pins `--jz-cut-lg: 14px` and `--jz-cut-sm: 8px`, and `theme-check.tsx:615–621, 636` requires Ready's gold `::before` to carry a gradient.)

### 3. Navigation

| Check | Lines | Asserts today (quote) | Needs |
|---|---|---|---|
| `scripts/nav-check.ts` | 52 | `=== "Home,Games,Tournaments,Shop,More"` "the five destinations in order" | `Home,Games,Compete,Shop,You` |
| `scripts/nav-check.ts` | 54 | `tabsFor(false) … === "Home,Games,Tournaments,More"` | `Home,Games,Compete,You` |
| `scripts/nav-check.ts` | 55 | `TAB_PATHS.more === "/more" && TAB_PATHS.tournaments === "/tournaments"` | Drop `more`; add You's path. `tournaments` passes if Compete keeps the id and `/tournaments` |
| `scripts/nav-check.ts` | 103, 116, 136 | `"more.tsx": "tab: More"`, `"play.tsx": "the gold Play bar…"`; every route file must be in `ROUTES` | Remove the More entry; reword the Play entry; add any new route file (the loop fails on a file with no entry) |
| `scripts/nav-check.ts` | 158, 219 | server-ready probe `fetch(`${origin}/more`)`; warm-up list holds `/more` | Another path (the probe never succeeds once `/more` is gone, so the whole check fails) |
| `scripts/nav-check.ts` | 247 | `labels.join(",") === "Home,Games,Tournaments,Shop,More"` "the tab bar" | New labels |
| `scripts/nav-check.ts` | 266–267 | `[data-nav-play='bar']` "the Play bar is above the tab bar and at least 44 px" | Delete (no Play bar) |
| `scripts/nav-check.ts` | 276–279 | Play bar click → `/play`, `[data-play-mode]` count 4 "the Play page: Arena, Rooms, Practice and Daily" | Delete, or reach the Play page another way if it stays |
| `scripts/nav-check.ts` | 288–292 | "Games has the Play bar", "the Play bar on Games opens the Play page" | Delete |
| `scripts/nav-check.ts` | 297–303 | tab loop `["tournaments", "/tournaments", "Tournaments"] … ["more", "/more", "More"]`; "the Play bar only on Home and Games" | Compete's heading, You's tab; the Play bar count becomes 0 everywhere |
| `scripts/nav-check.ts` | 316 | no page errors on `["/", "/more", "/tournaments"]` | Replace `/more` |
| `scripts/nav-check.ts` | 326–366 | `openApp("/more")`; `rows … === "profile,friends,leaderboards,challenges,daily,plus,settings,support"`; `groups … === "Friends and rivals\|Compete\|Joulz"`; each row's target and Back to `/more` | Rewrite for You's rows (Friends, Challenges, Badges, Settings) and Compete's (Leaderboards, Daily) |
| `scripts/nav-check.ts` | 367–370 | "More → Friends offers a guest the save-your-progress sheet" | Same rule on You's Friends row |
| `scripts/nav-check.ts` | 372–375 | "a guest's avatar opens the save-your-progress sheet" (and the path stays `/more`) | A guest's avatar opens You |
| `scripts/nav-check.ts` | 378–384, 393–397 | "a tab opened directly: Back returns to Home", using `/more` and `tapTab(page, "more")` | Same rule on You's tab |
| `scripts/nav-check.ts` | 403–409 | tablets drawn on `/more`, waiting for `[data-more-row='profile']` | Another page |
| `scripts/nav-check.ts` | 414–418 | `railTabs … === "Home,Games,Tournaments,More"`; "the rail carries the avatar and the gold Play button" (`[data-nav-play='rail']` count 1) | The new rail list; no Play button if it goes |
| `scripts/nav-check.ts` | 434 | `["avatar", "rail", "play", "practice", "tournaments", "more"].every(…)` "Tab reaches the rail's avatar, Play and destinations" | The new rail items |
| `scripts/nav-check.ts` | 453, 459 | harness screen `mode: "more"`; "an account's avatar opens Profile" (`/profile`) | Another mode. Line 459 passes if You lives at `/profile` |
| `scripts/app-shell-check.ts` | 193 | warm-up `["/tournaments", "Tournaments"], ["/profile", "Profile"], ["/play", "Play"]` | New headings (warm-ups only log, but each waits 3 min for a heading that never comes) |
| `scripts/app-shell-check.ts` | 212 | `tabs.join(",") === "Home,Games,Tournaments,More"` "four tabs with labels" | `Home,Games,Compete,You` |
| `scripts/app-shell-check.ts` | 258–265 | loop `["Tournaments", "/tournaments", "tournaments"], ["More", "/more", "more"]`: heading, URL, current tab | Compete and You |
| `scripts/app-shell-check.ts` | 267–269, 289 | `[data-more-row='profile']` click → heading "Profile", URL `/profile`; Back waits for the More row | You is the tab itself: no row to click, Back goes straight to Home |
| `scripts/app-shell-check.ts` | 296, 305, 318 | `getByRole("heading", { level: 1, name: "Tournaments" })` | "Compete" (or keep an h1 "Tournaments" on the tab) |
| `scripts/app-shell-check.ts` | 297–300, 319–322 | on the tab: `[data-public-game='join']`, `[data-public-later]`, `[data-public-results-empty]`, "Add to calendar" → "Join now" | Passes only if Compete's first view still draws the public-games list; else point at wherever it moved |
| `scripts/identity-screens-check.tsx` | 258, 269–271, 290, 302–303 | `"Home,Games,Tournaments,Shop,More"` / `"Home,Games,Tournaments,More"` (seven literals) | New labels |
| `scripts/identity-screens-check.tsx` | 304, 320–321 | `pages = ["play", "practice", "tournaments", "more", "shop"]`, "its own tab is current" | Replace `more` with You's tab id |
| `scripts/identity-screens-check.tsx` | 326–327 | `[data-rail-tab]` labels `=== state.want` "the desktop rail has the same tabs" | Fails if Friends, Challenges and Settings are drawn as `data-rail-tab` items. See "Can be avoided" |
| `scripts/desktop-layout-check.ts` | 207 | `m.rail.tabs !== 4 \|\| !m.rail.logo \|\| !m.rail.account \|\| !m.rail.settings` "rail lacks the logo, the four tabs, the account or settings" | Same condition as the row above; also needs the logo, `[data-rail-account]` and `[data-rail-settings]` kept |
| `scripts/desktop-layout-check.ts` | 208 | "the full rail has no search" (`input[type='search']`) | Keep the rail's search, or delete the line |
| `scripts/tournaments-screens-check.tsx` | 114–115 | reads `src/routes/tournaments.tsx`: `{hub ? <TournamentHubSections ` and `useTournamentHub()` | If the Compete tab is a new route file, point at it |
| `scripts/offline-check.ts` | 660–662 | `a[href="/tournaments"]` click → "Tournaments: offline state" | If Compete's path changes |
| `scripts/first-impressions-screens-check.ts` | 37, 49 | `"tournaments, nothing played…": ["[data-public-results-empty]", "[data-public-none]"], captains: 2`; `"nav: tournaments, coming soon": ["[data-tournaments-soon]"]` | If Compete's first view no longer draws these |
| `scripts/theme-screens.ts` (closed list) | 788, 789, 794 | `{ name: "nav: more", mode: "more" … }` (three screens) | Remove or re-point at You |
| `scripts/safe-area-harness.tsx` (helper) | 36, 66, 830–831 | `import { Route as MoreRoute } from "@/routes/more"`, `PlayRoute`; mode `"more"` | Every harness-based check stops compiling if `src/routes/more.tsx` (or `play.tsx`) is deleted while the import stands |
| `scripts/screens/home-play.ts` | 84–85, 90–92, 95 | `[data-play-format]` click, `[data-match-sheet]`; four `mode: "play"` screens | If the Play page goes with the Play bar |

### 4. Home

| Check | Lines | Asserts today (quote) | Needs |
|---|---|---|---|
| `scripts/app-shell-check.ts` | 246–247 | `[data-next-match='practice']` count 1 "Your next match: a Practice suggestion"; its game icon | The "Play now" hero (or delete) |
| `scripts/app-shell-check.ts` | 460–468 | `[data-next-match='practice']` → `data-next-game` → its button opens `/practice?page=<type>` | The hero's own selector and where it lands (a practice round, not the game page) |
| `scripts/rated-screens-check.tsx` | 737–742 | source: `{rated ? <RatingTiles status={rated} /> : null}` in `index.tsx`; `{status ? ( <RatedPlay status={status} />` in `play.tsx` "Home and Play draw rated play only for players it is open to" | The same rule on the Quick match hero. Line 738 throws if `play.tsx` is deleted |
| `scripts/play-tab-shift-check.ts` | 68, 248–250 | `intro: "[data-intro-card]"`; "first visit: the intro card is there from the first frame" | Delete (no IntroCard). Line 251 ("a device that has seen the intro: no intro card") then passes trivially |
| `scripts/play-tab-shift-check.ts` | 389–391 | `playCardTokens(…).join() === "daily,challenge,intro"`; "reserves no intro card"; "seen this session: no intro card" | `daily,challenge` once the `intro` slot is retired |
| `scripts/play-tab-shift-check.ts` | 415 | `attrs["data-play-cards"] === "named daily challenge intro public"` | Without `intro` |
| `scripts/play-tab-shift-check.ts` | 385–386 | boot script reads `ONBOARDING_SEEN_KEY`; "the intro key the boot script reads differs from lib/onboarding.ts" | Delete if the boot script stops reading it |
| `scripts/onboarding-check.ts` | 65 | `/onboardingSeen\(\)/.test(home)` "home does not read the onboarding flag" | Delete or re-point (Home no longer decides the intro) |
| `scripts/onboarding-check.ts` | 207–213, 275–314 | `cardUp` (`[data-intro-card]`), `openFromCard` (`[data-intro-how]`); "a fresh device did not see the intro card on home" at four sizes | Whole section goes or moves to where "How it works" lives |
| `scripts/onboarding-check.ts` | 316–342 | Skip lands on home; `[data-intro-close]`; `getByRole("button", { name: "How it works" })` on Home | Same |
| `scripts/onboarding-check.ts` | 344–369, 407–421, 423–434 | swipe, storage-failing and reduced-motion passes all start from `openFromCard` | Open the panels another way |
| `scripts/onboarding-check.ts` | 387–405 | `"How it works" on home reopens the three panels` | Delete, or the link's new place |
| `scripts/share-check.ts` | 810–814 | `home.indexOf("<ShareWelcomeCard") < home.indexOf("<DailyHero")` | If the Daily cards' component is renamed |
| `scripts/share-check.ts` | 819–822 | `/isShareRef\(window\.location\.search\)\) markOnboardingSeen\(\)/.test(home)` | Delete or re-point if Home's onboarding effect goes |
| `scripts/daily-check.ts` | 616 | `/<DailyHero/.test(home) && /<PlaySlot id="daily" state=\{slotState\(daily\.settled, …\)\}>/` | If renamed or the slot's line changes |
| `scripts/identity-screens-check.tsx` | 380–385 | guest and Shop-off header: `header.children.length === 1 && !header.querySelector(".ap-header-tools, [data-coin-counter])` "the avatar and title only, no counter" | If the header gains a tier chip, or coins for players the Shop is off for |
| `scripts/identity-screens-check.tsx` | 350 | `Boolean(counter) === shows` "coin counter … absent" for a guest | If coins show for everyone |
| `scripts/desktop-layout-check.ts` | 215 | `if (!m.aside) problems.push("no right column")` on "play" | Home must keep `[data-page-aside]` on a computer |
| `scripts/screens/home-play.ts` | 65 | `waitForSelector("[data-hp-recent]")` | If "Jump back in" drops the attribute |
| `scripts/celebrations-browser.ts` | 370 | `sameMarkup(o.page, before.home, "off, home")` | Fixture re-record (see the end) |

Not broken: `beta-extras-check.ts` 481–507 (the Home Screen hint) and `share-check.ts` 1066–1270 (the welcome card: above `[data-daily-card]`, th-card, buttons) keep passing if the `welcome` and `homescreen` PlaySlots and `data-daily-card` stay. `play-tab-shift-check.ts:241` wants "Done" and "694" in the **first** `[data-daily-card]`'s text, so with two cards the Puzzle card must come first. `pass-screens-check.tsx:170–175` mounts `PassHomeCard` directly: keep the component even if Home stops drawing it. `home-music-check.ts:182` wants `useHomeBed(true, screenMusic("music_home"))` in `index.tsx`. `game-catalogue-check.ts:126` forbids Home importing `registry.ts` (the hero and tiles must use `catalogue.ts`).

### 5. First run

| Check | Lines | Asserts today (quote) | Needs |
|---|---|---|---|
| `scripts/first-impressions-check.tsx` | 78 | `FIRST_OPEN_ONBOARDING === false` "the onboarding's switch is off" | `true` (or delete) |
| `scripts/first-impressions-check.tsx` | 81–85 | "off: firstOpenOn() is false", "shows nothing", "nothing is written to the phone" | Delete |
| `scripts/first-impressions-check.tsx` | 87–90 | root has `lazy(() => import("../components/app/FirstOpen"))` | The new first-run component |
| `scripts/first-impressions-check.tsx` | 102–105 | "on: a brand-new phone's first open on ${path} shows it" for `/`, `/practice`, `/tournaments`, `/profile` | The new rule's paths |
| `scripts/first-impressions-check.tsx` | 117–206 | "three screens"; Skip on each; "Play my first match"; "Play with friends instead"; swipes | One "Play" screen that starts an Easy practice game |
| `scripts/first-impressions-screens-check.ts` | 44–46, 156–166 | three `"first open, screen n"` entries; "Skip on screen" | One screen |
| `scripts/theme-screens.ts` (closed list) | 489–499 | `[1, 2, 3].map(… name: `first open, screen ${n}` … "[data-first-open-next]")` | One screen (plus the win screen as a new area file) |
| `scripts/onboarding-check.ts` | as change 4 | the IntroCard as the first-time intro | as change 4 |
| `scripts/play-tab-shift-check.ts` | 248–250, 389–391, 415 | as change 4 | as change 4 |

`demo-intro-check` is not touched by this change: it opens `?game=` intros with the onboarding key set. See "Can be avoided" for the one rule that matters here.

### 6. Games page

| Check | Lines | Asserts today (quote) | Needs |
|---|---|---|---|
| `scripts/practice-switch-check.ts` | 170–174 | "the top is the switch, the category tiles, the difficulty switch, then the games" (`[data-practice-switch]`, `[data-games-category-tiles]`, `[data-catalogue-level]`, `[data-games-grid]`) | The control, the hero, then the shelves |
| `scripts/practice-switch-check.ts` | 175 | `[data-practice-filter='all']` count 0 "no All chip" | Reword: All is a side of the control |
| `scripts/practice-switch-check.ts` | 177 | "a new visit opens on Puzzles" | Opens on All (if it does) |
| `scripts/practice-switch-check.ts` | 179 | `shownCounts === [counts.puzzles, counts.arcade]` | Three counts, or none |
| `scripts/practice-switch-check.ts` | 185–196 | category tiles: ids in order, names, colours, `oneRow.rows === 1 && oneRow.scrolls === "auto"` | Shelf headings in that order, each shelf one sideways-scrolling row |
| `scripts/practice-switch-check.ts` | 198 | "with no tile chosen, the side lists exactly its N active games once" | Per side, across its shelves (a game listed "also in" a second shelf now appears twice on one page) |
| `scripts/practice-switch-check.ts` | 199–210 | tap a tile: "lists exactly its games", "shows as chosen", "a second tap … shows the whole side again" | Each shelf holds exactly its games; no tap filter |
| `scripts/practice-switch-check.ts` | 226–227, 261 | `[data-level-intro]` "a first visit explains the levels"; "shown only once" | Delete here (the explainer leaves the catalogue) |
| `scripts/practice-switch-check.ts` | 229–253 | "the difficulty switch is Easy · Normal · Hard · Expert, on Normal"; "on Hard, a game with Hard plays Hard"; tile `data-level` / `data-tile-level` | Delete (no catalogue switch) |
| `scripts/practice-switch-check.ts` | 260 | "the level is remembered on this device" (`[data-catalogue-level] [data-level-option='hard']`) | Delete, or move to the game page |
| `scripts/practice-switch-check.ts` | 279 | "an empty search lists the side's games again" (`=== sideGames("arcade").length`) | Follows what the remembered side lists |
| `scripts/practice-switch-check.ts` | 307–309, 331 | `localStorage "duelz-levels:v1" = { catalogue: "hard", games: {} }` → "Play on …'s page at Hard asks for a Hard deal" | Seed the game's own level, unless the stored `catalogue` field is still read as the default |
| `scripts/practice-switch-check.ts` | 335–343, 349 | stand-in: clicks `[data-catalogue-level] [data-level-option='hard']`, judges the tiles' levels | Judge the stand-in on the game's page |
| `scripts/difficulty-check.ts` | 306–307 | `<LevelIntro />` in `GamesCatalogue.tsx`, `GamePage.tsx`, `RoomSettingsSheet.tsx`: "every level selector draws the explanation (… of 3)" | 2 of 2 |
| `scripts/difficulty-check.ts` | 258–260, 271–273 | "the catalogue's switch sets the level for every game"; "changing the catalogue's level clears each game's own choice" | Only if `levelChoice.ts` loses `setCatalogueLevel` |
| `scripts/app-shell-check.ts` | 369–382, 385 | `pressSide` (`[data-practice-side]`, `aria-pressed`); "the Puzzles side lists only puzzles"; "no game is listed on both sides" | Passes if Puzzles and Arcade stay as two `data-practice-side` buttons; a game "also in" a second shelf breaks line 385's "once" |
| `scripts/app-shell-check.ts` | 397 | "no All chip (one side at a time)" | Reword |
| `scripts/app-shell-check.ts` | 399–403 | `[data-practice-filter='logic']` click → "the Logic chip shows only logic games" | The Logic shelf holds only logic games |
| `scripts/desktop-layout-check.ts` | 237 | "practice: the title, search button or chips are missing" (`[data-games-chips]`) | The control's selector |
| `scripts/desktop-layout-check.ts` | 243–246 | `[data-games-grid]` rows: "practice: N cards across (want 3 to 5)" | A shelf row holds more than 5 tiles in one line, so this fails unless a computer wraps |
| `scripts/cosmetics-screens-check.tsx` | 310–314, 323, 332 | mounts `GamesCatalogue` with `{ filter, onFilter, side, onSide, hidden, … }`; "a chip whose games are all held back isn't drawn"; `chipIds.length >= 1 … && !chipIds.includes("all")` | The component's new props; "a shelf whose games are all held back isn't drawn" |
| `scripts/theme-screens.ts` (closed list) | 846–857 | "practice list, arcade side": `[data-practice-side='arcade']` then `[data-practice-filter='retro'][aria-pressed='true']` | Drop the Retro tap |
| `scripts/screens/games.ts` | 64–72 | "games: catalogue, Logic chosen": `[data-practice-filter='logic']` click | Remove or scroll to the Logic shelf |
| `scripts/screens/difficulty.ts` | 23–27, 41–42 | `arcadeHard`: `[data-catalogue-level] [data-level-option='hard']`; "difficulty: catalogue, first-time explanation", "…Arcade on Hard" | Remove both screens |
| `scripts/screens/difficulty.ts` | 29–35, 52–61 | "game page, a level it lacks": seeds `catalogue: "expert"` | Seed the game's own level |

### 7. Round intro

| Check | Lines | Asserts today (quote) | Needs |
|---|---|---|---|
| `scripts/demo-intro-check.ts` | 260–264 | `for (const key of ["title", "goal", "how", "stage", "score", "time", "ready"])` → "no ${key} on the intro" | `["title", "goal", "stage", "ready"]`, plus `time` if the time line stays. Fails for every game otherwise |
| `scripts/demo-intro-check.ts` | 116–120 | `how: ".intro-how"`, `score: ".intro-score"`, `time: ".round-intro-time"` | Trim to match. Line 335's with/without-demo comparison skips missing keys, so it needs nothing |
| `scripts/practice-goals-check.ts` | 370 | `<Stars levels={levelStarsOf(practiceProgressNow(), type)} />` in `RoundIntro.tsx` "the intro shows the game's stars" | If the short intro drops the stars |
| `scripts/desktop-geometry-check.tsx` | 367–368 | `[data-desktop-keys]` count: "the intro does not show the game's keys" | If the keys line moves behind "?" with How |
| `scripts/crazy-golf-v3-check.ts` | 462–466 | `PuzzleInstructions` (no props) "shows its goal", "every how-to line", "its score lines" | If the component's default render becomes the short form |
| `scripts/theme-check.tsx` | 635 | `probe.labels.length < 3` "Goal / How / Score labels are …, not the accent" (room intros) | If the room's "short intro" has fewer than three labelled blocks |

Not broken: `intro-score-text-check` reads `INTRO_SCORE` and `PUZZLE_INSTRUCTIONS` as data, not the screen. bottom-clearance-check, first-paint-check, safe-area-screens-check, screen-bottom-check and arcade-play-check only need the intro's Ready button (`/^Ready/`), which the plan keeps.

### 8. Game frame (a deeper category tint behind the board; header unchanged)

Nothing pinned, as long as the tint stays on `[data-puzzle-play] > .screen-background`. The assertions that judge that backdrop are relational, not colour values:

| Check | Lines | Asserts today (quote) | Needs |
|---|---|---|---|
| `scripts/bottom-clearance-check.ts` | 540–566 | "page behind the screen is html … body … (want one opaque colour)"; "top edge … against the page behind"; "strip steps … at y="; "strip painted … over the screen's" | No change, provided the notch strip and the home-bar strip (inset + 16 px) still fade to `--screen-edge` and html/body stay `--screen-edge` |

It would fail only if the tint leaks: onto arcade play screens (`presentation-geometry-check.tsx:212–215, 233–234`, `arcade-play-check.ts:482, 707–708, 741–742`, `bottom-clearance-check.ts:80, 641, 661–666`, `arcade-fill-check.ts:46, 162`: every gap must be `rgb(7, 7, 9)`), or onto the room intro (`theme-check.tsx:637–658`: the accent-coloured title and labels must stay 4.5:1 over what is behind them).

### 9. Rated screens

| Check | Lines | Asserts today (quote) | Needs |
|---|---|---|---|
| `scripts/rated-screens-check.tsx` | 459 | `$$("[data-vs-side] [data-player-card]").length === 2` "VS …: both player cards" | **This is the rule that makes VS draw the shared `PlayerCard`.** A VS of big avatars alone needs this line changed |
| `scripts/rated-screens-check.tsx` | 460 | `[data-vs-side] [data-jz='emblem']` length 2 "both tier emblems" | If the tier moves into the card only |
| `scripts/rated-screens-check.tsx` | 461–462 | pills `=== "Volt II1,296 \| Volt II1,278"` "each card shows tier and rating" | Follows 459 |
| `scripts/rated-screens-check.tsx` | 475 | `[data-vs-side='me'] [data-card-pill]` is "#0042" and `[data-unplaced-emblem]` | Follows 459 |
| `scripts/rated-screens-check.tsx` | 769–770, 774, 779 | opponent's `[data-card-name]`, `[data-card-pill]` "Guest", `.rt-vs-tier` "Guest", "Deleted player", `[data-card-badges]` | Follows 459 |
| `scripts/rated-screens-check.tsx` | 512, 543 | `text(".rt-result-title") === "You win"`, `=== "Sam wins"` | "You win!" if the banner carries the mark inside that element |

Rule sources, quoted: `rated-screens-check.tsx:459` (above); CLAUDE.md, Friends entry, 11 Nov 2026: "Joe's rule: a player's card, avatar and frame show wherever they appear"; CLAUDE.md, nameplate entry: "the one way to draw a player in a row, `NameplateStrip` / `NameplateSheet`". `identity-everywhere-check.tsx:443–444` enforces the shared pieces only for eight room components (`Standings`, `DuelOverall`, `RoomPanel`, `RoomChat`, `PodiumAwards`, `RoundResult`, `RoundResultsTable`, `AnswerReveal`); `player-strips-check` covers tournament rows. Neither reads the rated screens.

Not broken by a restyle that keeps the data: lines 454–457 (`data-rated-screen='vs'`, `data-source`, the live or recorded tag), 463–469 (`[data-head-to-head]`, `vs_shown`), 513–530 (chips, rating panel, per-game rows, Joules line, near miss, Rematch, Challenge), 696–702 (at least 8 animated selectors in `rated.css`, each stopped under Reduce Motion, every keyframe ending visible), 855 (`Searching`, `VsScreen`, `MatchResult` by name), `app-moments-check.tsx:188` (the rating count-up call in `RatedMatchScreens.tsx`). `rated-multi-check` and `scripts/screens/rooms-rated.ts:20–33` name fixture screens, not markup.

### 10. Profile becomes "You"

| Check | Lines | Asserts today (quote) | Needs |
|---|---|---|---|
| `scripts/profile-pages-check.tsx` | 281–282 | source order in `profile.tsx`: `"{wide ? null : cardColumn}", "<ProfileRatings />", 'aria-label="Mastery stars"', 'aria-label="Recent matches"', "<ProfileBadges />", "<ProfileFriends />"` | The new order: card, rating, stat tiles, rows |
| `scripts/profile-pages-check.tsx` | 285–286 | then `"<SeasonSection />", "<TrophyCabinet trophies={trophies} />", "data-get-started", "data-profile-footer"` | What You keeps of these |
| `scripts/profile-pages-check.tsx` | 287 | `!/ProfileBoards\|YourChallenges\|ProfileChallenges\|aria-label="Practice bests"\|data-profile-daily/` "no … challenges … on Profile" | Passes if Challenges is a plain link row; fails if You embeds one of those components |
| `scripts/profile-pages-check.tsx` | 288–290 | "Get started only until all three steps are done"; guest footer text; "the settings gear stays in the header" (`data-open-settings`) | If Get started, the footer or the gear go |
| `scripts/profile-pages-check.tsx` | 170 | `[data-profile-rating='placed'] .pf-tile` length 3 "three rating tiles" | If "rating" becomes one block beside three stat tiles |
| `scripts/app-shell-check.ts` | 268, 278 | `getByRole("heading", { level: 1, name: "Profile" })` | "You" |
| `scripts/app-shell-check.ts` | 273–277 | `[data-open-settings]` → `/settings` → `[data-settings-back]` back to Profile | The Settings row |
| `scripts/app-shell-check.ts` | 282 | `[data-get-started] [data-step]` count 3 | If Get started goes |
| `scripts/app-shell-check.ts` | 285, 287 | `[data-look-moved]` text has "Customise", `[data-customise-open]` count 1; "Saved on this phone. Create an account to keep it everywhere." | If either goes |
| `scripts/identity-screens-check.tsx` | 699 | `/<SeasonSection \/>/` in `profile.tsx` | If the season section leaves You |
| `scripts/identity-screens-check.tsx` | 721 | `const trophies = useMyTrophies(accountName !== null);` and `<TrophyCabinet trophies={trophies} />` in the source | If the cabinet leaves You |
| `scripts/identity-screens-check.tsx` | 730–734 | `{progress ? ( <section aria-label="Mastery stars"` and `{starTotalLine(progress)}` | If Mastery stars becomes a stat tile |
| `scripts/seasons-screens-check.tsx` | 157–158 | `<TrophyCabinet trophies={trophies} />` in `profile.tsx` "Profile draws the cabinet" | Same |
| `scripts/identity-everywhere-check.tsx` | 437 | `/data-look-moved/.test(profile) && /\/customise/.test(profile)` | If the pointer to Customise goes |
| `scripts/first-impressions-screens-check.ts` | 36 | `"profile, new player, empty states": ["[data-recent-rooms-empty]"], captains: 1` | If Recent matches leaves You |
| `scripts/beta-extras-check.ts` | 460–462 | `[data-open-settings]` → `"to":"/settings"` | The Settings row's selector |
| `scripts/beta-extras-check.ts` | 514, 524–533 | `[data-feedback-link]` on "profile": none without `TALLY_URL`, exactly one with it | If the feedback link leaves You |
| `scripts/screens/profile.ts` | 46 | `scrollTo("[data-profile-friends]")` | Tolerant (falls back to scrolling to the end): no change |

More's rows are covered under change 3 (`nav-check.ts:326–366`).

### 11. Shop (restyle only)

Nothing pinned to colours or layout. `shop-pages-check.ts:40` forbids "best value" and the other pressure words (the plan adds none), `:44` forbids struck-through prices, `:55–60` fix the eleven screens in `scripts/screens/shop.ts`. Those screens' steps need `[data-shop-item-buy='name-colour.sapphire']` and `[data-shop-bundle-buy]` (`scripts/screens/shop.ts:37, 46`). `pass-screens-check.tsx` and `cosmetics-screens-check.tsx` read data attributes and text, not paint. The live constraint is theme-check's measured contrast: every text on a brighter card must stay 4.5:1.

---

### Can be avoided

Build choices that keep assertions green. Each removes rows from the tables above.

**Tokens**
- Point the reward art at art-only tokens (`--jz-art-surface: #0F1424`, `--jz-art-surface-2: #1E2640`) in `src/design/art/markup.ts:30–31`. `art-check.tsx:62` then passes with no re-approved SVGs. `art-check.tsx:63` still passes (tokens only).
- Move `--jz-on-gold` to #04060C together with `--jz-bg`: `brand-assets-check.ts:37–38` pass with one `BRAND_INK`.

**Navigation**
- Keep the tab id `tournaments` and the path `/tournaments` for Compete, and keep `src/routes/tournaments.tsx` as its route still drawing `{hub ? <TournamentHubSections` with `useTournamentHub()`. Saves `tournaments-screens-check.tsx:114–115`, `offline-check.ts:660–662`, `nav-check.ts:55` (half) and the id in every `[data-tab='tournaments']` selector.
- Put You at `/profile`. Saves `nav-check.ts:459`, `account-flow-check.ts:235–236`, the guest redirects (`identity-screens-check.tsx:663`, `profile-pages-check.tsx` "a guest is sent to Profile").
- In the rail, keep `data-rail-tab` on the main tabs only (Home, Games, Compete, Shop, You: four with the Shop off), and give Friends, Challenges and Settings another attribute, with Settings keeping `data-rail-settings`, the avatar `data-rail-account`, the logo `data-rail-logo` and the search box. Then `desktop-layout-check.ts:207–208` pass unchanged and `identity-screens-check.tsx:326–327` needs only the label rename.
- Keep the files `src/routes/more.tsx` and `src/routes/play.tsx` until the harness import (`safe-area-harness.tsx:36, 66`) is edited in the same PR; deleting one first breaks every harness-based check at compile time.

**Home**
- Keep the `daily`, `welcome` and `homescreen` PlaySlots, `data-daily-card` on the Daily cards with Puzzle first, the name `DailyHero` and its `<PlaySlot id="daily" state={slotState(daily.settled, !!daily.status?.available)}>` line, with `<ShareWelcomeCard` above it in the source. Saves `share-check.ts:810–814, 1066–1112`, `daily-check.ts:616`, `play-tab-shift-check.ts:66, 220, 241, 272`.
- Keep `[data-home]`, `[data-app-header]`, `data-hp-recent` on "Jump back in" and a `[data-page-aside]` on a computer.
- Keep `RatedHome` / `RatedHomeView` (for Compete's ladder). `rated-screens-check.tsx:331–430` and `scripts/rated-fixture.tsx:10` mount them directly, and the hero's button can send the same `play_card_tapped` event and `/rated?pick=…&format=…` navigation (lines 406–407).
- Keep the Rooms page (`/rooms`) even with Create and Join on Home. Saves `play-tab-shift-check.ts:70–75` and all its Rooms scenarios, `app-shell-check.ts:425–448`, `beta-extras-check.ts:319–333`, `celebrations-browser.ts:127`.
- Keep `Onboarding.tsx` and Settings → How it works. Saves `round-max-check.ts:238`, `scripts/screens/settings-account.ts:22`, `onboarding-check.ts:62–80` (source rules), and gives `onboarding-check`'s panel passes a new way in.

**First run**
- The first run must not fire on a `?game=` or `?page=` link, or under automation unless a check's page allows it (as packs do with `__DUELZ_ALLOW_PACKS__`). `arcade-play-check`, `bottom-clearance-check`, `arcade-fill-check`, `arcade-device-bottom-check` and `replay-play-check` open `/practice?game=<id>` on the real app with fresh storage and **no** onboarding key; today's `decideFirstOpen` (`src/lib/firstOpen.ts`) would show on that path once switched on.
- Keep treating `duelz_onboarding_seen` as "not a new device". nav-check, app-shell-check, account-flow-check, chat-report-check, room-e2e-check, play-tab-shift-check and `theme-screens.ts:1050` seed that key and nothing else.

**Games page**
- Keep `[data-games-catalogue][data-hydrated]`, `data-practice-side="puzzles"` / `"arcade"` with `aria-pressed`, one `[data-practice-game="<id>"]` wrapper and one button named exactly the game per tile, every tile in the DOM (no lazy shelves), `[data-games-search-toggle]`, `#games-search` ("Search games"), `[data-games-hero]`, `data-practice-stars`, and on tiles `[data-card-best]`, `[data-online-only]`, `[data-pending]`. Then `scripts/practice-side-lib.ts` (`showPracticeSide`, `playFromCatalogue`, `practiceGameUrl`) works unchanged, and so do `offline-check.ts:58, 391–442, 607, 650–652, 719`, `screen-bottom-check.tsx:438`, `safe-area-screens-check.tsx:204`, `app-shell-check.ts:404–416`, `practice-switch-check.ts:265–276`, `practice-goals-check.ts:363`.
- List a game once per page (drop the "also in" second shelf), or `app-shell-check.ts:385` and `practice-switch-check.ts:198` need rewording.
- On a computer, wrap each shelf to a `[data-games-grid]` of at most 5 columns and keep `[data-games-chips]` on the control: `desktop-layout-check.ts:237–246` pass unchanged.
- Keep `setCatalogueLevel` and the `catalogue` field in `levelChoice.ts` (unused by the page): `difficulty-check.ts:258–276` pass unchanged.

**Round intro**
- Keep `PuzzleInstructions`' default render as today's full Goal / How / Score (rooms, the Daily and "?" use it) and give practice an opt-in short form: `crazy-golf-v3-check.ts:462–466` and `removed-games-check.tsx:185` pass unchanged.
- Keep three labelled blocks on the room intro, the stars, the time line and the `[data-desktop-keys]` line on the short practice intro: saves `theme-check.tsx:635`, `practice-goals-check.ts:370`, `desktop-geometry-check.tsx:367–368` and the `time` key in `demo-intro-check.ts:260`.

**Game frame**
- Keep the tint on `[data-puzzle-play]` only, with no animation (battery-check judges idle frames) and the two strips fading to `--screen-edge`.

**Rated**
- Keep `PlayerCard` in each `[data-vs-side]` (large avatars can sit beside it) and both `[data-jz='emblem']`: all of change 9's VS rows pass.
- Keep `.rt-result-title`'s text as "You win" / "Sam wins" and put any "!" in the banner's own element.

**You**
- Keep `data-open-settings` on the Settings row, `data-look-moved`, `data-customise-open`, `[data-feedback-link]`, `[data-recent-rooms-empty]`, and `<SeasonSection />`, `<TrophyCabinet trophies={trophies} />` and the Mastery stars section in `profile.tsx`. Then only `profile-pages-check.tsx:281–286` (the order) and the heading name change.

### Fixtures to re-record

| File | Recorded by | Why |
|---|---|---|
| `scripts/fixtures/celebrations-off.json`, entry `home` only | `bun scripts/celebrations-browser.ts --record-off` (keep the other five entries as they are; precedent: 13 and 14 Nov 2026, "only its home entry re-recorded") | Home's markup changes (changes 3 and 4: header, sections, tab labels, no Play bar). Compared at `celebrations-browser.ts:370` |
| `docs/art/svg/*.svg` (10 files), only if the art is **not** moved to its own tokens | `docs/art/source/gen.py` (the approved source) | `art-check.tsx:62` compares byte for byte. Avoidable, see above |
| `public/manifest.webmanifest`, app icons, splash images, `public/og-image.png` | `bun scripts/brand-icons.ts`, `bun scripts/og-image.ts` | Not fixtures: generated assets on `--jz-bg`. `brand-assets-check.ts:97–98` reads the manifest; the PNGs are checked for size only |

No other fixture is touched. `.github/ci/shards.ts` `PAGE_CHECK_SPLITS` may need its part counts raised if new area screens push a part past 40 draws (pre-approved routine consequence, 14 Nov 2026).


---

# Part 2. Games: looks and levels

Read on branch `fable-polish-plan` at 715d0a9e, 20 Nov 2026. Read-only: no check, build or dev server was run.
Every line number below was read in the file as it is now. Paths are under `scripts/` unless a
full path is given.

Classes used in Part A:

- **1** = an assertion line that must change (owner's approval needed, dated note beside it).
- **2** = generated data or a fixture that a documented script re-records (routine re-run; the script is named).
- **3** = keeps passing if file names, attributes, sizes and budgets are kept.

### Things that hold for every family (read first)

| Fact | Where | Consequence |
|---|---|---|
| In Bun there is no `Image`, so every renderer draws its code art in checks (`strategyImage`, `sportsSprite`, `logicSprite`, `realArt` all answer null) | `strategy-overhaul-check.ts:295-296`, `sports-sprites-check.ts:93`, `logic-overhaul-1-check.tsx:472-475` | Re-rendered WebPs never change a canvas pixel digest. Only a change to renderer **code** does (skins-default, bastion's digest, art-check). |
| Per-file and per-game byte budgets are literals | 20 KB (Word), 25 KB a sprite and 400 KB a game (Pattern, Logic, Attention, Strategy, Sports, Cards), 90 KB / 700 KB (Speed), 16 KB (tiles), 60 KB (Strategy stills) | Class 3 while the new renders stay under; class 1 the moment a brighter, richer render goes over. |
| `design-lint-check` fails on new hex / rgb() / hsl() in added lines of `src/polish-layout/*.css` and `src/styles.css`; `src/polish-<family>/`, `src/puzzles/`, `src/components/puzzles/` are reported, never failed; `src/lib/arcade/` is skipped | `design-lint.ts:48-49, 57, 340` | Board colours changed in `polish-word`, `polish-pattern`, `polish-logic`… pass. Colours changed in `polish-layout/batch-w-numline.css`, `polish-nov3-pattern.css`, `game-frame.css` must be tokens (or carry `design-lint-ignore`). |
| Puzzle screens' notch and home-bar strips must be one colour with the page behind (`--screen-edge`), no row step over 2 | `bottom-clearance-check.ts:548-566` (rule in the header, 36-42) | A mid-tone category stage is class 3 only if it fades to the page colour before the top 47 px and bottom 50 px strips. Running the stage colour to the screen's edges is class 1. |
| Tiles: each `public/tiles/<type>.webp` must hash to `tileScenes.data.ts`, be 208 × 208 and at most 16 KB | `tile-scenes-check.ts:38, 49-53, 65-68` | Class 2: `bun scripts/shots/tile-scenes.ts` after any game's look changes. Line 51 (16 KB) is a literal. |
| Reveal gradients are generated from the colour rules; white must read 7:1 on every stop; "deep at the top, fading to near-black" | `reveal-palette-check.ts:27-28, 37, 146, 148`; tray `102` | Class 2: `bun scripts/reveal-palette.ts` after tiles are re-exported. Lines 37 and 148 are class 1 if the reveal is meant to go mid-tone; line 102 pins `.reveal-tray` to `color-mix(in srgb, var(--jz-bg) 72%, transparent)` (class 1 for a lighter tray). |
| `skins-default-check`: main's digests are "never re-recorded"; redesigned games move to their own record | `skins-default-check.ts:30-52` (`--record-overhaul=<games>`), `58-68` (`--record-cards`) | See Sports and Cards & Board. |

---

### Part A. Game looks

#### Word

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `word-overhaul-check.ts` | 264 | `ok(!/drop-shadow\|glow\|blur\(/i.test(allCss…), "the look has no glows (no drop-shadow, glow or blur)")` over word-look, keypad, interlock, slider, forage, lookout, roundabout, strikeout, cryptogrid, swapword, nucleus `.css` | **1** | The regex also fails on the bare word "glow" in a class or custom-property name. Not in the old K list. |
| `word-overhaul-check.ts` | 257-261 | `statSync(path).size === m.bytes`, `m.bytes <= 20_000`, `allCss.includes('/word-art/${name}.webp')` | 2 / 3 | `scripts/word-art/word_art.py` rewrites `public/word-art/manifest.json` (lines 543-556 of the script) with each render: routine. The 20 KB cap (260) is a literal. Every manifest name must still be used by the CSS (261). |
| `word-overhaul-check.ts` | 263 | `existsSync("scripts/word-art/word_art.py")` | 3 | |
| `word-overhaul-check.ts` | 278-279, 281 | `imports "@/polish-word/word-look.css"`, `/data-wa=/`, the four-attribute selector `[data-wa][data-wa][data-wa][data-wa] {` | 3 | Keep the `data-wa` / `data-wa-tone` / `data-wa-btn` attributes. |
| `word-overhaul-check.ts` | 359-372 | reveal markup `data-wr-version="overhaul"`, `data-wr-number`, `data-wr-pair`, `data-wr-tiles` | 3 | |
| `word-polish-check.ts` | 84 | "reduced motion: one still glow, no stagger, no movement" | 3 | About the finish effect, not the board. |

#### Number

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `number-overhaul-measure-numline-check.ts` | 135 | `!/drop-shadow\|text-shadow: 0 0 1\|0 0 14px/.test(css)` "Ballpark: nothing glows in the live round" (`polish-layout/batch-w-numline.css`) | **1** | K5. |
| same | 132 | ruler `numberArt("numline", "ruler-l/m/r")`, `"pin-placed" : "pin"` | **1** per K5 (steel tape) / 3 if the slices are only re-rendered | |
| same | 169 | `/numline\/card\.webp/` "the number card is the rendered lacquer card" | **1** per K5 / 3 if `card.webp` is re-rendered under its name | |
| same | 262-267, 270-271 | `z.t >= 72`, card `<= 60`, `minor={live ? 10 : 0}`, `height: 56px;` | **1** per K5 (no minor ticks) | 262-267 are proportions that a re-colour alone leaves alone. |
| same | 95 | `ok(!/#F5B82E/.test(s), "Brimful: no bright yellow")` (`src/puzzles/measure.tsx`) | **1** if the bright palette brings that yellow back | Not in the old K list. |
| same | 94, 167-168 | `numberArt("measure", "jug-front")`, `className="mj-shell"`, `${JUG_SLICE} fill /`, `.mj-surface::after`, `.mj-glass::after` | 3 | |
| same | 162-164 | `public/number/{measure/jug-front, measure/shelf, numline/ruler-l…pin-placed}.webp` exist; `docs/design/number-overhaul/source/{measure,numline}.py` exist | 3 | Number art URLs carry no hash (`numberArt()` in `src/components/puzzles/number/overhaul.tsx:29`), so a re-render needs no data file. |
| `number-overhaul-balance-target-check.ts`, `-checkout-kakuro-`, `-equation-pyramid-` | (whole files) | only markup hooks: `data-ready`, `.co-rv-dart`, `.np-art`, `data-np-tray-row`, `[data-route-step] [data-hit]` | 3 | No colour, glow, asset or size pin found in these three. |

#### Speed

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `speed-overhaul-check.ts` | 155-163 | the 42 sprite names expected in `speedArt.data.ts` (`"flash-wait"` … `chain-${s}-${c}`) | 3 | Same names. |
| same | 174-175 | `e.url === '/speed-art/${name}.webp?v=${hash}'`, `e.bytes === bytes.length` | **2** | `python3 -I docs/design/speed-art/blender/export.py <png_dir>` rewrites the WebPs and `src/lib/fx/speedArt.data.ts` (routine). |
| same | 176, 178 | `bytes.length < 90_000`, `total < 700_000` | 3 (literal budgets) | |
| same | 181-194 | `e.reach <= 1` for the gophers, discs and round charms; clay, bird, board and tile aspect ratios | 3 | Bounds rule: the new renders must keep each sprite's box shape and stay inside the circle. |
| same | 347-348 | `bonk-slam`, `td-ten-burst`, `flash-pop`, `flash-done-in` keyframes end at `opacity: 1` in `polish-speed/speed-overhaul.css` | 3 | |
| `polish-a-check.tsx` | 7-9 | `styles.css` literals `.game-column [data-polish]…justify-content: center`, `--lw-wheel: clamp(200px` | 3 | Only if styles.css is touched there. |

#### Attention

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `attention-overhaul-check.ts` | 275-284 | every eagle, spot, tally, pair, wire and cap sprite and `tile`, `tile-marked`, `shelves`, `rockpool`, `felt`, `floor`, `casing`, `terminal`, `screw`, `back`, `face` exists under `public/attention/<game>/` | 3 | No hash file (`attentionArt()` builds plain URLs). |
| same | 286-291 | `bytes <= 400 * 1024` a game; every file a `.webp` | 3 (literal budget) | |
| same | 293-294 | every `url("…")` in `polish-attention/attention-overhaul.css` exists | 3 | |
| same | 116-135, 159-162, 205 | colour changes at least `P.MIN_LIGHTNESS_GAP` L* apart, read from `P.SPOT_ENAMEL`, `P.TALLY_ENAMEL`, `P.PAIR_ENAMEL` | 3 (relation) | A brighter enamel palette must keep the lightness gaps; the check reads the palette, it does not pin its hex values. |
| `attention-levels-check.ts` | 163, 205, 226 | the same lightness-gap rule on level deals | 3 (relation) | |

#### Pattern

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `pattern-overhaul-flow-check.ts` | 216-220, 224 | bead / wall / cell WebPs in the board HTML; `!/feGaussianBlur\|flow-halo/`; "no glow on the lines" | **1** | K2. |
| same | 320-325 | no `drop-shadow\|filter:\|blur(\|mix-blend` in any `.flow-` rule of flow.css and batch-p.css; no `@keyframes` in flow.css; flowArt has no blur / blend / filter; "the board no longer washes a line's colour into its squares" (325) | **1** | K2 gives 318-324; 325 (the tint wash) belongs with it. |
| same | 343-349, 351-352 | "no layer lighter than the body (no lighter core)", "a thin dark edge", "darker sides", "one crisp highlight stripe", "nothing drawn outside the tube (no halo)", `hsl(body).l <= 0.52` "a strong pigment, not a screen neon", "the tube is deeper than the old neon line" | **1** | K2 lists 348-352; 343-347 and 349 also pin the dark-glossy tube. |
| same | 185-204 | every sprite a WebP with alpha, `<= 25_000`, total `<= 400_000` | 3 (literal budgets) | |
| `pattern-overhaul-pipes-check.ts` | 195, 197, 200-202 | `corner-1-dry.webp` / `-wet`, `valve.webp` in the HTML; "the old SVG pipework is still drawn" must be false; `tile.webp` in pipes.css; `!/drop-shadow/` in polish-nov3-pattern's Pipeline block | **1** | K3. |
| same | 173, 205 | `pipeArtUrls().length === 33`; the intro draws `/pattern-art/pipes/` and a leak | **1** if the SVG pipes return (K3) / 3 otherwise | |
| same | 155-172 | WebP + alpha, 25 KB, 400 KB | 3 | |
| `pattern-overhaul-unblock-check.ts` | 318-320 | `!/unblock-car[^{]*\{[^}]*drop-shadow\(0 0 /` "a glow rule is still on a Gridlock car" (unblock.css + batch-p.css) | **1** | K4's exact lines. |
| same | 280-300, 304-317 | sprite names, alpha, 25 KB, box shapes, `lot.webp >= 640`, 400 KB; board, stage and intro draw `gold-2h.webp` and the lot | 3 | |
| `pattern-overhaul-push-check.ts` | 299-303 | no `drop-shadow(0 0 ` on `push…`, no `drop-shadow\|box-shadow` on `d4-gold` (push.css, depth4.css); batch-p.css has no `.push-crate…drop-shadow` and no `.push-crate-lit` | **1** | K4's exact lines. |
| same | 259-298 | 160 × 160 cells, 25 KB, 400 KB; floor / wall / mark / crate / worker sprites drawn | 3 | Line 289's message says "as wood": a name only. |
| `pattern-overhaul-laser-check.ts` | 389, 391-392 | `!/#FFF1BD\|#A9AEC4\|laser-gem-sparkle\|laser-bomb-spark/`; `!/feGaussianBlur\|laser-beam-neon/`; `!/drop-shadow/` in batch-p's Lightbender block | **1** | K4's exact lines. 389 is also a colour-literal pin. |
| same | 351-368, 380-387, 395 | 10 sprites (`LASER_SPRITES.length === 10`), 25 KB, 400 KB; `gem-dark` / `gem-lit` / `bomb` / `emitter` / `floor.webp` / `brick.webp` wired | 3 | |
| `pattern-overhaul-iceslide-check.ts` | 344-349 | `!/\.ice-ball[^{]*\{[^}]*box-shadow/`; no `ice-glint\|ice-sheen\|ice-base-0`; the `.ice-board.ice-rink` rule has no `rgba(` but black: "a coloured glow is round the board" | **1** | K4's exact lines. |
| same | 269 | `[data-solution-view] .ice-reveal-board { width: min(100cqw, 380px); }` | **1** | K6, still at 269. |
| same | 314-343 | names, alpha, `rink` 120 KB, pieces 25 KB, 400 KB, square, sizes | 3 | |
| `pattern-overhaul-gravity-check.ts` | 313 | `!/topsy-[a-z]+[^{]*\{[^}]*drop-shadow\(0 0 /` **and** `/\.grav-ball\.is-locked \{\s*filter: drop-shadow\(0 2px 2px/` "a glow is still on a Topsy-Turvy ball" | **1** | Not in K4. The second half pins today's exact shadow rule, so even a changed shadow fails. |
| same | 281, 283-294, 309, 311 | `TOPSY_SPRITES.length === 19`; 25 KB; `>= 96` px; 400 KB; `marble-yellow.webp`, `hole-orange.webp`; topsy.css draws block / floor / frame URLs | 3 | |
| `pattern-overhaul-gravity-levels-check.ts` | 264-265 | `/"green": "#8BE04A", "white": "#E8ECF2"/` in `docs/design/game-art/pattern/source/gravity.py`; `TOPSY_COLOURS[6] === "#8BE04A"`, `[7] === "#E8ECF2"` | **1** if the marble colours change | A colour literal pinned in both the Blender source and the app. |
| `pattern-overhaul-blockparty-check.tsx` | 328-329 | reads `docs/design/game-art/pattern/source/blockparty.py`: `ellipsoid(` in `def peg():`, no `brass_dot\|brass_base\|collar`; `def tray_block(` and `tray-{name}` | 3 / **1** | Passes while the peg stays a plain dome and the function names stay; a rewritten script that renames them is class 1. |
| same | 162-191, 274 | names, alpha, 25 KB, 400 KB; `peg.webp` × 2, `well.webp` × 47, `tray-red.webp`; reveal width `min(100cqw, 360px)` | 3 | |
| `pattern-overhaul-blockparty-levels-check.tsx` | 180-188 | `BLOCK_ART_HASH === sha256(all files).slice(0, 8)` "update it after re-rendering"; every sprite URL ends `.webp?v=${BLOCK_ART_HASH}` | **2** | After re-rendering, set `BLOCK_ART_HASH` in `src/components/puzzles/pattern/blockPartyArt.tsx:125` (a constant, no script). |
| same | 176-179 | Expert draws 64 squares, `tray-cyan.webp`, `tray-slate.webp`; `<= 25_000`; eleven colours | 3 | |

Pattern's Blender sources are `docs/design/game-art/pattern/source/<game>.py` (the task's "Pattern art scripts"); no data file but Party Blocks' hash.

#### Logic 1 (Box Six, Polypotions, Hanoi, Safe Cracker, Mosaic, Colour Flood, Minefield)

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `logic-overhaul-1-check.tsx` | 448-452, 467 | the `SPRITES` list (`box-tile`, `flask-glass`, `potion-<colour>`, `hanoi-ring-1…9`, `safe-door`, `mosaic-tile`, `flood-pot-1…6`, `mine-raised`…) each exists in `public/logic-art/` | 3 | |
| same | 454-465 | `bytes > 0 && bytes <= 400 * 1024` a game | 3 (literal budget) | |
| same | 468-469 | every `/logic-art/<name>.webp` in `polish-logic/logic-overhaul-1.css` is in `SPRITES` | 3 / addition | A new sprite name used by the CSS must be added to the list (an addition, not a loosening). |
| `logic-1-levels-check.tsx` | 339-344 | the check's own table `LIQUIDS = { red: "FF4D4D", blue: "4D8CFF", … pearl: "E6DFD2" }`; each hidden grey `>= 0.04` luminance from every liquid and `lum > 0.4` | **1** if the potion colours change | The liquids' hex values are written in the check itself, so a brighter potion set leaves it testing the old colours. |
| `logic-polish-check.tsx` | 59, 102-103 | `logic-calm-glow` in every solved stage; the reduced-motion rule names it | 3 | Class name kept. |
| `logic-art-check.ts` | 7-11 | spawns `bun scripts/logic-art.ts --check` (rebuild in memory, fail on any difference) | **2** | `bun scripts/logic-art.ts` after `scripts/logic-art/render2.py` (and `render.py`) redraw the PNGs in `docs/design/logic-art/source`; it rewrites `public/logic-art/` and `src/puzzles/logicArt.data.ts`. |

#### Logic 2 (Tents and Trees, Shikaku, Lamplighter, Trail, Loopline, Regions, Island Link)

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `logic-overhaul-2-check.ts` | 198 | `/data-lit/.test(lit) && /lightup-lamp/.test(lit)` "lit squares fill and lamps are the bulb sprite" | **1** | K1. |
| same | 204-207 | one `class="logic2-glow"` layer; `pools === litSquares`; one `--logic2-light` each | **1** | K1. |
| same | 210, 213, 216 | `fences-slate`, `fences-peg`, `data-tone="met"`; `bridges-coin-met` × 2; `data-size` | 3 | |
| same | 218-226 | every `LOGIC_ART_URLS` file on disk; art + tile `< 400 * 1024` a game | 3 (literal budget) | The budget adds `public/tiles/<game>.webp`, so a heavier tile counts. |
| `logic-art-check.ts` | 7-11 | as above | **2** | `bun scripts/logic-art.ts`. |

#### Retro

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `retro-overhaul-check.ts` | 706-709 | `RETRO_HUD_MIN_PX === 11`; `retroHudFloorPx(want)` never under 11 | 3 | |
| same | 720 | `RETRO_SCREEN_MIN_PX === 11`, box 390 × 768 | 3 | |
| same | 745-746 | every Retro renderer draws text (`draws > 0`) and none below 11 px on a 390 × 844 phone, over a weak and a near bot's run | 3 / **1** | Survives a repaint. Line 745 fails for a game whose renderer draws no text at all (the plan's `hud: false` desktop flag must not be the path the check draws). |
| `snake-renderer-check.ts` | 30 | `!s.stats.colours.has('#4BFF7A') && !…has('#1E9C45')` "meteor/star sprites have no green" | **1** if a more saturated Meteor adds those greens | |
| same | 42, 44, 55 | `COMET_TAILS.length >= 5`, distinct, six colours each; no line between segments; no eyes | 3 | |
| `pinball-joulz-check.ts` | 70 | `art.PIN_JOULZ_GOLD === "#FFD84A"` | **1** if the gold changes | |
| `arcade-phone-notes-check.ts` | 222-223 | `STAR_DRAW_SCALE === 1.2`; `!/cityRow\|WINDOW_TONES/` "Hover: no city in the background" | **1** only if the plan restores Hover's city | |
| `arcade-fx-check.ts` | 877-880, 893-894 | every game has `ARCADE_FX_TEXT_COLOURS` fill and outline as `#RRGGBB` at 7:1; at least 10 distinct fills | 3 (relation) | New text colours must keep 7:1. |
| `wavefront-ships-check.ts` | 63-64, 70 | every hull inside its 28 px cell; "a few ships carry a tint" | 3 | |
| `tuning-b-check.ts` | 292 | `[data-arena-slot]::after { … background: var(--screen-edge); }` | 3 | |
| `presentation-geometry-check.tsx` | 215, 219 | `--screen-edge: #070709;`; `[data-arcade-play] [data-arena-slot] [data-play-area] { box-shadow: none; }` "no ring round an arcade world" | **1** if a lit edge returns round an arcade world | |
| `arcade-fill-check.ts` | 352, 363 | no black strip below or beside a world (browser) | 3 (relation) | |

No Retro check pins a Retro material (dithered court, enamel bricks, glass atoms): `retro-overhaul-check` proves play and the text floor only.

#### Action

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `bastion-overhaul-check.ts` | 217-233 | `strokes === 1` "outlined" (220); "every outline sits on the tank's own edges, within 2 px" (230); "no outline on a near tank" (233) | **1** | K8. |
| `bastion-levels-check.ts` | 345-359 | `h.digest("hex") === "7e7e3bf835e4b1639de751d0561a45d0de820c00ceb2bb1a21c637a3e385b7c5"` "Expert's tanks (100 % weak spots) draw pixel for pixel as before" (`paintTank` at depths 0-1400) | **1** | **Missing from K.** A SHA-256 written in the check, no record script. It hashes far tanks, so removing the far outline (C3.1) or any tank repaint breaks it. |
| `bastion-overhaul-check.ts` | 348 | `/GOLD/.test(hud) && /PANEL_TOP = "#121A31"/.test(art)` "the panel is navy with champagne-gold labels" | **1** if the panel is recoloured | Missing from K. |
| same | 165, 182 | the three skies differ by > 40; lane dividers' luminance step `>= 30` | 3 (relation) | |
| `swing-overhaul-check.ts` | 213 | `J.JUNGLE_LOOP_R >= 12` (with PAR label 14 px, rope 1.3×) | **1** | K9. |
| same | 437 | `J.JUNGLE_LOOP_R === 14` | **1** | K9. |
| same | 438-456 | `paintGrabRing(x, 40, 40, 14, false)` on `#1F3528`; `ratio >= 7` "the ring's cream band against its dark pad" | **1** | K9 gives 441-455; the block is 438-456 and the assertion is line 456. |
| same | 204, 839 | "the late jungle is darker than the early one"; "the canopy deepens" (`late < early * 0.85`) | 3 (relation) | A brighter jungle must still darken along the course. |
| `ricochet-overhaul-check.ts` | 509-523 | `FAR_LANTERN_COUNT >= 4 && inside`; "a far lantern is never taller than half a sky lantern" | **1** | K10 (look b). |
| same | 387-423 | ricoRev 4's deal, body and witnesses | addition | K10 (rev 5 beside rev 4). |
| same | 544-560 | `ninjaArtScale(4) === MOON_BIG_HW / 13`; the bigger ninja's ink | addition | K10 gives 543-567; the section ends at 562. |
| same | 561 | `!/rgba\(242,199,92,0\.55\)/.test(src)` "no gold rim round the ninja (Joe: no glowing edges)" | **1** if lit edges return on the ninja | Inside K10's range but a different pin. |
| `art-check.tsx` | 196-217 | 4a: ricoRev 4's figure `<= (main + 0.5) × 17/13 + 0.25` | addition | K11 (a rev-5 entry). |
| `art-check.tsx` | header 5-6, section 2 | "Tokens: the five metals' stops, their inks and the glow in tokens.css are docs/art/README.md's values" | **1** if `--jz-metal-*` / `--jz-glow` change | Only if "no brushed gold" reaches the reward tokens. |
| `arcade-phone-notes-check.ts` | 227 | `!/…ORBIT_MOON_ASSIST…ctx\.stroke\(\)/ && !/"#91877A"/` "Orbit: no dashed ring round a moon, no belt track line" | **1** if S3's Orbit "paths" work restores either | Missing from K. |
| same | 234 | `!/drawFarCity/ && /function drawCaveDepths/` "Roofbound: no city, the cave's depths instead" | 3 | |
| `orbit-overhaul-check.ts` | 337-340 | nine planet maps hash to `orbitPlanetMaps.data.ts`; `bytes === ORBIT_PLANET_MAP_BYTES && bytes <= 400_000` | **2** | `scripts/orbit-planets-blender.py` (its `--check` rebuilds byte for byte), only if the planets are re-baked. |
| same | 383, 406 | lit side `> 2.5 ×` night side, night never black; "an icy world's lit face is never warmer than blue" | 3 (relation) | |
| `skyline-overhaul-check.ts` | 286, 408, 418, 509-510 | dusk to night monotone; no black beside the world; no colour step under it; the six Action ids are edgeless, seven others keep their edge glow | 3 | 509-510 name games: a lit edge back on an Action game is class 1. |
| `flip-overhaul-check.ts` | 254, 336-340, 402, 408 | side columns are the bedrock; gold puffs on the 8 sweet spots; "Roofbound draws no edge glow" | 3 | |

#### Strategy

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `strategy-overhaul-check.ts` | 298 | `if (rendered) ctx.drawImage(rendered, cx - radius, …); else flatGem` "Gemstone: the rendered stone" | **1** | K12 (its "299"). |
| same | 300 | `ctx.drawImage(body, x - r, y - r, r * 2, r * 2)` + `toyMarble(…)` "Ball Tracker: the rendered marble" | **1** | K12 (its "302"). |
| same | 301 | Tilt "rendered marbles at the marble's radius and the lacquered disc" (`strategyImage("tilt-disc")`) | **1** | K12 (its "305"); "lacquered" is the material the new direction drops. |
| same | 299 | Coral Pop "the rendered bubble at its own size" | 3 | Bubbles stay on the render route. |
| same | 304-306 | `"gem-heart" in STRATEGY_ART && "bubble-orange" in STRATEGY_ART`; the heart draws its rendered stone | **1** for `gem-heart` if gems go to code / 3 for the bubble | |
| same | 277 | `files === Object.keys(STRATEGY_ART)` "every rendered image is in strategyArt.data.ts, and nothing else" | **2** | `bun scripts/strategy-art-data.ts` after `docs/design/cosmetics-redraws/blender/strategy_art.py` re-renders or files are removed. |
| same | 280 | each file's sha256 prefix is `STRATEGY_ART[name]` | **2** | Same script. |
| same | 283-293 | budget prefixes `tilt-`, `marble-gloss`, `gem-`, `matchup-`, `bubble-`, `inkbridge-`, `bt-`; `bytes > 0 && bytes <= 400_000` | 3 / **1** | `bytes > 0` survives because the intro still is counted; the prefix table is class 1 only if files are renamed. |
| same | 252-255 | intro stills `> 4000 && <= 60_000` bytes; hash equals `STRATEGY_STILLS[type]`; `<FrameStill type=…>` | **2** | `bun scripts/shots/strategy-stills.ts` after any of the five games' look changes. |
| same | 223-227 | `WALNUT_TABLE` shaded by `TILT_TABLE_SHADE` equals `WALNUT_TABLE_EDGE`; arenaFills and the stage use it | 3 / **1** | A relation between two constants, but named for walnut; class 1 if the constants are renamed. |
| same | 325, 329 | reveal draws `<img src="/strategy/gem-` × 6, `/strategy/matchup-chest` × 6, `/strategy/inkbridge-coin` × 10 | **1** if gems leave the render route (the reveal's gem images go too) | Inside K12's 354-405? No: these are 325 and 329, outside both K12 ranges. |
| same | 336 | `!/#[0-9a-fA-F]{3,8}\b\|rgba?\(/.test(css)` "the reveal's styles use tokens only" (`polish-layout/strategy-reveal.css`) | 3 | |
| same | 385, 393 | `warnOn ? "rgba(255,92,80,0.85)"`; `woodPattern(ctx, "bt-walnut")` and `woodPattern(c, "bt-board")` "oak board and walnut grooves" | **1** if Ball Tracker's board or the warning colour is repainted | Source-text pins on `bubble.renderer.ts` and `ballTrackArt.renderer.ts`. |
| same | 378-392 | sixteen other source-text pins on effect code (`blitX(ctx, 'dial:…'`, `ctx.rotate(swapU * 1.6 * swapFx)`, `INK_CAPTAIN_H = 70`…) | 3 | They fail on any rewrite of those lines, look change or not. |
| `tilt-rev12-check.ts` | 126, 130 | `if (big) drawWalnutTable`, `paintWalnutDisc`, `drawBrassStrips`, `drawBrassBed(c, R)` "walnut table and disc, brass rim and walls"; `WALNUT_TABLE`, `tiltWalnutFill` | **1** if Tilt loses its brass and walnut | Missing from K. Function-name pins in `tiltArt.renderer.ts`. |
| `gemstone-rev10-check.ts` | 178 | `/#C8803E/.test(art) && !/#FFCF4A/.test(art)` "the treasure is bronze (no gold medallion)" (`matchup.renderer.ts`) | **1** if the chest is recoloured | Missing from K. |
| `arcade-phone-notes-check.ts` | 232 | `!/function cameraX/ && /const cam = \{ x: 0, y: 0 \};/` "Tilt: the camera stays on the disc's centre" | 3 | |

#### Sports

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `skins-default-check.ts` | 56, 82-84 + `fixtures/skins-default-frames.json` | Crazy Golf (9 frames) and Top Bins (6 frames) are still held to main's digests, "never re-recorded" | **1 then 2** | Repainting `minigolf.renderer.ts` or Top Bins' code art needs the game moved to the overhaul record: `bun scripts/skins-default-check.ts --record-overhaul=minigolf,freekick` (lines 30-52), with approval. K13 covers curling only. |
| same | 71-72, 121-128 + `fixtures/skins-default-frames-overhaul.json` | Cue Ball (13), Curl Champ (10), Apex (5) held to the overhaul record | **2** | `--record-overhaul=curling` (K13), `=pool`, `=racing` after a code repaint. |
| `sports-sprites-check.ts` | 16, 46-50, 87-88 | `BUDGET_KB = 400`; `FILES` = pool `arm`, `table`; curling `slide`, `release`, `arena`, `stone-gold`, `stone-red`; racing 21 frames; sizes equal `sportsSprites.data.ts`; "no stray images" | 3 / 2 | `docs/design/game-art/sports/render_sports.py` writes `public/sports/<game>/` and the anchors in `src/lib/arcade/sportsSprites.data.ts`; a new or removed image changes the `FILES` list (class 1). |
| `pool-overhaul-check.ts` | 129, 144-148 | gold = `r > 200 && g > 160 && b < 140`; `dark = all < 40`; `felt = g > r + 15 && g > 50` "the felt's green"; "an open black is drawn with its gold ring" | **1** if the cloth stops being green or the ring stops being gold | Pixel classifiers on `drawPool`'s code art. |
| same | 245, 553 | `kb < 400`; "no glare across the felt or the numbers" | 3 | |
| `curling-overhaul-check.ts` | 103-104, 111 | `slide.webp` / `release.webp` sizes equal `CURL_CAPTAIN`; the hand anchor is on the sprite's hand | 2 / 3 | Re-rendering the Captain re-records the anchors through `render_curling.py` / `render_sports.py`. |
| `apex-overhaul-check.ts` | 66, 68, 75, 104 | 21 car sprites; under 400 KB; one shared size; lowest pixel on the contact line | 3 | |
| `racing-render-check.ts` | whole | saving on = saving off, pixel for pixel | 3 (relation) | |
| `freekick-layered-check.ts` | 216-218 | `strikeFromStroke(straight, 2) === STRIKE_DRIVE`, `(bent, 70) === STRIKE_CURL`, `(flick, 10) === STRIKE_DIP` | addition | K14 gives 210-218; the block is 210-219. |

#### Cards & Board

| Check | Lines | Asserts today (quote) | Class | Note |
|---|---|---|---|---|
| `cards-board-overhaul-check.ts` | 214 | every image exists in `public/cards-board/` | 3 | `scripts/cards-board-art/{textures.ts, render.py, pack.py}`; no hash file (atlas URLs are plain, `realArt.renderer.ts:24-26`). |
| same | 218-219 | card game `< 400` KB; Mahjong `< 400` KB | 3 (literal budget) | |
| same | 232, 236, 238 | cards 0.68 aspect; tile `(W+6)/(H+6)`; felt `828 × 1544` | 3 | The atlas cell sizes must stay. |
| same | 239, 242 | the Blender pipeline's three files exist; `drawCard` has no `realArt` | 3 | |
| `skins-default-check.ts` | 58-68, 104-116 + `fixtures/skins-default-frames-cards.json` | Free Cell, Summit, Thirteen, Five Hands (9 frames each) held to the cards record | **2** | `bun scripts/skins-default-check.ts --record-cards`, only if `cardFace.renderer.ts` or the felt's **code** art changes (a WebP re-render does not move these digests). |
| `skins-check.ts` | 224-241, 273 + `fixtures/skins-deck-frames.json` | Full House's deck frames "recorded on main, never re-recorded" | 3 | Untouched while the shared `drawCard` is untouched. |

---

### Part B. Difficulty levels

"Table" means the assertion reads the level's own settings object and so follows a redesign; "literal" means the number or
string is written in the check.

| Game | Check | Lines | What is pinned as a literal | Relations that survive |
|---|---|---|---|---|
| all Word games | `word-levels-lib.ts` | 48-54 | ABOUT line `<= 90` chars, one sentence; must say "N seconds" whenever the clock is not `100_000` | jargon list read from `SCORE_JARGON` |
| Interlock, Slider, Swapword | `word-levels-shared.ts` | 44, 51-55, 60 | all four levels offered; ABOUT 10-100 chars, no `core\|units\|full at\|par`; names its clock in "N seconds" | 58-67: stamped, clock = `clockOf(level)` ≤ 120 s, same deal for all, not Normal's board, Normal byte for byte |
| Nucleus | `wordsmith-levels-check.ts` | 34; 70 and 76 (`BANDS` easy 155-182, normal 145-168, hard 128-155, expert 110-138); 78 (`- 8`); 85 (`- 5`) | 48-50 Normal; 55-65 read `s.timeLimitMs`, `s.sizes`, `s.everyday`; 79 |
| Forage | `wordhunt-levels-check.ts` | 35; 56 (an `N × N` board at every level); 71 and 77 (`BANDS` 170-195, 158-184, 138-164, 115-142); 86 | 48-49; 53-66 read `s.timeLimitMs`, `s.words`; 79-80 |
| Interlock | `tilegrid-levels-check.ts` | 31 (fifteen tiles); 36 ("an H of one across word and two down words"); 69 (near ≥ 190); 71 (Easy, Normal great ≥ 185); 74 (Expert great ≥ 100); 75 (`TG_TIME_MS === 100_000`) | 39-47 read `s.acrossLen`, `s.cross`, `s.innerAcross`; 72-73 |
| Slider | `wordslide-levels-check.ts` | 41-43 (Easy par ≤ 3, Hard par === 7, Expert par === 8); 51, 56 (< 1500 ms); 75-76 (near ≥ 190, great ≥ 185 at every level); 94-101 (`fixtures/slider-human-levels.json`, 24 boards a level: re-record with `bun scripts/slider-human-record.ts`); 110-113 (steps of 10; Expert done ≥ 2, best ≥ 180) | 38 (`wordSlideLevelRuleBreak(d, s)`); 44; 82-85 (solver's line is par, perfect is 200) |
| Swapword | `swapword-levels-check.ts` | 34 (six answer words, grid of 3); 51 (six steps); 72 (≥ 190); 74-76 (185, `- 10`, ≥ 100) | 32, 35-38 (one arrangement, human solver, no guess) |
| Lookout | `wordsearch-levels-check.ts` | 61 (`s.cols <= 10`); 65-67 (Easy 2 directions, Hard and Expert 8, Expert decoys > 0); 97-98 (`bun scripts/word-search-level-bank.ts --check`); 102 (bank ≥ 300); 163-168 with 185-187 (`BANDS` near / great per level; near finishes ≥ 18 of 20) | 73-76 Normal; 88-93 read `s.cols`, `s.rows`, `s.words`, `s.timeLimitMs`; 106-140 bank rules |
| Roundabout | `letterwheel-levels-check.ts` | 38; 116 and 122 (`BANDS` 170-195, 162-186, 155-180, 148-174); 131 | 53 (`bank.length === lim.bank`, table); 93; 100-111 |
| Strikeout | `strikeout-levels-check.ts` | 50; 56 (strikes ≥ 10); 106-111 with 129-131 (`BANDS` and `finishNear` 1 / 1 / 0.9 / 0.75); 136-137 (14 markers at 16 px fit 320 px) | 64-67 Normal; 78-98 read `s.strikes`, `s.vowels`, `s.timeLimitMs`; one answer at every Solve |
| Cryptogrid | `codeword-levels-check.ts` | 52; 59-60 (line ≤ 100 chars, names the starting letters as "Four" / "Five" / "Eight"); 62 (Easy > 6, Hard < 6, Expert === 4); 101-102 (Expert list rebuilds exactly, ≥ 500: `bun scripts/codeword-expert-bank.ts --check`); 110; 113-118 with 134, 139 (`BANDS`, step of 10) | 67-68 Normal; 78-95 read `s.givens`, `s.clockMs`; one solution |
| Counterweight, Exact | `number-levels-balance-target-check.ts` | 56; 61 (Exact 75 s at every level); **73-84 ("Counterweight Hard is today's deal exactly on 30 seeds")**; 88 (Hard deals `balanceRev 4`); 154-163 (person-like solver on 100 Expert boards); 187 (Exact Expert bank ≥ 300); 193 (bank rebuilds); 203-204 (every Expert deal a bank board, < 50 ms); 244 (stored route scores 200); 251-252 (Normal and Hard show the readout, Expert hides it); 260, 267 (goal line names the scales) | 85-86 Normal; 92-118 read `BALANCE_NORMAL` / `gameLevelSettings`; 146 |
| Checkout, Kakuro | `number-levels-checkout-kakuro-check.ts` | 92; 95-96 (proof strings); 102 (`"today" in` Hard's settings); **116 ("Hard is today's game byte for byte", 40 seeds)**; **152 ("Hard grades every answer exactly as today's game")**; 202-206 (Easy three standard any-ring boards; Normal five; Expert five exact with negatives, quad, uneven); 253 (≤ 7 across, ≥ 40 px); 255 (`docs/design/pages-review/number/img/kakuro-expert.webp` exists); 270-274; 278-279 (help text "Easy is three standard boards that finish on any dart", "Expert a 7 × 7 board"); 287 (≥ 80 %) | 118-125 Normal; 196-198, 240-243 read the settings; 262-266 |
| Operator, Integer Pyramid | `number-levels-equation-pyramid-check.ts` | 53; 58-60 (Operator clocks Easy 90 s, Hard 85 s, Expert 78 s; Pyramid 120 s); 81-82 (`bun scripts/number-pyramid-levels-bank.ts --check`); 108 (bank ≥ 100); 132; 178 (150 of 150); 192 (`p.speedFullByS === 40` at every level) | 75-77, 196 Normal; 97-111 read `settings.stages`, `settings.decoys`; 175-187 read `settings.lines`, `settings.tries` |
| Brimful, Ballpark | `number-levels-measure-numline-check.ts` | 60; 70-71 (open-answer strings, exact); **81 ("Brimful Hard is today's game byte for byte, measureRev 4", 60 seeds)**; 85; **158 ("Hard grades every answer exactly as today's game")**; 214-218 (three lines of five; Expert hides the top label until three are placed; Easy whole numbers and halves); 232-233 (help: `Levels:` with "Expert" / "10,000"); 241 (≥ 80 %) | 139-142, 178-179 Normal; 89-129 read `settingsOf(level)` |
| Flash, Ascend, Chain, Bonk, Tenfall, Pull! | `speed-levels-check.ts` | 64; 123 (`ceil(links / 5)` boards); 142 (± 12 %); 151 (targets ≥ 10); 166 (last launch 120 ticks before the end); 178 ("the run length is the same at every level", ≤ 7200); 204 (> 100); 215-217 (steps of 3); 220 (Expert best tenth ≥ min(140, Normal)); 229-232 (level line starts "Easy:", ≤ 110 chars; help has `Levels:`) | 66 (registry = `speedLevels.ts` tables); 77-79 Normal; 92-165 read `s.*`; 188, 196 (the stamp is read) |
| Eagle Eye, Double Take, Tally, Labyrinth, Bomb Defusal, Matchmaker | `attention-levels-check.ts` | 82; 86 (proof string); 101-102 (Eagle Eye's clock is `SCAN_MINUTE_MS` at **every** level); 135 (false trails ≥ 5 and ≥ 11 long); 166 (Hard's colour change is the nearest legible one); 189 (≥ 45°); 198 (tray ≤ 110); 304 (flawless 200); 319-321 (Expert bomb: 3 right steps, live check shape); 330, 337 (400 orders; every Expert bank panel); 340 (75 %); 351 | 85 (registry = data rows); 91-92 Normal; 124-233 read `MAZE_LEVELS`, `SPOT_LEVELS`, `SCAN_LEVELS`, `TALLY_LEVELS`, `PAIR_LEVELS`, `BOMB_LEVELS`; 243 |
| Gridlock | `pattern-overhaul-unblock-levels-check.ts` | 75; **76-82 (`spec`: Easy 6 cols, 6-12 moves, 8-10 cars, 60 s, full by 40; Hard 7, 22-30, 12-14, 60 s, 28; Expert 7, 40-48, 13-15, 90 s, 30)**; 142-144 (Expert 12 deeper); 151, 158-159 (bank rebuilds); 175 (`unblockRev === 4`); 184; 201 (≥ 40 px); 204 (lot CSS); 229 (40 s); 247-264 (`lot-6.webp`, `data-unblock-cols="6"`); 266 | 88, 190-192 Normal; 96-132; 173-180; 213-222 read `speedFullByS` |
| Party Blocks | `pattern-overhaul-blockparty-levels-check.tsx` | 66; 71; **77-85 (`want`: Easy 6 cols, 6 pieces, ≥ 20 ways, 60 s; Hard 7, 9, 2-5, 60 s; Expert 8, 11, 1-2, 70 s)**; 87 (Hard is Normal's board and pieces); 99 (`blockRev 4`); 123 (bank === 300); 143-144 (`bun scripts/blockparty-levels-bank.ts --check`); 171 (≥ 40 px); 175-177 (Expert four to a row, 64 squares); 192-196; 203, 207 (human limits 4 / 3) | 72-75; 98-106; 114-116 Normal; 130-139; 153-166 |
| Chroma Lines | `pattern-overhaul-flow-levels-check.ts` | 72; **83-85 (Easy 6 × 6, 5-6 pairs, no walls, 75 s; Hard 9 × 9, 8-9, 4-6 walls, 75 s; Expert 9 × 12, 12-14, 4-6, 90 s)**; 96 (`flowRev 3`); 105; 128-129 (bank size and SHA-256 build stamp); 147; 156 (≥ 39 px); 158; 187; 219 (≥ 0.9); 224-229 (fourteen colours, CYAN and TAN for Expert); 234-235 (108 squares, `9 / 12`) | 76-78; 95-102; 115-121, 174-178 Normal; 142; 182-183; 217-218 |
| Pipeline | `pattern-overhaul-pipes-levels-check.ts` | 92; **69-74 with 97 (`WANT`: Easy 5 × 5, 0.6 exact; Hard 8 × 8, 0.9; Expert 8 × 11, 0.95, leaks hidden, full by 90 s)**; 108 (`pipesRev 5`); 110 (120 s at every level); 240-241; 276 (≥ 8); 286-298 (8 × 11, 88 tiles, 176 on the reveal, "3 of 88"); 300 | 106-120; 191-234 Normal (fixture `PIPES_LEVELS_NORMAL_SEEDS`); 249-267 |
| Topsy-Turvy | `pattern-overhaul-gravity-levels-check.ts` | 87; **88-94 (`spec`: Easy 3 balls, 2 boards, 2-4 tilts, spare 12, full by 20; Hard 6, 3, 6-9, spare 6, 30; Expert 8, 3, 7-10, spare 5, 30; all 120 s)**; 97 (open string, exact); 100, 105-106; 116, 163, 170-172 (bank); 188 (`gravityRev 8`); 204; 244-249; 308, 313; 321-323 (three rings "Board 1/2", eight rings "Board 1/3"); 331 ("Left 90 s"); 344-350, 368 (Round pills' px) | 108, 216-237 Normal (fixture of 16 deals, 128 grades); 152-153; 186-200; 275-303 |
| Skid | `pattern-overhaul-iceslide-levels-check.ts` | 89; **79-83 with 92 (`WANT`: Easy 8 × 8, 8-12, no holes or thin ice, 90 s; Hard 12 × 12, 24-30, 5-8 holes, 100 s; Expert 11 × 13, 28-36, 120 s)**; 100, 103; 110-111 (bank size and SHA-256); 132-134; 146 (`slideRev 5`); 150; 181-190; 214, 217; 228, 241; 250-262 (11 × 13, 143 squares, 64, 144, 286); 265 (help names each level's "N s on Easy"); 396-399 (browser cell sizes) | 93-97; 116-129; 145-153; 159-175 Normal; 200-205 |
| Lightbender | `pattern-overhaul-laser-levels-check.ts` | 77; **89-91 (Easy 4-5 mirrors, 3 spare, 1-2 bombs, 5 shots, 60 s; Hard 8-9, 1, 4-5, 3, 75 s; Expert 9-10, 1, 5-6, 2, 90 s)**; 135; 143-144 (bank size and SHA-256); 173; 225; 267; 276, 282; 295-296; 312 (`- 4`); 324-325 (≥ 0.9, ≥ 180) | 81-84; 130-132; 167-168; 214-217, 248-252 Normal; 256-264; 294 |
| Heave | `pattern-overhaul-push-levels-check.ts` | 142; 146 (`NORMAL_REV === 3`); **83-87 with 150-155 (`WANT`: Easy 3 crates, 8-14, hint on, full by 30; Hard 5, 25-32, detour, 45; Expert 6, 30-40, detour, 45)**; 166 (120 s at every level); 170; 179 (bank === 120); 242; 284 (45 s); 292; 299; 304-305, 344-348 (hint on Easy and Normal only); 364 | 161-168; 184-216; 223-227 Normal; 255; 268, 273; 282 |
| Box Six, Polypotions, Hanoi, Safe Cracker, Mosaic, Colour Flood, Minefield | `logic-1-levels-check.tsx` | 90; 129 (200 banked Box Six boards a level); 153 (pour allowance ≥ min + 6); 166 (`towerRev 1`); 233 (200 Expert safe cards); 277 (flood bank ≥ 120 Hard, ≥ 48 Expert); 288 (par + spare); **298-300 (`want`: `MINES_REV_EASY`, `NORMAL`, `LOGIC` for Hard, `EXPERT`)**; **318 ("Normal has 16 mines, Hard today's 20")**; 319 (Expert 120 s); 326; 369-371, 381 (Expert hides clashes until Check; Easy hides a digit placed six times); 392 (twelve flasks); 402-403 (five drums, "tries left 2"); 410 (six paint pots); 418 | 96-97; 108-112, 145-151, 162-165, 202-225, 251-262, 271-272, 281-290, 303-306, 324 read each `lv` row; 118-119, 191-193 Normal |
| the same seven | `logic-1-steps-check.ts` | 20-24 (`EASY_STEP 1`, `LEVEL_STEP 5`, `NEAR_SLACK 0.5`, `EXPERT_FINISH 0.75`, `EXPERT_BEST_TENTH 185`) with 43-48 | the order itself |
| Tents and Trees, Shikaku, Lamplighter, Trail, Loopline, Regions, Island Link | `logic-levels-check.ts` | 127 (Normal's width at every level); 175 (finish ≥ 150); 182-184 (four levels, proof string); 210 (`LOGIC_LEVEL_BANK_SIZE`); 221-225 (bank entries rebuild: `bun scripts/logic-level-bank.ts --check`); 233-234 (Trail Easy leaves 22, Normal 26); 237; 246 (> 0.5) | 130-156 read `s.height`, `s.pairs`, `s.hidden`, `s.rects`, `s.maxArea`, `s.walls`, `s.numbered`, `s.givens`, `s.size`, `s.minClues`, `s.islands`; 165-172 (clock, one solution, person solver inside `s.person`); 192-198 Normal |
| Hover, Breaker, Rally, Tempo, Meteor, Fission, Blockzone, Pinball, Spacewalk | none | - | **No check reads `src/lib/arcade/retroLevels.ts`** (grep of every `scripts/*-check.ts(x)`); `retro-overhaul-check.ts`'s "levels" (144, 229, 306, 351, 414, 504, 549, 726) are bot skill levels | only `difficulty-check.ts:121-139` (each level deals without throwing, clock ≤ 120 s) and Normal's `retro-demos-check` |
| Wavefront | `wavefront-deal-check.ts` | 29 (≥ 60 seeds); 30 (every witness scores 200 at Normal, Easy, Hard, Expert); 32-33 (`wavefrontDeal.server.ts` is exactly the witnessed seeds) | re-record: `bun scripts/wavefront-big-deal.ts`; 42-50 (2,000 deals on a witnessed seed, `wavRev 15`) |
| Roofbound | `flip-levels-check.ts` | 95; 138-140 (Easy `stepTicks === 240`, no movers; Hard `180`, movers from `480`, `crashCost === 40`; Expert `150`, `300`, > 8 sweet spots); 135 (`110`, `120`); 147 (`FLIP_RUN_TICKS === 3600`); 166 (deal file rebuilds: `bun scripts/flip-level-deal.ts`); 172 (≥ 200 dealt); 185-186; 247 | 79-90 Normal (fixture `levels-action-legacy.json.gz`); 100 (registry mirrors `FLIP_LEVEL_RULES`); 121-130 read `r.*` |
| High Rise | `skyline-levels-check.ts` | 90; 84 (Normal 3 px, wind from 20, 3 lives); **105-109 (Easy 5 px, wind from 30, 3 lives; Hard 3 px, 15, 3; Expert 2 px, 10, 3)**; 117-118 (4 px and 2 px + 1 drops); 136 (3600 ticks); 143 (≥ 2 lives); 186 (oracle 200); **201-203 (Skyscraper "61 floors on Expert", `SKYLINE_V9_FULL_AT === 61`, the oracle builds 61+ on Expert)** | 72-83 Normal; 94 (registry mirrors `SKYLINE_LEVEL_RULES`); 97-102, 128 |
| Grappler | `swing-levels-check.ts` | 91; 97 (≥ 20 courses a level; deal = witnesses); 117 (course part 110); **119-126 (Hard reach `220 * 256`, Easy longer, Expert shorter; Expert seven ledge runs; sliders around 18; Easy swing `=== 100`)**; 145, 148; **153, 165 (King of the swingers is the Expert challenge and is met on every sampled Expert course)**; 164 (witness 200) | 68-87 Normal; 96 (registry = `SWING_LEVELS`); 99-111 read `c.*`; 168, 175 |
| Moon Climb | `ricochet-levels-check.ts` | 104; **116-117 (`fullM` 200 / 245 / 260; Easy knock 2 m; Expert 4 lanterns)**; 133-135 (blade, moss, ice and shuriken ratios); 155, 158; **163, 176 (Moonwalker is the Hard challenge, met on every sampled Hard tower)**; 175; 180 (`MOON_SCROLLS === 3`) | 79-99 Normal; 108-114 (registry = `MOON_LEVELS`; parts sum to 200); 147; 178-179 |
| Iron Wall | `bastion-levels-check.ts` | 135; **127, 145 (Expert deals `bastionRev 3` and grades exactly as the rev-3 fixture: Expert is today's old game)**; 138-141 (Easy, Normal, Hard on `bastionRev 4`); 150; 156 (`ms === 63_000`); **170-172 (base hits 5 / 4 / 3; Easy weak spots open ≥ 80)**; 227 (parts `core:110 weak:30 fast:20 drone:30 base:10`); 230-232; 252; 359 (the pixel digest, see Part A) | 108-130 older stamps (`fixtures/bastion-levels-legacy.json`); 168 (each level gentler on every lever); 178-200 read `set.*`; 261, 268-269 |
| Orbit | `orbit-levels-check.ts` | 106 (Normal bank file's SHA-256); 140-141; 147 (bank ≥ 24); 203, 216 (Easy auto checkpoints at planets 10, 20, 30); 221 (Expert respawn only); **232, 247 (Stargazer is a Hard challenge, met by every Hard witness)**; 246; 275-277 (`bun scripts/orbit-fuel-bank.ts --check <n> --level=…`) | 114-135 Normal and older stamps; 145 (registry = sim's `rules`); 157-198 read `rules.tank`, `rules.checkpoints`; 268 |
| Tilt | `tilt-levels-check.ts` | 66; 99 (levels' deal file rebuilds from witnesses); 105 (≥ 60 seeds); 117; **140-142 (two marbles: Easy on maze 3 only, Hard on 2 of mazes 2-4, Expert 2-3)**; **145-148 (Easy 3 mazes, Hard and Expert 4; sizes against `[13, 15, 17]`; pits ≤ 1 / 3-4 / 4; ice 3-4 / 5)**; 184-186 (`docs/arcade-standard/tilt.md` has a Levels section with Easy, Normal, Hard, Expert rows) | 70-72 (registry = `TILT_LEVELS`); 79-84 Normal; 90-94; 132-137 read `spec.*`; 144, 149; 154-177 |
| Gemstone | `gemstone-levels-check.ts` | 179; **185-188 (`want`: Easy 5 colours, 5 goals, 5 ice, hint 3 s; Normal 6, 6, 10, 5; Hard 6, 6, 14, 8; Expert 7, 7, 18, none)**; 190 (5400 ticks); 228, 234; 280-284 and 296-298 (`fixtures/gemstone-levels-runs.json` witnesses and runs: no record flag named in the check); 313-314 (steps of 4); 316-317 (≥ 145; ≥ 120, best ≥ 170); 319; 341, 343 (heart shape, `SUMMARY_COLOUR7`) | 78-108 older stamps and Normal; 183 (registry = sim); 200-212; 216-218; 243-270 |
| Coral Pop | `bubble-levels-check.ts` | 80; 142 (120 of 120 reefs: `set.reef`, `set.colours`, **6 chests**); 144, 239-243 (sixth colour, seahorse); 169 (90 s); 216-226 (witness file `fixtures/bubble-levels-normal.json` and recorded witnesses); 229-233 (order; Easy star 175+; Expert ≥ 120, best ≥ 170); **263-266 (trail: Normal ≥ 3 bounces, Easy 2, Hard 1, Expert 0)** | 81 (registry = `BUB_LEVELS`); 86, 101-107 Normal and older stamps; 155-158; 196-203 |
| Rainbow Bridge | `ink-levels-check.ts` | 75; **80-85 (ink 150 / 110 / 100 %; live levels none / from 7 / from 6; par margins 25 / 10 / 0 %; birds 25 %)**; 158 (≥ 50 seeds; deal = witnesses); 165; **239-240 (speed full with 10 s left on Easy, 70 s on Hard, 85 s on Expert)**; **246-247 (Easy clover 60 % along, tricks full at 2, clovers at 1)**; 263; 267-268 (trick and clover points) | 76 (registry = `INK_LEVEL_SETS`); 77-79, 93-102 Normal; 113-142 read `set.*`; 150-151; 222-225 |
| Ball Tracker | `balltrack-levels-check.ts` | 68; **70-74 (Easy 16 marbles every 190 ticks, cups never move, combos full at 10; Hard 42 every 72; Expert 42 every 66, fewer than 3 boosters)**; 116-117 (`BT_LEVEL_COUNT`, one witness each); 125 (moves before 48 s); 134 (released by 50 s); 138, 146 (200); 174 (intro line "N marbles", "move N times" / "never move"); 185-189 | 86-107 Normal and legacy; 124, 154-172 read `s.*` |
| Apex | `racing-levels-check.ts` | 67; **72-76 (gravel keeps 80 / 60 / 50 %; Easy wider; only Expert tightens; aids 2 / 1 / 0)**; 104 (each deal 300 seeds, 100 a circuit); 151 (`tightBy [2, 2, 0]`, circuit `ridge`); 197, 216 (oracle 200: `bun scripts/racing-deal.ts --rev=4 --level=…`); 239-241 (boards, braking points, signs per level); **276 (level lines say "80 %", "60 %", "half")**; **282-286 (Two hundred club completes on Normal only)**; 296 (Expert elite median ≥ 140) | 85, 112-125 Normal; 99-103; 130-148 read `lv.*`; 224; 295, 300 |
| Curl Champ | `curling-levels-check.ts` | 59; 68 (the level line names "two" / "four" / "five" reds); 74 (Normal full at 95); 78, 80 (120 s at every level); 83 (`NORMAL_DIGEST`); 97 (bank ≥ 20); **137-139 (Easy zone and the whole path; Hard zone and a third; Expert neither)**; 150 | 64-66, 70 (registry = sim); 87-91 Normal; 101-123 (witness 200); 146 |
| Home Run | `homerun-innings-check.ts` | 71 (120 proved seeds a level); 198-200 (40 pitches, 7 fielders, the zone's box 212-304 × 446-566); 253 (Normal `ballOff` `[14,34]`); 261-263 (Normal ≥ 190; steps of 15; Expert ≥ 120); 269; 277 (`HOMERUN_REV_5`) | 73; 179-188 read `L.winContact`, `L.winPower`, `L.perfect`; 199 (`L.balls`); 210-211, 244, 251-252; 273 (registry = sim) |
| Top Bins | `freekick-layered-check.ts` | 90 (60 proved seeds a level); 247; 254 (Normal's keeper is Easy's); 257 (`FREEKICK_REV_6`); **267 (rev 5 Hard `react === 8`, `speed === 1120`, Expert `wind === 5`)**; 284 (Goals 120 at `FK_V6_CORE_FULL[level]`); 297-299 (`- 6`, `- 15`, `- 10`, ≥ 110) | 92, 287 (oracle 200); 102-108 read `L.wall`, `L.wind`, `L.jumps`, `L.react`, `L.zoneLo/Hi`, `L.hoopLast`; 252; 266-273 |
| Crazy Golf | `crazy-golf-v3-check.ts` | 148 (four pars a hole, 1-6); 208, 215, 229-231; **402 (Hard and Expert `parIsBest`, `parOver === 0`)**; **411 (stroke limits 7 / 6 / 6 / 5 on a par 3)**; **413 (mill slow / normal / normal / fast)**; 425 (`holeId`s `0,400,800,1200,1600`) | 237, 242 Normal; 401 (build = `MG_LEVELS`); 403, 408-409, 419 |
| Cue Ball | `pool-levels-check.ts` | 54; **74 ("every deal is Normal's deal with level stamped")**; **82 (foul costs 5 / 10 / 10 / 15)**; 164; 187 (line ≤ 90 chars and names the foul cost); **192-194 (the black opens with 2 left on Easy only; "N of your 7")**; 212-213 | 61-63, 95, 178 Normal and older stamps; 80, 101-105 read `POOL_LEVEL_FOUL`; 135-138 (preview order) |
| Free Cell, Mahjong, Summit, Five Hands, Thirteen | `cards-levels-check.ts` | 101; **123-130 (Mahjong 56 tiles in 3 layers / 72; quads and shuffle cost "2/2 10/8 12/10"; Five Hands "1.6×75 1.4×50 1.3×45"; Summit speed full 25 / 20 / 16, Expert no wrap; pair values 10 and 15; Thirteen passes 3 / 1 / 1, Expert three Kings, filters 4 and 5; Free Cell Easy 5 cells and top rank 8, Expert 3 cells and 3 undos)**; 150-151 (`bun scripts/cards-level-text.ts --check`); 156; 181 (≥ 60 Easy deals); 188, 194-195 (≥ 100 deals; Expert's stock par ≥ Hard's); **285-311 (Free Cell hints 5 each on Hard, one on Expert, free on Easy; undo rules; 32 cards)**; **318-326, 333-345, 351-355, 365-370 (hint and undo costs, glow on Normal and Easy only, `50 × 1.4 − 5`)** | 113; 137, 142; 219, 227, 248, 261 read each game's `…_LEVEL_RULES` |
| the same five | `cards-levels-order-check.ts` | 24-26 (`ORDER_DEALS 24`, `ORDER_STEP 5`, `ORDER_SLACK 3`) | 44-57: each level clearly below the one before on some player, reversed on none |

#### Checks outside the levels checks that notice a level change

| Check | Lines | What it would notice | Note |
|---|---|---|---|
| `practice-goals-check.ts` | 117-121, 231-234 | 261 challenges; 217 Classic, 30 Hard, 14 Expert; 13 Hard at 100 coins, 9 Expert at 250 | Only if challenges are added, dropped or re-levelled. |
| `practice-challenge-numbers.ts` (run by practice-goals-check section 7) | header 5-10; 282 | every number in a goal's text must be a threshold its check reads or a declared live value; `"mahjong.tile-rush": { say: [[25, MAHJONG_LEVEL_RULES.hard.speedFullS]] }` | The 44 Hard and Expert goals are in `src/lib/duel/practiceChallenges.data.ts` lines 137-521 and quote level numbers: "Sort a Hard set within 45 s" (147), "Link an Expert chain within 45 s" (182), "Connect a Hard network within 60 s" (219), "Tap all 40 on Hard" (242), "Fill a Hard set within 60 s" (325), "Get 70 % of the way on Expert" (367), "Climb 245 m on Hard" (371), "Build 61 floors on Expert" (376), "Return 23 gold balls on Hard" (418), "Clear a Hard stack within 25 s" (485), "Clear a Hard deal within 20 s" (499), "Make 30 bank shots on Hard" (509), "Bring all six treasures down on Expert" (517), "Finish all four Hard mazes within 60 s" (521). A level redesign that moves any of these fails section 7 until the goal's text and number change, then `bun scripts/challenge-catalogue-doc.ts` rewrites `docs/challenges/catalogue.md`. |
| `practice-challenges-check.ts` | 281-284 | a Hard or Expert challenge "can't complete before wave 3.5" on any run | Class 1 the day `LIVE_CHALLENGE_LEVELS` (`practiceChallenges.data.ts:526`) gains a level. |
| `intro-score-text-check.ts` | 17-60 | Normal's `INTRO_SCORE` and "?" help only | Does not read a level. Unaffected. |
| Level text with a `--check` | `cards-levels-check.ts:150-151` | `src/lib/levels/cardLevelText.data.ts` equals what `scripts/cards-level-text.ts` builds from the rules | Routine re-run. The only level text file with a generator. |
| Level text pinned by hand | `strategy-overhaul-check.ts:262-265`; `speed-levels-check.ts:226-232`; `racing-levels-check.ts:271-276`; `curling-levels-check.ts:68-73`; `pool-levels-check.ts:184-194`; `balltrack-levels-check.ts:174-176`; `pattern-overhaul-iceslide-levels-check.ts:264-265`; `-pipes-:300`; `-push-:364`; `number-levels-*:232-233, 278-279`; `tilt-levels-check.ts:184-186` | the help's `Levels:` line and each intro's level line | Mostly format; the literal words are listed in the table above. |
| `deal-identity-check.ts` | 59-60, 70; 122; 156 | deals **Normal only** (no call passes a level); digests against `fixtures/deal-identity.json.gz` under each pin; the layer names string; `names.size === 51` era switches | A level redesign is invisible to it. It notices only a new era pin or deal layer (a new Normal stamp such as the plan's wavRev 16, burstRev 14, ricoRev 5): lines 122 and 156 and `deal-identity-lib.ts`'s `POST_RECORDING_PINS`. |
| `arcade-standard-check.ts` | 41-158 (`STANDARD_ROSTER`: `burst` 13 at 53, `wavefront` 15 at 87, `minigolf` 3 at 142, `pool` 4 at 143, `curling` 4 at 147, `ricochet` 4 at 157) | each game's live stamp as a literal | Notices a new Normal stamp only; no level is read. |
| `difficulty-check.ts` | 110-118; 121-139 | every puzzle level names a proof script that exists; every active game deals at every level it offers with a clock ≤ 120 s | Relations. A level whose deal throws, or a renamed proof script, fails here. |
| `arcade-self-replay-check.ts` | 1119-1243 | entries `bastion/v4-easy`, `-hard`, `ricochet/<lv>`, `swing/<lv>`, `orbit/easy`, `/hard`, `/expert`, `balltrack/<lv>`, `matchup/ice2-easy`, `-expert`, `tilt/expert`, `freekick/v6-expert`, `homerun/v5-expert` | Self-replay only (sim against server replay). Survive while the level game factories keep their signatures. New entries go at the end. |
| `scripts/level-tune.ts` | 177, 183 | nothing: a tool, exits 2 on a usage error only | No expectations. |
| Bank and deal rebuilds spawned by level checks | `wordsearch-levels-check.ts:97`; `number-levels-equation-pyramid-check.ts:81`; `pattern-overhaul-blockparty-levels-check.tsx:143`; `orbit-levels-check.ts:275`; `cards-levels-check.ts:150`; in-process rebuilds at `pattern-overhaul-unblock-levels-check.ts:151`, `-gravity-:163`, `flip-levels-check.ts:166`, `tilt-levels-check.ts:99`, `codeword-levels-check.ts:101`, `logic-levels-check.ts:221-225`, `wavefront-deal-check.ts:32` | byte-for-byte rebuilds of each level's bank or deal file | Routine re-runs after a level's settings change: `word-search-level-bank.ts`, `number-pyramid-levels-bank.ts`, `blockparty-levels-bank.ts`, `orbit-fuel-bank.ts --level=…`, `cards-level-text.ts`, `flip-level-deal.ts`, `codeword-expert-bank.ts`, `logic-level-bank.ts`, `wavefront-big-deal.ts`, plus `freecell-level-bank.ts`, `tripeaks-expert-bank.ts`, `swing-slide-deal.ts --rev=18 --level=…`, `racing-deal.ts --rev=4 --level=…`, `letter-wheel-bank.ts`. |

#### The pattern that matters most in Part B

1. **"Today's game is Hard (or Expert)"** is asserted byte for byte for five games: Counterweight (`number-levels-balance-target-check.ts:73-84`), Checkout and Kakuro (`number-levels-checkout-kakuro-check.ts:116, 152`), Brimful (`number-levels-measure-numline-check.ts:81, 158`), Minefield (`logic-1-levels-check.tsx:298-300, 318`) and Iron Wall's Expert (`bastion-levels-check.ts:127, 145`). Redesigning those levels at all breaks an identity assertion, not a number.
2. **A settings table copied into the check** (class "literal") for all eight Pattern games, Gemstone, High Rise, Tilt, Rainbow Bridge, Ball Tracker, Apex, Crazy Golf, Cue Ball and the five card games. Every one of those lines changes with its level.
3. **Band limits** (`BANDS`, "near ≥ 190", "Expert ≥ 120") in every Word check and most arcade ones: these are tuning targets, so a redesign that moves a level's difficulty moves them.
4. **Retro has nothing**: nine Retro games' Easy, Hard and Expert are unproved today, so the redesign needs new checks there, not changed ones.

---

### Old K1-K14, re-verified

| # | File | Lines in K | Status now |
|---|---|---|---|
| K1 | `logic-overhaul-2-check.ts` | 198, 204-207 | **Still right.** |
| K2 | `pattern-overhaul-flow-check.ts` | 216-224, 318-324, 348-352 | **Still right.** Add 325 (no tint wash) and 343-347, 349 (no lighter core, dark edge, darker sides, one stripe, "not a screen neon"). |
| K3 | `pattern-overhaul-pipes-check.ts` | 194-202 | **Still right** (assertions at 195, 197, 200, 201, 202). Add 173 (`=== 33` sprites) and 205 (the intro draws the sprites). |
| K4 | `pattern-overhaul-{unblock,push,laser,iceslide}-check.ts` | "each one's no-glow lines" | Exact lines: unblock **318-320**; push **299-303**; laser **389, 391-392**; iceslide **344-349**. Missing: `pattern-overhaul-gravity-check.ts` **313**. |
| K5 | `number-overhaul-measure-numline-check.ts` | 132, 135, 169, 262-271 | **Still right.** Add 95 (`#F5B82E` "no bright yellow"). |
| K6 | `pattern-overhaul-iceslide-check.ts` | 269 | **Still right.** |
| K7 | `reveal-fold-check.ts`; `reveal-palette-check.ts:118-158`; `app-moments-check.tsx:210-218`; `orbit-overhaul-check.ts:783-790`; `skyline-overhaul-check.ts:688-712`; `room-16-check.ts:494-545`; `room-extras-check.ts:325` | as listed | **Still right** where spot-checked: reveal-palette is 158 lines long (118-123 are the reveal-screen CSS lines); app-moments section 6 is 209-219; orbit 783-790 is the reveal-order block; skyline 688 opens its reveal section; room-16 494 and 543-545 and room-extras 325 are the answer-reveal blocks. Not a game-look item. |
| K8 | `bastion-overhaul-check.ts` | 217-233 | **Still right** (220, 230, 233). **Missing:** `bastion-levels-check.ts:345-359`, the `paintTank` SHA-256, and `bastion-overhaul-check.ts:348` (`PANEL_TOP = "#121A31"`). |
| K9 | `swing-overhaul-check.ts` | 213, 437, 441-455 | 213 and 437 **right**. The 7:1 block is **438-456** (the `ok` is line 456): moved by one. |
| K10 | `ricochet-overhaul-check.ts` | 510-523; 387-423; 543-567 | 510-523 **right** (the comment starts at 509); 387-423 **right**; the bigger-ninja block is **544-561** and the section ends at 562 (563 on is section 11's comment). Line 561 is a separate "no gold rim" pin. |
| K11 | `art-check.tsx` | 196-215 | **Still right** (the 4a block runs 196-217). |
| K12 | `strategy-overhaul-check.ts` | 299, 302, 305; 270-306; 354-405 | Ranges still cover it (section 5c is **269-308**, 5f is **354-403**), but the three single lines **moved**: Gemstone is **298**, Coral Pop 299, Ball Tracker **300**, Tilt **301**, the seventh gem and sixth bubble **304-306**; "nothing else" is 277, the 400 KB rule 293. Missing: the reveal's gem images at 325. |
| K13 | `skins-default-check.ts` | "the overhaul record for curling" | **Still right** as a mechanism: `--record-overhaul=curling` (lines 30-52); curling is already in `fixtures/skins-default-frames-overhaul.json` (10 frames). Crazy Golf and Top Bins are still on main's record and need adding if repainted. |
| K14 | `freekick-layered-check.ts` | 210-218 | **Still right** (assertions at 216-218; the block closes at 219). |

Nothing in K1-K14 has stopped existing. Pins found that K does not list: `word-overhaul-check.ts:264`,
`pattern-overhaul-gravity-check.ts:313`, `pattern-overhaul-gravity-levels-check.ts:264-265`,
`pattern-overhaul-blockparty-levels-check.tsx:186`, `logic-1-levels-check.tsx:339-344`, `bastion-levels-check.ts:359`,
`bastion-overhaul-check.ts:348`, `tilt-rev12-check.ts:126, 130`, `gemstone-rev10-check.ts:178`,
`arcade-phone-notes-check.ts:223, 227`, `pinball-joulz-check.ts:70`, `snake-renderer-check.ts:30`,
`pool-overhaul-check.ts:144-148`, `presentation-geometry-check.tsx:219`, `reveal-palette-check.ts:37, 102, 148`,
`ricochet-overhaul-check.ts:561`, `strategy-overhaul-check.ts:325, 385, 393`.

### What was not read

- The browser checks (`theme-check`, `no-wrap-check`, `arcade-fill-check`, `arcade-play-check`, `first-paint-check`,
  `battery-check`) were read only for colour literals. Their contrast (4.5:1) and seam rules are relations a mid-tone
  stage must still meet; no line in them names a game's colour.
- `identity-motion-check`, `cosmetics-art-check`, `cosmetic-redraws-check` (cosmetics, the old K15) were not opened beyond
  their first assertions.
- About 300 older checks (`phone-notes`, `puzzle-notes`, `*-standard-check`, `arcade-tuning-*`) were covered by one
  repository-wide search for colour literals, `drop-shadow`, `box-shadow`, `feGaussianBlur`, `lacquer`, `chrome` and
  `brass` inside assertion lines; the hits are in the tables above. A look pin written as a function name or a plain
  word in one of them could have been missed.
