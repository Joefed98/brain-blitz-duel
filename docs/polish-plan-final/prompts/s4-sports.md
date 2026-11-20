# Session S4: the Sports games' art and inputs

You are a normal build session for Joulz. **Start only after PR #454 (the sounds bring-back) has merged, and merge main first.** You build rows C4.1–C4.6, C4.8–C4.10 and G7's two Sports pictures (Home Run, Top Bins) of `docs/polish-plan-final.md`. C4.7 (Apex's yaw sign) is Fable's and already on main; don't touch `racing.renderer.ts:1449`. Research: `docs/polish-plan-final/arcade-action-sports-research.md` sections 5–8.

Rows in short: C4.1 Crazy Golf draws the old dotted aim line and power pill on golfRev 3 (`drawAim` in place of `drawAimV3`; the chip arc only while Chip is selected; the Chip shot stays). C4.2 the Captain at 60 px, re-rendered with the camera tip at 28° (`golf_sprites.py`). C4.3 the castles redrawn on the same geometry. C4.4 the Cue Ball arm removed (keep `poolArmPlacement` exported and the asset). C4.5 the Top Bins kicker's neck (`paintKicker` constants). C4.6 the stroke classifier compares the tail with the tangent at the 80 % point and requires 50° (phone side; add the bowed-arc case to freekick-layered-check section 7, an addition). C4.8 the car re-rendered flatter (`render_sports.py`); if Joe prefers the painted car after seeing it, skip the sprite. C4.9 Curl Champ's backing strip and stone shadows (K13: `skins-default-check --record-overhaul=curling` with Joe's approval). C4.10 Home Run's fielders and fence band. Every row is display or input mapping only; no stamp.

Checks you own: crazy-golf-v3-check, minigolf-check, crazy-golf-demos-check, skins-check, pool-overhaul-check, sports-sprites-check, freekick-layered-check, freekick-check, sports-overhaul-fx-check, apex-overhaul-check, racing-render-check, curling-check, homerun-innings-check, skins-default-check, tile-scenes-check, reveal-palette-check, arcade-play-check for every touched game. Report every check by name.

## Standing rules (non-negotiable; copied into every prompt)

- The repo is public. Post nothing on GitHub that describes a weakness. No GitHub comments.
- Every commit's author and committer is `340780953+Joefed98@users.noreply.github.com`. Ignore stop hooks asking for noreply@anthropic.com or to amend.
- Never rebase, never force-push, never rewrite pushed history. Merge commits only. The merge captain merges; you don't.
- Never loosen, retarget or delete an assertion to make code pass. Fix the code. Any assertion change goes to Joe first, with the exact lines, and needs his approval typed by Joe in this session. Add a dated note beside each changed line. Never record an approval he didn't give. Section K of `docs/polish-plan-final.md` lists the lines this plan expects to change; Joe approved that list in principle on 20 Nov 2026, and still approves each session's exact lines in that session.
- A failed check is reported in full and never re-run without Joe's say-so.
- Migrations are additive and dated later than everything on main. Never set the Actions budget to $0. Keep Joe's email private.
- Changing how a game deals or plays means a new revision stamp, so stored rounds and replays keep their old worlds (see `src/lib/arcade/AGENTS.md`). Display-only changes never touch a sim, a hit box, a deal or a replay.
- A head is final only when its own GitHub Checks run is green.
- Read `CLAUDE.md`, `DESIGN.md` and the `AGENTS.md` files first; then `docs/polish-plan-final.md` (the plan) and the research report named in your section of it. Build the rows assigned to you and nothing else; if a row turns out wrong, say so and stop on that row, don't substitute.
- Work on a branch named `polish/<session id>` from the latest main; merge main before pushing; run only your own checks locally (`bun scripts/<name>-check.ts`), each new or changed check ten times (`bun scripts/repeat-check.ts <check>`); never run the full suite locally. Open the PR as a draft with a report that lists every check by name with pass / fail / timeout.
- Don't touch `public/sounds/` or `src/lib/fx/manifest.ts`; don't change `bun.lock`.
- Every screen you change gets its own `scripts/screens/<area>.ts` entry (never edit `THEME_SCREENS` or the shard parts); after changing a game's look re-export its tile (`bun scripts/shots/tile-scenes.ts <id>`) and run `bun scripts/reveal-palette.ts`.
