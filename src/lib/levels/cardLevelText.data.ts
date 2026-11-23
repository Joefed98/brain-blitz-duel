/**
 * The Cards & Board levels' words (the overhaul's stage 3, 15 Nov 2026), written by scripts/cards-level-text.ts (do not
 * edit by hand): for each game and level, its goal, what changes (shown under HOW), the intro's SCORE line and the "?"
 * help's SCORE text (from the level's own spec). Plain data, so the phone loads no game code for it.
 */
export interface CardLevelText {
  goal: string;
  how: readonly string[];
  intro: string;
  score: string;
}

export const CARD_LEVEL_TEXT: Readonly<Record<string, Readonly<Record<"easy" | "hard" | "expert", CardLevelText>>>> = {
  "freecell": {
    "easy": {
      "goal": "Get all 32 cards home, fast, in two minutes.",
      "how": [
        "32 cards (Ace to 8), 5 free cells.",
        "Undo is free and unlimited.",
        "Hints are free: the Hint button lights one good move, and it lights by itself after 8 s without a move."
      ],
      "intro": "Move all 32 cards home; bonuses for few moves and speed. Up to 200.",
      "score": "Cards: every card home scores, a card in a sorted run on the columns half as much; all 32 home for all of it, up to 105. Par moves: finish within an eighth over the deal’s fewest moves (par) for all of it, nothing at twice par, up to 50. Speed: finish within 60 s for all of it, falling to 0 at the buzzer, up to 45. Total 200."
    },
    "hard": {
      "goal": "Get all 40 cards home, fast, in two minutes.",
      "how": [
        "40 cards (Ace to 10), 3 free cells.",
        "Undo counts as a move."
      ],
      "intro": "Move all 40 cards home; bonuses for few moves and speed. Up to 200.",
      "score": "Cards: every card home scores, a card in a sorted run on the columns half as much; all 40 home for all of it, up to 105. Par moves: finish within an eighth over the deal’s fewest moves (par) for all of it, nothing at one and a half times par, up to 50. Speed: finish within 33 s for all of it, falling to 0 at the buzzer, up to 45. Total 200."
    },
    "expert": {
      "goal": "Get all 48 cards home, fast, in two minutes.",
      "how": [
        "48 cards (Ace to 12), 2 free cells, only the deals solved in 50 moves or fewer.",
        "3 undos, each a move."
      ],
      "intro": "Move all 48 cards home; bonuses for few moves and speed. Up to 200.",
      "score": "Cards: every card home scores, a card in a sorted run on the columns half as much; all 48 home for all of it, up to 105. Par moves: finish within a quarter over the deal’s fewest moves (par) for all of it, nothing at one and a half times par, up to 50. Speed: finish within 45 s for all of it, falling to 0 at the buzzer, up to 45. Total 200."
    }
  },
  "mahjong": {
    "easy": {
      "goal": "Clear all 48 tiles in pairs.",
      "how": [
        "48 tiles in 2 layers; 2 faces appear four times, so pick which pair to take carefully.",
        "A shuffle costs 2.",
        "Hints are free: the Hint button lights one good move, and it lights by itself after 8 s without a move."
      ],
      "intro": "Clear pairs of the 48 tiles; bonuses for no shuffles and speed. Up to 200.",
      "score": "Pairs: clear the 24 pairs, each worth the same, up to 150. No shuffles: the same again for each pair, all of it lost on your first shuffle; each shuffle costs 2, up to 20. Speed: clear the board within 70 s for all of it, falling to 0 at the buzzer, up to 30. Total 200."
    },
    "hard": {
      "goal": "Clear all 104 tiles in pairs.",
      "how": [
        "104 tiles in 4 layers; 18 faces appear four times, so pick which pair to take carefully.",
        "A shuffle costs 10."
      ],
      "intro": "Clear pairs of the 104 tiles; bonuses for no shuffles and speed. Up to 200.",
      "score": "Pairs: clear the 52 pairs, each worth the same, up to 150. No shuffles: the same again for each pair, all of it lost on your first shuffle; each shuffle costs 10, up to 20. Speed: clear the board within 79 s for all of it, falling to 0 at the buzzer, up to 30. Total 200."
    },
    "expert": {
      "goal": "Clear all 136 tiles in pairs in 110 seconds.",
      "how": [
        "136 tiles in 4 layers; every face appears four times, so pick which pair to take carefully.",
        "A shuffle costs 15."
      ],
      "intro": "Clear pairs of the 136 tiles; bonuses for no shuffles and speed. Up to 200.",
      "score": "Pairs: clear the 68 pairs, each worth the same, up to 150. No shuffles: the same again for each pair, all of it lost on your first shuffle; each shuffle costs 15, up to 20. Speed: clear the board within 100 s for all of it, falling to 0 at the buzzer, up to 30. Total 200."
    }
  },
  "tripeaks": {
    "easy": {
      "goal": "Clear the three peaks, one up or down from the discard, in 90 seconds.",
      "how": [
        "90 seconds; the whole stock; the easiest deals.",
        "Playable cards glow; Ace and King wrap.",
        "3 undos, back one play or stock card each. Hints are free: the Hint button lights one good move, and it lights by itself after 8 s without a move."
      ],
      "intro": "Clear the peaks in long runs; speed full by 30 s. Up to 200.",
      "score": "Cards cleared: clear the 28 peak cards, each worth the same, up to 105. Peak tops: 10 for each peak top cleared, up to 30. Longest run: a run of 5 cards in a row for all of it, up to 10. Clear: clear all 28, up to 10. Stock par: clear all 28 turning the stock no more than 10 over the deal’s par for all of it, nothing if you turned it all, up to 20. Speed: clear all 28 within 30 s for all of it, falling to 0 at the buzzer, up to 25. Total 200."
    },
    "hard": {
      "goal": "Clear the three peaks, one up or down from the discard, in 45 seconds.",
      "how": [
        "45 seconds; the stock cut to 18 cards.",
        "No glow: find the playable cards yourself; Ace and King wrap.",
        "No undo and no hints."
      ],
      "intro": "Clear the peaks in long runs; speed full by 31 s. Up to 200.",
      "score": "Cards cleared: clear the 28 peak cards, each worth the same, up to 105. Peak tops: 10 for each peak top cleared, up to 30. Longest run: a run of 6 cards in a row for all of it, up to 10. Clear: clear all 28, up to 10. Stock par: clear all 28 turning the stock no more than 8 over the deal’s par for all of it, nothing if you turned it all, up to 20. Speed: clear all 28 within 31 s for all of it, falling to 0 at the buzzer, up to 25. Total 200."
    },
    "expert": {
      "goal": "Clear the three peaks, one up or down from the discard, in 32 seconds.",
      "how": [
        "32 seconds; the stock cut to 14 cards.",
        "No glow: find the playable cards yourself; Ace and King wrap.",
        "No undo and no hints."
      ],
      "intro": "Clear the peaks in long runs; speed full by 27 s. Up to 200.",
      "score": "Cards cleared: clear the 28 peak cards, each worth the same, up to 105. Peak tops: 10 for each peak top cleared, up to 30. Longest run: a run of 6 cards in a row for all of it, up to 10. Clear: clear all 28, up to 10. Stock par: clear all 28 turning the stock no more than 5 over the deal’s par for all of it, nothing if you turned it all, up to 20. Speed: clear all 28 within 27 s for all of it, falling to 0 at the buzzer, up to 25. Total 200."
    }
  },
  "fivehands": {
    "easy": {
      "goal": "Build five poker hands, then pick a column. 90 s, about 4.3 s a card.",
      "how": [
        "90 seconds for your 20 cards; 200 at 94 hand points.",
        "The next 2 cards show beside yours, and each column's value shows while you pick.",
        "Hints are free: the Hint button lights one good move, and it lights by itself after 8 s without a move."
      ],
      "intro": "Make poker hands in five rows, then pick a column; 200 at 94 hand points. Up to 200.",
      "score": "Hand points: your five rows’ hands plus the column you pick, 200 at 94 hand points (pair 15, two pair 20, three of a kind 25, straight 30, flush 35, full house 40, four of a kind 45, straight flush 50), up to 200. Total 200."
    },
    "hard": {
      "goal": "Build five poker hands, then pick a column. 42 s, about 2 s a card.",
      "how": [
        "42 seconds for your 20 cards; 200 at 100 hand points; pair 10, two pair 20 (bigger hands pay as Normal).",
        "No preview of the next cards, no column values and no hints."
      ],
      "intro": "Make poker hands in five rows, then pick a column; 200 at 100 hand points. Up to 200.",
      "score": "Hand points: your five rows’ hands plus the column you pick, 200 at 100 hand points (pair 10, two pair 20, three of a kind 25, straight 30, flush 35, full house 40, four of a kind 45, straight flush 50), up to 200. Total 200."
    },
    "expert": {
      "goal": "Build five poker hands, then pick a column. 30 s, about 1.4 s a card.",
      "how": [
        "30 seconds for your 20 cards; 200 at 104 hand points; pair 10, two pair 15 (bigger hands pay as Normal).",
        "No preview of the next cards, no column values and no hints."
      ],
      "intro": "Make poker hands in five rows, then pick a column; 200 at 104 hand points. Up to 200.",
      "score": "Hand points: your five rows’ hands plus the column you pick, 200 at 104 hand points (pair 10, two pair 15, three of a kind 25, straight 30, flush 35, full house 40, four of a kind 45, straight flush 50), up to 200. Total 200."
    }
  },
  "pyramid": {
    "easy": {
      "goal": "Clear the pyramid in pairs that add to 13.",
      "how": [
        "6 rows: 21 cards, 31 in the stock; 3 passes through it; 1 or 3 Kings in the pyramid.",
        "A picked card's partners glow.",
        "Hints are free: the Hint button lights one good move, and it lights by itself after 8 s without a move."
      ],
      "intro": "Clear the 6-row pyramid in pairs to 13; bonuses for a clear and speed. Up to 200.",
      "score": "Pyramid cards: remove the 21 pyramid cards, each worth the same, up to 140. Cleared: remove all 21, up to 15. Speed: clear it within 20 s for all of it, falling to 0 at the buzzer, up to 25. Pyramid pairs: pairs made of two pyramid cards, all of it at 9, up to 20. Total 200."
    },
    "hard": {
      "goal": "Clear the pyramid in pairs that add to 13.",
      "how": [
        "8 rows: 36 cards, 16 in the stock; one pass through it; 2 or 4 Kings in the pyramid.",
        "No glow and no hints: find each card's partner yourself."
      ],
      "intro": "Clear the 8-row pyramid in pairs to 13; bonuses for a clear and speed. Up to 200.",
      "score": "Pyramid cards: remove the 36 pyramid cards, each worth the same, up to 140. Cleared: remove all 36, up to 15. Speed: clear it within 35 s for all of it, falling to 0 at the buzzer, up to 25. Pyramid pairs: pairs made of two pyramid cards, all of it at 16, up to 20. Total 200."
    },
    "expert": {
      "goal": "Clear the pyramid in pairs that add to 13.",
      "how": [
        "9 rows: 45 cards, 7 in the stock; one pass through it; 3 Kings in the pyramid.",
        "No glow and no hints: find each card's partner yourself."
      ],
      "intro": "Clear the 9-row pyramid in pairs to 13; bonuses for a clear and speed. Up to 200.",
      "score": "Pyramid cards: remove the 45 pyramid cards, each worth the same, up to 140. Cleared: remove all 45, up to 15. Speed: clear it within 42 s for all of it, falling to 0 at the buzzer, up to 25. Pyramid pairs: pairs made of two pyramid cards, all of it at 21, up to 20. Total 200."
    }
  }
};
