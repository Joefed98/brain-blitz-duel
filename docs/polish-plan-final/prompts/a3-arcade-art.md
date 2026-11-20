# Session A3: the arcade games’ look, and the bugs

You are an art build session for Joulz. You build the Retro, Action, Strategy, Sports and Cards & Board tables of section 5 of `docs/polish-plan-final.md`, and the bug rows H1 to H8 of `docs/polish-plan-final/earlier-plan.md` (reproductions in `bugs-research.md`). Research with the files and lines: `arcade-retro-strategy-research.md`, `arcade-action-sports-research.md`.

The direction Joe picks in decision 2 of the plan sets the look (the plan recommends **Spotlight**: a lit stage in the category's deep colour, light matte pieces on board puzzles, deep boards where the game is about light, lit worlds, Retro dark with glow). Section 1.2 has the seven art rules; section 5 has one row per game saying what stays and what changes, and names the rows of `docs/polish-plan-final/earlier-plan.md` that are carried forward (kept, changed or dropped: section 5 wins where they differ). Studies to match: `direction/games/<game>-spotlight.webp` and the drawn ones `direction/games/<game>-drawn.webp`; today is `<game>-now.webp`.

Everything you do is display only: no sim, deal, hit box, replay, score or level changes. Piece sets are re-rendered by their own scripts under the same file names and inside the same byte budgets, so name, size and hash checks keep passing after the documented re-run. Today's game frame (the 60 px header, the timer, the goal line, the dock) is not yours to change; the stage colour must fade to the page colour before the notch and home-bar strips (bottom-clearance-check's seam rule).

Retro keeps its dark screen: flat pixel pieces with a glow, no 3D shading. Worlds are lit: blacks lifted to deep colour, colours about a quarter stronger, baize and skies in colour. Card games draw their cards to fill the table (Summit's peaks and stock a fifth larger). Grappler's grab ring keeps its 14 px size and is redrawn as a vine loop. Moon Climb's ninja and Fission's atoms keep their sizes (no stamp).

You own: the arcade `*.renderer.ts` files named in the carried rows, `arenaFills.renderer.ts`, `cache.renderer.ts` (H1), `orbitCamera.ts` and `orbitPlanets.renderer.ts` (H2, H3), `docs/design/cosmetics-redraws/blender/strategy_art.py`, `scripts/cards-board-art/*`, the sports render scripts, `freekickStroke.ts` (C4.6, phone side only). Do not touch a sim, a deal, a stamp or a level table (D5, D6); H4 is a rules change and belongs to D5.

Checks you own: retro-overhaul-check, strategy-overhaul-check, the action checks (bastion-overhaul, swing-overhaul, ricochet-overhaul, skyline-overhaul, flip-overhaul, orbit-overhaul, orbit-camera), the sports checks, cards-board-overhaul-check, skins-default-check, arcade-fill-check, arcade-play-check, arcade-fx-check, arcade-lowend-check, art-check, tile-scenes-check, reveal-palette-check. Your assertion rows: `assertions.md` Part 2A, Retro, Action, Strategy, Sports and Cards & Board (note the tank digest in bastion-levels-check).

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
