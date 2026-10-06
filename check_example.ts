import { withSeededRandom } from "./src/lib/duel/random";
import { generateWordsmith } from "./src/lib/duel/wordsmith.server";
import { INTRO_EXAMPLE_SEED } from "./src/lib/duel/puzzleDemo";

const made = withSeededRandom(INTRO_EXAMPLE_SEED, () => generateWordsmith(9));
console.log("Example board letters:", made.letters);
console.log("Example board word count:", made.wordCount);
console.log("Example board source:", made.source);
