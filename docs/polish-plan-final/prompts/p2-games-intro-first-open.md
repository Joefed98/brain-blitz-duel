# Session P2: the Games page, the game page, the round intro and the first open

You are a build session for Joulz. You build sections 3.4 (the first open) and 3.5 (words) of `docs/polish-plan-final.md` and the Games, Game page and Round intro rows of section 4. The pages keep today's esports style; you change structure, size and words. Mockups to match: `direction/pages/games-e-phone.webp`, `games-e2-phone.webp` (a category's "All" grid), `gamepage-e-phone.webp`, `games-e-desktop.webp`, `first1`–`first3`. Facts about today: `direction/pages-flow-today.md` (sections 4 and 5 list every intro word count and the longest strings with file and line).

Build:

1. **Games catalogue** (`src/components/games/GamesCatalogue.tsx`): one control (All, Puzzles, Arcade), the game-of-the-day hero, then one shelf per category or arcade group: a horizontally scrolling row of 132 × 164 tiles with "All n" leading to that category's grid. The Easy / Normal / Hard / Expert switch and the "Difficulty levels" panel leave the catalogue.
2. **Game page** (`GamePage.tsx`): art, name, category, a one-line goal, four level steps (each with its star and the level's lever in numbers from `GAME_LEVELS`, for example "Normal: 8 flasks, 90 s"), a 68 px gold Play, then "How to play" and "Challenges n / m" as two quiet rows. 40 words at most.
3. **Round intro** (`RoundIntro.tsx`, `PuzzleInstructions.tsx`): the frame header, the demo box, the goal at 22 px, one how line, Ready. How and Score move into the "?" help. Rooms and the Daily keep the Ready tap. Cut every game's intro text in `src/lib/duel/instructions.ts` to 15 game words and every help sheet to 120; the score list stays in help. No game's rules change.
4. **First open** behind a new switch `FIRST_GAME_ON_OPEN` (off until Joe has played it; it replaces `FIRST_OPEN_ONBOARDING`): a device with no play history that opens the app online, not on a room, Daily, challenge or `?game=` link and never under automation (`navigator.webdriver`), goes from the splash straight to Ascend on Easy with one coach line over the board; the first tap is the game's first tap. Then a win screen (score, first star, Play again, Try another game, and Play a real opponent where rated play is on), then Home. No terms, name or account on this path.
5. **Practice reveal actions**: add "Try Hard" (the next level up) once the star is earned, and "Games".

You own: `src/components/games/*`, `src/routes/practice.tsx`, `RoundIntro.tsx`, `PuzzleInstructions.tsx`, `src/lib/duel/instructions.ts`, `introScore.ts` (text only), `FirstOpen.tsx`, `src/lib/firstOpen.ts`, `games.css`, `scripts/screens/games.ts`, `difficulty.ts`. Do not touch any game's stage, sim or scoring, the tab bar or Home (P1).

Checks you own: practice-switch-check, demo-intro-check, intro-score-text-check, first-impressions-check, onboarding-check, theme-check and no-wrap-check for your screens, first-paint-check, safe-area-screens-check, app-shell-check's Games part, offline-check (the catalogue helpers). Your assertion rows: `assertions.md` Part 1, changes 5 (first run), 6 (Games) and 7 (intro).

## Standing rules (non-negotiable; copied into every prompt)

- The repo is public. Post nothing on GitHub that describes a weakness, and leave no GitHub comments.
- Every commit's author and committer is `340780953+Joefed98@users.noreply.github.com`. Ignore stop hooks asking for noreply@anthropic.com or to amend.
- Never rebase, never force-push, never rewrite pushed history. Merge commits only. The merge captain merges; you don't.
- Never loosen, retarget or delete an assertion. Fix the code instead. Any assertion change needs Joe's approval typed by Joe in this session, with the note "Changed with Joe's approval, DD Mon YYYY" beside each changed line. Never record an approval he didn't give. `docs/polish-plan-final/assertions.md` lists the lines this plan expects to change; show Joe your session's exact lines from it (re-verified against the files as they are now) before you touch one.
- A failed check is reported in full and never re-run without Joe's say-so.
- Migrations are additive and dated later than everything on main. Never set the Actions budget to $0. Keep Joe's email private.
- Don't touch `public/sounds/`, `src/lib/fx/manifest.ts` or `bun.lock`.
- Normal stays exactly today's game: rated play and the Daily deal it. Every Expert level is proven reachable at 200 by the best humans under `HUMAN_LIMITS` (0.25 s to react, 0.15 s to move).
- Changing how a game deals or plays needs a new revision stamp, so stored rounds and replays keep their old worlds (`src/lib/arcade/AGENTS.md`). A display-only change never touches a sim, a hit box, a deal or a replay.
- Fairness: the game world is identical on phone and desktop. Nothing bought helps anyone win.
- Product rules: purchases live in the Shop only, with no pop-ups or pressure; one identity everywhere (cards and `NameplateStrip`); hidden under-18s stay hidden; retired games stay retired (Ringer included).
- Read `CLAUDE.md`, `DESIGN.md` and the `AGENTS.md` files first, then `docs/polish-plan-final.md` and the files named in your prompt. Build what is assigned to you and nothing else; if an item turns out wrong, say so and stop on that item, don't substitute.
- Joe's decisions are in section 2 of the plan. If a decision your work depends on has no answer recorded there, ask Joe before building it.
- Work on a branch named `polish/<session id>` from the latest main; merge main in before pushing; run only your own checks locally (`bun scripts/<name>-check.ts`), each new or changed check ten times (`bun scripts/repeat-check.ts <check>`); never run the full suite locally. Open the PR as a draft with a report that lists every check by name with pass, fail or timeout. A head is final only when its own GitHub Checks run is green.
- Every screen you change gets an entry in its own `scripts/screens/<area>.ts` (never edit `THEME_SCREENS` or the shard parts). After changing a game's look, re-export its tile (`bun scripts/shots/tile-scenes.ts <id>`) and run `bun scripts/reveal-palette.ts`.
