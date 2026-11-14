# Joulz style guide · round 2

Your round-1 pick: A · Forge’s layout, type, radii, buttons and Play bar, in Joulz’s own black, navy and champagne
gold, with B · Volt’s glossy 3D art and its Daily Puzzle card. The guiding rule: Joulz’s own look, chess.com’s use of
space. Each mockup has one line on what it improves in flow or use of space compared with the app’s screen today.

Approved 14 Nov 2026 with Joe’s last changes: angled cuts on key elements (the Play bar, Find a match, Play, hero
cards, the player card), flat champagne gold buttons (the richer gold only for 3D metal in the art kit), 195
challenges, and only items that aren’t withdrawn in the Shop. The rules and exact values are in
[STYLE-GUIDE.md](STYLE-GUIDE.md).

Round 1’s three directions (Forge, Volt, Studio) are viewable in the history of [PR #398](https://github.com/Joefed98/brain-blitz-duel/pull/398) (commit 31b6c75).

## The style guide

<img src="tokens.png" width="700" alt="Tokens: colour, type, spacing, radii, elevation">

<img src="components.png" width="700" alt="Components and their states">

<img src="motion.png" width="700" alt="Motion timings and frame strips">

<img src="artkit.png" width="700" alt="The art kit: every icon and key art">

---

## Home

<img src="phone/home.png" width="300"> <img src="phone/home-scrolled.png" width="300">

<img src="desktop/home.png" width="900">

**Better than today:** the Play tab stacks Quick play, Rejoin, the Daily and Challenge a friend in one long
column; Home gives each its own short section (today, your next match, ratings, recently played, this week,
friends online) and keeps Play one tap away in a fixed bar.

Light theme:

<img src="phone/home-light.png" width="300">

## Play

<img src="phone/play.png" width="300">

<img src="desktop/play.png" width="900">

**Better than today:** rated play, Arena, rooms, practice and the Daily start from different tabs and cards; one
page now holds every way to play, the main choice in one selector, the stakes shown before you start.

## Bottom sheet: choose a match

<img src="phone/sheet.png" width="300">

<img src="desktop/sheet.png" width="900">

**Better than today:** the match choice is a short sheet of big targets instead of more buttons on the page, so
Play stays one screen tall; on a computer the same choice is a small dialog.

## A puzzle: Polypotions, mid-pour

<img src="phone/puzzle.png" width="300">

<img src="desktop/puzzle.png" width="900">

**Better than today:** the game frame’s header carries name, category, timer ring, score, help and sound; here the
top holds only both players, the game number and the stakes, so the flasks get the height. Shown mid-pour: the
flask lifts, tilts and pours, and the slot it came from waits as an outline.

## An arcade game: Cue Ball

<img src="phone/arcade.png" width="300">

<img src="desktop/arcade.png" width="900">

**Better than today:** the result moves to a separate reveal screen; here the win lands over the table, the
challenge shows as a quiet toast and Next match is one tap in the side panel.

## Games (the catalogue)

<img src="phone/catalogue.png" width="300">

<img src="desktop/catalogue.png" width="900">

**Better than today:** Practice has a Puzzles | Arcade switch, a 4 × 2 chip grid and rows of 104 px tiles with a
Best column; now one row of chips, a hero tile and a two-column grid of large key art, with mastery stars small in
each tile’s corner and nothing else.

## A game’s page, with its challenges

<img src="phone/intro.png" width="300">

<img src="desktop/intro.png" width="900">

**Better than today:** the intro is a timed screen and a game’s challenges live in a separate list; tapping a tile
now opens the game’s own page: the goal in two lines, your stars and best, only this game’s challenges, one Play
button.

## Every challenge (More → Challenges)

<img src="phone/challenges.png" width="300">

<img src="desktop/challenges.png" width="900">

**Better than today:** challenges appear in both Practice and Profile; the full list has one home, with one
progress figure and In progress / New / Done instead of a long scroll.

## Profile

<img src="phone/profile.png" width="300">

<img src="desktop/profile.png" width="900">

**Better than today:** Profile mixes the card, look, stats, recent rooms, practice bests, challenges and settings;
now four sections, card, ratings, mastery and recent matches, with settings moved to More.

## Shop

<img src="phone/shop.png" width="300">

<img src="desktop/shop.png" width="900">

**Better than today:** two levels of tabs (Shop · Pass · Plus, then Featured · Daily · Coins) become one switch;
the week’s bundle (Card Table) and today’s items share one screen with the price on each button, real catalogue
items that aren’t withdrawn and no timers or value labels.

## More

<img src="phone/more.png" width="300">

<img src="desktop/more.png" width="900">

**Better than today:** Friends hides behind a Profile button, tournaments take a whole tab and settings sit behind
a gear; More gives each one a single labelled home in three groups, with the art kit’s icons.

## A list: Arena and tournaments

<img src="phone/list.png" width="300">

<img src="desktop/list.png" width="900">

**Better than today:** the Tournaments tab mixes schedule cards and results; now chess.com’s clean rows, one event
a row with when it is on at the right, and your results behind one switch.

---

To re-render: `node docs/design/style-guide/source/render2.mjs [--no-art] [--only=home,shop,…]` and
`node docs/design/style-guide/source/tokens-css.mjs` from the repo root.
