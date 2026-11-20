# Session A1: the Word and Number games’ look, and the shared puzzle stage

You are an art build session for Joulz. You go **first** of the art sessions: you own the one shared rule that lights every puzzle's stage. You build the Word and Number tables of section 5 of `docs/polish-plan-final.md`, the frame paint of section 6, and rows G2 and G3 of `earlier-plan.md` (the Word and Number reveals' boards drawn at the reveal template's stage size).

The direction Joe picks in decision 2 of the plan sets the look (the plan recommends **Spotlight**: a lit stage in the category's deep colour, light matte pieces on board puzzles, deep boards where the game is about light, lit worlds, Retro dark with glow). Section 1.2 has the seven art rules; section 5 has one row per game saying what stays and what changes, and names the rows of `docs/polish-plan-final/earlier-plan.md` that are carried forward (kept, changed or dropped: section 5 wins where they differ). Studies to match: `direction/games/<game>-spotlight.webp` and the drawn ones `direction/games/<game>-drawn.webp`; today is `<game>-now.webp`.

Everything you do is display only: no sim, deal, hit box, replay, score or level changes. Piece sets are re-rendered by their own scripts under the same file names and inside the same byte budgets, so name, size and hash checks keep passing after the documented re-run. Today's game frame (the 60 px header, the timer, the goal line, the dock) keeps its geometry; the stage colour must fade to the page colour before the notch and home-bar strips (bottom-clearance-check's seam rule). Do not commit re-exported tiles, intro stills or the reveal palette: the final pass (F1) regenerates them all once.

Build:

1. **The stage for every puzzle category** (art rule 1): one rule in `src/polish-layout/game-frame.css` so the backdrop behind a board is its category's deep colour; goal text 19 px and status chips 15 px. This replaces earlier E0.1. A2 only overrides per game in its own folders.
2. **Word**: re-render the tile, disc, well, key and pip set in `scripts/word-art/word_art.py` (matte ivory bodies, a warm ledge, the tones in the Word table), ink dark navy, the keyboard relief on every Word game (earlier E2.4).
3. **Number**: ivory and enamel in place of brushed metal, Exact's white target plate, Counterweight's light oak and coloured kettlebells (E2.3 as changed), Checkout's fairground (E2.1), Ballpark's white ruler (E1.5 as changed), Kakuro's white cells; the dyed controls go (E0.4, the Number part).
4. **Outlines** (earlier E0.5): the shared accent ring (`src/styles.css:1628`) and the tray border (`game-frame.css:426`) are yours; so are the hairline frames of the Word and Number boards. A2 removes its own families' hairlines.

You own: `scripts/word-art/*`, `public/word-art/*`, `src/polish-word/*`, the Number art script and its output, `src/polish-number/*`, `src/polish-layout/{game-frame,puzzle-shared,readability,number-overhaul}.css` and `batch-w-*.css`, `src/styles.css` (that one rule), `src/components/puzzles/{LetterKeypad,WordReveal,HudPills}.tsx`, `src/components/puzzles/number/*`, the markup of the Word and Number boards in `src/puzzles/` where a class or attribute is needed, `scripts/shots/tile-scenes/{word,number}.tsx`. Do not touch levels, deals or graders (D1, D2), `GameFrame.tsx` (P4) or `RevealScreen.tsx` (P2).

Checks you own: word-overhaul-check, every number-overhaul-*-check, strikeout-check and letterwheel-check (legacy markup must not move), theme-check and no-wrap-check for the Word and Number screens, bottom-clearance-check, puzzle-surface-check, phone-gap-check, first-paint-check, design-lint-check. Your assertion rows: `assertions.md` Part 2A, Word and Number, and "Things that hold for every family".

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
