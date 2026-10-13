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
 *     whole highlight 8–12 s for two moments; the slim bar takes over before
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
import { planHighlight, planPlayOfTheGame } from "../src/lib/replay/pick";
import type { Moment } from "../src/lib/replay/moments";

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
  withPanel.includes("data-continue-footer") && withPanel.includes("Continue (8s)"),
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
ok(
  podium(marker).includes("Play again") &&
    podium(marker).includes("Leave") &&
    strip(podium(marker)) === podium(),
  "Podium: the play of the game changed Play again / Leave or the screen",
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
const highlightSource = readFileSync("src/components/replay/RoundHighlight.tsx", "utf8");
ok(
  /const \[watching, setWatching\] = useState\(false\)/.test(highlightSource) &&
    /onClick=\{\(\) => setWatching\(true\)\}/.test(highlightSource),
  "the full-run viewer must open only on a tap",
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
const two = planHighlight([m(900), m(2400)], 3600);
const total = two.reduce((s, c) => s + c.seconds, 0);
ok(
  two.every((c) => c.seconds >= 3 && c.seconds <= 5),
  `highlight clips run ${two.map((c) => c.seconds.toFixed(1)).join(", ")} s (3–5 s each)`,
);
ok(total >= 8 && total <= 12, `a two-moment highlight runs ${total.toFixed(1)} s (8–12 s)`);
const one = planHighlight([m(1200)], 3600)[0]!;
ok(
  one.seconds >= 3 && one.seconds <= 6.5,
  `a one-moment highlight runs ${one.seconds.toFixed(1)} s`,
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

if (failures.length) {
  console.log(failures.join("\n"));
  console.log(`FAIL: ${failures.length} of ${checks} replay flow checks`);
  process.exit(1);
}
console.log(
  `Replay flow: ${checks} checks passed — results and podium keep Continue, Play again, Leave and the host's controls with or without a replay panel (and with a failing one); no replay code calls a room action or timer; highlight 8–12 s, play of the game 10–15 s; the panel never pushes Continue off screen`,
);
