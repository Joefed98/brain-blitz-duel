/**
 * An event page (wave 4, W4b; docs/mockups/wave-4/07 and 08): what it is, when, who's in, the fixed prizes, how it
 * works and entry; once live, the Arena's live board and "Find a duel", or the Score Attack's Play. Everything shown is
 * the server's answer; the phone decides nothing. Tokens and shared components only (DESIGN.md).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

import { AccountHead } from "@/components/account/AccountParts";
import { PhoneShell } from "@/components/duel/PhoneShell";
import { Button, EmptyState, Icon, LiveTag, Panel, Row, SectionHeader, SkeletonPage } from "@/design/components";
import { ukTime } from "@/lib/publicSchedule";
import { KIND_LABEL, placeLabel } from "@/lib/tournaments/rules";
import { countdown, entryLabel, tournamentsBackend, useTournamentEvent } from "@/lib/tournaments/tournamentsApi";
import type { ArenaBoard, ArenaPoll, EntryOption, ScoreAttackBoard, TournamentEventView } from "@/lib/tournaments/types";

import { dayLabel, inMinutes } from "./TournamentHub";

/** The plain "how it works" lines per kind (the full rules page has the rest). */
export function howItWorks(ev: Pick<TournamentEventView, "kind" | "rounds" | "pickLabel">): string[] {
  if (ev.kind === "arena")
    return [
      "For 45 minutes, play back-to-back best-of-3 duels against other entrants near your level.",
      "Win 2 points a duel. After two wins in a row, each win counts double until the streak breaks.",
      "Most points takes it. It starts with 4 or more entrants.",
      "Doesn’t change your rating.",
    ];
  return [
    `Everyone plays the same ${ev.rounds ?? 5} ${ev.pickLabel} games, once, any time today.`,
    "Highest total wins; the faster total time breaks a tie.",
    "Any number of players. Doesn’t change your rating.",
  ];
}

function prizeText(coins: number, trophy: string | null): string {
  return `${coins.toLocaleString("en-GB")} coins${trophy ? `, ${trophy} trophy` : ""}`;
}

function When({ ev, now }: { ev: TournamentEventView; now: number }) {
  if (ev.kind === "score_attack") return <p className="tn-meta">{`${dayLabel(ev.startsAt, now)}, all day (UK time)`}</p>;
  return <p className="tn-meta">{`${dayLabel(ev.startsAt, now)}, ${ukTime(ev.startsAt)} UK, about 45 min`}</p>;
}

function EntryButtons({ ev, busy, onEnter }: { ev: TournamentEventView; busy: boolean; onEnter: (o: EntryOption) => void }) {
  const firstUsable = ev.entryOptions.find((o) => o.affordable);
  return (
    <div className="tn-enter" data-tournament-enter>
      {ev.entryOptions.map((o) => (
        <Button
          key={o.entry}
          variant={o === firstUsable ? "gold" : "secondary"}
          size={o === firstUsable ? 52 : 46}
          block
          disabled={busy || !o.affordable}
          onClick={() => onEnter(o)}
          data-entry={o.entry}
        >
          {o.entry === "free" ? "Enter, free" : `Enter with ${entryLabel(o.entry, o.coins).toLowerCase()}${o.held !== null ? ` (${o.held} held)` : ""}`}
        </Button>
      ))}
      {ev.entryOptions.some((o) => o.entry === "coins") ? (
        <p className="tn-meta">Refunded in full if it doesn’t run. Prizes are fixed by Joulz; entries never go into a prize pot.</p>
      ) : null}
    </div>
  );
}

function ArenaLive({ ev, now }: { ev: TournamentEventView; now: number }) {
  const navigate = useNavigate();
  const [board, setBoard] = useState<ArenaBoard | null>(null);
  const [state, setState] = useState<"idle" | "searching" | "closed">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const searching = useRef(false);

  const loadBoard = useCallback(async () => {
    const b = await tournamentsBackend();
    if (!b) return;
    try {
      const answer = await b.arenaBoard(ev.id);
      if (answer) setBoard(answer);
    } catch {
      // keep the last board
    }
  }, [ev.id]);

  useEffect(() => {
    void loadBoard();
    const id = window.setInterval(() => void loadBoard(), 5_000);
    return () => window.clearInterval(id);
  }, [loadBoard]);

  const handle = useCallback(
    (poll: ArenaPoll | null) => {
      if (!poll) return;
      if (poll.state === "duel" && poll.duel.roomCode) {
        searching.current = false;
        void navigate({ to: "/duel/$code", params: { code: poll.duel.roomCode } });
      } else if (poll.state === "closed") {
        searching.current = false;
        setState("closed");
        setMessage(poll.message);
      } else if (poll.state === "idle") {
        searching.current = false;
        setState("idle");
      }
    },
    [navigate],
  );

  useEffect(() => {
    if (state !== "searching") return;
    const id = window.setInterval(async () => {
      const b = await tournamentsBackend();
      if (!b || !searching.current) return;
      try {
        handle(await b.arenaPoll(ev.id));
      } catch {
        // try again next second
      }
    }, 1_000);
    return () => window.clearInterval(id);
  }, [state, ev.id, handle]);

  useEffect(
    () => () => {
      if (searching.current) void tournamentsBackend().then((b) => b?.arenaLeave(ev.id));
    },
    [ev.id],
  );

  const find = async () => {
    const b = await tournamentsBackend();
    if (!b) return;
    setMessage(null);
    setState("searching");
    searching.current = true;
    try {
      handle(await b.arenaReady(ev.id));
    } catch {
      searching.current = false;
      setState("idle");
      setMessage("Couldn’t reach us. Give it another go.");
    }
  };
  const stop = async () => {
    searching.current = false;
    setState("idle");
    const b = await tournamentsBackend();
    await b?.arenaLeave(ev.id);
  };

  const me = board?.me ?? null;
  return (
    <div className="ap-stack" data-arena-live>
      <Panel pad>
        <div className="tn-live-head">
          <LiveTag />
          <span className="tn-meta">{`Ends in ${countdown(ev.endsAt - now)}`}</span>
        </div>
        <div className="tn-stats">
          <span className="tn-stat">
            <span className="tn-stat-value">{me ? ordinal(me.place) : "–"}</span>
            <span className="tn-meta">your place</span>
          </span>
          <span className="tn-stat">
            <span className="tn-stat-value">{me?.points ?? 0}</span>
            <span className="tn-meta">points</span>
          </span>
          <span className="tn-stat">
            <span className="tn-stat-value">{me?.streak ?? 0}</span>
            <span className="tn-meta">win streak</span>
          </span>
        </div>
        <p className="tn-rule">Win 2 points a duel. After two wins in a row, each win counts double.</p>
        {state === "searching" ? (
          <div className="tn-actions">
            <p className="tn-meta" role="status">
              Finding your next opponent…
            </p>
            <Button variant="secondary" size={46} onClick={() => void stop()}>
              Stop
            </Button>
          </div>
        ) : state === "closed" ? null : (
          <Button variant="gold" size={52} block onClick={() => void find()} data-arena-find>
            {me && me.played > 0 ? "Next duel" : "Find a duel"}
          </Button>
        )}
        {message ? <p className="tn-meta" role="status">{message}</p> : null}
      </Panel>
      <section aria-label="Leaderboard" className="ap-section">
        <SectionHeader title="Points" right={board ? <span className="ap-meta">{`${board.players} playing`}</span> : undefined} />
        <Panel as="ol">
          {(board?.rows ?? []).map((r) => (
            <Row as="li" key={r.userId} data-arena-row={r.place} data-me={r.isMe ? "" : undefined} className={r.isMe ? "tn-me" : undefined}>
              <span className="tn-place">{r.place}</span>
              <span className="jz-row-text">
                <span className="jz-row-title">{r.isMe ? "You" : r.name}</span>
                <span className="jz-row-sub">{r.streak >= 2 ? `${r.streak} in a row` : `${r.wins} ${r.wins === 1 ? "win" : "wins"}`}</span>
              </span>
              <span className="tn-points">{r.points}</span>
            </Row>
          ))}
        </Panel>
      </section>
    </div>
  );
}

function ordinal(n: number): string {
  return placeLabel(n, n);
}

function ScoreAttackPlay({ ev, onPlay }: { ev: TournamentEventView; onPlay: () => void }) {
  const [board, setBoard] = useState<ScoreAttackBoard | null>(null);
  useEffect(() => {
    void tournamentsBackend().then(async (b) => {
      if (!b) return;
      try {
        setBoard(await b.scoreAttackBoard(ev.id));
      } catch {
        // nothing to show yet
      }
    });
  }, [ev.id]);
  const me = board?.me ?? null;
  const done = me?.finished === true;
  return (
    <div className="ap-stack" data-score-attack>
      <Panel pad>
        {done ? (
          <>
            <h3 className="tn-card-title">{`Your total: ${me!.total.toLocaleString("en-GB")}`}</h3>
            <p className="tn-meta">{me!.place ? `${ordinal(me!.place)} of ${board!.count} so far` : "Places show once the board opens."}</p>
          </>
        ) : ev.status === "live" ? (
          <>
            <p className="tn-meta">{me ? `${me.roundsDone} of ${ev.rounds ?? 5} games played` : `${ev.rounds ?? 5} games, once each`}</p>
            <Button variant="gold" size={52} block onClick={onPlay} data-score-attack-play>
              {me ? "Continue" : "Play"}
            </Button>
          </>
        ) : (
          <p className="tn-meta">{ev.status === "scheduled" ? `Opens ${dayLabel(ev.startsAt, Date.now()).toLowerCase()} at midnight.` : "This Score Attack has closed."}</p>
        )}
      </Panel>
      {board?.open && board.rows.length ? (
        <section aria-label="Leaderboard" className="ap-section">
          <SectionHeader title="Leaderboard" right={<span className="ap-meta">{`${board.count} played`}</span>} />
          <Panel as="ol">
            {board.rows.map((r) => (
              <Row as="li" key={`${r.place}`} data-me={r.isMe ? "" : undefined} className={r.isMe ? "tn-me" : undefined}>
                <span className="tn-place">{r.place}</span>
                <span className="jz-row-text">
                  <span className="jz-row-title">{r.isMe ? "You" : r.name}</span>
                </span>
                <span className="tn-points">{r.total.toLocaleString("en-GB")}</span>
              </Row>
            ))}
          </Panel>
        </section>
      ) : null}
    </div>
  );
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** The event page. `onBack` returns to the hub; `onPlayScoreAttack` opens the Score Attack's run on its room. */
export function TournamentEventScreen({
  eventId,
  onBack,
  onRules,
  onPlayScoreAttack,
}: {
  eventId: string;
  onBack: () => void;
  onRules: (kind: string) => void;
  onPlayScoreAttack: (roomId: string, title: string) => void;
}) {
  const { event: ev, loaded, refresh } = useTournamentEvent(eventId);
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!loaded)
    return (
      <PhoneShell bare skin="tournaments">
        <SkeletonPage label="Loading the tournament" />
      </PhoneShell>
    );
  if (!ev)
    return (
      <PhoneShell bare skin="tournaments">
        <div className="tn-page">
          <AccountHead title="Tournament" onBack={onBack} />
          <EmptyState layout="page" tone="cool" title="That tournament isn’t here" body="It may have finished, or tournaments aren’t open to you yet." action={{ label: "Back to Tournaments", onClick: onBack }} />
        </div>
      </PhoneShell>
    );

  const entered = ev.mine !== null && !ev.mine.refunded;
  const enter = async (o: EntryOption) => {
    const b = await tournamentsBackend();
    if (!b) return;
    setBusy(true);
    setMessage(null);
    try {
      const out = await b.enter(ev.id, o.entry);
      if (!out.ok) setMessage(out.message);
      refresh();
    } catch {
      setMessage("Couldn’t reach us. Give it another go.");
    } finally {
      setBusy(false);
    }
  };
  const remind = async () => {
    const b = await tournamentsBackend();
    if (!b) return;
    await b.remind(ev.id, !ev.reminded).catch(() => undefined);
    refresh();
  };
  const play = async () => {
    const b = await tournamentsBackend();
    if (!b) return;
    const out = await b.scoreAttackStart(ev.id).catch(() => ({ ok: false as const, message: "Couldn’t reach us. Give it another go." }));
    if (out.ok) onPlayScoreAttack(out.roomId, ev.title);
    else setMessage(out.message);
  };

  return (
    <PhoneShell bare skin="tournaments">
      <div className="tn-page" data-tournament-event={ev.id} data-kind={ev.kind}>
        <AccountHead title="Tournament" onBack={onBack} />
        <div>
          <div className="tn-live-head">
            {ev.status === "live" ? <LiveTag /> : null}
            <span className="tn-kind">{`${KIND_LABEL[ev.kind]}, ${ev.pickLabel}`}</span>
          </div>
          <h1 className="tn-title">{ev.title}</h1>
          <When ev={ev} now={now} />
          <p className="tn-meta">{`${ev.entrants} entered`}</p>
        </div>

        {ev.status === "cancelled" ? (
          <Panel pad data-tournament-cancelled>
            <h3 className="tn-card-title">Called off this time</h3>
            <p className="tn-meta">
              {ev.cancelReason === "too_few"
                ? `It needs 4 players to start, and not quite enough came. Thanks for turning up.${ev.cancelledNext ? ` The next Arena is ${dayLabel(ev.cancelledNext, now).toLowerCase()} at ${ukTime(ev.cancelledNext)}.` : ""}`
                : "Every entry has been refunded in full."}
            </p>
          </Panel>
        ) : entered && ev.status === "live" && ev.kind === "arena" ? (
          <ArenaLive ev={ev} now={now} />
        ) : entered && ev.kind === "score_attack" ? (
          <ScoreAttackPlay ev={ev} onPlay={() => void play()} />
        ) : entered ? (
          <Panel pad data-tournament-entered>
            <h3 className="tn-card-title">You’re in</h3>
            <p className="tn-meta">{ev.status === "finished" ? "This one has finished." : `It starts in ${inMinutes(ev.startsAt - now)}. We’ll remind you.`}</p>
          </Panel>
        ) : ev.entryOpen ? (
          <EntryButtons ev={ev} busy={busy} onEnter={(o) => void enter(o)} />
        ) : (
          <Panel pad>
            <p className="tn-meta">{ev.status === "finished" ? "This one has finished." : ev.startsAt > now ? "Entry opens a day before it starts." : "Entry has closed."}</p>
          </Panel>
        )}
        {message ? (
          <p className="tn-meta" role="status" data-tournament-message>
            {message}
          </p>
        ) : null}
        {!entered && ev.status !== "cancelled" && ev.status !== "finished" ? (
          <Button variant="quiet" size={44} onClick={() => void remind()} aria-pressed={ev.reminded} data-tournament-remind={ev.id}>
            <Icon name="notifications" size={20} tone={ev.reminded ? "gold" : "text-2"} />
            {ev.reminded ? "Reminder on" : "Remind me"}
          </Button>
        ) : null}

        <section aria-label="Prizes" className="ap-section">
          <SectionHeader title="Prizes" />
          <Panel>
            {ev.prizes.map((p) => (
              <Row key={p.from} title={placeLabel(p.from, p.to)} sub={p.minEntrants > 1 ? `Pays with ${p.minEntrants} or more entrants` : undefined}>
                <span className="tn-entry-value">{prizeText(p.coins, p.trophy)}</span>
              </Row>
            ))}
          </Panel>
          <p className="tn-meta">Prizes are fixed by Joulz. Entry fees never go into a prize pot.</p>
        </section>

        <section aria-label="How it works" className="ap-section">
          <SectionHeader title="How it works" right={<Button variant="quiet" size={44} onClick={() => onRules(ev.kind)} data-tournament-rules>Full rules</Button>} />
          <Panel pad>
            <ol className="tn-how">
              {howItWorks(ev).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </Panel>
        </section>
      </div>
    </PhoneShell>
  );
}
