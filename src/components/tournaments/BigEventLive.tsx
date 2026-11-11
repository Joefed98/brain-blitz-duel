/**
 * The Category Cup and the Joulz Championship's live part of W4b's event page (wave 4, W4c; mockups
 * docs/mockups/wave-4/09-swiss-round and 10-knockout-bracket): the round and its countdown, the caller's match (Play
 * opens its room), the Swiss standings or the bracket, and the line a flagged player sees. Everything is the server's
 * answer (`bigEventFn`); the phone decides nothing. Also the hall of fame for the Tournaments tab. Tokens and shared
 * components only (DESIGN.md).
 *
 * Calls go through `bigEventsBackend`: under browser automation nothing is called (W4b's `tournamentsAutomated`, which
 * ignores its check-only switch in a production build); checks stand in with `setBigEventsBackend`.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { Button, LiveTag, Panel, Row, SectionHeader } from "@/design/components";
import { roundName } from "@/lib/tournaments/knockout";
import { tournamentsAutomated } from "@/lib/tournaments/tournamentsApi";
import type { BigBracketMatch, BigEventView, HallOfFameEntry } from "@/lib/tournaments/eventsFlow.server";

export interface BigEventsBackend {
  event(eventId: string): Promise<BigEventView | null>;
  hallOfFame(): Promise<HallOfFameEntry[]>;
}

let injected: BigEventsBackend | null = null;
export function setBigEventsBackend(next: BigEventsBackend | null): void {
  injected = next;
}

async function bigEventsBackend(): Promise<BigEventsBackend | null> {
  if (injected) return injected;
  if (tournamentsAutomated()) return null;
  try {
    const fns = await import("@/lib/tournaments/events.functions");
    return {
      event: async (eventId) => {
        const v = await fns.bigEventFn({ data: { eventId } });
        return v && "busy" in v ? null : v;
      },
      hallOfFame: () => fns.hallOfFameFn(),
    };
  } catch {
    return null;
  }
}

const POLL_MS = 3_000;

function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The live part of a Category Cup or Championship page, polled every 3 s (each poll moves the event on). */
export function BigEventLive({ eventId }: { eventId: string }) {
  const [view, setView] = useState<BigEventView | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let live = true;
    const load = async () => {
      const b = await bigEventsBackend();
      if (!b) return;
      try {
        const v = await b.event(eventId);
        if (live && v) setView(v);
      } catch {
        // the next poll tries again
      }
    };
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [eventId]);
  // A one-second clock only while a round's countdown shows.
  const counting = !!view?.myMatch && view.myMatch.state === "waiting" && (view.roundStartsAtMs ?? 0) > now;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting]);
  if (!view) return null;
  return (
    <div className="ap-stack" data-big-event={view.kind}>
      {view.underReview ? (
        <Panel pad data-big-under-review>
          <p className="tn-meta">{view.underReview}</p>
        </Panel>
      ) : null}
      {view.myMatch ? <MyMatch view={view} now={now} /> : null}
      {view.kind === "category_cup" && view.standings.length ? <Standings view={view} /> : null}
      {view.kind === "championship" && view.bracket.length ? <Bracket view={view} /> : null}
    </div>
  );
}

function MyMatch({ view, now }: { view: BigEventView; now: number }) {
  const navigate = useNavigate();
  const m = view.myMatch!;
  const startsIn = (view.roundStartsAtMs ?? 0) - now;
  return (
    <section aria-label="Your match" className="ap-section" data-big-my-match={m.state}>
      <SectionHeader title={m.roundLabel} right={m.state === "waiting" && startsIn > 0 ? <span className="tn-meta">{`Starts in ${countdown(startsIn)}`}</span> : undefined} />
      <Panel>
        {m.bye ? (
          <Row title="A bye this round" sub="It counts as a win. Back next round." />
        ) : (
          <Row
            title={`You${m.myRecord ? ` ${m.myRecord}` : ""} v ${m.opponent ?? "?"}${m.opponentRecord ? ` ${m.opponentRecord}` : ""}`}
            sub={m.state === "done" ? (m.result === "won" ? "You won" : m.result === "lost" ? "You lost" : "Drawn") : "Best of 3"}
          />
        )}
      </Panel>
      {m.state === "playing" && m.roomCode ? (
        <Button variant="gold" size={52} block data-big-play onClick={() => void navigate({ to: "/duel/$code", params: { code: m.roomCode! } })}>
          Play
        </Button>
      ) : null}
    </section>
  );
}

function Standings({ view }: { view: BigEventView }) {
  return (
    <section aria-label="Standings" className="ap-section" data-big-standings>
      <SectionHeader title="Standings" right={<span className="tn-meta">{`${view.field} players`}</span>} />
      <Panel>
        {view.standings.map((s) => (
          <Row key={`${s.place}-${s.name}`} data-standing={s.place} data-me={s.me ? "" : undefined} className={s.me ? "tn-me" : undefined} title={`${s.place}. ${s.me ? "You" : s.name}`} sub={`${s.record} · ${s.points} pts`} />
        ))}
      </Panel>
    </section>
  );
}

function sideName(m: BigBracketMatch, side: "a" | "b"): string {
  const name = side === "a" ? m.nameA : m.nameB;
  return name ?? (m.walkover ? "Bye" : "–");
}

function Bracket({ view }: { view: BigEventView }) {
  const size = view.bracketSize ?? 2;
  const rounds = [...new Set(view.bracket.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <section aria-label="Bracket" className="ap-section" data-big-bracket>
      {rounds.map((r) => (
        <div key={r} className="ap-section" data-bracket-round={r}>
          <SectionHeader title={roundName(size, r)} />
          <Panel>
            {view.bracket
              .filter((m) => m.round === r)
              .sort((a, b) => (a.stage === b.stage ? a.slot - b.slot : a.stage === "knockout" ? -1 : 1))
              .map((m) => (
                <Row
                  key={`${m.stage}-${m.slot}`}
                  data-bracket-match={`${m.stage}-${m.round}-${m.slot}`}
                  data-me={m.me ? "" : undefined}
                  className={m.me ? "tn-me" : undefined}
                  title={`${m.winner === "a" ? "✓ " : ""}${sideName(m, "a")} ${m.gamesA ?? ""}`.trim()}
                  sub={`${m.stage === "third_place" ? "Third place · " : ""}${m.winner === "b" ? "✓ " : ""}${sideName(m, "b")} ${m.gamesB ?? ""}`.trim()}
                >
                  {m.live ? <LiveTag /> : null}
                </Row>
              ))}
          </Panel>
        </div>
      ))}
    </section>
  );
}

/** Every Championship winner, by month (for the Tournaments tab; nothing while there is none or the switch is off). */
export function HallOfFame({ on }: { on: boolean }) {
  return on ? <HallOfFameOn /> : null;
}

function HallOfFameOn() {
  const [rows, setRows] = useState<HallOfFameEntry[]>([]);
  useEffect(() => {
    let live = true;
    void (async () => {
      const b = await bigEventsBackend();
      if (!b) return;
      try {
        const r = await b.hallOfFame();
        if (live) setRows(r);
      } catch {
        // offline: nothing shown
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  if (!rows.length) return null;
  return (
    <section aria-label="Hall of fame" className="ap-section" data-hall-of-fame>
      <SectionHeader title="Hall of fame" />
      <Panel>
        {rows.map((r) => (
          <Row key={r.month} data-hall-row={r.month} title={r.name} sub={`Joulz Champion, ${r.label}`} />
        ))}
      </Panel>
    </section>
  );
}
