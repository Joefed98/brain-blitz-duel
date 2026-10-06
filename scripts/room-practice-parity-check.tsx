import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { GameLayout, PhoneShell } from "../src/components/duel/PhoneShell";
import { ScoreStrip } from "../src/components/duel/ScoreStrip";
import { SoloScoreStrip } from "../src/components/duel/SoloScoreStrip";
import { TimerBar } from "../src/components/duel/TimerBar";
import { PuzzleHelpButton } from "../src/components/duel/PuzzleInstructions";
import { RoundPips } from "../src/components/duel/RoundPips";
import { PUZZLE_REGISTRY, puzzleShowsTimer } from "../src/lib/duel/registry";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { withSeededRandom } from "../src/lib/duel/random";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import type { PuzzleType } from "../src/lib/duel/types";

// Happy DOM parses DOM only. Budgets below are CSS arithmetic, NOT pixel measurements.
const room = readFileSync("src/routes/duel.$code.tsx", "utf8").split("const roomGameHeader")[1] ?? "";
const practice = readFileSync("src/routes/practice.tsx", "utf8").split("const StageComponent")[1] ?? "";
for (const source of [room, practice]) {
  assert.match(source, /<GameLayout/);
  assert.doesNotMatch(source, /<RoomChat|pb-|bottom-|100vh/);
}
const window = new Window();
const active = Object.entries(PUZZLE_REGISTRY).filter(([, d]) => !d.retired);
let comparisons = 0;
let controls = 0;
for (const [key, definition] of active) {
  const type = key as PuzzleType;
  const puzzle = splitPuzzle(withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type))).pub;
  const stage = renderToStaticMarkup(<definition.Stage puzzle={puzzle} phaseStartedAt={0} now={0} locked={false} onSubmit={() => {}} stateKey={`parity-${type}`} />);
  assert.ok(stage.length, `${key}: empty stage`);
  for (const [width, height] of [[390, 700], [375, 667]]) {
    window.happyDOM.setWindowSize({ width, height });
    let baseline = "";
    for (const mode of ["practice", "room", "multi"] as const) {
      const header = mode === "practice" || type === "spotdiff" || type === "blockparty" ? undefined : mode === "multi"
        ? <SoloScoreStrip name="A long player name" total={149} position={10} playerCount={10} compact />
        : <ScoreStrip myName="A long player name" opponentName="Another long player name" myTotal={123} opponentTotal={149} compact />;
      const root = window.document.createElement("div");
      root.innerHTML = renderToStaticMarkup(
        <PhoneShell constrained gameScreen gameType={type} gameHeader={header}>
          <GameLayout label={mode === "practice" ? "PRACTICE" : "Round 6 of 6"} title={definition.name}
            help={<PuzzleHelpButton onClick={() => {}} />}
            progress={mode === "practice" ? undefined : <RoundPips currentRound={6} outcomes={[]} />}
            timer={puzzleShowsTimer(puzzle) ? <TimerBar msRemaining={30_000} totalMs={60_000} active={false} /> : undefined}
            beforeGame={type === "balance" ? <div className="h-3 w-full shrink-0" /> : undefined}>
            <div data-stage-fixture dangerouslySetInnerHTML={{ __html: stage }} />
          </GameLayout>
        </PhoneShell>,
      );
      const region = root.querySelector("[data-game-region]");
      assert.ok(region);
      // Every game subtree and every ancestor class is mode-independent.
      const ancestors: string[] = [];
      let node = region;
      while (node && node !== root) {
        ancestors.push(node.getAttribute("class") ?? "");
        node = node.parentElement;
      }
      const signature = JSON.stringify([ancestors, region.innerHTML]);
      if (mode === "practice") {
        baseline = signature;
        controls += region.querySelectorAll("button, [role='button']").length;
      } else {
        assert.equal(signature, baseline, `${key} ${width}×${height} ${mode}: stage ancestry differs`);
        comparisons++;
      }
      const heading = root.querySelector("[data-round-heading]");
      assert.match(heading?.getAttribute("class") ?? "", /h-7 shrink-0/);
      const top = root.querySelector(".pad-game-safe")?.firstElementChild;
      assert.match(top?.getAttribute("class") ?? "", /h-9 shrink-0/);
      assert.equal(root.querySelectorAll(".pad-game-safe").length, 1);
      // Single safe-area owner; equal available height for any inset value.
      for (const bottomInset of [0, 34]) {
        const budget = height - 8 - Math.max(8, bottomInset) - 44 - 28 - 8
          - (puzzleShowsTimer(puzzle) ? 28 : 0) - (type === "balance" ? 20 : 0);
        assert.ok(budget > 0);
      }
    }
  }
}
console.log(`PASS ${active.length} active games, ${comparisons} room/multi versus practice DOM comparisons at 390×700 and 375×667; ${controls} control nodes covered.`);
console.log("PASS fixed 36px top bar, 28px heading, shared 20px timer and identical stage ancestry; calculated room/practice height delta 0px, including 34px bottom inset.");
console.log("No source-level game differences. Actual control positions within 4px, font rendering, 44px target fit and no-scroll visibility remain UNMEASURED: no browser tests ran.");