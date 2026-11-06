# Joulz design inventory (6 Nov 2026)

How Joulz looks and behaves today, for the visual redesign. This is a read-only audit: nothing in the app was
changed. Everything here was read from the code on `main` (48cf4f15) or drawn from the real screens.

## How to read this

- **`screenshots/<area>/`**: PNGs named `area_screen_state_size.png`. Phone shots are 390×844 at 2×, with a 47 px
  notch and 34 px home bar emulated; key screens also at 1440×900 (mouse, the desktop layout). `-scrolled` frames
  show the end of a scrolling page. `screenshots/index.json` lists every file with a label.
- **`contact-sheets/`**: one labelled sheet per area (at most 12 screens a sheet; bigger areas in numbered parts),
  plus `desktop*.png` for the 1440×900 shots.
- **`design-values.md` / `.json`**: every colour, font, size, weight, radius, shadow and gradient written in the
  source, with counts, the files using each value and one-off flags.
- **`strings.csv`**: user-facing copy (screen, key, text, kind).
- **`typography.json`**: the browser's computed type styles for the elements in "Typography in use".
- **`tools/`**: the scripts that made all of the above (rerun from the repo root, e.g.
  `bun docs/design-audit/tools/capture.ts`).

### How the screenshots were made

The app's real routes, components and CSS were drawn in headless Chromium through the repo's screen harness
(`scripts/safe-area-harness.tsx`). Only the network edge is faked: server functions, Supabase, the room and chat
hooks and the router. Room, daily and challenge data come from the repo's fixtures (`scripts/theme-screens.ts`,
`daily-fixture.ts`, `challenge-fixture.ts`), with made-up names and scores, on a fixed clock (Mon 26 Oct 2026).
The app's Google Fonts stylesheet (Space Grotesk, Inter, JetBrains Mono, Press Start 2P) was added to each page, as
the app's root does, so game screens show the real faces. The harness always treats this device as the room's host.

---

## 1. Screen list

| Route | Screen | Purpose | States drawn | Rendered by |
|---|---|---|---|---|
| `/` | Play tab | Make or join a room; the day's cards | First visit (intro card), returning, Rejoin card, Add to Home Screen hint (iPhone Safari), no public game, offline | `src/routes/index.tsx`; cards `PlaySlot` → `IntroCard`, `ShareWelcomeCard`, `DailyCard`, `ChallengeCard`, `PublicGameCard` (`PublicGameNext`), `HomeScreenHint`; `Onboarding` (How it works) |
| `/` (first run) | First-time intro | Three panels explaining the game | How it works | `src/components/duel/Onboarding.tsx` |
| `/practice` | Practice tab | Play any game alone | Puzzles side, Arcade side, no bests, category filter, search, search with no match, offline banner | `src/routes/practice.tsx` (rows with `GameIcon`, the Puzzles/Arcade switch, chips) |
| `/practice?game=` | Practice round | Intro → game → reveal with Back / Play again | (room versions drawn instead; same components) | `RoundIntro`, `GameLayout`/`GameFrame`, `AnswerReveal` |
| `/tournaments` | Tournaments tab | Scheduled public games and your results | With an event, empty | `src/routes/tournaments.tsx` (`PublicGameNext`, `PublicGameRow`, `PlaceDisc`) |
| `/profile` | Profile tab | Your look, record, bests, challenges, settings | New player (Get started), returning, colour wheel | `src/routes/profile.tsx` (`LookPicker`, `YourChallenges`, `FeedbackLink`) |
| `/profile` (sheet) | Settings | Sound, music, haptics, battery saver, offline practice, controls, terms | Open, scrolled | `src/components/app/SettingsSheet.tsx` |
| `/terms` | Beta terms | Shown before a device's first room, daily or challenge | First time | `TermsScreen` (`src/lib/beta/terms.ts`), `TermsGate` |
| `/duel/$code` | Room: link join | Join a room from a link with a name | Open lobby, not found, full, finished | `src/components/duel/JoinFromLink.tsx` |
| | Room: loading | | Loading | `WaitingLine` in `src/routes/duel.$code.tsx:803` |
| | Room: lobby | Players gather; host sets the room up | 2 players, 16 players, as a guest, after a player left, host's player menu, remove-player confirm, Disband confirm | `RoomLobby.tsx`, `RoomFooter.tsx` (`RoomMenu`), `ConfirmDialog.tsx`, `ChargeMeter` |
| | Room settings sheet | Presets, categories, rounds | Mixed, rounds capped | `RoomSettingsSheet.tsx` |
| | Room disbanded | | Disbanded | `src/routes/duel.$code.tsx` |
| | Prepare to Duel | The room's opening moment | Start | `DuelStart.tsx`, `PrepareLightning.tsx` |
| | Round title | "Round 1" moment | Round 1 | `RoundTitle.tsx` (`roomMoments.ts`) |
| | Game intro | Goal, how, demo, score, Ready | Puzzle (Box Six), arcade (Gemstone) | `RoundIntro.tsx`, `IntroStage`, `PuzzleInstructions` |
| | 3-2-1 | Countdown to GO | Mid-count | `RoundIntro.tsx:292` |
| | Game frame | The live round's shared header, timer, score | Puzzle (Box Six), arcade (Gemstone), after a player left | `GameFrame.tsx`, `TimerBar.tsx`, `GameLayout`, `DropoutBanner.tsx`, `FinishedPings.tsx` |
| | Answer reveal | Your score, the breakdown, the others | Puzzle, arcade chart, 16 players with four part lines, 0 points | `AnswerReveal.tsx`, `ArcadeReveal.tsx`, `ArcadeScoreChart.tsx`, `RevealBreakdown.tsx` |
| | Points reveal (round results) | Round leaderboard | 2, 10, 16 players, with a 0 | `RoundResult.tsx`, `RoundResultsTable.tsx` |
| | Standings | Totals after the round | 10 players, ties, 16 players, after a player left | `Standings.tsx` (`tieDisplay.ts`) |
| | Winner reveal | Drumroll before the podium | Reveal | `WinnerReveal.tsx` |
| | Podium | Final results, rooms of 3+ | 10, 16 players, whitewash | `Podium.tsx`, `PodiumAwards.tsx` |
| | Two-player final | Final results for 2 | 2 players | `FinalResult.tsx` |
| | Chat and reactions | Messages, emoji reactions, toast between rounds | Sheet, reactions, toast | `RoomChat.tsx` (`ReactionLayer`, chat toast) |
| `/daily` | Daily Puzzle / Daily Arcade | Today's set, board, results | Puzzle before / board, Arcade before / board, results, offline | `src/routes/daily.tsx`, `DailyBoard`, `AsyncRun`, `AsyncResults` |
| `/challenge?code=` | Friend challenge | Make, play and compare a challenge | Make one, link opened, round leaderboard, standings, podium, creator's link, not found | `src/routes/challenge.tsx`, `ChallengeCreate`, `ChallengeShare*`, `Podium` |
| (share sheet) | Share card | 1080×1350 PNG attached to the share sheet | Room podium | `src/lib/share/resultCard.ts` via `ShareResultButton.tsx` |
| (root) | Celebrations layer | Hero run / dance / grand lap, sparks, banners | Reveal 150, 190, 200 (two moments), podium hero, winner reveal | `CelebrationLayer`, `src/lib/fx/celebrations.ts`, `celebrationCanvas.ts`, `hero.renderer.ts` |
| (root) | Update | Full-screen "Updating…" for ~1.2 s before the reload | Updating (reconstructed, see §12) | `src/components/app/AppUpdateOverlay.tsx`, `src/lib/appUpdate.ts` |
| (root) | 404 / errors | | Not drawn: see §12 | `ErrorState.tsx`, `src/routes/__root.tsx` |
| `/dev-crash`, `/replay-lab` | Developer tools | Not player-facing | — | |

---

## 2. Typography in use

Computed in Chromium at 390×844 from the live screens (`tools/typography.ts`, `typography.json`). "Width" is
`font-stretch` (Archivo is a variable font with a width axis, 62–125 %, self-hosted in `public/fonts`).

| Element | Example | Font family (computed) | Weight | Width (stretch) | Size | Line height | Letter spacing | Transform |
|---|---|---|---|---|---|---|---|---|
| JOULZ wordmark | `.ap-wordmark-text` (header) | Archivo, system-ui, sans-serif | 900 | 118 % | 22px | 22px | 0.22px | none (uppercase in the source); the last letter gold |
| Page title | "Practice", "Profile", "Play live with friends" | Archivo | 800 | 112 % | 31px | 33.48px | −0.62px | none |
| Screen title (room screens) | "Standings" | Archivo | 800 | 108 % | 22px | 24.2px | −0.22px | none |
| Section heading | "Today", "Next public game", Practice's category names | Archivo | 750 | 110 % | 18px | 21.6px | −0.18px | none |
| Card title | "Daily Puzzle", "Saturday night quiz", a Practice row's game name | Archivo | 620 | 100 % | 16px | 20px | normal | none |
| Body text | Play's lede "Up to 16 players…" | Archivo | 400 | 100 % | 15px | 21px | normal | none |
| Card meta line | "Wed 28 Oct · 7:00 pm UK · 6 rounds" | Archivo | 450 | 100 % | 13.5px | 18px | normal | none |
| Small label | "BEST" (Practice column) | Archivo | 700 | 100 % | 12px | 18px | 0.96px | none (typed in capitals) |
| Small label | Profile stat caption "Rooms played" | Archivo | 500 | 100 % | 12.5px | 18.75px | normal | none |
| Date tile label | "WED" | Archivo | 700 | 100 % | 11px | 11px | normal | none (typed in capitals) |
| Primary button | "Create a room" (gold) | Archivo | 800 | 100 % | 18px | 27px | normal | none |
| Secondary button | "Join" | Archivo | 600 | 100 % | 16px | 24px | normal | none |
| Link | "All public games" | Archivo | 600 | 100 % | 15px | 22.5px | normal | none |
| Segmented switch | "Puzzles 55" | Archivo | 800 | 100 % | 15px | 22.5px | normal | none |
| Chip | "All games" | Archivo | 750 | 100 % | 13.5px | 20.25px | normal | none |
| Input | "Your name" | Archivo | 500 | 100 % | 16px | 24px | normal | none |
| Scores / numbers | Practice best "148" | Archivo | 800 | 100 % | 18px | 27px | normal | none (tabular-nums) |
| Scores / numbers | Profile stat "3" | Archivo | 800 | 100 % | 24px | 26.4px | normal | none (tabular-nums) |
| Scores / numbers | Standings total "351" | Archivo | 800 | 100 % | 22px | 33px | −0.22px | none (tabular-nums) |
| Scores / numbers | Date tile "28" | Archivo | 800 | 100 % | 20px | 21px | normal | none |
| Player name | Standings row | Archivo | 700 | 100 % | 15px | 22.5px | normal | none |
| Tab bar labels | "Play" (current, gold #F7BF2F), "Practice" (#8E8B94) | Archivo | 600 | 100 % | 11px | 11px | normal | none |

In game screens (room round of Box Six, the same components for every game):

| Element | Example | Font family (computed) | Weight | Width (stretch) | Size | Line height | Letter spacing | Transform |
|---|---|---|---|---|---|---|---|---|
| Intro: game title | "Box Six" (intro header) | "Space Grotesk", system-ui, sans-serif | 800 | 110 % (Space Grotesk has no width axis, so it has no effect) | 19px | 22px | −0.19px | none |
| Intro: context line | "Logic · Round 1 of 1" | Archivo, system-ui, sans-serif | 600 | 100 % | 12px | 16px | normal | none |
| Intro: section label | "Goal" | Archivo, system-ui, sans-serif | 700 | 100 % | 12px | 18px | normal | none |
| Intro: goal line | "Fill the 6 × 6 sudoku grid." | "Space Grotesk", system-ui, sans-serif | 700 | 100 % | 22px | 27.5px | normal | none |
| Intro: Ready button | "Ready" | Archivo, system-ui, sans-serif | 800 | 100 % | 18px | 27px | normal | none |
| Live round: game title | "Box Six" (game frame header) | Archivo, system-ui, sans-serif | 800 | 110 % | 19px | 22px | −0.19px | none |
| Live round: timer number | "84" in the ring | Archivo, system-ui, sans-serif | 800 | 100 % | 15px | 15px | normal | none (tabular-nums) |
| Live round: goal line | "Fill the 6 × 6 sudoku grid" | Archivo, system-ui, sans-serif | 600 | 100 % | 13px | 18px | 0.16px | none |

The same game title renders in **Space Grotesk on the intro** and in **Archivo in the live round's header**: one of several mixed-family spots on game screens.

Notes:

- **One family on every app screen.** Every tab page and every skinned room screen renders in Archivo, set
  through `--ap-font` in `src/polish-layout/app-pages.css` and `room-screens.css`. Hierarchy comes from weight
  (400–900, including in-between weights 450, 620 and 750) and width (100–118 %).
- **Other faces are still declared.** `docs/design-system.md` and `src/polish-layout/theme.css` still declare
  Saira (headings), Manrope (body) and "Duelz Mono" (JetBrains Mono, for scores) for the page skin. On the screens
  measured, those rules are overridden by Archivo, so scores are not monospaced: they rely on `tabular-nums`.
- **Game screens use the older stack.** `src/styles.css:630` sets `--font-display` to Space Grotesk, `--font-body`
  to Inter and `--font-mono` to JetBrains Mono, plus Press Start 2P for Retro games. All of these are loaded from
  Google Fonts.
- **Capitals are typed, not styled.** Uppercase labels (BEST, WED, JOULZ) are typed in capitals rather than set with
  `text-transform`, so screen readers spell some of them out letter by letter.
- **Close-up:** `screenshots/typography_play_closeup.png` (2×) shows the Play page's top: the wordmark, title and
  first card.

---

## 3. Design values in use

Full tables, counts and files are in **`design-values.md`**; the raw data with every file is in
`design-values.json`. Counts are occurrences in the source: one declaration counts once, not each place it renders.
The scan is split three ways:
- **ui**: app screens and shared components.
- **puzzle-ui**: the puzzle games' own boards (`src/puzzles`, `src/components/puzzles`, `src/polish-*` except
  `polish-layout`).
- **game-art**: canvas art in the arcade sims and renderers.

| Kind | ui (distinct / one-offs) | puzzle-ui | game-art |
|---|---|---|---|
| Hard-coded hex colours | 432 / 331 (830 uses) | 892 / 699 (1,470 uses) | 2,070 / 1,611 (3,444 uses) |
| rgb()/hsl()/color-mix() colours | 356 | 559 | 1,499 |
| Gradients (CSS) | 177 | 291 | (canvas) |
| box-shadow values | 202 | 289 | — |
| text-shadow values | 15 | 31 | — |
| font-family declarations | 19 | 4 | 159 canvas fonts |
| font-size (CSS) | 51 distinct | 30 | — |
| font-weight (CSS) | 17 distinct (incl. 450, 550, 620, 650, 750) | 3 | — |
| border-radius (CSS) | 28 distinct | 24 | — |
| CSS custom properties defined | 332 | 53 | — |
| Tailwind arbitrary values | 187 distinct | 127 | — |

What stands out:

- **Arbitrary Tailwind values.** There are about 283 `text-[…]` uses across ui and puzzle-ui. The most common are
  `text-[13px]` (39), `text-[15px]` (22), `text-[11px]` (16), `text-[10px]` (12), `text-[14px]`, `text-[17px]` and
  `text-[12.5px]`. There are also about 32 `rounded-[…]` uses, mostly `rounded-[14px]`, and fixed heights such as
  `h-[52px]` and `h-[50px]`. (The many `data-[state=open]`-style matches are Radix variant selectors from the unused
  shadcn kit, not arbitrary values.)
- **Near-duplicate colours.** Near-white text appears as `#F3F1EC` (30), `#F5F5F7`, `#FFFFFF` (19) and `#FFF` (7).
  Gold appears as `#F5B82E` (26), `#F7BF2F` (13), `#F2C75C` (12) and `#FFE08A` (11). Teal appears as `#2ED3B7`,
  `#3FD0C9` and `#5CD6C0`. Near-black backgrounds appear as `#0D0D0F`, `#0B0B0F`, `#07070A`, `#070709` and
  `#17171B`.
- **Radii.** The common ones are `999px` (27) and `50%` (21), then 12, 14, 10 and 16 px, plus one-offs at 2, 4, 5,
  8, 11 and 18 px.
- **Three skins' token sets live side by side:**
  - `--th-*`: the page skin (`theme.css`).
  - `--ap-*`: the tab pages and room screens (`app-pages.css`, `room-screens.css`).
  - The original shadcn tokens (`styles.css`).

  `data-skin-off` restores the originals inside skinned screens for game art.

---

## 4. Components

| Kind | What exists (path) | Duplicates / notes |
|---|---|---|
| **Primary button** | `.th-btn-gold` (`src/polish-layout/theme.css:296`, 15 uses, skinned screens); `.ap-btn-gold` (`app-pages.css:418`, 15 uses, tab pages); `.rs-btn-gold` (`room-screens.css:416`, room footer); `src/components/ui/button.tsx` default | **Three gold CTAs for the same job**, each with its own gradient, shine and disabled filter. None has its own `:active`; all rely on `.press`. |
| Secondary button | `.th-btn-teal`, `.th-btn-ghost`, `.th-btn-outline-gold`, `.th-btn-outline-teal` (0 uses); `.ap-btn-outline`, `.ap-btn-quiet`, `.ap-btn-off`, `.ap-icon-btn`; `.rs-btn`, `.rs-row-btn`, `.rs-menu-btn`, `.rs-chat-btn`; shadcn `Button` outline/ghost (30 files: puzzles, RoomChat, MuteToggle, the "?" help button) | Outline exists twice (`th-btn-outline-gold`, `ap-btn-outline`), ghost twice; `th-btn-outline-teal` is unused. |
| Pills | `.ap-pill-gold`, `.ap-pill-done`; `.th-pill`; `.rs-pill`; `CategoryPill.tsx` | `th-pill` and `CategoryPill` overlap for category labels. |
| **Cards / panels** | `.th-card` with `data-tint` (10 uses); `.ap-panel` (40 uses) and `.ap-row`; `.ap-empty-card`; `IntroCard`, `DailyCard`, `ChallengeCard`, `PublicGameCard`, `ShareWelcomeCard`, `OfflineInstallCard`, `HomeScreenHint`; `ui/card.tsx` (unused) | `th-card` and `ap-panel` are the same surface in two skins. IntroCard, ShareWelcomeCard, OfflineInstallCard and HomeScreenHint are four variants of "hint card with ✕". |
| **Sheets / dialogs** | Custom portals with `.th-scrim` + `.th-sheet`: `SettingsSheet.tsx:72`, `RoomSettingsSheet.tsx:89`, the chat sheet (`RoomChat.tsx:326`), the help sheet (`PuzzleInstructions.tsx:130`), `ConfirmDialog.tsx` (alertdialog); `RoomMenu` (`RoomFooter.tsx`, a popover menu); MuteToggle uses Radix `ui/popover` | SettingsSheet and RoomSettingsSheet are near-identical bottom sheets. Escape and outside-tap handling is rewritten per sheet. shadcn `sheet`, `drawer` (vaul), `dialog` and `alert-dialog` are unused. |
| **Toasts / banners** | Chat toast (`RoomChat.tsx:487`); `FinishedPings.tsx`; celebration banner (`showBanner`, `celebrations.ts`); `DropoutBanner.tsx`; `OfflineBanner.tsx`; desktop house banners (`config/banners.ts`, empty); practice notice (`practice.tsx:747`); `ui/sonner.tsx` (not mounted) | No shared toast component; several bespoke ones. |
| **Inputs** | `.th-input` + a long Tailwind string (`ChallengeCreate.tsx:61`, `JoinFromLink.tsx:150`, `daily.tsx:383`, `challenge.tsx:433`); `.ap-input` (`ErrorState`, `AppRail` search, `RoomPanel`, Practice search, Play, Profile); the chat input; `NumberEntry`; `LetterKeypad` | `th-input` and `ap-input` do the same job; the `th-input` call sites repeat one Tailwind string four times. |
| **Chips / segmented controls** | `.th-chip` + `.th-chip-dot`; `.ap-chip`, `.ap-chip-grid`, `.ap-chip-quiet`; `.ap-switch` (Practice Puzzles/Arcade); `.rs-seg`, `.rs-cat` (room settings); `SolutionSwitch`; `HudPills`, `AcceptedWordChip` | The segmented control exists three times (`ap-switch`, `rs-seg`, `SolutionSwitch`); chips twice (`th-chip`, `ap-chip`). |
| **Avatars** | `PlayerBadge.tsx` (an initial or icon on the player's colour, 17 files); `PlaceDisc` (`TabIcons.tsx:92`); `Medal.tsx` (gold, silver and bronze gradient discs) | One avatar component; `ui/avatar` is unused. |
| **Tab bar / nav** | `AppTabBar.tsx` (phone bottom bar); `AppRail.tsx` (desktop rail, 1024 px and wider); `AppHeader.tsx` (`AppWordmark`, `LogoMark`) | The tab list is copied verbatim in `AppTabBar.tsx:25-30` and `AppRail.tsx:24-29`. |
| Loading | `Dots` / `WaitingLine` (`src/components/duel/Dots.tsx`) | The only loading indicator; `ui/skeleton` is unused. |

**The shadcn/Radix kit is mostly unused.** Of the 46 files in `src/components/ui`, only `button` (about 30
importers), `slider` (3) and `popover` (1) are used, plus a single import each of `tooltip`, `toggle`,
`separator`, `label` and `input` from inside the kit or a puzzle.

---

## 5. Icons

- **Library:** `lucide-react` 0.575. About 50 distinct icons in about 41 app files. The most used are
  ChevronRight, X, ChevronDown, Check, CloudOff and ChevronLeft. The tab bar is Lucide: Zap, Target, Trophy and
  UserRound.
- **Custom sets:**
  - `src/components/app/TabIcons.tsx`: DailyPuzzleTile, DailyArcadeTile, ChallengeTile and PlaceDisc.
  - `src/components/duel/playerIcons.tsx`: 16 original player icons, behind `PLAYER_ICONS_ENABLED`.
  - Game tiles (`GameIcon.tsx`): 208 px WebP scenes in `public/tiles/` (104 files), with line-drawing fallbacks in
    `gameIcons/conceptIcons.tsx`.
  - `brand/LogoMark.tsx`: the bolt.
  - `Medal.tsx`.
  - Puzzle icons in `components/puzzles/refreshIcons.tsx` and `BonkIcon.tsx`.
  - Inline SVGs: MuteToggle, the reveal's verdict marks, the timer ring and the intro's auto-start ring.
- **Text glyphs used as icons:** `?` (help), `×`, `▾`/`▴`, `✓`/`✗`, `⋯` (via MoreHorizontal).

| Screen | Lucide icons | Custom icons / glyphs |
|---|---|---|
| Play | ChevronRight, DoorOpen; tab bar Zap / Target / Trophy / UserRound; CalendarPlus, Clock, Lock, Users (public game); Check (daily); Megaphone (desktop aside); X (hint cards); Share, SquarePlus (home-screen hint) | DailyPuzzleTile, DailyArcadeTile, ChallengeTile, GameIcon, PlayerBadge, AppWordmark / LogoMark |
| Practice | Search, CloudOff, Share, SquarePlus, X, Clock3 | GameIcon tiles |
| Tournaments | CalendarDays, ExternalLink, plus the public-game icons | PlaceDisc |
| Profile and Settings | Check, ChevronRight, Settings, X, MessageSquare | PlayerBadge, PlaceDisc, GameIcon |
| Lobby and chat | MessageSquare, Send, MessageCircle, MoreHorizontal, Maximize2, Minimize2, X | PlayerBadge, inline check SVG (`RoomLobby.tsx:125`), ▾/▴, CategoryPill |
| Game intro and frame | ChevronLeft, Volume2, Music2, ChevronDown; puzzle controls Undo2, RotateCcw, Shuffle, Lock, LockOpen, Delete, ArrowLeftRight | Timer ring, auto-start ring, "?" button, per-game art |
| Answer reveal | Speaker (MuteToggle) | Verdict SVGs (`AnswerReveal.tsx:511-527`), PlayerBadge, ✓/✗ |
| Round results / standings | ChevronDown | Medal, PlayerBadge, GameIcon, ✓/✗ |
| Podium / final | ChevronDown | Medal, PlayerBadge, GameIcon, the share button's inline SVG |
| Daily | ChevronLeft, Lock, ChevronDown, MessageSquare | PlayerBadge, Medal, GameIcon |
| Challenge | ChevronLeft, Swords, ChevronDown | ChallengeTile, PlayerBadge, Medal, GameIcon |
| Offline | CloudOff | — |

---

## 6. Motion

**Summary**

- **CSS animations:** 172 distinct `@keyframes` (one name, `shake`, is declared twice: `styles.css:1205` and
  `:1260`) across 25 CSS files. `styles.css` holds 61 and `polish-logic/logic.css` 38.
- **Utilities:** 21 Tailwind `animate-*` utilities are defined in `styles.css`; `tw-animate-css` adds
  `animate-in` / `animate-out`, fade and scale.
- **Transitions:** 74 CSS `transition:` declarations, mostly 150–300 ms `ease-out`; 7 inline style transitions in
  puzzle boards.
- **JS motion:**
  - `src/lib/fx/motion.ts` `animateFx`, Web Animations: pop 180 ms, shake 250, burst 400, trail 200, glow 400,
    scorePop 400, timerPulse 1000, slideIn/Out 200, all `ease-out`. Under reduced motion it becomes a 160 ms
    opacity fade.
  - The celebrations canvas (`celebrationCanvas.ts`) and every arcade game run on `requestAnimationFrame`.
  - The logo's charge-in is SMIL (`celebrations.css:85-91`).

**Reduced motion**

- A global rule (`src/styles.css:1228-1236`) clamps every CSS animation and transition to 0.01 ms with
  `!important`. 23 of the 25 files also have their own calmer alternative. The logic puzzles' stage is clamped to
  1 ms (`logic.css:83-89`). 26 files check `prefersReducedMotion` in JS (canvas effects, hero, sparks, count-ups).
- **Defect: two reduced-motion fallbacks are lost.** Under the global rule, `.practice-new-best` (`styles.css:1863`)
  and `.arcade-celebration-headline` (`styles.css:1905`) get their duration cut to 0.01 ms. Their keyframes end at
  opacity 0 with `both` fill, so with reduced motion on, the "New best" line and the arcade headline are
  effectively invisible. `logo-charge-calm` and `ice-fade-out` are hit the same way, harmlessly.

**The signature transition:** `src/lib/fx/signature.ts`, a gold flash and a logo burst (600 ms, starting 1 s after
the solve) on every completion in every game. Two tiers, "solve" and "fast". Under reduced motion it becomes a soft
gold fade.

**Room moments** (`src/lib/fx/roomMoments.ts`, CSS `rfx-*`), all `ease-out`, all reduced to `rfx-calm` under
reduced motion:

| Moment | Length |
|---|---|
| Prepare to Duel | about 6 s glow, a ring ×3, 12 streaks, plus lightning strikes at least 550 ms apart (`prepareLightning.ts`) |
| Round titles 1–6 | 2.2–2.75 s |
| Final round | 2.9 s |
| Winner reveal | 4.5–5.9 s |

**Main keyframes** (where, duration and easing; "own RM" means the file has its own reduced-motion rule, and the
global clamp covers all of them anyway):

| Keyframe | Where | Duration · easing | Own RM |
|---|---|---|---|
| phase-in / round-in | `styles.css:861/880`, screen and round entrances | 200 ms ease-out | yes (fade) |
| stamp-in | `:910` | 220 ms cubic-bezier(.2,1.4,.4,1) | yes |
| rise-settle | `:931` | 340 ms cubic-bezier(.22,1,.36,1) | yes |
| pop-in | `:1049` | 260 ms cubic-bezier(.2,1.4,.4,1) | yes |
| tag-slam | `:1000` | 260 ms cubic-bezier(.2,1.5,.4,1) | yes |
| word-scale-in | `:1019` | 420 ms cubic-bezier(.2,1.3,.4,1) | yes |
| row-stagger | `:1034` | 260 ms ease-out | yes |
| countdown-number | `:1069`, 3-2-1 | 1 s ease-out | yes (none) |
| timer-pulse / -strong / -second-pulse | `:731-770`, last seconds | 1 s / 0.85 s / 1 s ease-in-out infinite | global |
| fx-timer-pulse | `:1454` | 1 s cubic-bezier(.2,.7,.3,1) | yes |
| shake / fx-shake | `:1205`, `:1460`, wrong moves | 320 / 250 ms | global |
| tile-flash | `:779` | 280 ms ease-out | global |
| dot-bounce | `:1149`, loading dots | 1.2 s steps(1,end) infinite | global |
| slow-pulse, sheen | `:1171`, `:1189` | 1.8 s ease-in-out / 6 s linear, infinite | also off in Battery saver |
| reaction-float | `:1283`, chat reactions | 1500 ms ease-out | yes |
| arcade-reveal-pulse / -glow | `:1362/1366` | 1.2 s / 1.6 s infinite | global |
| screen-drift | `:1438` | 30 s ease-in-out infinite alternate | yes |
| practice-best-moment | `:1860` | 1800 ms ease-out | **fallback lost** (see above) |
| arcade-celebration-headline | `:1896` | 2600 ms cubic-bezier(.2,.8,.2,1) | **fallback lost** |
| arcade-score-celebrate | `:1903` | 900 ms ease-out ×2 | yes |
| podium-award-in | `:1913` | 340 ms cubic-bezier(.2,1.2,.4,1) | yes |
| new-best-moment | `:1925` | 1800 ms ease-out | component skipped under RM |
| chat-toast-up | `:1928` | 220 ms ease-out | yes |
| gf-alert-pulse | `game-frame.css:363` | 1 s ease-in-out infinite | yes |
| logo charge-in (SMIL) | `celebrations.css` | `LOGO_CHARGE_MS` | calm fallback (lost, harmless) |
| Puzzle feedback families | `polish-logic/logic.css` (38), `polish-pattern/*.css` (blockparty, flow, gravity, iceslide, laser, pipes, push, rings, tiles, topsy, unblock), `polish-logic/{bridges,fences,fillomino,kakuro}.css`, `polish-speed`, `polish-b`, `depth4` | 130–1100 ms, mostly ease-out or springy cubic-beziers; a few infinite idle loops (ice twinkle 4.2 s, laser gem 1.5 s, pipe ripple 900 ms, hanoi hover 1.1 s) | yes in every file, or the logic stage clamp |

**Transitions elsewhere**
- `.press` scales to 0.97 on `:active`; on tab pages and room screens it scales to 98 % with `brightness(1.12)`.
- Hidden Play-tab cards collapse over 420 ms.
- Standings rows slide with FLIP and totals count up over 1.2 s (`useFlipRows`, `AnimatedScore`).

---

## 7. Sound and haptics map

**Haptics** (`src/lib/haptics.ts:28-35`):

| Pattern | Vibration |
|---|---|
| `tick` | 10 ms |
| `go` | 35 ms |
| `success` | [14, 40, 22] |
| `error` | [10, 70, 10] |
| `impact` | 45 ms |
| `celebrate` | [25, 50, 25, 50, 60] |

Haptics go through the Vibration API only, so **iPhone gets none**. They can be switched off in Settings
(`duelz-haptics:v1`), and in-game ones fire only while a live board is on screen.

**Sound:**
- Named cues go out through `soundCue()` (`src/lib/fx/soundCues.ts`, the window event `duelz-sound`).
- Files are mapped in `src/lib/fx/manifest.ts` (about 1,095 slots); the recordings are in `public/sounds/`
  (331 files, 22 MB).
- The cue sheet is `docs/sound-cues/cue-sheet.md`.

| Moment | Sound (cue → file) | Haptic | Where |
|---|---|---|---|
| Create a room | `shared.celebrate.zap` → sfx_joulz_zap.mp3 | — | `routes/index.tsx:362` |
| Lobby: player joins / charge meter | `player_joined`; `crackle1-3`; meter full → `chime`; music `lobby_loop` | — | `duel.$code.tsx:681`, `fx/ChargeMeter.tsx` |
| Home bed (tab pages) | one bed carried across Play, Practice, Tournaments, Profile and settings; crossfades to the lobby loop | — | `holdHomeBed` / `useHomeBed` |
| Ready / Start / submit / chat send | `lock` (blip) | — | `duel.$code.tsx`, `practice.tsx:491`, `RoomChat.tsx:177` |
| Chat toast between rounds | blip | tick | `RoomChat.tsx:177-178` |
| Prepare to Duel | `room.prepare`, voice `prepareToDuel`, `room.prepare.flash`, `shared.celebrate.prepareThunder` | — | `DuelStart.tsx:34` |
| Round title | `room.round.1-6`, voice `round1`–`round11` | — | `RoundTitle.tsx:56` |
| Final round | `room.finalRound`, voice `finalRound` | — | roomMoments |
| 3-2-1 | `countdown_step` | tick ×3 | `RoundIntro.tsx:125` |
| GO | `shared.celebrate.thunder` + zap, one lightning strike | go | `RoundIntro.tsx:138` |
| Last 10 s | `warning_10`, `warning_tick` (10–4 s), `warning_tick_final` (3–1 s) | — | `TimerBar.tsx:56` |
| Time's up | `time_up`, `voice.timesUp` | impact (arcade) | `TimerBar.tsx:65`, `fx/arcade.ts:53` |
| Puzzle correct / wrong move | `correct` / `wrong` | success / error | `usePuzzleHaptics.ts` |
| Refused move | `shared.reject` → ui.nope.mp3 | — | `puzzleReject` |
| Solve (signature beat) | `shared.signature.solve` / `.fast` | success | `signature.ts` |
| Arcade goal, home run, pot / foul / crash, life lost | per-game cues | success / error / impact | `gameSounds.ts` (`feel`) |
| Help sheet | `shared.help.open/close` | — | `PuzzleInstructions.tsx` |
| Reveal score | `reveal_score` | — | AnswerReveal |
| Perfect (max) | `shared.perfect`, `voice.perfect` | — | `signature.ts` |
| Hero 150+ / 190–199 / 200 | `heroRun` / `heroDance` / `heroGrand` + `firework` ×6 | — | `AnswerReveal.tsx:687` |
| New best | `shared.celebrate.chime`, `voice.newBest` | — | `NewBestMoment.tsx`, `ArcadeReveal.tsx:267` |
| Round results | `shared.roundResults` or `round_won` (top scorer); voice `roundTaken` / `roundLost` / `tie` | — | `RoundResult.tsx`, `RoundResultsTable.tsx` |
| Standings | `countTick`, `countDing`, `overtake`, `voice.newLeader`, `standings_loop` | — | `Standings.tsx` |
| Winner reveal | voice `winnerIs`, `winner_drumroll`, `room.winner.lock`, `winner_crash` | — | `WinnerReveal.tsx` |
| Podium / final | `podium_fanfare`, `shared.celebrate.victory`, chime for the winner; `voice.youWin` / `gg` / `draw`, `photoFinish`, `cleanSweep`; `podium_loop` | celebrate (winner) | `Podium.tsx:176-200`, `FinalResult.tsx` |
| Award card | `room.award` | — | `PodiumAwards.tsx` |
| Rematch | `voice.rematch` | — | `duel.$code.tsx:315` |
| Daily streak 3/7 and 30 | `shared.celebrate.streak` / `streakBig` | — | `daily.tsx:483` |
| Logo charge-in | `shared.celebrate.logoCharge` | — | celebrations |
| Replays and highlights | `shared.highlight.*`, `shared.replay.*`, `shared.timelapse.*` | — | `components/replay/*` |
| Tab bar, tab-page buttons, opening Settings | **none** | **none** | — |

**Per-game cues:**
- **Most:** Grappler 47, Roofbound 29, Breaker 26, Wavefront 25, Rainbow Bridge 21, Fission 21.
- **10–19:** most arcade games.
- **2–8:** the cards and puzzle games.
- **1:** most word and speed games.
- **Music:** about 39 `music_*` beds, three per puzzle category plus one per arcade game.

---

## 8. Copy

**`strings.csv`** has 2,906 strings in four columns:
- `screen`: worked out from the file path.
- `key`: `file:line`. The app has no string catalogue; copy lives in the components and a few copy modules (help
  text in `src/lib/duel/instructions.ts`, game names in `gameNames.ts`, share lines, awards, reveal words).
- `text`: `{…}` marks an interpolated value.
- `kind`: JSX text, an attribute (aria-label, placeholder…), an expression inside JSX, a code literal, or a copy
  module.

| Screen | Strings |
|---|---|
| Game intro and help | 1,245 |
| In-game | 715 |
| Desktop controls | 106 |
| Game names | 104 |
| Answer reveal | 64 |
| Lobby | 54 |
| Game frame | 52 |
| Play | 52 |
| The rest | smaller |

The extractor (`tools/strings.ts`) works by pattern, so it misses some text (copy built entirely from variables,
canvas-drawn text in arcade HUDs) and keeps a few non-copy literals. Treat it as an inventory, not a translation
file.

---

## 9. Assets

| Asset | File(s) | Size | Status |
|---|---|---|---|
| App icon (any) | `public/app-icon-180.png`, `-192`, `-512` (copy: `screenshots/assets/assets_app-icon_512.png`) | 180, 192, 512 px | Final for the beta: the inverted bolt on the gold shine, drawn by `scripts/brand-icons.ts` |
| App icon (maskable) | `public/app-icon-maskable-512.png` | 512 px | Final for the beta |
| Favicons | `public/favicon-16.png`, `-32.png`, `favicon.png` | 16, 32 px | Final for the beta |
| In-game logo (solve burst) | `public/icon-512.png` (`APP_LOGO_URL`; copy: `assets_in-game-logo_816.png`) | 816 × 816 | The older logo, still used by the solve burst; the in-game flag uses the new icon |
| Link preview | `public/og-image.png` (copy: `assets_og-image_1200x630.png`) | 1200 × 630 | Final for the beta (`scripts/og-image.ts`) |
| Splash screen | none | — | **Missing**: no `apple-touch-startup-image`; iOS shows the manifest's `background_color` #0B0B0F |
| Wordmark and bolt | `src/components/brand/AppWordmark.tsx`, `LogoMark.tsx` (SVG, gold gradients) | vector | Final for the beta |
| Joulz Hero | drawn in code: `src/lib/arcade/hero.renderer.ts` (gold cape, gold-outlined black limbs, chest bolt, gold gloves and boots, masked head); renders in `screenshots/hero/` | vector / canvas | Code art, no source file. Appears in Grappler, Roofbound, Moon Climb (ninja gear), their tiles, the reveal's hero moments and the podium |
| Medals | `src/components/duel/Medal.tsx` (CSS discs, `--th-medal-gold/silver/bronze` gradients, `theme.css:86-88`) | 22 px | Simple placeholder-grade discs with the place number; no trophy art |
| Trophy | Lucide `Trophy` (tab bar) only | — | Library icon |
| Daily / challenge tiles | `src/components/app/TabIcons.tsx` (SVG) | vector | Final for the beta |
| Game tiles | `public/tiles/*.webp` (104), `tileScenes.data.ts` | 208 px | Final for the beta, re-exported when a game's look changes |
| Player icons | `src/components/duel/playerIcons.tsx` (16 line drawings) | vector | Built, behind `PLAYER_ICONS_ENABLED` (off: initials) |
| Arcade sprites | `src/assets/arcade/{cavelava,fairground,space,toybox}` (Kenney, CC0) | a few PNGs | In use in 4 worlds; the rest is code art |
| Fonts | `public/fonts`: Archivo (variable), Manrope, Saira, JetBrains Mono (all OFL); Google Fonts: Space Grotesk, Inter, JetBrains Mono, Press Start 2P | 316 KB self-hosted | Final |
| Sounds and music | `public/sounds/` (331 files), `src/assets/music`, `src/assets/sounds` | 22 MB | Mostly final; some slots still use library sounds until recorded (`docs/sound-cues/*.md`) |
| Illustrations | none beyond tiles, the hero and the icon tiles | — | — |

---

## 10. Checklist

| Item | Answer | Evidence |
|---|---|---|
| Custom icon set | **Partly** | UI chrome is `lucide-react` (about 50 icons, including the tab bar, `AppTabBar.tsx:25-30`); custom art for game tiles (`GameIcon.tsx`, `public/tiles`), daily and challenge tiles (`TabIcons.tsx`), player icons (`playerIcons.tsx`) and the brand (`LogoMark.tsx`). |
| One signature transition | **Yes** | `src/lib/fx/signature.ts:1-55`: the gold flash and logo burst on every solve. Room moments in `src/lib/fx/roomMoments.ts`. |
| Personalised, data-driven copy (rivals, margins, personal bests) | **Yes** | "Sam beat you 612–580" (`src/lib/duel/challenge.ts:265-276`, `YourChallenges.tsx`); near misses (`nearMiss.ts:17-36`); awards So Close, Comeback Kid, Fastest Finger, Perfectionist (`podiumAwards.ts`); "New best!" (`NewBestMoment.tsx`); tie notes "Level on 230 · ahead on time" (`tieDisplay.ts:35`). |
| Designed edge cases | **Yes, mostly** | 16 players (`types.ts:598`, lobby in two columns, compact lists with my row pinned: `screenshots/room/*16*`); long names truncate (about 77 `truncate`, fixture "Another long player name"); ties (`tieDisplay.ts`); 0 points shows ✗ (`resultPresentation.ts:85-102`); someone leaving (`DropoutBanner.tsx`); offline (`OnlineOnly.tsx`, `OfflineBanner.tsx`). **Slow network: Partly**: sends retry silently (`roomSend.ts`) with no "reconnecting" indicator. |
| Unambiguous room-code letters | **Partly** | Room codes `ABCDEFGHJKLMNPQRSTUVWXYZ` (`src/lib/duel/puzzles.ts:11`): no I or O, letters only, but **L is kept**. Challenge codes `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (`challenge.ts:47`) exclude I, L, O, 0 and 1. The two alphabets differ. |
| Tabular figures | **Yes** | `tabular-nums` about 101 times (`app-pages.css:733-737`, `game-frame.css:144`, `room-screens.css:44`, `styles.css:1496`); computed on every probed element (`typography.json`). |
| Curly apostrophes | **No** | 0 uses of `’` or `&rsquo;` in `src`; about 224 straight `'` contractions (`instructions.ts` 79; e.g. `OfflineState.tsx:16` "You're offline", `RoomLobby.tsx:410` "everyone's in", `Onboarding.tsx:176` "Let's play"). |
| Press states on all buttons | **Partly** | `.press` (`styles.css:715-729`) and the skin overrides (`app-pages.css:743-757`, `room-screens.css:185-196`); every gold CTA carries `.press`, but shadcn `ui/button.tsx:8` (30 files: puzzles, chat, the help and sound buttons) has no `:active` state, and many puzzle-board buttons rely on game CSS or nothing (13 `:active` rules in all the CSS). |
| No layout jumps while loading | **Yes** | `PlaySlot.tsx` plus `PLAY_CARDS_BOOT` (`src/lib/playCards.ts:174`, `__root.tsx:171`) reserve cards before first paint; the geometry hold (`PhoneShell.tsx:355-404`) for iOS home-screen apps; proved by play-tab-shift-check and first-paint-check. |
| Safe-area handling | **Yes** | `viewport-fit=cover` (`__root.tsx:98`); `env(safe-area-inset-*)` 61 times (`app-shell.css:22-40`, `styles.css:111,186-188`, `SettingsSheet.tsx:85`, `chatToastPlace.ts`); proved by safe-area-screens-check and screen-bottom-check. |
| Native swipe-back and sheet gestures | **Partly (mostly No)** | No drag-to-dismiss on SettingsSheet or RoomSettingsSheet (`SettingsSheet.tsx:72-85`, `RoomSettingsSheet.tsx:89-101`); the chat sheet closes on a 40 px downward flick with no finger-follow (`RoomChat.tsx:347-357`); vaul is installed but unused (`ui/drawer.tsx`); no edge-swipe handling; `overscroll-behavior: none` on the root (`styles.css:99`). |
| Skeletons rather than spinners | **No** (neither) | One loader: three bouncing dots with a label (`src/components/duel/Dots.tsx`, 14 uses: "Loading room", "Making a puzzle", "Scoring…"); some text only ("Loading words…", `RoundIntro.tsx:353`); `ui/skeleton.tsx` unused. The Play tab avoids placeholders by drawing cached cards. |
| Keyboard focus states | **Partly** | Rings only with hover and a fine pointer (desktop): `styles.css:676-700` removes outlines on touch devices, including an iPad with a keyboard; `.press:focus-visible` 2 px outline (`styles.css:725`); only 8 `focus-visible` rules in the CSS. |
| Colour contrast 4.5:1 | **Yes** | theme-check measures every visible text from screenshots (`scripts/theme-check.tsx:404-452`); 32 player colours at least 4.5:1 (`playerLook.ts:15-27`); reveal gradients at least 7:1 under white (`reveal-palette-check.ts`); rule in `docs/design-system.md:62`. Intentionally dimmed text and text in game art are exempt. |
| Rare-moment personality | **Yes for game moments; No for seasonal** | Perfect 200: `heroGrand` with six fireworks (`celebrations.ts:380`, `AnswerReveal.tsx:687`); 190+: `heroDance`; whitewash: `voice.cleanSweep` (`roomVoices.ts`, `Podium.tsx:198`); `photoFinish`, `newLeader`, `draw`; daily streak banners at 3, 7 and 30 (`daily.tsx:483`). No seasonal theming: `HOUSE_BANNERS` is empty (`src/config/banners.ts:17`). |

---

## 11. Other findings for the designer

- **Three visual languages co-exist:**
  - Tab pages and room screens: the `ap-*` / `rs-*` look, Archivo with flat panels and divided rows.
  - The older page skin: `th-*`, Saira / Manrope / Duelz Mono, still declared.
  - Game screens: Space Grotesk / Inter / JetBrains Mono, on category gradients.
- **Gold means "tap to play"** (`docs/design-system.md`). The rule is followed on the tab pages, but the gold CTA
  exists as three separate classes.
- **Two wordmarks.** The share card (`src/lib/share/resultCard.ts`, `share_card_result-card_1080x1350.png`) writes
  "Joulz" in mixed case beside a gold bolt tile, while the app header writes "JOULZ" in Archivo 900 at 118 % with a
  gold Z. The app icon is a third treatment: the inverted bolt on gold.
- **Desktop shows a house banner** ("Saturday night quiz", `BannerSlot`) above Play, Practice and Tournaments, built
  from the public schedule; phones never show it.
- **Room screens draw no tab bar;** the header carries a "⋯" menu for Disband and Leave (`RoomFooter.tsx`). Desktop
  replaces the tab bar with a 240 px rail and adds a right-hand column (`docs/desktop-layout.md`).
- **The harness always treats this device as the host,** so screens a guest sees are under-represented. The lobby
  "as a guest" shot sets another host, but the `isHost` flag from the stubbed room hook stays true.

---

## 12. What couldn't be captured, and why

| Wanted | What happened |
|---|---|
| Leave confirm (guest) | The harness's room hook always reports this device as the host, so the guest's "Leave" menu item is never offered. The host's player menu and remove-player confirm were drawn instead. |
| Update available | The `AppUpdateOverlay` is mounted only by the app root, which the harness doesn't draw. `states_update_updating_*` puts the exact markup and classes from `AppUpdateOverlay.tsx` on the Play page, so it is **reconstructed, not live**. There is no "update available" banner or prompt: the app reloads itself at a safe moment (`src/lib/appUpdate.ts`). |
| 404 page | The root route's own component, not part of the harness. It uses `ErrorState`, the same layout as "room not found" and "challenge not found", which are drawn. |
| Splash screen | None exists (see Assets). |
| Slow network | Retries are silent and leave no visible state to capture. Loading states drawn: room loading. |
| A real round played to its end on the phone | The reveal, results and celebrations are drawn from stored results (fixtures), as the room would show them, not from live play. |
| Haptics | Not visible; mapped in §7. |
| Hero in Spacewalk (Jaywalk) | Spacewalk now draws a pixel astronaut, not the hero (since 3 Nov 2026), so it has no hero frame. `screenshots/hero/` holds Grappler and Roofbound renders from `scripts/shots/hero-shots.ts` (the real renderers, at 414 px and 4× close-ups). |
| Hero moments on the reveal | The reveal plays its hero once, as soon as it opens, before a screenshot can settle. The shots in `celebrations/` re-fire the same moment (`heroRun`, `heroDance`, `heroGrand`) through the page's own celebrations module, as `scripts/celebrations-browser.ts` does, and are taken mid-move. |
| Puzzle reveal board | The puzzle answer reveals (Box Six) stay on "Revealing…" because the harness doesn't serve the closed round's full puzzle (`fetchRevealPuzzle`). The score, verdict and footer are real; the solved board that fills the space on a phone is missing. The arcade reveals (chart, breakdown) are complete. |

Every planned shot was captured (121 frames from the capture script, 0 misses; plus the hero renders, asset copies and the typography close-up).
