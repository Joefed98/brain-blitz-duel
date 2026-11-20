# Session F1: the final pass

You are the last build session for Joulz in this plan. Start only when every P, A and D session of `docs/polish-plan-final.md` section 11 has merged. You change no code and no look: you regenerate what is generated, once, on the merged main.

Do, in this order, and commit each step's output:

1. Re-export every game's tile: `bun scripts/shots/tile-scenes.ts` (all games), which rewrites `public/tiles/*.webp` and `tileScenes.data.ts`.
2. Re-export the intro stills that are real frames (`bun scripts/shots/strategy-stills.ts` and the others CLAUDE.md names for the families that changed), then `bun scripts/strategy-art-data.ts`.
3. `bun scripts/reveal-palette.ts` (the reveal gradients come from the tiles).
4. `bun scripts/look-previews.ts --check` and `bun scripts/shop-previews.ts` if a skinned game's or an item's picture changed.
5. `bun scripts/practice-stamps.ts` and the challenge catalogue doc script, as a check that nothing is stale.
6. Re-record `scripts/fixtures/celebrations-off.json` (`bun scripts/celebrations-browser.ts --record-off`) only if a recorded screen's markup changed since it was last recorded, and only with Joe's approval typed in this session.
7. Tell the merge captain the intro demos are ready to re-record: list every game whose dealt stamp changed, from the D sessions' reports, for the "Save intro demos" workflow.

You own: `public/tiles/*`, `src/components/app/gameIcons/tileScenes.data.ts`, `public/intro/*`, `src/lib/duel/revealPalette.data.ts`, `src/lib/arcade/strategyArt.data.ts`, `public/looks/*`, `public/shop/*`, `scripts/fixtures/celebrations-off.json`. Do not touch anything else.

Checks you own: tile-scenes-check, reveal-palette-check, strategy-overhaul-check (its data lines), practice-bests-check, practice-goals-check, celebrations-check, offline-media-refresh-check. Report every check by name.

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
- Joe's decisions and his answers are in section 2 of the plan. If a decision your work depends on has no answer recorded there, ask Joe before building it.
- You own the files your prompt lists and no others (`docs/polish-plan-final/coverage.md` has the whole map). If you need a change in a file another session owns, write it up for that session; don't make it.
- Work on a branch named `polish/<session id>` from the latest main; merge main in before pushing; run only your own checks locally (`bun scripts/<name>-check.ts`), each new or changed check ten times (`bun scripts/repeat-check.ts <check>`); never run the full suite locally. Open the PR as a draft with a report that lists every check by name with pass, fail or timeout. A head is final only when its own GitHub Checks run is green.
- Every screen you change gets an entry in its own `scripts/screens/<area>.ts` (never edit `THEME_SCREENS` or the shard parts without Joe's approval). Generated data files (tiles, palettes, stamps, catalogues) are regenerated by their scripts after merging main, never merged by hand.
