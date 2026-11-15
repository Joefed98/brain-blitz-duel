/**
 * The Tournaments hub (wave 4, W4b; restyled in phase 2 step 3, 14 Nov 2026, after the style guide's list mockup,
 * docs/design/style-guide/phone/list.png): two views on a segmented control, Upcoming (what's live, then the week's
 * schedule as list rows: the event's art-kit icon, its name, its entry and players, when it starts on the right and a
 * chevron) and Your results (your entries). Both views are in the page, the other one `hidden`, so a screen reader's
 * tab order and the checks read the same markup. Drawn only once the server's hub answers with tournaments open
 * (useTournamentHub). Tokens and shared components only; one gold button at most (the first live event's way in).
 * The Category Cup and the Joulz Championship stay hidden while their switches are off.
 */
import { Fragment, useState, type ReactNode } from "react";

import { Button, EmptyState, Icon, LiveTag, Panel, Row, SectionHeader, Segmented } from "@/design/components";
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
import { CHAMPIONSHIP_NOT_HELD, isBigKind } from "@/lib/tournaments/eventRules";
import { TOURNAMENT_KINDS_ON } from "@/config/tournamentConfig";
import type { EntryView, TournamentEventView, TournamentHub, TrophyView } from "@/lib/tournaments/types";

import { KIND_ART, TournamentArt } from "./TournamentArt";

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

/** Whether an event kind is shown: the Category Cup and the Championship only while their switches are on. */
export function kindShown(kind: TournamentEventView["kind"]): boolean {
  return !isBigKind(kind) || Boolean((TOURNAMENT_KINDS_ON as Record<string, boolean>)[kind]);
}

function firstPrize(ev: TournamentEventView): string {
  const first = ev.prizes[0];
  return first ? `1st: ${first.coins.toLocaleString("en-GB")} coins and a gold trophy` : "";
}

/** "Mixed · 50 coins · 124 entered" (the list mockup's second line). */
function eventSub(ev: TournamentEventView): string {
  const coins = ev.entryOptions.find((o) => o.entry === "coins")?.coins ?? 0;
  const parts = [ev.pickLabel, coins > 0 ? `${coins.toLocaleString("en-GB")} coins` : "Free"];
  if (ev.entrants > 0) parts.push(`${ev.entrants.toLocaleString("en-GB")} entered`);
  return parts.join(" · ");
}

/** The right-hand line: "Live", "8:00 pm", "All day", "Called off". */
function eventWhen(ev: TournamentEventView): { text: string; tone?: "live" } {
  if (ev.status === "cancelled") return { text: "Called off" };
  if (ev.status === "live") return { text: "Live", tone: "live" };
  if (ev.status === "finished") return { text: "Finished" };
  if (ev.kind === "score_attack") return { text: "All day" };
  return { text: ukTime(ev.startsAt) };
}

function LiveCard({ ev, now, primary, onOpen }: { ev: TournamentEventView; now: number; primary: boolean; onOpen: (id: string) => void }) {
  const entered = ev.mine !== null && !ev.mine.refunded;
  const action = ev.kind === "arena" ? (entered ? "Go to the Arena" : "Join the Arena") : entered ? "Play" : "Enter";
  const meta =
    ev.kind === "arena"
      ? `${ev.entrants} entered · ends in ${inMinutes(ev.endsAt - now)}`
      : `${ev.entrants} entered · ${inMinutes(ev.endsAt - now)} left`;
  return (
    <Panel pad data-tournament-live={ev.id} className={`tn-hero${primary ? " jz-cut-lg" : ""}`}>
      <div className="tn-hero-head">
        <TournamentArt name={KIND_ART[ev.kind]} size={44} />
        <div className="tn-hero-text">
          <span className="tn-live-head">
            <LiveTag />
            <span className="tn-kind">{KIND_LABEL[ev.kind]}</span>
          </span>
          <h3 className="tn-hero-title">{ev.title}</h3>
          <p className="tn-meta">{meta}</p>
        </div>
      </div>
      {ev.kind === "arena" ? <p className="tn-rule">Win 2 points a duel. After two wins in a row, each win counts double.</p> : null}
      <dl className="tn-facts">
        <div>
          <dt>Entry</dt>
          <dd>{ev.entryOptions.map((o) => entryLabel(o.entry, o.coins)).join(" or ")}</dd>
        </div>
        <div>
          <dt>Prize</dt>
          <dd>{firstPrize(ev)}</dd>
        </div>
      </dl>
      <Button variant={primary ? "gold" : "secondary"} size={primary ? 60 : 48} block onClick={() => onOpen(ev.id)} data-tournament-open={ev.id}>
        {action}
      </Button>
    </Panel>
  );
}

function NothingLive({ hub, onOpen, onRemind }: { hub: TournamentHub; onOpen: (id: string) => void; onRemind: (id: string, on: boolean) => void }) {
  const next = hub.next;
  if (!next) return null;
  return (
    <Panel pad data-tournament-nothing-live className="tn-hero">
      <div className="tn-hero-head">
        <TournamentArt name={KIND_ART[next.kind]} size={44} />
        <div className="tn-hero-text">
          <h3 className="tn-hero-title">Nothing live right now</h3>
          <p className="tn-meta">{`Next: ${next.title} at ${ukTime(next.startsAt)}${dayLabel(next.startsAt, hub.now) === "Today" ? "" : `, ${dayLabel(next.startsAt, hub.now)}`}`}</p>
        </div>
      </div>
      <div className="tn-actions">
        <Button variant="secondary" size={48} onClick={() => onOpen(next.id)}>
          See details
        </Button>
        {hub.account && !next.mine ? (
          <Button variant="quiet" size={48} onClick={() => onRemind(next.id, !next.reminded)} aria-pressed={next.reminded} data-tournament-remind={next.id}>
            <Icon name="notifications" size={20} tone={next.reminded ? "gold" : "text-2"} />
            {next.reminded ? "Reminder on" : "Remind me"}
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}

function ScheduleRow({ ev, hub, onOpen, onRemind }: { ev: TournamentEventView; hub: TournamentHub; onOpen: (id: string) => void; onRemind: (id: string, on: boolean) => void }) {
  // The Joulz Championship with fewer than 16 qualifiers (W4c) isn't held that month, and the row says so.
  const sub =
    ev.status === "cancelled"
      ? ev.cancelReason === CHAMPIONSHIP_NOT_HELD
        ? "Not held this month: fewer than 16 qualified"
        : `${KIND_LABEL[ev.kind]} · entries refunded`
      : eventSub(ev);
  const when = eventWhen(ev);
  // A bell or a tick ends the row for an account; with neither (a guest, a called-off event) the chevron does.
  const trailing = hub.account && ev.status !== "cancelled";
  return (
    <div className="tn-list-row" data-tournament-row={ev.id} data-status={ev.status}>
      <Row
        as="button"
        icon="sq"
        onClick={() => onOpen(ev.id)}
        leading={<TournamentArt name={KIND_ART[ev.kind]} size={40} />}
        title={ev.title}
        sub={sub}
      >
        <span className="tn-when" data-tone={when.tone}>
          {when.text}
        </span>
        {trailing ? null : <Icon name="chevron-right" size={20} tone="text-3" />}
      </Row>
      {hub.account && ev.status !== "cancelled" ? (
        ev.mine && !ev.mine.refunded ? (
          <span className="tn-in" role="img" aria-label="You’re in">
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
    <Row data-tournament-entry={entry.eventId} icon="sq" leading={<TournamentArt name={KIND_ART[entry.kind]} size={40} />} title={entry.title} sub={sub}>
      {entry.prizeCoins > 0 ? <span className="tn-prize">{`+${entry.prizeCoins.toLocaleString("en-GB")}`}</span> : null}
    </Row>
  );
}

type HubView = "upcoming" | "results";

/**
 * The hub (Upcoming and Your results). `upcoming` and `results` are the tab's other lists (the scheduled public games
 * and their results), drawn after the hub's own in each view; `resultsEmpty` stands in when there's nothing at all.
 */
export function TournamentHubSections({
  hub,
  onOpen,
  onRemind,
  upcoming,
  results,
  resultsEmpty,
}: {
  hub: TournamentHub;
  onOpen: (eventId: string) => void;
  onRemind: (eventId: string, on: boolean) => void;
  upcoming?: ReactNode;
  results?: ReactNode;
  resultsEmpty?: ReactNode;
}) {
  const [view, setView] = useState<HubView>("upcoming");
  const days: { label: string; events: TournamentEventView[] }[] = [];
  for (const ev of hub.week) {
    if (!kindShown(ev.kind)) continue;
    const label = dayLabel(ev.startsAt, hub.now);
    const last = days[days.length - 1];
    if (last && last.label === label) last.events.push(ev);
    else days.push({ label, events: [ev] });
  }
  const live = hub.live.filter((ev) => kindShown(ev.kind));
  const entries = hub.entries.filter((e) => kindShown(e.kind));
  // Nothing at all yet (no event, entry or result): no views to switch between, so the page is the two empty states.
  if (live.length === 0 && !hub.next && days.length === 0 && entries.length === 0 && !results)
    return (
      <div className="tn-hub" data-tournament-hub data-tournament-hub-empty>
        {upcoming}
        <section aria-label="Your results" className="tn-section">
          <SectionHeader title="Your results" />
          {resultsEmpty ?? <EmptyState layout="card" title="No results yet" body="Enter a tournament and your places and prizes land here." />}
        </section>
      </div>
    );
  return (
    <div className="tn-hub" data-tournament-hub>
      <Segmented
        label="Tournaments"
        value={view}
        onChange={setView}
        className="tn-views"
        options={[
          { value: "upcoming", label: "Upcoming", data: { "data-tournament-view": "upcoming" } },
          { value: "results", label: "Your results", data: { "data-tournament-view": "results" } },
        ]}
      />
      <div className="tn-view" data-tournament-panel="upcoming" hidden={view !== "upcoming"}>
        {live.length > 0 ? (
          <section aria-label="Live" className="tn-section">
            <SectionHeader title="Live now" />
            <div className="tn-cards">
              {live.map((ev, i) => (
                <LiveCard key={ev.id} ev={ev} now={hub.now} primary={i === 0} onOpen={onOpen} />
              ))}
            </div>
          </section>
        ) : hub.next ? (
          <section aria-label="Nothing live" className="tn-section">
            <NothingLive hub={hub} onOpen={onOpen} onRemind={onRemind} />
          </section>
        ) : null}
        {days.length > 0 ? (
          <section aria-label="Schedule" className="tn-section">
            {days.map((d) => (
              <Fragment key={d.label}>
                <h3 className="tn-day" data-tournament-day>
                  {d.label}
                </h3>
                <Panel>
                  {d.events.map((ev) => (
                    <ScheduleRow key={ev.id} ev={ev} hub={hub} onOpen={onOpen} onRemind={onRemind} />
                  ))}
                </Panel>
              </Fragment>
            ))}
          </section>
        ) : null}
        {upcoming}
      </div>
      <div className="tn-view" data-tournament-panel="results" hidden={view !== "results"}>
        {entries.length > 0 ? (
          <section aria-label="Your entries" className="tn-section">
            <SectionHeader title="Tournaments" />
            <Panel>
              {entries.map((e) => (
                <EntryRow key={e.eventId} entry={e} now={hub.now} />
              ))}
            </Panel>
          </section>
        ) : null}
        {results}
        {entries.length === 0 && !results
          ? (resultsEmpty ?? (
              <EmptyState layout="card" title="No results yet" body="Enter a tournament and your places and prizes land here." />
            ))
          : null}
      </div>
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
