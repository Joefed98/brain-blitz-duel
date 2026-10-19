/**
 * stage-state-reload-check (19 Oct 2026, room flow only): a room round's stage inputs survive a reload,
 * or iOS evicting the home-screen app (src/lib/duel/stageState.ts `persistStageState`), so the stage
 * continues the same board and the draft keeper (roomDraft.ts) keeps extending the restored draft.
 *
 *  1. The tagged encoding round-trips Set, Map, arrays (undefined entries), plain objects (a "$t" key
 *     too), NaN, ±Infinity and -0; functions, class instances, Dates and cycles are refused.
 *  2. A marked round's bucket is written on every change and a reload (memory cleared) hydrates it
 *     before the stage reads it; a value that can't round-trip falls back to the stage's initial;
 *     marking a round prunes other rounds; stale (over the TTL) and corrupt entries are never
 *     restored; blocked storage throws nothing; unmarked keys (practice, demos, "") never persist.
 *  3. Real stages in happy-dom (Exact, Pipes): played, reloaded (unmount, memory cleared, a new
 *     keeper over the same storage, remount), the board is the same, the first draft is the restored
 *     one, and the next action's draft extends it and replaces it in the keeper.
 *  4. The room page marks its live puzzle round (never an arcade run) before the stage renders.
 *
 *   bun scripts/stage-state-reload-check.tsx
 */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 390, height: 844 });
const g = globalThis as Record<string, unknown>;
for (const key of [
  "window", "document", "navigator", "Node", "Element", "HTMLElement", "HTMLButtonElement", "SVGElement",
  "Text", "Event", "MouseEvent", "PointerEvent", "KeyboardEvent", "FocusEvent", "getComputedStyle", "MutationObserver",
  "CustomEvent",
]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
g["IS_REACT_ACT_ENVIRONMENT"] = true;
// Sound cues and effects dispatch events on happy-dom's window.
for (const key of ["Event", "CustomEvent"]) g[key] = (win as unknown as Record<string, unknown>)[key];
g["ResizeObserver"] ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
g["requestAnimationFrame"] ??= (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 16);
g["cancelAnimationFrame"] ??= (id: number) => clearTimeout(id);
const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && /not wrapped in act|act\(\.\.\.\)/.test(args[0])) return;
  originalError(...args);
};

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;

const stage = await import("../src/lib/duel/stageState");
const { createDraftKeeper } = await import("../src/lib/duel/roomDraft");
const { generatePuzzle } = await import("../src/lib/duel/generate.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { puzzleDef } = await import("../src/lib/duel/registry");
const { decodeSteps } = await import("../src/lib/duel/target");
type DraftStorage = import("../src/lib/duel/roomDraft").DraftStorage;
type PuzzleData = import("../src/lib/duel/types").PuzzleData;

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

function memoryStorage(): DraftStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

let clock = 5_000_000;
const now = () => clock;
const P = stage.STAGE_STATE_PREFIX;

/* ------------------------------------------------------------ 1. encoding */
{
  const sparse: (string | undefined)[] = [];
  sparse[2] = "c";
  const value = {
    set: new Set([1, 2, 3]),
    map: new Map<unknown, unknown>([["a", [1, 2]], [3, new Set(["x"])]]),
    list: [[1, 2], [], [3]],
    holes: sparse,
    nums: [NaN, Infinity, -Infinity, -0, 0, 1.5],
    nested: { a: null, b: undefined, c: { d: true } },
    tagged: { $t: "set", v: [1] },
  };
  const text = stage.encodeStageValue(value);
  check(text !== null, "a Set/Map/array value could not be encoded");
  const back = stage.decodeStageValue(text!) as typeof value;
  check(back.set instanceof Set && [...back.set].join() === "1,2,3", "a Set did not round-trip");
  check(back.map instanceof Map && (back.map.get("a") as number[]).join() === "1,2" && back.map.get(3) instanceof Set, "a Map did not round-trip");
  check(JSON.stringify(back.list) === JSON.stringify(value.list), "nested arrays did not round-trip");
  check(back.holes.length === 3 && back.holes[0] === undefined && back.holes[2] === "c", "undefined array entries did not round-trip");
  check(Number.isNaN(back.nums[0]) && back.nums[1] === Infinity && back.nums[2] === -Infinity, "NaN/Infinity did not round-trip");
  check(Object.is(back.nums[3], -0) && Object.is(back.nums[4], 0) && back.nums[5] === 1.5, "-0 / numbers did not round-trip");
  check("b" in back.nested && back.nested.b === undefined && back.nested.c.d === true, "plain objects did not round-trip");
  check(!(back.tagged instanceof Set) && back.tagged.$t === "set" && back.tagged.v[0] === 1, "an object with a $t key was read as a tag");
  class Thing {}
  const cyclic: unknown[] = [];
  cyclic.push(cyclic);
  for (const [bad, label] of [
    [() => 1, "a function"],
    [new Thing(), "a class instance"],
    [new Date(0), "a Date"],
    [[1, { f: () => 2 }], "a nested function"],
    [cyclic, "a cycle"],
    [10n, "a bigint"],
  ] as const) {
    check(stage.encodeStageValue(bad) === null, `${label} was encoded`);
  }
  const shared = [1];
  check(stage.encodeStageValue([shared, shared]) !== null, "a shared (non-cyclic) array was refused");
}

/* ------------------------------------------------------------ 2. buckets through a reload */
// A tiny component that reads stage state, so the hook is exercised the way stages use it.
type Setter = (next: unknown) => void;
const setters: Record<string, Setter> = {};
const seen: Record<string, unknown> = {};
function Probe({ stateKey, names }: { stateKey: string; names: [string, () => unknown][] }) {
  for (const [name, initial] of names) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [value, set] = stage.useStageState<unknown>(stateKey, name, initial);
    seen[name] = value;
    setters[name] = set as Setter;
  }
  return null;
}
const host = (win.document as unknown as Document).createElement("div");
(win.document as unknown as Document).body.appendChild(host as unknown as Node);
async function mount(node: React.ReactElement) {
  const root = createRoot(host as unknown as HTMLElement);
  await act(async () => root.render(node));
  return root;
}
async function unmount(root: ReturnType<typeof createRoot>) {
  await act(async () => root.unmount());
}

{
  const KEY = "room-a-0-2";
  const store = memoryStorage();
  store.setItem(P + "room-a-0-1", JSON.stringify({ at: clock, values: { x: 1 } }));
  store.setItem(P + "room-b-0-4", JSON.stringify({ at: clock, values: { x: 1 } }));
  store.setItem("duelz.roomDraft.v1:room-a-0-1", "{}");
  stage.persistStageState(KEY, { storage: () => store, clock: now });
  check([...store.map.keys()].filter((k) => k.startsWith(P)).length === 0, "marking a round left other rounds' stage inputs");
  check(store.map.has("duelz.roomDraft.v1:room-a-0-1"), "stage pruning removed a draft entry");

  const names: [string, () => unknown][] = [
    ["picked", () => new Set<number>()],
    ["paths", () => new Map<string, number[]>()],
    ["moves", () => [] as number[]],
    ["fn", () => () => 0],
  ];
  let root = await mount(<Probe stateKey={KEY} names={names} />);
  check(!store.map.has(P + KEY), "an untouched round was written");
  await act(async () => {
    setters.picked!(new Set([4, 7]));
    setters.paths!(new Map([["red", [1, 2, 3]]]));
    setters.moves!((m: number[]) => [...m, 9, -0]);
    setters.fn!(() => () => 42);
  });
  check(store.map.has(P + KEY), "a change to a marked round was not written");
  await unmount(root);

  // Reload: memory gone, the page marks the round again, the stage mounts.
  stage.clearAllStageStateForReload();
  stage.persistStageState(KEY, { storage: () => store, clock: now });
  root = await mount(<Probe stateKey={KEY} names={names} />);
  check(stage.stageStateRestored(KEY), "the reload did not restore the round's bucket");
  check(seen.picked instanceof Set && [...(seen.picked as Set<number>)].join() === "4,7", "a Set value was not restored");
  check(seen.paths instanceof Map && (seen.paths as Map<string, number[]>).get("red")?.join() === "1,2,3", "a Map value was not restored");
  check(Array.isArray(seen.moves) && (seen.moves as number[])[0] === 9 && Object.is((seen.moves as number[])[1], -0), "an array value was not restored");
  check(typeof seen.fn === "function" && (seen.fn as () => number)() === 0, "a function value did not fall back to the stage's initial");
  await unmount(root);

  // Stale: past the TTL the round starts fresh.
  stage.clearAllStageStateForReload();
  clock += stage.STAGE_STATE_TTL_MS + 1;
  stage.persistStageState(KEY, { storage: () => store, clock: now });
  root = await mount(<Probe stateKey={KEY} names={names} />);
  check(!stage.stageStateRestored(KEY) && (seen.picked as Set<number>).size === 0, "a stale bucket was restored");
  await unmount(root);

  // Corrupt: never restored, never throws.
  stage.clearAllStageStateForReload();
  store.map.set(P + KEY, "{not json");
  stage.persistStageState(KEY, { storage: () => store, clock: now });
  root = await mount(<Probe stateKey={KEY} names={names} />);
  check(!stage.stageStateRestored(KEY) && (seen.moves as number[]).length === 0, "a corrupt bucket was restored");
  await unmount(root);

  // Blocked storage: inputs stay in memory, nothing throws.
  stage.clearAllStageStateForReload();
  const throwing: DraftStorage = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("full");
    },
    removeItem: () => {
      throw new Error("blocked");
    },
    key: () => {
      throw new Error("blocked");
    },
    length: 1,
  };
  let threw = false;
  try {
    stage.persistStageState(KEY, { storage: () => throwing, clock: now });
    root = await mount(<Probe stateKey={KEY} names={names} />);
    await act(async () => setters.moves!([1, 2]));
    check((seen.moves as number[]).join() === "1,2", "blocked storage lost the in-memory inputs");
    await unmount(root);
  } catch {
    threw = true;
  }
  check(!threw, "blocked storage threw");

  // Unmarked keys (practice, demos) never persist, nor does a room with no live puzzle round.
  stage.clearAllStageStateForReload();
  const quiet = memoryStorage();
  stage.persistStageState("", { storage: () => quiet, clock: now });
  for (const practiceKey of ["practice-1", "demo-target", "room-a-0-3"]) {
    root = await mount(<Probe stateKey={practiceKey} names={names} />);
    await act(async () => setters.moves!([5]));
    await unmount(root);
  }
  check(quiet.map.size === 0, `unmarked rounds were persisted: ${[...quiet.map.keys()].join(", ")}`);
  stage.persistStageState("room-a-0-3", { storage: () => quiet, clock: now });
  root = await mount(<Probe stateKey="practice-2" names={names} />);
  await act(async () => setters.moves!([6]));
  await unmount(root);
  check(quiet.map.size === 0, "a practice key was persisted while a room round was marked");
}

/* ------------------------------------------------------------ 3. real stages, reloaded */
const doc = win.document as unknown as Document;
const click = async (el: Element | null | undefined, label: string) => {
  if (!el) {
    failures.push(`no ${label} to tap`);
    return;
  }
  await act(async () => {
    (el as HTMLElement).dispatchEvent(new (win as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("click", { bubbles: true }) as unknown as Event);
  });
};

interface Room {
  store: ReturnType<typeof memoryStorage>;
  key: string;
  drafts: string[];
  keeper: ReturnType<typeof createDraftKeeper>;
}
function openPage(room: Room) {
  stage.clearAllStageStateForReload();
  room.keeper = createDraftKeeper(() => room.store, now);
  room.drafts = [];
  stage.persistStageState(room.key, { storage: () => room.store, clock: now });
}
async function mountStage(room: Room, puzzle: PuzzleData) {
  const Stage = puzzleDef(puzzle.type).Stage;
  const start = Date.now();
  return mount(
    <Stage
      puzzle={puzzle}
      stateKey={room.key}
      phaseStartedAt={start}
      now={start}
      locked={false}
      onSubmit={(answer: string) => room.keeper.push(room.key, answer, true)}
      onDraftAnswer={(answer: string) => {
        room.drafts.push(answer);
        room.keeper.push(room.key, answer);
      }}
    />,
  );
}

// Exact: combine two tiles, reload, combine once more.
{
  let tested = 0;
  for (const seed of [2, 5, 9, 13, 21]) {
    const puzzle = withSeededRandom(seed, () => generatePuzzle("target")) as PuzzleData;
    if (puzzle.type !== "target") continue;
    const [a, b, c] = puzzle.tiles;
    if (a + b === puzzle.target || a + b + c === puzzle.target) continue;
    const room: Room = { store: memoryStorage(), key: `room-exact-${seed}-0-1`, drafts: [], keeper: createDraftKeeper(() => null) };
    openPage(room);
    let root = await mountStage(room, puzzle);
    const tile = (id: number) => doc.querySelector(`[data-tile-id="${id}"]`);
    const plus = () => [...doc.querySelectorAll(".exact-ops button")].find((el) => el.textContent === "+");
    await click(tile(0), "tile 0");
    await click(plus(), "+");
    await click(tile(1), "tile 1");
    const before = room.keeper.current(room.key);
    check(decodeSteps(before).length === 1, `Exact seed ${seed}: the first combine was not drafted (${before})`);
    await unmount(root);

    openPage(room);
    root = await mountStage(room, puzzle);
    check(stage.stageStateRestored(room.key), `Exact seed ${seed}: the board was not restored`);
    check(tile(1)?.getAttribute("data-state") === "consumed" && tile(0)?.textContent === String(a + b), `Exact seed ${seed}: the restored board is not the played one`);
    check(tile(0)?.getAttribute("data-state") === "selected", `Exact seed ${seed}: the selected tile was not restored`);
    check(room.drafts[0] === before, `Exact seed ${seed}: the first draft after the reload (${room.drafts[0]}) is not the restored one (${before})`);
    check(room.keeper.current(room.key) === before, `Exact seed ${seed}: the keeper lost the restored draft`);
    await click(plus(), "+");
    await click(tile(2), "tile 2");
    const after = room.keeper.current(room.key);
    check(decodeSteps(after).length === 2 && after.startsWith(before + ";"), `Exact seed ${seed}: the next combine did not extend the restored draft (${before} → ${after})`);
    check(!room.keeper.restored(room.key), `Exact seed ${seed}: the keeper still holds the restored draft over new play`);
    await unmount(root);
    // A third page sees the extended board and draft.
    openPage(room);
    check(room.keeper.current(room.key) === after, `Exact seed ${seed}: the extended draft was not stored`);
    root = await mountStage(room, puzzle);
    check(tile(2)?.getAttribute("data-state") === "consumed", `Exact seed ${seed}: the extended board was not stored`);
    await unmount(root);
    tested++;
  }
  check(tested >= 3, `only ${tested} Exact boards tested`);
}

// Pipes: two tiles turned, reload, one more (the draft is the whole board, one hex digit a tile).
{
  let tested = 0;
  for (const seed of [4, 8, 15]) {
    const puzzle = withSeededRandom(seed, () => generatePuzzle("pipes")) as PuzzleData;
    if (puzzle.type !== "pipes") continue;
    const room: Room = { store: memoryStorage(), key: `room-pipes-${seed}-0-3`, drafts: [], keeper: createDraftKeeper(() => null) };
    openPage(room);
    let root = await mountStage(room, puzzle);
    const opening = room.drafts[0] ?? "";
    const turned = new Set<number>();
    /** Turns the first not-yet-turned tile whose turn changes the board; returns its index. */
    const turnNew = async () => {
      const cells = [...doc.querySelectorAll(".pipes-play-board .pipe-tile")];
      for (let i = 0; i < cells.length; i++) {
        if (turned.has(i)) continue;
        const draft = room.keeper.current(room.key);
        await click(cells[i], "pipe tile");
        if (room.keeper.current(room.key) !== draft) {
          turned.add(i);
          return i;
        }
      }
      return -1;
    };
    await turnNew();
    await turnNew();
    const before = room.keeper.current(room.key);
    const diff = (x: string, y: string) => [...x].filter((ch, i) => ch !== y[i]).length;
    check(before.length === opening.length && diff(before, opening) === 2, `Pipes seed ${seed}: two turns were not drafted (${opening} → ${before})`);
    await unmount(root);

    openPage(room);
    root = await mountStage(room, puzzle);
    check(stage.stageStateRestored(room.key), `Pipes seed ${seed}: the board was not restored`);
    check(room.drafts[0] === before, `Pipes seed ${seed}: the first draft after the reload (${room.drafts[0]}) is not the restored one (${before})`);
    const third = await turnNew();
    const after = room.keeper.current(room.key);
    check(third >= 0 && diff(after, before) === 1 && after[third] !== before[third] && diff(after, opening) === 3,
      `Pipes seed ${seed}: the next turn did not continue the restored board (${opening} → ${before} → ${after})`);
    await unmount(root);
    tested++;
  }
  check(tested >= 2, `only ${tested} Pipes boards tested`);
}

// Practice: the same stage under a practice key writes nothing.
{
  const store = memoryStorage();
  stage.clearAllStageStateForReload();
  stage.persistStageState("", { storage: () => store, clock: now });
  const puzzle = withSeededRandom(2, () => generatePuzzle("target")) as PuzzleData;
  const room: Room = { store, key: "practice-7", drafts: [], keeper: createDraftKeeper(() => null) };
  const root = await mountStage(room, puzzle);
  await click(doc.querySelector('[data-tile-id="0"]'), "tile 0");
  await unmount(root);
  check(store.map.size === 0, "a practice round's stage was persisted");
}

/* ------------------------------------------------------------ 4. the room page */
{
  const route = readFileSync(new URL("../src/routes/duel.$code.tsx", import.meta.url), "utf8");
  const mark = route.indexOf("persistStageState(puzzle && !isArcadeScreenType(puzzle.type) ? stateKey : \"\")");
  check(mark > 0, "the room page does not mark its live puzzle round (never an arcade run)");
  check(mark > 0 && mark < route.indexOf("<SteadyOrPlain"), "the room page marks the round after the stage renders");
  const practice = readFileSync(new URL("../src/routes/practice.tsx", import.meta.url), "utf8");
  check(!/persistStageState/.test(practice), "practice persists stage inputs");
}

if (failures.length) {
  console.log(failures.map((f) => `FAIL ${f}`).join("\n"));
  console.log(`stage-state-reload-check: FAIL (${failures.length} failed, ${passes} passed)`);
  process.exit(1);
}
console.log(`stage-state-reload-check: PASS (${passes} checks)`);
process.exit(0);
