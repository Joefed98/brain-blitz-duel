import { pick, shuffled } from "@/lib/duel/random";
import type { OddWordPuzzleData } from "@/lib/duel/types";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

interface OddWordSet {
  theme: string;
  words: [string, string, string];
  odd: string;
}

/** Hard-coded bank of themed sets. The odd word should be plausible at a glance. */
export const ODD_WORD_SETS: OddWordSet[] = [
  { theme: "Citrus", words: ["Lemon", "Lime", "Grapefruit"], odd: "Plum" },
  { theme: "Planets", words: ["Venus", "Mars", "Neptune"], odd: "Titan" },
  { theme: "Currencies", words: ["Peso", "Rupee", "Krona"], odd: "Karat" },
  { theme: "Chess pieces", words: ["Rook", "Bishop", "Knight"], odd: "Jester" },
  { theme: "String instruments", words: ["Cello", "Viola", "Harp"], odd: "Oboe" },
  { theme: "Big cats", words: ["Jaguar", "Leopard", "Cougar"], odd: "Hyena" },
  { theme: "Noble gases", words: ["Argon", "Neon", "Xenon"], odd: "Nitrogen" },
  { theme: "Greek letters", words: ["Sigma", "Delta", "Omega"], odd: "Zenith" },
  { theme: "Shades of blue", words: ["Cobalt", "Azure", "Navy"], odd: "Ochre" },
  { theme: "Italian cities", words: ["Turin", "Naples", "Verona"], odd: "Valencia" },
  { theme: "Card suits", words: ["Spades", "Clubs", "Hearts"], odd: "Crowns" },
  { theme: "Types of cloud", words: ["Cirrus", "Cumulus", "Stratus"], odd: "Corona" },
  { theme: "Herbs", words: ["Basil", "Thyme", "Oregano"], odd: "Paprika" },
  { theme: "Mountain ranges", words: ["Andes", "Alps", "Urals"], odd: "Sahara" },
  { theme: "Woodwind instruments", words: ["Clarinet", "Flute", "Bassoon"], odd: "Trombone" },
  { theme: "Root vegetables", words: ["Turnip", "Parsnip", "Beetroot"], odd: "Courgette" },
  { theme: "Bones", words: ["Femur", "Tibia", "Sternum"], odd: "Cornea" },
  { theme: "Precious stones", words: ["Ruby", "Sapphire", "Emerald"], odd: "Granite" },
  { theme: "Reptiles", words: ["Gecko", "Iguana", "Python"], odd: "Newt" },
  { theme: "Pasta shapes", words: ["Penne", "Fusilli", "Rigatoni"], odd: "Risotto" },
  { theme: "Oceans", words: ["Pacific", "Arctic", "Indian"], odd: "Caspian" },
  { theme: "Triangles", words: ["Scalene", "Isosceles", "Equilateral"], odd: "Rhombus" },
  { theme: "Wind instruments of brass", words: ["Tuba", "Cornet", "Bugle"], odd: "Sitar" },
  { theme: "Shakespeare plays", words: ["Macbeth", "Othello", "Hamlet"], odd: "Faustus" },
  { theme: "Units of length", words: ["Furlong", "Fathom", "League"], odd: "Bushel" },
  { theme: "Birds of prey", words: ["Falcon", "Osprey", "Kestrel"], odd: "Pelican" },
  { theme: "Deserts", words: ["Gobi", "Kalahari", "Atacama"], odd: "Serengeti" },
  { theme: "Vitamins", words: ["Thiamine", "Niacin", "Folate"], odd: "Keratin" },
  { theme: "Nordic capitals", words: ["Oslo", "Helsinki", "Reykjavik"], odd: "Riga" },
  { theme: "Mushrooms", words: ["Shiitake", "Portobello", "Chanterelle"], odd: "Artichoke" },
  { theme: "Dog breeds", words: ["Beagle", "Whippet", "Dachshund"], odd: "Ocelot" },
  { theme: "Chemical elements", words: ["Cobalt", "Bismuth", "Tungsten"], odd: "Bakelite" },
  { theme: "Sails and rigging", words: ["Mainsail", "Jib", "Spinnaker"], odd: "Rudder" },
  { theme: "Dances", words: ["Tango", "Waltz", "Foxtrot"], odd: "Sonata" },
  { theme: "Cheeses", words: ["Gouda", "Brie", "Manchego"], odd: "Chorizo" },
  { theme: "Rivers of Europe", words: ["Danube", "Rhine", "Elbe"], odd: "Congo" },
  { theme: "Shellfish", words: ["Mussel", "Scallop", "Clam"], odd: "Herring" },
  { theme: "Poetic forms", words: ["Sonnet", "Haiku", "Limerick"], odd: "Fresco" },
  { theme: "Martial arts", words: ["Judo", "Karate", "Aikido"], odd: "Kabuki" },
  { theme: "Winter sports", words: ["Luge", "Biathlon", "Curling"], odd: "Kayaking" },
  { theme: "Types of rock", words: ["Basalt", "Marble", "Slate"], odd: "Bronze" },
  { theme: "Knots", words: ["Bowline", "Clove hitch", "Sheet bend"], odd: "Bobbin" },
  { theme: "Constellations", words: ["Orion", "Lyra", "Cassiopeia"], odd: "Halley" },
  { theme: "Spanish cities", words: ["Seville", "Granada", "Bilbao"], odd: "Porto" },
  { theme: "Coffee drinks", words: ["Macchiato", "Cortado", "Ristretto"], odd: "Matcha" },
  { theme: "Boat types", words: ["Schooner", "Catamaran", "Trawler"], odd: "Cabriolet" },
  { theme: "Fabrics", words: ["Linen", "Chiffon", "Denim"], odd: "Lacquer" },
  { theme: "Bread", words: ["Ciabatta", "Focaccia", "Brioche"], odd: "Polenta" },
  { theme: "Hats", words: ["Fedora", "Beret", "Trilby"], odd: "Cravat" },
  { theme: "Tennis Grand Slams", words: ["Wimbledon", "Roland Garros", "Flushing Meadows"], odd: "Augusta" },
  { theme: "Rainforest animals", words: ["Toucan", "Sloth", "Tapir"], odd: "Wombat" },
  { theme: "Musical tempos", words: ["Allegro", "Adagio", "Andante"], odd: "Arpeggio" },
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
