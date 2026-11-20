# Session P1: navigation, Home and the splash

You are a build session for Joulz. You build sections 3.2 (navigation) and 3.3 (Home) of `docs/polish-plan-final.md`, the Launch / splash and Home rows of section 4, and the five navy token values of section 1.1. The pages keep today's esports style (navy-black, champagne gold, the angled cut on key elements): you change structure, size and words, not the look. Mockups to match: `docs/polish-plan-final/direction/pages/home-e-phone.webp`, `home-e-desktop.webp`, `first1-e-phone.webp`; today's screens are the `…-now-…` files beside them. Facts about today's code (every route, section, string and tap count): `docs/polish-plan-final/direction/pages-flow-today.md`.

Build:

1. **Tabs** (`src/design/components/TabBar.tsx` `TABS`, `AppTabBar`, `AppRail`): Home · Games · Compete · [Shop] · You. Ids stay (`play`, `practice`, `tournaments`, `shop`); `more` becomes `you` and points at `/profile`. `/more` and `/play` redirect (to `/profile` and `/`). The floating gold Play bar (`PlayBar`) is removed from Home and Games. The header avatar opens You for guests too (no sheet on tap). The rail lists Home, Games, Compete, Shop, Friends, Challenges, You, with Settings at the foot and a gold Play that starts what Home's hero starts.
2. **Home** (`src/routes/index.tsx`, `src/components/home/*`): header (avatar, name, tier and rating where rated, streak, coins) → hero → Daily Puzzle and Daily Arcade side by side, each with a visible Play or its Done score → Play friends (Create, Join) → Jump back in (tiles 112 × 136 or larger) → This week → Friends online. The hero is "Quick match" for rated players (its button starts the search) and "Play now" over the game of the day for everyone else (its button goes straight to that game's 3-2-1). Remove the IntroCard, "Your next match", the Ratings tiles and the "How it works" link from Home.
3. **No pop-in**: every Home section is reserved before paint (slot ids, the cached `duelz-play-cards:v1` record, fixed-height skeletons), as `earlier-plan.md` row A2 describes with its files and lines.
4. **Navy tokens** (`src/design/tokens.css` only, plus their mirrors): `--jz-bg #04060C`, `--jz-bg-raised #090D1A`, `--jz-surface #101A33`, `--jz-surface-2 #1C2A52`, `--jz-surface-3 #26376B`, `--jz-line #223058`, `--jz-navy #142454`, `--jz-navy-edge #2F4A94`. Gold, text and `--screen-edge` do not change. Row A5 of `earlier-plan.md` lists the mirrors.
5. **Splash**: row A1 of `earlier-plan.md` with Joe's pick (the bolt alone, no speed lines, no caption).

You own: `TabBar.tsx`, `AppTabBar.tsx`, `AppRail.tsx`, `PlayBar.tsx`, `AvatarButton.tsx`, `src/routes/{index,play,more}.tsx`, `src/components/home/*`, `src/components/nav/*`, `src/lib/playCards.ts`, `src/design/tokens.css` (those values only), `home-play.css`, `nav.css`. Do not touch game screens, the Games catalogue, Shop or Profile contents (P2 and P3).

Checks you own: nav-check, app-shell-check, play-tab-shift-check, theme-check and no-wrap-check for your screens (`scripts/screens/home-play.ts` and a nav area file), brand-assets-check, design-lint-check, reduced-motion-end-check, first-impressions-check, desktop-layout-check (the rail). Your assertion rows: `assertions.md` Part 1, changes 1 (navy), 3 (navigation) and 4 (Home).

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
