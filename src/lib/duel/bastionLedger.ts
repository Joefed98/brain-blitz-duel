/**
 * Iron Wall's answer-reveal picture of a run (Action overhaul stage 2, 15 Nov 2026; display only, never imported by
 * the server or the sim): the stored log replayed tick by tick through the real sim exactly as `replayBastionTankRun`
 * does (the same checked events, the same end tick), folded into a ledger of what became of each tank, each weak-spot
 * hit and each drone. Its final state is the replay's (bastion-overhaul-check proves it on the recorded runs).
 */
import { checkInputEvents, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { bastionLedgerStart, bastionLedgerStep, type BtLedger } from "@/lib/arcade/bastionLook";
import { bastionTankCount, bastionTankGameFor, BT3_DRONES, type BastionTankState } from "@/lib/arcade/bastionTank";
import { decodeBastionTankRun } from "./bastion";

export function bastionTankLedger(seed: number, raw: string, rev?: number | null, level?: unknown): { ledger: BtLedger; state: BastionTankState } {
  const game = bastionTankGameFor(rev ?? 2, level);
  const run = decodeBastionTankRun(raw);
  const runTicks = game.runTicks;
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, runTicks) : 0;
  const lastTick = endTick > 0 && endTick < runTicks ? endTick : runTicks;
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of checkInputEvents(run.events, runTicks, game.inputRanges ?? []).events) events.set(event.t, event);
  let state = game.init(seed);
  // One slot a tank of the run (30 before bastionRev 5; bastionRev 5's levels 20, 30, 40 or 45).
  const ledger = bastionLedgerStart(seed, bastionTankCount(state.rev, state.lvl), BT3_DRONES);
  for (let tick = 1; tick <= lastTick; tick++) {
    const next = game.step(state, events.get(tick) ?? null);
    bastionLedgerStep(ledger, state, next);
    state = next;
    if (game.isOver(state)) break;
  }
  return { ledger, state };
}
