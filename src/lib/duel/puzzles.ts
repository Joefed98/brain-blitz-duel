import {
  SEQUENCE_LENGTH,
  type AnagramPuzzleData,
  type ArithmeticPuzzleData,
  type PuzzleData,
  type PuzzleType,
  type SequencePuzzleData,
} from "./types";

/**
 * Pluggable puzzle generators. Add a new puzzle type by adding a generator
 * here plus a component that renders it — nothing else needs to change.
 */
export interface PuzzleGenerator {
  type: PuzzleType;
  generate: () => PuzzleData;
  check: (puzzle: PuzzleData, answer: string) => boolean;
}

export const SIX_LETTER_WORDS = [
  "garden","silver","planet","orange","market","winter","summer","guitar","packet","rocket",
  "socket","ticket","basket","castle","bottle","candle","handle","middle","purple","temple",
  "animal","bridge","butter","camera","canvas","carpet","cheese","cherry","circle","coffee",
  "copper","corner","cotton","damage","danger","desert","dinner","doctor","dollar","donkey",
  "dragon","driver","engine","eleven","expert","family","farmer","finger","flower","forest",
  "friend","future","garage","ginger","golden","ground","hammer","hidden","hollow","honest",
  "hunter","island","jacket","jungle","kitten","ladder","laptop","lawyer","legend","letter",
  "lizard","magnet","marble","meadow","member","mirror","monkey","mother","muscle","napkin",
  "nature","needle","nickel","noodle","number","object","office","oxygen","palace","parent",
  "parrot","pencil","people","pepper","person","pillow","pirate","pocket","poison","police",
  "potato","powder","prince","prison","puzzle","rabbit","ribbon","rubber","saddle","salmon",
  "school","season","second","shadow","shield","signal","singer","sister","soccer","spider",
  "spring","square","statue","stream","street","string","studio","sunset","tunnel","turtle",
  "valley","velvet","wallet","window","wizard","yellow",
];

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function scramble(word: string): string {
  const letters = word.toUpperCase().split("");
  let out = word.toUpperCase();
  for (let attempt = 0; attempt < 20 && out === word.toUpperCase(); attempt++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [letters[i], letters[j]] = [letters[j]!, letters[i]!];
    }
    out = letters.join("");
  }
  if (out === word.toUpperCase()) {
    // Guaranteed fallback: rotate the letters.
    out = out.slice(1) + out[0];
  }
  return out;
}

const anagramGenerator: PuzzleGenerator = {
  type: "anagram",
  generate: () => {
    const word = pick(SIX_LETTER_WORDS).toUpperCase();
    return { type: "anagram", word, scrambled: scramble(word) } satisfies AnagramPuzzleData;
  },
  check: (puzzle, answer) =>
    puzzle.type === "anagram" &&
    answer.trim().toUpperCase() === puzzle.word.trim().toUpperCase(),
};

const arithmeticGenerator: PuzzleGenerator = {
  type: "arithmetic",
  generate: () => {
    const op = pick(["+", "-", "×", "÷"] as const);
    let a: number;
    let b: number;
    let answer: number;

    if (op === "+") {
      a = randInt(17, 89);
      b = randInt(17, 89);
      answer = a + b;
    } else if (op === "-") {
      a = randInt(40, 99);
      b = randInt(11, a - 1);
      answer = a - b;
    } else if (op === "×") {
      a = randInt(6, 19);
      b = randInt(3, 9);
      answer = a * b;
    } else {
      b = randInt(3, 9);
      answer = randInt(4, 24);
      a = b * answer;
    }

    return {
      type: "arithmetic",
      expression: `${a} ${op} ${b}`,
      answer,
    } satisfies ArithmeticPuzzleData;
  },
  check: (puzzle, answer) => {
    if (puzzle.type !== "arithmetic") return false;
    const parsed = Number.parseInt(answer.trim(), 10);
    return Number.isFinite(parsed) && parsed === puzzle.answer;
  },
};

const sequenceGenerator: PuzzleGenerator = {
  type: "sequence",
  generate: () => {
    const tiles: number[] = [];
    while (tiles.length < SEQUENCE_LENGTH) {
      const next = randInt(0, 8);
      if (tiles[tiles.length - 1] === next) continue;
      tiles.push(next);
    }
    return { type: "sequence", tiles } satisfies SequencePuzzleData;
  },
  check: (puzzle, answer) => {
    if (puzzle.type !== "sequence") return false;
    const taps = answer
      .split(",")
      .map((v) => Number.parseInt(v, 10))
      .filter((v) => Number.isFinite(v));
    return (
      taps.length === puzzle.tiles.length &&
      taps.every((tap, index) => tap === puzzle.tiles[index])
    );
  },
};

export const PUZZLE_GENERATORS: Record<PuzzleType, PuzzleGenerator> = {
  anagram: anagramGenerator,
  arithmetic: arithmeticGenerator,
  sequence: sequenceGenerator,
};

export function checkAnswer(puzzle: PuzzleData, answer: string): boolean {
  return PUZZLE_GENERATORS[puzzle.type].check(puzzle, answer);
}

/**
 * Generated ONCE when a duel is created and stored in the database so both
 * players receive identical puzzles in an identical order.
 */
export function buildDuelPuzzles(): { roundOrder: PuzzleType[]; puzzles: PuzzleData[] } {
  const roundOrder: PuzzleType[] = ["anagram", "arithmetic", "sequence"];
  for (let i = roundOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roundOrder[i], roundOrder[j]] = [roundOrder[j]!, roundOrder[i]!];
  }
  return {
    roundOrder,
    puzzles: roundOrder.map((type) => PUZZLE_GENERATORS[type].generate()),
  };
}

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += pick(CODE_LETTERS.split(""));
  return code;
}
