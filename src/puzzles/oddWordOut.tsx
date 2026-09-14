import { pick, shuffled } from "@/lib/duel/random";
import type { OddWordPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

interface OddWordSet {
  theme: string;
  words: [string, string, string];
  odd: string;
}

/**
 * Hard-coded bank of hidden-rule sets. The shared rule is never a plain
 * category — it has to be worked out — and exactly one word breaks it.
 */
export const ODD_WORD_SETS: OddWordSet[] = [
  { theme: "They can all come before BOARD", words: ["Key", "Black", "Skate"], odd: "Chair" },
  { theme: "They are all anagrams of animals", words: ["Bare", "Flow", "Shore"], odd: "Prism" },
  { theme: "They all hide a country", words: ["Perusal", "Chinatown", "Malice"], odd: "Cabinet" },
  { theme: "They all start with a silent letter", words: ["Knight", "Gnome", "Wrist"], odd: "Ghost" },
  { theme: "They are all units of measurement", words: ["Second", "Yard", "Stone"], odd: "Brick" },
  { theme: "They can all follow SUN", words: ["Flower", "Shine", "Burn"], odd: "Storm" },
  { theme: "They all hide a body part", words: ["Charming", "Slipper", "Beard"], odd: "Candle" },
  { theme: "They all hide a number", words: ["Often", "Freighter", "Stone"], odd: "Camera" },
  { theme: "They all sound like a single letter", words: ["Bee", "Sea", "Why"], odd: "Tree" },
  { theme: "They all spell another word backwards", words: ["Stressed", "Diaper", "Straw"], odd: "Bottle" },
  { theme: "They can all come before LIGHT", words: ["Day", "Moon", "Flash"], odd: "Water" },
  { theme: "They can all follow FIRE", words: ["Fly", "Place", "Wood"], odd: "Metal" },
  { theme: "They all hide a colour", words: ["Screen", "Charred", "Brownie"], odd: "Sparkle" },
  { theme: "They can all come before ACHE", words: ["Head", "Heart", "Tooth"], odd: "Hand" },
  { theme: "They can all follow BLACK", words: ["Bird", "Smith", "Board"], odd: "Cloud" },
  { theme: "They all hide an animal", words: ["Scowl", "Grateful", "Bullet"], odd: "Pattern" },
  { theme: "They all hide a musical instrument", words: ["Conundrum", "Harpoon", "Organic"], odd: "Melody" },
  { theme: "They can all come before WAY", words: ["High", "Sub", "Drive"], odd: "Path" },
  { theme: "They can all follow OVER", words: ["Look", "Coat", "Night"], odd: "Under" },
  { theme: "They are all palindromes", words: ["Level", "Rotor", "Civic"], odd: "Rider" },
  { theme: "They all hide three letters in alphabetical order", words: ["Understudy", "Defiant", "Hijack"], odd: "Rampant" },
  { theme: "They are all card games", words: ["Bridge", "Patience", "Rummy"], odd: "Marble" },
  { theme: "They all contain a silent B", words: ["Thumb", "Comb", "Doubt"], odd: "Rabbit" },
  { theme: "They all contain a silent L", words: ["Calm", "Salmon", "Yolk"], odd: "Melon" },
  { theme: "They can all come before PRINT", words: ["Foot", "Blue", "Finger"], odd: "Sun" },
  { theme: "They all hide a fruit", words: ["Plumber", "Grapple", "Dateline"], odd: "Marigold" },
  { theme: "They can all follow GREEN", words: ["House", "Horn", "Land"], odd: "Stone" },
  { theme: "They are all anagrams of countries", words: ["Chain", "Rain", "Pure"], odd: "Shore" },
  { theme: "They can all come before HOLE", words: ["Man", "Key", "Pot"], odd: "Door" },
  { theme: "They can all follow BOOK", words: ["Case", "Mark", "Shelf"], odd: "Table" },
  { theme: "They can all come before STORM", words: ["Brain", "Snow", "Thunder"], odd: "Cloud" },
  { theme: "They can all follow BACK", words: ["Bone", "Pack", "Ground"], odd: "Front" },
  { theme: "They all hide a metal", words: ["Ironic", "Tinker", "Leadership"], odd: "Plastic" },
  { theme: "They all start and end with the same letter", words: ["Tenement", "Redder", "Nylon"], odd: "Candle" },
  { theme: "They all hide the word EAT", words: ["Feather", "Sweater", "Theatre"], odd: "Feature" },
  { theme: "They can all come before WATCH", words: ["Wrist", "Night", "Stop"], odd: "Clock" },
  { theme: "They can all follow HORSE", words: ["Shoe", "Power", "Radish"], odd: "Wagon" },
  { theme: "They all hide a bird", words: ["Crown", "Henceforth", "Emulate"], odd: "Trumpet" },
  { theme: "They can all come before BAND", words: ["Head", "Rubber", "Waist"], odd: "Ankle" },
  { theme: "They can all follow WATER", words: ["Fall", "Melon", "Proof"], odd: "Candle" },
  { theme: "They all contain a silent W", words: ["Wrench", "Answer", "Sword"], odd: "Winter" },
  { theme: "They all contain a silent H", words: ["Ghost", "Rhythm", "Honest"], odd: "House" },
  { theme: "They all hide a vegetable", words: ["Corner", "Peasant", "Sleek"], odd: "Tractor" },
  { theme: "They can all come before ROOM", words: ["Bath", "Mush", "Class"], odd: "Table" },
  { theme: "They can all follow UP", words: ["Hold", "Right", "Set"], odd: "Down" },
  { theme: "They all hide the word ART", words: ["Started", "Particle", "Departure"], odd: "Painting" },
  { theme: "They can all come before BERRY", words: ["Blue", "Straw", "Goose"], odd: "Apple" },
  { theme: "They can all follow EYE", words: ["Ball", "Brow", "Lash"], odd: "Nose" },
  { theme: "They all hide a tree", words: ["Ashamed", "Firmly", "Teakettle"], odd: "Woodland" },
  { theme: "They all hide the word ICE", words: ["Police", "Notice", "Service"], odd: "Freeze" },
  { theme: "They all hide the word ONE", words: ["Money", "Honey", "Prone"], odd: "Nobody" },
  { theme: "They can all come before BALL", words: ["Foot", "Snow", "Eye"], odd: "Chair" },
  { theme: "They can all follow NEWS", words: ["Paper", "Cast", "Letter"], odd: "Window" },
  { theme: "They all contain a silent P", words: ["Psychic", "Pneumonia", "Receipt"], odd: "Pepper" },
  { theme: "They all hide the word CAT", words: ["Delicate", "Locate", "Vacation"], odd: "Domino" },
  { theme: "They all hide the word RAT", words: ["Grateful", "Crater", "Pirate"], odd: "Portrait" },
  { theme: "They can all come before WORK", words: ["Home", "Net", "Frame"], odd: "Table" },
  { theme: "They can all follow DAY", words: ["Break", "Dream", "Light"], odd: "Night" },
  { theme: "They all contain a silent T", words: ["Listen", "Castle", "Fasten"], odd: "Master" },
  { theme: "They all hide the word AGE", words: ["Manager", "Package", "Village"], odd: "Bandit" },
  { theme: "They can all come before MAN", words: ["Fire", "Post", "Snow"], odd: "Rain" },
  { theme: "They can all follow FOOT", words: ["Print", "Ball", "Note"], odd: "Chair" },
  { theme: "They all hide the word EAR", words: ["Beard", "Search", "Yearly"], odd: "Silence" },
  { theme: "They can all come before PIPE", words: ["Bag", "Wind", "Drain"], odd: "Stove" },
  { theme: "They can all follow MOON", words: ["Light", "Beam", "Walk"], odd: "Storm" },
  { theme: "They all hide the word PEN", words: ["Expensive", "Happen", "Opening"], odd: "Marble" },
  { theme: "They all hide the word CAR", words: ["Scarf", "Vicar", "Discard"], odd: "Wagon" },
  { theme: "They can all follow TOOTH", words: ["Ache", "Brush", "Paste"], odd: "Water" },
];

function IntroExample() {
  const tiles = ["Apple", "Banana", "Carrot", "Cherry"];
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Three words share a theme. Tap the one that doesn't fit.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((word) => (
          <span
            key={word}
            className={`flex h-12 w-[104px] items-center justify-center rounded-lg border font-display text-sm font-bold ${
              word === "Carrot"
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-card text-foreground"
            }`}
          >
            {word}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Tap once to lock your answer. Faster = more points.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit }: PuzzleStageProps) {
  if (puzzle.type !== "oddword") return null;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-7">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Tap the odd one out
      </p>
      <div className="grid grid-cols-2 gap-3">
        {puzzle.words.map((word) => (
          <button
            key={word}
            type="button"
            disabled={locked}
            onClick={() => !locked && onSubmit(word)}
            className="flex h-24 w-[148px] items-center justify-center rounded-xl border border-border bg-card px-2 text-center font-display text-lg font-bold text-foreground disabled:opacity-50"
          >
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect }: PuzzleRevealProps) {
  if (puzzle.type !== "oddword") return null;
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {puzzle.words.map((word) => (
          <span
            key={word}
            className={`flex h-14 w-[136px] items-center justify-center rounded-xl border px-2 text-center font-display text-base font-bold ${
              word === puzzle.odd
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {word}
          </span>
        ))}
      </div>
      <p className="font-mono text-sm text-muted-foreground">Theme: {puzzle.theme}</p>
      <div className="flex w-full flex-col items-center gap-3 rounded-2xl bg-card px-4 py-5">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Your answer</p>
        {!myAnswer ? (
          <p className="font-display text-2xl font-bold text-warn">No answer</p>
        ) : (
          <p
            className={`font-display text-2xl font-bold ${
              myCorrect ? "text-primary" : "text-warn"
            }`}
          >
            {myAnswer} {myCorrect ? "✓" : "✗"}
          </p>
        )}
      </div>
    </>
  );
}

export const oddWordPuzzle: PuzzleDefinition = {
  key: "oddword",
  name: "Odd-Word-Out",
  category: "word",
  generate: () => {
    const set = pick(ODD_WORD_SETS);
    return {
      type: "oddword",
      theme: set.theme,
      words: shuffled([...set.words, set.odd]),
      odd: set.odd,
    } satisfies OddWordPuzzleData;
  },
  check: (answer, puzzle) =>
    puzzle.type === "oddword" &&
    answer.trim().toLowerCase() === puzzle.odd.trim().toLowerCase(),
  IntroExample,
  Stage,
  Reveal,
};
