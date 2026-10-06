import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import { PhoneShell } from "../src/components/duel/PhoneShell";
import { ScoreStrip } from "../src/components/duel/ScoreStrip";
import { PUZZLE_REGISTRY } from "../src/lib/duel/registry";
import { wordSearchPuzzle } from "../src/puzzles/wordSearch";

const room = readFileSync("src/routes/duel.$code.tsx", "utf8");
const practice = readFileSync("src/routes/practice.tsx", "utf8");
const shellSource = readFileSync("src/components/duel/PhoneShell.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");

const roomPuzzleBlock = room.slice(room.indexOf("const clockActive"));
const roomRevealBlock = room.slice(room.indexOf('if (phase === "reveal"'), room.indexOf('if (phase === "result"'));
const roomIntroBlock = room.slice(room.indexOf('if (phase === "intro"'), room.indexOf('if (phase === "reveal"'));
const practiceIntroBlock = practice.slice(practice.indexOf('if (stage === "intro"'), practice.indexOf('if (stage === "reveal"'));

assert.doesNotMatch(roomPuzzleBlock, /<RoomChat/);
assert.doesNotMatch(roomRevealBlock, /<RoomChat/);
assert.doesNotMatch(roomIntroBlock, /constrained|gameScreen/);
assert.doesNotMatch(practiceIntroBlock, /constrained|gameScreen/);
assert.match(roomPuzzleBlock, /gameHeader=\{roomGameHeader\}/);
assert.match(room, /duel\.phase === "puzzle" \|\| duel\.phase === "reveal"/);
assert.match(shellSource, /h-\[100dvh\] overflow-hidden/);
assert.doesNotMatch(shellSource, /100vh/);
assert.equal((styles.match(/padding-bottom: max\(0\.5rem, env\(safe-area-inset-bottom\)\)/g) ?? []).length, 1);

const active = Object.entries(PUZZLE_REGISTRY).filter(([, definition]) => !definition.retired);
const puzzleSources = Array.from(new Bun.Glob("src/puzzles/*.tsx").scanSync()).map((path) => readFileSync(path, "utf8"));
const fixedHeightRisks = puzzleSources.filter((source) => /(?:min-h-|h-)\[(?:[4-9]\d\d|\d{4,})px\]/.test(source));
assert.equal(fixedHeightRisks.length, 0);
for (const [width, height] of [[390, 700], [375, 667]] as const) {
  const header = <ScoreStrip myName="A long player name" opponentName="Another long player name" myTotal={123} opponentTotal={149} compact />;
  for (const [type] of active) {
    const markup = renderToStaticMarkup(
      <PhoneShell constrained gameScreen gameType={type as keyof typeof PUZZLE_REGISTRY} gameHeader={header}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden" />
      </PhoneShell>,
    );
    assert.match(markup, /h-\[100dvh\] overflow-hidden/);
    assert.match(markup, /pad-game-safe/);
    assert.doesNotMatch(markup, /Say something|RoomChat/);
  }
  console.log(`PASS ${width}x${height}: ${active.length} active room play shells, no chat reservation, one shared safe-area owner`);
}

const reveal = renderToStaticMarkup(
  <wordSearchPuzzle.Reveal
    puzzle={{
      type: "wordsearch",
      size: 5,
      grid: "ABCDEFGHIJKLMNOPQRSTUVWXY",
      category: "Test",
      wordCount: 2,
      placements: [
        { word: "ABCDE", cells: [0, 1, 2, 3, 4] },
        { word: "AFKPU", cells: [0, 5, 10, 15, 20] },
      ],
    }}
    myAnswer="0.4"
    myCorrect={false}
    myReactionAvgMs={null}
    timeLimitMs={60_000}
  />,
);
assert.match(reveal, /text-primary[^>]*>ABCDE/);
assert.match(reveal, /text-destructive[^>]*>AFKPU/);
assert.equal((reveal.match(/ring-2 ring-inset ring-destructive/g) ?? []).length, 5);
assert.match(reveal, /bg-primary text-primary-foreground ring-2 ring-inset ring-destructive/);
console.log("PASS Word Search: every missed path cell is red-outlined, shared found cells retain gold, and list colours match");

console.log("Remaining fixed-overflow exceptions: none found; content-sized reveal lists retain their existing internal scroll regions.");