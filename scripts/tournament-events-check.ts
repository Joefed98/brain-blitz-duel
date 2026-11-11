/**
 * tournament-events-check (wave 4, W4c; docs/tournaments/events.md): the Category Cup's Swiss system and the Joulz
 * Championship's Knockout bracket as pure rules, on W4b's schedule, prizes and switches; flagged runs; both switched off
 * at launch. No database or browser (~6 s); tournament-events-server-check runs the flow on PostgreSQL.
 *
 * What it proves:
 * - rounds by field size (5 under 32, 6 under 64, 7 from 64; none under the 16 minimum);
 * - Swiss pairing over every round of 2,000 seeded cups of 16–128 players with random results (draws included): never
 *   the same opponent twice, nobody left out, at most one bye a player, the bye to the lowest-placed player without
 *   one, round 2 crossing score groups at most once, no score group floating more than 3 players down, and most
 *   pairings on the same points;
 * - the stated tie-breaks in order: points, Buchholz, head-to-head, total score, entry order;
 * - flagged runs: a flagged side takes no points and no score from the match (a loss), its opponent the win; flags are
 *   read only from the stored grade's extra.flagged; a flagged player gets no place, the rest are placed 1, 2, 3…;
 * - the Knockout: bracket sizes for 2–64 qualifiers, the standard seed order (top seeds meet last), byes to the top
 *   seeds when fewer than 64 qualify, every bracket of 2–64 played to its final with unique places 1–4 and 5th–8th
 *   for the quarter-final losers, a level match to the higher seed, the third-place match from the semi losers;
 * - the month's Score Attack standings (best 10 daily totals, then days played, then best place);
 * - prizes on W4b's table: 3,000 / 1,800 / 900 / 300 (4th–8th) with 2nd only from 8 and 3rd only from 12 players;
 *   10,000 / 5,000 / 2,500 / 1,000 / 500 (5th–8th); trophies for 1st–3rd under the same rule; the badges; the frame;
 * - the schedule on W4b's ids: Saturdays at 7 pm UK (GMT and BST), the 11 categories in turn (14 Nov 2026 is Logic),
 *   the last Sunday of the month (29 Nov 2026), entry 150 coins or a Category Cup ticket, the Championship not
 *   enterable (qualification only), both in W4b's schedule only while switched on;
 * - both switched off at launch (W4b's TOURNAMENT_KINDS_ON), so W4b's schedule makes neither and the hall of fame and
 *   Customise show nothing;
 * - check-only setters ignored in a production build (`import.meta.env.PROD`), and no window override in W4c's code.
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
const w4b = await import("../src/lib/tournaments/rules");
const swiss = await import("../src/lib/tournaments/swiss");
const ko = await import("../src/lib/tournaments/knockout");
const config = await import("../src/config/tournamentConfig");
const flow = await import("../src/lib/tournaments/eventsFlow.server");

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
  check(rules.CUP_MIN_ENTRANTS === 16 && w4b.entryCoins("category_cup") === 150 && w4b.entryOptionsFor("category_cup").join() === "coins,ticket_category_cup", "the cup: 16 minimum, 150 coins or a Category Cup ticket");
  check(w4b.entryOptionsFor("championship").length === 0, "the Championship can't be entered (the month's top 64 qualify)");
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
  const coins = (kind: "category_cup" | "championship", place: number, field: number) => w4b.prizeFor(kind, place, field)?.coins ?? 0;
  const cup = (place: number, field: number) => coins("category_cup", place, field);
  check(cup(1, 16) === 3000 && cup(2, 16) === 1800 && cup(3, 16) === 900 && [4, 5, 6, 7, 8].every((p) => cup(p, 16) === 300) && cup(9, 16) === 0, "the cup: 3,000 / 1,800 / 900, 4th–8th 300, nothing from 9th");
  check(cup(2, 7) === 0 && cup(2, 8) === 1800 && cup(3, 11) === 0 && cup(3, 12) === 900 && cup(1, 2) === 3000, "the safeguard: 2nd only with 8+, 3rd only with 12+");
  const ch = (place: number) => coins("championship", place, 64);
  check(ch(1) === 10000 && ch(2) === 5000 && ch(3) === 2500 && ch(4) === 1000 && [5, 6, 7, 8].every((p) => ch(p) === 500) && ch(9) === 0, "the Championship: 10,000 / 5,000 / 2,500 / 1,000, 5th–8th 500");
  const trophy = (kind: "category_cup" | "championship", place: number, field: number) => w4b.prizeFor(kind, place, field)?.trophy ?? null;
  check(
    trophy("category_cup", 1, 16) === "gold" && trophy("category_cup", 2, 16) === "silver" && trophy("category_cup", 3, 16) === "bronze" && trophy("category_cup", 4, 16) === null && trophy("category_cup", 3, 11) === null && trophy("championship", 3, 4) === "bronze",
    "trophies for 1st–3rd, under the same safeguard",
  );
  check(rules.WINNER_BADGE.category_cup === "swiss-champion" && rules.WINNER_BADGE.championship === "knockout-champion" && rules.CHAMPIONSHIP_FRAME === "frame.championship", "the winner badges and the frame");
  const cat = await import("../src/lib/badges/catalogue");
  check(cat.BADGE_BY_SLUG.get("swiss-champion")?.status === "earnable" && cat.BADGE_BY_SLUG.get("knockout-champion")?.status === "earnable", "both champion badges are earnable (Joe's approval, 11 Nov 2026)");
  const wave4 = JSON.parse(readFileSync("docs/art/wave-4/catalogue.json", "utf8")) as { items: { id: string; source: string; animated: boolean; exclusive_forever: boolean; shop_price_coins: number | null }[] };
  const frame = wave4.items.find((i) => i.id === "frame.championship");
  check(!!frame && frame.source === "tournament" && frame.animated && frame.exclusive_forever && frame.shop_price_coins === null, "the Championship frame: an earned tournament item, animated, never sold");
}

/* ------------------------------------------------------------------ flagged runs */
{
  type M = import("../src/lib/tournaments/swiss").SwissMatch;
  const P = (ids: string[]) => ids.map((id, i) => ({ id, order: i + 1 }));
  const fm = (round: number, a: string, b: string, winner: string | null, noPoints: string[] = []): M => ({ round, a, b, result: { winner, totalA: 300, totalB: 200, noPoints } });
  const t = swiss.swissStandings(P(["x", "y", "z", "w"]), [fm(1, "x", "y", "y", ["x"]), fm(1, "z", "w", null, ["z", "w"])]);
  const row = (id: string) => t.find((r) => r.id === id)!;
  check(row("x").points2 === 0 && row("x").totalScore === 0 && row("x").losses === 1 && row("y").points2 === 2 && row("y").totalScore === 200, "a flagged side takes no points and no score (a loss); its opponent takes the win");
  check(row("z").points2 === 0 && row("w").points2 === 0 && row("z").totalScore === 0, "both sides flagged: neither takes anything");
  const res = (slot: number, round: number, extra: Record<string, unknown> | null) => ({ player_slot: slot, round_number: round, extra });
  const flags = flow.matchFlagsOf({ player_a: "A", player_b: "B" }, [{ type: "gridlock" }, { type: "flip" }] as never, [res(1, 1, { flagged: true, flagReason: "desync" }), res(2, 1, { flagged: "yes" }), res(2, 2, { flagged: true }), res(1, 2, null)]);
  check(flags.length === 2 && flags[0]!.player_id === "A" && flags[0]!.reason === "desync" && flags[0]!.game === "gridlock" && flags[1]!.player_id === "B" && flags[1]!.reason === "server_replay" && flags[1]!.game_idx === 1, "flags only from the stored grade's extra.flagged === true, with the game and the reason");
  const seeds = ["a", "b", "c", "d"].map((user_id, i) => ({ event_id: "e", user_id, seed: i + 1 }));
  const base = { event_id: "e", stage: "swiss", duel_id: null, status: "settled", walkover: false, games_a: 2, games_b: 0, seed_a: null, seed_b: null, created_at: "", room_made_at: null, settled_at: null, id: "m" };
  const matches = [
    { ...base, round: 1, slot: 0, player_a: "a", player_b: "b", winner: "b", flagged_a: true, flagged_b: false, total_a: 0, total_b: 100 },
    { ...base, round: 1, slot: 1, player_a: "c", player_b: "d", winner: "c", flagged_a: false, flagged_b: false, total_a: 300, total_b: 100 },
  ];
  const placed = flow.placesOf("category_cup", { bracket_size: null }, seeds, matches);
  check(placed.length === 3 && !placed.some((p) => p.userId === "a") && placed.map((p) => p.place).join() === "1,2,3", `a flagged player gets no place; the rest are placed 1, 2, 3 (${placed.map((p) => `${p.userId}${p.place}`).join(" ")})`);
  check(flow.flaggedPlayers(matches).has("a") && flow.flaggedPlayers(matches).size === 1, "flaggedPlayers lists exactly the flagged sides");
}

/* ------------------------------------------------------------------ the month's Score Attack standings */
{
  const r = (user_id: string, total: number, place: number) => ({ user_id, total, place });
  // "many": eleven days of 100 and one of 1 counts its best ten, 1,000 (not 1,101); "top" 1,050 in two days beats it.
  const twelveDays = Array.from({ length: 12 }, (_, i) => r("many", i === 0 ? 1 : 100, 5));
  const order = rules.monthStandings([...twelveDays, r("top", 750, 1), r("top", 300, 2), r("tie1", 500, 3), r("tie2", 250, 1), r("tie2", 250, 4)]);
  check(order.join() === "top,many,tie2,tie1" && rules.MONTH_BEST_DAYS === 10, `the best 10 daily totals count, then more days played breaks a level sum (${order.join(", ")})`);
  const sameDays = rules.monthStandings([r("p", 300, 4), r("q", 300, 2)]);
  check(sameDays.join() === "q,p", "then the better best daily place");
}

/* ------------------------------------------------------------------ schedule (W4b's ids) */
{
  check(rules.weekdayOf("2026-11-14") === 6 && rules.weekdayOf("2026-11-29") === 0, "14 Nov 2026 is a Saturday, 29 Nov a Sunday");
  check(rules.cupCategoryOn("2026-11-14") === "logic", `14 Nov 2026's cup is Logic (${rules.cupCategoryOn("2026-11-14")})`);
  const eleven = Array.from({ length: 11 }, (_, k) => rules.cupCategoryOn(new Date(Date.UTC(2026, 9, 10 + 7 * k)).toISOString().slice(0, 10)));
  check(new Set(eleven).size === 11 && rules.cupCategoryOn("2027-01-02") === rules.cupCategoryOn(new Date(Date.UTC(2027, 0, 2 + 77)).toISOString().slice(0, 10)), `the 11 categories in turn, repeating every 11 weeks (${eleven.join(", ")})`);
  check(rules.lastSundayOf("2026-11") === "2026-11-29" && rules.lastSundayOf("2027-02") === "2027-02-28" && rules.lastSundayOf("2026-12") === "2026-12-27", "the last Sunday of the month");
  const ON = { forEveryone: true, kinds: { arena: true, score_attack: true, category_cup: true, championship: true } } as const;
  const cupEv = w4b.scheduledEvent("category_cup:2026-11-14:1900", ON);
  const juneCup = w4b.scheduledEvent("category_cup:2027-06-05:1900", ON);
  check(!!cupEv && new Date(cupEv.startsAt).toISOString() === "2026-11-14T19:00:00.000Z" && !!juneCup && new Date(juneCup.startsAt).toISOString() === "2027-06-05T18:00:00.000Z", "the cup at 7 pm UK in GMT and BST");
  check(cupEv?.title === "Logic Cup" && cupEv.pick === "logic" && cupEv.entryClosesAt === cupEv.startsAt && cupEv.startsAt - cupEv.entryOpensAt === 6 * 86_400_000, "its title and category; entry opens six days before and closes at the start");
  check(w4b.scheduledEvent("category_cup:2026-11-13:1900", ON) === null && w4b.scheduledEvent("category_cup:2026-11-14:2000", ON) === null, "a cup only on a Saturday at 7 pm");
  const ch = w4b.scheduledEvent("championship:2026-11", ON);
  check(!!ch && new Date(ch.startsAt).toISOString() === "2026-11-29T19:00:00.000Z" && ch.title === "Joulz Championship" && w4b.parseEventId("championship:2026-11")?.kind === "championship", "the Championship on the last Sunday at 7 pm, on W4b's ids");
  const week = w4b.scheduleBetween(Date.parse("2026-11-23T00:00:00Z"), Date.parse("2026-11-30T23:00:00Z"), ON).filter((e) => e.kind === "category_cup" || e.kind === "championship");
  check(week.map((e) => e.id).join() === "category_cup:2026-11-28:1900,championship:2026-11", `switched on, both are in W4b's schedule (${week.map((e) => e.id).join()})`);
}

/* ------------------------------------------------------------------ switches off at launch */
{
  check(config.TOURNAMENT_KINDS_ON.category_cup === false && config.TOURNAMENT_KINDS_ON.championship === false, "both events are switched off at launch (W4b's TOURNAMENT_KINDS_ON)");
  check(w4b.scheduledEvent("category_cup:2026-11-14:1900") === null && w4b.scheduledEvent("championship:2026-11") === null, "switched off: W4b's schedule makes neither (so the server refuses entry and the page)");
  const off = w4b.scheduleBetween(Date.parse("2026-11-01T00:00:00Z"), Date.parse("2026-12-01T00:00:00Z")).filter((e) => e.kind === "category_cup" || e.kind === "championship");
  check(off.length === 0, "switched off: nothing of either in a month of W4b's schedule");
  const ui = await import("../src/components/tournaments/BigEventLive");
  check(ui.HallOfFame({ on: false }) === null, "the hall of fame renders nothing while the Championship is off");
  const sourceLine = (await import("../src/lib/identity/customise")).sourceLine;
  check(sourceLine({ id: "frame.championship", name: "Championship", kind: "frame", rarity: null, source: "tournament", passLevel: null, shopPrice: null, animated: true }, true) === null, "Customise lists no Championship frame while the Championship is off");
  const page = readFileSync("src/components/tournaments/TournamentEvent.tsx", "utf8");
  check(page.includes("<BigEventLive eventId={ev.id} />") && readFileSync("src/routes/tournaments.tsx", "utf8").includes("<HallOfFame on={TOURNAMENT_KINDS_ON.championship} />"), "W4b's event page draws the live part, and the Tournaments tab the hall of fame behind its switch");
  const fns = readFileSync("src/lib/tournaments/events.functions.ts", "utf8");
  check(/eventFor\(client, context\.userId, eventId, Date\.now\(\)\)/.test(fns) && /if \(!TOURNAMENT_SWITCHES\.kinds\.championship\) return \[\]/.test(fns), "the server functions read W4b's switches and tester rule on every call");
}

/* ------------------------------------------------------------------ check-only setters in production */
{
  const platform = readFileSync("src/lib/tournaments/platform.server.ts", "utf8");
  const flowSrc = readFileSync("src/lib/tournaments/eventsFlow.server.ts", "utf8");
  check(/setTournamentPlatform[\s\S]*?if \(import\.meta\.env\.PROD\) return;/.test(platform) && /setBigRoomMaker[\s\S]*?if \(import\.meta\.env\.PROD\) return;/.test(flowSrc), "the check-only setters are ignored in a production build (plain import.meta.env.PROD)");
  const { readdirSync } = await import("node:fs");
  const mine = ["eventRules.ts", "swiss.ts", "knockout.ts", "eventsFlow.server.ts", "events.functions.ts", "platform.server.ts"].map((f) => readFileSync(`src/lib/tournaments/${f}`, "utf8"));
  mine.push(readFileSync("src/components/tournaments/BigEventLive.tsx", "utf8"));
  check(mine.every((src) => !/window\.__[A-Z_]+__/.test(src)) && readdirSync("src/lib/tournaments").includes("eventsFlow.server.ts"), "no window.__…__ override in W4c's code (the phone reuses W4b's guarded one)");
  check(!/recordRatedMatch|from "@\/lib\/rated\/ratings/.test(flowSrc), "the events never call the ratings");
}

console.log(`tournament-events-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: Swiss pairing, tie-breaks, the Knockout bracket, prizes, the schedule and the switches hold.");
