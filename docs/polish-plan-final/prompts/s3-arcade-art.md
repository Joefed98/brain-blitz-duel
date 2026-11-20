# Session S3: arcade art (Retro, Strategy, Action) and the arcade reveal pictures

You are a normal build session for Joulz. **Start only after PR #454 (the sounds bring-back) has merged, and merge main first.** You build these rows of `docs/polish-plan-final.md`: C1.1–C1.5, C1.7, C1.9–C1.11, C2.1–C2.4, C3.1–C3.4, C3.6–C3.8, G7 (the pictures only), and bugs H1, H2, H3, H5, H6, H7, H8. Research: `docs/polish-plan-final/arcade-retro-strategy-research.md`, `arcade-action-sports-research.md`, `bugs-research.md`. Every row is display only: no sim, hit box, deal, replay or stamp changes (the three stamps C1.6, C1.8 and C3.5 belong to session D5, not you).

The principle: restore the look, keep the rules. Where a row says "restore from 82f2f648", `git show 82f2f648:<file>` is the source. After each game: re-export its tile, re-run `bun scripts/reveal-palette.ts`, and for a Strategy game `bun scripts/shots/strategy-stills.ts <id>` and `bun scripts/strategy-art-data.ts`. G7: every run picture draws at the stage box's size through Fable's `RevealScreen` `views` prop (merged before you start).

Assertions this session expects to change (section K; Joe approves the exact lines in this session): K8 bastion-overhaul-check 217–233, K9 swing-overhaul-check 213 / 437 / 441–455, K10 ricochet-overhaul-check 510–523, K12 strategy-overhaul-check 299 / 302 / 305 and the "nothing else" rule.

Checks you own: each game's own check (retro-overhaul-check, snake-renderer-check, wavefront-ships-check, burst-renderer-performance-check, orbit-camera-check with a respawn case added, strategy-overhaul-check, bastion-overhaul-check, swing-overhaul-check, ricochet-overhaul-check, skyline-overhaul-check, flip-overhaul-check), arcade-fx-check (a new case: a shake never repaints a device layer), arcade-fill-check, arcade-play-check for every touched game (the frame-time baseline), arcade-lowend-check (Orbit), tile-scenes-check, reveal-palette-check, reveal-fold-check, room-16-check, room-extras-check, retro-summary-check. Report every check by name.

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
