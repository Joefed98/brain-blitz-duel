/**
 * room-draft-check (19 Oct 2026, room flow only): the live round's draft survives a reload, or iOS
 * evicting the home-screen app (src/lib/duel/roomDraft.ts), #115's audit item 5.
 *
 *  1. Every draft is kept on the device by its round's state key; a fresh page (a new keeper over
 *     the same storage) reads it back, so the answer sent if the round ends first is the player's.
 *  2. After a reload the stage's untouched opening board never replaces the restored draft; the
 *     first draft that differs (the player has played again) does, and so does the stage's own
 *     submit. A reload never keeps the better of two attempts.
 *  3. Other rounds' drafts are pruned; stale ones (over DRAFT_TTL_MS) are never restored; blocked or
 *     full storage leaves the draft in memory and throws nothing.
 *  4. End to end: a Chroma Lines round half done, the page reloaded and the room at the reveal before
 *     the stage is back: the restored draft grades as the half-done board did (practice's grade),
 *     where the empty answer sent before scored 0.
 *  5. The room page keeps drafts through the keeper (stage drafts, the stage's own submit, the time-out).
 *
 *   bun scripts/room-draft-check.ts
 */
import { readFileSync } from "node:fs";

import { createDraftKeeper, DRAFT_TTL_MS, ROOM_DRAFT_PREFIX, type DraftStorage } from "../src/lib/duel/roomDraft";
import { encodeFlowPaths } from "../src/lib/duel/flow";
import { gradeAnswer, generatePuzzle } from "../src/lib/duel/generate.server";
import { withSeededRandom } from "../src/lib/duel/random";
import type { PuzzleData } from "../src/lib/duel/types";

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

const KEY = "room-uuid-0-3";
let clock = 1_000_000;
const now = () => clock;

/* ------------------------------------------------------------ 1. kept through a reload */
{
  const store = memoryStorage();
  const before = createDraftKeeper(() => store, now);
  check(before.current(KEY) === "", "a new round starts with a draft");
  before.push(KEY, "a");
  before.push(KEY, "ab");
  check(before.current(KEY) === "ab", "the newest draft is not the round's");
  const after = createDraftKeeper(() => store, now);
  check(after.current(KEY) === "ab" && after.restored(KEY), "a reloaded page lost the round's draft");
  check(after.current("room-uuid-0-4") === "", "another round read this round's draft");
}

/* ------------------------------------------------------------ 2. opening board, replay, own submit */
{
  const store = memoryStorage();
  createDraftKeeper(() => store, now).push(KEY, "moves:1,2,3,4,5");
  const after = createDraftKeeper(() => store, now);
  after.push(KEY, "moves:");
  check(after.current(KEY) === "moves:1,2,3,4,5", "the stage's opening board replaced the restored draft");
  after.push(KEY, "moves:");
  check(after.current(KEY) === "moves:1,2,3,4,5", "a repeat of the opening board replaced the restored draft");
  after.push(KEY, "moves:9");
  check(after.current(KEY) === "moves:9" && !after.restored(KEY), "a new move after the reload did not replace the restored draft");
  check(createDraftKeeper(() => store, now).current(KEY) === "moves:9", "the newer draft was not stored");

  createDraftKeeper(() => store, now).push(KEY, "old");
  const again = createDraftKeeper(() => store, now);
  again.push(KEY, "final answer", true);
  check(again.current(KEY) === "final answer", "the stage's own submit did not replace a restored draft");
}

/* ------------------------------------------------------------ 3. pruning, staleness, blocked storage */
{
  const store = memoryStorage();
  const keeper = createDraftKeeper(() => store, now);
  keeper.push("other-room-0-1", "x");
  keeper.push(KEY, "y");
  keeper.prune(KEY);
  check([...store.map.keys()].every((k) => k === ROOM_DRAFT_PREFIX + KEY), `prune kept other rounds: ${[...store.map.keys()].join(", ")}`);
  keeper.prune("");
  check(store.map.size === 0, "prune with no round left drafts behind");

  createDraftKeeper(() => store, now).push(KEY, "stale");
  clock += DRAFT_TTL_MS + 1;
  check(createDraftKeeper(() => store, now).current(KEY) === "", "a stale draft was restored");

  store.map.set(ROOM_DRAFT_PREFIX + KEY, "{not json");
  check(createDraftKeeper(() => store, now).current(KEY) === "", "a corrupt entry was restored");

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
    key: () => null,
    length: 0,
  };
  let threw = false;
  try {
    const keeper2 = createDraftKeeper(() => throwing, now);
    keeper2.push(KEY, "kept in memory");
    keeper2.prune(KEY);
    check(keeper2.current(KEY) === "kept in memory", "blocked storage lost the in-memory draft");
    const none = createDraftKeeper(() => null, now);
    none.push(KEY, "z");
    check(none.current(KEY) === "z", "no storage lost the in-memory draft");
  } catch {
    threw = true;
  }
  check(!threw, "blocked storage threw");
}

/* ------------------------------------------------------------ 4. end to end: the restored draft grades */
{
  let tested = 0;
  for (const seed of [3, 11, 19, 27]) {
    const puzzle = withSeededRandom(seed, () => generatePuzzle("flow")) as PuzzleData;
    if (puzzle.type !== "flow" || !puzzle.solution?.length) continue;
    const half = puzzle.solution.map((path, i) => (i < Math.ceil(puzzle.solution!.length / 2) ? [...path] : []));
    const draft = encodeFlowPaths(half);
    const store = memoryStorage();
    createDraftKeeper(() => store, now).push(`room-${seed}-0-2`, draft);
    // Reloaded; the room is at the reveal before the stage is back: the time-out sends the keeper's draft.
    const sent = createDraftKeeper(() => store, now).current(`room-${seed}-0-2`);
    const restored = gradeAnswer(puzzle, sent, 0);
    const practice = gradeAnswer(puzzle, draft, 0);
    const empty = gradeAnswer(puzzle, "", 0);
    check(sent === draft, `seed ${seed}: the restored draft is not the one made`);
    check(restored.score === practice.score && restored.score > 0, `seed ${seed}: restored ${restored.score}, practice ${practice.score}`);
    check(empty.score === 0, `seed ${seed}: the empty answer scored ${empty.score}`);
    tested++;
  }
  check(tested >= 3, `only ${tested} Chroma Lines boards tested`);
}

/* ------------------------------------------------------------ 5. the room page */
{
  const route = readFileSync(new URL("../src/routes/duel.$code.tsx", import.meta.url), "utf8");
  check(/const drafts = useRef\(createDraftKeeper\(\)\)\.current/.test(route), "the room page has no draft keeper");
  check(/drafts\.push\(latest\.current\.stateKey, answer\);/.test(route), "stage drafts do not go to the keeper");
  check(/drafts\.push\(latest\.current\.stateKey, answer, true\);/.test(route), "the stage's own submit is not kept as the draft");
  check(/answer: drafts\.current\(stateKey\)/.test(route), "the time-out does not send the keeper's draft");
  check(/drafts\.prune\(stateKey\)/.test(route), "other rounds' drafts are not pruned");
  check(!/draftAnswer/.test(route), "the in-memory-only draft is still used");
}

if (failures.length) {
  console.log(failures.map((f) => `FAIL ${f}`).join("\n"));
  console.log(`room-draft-check: FAIL (${failures.length} failed, ${passes} passed)`);
  process.exit(1);
}
console.log(`room-draft-check: PASS (${passes} checks)`);
