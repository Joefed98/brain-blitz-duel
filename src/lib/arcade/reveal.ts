/**
 * The arcade answer-reveal summary, built on the SERVER from its own replay and
 * stored on round_results.extra.reveal. The phone only displays it, so the
 * axis value, the breakdown lines and the stat tiles always describe the same
 * replay that produced round_results.score.
 */

import { CROSS_LANE_POINTS, CROSS_CROSSING_POINTS } from "./cross";
import { BT_BALLS } from "./ballTrack";
import { MATCHUP_PAR_RAW } from "./matchup";

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
const sec = (value: number): string => `${value.toFixed(1)} s`;

/** "x / y things → score", splitting the completion score into 130 + time when finished. */
function head(text: string, score: number, complete: boolean): string {
  return complete && score >= 130 ? `${text} → 130 · time +${score - 130}` : `${text} → ${score}`;
}

function ended(run: Run, complete: boolean): ArcadeRevealData["outcome"] {
  if (complete) return "finish";
  if (run["survived"] === false) return "crash";
  return "time";
}

type Builder = (run: Run, score: number) => ArcadeRevealData;

const BUILDERS: Record<string, Builder> = {
  hover: (r, s) => {
    const done = n(r, "gates") >= n(r, "totalGates") && n(r, "totalGates") > 0;
    return {
      axis: { value: n(r, "gates"), max: n(r, "totalGates"), label: "Barriers passed" },
      lines: [`${n(r, "gates")} / ${n(r, "totalGates")} barriers → ${s}`],
      tiles: [
        { label: "Barriers", value: String(n(r, "gates")) },
        { label: b(r, "survived") ? "Survived" : "Crashed at", value: b(r, "survived") ? "60 s" : sec(n(r, "endedSeconds")) },
      ],
      outcome: done ? "finish" : ended(r, false),
    };
  },
  skyline: (r, s) => ({
    axis: { value: n(r, "blocks"), max: null, label: "Blocks stacked" },
    lines: [`${n(r, "blocks")} blocks · ${n(r, "perfects")} perfect → ${s}`],
    tiles: [
      { label: "Blocks", value: String(n(r, "blocks")) },
      { label: "Perfect drops", value: String(n(r, "perfects")) },
    ],
    outcome: ended(r, false),
  }),
  bintoss: (r, s) => {
    const done = n(r, "baskets") >= 10;
    return {
      axis: { value: n(r, "baskets"), max: 10, label: "Buckets" },
      lines: [head(`${n(r, "baskets")} / 10 buckets`, s, done)],
      tiles: [
        { label: "Buckets", value: `${n(r, "baskets")} / 10` },
        { label: "Throws", value: String(n(r, "throws")) },
      ],
      outcome: done ? "finish" : "time",
    };
  },
  bullseye: (r, s) => ({
    axis: { value: n(r, "total"), max: 100, label: "Ring total" },
    lines: [`${n(r, "total")} / 100 rings → ${s}`],
    tiles: [
      { label: "Bullseyes", value: String(n(r, "inner")) },
      { label: "Darts", value: String(n(r, "arrows")) },
    ],
    outcome: b(r, "finished") ? "finish" : "time",
  }),
  matchup: (r, s) => ({
    axis: { value: n(r, "raw"), max: MATCHUP_PAR_RAW, label: "Match points" },
    lines: [`${n(r, "raw").toLocaleString("en-GB")} match points → ${s}`],
    tiles: [
      { label: "Best line", value: String(n(r, "bestLine")) },
      { label: "Cascades", value: String(n(r, "cascades")) },
      { label: "Swaps", value: String(n(r, "swaps")) },
    ],
    outcome: "time",
  }),
  breaker: (r, s) => {
    const done = b(r, "cleared");
    return {
      axis: { value: n(r, "destroyed"), max: 80, label: "Bricks" },
      lines: [head(`${n(r, "destroyed")} / 80 bricks`, s, done)],
      tiles: [
        { label: "Power-ups", value: String(n(r, "powerUps")) },
        { label: "Balls lost", value: String(n(r, "losses")) },
        { label: "Brick hits", value: String(n(r, "totalHits")) },
      ],
      outcome: done ? "finish" : n(r, "bricksLeft") > 0 && n(r, "endedSeconds") < 90 ? "crash" : "time",
    };
  },
  rally: (r, s) => ({
    axis: { value: n(r, "goldHits"), max: null, label: "Gold-ball hits" },
    lines: [`${n(r, "hits")} hits · ${n(r, "goldHits")} gold → ${s}`],
    tiles: [
      { label: "Gold hits", value: String(n(r, "goldHits")) },
      { label: "All hits", value: String(n(r, "hits")) },
      { label: "Paddle", value: `${n(r, "paddleWidth")} px` },
    ],
    outcome: ended(r, false),
  }),
  slice: (r, s) => ({
    axis: { value: n(r, "slices"), max: n(r, "totalDiscs"), label: "Foods sliced" },
    lines: [
      `${n(r, "slices")} / ${n(r, "totalDiscs")} foods → ${s}`,
      ...(n(r, "bombsHit") > 0 ? [`−10 × ${n(r, "bombsHit")} ${n(r, "bombsHit") === 1 ? "chilli" : "chillies"}`] : []),
    ],
    tiles: [
      { label: "Best combo", value: `×${n(r, "bestMult")}` },
      { label: "Ketchup / mustard", value: String(n(r, "bonuses")) },
      { label: "Chillies", value: String(n(r, "bombsHit")) },
    ],
    outcome: "time",
  }),
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
  flip: (r, s) => ({
    axis: { value: Math.round(n(r, "survivedSeconds") * 10) / 10, max: 60, label: "Seconds survived" },
    lines: [`${sec(n(r, "survivedSeconds"))} survived → ${s}`],
    tiles: [{ label: b(r, "survived") ? "Survived" : "Crashed at", value: b(r, "survived") ? "60 s" : sec(n(r, "survivedSeconds")) }],
    outcome: b(r, "survived") ? "finish" : "crash",
  }),
  junction: (r, s) => ({
    axis: { value: n(r, "cleared"), max: null, label: "Cars cleared" },
    lines: [`${n(r, "cleared")} cars cleared → ${s}`],
    tiles: [
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
    if (rev === 3 && levels < total) {
      phase = current <= 4 ? " (Standard)" : current <= 8 ? " (Moving Pot)" : " (Live)";
    }
    return {
      axis: { value: levels, max: 10, label: "Levels" },
      lines: [head(`${levels} / ${total} levels${phase}`, s, done)],
      tiles: [
        { label: "Levels", value: String(levels) },
        { label: "Fails", value: String(n(r, "fails")) },
      ],
      outcome: done ? "finish" : "time",
    };
  },
  burst: (r, s) => ({
    axis: { value: Math.max(1, n(r, "wave")), max: null, label: "Waves" },
    lines: [`Wave ${Math.max(1, n(r, "wave"))} · ${n(r, "hits")} atoms → ${s}`],
    tiles: [
      { label: "Atoms", value: String(n(r, "hits")) },
      { label: "Lives lost", value: String(n(r, "livesLost")) },
    ],
    outcome: ended(r, false),
  }),
  orbit: (r, s) => {
    const done = b(r, "finished");
    return {
      axis: { value: n(r, "passed"), max: 40, label: "Planets" },
      lines: [head(done ? "Sun reached" : `${n(r, "passed")} / 40 planets`, s, done)],
      tiles: [
        { label: "Checkpoint planet", value: typeof r["checkpoint"] === "number" && n(r, "checkpoint") >= 0 ? String(n(r, "checkpoint")) : "none" },
        { label: "Planets", value: String(n(r, "captured")) },
      ],
      outcome: done ? "finish" : ended(r, false),
    };
  },
  swing: (r, s) => {
    const metres = n(r, "metres");
    const done = metres >= 500;
    return {
      axis: { value: Math.min(500, metres), max: 500, label: "Metres" },
      lines: [head(`${Math.min(500, metres)} m`, s, done), ...(n(r, "dragonTotal") > 0 ? ["Watch out for dragons near the end."] : [])],
      tiles: [{ label: done ? "Finished at" : b(r, "survived") ? "Survived" : "Fell at", value: sec(n(r, "survivedSeconds")) }],
      outcome: done ? "finish" : ended(r, false),
    };
  },
  snip: (r, s) => {
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
    const done = n(r, "mazes") >= 4;
    return {
      axis: { value: n(r, "mazes"), max: 4, label: "Mazes" },
      lines: [head(`${n(r, "mazes")} / 4 mazes`, s, done)],
      tiles: [
        { label: "Mazes", value: `${n(r, "mazes")} / 4` },
        { label: b(r, "caught") ? "Caught at" : b(r, "survived") ? "Time" : "Pit at", value: sec(n(r, "survivedSeconds")) },
      ],
      outcome: done ? "finish" : ended(r, false),
    };
  },
  balltrack: (r, s) => {
    const done = n(r, "home") >= BT_BALLS;
    return {
      axis: { value: n(r, "home"), max: BT_BALLS, label: "Marbles home" },
      lines: [head(`${n(r, "home")} / ${BT_BALLS} home`, s, done)],
      tiles: [
        { label: "Marbles home", value: `${n(r, "home")} / ${BT_BALLS}` },
        { label: "Wrong tray", value: String(n(r, "wrong")) },
        { label: "Lost", value: String(n(r, "lost")) },
      ],
      outcome: done ? "finish" : "time",
    };
  },
  whack: (r, s) => {
    const penalties = [
      n(r, "wrong") > 0 ? `−${3 * n(r, "wrong")} wrong` : "",
      n(r, "bombs") > 0 ? `−${5 * n(r, "bombs")} hedgehogs` : "",
      n(r, "empty") > 0 ? `−${3 * n(r, "empty")} empty` : "",
      b(r, "perfect") ? "+15 all targets" : "",
    ].filter(Boolean);
    return {
      axis: { value: n(r, "hits"), max: n(r, "totalTargets"), label: "Hits" },
      lines: [`${n(r, "hits")} / ${n(r, "totalTargets")} hits → ${s}`, ...(penalties.length ? [penalties.join(" · ")] : [])],
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
      ...(n(r, "birdTotal") > 0 ? [`${n(r, "birdHits")} bird${n(r, "birdHits") === 1 ? "" : "s"} hit · −${n(r, "birdHits") * 10}`] : []),
    ],
    tiles: [
      { label: "Gold", value: String(n(r, "goldHits")) },
      { label: "Orange", value: String(n(r, "orangeHits")) },
      ...(n(r, "birdTotal") > 0 ? [{ label: "Birds hit", value: String(n(r, "birdHits")) }] : []),
      { label: "Shots", value: String(n(r, "shots")) },
    ],
    outcome: b(r, "perfect") ? "finish" : "time",
  }),
  tendrop: (r, s) => {
    const done = n(r, "cleared") >= 10;
    return {
      axis: { value: n(r, "cleared"), max: 10, label: "Targets" },
      lines: [`${n(r, "cleared")} / 10 targets → ${s}`],
      tiles: [
        { label: "Targets", value: `${n(r, "cleared")} / 10` },
        { label: "Resets", value: String(n(r, "resets")) },
      ],
      outcome: done ? "finish" : "time",
    };
  },
  stroop: (r, s) => {
    // Fixed-queue rounds: correct / N, wrong and the completion-only time bonus.
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
export function buildArcadeReveal(type: string, run: unknown, score: number): ArcadeRevealData | null {
  const builder = BUILDERS[type];
  if (!builder || !run || typeof run !== "object") return null;
  return builder(run as Run, score);
}
