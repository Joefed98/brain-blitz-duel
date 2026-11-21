# Joulz: the design direction and polish plan

Fable, 20 Nov 2026 (the design-direction session), on main f3016234. This replaces the plan of 19–20 Nov, which is kept as `docs/polish-plan-final/earlier-plan.md` because many of its rows are carried forward by id. Review page: the link in Joe's report (a copy is `docs/polish-plan-final/review.html`). Mockups and before shots: `docs/polish-plan-final/direction/`.

## 0. The brief, as corrected

Joe's brief of 20 Nov, with his correction the same day:

1. **Joulz stays an esports-style app**: competitive, premium. Not a cartoon or casual redesign.
2. **The pages keep today's esports style** (Home, Games, Profile, Shop, tournaments, rated play, Settings). They are refined, not restyled. Their structure and flow are open: layout, what goes where, fewer words, the first-game journey.
3. **The games are where the look changes.** They have gone too dark, shiny and metallic. A little more vibrant: brighter, more colourful, more exciting, larger where it helps play, and still at home inside the esports frame. "Vivid game worlds inside a sleek competitive frame."
4. **About four game art directions**, each clearly different, shown on real screenshots of several games inside today's UI, with a recommendation.
5. Difficulty: every game's curve designed from scratch (`docs/polish-plan-final/difficulty-spec.md`).
6. Fixed: Normal stays exactly today's game; every Expert proven reachable at 200 under `HUMAN_LIMITS`; a deal or rule change needs a new stamp; the world is identical on phone and desktop; nothing bought helps anyone win; purchases live in the Shop only with no pop-ups or pressure; one identity everywhere; hidden under-18s stay hidden; retired games stay retired.

How this plan was made: every page and game was looked at on today's real app (the 232 contact sheets of the earlier session, plus 42 pages and 12 games re-shot at full resolution in this one); the page mockups are HTML at 390 × 844 and 1440 × 900 using the app's own art; the game directions are today's real screenshots with the game area re-treated and today's header left untouched.

## 1. The direction

### 1.1 Pages: "Esports, refined"

Keep: the navy-black page, champagne gold as the one action colour, the angled cut on the key elements (the main button, hero cards, the player card), Archivo, thin lines, the 3D art kit, cyan for live, the nameplates and cards.

The whole kit is on one board for the build sessions, `direction/pages/kit-board.webp`: the navy frame, the gold metal for actions only, the type scale, the cut corner for heroes only, the eleven family colours, the four level marks, tiles, nameplates, the lit game stage and six rules (one gold button a screen; one hero a page; colour means a family, a level, a win or a loss; numbers are the display type; fewer words; dark frame, bright game). Room and game screens in the same kit: `frame-spotlight-phone`, `frame-neon-phone`, `intro-e-phone`, `reveal-e-phone`, `lobby-e-phone`, `podium-e-phone`, `daily-e-phone`, `event-e-phone` (a live tournament), `leaderboard-e-phone`, `pass-e-phone`, `customise-e-phone`, `friends-e-phone`, `settings-e-phone`, `play-e-desktop`, `levels-e-desktop`. The four main journeys and the pages around them are on one sheet, `flow-board.webp`, with the taps each step takes.

Refine (what changes on every page):

- **One job per screen, one gold button.** Each page opens on a hero that says what to do next; everything else is quieter.
- **Larger.** Hero titles 30–34 px, section headings 21 px, no label under 15 px on a tab page, primary buttons 56 px (68 px on a hero), game tiles 132 × 164 on a phone (today about 104).
- **Colour arrives as light, not paint.** Feature cards stay obsidian navy and take their category or mode colour as an edge light and a corner glow (Daily Puzzle violet, Daily Arcade cyan, friends green). That gives the pages colour without leaving the esports look.
- **The navy from the earlier round stays picked** (U2b: `--jz-bg #04060C`, `--jz-surface #101A33`, `--jz-surface-2 #1C2A52`, `--jz-surface-3 #26376B`, `--jz-line #223058`), so panels separate from the page. Gold, text and `--screen-edge` do not change.
- **Fewer words.** A page budget of 40 words of body text (Terms and Help apart); see 3.5.

**The navy change, checked on the real app** (fact-check pass): Home, Games and the Shop were re-shot with only those eight token values changed (`direction/pages/home-now-phone.webp` beside `home-navy-phone.webp`, and the same for `games` and `shop`). The pictures differ by an average of 1 to 7 levels in 255 per colour channel, most of it in blue; mean brightness rises by 1 to 2 levels. It reads as today's style with panels that separate from the page a little better, not as a restyle, so the change stays in P1. It is small: if Joe would rather not spend five assertion rows on it, dropping it costs nothing else in the plan.

Alternatives on the review page, same layouts: **F "Esports, colour-charged"** (the same style with the hero and feature cards carrying full colour) and **A "Bright Spark"** (the royal-blue, bolt-yellow, rounded redesign made before the correction; kept as the bold option). **Recommendation: E.** F is the fallback if E reads too quiet on a phone; A is a different product.

**More layouts for Home, Compete and You** (added at Joe's request on the fact-check pass; `direction/pages/home2…`, `home3…`, `compete1…3`, `profile2…3`), each drawn in the esports style and in a second colourway:

| Page | Layout | The idea | Recommended |
|---|---|---|---|
| Home | **H1 Hero** (`home-e-phone`) | One hero, one gold button, then the Dailies, friends and recent games | **Yes, for launch**: it works for every player, rated or not |
| Home | **H2 Match day** (`home2-…`) | A live strip, your player banner with rating and tier bar, a full-width Find a match, then today as a timeline | The best competitive feel; right once rated play is open to everyone |
| Home | **H3 Deck** (`home3-…`) | A console-style grid of mode tiles with corner brackets, a Continue strip, friends online | No: five equal tiles and no single next step |
| Compete | **C1 Ladder** (`compete1-…`) | Your tier and rating as the hero, Find a match, then the boards as tabs with your row pinned | **Yes**: never empty, even with tournaments off |
| Compete | **C2 Fixtures** (`compete2-…`) | A live event card, today's fixtures as a timeline, the top three, your rating as a strip | Later, when tournaments are open to everyone |
| Compete | **C3 Season** (`compete3-…`) | The season banner, the tier ladder with you on it, rivals either side of you | Later, when a season has dates |
| You | **Y1 Rows** (`profile-e-phone`) | The card, the rating, three stats, rows | Sound, plain |
| You | **Y2 Card first** (`profile2-…`) | The player card large, strongest categories as bars, recent form, four quick tiles | **Yes**: the page is about identity, and the card is the identity |
| You | **Y3 Career** (`profile3-…`) | Ring gauges, a trophy shelf, recent matches | No: more stats than a profile needs |

Joe's answers of 20 Nov (section 2.1) combine these: Home is H1 with H2's banner and Jump back in (`home-mixed-phone`); Compete is C1 reordered with C2's fixtures (`compete-mixed-phone`); You is Y2 with Y3's gauges and trophy shelf (`you-mixed-phone`). The mixed mockups are what P1 and P3 build.

Colourways tried on those layouts: **champagne** (today's, look E), **Ion** (navy with electric cyan as the accent) and **Ember** (carbon with a magenta-to-orange accent). Gold stays the one action colour in all three. **Recommendation: champagne.** Ion is the nearest sibling (cyan is already Joulz's colour for live and positive) and would be the one to try if Joe wants a cooler look; Ember is a different brand.

### 1.2 Games: four directions

Each was mocked on the same seven real screenshots (Forage, Box Six, Pipeline, Gemstone, Breaker, Top Bins, Summit) with today's header untouched. They are fast studies made by re-treating the real picture, to choose a direction; the build draws each game properly.

| | Name | The idea in one line | For | Against |
|---|---|---|---|---|
| 1 | **Floodlit** | Same games, lights on: every near-black stage becomes its category's deep colour, colours a quarter stronger, chrome turned to satin colour | Works on all 83 games; the smallest build; sits naturally in the frame | Pieces stay dark-bodied, so puzzles change least where they need it most |
| 2 | **Neon Arena** | Keep the dark; make every piece glow | The most "esports"; superb on Retro and on Pipeline | Still dark, and glow is another kind of shiny; tiring on reading puzzles |
| 3 | **Two-Tone Worlds** | Each world floods with a bold two-colour gradient | The most colourful | Fights the frame; boards lose contrast; reads casual |
| 4 | **Spotlight** | Floodlit's lit stage, plus light matte pieces on the board puzzles: a bright table in a dark arena | The biggest gain where the complaint is (black tiles, chrome pipes, brushed metal); the formula chess.com uses (a bright board in a dark frame) and the one Joulz's own card and sports games already use | The largest art job: each puzzle family's piece set is re-rendered |

**Recommendation: 4, Spotlight**, with two standing exceptions that are part of it: the Retro group keeps its dark screen and takes direction 2's glow (neon is what Retro is), and games that are about light or colour on dark (Lamplighter, Lightbender, Chroma Lines) keep a deep-coloured board. Arcade worlds, sports and cards have no dark pieces to flip, so under Spotlight they get exactly Floodlit's treatment. If Joe wants the lighter touch, **1 Floodlit** is the same plan without the new piece sets and can ship first: Spotlight is Floodlit plus one more step, so nothing is wasted.

The five "drawn" studies on the review page (Forage, Box Six, Exact, Chroma Lines, Gemstone under today's real header) show Spotlight drawn rather than filtered.

**The art rules that follow from Spotlight** (for every game session):

1. **The stage.** Behind every board the backdrop is the category's deep colour, never near-black: about a third of the category colour over navy at the top, falling to about a tenth at the foot. The header, the dock buttons and the page chrome stay today's.
2. **Pieces on board puzzles are light and matte**: ivory or white bodies with a darker ledge, dark navy ink, one soft top light, short shadows. State colours: selected is the category colour, correct is green, the special piece is champagne gold. No chrome, no black lacquer, no brushed metal, no white glare spots.
3. **Deep boards where the game needs them** (light, beams, coloured lines): the board is the category's deep colour, pieces saturated with a soft glow.
4. **Worlds** (arcade, sports, cards): keep the world; lift blacks to deep colour, colours about a quarter stronger, skies and felts in colour, materials satin.
5. **Retro** stays a dark screen: flat pixel pieces with a glow, saturation up, no 3D shading.
6. **Larger where it helps play**: pieces use the free height, no HUD text under 13 px on a phone (Retro's 11 px pixel floor stays), cards and discs grow to fill their tables. Hit boxes never change for looks (rule 3 of the house rules: art within 2 px of the collision bounds).
7. **Display only.** No sim, deal, hit box, replay or score changes in an art session. The piece sets are re-rendered under the same file names by their own scripts, so the checks that pin names and sizes keep passing.


The recommended direction is also shown on seven more real screenshots (`direction/games/<id>-now.webp` beside `<id>-spotlight.webp` for Ascend, Strikeout, Exact, Polypotions, Iron Wall, Chroma Lines and Hover), so nine of the eleven families have a real before and after. Chroma Lines and Hover are there as the two exceptions: a light-on-dark board that keeps its deep board, and a Retro game that stays neon. They are filters on the real picture, made by `direction/source/directions-more.py`; the build redraws each game.

### 1.3 Motion (pages and games)

Today's motion rules stand (reduced motion ends visible; transform and opacity only). Added: the hero button gets one slow sheen every six seconds; lists arrive staggered 40 ms a row; a win counts its numbers up and fires the existing celebration kit; the VS screen's two halves slide in from their own sides and the badge lands with the existing GO strike. Nothing new moves during play.

## 2. Decisions for Joe

Each has a recommendation he can say yes to. **Joe answered on 20 Nov 2026; section 2.1 records every answer.** Where an answer changes a recommendation in this table, section 2.1 is what the sessions build.

| # | Decision | Recommendation |
|---|---|---|
| 1 | Page look: E "Esports, refined", F "colour-charged" or A "Bright Spark" | **E** |
| 2 | Game art direction: Floodlit, Neon Arena, Two-Tone Worlds or Spotlight | **Spotlight** (Retro on Neon; Floodlit first if a smaller first step is wanted) |
| 3 | Navigation: five tabs Home · Games · Compete · Shop · You with Home's hero as the play action (N1), or four tabs round a centre Play button (N2) | **N1.** The floating gold Play bar goes; "More" becomes "You" |
| 4 | A new phone's first open goes straight into a first game (Ascend on Easy, the first tap is the game's first tap), then a win screen, then Home | **Yes.** It replaces the three text screens waiting behind `FIRST_OPEN_ONBOARDING` |
| 5 | Games page: category shelves (G1) or the three-across grid picked on 20 Nov (G2) | **G1 shelves** on a phone (larger tiles, every category on the first screen); the grid stays as each category's "All" page |
| 6 | The level picker leaves the catalogue and lives on each game's page; the "Difficulty levels" explainer goes | **Yes** |
| 7 | Round intro: demo, one-line goal and Ready; How and Score move behind "?" (rooms and the Daily keep the Ready tap) | **Yes** |
| 8 | Ratings tiles leave Home (the hero shows the rating; all three ratings live on You). This reverses the 14 Nov choice to show them on both | **Yes** |
| 9 | Beta terms cut to about 60 words with a link to the full text, shown at the first Play tap on the Daily rather than before the page. Legal wording is the adviser's call | **Yes, subject to the adviser** |
| 10 | Difficulty: the five items in `difficulty-spec.md` "Decisions for Joe" (a Hard you can see for Counterweight, Brimful, Checkout and Kakuro; Iron Wall's four-lane Expert; level-deal scoring fixes so 200 is reachable; proof tools first; Minefield's Expert back to 10 × 16) | **Yes to all five** |
| 11 | "Best value" on coin packs (in the earlier plan's shop mockup) | **Drop it.** The style guide's own rule is no pressure labels |
| 12 | The avatars' backing disc (earlier A3) and a Blender redraw of the avatars | **Leave both.** The rounded-square avatar in the new header and VS screens makes the disc a non-issue |
| 13 | Earlier "go back" items | **Judged one by one in section 5**, not reverted wholesale: most become "re-render in the new material" instead of "restore the old file" |
| 14 | Home layout: H1 Hero, H2 Match day or H3 Deck | **H1** now; H2 when rated play is open to everyone |
| 15 | Compete layout: C1 Ladder, C2 Fixtures or C3 Season | **C1** now; C2 and C3 as tournaments and seasons open |
| 16 | You layout: Y1 Rows, Y2 Card first or Y3 Career | **Y2** |
| 17 | Accent colourway: champagne, Ion or Ember | **Champagne** |
| 18 | The level picker on a game's page: L1 Ladder (all four levels with a picture of what changes) or L2 Preview (one level large). The step-up card on the reveal comes with either (section 6.1) | **L1** |
| 19 | Nucleus and Forage on Expert: the modelled best player cannot reach 200 (best 160 to 191; 184 on Nucleus's Normal). Change the points line on level deals, or accept a typed-out perfect run as the proof | **Change the scoring on level deals** (a new stamp; Normal untouched) |
| 20 | Breaker: a lost ball costs only a 3-second relaunch, so even measured with a bot that feels paddle width Hard sits just 14 under Normal. Make a lost ball cost a life or time on Hard and Expert deals | **Yes** |
| 21 | Gemstone: ice at any count leaves Expert level with Hard; colours are the only setting that moves an average player (163, 95, 72 on 5, 6, 7 colours). An eighth gem for Expert (sim code and one new gem) | **Yes**: the ladder is 5, 6, 7, 8 colours |

### 2.1 Joe's answers, 20 Nov 2026

The numbers are the review page's (its Decide section had 24 questions).

**Agreed as recommended**

| # | Decision | Answer |
|---|---|---|
| 2 | Game art direction | **Spotlight**, with Retro on Neon's glow and the light-on-dark games keeping a deep board ("your drawn versions look really good") |
| 3 | Navigation | **N1**: Home · Games · Compete · Shop · You |
| 4 | A new phone opens straight into a game | **Yes**; the first game is **Ascend on Easy** (Joe's pick, 20 Nov) |
| 6 | The level picker lives on each game's page only | **Yes** |
| 7 | Round intro: demo, one-line goal, Ready | **Yes** |
| 9 | Beta terms at about 60 words and a link | **Yes, subject to Joe's adviser** |
| 10 | A Hard you can see for Counterweight, Brimful, Checkout and Kakuro | **Yes** |
| 11 | Iron Wall's four lanes | **Yes** |
| 12 | Scoring on level deals so 200 is reachable | **Yes** (and see addition 10: on Normal too) |
| 13 | Every difficulty session builds its proof first | **Yes** |
| 14 | Minefield's Expert back to 10 × 16 | **Yes, with 40 mines**, as the spec now says |
| 15 | Drop "best value" | **Yes** |
| 16 | Leave the avatars and their disc | **Yes** |
| 21 | Nucleus and Forage on Expert | **Change the scoring** so a real top player can reach 200 |
| 22 | Breaker: a lost ball costs more on Hard and Expert | **Yes** |
| 23 | Gemstone: an eighth gem for Expert | **Yes** |
| 24 | Accent | **Champagne** |

**Changed or mixed**

| # | Decision | Joe's answer |
|---|---|---|
| 1 | Page look | **E**, with my rating front and centre on Home |
| 17 | Home layout | **H1 and H2 combined, nothing shown twice** (mockups `home-mixed-phone`, `home-mixed-unplaced-phone`, `home-mixed-open-phone`, `home-mixed-desktop`): H1's top line (avatar, name, streak, coins; no rating there); then H2's player banner (rating large, "+22 this week", tier and the bar to the next tier, gold Find a match; no streak or coins in the banner); then H1's middle (Daily Puzzle and Daily Arcade side by side, Play friends with Create and Join); then H2's bottom (Jump back in). Until rated play is on for a player the banner is "Play now" over the game of the day; once it is open to them but they are unplaced it is "Play 5 placement matches to get your rating" |
| 8 | Ratings on Home | The three tiles go. The main rating is in the banner; the other two ratings show as small chips under it; tapping one opens Compete |
| 18 | Compete layout | **C1's layout, reordered** (`compete-mixed-phone`). Compete is about ranked play and tournaments: rating, tier and Find a match first; then tournaments (C2's live event card and upcoming fixtures); then leaderboards lower down as tabs, with the Daily top 100 as one tab and nothing more prominent |
| 19 | You layout | **Y2**, with Y3's three ring gauges in place of the three stat tiles and Y3's trophy shelf as one row under the card (`you-mixed-phone`) |
| 20 | Level picker on a game's page | **L1 and L2 combined** (`gamepage-mixed-phone`): the page opens on my current level, shown large (from L2); all four levels sit underneath as a compact row to tap, each with its small picture, my best and my star (from L1); it remembers the last level I played on each game; Challenges and How to play are two small buttons |
| 5 | Games page | **G1 shelves (bigger tiles) by default, plus one switch to "All"**: every game in the three-across grid (G2), grouped by category. The page remembers the last view (`games-mixed-phone`, `games-mixed-all-phone`) |
| 4 | The first game | Straight into a game, yes. **Ascend on Easy** (Joe's pick of the three candidates, 20 Nov) |

**Additions**

| # | Addition | Where it is built |
|---|---|---|
| 9 | The three stamps approved on 20 Nov come back: Moon Climb's smaller ninja (C3.5, `ricoRev 5`), Fission's smaller atoms (C1.8, `burstRev 14`), Wavefront's wider formation (C1.6, `wavRev 16`), with their assertion rows (K10's rev-5 parts, K11) and their demo re-records | D5; the demos in F1's list |
| 10 | The scoring review's seven approved fixes are built on Normal too, each under a new stamp, with Normal's caps for Flash, Bonk and Pull! (section 8.2). "Normal stays today's game" meant the difficulty levels do not change Normal, not that approved scoring fixes are banned. I6 and I9 stay "leave it" | The difficulty session that owns each game |
| 11 | The desktop rail also gets Badges, Notifications, Leaderboards and the Daily | P1 (it owns the rail) |
| 12 | Keyboard controls in every game on a computer, shown on the intro | P4 (the mapping), P2 (the intro's key line) |
| 13 | Grappler and Curl Champ: D5 and D6 each propose a working lever to Joe before building those two | D5, D6 |
| 14b | Pipeline, Chroma Lines, Topsy-Turvy and Ballpark, shown three ways on the review page (old at 82f2f648, today, Spotlight). **Joe's picks, 20 Nov: the old look for all four.** Pipeline: the old look, with the bigger pipes. Chroma Lines: the old look ("I don't like the new circles; the old ones are much better"). Topsy-Turvy: the old look ("I don't like the new circle designs"). Ballpark: the old look. Each is restored as the earlier plan's E1 row describes, keeps today's rules, levels, effects and every `data-*` attribute, and sits on the new lit stage | E1.5 Ballpark by A1; E1.2 Topsy-Turvy, E1.3 Chroma Lines, E1.4 Pipeline by A2 |

**Joe's picks and approval, 20 Nov 2026 (later the same day)**

| Pick | Joe's answer |
|---|---|
| The first game on a new phone | **Ascend on Easy** |
| Pipeline | **The old look, with the bigger pipes**: the old SVG pipes and lit network (E1.4), drawn at today's tile and pipe size |
| Chroma Lines | **The old look** (E1.3), old dots included: "I don't like the new circles; the old ones are much better" |
| Topsy-Turvy | **The old look** (E1.2): "I don't like the new circle designs" |
| Ballpark | **The old look** (E1.5) |
| `scripts/skyline-overhaul-check.ts:728` | Approved on 20 Nov exactly as shown (the room order score, picture, chart, summary, breakdown(folded)). **It no longer applies** (21 Nov, below): the line is back to main's text with the template's code, and P2 shows Joe the line again |

For the four looks, A1 and A2 restore the old look as the earlier plan's E1 rows describe. They keep today's rules, levels, effects and every `data-*` attribute, and the boards sit on the new lit stage (art rule 1). Their assertion rows are back in `assertions.md`.

**Joe's decision of 21 Nov 2026: the reveal template comes off this branch and goes to P2.**

What was found. The Checks run on the head that carried the approved line (`3f63fde5`) failed on one check, `swing-overhaul-check` (two lines, 672 and 673: the template had dropped the reveal column's `px-3` and the Grappler picture wrapper's `mt-2`). Measuring the Grappler reveal in a real browser to prove the new width (343 px at 375, 358 px at 390: viewport − 2 × (4 + 12)) showed something no check catches: the template's stage was a fixed-height box with `overflow: hidden` on a column that no longer scrolled, so **the run picture was cut off on phones** (`direction/pages/reveal-cut-375x667.webp`). Practice reveals, measured:

| Game | Hidden at 375 × 667 | Hidden at 390 × 844 |
|---|---|---|
| Crazy Golf | 531 px | 443 px |
| Iron Wall | 269 px | 141 px |
| Free Cell | 245 px | 129 px |
| Grappler | 182 px | 50 px |
| Orbit | 178 px | 67 px |
| Moon Climb | 169 px | 23 px |
| Apex | 129 px | none |
| High Rise | 31 px | none |
| Roofbound | 30 px | none |
| Meteor, Hover, Gemstone, Tilt, Coral Pop | none | none |

Two more things broke, found by running the five browser checks that judge the reveal once each: `celebrations-check` (its recorded `reveal150` markup no longer matched, `scripts/celebrations-browser.ts:304`) and the Crazy Golf reveal screen that theme-check and no-wrap-check draw (`scripts/screens/crazy-golf.ts:39`: its tap timed out at every size, because a room's reveal opened on the Room view and the scorecard was in the hidden "Your run" view). `room-16-check`, `room-extras-check` and every other reveal screen in theme-check (204 draws) and no-wrap-check (245) passed; the other 47 browser checks were read, not run.

What Joe decided (Option 1 of three):

- **The template's code is off this branch**, in one commit: `AnswerReveal.tsx`, `ArcadeReveal.tsx`, `reveal-screen.css` and `scripts/skyline-overhaul-check.ts` are back to main's text (so the approval of line 728 no longer applies), and `RevealScreen.tsx` and `scripts/screens/reveals.ts` are removed. The three `swing-overhaul-check` lines Joe had approved on 21 Nov are **not applied**. Apex's steering fix and the Cabinet skeleton stay exactly as they were; no Cabinet file carried template code.
- **P2 builds the template as its first job**, starting from commits `86fe22258` and `2cbba0c5e`, with this fix list: (a) the stage never cuts a run picture at any phone size (the picture fits the box, or the slot scrolls), proved in a real browser on all 14 games above at 375 × 667 and 390 × 844 with none hidden; (b) the `reveal150` entry in `celebrations-off.json` re-recorded, with Joe's approval in that session; (c) the Crazy Golf screen taps "Your run" first, with Joe's approval; (d) the room screens named "with the run summary" or "the overhaul's picture" still look at the picture; (e) the `swing-overhaul-check` and `skyline-overhaul-check` lines shown to Joe there, with the real measured widths.
- **A1, A2 and A3 build their reveal rows (G2 to G7) only after P2's template has merged.** The rest of their art does not wait. P2 opens the template as its own first pull request so the art train is not held by the rest of P2.

**Still open with Joe**: Grappler's and Curl Champ's levers (D5 and D6 propose first), and the keys for the five pointer games (P4 proposes them).

Where I disagree with something Joe asked for:

- **"Larger" cannot mean larger hit boxes.** Art must sit within 2 px of the collision bounds, so a bigger ball or ship is a new stamp with a re-proved deal. Larger here means the board fills its space, bigger type, bigger cards. The difficulty spec uses real size changes where they are the lever (Breaker's paddle, Hover's gaps), under level stamps.
- **Not every game should get brighter pieces.** Retro is neon on black by genre, and Lamplighter, Lightbender and Chroma Lines are games about light on dark. Forcing them light would make them worse.
- **Joe's earlier picks I would now change**: ratings on Home (decision 8), the three-across grid on a phone (decision 5), the avatar disc removal (decision 12). Each is his to keep.

## 3. Pages and flow

Facts about today are from `docs/polish-plan-final/direction/pages-flow-today.md` (every route, switch, string and tap count, read from the code in this session).

### 3.1 What is wrong with the flow today

- The **Tournaments tab is a dead end** for everyone but testers (one "Coming soon" panel), and **More is a drawer**: Profile, Friends, Leaderboards, Challenges, Daily, Plus, Settings and Support with no order.
- A guest's **avatar opens a sign-up sheet**, so the only way to a guest's Profile is More.
- **Joining with a code is three levels down** (Play bar, Rooms, code) while the Daily has five entrances.
- The **first-time card describes rooms** but its button starts practice; a solo newcomer who follows the words reaches a lobby that cannot start alone.
- **The round intro averages 59 game words** (Cue Ball 113) and is shown, with a Ready tap, before every one of a Daily's six rounds. The game page then repeats Goal and How.
- **Daily results and the rated result have no way home.**
- "How it works" appears three times; difficulty is set in two places; name entry exists in five.
- Home's "Your next match" heading sits over a practice suggestion; its rated, weekly and friends sections pop in late (earlier A2).

### 3.2 Navigation

| Today | New | Why |
|---|---|---|
| Tabs Home · Games · Tournaments · [Shop] · More | **Home · Games · Compete · [Shop] · You** (ids unchanged: `play`, `practice`, `tournaments`, `shop`, and `more` becomes `you`) | Every tab has something to do for every player |
| Gold Play bar floating on Home and Games, leading to `/play` | **Gone.** Home's hero is the play action; Games' tiles are | One fewer screen on every path; nothing floats over content |
| `/play` hub (one action and four mode rows) | **Folded into Home**: the hero (Quick match, or Play now), the two Dailies, Play friends | The hub repeated Home |
| Tournaments tab | **Compete**: your rating and Find a match (where rated is on), tournaments (where on), Leaderboards, the Daily top 100, tiers | Leaderboards and the Daily board are open to all, so the tab is never empty |
| More | **You**: the card, rating, three stats, Friends, Challenges, Badges and trophies, Customise, Settings, Help and support | Profile and More were two halves of one page |
| Avatar: account to Profile, guest to a sign-up sheet | **Always opens You.** A guest's You page carries one calm "Save your progress" row | The sheet on tap was a small pressure pop-up |
| Rail on a computer: the five tabs | Home, Games, Compete, Shop, Friends, Challenges, You, then Settings at the foot; gold Play at the top starts what Home's hero starts | Room for the second level; matches the 20 Nov pick |

Routes that go: `/more` (its file stays and redirects to `/profile`), `/play` (stays and redirects to `/`). Routes that stay as they are: everything else.

### 3.3 Home

Joe's answer of 20 Nov combines H1 and H2 (mockups `home-mixed-phone`, `home-mixed-unplaced-phone`, `home-mixed-open-phone`, `home-mixed-desktop`). Order, phone:

1. **The top line** (H1's): avatar, name, streak, coins. No rating here.
2. **The player banner** (H2's), the page's one hero and its one gold button. It has three states:
   - **Placed**: the tier, the rating large, the bar to the next tier, "+22 this week", gold **Find a match**. No streak or coins in the banner.
   - **Rated play open to the player, not yet placed**: "Play 5 placement matches to get your rating", five pips, gold Find a match.
   - **Rated play not on for the player** (everyone but the testers today): "Play now" over the game of the day, gold Play that goes straight to its 3-2-1.
3. **The other two ratings** as two small chips under the banner (Puzzles, Arcade), for placed players only. Tapping either opens Compete. The three Ratings tiles are gone.
4. **Daily Puzzle and Daily Arcade** side by side (H1's middle), each with a visible Play or its score once played.
5. **Play friends** with Create and Join: one tap each (today two and three).
6. **Jump back in** (H2's bottom): the last four games as tiles.

- Nothing is shown twice: the rating is in the banner only, streak and coins in the top line only.
- Gone from Home: the IntroCard, "Your next match", the Ratings tiles, "How it works" (it moves to You → Help), the Play bar, H2's live strip and Today timeline (Compete carries what is live).
- Every section is reserved before paint (earlier A2 stands: slot ids, the cached record, fixed-height skeletons), so nothing pops in. The banner's three states share one height.

### 3.4 The first open

| | Today | New |
|---|---|---|
| Screens before the first tap inside a game | Home, loading, the full intro (Goal, How, Score, Ready) or the game page | **None.** Splash, then the first game's board with one coach line |
| Taps before the first tap inside a game | 2 | **0** (the first tap is "1" on the board; it also starts the clock and unlocks sound) |
| The first game | Gridlock at Normal (a 120 s puzzle) | **Ascend on Easy** (Joe's pick of the three below, 20 Nov): tap 1 to 16 in order, about 20 s, nothing to read |
| First result | The standard reveal | A win screen: the score, the first star, "248 to collect", then **Play again**, **Try another game**, and for rated players **Play a real opponent**; "No account needed" |
| Then | – | Home, with the intro card gone for good |

The three candidates (Joe, 20 Nov: "propose two or three, each with one line on why"). All three are understood without reading and are a likely win inside a minute; the averages are the average player's, measured on 20 Nov.

| Candidate | Why | Easy, average player |
|---|---|---|
| **Ascend, Easy** (Joe's pick) | Tap 1 to 16 in order. There is nothing to explain, the first tap is the game's first tap, and it is over in about 20 seconds | 171 |
| **Colour Flood, Easy** | Tap a colour and the board floods with it. One rule, big moves, and the highest Easy average of any game measured | 195 |
| **Polypotions, Easy** | Pour to sort the colours. Most people have seen the idea, six flasks take well under a minute, and the finish is satisfying | 180 |

Rules: only on a device with no play history and only online (offline goes to Home); never on a room, Daily, challenge or `?game=` link (those go where they point) and never under automation; no terms, name or account on this path (practice needs none today). One switch, `FIRST_GAME_ON_OPEN`, replaces `FIRST_OPEN_ONBOARDING`; off by default until Joe has played it.

### 3.5 Words

| Screen | Today (words) | Budget | How |
|---|---|---|---|
| Round intro | 59 game words average, 39–113 | **15** | The demo box, the goal (8 words), one how line, Ready. How and Score are in "?" |
| Game page | 90–130 | **40** | Art, name, one-line goal, the level steps with each level's lever in numbers, Play; challenges as a row count |
| Help sheet | 252 average, Orbit 555 | **120** | Goal, three how lines, the score list; drop history and repeated numbers |
| Home, new guest | 60–85 | **25** | The hero and cards carry it; the intro card goes |
| Beta terms | about 150 | **60** | Six sections become three lines and a link (adviser's wording) |
| Profile, new guest | 85 | **30** | One card, one row |
| Tournaments, coming soon | 21 | 0 | The tab is Compete; nothing is "coming soon" |

One explanation of the app ("How it works", three panels) lives in You → Help. The seventeen longest strings are listed with file and line in `pages-flow-today.md` section 5; the Pages session cuts each to a line.

### 3.6 Other flows

- **Practice**: Home hero or a tile → the game page → Play → 3-2-1 → game → reveal. Play again deals at once (as today). The reveal gains "Try Hard" (the next level up) once a star is earned, and "Games".
- **The Daily**: Home card → the Daily page (visible before the terms) → Play (terms once, a name once: a generated name is pre-filled, one tap) → round 1. Ready is kept before each round; the intro is the short one. Results gain **Home**.
- **A friend's room link**: unchanged in steps; the join screen shows who is in the room as nameplates, and the name box is pre-filled.
- **Rated**: Home hero → searching → VS → the room. The result gains **Home**; Next match stays the gold action.
- **Name entry**: one shared "Pick a name" sheet (pre-filled with a generated name) replaces the five separate boxes.
- **Money**: unchanged in rule. The two tab-bar toasts (pass level, shop back) become dots on the Shop tab only; no sheet opens on a tap of the avatar. Nothing sells outside the Shop.

## 4. Page by page

Mockups are in `direction/pages/` as `<page>-<e|f|a>-<phone|desktop>.webp` beside `<page>-now-…`. Size: S under half a day, M a day, L two or three. Sessions are in section 11.

| Page | Stays | Changes | Why | Mockup | Size |
|---|---|---|---|---|---|
| Launch / splash | The bolt and wordmark; `--jz-bg` | The vector bolt at 160 px charging bottom to top (earlier A1, Joe's U1a pick: no speed lines, no caption); at least 0.9 s then a 200 ms fade; silent on a cold open | Today it is gone at hydration and jumps from the iOS launch image | `first1-e-phone` | M |
| First open | – | Section 3.4; the first game is Ascend on Easy (Joe's pick) | A first win inside seconds | `first1-e`, `first2-e`, `first3-e` | M |
| Home | The art kit, the Daily art, the header's counters | Section 3.3 (Joe's mix of H1 and H2): top line, the player banner in three states, two rating chips, Dailies side by side, Play friends, Jump back in; every section reserved | The rating front and centre; one tap to play; nothing twice | `home-mixed-phone`, `home-mixed-unplaced-phone`, `home-mixed-open-phone`, `home-mixed-desktop` | L |
| Games | Tiles' art, stars, search, game of the day | One switch, **Shelves · All**, remembered on the device. Shelves (the default): the game-of-the-day hero, then a shelf per family of 132 × 164 tiles with "All n". All: every game in the three-across grid, grouped by family. No level switch or explainer here | Five rows of controls before a game today; larger tiles; one tap to see everything | `games-mixed-phone`, `games-mixed-all-phone`, `games-e-desktop` | M |
| Game page | Art, name, best, challenges | Joe's mix of L1 and L2: the page opens on the player's current level shown large (its picture, its lever in words, their best and star); the four levels sit under it as a compact row to tap, each with its small picture, best and star; the last level played is remembered per game; one large gold Play; "How to play" and "Challenges 1 / 3" as two small buttons | The level is chosen where it is played; 40 words | `gamepage-mixed-phone`, `levels-e-desktop` | M |
| Challenges | The tabs and rows | Reached from You and the rail; rows gain the game's tile | A home that is not More | – | S |
| Compete (was Tournaments) | The hub's Upcoming and Your results, event pages, podium, rules | Joe's order: your rating, tier and Find a match first (where rated is on); then tournaments (a live event card, then upcoming fixtures); then leaderboards lower down as tabs (Rating, Puzzles, Arcade, Daily 100) with your row pinned. Nothing is more prominent than ranked play and tournaments | Never a dead end; about ranked play and tournaments | `compete-mixed-phone`, `event-e-phone`, `leaderboard-e-phone` | M |
| Leaderboards, Daily board | As built (nameplates, podium, picker) | Reached from Compete | – | – | S |
| Daily | The hero cards and your line | The page shows before the terms; results gain Home; the name box becomes the shared sheet | Look before you agree; a way home | – | S |
| Rated: searching, VS | The data and timings; each player's full `PlayerCard` in their half | **VS**: full-bleed, each half lit in its player's colour, the card drawn large (its avatar about 124 px), the tier and rating, a champagne VS plate on a gold seam, the first game's tile and the stakes at the foot | Today it is two small cards and a third of a screen of nothing | `vs-e-phone`, `vs-e-desktop` | M |
| Rated: result | The rating panel, game rows, Joules, Next match, the title text "You win" | The title at 62 px in gold, the score under it, the rating bar, Home beside Rematch | The win should feel won; a way home | `result-e-phone` (the mockup's exclamation mark is not built), `result-e-desktop` | M |
| You (Profile + More) | The player card, Customise, badges, the season section | One page (Joe's mix of Y2 and Y3): the card large with Customise; the trophy shelf as one row under it; three ring gauges (rated wins, stars, Daily streak) in place of stat tiles; strongest categories; rows for Friends, Challenges, Badges, Help; Settings in the header | One home for the player | `you-mixed-phone`, `profile-e-desktop` | M |
| Friends, Customise, Card, Badges | As built | Reached from You | – | – | S |
| Shop, Pass, Plus | The parts, the bundle, Today, the wishlist, the confirmation | The bundle as an obsidian hero with gold edge light and its item stills large; item cards with the still filling the top half and the rarity as the name's colour; no "best value" | Warmer and larger, still no pressure | `shop-e-phone`, `shop-e-desktop` | M |
| Settings, Account, Terms | As built | Terms cut to 60 words and a link; "How it works" lives here | Words | – | S |
| Room: lobby, link join, round results, standings, podium | As built (nameplates, the broadcast reveal) | Larger type on the room code and the main action; the join screen's name box pre-filled | These screens are sound | – | S |
| Round intro | The frame header, the demo box, Ready, the countdown | Goal 22 px, one how line, How and Score behind "?" | 15 words | – | M |
| Reveal | The reveal template, which P2 builds as its first job (section 9: it is not on main) | Section 6 | – | `reveal-a-phone` (layout only) | M |
| Empty and error states | The Captain art | "Tournaments, coming soon" goes with the tab; a new guest's You page is one card and one row | – | – | S |
| Desktop tab pages | The rail, the aside | Section 7 | – | `home-e-desktop`, `games-e-desktop`, `vs-e-desktop` | L |

## 5. Game by game

The recommended direction (Spotlight) applied to every active game. "Earlier" names a row of `earlier-plan.md` whose files, lines and checks still apply; **kept** means build it as written there, **changed** means the aim moved and this row wins, **dropped** means do not build it. Bugs (H rows) are all kept. Every row is display only.

### Word (9): the piece set goes ivory

All nine share one move: `scripts/word-art/word_art.py` re-renders the tile, disc, well, key and pip set in a matte ivory body with a warm ledge (same file names and sizes), tones gold → champagne enamel, teal → mint, grey → pale stone, red → coral, sapphire → the category blue; ink becomes dark navy; the stage behind is the Word deep blue. Keyboards stay navy (they are controls) and gain the key relief on every Word game (earlier E2.4, kept).

| Game | Stays | Changes | Larger |
|---|---|---|---|
| Nucleus | The wheel layout, the pangram chip | Ivory discs, the centre disc category blue | The entered word 22 px |
| Interlock | The grid, live word lights | Ivory tiles on pale wells | – |
| Slider | Rows and locks | Ivory tiles, champagne locks | – |
| Forage | The 6 × 6, the path, the found-word chip | Ivory tiles, a blue path, a champagne gold tile; the found word as a green capsule | Status chips 15 px |
| Lookout | The found capsules | A light sheet with navy letters; found words in colour | Letters 60 % of a cell (as today) |
| Roundabout | Wheel and crossword | White crossword cells, ivory wheel | – |
| Strikeout | The row, the strikes | Ivory tiles, coral strikes | Solved words 17 px |
| Cryptogrid | Numbers in cells, the selection jump | White cells, champagne givens, navy letters | – |
| Swapword | The loops, in-place and elsewhere colours | Ivory tiles; green and teal states kept | – |

### Number (8): enamel and ivory in place of brushed metal

| Game | Stays | Changes | Earlier |
|---|---|---|---|
| Counterweight | The beam, hangs and readout | Light oak frame, coloured enamel kettlebells, a champagne beam | E2.3 changed (lighter than the old values, not a return to them) |
| Exact | The rack, the step list, the operators | A white target plate with a category-green ring; ivory number tiles; champagne for made numbers | – |
| Operator | Gaps and tray | Ivory tiles on wells; gold circles and teal squares kept as the gap code | – |
| Integer Pyramid | The sandstone blocks (they already read) | The stage lit; gold completion kept | – |
| Brimful | Glass jugs, bright water | The stage lit; scale marks 13 px | – |
| Checkout | The dartboard | The fairground backdrop back, the stacked outlines gone | E2.1 and E0.5 kept |
| Ballpark | today's rules, levels, effects and every `data-*` attribute | **The old look (Joe's pick, 20 Nov)**: the steel tape with no minor ticks, the notches above it, the old pin and the lit card, on the new lit stage | E1.5 as the earlier plan wrote it, built by A1 |
| Kakuro | Clues and keypad | White cells, deep-green clue cells | – |

Category-wide: E0.1 (the halved backdrop) is replaced by rule 1 of the stage; E0.4 (navy and champagne dyed controls) kept.

### Speed (6) and Attention (6)

| Game | Stays | Changes |
|---|---|---|
| Flash | The full-colour flash (it is the game) | The frame's wood a shade lighter |
| Ascend | The scatter | Ivory discs with navy numerals on green baize; done discs green; discs drawn to the largest size the count allows |
| Don't Break the Chain | The charms (already vivid) | A lighter baize board; the cycle strip 15 px |
| Bonk | The lawn and gophers | A brighter green; the rule plate larger |
| Tenfall | Lanes and tiles | Lighter lanes; ivory and blue tiles |
| Pull! | The sky and field (already vivid) | Clays a brighter orange |
| Eagle Eye | The grid | Pale tiles, dark-ink eagles, the target chip larger |
| Double Take | The shelves (already vivid) | – |
| Tally | The tray | Shapes on a light tray |
| Labyrinth | The maze | An ivory floor, deep walls, a champagne exit |
| Bomb Defusal | The panel (a bomb is metal) | Wires more saturated; the clue card white |
| Matchmaker | The pink backs | White faces |

Speed and Attention's dark frames (earlier E0.3) follow rule 1.

### Pattern (8)

| Game | Stays | Changes | Earlier |
|---|---|---|---|
| Gridlock | The lot and cars | Lighter tarmac, saturated cars, a champagne gold car | E0.2 changed: soft glows return where the direction asks, not the deleted blocks wholesale |
| Tessellate | The pieces (already vivid) | An ivory pegboard | – |
| Pipeline | today's rules, levels, effects and every `data-*` attribute | **The old look, with the bigger pipes (Joe's pick, 20 Nov)**: the old SVG pipes and lit network, drawn at today's tile and pipe size, on the new lit stage | E1.4 as the earlier plan wrote it, built by A2 |
| Chroma Lines | today's rules, levels, effects and every `data-*` attribute | **The old look (Joe's pick, 20 Nov)**: tinted cells, the old flat glossy dots, the bright line with its halo, on the new lit stage | E1.3 as the earlier plan wrote it, built by A2 |
| Skid | The ice (already bright) | – | – |
| Heave | The warehouse | The stage lit | – |
| Lightbender | The dark board (a beam needs it) | Deep violet, not black; the beam's glow back | E0.2 kept for this game |
| Topsy-Turvy | today's rules, levels, effects and every `data-*` attribute; the three-layer tray | **The old look (Joe's pick, 20 Nov)**: gradient balls with the white gloss, coloured-ring sockets, the blue-grey floor and steel-blue blocks, on the new lit stage | E1.2 as the earlier plan wrote it, built by A2 |

### Logic (14)

| Game | Stays | Changes | Earlier |
|---|---|---|---|
| Box Six | The grid and keypad | A white grid with tinted boxes, navy givens, teal entries, a champagne selection | – |
| Hanoi | The rings (already vivid) | Light oak posts; the stage lit | – |
| Polypotions | All of it (already vivid) | The stage lit | – |
| Safe Cracker | The dials (a safe is metal) | Brighter brass; a white clue card | – |
| Mosaic | Clues and locks | A light grid, filled cells category teal | – |
| Colour Flood | All of it | – | – |
| Minefield | The board | Light squares, the Logic palette for numbers, a red disc for mines | E2.2 kept |
| Tents and Trees | The pieces | A brighter grass board | – |
| Shikaku | The grid | A light grid, rectangles in pastel fills | – |
| Lamplighter | The dark board (it is about light) | Warm lamps with their glow and per-square pools | E1.1 kept |
| Trail | The path | Ivory tiles, a champagne path | – |
| Loopline | The dots | Light paper, the loop in category colour | – |
| Regions | The number pad | A light grid, tinted regions | – |
| Island Link | The bridges | A brighter sea, white islands | – |

E0.3 (near-black Logic 2 frames) is replaced by rules 1 and 2; E0.5 (hairline rings round boards) kept.

### Retro (10): dark stays, glow up

| Game | Stays | Changes | Earlier |
|---|---|---|---|
| Hover | The craft, the gates | A soft nebula that follows the gate colour | C1.3 and H1 kept |
| Breaker | The wall, capsule icons | A flat pixel ball with a glow; flat bright bricks | C1.1, C1.2 kept |
| Rally | The court | The same ball and a flat paddle | C1.1 kept |
| Tempo | Lanes and fever bar | Brighter lanes, notes with a glow | – |
| Meteor | The comet, the border | Soft nebulae, ringed wormholes | C1.9 kept |
| Fission | The atoms | No white glass highlight | C1.7 kept; C1.8 back (Joe, 20 Nov): `burstRev 14`, atoms 35 / 24 / 15 / 9 px, built by D5 |
| Wavefront | The hulls | A cool nebula; edge light by wave; the fill continues the sky | C1.4, C1.5 kept; C1.6 back (Joe, 20 Nov): `wavRev 16`, the wider formation on a proved deal, built by D5 |
| Blockzone | All of it | A true cabinet on a computer (section 7) | B2 kept |
| Pinball | All of it | – | – |
| Spacewalk | The pixel art | The fill continues the sky | C1.11 kept |

### Action (6), Strategy (5), Sports (6), Cards & Board (5): lit worlds

| Game | Stays | Changes | Earlier |
|---|---|---|---|
| Roofbound | The runner, the course | Two tones: cool basalt and warm lava | C3.8 kept |
| High Rise | The city, plaza and dusk | Coloured floors; a bolder crane | C3.6, C3.7 kept |
| Grappler | The jungle; **the 14 px grab ring's size** (a larger target helps play) | The ring drawn as a vine loop, not an enamel disc | C3.3 changed: no radius change, so its assertion stays |
| Moon Climb | The shaft, the ninja's size | A calmer sky (fewer stars, no far lanterns) | C3.4 kept; C3.5 back (Joe, 20 Nov): `ricoRev 5`, a 30 × 60 body between today's and the old one, built by D5 |
| Iron Wall | The road, badges | No white outline on far tanks; ruins beside the road; a brighter desert | C3.1, C3.2 kept |
| Orbit | The planets | Solid orbit paths | C1.10 and H2–H8 kept |
| Tilt | The disc filling the width | A lighter walnut table | C2.4 kept |
| Gemstone | The chest, the goals | Flat-cut bright gems on lighter cells | C2.1 kept, with lighter cells added |
| Coral Pop | The reef | Bubbles re-rendered without the white window glare | C2.3 kept |
| Rainbow Bridge | All of it (already bright) | – | – |
| Ball Tracker | The tubes | Code marbles at the sim's size; lighter oak | C2.2 kept |
| Home Run | The park | Fielders as figures with shadows; a lighter wall | C4.10 kept |
| Top Bins | All of it (the best-lit game in the app) | The kicker's neck; the curl classifier | C4.5, C4.6 kept |
| Apex | The circuit | A flatter car finish | C4.7 built; C4.8 kept |
| Crazy Golf | The course | The dotted aim line and power pill; a 60 px Captain; castles that read as castles | C4.1–C4.3 kept |
| Cue Ball | The table | No arm over the cue; a brighter baize | C4.4 kept |
| Curl Champ | The sheet | A backing strip under the controls; stone shadows | C4.9 kept |
| Free Cell | The cards | A brighter baize; cards drawn to fill the columns | – |
| Mahjong | The tiles (already ivory) | A brighter felt | – |
| Summit | The cards | A brighter baize; the peaks and the stock a fifth larger into the empty lower third | – |
| Five Hands | The grid | A brighter baize | – |
| Thirteen | The pyramid | A brighter baize; larger cards | – |

After the art sessions: re-export every tile and intro still, and re-run `bun scripts/reveal-palette.ts` (earlier A10 kept).

## 6. The game frame, the intro and the reveal

- **The frame keeps its geometry**: the 60 px header, the timer on its bottom edge, the goal line, the dock, the phone-gap rule. Those are pinned by six checks and are right. Only paint changes: the stage behind the board (rule 1), goal text 19 px, status chips 15 px.
- **The intro** keeps the frame header, the demo box (about 40 % of the height) and Ready; the goal grows to 22 px, one how line stays, How and Score move behind "?" (section 3.5).
- **The reveal** uses the reveal template, which P2 builds as its first job (section 9: the first version came off this branch on 21 Nov). Its paint follows the direction: the score 72–96 px, the star row under it, "New best" as a champagne ribbon, three part chips, the stage picture, then Play again (gold), the next level up, Games. The paint adds no layout change to the template. Each family's boards and run pictures move onto the template's stage (earlier rows G2 to G7, carried forward: the first version of this plan left them out), once P2's template has merged.

### 6.1 The levels in the app (added 20 Nov, mockups `levels1-e`, `levels2-e`, `levels3-e`, `frame-*`, `kit-board`)

- **One level mark everywhere**: a colour and one to four bars (Easy green and one bar, Normal blue and two, Hard orange and three, Expert red and four), never colour alone. It sits on the game's page, in the frame header during play (beside "Round 2 of 6"), on the intro, on the reveal and in room settings. A star marks 175+ on Easy, Normal and Hard; Expert's mark is a crown.
- **The small pictures** are shown for eight games on `pictures-board.webp` (Breaker's wall and paddle, Box Six's given numbers, Ascend's discs, Meteor's rocks and walls, Top Bins' wall and wind, Iron Wall's lanes and tanks, Tempo's lanes, Mahjong's stack), drawn from the spec's level numbers. A ladder whose four pictures look alike is a ladder whose steps a player cannot see: the board is the quick test of that.
- **The level picker on a game's page (Joe, 20 Nov: L1 and L2 combined; mockup `gamepage-mixed-phone`, desktop `levels-e-desktop`)**: the page opens on the player's current level, shown large (the level's picture, its lever in a few words, their best and star). Under it the four levels sit as a compact row to tap, each with its small picture, the level mark, their best and their star (a crown on Expert). Tapping a level makes it the large one. The page remembers the last level played on each game (the device's existing level choice, per game; a new player starts on Normal). Normal says "the ranked game". One large gold Play; "How to play" and "Challenges n / m" are two small buttons under it. The pictures are drawn from the level's own settings (`GAME_LEVELS`), never hand-made, so they cannot drift from the game.
- The earlier L1 (`levels1-e-phone`: four full rows) and L2 (`levels2-e-phone`: one level large with a switch) mockups are kept as the two halves this picker combines.
- **The step-up card on the reveal (L3)**: after a star, Normal beside Hard and one line saying what is new, with "Play Hard" as the gold button. No star: Play again stays gold and the card is not shown. It never appears in rooms, rated play or the Daily.
- **In play**: the frame header shows the game's name, the level mark and round, the score with place, and the timer as a gold bar on the header's bottom edge (the 60 px geometry is unchanged).
- **The kit** (`kit-board`): the navy frame, the one gold action, Archivo, the cut corner for heroes only, the family colours, level marks, tiles, nameplates, the lit stage and six rules, on one board for the build sessions.
- Built by P2: the level mark as one shared component (`LevelMark.tsx`), the game page's ladder, the intro's and the frame header's mark, the reveal's step-up card and the lever-picture slot, with Breaker's picture as the worked example. Each difficulty session (D1 to D6) adds its own families' pictures in one new file of its own, drawn from the level settings it has just written (`coverage.md` has the file names).

## 7. Desktop (1024 px and up)

- **Tab pages** (earlier B4, kept, with this plan's layouts): Home is the hero across two columns, the three feature cards in a row, Jump back in as six tiles, an aside with your rating, friends online and this week; Games is the hero across the top and shelves of seven tiles; Shop and You gain a second column so no aside is empty.
- **The rail** (earlier B5, with Joe's additions of 20 Nov; mockup `home-mixed-desktop`): the nameplate, gold Play, then Home, Games, Compete, Shop, You; under a "More" label Daily, Leaderboards, Friends, Challenges, Badges and Notifications (with its count); Settings at the foot. Compact in rooms and games, as today.
- **Arcade games: the Cabinet** (earlier B1, Joe's D1 pick, kept): the identical world at its largest uniform scale, a left panel (game, big score, timer, best, this run) and a right panel (goal, next challenges, controls; in a room the standings and chat), the game's scenery carried behind both. Mockup `play-a-desktop` shows it on Breaker.
- **Puzzles** (earlier B3, kept): the board left at the largest size that fits, controls in a right column.
- **Keyboard controls in every game** (Joe, 20 Nov). Every active game is playable from the keyboard on a computer and says so on its intro. Today 18 of the 83 active games have no line in `DESKTOP_KEYS` (`src/lib/desktopKeys.ts`, read on 20 Nov): Counterweight, Tessellate, Don't Break the Chain, Pull!, Chroma Lines, Lamplighter, Mosaic, Ascend, Matchmaker, Pipeline, Cue Ball, Flash, Shikaku, Swapword, Tenfall, Tents and Trees, Bonk and Lookout. Some of them are pointer games by nature (Ascend, Bonk, Pull!, Flash, Cue Ball): P4 proposes each one's keys to Joe where the choice is not obvious (a cursor moved with the arrows and Space to tap is the default for board games; number or letter keys for targets that can be labelled). P4 completes the mapping in `src/lib/desktopKeys.ts`, `useGameKeys` and each stage's `keys` prop: input mapping only, feeding the same handlers and queues as taps, so the game world, its timing and its scoring are identical on every device (`desktop-fairness-check`). P2 draws the intro's key line from `DESKTOP_KEYS` on a computer (the short intro keeps one how line on a phone; on a computer the key line sits under it) and the Controls tab in the game menu stays as today.
- **VS on a computer**: the two halves side by side on a slanted gold seam (`vs-e-desktop`).
- **You, the Shop and the rated result on a computer**: `profile-e-desktop` (the card, rating and stats left; rows, recent matches and the showcase right), `shop-e-desktop` (the bundle across the top, four items a row, coins and the wishlist in the aside), `result-e-desktop` (the title, the rating card beside the game rows, the three actions in a row).

## 8. Difficulty

The full spec is `docs/polish-plan-final/difficulty-spec.md`; its data is `difficulty/*.json`. In short: one visible lever per game, four levels as one ladder, Normal untouched, 2 kept, 46 retuned, 35 redesigned, five new mechanics, and a proof route for every Expert. Its five decisions are decision 10 above. The scoring items of the earlier plan's section I stay open and are folded into the spec where a level's 200 depends on them (Flash, Five Hands, Integer Pyramid, the open Word games' star line, High Rise, Cue Ball, Tilt); I6 and I9 stay "leave it".

### 8.1 Fact-check of 20 Nov (numbers and method)

Asked for by Joe before any build. Measured with the repo's own tools on this branch (main f3016234 merged in); nothing in the repo was changed to measure.

| Claim in the first version | Measured | Verdict |
|---|---|---|
| Counterweight, Brimful, Checkout, Kakuro: the old game as Hard "looks and scores like Normal" | 96 deals a game, seeds 7000 to 7095, same seeds at both levels, the four puzzle-fairness kits through the server's grade. First board identical on all four. Good kit, Normal → Hard: 195 → 171, 182 → 95, 140 → 103, 167 → 106. Average kit: 164 → 94, 63 → 61, 53 → 50, 80 → 65. Person-like solver finishes 81 of 96 old-Hard Kakuro boards. | **Half right.** It looks like Normal in the first seconds; it does not score like Normal. The rows keep the difficulty and add a visible step. |
| Iron Wall's Expert needs the fourth lane | 60 room seeds a level. Hard and Expert: same tanks, lanes and spawn moments on 60 of 60 seeds. Average bot 104 and 84; elite under the limits 161 and 146 (best 177 and 172, no 200). A pace-only Expert in memory: average 91, elite 148. The oracle held to human pace reaches 200 on 58 of 60 Expert seeds. | **The reason holds** (Expert is not a step you can see, and pace alone does not make one). The lane itself is not measured: it needs sim code. |
| No proof tool applies `HUMAN_LIMITS` today | Read from the code: `level-tune.ts --human-limits`, the Home Run and Top Bins Expert proof, and nine level checks apply or assert under them. | **Wrong as written.** True only in the narrower form now in the spec: most 200 witnesses are frame-exact, and most checks assert "scores well" under the limits, not 200. |
| Flash and Bonk cap a perfect human at about 130 and 160 at every level | Flash: every flash tapped at exactly 0.25 s, 100 deals a level: 130 at all four levels (0.20 s gives 135, 0.17 s 165, 0.14 s 190). Bonk: 0.25 s to react and 0.15 s to move, one finger, 100 deals a level: 156 on Easy, Normal and Hard, 153 on Expert. | **Holds** (130 and 156). It is the scoring curve, so no level setting fixes it; the spec's decision 3 stands. |

<!-- overall-result -->
**The overall result.** Of the 249 Easy, Hard and Expert rows, 174 were measured in this pass, 7 come from the repo's documents (today's level, kept) and 68 are not measured yet, because they need a board size, a bank or a mechanic that does not exist until it is built. By game: 8 hold as proposed, 48 were changed because a measurement contradicted them, and 27 keep a risky part unproven until their session builds the proof. Three things showed across the board:

1. **The commonest fault was a step too small to matter**, and the fix was a bigger move of the same lever: Blockzone's Hard from twice to four times Normal's pace, High Rise's blocks from 150 and 110 px to 110 and 50, Rally's Hard paddle from 88 to 72 px, Minefield's Expert from 36 to 40 mines, Tally's and Matchmaker's clocks.
2. **The repo's bots and kits cannot feel some of the levers a player sees**: a paddle's width (Breaker, Rally), the shortest word that counts (Nucleus, Forage), and any board size the code cannot deal yet (Interlock, Slider, Cryptogrid, Trail, Gridlock's 9 × 9). Those steps stay unproven until the session writes a player that can feel them, or people confirm them. A row marked measured is not a row marked proven: the verdict line says which.
3. **200 under the human limits is rare today.** In the arcade families the elite bot under the limits reaches 200 on Expert in only a few games, and in several it does not reach 200 on Normal either, which is a ceiling of the bot or of the scoring (Flash 130, Bonk 156), not of the level. Nothing applies the limits to 28 of the 83 games at all. So each difficulty session's first job is its proof under the limits, before any number is tuned.
<!-- /overall-result -->

**The second round (20 Nov, later).** The rows the first measurements broke were worked on again, and the 15 Pattern and Logic games skipped the first time were measured. What it found, beyond the row changes in the spec:

- **Easy was not welcoming in several puzzles**: an average player finished none of 12 boards on Box Six's Easy and few on Mosaic's, Safe Cracker's, Lightbender's and Lamplighter's. Each Easy is now bigger-hearted (Box Six starts with 24 to 26 numbers, was 19 to 21).
- **Above Hard there is little room for an average player** in most Pattern and Logic games: they already score 25 to 40 on Hard, so a 20-point step to Expert is rarely possible. Expert there is a level for strong players, and it reads as one by what you see (fewer numbers, a bigger board), not by the average score.
- **The best simulated player reached 200 on no proposed Pattern or Logic Expert until a "full speed by" time was moved** (Skid, Lightbender). Each difficulty session sets that time from its own measurement.
- **Some levers do not exist yet**: Breaker's paddle is weak while a lost ball is cheap (decision 20), Gemstone's ice does nothing and its ladder moves to colours (decision 21), Grappler has no setting that makes a real step (it needs a faster chase than the course builder can prove today), and Curl Champ's dealer cannot place the red stones the row asked for.

Each of the 83 rows in the spec now carries an **Evidence** line per level (documented, measured or not measured, with the numbers), a fact-check verdict (holds, adjusted or unproven) and what applies the human limits to that game today. Rows the measurements contradicted were changed and say so.

### 8.2 Scoring fixes and stamps on Normal (Joe, 20 Nov)

Joe's ruling: "Normal stays today's game" means the difficulty levels do not change Normal. It does not ban the scoring fixes he approved. So the scoring review's seven fixes are built **on Normal too**, each under a new stamp, by the difficulty session that owns the game, together with Normal's caps for Flash, Bonk and Pull!. I6 (Roofbound) and I9 (Moon Climb) stay "leave it".

| Item | Game | New stamp | The fix | Session |
|---|---|---|---|---|
| I1 | Flash | `tapRev 8` | Refit the per-flash curve so a 0.25 s tap pays about 150 and a 0.17 s tap about 200. Measured today: every flash at exactly 0.25 s scores 130 at all four levels | D3 |
| cap | Bonk | `whackRev 5` | Widen the quick window so a player reacting in 0.25 s and moving in 0.15 s can fill the combo part. Measured today: 156 at the limits (0.20 s would give 198) | D3 |
| cap | Pull! | `clayRev 9` | Set the quick-hit part's full line from the best human-limited run. Measured today: no limited run reaches 200 (best 183) | D3 |
| I2 | Five Hands | `fiveHandsRev 4` | Hand points full at the elite median (143 → 128); × 1.4 and the bonus column kept | D6 |
| I3 | Integer Pyramid | `depthRev 3` (numpyramid) | Unfinished credit 130 × stones placed correctly ÷ stones; finishes unchanged | D2 |
| I4 | Nucleus, Forage, Roundabout | `wordsmithRev 6`, `wordHuntRev 5`, `wheelRev 6` | Refit each points line so a near-perfect player earns the star and the best can reach 200 (the refit option of I4, because each fix is to be a stamp; the star line stays 175 and no migration is needed). This is also decision 21's fix, on Normal and on the level deals | D1 |
| I5 | High Rise | `skylineRev 12` | Floors full at 45, perfect drops full at 30; play unchanged | D5 |
| I7 | Cue Ball | `poolRev 5` | Speed measured from the fifth pot (full by 60 s); the bank re-proved | D6 |
| I8 | Tilt | `tiltRev 13` | Normal deals 3 mazes (today's 4 without the tight fourth), par over three, speed full by 55 s; the deal re-proved | D6 |

The three stamps Joe approved on 20 Nov also come back, all in D5: **Moon Climb `ricoRev 5`** (a 30 × 60 body between today's 34 × 68 and the old 26 × 52; C3.5), **Fission `burstRev 14`** (atoms 35 / 24 / 15 / 9 px; C1.8) and **Wavefront `wavRev 16`** (the wider formation, on a deal proved at 200 at every level; C1.6).

Every one of these is a gameplay or scoring stamp under the house rule, so each session does the whole routine for it: record a legacy fixture of today's stamp first; gate the change on the new stamp so older rounds replay and score exactly as before; add the era pin in `DEAL_PINS` so checks written for today's stamp keep their deals; update the game's entry in `LIVE_BANDS` and `scripts/arcade-standard/` and its help and intro numbers; re-run `practice-stamps.ts` (practice bests start fresh for that game) and the challenge catalogue's numbers; append its self-replay entries at the end; and list its intro demo for re-recording (F1). The level ladders in the spec are then tuned on the new Normal, not today's.

**Grappler and Curl Champ.** Neither has a working lever today (section 8.1). D5 and D6 each propose one to Joe, with numbers, **before** building those two games' levels.

## 9. The three items built in the earlier session

| Item | Still fits? | Note |
|---|---|---|
| **Apex's steering fix** (C4.7: the car's sprite turns with the steer) | **Yes, unchanged.** | A plain bug fix; no direction touches it |
| **The reveal template** (`RevealScreen`, G1) | **Not as built.** Off this branch on 21 Nov; P2's first job | The direction still needs one reveal layout to repaint, but the first version cut run pictures off on phones (its stage was a fixed-height box that could not scroll: 9 of 14 sampled arcade games at 375 × 667, 6 of 14 at 390 × 844) and broke `swing-overhaul-check`, the `reveal150` entry `celebrations-check` compares and the Crazy Golf reveal screen that theme-check and no-wrap-check draw. Its files are back to main's text, `skyline-overhaul-check` line 728 included. P2 starts from commits `86fe22258` and `2cbba0c5e` with the fix list in section 2.1 |
| **The desktop Cabinet skeleton** (B1, behind `ARENA_CABINET_LEFT`, off) | **Yes.** | The Cabinet is still the desktop answer for arcade. The session that fills it paints the panels in the esports style (navy, one cyan or category edge) and switches it on with the three desktop-geometry lines Joe approves |

## 10. Assertion changes this plan needs

The rule stands: no session loosens, retargets or deletes an assertion without Joe's approval typed in that session, with the note "Changed with Joe's approval, DD Mon YYYY" beside each changed line. The full list, with exact lines, is **`docs/polish-plan-final/assertions.md`**. Each build session shows Joe its own rows from that file before touching them.

## 11. Build sessions

Fourteen sessions. Prompts: `docs/polish-plan-final/prompts/`, each paste-ready for an Opus 5.5 session and ending with the same standing rules, byte for byte (`build-prompts.py` in `direction/source/` writes them all from one block). **`docs/polish-plan-final/coverage.md` maps every row of this plan to the one prompt that builds it, lists every file two prompts would have shared with its one owner, and gives the launch order.**

| Session | Builds | Owns (in short; the prompt has the list) |
|---|---|---|
| **P1 Navigation, Home, splash, navy** | Sections 3.2, 3.3; the splash; the navy values; the rail | The tab bar, rail and header, `index.tsx`, `play.tsx`, `more.tsx`, Home's components, `tokens.css`, the shared page CSS, the screen harness |
| **P2 Games, game page, Challenges, intro, the reveal template, first open** | **The reveal template first** (G1, with the fix list of section 2.1), as its own pull request; then sections 3.4, 3.5; those rows of section 4; the reveal's paint | The games components, `practice.tsx`, `challenges.tsx`, `RoundIntro`, `RevealScreen`, `instructions.ts`, the first-open files |
| **P3 Compete, You, Shop, rated, Daily, rooms** | Those rows of section 4; section 3.6 | The other routes and their components, the room screens |
| **P4 Desktop** | Section 7 (earlier B1 to B4) | `desktop-layout.css`, the arena panel and frame files, Blockzone's layout |
| **A1 Word and Number art, and the shared puzzle stage** | Their tables in section 5; section 6's frame paint; G2, G3 (after P2's template has merged) | The Word and Number art and CSS, `game-frame.css`, the one shared stage rule |
| **A2 Speed, Attention, Pattern, Logic art** | Their tables; G4 to G6 (after P2's template has merged) | Those families' art and CSS, Minefield's and the Speed engine games' renderers |
| **A3 Arcade art and the bugs** | Their tables; G7 (after P2's template has merged); H1 to H3, H5 to H8 | Every other arcade renderer, the fills, the run pictures |
| **D1 to D6 Difficulty** | `difficulty-spec.md`, a group each; the proof tool first; D5 also H4 | Each game's level table, deal and bank scripts, level checks; only its own games' rows in the shared one-row-a-game files |
| **F1 Final pass** | Tiles, stills, the reveal palette, `celebrations-off.json`, the list of demos to re-record | The generated art data, once, at the end |

**Launch order.** Three trains that share no files. Pages: **P1** first and alone, then P2, P3 and P4 together. Art: **A1** first, then A2; A3 any time. Difficulty: **D1 to D6** merged one at a time in that order. **F1** last, then the merge captain runs the Save-intro-demos workflow. Three cross-train rules: a difficulty session that needs new art waits for that family's art session; P2 merges before any difficulty session touches help or intro text; and A1, A2 and A3 build their reveal rows (G2 to G7) only after P2's reveal template has merged, which P2 opens as its own first pull request (the rest of their art does not wait). If only three sessions start at once: P1, A1 and D1.

**After Joe's answers of 20 Nov** (section 2.1; `coverage.md` has the rows): P1 builds the mixed Home and the fuller desktop rail; P2 the Games switch, the combined level picker, the intro's key line and the first open into Ascend on Easy; P3 the reordered Compete and the mixed You; P4 the keyboard mapping for every game (P1 builds the fuller rail with the rest of the navigation); A1 the old look of Ballpark (E1.5) and A2 the old looks of Pipeline (with the bigger pipes), Chroma Lines and Topsy-Turvy (E1.4, E1.3, E1.2), each on the new lit stage with today's rules, levels, effects and attributes; D1 to D6 the scoring fixes on Normal for their games (section 8.2), D5 the three stamps, and D5 and D6 a lever proposal to Joe before Grappler and Curl Champ; F1 the longer list of demos to re-record.

## 12. Carried forward unchanged from the earlier plan

- Section H (bugs H1–H8: Hover's frame drop, Orbit's planet bake, camera cut, low-fuel line, rings, checkpoint button, pop texts), built by A3, except H4 (a rules change, so a stamp), built by D5.
- Rows G2 to G7 (each family's reveal boards and run pictures drawn at the reveal template's stage size), built by A1, A2 and A3 once P2's reveal template has merged.
- Row A4 (the showcase strip on the profile), built by P3.
- Section J (infrastructure notes), for the infrastructure session.
- A2 (Home's sections reserved), A12 and A13 are absorbed into sections 3 and 4 here.

Built after Joe's answers of 20 Nov: the earlier scoring review's seven approved fixes (I1 to I5, I7, I8) and Normal's caps for Flash, Bonk and Pull!, each under a new stamp in the difficulty session that owns the game (section 8.2). I6 and I9 stay "leave it".

Dropped from the earlier plan: A3 (avatar discs), the "best value" pack frame in A8, the old section D and its spec. C1.6, C1.8 and C3.5 (the three stamps) are back, in D5. The earlier E1.2 to E1.5 are back: Joe picked the old look for Topsy-Turvy, Chroma Lines, Pipeline (with the bigger pipes) and Ballpark on 20 Nov, restored as E1 described, on the new lit stage.
