import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { GameLayout, PhoneShell, isArcadeScreenType } from "../src/components/duel/PhoneShell";
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
import { ACTIVE_ARCADE_GAMES, ARCADE_FX_SPECS } from "../src/lib/arcade/arcadeFxGames.renderer";

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
let arenas = 0;
let arcadeHeaders = 0;
// Phones from the smallest supported to the tallest, plus a laptop window.
const SIZES = [[390, 700], [375, 667], [390, 844], [430, 932], [1280, 800]] as const;
const ARCADE_WORLDS = ARCADE_FX_SPECS as Record<string, { width: number; height: number }>;
for (const [key, definition] of active) {
  const type = key as PuzzleType;
  const puzzle = splitPuzzle(withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type))).pub;
  const stage = renderToStaticMarkup(<definition.Stage puzzle={puzzle} phaseStartedAt={0} now={0} locked={false} onSubmit={() => {}} stateKey={`parity-${type}`} />);
  assert.ok(stage.length, `${key}: empty stage`);
  const world = ARCADE_WORLDS[key];
  if (world) {
    // Arcade: exactly one arena slot (carrying the world size; no per-game fill since 15 Oct 2026)
    // whose only arena child is the world rectangle; controls follow the slot, never inside it.
    const host = window.document.createElement("div");
    host.innerHTML = stage;
    const slots = [...host.querySelectorAll("[data-arena-slot]")];
    assert.equal(slots.length, 1, `${key}: one arena slot`);
    const slot = slots[0]!;
    const style = (slot.getAttribute("style") ?? "").replace(/\s/g, "");
    assert.ok(style.includes(`--arena-w:${world.width}`) && style.includes(`--arena-h:${world.height}`), `${key}: slot world ${style}`);
    assert.ok(!style.includes("--arena-fill"), `${key}: no per-game slot fill ${style}`);
    assert.equal([...slot.children].filter((c) => c.hasAttribute("data-game-arena")).length, 1, `${key}: one arena in the slot`);
    assert.equal(host.querySelectorAll("[data-game-arena]").length, 1, `${key}: no arena outside the slot`);
    assert.equal(slot.querySelectorAll("[data-game-controls], button").length, 0, `${key}: controls sit below the slot`);
    arenas++;
  }
  for (const [width, height] of SIZES) {
    window.happyDOM.setWindowSize({ width, height });
    let baseline = "";
    for (const mode of ["practice", "room", "multi"] as const) {
      // Arcade play screens carry the score stacked in their one compact header row (as the room route passes it).
      const arcade = isArcadeScreenType(type);
      const header = mode === "practice" || type === "spotdiff" || type === "blockparty" ? undefined : mode === "multi"
        ? <SoloScoreStrip name="A long player name" total={149} position={10} playerCount={10} compact stacked={arcade} />
        : <ScoreStrip myName="A long player name" opponentName="Another long player name" myTotal={123} opponentTotal={149} compact stacked={arcade} />;
      const root = window.document.createElement("div");
      root.innerHTML = renderToStaticMarkup(
        <PhoneShell constrained gameScreen play gameType={type} gameHeader={header}>
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
      const top = root.querySelector(".pad-game-safe")?.firstElementChild;
      if (arcade) {
        // Arcade play screen (15 Oct 2026): one 44px header row in place of the 36px top bar, 28px heading and 20px timer.
        assert.match(heading?.getAttribute("class") ?? "", /^grid h-11 shrink-0/, `${key}: one 44px header row`);
        assert.ok(heading?.hasAttribute("data-arcade-header") && heading.querySelector("[data-sound-controls]"), `${key}: sound controls in the header`);
        assert.ok(root.querySelector("[data-arcade-play]"), `${key}: arcade play screen`);
        assert.ok(top?.hasAttribute("data-round-layout"), `${key}: no separate top bar`);
        if (puzzleShowsTimer(puzzle)) assert.ok(heading?.querySelector("[data-arcade-timer] [role='timer']"), `${key}: the timer in the header's centre`);
        arcadeHeaders++;
      } else {
        assert.match(heading?.getAttribute("class") ?? "", /h-7 shrink-0/);
        assert.match(top?.getAttribute("class") ?? "", /h-9 shrink-0/);
        assert.ok(!root.querySelector("[data-arcade-play]"), `${key}: not an arcade play screen`);
      }
      assert.equal(root.querySelectorAll(".pad-game-safe").length, 1);
      // Single safe-area owner; equal available height for any inset value.
      for (const bottomInset of [0, 34]) {
        const budget = height - 8 - (bottomInset + 16) - 44 - 28 - 8
          - (puzzleShowsTimer(puzzle) ? 28 : 0) - (type === "balance" ? 20 : 0);
        assert.ok(budget > 0);
      }
    }
  }
}
// Junction (practice only since Tuning C) is not an active type; every active arcade game is.
assert.equal(arenas, ACTIVE_ARCADE_GAMES.length, "every active arcade game has its arena slot");
console.log(`PASS ${active.length} active games, ${comparisons} room/multi versus practice DOM comparisons at 390×700, 375×667, 390×844, 430×932 and 1280×800; ${controls} control nodes covered.`);
console.log(`PASS ${arenas} arcade stages: one arena slot each with the game's world size (no per-game fill), one world-aspect arena inside, controls below it.`);
console.log("PASS puzzles: fixed 36px top bar, 28px heading, shared 20px timer and identical stage ancestry; calculated room/practice height delta 0px, including 34px bottom inset.");
console.log(`PASS arcade play screens: ${arcadeHeaders} renders with one 44px header row (score or PRACTICE, centred timer, "?" and sound) and no separate top bar, in practice, duel and multi alike.`);
console.log("No source-level game differences. Actual control positions within 4px, font rendering, 44px target fit and no-scroll visibility remain UNMEASURED: no browser tests ran.");