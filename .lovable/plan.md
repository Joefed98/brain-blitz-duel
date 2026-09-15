# Wordsmith + server dictionary

Replace the Anagram round with a new 60-second word-building round called **Wordsmith**, backed by a real English dictionary that lives only on the server.

## Part 1 — Server-side dictionary

- Download a public-domain word list (ENABLE / SCOWL-derived), filter to lowercase letters-only entries of 2+ characters, and store it as a compact server-only data file.
- New server-only module (never reachable from the browser) that loads the list once into memory and exposes:
  - `isWord(word)` — dictionary membership, with a small offensive-word blocklist that is always rejected.
  - `wordsFrom(letters, minLength)` — every dictionary word buildable from the given multiset of letters, using each letter at most once.
- Words are indexed by sorted-letter signature at first use so `wordsFrom` is fast enough to run inside puzzle generation.
- The list is imported only through dynamic imports inside server handlers, so it never enters the browser bundle.

## Part 2 — Wordsmith puzzle type

Remove the Anagram type and register `wordsmith` (category *word*, 60-second limit) in its place.

**Generation (server only)**
- Pick a source word from a bank of 200+ common 7- and 8-letter words, run `wordsFrom` on its letters, and accept only boards yielding 20+ words of 4 or more letters (re-roll otherwise).
- Shuffle the tiles so they never spell the source word.
- Public part: the letter tiles. Private part (secrets table): the full valid word list with per-word points and the board's total points.
- Word points: 4 letters = 1, 5 = 2, 6 = 4, 7 = 7, 8 = 11.

**Play**
- One row of large letter tiles (two rows on very narrow screens, 48px tap targets), a gold monospace word bar above them, and a scrolling found-words list.
- Tap tiles to build a word, tap a tile in the bar to return it, or type on the keyboard to highlight matching tiles. Enter or Submit sends the word.
- Every submission is validated on the server (real dictionary word, buildable from the tiles, not already found — a word and that word plus `-S` count once). Valid words slide into the found list with their points flashing gold; invalid or duplicate words shake red and leave the tiles in place, with no penalty.
- Live monospace points counter and a small `words: 6` count, with no hint of how many words remain.
- Shuffle button reorders tiles cosmetically. Done locks early; otherwise the round runs the full 60 seconds. This type never ends the round early for everyone.

**Scoring**
- The client sends only its submitted word list; the server re-validates every word against the stored list.
- `par` = 35% of the board's total available points; `score = min(150, round(150 × points / par))`; no words scores 0.
- `points`, the found words and `par` are stored on the round result.

**Reveal and standings**
- Reveal: the player's words with points, their total against par, and the five highest-scoring words they missed in grey ("You missed: PLANETS (7)").
- Standings line: `7 words · 14 pts`, with the full found list in the expanded row.

**Fixed intro example**
"Make as many words as you can from the letters. Four letters or more." — tiles T A P L N E S beside found words PLANT · PANEL · LEAPT · NEST with points, then "Longer words score more. You have 60 seconds."

## Technical notes

- Puzzle generation is currently synchronous and shared with client code; the generation path becomes async so Wordsmith can generate through a server-only dictionary import. Other types are unaffected.
- A new authenticated server function checks a single word mid-round against the stored private list for real rooms, and an equivalent path handles practice mode's sealed puzzle.
- Grading for this type is done in the existing server-side grading module via the same server-only dictionary import.

## Verification

Play several `/practice` rounds at 390px wide and confirm nonsense is rejected, ordinary words accepted, duplicates caught, boards always offer 20+ words, and a decent run scores in the 40–150 range.
