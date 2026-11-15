/**
 * Iron Wall's answer-reveal picture of a run (Action overhaul stage 2, 15 Nov 2026; display only, never imported by
 * the server or the sim): the stored log replayed tick by tick through the real sim exactly as `replayBastionTankRun`
 * does (the same checked events, the same end tick), folded into a ledger of what became of each tank, each weak-spot
 * hit and each drone. Its final state is the replay's (bastion-overhaul-check proves it on the recorded runs).
 */
import { checkInputEvents, type ArcadeInputEvent } from "@/lib/arcade/engine";
import { bastionLedgerStart, bastionLedgerStep, type BtLedger } from "@/lib/arcade/bastionLook";
import { bastionTankGameFor, BT2_TANKS, BT3_DRONES, type BastionTankState } from "@/lib/arcade/bastionTank";
import { decodeBastionTankRun } from "./bastion";

export function bastionTankLedger(seed: number, raw: string, rev?: number | null): { ledger: BtLedger; state: BastionTankState } {
  const game = bastionTankGameFor(rev ?? 2);
  const run = decodeBastionTankRun(raw);
  const runTicks = game.runTicks;
  const endTick = run.endTick && run.endTick > 0 ? Math.min(run.endTick, runTicks) : 0;
  const lastTick = endTick > 0 && endTick < runTicks ? endTick : runTicks;
  const events = new Map<number, ArcadeInputEvent>();
  for (const event of checkInputEvents(run.events, runTicks, game.inputRanges ?? []).events) events.set(event.t, event);
  const ledger = bastionLedgerStart(seed, BT2_TANKS, BT3_DRONES);
  let state = game.init(seed);
  for (let tick = 1; tick <= lastTick; tick++) {
    const next = game.step(state, events.get(tick) ?? null);
    bastionLedgerStep(ledger, state, next);
    state = next;
    if (game.isOver(state)) break;
  }
  return { ledger, state };
}
