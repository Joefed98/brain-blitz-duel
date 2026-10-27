/**
 * The scoring standard's draft timeline on the phone (docs/scoring-standard.md): the stage wrapper (FeedbackStage)
 * appends the timeline to every draft and answer of a puzzle on a timed standard stamp, with the host clock's
 * round-clock times; never on an older stamp; keeps it on the device so a remount or reload of the same round carries
 * on; and the server grades the plain answer, stores it without the timeline, and reads the times.
 *
 *   bun scripts/standard-timeline-check.tsx
 */
import { Window } from "happy-dom";

const window = new Window({ width: 375, height: 667 });
Object.assign(globalThis, {
  window,
  document: window.document,
  localStorage: window.localStorage,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  CustomEvent: window.CustomEvent,
  IS_REACT_ACT_ENVIRONMENT: true,
});

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const { feedbackStage } = await import("../src/components/duel/FeedbackStage");
const { generatePuzzle, gradeAnswer } = await import("../src/lib/duel/generate.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { pinPreStandard, standardTimesParts } = await import("../src/lib/duel/standard/stamps");
const { TIMELINE_MARK, decodeTimeline, splitTimeline } = await import("../src/lib/duel/standard/timeline");
type Props = import("../src/puzzles/types").PuzzleStageProps;

let fail = 0;
const ok = (cond: boolean, msg: string) => {
  if (!cond) {
    fail++;
    console.log(`FAIL ${msg}`);
  }
};

/** A stand-in stage: hands its props out so the check can play drafts through the wrapper. */
let stageProps: Props | null = null;
function FakeStage(props: Props) {
  stageProps = props;
  return null;
}
const { gameTheme } = await import("../src/lib/fx/theme");
const theme = gameTheme("tilegrid", "word");
const Wrapped = feedbackStage(FakeStage, theme);

async function play(puzzle: import("../src/lib/duel/types").PuzzleData, stateKey: string, drafts: [string, number][], start = 1_000_000) {
  const sent: string[] = [];
  let submitted: string | null = null;
  const host = document.createElement("div");
  const root = createRoot(host as unknown as Element);
  let now = start;
  const render = () =>
    root.render(
      React.createElement(Wrapped, {
        puzzle,
        stateKey,
        phaseStartedAt: start,
        now,
        locked: false,
        onSubmit: (a: string) => {
          submitted = a;
        },
        onDraftAnswer: (a: string) => {
          sent.push(a);
        },
      }),
    );
  await act(async () => render());
  for (const [draft, t] of drafts) {
    now = start + t;
    await act(async () => render());
    await act(async () => stageProps!.onDraftAnswer!(draft));
  }
  const last = drafts[drafts.length - 1]![0];
  await act(async () => stageProps!.onSubmit(last));
  await act(async () => root.unmount());
  return { sent, submitted: submitted as string | null };
}

const deal = (type: import("../src/lib/duel/types").PuzzleType, seed: number) => withSeededRandom(seed, () => generatePuzzle(type, { bankSeed: seed }));

// A timed standard game (Interlock, tileGridRev 3): drafts and the answer carry the timeline, times on the round clock.
const tg = deal("tilegrid", 41);
ok(standardTimesParts(tg), "Interlock is dealt on a timed standard stamp");
const grid = (w: string) => w.padEnd(49, ".");
const run = await play(tg, "room-x-1", [["", 0], [grid("A"), 2_000], [grid("AB"), 5_000], [grid("A"), 9_000]]);
ok(run.sent.every((a) => a === "" || a.includes(TIMELINE_MARK)), "every non-empty draft carries the timeline");
const { body, timeline } = splitTimeline(run.submitted ?? "");
ok(body === grid("A"), "the answer's body is the stage's own answer");
const drafts = decodeTimeline(timeline, body, 100_000);
ok(JSON.stringify(drafts?.map((d) => d.t)) === JSON.stringify([0, 2_000, 5_000, 9_000]), `round-clock times kept (${JSON.stringify(drafts?.map((d) => d.t))})`);

// A remount of the same round carries on (memory), and a fresh page (memory gone) carries on from the device's copy.
const again = await play(tg, "room-x-1", [[grid("AC"), 12_000]]);
const resumed = decodeTimeline(splitTimeline(again.submitted ?? "").timeline, grid("AC"), 100_000);
ok(resumed?.length === 5 && resumed[4]!.t === 12_000, "a remount keeps the round's record");
ok(localStorage.getItem("duelz.timeline.v1:room-x-1")?.startsWith(TIMELINE_MARK) === true, "the record is kept on the device");
// Another round's record replaces it on the device.
await play(tg, "room-x-2", [[grid("B"), 1_000]]);
ok(localStorage.getItem("duelz.timeline.v1:room-x-1") === null, "only the latest round's record is kept on the device");

// The server grades the plain answer and stores it without the timeline.
const graded = gradeAnswer(tg, run.submitted ?? "", 0);
ok(graded.answer === body, "the stored answer is the plain answer");
ok(gradeAnswer(tg, body, 0).score <= graded.score, "the timeline can only add early extras");

// An older stamp never gets a timeline.
const before = pinPreStandard(true);
const old = deal("tilegrid", 41);
pinPreStandard(before);
ok(!standardTimesParts(old), "the pre-standard deal is not timed");
const oldRun = await play(old, "room-y-1", [[grid("A"), 2_000]]);
ok(oldRun.submitted === grid("A") && oldRun.sent.every((a) => !a.includes(TIMELINE_MARK)), "an older stamp's answers are untouched");

if (fail > 0) {
  console.log(`FAIL standard-timeline-check (${fail})`);
  process.exit(1);
}
console.log("PASS standard-timeline-check");
