/**
 * The Category Cup and the Joulz Championship on the phone (wave 4, W4c; mockups docs/mockups/wave-4/07, 09 and 10):
 * the Tournaments tab's two event rows and the hall of fame, and each event's page (entry, the round, standings or
 * the bracket, prizes and the rules).
 *
 * Behind the switches (src/config/tournamentEventsConfig.ts): with both off the tab's section renders nothing and calls
 * nothing, so the Tournaments tab is exactly as before; an event's page with its switch off says it isn't running and
 * calls nothing. The server refuses a switched-off event whatever the phone sends.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";

import { CATEGORY_CUP_ENABLED, JOULZ_CHAMPIONSHIP_ENABLED } from "@/config/tournamentEventsConfig";
import { Button, EmptyState, LiveTag, Row } from "@/design/components";
import { ordinal } from "@/lib/duel/ordinal";
import { ukDateParts, ukTime } from "@/lib/publicSchedule";
import { EVENT_NAME, type EventKind } from "@/lib/tournaments/eventRules";
import { roundName } from "@/lib/tournaments/knockout";
import type { BracketMatchView, EntryOutcome, EventView, HallOfFameEntry } from "@/lib/tournaments/eventsFlow.server";

import { eventsBackend } from "./eventsApi";

export const EVENT_ON: Record<EventKind, boolean> = { category_cup: CATEGORY_CUP_ENABLED, championship: JOULZ_CHAMPIONSHIP_ENABLED };
export const EVENT_PATH: Record<EventKind, "/cup" | "/championship"> = { category_cup: "/cup", championship: "/championship" };
const POLL_MS = 3_000;

const when = (ms: number) => {
  const d = ukDateParts(ms);
  return `${d.weekday} ${d.day} ${d.month}, ${ukTime(ms)}`;
};

function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ the Tournaments tab */

/** The two big events and the hall of fame; nothing at all while both switches are off. */
export function BigEventsSection() {
  if (!CATEGORY_CUP_ENABLED && !JOULZ_CHAMPIONSHIP_ENABLED) return null;
  return <BigEventsOn />;
}

function BigEventsOn() {
  const [hall, setHall] = useState<HallOfFameEntry[]>([]);
  useEffect(() => {
    if (!JOULZ_CHAMPIONSHIP_ENABLED) return;
    let live = true;
    void eventsBackend()
      .then((b) => b.hallOfFame())
      .then((rows) => live && setHall(rows))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return (
    <>
      <section aria-label="Big events" className="ap-section" data-big-events>
        <div className="ap-section-head">
          <h2 className="ap-section-title">Big events</h2>
        </div>
        <div className="jz-panel">
          {CATEGORY_CUP_ENABLED ? (
            <Link to="/cup" className="jz-row" data-interactive="" data-event-row="category_cup">
              <span className="jz-row-text">
                <span data-ellipsis className="jz-row-title">
                  Category Cup
                </span>
                <span data-ellipsis className="jz-row-sub">
                  Swiss · Saturdays 7 pm · Entry 150
                </span>
              </span>
            </Link>
          ) : null}
          {JOULZ_CHAMPIONSHIP_ENABLED ? (
            <Link to="/championship" className="jz-row" data-interactive="" data-event-row="championship">
              <span className="jz-row-text">
                <span data-ellipsis className="jz-row-title">
                  Joulz Championship
                </span>
                <span data-ellipsis className="jz-row-sub">
                  Knockout · Last Sunday of the month · Qualify
                </span>
              </span>
            </Link>
          ) : null}
        </div>
      </section>
      {JOULZ_CHAMPIONSHIP_ENABLED ? <HallOfFame rows={hall} /> : null}
    </>
  );
}

/** Every Championship winner, by month (only once there's one). */
export function HallOfFame({ rows }: { rows: readonly HallOfFameEntry[] }) {
  if (!rows.length) return null;
  return (
    <section aria-label="Hall of fame" className="ap-section" data-hall-of-fame>
      <div className="ap-section-head">
        <h2 className="ap-section-title">Hall of fame</h2>
      </div>
      <ul className="jz-panel">
        {rows.map((r) => (
          <Row as="li" key={r.month} data-hall-row={r.month} title={r.name} sub={`Joulz Champion, ${r.label}`} />
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ an event's page */

export function EventScreen({ kind }: { kind: EventKind }) {
  if (!EVENT_ON[kind])
    return (
      <EmptyState data-event-off layout="page" title={`The ${EVENT_NAME[kind]} isn’t running yet`} body="It’s on its way. Arena and Score Attack are on now." />
    );
  return <EventOn kind={kind} />;
}

function EventOn({ kind }: { kind: EventKind }) {
  const [view, setView] = useState<EventView | null>(null);
  const [off, setOff] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const answer = await (await eventsBackend()).event(kind);
      if ("off" in answer) setOff(answer.off);
      else if ("view" in answer) setView(answer.view);
    } catch {
      /* the next poll tries again */
    }
  }, [kind]);
  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const act = async (run: () => Promise<EntryOutcome>) => {
    setBusy(true);
    try {
      const r = await run();
      setNote(r.ok ? null : r.message);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (off) return <EmptyState data-event-off layout="page" title={off} body="" />;
  if (!view) return <div data-event-loading className="ap-stack" />;
  return (
    <div className="ap-stack te-page" data-event-page={kind} data-event-status={view.status}>
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="ap-title" data-event-title>
            {view.title}
          </h1>
          {view.status === "running" ? <LiveTag /> : null}
        </div>
        <p className="ap-sub" data-event-when>
          {kind === "category_cup" ? "Swiss · Best of 3" : "Knockout · Best of 3"} · {when(view.startsAtMs)} UK
        </p>
      </div>

      {view.status === "cancelled" ? (
        <EmptyState
          data-event-cancelled
          layout="card"
          title="Cancelled"
          body={view.cancelledReason === "no_qualifiers" ? "Not enough players qualified this month." : "Not enough players entered. Every entry has been refunded."}
        />
      ) : null}

      {view.status === "open" ? <EntryPanel view={view} busy={busy} note={note} act={act} /> : null}
      {view.status === "running" && view.myMatch ? <MyMatch view={view} /> : null}
      {view.status === "finished" && view.me.finalPlace ? (
        <div className="jz-panel" data-event-my-place>
          <Row title={`You finished ${ordinal(view.me.finalPlace)}`} sub={`of ${view.entrants}`} />
        </div>
      ) : null}

      {kind === "category_cup" && view.standings.length ? <Standings view={view} /> : null}
      {kind === "championship" && view.bracket.length ? <Bracket view={view} /> : null}

      <section aria-label="Prizes" className="ap-section" data-event-prizes>
        <div className="ap-section-head">
          <h2 className="ap-section-title">Prizes</h2>
        </div>
        <ul className="jz-panel">
          {view.prizes.map((p) => (
            <Row as="li" key={p} title={p} />
          ))}
        </ul>
      </section>
      <section aria-label="Rules" className="ap-section" data-event-rules>
        <div className="ap-section-head">
          <h2 className="ap-section-title">How it works</h2>
        </div>
        <ol className="jz-panel te-rules">
          {view.rules.map((r) => (
            <li key={r} className="te-rule">
              {r}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function EntryPanel({
  view,
  busy,
  note,
  act,
}: {
  view: EventView;
  busy: boolean;
  note: string | null;
  act: (run: () => Promise<EntryOutcome>) => Promise<void>;
}) {
  const navigate = useNavigate();
  const kind = view.kind;
  const field = `${view.entrants} of ${view.maxEntrants} entered`;
  return (
    <div className="jz-panel te-entry" data-event-entry>
      <Row title={kind === "category_cup" ? field : "Top 64 from this month’s Score Attacks qualify"} sub={kind === "category_cup" ? `Needs ${view.minEntrants} to start` : "No entry fee"} />
      {kind === "category_cup" ? (
        <div className="te-actions">
          {!view.me.account ? (
            <Button variant="gold" size={48} block data-event-account onClick={() => void navigate({ to: "/account" })}>
              Make an account to enter
            </Button>
          ) : view.me.entered ? (
            <Button variant="secondary" size={48} block disabled={busy} data-event-leave onClick={() => void act(async () => (await eventsBackend()).leave(kind))}>
              Leave and get your entry back
            </Button>
          ) : (
            <>
              <Button variant="gold" size={48} block disabled={busy} data-event-enter="coins" onClick={() => void act(async () => (await eventsBackend()).enter(kind, "coins"))}>
                Enter for {view.entryCoins}
              </Button>
              <Button variant="secondary" size={48} block disabled={busy} data-event-enter="ticket" onClick={() => void act(async () => (await eventsBackend()).enter(kind, "ticket"))}>
                Use a Category Cup ticket
              </Button>
            </>
          )}
          {note ? (
            <p className="te-note" role="status" data-event-note>
              {note}
            </p>
          ) : (
            <p className="te-note">Refunded if the cup is cancelled.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MyMatch({ view }: { view: EventView }) {
  const navigate = useNavigate();
  const m = view.myMatch!;
  // A one-second clock only while the countdown to the round shows.
  const [now, setNow] = useState(() => Date.now());
  const counting = m.state === "waiting" && view.roundStartsAtMs !== null && view.roundStartsAtMs > now;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting]);
  const startsIn = view.roundStartsAtMs !== null ? view.roundStartsAtMs - now : 0;
  return (
    <section aria-label="Your match" className="ap-section" data-event-my-match={m.state}>
      <div className="ap-section-head">
        <h2 className="ap-section-title">{m.roundLabel}</h2>
        {m.state === "waiting" && startsIn > 0 ? <span className="ap-meta">Starts in {countdown(startsIn)}</span> : null}
      </div>
      <div className="jz-panel">
        {m.bye ? (
          <Row title="A bye this round" sub="It counts as a win. Back next round." />
        ) : (
          <Row
            title={`You${m.myRecord ? ` ${m.myRecord}` : ""} v ${m.opponent ?? "?"}${m.opponentRecord ? ` ${m.opponentRecord}` : ""}`}
            sub={m.state === "done" ? (m.result === "won" ? "You won" : m.result === "lost" ? "You lost" : "Drawn") : "Best of 3"}
          />
        )}
        {m.state === "playing" && m.roomCode ? (
          <div className="te-actions">
            <Button variant="gold" size={48} block data-event-play onClick={() => void navigate({ to: "/duel/$code", params: { code: m.roomCode! } })}>
              Play
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function Standings({ view }: { view: EventView }) {
  return (
    <section aria-label="Standings" className="ap-section" data-event-standings>
      <div className="ap-section-head">
        <h2 className="ap-section-title">Standings</h2>
        <span className="ap-meta">{view.entrants} players</span>
      </div>
      <ol className="jz-panel">
        {view.standings.map((s) => (
          <Row as="li" key={`${s.place}-${s.name}`} data-standing={s.place} data-me={s.me ? "" : undefined} title={`${s.place}. ${s.me ? "You" : s.name}`} sub={`${s.record} · ${s.points} pts`} />
        ))}
      </ol>
    </section>
  );
}

function Bracket({ view }: { view: EventView }) {
  const size = view.bracketSize ?? 2;
  const rounds = [...new Set(view.bracket.map((m) => m.round))].sort((a, b) => a - b);
  const side = (m: BracketMatchView, s: "a" | "b") => {
    const name = s === "a" ? m.nameA : m.nameB;
    const games = s === "a" ? m.gamesA : m.gamesB;
    return (
      <span className="te-side" data-won={m.winner === s ? "" : undefined}>
        <span data-ellipsis className="te-name">
          {name ?? (m.walkover ? "Bye" : "–")}
        </span>
        <span className="te-games">{games ?? ""}</span>
      </span>
    );
  };
  return (
    <section aria-label="Bracket" className="ap-section" data-event-bracket>
      {rounds.map((r) => (
        <div key={r} className="te-round" data-bracket-round={r}>
          <div className="ap-section-head">
            <h2 className="ap-section-title">{roundName(size, r)}</h2>
          </div>
          <ul className="jz-panel">
            {view.bracket
              .filter((m) => m.round === r)
              .sort((a, b) => (a.stage === b.stage ? a.slot - b.slot : a.stage === "knockout" ? -1 : 1))
              .map((m) => (
                <li key={`${m.stage}-${m.slot}`} className="te-match" data-bracket-match={`${m.stage}-${m.round}-${m.slot}`} data-me={m.me ? "" : undefined}>
                  {m.stage === "third_place" ? <span className="te-label">Third place</span> : null}
                  {side(m, "a")}
                  {side(m, "b")}
                  {m.live ? <LiveTag /> : null}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
