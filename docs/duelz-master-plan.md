# Duelz — Master Plan

Updated 10 Oct 2026 · Joe

## How to use this plan

Duelz moves through six phases: protect the game IP, finish the player experience and settle the app's name, migrate and build the competitive layer, prove retention, then monetise and launch. The app rename closes Phase 2, so it lands before the company, trademark, accounts and stores carry the name.

Start each new chat by pointing Claude at this doc and the latest handover note. Tick tasks off as they land and update the tracker at the end. Not legal, tax or financial advice: the naming, IP, dictionary and real-money points need a solicitor or adviser before acting.

## Phase 1: Protect (now)

Phase 1 cleans up the game names, art and word list. The app rename moves to step 9 at the end of Phase 2; until then Duelz stays a private working title.

- [x] **1. Rename the games.** Done. All 68 active games renamed in one display-only pass (internal ids unchanged), then screened against the UK and EU registers.
- [x] **2. IP art pass.** Done. Fission's invaders became atoms, Nucleus's Polygon-style board became an atom board, Slice's power-ups became Saucy and Simmer, Hover's pipe-like gates became energy barriers, and Scrumper was confirmed clear.
- [ ] **3. Request dictionary quotes.** Email Oxford Languages about their UK English word game dataset and Collins about Collins Scrabble Words. Licensing takes weeks, so start now and swap the word list in when it lands. *Claude: draft both emails.*

## Phase 2: Player experience (on Lovable, before migration)

Everything players see gets finished while it is still cheap to change, ending with the intro demos once names, art and sims are frozen.

- [ ] **4. Clear the current backlog.** Joe's phone test of the 8 Oct build turned into one fix prompt; the scoring rulings in section 16 of the scoring reference; the game bank rewrite under the new names.
- [x] **4a. Game tuning and polish.** Done (October 2026, Prompts 1–17 in the Game Tuning Prompt Pack): visual refreshes and readability fixes across the puzzles, a 50% speed-bonus par for every game, Bomb Defusal's six steps, a smaller Swish bucket, 30 Scrumper levels, Rainbow Bridge's birds and live-drawing rounds, Pull!'s birds, Grappler's dragons, Orbit's zig-zag world and new camera, polish passes from the visual audit, and arcade success effects. The check runner now catches hidden failures, and every result is named.
- [ ] **4b. Feel upgrades and five gameplay features.** Prompts 18a–23 in the Game Tuning Prompt Pack: last-10-seconds tension, shuffle buttons, personal bests, consistent wrong-answer feedback, found-word feedback, puzzle solve moments and near-miss messages; then Wavefront (wave breaks, divers, boss), High Rise (accuracy changes block size), Pull! doubles, Slice combos and Junction ambulances.
- [ ] **5. Build the new word and number games.** Word and Number go from 6 to about 9 active games each, so word and number players get category duels with real variety. Candidates are in the next section; build in batches of three, one fix pass per batch. UPDATE SOME PUZZLE GRAPHICS - LOOK INTO FANDUEL GAMES
- [ ] **6. Winner replay.** Replay the round winner's arcade run on the reveal or results screen, using the stored input logs and the existing replay renderer. Puzzle move-log replays follow the same pattern.
- [ ] **7. Laptop and PC support.** Centred game column with chat and standings in the side space; keyboard and mouse mapped into the same input log; record the input type on every result now, for ratings later.
- [ ] **8. Intro demos.** Generate puzzle demos automatically from stored solutions with a finger cursor; record each arcade demo once; optional ElevenLabs narration over each demo. The tuning work reset every intro demo to its fixed example (old recordings no longer match the new art and rules), so every game needs a fresh demo here.
- [ ] **9. Rename the app.** Do this before the Ltd is registered and before accounts, the stores or any marketing carry the name; Duelz Casino (SuprPlay Limited, UKGC-licensed since 2018) rules out keeping Duelz. Ruled out so far: Callout (KALLOUT is registered in the UK for mobile games), Sixfold (a Sixfold puzzle game is coming to the App Store), Cerebrawl (a live Google Play game). Clear on the registers, both app stores and the web: Shpil / Shpiler and Danjo. Then confirm and buy domains and handles, register the Ltd and file a UK trademark in classes 9, 28 and 41. *Claude: final screening and filing checklist.*

Short-form clips of arcade rounds can start in this phase at no cost, building an audience and a footage library for Phase 6.

## New word and number games

The aim is three or four new games in each category, chosen from the candidates below; testers prefer games where you move things on screen over look-remember-type, so every candidate is tactile. Names are working titles. Each new game declares its scoring shape and reveal config up front, has a fixed intro example, and is deterministic from the room seed.

Scoring shapes: **A** = standard (130 + up to 20 speed, flat per-item credit when unfinished); **B** = fewest moves (100 + 25 moves + 25 speed); **Staged** = points per stage, speed bonus on all stages; **Arcade** = engine game with a finish bonus.

### Word candidates

| Working name | How it plays | Input | Scoring | Priority |
| --- | --- | --- | --- | --- |
| Swapword | A 5×5 letter grid hides six crossing words; swap tiles to solve it within a swap budget | swap | B | High |
| Compound Words | Eight fragments; drag them together into four compound words, then a second, harder set | drag | Staged | High |
| Word Drop | Letters fall into a well; tap a run of adjacent letters to clear a word before the well fills | tap, engine | Arcade | High |
| Fill-In | Place a given list of words into an empty crossword-shaped grid where only one layout fits | drag | A | Medium |
| Cryptex | Four letter rings on a cylinder; rotate them so every column spells a word | rotate | B | Medium |
| Unscramble Ladder | Five scrambled words of 4 to 8 letters; tap the tiles into order, each one longer than the last | tap | Staged | Medium |
| Mini Crossword | A 5×5 crossword with short clues, solved against the clock | type | A | Low: more recall than testers like, but word players expect it |

### Number candidates

| Working name | How it plays | Input | Scoring | Priority |
| --- | --- | --- | --- | --- |
| Equation Fill | A 3×3 grid of digit slots with a sum or product on every row and column; drag digits in | drag | A | High (already agreed) |
| Checkout | Darts maths: reach exactly zero from a score like 121 in three darts, finishing on a double; five checkouts | tap board | Staged | High: suits the UK pub audience and the Fairground world |
| Merge Target | A 2048-style board with a fixed spawn queue; reach the target tile in the fewest moves | swipe | B | High |
| Change Up | Pay exact amounts with the fewest coins and notes, five tills of rising difficulty | tap | Staged | Medium (agreed alternate) |
| Cages | A 5×5 Latin square with arithmetic cages | tap | A | Medium |
| Magic Square | Drag nine or sixteen numbers so every row, column and diagonal hits the target | drag | A | Medium |
| Prime Rush | Numbers stream past; tap only the primes, faster each phase | tap, engine | Arcade | Low: also fits Speed |

Open points: name Cages and Merge Target clear of KenKen and 2048-branded titles; Memory was dropped on 14 Oct 2026 (its four games and 15 other retired games deleted; scoring reference section 12.1).

## Phase 3: Platform and competitive layer (Claude Code, not Lovable credits)

This phase is systems work, so it moves to Claude Code against the GitHub repo: Fable 5.1 for the systems builds, Opus 5.5 for planning and Lovable prompts.

- [ ] **10. GitHub sync and Claude Code setup.** Free; lets Claude read the code and make edits without credits. Clean the dead code and stale comments listed in the scoring reference. Also: repair or delete the 15 stale failing checks named in the latest Lovable report (including the Turntable part of stroke-tiles-rings-check), fix the burst-swing-score-check timeout, split the slow snip-check (about 13 minutes), and refactor the speed-par rule so "par or not" is passed into the calculation instead of a temporary global setting.
- [ ] **11. Supabase migration, London region.** Move server functions to Edge Functions; move heavy generators (Laser, Push, Light Up, Shikaku) to precomputed banks; grow the Bomb Defusal pool from 300 to a few thousand bombs so regular players don't see repeats (Grappler and Orbit already use 504-course banks); add 4–6 more hard Scrumper levels; measure arcade grading time against Edge Function limits; run the identity proofs and a two-phone room test before switching the live URL.
- [ ] **12. Accounts.** Email magic link plus Apple and Google sign-in; link anonymous identities so history stays; unique filtered username; date of birth for age rules; `stake`, `mode` and input-type fields on results.
- [ ] **13. Daily Rush.** Five puzzles, the same for everyone, one attempt, daily board, streaks, share card with a playable seed link. The first real retention measure.
- [ ] **14. Ratings.** Glicko-2 underneath, shown on a fixed 0–100 curve with one decimal and named tiers; mixed duels feed the overall rating, category duels feed only their category; ranked play at one fixed difficulty; asynchronous pairing first; first ten duels are placement. Live spectating for players who have finished goes here, on the new realtime backend.
- [ ] **15. Tournaments and coins.** Open scheduled tournaments and a monthly season table; free daily coins only, closed loop, no cash-out; Casual / Standard / Hard difficulty for casual rooms and tournaments; tournament wins shown as badges beside ratings.
- [ ] **16. Load test.** Dev-only bots filling a few hundred rooms to find the limits on realtime connections, room starts and grading before any public push.

## Phase 4: Prove it

The gate to spending money or time on growth is a 7-day return rate above 30% from players Joe didn't personally recruit.

- [ ] **17. Measure for at least four weeks.** 7-day return (of players who played one room, how many play another within 7 days); Daily Rush day-2 return and streak lengths; rooms created without prompting; codes shared to new players.
- [ ] **18. Decide.** Above 30%: push into Phases 5 and 6. Between 10% and 30%: fix onboarding and the game mix, then re-measure. Below 10%: rethink the core loop before spending anything.

## Phase 5: Revenue

Paid, non-gambling revenue through an ordinary merchant account comes first; it also builds the six months of trading history any future real-money stage needs.

- [ ] **19. Premium subscription via Stripe.** Ad-free, unlimited practice (three free games a day otherwise), stats and rating history, extra room settings, cosmetics.
- [ ] **20. Coin packs and cosmetics.** Coins for tournament entry; arcade world themes, avatars and celebrations that change only the look, never the gameplay.
- [ ] **21. Paid private tournaments (B2B).** Branded rooms for pubs, companies and events, invoiced directly.
- [ ] **22. Ads.** Lobby banner, an interstitial after the podium at most every two or three rooms, and opt-in rewarded videos for coins. Never during rounds, reveals or standings. Age-appropriate ad settings and UK GDPR cookie consent.
- [ ] **23. Solicitor's IP review.** A freedom-to-operate check across every game, name and art set before the store launch.

## Phase 6: Go to market

Positioning: the skill game you play with your mates, which makes popular solo puzzles social and competitive. Channels run cheapest first.

- [ ] **24. Short-form video.** Arcade rounds and friend-group reactions on TikTok, Reels and Shorts, each clip ending with a playable seed link.
- [ ] **25. Offline groups.** Pubs, offices, university societies, WhatsApp groups; one room code brings in up to nine people.
- [ ] **26. Creators and streamers.** Ten-player rooms as a play-with-chat format.
- [ ] **27. Reddit and Product Hunt.** Post as the developer, following each subreddit's self-promotion rules.
- [ ] **28. App store launch.** Native wrapper once the trademark is filed and the IP review is clear; store purchases set up so the same products exist on web and in the stores.
- [ ] **29. Paid acquisition.** Only once retention and revenue numbers justify it.

## Later: more arcade gameplay ideas

Candidates not chosen for Prompts 19–23. Each changes how a game plays, so each needs versioning, a proof that full scores stay achievable, and tuning. Best done in Claude Code, where it is cheaper.

**Across many games**

- Optional risky bonuses: gold stars or coins in harder-to-reach spots (a tight Hover gap, a high Grappler anchor, a tricky Tilt line), adding points within the 150 cap.
- A final-stretch surge: the last 15 seconds speed up slightly or bring the hardest pattern, so runs end on a climax.

| Game | Idea |
| --- | --- |
| Breaker | A multi-ball brick, and a row of moving bricks in later stages |
| Meteor | Asteroids appear as the tail grows; speed builds with length |
| Swish | The bucket slides side to side on the last throws, plus a small bonus target |
| Flightpath | The board drifts slowly on the final darts |
| Tempo | Two-lane chords and swipe notes in the second half |
| Rally | Targets on the far wall worth bonus points |
| Bonk | A rare golden gopher worth extra points |
| Jaywalk | Cyclist lanes and a roadworks section (avoid river and log sections, Frogger's signature) |
| Ball Tracker | Switch points that change marble routes |
| Roofbound | Ceiling tiles that crumble after you land |

## Later: new content ideas

For discussion once tuning is finished. The deterministic engine makes all of these pure skill games: everyone in a room gets exactly the same seeded situation.

**Sports arcade section.** Short skill challenges on seeded scenarios, with generic sports, no league, team or player names, and our own art.

- Pool: a seeded rack and a fixed number of shots; score by balls potted.
- Football: a penalty shoot-out against a goalkeeper whose dives are seeded.
- Basketball: free throws or trick shots with a flick, under seeded wind or moving hoops.
- Baseball: a home-run derby with timed swings against a seeded pitch sequence.
- Tennis: return a seeded serve-machine sequence into target zones.
- Rugby: conversions from seeded positions and angles.
- American football: field goals, or passes to receivers on seeded routes.
- Also natural fits: golf putting, bowling, archery.

**Action games.** These work when the opponent or course is scripted from the seed:

- Fighting: every player faces the same scripted opponent, so it becomes a test of reading and countering. Check first what didn't work in the retired Parry.
- Runners and platformers on seeded courses, like Grappler and Roofbound.
- Flick games: the engine's physics is deterministic, so the same flick always gives the same result.

**Solitaire.** Pure skill when everyone gets the same seeded deal. FreeCell fits best (almost every deal solvable, no hidden cards); Klondike needs proven-solvable deals only. Keep card art clearly non-casino, with generic names.

**More word and number games.** Beyond the candidates in the section above, aim for genuinely new mechanics rather than more classic puzzles.

**Next step:** after Prompt 23, pick a shortlist and schedule it with the new word and number games (step 5).

## Progress tracker

| Phase | Steps | Gate to move on | Status |
| --- | --- | --- | --- |
| 1. Protect | 1–3 | Games renamed, art pass done, dictionary quotes requested | In progress |
| 2. Player experience | 4–9 | New games live, demos recorded, app renamed and Ltd registered | In progress |
| 3. Platform and competitive layer | 10–16 | Load test passed on the new backend | Not started |
| 4. Prove it | 17–18 | 7-day return above 30% | Not started |
| 5. Revenue | 19–23 | First paying players; IP review clear | Not started |
| 6. Go to market | 24–29 | Store listing live | Not started |
