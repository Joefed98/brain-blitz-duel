import { commonWords, isWord } from "./dictionary.server";
import { pick, shuffled } from "./random";
import type { WordLadderPuzzleData } from "./types";

interface Graph {
  words: string[];
  neighbours: Map<string, string[]>;
}

let cached: Graph | null = null;

function differsByOne(a: string, b: string): boolean {
  if (a.length !== 4 || b.length !== 4) return false;
  let changed = 0;
  for (let i = 0; i < 4; i++) {
    if (a[i] !== b[i] && ++changed > 1) return false;
  }
  return changed === 1;
}

function graph(): Graph {
  if (cached) return cached;
  const words = [...new Set(commonWords().filter((word) => word.length === 4 && isWord(word)))];
  const buckets = new Map<string, string[]>();
  for (const word of words) {
    for (let i = 0; i < 4; i++) {
      const key = `${word.slice(0, i)}*${word.slice(i + 1)}`;
      const list = buckets.get(key) ?? [];
      list.push(word);
      buckets.set(key, list);
    }
  }
  const neighbours = new Map<string, string[]>();
  for (const word of words) {
    const found = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const key = `${word.slice(0, i)}*${word.slice(i + 1)}`;
      for (const other of buckets.get(key) ?? []) if (other !== word) found.add(other);
    }
    neighbours.set(word, [...found]);
  }
  cached = { words, neighbours };
  return cached;
}

function pathsFrom(start: string): Map<string, string[]> {
  const { neighbours } = graph();
  const paths = new Map<string, string[]>([[start, [start]]]);
  const queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const word = queue[cursor];
    if (!word) continue;
    const path = paths.get(word) ?? [];
    if (path.length > 6) continue;
    for (const next of neighbours.get(word) ?? []) {
      if (paths.has(next)) continue;
      paths.set(next, [...path, next]);
      queue.push(next);
    }
  }
  return paths;
}

export function generateWordLadder(): WordLadderPuzzleData {
  const candidates = graph().words.filter(
    (word) => (graph().neighbours.get(word)?.length ?? 0) >= 2,
  );
  for (const start of shuffled(candidates).slice(0, 80)) {
    const paths = pathsFrom(start);
    const targets = [...paths.entries()].filter(([, path]) => path.length >= 5 && path.length <= 7);
    if (!targets.length) continue;
    const [target, path] = pick(targets);
    return {
      type: "ladder",
      startWord: start.toUpperCase(),
      targetWord: target.toUpperCase(),
      shortestLength: path.length - 1,
      shortestPath: path.map((word) => word.toUpperCase()),
    };
  }
  return {
    type: "ladder",
    startWord: "COLD",
    targetWord: "WARM",
    shortestLength: 4,
    shortestPath: ["COLD", "CORD", "CARD", "WARD", "WARM"],
  };
}

export function checkLadderRung(
  previous: string,
  candidate: string,
): {
  valid: boolean;
  word: string;
  reason?: string;
} {
  const word = candidate.trim().toLowerCase();
  const before = previous.trim().toLowerCase();
  if (word.length !== 4)
    return { valid: false, word: word.toUpperCase(), reason: "Use four letters." };
  if (word === before)
    return { valid: false, word: word.toUpperCase(), reason: "Change one letter." };
  if (!differsByOne(before, word))
    return { valid: false, word: word.toUpperCase(), reason: "Change exactly one letter." };
  if (!isWord(word))
    return { valid: false, word: word.toUpperCase(), reason: "Not in the dictionary." };
  return { valid: true, word: word.toUpperCase() };
}

export function validateLadder(
  puzzle: WordLadderPuzzleData,
  raw: string,
): {
  validRungs: string[];
  solved: boolean;
} {
  const submitted = raw
    .split(",")
    .map((word) => word.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 30);
  const validRungs: string[] = [];
  let previous = puzzle.startWord;
  for (const word of submitted) {
    const verdict = checkLadderRung(previous, word);
    if (!verdict.valid) break;
    validRungs.push(verdict.word);
    previous = verdict.word;
    if (word === puzzle.targetWord) break;
  }
  return { validRungs, solved: validRungs.at(-1) === puzzle.targetWord };
}

export function shortestLadderDistance(start: string, target: string): number | null {
  const path = pathsFrom(start.toLowerCase()).get(target.toLowerCase());
  return path ? path.length - 1 : null;
}
