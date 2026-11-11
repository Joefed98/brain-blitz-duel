/**
 * The phone's calls for the Category Cup and the Joulz Championship (wave 4, W4c). Every call goes to the server
 * functions in src/lib/tournaments/events.functions.ts, which read the switches themselves; the screens call nothing
 * while an event's switch is off (src/config/tournamentEventsConfig.ts). Checks stand in with `setEventsBackend`.
 */
import type { EntryOutcome, EventView, HallOfFameEntry } from "@/lib/tournaments/eventsFlow.server";
import type { EventKind } from "@/lib/tournaments/eventRules";

export type EventAnswer = { off: string } | { busy: true } | { view: EventView };

export interface EventsBackend {
  event(kind: EventKind): Promise<EventAnswer>;
  enter(kind: EventKind, payWith: "coins" | "ticket"): Promise<EntryOutcome>;
  leave(kind: EventKind): Promise<EntryOutcome>;
  hallOfFame(): Promise<HallOfFameEntry[]>;
}

let injected: EventsBackend | null = null;

/** Checks stand in for the server (happy-dom screen checks). */
export function setEventsBackend(next: EventsBackend | null): void {
  injected = next;
}

export async function eventsBackend(): Promise<EventsBackend> {
  if (injected) return injected;
  const fns = await import("@/lib/tournaments/events.functions");
  return {
    event: (kind) => fns.tournamentEventFn({ data: { kind } }),
    enter: (kind, payWith) => fns.enterTournamentEventFn({ data: { kind, payWith } }),
    leave: (kind) => fns.leaveTournamentEventFn({ data: { kind } }),
    hallOfFame: () => fns.hallOfFameFn(),
  };
}
