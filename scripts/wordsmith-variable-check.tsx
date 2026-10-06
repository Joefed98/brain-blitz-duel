import { renderToStaticMarkup } from "react-dom/server";
import { generateWordsmith, generateWordsmithExample, checkWordsmithWord, gradeWordsmith, isPluralForm } from "../src/lib/duel/wordsmith.server";
import { wordsFrom, commonWords } from "../src/lib/duel/dictionary.server";
import { withSeededRandom, pick, shuffled } from "../src/lib/duel/random";
import { WORDSMITH_CENTRE_INDEX, WORDSMITH_SIZES, WORDSMITH_WORD_RANGES, wordsmithPoints } from "../src/lib/duel/types";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { WordsmithRing, wordsmithRingSegments, WORDSMITH_GLYPH_REDUCTION } from "../src/components/puzzles/WordsmithRing";

function check(ok: unknown, label: string): asserts ok { if (!ok) throw new Error(label); }
const distribution = new Map<number, number>();
for (let seed = 0; seed < 800; seed++) {
  const puzzle = withSeededRandom(seed, () => generateWordsmith());
  const again = withSeededRandom(seed, () => generateWordsmith());
  check(JSON.stringify(puzzle) === JSON.stringify(again), "seed reproducibility");
  distribution.set(puzzle.letters.length, (distribution.get(puzzle.letters.length) ?? 0) + 1);
}
console.log("800 seeded size draws", Object.fromEntries(distribution));
for (const size of WORDSMITH_SIZES) {
  check((distribution.get(size) ?? 0) >= 150 && (distribution.get(size) ?? 0) <= 250, "roughly equal weighting");
  const times: number[] = [], counts: number[] = [];
  const range = WORDSMITH_WORD_RANGES[size];
  for (let seed = 0; seed < 200; seed++) {
    const start = performance.now();
    const puzzle = withSeededRandom(seed + 10000, () => generateWordsmith(size));
    times.push(performance.now() - start);
    check(JSON.stringify(puzzle) === JSON.stringify(withSeededRandom(seed + 10000, () => generateWordsmith(size))), "per-size seed repeatability");
    check(puzzle.letters.length === size && puzzle.source?.length === size, "chosen size retained");
    const centre = puzzle.letters[WORDSMITH_CENTRE_INDEX];
    check(centre, "centre");
    const expected = wordsFrom(puzzle.letters.join(""), 4, true).filter(word => word.includes(centre.toLowerCase()) && !isPluralForm(word));
    counts.push(expected.length);
    check(expected.length >= range.min && expected.length <= range.max && puzzle.wordCount === expected.length, "enforced actual total");
    check(puzzle.words?.length === expected.length, "complete private word list");
    check(checkWordsmithWord(puzzle.letters, puzzle.source ?? "", []).valid, "pangram accepted");
    for (const word of expected) check(checkWordsmithWord(puzzle.letters, word, []).valid, "all listed words accepted");
    const missingCentre = wordsFrom(puzzle.letters.join(""), 4, true).find(word => !word.includes(centre.toLowerCase()));
    if (missingCentre) check(checkWordsmithWord(puzzle.letters, missingCentre, []).reason === "Must use the centre letter", "centre enforced at every size");
    const score = gradeWordsmith(puzzle, puzzle.source ?? "", 50000).score;
    check(score === Math.min(150, Math.floor(2.5 * wordsmithPoints(puzzle.source ?? ""))), "score unchanged");
    const { pub } = splitPuzzle(puzzle);
    check(pub.type === "wordsmith" && pub.wordCount === expected.length && !pub.words && !pub.source, "private answers never public");
    if (seed === 0) {
      const html = renderToStaticMarkup(<WordsmithRing letters={puzzle.letters} />);
      check((html.match(/data-wordsmith-tile=/g) ?? []).length === size, "all tap targets rendered");
      check(!html.includes("NaN"), "finite geometry");
    }
  }
  times.sort((a, b) => a - b);
  counts.sort((a, b) => a - b);
  const histogram: Record<string, number> = {};
  for (const count of counts) { const lo = Math.floor(count / 10) * 10, label = `${lo}–${lo + 9}`; histogram[label] = (histogram[label] ?? 0) + 1; }
  console.log(JSON.stringify({ size, samples: 200, enforced: range, words: { min: counts[0], median: ((counts[99] ?? 0) + (counts[100] ?? 0)) / 2, p95: counts[189], max: counts[199], histogram }, generationMs: { median: ((times[99] ?? 0) + (times[100] ?? 0)) / 2, p95: times[189], max: times[199] } }));
  if ((times[199] ?? 0) > 1000) console.log(`WARNING: ${size} letters exceeded one second`);
}
// Exact fixed-example puzzle parity with the old nine-letter source draw.
const legacy = withSeededRandom(INTRO_EXAMPLE_SEED, () => {
  const bank = commonWords().filter(word => word.length === 9 && [...new Set(word)].every(letter => word.split(letter).length - 1 <= 2));
  for (let attempt = 0; attempt < 200; attempt++) {
    const source = pick(bank);
    if (isPluralForm(source)) continue;
    const all = wordsFrom(source, 4, true).filter(word => !isPluralForm(word));
    const centre = shuffled([...new Set(source)]).find(letter => {
      const count = all.filter(word => word.includes(letter)).length;
      return count >= 25 && count <= 60;
    });
    if (!centre) continue;
    const upper = source.toUpperCase().split("");
    const at = upper.indexOf(centre.toUpperCase());
    const outer = upper.filter((_, i) => i !== at);
    let ring = shuffled(outer);
    for (let n = 0; n < 20 && ring.join("") === outer.join(""); n++) ring = shuffled(outer);
    return [...ring.slice(0, 4), centre.toUpperCase(), ...ring.slice(4)];
  }
  throw new Error("legacy seed fallback");
});
check(JSON.stringify(legacy) === JSON.stringify(withSeededRandom(INTRO_EXAMPLE_SEED, () => generateWordsmithExample()).letters), "fixed demo puzzle unchanged");
check(WORDSMITH_GLYPH_REDUCTION === .7, "70% lettering retained");
// Conservative 280px live board, smaller than available source-derived phone room space.
// Every wedge contains a real, non-overlapping 44×44 CSS-pixel square.
for (const count of [7, 8, 9, 10]) {
  const segments = wordsmithRingSegments(count);
  check(segments.length === count, "wedge count");
  let area = 0;
  for (const { polygon } of segments) {
    area += polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return b ? sum + a.x * b.y - b.x * a.y : sum; }, 0) / 2;
    const inside = (x: number, y: number) => {
      let result = false;
      polygon.forEach((a, i) => { const b = polygon[(i + 1) % polygon.length]; if (b && (a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) result = !result; });
      return result;
    };
    const half = 22 / 2.8;
    let fits = false;
    for (let y = 0; y <= 100 && !fits; y += .5) for (let x = 0; x <= 100 && !fits; x += .5) {
      fits = [[-half,-half],[half,-half],[-half,half],[half,half]].every(([dx = 0,dy = 0]) => inside(x + dx,y + dy));
    }
    check(fits, "44px square target within wedge");
  }
  const octagonArea = (10000 - 2 * ((1 - Math.tan(Math.PI / 8)) * 50) ** 2) * (1 - .34 ** 2);
  check(Math.abs(area - octagonArea) < .001, "same octagonal ring coverage");
}
console.log("PASS: variable validation, totals, scoring, private projection, seeded fixed-demo parity, 70% glyphs and 44px targets; no browsers");