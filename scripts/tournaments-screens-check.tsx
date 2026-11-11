/**
 * tournaments-screens-check (wave 4, W4b; docs/mockups/wave-4/05–08): the Tournaments hub's screens as rendered markup,
 * no browser (~2 s). What it proves:
 * - live: a card per live event, the Arena's rule line, its entry and first prize; at most one gold button on the hub;
 * - nothing live: "Nothing live right now", the next event and Remind me; the schedule grouped by day with bells;
 * - your entries with places and prizes; a called-off event says so;
 * - the trophy cabinet draws nothing without a trophy;
 * - the rules pages say they're a draft and state the config's numbers (prizes, the window, the minimum);
 * - the Tournaments tab draws the hub only once the server answered (the public games markup otherwise unchanged).
 */
import { readFileSync } from "node:fs";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

const { TournamentHubSections, TrophyCabinet } = await import("../src/components/tournaments/TournamentHub");
const { rulesFor } = await import("../src/components/tournaments/TournamentRules");
const { howItWorks } = await import("../src/components/tournaments/TournamentEvent");
const rules = await import("../src/lib/tournaments/rules");
import type { TournamentEventView, TournamentHub } from "../src/lib/tournaments/types";

const NOW = Date.UTC(2026, 11, 3, 13, 20);
function view(id: string, patch: Partial<TournamentEventView> = {}): TournamentEventView {
  const ev = rules.scheduledEvent(id)!;
  return {
    id,
    kind: ev.kind,
    title: ev.title,
    pick: ev.pick,
    pickLabel: ev.pick === "mixed" ? "Mixed" : ev.pick,
    startsAt: ev.startsAt,
    endsAt: ev.endsAt,
    entryOpensAt: ev.entryOpensAt,
    entryClosesAt: ev.entryClosesAt,
    status: "scheduled",
    entrants: 0,
    entryOpen: true,
    entryOptions: rules.entryOptionsFor(ev.kind).map((entry) => ({ entry, coins: entry === "coins" ? 50 : 0, affordable: true, held: entry.startsWith("ticket") ? 0 : null })),
    prizes: rules.prizeLines(ev.kind),
    mine: null,
    reminded: false,
    rulesDraft: true,
    cancelledNext: null,
    cancelReason: null,
    rounds: ev.kind === "score_attack" ? 5 : null,
    ...patch,
  };
}
const render = (hub: TournamentHub) =>
  renderToStaticMarkup(React.createElement(TournamentHubSections, { hub, onOpen: () => undefined, onRemind: () => undefined }));

{
  const arena = view("arena:2026-12-03:1300", { status: "live", entrants: 42 });
  const sa = view("score_attack:2026-12-03", { status: "live", entrants: 418 });
  const later = view("arena:2026-12-03:2000");
  const html = render({ open: true, account: true, now: NOW, live: [arena, sa], next: later, week: [sa, arena, later], entries: [], trophies: [] });
  check((html.match(/data-tournament-live=/g) ?? []).length === 2, "a card per live event");
  check(/Win 2 points a duel\. After two wins in a row, each win counts double\./.test(html), "the Arena's rule line");
  check((html.match(/data-variant="gold"/g) ?? []).length === 1, "at most one gold button on the hub (the first live event's)");
  check(/Join the Arena/.test(html) && />Enter</.test(html), "the ways in: Join the Arena, Enter");
  check(/1st: 100 coins and a gold trophy/.test(html) && /1st: 300 coins and a gold trophy/.test(html), "each card's first prize");
  check(!/data-tournament-nothing-live/.test(html), "no nothing-live panel while something is live");
  check(/data-tournament-day[^>]*>Today</.test(html) && (html.match(/data-tournament-row=/g) ?? []).length === 3, "the schedule grouped by day");
  check(/Remind me about Evening Arena/.test(html), "a bell for a reminder on each row");
}
{
  const next = view("arena:2026-12-03:2000", { entrants: 3, reminded: true });
  const cancelled = view("arena:2026-12-04:1300", { status: "cancelled" });
  const html = render({
    open: true,
    account: true,
    now: NOW,
    live: [],
    next,
    week: [next, cancelled],
    entries: [
      { eventId: "arena:2026-12-01:1300", kind: "arena", title: "Lunchtime Arena", startsAt: NOW - 2 * 86_400_000, entry: "free", coins: 0, enteredAt: 0, refunded: false, status: "finished", place: 2, prizeCoins: 60 },
      { eventId: "arena:2026-12-02:1300", kind: "arena", title: "Lunchtime Arena", startsAt: NOW - 86_400_000, entry: "free", coins: 0, enteredAt: 0, refunded: true, status: "cancelled", place: null, prizeCoins: 0 },
    ],
    trophies: [],
  });
  check(/Nothing live right now/.test(html) && /Next: Evening Arena at 8:00 pm/.test(html), "nothing live: the next event");
  check(/Reminder on/.test(html) && (html.match(/data-variant="gold"/g) ?? []).length === 0, "nothing live: Remind me (on), and no gold button");
  check(/Called off/.test(html), "a called-off event says so in the schedule");
  check(/2nd, /.test(html) && /\+60/.test(html) && /called off, entry refunded/.test(html), "your entries: place and prize, a refunded one");
}
{
  const guest = render({ open: true, account: false, now: NOW, live: [], next: null, week: [view("arena:2026-12-03:2000")], entries: [], trophies: [] });
  check(!/Remind me/.test(guest) && !/data-tournament-remind/.test(guest), "a guest gets no reminder buttons");
  check(renderToStaticMarkup(React.createElement(TrophyCabinet, { trophies: [] })) === "", "no trophy cabinet without a trophy");
}
{
  const arena = rulesFor("arena").flatMap((s) => s.lines).join(" ");
  const sa = rulesFor("score_attack").flatMap((s) => s.lines).join(" ");
  check(/1:00 pm and 8:00 pm/.test(arena) && /45 minutes/.test(arena) && /4 or more entrants/.test(arena), "the Arena rules state its times, window and minimum");
  check(/1st: 100 coins and a gold trophy, paid with 4 or more entrants\./.test(arena) && /2nd: 60 coins and a silver trophy, paid with 8 or more/.test(arena), "the Arena rules state its prizes and the safeguard");
  check(/4th–10th: 60 coins, paid with 50 or more entrants\./.test(sa) && /50 coins or a Score Attack ticket/.test(sa) && /refunded in full/.test(sa), "the Score Attack rules: prizes, entry, refunds");
  check(/never change your rating/.test(arena) && /Entry fees are never pooled/.test(sa), "never a rating; never pooled");
  const page = readFileSync("src/components/tournaments/TournamentRules.tsx", "utf8");
  check(/data-rules-draft/.test(page) && /Draft: these rules may change/.test(page), "the rules page is marked as a draft");
  check(howItWorks({ kind: "arena", rounds: null, pickLabel: "Mixed" }).some((l) => /Doesn’t change your rating/.test(l)), "the event page says it doesn’t change your rating");
}
{
  const tab = readFileSync("src/routes/tournaments.tsx", "utf8");
  check(/\{hub \? <TournamentHubSections /.test(tab) && /useTournamentHub\(\)/.test(tab), "the Tournaments tab draws the hub only once the server answered");
  const api = readFileSync("src/lib/tournaments/tournamentsApi.ts", "utf8");
  check(/if \(live && answer && answer\.open\) setHub\(answer\);/.test(api), "a hub closed to the player draws nothing (the public games as before)");
}

console.log(`tournaments-screens-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS");
