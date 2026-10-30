/**
 * arcade-standard-check's case for `bubble` (Coral Pop, bubbleRev 11; see ./case.ts). The reef starts with 95 bubbles
 * on every seed (10 rows of 10 and 9, chests included), so the core is full at 95 bubbles cleared.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  bubbleGameFor,
  bubbleStdParts,
  bubMineNearest,
  bubCellX,
  bubCellY,
  BUB_BOMB,
  BUB_CHEST,
  BUB_COLS,
  BUB_REV_BLAST,
  BUB_REV_STD,
  BUB_RUN_TICKS,
  BUB_V11_BANK_PER,
  BUB_V11_BANK_MAX,
  BUB_V11_CHEST_EACH,
  BUB_V11_COMBO_EACH,
  BUB_V11_COMBO_MAX,
  BUB_V11_MINE_POPS,
  BUB_V11_REEF,
  BUB_V11_SPEED_FULL_LEFT,
  type BubState,
} from "../../src/lib/arcade/bubble";
import { TICKS_PER_SECOND } from "../../src/lib/arcade/engine";
import type { StdCase } from "./case";

const game = bubbleGameFor(BUB_REV_STD);
const SEED = 4242;
const played = (patch: Partial<BubState> = {}): BubState => ({ ...(game.init(SEED) as BubState), acted: 1, tick: 600, ...patch });
const part = (s: BubState, key: string) => bubbleStdParts(s)!.find((p) => p.key === key)!.points;
/** A state with `v` reef bubbles gone (net shrink), not cleared. */
function shrunk(v: number): BubState {
  const s = played();
  const grid = [...s.grid];
  let left = v;
  for (let i = grid.length - 1; i >= 0 && left > 0; i--) {
    if (grid[i]) {
      grid[i] = 0;
      left--;
    }
  }
  return { ...s, grid, popped: v - left };
}
const clearedAt = (endedTick: number, patch: Partial<BubState> = {}): BubState =>
  played({ grid: played().grid.map(() => 0), cleared: true, endedTick, tick: endedTick, popped: BUB_V11_REEF, ...patch });

export const stdCase: StdCase = {
  game,
  fullAt: BUB_V11_REEF,
  perfect: () => clearedAt(BUB_RUN_TICKS - BUB_V11_SPEED_FULL_LEFT, { chests: 6, banks: BUB_V11_BANK_PER * BUB_V11_BANK_MAX, combos: 15 }),
  idle: () => played(),
  // Below the whole reef: its net shrink. From the whole reef on (a check-only state, no clear bonus): a quarter of the
  // bubbles burst, 4v popped with the reef as it started.
  core: (v) => (v < BUB_V11_REEF ? shrunk(v) : played({ popped: 4 * v })),
  older: () => bubbleGameFor(BUB_REV_BLAST).init(SEED),
  extra(ok) {
    ok(game.init(SEED).startCount === BUB_V11_REEF, `the reef starts with ${BUB_V11_REEF} bubbles`);
    for (let seed = 1; seed <= 200; seed++) {
      const s = game.init(seed) as BubState;
      ok(s.startCount === BUB_V11_REEF, `seed ${seed}: the reef starts with ${BUB_V11_REEF}`);
      ok(s.grid.filter((v) => v === BUB_CHEST).length === 6, `seed ${seed}: 6 seeded chests`);
    }
    // Chests: 5 each, 30 for all 6.
    for (let k = 0; k <= 6; k++) ok(part(played({ chests: k }), "chests") === k * BUB_V11_CHEST_EACH, `${k} chests pay ${k * BUB_V11_CHEST_EACH}`);
    // Bank shots: 1 for every 2, up to 15 (30 bank shots); combos 1 each up to 15.
    for (let k = 0; k <= 34; k++) ok(part(played({ banks: k }), "banks") === Math.min(BUB_V11_BANK_MAX, Math.floor(k / BUB_V11_BANK_PER)), `${k} bank shots pay ${Math.min(BUB_V11_BANK_MAX, Math.floor(k / BUB_V11_BANK_PER))}`);
    for (let k = 0; k <= 20; k++) ok(part(played({ combos: k }), "combos") === Math.min(BUB_V11_COMBO_MAX, k * BUB_V11_COMBO_EACH), `${k} combos pay ${Math.min(BUB_V11_COMBO_MAX, k * BUB_V11_COMBO_EACH)}`);
    // Clear 10 and speed: full with half the clock left, even to 0 at the buzzer; nothing for either without a clear.
    ok(part(clearedAt(BUB_RUN_TICKS - 1), "clear") === 10, "a cleared reef pays 10");
    ok(part(clearedAt(BUB_RUN_TICKS / 4), "speed") === 10 && part(clearedAt(BUB_RUN_TICKS / 2), "speed") === 10, "speed is full with half the clock or more left");
    ok(part(clearedAt((3 * BUB_RUN_TICKS) / 4), "speed") === 5, "speed is 5 with a quarter of the clock left");
    ok(part(clearedAt(BUB_RUN_TICKS), "speed") === 0, "speed is 0 at the buzzer");
    ok(part(shrunk(94), "clear") === 0 && part(shrunk(94), "speed") === 0, "no clear and no speed without a clear");
    ok(game.score(clearedAt(BUB_RUN_TICKS - 30 * TICKS_PER_SECOND)) === 120 + 10 + 6, "a clear with 30 s left scores 120 + 10 + 6");
    // Features never cost core: the same reef with features scores its core plus the features.
    const base = shrunk(60);
    const extra = { ...base, chests: 2, banks: 2, combos: 4 };
    ok(part(extra, "core") === part(base, "core") && game.score(extra) === game.score(base) + 10 + 1 + 4, "features add to the core, never from it");
    // The mine (gameplay change): pops exactly the 4 bubbles nearest where it lands.
    let minesSeen = 0;
    for (let seed = 1; seed <= 400 && minesSeen < 40; seed++) {
      const s0 = game.init(seed) as BubState;
      const slot = s0.queue.indexOf(BUB_BOMB);
      if (slot < 0) continue;
      minesSeen++;
      // Load the mine and fire it straight up from a field with the lowest rows still on it.
      const s = { ...s0, acted: 1, queueAt: slot } as BubState;
      let st: BubState = game.step(s, { t: s.tick + 1, k: 2, a: (seed % 7) * 300 - 900, b: -4000, c: 0, d: 0 });
      while (st.flightColour !== 0 && !game.isOver(st)) st = game.step(st, null);
      const landed = st.lastSpecialCell ?? -1;
      ok(st.lastSpecial === BUB_BOMB && landed >= 0, `seed ${seed}: the mine landed`);
      if (landed < 0) continue;
      const grid = [...s.grid];
      grid[landed] = BUB_BOMB;
      const want = bubMineNearest(grid, landed, BUB_V11_MINE_POPS);
      ok(want.length === BUB_V11_MINE_POPS && st.lastSpecialCleared === BUB_V11_MINE_POPS, `seed ${seed}: the mine popped ${st.lastSpecialCleared}, not ${BUB_V11_MINE_POPS}`);
      ok(st.popped === BUB_V11_MINE_POPS && want.every((i) => st.grid[i] === 0) && st.grid[landed] === 0, `seed ${seed}: the mine popped exactly its 4 nearest`);
      // Nothing else went but what then hung loose (dropped).
      const gone = s.grid.filter((v, i) => v && !st.grid[i]).length;
      ok(gone === BUB_V11_MINE_POPS + st.dropped, `seed ${seed}: only the 4 nearest and the loose bubbles left the reef`);
      // They are the 4 nearest by distance: no bubble left is nearer than the farthest popped.
      const lr = Math.floor(landed / BUB_COLS);
      const d2 = (i: number) => {
        const r = Math.floor(i / BUB_COLS);
        return (bubCellX(r, i % BUB_COLS) - bubCellX(lr, landed % BUB_COLS)) ** 2 + (bubCellY(r, 0) - bubCellY(lr, 0)) ** 2;
      };
      const far = Math.max(...want.map(d2));
      ok(s.grid.every((v, i) => !v || want.includes(i) || i === landed || d2(i) >= far), `seed ${seed}: no bubble nearer than the mine's farthest pop survives`);
    }
    ok(minesSeen >= 20, `mines tried on ${minesSeen} seeds`);
    // Rev 10 (older) keeps its two-ring blast.
    const blast = bubbleGameFor(BUB_REV_BLAST).init(SEED) as BubState;
    ok(blast.bombR === 2 && blast.minePops === undefined && (game.init(SEED) as BubState).bombR === undefined, "bubbleRev 10 keeps its two-ring blast; bubbleRev 11 carries the 4-pop mine");
  },
};
