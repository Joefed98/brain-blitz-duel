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
      "score": "Cards: every card home scores, a card in a sorted run on the columns half as much; all 32 home for all of it, up to 105. Par moves: finish in the deal’s fewest moves (par) for all of it, nothing at twice par, up to 50. Speed: finish within 60 s for all of it, falling to 0 at the buzzer, up to 45. Total 200."
    },
    "hard": {
      "goal": "Get all 52 cards home, fast, in two minutes.",
      "how": [
        "52 cards (Ace to King), 4 free cells, deals with short solutions.",
        "Undo counts as a move.",
        "Hints: the Hint button lights one good move, 5 points each."
      ],
      "intro": "Move all 52 cards home; bonuses for few moves and speed. Up to 200.",
      "score": "Cards: every card home scores, a card in a sorted run on the columns half as much; all 52 home for all of it; each hint costs 5, up to 105. Par moves: finish in the deal’s fewest moves (par) for all of it, nothing at one and a quarter times par, up to 50. Speed: finish within 25 s for all of it, falling to 0 at the buzzer, up to 45. Total 200."
    },
    "expert": {
      "goal": "Get all 52 cards home, fast, in two minutes.",
      "how": [
        "52 cards (Ace to King), 3 free cells, only the deals with the shortest solutions.",
        "3 undos, each a move.",
        "One hint this round: the Hint button lights one good move."
      ],
      "intro": "Move all 52 cards home; bonuses for few moves and speed. Up to 200.",
      "score": "Cards: every card home scores, a card in a sorted run on the columns half as much; all 52 home for all of it, up to 105. Par moves: finish in the deal’s fewest moves (par) for all of it, nothing at one and a quarter times par, up to 50. Speed: finish within 25 s for all of it, falling to 0 at the buzzer, up to 45. Total 200."
    }
  },
  "mahjong": {
    "easy": {
      "goal": "Clear all 56 tiles in pairs.",
      "how": [
        "56 tiles in 3 layers; 2 faces appear four times, so pick which pair to take carefully.",
        "A shuffle costs 2.",
        "Hints are free: the Hint button lights one good move, and it lights by itself after 8 s without a move."
      ],
      "intro": "Clear pairs of the 56 tiles; bonuses for no shuffles and speed. Up to 200.",
      "score": "Pairs: clear the 28 pairs, each worth the same, up to 150. No shuffles: the same again for each pair, all of it lost on your first shuffle; each shuffle costs 2, up to 20. Speed: clear the board within 70 s for all of it, falling to 0 at the buzzer, up to 30. Total 200."
    },
    "hard": {
      "goal": "Clear all 72 tiles in pairs.",
      "how": [
        "72 tiles in 4 layers; 10 faces appear four times, so pick which pair to take carefully.",
        "A shuffle costs 8.",
        "Hints: the Hint button lights one good move, 5 points each."
      ],
      "intro": "Clear pairs of the 72 tiles; bonuses for no shuffles and speed. Up to 200.",
      "score": "Pairs: clear the 36 pairs, each worth the same, up to 150. No shuffles: the same again for each pair, all of it lost on your first shuffle; each shuffle costs 8, each hint 5, up to 20. Speed: clear the board within 25 s for all of it, falling to 0 at the buzzer, up to 30. Total 200."
    },
    "expert": {
      "goal": "Clear all 88 tiles in pairs.",
      "how": [
        "88 tiles in 5 layers; 12 faces appear four times, so pick which pair to take carefully.",
        "A shuffle costs 10.",
        "One hint this round: the Hint button lights one good move."
      ],
      "intro": "Clear pairs of the 88 tiles; bonuses for no shuffles and speed. Up to 200.",
      "score": "Pairs: clear the 44 pairs, each worth the same, up to 150. No shuffles: the same again for each pair, all of it lost on your first shuffle; each shuffle costs 10, up to 20. Speed: clear the board within 30 s for all of it, falling to 0 at the buzzer, up to 30. Total 200."
    }
  },
  "tripeaks": {
    "easy": {
      "goal": "Clear the three peaks, one up or down from the discard.",
      "how": [
        "Playable cards glow; Ace and King wrap.",
        "3 undos, back one play or stock card each.",
        "Hints are free: the Hint button lights one good move, and it lights by itself after 8 s without a move."
      ],
      "intro": "Clear the peaks in long runs; speed full by 25 s. Up to 200.",
      "score": "Cards cleared: clear the 28 peak cards, each worth the same, up to 105. Peak tops: 10 for each peak top cleared, up to 30. Longest run: 1 for each card in your longest run, up to 10. Clear: clear all 28, up to 10. Stock par: clear all 28 turning the stock no more than the deal’s par for all of it, nothing if you turned it all, up to 20. Speed: clear all 28 within 25 s for all of it, falling to 0 at the buzzer, up to 25. Total 200."
    },
    "hard": {
      "goal": "Clear the three peaks, one up or down from the discard.",
      "how": [
        "No glow: find the playable cards yourself; Ace and King wrap.",
        "No undo.",
        "Hints: the Hint button lights one good move, 5 points each."
      ],
      "intro": "Clear the peaks in long runs; speed full by 20 s. Up to 200.",
      "score": "Cards cleared: clear the 28 peak cards, each worth the same; each hint costs 5, up to 105. Peak tops: 10 for each peak top cleared, up to 30. Longest run: 1 for each card in your longest run, up to 10. Clear: clear all 28, up to 10. Stock par: clear all 28 turning the stock no more than the deal’s par for all of it, nothing if you turned it all, up to 20. Speed: clear all 28 within 20 s for all of it, falling to 0 at the buzzer, up to 25. Total 200."
    },
    "expert": {
      "goal": "Clear the three peaks, one up or down from the discard.",
      "how": [
        "No glow: find the playable cards yourself; no wrap: an Ace never goes on a King or a King on an Ace.",
        "No undo.",
        "One hint this round: the Hint button lights one good move."
      ],
      "intro": "Clear the peaks in long runs; speed full by 16 s. Up to 200.",
      "score": "Cards cleared: clear the 28 peak cards, each worth the same, up to 105. Peak tops: 10 for each peak top cleared, up to 30. Longest run: 1 for each card in your longest run, up to 10. Clear: clear all 28, up to 10. Stock par: clear all 28 turning the stock no more than the deal’s par for all of it, nothing if you turned it all, up to 20. Speed: clear all 28 within 16 s for all of it, falling to 0 at the buzzer, up to 25. Total 200."
    }
  },
  "fivehands": {
    "easy": {
      "goal": "Build five poker hands, then pick a column. ×1.6, 75 s.",
      "how": [
        "Your hand points × 1.6; 75 seconds.",
        "The next 2 cards show beside yours, and each column's value shows while you pick.",
        "Hints are free: the Hint button lights one good move, and it lights by itself after 8 s without a move."
      ],
      "intro": "Make poker hands in five rows, then pick a column; × 1.6. Up to 200.",
      "score": "Hand points: your five rows’ hands plus the column you pick, times 1.6 (pair 15, two pair 20, three of a kind 25, straight 30, flush 35, full house 40, four of a kind 45, straight flush 50), up to 200. Total 200."
    },
    "hard": {
      "goal": "Build five poker hands, then pick a column. ×1.4, 50 s.",
      "how": [
        "Your hand points × 1.4; 50 seconds.",
        "Hints: the Hint button lights one good move, 5 points each."
      ],
      "intro": "Make poker hands in five rows, then pick a column; × 1.4. Up to 200.",
      "score": "Hand points: your five rows’ hands plus the column you pick, times 1.4 (pair 15, two pair 20, three of a kind 25, straight 30, flush 35, full house 40, four of a kind 45, straight flush 50); each hint costs 5, up to 200. Total 200."
    },
    "expert": {
      "goal": "Build five poker hands, then pick a column. ×1.3, 45 s.",
      "how": [
        "Your hand points × 1.3; 45 seconds.",
        "One hint this round: the Hint button lights one good move."
      ],
      "intro": "Make poker hands in five rows, then pick a column; × 1.3. Up to 200.",
      "score": "Hand points: your five rows’ hands plus the column you pick, times 1.3 (pair 15, two pair 20, three of a kind 25, straight 30, flush 35, full house 40, four of a kind 45, straight flush 50), up to 200. Total 200."
    }
  },
  "pyramid": {
    "easy": {
      "goal": "Clear the pyramid in pairs that add to 13.",
      "how": [
        "3 passes through the stock; 3–4 Kings in the pyramid.",
        "A picked card's partners glow.",
        "Hints are free: the Hint button lights one good move, and it lights by itself after 8 s without a move."
      ],
      "intro": "Clear the pyramid in pairs to 13; bonuses for a clear and speed. Up to 200.",
      "score": "Pyramid cards: remove the 28 pyramid cards, each worth the same, up to 140. Cleared: remove all 28, up to 15. Speed: clear it within 20 s for all of it, falling to 0 at the buzzer, up to 25. Pyramid pairs: 2 for each pair made of two pyramid cards, up to 20. Total 200."
    },
    "hard": {
      "goal": "Clear the pyramid in pairs that add to 13.",
      "how": [
        "One pass through the stock; 2–3 Kings in the pyramid; harder deals.",
        "No glow: find each card's partner yourself.",
        "Hints: the Hint button lights one good move, 5 points each."
      ],
      "intro": "Clear the pyramid in pairs to 13; bonuses for a clear and speed. Up to 200.",
      "score": "Pyramid cards: remove the 28 pyramid cards, each worth the same; each hint costs 5, up to 140. Cleared: remove all 28, up to 15. Speed: clear it within 20 s for all of it, falling to 0 at the buzzer, up to 25. Pyramid pairs: 2 for each pair made of two pyramid cards, up to 20. Total 200."
    },
    "expert": {
      "goal": "Clear the pyramid in pairs that add to 13.",
      "how": [
        "One pass through the stock; 2 Kings in the pyramid; the hardest deals.",
        "No glow: find each card's partner yourself.",
        "One hint this round: the Hint button lights one good move."
      ],
      "intro": "Clear the pyramid in pairs to 13; bonuses for a clear and speed. Up to 200.",
      "score": "Pyramid cards: remove the 28 pyramid cards, each worth the same, up to 140. Cleared: remove all 28, up to 15. Speed: clear it within 20 s for all of it, falling to 0 at the buzzer, up to 25. Pyramid pairs: 2 for each pair made of two pyramid cards, up to 20. Total 200."
    }
  }
};
