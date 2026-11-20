# Session P3: Compete, You, the Shop and the rated screens

You are a build session for Joulz. You build the Compete, You, Shop, Daily, Rated (VS and result), Settings and Terms rows of section 4 of `docs/polish-plan-final.md` and the "Other flows" of section 3.6. The pages keep today's esports style; you change structure, size and words. Mockups to match: `direction/pages/vs-e-phone.webp`, `vs-e-desktop.webp`, `result-e-phone.webp`, `profile-e-phone.webp`, `shop-e-phone.webp`. Facts about today: `direction/pages-flow-today.md`.

Build:

1. **Compete** (`src/routes/tournaments.tsx`): opens on the player's rating card and Find a match where rated play is on, then tournaments where they are on, then Leaderboards and the Daily top 100 as rows showing the player's place. The "Coming soon" page goes. Nothing here changes who may see rated play or tournaments.
2. **You** (`src/routes/profile.tsx`): Profile and More in one page: the player card, the rating with its bar, three stat tiles, rows for Friends, Challenges, Badges and trophies, Customise, Settings, Help and support. A guest sees one card and one calm "Save your progress" row.
3. **VS** (`src/components/rated/*`): full-bleed, each half lit in its player's colour, 124 px avatars, name, title, tier and rating, a champagne VS plate on a gold seam, the first game's tile and the stakes at the foot. Players are still drawn with the shared identity pieces (`PlayerCard`, `NameplateStrip`, `MiniCard`); hidden under-18s stay hidden. Timings unchanged.
4. **Rated result**: "You win!" at 62 px in gold, the score, the rating bar, the game rows, Next match as the gold action, Rematch and **Home**. Daily results gain **Home** too.
5. **Shop**: the bundle as an obsidian hero with its item stills large, item cards with the still filling the top half and the rarity as the name's colour. No "best value" or any pressure label. Nothing sells outside the Shop; the two tab-bar toasts become the Shop tab's dot.
6. **One name sheet**: a shared "Pick a name" sheet, pre-filled with a generated name, replaces the five name boxes (`/rooms`, `/daily`, link join, `/challenge`, Profile).
7. **Terms**: about 60 words and a link to the full text; on the Daily the page shows first and the terms come at the first Play tap. The wording is Joe's adviser's call: build the layout and ask Joe for the text.

You own: `src/routes/{tournaments,profile,shop,rated,daily,settings,terms,rooms}.tsx`, `src/components/{rated,identity,shop,tournaments,beta,account}/*`, their CSS and `scripts/screens/{rooms-rated,profile,shop,tournaments,settings-account}.ts`. Do not touch the tab bar, Home or Games (P1, P2), the rated engine, matchmaking or any server function.

Checks you own: rated-screens-check, rated-multi-check, identity-screens-check, identity-everywhere-check, player-strips-check, tournaments-screens-check, badges-screens-check, seasons-screens-check, cosmetics-screens-check, pass-screens-check, account-screens-check, beta-extras-check, theme-check and no-wrap-check for your screens. Your assertion rows: `assertions.md` Part 1, changes 9 (rated), 10 (You) and 11 (Shop).

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
