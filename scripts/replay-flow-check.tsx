/**
 * Replays never hold up the room (docs/replays.md):
 *
 *  1. The results screens (RoundResultsTable, RoundResult) render their
 *     Continue footer with the same continue state whether or not a highlight
 *     is passed, and the podiums (Podium, FinalResult) keep Play again / Leave
 *     / Home with a play-of-the-game panel; a panel that throws renders nothing
 *     (ReplayBoundary) and the screen is unchanged.
 *  2. Source scan: no replay file calls a room action (continue, advance,
 *     ready, finish, start, submit, leave, rematch) or touches the phase
 *     timers; the room route still hands the screens the same continueState
 *     and host controls, and only adds the highlight / play-of-the-game props;
 *     the full-run viewer opens only on a tap (never on its own).
 *  3. The highlight fits the results screen: the clips run 3–5 s each and the
 *     whole highlight about 7.5 s, inside the 8 s results screen and never past
 *     its time left; a stale-version reload ends the panels; the slim bar takes over before
 *     the table and Continue would leave a short phone's screen.
 *
 *   bun scripts/replay-flow-check.tsx
 */
import { readdirSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";

import { FinalResult } from "../src/components/duel/FinalResult";
import { Podium } from "../src/components/duel/Podium";
import { RoundResult } from "../src/components/duel/RoundResult";
import { RoundResultsTable } from "../src/components/duel/RoundResultsTable";
import { ReplayBoundary } from "../src/components/replay/ReplayBoundary";
import { highlightPx } from "../src/components/replay/RoundHighlight";
import type { Standing } from "../src/lib/duel/scoring";
import {
  finalMomentsClip,
  HIGHLIGHT_BUDGET_S,
  HIGHLIGHT_MIN_S,
  planHighlight,
  planPlayOfTheGame,
} from "../src/lib/replay/pick";
import { planTimelapse, TIMELAPSE_CAP_MS } from "../src/lib/replay/timelapse";
import { NEXT_ROUND_AUTO_MS, type PuzzleData } from "../src/lib/duel/types";
import type { Moment } from "../src/lib/replay/moments";
import { runTimelapseChecks } from "./replay-timelapse-lib";

const failures: string[] = [];
let checks = 0;
const ok = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};

const rows: Standing[] = [1, 2, 3].map((slot) => ({
  slot,
  name: ["Ana", "Bo", "Cy"][slot - 1]!,
  status: "active",
  total: 300 - slot * 20,
  roundScore: 150 - slot * 20,
  roundCorrect: true,
  answerMs: 20_000,
  position: slot,
  previousPosition: null,
  summary: "",
  detail: [],
}));
const continueState = {
  continued: false,
  continuedCount: 0,
  waitingCount: 3,
  onContinue: () => undefined,
};
const Boom = () => {
  throw new Error("replay panel blew up");
};
const marker = <div data-test-panel>panel</div>;
const quiet = <T,>(fn: () => T): T => {
  const error = console.error;
  console.error = () => {};
  try {
    return fn();
  } finally {
    console.error = error;
  }
};
/** Client render in happy-dom (error boundaries only work there); returns the markup. */
const happy = new Window();
Object.assign(globalThis, {
  window: happy,
  document: happy.document,
  navigator: happy.navigator,
  HTMLElement: happy.HTMLElement,
  Node: happy.Node,
  Event: happy.Event,
  CustomEvent: happy.CustomEvent,
  requestAnimationFrame: (cb: () => void) => setTimeout(cb, 16),
  cancelAnimationFrame: (id: number) => clearTimeout(id),
});
const { createRoot } = await import("react-dom/client");
const { flushSync } = await import("react-dom");
const clientRender = (el: React.ReactElement): string => {
  const container = happy.document.createElement("div");
  const root = createRoot(container as unknown as HTMLElement);
  flushSync(() => root.render(el));
  const html = container.innerHTML;
  root.unmount();
  return html;
};
const strip = (html: string) => html.replace(/<div data-test-panel="true">panel<\/div>/g, "");

/* 1: screens keep their controls */
const table = (highlight?: React.ReactNode) =>
  renderToStaticMarkup(
    <RoundResultsTable
      roundTitle="Round 2"
      rows={rows}
      times={new Map()}
      mySlot={1}
      autoSeconds={8}
      finalRound={false}
      continueState={continueState}
      {...(highlight !== undefined ? { highlight } : {})}
    />,
  );
const plain = table();
const withPanel = table(marker);
ok(
  withPanel.includes("data-continue-footer") &&
    withPanel.replace(/<[^>]+>/g, "").includes("Continue (8s)"),
  "RoundResultsTable: Continue missing with a highlight",
);
ok(strip(withPanel) === plain, "RoundResultsTable: a highlight changed the rest of the screen");
const tableEl = (highlight?: React.ReactNode) => (
  <RoundResultsTable
    roundTitle="Round 2"
    rows={rows}
    times={new Map()}
    mySlot={1}
    autoSeconds={8}
    finalRound={false}
    continueState={continueState}
    {...(highlight !== undefined ? { highlight } : {})}
  />
);
ok(
  quiet(() =>
    clientRender(
      tableEl(
        <ReplayBoundary>
          <Boom />
        </ReplayBoundary>,
      ),
    ),
  ) === quiet(() => clientRender(tableEl())),
  "RoundResultsTable: a failing highlight changed the screen",
);

const duel = (highlight?: React.ReactNode) =>
  renderToStaticMarkup(
    <RoundResult
      roundTitle="Round 2"
      myName="Ana"
      opponentName="Bo"
      myRoundScore={120}
      myVerdict="correct"
      mySummary=""
      myTime="20.0s"
      opponentRoundScore={90}
      opponentVerdict="correct"
      opponentSummary=""
      opponentTime="22.0s"
      autoSeconds={8}
      finalRound={false}
      continueState={continueState}
      {...(highlight !== undefined ? { highlight } : {})}
    />,
  );
ok(
  duel(marker).includes("data-continue-footer") && strip(duel(marker)) === duel(),
  "RoundResult: the highlight changed Continue or the screen",
);

const podium = (panel?: React.ReactNode) =>
  renderToStaticMarkup(
    <Podium
      rows={rows}
      mySlot={1}
      results={[]}
      roundOrder={["hover"]}
      isHost
      busy={false}
      onPlayAgain={() => undefined}
      onLeave={() => undefined}
      {...(panel !== undefined ? { playOfTheGame: panel } : {})}
    />,
  );
// Polish batch R: Leave moved into the room header's "⋯" menu (the route draws it, checked below).
ok(
  podium(marker).includes("Play again") &&
    strip(podium(marker)) === podium(),
  "Podium: the play of the game changed Play again or the screen",
);
const podiumEl = (panel?: React.ReactNode) => (
  <Podium
    rows={rows}
    mySlot={1}
    results={[]}
    roundOrder={["hover"]}
    isHost
    busy={false}
    onPlayAgain={() => undefined}
    onLeave={() => undefined}
    {...(panel !== undefined ? { playOfTheGame: panel } : {})}
  />
);
ok(
  quiet(() =>
    clientRender(
      podiumEl(
        <ReplayBoundary>
          <Boom />
        </ReplayBoundary>,
      ),
    ),
  ) === quiet(() => clientRender(podiumEl())),
  "Podium: a failing play of the game changed the screen",
);
const final = (panel?: React.ReactNode) =>
  renderToStaticMarkup(
    <FinalResult
      outcome="win"
      myName="Ana"
      opponentName="Bo"
      myTotal={500}
      opponentTotal={400}
      breakdown={[{ round: 1, mine: 100, theirs: 80 }]}
      roundOrder={["hover"]}
      busy={false}
      onPlayAgain={() => undefined}
      isHost
      onHome={() => undefined}
      {...(panel !== undefined ? { playOfTheGame: panel } : {})}
    />,
  );
ok(
  strip(final(marker)) === final() && final(marker).includes("Play again"),
  "FinalResult: the play of the game changed Play again / Home or the screen",
);

/* 2: source scan */
const files = [
  ...readdirSync("src/components/replay").map((f) => `src/components/replay/${f}`),
  ...readdirSync("src/lib/replay").map((f) => `src/lib/replay/${f}`),
];
const ROOM_ACTIONS =
  /\b(continueOn|advancePhase|readyUp|finishNow|startRoom|submitAnswer|leaveRoom|ensureRematch|continueFn|advancePhaseFn|readyUpFn|submitAnswerFn|setPhase|NEXT_ROUND_AUTO_MS|STANDINGS_MS|onContinue|onPlayAgain)\b/;
for (const file of files)
  ok(!ROOM_ACTIONS.test(readFileSync(file, "utf8")), `${file}: touches a room action or timer`);
const route = readFileSync("src/routes/duel.$code.tsx", "utf8");
ok(
  (route.match(/continueState=\{continueState\}/g) ?? []).length >= 4,
  "duel route: the screens must still get the same continueState",
);
ok(
  /<RoundHighlight\s+roomId=\{duel\.id\}\s+round=\{round\}\s+active=\{phase === "result"\}/.test(
    route,
  ),
  "duel route: the highlight is fetched only on the results screen",
);
ok(
  /onPlayAgain=\{\(\) => void handlePlayAgain\(\)\}/.test(route),
  "duel route: Play again unchanged",
);
ok(
  /label: "Leave", onSelect: \(\) => void handleLeave\(\)/.test(route),
  "duel route: the final screens' Leave (the header menu) unchanged",
);
const highlightSource = readFileSync("src/components/replay/RoundHighlight.tsx", "utf8");
ok(
  /const \[watching, setWatching\] = useState\(false\)/.test(highlightSource) &&
    /onClick=\{\(\) => setWatching\(true\)\}/.test(highlightSource),
  "the full-run viewer must open only on a tap",
);

// The dev-only replay lab: unreachable in production (a plain import.meta.env.DEV, never cast,
// so Vite folds it and drops the lab; the route answers not-found). Verified on the build output
// on 13 Oct 2026: the route's beforeLoad compiles to an unconditional notFound and the fixture is absent.
const lab = readFileSync("src/routes/replay-lab.tsx", "utf8");
ok(
  /beforeLoad: \(\) => \{\s*if \(!import\.meta\.env\.DEV\) throw notFound\(\);/.test(lab),
  "replay-lab: production must answer not-found",
);
ok(
  !/import\.meta as|\(import\.meta[^)]*\) as|import\.meta\.env as/.test(lab),
  "replay-lab: a cast on import.meta stops Vite removing the dev check",
);
ok(
  /import\.meta\.env\.DEV\s*\?\s*import\.meta\.glob\(/.test(lab),
  "replay-lab: the fixture loads only through a dev-only glob",
);

/* 3: timing and fit */
const m = (tick: number): Moment => ({
  game: "hover",
  id: "zone",
  tick,
  weight: 30,
  category: "success",
  caption: "ZONE 2",
  at: null,
});
// The results screen moves on after NEXT_ROUND_AUTO_MS (8 s): the highlight fits inside it.
ok(
  HIGHLIGHT_BUDGET_S <= NEXT_ROUND_AUTO_MS / 1000 - 0.4,
  `highlight budget ${HIGHLIGHT_BUDGET_S} s does not fit the ${NEXT_ROUND_AUTO_MS / 1000} s results screen`,
);
const two = planHighlight([m(900), m(2400)], 3600);
const total = two.reduce((s, c) => s + c.seconds, 0);
ok(
  two.length === 2 && two.every((c) => c.seconds >= 3 && c.seconds <= 4),
  `two-moment clips run ${two.map((c) => c.seconds.toFixed(2)).join(", ")} s (about 3.7 s each)`,
);
ok(
  total >= 7 && total <= HIGHLIGHT_BUDGET_S,
  `a two-moment highlight runs ${total.toFixed(2)} s (about 7.5 s, at most ${HIGHLIGHT_BUDGET_S})`,
);
const one = planHighlight([m(1200)], 3600)[0]!;
ok(
  one.seconds >= 6 && one.seconds <= HIGHLIGHT_BUDGET_S,
  `a one-moment highlight runs ${one.seconds.toFixed(2)} s`,
);
// With less time left (a late fetch, a slow first pass) it shrinks: one moment, a shorter lead, or nothing.
for (const left of [7.5, 6, 4.5, 3, 2, 1.6, 1.2, 0, -3]) {
  const plan = planHighlight([{ ...m(900), weight: 40 }, m(2400)], 3600, left);
  const secs = plan.reduce((s, c) => s + c.seconds, 0);
  ok(secs <= Math.max(0, left) + 1e-9, `${left} s left: the highlight runs ${secs.toFixed(2)} s`);
  ok(
    left < HIGHLIGHT_MIN_S ? plan.length === 0 : plan.length >= 1,
    `${left} s left: ${plan.length} clips`,
  );
  if (plan.length === 1)
    ok(plan[0]!.moment.weight === 40, `${left} s left: the heavier moment must stay`);
  const fallback = finalMomentsClip(3600, "hover", "90 points", left);
  ok(
    fallback === null ? left < HIGHLIGHT_MIN_S : fallback.seconds <= left + 1e-9,
    `${left} s left: the stand-in clip runs ${fallback?.seconds} s`,
  );
}
const lapse = planTimelapse(
  { type: "tower", minMoves: 7 } as unknown as PuzzleData,
  "0>2,0>1,2>1,0>2,1>0,1>2,0>2",
  true,
  4000,
);
ok(
  lapse !== null && lapse.frames.length * lapse.frameMs <= 4000 + 1e-6,
  `a time-lapse with 4 s left runs ${lapse ? (lapse.frames.length * lapse.frameMs).toFixed(0) : "-"} ms`,
);
// A timed answer (Lightbender's action log) keeps its moves' real rhythm, sped up into at most about 8 s.
{
  const timedPuzzle = { type: "laser", alogRev: 1 } as unknown as PuzzleData;
  const times = [2_000, 3_000, 9_000, 9_500, 40_000];
  const log = `alog1:${times.map((t, i) => `${i === times.length - 1 ? "f" : `p${10 + i}s`}@${t}`).join(",")}`;
  const timed = planTimelapse(timedPuzzle, log, true);
  ok(timed !== null && timed.timed, "a Lightbender action log plans a timed time-lapse");
  if (timed) {
    const at = timed.atMs;
    ok(at.every((t, i) => i === 0 || t > at[i - 1]!), `timed frames rise (${at.map(Math.round).join(", ")})`);
    ok(at[at.length - 1]! + timed.frameMs <= TIMELAPSE_CAP_MS, `the timed time-lapse lasts ${Math.round(at[at.length - 1]! + timed.frameMs)} ms (cap ${TIMELAPSE_CAP_MS})`);
    const gap = (i: number) => at[i + 1]! - at[i]!;
    ok(Math.abs(gap(2) / gap(1) - 6) < 1e-6 && Math.abs(gap(4) / gap(1) - 30.5) < 1e-6, "gaps keep the moves' real proportions");
  }
  ok(planTimelapse({ type: "laser" } as unknown as PuzzleData, "1|", true) === null, "an old Lightbender answer (no action log) has no time-lapse");
  const even = planTimelapse({ type: "tower", minMoves: 7 } as unknown as PuzzleData, "0>2,0>1,2>1,0>2,1>0,1>2,0>2", true);
  ok(even !== null && !even.timed && even.atMs.every((t, k) => Math.abs(t - k * even.frameMs) < 1e-9), "an untimed move list is evenly spaced");
}
// A stale-version reload (lib/appUpdate) on the results or final screen ends the panel: it never claims the gate or holds a submission.
for (const file of files)
  ok(
    !/\b(useUpdateGate|claimGate|trackSubmission)\b/.test(readFileSync(file, "utf8")),
    `${file}: holds the stale-version reload`,
  );
for (const file of [
  "src/components/replay/RoundHighlight.tsx",
  "src/components/replay/PlayOfTheGame.tsx",
]) {
  const text = readFileSync(file, "utf8");
  ok(
    /useAppUpdateStatus\(\) === "updating"/.test(text),
    `${file}: does not end on a stale-version reload`,
  );
}
ok(
  /if \(!winner \|\| updating\) return null;/.test(highlightSource) &&
    /if \(!chosen \|\| done \|\| updating\) return null;/.test(
      readFileSync("src/components/replay/PlayOfTheGame.tsx", "utf8"),
    ),
  "the highlight and the play of the game render nothing once the reload starts",
);
const potg = planPlayOfTheGame(m(2000), 3600);
ok(
  potg.seconds >= 10 && potg.seconds <= 15,
  `the play of the game runs ${potg.seconds.toFixed(1)} s (10–15 s)`,
);
for (const [players, h] of [
  [4, 667],
  [6, 844],
  [10, 667],
  [10, 932],
  [2, 568],
] as const) {
  const px = highlightPx(players, h);
  ok(
    px === 0 || h - 290 - players * 44 >= px,
    `${players} players at ${h} px: the highlight (${px} px) would push Continue off screen`,
  );
}
ok(
  highlightPx(10, 667) === 0 && highlightPx(4, 667) > 0,
  "slim bar on a short phone with a full room, picture otherwise",
);

/* 4: the time-lapse still drives every reveal board it supports */
const lapse4 = runTimelapseChecks();
checks += lapse4.checks;
failures.push(...lapse4.failures);

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} replay flow checks`);
  process.exit(1);
}
console.log(
  `Replay flow: ${checks} checks passed — results and podium keep Continue, Play again, Leave and the host's controls with or without a replay panel (and with a failing one); no replay code calls a room action or timer; highlight within the 8 s results screen (about 7.5 s), ends on a stale-version reload, play of the game 10–15 s; the panel never pushes Continue off screen; time-lapse boards driven: ${lapse4.driven.join(", ")}`,
);
