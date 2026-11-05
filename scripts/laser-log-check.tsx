/**
 * Lightbender action-log check (13 Oct 2026; src/lib/duel/actionLog.ts,
 * src/lib/duel/laserLog.ts, docs/puzzle-action-log.md). New Lightbender rounds
 * are stamped `alogRev: 1` and answered with every placement, turn, move,
 * removal, Reset and FIRE on the round clock; the server counts the shots and
 * takes the layout at each shot from the log.
 *
 *  1. Phone parity: today's real Stage, played in happy-dom by scripted honest
 *     players (placing, turning, moving, dragging off, Undo, Reset, missed
 *     shots), sends the old "shot|layout" answer on unstamped puzzles and an
 *     action log on stamped ones.
 *  2. Legacy identity: the unstamped answers grade exactly as the original
 *     formula (verifyLaser + scoreLaser on the sent layout and shot).
 *  3. Honest identity: the stamped logs grade identically (score, correct,
 *     gems, time left) with the shot counted by the server. The one deliberate
 *     difference is asserted: a solving layout that was never fired is not a
 *     solve and earns the unfinished credit for the gems its final layout lights.
 *  4. Tampering: old-format answers, claimed shots, removed or extra FIREs,
 *     reordered actions, times beyond the round or after receipt + 1.5 s,
 *     earlier solve times, illegal pieces and garbage never beat the honest run
 *     (score, then time left), and every repair is counted. Dropping a missed
 *     FIRE is the one edit a server cannot see: the log is then a legal run that
 *     never took that shot (the phone could trace the beam without firing just
 *     as well), and it is asserted to grade exactly as that legal run.
 *  5. The reveal shows the server's layout, gems and shot.
 *
 *   bun scripts/laser-log-check.tsx
 */
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 700 });
const g = globalThis as Record<string, unknown>;
for (const key of [
  "window", "document", "navigator", "Node", "Element", "HTMLElement", "HTMLIFrameElement", "SVGElement",
  "Text", "Event", "MouseEvent", "PointerEvent", "KeyboardEvent", "FocusEvent", "getComputedStyle", "MutationObserver",
]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
g["IS_REACT_ACT_ENVIRONMENT"] = true;
// The Stage's sound cues dispatch a CustomEvent on happy-dom's window.
g["CustomEvent"] = (win as unknown as Record<string, unknown>)["CustomEvent"];
g["ResizeObserver"] ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && /not wrapped in act|act\(\.\.\.\)/.test(args[0])) return;
  originalError(...args);
};

// A fixed 400 × 400 board, so a pointer at a cell's centre finds that cell.
const BOARD = 400;
const proto = (win as unknown as { HTMLElement: { prototype: object } }).HTMLElement.prototype;
Object.defineProperty(proto, "getBoundingClientRect", {
  configurable: true,
  value: () => ({ left: 0, top: 0, x: 0, y: 0, right: BOARD, bottom: BOARD, width: BOARD, height: BOARD, toJSON: () => ({}) }),
});
for (const key of ["clientWidth", "clientHeight", "offsetWidth", "offsetHeight"])
  Object.defineProperty(proto, key, { configurable: true, get: () => BOARD });

// Fake clock and timers: the Stage's shot animation runs on window.setTimeout.
let clock = 0;
Date.now = () => clock;
let timerId = 0;
const timers = new Map<number, { at: number; cb: () => void }>();
const fakeSet = (cb: () => void, ms = 0) => {
  timers.set(++timerId, { at: clock + Math.max(0, ms), cb });
  return timerId;
};
const fakeClear = (id: number) => void timers.delete(id);
(win as unknown as Record<string, unknown>)["setTimeout"] = fakeSet;
(win as unknown as Record<string, unknown>)["clearTimeout"] = fakeClear;

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { renderToString } = await import("react-dom/server");
const { act } = React;

const { laserPuzzle } = await import("../src/puzzles/laser");
const { generateLaser } = await import("../src/lib/duel/laser.server");
const { verifyLaser, encodeLaserAnswer, decodeLaserAnswer, flipMirror } = await import("../src/lib/duel/laser");
const { gradeAnswer } = await import("../src/lib/duel/generate.server");
const { scoreLaser } = await import("../src/lib/duel/scoring");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { puzzleDef } = await import("../src/lib/duel/registry");
const { ACTION_LOG_PREFIX, ACTION_LOG_REV, decodeActionLog, encodeActionLog, usesActionLog } = await import("../src/lib/duel/actionLog");
const { laserAction, replayLaserLog } = await import("../src/lib/duel/laserLog");
const { LASER_CELLS, LASER_COLS, LASER_TIME_MS } = await import("../src/lib/duel/types");
type LaserPuzzleData = import("../src/lib/duel/types").LaserPuzzleData;
type MirrorPlacement = import("../src/lib/duel/types").MirrorPlacement;
type PuzzleData = import("../src/lib/duel/types").PuzzleData;
type LoggedAction = import("../src/lib/duel/actionLog").LoggedAction;

let failures = 0;
let passes = 0;
function check(ok: boolean, message: string) {
  if (ok) passes++;
  else {
    failures++;
    console.log(`  FAIL ${message}`);
  }
}

/* ---------------- the phone, scripted ---------------- */
type Step =
  | { t: number; kind: "select"; piece: "mirror" | "splitter" }
  | { t: number; kind: "tap"; cell: number }
  | { t: number; kind: "drag"; from: number; to: number | null }
  | { t: number; kind: "fire" | "undo" | "reset" };

const PHASE_START = 5_000_000;
const centre = (cell: number) => ({
  clientX: (cell % LASER_COLS) * 40.2 + 19.1,
  clientY: Math.floor(cell / LASER_COLS) * 40.2 + 19.1,
});

function advance(to: number) {
  for (;;) {
    const due = [...timers.entries()].filter(([, t]) => t.at <= to).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
    if (!due) break;
    timers.delete(due[0]);
    clock = Math.max(clock, due[1].at);
    act(() => due[1].cb());
  }
  clock = Math.max(clock, to);
}

interface PhoneRun {
  answer: string;
  submitted: boolean;
  /** Round-clock ms of the submit (the limit at the buzzer). */
  at: number;
  msRemaining: number;
}

async function playPhone(puzzle: LaserPuzzleData, steps: Step[], key: string): Promise<PhoneRun> {
  timers.clear();
  clock = PHASE_START;
  const container = win.document.createElement("div") as unknown as HTMLElement;
  win.document.body.appendChild(container as unknown as never);
  const root = createRoot(container);
  let submitted: { answer: string; at: number } | null = null;
  let draft = "";
  const Stage = laserPuzzle.Stage;
  const render = () =>
    act(() =>
      root.render(
        <Stage
          key={key}
          stateKey={key}
          puzzle={puzzle as PuzzleData}
          phaseStartedAt={PHASE_START}
          now={clock}
          locked={submitted !== null}
          onSubmit={(answer: string) => {
            if (!submitted) submitted = { answer, at: clock - PHASE_START };
          }}
          onDraftAnswer={(answer: string) => {
            draft = answer;
          }}
        />,
      ),
    );
  await render();
  const button = (text: string) =>
    [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === text || b.getAttribute("aria-label") === text);
  const board = () => container.querySelector('[data-game-arena="board"] > div') as HTMLElement;
  const pointer = (target: EventTarget, type: string, at: { clientX: number; clientY: number }) =>
    act(() => {
      target.dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true, ...at }) as unknown as Event);
    });

  for (const step of steps) {
    advance(PHASE_START + step.t);
    await render();
    if (step.kind === "select") button(step.piece === "mirror" ? "Select mirror" : "Select splitter")?.click();
    else if (step.kind === "tap") {
      pointer(board(), "pointerdown", centre(step.cell));
      pointer(win as unknown as EventTarget, "pointerup", centre(step.cell));
    } else if (step.kind === "drag") {
      pointer(board(), "pointerdown", centre(step.from));
      pointer(win as unknown as EventTarget, "pointerup", step.to === null ? { clientX: BOARD + 200, clientY: BOARD + 200 } : centre(step.to));
    } else {
      const label = step.kind === "fire" ? "Fire" : step.kind === "undo" ? "Undo" : "Reset";
      act(() => button(label)?.click());
    }
    await render();
  }
  advance(PHASE_START + LASER_TIME_MS);
  await render();
  act(() => root.unmount());
  container.remove();
  const done = submitted as { answer: string; at: number } | null;
  return done
    ? { answer: done.answer, submitted: true, at: done.at, msRemaining: LASER_TIME_MS - done.at }
    : { answer: draft, submitted: false, at: LASER_TIME_MS, msRemaining: 0 };
}

/* ---------------- honest players ---------------- */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Plan = "shot1" | "shot2" | "shot3" | "miss" | "unfired" | "reset";
interface Honest {
  steps: Step[];
  /** The shot that solves (null for none), and the layout on it or at the end. */
  shot: number | null;
  shots: number;
  layout: MirrorPlacement[];
}

/** A player who knows the answer but takes the scenic route the plan asks for. */
function honestPlayer(p: LaserPuzzleData, plan: Plan, seed: number): Honest {
  const r = rng(seed);
  const solution = [...(p.solution ?? [])].sort(() => r() - 0.5);
  const fixed = new Set([p.source, ...p.gems, ...p.bombs, ...p.blocks, ...(p.splitters ?? []), ...solution.map((s) => s.cell)]);
  const free = Array.from({ length: LASER_CELLS }, (_, c) => c).filter((c) => !fixed.has(c));
  const decoy = free[Math.floor(r() * free.length)]!;
  const steps: Step[] = [];
  let t = 1_200 + Math.floor(r() * 600);
  const gap = () => (t += 250 + Math.floor(r() * 650));
  let selected: "mirror" | "splitter" = "mirror";
  const select = (piece: "mirror" | "splitter") => {
    if (selected !== piece) steps.push({ t: gap(), kind: "select", piece });
    selected = piece;
  };
  const place = (piece: MirrorPlacement, viaDecoy: boolean) => {
    const splitter = piece.kind === "S|" || piece.kind === "S-";
    select(splitter ? "splitter" : "mirror");
    if (viaDecoy) {
      steps.push({ t: gap(), kind: "tap", cell: decoy });
      steps.push({ t: gap(), kind: "drag", from: decoy, to: piece.cell });
    } else steps.push({ t: gap(), kind: "tap", cell: piece.cell });
    // The tray places "/" and "S-"; a tap turns it.
    if (piece.kind === "\\" || piece.kind === "S|") steps.push({ t: gap(), kind: "tap", cell: piece.cell });
  };
  const fire = () => {
    steps.push({ t: gap(), kind: "fire" });
    t += 3_600; // the beam and its fade
  };
  // Every player starts with a slip: a mirror on the wrong cell, undone.
  steps.push({ t: gap(), kind: "tap", cell: decoy });
  steps.push({ t: gap(), kind: "undo" });
  if (plan === "reset") {
    place(solution[0]!, false);
    place(solution[1]!, false);
    steps.push({ t: gap(), kind: "reset" });
  }
  const held = plan === "shot2" || plan === "shot3" || plan === "miss" ? 1 : 0;
  solution.slice(0, solution.length - held).forEach((piece, i) => place(piece, i === 1));
  // A second slip: one piece turned the wrong way and back, one dragged off and replaced.
  const turned = solution[2]!;
  steps.push({ t: gap(), kind: "tap", cell: turned.cell }, { t: gap(), kind: "tap", cell: turned.cell });
  const dragged = solution[3]!;
  steps.push({ t: gap(), kind: "drag", from: dragged.cell, to: null });
  place(dragged, false);
  const partial = solution.slice(0, solution.length - held);
  if (plan === "unfired") return { steps, shot: null, shots: 0, layout: solution };
  if (plan === "miss") {
    fire();
    fire();
    fire();
    return { steps, shot: null, shots: 3, layout: partial };
  }
  const misses = plan === "shot2" ? 1 : plan === "shot3" ? 2 : 0;
  for (let i = 0; i < misses; i++) fire();
  if (held) place(solution.at(-1)!, false);
  fire();
  return { steps, shot: misses + 1, shots: misses + 1, layout: solution };
}

/* ---------------- grading helpers ---------------- */
const sortLayout = (layout: MirrorPlacement[]) => JSON.stringify([...layout].sort((a, b) => a.cell - b.cell));
type Graded = ReturnType<typeof gradeAnswer>;
const RECEIPT_LAG = 180;
function gradeRun(puzzle: LaserPuzzleData, answer: string, run: { msRemaining: number; at: number }): Graded {
  // The room: the server receives the answer a moment after the phone sends it.
  return gradeAnswer(puzzle as PuzzleData, answer, run.msRemaining, undefined, Math.max(0, LASER_TIME_MS - run.at - RECEIPT_LAG));
}
const beats = (x: Graded, honest: Graded) => x.score > honest.score || (x.score === honest.score && x.storedMs > honest.storedMs);
const sameGrade = (a: Graded, b: Graded) =>
  a.score === b.score && a.isCorrect === b.isCorrect && a.correctCount === b.correctCount && a.storedMs === b.storedMs;

/* ---------------- runs ---------------- */
const PLANS: Plan[] = ["shot1", "shot2", "shot3", "miss", "unfired", "reset"];
const SEEDS = Number(process.env["LASER_LOG_SEEDS"] ?? 8);
let honestRuns = 0;
let parityOk = true;
let legacyOk = true;
let identityOk = true;
let unfiredOk = true;
let shotsOk = true;
let revealOk = true;
let summaryOk = true;
let stampOk = true;
let tampered = 0;
let tamperOk = true;
let repairsOk = true;
let reorderOk = true;
let droppedMiss = 0;
let droppedMissOk = true;
let droppedMissGains = 0;

function fail(flagSetter: () => void, message: string) {
  flagSetter();
  console.log(`  ${message}`);
}

for (let seed = 1; seed <= SEEDS; seed++) {
  // Stamped speedPar like every live round (generatePuzzle), so scores use the par curve.
  const stamped = { ...withSeededRandom(10_000 + seed, generateLaser), speedPar: 1 } as LaserPuzzleData;
  if (stamped.alogRev !== ACTION_LOG_REV || !usesActionLog(stamped)) stampOk = false;
  const legacy: LaserPuzzleData = { ...stamped, alogRev: undefined };
  for (const plan of PLANS) {
    const honest = honestPlayer(stamped, plan, seed * 31 + PLANS.indexOf(plan));
    const key = `${seed}-${plan}`;
    const oldRun = await playPhone(legacy, honest.steps, `old-${key}`);
    const newRun = await playPhone(stamped, honest.steps, `new-${key}`);
    honestRuns++;

    // 1. The phone: the old answer on unstamped puzzles, a log on stamped ones.
    const sent = decodeLaserAnswer(oldRun.answer, stamped.mirrors + (stamped.splitterPieces ?? 0));
    const sameLayout = sortLayout(sent.mirrors) === sortLayout(honest.layout);
    if (!sameLayout || sent.fires !== Math.max(1, honest.shots) || oldRun.submitted !== (honest.shot !== null)) {
      fail(() => (parityOk = false), `${key}: phone sent ${oldRun.answer} (submitted ${oldRun.submitted}), expected shot ${Math.max(1, honest.shots)} on ${sortLayout(honest.layout)}`);
      continue;
    }
    if (honest.steps.at(-1)!.t > LASER_TIME_MS - 4_000) fail(() => (parityOk = false), `${key}: scripted run too long`);
    if (!newRun.answer.startsWith(ACTION_LOG_PREFIX) || newRun.submitted !== oldRun.submitted || newRun.at !== oldRun.at) {
      fail(() => (parityOk = false), `${key}: stamped phone sent ${newRun.answer.slice(0, 60)}… submitted ${newRun.submitted}`);
      continue;
    }
    const log = decodeActionLog(newRun.answer, LASER_TIME_MS);
    if (log.diag.clamped + log.diag.dropped !== 0) fail(() => (parityOk = false), `${key}: honest log needed repairs: ${JSON.stringify(log.diag)}`);

    // 2. Legacy identity: the old formula on the layout and shot sent.
    const oldGrade = gradeRun(legacy, oldRun.answer, oldRun);
    const verdict = verifyLaser(legacy, sent.mirrors, sent.fires);
    const oldScore = scoreLaser(verdict.solved, verdict.gemsLit, Math.max(1, honest.shots), oldRun.msRemaining, LASER_TIME_MS);
    if (oldGrade.score !== oldScore || oldGrade.isCorrect !== verdict.solved || oldGrade.storedMs !== oldRun.msRemaining)
      fail(() => (legacyOk = false), `${key}: legacy grade ${oldGrade.score} vs formula ${oldScore}`);

    // 3. Honest identity, from the log.
    const newGrade = gradeRun(stamped, newRun.answer, newRun);
    const replay = replayLaserLog(stamped, newRun.answer, LASER_TIME_MS);
    if (replay.shots !== honest.shots || replay.solvedShot !== honest.shot) fail(() => (shotsOk = false), `${key}: server counted ${replay.shots} shots, solve on ${replay.solvedShot}`);
    if (plan === "unfired") {
      // Never fired: not a solve; the final layout's gems earn the unfinished credit.
      const credit = scoreLaser(false, stamped.gems.length, 1, 0, LASER_TIME_MS);
      if (newGrade.isCorrect || newGrade.score !== credit || !oldGrade.isCorrect || newGrade.score >= oldGrade.score)
        fail(() => (unfiredOk = false), `${key}: unfired solve graded ${newGrade.score} (correct ${newGrade.isCorrect}), old ${oldGrade.score}`);
    } else if (!sameGrade(newGrade, oldGrade)) {
      fail(() => (identityOk = false), `${key}: log grade ${JSON.stringify([newGrade.score, newGrade.isCorrect, newGrade.correctCount, newGrade.storedMs])} vs old ${JSON.stringify([oldGrade.score, oldGrade.isCorrect, oldGrade.correctCount, oldGrade.storedMs])}`);
    }

    // The standings line reads the same from either row.
    const asRow = (graded: Graded, answer: string) =>
      ({ id: "r", duel_id: "d", player_slot: 1, round_number: 1, answer, is_correct: graded.isCorrect, ms_remaining: graded.storedMs,
        reaction_avg_ms: graded.reactionAvgMs, correct_count: graded.correctCount, errors: graded.errors, extra: graded.extra,
        score: graded.score, submitted_at: "" }) as import("../src/lib/duel/types").RoundResultRow;
    if (plan !== "unfired") {
      const a = puzzleDef("laser").roundSummary(asRow(oldGrade, oldRun.answer), legacy as PuzzleData);
      const b = puzzleDef("laser").roundSummary(asRow(newGrade, newRun.answer), stamped as PuzzleData);
      if (JSON.stringify(a) !== JSON.stringify(b)) fail(() => (summaryOk = false), `${key}: summary ${JSON.stringify(b)} vs old ${JSON.stringify(a)}`);
    }

    // 5. The reveal draws the server's layout and shot.
    const Reveal = laserPuzzle.Reveal;
    const html = renderToString(
      <Reveal puzzle={stamped as PuzzleData} myAnswer={newRun.answer} myCorrect={newGrade.isCorrect} myReactionAvgMs={null}
        myMsRemaining={newGrade.storedMs} timeLimitMs={LASER_TIME_MS} />,
    ).replace(/<!-- -->/g, "");
    const ordinal = ["1st", "2nd", "3rd"][(honest.shot ?? 1) - 1];
    // Text pass (4 Nov 2026): "6 of 6 gems" (plain words), the time after a comma.
    const expectText = newGrade.isCorrect ? `6 of 6 gems · ${ordinal} shot` : newGrade.correctCount ? `${newGrade.correctCount} of 6 gems` : "Missed";
    if (!html.includes(expectText)) fail(() => (revealOk = false), `${key}: reveal lacks "${expectText}"`);

    // 4. Tampering, on the stamped puzzle.
    const actions = log.actions;
    const variants: { name: string; answer: string; at?: number; ms?: number; repaired: boolean }[] = [];
    const add = (name: string, list: LoggedAction[] | string, repaired: boolean, ms?: number) =>
      variants.push({ name, answer: typeof list === "string" ? list : encodeActionLog(list), repaired, ...(ms === undefined ? {} : { ms }) });
    const fires = actions.map((a, i) => (a.a === "f" ? i : -1)).filter((i) => i >= 0);
    // Claimed shots.
    add("old-format first-shot claim", encodeLaserAnswer(honest.layout, 1), true);
    add("old-format claim on a log", `${ACTION_LOG_PREFIX}1|${honest.layout.map((m) => `${m.cell}:${m.kind}`).join(",")}`, true);
    add("numbered FIREs", actions.map((a) => (a.a === "f" ? { ...a, a: "f1" } : a)), true);
    add("a claimed shot count", [...actions, { a: "s1", t: actions.at(-1)?.t ?? 0 }], true);
    // Removed FIREs.
    if (fires.length) {
      add("solving FIRE removed", actions.filter((_, i) => i !== fires.at(-1)), false);
      add("every FIRE removed", actions.filter((a) => a.a !== "f"), false);
    }
    // Extra FIREs.
    add("FIRE flood", [...actions.slice(0, 1), ...Array.from({ length: 8 }, (_, k) => ({ a: "f", t: (actions[0]?.t ?? 0) + k + 1 })), ...actions.slice(1).map((a) => ({ ...a, t: a.t + 20 }))], true);
    // Reordered actions (times unchanged).
    for (let k = 0; k < 6; k++) {
      const rr = rng(seed * 1000 + k);
      add(`shuffle ${k}`, [...actions].sort(() => rr() - 0.5), true);
    }
    add("reversed", [...actions].reverse(), true);
    if (fires.length) {
      const f = fires.at(-1)!;
      const moved = [...actions];
      const [solve] = moved.splice(f, 1);
      moved.splice(Math.max(0, f - 4), 0, solve!);
      add("solving FIRE moved earlier", moved, true);
      // Times edited: the solve claimed earlier than it happened.
      add("solve time edited earlier", actions.map((a, i) => (i === f ? { ...a, t: Math.max(0, a.t - 10_000) } : a)), false, newGrade.storedMs);
      // Beyond the round, and after the receipt.
      add("solving FIRE after the round", actions.map((a, i) => (i === f ? { ...a, t: LASER_TIME_MS + 1 } : a)), true);
      add("solving FIRE after receipt + 1.5 s", actions.map((a, i) => (i === f ? { ...a, t: newRun.at + RECEIPT_LAG + 1_501 } : a)), true);
    }
    add("every action after the round", actions.map((a) => ({ ...a, t: a.t + LASER_TIME_MS + 1 })), true);
    add("negative times", ACTION_LOG_PREFIX + actions.map((a) => `${a.a}@${-a.t - 1}`).join(","), true);
    // Illegal pieces: on the source, blocks, bombs, gems and fixed splitters; turns, moves and removals of nothing.
    const fixedCells = [stamped.source, ...stamped.blocks, ...stamped.bombs, ...stamped.gems, ...(stamped.splitters ?? [])];
    const illegal: LoggedAction[] = [
      ...fixedCells.map((c, k) => ({ a: laserAction.place(c, k % 2 ? "/" : "S-"), t: 1 + k })),
      ...fixedCells.map((c, k) => ({ a: laserAction.turn(c), t: 100 + k })),
      ...fixedCells.map((c, k) => ({ a: laserAction.move(c, (c + 1) % LASER_CELLS), t: 200 + k })),
      ...fixedCells.map((c, k) => ({ a: laserAction.remove(c), t: 300 + k })),
    ];
    add("illegal pieces", [...illegal, ...actions.map((a) => ({ ...a, t: a.t + 400 }))], true);
    // Garbage.
    const gr = rng(seed * 77);
    const junk = (n: number) => Array.from({ length: n }, () => String.fromCharCode(32 + Math.floor(gr() * 95))).join("");
    for (const text of ["", ACTION_LOG_PREFIX, `${ACTION_LOG_PREFIX}f`, `${ACTION_LOG_PREFIX}f@NaN,f@1e3,f@0x10`, `${ACTION_LOG_PREFIX}${junk(400)}`, junk(300),
      `${ACTION_LOG_PREFIX}${"f@5,".repeat(3000)}`, `${ACTION_LOG_PREFIX}p999s@5,pxs@6,m1-2-3@7,r@8,x-1@9,c1@10,F@11`])
      add(`garbage ${JSON.stringify(text.slice(0, 24))}`, text, text.length > 0 && text !== ACTION_LOG_PREFIX);

    for (const v of variants) {
      tampered++;
      const graded = gradeRun(stamped, v.answer, { msRemaining: v.ms ?? newRun.msRemaining, at: newRun.at });
      if (beats(graded, newGrade)) fail(() => (tamperOk = false), `${key}: "${v.name}" scored ${graded.score} (${graded.storedMs} ms) over honest ${newGrade.score} (${newGrade.storedMs} ms)`);
      const repaired = Number((graded.extra as { repaired?: number } | null)?.repaired ?? 0);
      if (v.repaired && repaired === 0 && v.answer !== newRun.answer) fail(() => (repairsOk = false), `${key}: "${v.name}" was not counted as repaired`);
      if (v.name.startsWith("shuffle") || v.name === "reversed" || v.name === "solving FIRE moved earlier") {
        if (!sameGrade(graded, newGrade)) fail(() => (reorderOk = false), `${key}: "${v.name}" graded differently from the honest run`);
      }
    }
    // Dropping a missed FIRE: indistinguishable from a run that never took that shot.
    for (const f of fires.slice(0, -1)) {
      droppedMiss++;
      const edited = actions.filter((_, i) => i !== f);
      const graded = gradeRun(stamped, encodeActionLog(edited), newRun);
      const legal = replayLaserLog(stamped, encodeActionLog(edited), LASER_TIME_MS);
      const expect = scoreLaser(legal.solved, legal.gemsLit, legal.solved ? legal.solvedShot! : Math.max(1, legal.shots), graded.storedMs, LASER_TIME_MS);
      if (beats(graded, newGrade)) droppedMissGains++;
      if (graded.score !== expect || legal.shots !== honest.shots - 1) {
        droppedMissOk = false;
        console.log(`  ${key}: dropped missed FIRE graded ${graded.score}, legal run ${expect} (${legal.shots} shots)`);
      }
    }
  }
}

check(stampOk, `stamp: every new Lightbender puzzle is stamped alogRev ${ACTION_LOG_REV}`);
check(parityOk, `phone parity: ${honestRuns} scripted runs send the old answer unstamped and a clean action log stamped`);
check(legacyOk, "legacy identity: unstamped answers grade exactly as the original formula");
check(shotsOk, "server shot count: the server counts every FIRE and finds the solving shot from the log");
check(identityOk, "honest identity: stamped logs grade identically (score, correct, gems, time left)");
check(unfiredOk, "never fired: a solving layout without a FIRE is not a solve and earns the unfinished credit");
check(revealOk, "reveal: shows the server's layout, gems and shot from the log");
check(summaryOk, "standings line: reads the same from the log row as from the old row");
check(tamperOk, `tampering: ${tampered} altered answers never beat the honest run on score or time left`);
check(repairsOk, "tampering: every repair is counted");
check(reorderOk, "reordering: shuffled actions replay in time order, exactly as the honest run");
check(droppedMissOk, `dropped missed FIREs: ${droppedMiss} edits grade exactly as the legal run that never took that shot (not detectable server-side)`);
console.log(`  dropped missed FIREs: ${droppedMissGains}/${droppedMiss} score above the honest run (an earlier solving shot); the documented limit of a phone-side log`);

/* ---------------- unit cases ---------------- */
const p = { ...withSeededRandom(4242, generateLaser), speedPar: 1 } as LaserPuzzleData;
const sol = p.solution ?? [];
const placeAll = (t0: number): LoggedAction[] => sol.map((m, k) => ({ a: laserAction.place(m.cell, m.kind), t: t0 + k }));
const solvedOn = (log: LoggedAction[]) => replayLaserLog(p, encodeActionLog(log), LASER_TIME_MS);
check(solvedOn([...placeAll(100), { a: "f", t: 500 }]).solvedShot === 1, "unit: placing the solution and firing solves on shot 1");
check(solvedOn([{ a: "f", t: 50 }, { a: "f", t: 60 }, { a: "f", t: 70 }, ...placeAll(100), { a: "f", t: 500 }]).solved === false, "unit: a fourth FIRE is never counted");
check(solvedOn([...placeAll(100), { a: laserAction.turn(sol[0]!.cell), t: 400 }, { a: "f", t: 500 }]).solved === false, "unit: the layout at the shot is the one fired");
check(solvedOn([...placeAll(100), { a: "f", t: 500 }, { a: laserAction.reset(), t: 600 }]).layout.length === sol.length, "unit: actions after the solve change nothing");
check(solvedOn([{ a: laserAction.place(sol[0]!.cell, flipMirror(sol[0]!.kind)), t: 1 }, { a: laserAction.turn(sol[0]!.cell), t: 2 }]).layout[0]?.kind === sol[0]!.kind, "unit: a turn flips the piece");
check(laserAction.place(99, "S|") === "p99v" && laserAction.move(3, 45) === "m3-45", "unit: action codes");
check(decodeActionLog("alog1:f@10,f@5", 60_000).diag.clamped === 1 && decodeActionLog("alog1:f@10,f@5", 60_000).actions[0]!.t === 5, "unit: out-of-order actions are put back in time order and counted");
check(decodeActionLog("log1:5,6", 60_000).actions.length === 0, "unit: a tap log is not an action log");

console.log(`laser-log-check: ${passes} passed, ${failures} failed (${honestRuns} honest runs over ${SEEDS} boards, ${tampered} tampered answers, ${droppedMiss} dropped missed FIREs)`);
if (failures) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: Lightbender grades from the action log; honest runs unchanged; tampering never beats the honest run (dropping a missed FIRE grades as the legal run without that shot)");
process.exit(0);
