# Session P4: desktop

You are a build session for Joulz. You build section 7 of `docs/polish-plan-final.md`: rows B1 to B5 of `docs/polish-plan-final/earlier-plan.md` (their files, lines and checks still apply), on the Cabinet skeleton that is already on main behind `ARENA_CABINET_LEFT` in `src/lib/gameFrame/arena.ts`. Read `docs/polish-plan-final/desktop-research.md` first. Mockups: `direction/pages/play-a-desktop.webp` (the Cabinet's layout on Breaker; paint the panels in the esports style: navy, one cyan or category edge), `home-e-desktop.webp`, `games-e-desktop.webp`, `vs-e-desktop.webp`.

Build: B1 the Cabinet (left panel with the game, a big score, the timer, best and this run; right panel with the goal, next challenges and controls, and in a room the standings and chat; the game's scenery carried behind both; canvas HUDs drawn in the panel through the `hud` placement flag); B2 Blockzone's true cabinet; B3 puzzles in two columns; B4 tab pages on a computer in this plan's layouts (P1 to P3 own the pages' contents; you own their desktop grids); B5 the rail's contents once P1 has merged.

The world never changes: `arena-world-check` and `desktop-fairness-check` stay green untouched. You own: `desktop-layout.css`, `ArenaGamePanel.tsx`, `src/lib/gameFrame/arena.ts`, `hudPlacement.ts` and the HUD flags in `retro.renderer.ts`, `actionHud.renderer.ts`, `hudPill.renderer.ts` and `cards/*.renderer.ts`, `blockfall.renderer.ts` (`bfLayout`), `scripts/screens/desktop.ts`. Do not touch any art function (balls, gems, tiles), sim or deal.

Checks you own: arena-world-check, desktop-fairness-check, desktop-layout-check, desktop-geometry-check, arcade-play-desktop-check, skins-default-check (the HUD flag defaults on, so digests do not move), phone-gap-check (phones unchanged). Your assertion rows: `assertions.md` Part 1's desktop lines (the three desktop-geometry-check lines for the left panel).

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
