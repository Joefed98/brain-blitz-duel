# Badge catalogue (approved)

Joe's approved catalogue of the 54 badges, 11 November 2026. This file is the source for every badge's rule;
`src/lib/badges/catalogue.ts` and the seed in `supabase/migrations/20261111220000_badges_titles.sql` follow it, and
badges-check fails if the table below and the code disagree. How the rules are checked, the titles and the rewards:
`docs/badges/README.md`.

## As approved (verbatim)

Competitive (all wait for wave 3’s rated play): First Win (win your first rated match, Common); Placed (finish your 5 placement matches, Common); Hot Streak (win 5 rated matches in a row, Rare); Comeback Kid (win a best of 3 or 5 after losing the first game, Rare); Clean Sweep (win a best of 5 without dropping a game, Epic); Podium Regular (finish top 3 in 25 four- or eight-player matches, Epic); Unstoppable (win 10 rated matches in a row, Elite); Giant Slayer (beat a player rated at least 300 above you, Elite); Storm Chaser (reach Storm, Elite); Lightning Strikes (reach Lightning, Legendary); Top 500 (be ranked in the Top 500 at any point, Legendary).

Mastery: First Star (earn your first mastery star, Common), now; Flawless (score 200 in any game, Rare), now; All-Rounder (at least one star in every game, Rare), now; Perfectionist (score 200 in 25 different games, Elite), now. Waiting for wave 3.5 (all three stars per game): Logic, Word, Number, Pattern, Speed, Attention, Action, Retro, Sports, Cards and Strategy Master (all three stars in every game of that category, Epic); Grand Master (all three stars in every game, Legendary).

Daily and tournaments: Daily Habit (play the Daily 7 days in a row, Common), Dedicated (30 days in a row, Rare), Century (100 days in a row, Elite), all now, from the server streak. From wave 4’s Daily leaderboards, now (W4a, 11 Nov 2026; the minimum field sizes decided 11 Nov 2026): Daily Top 100 (finish in the top 100 of a Daily board, Rare; counts only on a board of 500 or more players); Daily Champion (finish first on a Daily board, Legendary; counts only on a board of 100 or more players). Now, from wave 4’s tournaments (W4b, 11 Nov 2026, awarded by the tournaments code): Entrant (play your first tournament, Common); Trophy Hunter (finish top 3 in any tournament, Rare); Arena Ace (win 8 games in a row in one Arena, Epic); Champion (win your first tournament, Epic); Arena Champion (win an Arena, Elite); Score Attack Champion (win a Score Attack, Elite); Serial Winner (win 10 tournaments, Legendary). Now, from the Category Cup and the Joulz Championship (W4c, Joe’s approval of 11 Nov 2026), awarded when they finish: Swiss Champion (win a Swiss tournament: the Category Cup, Elite); Knockout Champion (win a Knockout final: the Joulz Championship, Legendary).

Challenges: Challenger (complete 10 Practice challenges, Common), Challenge Seeker (50, Rare), Challenge Expert (100, Epic), all now, from C1b. Wait for wave 3.5, because they count every challenge including Hard and Expert: Category Clear (complete every challenge in one category, Elite); Completionist (complete every Practice challenge, Legendary).

Fun: Buzzer Beater (finish a puzzle with under 1 second left, Rare) and Speed Demon (finish a puzzle in under a third of its time, 10 times, Epic), now, in any mode (Practice runs from the fresh start, rooms, the Daily). Wait for wave 3: Revenge (win the rematch after losing to the same player, Common); Photo Finish (win a rated match by 1 point or less, Rare).

Social, collection and special: Party Host (host 25 rooms with at least 3 players, Rare), now, from stored room history; Gem Hunter (unlock your first gem colour, Rare), now, from C1a; Founding Player (sign up before launch, numbered, Legendary), as built; Friendly (add 5 friends, Common): B1 awards it through badge_award once it lands, so give it its rule and leave the awarding to B1.

Mix: 8 Common, 12 Rare, 17 Epic, 9 Elite, 8 Legendary; each Legendary pays 250 coins once. Every badge shows its rule; none says “announced soon” any more. Locked badges show progress where there’s a count (for example 4 of 7 days).

## In the app

**Rated play (11 Nov 2026, wave 3 W3a, Joe's approval in the W3a brief):** the 13 badges the approved text says wait for
wave 3's rated play (the 11 competitive, Revenge and Photo Finish) are earnable, from the server's rated record
(`public.rated_badge_facts`, kept by the ratings engine; `docs/rated/README.md` "Badges" has each rule's reading).
29 earnable, 25 waiting.

The "now" badges built on C1a and C1b read their stored data: First Star, All-Rounder and Gem Hunter C1a's stars and
gems (All-Rounder's count is every active game, so it follows the game list), the three challenge badges C1b's
completed challenges (`docs/badges/README.md`).

| Slug | Badge | Group | Rarity | Rule shown | Count | When |
| --- | --- | --- | --- | --- | --- | --- |
| `first-win` | First Win | Competitive | Common | Win your first rated match. | – | now |
| `placed` | Placed | Competitive | Common | Finish your 5 placement matches. | 5 matches | now |
| `hot-streak` | Hot Streak | Competitive | Rare | Win 5 rated matches in a row. | 5 wins | now |
| `comeback-kid` | Comeback Kid | Competitive | Rare | Win a best of 3 or 5 after losing the first game. | – | now |
| `clean-sweep` | Clean Sweep | Competitive | Epic | Win a best of 5 without dropping a game. | – | now |
| `podium-regular` | Podium Regular | Competitive | Epic | Finish top 3 in 25 four- or eight-player matches. | 25 matches | now |
| `unstoppable` | Unstoppable | Competitive | Elite | Win 10 rated matches in a row. | 10 wins | now |
| `giant-slayer` | Giant Slayer | Competitive | Elite | Beat a player rated at least 300 above you. | – | now |
| `storm-chaser` | Storm Chaser | Competitive | Elite | Reach Storm. | – | now |
| `lightning-strikes` | Lightning Strikes | Competitive | Legendary | Reach Lightning. | – | now |
| `top-500` | Top 500 | Competitive | Legendary | Be ranked in the Top 500 at any point. | – | now |
| `first-star` | First Star | Mastery | Common | Earn your first mastery star. | – | now |
| `flawless` | Flawless | Mastery | Rare | Score 200 in any game. | – | now |
| `all-rounder` | All-Rounder | Mastery | Rare | Earn at least one star in every game. | 92 games | now |
| `logic-master` | Logic Master | Mastery | Epic | Earn all three stars in every Logic game. | – | Arrives with all three stars per game |
| `word-master` | Word Master | Mastery | Epic | Earn all three stars in every Word game. | – | Arrives with all three stars per game |
| `number-master` | Number Master | Mastery | Epic | Earn all three stars in every Number game. | – | Arrives with all three stars per game |
| `pattern-master` | Pattern Master | Mastery | Epic | Earn all three stars in every Pattern game. | – | Arrives with all three stars per game |
| `speed-master` | Speed Master | Mastery | Epic | Earn all three stars in every Speed game. | – | Arrives with all three stars per game |
| `attention-master` | Attention Master | Mastery | Epic | Earn all three stars in every Attention game. | – | Arrives with all three stars per game |
| `action-master` | Action Master | Mastery | Epic | Earn all three stars in every Action game. | – | Arrives with all three stars per game |
| `retro-master` | Retro Master | Mastery | Epic | Earn all three stars in every Retro game. | – | Arrives with all three stars per game |
| `sports-master` | Sports Master | Mastery | Epic | Earn all three stars in every Sports game. | – | Arrives with all three stars per game |
| `cards-master` | Cards Master | Mastery | Epic | Earn all three stars in every Cards & Board game. | – | Arrives with all three stars per game |
| `strategy-master` | Strategy Master | Mastery | Epic | Earn all three stars in every Strategy game. | – | Arrives with all three stars per game |
| `perfectionist` | Perfectionist | Mastery | Elite | Score 200 in 25 different games. | 25 games | now |
| `grand-master` | Grand Master | Mastery | Legendary | Earn all three stars in every game. | – | Arrives with all three stars per game |
| `daily-habit` | Daily Habit | Daily and tournaments | Common | Play the Daily 7 days in a row. | 7 days | now |
| `dedicated` | Dedicated | Daily and tournaments | Rare | Play the Daily 30 days in a row. | 30 days | now |
| `daily-top-100` | Daily Top 100 | Daily and tournaments | Rare | Finish in the top 100 of a Daily board. | – | now |
| `century` | Century | Daily and tournaments | Elite | Play the Daily 100 days in a row. | 100 days | now |
| `daily-champion` | Daily Champion | Daily and tournaments | Legendary | Finish first on a Daily board. | – | now |
| `entrant` | Entrant | Daily and tournaments | Common | Play your first tournament. | – | now |
| `trophy-hunter` | Trophy Hunter | Daily and tournaments | Rare | Finish top 3 in any tournament. | – | now |
| `arena-ace` | Arena Ace | Daily and tournaments | Epic | Win 8 games in a row in one Arena. | – | now |
| `champion` | Champion | Daily and tournaments | Epic | Win your first tournament. | – | now |
| `arena-champion` | Arena Champion | Daily and tournaments | Elite | Win an Arena. | – | now |
| `score-attack-champion` | Score Attack Champion | Daily and tournaments | Elite | Win a Score Attack. | – | now |
| `swiss-champion` | Swiss Champion | Daily and tournaments | Elite | Win a Swiss tournament. | – | now |
| `knockout-champion` | Knockout Champion | Daily and tournaments | Legendary | Win a Knockout final. | – | now |
| `serial-winner` | Serial Winner | Daily and tournaments | Legendary | Win 10 tournaments. | 10 tournaments | now |
| `challenger` | Challenger | Challenges | Common | Complete 10 Practice challenges. | 10 challenges | now |
| `challenge-seeker` | Challenge Seeker | Challenges | Rare | Complete 50 Practice challenges. | 50 challenges | now |
| `challenge-expert` | Challenge Expert | Challenges | Epic | Complete 100 Practice challenges. | 100 challenges | now |
| `category-clear` | Category Clear | Challenges | Elite | Complete every challenge in one category. | – | Arrives with Hard and Expert challenges |
| `completionist` | Completionist | Challenges | Legendary | Complete every Practice challenge. | – | Arrives with Hard and Expert challenges |
| `revenge` | Revenge | Fun | Common | Win the rematch after losing to the same player. | – | now |
| `photo-finish` | Photo Finish | Fun | Rare | Win a rated match by 1 point or less. | – | now |
| `buzzer-beater` | Buzzer Beater | Fun | Rare | Finish a puzzle with under 1 second left. | – | now |
| `speed-demon` | Speed Demon | Fun | Epic | Finish a puzzle in under a third of its time, 10 times. | 10 times | now |
| `friendly` | Friendly | Social and special | Common | Add 5 friends. | 5 friends | now (B1 awards) |
| `party-host` | Party Host | Social and special | Rare | Host 25 rooms with at least 3 players. | 25 rooms | now |
| `gem-hunter` | Gem Hunter | Social and special | Rare | Unlock your first gem colour. | – | now |
| `founding-player` | Founding Player | Social and special | Legendary | Make an account before 26 January 2027. | – | now |
