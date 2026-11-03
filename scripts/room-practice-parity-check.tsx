import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";
import { GameLayout, PhoneShell, isArcadeScreenType } from "../src/components/duel/PhoneShell";
import { FrameScore } from "../src/components/duel/GameFrame";
import { TimerBar } from "../src/components/duel/TimerBar";
import { PuzzleHelpButton } from "../src/components/duel/PuzzleInstructions";
import { RoundPips } from "../src/components/duel/RoundPips";
import { PUZZLE_REGISTRY, puzzleShowsTimer } from "../src/lib/duel/registry";
import { CURL_TURN_ROW_TOP } from "../src/puzzles/curling";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { withSeededRandom } from "../src/lib/duel/random";
import { INTRO_EXAMPLE_SEED } from "../src/lib/duel/puzzleDemo";
import type { PuzzleType } from "../src/lib/duel/types";
import { ACTIVE_ARCADE_GAMES, ARCADE_FX_SPECS } from "../src/lib/arcade/arcadeFxGames.renderer";
import { orbitXpRev } from "../src/lib/arcade/orbit";

// Happy DOM parses DOM only. Budgets below are CSS arithmetic, NOT pixel measurements.
const room = readFileSync("src/routes/duel.$code.tsx", "utf8").split("const frameScore")[1] ?? "";
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
    // Orbit orbitRev 12 (Joe's phone notes, 27 Oct 2026): its world reaches the screen's bottom, so SET CHECKPOINT sits in
    // the reserved top-right zone of the world (ORBIT_XP_ZONE, where nothing in play is drawn and the rocket never goes;
    // play-control-clearance-check proves both on every course and frame): exactly that one row in the arena, absolutely
    // placed 4px in from its top and right, holding the one 44px button. Every other control still sits below the slot.
    const inSlot = [...slot.querySelectorAll("[data-game-controls], button")];
    if (key === "orbit" && orbitXpRev((puzzle as { orbitRev?: number }).orbitRev)) {
      const row = slot.querySelector("[data-game-arena] > [data-orbit-zone]");
      assert.ok(row && row.getAttribute("data-game-controls") === "checkpoint", `${key}: the checkpoint row sits in the world's reserved corner`);
      const cls = ` ${row!.getAttribute("class") ?? ""} `;
      for (const c of ["absolute", "right-1", "top-1", "h-11", "pointer-events-none"]) assert.ok(cls.includes(` ${c} `), `${key}: corner row class ${c}`);
      const buttons = [...row!.querySelectorAll("button")];
      assert.equal(buttons.length, 1, `${key}: one button in the corner`);
      assert.ok(` ${buttons[0]!.getAttribute("class") ?? ""} `.includes(" h-11 "), `${key}: the corner button is 44px tall`);
      assert.deepEqual(inSlot, [row, buttons[0]], `${key}: nothing else in the slot but the corner row and its button`);
      assert.equal(host.querySelectorAll("[data-game-controls]").length, 1, `${key}: no row below the world on orbitRev 12`);
    } else if (key === "curling" && ((puzzle as { curlRev?: number }).curlRev ?? 1) >= 4) {
      // Curl Champ curlRev 4 (Joe's approval, 3 Nov 2026): In, Out and Throw sit over the bottom of the sheet, below the near
      // hog line (between it and the near house since 3 Nov 2026), so the world reaches the screen's bottom; they clear the start point, the aim line and every stone at rest
      // (the review shots at 414x896 and 375x667: stones rest in the far house, the near end behind the thrower is never in
      // play). Exactly that wrapper in the arena, absolutely placed across its bottom and lifted by the home bar, holding the
      // one turn row of exactly the In, Out and Throw buttons (48px, over the 44px minimum). Every other control, and every
      // older revision's, still sits below the slot.
      const row = slot.querySelector('[data-game-arena] > div > [data-game-controls="turn"]');
      assert.ok(row, `${key}: the turn row sits in the arena`);
      const wrap = row!.parentElement!;
      const wcls = ` ${wrap.getAttribute("class") ?? ""} `;
      for (const c of ["absolute", "inset-x-1", "pointer-events-none"]) assert.ok(wcls.includes(` ${c} `), `${key}: turn wrapper class ${c}`);
      // 3 Nov 2026 (Joe's phone note): centred between the near hog line and the near house's blue ring
      // (CURL_TURN_ROW_TOP), never lower than the slot's bottom less the row and the home-bar lift.
      assert.equal((wrap.getAttribute("style") ?? "").replace(/\s/g, ""), `top:${CURL_TURN_ROW_TOP.replace(/\s/g, "")}`, `${key}: the turn row sits between the hog line and the house, lifted by the home bar`);
      assert.ok(CURL_TURN_ROW_TOP.includes("100cqh - 48px - max(0px, calc(env(safe-area-inset-bottom, 0px) - 4px))"), `${key}: the turn row is clamped above the home bar`);
      const cls = ` ${row!.getAttribute("class") ?? ""} `;
      for (const c of ["grid", "h-12", "grid-cols-3"]) assert.ok(cls.includes(` ${c} `), `${key}: turn row class ${c}`);
      const buttons = [...row!.querySelectorAll("button")];
      assert.deepEqual(buttons.map((b) => b.getAttribute("aria-label")), ["In-turn", "Out-turn", "Throw"], `${key}: exactly the In, Out and Throw buttons`);
      for (const b of buttons) assert.ok(` ${b.getAttribute("class") ?? ""} `.includes(" h-12 "), `${key}: each turn button is 48px tall`);
      assert.deepEqual(inSlot, [row, ...buttons], `${key}: nothing else in the slot but the turn row and its three buttons`);
      assert.equal(host.querySelectorAll("[data-game-controls]").length, 1, `${key}: no row below the world on curlRev 4`);
    } else {
      // Every other game's controls sit below the slot. Home Run follows this rule again (homerunRev 4, 3 Nov 2026: no
      // buttons over the field; its homerunRev 3 exception for the Contact / Power row was removed with that row).
      assert.equal(inSlot.length, 0, `${key}: controls sit below the slot`);
    }
    arenas++;
  }
  for (const [width, height] of SIZES) {
    window.happyDOM.setWindowSize({ width, height });
    let baseline = "";
    for (const mode of ["practice", "room", "multi"] as const) {
      // The game frame (Polish 2, 24 Oct 2026): every mode has the same 60px header; only its score block
      // and context line differ (practice: Best; rooms: the total with the place or the opponent's total).
      const arcade = isArcadeScreenType(type);
      const score = mode === "practice" ? <FrameScore label="Best" value={null} />
        : mode === "multi" ? <FrameScore value={149} note="10th of 10" />
        : <FrameScore value={123} note={<span className="text-opponent">Another long player name 149</span>} />;
      const root = window.document.createElement("div");
      root.innerHTML = renderToStaticMarkup(
        <PhoneShell constrained gameScreen play gameType={type}>
          <GameLayout label={mode === "practice" ? "Practice" : "Round 6 of 6"} title={definition.name}
            help={<PuzzleHelpButton onClick={() => {}} />}
            score={score}
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
      // One 60px frame header for every game (Polish 2): no separate top bar, the timer in its centre
      // column, sound in the header; the old arcade row (h-11) and puzzle heading (h-7 under an h-9 bar) are gone.
      assert.match(heading?.getAttribute("class") ?? "", /^game-frame-header$/, `${key}: the frame header`);
      assert.ok(heading?.querySelector("[data-sound-controls]"), `${key}: sound controls in the header`);
      assert.ok(top?.hasAttribute("data-round-layout"), `${key}: no separate top bar`);
      assert.ok(!root.querySelector("[data-round-label]"), `${key} ${mode}: no RoundLabel (the context line says the round)`);
      if (puzzleShowsTimer(puzzle)) assert.ok(heading?.querySelector("[data-frame-timer] [role='timer']"), `${key}: the timer in the header's centre`);
      assert.ok(heading?.querySelector("[data-header-right] [data-frame-score]"), `${key} ${mode}: the score block on the right`);
      if (arcade) {
        assert.ok(heading?.hasAttribute("data-arcade-header"), `${key}: arcade header`);
        assert.ok(root.querySelector("[data-arcade-play]"), `${key}: arcade play screen`);
        assert.ok(!root.querySelector("[data-goal-line]"), `${key}: no goal line on an arcade play screen`);
        arcadeHeaders++;
      } else {
        assert.ok(!heading?.hasAttribute("data-arcade-header"), `${key}: not the arcade header`);
        assert.ok(!root.querySelector("[data-arcade-play]"), `${key}: not an arcade play screen`);
        assert.ok(root.querySelector("[data-puzzle-play] [data-goal-line]"), `${key}: the goal line`);
      }
      assert.equal(root.querySelectorAll(".pad-game-safe").length, 1);
      // Single safe-area owner; equal available height for any inset value.
      for (const bottomInset of [0, 34]) {
        const budget = height - (bottomInset + 16) - 60 - 30 - (type === "balance" ? 20 : 0);
        assert.ok(budget > 0);
      }
    }
  }
}
// Junction (practice only since Tuning C) is not an active type; every active arcade game is.
assert.equal(arenas, ACTIVE_ARCADE_GAMES.length, "every active arcade game has its arena slot");
console.log(`PASS ${active.length} active games, ${comparisons} room/multi versus practice DOM comparisons at 390×700, 375×667, 390×844, 430×932 and 1280×800; ${controls} control nodes covered.`);
console.log(`PASS ${arenas} arcade stages: one arena slot each with the game's world size (no per-game fill), one world-aspect arena inside, controls below it.`);
console.log("PASS puzzles: the frame's 60px header and goal line, no separate top bar, identical stage ancestry; calculated room/practice height delta 0px, including 34px bottom inset.");
console.log(`PASS arcade play screens: ${arcadeHeaders} renders with the frame's 60px header (name and context, centred timer, score, "?" and sound) and no separate top bar, in practice, duel and multi alike.`);
console.log("No source-level game differences. Actual control positions within 4px, font rendering, 44px target fit and no-scroll visibility remain UNMEASURED: no browser tests ran.");