/**
 * The arcade answer-reveal summary, built on the SERVER from its own replay and
 * stored on round_results.extra.reveal. The phone only displays it, so the
 * axis value, the breakdown lines and the stat tiles always describe the same
 * replay that produced round_results.score.
 */

import { CROSS_LANE_POINTS, CROSS_CROSSING_POINTS } from "./cross";
import { BT_BALLS, BT_V7_BALLS } from "./ballTrack";
import { whackDepthScore, type WhackState } from "./whack";
import { CLAY_DOUBLES, clayDepthScore, clayDoublesHit, type ClayState } from "./clayShoot";
import { MATCHUP_PAR_RAW, matchupCoreGemsOf, matchupGoalsMet, matchupGoalsOf, matchupTreasuresOf, type MatchupState } from "./matchup";
import { WF_PAR } from "./wordfall";
import { HOVER_CHAINS, HOVER_TIGHT_GATES, HOVER_V2_GATES_SCORE, HOVER_V2_STARS_SCORE } from "./hover";
import { WAV_BOSS_HP, WAV_V2_WAVES } from "./wavefront";
import { BAND_SPECS } from "./bandParts";
import { breakerStdParts, type BrkState } from "./breaker";
import { burstGoldenCount, burstStdParts, BURST_V10_GOLDENS, BURST_V10_WAVES, type BurstState } from "./burst";
import { bandLines } from "./scoreBands";
import { stdLines } from "./arcadeStandard";
import { psCoreFullFor } from "./cards/pokerSquares";
import { fhCoreFullFor } from "./cards/fiveHands";
import { fcCardsFor, fcCoreUnitsFor } from "./cards/freecell";
import { NINJA_COINS, NINJA_CORE_FULL_M, NINJA_LANTERNS, NINJA_SCROLLS } from "./ricochetNinja";
import { MG_CORE_FULL } from "./cards/muggins";
import { arcadeStdParts } from "./standard";

export interface ArcadeRevealTile {
  label: string;
  value: string;
}

export interface ArcadeRevealData {
  /** Where this player ended on the game's progress axis. */
  axis: { value: number; max: number | null; label: string };
  /** Formula lines mirroring the stored score. */
  lines: string[];
  tiles: ArcadeRevealTile[];
  /** How the run ended: reached the finish, crashed / lost the last life, or ran out of time. */
  outcome: "finish" | "crash" | "time";
}

type Run = Record<string, unknown>;

const n = (run: Run, key: string): number => {
  const value = run[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
};
const b = (run: Run, key: string): boolean => run[key] === true;

/** Depth to 200, Bonk whackRev 3: the combo and diamonds line, for a run whose state carries them. */
function whackDepthLine(run: Run): string[] {
  const state = run["state"] as WhackState | undefined;
  if (!state?.dp) return [];
  const d = whackDepthScore(state);
  return [`Combo +${d.combo} (best run ${state.dp.best}) · diamonds +${d.diamonds} (${state.dp.hits} of ${state.dp.at.length})`];
}

/** Depth to 200, Pull! clayRev 9: the doubles and streak line. */
function clayDepthLine(run: Run): string[] {
  const state = run["state"] as ClayState | undefined;
  if (!state?.dp) return [];
  const d = clayDepthScore(state);
  return [`Doubles +${d.doubles} (${clayDoublesHit(state)} of ${CLAY_DOUBLES}) · streak +${d.streak} (best ${state.dp.best})`];
}
const sec = (value: number): string => `${value.toFixed(1)} s`;

/** Gemstone before matchupRev 11: match points on the axis (unchanged). */
function matchupRevealBefore(r: Run, s: number): ArcadeRevealData {
  return {
    axis: { value: n(r, "raw"), max: n(r, "parRaw") || MATCHUP_PAR_RAW, label: "Match points" },
    lines: [`${n(r, "raw").toLocaleString("en-GB")} match points → ${s}`],
    tiles: [
      { label: "Best line", value: String(n(r, "bestLine")) },
      ...(n(r, "jackpots") > 0 ? [{ label: "Jackpots", value: String(n(r, "jackpots")) }] : []),
      { label: "Cascades", value: String(n(r, "cascades")) },
      { label: "Swaps", value: String(n(r, "swaps")) },
    ],
    outcome: "time",
  };
}

/** "x / y things → score", splitting the completion score into 130 + time when finished. */
function head(text: string, score: number, complete: boolean): string {
  return complete && score >= 130 ? `${text} → 130 · time +${score - 130}` : `${text} → ${score}`;
}

function ended(run: Run, complete: boolean): ArcadeRevealData["outcome"] {
  if (complete) return "finish";
  if (run["survived"] === false) return "crash";
  return "time";
}

/** Slice before sliceRev 11. */
function sliceReveal(r: Run, s: number): ArcadeRevealData {
  return {
    axis: { value: n(r, "slices"), max: n(r, "totalDiscs"), label: "Foods sliced" },
    lines: [
      `${n(r, "slices")} / ${n(r, "totalDiscs")} foods → ${s}`,
      ...(n(r, "bombsHit") > 0 ? [`−10 × ${n(r, "bombsHit")} ${n(r, "bombsHit") === 1 ? "chilli" : "chillies"}`] : []),
    ],
    tiles: [
      { label: "Best combo", value: `×${n(r, "bestMult")}` },
      { label: "Ketchup / mustard", value: String(n(r, "bonuses")) },
      { label: "Chillies", value: String(n(r, "bombsHit")) },
      // sliceRev 2 rounds only: mayonnaise bottles cut.
      ...(("mayoOn" in r ? b(r, "mayoOn") : "mayo" in r) ? [{ label: "Mayo", value: String(n(r, "mayo")) }] : []),
    ],
    outcome: "time",
  };
}

type Builder = (run: Run, score: number) => ArcadeRevealData;

/**
 * The Sports group (30 Oct 2026: Home Run Derby, Free Kick, Racing), born on the arcade scoring standard: the axis is
 * the core part, a tile for each feature part (points of its maximum); the lines come from the parts (below).
 */
function sportsBuilder(axisLabel: string, finished: (r: Run) => boolean): Builder {
  return (r) => {
    const parts = (r["parts"] as { key: string; label: string; points: number; max: number; detail: string }[] | undefined) ?? [];
    const core = parts.find((p) => p.key === "core");
    return {
      axis: { value: core?.points ?? 0, max: core?.max ?? null, label: axisLabel },
      lines: [],
      tiles: parts.filter((p) => p.key !== "core").map((p) => ({ label: p.label, value: `${p.points} / ${p.max}` })),
      outcome: finished(r) ? "finish" : "time",
    };
  };
}

const BUILDERS: Record<string, Builder> = {
  homerun: sportsBuilder("Distance points", (r) => n(r, "pitches") >= 10),
  // Bastion bastionRev 2 (1 Nov 2026): the armour core on the axis, a tile for each feature; the base falling is a crash.
  // (The original Bastion's unstamped rounds have no builder: buildArcadeReveal gives null for them, as before.)
  bastion: (r, s) => {
    const data = sportsBuilder("Armour points", (q) => !b(q, "fell"))(r, s);
    return { ...data, outcome: b(r, "fell") ? "crash" : "time" };
  },
  freekick: sportsBuilder("Goal points", (r) => b(r, "finished")),
  racing: sportsBuilder("Distance points", (r) => b(r, "finished")),
  // Blockfall and Alley Roll (1 Nov 2026): the same shape (the lines come from the standard parts).
  blockfall: sportsBuilder("Lines points", (r) => !b(r, "toppedOut")),
  alleyroll: sportsBuilder("Ring points", (r) => b(r, "finished")),
  // Cards & Board (30 Oct 2026; the lines come from each game's standard parts).
  freecell: (r, s) => ({
    axis: { value: n(r, "home"), max: fcCardsFor(n(r, "freecellRev") || 1), label: "Cards home" },
    // freecellRev 3: the core is full at FC_CORE_UNITS_V3 units (home 2 each, sorted 1 each), well before all 52;
    // freecellRev 4: the 40-card deal, full at FC_CORE_UNITS_V4.
    lines: (n(r, "freecellRev") || 1) >= 3
      ? [`${n(r, "home")} home · ${n(r, "sorted")} sorted = ${2 * n(r, "home") + n(r, "sorted")} units (full at ${fcCoreUnitsFor(n(r, "freecellRev"))}) → ${s}`]
      : [`${n(r, "home")} / 52 home → ${s}`],
    tiles: [
      { label: "Moves", value: `${n(r, "moves")} · par ${n(r, "par")}` },
      { label: "Sorted runs", value: String(n(r, "sorted")) },
      { label: "Time", value: b(r, "finished") ? sec(n(r, "finishSeconds")) : "—" },
    ],
    outcome: b(r, "finished") ? "finish" : "time",
  }),
  tripeaks: (r, s) => ({
    axis: { value: n(r, "cleared"), max: 28, label: "Cards cleared" },
    lines: [`${n(r, "cleared")} / 28 cleared → ${s}`],
    tiles: [
      { label: "Peak tops", value: `${n(r, "peaks")} / 3` },
      { label: "Longest run", value: String(n(r, "bestRun")) },
      (n(r, "tripeaksRev") || 1) >= 2 ? { label: "Stock par", value: `${n(r, "stockTurns")} / ${n(r, "stockPar")}` } : { label: "Stock left", value: String(n(r, "stockLeft")) },
      { label: "Time", value: b(r, "finished") ? sec(n(r, "finishSeconds")) : "—" },
    ],
    outcome: b(r, "finished") ? "finish" : n(r, "endedSeconds") < 60 ? "crash" : "time",
  }),
  pokersquares: (r, s) => {
    const full = psCoreFullFor(n(r, "pokerSquaresRev") || 1);
    return {
      axis: { value: n(r, "total"), max: full, label: "Hand points" },
      lines: [`${n(r, "total")} hand points (full at ${full}) → ${s}`],
      tiles: [
        { label: "Made hands", value: `${n(r, "made")} / 10` },
        { label: "Full at", value: String(full) },
        { label: "Placed", value: `${n(r, "placed")} / 25` },
      ],
      outcome: n(r, "placed") === 25 ? "finish" : "time",
    };
  },
  ricochet: (r, s) => ({
    axis: { value: n(r, "metres"), max: NINJA_CORE_FULL_M, label: "Metres climbed" },
    lines: [`${n(r, "metres")} m climbed (full at ${NINJA_CORE_FULL_M}) · ${n(r, "coins")} coins · ${n(r, "lanterns")} lanterns · ${n(r, "scrolls")} scrolls → ${s}`],
    tiles: [
      { label: "Height", value: `${n(r, "metres")} m` },
      { label: "Coins", value: `${n(r, "coins")} / ${NINJA_COINS}` },
      { label: "Lanterns", value: `${n(r, "lanterns")} / ${NINJA_LANTERNS}` },
      { label: "Scrolls", value: `${n(r, "scrolls")} / ${NINJA_SCROLLS}` },
      { label: "Hits", value: String(n(r, "hits")) },
    ],
    outcome: "time",
  }),
  fivehands: (r, s) => {
    // fiveHandsRev 2: hand points alone on the steep table, full at FH_CORE_FULL_V2; rev 3: the flat table summed, capped at 200.
    const rev = n(r, "fiveHandsRev") || 1;
    const full = fhCoreFullFor(rev);
    return {
    axis: { value: n(r, "total"), max: full, label: "Hand points" },
    lines: rev >= 3
      ? [
          `${n(r, "total") - n(r, "columnPoints")} from the five rows + ${n(r, "column") >= 0 ? `${n(r, "columnPoints")} from column ${n(r, "column") + 1}` : "no column picked"} = ${n(r, "total")} hand points × 1.4 (capped at 200) → ${s}`,
        ]
      : [`${n(r, "total")} hand points (full at ${full}) → ${s}`],
    tiles: [
      { label: (n(r, "fiveHandsRev") || 1) >= 2 ? "Rows with a hand" : "Made hands", value: `${n(r, "made")} / 5` },
      rev >= 3
        ? { label: "Sixth hand (column)", value: n(r, "column") >= 0 ? `${String((r as Record<string, unknown>)["columnHand"] || "No hand")} +${n(r, "columnPoints")}` : "Not picked" }
        : { label: "Full at", value: String(full) },
      { label: "Placed", value: `${n(r, "placed")} / 20` },
    ],
    outcome: n(r, "placed") === 20 ? "finish" : "time",
    };
  },
  pyramid: (r, s) => ({
    axis: { value: n(r, "removed"), max: 28, label: "Pyramid cards" },
    lines: [`${n(r, "removed")} / 28 removed → ${s}`],
    tiles: [
      { label: "Removed", value: `${n(r, "removed")} / 28` },
      { label: "Pyramid pairs", value: `${Math.min(10, n(r, "ppPairs"))} / 10` },
      { label: "Time", value: b(r, "finished") ? sec(n(r, "finishSeconds")) : "—" },
    ],
    outcome: b(r, "finished") ? "finish" : n(r, "endedSeconds") < 90 ? "crash" : "time",
  }),
  golfsol: (r, s) => ({
    axis: { value: n(r, "cleared"), max: 35, label: "Cards cleared" },
    lines: [`${n(r, "cleared")} / 35 cleared → ${s}`],
    tiles: [
      { label: "Cleared", value: `${n(r, "cleared")} / 35` },
      { label: "Runs of 5", value: `${Math.min(5, n(r, "runs"))} / 5` },
      { label: "Time", value: b(r, "finished") ? sec(n(r, "finishSeconds")) : "—" },
    ],
    outcome: b(r, "finished") ? "finish" : n(r, "endedSeconds") < 75 ? "crash" : "time",
  }),
  muggins: (r, s) => ({
    axis: { value: n(r, "points"), max: MG_CORE_FULL, label: "Muggins points" },
    lines: [`${n(r, "points")} points (full at ${MG_CORE_FULL}) → ${s}`],
    tiles: [
      { label: "Points", value: String(n(r, "points")) },
      { label: "Big plays", value: `${Math.min(2, n(r, "bigs"))} / 2` },
      { label: "Hand", value: b(r, "finished") ? "cleared" : `${n(r, "handLeft")} left` },
    ],
    outcome: b(r, "finished") ? "finish" : n(r, "endedSeconds") < 90 ? "crash" : "time",
  }),
  hover: (r, s) => {
    const done = n(r, "gates") >= n(r, "totalGates") && n(r, "totalGates") > 0;
    // hoverRev 9 (the 200 expansion): the base, then the skill points (tight gates, chains, centre lines).
    if (r["tightGates"] !== undefined)
      return {
        axis: { value: n(r, "gates"), max: n(r, "totalGates"), label: "Barriers passed" },
        lines: [
          `${n(r, "gates")} / ${n(r, "totalGates")} barriers · ${n(r, "stars")} / ${n(r, "totalStars")} gold stars → ${s - n(r, "skill")}`,
          `Skill +${n(r, "skill")}: ${n(r, "tightGates")} tight gates · ${n(r, "starChains")} star chains · centre ${n(r, "centrePts")}`,
          `Total → ${s}`,
        ],
        tiles: [
          { label: "Barriers", value: String(n(r, "gates")) },
          { label: "Tight gates", value: `${n(r, "tightGates")} / ${HOVER_TIGHT_GATES}` },
          { label: "Star chains", value: `${n(r, "starChains")} / ${HOVER_CHAINS}` },
          { label: b(r, "survived") ? "Survived" : "Crashed at", value: b(r, "survived") ? "60 s" : sec(n(r, "endedSeconds")) },
        ],
        outcome: done ? "finish" : ended(r, false),
      };
    return {
      axis: { value: n(r, "gates"), max: n(r, "totalGates"), label: "Barriers passed" },
      lines:
        n(r, "totalStars") > 0
          ? [
              `${n(r, "gates")} / ${n(r, "totalGates")} barriers → ${Math.min(HOVER_V2_GATES_SCORE, Math.round((HOVER_V2_GATES_SCORE * n(r, "gates")) / Math.max(1, n(r, "totalGates"))))}`,
              `${n(r, "stars")} / ${n(r, "totalStars")} gold stars → ${Math.min(HOVER_V2_STARS_SCORE, Math.round((HOVER_V2_STARS_SCORE * n(r, "stars")) / n(r, "totalStars")))}`,
              `Total → ${s}`,
            ]
          : [`${n(r, "gates")} / ${n(r, "totalGates")} barriers → ${s}`],
      tiles: [
        { label: "Barriers", value: String(n(r, "gates")) },
        ...(n(r, "totalStars") > 0 ? [{ label: "Gold stars", value: `${n(r, "stars")} / ${n(r, "totalStars")}` }] : []),
        { label: b(r, "survived") ? "Survived" : "Crashed at", value: b(r, "survived") ? "60 s" : sec(n(r, "endedSeconds")) },
      ],
      outcome: done ? "finish" : ended(r, false),
    };
  },
  skyline: (r, s) => ({
    axis: { value: n(r, "blocks"), max: null, label: "Blocks stacked" },
    lines: [
      n(r, "skylineRev") >= 7
        ? `${n(r, "blocks")} blocks · ${n(r, "perfects")} perfect · best ×${Math.max(1, n(r, "bestMult"))} · ${n(r, "golds")} gold · ${n(r, "milestones")} milestone${n(r, "milestones") === 1 ? "" : "s"} → ${s}`
        : n(r, "skylineRev") > 0
          ? `${n(r, "blocks")} blocks · ${n(r, "perfects")} perfect · +${n(r, "streakPoints")} streak → ${s}`
          : `${n(r, "blocks")} blocks · ${n(r, "perfects")} perfect → ${s}`,
    ],
    tiles: [
      { label: "Blocks", value: String(n(r, "blocks")) },
      { label: "Perfect drops", value: String(n(r, "perfects")) },
      ...(n(r, "skylineRev") > 0 || (r["state"] as { expandRev?: number } | undefined)?.expandRev === 9 ? [{ label: "Best streak", value: String(n(r, "bestStreak")) }] : []),
      // skylineRev 9 (the arcade scoring standard; the replay's state carries expandRev 9): five gold blocks a run.
      ...((r["state"] as { expandRev?: number } | undefined)?.expandRev === 9
        ? [{ label: "Gold blocks", value: `${n(r, "golds")} / 5` }]
        : n(r, "skylineRev") >= 7
          ? [{ label: "Gold blocks", value: String(n(r, "golds")) }]
          : []),
    ],
    outcome: ended(r, false),
  }),
  bintoss: (r, s) => {
    const done = n(r, "baskets") >= 10;
    const hoops = n(r, "hoops");
    const bonus = 3 * n(r, "swishes");
    return {
      axis: { value: n(r, "baskets"), max: 10, label: "Buckets" },
      lines:
        hoops > 0
          ? [
              done && s >= 130 ? `10 / 10 buckets → 130 · time +${Math.max(0, s - 130 - bonus)}` : `${n(r, "baskets")} / 10 buckets → ${10 * n(r, "baskets")}`,
              `${n(r, "swishes")} / ${hoops} hoop bonuses → +${bonus}`,
              `Total → ${s}`,
            ]
          : [head(`${n(r, "baskets")} / 10 buckets`, s, done)],
      tiles: [
        { label: "Buckets", value: `${n(r, "baskets")} / 10` },
        ...(hoops > 0 ? [{ label: "Hoop bonuses", value: `${n(r, "swishes")} / ${hoops}` }] : []),
        // binRev 9 (the arcade scoring standard): the far buckets made.
        ...(r["far"] !== undefined ? [{ label: "Far buckets", value: `${n(r, "far")} / 6` }] : []),
        { label: "Throws", value: String(n(r, "throws")) },
      ],
      outcome: done ? "finish" : "time",
    };
  },
  bullseye: (r, s) => {
    // bullRev 2: inner bulls and balloons score 12, so the axis runs to 120;
    // bullRev 4 balloons add up to 6 on top of the rings (126).
    const rev2 = n(r, "bullRev") === 2;
    const tuned = n(r, "tuned") === 1;
    return {
      axis: { value: n(r, "total"), max: tuned ? 126 : rev2 ? 120 : 100, label: "Dart total" },
      lines: [
        ...(rev2 ? [`${n(r, "total")} points from 10 darts → ${s}`] : [`${n(r, "total")} / 100 rings → ${s}`]),
        // bullRev 8: the streak and dead-centre points on top.
        ...(typeof r["dead"] === "number" ? [`Bull streak +${n(r, "streakPts")} · dead-centre ${n(r, "dead")} +${n(r, "deadPts")}`] : []),
      ],
      tiles: [
        { label: "Bullseyes", value: String(n(r, "inner")) },
        ...(typeof r["dead"] === "number" ? [{ label: "Dead-centre", value: String(n(r, "dead")) }] : []),
        ...(rev2 ? [{ label: "Inner bulls", value: String(n(r, "innerBulls")) }, { label: "Balloons", value: tuned ? `${n(r, "pops")} / ${n(r, "balloons")} · +${n(r, "balloonPoints")}` : `${n(r, "pops")} / ${n(r, "balloons")}` }] : []),
        { label: "Darts", value: String(n(r, "arrows")) },
      ],
      outcome: b(r, "finished") ? "finish" : "time",
    };
  },
  matchup: (r, s) => {
    // matchupRev 11 (the arcade scoring standard): gems cleared on the axis, the parts as tiles (the lines come from
    // the band breakdown, matchupStdBandParts). matchupRev 12: its own core count, six goals and six treasures.
    const st = r["state"] as MatchupState | undefined;
    if (st?.std)
      return {
        axis: { value: st.gemsCleared ?? 0, max: matchupCoreGemsOf(st), label: "Gems cleared" },
        lines: [`${(st.gemsCleared ?? 0).toLocaleString("en-GB")} gems cleared → ${s}`],
        tiles: [
          { label: "Treasure", value: `${st.treasures ?? 0} / ${matchupTreasuresOf(st)}` },
          { label: "Goals", value: `${matchupGoalsMet(st)} / ${matchupGoalsOf(st)}` },
          { label: "Ice", value: String(st.iceBroken ?? 0) },
          { label: "Big lines", value: String(st.bigLines ?? 0) },
        ],
        outcome: "time",
      };
    return matchupRevealBefore(r, s);
  },
  breaker: (r, s) => {
    const done = b(r, "cleared");
    // brkRev 11 (the arcade scoring standard): every brick on the axis (gold included, what the core counts), gold as a
    // tile, no combo tile. Read from the replayed state the run carries, through the sim's own parts.
    const stdState = r["state"] as BrkState | undefined;
    const std = stdState?.std ? breakerStdParts(stdState) : null;
    if (std)
      return {
        axis: { value: std.bricks, max: std.all, label: "Bricks destroyed" },
        lines: [head(`${std.bricks} / ${std.all} bricks`, s, done)],
        tiles: [
          { label: "Gold bricks", value: `${std.goldBroken} / ${std.goldDealt}` },
          { label: "Power-ups", value: String(n(r, "powerUps")) },
          { label: "Balls lost", value: String(n(r, "losses")) },
          { label: "Brick hits", value: String(n(r, "hits")) },
        ],
        outcome: done ? "finish" : n(r, "bricksLeft") > 0 && n(r, "endedSeconds") < 90 ? "crash" : "time",
      };
    // brkRev 9: a 105-brick wall, and the skill points (gold bricks, combos) as their own line and tiles.
    const wall = n(r, "wall") || 80;
    const deep = n(r, "wall") > 0;
    return {
      axis: { value: n(r, "destroyed"), max: wall, label: "Bricks destroyed" },
      lines: [head(`${n(r, "destroyed")} / ${wall} bricks`, s, done), ...(deep ? [`Skill +${n(r, "skill")}: ${n(r, "goldBroken")} gold · ${n(r, "comboPts")} combo`] : [])],
      tiles: [
        ...(deep ? [{ label: "Gold bricks", value: String(n(r, "goldBroken")) }, { label: "Best combo", value: String(n(r, "bestChain")) }] : []),
        { label: "Power-ups", value: String(n(r, "powerUps")) },
        { label: "Balls lost", value: String(n(r, "losses")) },
        // Hits this run landed (was the wall's total hit points, e.g. 130 for 6 bricks destroyed).
        { label: "Brick hits", value: String(n(r, "hits")) },
      ],
      outcome: done ? "finish" : n(r, "bricksLeft") > 0 && n(r, "endedSeconds") < 90 ? "crash" : "time",
    };
  },
  // Cards & Board (30 Oct 2026; the lines come from the standard's parts).
  minesweeper: (r, s) => ({
    axis: { value: n(r, "revealed") - n(r, "opening"), max: n(r, "safe") - n(r, "opening"), label: "Safe squares" },
    lines: [`${n(r, "revealed") - n(r, "opening")} safe squares → ${s}`],
    tiles: [
      { label: "Mines hit", value: String(n(r, "hits")) },
      { label: "Flags", value: String(n(r, "flags")) },
      { label: "Cleared", value: b(r, "cleared") ? sec(n(r, "clearedSeconds")) : "No" },
    ],
    outcome: b(r, "cleared") ? "finish" : "time",
  }),
  mahjong: (r, s) => ({
    axis: { value: n(r, "pairs"), max: 36, label: "Pairs" },
    lines: [`${n(r, "pairs")} / 36 pairs → ${s}`],
    tiles: [
      { label: "Shuffles", value: String(n(r, "shuffles")) },
      { label: "Cleared", value: b(r, "cleared") ? sec(n(r, "clearedSeconds")) : "No" },
    ],
    outcome: b(r, "cleared") ? "finish" : "time",
  }),
  // The Sports group (30 Oct 2026; the lines come from the arcade standard's parts).
  minigolf: (r, s) => ({
    axis: { value: n(r, "holed"), max: 5, label: "Holes holed" },
    lines: [`${n(r, "holed")} of 5 holed → ${s}`],
    tiles: [
      { label: "Strokes", value: String(n(r, "strokes")) },
      { label: "At par or better", value: `${n(r, "pars")} / 5` },
      { label: "Under par", value: String(n(r, "birdies")) },
      { label: "In the water", value: String(n(r, "waters")) },
    ],
    outcome: n(r, "holed") >= 5 ? "finish" : "time",
  }),
  pool: (r, s) => ({
    axis: { value: n(r, "spots"), max: 7, label: "Spots potted" },
    lines: [`${n(r, "spots")} of 7 spots → ${s}`],
    tiles: [
      { label: "The black", value: b(r, "black") ? "Potted" : "–" },
      { label: "Best run", value: String(n(r, "streakBest")) },
      { label: "Fouls", value: String(n(r, "fouls")) },
    ],
    outcome: b(r, "black") ? "finish" : "time",
  }),
  curling: (r, s) => ({
    axis: { value: n(r, "onButton"), max: 8, label: "Stones on the button" },
    // curlRev 4: the stones that counted (nearer than every red in the house) too.
    lines: [((r["state"] as { rev?: number } | undefined)?.rev ?? 1) >= 4 ? `${n(r, "onButton")} of 8 on the button · ${n(r, "counted")} counted → ${s}` : `${n(r, "onButton")} of 8 on the button → ${s}`],
    tiles: [
      { label: "In the 4-foot", value: `${n(r, "inFourFoot")} / 8` },
      { label: "Takeouts", value: `${n(r, "takeouts")} / ${n(r, "opponents")}` },
      { label: "Holding shot", value: b(r, "holding") ? "Yes" : "No" },
    ],
    outcome: "finish",
  }),
  pinball: (r, s) =>
    // pinRev 6 (the arcade scoring standard; the lines come from its parts): no multiplier tile, its features instead.
    (r["state"] as { rev6?: number } | undefined)?.rev6
      ? {
          axis: { value: n(r, "points"), max: null, label: "Table points" },
          lines: [`${n(r, "points").toLocaleString("en-GB")} table points → ${s}`],
          tiles: [
            { label: "J-O-U-L-Z", value: String(n(r, "laneSets")) },
            { label: "Multiball", value: String(n(r, "multiballs")) },
            { label: "Jackpots", value: String(n(r, "jackpots")) },
            { label: "Ramps", value: `${n(r, "ramps")} · ${n(r, "combos")} combo${n(r, "combos") === 1 ? "" : "s"}` },
            { label: "Balls left", value: String(n(r, "ballsLeft")) },
          ],
          outcome: n(r, "ballsLeft") > 0 ? "time" : "crash",
        }
      : {
    axis: { value: n(r, "points"), max: null, label: "Table points" },
    lines:
      n(r, "pinRev") >= 4
        ? [`${n(r, "points").toLocaleString("en-GB")} table points · ${n(r, "ramps")} ramps · ${n(r, "multiballs")} multiball · ${n(r, "jackpots")} jackpots → ${s}`]
        : [`${n(r, "points").toLocaleString("en-GB")} table points → ${s}`],
    tiles: [
      ...(n(r, "pinRev") >= 4 ? [{ label: "Ramps", value: `${n(r, "ramps")}${n(r, "bestCombo") > 1 ? ` · combo ×${n(r, "bestCombo")}` : ""}` }, { label: "Jackpots", value: String(n(r, "jackpots")) }] : []),
      { label: "Bumper hits", value: String(n(r, "bumps")) },
      { label: "Targets", value: `${n(r, "drops")}${n(r, "banks") > 0 ? ` · ${n(r, "banks")} bank${n(r, "banks") === 1 ? "" : "s"}` : ""}` },
      { label: "Multiplier", value: `×${Math.max(1, n(r, "mult"))}` },
      { label: "Balls left", value: String(n(r, "ballsLeft")) },
    ],
    outcome: n(r, "ballsLeft") > 0 ? "time" : "crash",
  },
  rally: (r, s) => ({
    axis: { value: n(r, "goldHits"), max: null, label: "Gold-ball hits" },
    lines: [
      ...(n(r, "rallyRev") === 2
        ? [`${n(r, "hits")} hits · ${n(r, "goldHits")} gold · ${n(r, "targetHits")} targets → ${s}`]
        : [`${n(r, "hits")} hits · ${n(r, "goldHits")} gold → ${s}`]),
      // rallyRev 10: the gold bonus targets on top.
      ...(typeof r["bonusHits"] === "number" ? [`Gold targets ${n(r, "bonusHits")} / 6 +${n(r, "bonusPts")}`] : []),
    ],
    tiles: [
      { label: "Gold hits", value: String(n(r, "goldHits")) },
      ...(typeof r["bonusHits"] === "number" ? [{ label: "Gold targets", value: `${n(r, "bonusHits")} / 6` }] : []),
      ...(n(r, "rallyRev") === 2 ? [{ label: "Targets", value: String(n(r, "targetHits")) }] : []),
      { label: "All hits", value: String(n(r, "hits")) },
      { label: "Paddle", value: `${n(r, "paddleWidth")} px` },
    ],
    outcome: ended(r, false),
  }),
  slice: (r, s) => {
    // sliceRev 11 (the arcade scoring standard): the axis is foods cut out of foods thrown, its tiles the parts.
    const st = r["state"] as { v11?: number; foodCut?: number; foodMissed?: number; comboFoods?: number; golds?: number; breadTickets?: number; dodges?: number } | undefined;
    if (st && typeof st === "object" && st.v11) {
      const cut = st.foodCut ?? 0;
      return {
        axis: { value: cut, max: cut + (st.foodMissed ?? 0), label: "Foods sliced" },
        lines: [`${cut} / ${cut + (st.foodMissed ?? 0)} foods → ${s}`],
        tiles: [
          { label: "Combo foods", value: String(st.comboFoods ?? 0) },
          { label: "Golden fruit", value: String(st.golds ?? 0) },
          { label: "Tickets", value: String(st.breadTickets ?? 0) },
          { label: "Dodges", value: String(st.dodges ?? 0) },
          { label: "Chillies", value: String(n(r, "bombsHit")) },
        ],
        outcome: "time",
      };
    }
    return sliceReveal(r, s);
  },
  bubble: (r, s) => {
    // Replay results keep the original board count on state; persisted flat facts
    // also carry startCount. Neither popped nor shots is the starting total.
    const state = r["state"];
    const start = n(r, "startCount") || (state && typeof state === "object" ? n(state as Run, "startCount") : 0);
    const pct = start > 0 ? Math.max(0, Math.min(100, Math.round((100 * (start - n(r, "bubblesLeft"))) / start))) : 0;
    const done = b(r, "cleared");
    return {
      axis: { value: done ? 100 : pct, max: 100, label: "% cleared" },
      lines: [head(done ? "Board cleared" : `${pct}% cleared`, s, done)],
      tiles: [
        { label: "Popped", value: String(n(r, "popped")) },
        { label: "Dropped", value: String(n(r, "dropped")) },
        { label: "Shots", value: String(n(r, "shots")) },
      ],
      outcome: done ? "finish" : ended(r, false),
    };
  },
  beat: (r, s) => ({
    axis: { value: n(r, "hits"), max: n(r, "noteCount"), label: "Notes hit" },
    lines: [`${n(r, "hits")} / ${n(r, "noteCount")} notes → ${s}`],
    tiles: [
      { label: "Perfects", value: String(n(r, "perfect")) },
      { label: "Best combo", value: String(n(r, "maxCombo")) },
      { label: "Holds", value: `${n(r, "holdsDone")} / ${n(r, "holds")}` },
      ...(n(r, "swipes") > 0 ? [{ label: "Swipes", value: `${n(r, "swipesHit")} / ${n(r, "swipes")}` }] : []),
    ],
    outcome: "time",
  }),
  snake: (r, s) => ({
    axis: { value: n(r, "pellets"), max: null, label: "Stars" },
    lines: [`${n(r, "pellets")} stars → ${s}`],
    tiles: [
      { label: "Length", value: String(n(r, "length")) },
      { label: b(r, "survived") ? "Survived" : b(r, "rockHit") ? "Hit a rock at" : "Crashed at", value: b(r, "survived") ? "60 s" : sec(n(r, "endedSeconds")) },
      ...(n(r, "rocks") > 0 ? [{ label: "Rocks dodged", value: String(n(r, "rocksDodged")) }] : []),
    ],
    outcome: ended(r, false),
  }),
  cross: (r, s) => ({
    axis: { value: n(r, "lanes"), max: null, label: "Lanes crossed" },
    lines: [
      `${n(r, "lanes")} lanes × ${CROSS_LANE_POINTS} = ${n(r, "lanes") * CROSS_LANE_POINTS}`,
      `${n(r, "crossings")} crossings × ${CROSS_CROSSING_POINTS} = ${n(r, "crossings") * CROSS_CROSSING_POINTS}`,
      `Total → ${s} · capped at 150`,
    ],
    tiles: [
      { label: "Lanes crossed", value: String(n(r, "lanes")) },
      { label: "Crossings completed", value: String(n(r, "crossings")) },
      { label: "Lives lost", value: String(n(r, "livesLost")) },
    ],
    outcome: ended(r, false),
  }),
  wavefront: (r, s) => {
    if (n(r, "wavRev") > 0) {
      // wavRev 2: five waves, then the boss.
      const killed = n(r, "bossKilled") > 0;
      const waves = WAV_V2_WAVES;
      const bossHp = WAV_BOSS_HP;
      return {
        axis: { value: n(r, "wavesCleared"), max: waves, label: "Waves" },
        lines: [
          `${n(r, "wavesCleared")} / ${waves} waves · ${n(r, "shapesDown")} ships · ${n(r, "armourHits")} armour hits`,
          `Boss: ${n(r, "bossHits")} / ${bossHp} hits${killed ? " · destroyed" : ""} → ${s}`,
        ],
        tiles: [
          { label: "Boss", value: killed ? "Destroyed" : `${n(r, "bossHits")} / ${bossHp}` },
          { label: "Saucers", value: String(n(r, "saucers")) },
          { label: "Lives left", value: String(n(r, "lives")) },
        ],
        outcome: killed ? "finish" : ended(r, false),
      };
    }
    const done = n(r, "wavesCleared") >= 5;
    return {
      axis: { value: n(r, "wavesCleared"), max: 5, label: "Waves" },
      lines: [`${n(r, "wavesCleared")} / 5 waves · ${n(r, "shapesDown")} ships → ${s}`],
      tiles: [
        { label: "Armour hits", value: String(n(r, "armourHits")) },
        { label: "Saucers", value: String(n(r, "saucers")) },
        { label: "Lives left", value: String(n(r, "lives")) },
      ],
      outcome: done ? "finish" : ended(r, false),
    };
  },
  flip: (r, s) => b(r, "flow") ? {
    // flipRev 11 (3 Nov 2026): no stars; clean time, perfect landings, double flips and the longest flow streak.
    axis: { value: Math.round(n(r, "survivedSeconds") * 10) / 10, max: 60, label: "Seconds survived" },
    lines: [`${sec(n(r, "survivedSeconds"))} survived${n(r, "saves") > 0 ? ` · ${n(r, "saves")} saved` : ""} · best streak ${n(r, "streak")} → ${s}`],
    tiles: [
      { label: b(r, "survived") ? "Survived" : "Crashed at", value: b(r, "survived") ? "60 s" : sec(n(r, "survivedSeconds")) },
      { label: "Perfect landings", value: `${n(r, "sweets")} / ${n(r, "sweetsTotal")}` },
      { label: "Best streak", value: String(n(r, "streak")) },
      { label: "Features", value: `+${n(r, "skill")}` },
    ],
    outcome: b(r, "survived") ? "finish" : "crash",
  } : ({
    axis: { value: Math.round(n(r, "survivedSeconds") * 10) / 10, max: 60, label: "Seconds survived" },
    lines: n(r, "starsTotal") > 0
      ? [`${sec(n(r, "survivedSeconds"))} survived + ${n(r, "stars")} stars × 2 → ${s}`]
      : [`${sec(n(r, "survivedSeconds"))} survived → ${s}`],
    tiles: [
      { label: b(r, "survived") ? "Survived" : "Crashed at", value: b(r, "survived") ? "60 s" : sec(n(r, "survivedSeconds")) },
      // flipRev 2 rounds only: stars taken.
      ...(n(r, "starsTotal") > 0 ? [{ label: "Stars", value: `${n(r, "stars")} / ${n(r, "starsTotal")}` }] : []),
      // flipRev 8 rounds only: sweet landings and the skill points.
      // flipRev 10 (the arcade scoring standard): the features' points under "Features" (no skill pay).
      ...(n(r, "sweetsTotal") > 0 ? [{ label: "Sweet landings", value: `${n(r, "sweets")} / ${n(r, "sweetsTotal")}` }, { label: b(r, "std") ? "Features" : "Skill", value: `+${n(r, "skill")}` }] : []),
    ],
    outcome: b(r, "survived") ? "finish" : "crash",
  }),
  junction: (r, s) => ({
    axis: { value: n(r, "cleared"), max: null, label: "Cars cleared" },
    lines: [
      n(r, "junctionRev") > 0
        ? `${n(r, "cleared")} through (${n(r, "busCleared")} buses, ${n(r, "diagCleared")} from the new roads) → ${s}`
        : `${n(r, "cleared")} cars cleared → ${s}`,
    ],
    tiles: [
      ...(n(r, "junctionRev") > 0 ? [{ label: "Buses through", value: String(n(r, "busCleared")) }] : []),
      { label: "Ambulances through", value: String(n(r, "ambThrough")) },
      { label: "Gave up", value: String(n(r, "gaveUp")) },
    ],
    outcome: ended(r, false),
  }),
  inkbridge: (r, s) => {
    const levels = n(r, "levels");
    const total = n(r, "total") || 10;
    const done = levels >= total;
    const rev = n(r, "rev");
    const current = levels < total ? levels + 1 : total;
    let phase = "";
    // Which kind of level the run stopped on, in plain words.
    if (rev >= 3 && levels < total) {
      phase = current <= 4 ? `, stopped on level ${current}: still pot` : current <= 8 ? `, stopped on level ${current}: moving pot` : `, stopped on level ${current}: live drawing`;
    }
    const starLevels = n(r, "starLevels");
    const bonus = 2 * n(r, "stars");
    return {
      axis: { value: levels, max: 10, label: "Levels" },
      lines:
        starLevels > 0
          ? [
              done && s >= 130 ? `10 / 10 levels → 130 · time +${Math.max(0, s - 130 - bonus)}` : `${levels} / ${total} levels${phase} → ${11 * levels}`,
              `${n(r, "stars")} / ${starLevels} gold stars → +${bonus}`,
              `Total → ${s}`,
            ]
          : [head(`${levels} / ${total} levels${phase}`, s, done)],
      tiles: [
        { label: "Levels", value: String(levels) },
        ...(starLevels > 0 ? [{ label: n(r, "silverTotal") > 0 ? "Ink stars" : "Gold stars", value: `${n(r, "stars")} / ${starLevels}` }] : []),
        // inkRev 10 (x200): silver coins and the shamrock.
        ...(n(r, "silverTotal") > 0 ? [{ label: "Silver", value: `${n(r, "silver")} / ${n(r, "silverTotal")}` }, { label: "Shamrock", value: n(r, "shamrock") ? "Yes" : "No" }] : []),
        // inkRev 13: levels potted within their ink par, trick shots and clovers (no stars or silver coins).
        ...(n(r, "cloverTotal") > 0
          ? [
              { label: "Within ink par", value: `${n(r, "parLevels")} / ${levels}` },
              { label: "Trick shots", value: `${n(r, "tricks")} / ${n(r, "cloudLevels")}` },
              { label: "Clovers", value: `${n(r, "shamrock")} / ${n(r, "cloverTotal")}` },
            ]
          : []),
        { label: "Fails", value: String(n(r, "fails")) },
      ],
      outcome: done ? "finish" : "time",
    };
  },
  burst: (r, s) => {
    // burstRev 10 (the arcade scoring standard): the replayed state's parts (the stored result carries them flat).
    const st = (r["state"] && typeof r["state"] === "object" ? r["state"] : null) as BurstState | null;
    const std = st?.std ? burstStdParts(st) : null;
    const flat = typeof r["goldensDealt"] === "number";
    return {
    axis: { value: Math.max(1, n(r, "wave")), max: std || flat ? BURST_V10_WAVES : null, label: "Waves" },
    lines:
      std
        ? [`${n(r, "hits")} of ${std.atoms} atoms ${std.core} · wave clears ${std.clear} · golden ${std.gold}${std.lives > 0 ? ` · lives −${std.lives}` : ""} → ${s}`]
        : flat
        ? [`${n(r, "hits")} of ${n(r, "atoms")} atoms ${n(r, "core")} · wave clears ${n(r, "clearPts")} · golden ${n(r, "goldPts")}${n(r, "lifeCost") > 0 ? ` · lives −${n(r, "lifeCost")}` : ""} → ${s}`]
        : typeof r["cleanWaves"] === "number" || typeof r["quickWaves"] === "number"
        ? [`${n(r, "hits")} atoms · ${n(r, "livesLost")} lives lost · skill +${n(r, "skill")} → ${s}`]
        : n(r, "burstRev") > 0
        ? [
            s === 150 && n(r, "livesLost") === 0
              ? `Full 90 s, no life lost, ${n(r, "cleared")} waves cleared → 150`
              : `${n(r, "hits")} atoms × 2 − ${n(r, "livesLost")} lives × 9 (up to 130) → ${s}`,
          ]
        : [`Wave ${Math.max(1, n(r, "wave"))} · ${n(r, "hits")} atoms → ${s}`],
    tiles: [
      { label: "Atoms", value: String(n(r, "hits")) },
      { label: "Lives lost", value: String(n(r, "livesLost")) },
      // burstRev 8: clean waves and golden atoms.
      // burstRev 9: quick waves (cleared with a time bonus) and golden atoms.
      // burstRev 10: golden atoms of the five dealt (the waves cleared tile below counts of five).
      ...(std && st ? [{ label: "Golden atoms", value: `${burstGoldenCount(st)} / ${BURST_V10_GOLDENS}` }] : flat ? [{ label: "Golden atoms", value: `${n(r, "goldens")} / ${n(r, "goldensDealt")}` }] : []),
      ...(typeof r["quickWaves"] === "number" && !flat ? [{ label: "Quick waves", value: String(n(r, "quickWaves")) }, { label: "Golden atoms", value: `${n(r, "goldens")} / 6` }] : []),
      ...(typeof r["cleanWaves"] === "number" ? [{ label: "Clean waves", value: String(n(r, "cleanWaves")) }, { label: "Golden atoms", value: `${n(r, "goldens")} / 6` }] : []),
      ...(n(r, "burstRev") > 0 ? [{ label: "Waves cleared", value: std || flat ? `${n(r, "cleared")} / ${BURST_V10_WAVES}` : String(n(r, "cleared")) }, { label: "Freezes", value: String(n(r, "freezes")) }] : []),
    ],
    // burstRev 10: clearing all five waves completes the run.
    outcome: ended(r, Boolean(st?.done) || n(r, "done") === 1),
    };
  },
  orbit: (r, s) => {
    const done = b(r, "finished");
    // orbitRev 12: the features taken, on the replay (its `xp`) or as the stored result's flat numbers.
    const xp = (r["xp"] && typeof r["xp"] === "object" ? r["xp"] : r) as Run;
    return {
      axis: { value: n(r, "passed"), max: 40, label: "Planets" },
      lines: [head(done ? "Sun reached" : `${n(r, "passed")} / 40 planets`, s, done)],
      tiles: [
        { label: "Checkpoint planet", value: typeof r["checkpoint"] === "number" && n(r, "checkpoint") >= 0 ? String(n(r, "checkpoint")) : "none" },
        { label: "Planets", value: String(n(r, "captured")) },
        ...(n(r, "holes") > 0 ? [{ label: "Black holes", value: `${n(r, "jumps")} / ${n(r, "holes")} (+${n(r, "skipped")} planets)` }] : []),
        // orbitRev 12 (the expansion to 200): the features taken.
        ...(n(xp, "dustTotal") > 0
          ? [
              { label: "Stardust", value: `${n(xp, "dust")} / ${n(xp, "dustTotal")}` },
              { label: "Slingshots", value: `${n(xp, "slings")} / ${n(xp, "slingsTotal")}` },
              { label: "Fields threaded", value: `${n(xp, "threads")} / ${n(xp, "threadsTotal")}` },
              { label: "Perfect orbits", value: String(n(xp, "perfect")) },
            ]
          : []),
        // orbitRev 14 (the fuel meter): a run that ended with an empty tank says so.
        ...(b(r, "outOfFuel") ? [{ label: "Ended", value: "Out of fuel" }] : []),
      ],
      outcome: done ? "finish" : ended(r, false),
    };
  },
  swing: (r, s) => {
    // swingRev 17 (the sliding hooks and the clean-swing streak): the share of the course on the axis; four parts add up to the stored score.
    if (n(r, "swingRev") >= 17) {
      const done = n(r, "sections") >= n(r, "sectionTotal") && n(r, "sectionTotal") > 0;
      return {
        axis: { value: Math.trunc(n(r, "permille") / 10), max: 100, label: "% of the course" },
        lines: [
          `${Math.trunc(n(r, "permille") / 10)} % of the course · ${n(r, "sections")} / ${n(r, "sectionTotal")} stretches → ${n(r, "basePts")}`,
          `Pars (${n(r, "parsBeaten")} under) +${n(r, "parPts")}`,
          `Gates (${n(r, "gates")} / ${n(r, "gateTotal")}) +${n(r, "gatePts")}`,
          `Clean-swing streak +${n(r, "streakPts")}`,
          `Total → ${s}`,
        ],
        tiles: [
          { label: "Course", value: `${Math.trunc(n(r, "permille") / 10)} %` },
          { label: "Under par", value: `${n(r, "parsBeaten")}` },
          { label: "Restarts", value: `${n(r, "restarts")}` },
          { label: "Gates", value: `${n(r, "gates")} / ${n(r, "gateTotal")}` },
        ],
        outcome: done ? "finish" : ended(r, false),
      };
    }
    // swingRev 15 (the swinging course) and 16 (its dark ledge runs, 90 s): the share of the course on the axis; the three parts add up to the stored score.
    if (n(r, "swingRev") >= 15) {
      const done = n(r, "sections") >= n(r, "sectionTotal") && n(r, "sectionTotal") > 0;
      return {
        axis: { value: Math.trunc(n(r, "permille") / 10), max: 100, label: "% of the course" },
        lines: [
          `${Math.trunc(n(r, "permille") / 10)} % of the course · ${n(r, "sections")} / ${n(r, "sectionTotal")} stretches → ${n(r, "basePts")}`,
          `Pars (${n(r, "parsBeaten")} under) +${n(r, "parPts")}`,
          `Gates, gems, stars (${n(r, "gates")} · ${n(r, "gems")} · ${n(r, "stars")}) +${n(r, "pickupPts")}`,
          `Total → ${s}`,
        ],
        tiles: [
          { label: "Course", value: `${Math.trunc(n(r, "permille") / 10)} %` },
          { label: "Under par", value: `${n(r, "parsBeaten")}` },
          { label: "Restarts", value: `${n(r, "restarts")}` },
          { label: "Gates · gems · stars", value: `${n(r, "gates")} · ${n(r, "gems")} · ${n(r, "stars")}` },
        ],
        outcome: done ? "finish" : ended(r, false),
      };
    }
    // swingRev 14 (the assault course): sections on the axis; the lines add up to the stored score.
    if (n(r, "swingRev") >= 14) {
      const done = n(r, "sections") >= n(r, "sectionTotal") && n(r, "sectionTotal") > 0;
      return {
        axis: { value: n(r, "sections"), max: Math.max(1, n(r, "sectionTotal")), label: "Sections" },
        lines: [
          `Section ${n(r, "sections")} / ${n(r, "sectionTotal")} → ${n(r, "basePts")}`,
          `Pars, gates, gems, stars${done ? ", course cleared" : ""} +${n(r, "bonusPts")}`,
          `Total → ${s}`,
        ],
        tiles: [
          { label: "Sections", value: `${n(r, "sections")} / ${n(r, "sectionTotal")}` },
          { label: "Under par", value: `${n(r, "parsBeaten")}` },
          { label: "Restarts", value: `${n(r, "restarts")}` },
          { label: "Gates · gems · stars", value: `${n(r, "gates")} · ${n(r, "gems")} · ${n(r, "stars")}` },
        ],
        outcome: done ? "finish" : ended(r, false),
      };
    }
    const metres = n(r, "metres");
    const done = metres >= 500;
    return {
      axis: { value: Math.min(500, metres), max: 500, label: "Metres" },
      lines:
        n(r, "swingRev") > 0
          ? [
              `${Math.min(500, metres)} m → ${Math.min(120, Math.round((120 * Math.min(500, metres)) / 500))}`,
              `${n(r, "stars")} / ${n(r, "starTotal")} stars → ${n(r, "stars")}${done ? " · 500 m reached +20" : ""}`,
              `Total → ${s}`,
            ]
          : [head(`${Math.min(500, metres)} m`, s, done)],
      tiles: [
        {
          label: done ? "Finished at" : b(r, "survived") ? "Survived" : n(r, "cause") === 1 ? "Caught at" : "Fell at",
          value: sec(n(r, "survivedSeconds")),
        },
        ...(n(r, "swingRev") > 0 ? [{ label: "Stars", value: `${n(r, "stars")} / ${n(r, "starTotal")}` }] : []),
        // swingRev 13 (the 200 expansion): gems, gates and the set-route sections with their par times.
        ...(n(r, "gemTotal") > 0
          ? [
              { label: "Gems", value: `${n(r, "gems")} / ${n(r, "gemTotal")}` },
              { label: "Speed gates", value: `${n(r, "gates")} / ${n(r, "gateTotal")}` },
              { label: "Sections", value: `${n(r, "sections")} / ${n(r, "sectionTotal")} · ${n(r, "parsBeaten")} under par` },
            ]
          : []),
        ...(n(r, "cause") > 0 ? [{ label: "Ended by", value: ["", "the dragon", "a stalactite", "a lava jet"][n(r, "cause")] ?? "" }] : []),
      ],
      outcome: done ? "finish" : ended(r, false),
    };
  },
  snip: (r, s) => {
    // snipRev 11 (the 200-point expansion): six courses with 1–3 fruits each, golden apples, par cuts and par times.
    if (n(r, "snipRev") >= 11)
      return {
        axis: { value: n(r, "eaten"), max: Math.max(1, n(r, "fruits")), label: "Fruit" },
        lines: [`${n(r, "eaten")} / ${n(r, "fruits")} fruit · ${n(r, "cleared")} / 6 levels · skill +${n(r, "skill")} → ${s}`],
        tiles: [
          { label: "Golden", value: `${n(r, "golden")} / 3` },
          { label: "At par", value: `${n(r, "parLevels")} / 6` },
          { label: "Quick", value: `${n(r, "quickLevels")} / 6` },
          { label: "Leaves", value: String(n(r, "stars") + n(r, "stars2")) },
        ],
        outcome: n(r, "cleared") >= 6 ? "finish" : "time",
      };
    const done = n(r, "eaten") >= 10;
    return {
      axis: { value: n(r, "eaten"), max: 10, label: "Apples" },
      lines: [`${n(r, "eaten")} apples × 10 · ${n(r, "stars")} leaves × 3${done ? ` · time +${Math.max(0, s - 10 * n(r, "eaten") - 3 * n(r, "stars"))}` : ""} → ${s}`],
      tiles: [
        { label: "Leaves", value: String(n(r, "stars")) },
        { label: "Cuts", value: String(n(r, "cuts")) },
      ],
      outcome: done ? "finish" : "time",
    };
  },
  tilt: (r, s) => {
    // tiltRev 8 (the expansion, docs/expansions/x200-tilt.md): three mazes and quick stars; tiltRev 10 four mazes again.
    const all = n(r, "tiltRev") === 8 || n(r, "tiltRev") === 9 ? 3 : 4;
    const done = n(r, "mazes") >= all;
    const quick = n(r, "totalQuick") > 0;
    // tiltRev 11: no gold stars; mazes within par and a clean run instead.
    if (n(r, "tiltRev") >= 11)
      return {
        axis: { value: n(r, "mazes"), max: all, label: "Mazes" },
        lines: [`${n(r, "mazes")} / ${all} mazes · ${n(r, "parsMet")} under par · ${n(r, "falls") > 0 ? `clean for ${n(r, "cleanMazes")}` : "clean run"} → ${s}`],
        tiles: [
          { label: "Mazes", value: `${n(r, "mazes")} / ${all}` },
          { label: "Under par", value: `${n(r, "parsMet")} / ${all}` },
          { label: "Falls", value: String(n(r, "falls")) },
          { label: "Time", value: sec(n(r, "survivedSeconds")) },
        ],
        outcome: done ? "finish" : ended(r, false),
      };
    return {
      axis: { value: n(r, "mazes"), max: all, label: "Mazes" },
      lines: [n(r, "tiltRev") > 0 ? `${n(r, "mazes")} / ${all} mazes · ${n(r, "stars")} / ${n(r, "totalStars")} stars${quick ? ` · ${n(r, "quickStars")} / ${n(r, "totalQuick")} quick stars` : ""} → ${s}` : head(`${n(r, "mazes")} / 4 mazes`, s, done)],
      tiles: [
        { label: "Mazes", value: `${n(r, "mazes")} / ${all}` },
        ...(n(r, "tiltRev") > 0 ? [{ label: "Stars", value: `${n(r, "stars")} / ${n(r, "totalStars")}` }] : []),
        ...(quick ? [{ label: "Quick stars", value: `${n(r, "quickStars")} / ${n(r, "totalQuick")}` }] : []),
        { label: b(r, "caught") ? "Caught at" : b(r, "survived") ? "Time" : "Pit at", value: sec(n(r, "survivedSeconds")) },
      ],
      outcome: done ? "finish" : ended(r, false),
    };
  },
  balltrack: (r, s) => {
    // btRev 7 drops 36 marbles (every earlier course 30): the replay's own state says which.
    const all = (r["state"] as { r7?: number } | undefined)?.r7 ? BT_V7_BALLS : BT_BALLS;
    const done = n(r, "home") >= all;
    return {
      axis: { value: n(r, "home"), max: all, label: "Marbles home" },
      lines: [head(`${n(r, "home")} / ${all} home`, s, done)],
      tiles: [
        { label: "Marbles home", value: `${n(r, "home")} / ${all}` },
        { label: "Wrong tray", value: String(n(r, "wrong")) },
        { label: "Lost", value: String(n(r, "lost")) },
      ],
      outcome: done ? "finish" : "time",
    };
  },
  whack: (r, s) => {
    // whackRev 1 (lifted) and 2 (banded): these are the run's total before it becomes the score, not score points.
    const mapped = rawTotalMapped(r);
    const penalties = [
      n(r, "wrong") > 0 ? `−${3 * n(r, "wrong")} wrong` : "",
      n(r, "bombs") > 0 ? `−${5 * n(r, "bombs")} hedgehogs` : "",
      n(r, "empty") > 0 ? `−${3 * n(r, "empty")} empty` : "",
      b(r, "perfect") ? "+15 all targets" : "",
    ].filter(Boolean);
    return {
      axis: { value: n(r, "hits"), max: n(r, "totalTargets"), label: "Hits" },
      lines: [
        `${n(r, "hits")} / ${n(r, "totalTargets")} hits → ${s}`,
        ...(penalties.length ? [mapped ? `Total ${penalties.join(" · ")}` : penalties.join(" · ")] : []),
        // whackRev 3 (depth to 200): the features' points past the hits' 150.
        ...whackDepthLine(r),
      ],
      tiles: [
        { label: "Wrong colour", value: String(n(r, "wrong")) },
        { label: "Hedgehogs", value: String(n(r, "bombs")) },
        { label: "Empty taps", value: String(n(r, "empty")) },
      ],
      outcome: "time",
    };
  },
  clayshoot: (r, s) => ({
    axis: { value: n(r, "hits"), max: n(r, "total") || 25, label: "Clays" },
    lines: [
      `${n(r, "hits")} / ${n(r, "total")} clays → ${s}`,
      ...(n(r, "birdTotal") > 0
        ? [`${n(r, "birdHits")} bird${n(r, "birdHits") === 1 ? "" : "s"} hit · −${n(r, "birdHits") * 10}${rawTotalMapped(r) ? " from the total" : ""}`]
        : []),
      // clayRev 9 (depth to 200): the features' points past the clays' 150.
      ...clayDepthLine(r),
    ],
    tiles: [
      { label: "Gold", value: String(n(r, "goldHits")) },
      { label: "Orange", value: String(n(r, "orangeHits")) },
      ...(n(r, "birdTotal") > 0 ? [{ label: "Birds hit", value: String(n(r, "birdHits")) }] : []),
      { label: "Shots", value: String(n(r, "shots")) },
    ],
    outcome: b(r, "perfect") ? "finish" : "time",
  }),
  wordfall: (r, s) => {
    const best = Array.isArray(r["best"]) ? (r["best"] as unknown[]).map(String).slice(0, 5) : [];
    const par = n(r, "par") || WF_PAR;
    return {
      axis: { value: Math.min(n(r, "points"), par), max: par, label: "Word points" },
      lines: [
        `${n(r, "points")} / ${par} word points → ${s}`,
        best.length ? `Best: ${best.join(" · ")}` : "No words found",
        ...(b(r, "overflow") ? [`A column overflowed at ${sec(n(r, "endedSeconds"))}`] : []),
      ],
      tiles: [
        { label: "Words", value: String(n(r, "words")) },
        { label: "Longest", value: n(r, "longest") ? `${n(r, "longest")} letters` : "—" },
        { label: b(r, "overflow") ? "Overflowed" : "Survived", value: b(r, "overflow") ? sec(n(r, "endedSeconds")) : "90 s" },
      ],
      outcome: n(r, "points") >= par ? "finish" : b(r, "overflow") ? "crash" : "time",
    };
  },
  tendrop: (r, s) => {
    const done = n(r, "cleared") >= 10;
    return {
      axis: { value: n(r, "cleared"), max: 10, label: "Targets" },
      lines: [`${n(r, "cleared")} / 10 targets → ${s}`],
      tiles: [
        { label: "Targets", value: `${n(r, "cleared")} / 10` },
        { label: "Resets", value: String(n(r, "resets")) },
        // tenRev 4: tens made by the gold tile.
        ...("goldTens" in (r as object) ? [{ label: "Gold tens", value: String(n(r, "goldTens")) }] : []),
      ],
      outcome: done ? "finish" : "time",
    };
  },
  stroop: (r, s) => {
    // Fixed-queue rounds: correct / N, wrong and the completion-only time bonus.
    // clashRev 4 (puzzle score shape): a finish is all sorted with at most 2 wrong = 120 + the time bonus
    // (−5 per wrong from it); otherwise 110 × correct ÷ N − 2 per wrong. The bonus is the stored one.
    // clashRev 8 (depth to 200): the same lines, then the gold, streak and speed-stretch points a finish added.
    const depth = (r as { depth?: { base: number; gold: number; streak: number; stretch: number; best: number; golds: number; goldWords: number; touched: number; standard?: boolean } }).depth;
    // clashRev 10 (the scoring standard): 150 + speed + streak + gold, or the share of words right less wrong plus both.
    if (depth?.standard && n(r, "queue") > 0) {
      const done = b(r, "finished");
      const sorted = n(r, "correct") + n(r, "wrong") >= n(r, "queue");
      return {
        axis: { value: n(r, "correct"), max: n(r, "queue"), label: "Correct" },
        lines: [
          `${n(r, "correct")} / ${n(r, "queue")} correct → ${s}`,
          done ? `${n(r, "wrong")} wrong · finish ${depth.base} · speed +${depth.stretch}` : `${n(r, "wrong")} wrong · ${Math.max(0, n(r, "net"))} net → ${depth.base} · ${sorted ? "more than 3 wrong" : "not all sorted"}`,
          `streak +${depth.streak} (best ${depth.best}) · gold +${depth.gold} (${depth.golds}/${depth.goldWords})`,
        ],
        tiles: [
          { label: "Correct", value: `${n(r, "correct")} / ${n(r, "queue")}` },
          { label: "Best streak", value: String(depth.best) },
          { label: "Bonus", value: `+${depth.gold + depth.streak}` },
        ],
        outcome: done ? "finish" : "time",
      };
    }
    if (depth && n(r, "queue") > 0) {
      const done = b(r, "finished");
      const sorted = n(r, "correct") + n(r, "wrong") >= n(r, "queue");
      const bonus = depth.gold + depth.streak + depth.stretch;
      return {
        axis: { value: n(r, "correct"), max: n(r, "queue"), label: "Correct" },
        lines: [
          `${n(r, "correct")} / ${n(r, "queue")} correct → ${s}`,
          done ? `${n(r, "wrong")} wrong · finish ${n(r, "finishBase")} · time bonus +${n(r, "timeBonus")}` : `${n(r, "wrong")} wrong · ${Math.max(0, n(r, "net"))} net · ${sorted ? "more than 3 wrong" : "not all sorted"}`,
          done ? `gold +${depth.gold} · streak +${depth.streak} · speed +${depth.stretch}` : `best streak ${depth.best} · gold ${depth.golds}/${depth.goldWords}`,
        ],
        tiles: [
          { label: "Correct", value: `${n(r, "correct")} / ${n(r, "queue")}` },
          { label: "Best streak", value: String(depth.best) },
          { label: "Bonus", value: done ? `+${bonus}` : "—" },
        ],
        outcome: done ? "finish" : "time",
      };
    }
    if (n(r, "queue") > 0 && "finishBase" in (r as object)) {
      const done = b(r, "finished");
      const sorted = n(r, "correct") + n(r, "wrong") >= n(r, "queue");
      return {
        axis: { value: n(r, "correct"), max: n(r, "queue"), label: "Correct" },
        lines: [
          `${n(r, "correct")} / ${n(r, "queue")} correct → ${s}`,
          done ? `${n(r, "wrong")} wrong · finish ${n(r, "finishBase")}` : "net" in (r as object) ? `${n(r, "wrong")} wrong · ${Math.max(0, n(r, "net"))} net` : `${n(r, "wrong")} wrong × −2`,
          done ? `time bonus +${n(r, "timeBonus")}` : sorted ? "time bonus — more than 2 wrong" : "time bonus — not all sorted",
        ],
        tiles: [
          { label: "Correct", value: `${n(r, "correct")} / ${n(r, "queue")}` },
          { label: "Wrong", value: String(n(r, "wrong")) },
          { label: "Time bonus", value: done ? `+${n(r, "timeBonus")}` : "—" },
        ],
        outcome: done ? "finish" : "time",
      };
    }
    if (n(r, "queue") > 0) {
      const done = b(r, "finished");
      return {
        axis: { value: n(r, "correct"), max: n(r, "queue"), label: "Correct" },
        lines: [
          `${n(r, "correct")} / ${n(r, "queue")} correct → ${s}`,
          `${n(r, "wrong")} wrong × −2`,
          done ? `time bonus +${n(r, "timeBonus")}` : "time bonus — not all sorted",
        ],
        tiles: [
          { label: "Correct", value: `${n(r, "correct")} / ${n(r, "queue")}` },
          { label: "Wrong", value: String(n(r, "wrong")) },
          { label: "Time bonus", value: done ? `+${n(r, "timeBonus")}` : "—" },
        ],
        outcome: done ? "finish" : "time",
      };
    }
    return {
      axis: { value: n(r, "correct"), max: n(r, "total"), label: "Correct" },
      lines: [`${n(r, "correct")} / ${n(r, "total")} correct → ${s}`],
      tiles: [
        { label: "Wrong", value: String(n(r, "wrong")) },
        { label: "Missed", value: String(n(r, "missed")) },
      ],
      outcome: n(r, "correct") >= n(r, "total") && n(r, "total") > 0 ? "finish" : "time",
    };
  },
};

export const ARCADE_REVEAL_TYPES = Object.keys(BUILDERS);

/** Builds the stored reveal summary from the server's replay result and its score. */
/** clayRev 7 and whackRev 1–2: the run's total goes through a curve, so its costs are not score points. */
function rawTotalMapped(r: Run): boolean {
  const state = r["state"] as { sb?: number; tgt?: number } | undefined;
  return Boolean(state && typeof state === "object" && (state.sb || state.tgt));
}

export function buildArcadeReveal(type: string, run: unknown, score: number): ArcadeRevealData | null {
  const builder = BUILDERS[type];
  if (!builder || !run || typeof run !== "object") return null;
  if (type === "bastion" && (run as Run)["std"] !== true) return null;
  const data = builder(run as Run, score);
  // The arcade scoring standard (arcadeStandard.ts): one line per part (core, then each feature) and the total.
  const std = arcadeStdParts(type, (run as Run)["state"]);
  if (std) return { ...data, lines: stdLines(std, score, Boolean(((run as Run)["state"] as { acted?: number }).acted)) };
  // Oct 2026 score-band rounds: same axis and tiles, breakdown lines from the band rules.
  const state = (run as Run)["state"] as { band?: number; acted?: number } | undefined;
  const band = BAND_SPECS[type];
  if (band && state && typeof state === "object" && state.band) return { ...data, lines: bandLines(band.parts(state), score, Boolean(state.acted)) };
  return data;
}
