/**
 * The Tournaments hub (wave 4, W4b; docs/mockups/wave-4/05 and 06): what's live, what's next, the week's schedule and
 * your entries, above the public games the tab already showed. Drawn only once the server's hub answers with
 * tournaments open (useTournamentHub), so with no answer the tab is exactly as before. Tokens and shared components
 * only (DESIGN.md); one gold button at most (the first live event's way in).
 */
import { Fragment } from "react";

import { Button, Icon, LiveTag, Panel, Row, SectionHeader } from "@/design/components";
import { Trophy } from "@/design/art";
import { SeasonEmblem } from "@/components/seasons/SeasonSection";
import { SEASON_TIER_NAMES } from "@/lib/seasons/rules";
import { useMySeasons } from "@/lib/seasons/seasonsApi";
import type { SeasonHistoryEntry } from "@/lib/seasons/types";
import { ukDateParts, ukTime } from "@/lib/publicSchedule";
import { ukDayKey } from "@/lib/duel/daily";
import { ordinal } from "@/lib/duel/ordinal";
import { KIND_LABEL, placeLabel, UNDER_REVIEW_LINE } from "@/lib/tournaments/rules";
import { entryLabel } from "@/lib/tournaments/tournamentsApi";
import { CHAMPIONSHIP_NOT_HELD } from "@/lib/tournaments/eventRules";
import type { EntryView, TournamentEventView, TournamentHub, TrophyView } from "@/lib/tournaments/types";

/** "ends in 18 min", "ends in 2 h 5 min". */
export function inMinutes(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "Today", "Tomorrow", "Sat 14 Nov". */
export function dayLabel(ms: number, now: number): string {
  const day = ukDayKey(ms);
  if (day === ukDayKey(now)) return "Today";
  if (day === ukDayKey(now + 86_400_000)) return "Tomorrow";
  const p = ukDateParts(ms);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "Arena, free" / "Score Attack, 50". */
export function kindAndEntry(ev: TournamentEventView): string {
  const coins = ev.entryOptions.find((o) => o.entry === "coins")?.coins ?? 0;
  return `${KIND_LABEL[ev.kind]}, ${coins > 0 ? coins.toLocaleString("en-GB") : "free"}`;
}

function firstPrize(ev: TournamentEventView): string {
  const first = ev.prizes[0];
  return first ? `1st: ${first.coins.toLocaleString("en-GB")} coins and a gold trophy` : "";
}

function LiveCard({ ev, now, primary, onOpen }: { ev: TournamentEventView; now: number; primary: boolean; onOpen: (id: string) => void }) {
  const entered = ev.mine !== null && !ev.mine.refunded;
  const action = ev.kind === "arena" ? (entered ? "Go to the Arena" : "Join the Arena") : entered ? "Play" : "Enter";
  const meta =
    ev.kind === "arena"
      ? `${ev.entrants} entered, ends in ${inMinutes(ev.endsAt - now)}`
      : `Play any time in the next ${inMinutes(ev.endsAt - now)}, ${ev.entrants} entered`;
  return (
    <Panel pad data-tournament-live={ev.id}>
      <div className="tn-live-head">
        <LiveTag />
        <span className="tn-kind">{KIND_LABEL[ev.kind]}</span>
      </div>
      <h3 className="tn-card-title">{ev.title}</h3>
      <p className="tn-meta">{meta}</p>
      {ev.kind === "arena" ? <p className="tn-rule">Win 2 points a duel. After two wins in a row, each win counts double.</p> : null}
      <div className="tn-entry-line">
        <span className="tn-meta">Entry</span>
        <span className="tn-entry-value">{ev.entryOptions.map((o) => entryLabel(o.entry, o.coins)).join(" or ")}</span>
      </div>
      <p className="tn-meta">{firstPrize(ev)}</p>
      <Button variant={primary ? "gold" : "secondary"} size={50} block onClick={() => onOpen(ev.id)} data-tournament-open={ev.id}>
        {action}
      </Button>
    </Panel>
  );
}

function NothingLive({ hub, onOpen, onRemind }: { hub: TournamentHub; onOpen: (id: string) => void; onRemind: (id: string, on: boolean) => void }) {
  const next = hub.next;
  return (
    <Panel pad data-tournament-nothing-live>
      <h3 className="tn-card-title">Nothing live right now</h3>
      {next ? (
        <>
          <p className="tn-meta">{`Next: ${next.title} at ${ukTime(next.startsAt)}${dayLabel(next.startsAt, hub.now) === "Today" ? "" : `, ${dayLabel(next.startsAt, hub.now)}`}`}</p>
          <div className="tn-actions">
            <Button variant="secondary" size={46} onClick={() => onOpen(next.id)}>
              See details
            </Button>
            {hub.account && !next.mine ? (
              <Button variant="quiet" size={46} onClick={() => onRemind(next.id, !next.reminded)} aria-pressed={next.reminded} data-tournament-remind={next.id}>
                <Icon name="notifications" size={20} tone={next.reminded ? "gold" : "text-2"} />
                {next.reminded ? "Reminder on" : "Remind me"}
              </Button>
            ) : null}
          </div>
        </>
      ) : (
        <p className="tn-meta">New events are on the way.</p>
      )}
    </Panel>
  );
}

function ScheduleRow({ ev, hub, onOpen, onRemind }: { ev: TournamentEventView; hub: TournamentHub; onOpen: (id: string) => void; onRemind: (id: string, on: boolean) => void }) {
  const allDay = ev.kind === "score_attack";
  // The Joulz Championship with fewer than 16 qualifiers (W4c) isn't held that month, and the row says so.
  const sub =
    ev.status === "cancelled"
      ? ev.cancelReason === CHAMPIONSHIP_NOT_HELD
        ? "Not held this month: fewer than 16 qualified"
        : "Called off"
      : `${kindAndEntry(ev)}${ev.entrants > 0 ? `, ${ev.entrants} in` : ""}`;
  return (
    <div className="tn-schedule-row" data-tournament-row={ev.id}>
      <Row
        as="button"
        onClick={() => onOpen(ev.id)}
        leading={<span className="tn-time">{allDay ? "All day" : ukTime(ev.startsAt)}</span>}
        title={ev.title}
        sub={sub}
      />
      {hub.account && ev.status !== "cancelled" ? (
        ev.mine && !ev.mine.refunded ? (
          <span className="tn-in" aria-label="You’re in">
            <Icon name="check" size={20} tone="cyan" />
          </span>
        ) : (
          <Button
            variant="icon"
            aria-label={ev.reminded ? `Reminder on for ${ev.title}` : `Remind me about ${ev.title}`}
            aria-pressed={ev.reminded}
            onClick={() => onRemind(ev.id, !ev.reminded)}
          >
            <Icon name="notifications" size={20} tone={ev.reminded ? "gold" : "text-3"} />
          </Button>
        )
      ) : null}
    </div>
  );
}

function EntryRow({ entry, now }: { entry: EntryView; now: number }) {
  const when = dayLabel(entry.startsAt, now);
  const sub = entry.underReview
    ? `${when}, ${UNDER_REVIEW_LINE.toLowerCase().replace(/\.$/, "")}`
    : entry.refunded
    ? `${when}, called off, entry refunded`
    : entry.place !== null
      ? `${ordinal(entry.place)}, ${when}`
      : entry.status === "finished"
        ? `${when}, finished`
        : `${when}, entered with ${entryLabel(entry.entry, entry.coins).toLowerCase()}`;
  return (
    <Row data-tournament-entry={entry.eventId} title={entry.title} sub={sub}>
      {entry.prizeCoins > 0 ? <span className="tn-prize">{`+${entry.prizeCoins.toLocaleString("en-GB")}`}</span> : null}
    </Row>
  );
}

/** The hub's sections (live or nothing live, the schedule, your entries). */
export function TournamentHubSections({
  hub,
  onOpen,
  onRemind,
}: {
  hub: TournamentHub;
  onOpen: (eventId: string) => void;
  onRemind: (eventId: string, on: boolean) => void;
}) {
  const days: { label: string; events: TournamentEventView[] }[] = [];
  for (const ev of hub.week) {
    const label = dayLabel(ev.startsAt, hub.now);
    const last = days[days.length - 1];
    if (last && last.label === label) last.events.push(ev);
    else days.push({ label, events: [ev] });
  }
  return (
    <div className="ap-stack" data-tournament-hub>
      {hub.live.length > 0 ? (
        <section aria-label="Live" className="ap-section">
          <SectionHeader title="Live" />
          <div className="tn-cards">
            {hub.live.map((ev, i) => (
              <LiveCard key={ev.id} ev={ev} now={hub.now} primary={i === 0} onOpen={onOpen} />
            ))}
          </div>
        </section>
      ) : (
        <section aria-label="Nothing live" className="ap-section">
          <NothingLive hub={hub} onOpen={onOpen} onRemind={onRemind} />
        </section>
      )}
      <section aria-label="Schedule" className="ap-section">
        <SectionHeader title="Schedule" right={hub.account ? <span className="ap-meta">Tap the bell for a reminder</span> : undefined} />
        <Panel>
          {days.map((d) => (
            <Fragment key={d.label}>
              <p className="tn-day" data-tournament-day>
                {d.label}
              </p>
              {d.events.map((ev) => (
                <ScheduleRow key={ev.id} ev={ev} hub={hub} onOpen={onOpen} onRemind={onRemind} />
              ))}
            </Fragment>
          ))}
        </Panel>
      </section>
      {hub.entries.length > 0 ? (
        <section aria-label="Your entries" className="ap-section">
          <SectionHeader title="Your entries" />
          <Panel>
            {hub.entries.map((e) => (
              <EntryRow key={e.eventId} entry={e} now={hub.now} />
            ))}
          </Panel>
        </section>
      ) : null}
    </div>
  );
}

const TROPHY_KIND = { gold: "gold", silver: "silver", bronze: "bronze" } as const;

/**
 * The trophy cabinet (Profile): only real trophies, newest first; nothing at all for a player with none. The trophy
 * art is F5's placeholder until the canvas art is drawn.
 */
/**
 * The trophy cabinet: the account's tournament trophies and (wave 4 W4d, docs/seasons/README.md) its season emblems, one
 * per season reward granted (the tier's emblem with the season's mark), both from the server; nothing without either.
 * `seasons` stands in for the server's season history (checks); by default it is the account's own (useMySeasons).
 */
export function TrophyCabinet({ trophies, seasons }: { trophies: readonly TrophyView[]; seasons?: readonly SeasonHistoryEntry[] }) {
  const mine = useMySeasons();
  const emblems = seasons ?? (mine.live && mine.seasons?.account ? mine.seasons.history : []);
  if (!trophies.length && !emblems.length) return null;
  return (
    <section aria-label="Trophy cabinet" className="ap-section" data-trophy-cabinet>
      <SectionHeader title="Trophy cabinet" right={<span className="ap-meta">{trophies.length + emblems.length}</span>} />
      <Panel pad>
        <ul className="tn-trophies">
          {emblems.map((h, i) => (
            <li key={`season:${h.season}:${h.grantedAt}:${i}`} className="tn-trophy" data-season-trophy={h.tier}>
              <SeasonEmblem tier={h.tier} mark={h.mark} size={48} />
              <span className="tn-trophy-title">{h.test ? `${h.name} (test)` : h.name}</span>
              <span className="tn-meta">{`Peak ${SEASON_TIER_NAMES[h.tier]}`}</span>
            </li>
          ))}
          {trophies.map((t) => (
            <li key={t.eventId} className="tn-trophy" data-trophy={t.medal}>
              <Trophy kind={TROPHY_KIND[t.medal]} size={56} label={`${t.medal} trophy`} />
              <span className="tn-trophy-title">{t.title.replace(/, [0-9]+(st|nd|rd|th)$/, "")}</span>
              <span className="tn-meta">{placeLabel(t.place, t.place)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}
