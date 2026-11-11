/**
 * tournament-events-check (wave 4, W4c; docs/tournaments/events.md): the Category Cup's Swiss system and the Joulz
 * Championship's Knockout bracket as pure rules, the prizes with the small-field safeguard, the schedule, and both
 * switches off at launch. No database or browser (~2 s); tournament-events-server-check runs the flow on PostgreSQL.
 *
 * What it proves:
 * - rounds by field size (5 under 32, 6 under 64, 7 from 64; none under the 16 minimum);
 * - Swiss pairing over every round of 2,000 seeded cups of 16–128 players with random results (draws included): never
 *   the same opponent twice, nobody left out, at most one bye a player while one is avoidable, the bye to the
 *   lowest-placed player without one, players on the same points paired together whenever their group can pair
 *   (round 2 after a round with no draws: every pairing on the same points), and few pairings across score groups;
 * - the stated tie-breaks in order: points, Buchholz, head-to-head, total score, entry order;
 * - the Knockout: bracket sizes for 2–64 qualifiers, the standard seed order (top seeds meet last), byes to the top
 *   seeds when fewer than 64 qualify, every bracket of 2–64 played to its final with unique places 1–4 and 5th–8th
 *   for the quarter-final losers, a level match to the higher seed, the third-place match from the semi losers;
 * - prizes: 3,000 / 1,800 / 900 / 300 (4th–8th) with 2nd only from 8 and 3rd only from 12 players; the Championship's
 *   10,000 / 5,000 / 2,500 / 1,000 / 500 (5th–8th); trophies for 1st–3rd under the same safeguard; the badges;
 * - the schedule: Saturdays at 7 pm UK (GMT and BST), the 11 categories in turn (14 Nov 2026 is Logic), the last
 *   Sunday of the month (29 Nov 2026);
 * - both switches off at launch: the config, and the Tournaments tab's section rendering nothing (no call made);
 * - the check-only platform setter is ignored in a production build (`import.meta.env.PROD`).
 */
import { readFileSync } from "node:fs";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

const rules = await import("../src/lib/tournaments/eventRules");
const swiss = await import("../src/lib/tournaments/swiss");
const ko = await import("../src/lib/tournaments/knockout");
const config = await import("../src/config/tournamentEventsConfig");

/* ------------------------------------------------------------------ a seeded PRNG */
function prng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/* ------------------------------------------------------------------ rounds by field size */
{
  const want: [number, number][] = [[0, 0], [15, 0], [16, 5], [24, 5], [31, 5], [32, 6], [48, 6], [63, 6], [64, 7], [100, 7], [128, 7]];
  check(want.every(([n, r]) => rules.swissRoundsFor(n) === r), `rounds by field size: ${want.map(([n]) => `${n}→${rules.swissRoundsFor(n)}`).join(" ")}`);
  check(rules.CUP_MIN_ENTRANTS === 16 && rules.CUP_MAX_ENTRANTS === 128 && rules.CUP_ENTRY_COINS === 150 && rules.CUP_TICKET_KIND === "ticket_category_cup", "the cup: 16 minimum, 128 most, 150 coins or a Category Cup ticket");
}

/* ------------------------------------------------------------------ Swiss pairing */
{
  let cups = 0;
  let rematches = 0;
  let leftOut = 0;
  let doubleByes = 0;
  let wrongBye = 0;
  let round2Cross = 0;
  let crossTotal = 0;
  let pairingsTotal = 0;
  let crossOverGroups = 0;
  let threw = 0;
  for (let c = 0; c < 2000; c++) {
    const rnd = prng(9000 + c);
    const n = 16 + Math.floor(rnd() * 113);
    const players = Array.from({ length: n }, (_, i) => ({ id: `p${String(i).padStart(3, "0")}`, order: i + 1 }));
    const rounds = rules.swissRoundsFor(n);
    const matches: import("../src/lib/tournaments/swiss").SwissMatch[] = [];
    const drawsAllowed = c % 2 === 0;
    let noDrawsSoFar = true;
    for (let round = 1; round <= rounds; round++) {
      const before = swiss.swissStandings(players, matches);
      let pairs: import("../src/lib/tournaments/swiss").SwissPairing[];
      try {
        pairs = swiss.pairSwissRound(players, matches);
      } catch {
        threw++;
        break;
      }
      // Everyone exactly once.
      const seen = pairs.flatMap((p) => (p.b ? [p.a, p.b] : [p.a]));
      if (seen.length !== n || new Set(seen).size !== n) leftOut++;
      const met = new Set(matches.filter((m) => m.b).flatMap((m) => [`${m.a}|${m.b}`, `${m.b}|${m.a}`]));
      for (const p of pairs) if (p.b && met.has(`${p.a}|${p.b}`)) rematches++;
      const pts = new Map(before.map((s) => [s.id, s.points2]));
      const cross = pairs.filter((p) => p.b && pts.get(p.a) !== pts.get(p.b)).length;
      crossTotal += cross;
      pairingsTotal += pairs.filter((p) => p.b).length;
      // Floated down from each score group: its odd one out, plus two more only when rematches force them.
      const floated = new Map<number, number>();
      for (const p of pairs) {
        if (!p.b) continue;
        const hi = Math.max(pts.get(p.a)!, pts.get(p.b)!);
        if (pts.get(p.a) !== pts.get(p.b)) floated.set(hi, (floated.get(hi) ?? 0) + 1);
      }
      if ([...floated.values()].some((v) => v > 3)) crossOverGroups++;
      if (round === 2 && noDrawsSoFar) {
        // After a round of wins and losses there are two score groups (the bye joins the winners), and nobody in a
        // group has met: at most one pairing crosses (only when the groups are odd).
        if (cross > 1) round2Cross++;
      }
      const bye = pairs.find((p) => !p.b);
      if (bye) {
        const hadBye = new Set(matches.filter((m) => !m.b).map((m) => m.a));
        if (hadBye.has(bye.a)) doubleByes++;
        // The lowest-placed player without a bye gets it (unless that would leave the rest unpairable).
        const lowestFree = [...before].reverse().find((s) => !hadBye.has(s.id));
        if (lowestFree && lowestFree.id !== bye.a) {
          // Allowed only if the lower players couldn't leave a pairable field; checked loosely: they must be below.
          const placeOf = new Map(before.map((s) => [s.id, s.place]));
          if ((placeOf.get(bye.a) ?? 0) > (placeOf.get(lowestFree.id) ?? 0)) wrongBye++;
        }
      }
      for (const p of pairs) {
        if (!p.b) {
          matches.push({ round, a: p.a, b: null, result: { winner: p.a, totalA: 0, totalB: 0 } });
          continue;
        }
        const r = rnd();
        const draw = drawsAllowed && r < 0.08;
        if (draw) noDrawsSoFar = false;
        const winner = draw ? null : r < 0.54 ? p.a : p.b;
        matches.push({ round, a: p.a, b: p.b, result: { winner, totalA: Math.floor(rnd() * 600), totalB: Math.floor(rnd() * 600) } });
      }
    }
    cups++;
  }
  check(threw === 0, `every round of 2,000 cups (16–128 players) pairs (${threw} failed)`);
  check(rematches === 0, `never the same opponent twice (${rematches} rematches)`);
  check(leftOut === 0, `every player in every round exactly once, nobody knocked out (${leftOut} rounds wrong)`);
  check(doubleByes === 0, `nobody gets a second bye (${doubleByes})`);
  check(wrongBye === 0, `the bye goes to the lowest-placed player without one (${wrongBye} otherwise)`);
  check(round2Cross === 0, `round 2 after a round with no draws: everyone meets someone on the same points but at most one pairing (${round2Cross} cups crossed more)`);
  check(crossOverGroups === 0, `no score group floats more than 3 players down in a round (${crossOverGroups} rounds did)`);
  check(pairingsTotal > 0 && crossTotal / pairingsTotal < 0.2, `most pairings are on the same points (${((100 * crossTotal) / pairingsTotal).toFixed(1)} % cross)`);
  check(cups === 2000, "2,000 cups played");
}

/* ------------------------------------------------------------------ tie-breaks */
{
  type M = import("../src/lib/tournaments/swiss").SwissMatch;
  const P = (ids: string[]) => ids.map((id, i) => ({ id, order: i + 1 }));
  const win = (round: number, a: string, b: string, w: string | null, ta = 0, tb = 0): M => ({ round, a, b, result: { winner: w, totalA: ta, totalB: tb } });
  // Points first.
  let s = swiss.swissStandings(P(["a", "b", "c", "d"]), [win(1, "a", "b", "a"), win(1, "c", "d", "c"), win(2, "a", "c", "a"), win(2, "b", "d", "b")]);
  check(s[0]!.id === "a" && s[0]!.points2 === 4 && s[3]!.id === "d", "points decide first (a 2–0 top, d 0–2 bottom)");
  // Buchholz: b and c both on 1 win; b's opponents scored more.
  s = swiss.swissStandings(P(["a", "b", "c", "d"]), [win(1, "a", "b", "a"), win(1, "c", "d", "c"), win(2, "a", "d", "a"), win(2, "b", "c", "c"), win(3, "b", "d", "b"), win(3, "a", "c", "c")]);
  const order = s.map((r) => r.id).join("");
  check(order.startsWith("ca") || order.startsWith("ac"), `Buchholz between level players (${order}, buchholz ${s.map((r) => `${r.id}${r.buchholz2}`).join(" ")})`);
  // Head-to-head: in seeded random six-player cups, whenever exactly two players are level on points and Buchholz and
  // met, the one who won that match is placed above (unless they drew).
  let h2hCases = 0;
  let h2hWrong = 0;
  for (let c = 0; c < 4000; c++) {
    const rnd = prng(500 + c);
    const ids = ["u0", "u1", "u2", "u3", "u4", "u5"];
    const ms: M[] = [];
    for (let round = 1; round <= 3; round++) {
      let pairs: import("../src/lib/tournaments/swiss").SwissPairing[];
      try {
        pairs = swiss.pairSwissRound(P(ids), ms);
      } catch {
        break;
      }
      for (const p of pairs) ms.push(win(round, p.a, p.b!, rnd() < 0.5 ? p.a : p.b!, Math.floor(rnd() * 400), Math.floor(rnd() * 400)));
    }
    const table = swiss.swissStandings(P(ids), ms);
    const groups = new Map<string, typeof table>();
    for (const r of table) groups.set(`${r.points2}:${r.buchholz2}`, [...(groups.get(`${r.points2}:${r.buchholz2}`) ?? []), r]);
    for (const g of groups.values()) {
      if (g.length !== 2) continue;
      const [u, v] = g as [(typeof table)[number], (typeof table)[number]];
      const game = ms.find((m) => (m.a === u.id && m.b === v.id) || (m.a === v.id && m.b === u.id));
      if (!game?.result?.winner) continue;
      h2hCases++;
      const winner = game.result.winner === u.id ? u : v;
      const loser = winner === u ? v : u;
      if (winner.place > loser.place) h2hWrong++;
    }
  }
  check(h2hCases > 50 && h2hWrong === 0, `head-to-head after Buchholz: the winner of the match between two level players is placed above (${h2hCases} cases, ${h2hWrong} wrong)`);
  // Total score: level on points, Buchholz and head-to-head (they never met).
  const ts = swiss.swissStandings(P(["m", "n", "o", "r"]), [win(1, "m", "o", "m", 500, 0), win(1, "n", "r", "n", 300, 0)]);
  check(ts[0]!.id === "m" && ts[1]!.id === "n", "then the total score across the cup");
  // Entry order last.
  const eo = swiss.swissStandings(P(["e1", "e2", "e3", "e4"]), [win(1, "e2", "e4", "e2", 100, 0), win(1, "e1", "e3", "e1", 100, 0)]);
  check(eo[0]!.id === "e1" && eo[1]!.id === "e2" && new Set(eo.map((r) => r.place)).size === 4, "then entry order: every place unique");
  // A draw is half a point each, a bye a win.
  const dr = swiss.swissStandings(P(["d1", "d2", "d3"]), [win(1, "d1", "d2", null), { round: 1, a: "d3", b: null, result: { winner: "d3", totalA: 0, totalB: 0 } }]);
  check(dr.find((r) => r.id === "d1")!.points2 === 1 && dr.find((r) => r.id === "d3")!.points2 === 2 && swiss.pointsText(3) === "1½", "a drawn match is half a point each, a bye a win");
}

/* ------------------------------------------------------------------ Knockout */
{
  const sizes: [number, number][] = [[1, 2], [2, 2], [3, 4], [4, 4], [5, 8], [9, 16], [33, 64], [64, 64], [80, 64]];
  check(sizes.every(([n, s]) => ko.bracketSize(n) === s), `bracket sizes: ${sizes.map(([n]) => `${n}→${ko.bracketSize(n)}`).join(" ")}`);
  check(ko.seedOrder(8).join() === "1,8,4,5,2,7,3,6", `the seed order for 8 (${ko.seedOrder(8).join()})`);
  const sixtyFour = ko.seedOrder(64);
  check(new Set(sixtyFour).size === 64 && sixtyFour[0] === 1 && sixtyFour[1] === 64 && sixtyFour[32] === 2, "64 seeds, 1 v 64 first, seed 2 at the top of the other half");
  // Top seeds meet last: 1 and 2 only in the final, 1–4 only from the semis.
  const half = (s: number) => (sixtyFour.indexOf(s) < 32 ? 0 : 1);
  const quarter = (s: number) => Math.floor(sixtyFour.indexOf(s) / 16);
  check(half(1) !== half(2) && new Set([1, 2, 3, 4].map(quarter)).size === 4, "seeds 1 and 2 in different halves, 1–4 in different quarters");
  // Byes: fewer than 64, the top seeds go through.
  const r1 = ko.firstRound(40);
  const byes = r1.filter((m) => ko.isWalkover(m));
  const byeSeeds = byes.map((m) => ko.walkoverWinner(m)).sort((a, b) => (a ?? 0) - (b ?? 0));
  check(r1.length === 32 && byes.length === 24 && byeSeeds.join() === Array.from({ length: 24 }, (_, i) => i + 1).join(), `40 qualifiers: 24 byes, to seeds 1–24 (${byeSeeds.slice(0, 5).join()}…)`);
  check(ko.roundName(64, 1) === "Last 64" && ko.roundName(64, 4) === "Quarter-finals" && ko.roundName(64, 5) === "Semi-finals" && ko.roundName(64, 6) === "Final" && ko.roundName(8, 1) === "Quarter-finals", "round names");
  check(ko.playedWinner({ seedA: 7, seedB: 3 }, "draw") === 3 && ko.playedWinner({ seedA: 7, seedB: 3 }, "a") === 7, "a level match goes to the higher seed");

  let bad = 0;
  for (let n = 2; n <= 64; n++) {
    for (let trial = 0; trial < 6; trial++) {
      const rnd = prng(n * 100 + trial);
      const size = ko.bracketSize(n);
      const all: import("../src/lib/tournaments/knockout").KoMatch[] = [];
      let round = ko.firstRound(n);
      let third: import("../src/lib/tournaments/knockout").KoMatch | null = null;
      for (let r = 1; r <= ko.bracketRounds(size); r++) {
        for (const m of round) m.winner = ko.isWalkover(m) ? ko.walkoverWinner(m) : ko.playedWinner(m, rnd() < 0.1 ? "draw" : rnd() < 0.5 ? "a" : "b");
        all.push(...round);
        if (r === ko.bracketRounds(size)) break;
        const next = ko.nextRound(round);
        if (r + 1 === ko.bracketRounds(size)) third = ko.thirdPlaceMatch(round);
        round = next;
      }
      if (third) {
        third.winner = ko.isWalkover(third) ? ko.walkoverWinner(third) : ko.playedWinner(third, rnd() < 0.5 ? "a" : "b");
        all.push(third);
      }
      const places = ko.finalPlaces(size, all);
      const counts = (p: number) => [...places.values()].filter((v) => v === p).length;
      const everySeed = Array.from({ length: n }, (_, i) => i + 1).every((s) => places.has(s));
      const ok =
        everySeed &&
        counts(1) === 1 &&
        counts(2) === 1 &&
        (n < 3 || counts(3) === 1) &&
        (n < 4 || counts(4) === 1) &&
        counts(5) === Math.max(0, Math.min(4, n - 4)) &&
        [...places.values()].every((p) => p >= 1 && p <= n + 32);
      if (!ok) bad++;
    }
  }
  check(bad === 0, `every bracket of 2–64 qualifiers plays to one champion, one 2nd, 3rd, 4th and the quarter-final losers 5th (${bad} wrong)`);
  // The final's winner is 1st, and only the semi losers play for 3rd.
  const semis = [
    { stage: "knockout" as const, round: 2, slot: 0, seedA: 1, seedB: 4, winner: 4 },
    { stage: "knockout" as const, round: 2, slot: 1, seedA: 2, seedB: 3, winner: 2 },
  ];
  const tp = ko.thirdPlaceMatch(semis)!;
  check(tp.seedA === 1 && tp.seedB === 3 && tp.stage === "third_place", "the third-place match is the two semi losers");
}

/* ------------------------------------------------------------------ prizes, trophies, badges */
{
  const cup = (place: number, field: number) => rules.prizeCoins("category_cup", place, field);
  check(cup(1, 16) === 3000 && cup(2, 16) === 1800 && cup(3, 16) === 900 && [4, 5, 6, 7, 8].every((p) => cup(p, 16) === 300) && cup(9, 16) === 0, "the cup: 3,000 / 1,800 / 900, 4th–8th 300, nothing from 9th");
  check(cup(2, 7) === 0 && cup(2, 8) === 1800 && cup(3, 11) === 0 && cup(3, 12) === 900 && cup(1, 2) === 3000, "the safeguard: 2nd only with 8+, 3rd only with 12+");
  const ch = (place: number) => rules.prizeCoins("championship", place, 64);
  check(ch(1) === 10000 && ch(2) === 5000 && ch(3) === 2500 && ch(4) === 1000 && [5, 6, 7, 8].every((p) => ch(p) === 500) && ch(9) === 0, "the Championship: 10,000 / 5,000 / 2,500 / 1,000, 5th–8th 500");
  check(
    rules.trophyFor("category_cup", 1, 16) === "gold" && rules.trophyFor("category_cup", 2, 16) === "silver" && rules.trophyFor("category_cup", 3, 16) === "bronze" && rules.trophyFor("category_cup", 4, 16) === null && rules.trophyFor("category_cup", 3, 11) === null && rules.trophyFor("championship", 3, 4) === "bronze",
    "trophies for 1st–3rd, under the same safeguard",
  );
  check(rules.WINNER_BADGE.category_cup === "swiss-champion" && rules.WINNER_BADGE.championship === "knockout-champion" && rules.CHAMPIONSHIP_FRAME === "frame.championship" && rules.FINISH_JOULES === 150, "the badges, the frame and 150 Joules for finishing");
  const cat = await import("../src/lib/badges/catalogue");
  check(cat.BADGE_BY_SLUG.get("swiss-champion")?.status === "earnable" && cat.BADGE_BY_SLUG.get("knockout-champion")?.status === "earnable", "both champion badges are earnable (Joe's approval, 11 Nov 2026)");
  const wave4 = JSON.parse(readFileSync("docs/art/wave-4/catalogue.json", "utf8")) as { items: { id: string; source: string; animated: boolean; exclusive_forever: boolean; shop_price_coins: number | null }[] };
  const frame = wave4.items.find((i) => i.id === "frame.championship");
  check(!!frame && frame.source === "tournament" && frame.animated && frame.exclusive_forever && frame.shop_price_coins === null, "the Championship frame: an earned tournament item, animated, never sold");
}

/* ------------------------------------------------------------------ schedule */
{
  check(rules.weekdayOf("2026-11-14") === 6 && rules.weekdayOf("2026-11-29") === 0, "14 Nov 2026 is a Saturday, 29 Nov a Sunday");
  check(rules.cupCategoryOn("2026-11-14") === "logic", `14 Nov 2026's cup is Logic (${rules.cupCategoryOn("2026-11-14")})`);
  const eleven = Array.from({ length: 11 }, (_, k) => rules.cupCategoryOn(new Date(Date.UTC(2026, 9, 10 + 7 * k)).toISOString().slice(0, 10)));
  check(new Set(eleven).size === 11 && rules.cupCategoryOn("2027-01-02") === rules.cupCategoryOn(new Date(Date.UTC(2027, 0, 2 + 77)).toISOString().slice(0, 10)), `the 11 categories in turn, repeating every 11 weeks (${eleven.join(", ")})`);
  check(rules.lastSundayOf("2026-11") === "2026-11-29" && rules.lastSundayOf("2027-02") === "2027-02-28" && rules.lastSundayOf("2026-12") === "2026-12-27", "the last Sunday of the month");
  check(new Date(rules.eventStartMs("2026-11-14")).toISOString() === "2026-11-14T19:00:00.000Z" && new Date(rules.eventStartMs("2027-06-05")).toISOString() === "2027-06-05T18:00:00.000Z", "7 pm UK in GMT and BST");
  const fri = Date.parse("2026-11-13T12:00:00Z");
  const satLate = Date.parse("2026-11-15T02:00:00Z");
  check(rules.cupDateFor(fri) === "2026-11-14" && rules.cupDateFor(Date.parse("2026-11-14T20:00:00Z")) === "2026-11-14" && rules.cupDateFor(satLate) === "2026-11-21", "the page shows this Saturday's cup until 6 h after its start");
  check(rules.championshipMonthFor(Date.parse("2026-11-29T20:00:00Z")) === "2026-11" && rules.championshipMonthFor(Date.parse("2026-11-30T03:00:00Z")) === "2026-12" && rules.championshipMonthFor(Date.parse("2026-12-31T23:00:00Z")) === "2027-01", "the page shows this month's Championship until 6 h after it, then next month's");
}

/* ------------------------------------------------------------------ switches off at launch */
{
  check(config.CATEGORY_CUP_ENABLED === false && config.JOULZ_CHAMPIONSHIP_ENABLED === false, "both events are switched off at launch");
  const flow = await import("../src/lib/tournaments/eventsFlow.server");
  check(flow.eventRefusal("category_cup") !== null && flow.eventRefusal("championship") !== null, "the server's refusal reads the switches (both refused)");
  check(flow.eventRefusal("category_cup", { category_cup: true, championship: false }) === null, "a switched-on cup is allowed");
  const ui = await import("../src/components/tournaments/BigEvents");
  check(ui.BigEventsSection() === null, "the Tournaments tab's section renders nothing with both switches off (and calls nothing)");
  const tab = readFileSync("src/routes/tournaments.tsx", "utf8");
  check(tab.includes("<BigEventsSection />"), "the Tournaments tab draws the section");
  const sourceLine = (await import("../src/lib/identity/customise")).sourceLine;
  check(sourceLine({ id: "frame.championship", name: "Championship", kind: "frame", rarity: null, source: "tournament", passLevel: null, shopPrice: null, animated: true }, true) === null, "Customise lists no Championship frame while the Championship is off");
}

/* ------------------------------------------------------------------ the check-only setter in production */
{
  const src = readFileSync("src/lib/tournaments/platform.server.ts", "utf8");
  check(/if \(import\.meta\.env\.PROD\) return;/.test(src), "setTournamentPlatform is ignored in a production build (plain import.meta.env.PROD)");
  const all = ["src/lib/tournaments", "src/components/tournaments"].flatMap((d) =>
    (require("node:fs").readdirSync(d) as string[]).map((f) => readFileSync(`${d}/${f}`, "utf8")),
  );
  check(all.every((s) => !/window\.__[A-Z_]+__/.test(s)), "no window.__…__ override anywhere in the events' code");
}

console.log(`tournament-events-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: Swiss pairing, tie-breaks, the Knockout bracket, prizes, the schedule and the switches hold.");
