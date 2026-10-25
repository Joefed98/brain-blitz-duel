# Screen audit (25 Oct 2026)

A report only: no app code, checks, CI or data changed. Every non-gameplay screen was drawn on the real
routes through the screen harness (`scripts/safe-area-harness.tsx`, network stubbed; the theme screens'
daily and challenge fixtures) at **414×896** (an iPhone 11 home-screen app with 48/34 px insets) and
**375×667** (iPhone SE Safari), and judged against `docs/design-system.md`. Game play screens (the seven
polish PRs' area) were not audited.

- Screenshots: `screenshots/screen-audit/<screen>-<size>.jpg` (98 frames; `-end-` frames are the same page
  scrolled to its end). One overview sheet per group: `overview-<group>-<size>.jpg`. `index.json` lists
  every frame and its state.
- Re-run: `bun scripts/shots/screen-audit-shots.ts [--only=<group,…>] [--app=<dev server origin>]` (the
  404 page needs the app's own dev server, e.g. `bunx vite dev --port 8099 --host 127.0.0.1`).
- Fixture caveats (not findings): names and scores are made up; the harness's room code shows as SAFE on
  the link-join error; round leaderboard summaries come from a stand-in reveal, so a row can read
  "Partly solved · Solved"; the arcade reveal logs a "client/server desync" because its run is a stand-in.

Severity: **P1** breaks use or reads clearly wrong on a phone; **P2** a visible break from the design
system; **P3** polish.

## The big picture

The four tab pages (Play, Practice, Tournaments, Profile) follow the design system closely: flat panels,
divided rows, Archivo, neutral links, gold only on play actions. Almost everything else, the room
(lobby, reveals, standings, podium), daily, challenge, terms, intros and errors, is still on the older
**skinned look**: Saira all-caps labels and buttons, gold-edged glass cards, gold scores and a gold
outline on "my" row, and the old small `Wordmark` (`src/components/duel/Wordmark.tsx`) instead of
`AppWordmark`. The design system allows the skin on those screens, but its gold rule applies everywhere,
and the skin breaks it on nearly every screen. The two families also look like two apps when you move
from the Play tab into a lobby.

The second theme is **height at 375×667**: the room's sticky footer (primary button, Disband, chat bar
with six emoji) takes about 190 px, which leaves the lobby and podium lists a 70–120 px window.

## Play tab

Frames: `play-first-time-intro`, `play-fresh` (+`-end`), `play-dailies-done`, `play-public-game`,
`play-home-hint`; sheet `overview-play-*`.

1. **P2 · First-time intro is the old look.** Small mixed-case "Joulz ⚡" wordmark instead of
   `AppWordmark` (JOULZ, gold Z); all-caps SKIP and NEXT; NEXT is a flat yellow (`--primary` #F5B82E),
   not the gold shine; "Next" is not a play action, so gold here dilutes the rule. The top half of the
   screen is empty black above the A ⚡ B art.
2. **P2 · Join now looks disabled with no reason.** Before the lobby opens, the public game's Join now is
   a greyed outline button beside an active Add to calendar; nothing says when it opens (the "Lobby opens
   7:45 pm" line is in the card above it, not on the button).
3. **P3 · The header's sound and music controls** (two icons, each with a chevron) are small (about
   16 px glyphs), the only controls on the page without a label, and read as decoration.
4. **P3 · Fresh install**: Quick play's name field relies on a placeholder ("Your name") as its only
   label; the Warm up tiles' names sit at 13 px under 72 px tiles with a lot of space to the panel edge.
5. Good: gold is limited to Create a room, the Daily Play / Continue pills, the current tab and the logo;
   Done pills are grey; the Add to Home Screen hint is a plain panel.

## Practice

Frames: `practice-all-fresh` (+`-end`), `practice-all-bests`, `practice-category`, `practice-search`,
`practice-search-empty`; sheet `overview-practice-*`.

1. **P2 · Shelf headings are weaker than their link.** "Word", "Number", "Speed"… are 13 px grey
   (`.ap-group-title`) while "See all" beside them is 15 px bold white: the hierarchy is upside down.
   Shelf titles should be `.ap-section-title` (18 px) with See all in `--ap-link`.
2. **P2 · Speed tiles read brown, not orange.** `--cat-lo` for #FF8A3D lands on a muddy brown, so the
   Speed shelf looks unlike its chips, intros and round titles. Number and Logic greens are also close
   enough to confuse at a glance (#3DDC84 vs #2ED3B7 tiles).
3. **P3 · "Best 148" is tiny and inconsistent.** 12 px grey under only some tiles, so rows of tiles have
   ragged baselines; consider reserving the line or putting the best on the tile.
4. **P3 · Chip row clips "Attention"** at both sizes with no fade or affordance that it scrolls.
5. **P3 · No-match search** shows "No games match" in a panel plus a floating footnote ("Personal bests
   stay on this device") that belongs to the list, not the empty state; no "Clear search" action.
6. **P3 · Retired (10)** is a bare 13 px disclosure with a ▸ glyph, unlike every other row.

## Tournaments

Frames: `tournaments-scheduled`, `tournaments-none`; sheet `overview-tournaments-*`.

1. **P2 · Your results don't say which game.** Rows read "Sat 24 Oct · 10 players · 812 points" with no
   title (the schedule has one), and "1st" has no medal, unlike every room screen.
2. **P2 · Empty state is two grey one-liners** and then 300+ px of black above the tab bar. With nothing
   scheduled there is no hint of what tournaments are or when to check back.
3. **P3 · The date tile is teal** (#2ED3B7 family), which is Logic's category colour. A neutral or gold
   tint would avoid implying a category.
4. **P3 · "Left"** for an abandoned game is drawn as large as a place, so it reads like a result.

## Profile

Frames: `profile-new` (+`-end`), `profile-stats` (+`-end`), `profile-settings`; sheet `overview-profile-*`.

1. **P1 · The settings sheet is the old design.** Saira all-caps (SETTINGS, ARROWS / JOYSTICK, HOW IT
   WORKS, BETA TERMS), glass cards, and a gold-outlined selected segment (ARROWS) though the gold rule
   reserves gold for play actions and the Practice chip. It opens from a page that follows the system
   exactly, so the jump is obvious.
2. **P2 · The player's own badge is a grey "P"** on a neutral disc. Everywhere else a player is their
   colour; a new player gets no sense of their look until they open a lobby.
3. **P2 · A new player's Profile is mostly zeros and dashes** ("0 days", "–", "–"; three 0 stats) with
   empty-state panels below. A first-run message ("Play a room or today's daily to fill this in") with a
   play button would use the space better.
4. **P3 · Your challenges rows** pack four lines of differently weighted text ("Sam beat you 708–694" in
   white, the rest grey) under a spaced mono code; the row is taller than the 62 px row spec allows for
   and has no icon square, unlike its neighbours.
5. Good: stat tiles, practice bests with icons, recent rooms and the footer follow the row and panel spec.

## Lobby

Frames: `lobby-1`, `lobby-3`, `lobby-10` (+`-end`); sheet `overview-lobby-*`.

1. **P1 · At 375×667 the lobby has a 70 px window.** With 3 players the list shows one and a half rows
   and the categories are hidden behind the sticky footer (START GAME, Disband room, the chat bar). With 1
   player only STANDARD and ARCADE ONLY are visible; nothing shows that the area scrolls. The host has to
   find the category chips by scrolling a strip the height of one row.
2. **P1 · Gold everywhere.** Room code, SHARE (gold outline), YOU'RE THE HOST pill, the charge meter, my
   row's gold border, HOST / YOU labels, the selected STANDARD chip, every selected category chip, START
   GAME and the chat send button are all gold: about ten gold things on one screen, against "a second gold
   thing should be a reason to look again". Only START GAME qualifies.
3. **P2 · Category chips don't use the category colours.** Selected categories are gold-outlined with a
   small coloured dot; the design system says categories carry their own colour on chips.
4. **P2 · The old look throughout.** Small mixed-weight `Wordmark`, Saira all-caps for every label and
   button (ROOM CODE, COPY LINK, CATEGORIES, 1 OF 10 PLAYERS), glass cards; nothing shares the tab pages'
   panels and rows, so leaving the Play tab feels like a different app.
5. **P2 · Instruction line with an emoji glyph**: "🔊 Chat: mute that player's chat for everyone · ×:
   remove them" sits mid-screen as a permanent caption in 13 px; the per-row "🔊 CHAT" and "×" controls
   are small (about 24 px glyphs) and unlabelled for a first-time host.
6. **P3 · The chat bar** ("Chat…" input truncated to "Chat" at 375 px, six emoji reactions) is on every
   room screen including the lobby's first moments; the placeholder truncation reads as broken.

## Game intros

Frames: `intro-puzzle-demo` (Box Six), `intro-puzzle-still` (Strikeout), `intro-arcade` (Gemstone);
sheet `overview-intros-*`.

1. **P2 · Header and type are the old app tokens.** Small "Joulz" wordmark, a pill "← Back", mono
   meta ("PRACTICE · LOGIC", "auto-start in 26s", "Best: — · this device"), all-caps READY on flat
   `--primary` yellow. None of it matches the game frame header (Polish 2) the round opens into a second
   later, so the intro → play transition changes header, fonts and gold.
2. **P2 · Category colour is only in tiny labels.** GOAL / HOW / SCORE and the category word are coloured;
   the screen itself is plain black, while the play screen it leads to has the category gradient.
3. **P2 · Empty black around the still.** Strikeout's still is a small strip with about 150 px of
   blank space above and below; at 375×667 Box Six's demo box shrinks to about 100 px wide.
4. **P3 · "Best: — · this device"** is a mono line with an em dash for a first run; "No best yet" is
   friendlier.

## Answer reveal

Frames: `reveal-puzzle-2`, `reveal-puzzle-6`, `reveal-arcade-2`, `reveal-arcade-6`; sheet `overview-reveal-*`.

1. **P2 · Edge-to-edge with a 4 px gutter.** "ROUND 1 OF 1", the game name and the board panel run to
   4 px from the screen edge, against the 16 px page gutter used everywhere else.
2. **P2 · Gold for scores.** "127 points" (mono, gold) and the arcade's big 127 are gold; the gold rule
   makes scores neutral. The verdict ring is gold too.
3. **P2 · Empty space round the puzzle board.** The board sits in a full-height tinted panel; at 414×896
   about 130 px above and 150 px below it are empty.
4. **P2 · "✓ SOLVED · 53.2S"**: the uppercase transform turns the seconds unit into a capital S.
5. **P3 · The arcade chart sits over the game's blurred board** (Gemstone's gems show through), which
   competes with the snake's markers; names at 13 px over coloured gems are hard to read at 375 px.
6. **P3 · Neither reveal says who else is in** (a puzzle reveal with 6 players looks the same as with 2);
   the "Still scoring: …" line is the only sign, in mono at the very bottom.

## Points reveal and standings

Frames: `points-6`, `points-swap`, `standings-countup`, `standings-swap`, `standings-tie`, `standings-2`;
sheet `overview-standings-*`.

1. **P1 · Ties are drawn as distinct places.** Three players on 230 get medals 1, 2 and 3 and "–"
   movement; nothing says they are level (no "=1", shared medal or "tied" note), so two of them see
   themselves placed below an equal score.
2. **P2 · Gold overload again**: OVERALL STANDINGS label, the leader's score, ▲ movement arrows, my row's
   gold border, ROUND WON pill, CONTINUE and the chat send button.
3. **P2 · Large empty band** between the list and CONTINUE (about 250 px at 414×896 with 6 players).
4. **P2 · Redundant labels**: "OVERALL STANDINGS" and "OVERALL" (and "ROUND RESULTS" / "FINAL ROUND") sit
   on one line in two styles, plus a legend line "▲▼ places moved · +points this round · total" in mono.
5. **P3 · The row chevron** ("›" after each score) is about 8 px and faint, the only cue that a row opens.
6. Good: the count-up and its sparks read well mid-way (`standings-countup`); the swap animates and
   ▲1 / ▼2 are clear; the round leaderboard's one-line summaries fit.

## Podium and final results

Frames: `final-2` (+`-end`), `podium-6` (+`-end`); sheet `overview-final-*`.

1. **P1 · At 375×667 the podium list shows 3 of 6 rows** (Jordan, Alex and Robin are below a scrolling
   strip under the footer); a player in 4th–6th can't see their own row without finding the scroll.
2. **P2 · Opponent colours are wrong on the two-player screen.** Priya's badge is orange but her name
   and scores are teal; the player's own scores are gold. The screen should use the players' own
   colours (or neutral), never teal/gold as stand-ins.
3. **P2 · Gold**: "1ST" / "WIN", my score, the 1 step, my row and PLAY AGAIN; only PLAY AGAIN qualifies.
4. **P2 · Rounds table without icons.** BOX SIX, GEMSTONE… are spaced all-caps labels; every other
   screen shows a game with its icon tile.
5. **P3 · The podium hero is tiny** (about 30 px tall, beside the step's number) and the steps are
   hollow tinted shapes; the moment is undersold for the end of a game.
6. **P3 · LEAVE / HOME** are full-width all-caps outline buttons with more weight than Share.

## Daily, challenge, terms and errors

Frames: `daily-results` (+`-end`), `daily-board`, `challenge-podium` (+`-end`), `challenge-creator`,
`terms` (+`-end`), `error-challenge-not-found`, `error-room-not-found`, `error-404`; sheet `overview-other-*`.

1. **P1 · The 404 page is the starter template.** "404 / Page not found / Go home" in the default font
   with a small rounded `--primary` button; no app header, wordmark, tab bar or Joulz copy
   (`NotFoundComponent` in `src/routes/__root.tsx`).
2. **P2 · Daily board: five gold things above the fold.** CLOSES IN pill, DAILY PUZZLE tab, YOUR
   RESULTS, TODAY tab and my total 694 are gold, while the real action (Share) is teal. The selected
   segment of a tab pair is gold-outlined, which the rule reserves for the Practice chip.
3. **P2 · Daily results: LEADERBOARD in gold, Share in teal**; 694 and the 150 row score are gold.
   Round rows use "1. Don't Break the Chain" numbering plus icon, and summaries ellipsise ("0 pushes
   (mi…") so the line says little.
4. **P2 · Challenge podium: "CHALLENGE SOMEONE ELSE" is a gold-text button on a dark gold glass**, a
   third style of button on one screen (teal Share, gold-glass, grey NEW CHALLENGE / DONE).
5. **P2 · Terms**: the terms sit in a gold-bordered glass card under a gold "BEFORE YOU PLAY" label, all
   section headings in Saira caps; long reading text in a bordered card with 16 px padding is cramped at
   375 px. I AGREE in gold is right.
6. **P2 · Error states are inconsistent.** Room not found: centred Saira caps title with a full-width
   gold HOME (gold for a non-play action). Challenge not found: left-aligned page with a grey panel and a
   gold-outlined MAKE YOUR OWN CHALLENGE. 404: the template. Three looks for one idea.
7. **P3 · Daily board's "‹ PLAY" back link** is all-caps and grey 13 px, unlike the tab pages' links.

## Prioritised fixes

1. **Room footer height at 375×667** (lobby, podium, standings): fold Disband into an overflow, shrink the
   chat bar to an icon that opens the chat sheet (reactions inside it), so lists and categories get
   their room back. (P1 lobby, P1 podium.)
2. **Show ties** on standings, podium and round results: shared place ("=1"), shared medal, and a
   "tied" note; ranking can keep its tie-break order. (P1.)
3. **Apply the gold rule to the skinned screens**: gold only for Start game, Ready, Play again, Join and
   the daily Play/Continue; scores, labels, "you" rows, room code, selected segments and pills neutral
   (or the player's colour for "you"). Start with the lobby, standings and daily board, where the count is
   highest. (P1/P2 across 8 screens.)
4. **Replace the 404 and unify the error states** (404, room not found, challenge not found) on one tab
   page layout: AppHeader, a panel with the message, Back to Play as a neutral button and one gold play
   action where it makes sense. (P1/P2.)
5. **Move the settings sheet to the tab pages' look** (Archivo, panel rows, neutral selected segment).
   (P1.)
6. **Use `AppWordmark` on every screen that shows a wordmark** (rooms, intros, first-time intro, daily,
   challenge, terms) and retire `src/components/duel/Wordmark.tsx`. (P2, cheap, high visibility.)
7. **Category colours where categories appear**: the lobby's category chips in their own colours;
   intro background in the category gradient like the play screen; revisit `--cat-lo` for Speed (brown)
   and the Number/Logic green pair; a neutral date tile on Tournaments. (P2.)
8. **Two-player final screen**: players' own colours instead of gold/teal; game icons in the rounds
   table. (P2.)
9. **Bring the room screens' type down from all-caps Saira** to sentence-case headings and Manrope labels
   (ROOM CODE, COPY LINK, OVERALL STANDINGS, CONTINUE, LEAVE…), keeping caps for the biggest moments only.
   Remove duplicated labels (OVERALL STANDINGS + OVERALL) and the legend line. (P2.)
10. **Empty space**: tighten the answer reveal's board panel, the standings gap above Continue, and the
    intros' still box; give empty Profile and Tournaments states a line of guidance and a play button.
    (P2.)
11. **Answer reveal gutter** to 16 px and fix the "53.2S" uppercase unit. (P2, small.)
12. **Small polish**: Practice shelf heading hierarchy, ragged "Best" lines, the clipped chip row,
    Tournament results titles and medals, Join now's "opens at" text, a real label for the name field,
    bigger lobby row controls with labels, the row chevron size. (P3.)
