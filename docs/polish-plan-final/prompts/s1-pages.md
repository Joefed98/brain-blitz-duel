# Session S1: the UI pages (Home, splash, daily cards, Shop, Games, colours, avatars, the rail)

You are a normal build session for Joulz (repo Joefed98/brain-blitz-duel). You build section A of `docs/polish-plan-final.md` (rows A1–A13) and the two page rows of section B (B4, B5), as Joe decided on 20 Nov 2026. Research you must read first: `docs/polish-plan-final/ui-research.md`. The mockups are in `docs/polish-plan-final/mockups/` (open the review page's index.json for captions).

Joe's picks: **Splash U1a** without the two speed lines off the bolt and without the caption line under the wordmark (the bolt fills bottom to top with sparks, silent on a cold open, the spark sound on re-opens); **Home U6b's layout with U6a's daily cards** (the category colour sweep, the jigsaw bolt, a visible gold Play on both cards; sections reserved so nothing pops in, A2); **Colours U2b** (the token values in row A5, every contrast pair re-checked); **Shop U4a** (warm: obsidian and gold, rarity bands, the coin packs sparkling on gold leaf with a BEST VALUE frame); **Games U5a's chrome with three 4:5 tiles a row** (one control row, pill chips with the category dot, the level switch inside the hero); **Desktop Home U7b** (a dashboard of equal cards in three columns) **plus more rail tabs**: Home, Games, Tournaments, Shop, Challenges, Badges, Notifications, Friends, Leaderboards, Daily, Settings (B5; the phone keeps five tabs and More). Avatars lose their disc (A3); the showcase strip (A4); Tournaments coming-soon and the guest Profile (A12, A13). A10 (every tile re-exported) runs last, after S3–S5 merge; skip it if they haven't.

Order: A5 tokens first (everything else sits on them), then A2, A6/A7/A11 together (Home), A1, A8, A9, A3, A4, B4, B5, A12, A13.

Checks you own: theme-check and no-wrap-check for every screen you touch (add `scripts/screens/pages-polish.ts`), play-tab-shift-check (extend it to the `rated`, `week` and `friends` sections, an addition), nav-check, app-shell-check, reduced-motion-end-check (the sweeps and sparkles listed as effects), design-lint-check, brand-assets-check, identity-screens-check and identity-motion-check (A3 changes the approved avatar PNGs: show Joe the exact fixture change, K15), practice-switch-check, tile-scenes-check, desktop-geometry-check, desktop-layout-check. Report every check by name.

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
