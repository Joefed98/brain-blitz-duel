import type { BtCourse } from "@/lib/arcade/ballTrack";
import type { OrbitExtrasRow, OrbitHoleRow, OrbitRev3CompactPlanet } from "@/lib/arcade/orbitRev3";
import type { RemovedPuzzleType } from "./removedGames";
export type PuzzleType =
  | "wordsmith"
  | "target"
  | "reaction"
  | "equation"
  | "stroop"
  | "symscan"
  | "numhunt"
  | "spotdiff"
  | "stopwatch"
  | "countup"
  | "wordhunt"
  | "balance"
  | "tilegrid"
  | "wordslide"
  | "unblock"
  | "blockparty"
  | "lightsout"
  | "pipes"
  | "sudoku"
  | "flow"
  | "iceslide"
  | "push"
  | "laser"
  | "tower"
  | "maze"
  | "tubes"
  | "safe"
  | "bomb"
  | "gravity"
  | "chain"
  | "nonogram"
  | "pairmatch"
  | "flood"
  | "tiles"
  | "rings"
  | "hover"
  | "swerve"
  | "skyline"
  | "bintoss"
  | "bullseye"
  | "matchup"
  | "snake"
  | "cross"
  | "dual"
  | "ricochet"
  | "breaker"
  | "rally"
  | "steady"
  | "slice"
  | "bubble"
  | "beat"
  | "whack"
  | "tents"
  | "shikaku"
  | "lightup"
  | "wavefront"
  | "bastion"
  | "rooftop"
  | "flip"
  | "junction"
  | "inkbridge"
  | "burst"
  | "orbit"
  | "swing"
  | "tilt"
  | "hotfloor"
  | "balltrack"
  | "wordsearch"
  | "tendrop"
  | "wordfall"
  | "clayshoot"
  | "numpyramid"
  | "trail"
  | "dig"
  | "letterwheel"
  | "strikeout"
  | "codeword"
  | "swapword"
  | "snip"
  | "measure"
  | "checkout"
  | "numline"
  | "pinball"
  | "minesweeper"
  | "mahjong"
  | "homerun"
  | "freekick"
  | "racing"
  | "freecell"
  | "tripeaks"
  | "pokersquares"
  | "fivehands"
  | "minigolf"
  | "pool"
  | "curling";

/** A type id as stored rooms hold it: a live type, or a game deleted since (removedGames.ts). */
export type StoredPuzzleType = PuzzleType | RemovedPuzzleType;

export type PuzzleCategory =
  "word" | "number" | "speed" | "attention" | "pattern" | "logic" | "arcade";

/** Wordsmith: variable ring with the required centre retained at its legacy index. */
export const WORDSMITH_TIME_MS = 100_000;
export const WORDSMITH_MIN_LENGTH = 4;
export const WORDSMITH_LETTERS = 9;
export const WORDSMITH_SIZES = [8, 9, 10, 11] as const;
/** Stable index preserves old rounds and the fixed nine-letter example. */
export const WORDSMITH_CENTRE_INDEX = 4;
/** Inclusive possible-word bounds for each generated puzzle size. */
export const WORDSMITH_WORD_RANGES = {
  8: { min: 25, max: 60 },
  9: { min: 30, max: 80 },
  10: { min: 40, max: 100 },
  11: { min: 50, max: 120 },
} as const;
/** Par is this share of every point available on the board. */
export const WORDSMITH_PAR_SHARE = 0.35;
const WORDSMITH_POINTS: Record<number, number> = { 4: 1, 5: 2, 6: 4, 7: 7, 8: 11, 9: 15 };

export function wordsmithPoints(word: string): number {
  return WORDSMITH_POINTS[Math.min(9, word.trim().length)] ?? 0;
}

export interface WordsmithWord {
  word: string;
  points: number;
}

export interface WordsmithPuzzleData {
  type: "wordsmith";
  /** Nine letters, row-major 3×3; letters[4] is the centre. */
  letters: string[];
  /** Public: how many valid words the board allows. */
  wordCount?: number;
  /** Server-side only until the reveal: every word the board allows. */
  words?: WordsmithWord[];
  totalPoints?: number;
  par?: number;
  /** The nine-letter word (hidden until the reveal). */
  source?: string;
  /** Scoring targets (18 Oct 2026): 1 = word points on WORDSMITH_V1_CURVE; absent = 2.5 × points. */
  wordsmithRev?: number;
}

/** One combining step: two values and an operator, giving a new value. */
export interface TargetStep {
  a: number;
  b: number;
  operator: Operator;
  result: number;
}

export interface TargetNumberPuzzleData {
  type: "target";
  /** Number depth to 200 (numberDepth.ts, 25 Oct 2026): 1 = scored to 200; absent on rounds dealt before. */
  depthRev?: number;
  /** The six starting tiles, in the order both players see them. */
  tiles: number[];
  /** The three-digit number to reach exactly. */
  target: number;
  /** One valid solution, kept server-side until the reveal. */
  solution: TargetStep[];
}

export type SpotShapeKind = "circle" | "square" | "triangle" | "star" | "hexagon" | "arrow";

/** One shape in a Spot the Difference scene, placed on an 8x5 grid. */
export interface SpotShape {
  /** Cell index, 0 .. SPOT_CELLS - 1. */
  cell: number;
  kind: SpotShapeKind;
  colour: StroopColour;
  /** Quarter turn, 0 or 90 (arrows and triangles only). */
  rot?: number;
  /** Mirrored horizontally (arrows and triangles only). */
  flip?: boolean;
  /** spotRev 2: drawn a little smaller (the hidden seventh difference; depth/doubleTake.ts). */
  small?: boolean;
}

export type SpotDifferenceKind = "colour" | "turn" | "kind" | "size";

export interface SpotDifference {
  kind: SpotDifferenceKind;
  /** The cells that count as this difference — two when a shape moved. */
  cells: number[];
  label: string;
  /** spotRev 1: which picture (0 sweet shop, 1 rock pool); absent = picture 0. */
  scene?: number;
}

export interface SpotPuzzleData {
  type: "spotdiff";
  /** Picture 1 (the sweet shop). */
  top: SpotShape[];
  bottom: SpotShape[];
  /**
   * Server-side only until the reveal: the six differences (stored rounds), or on
   * `spotRev: 1` the twelve, each tagged with its picture (`scene` 0 or 1).
   */
  differences?: SpotDifference[];
  /** Two-picture revision (14 Oct 2026): 1 = the sweet shop, then the rock pool, 60 s. */
  spotRev?: number;
  /** spotRev 1: picture 2 (the rock pool), drawn from the same shape kinds. */
  reef?: { top: SpotShape[]; bottom: SpotShape[] };
  /** spotRev 1 carries its own 60 s clock; stored rounds use SPOT_TIME_MS. */
  timeLimitMs?: number;
  /**
   * spotRev 2: the hidden seventh difference (a shape drawn smaller in one panel), in one of the two pictures
   * (`scene`). Server-side only until the reveal, like `differences`; never counted in the twelve.
   */
  bonus?: SpotDifference;
}

export interface ReactionPuzzleData {
  type: "reaction";
  /** When each gold flash starts, in ms from the round start (generated once). */
  flashes: number[];
  /**
   * Seeded decoy pulses before the gold flashes: start time and colour. `tapRev: 3`
   * (14 Oct 2026) adds gold-like decoys: near-gold amber, a gold border only, the
   * word GOLD on a dark screen and a half-screen gold (REACTION_GOLD_LIKE_DECOYS).
   */
  decoys: { at: number; color: ReactionDecoyColour }[];
  /** Tap-log answers (tapLog.ts TAP_REV); unstamped rounds keep per-flash summaries. */
  tapRev?: number;
}

export type Operator = "+" | "-" | "×" | "÷";

export interface EquationStage {
  numbers: number[];
  target: number;
}

export interface EquationPuzzleData {
  type: "equation";
  /** Number depth to 200 (numberDepth.ts, 25 Oct 2026): 1 = scored to 200; absent on rounds dealt before. */
  depthRev?: number;
  /** Four equations of three, four, five and five numbers. */
  stages: EquationStage[];
  /** Server-side only until reveal: the one operator set per stage. */
  operators?: Operator[][];
  /** Try limit revision (moveLimits.ts, 13 Oct 2026): 1 = `tryLimit` full wrong tries per equation, recorded in the answer. Absent = no limit. */
  equationRev?: number;
  /** Full operator sets a player may try on each equation (equationRev 1). */
  tryLimit?: number;
}

export const EQUATION_TIME_MS = 90_000;
export const EQUATION_STAGE_POINTS = [25, 30, 35, 40] as const;
export const EQUATION_STAGE_COUNT = 4;
export const EQUATION_SPEED_POINTS = 20;

export type StroopColour =
  "RED" | "BLUE" | "GREEN" | "PURPLE" | "PINK" | "ORANGE" | "BROWN" | "YELLOW";

/** Which colour the player must tap for an item. */
export type StroopInstruction = "ink" | "word";

export interface StroopItem {
  word: StroopColour;
  /** Always different from `word`. */
  ink: StroopColour;
  /** Read this to know which swatch counts as correct. */
  instruction: StroopInstruction;
}

export interface StroopPuzzleData {
  type: "stroop";
  /** Draws the full sorting stream — identical for everyone. */
  seed: number;
  /** Fixed queue length (current rounds); absent = legacy open-ended 60 s stream. */
  queue?: number;
  /** Rules revision (3 = 75 s, five phases; 4 = the puzzle score shape; 5 = the taller 390 × 650 board and the gentler finish; 6–7 score maps; 8 = depth to 200: streak, "don't sort" and gold words); absent = older rules by queue. */
  clashRev?: number;
}

export type GlyphShape = "circle" | "square" | "triangle" | "star" | "hexagon";
/** Tally's shapes use the Colour Clash palette, plus gold. */
export type GlyphColour = StroopColour | "GOLD";

/** The eight compass directions used by Symbol Scan. */
export type ArrowDir = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface SymbolScanStage {
  target: ArrowDir;
  /** scanRev 1, grid 3 only: a second target direction (tap eagles facing either). */
  alsoTarget?: ArrowDir;
  cols: number;
  /** cols × cols cells, row-major. */
  cells: ArrowDir[];
}

export interface SymbolScanPuzzleData {
  type: "symscan";
  /** Three grids: 5×5, 6×6 and 7×7. */
  stages: SymbolScanStage[];
  /** Server-side only until reveal: indices matching each stage's target. */
  targets?: number[][];
  /** Two-direction revision (14 Oct 2026): 1 = grid 3 has two target directions, rebalanced stage scores. */
  scanRev?: number;
}

export interface HuntSpot {
  /** Percentages of the puzzle area's width and height. */
  x: number;
  y: number;
  /** The two-digit number shown in the circle. */
  n: number;
}

export interface NumberHuntPuzzleData {
  type: "numhunt";
  /** Initial positions plus the seeded positions used at 15, 30 and 45 seconds. */
  spots: HuntSpot[];
  layouts: HuntSpot[][];
  /** Tap-log answers (tapLog.ts TAP_REV); unstamped rounds keep "reached,errors" summaries. */
  tapRev?: number;
}

export type PuzzleData =
  | WordsmithPuzzleData
  | TargetNumberPuzzleData
  | SpotPuzzleData
  | ReactionPuzzleData
  | EquationPuzzleData
  | StroopPuzzleData
  | SymbolScanPuzzleData
  | NumberHuntPuzzleData
  | StopWatchPuzzleData
  | CountUpPuzzleData
  | WordHuntPuzzleData
  | BalancePuzzleData
  | TileGridPuzzleData
  | WordSlidePuzzleData
  | UnblockPuzzleData
  | BlockPartyPuzzleData
  | LightsOutPuzzleData
  | PipesPuzzleData
  | SudokuPuzzleData
  | FlowPuzzleData
  | SlidePuzzleData
  | PushPuzzleData
  | LaserPuzzleData
  | TowerPuzzleData
  | MazePuzzleData
  | TubesPuzzleData
  | SafePuzzleData
  | BombPuzzleData
  | GravityPuzzleData
  | ChainPuzzleData
  | NonoPuzzleData
  | PairPuzzleData
  | FloodPuzzleData
  | TilesPuzzleData
  | RingsPuzzleData
  | HoverPuzzleData
  | SwervePuzzleData
  | SkylinePuzzleData
  | BinTossPuzzleData
  | BullseyePuzzleData
  | MatchupPuzzleData
  | SnakePuzzleData
  | CrossPuzzleData
  | DualPuzzleData
  | RicoPuzzleData
  | BreakerPuzzleData
  | RallyPuzzleData
  | SteadyPuzzleData
  | SlicePuzzleData
  | BubblePuzzleData
  | BeatPuzzleData
  | WhackPuzzleData
  | TenDropPuzzleData
  | ClayShootPuzzleData
  | WordfallPuzzleData
  | TentsPuzzleData
  | ShikakuPuzzleData
  | LightUpPuzzleData
  | BallTrackPuzzleData
  | NumberPyramidPuzzleData
  | TrailPuzzleData
  | MeasurePuzzleData
  | CheckoutPuzzleData
  | NumlinePuzzleData
  | DigPuzzleData
  | WordSearchPuzzleData
  | LetterWheelPuzzleData
  | StrikeoutPuzzleData
  | CodewordPuzzleData
  | SwapwordPuzzleData
  | WavefrontPuzzleData
  | BastionPuzzleData
  | RooftopPuzzleData
  | FlipPuzzleData
  | JunctionPuzzleData
  | InkBridgePuzzleData
  | BurstPuzzleData
  | OrbitPuzzleData
  | SwingPuzzleData
  | SnipPuzzleData
  | TiltPuzzleData
  | HotFloorPuzzleData
  | PinballPuzzleData
  | MinesweeperPuzzleData
  | MahjongPuzzleData
  | HomerunPuzzleData
  | FreekickPuzzleData
  | RacingPuzzleData
  | FreecellPuzzleData
  | TripeaksPuzzleData
  | PokerSquaresPuzzleData
  | FiveHandsPuzzleData
  | MinigolfPuzzleData
  | PoolPuzzleData
  | CurlingPuzzleData;

/** Every timed screen of a round, driven by a shared timestamp. */
export type DuelPhase = "starting" | "round_title" | "intro" | "puzzle" | "reveal" | "result" | "standings" | "winner_reveal";

/** One finished game in a room's "previous games", appended on Play again. */
export interface TournamentEntry {
  winner: string;
  date: string;
  /** The winner's total; stored round scores are never changed. */
  score: number;
  round_order: StoredPuzzleType[];
  /** Word Match prompts, stored by restart_duel_room; no longer read (Word Match was deleted on 14 Oct 2026). */
  word_match_words?: string[];
  /** The game ended through "Finish now": the winner was the last player still in it. */
  forfeit?: boolean;
  /** Who had left or dropped out when it was finished. */
  forfeited_by?: string[];
}

export interface DuelRow {
  id: string;
  room_code: string;
  status: "waiting" | "countdown" | "in_progress" | "finished";
  selected_categories: PuzzleCategory[];
  tournament_history: TournamentEntry[];
  disbanded_at: string | null;
  /** The player who created the room; only they can start it or remove players. */
  host_user_id: string | null;
  max_players: number;
  round_count: number;
  round_order: StoredPuzzleType[];
  /** Host setting: kept for older rooms; no longer used in the draw. */
  no_maths: boolean;

  /**
   * Only what each player needs to render the round. Answers live in the
   * server-only `duel_secrets` table and arrive at reveal time.
   */
  puzzles_public: PuzzleData[];
  current_round: number;
  phase: DuelPhase;
  phase_started_at: string | null;
  round_started_at: string | null;
  next_duel_id: string | null;
  created_at: string;
}

export type PlayerStatus = "active" | "inactive" | "left";

export interface DuelPlayerRow {
  id: string;
  duel_id: string;
  player_slot: number;
  display_name: string;
  /** The device's anonymous auth identity. */
  user_id: string;
  ready_round: number;
  /** The round this player has tapped READY on the intro screen for. */
  intro_ready_round: number;
  /** Host setting: this player cannot send chat or reactions in this room. */
  muted_by_host: boolean;
  last_reaction_at: string | null;
  last_seen_at: string;
  /** inactive = missed two rounds in a row; left = tapped Leave. */
  status: PlayerStatus;
  joined_at: string;
  /**
   * Index into PLAYER_COLOURS (playerLook.ts); null for rows seated before colours were stored.
   * Absent until the colour/icon migration is applied: phones then resolve slot colours.
   */
  colour?: number | null;
  /** A PLAYER_ICON_IDS id, or null for the player's initial; absent before the migration. */
  icon?: string | null;
  /**
   * The last round this player's answer was stored for (0: none this game), for the live
   * "finished" pings (finishedPings.ts); never a score or result. Absent until the
   * 20261017140000 migration is applied: phones then show no pings.
   */
  submitted_round?: number;
}

export interface RoundResultRow {
  id: string;
  duel_id: string;
  player_slot: number;
  round_number: number;
  answer: string | null;
  is_correct: boolean;
  ms_remaining: number;
  /** Reaction Time rounds only: average of the three attempts. */
  reaction_avg_ms: number | null;
  /** Colour Clash rounds only: how many of the fifteen items were tapped correctly. */
  correct_count: number | null;
  /** Number Hunt rounds only: how many wrong taps the player made. */
  errors: number | null;
  /** Per-type detail — Target Number stores the value reached and the steps. */
  extra: Record<string, unknown> | null;
  score: number;
  submitted_at: string;
}

/** Server-built display data, released only after its round has ended. */
export interface PlayerRoundDetail {
  playerSlot: number;
  summary: string;
  /** Longer answer detail shown when a standings row is expanded. */
  detail: string[];
}

export interface RoundRevealData {
  puzzle: PuzzleData;
  /** Compact correct-answer text for the result header, when the type has one. */
  correctAnswer: string | null;
  players: PlayerRoundDetail[];
  /**
   * True while the round still takes late answers (the reveal phase): `players`
   * holds only the caller's own detail. Fetch again once the round closes.
   */
  partial?: boolean;
  /**
   * Reveal phase, arcade rounds: where each other player's run ended on the
   * reveal track (the reveal's progress axis) and their stored score, used only to
   * place their marker on the reveal's chart (never drawn); never their answer.
   */
  progress?: { playerSlot: number; axis: { value: number; max: number | null; label: string }; score?: number }[];
  /**
   * Reveal phase, caller has no answer in yet: no answer detail at all (only
   * the public puzzle), so it can't be sent as a late answer. Fetch again once
   * the caller's answer is stored or the round closes.
   */
  awaitingAnswer?: boolean;
}

export const ROUND_MS = 30_000;
/** Target Number gets a full minute. */
export const TARGET_TIME_MS = 75_000;
/** Target Number: how close a miss still earns something. */
export const TARGET_NEAR_POINTS = 50;
export const TARGET_FAR_POINTS = 25;
/** Default round count for older rooms; new rooms set round_count from roomRoundCount (6, or 7 with all categories). */
export const TOTAL_ROUNDS = 6;
/** New rooms play at most seven rounds. */
export const MAX_ROUNDS = 7;
/**
 * A room holds two to sixteen players (31 Oct 2026, was ten); two plays as the classic duel. The
 * 17th join is refused as full. Bigger events (40+) are for the tournament system, not rooms.
 */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 16;
/** A room's seats: every lobby seats MAX_PLAYERS, rooms made before 16 (stored max_players 10) included. */
export function roomCapacity(room: { max_players?: number | null } | null | undefined): number {
  return Math.max(MAX_PLAYERS, Number(room?.max_players) || 0);
}
/** What a join past the room's seats is told. */
export function roomFullMessage(seats: number): string {
  return `That room is full (${seats} players).`;
}
export const COUNTDOWN_MS = 3_000;
/** Round intro: up to 30s waiting on READY taps, then a 3-2-1 countdown. */
export const INTRO_WAIT_MS = 30_000;
export const INTRO_MS = 33_000;
export const INTRO_COUNTDOWN_MS = 3_000;
/** Answer reveal after each round. */
export const REVEAL_MS = 5_000;
export const NEXT_ROUND_AUTO_MS = 8_000;
/** How long the overall standings screen stays up. */
export const STANDINGS_MS = 10_000;
/** Missing this many rounds in a row marks a player inactive. */
export const INACTIVE_AFTER_MISSED = 2;
export const DISCONNECT_MS = 15_000;

/** Reaction Time: 5–8 stored gold flashes on one shared 60-second timeline. */
export const REACTION_ROUND_MS = 60_000;
export const REACTION_MIN_FLASHES = 5;
export const REACTION_MAX_FLASHES = 8;
/** A gold flash lasts until tapped or this long; a miss records this value. */
export const REACTION_FLASH_MS = 1_500;
export const REACTION_MISS_MS = 1_200;
/** How long a decoy pulse stays on screen. */
export const REACTION_DECOY_MS = 600;
/** Flash decoys: the original colours, plus the gold-like ones `tapRev: 3` deals. */
export const REACTION_PLAIN_DECOYS = ["teal", "red", "blue"] as const;
export const REACTION_GOLD_LIKE_DECOYS = ["amber", "border", "word", "half"] as const;
export type ReactionDecoyColour = (typeof REACTION_PLAIN_DECOYS)[number] | (typeof REACTION_GOLD_LIKE_DECOYS)[number];

/** Every run holds at least this many of each instruction. */
export const STROOP_MIN_PER_INSTRUCTION = 4;
/** Never more than this many of the same instruction in a row. */
export const STROOP_MAX_STREAK = 3;

/** Symbol Scan: a 7x7 grid of arrows with 6-10 matching the target. */
export const SYMSCAN_COLS = 7;
export const SYMSCAN_CELLS = SYMSCAN_COLS * SYMSCAN_COLS;
export const SYMSCAN_MIN_TARGETS = 5;
export const SYMSCAN_MAX_TARGETS = 9;
export const SYMSCAN_STAGE_COLS = [5, 6, 7] as const;
export const SYMSCAN_TIME_MS = 30_000;

/** Spot the Difference: two full 8x6 grids — every cell holds a shape. */
export const SPOT_COLS = 8;
export const SPOT_ROWS = 6;
export const SPOT_CELLS = SPOT_COLS * SPOT_ROWS;
export const SPOT_DIFFERENCES = 6;
/** Unfinished Spot the Difference: points per difference found. */
export const SPOT_DIFF_POINTS = 20;
export const SPOT_TIME_MS = 30_000;
/** Flat scores for partial finds. */
export const SPOT_FOUR_POINTS = 70;
export const SPOT_THREE_POINTS = 50;
export const SPOT_TWO_POINTS = 30;
export const SPOT_ONE_POINTS = 15;

/** Ascend (Number Hunt): 24 numbers over one minute. */
export const NUMHUNT_COUNT = 24;
export const NUMHUNT_TIME_MS = 60_000;
export const NUMHUNT_CIRCLE_PX = 42;
export const NUMHUNT_ERROR_PENALTY = 5;
export const NUMHUNT_FLASH_MS = 200;
export const NUMHUNT_MOVE_MS = 15_000;

/* -------------------------------------------------------------------------- */
/*  Stop Watch                                                                 */
/* -------------------------------------------------------------------------- */

export interface StopWatchSpec {
  /** Zone centre as a fraction of the bar (0–1). */
  centre: number;
  /** Zone half-width as a fraction of the bar. */
  half: number;
  /** One traversal of the bar, in ms. */
  sweepMs: number;
  /** The marker vanishes over the final third of the bar. */
  hidden: boolean;
  /** Wraps from the right boundary to the left instead of bouncing. */
  wrap: boolean;
  /** Optional seeded target oscillation around `centre`. */
  moving?: { amplitude: number; cycleMs: number; phase: number };
  /** Draw and move this watch vertically instead of horizontally. */
  vertical?: boolean;
  /** `tapRev: 3`: draw the bar corner to corner (bottom left to top right); the marker rules are unchanged. */
  diagonal?: boolean;
  /** `tapRev: 3`: black blind spots, [from, to] as fractions of the bar, where the marker vanishes (drawing only). */
  blind?: [number, number][];
  /** Optional traversal times, one per pass. */
  passSweepMs?: number[];
  /** Right-boundary arrivals allowed before this watch is missed. */
  passes: number;
}

export interface StopWatchPuzzleData {
  type: "stopwatch";
  watches: StopWatchSpec[];
  /** Tap-log answers on the fixed watch schedule (tapLog.ts TAP_REV); unstamped rounds keep distance summaries. */
  tapRev?: number;
}

export const STOPWATCH_ATTEMPTS = 10;
export const STOPWATCH_ROUND_MS = 60_000;
/** The first watch starts this long after the round opens. */
export const STOPWATCH_LEAD_IN_MS = 800;
/** Pause between one watch's result and the next watch starting. */
export const STOPWATCH_GAP_MS = 600;
/** Recorded when a watch is never stopped. */
export const STOPWATCH_MISS_MS = 500;
/** Distance at which the accuracy bonus reaches zero. */
export const STOPWATCH_MAX_DIST_MS = 400;

/* -------------------------------------------------------------------------- */
/*  Count Up                                                                   */
/* -------------------------------------------------------------------------- */

export interface CountUpShape {
  shape: GlyphShape | "hexagon";
  colour: GlyphColour;
  /** Percentages of the field's width and height. */
  x: number;
  y: number;
  size: number;
  rotation: number;
  layer: number;
}

export interface CountUpStage {
  cols: number;
  rows: number;
  shapes: CountUpShape[];
  targetShape: GlyphShape | "hexagon";
  targetColour: GlyphColour;
  /**
   * countRev 2, tray 4: a comparison question, "How many more <more> than <less>?",
   * counting every shape of each colour. The answer is count(more) − count(less);
   * targetColour is `more` there and targetShape is unused.
   */
  compare?: { more: GlyphColour; less: GlyphColour };
  /**
   * countRev 6 (Joe's phone notes, 28 Oct 2026; puzzleNotes.ts), tray 2 only: "shape" counts every shape of
   * targetShape whatever its colour ("How many triangles?"), "colour" every shape of targetColour ("How many pink
   * shapes?"). Absent: the colour and the shape together, as every tray before.
   */
  ask?: "shape" | "colour";
}

export interface CountUpPuzzleData {
  type: "countup";
  /** Three fields: 5×4, 7×6, then the full packed grid. */
  stages: CountUpStage[];
  /** Server-side only: how many shapes match each stage's question. */
  counts?: number[];
  /**
   * Count revision. 1 (13 Oct 2026) = the wider per-tray ranges (`COUNTUP_STAGE_COUNTS_REV1`),
   * generation only. 2 (14 Oct 2026) = the same three trays plus a fourth comparison tray,
   * 60 s, scored on the four-tray weights (attentionRev.ts).
   */
  countRev?: number;
  /** countRev 2 carries its own 60 s clock; stored rounds use COUNTUP_TIME_MS. */
  timeLimitMs?: number;
}

export const COUNTUP_STAGE_SIZES = [50, 80, 110] as const;
export const STAGE_WEIGHTS_3 = [30, 45, 55] as const;

/** The field fills a short phone's measured play area without cropping its edges. */
export const COUNTUP_COLS = 8;
export const COUNTUP_ROWS = 6;
export const COUNTUP_TIME_MS = 45_000;
export const COUNTUP_MIN_SHAPES = 50;
export const COUNTUP_MAX_SHAPES = 110;
export const COUNTUP_MIN_COUNT = 6;
export const COUNTUP_MAX_COUNT = 12;

/* -------------------------------------------------------------------------- */
/*  Word Hunt                                                                  */
/* -------------------------------------------------------------------------- */

export const WORDHUNT_COLS = 5;
export const WORDHUNT_CELLS = WORDHUNT_COLS * WORDHUNT_COLS;
/** wordHuntRev 3 (word depth, 25 Oct 2026): a 6×6 board (wordHunt.ts). */
export const WORDHUNT_COLS_DEPTH = 6;
/**
 * A stored board's side: 6 for wordHuntRev 3's 36 tiles, else WORDHUNT_COLS (every older board, whatever its
 * length, keeps the 5-column rules it was graded under).
 */
export function wordHuntCols(grid: readonly unknown[] | null | undefined): number {
  return grid?.length === WORDHUNT_COLS_DEPTH * WORDHUNT_COLS_DEPTH ? WORDHUNT_COLS_DEPTH : WORDHUNT_COLS;
}
export const WORDHUNT_TIME_MS = 100_000;
export const WORDHUNT_MIN_LENGTH = 4;
/** A board is only used when the dictionary finds at least this many words. */
export const WORDHUNT_MIN_WORDS = 40;
export const WORDHUNT_PAR_SHARE = 0.35;

/** 4 letters = 1 point, rising to 11 for eight letters or more. */
export function wordHuntPoints(word: string): number {
  const length = word.trim().length;
  if (length >= 8) return 11;
  return { 4: 1, 5: 2, 6: 4, 7: 7 }[length] ?? 0;
}

export interface WordHuntWord {
  word: string;
  points: number;
  /** Cell indices of one path that spells it. */
  path: number[];
}

export interface WordHuntPuzzleData {
  type: "wordhunt";
  /** 25 tiles (5×5; 36 on wordHuntRev 3), row-major; a Q tile always reads "QU". */
  grid: string[];
  /** Server-side only until the reveal: every word the board allows. */
  words?: WordHuntWord[];
  totalPoints?: number;
  par?: number;
  /**
   * Scoring targets (18 Oct 2026): 1 = word points on WORDHUNT_V1_CURVE; absent = 2 × points; 2 = misses cost
   * (20 Oct 2026); 3 = the 6×6 board, long-word multiplier and golden tile (wordHunt.ts, 25 Oct 2026).
   */
  wordHuntRev?: number;
  /** wordHuntRev 3: the golden tile's index (public; a word traced through it scores double). */
  golden?: number;
}

/* -------------------------------------------------------------------------- */
/*  Unblock                                                                    */
/* -------------------------------------------------------------------------- */

export const UNBLOCK_COLS = 7;
export const UNBLOCK_TIME_MS = 60_000;
/** The gold car and the exit gap both sit on this row (0-based). */
export const UNBLOCK_EXIT_ROW = 2;
/** Flat bonus for solving in the fewest possible moves. */
export const UNBLOCK_MIN_MOVE_BONUS = 20;

export type UnblockAxis = "h" | "v";

export interface UnblockVehicle {
  /** Stable id; 0 is always the gold car. */
  id: number;
  row: number;
  col: number;
  /** 2 for a car, 3 for a lorry. */
  len: number;
  axis: UnblockAxis;
}

export interface UnblockPuzzleData {
  type: "unblock";
  vehicles: UnblockVehicle[];
  /** Depth batch 4 (docs/depth/d4-pattern.md): 1 = par moves, scored to 200; absent = the old rules. */
  unblockRev?: number;
  /** unblockRev 1: the par (the solver's minimum), public so the phone can show "Moves n · Par p". */
  par?: number;
  /** Server-side only: the fewest moves the layout can be solved in. */
  minMoves?: number;
  /** Server-side only: one minimum-length solution, as encoded moves. */
  solution?: string;
}

/* -------------------------------------------------------------------------- */
/*  Block Party                                                                */
/* -------------------------------------------------------------------------- */

export const BLOCK_COLS = 6;
export const BLOCK_CELLS = BLOCK_COLS * BLOCK_COLS;
export const BLOCK_BLOCKERS = 7;
export const BLOCK_FREE_CELLS = BLOCK_CELLS - BLOCK_BLOCKERS;
export const BLOCK_TIME_MS = 60_000;
/** Partial credit when the board is not filled by the timer. */
export const BLOCK_PARTIAL_POINTS = 60;
/** Unfinished Block Party: points per legally placed piece. */
export const BLOCK_PIECE_POINTS = 12;

/** One piece sitting on the board, by the absolute cells it covers. */
export interface BlockPlacement {
  /** Index into the tray piece list. */
  piece: number;
  cells: number[];
}

export interface BlockPartyPuzzleData {
  /** Puzzle score shape stamp (puzzleScoreRev.ts; set by generatePuzzle, kept on the banked intro example). */
  puzzleScoreRev?: number;
  type: "blockparty";
  /** Seven peg cells the pieces must fit around (blockRev 1: sixteen, on a 7×7 board). */
  blockers: number[];
  /** Depth batch 4: 1 = the 7×7 board (nine pieces, a Plus for the Dot), scored to 200; absent = the 6×6 board. */
  blockRev?: number;
  /** Server-side only: one full solution. */
  solution?: BlockPlacement[];
  /** Server-side only: how many solutions the layout has (capped). */
  solutions?: number;
}

/* -------------------------------------------------------------------------- */
/*  Lights Out                                                                 */
/* -------------------------------------------------------------------------- */

export const LIGHTS_COLS = 6;
export const LIGHTS_CELLS = LIGHTS_COLS * LIGHTS_COLS;
export const LIGHTS_TIME_MS = 75_000;
/** Presses used to build a pattern. */
export const LIGHTS_MIN_BUILD = 8;
export const LIGHTS_MAX_BUILD = 12;
/** Patterns with fewer lights than this are thrown away. */
export const LIGHTS_MIN_ON = 6;
/** Bonus for solving in the fewest possible presses. */
export const LIGHTS_MIN_BONUS = 20;
/** Most a partly-cleared board can earn. */
export const LIGHTS_PARTIAL_POINTS = 60;

export interface LightsOutPuzzleData {
  /** Depth revision (logicDepth.ts, 25 Oct 2026): 1 = scored to 200. Absent = the old scoring. */
  depthRev?: number;
  /** The depth revision's public par: the stored minimum, shown on the board (logicDepthStamp.server.ts). */
  par?: number;
  type: "lightsout";
  /** Twenty-five lights, true for lit, in the order every player sees them. */
  lights: boolean[];
  /** Server-side only: the fewest presses this pattern can be cleared in. */
  minPresses?: number;
  /** Server-side only: one shortest press set. */
  solution?: number[];
}

/* -------------------------------------------------------------------------- */
/*  Pipes                                                                     */
/* -------------------------------------------------------------------------- */

export const PIPES_COLS = 7;
export const PIPES_CELLS = PIPES_COLS * PIPES_COLS;
export const PIPES_TIME_MS = 120_000;
export const PIPES_PARTIAL_POINTS = 60;

export type PipeShape = "end" | "straight" | "corner" | "tee" | "cross";

/**
 * A tile is nothing but its set of open sides — north 1, east 2, south 4,
 * west 8. The drawn shape is derived from that set, so there is no shape name
 * plus rotation to keep in step.
 */
export interface PipeTile {
  sides: number;
}

export interface PipesPuzzleData {
  type: "pipes";
  /** Thirty-six tiles with their scrambled open sides. */
  tiles: PipeTile[];
  /** The cell water flows from — the root of the spanning tree. */
  source: number;
  /** Depth batch 4: 1 = par turns (the answer carries its tap log), scored to 200; absent = the old rules. */
  pipesRev?: number;
  /** pipesRev 1: the fewest taps that turn the board into the stored solution. */
  par?: number;
  /** Server-side only: the solved open sides of every tile. */
  solution?: number[];
}

/* -------------------------------------------------------------------------- */
/*  Mini Sudoku                                                               */
/* -------------------------------------------------------------------------- */

export const SUDOKU_COLS = 6;
export const SUDOKU_CELLS = SUDOKU_COLS * SUDOKU_COLS;
/** Boxes are two rows tall and three columns wide. */
export const SUDOKU_BOX_ROWS = 2;
export const SUDOKU_BOX_COLS = 3;
export const SUDOKU_TIME_MS = 90_000;
export const SUDOKU_MIN_GIVENS = 14;
export const SUDOKU_MAX_GIVENS = 16;
/** sudokuRev 1 (14 Oct 2026): one fewer given, 13–15, still one solution. */
export const SUDOKU_REV_FEWER = 1;
export const SUDOKU_REV1_MIN_GIVENS = 13;
export const SUDOKU_REV1_MAX_GIVENS = 15;
export const SUDOKU_PARTIAL_POINTS = 110;

export interface SudokuPuzzleData {
  /** Depth revision (logicDepth.ts, 25 Oct 2026): 1 = scored to 200. Absent = the old scoring. */
  depthRev?: number;
  type: "sudoku";
  /** Thirty-six cells: the fixed digits, 0 where the player must fill in. */
  givens: number[];
  /** Generation revision: 1 = 13–15 givens (14 Oct 2026); absent = 14–16. Grading reads only the givens, so it is the same either way. */
  sudokuRev?: 1;
  /** Server-side only: the one grid the givens allow. */
  solution?: number[];
}

/* -------------------------------------------------------------------------- */
/*  Colour Connect                                                            */
/* -------------------------------------------------------------------------- */

export const FLOW_COLS = 9;
export const FLOW_CELLS = FLOW_COLS * FLOW_COLS;
/** Each board has between ten and twelve pairs. */
export const FLOW_MIN_PAIRS = 10;
export const FLOW_MAX_PAIRS = 12;
/** Upper bound used when decoding answers. */
export const FLOW_PAIRS = FLOW_MAX_PAIRS;
/** Dark wall cells no path may enter. */
export const FLOW_MIN_WALLS = 2;
export const FLOW_MAX_WALLS = 4;
export const FLOW_TIME_MS = 75_000;
/** Every path in a layout covers at least this many cells. */
export const FLOW_MIN_PATH = 3;
/** Most a partly-joined board can earn. */
export const FLOW_PARTIAL_POINTS = 60;
/** Unfinished Colour Connect: points per pair joined. */
export const FLOW_PAIR_POINTS = 10;
/** Unfinished Ice Slide: share of distance closed × this. */
export const SLIDE_PARTIAL_POINTS = 90;

export type FlowColour =
  | StroopColour
  | "TEAL"
  | "WHITE"
  | "LIME"
  | "SILVER";

export interface FlowPair {
  colour: FlowColour;
  /** The two dot cells; either end may be drawn from. */
  a: number;
  b: number;
}

export interface FlowPuzzleData {
  /** Puzzle score shape stamp (puzzleScoreRev.ts; set by generatePuzzle, kept on the banked intro example). */
  puzzleScoreRev?: number;
  type: "flow";
  /** Ten to twelve pairs in the order every player sees them. */
  pairs: FlowPair[];
  /** Dark wall cells: no path may enter, and they need no filling. */
  walls?: number[];
  /** Depth batch 4: 1 = scored to 200 (the stretch); absent = scored to 150. The board is unchanged. */
  flowRev?: number;
  /** Server-side only: the cell path of each pair, in pair order. */
  solution?: number[][];
}

/* -------------------------------------------------------------------------- */
/*  Ice Slide                                                                 */
/* -------------------------------------------------------------------------- */

export const SLIDE_COLS = 12;
export const SLIDE_CELLS = SLIDE_COLS * SLIDE_COLS;
export const SLIDE_TIME_MS = 90_000;
export const SLIDE_MIN_WALLS = 30;
export const SLIDE_MAX_WALLS = 44;
export const SLIDE_MIN_MOVES = 18;
export const SLIDE_MAX_MOVES = 26;
/** The exit may not be within this many slides of the start. */
export const SLIDE_EASY_MOVES = 8;
/** Holes the ball must slide around: falling in sends it back to the start. */
export const SLIDE_MIN_HOLES = 2;
export const SLIDE_MAX_HOLES = 4;
/** One-way arrow cells: a ball entering one is deflected and keeps sliding. */
export const SLIDE_MIN_ARROWS = 1;
export const SLIDE_MAX_ARROWS = 3;
/** At least this many walls must be stoppers the shortest route depends on. */
export const SLIDE_MIN_STOPPERS = 5;
/** Bonus for reaching the exit in the fewest possible slides. */
export const SLIDE_MIN_MOVE_BONUS = 20;
/** Consolation for stopping within two slides of the exit. */
export const SLIDE_NEAR_POINTS = 30;
export const SLIDE_NEAR_MOVES = 2;
/** Portal pairs: a ball entering one leaves its twin, same heading. */
export const SLIDE_MIN_PORTALS = 1;
export const SLIDE_MAX_PORTALS = 2;
/** Thin ice: crossing one turns it into a hole for every later slide. */
export const SLIDE_MIN_THIN = 3;
export const SLIDE_MAX_THIN = 5;

/** Up, down, left, right — the only four directions a slide can take. */
export type SlideDir = "U" | "D" | "L" | "R" | "X" | "Y";

/** A one-way cell: whatever enters it leaves in this direction. */
export interface SlideArrow {
  cell: number;
  dir: SlideDir;
}

/** Generator figures, shown only in the dev readout. */
export interface SlideStats {
  walls: number;
  holes: number;
  arrows: number;
  minMoves: number;
  /** True when the exit is reachable in six slides or fewer — must be false. */
  easyExit: boolean;
  stoppers: number;
  attempts: number;
}

export interface SlidePuzzleData {
  /** Puzzle score shape stamp (puzzleScoreRev.ts; set by generatePuzzle, kept on the banked intro example). */
  puzzleScoreRev?: number;
  type: "iceslide";
  /** Wall cells the ball stops against. */
  walls: number[];
  /** Holes: sliding over one drops the ball back on the start. */
  holes: number[];
  /** One-way arrow cells. */
  arrows?: SlideArrow[];
  start: number;
  /** The gold gap in the border. */
  exit: number;
  /** Portal pairs, each entered from either end. */
  portals?: [number, number][];
  /** Thin-ice cells, in bit order for the broken-ice mask. */
  thin?: number[];
  /** Depth batch 4: 1 = ice gems off the direct route, scored to 200; absent = the old rules. */
  slideRev?: number;
  /** slideRev 1: the gem cells; the ball collects one by sliding over or stopping on it. */
  gems?: number[];
  /** Generator figures for the dev readout. */
  stats?: SlideStats;
  /** Server-side only: the fewest slides the layout needs. */
  minMoves?: number;
  /** Server-side only: one shortest sequence, as UDLR letters. */
  solution?: string;
}

/* -------------------------------------------------------------------------- */
/*  Push                                                                      */
/* -------------------------------------------------------------------------- */

export const PUSH_COLS = 9;
export const PUSH_CELLS = PUSH_COLS * PUSH_COLS;
export const PUSH_TIME_MS = 120_000;
/** Every bank layout needs between this many and this many pushes. */
export const PUSH_MIN_PUSHES = 16;
export const PUSH_MAX_PUSHES = 30;
/** Four or five crates, and every one of them has to move at least three times. */
export const PUSH_MIN_CRATES = 4;
export const PUSH_MAX_CRATES = 5;
export const PUSH_MIN_MOVES_PER_CRATE = 3;
/** How many solver-verified layouts the bank holds. */
export const PUSH_BANK_SIZE = 120;
/** Bonus for finishing in the fewest possible pushes. */
export const PUSH_MIN_PUSH_BONUS = 20;
/** Most a partly-finished warehouse can earn. */
export const PUSH_PARTIAL_POINTS = 110;

/** Generator figures, shown only in the dev readout. */
export interface PushStats {
  crates: number;
  minPushes: number;
  minMoves: number;
  /** True when the optimal solution takes a crate away from its own target. */
  detour: boolean;
}

export interface PushPuzzleData {
  type: "push";
  walls: number[];
  /** Starting crate cells. */
  crates: number[];
  /** The same number of target cells. */
  targets: number[];
  /** Where the pusher starts. */
  pusher: number;
  /** Depth batch 4: 1 = the bigger warehouse with a gold crate, scored to 200; absent = the old rules. */
  pushRev?: number;
  /** pushRev 1: the gold crate (an index into `crates`) and its gold mark (a cell in `targets`). */
  gold?: { crate: number; target: number };
  /** Generator figures for the dev readout. */
  stats?: PushStats;
  /** Server-side only: the fewest pushes the layout can be finished in. */
  minPushes?: number;
  /** Server-side only: one minimum solution, as "cell:dir" pushes. */
  solution?: string;
}

/* -------------------------------------------------------------------------- */
/*  Laser and Mirrors                                                         */
/* -------------------------------------------------------------------------- */

export const LASER_COLS = 10;
export const LASER_CELLS = LASER_COLS * LASER_COLS;
export const LASER_TIME_MS = 60_000;
/** Seven or eight mirrors, plus one movable splitter. */
export const LASER_MIN_MIRRORS = 7;
export const LASER_MAX_MIRRORS = 8;
export const LASER_MIN_BLOCKS = 18;
export const LASER_MAX_BLOCKS = 26;
/** Six gems the beam must pass through, and three or four bombs it must miss. */
export const LASER_GEMS = 6;
export const LASER_MIN_BOMBS = 3;
export const LASER_MAX_BOMBS = 4;
/** Blocks closing off the straight and single-bend shortcuts. */
export const LASER_MIN_SHORTCUT_BLOCKS = 3;
/** Blocks touching the beam route without sitting on it, hiding the corridor. */
export const LASER_MIN_ADJACENT_BLOCKS = 3;
/** Blocks that must sit in the middle 6x6, so the centre is genuinely obstructed. */
export const LASER_MIN_CENTRAL_BLOCKS = 7;
/** The middle 6x6 area, as inclusive row/column indices on the 10x10 grid. */
export const LASER_CENTRAL_FROM = 2;
export const LASER_CENTRAL_TO = 7;
/** A bomb must lie on this many different near-miss beams. */
export const LASER_MIN_BOMB_CROSSINGS = 2;
/** The beam route always turns at least this many times. */
export const LASER_MIN_BENDS = 7;
/** And never more: the route bends exactly once per mirror. */
export const LASER_MAX_BENDS = 8;
/** Three shots per round. */
export const LASER_MAX_FIRES = 3;
/** Base points by the shot that lit every gem: first, second, third. */
export const LASER_FIRE_BASE = [130, 115, 100];
/** Fired but not every gem lit: points per gem lit. */
export const LASER_GEM_POINTS = 15;
/** A shot that missed scores in proportion to the gems it did light. */
export const LASER_PARTIAL_POINTS = 70;
/** How many near-miss placements the necessity search may carry forward. */
export const LASER_PROMISING_CAP = 20_000;
/** How long the beam takes to draw itself, and how long it lingers after a miss. */
export const LASER_BEAM_MS = 600;
export const LASER_FADE_MS = 1_500;

/** Diagonal mirrors and splitters with a vertical/horizontal input axis. */
export type MirrorKind = "/" | "\\" | "S|" | "S-";

/** Up, down, left, right — the direction a beam travels. */
export type BeamDir = "U" | "D" | "L" | "R";

export interface MirrorPlacement {
  cell: number;
  kind: MirrorKind;
}

/** Generator figures, shown only in the dev readout. */
export interface LaserStats {
  blocks: number;
  mirrors: number;
  bends: number;
  gems: number;
  bombs: number;
  /** Every proper subset of the stored exact-piece solution fails. */
  necessityPass: boolean;
  /** How many proper subsets of the stored solution were traced. */
  subsetsTested: number;
  attempts: number;
  splitters?: number;
  directionalGems?: number;
  splitRequired?: boolean;
  generationMs?: number;
}

export interface LaserPuzzleData {
  type: "laser";
  /** The edge cell the laser fires from. */
  source: number;
  /** The direction it fires, inward from that edge. */
  dir: BeamDir;
  /** The six gems the split beam must light. */
  gems: number[];
  /** Two gems only light when entered with this heading. */
  directionalGems?: { cell: number; from: BeamDir }[];
  /** Legacy fixed splitters, retained only for previously stored rounds. */
  splitters?: number[];
  /** Movable splitter pieces supplied in addition to the mirrors. */
  splitterPieces?: number;
  /** Bombs: touching one ends the shot at once. */
  bombs: number[];
  /** Cells the beam cannot pass. */
  blocks: number[];
  /** Exactly as many mirrors as the solution needs. */
  mirrors: number;
  /** Generator figures for the dev readout. */
  stats?: LaserStats;
  /** Server-side only: where each mirror belongs, and which way it faces. */
  solution?: MirrorPlacement[];
  /** 1: answered with the timestamped action log (laserLog.ts); absent: the old "shot|layout" answer. */
  alogRev?: number;
  /** Depth batch 4: 1 = spare mirrors and the elegant beam, scored to 200; absent = the old rules. */
  laserRev?: number;
  /** laserRev 1: the mirrors the stored solution uses (an elegant beam lights every gem with no more). */
  par?: number;
}

/* -------------------------------------------------------------------------- */
/*  Tower                                                                     */
/* -------------------------------------------------------------------------- */

export const TOWER_TIME_MS = 90_000;
/** Eight discs across four pegs. */
export const TOWER_DISCS = 9;
export const TOWER_PEGS = 4;
/** A starting spread is only used when it needs at least this many moves. */
export const TOWER_MIN_MINIMUM = 20;
export const TOWER_MAX_MINIMUM = 40;
/** Bonus for finishing in the fewest possible moves. */
export const TOWER_MIN_MOVE_BONUS = 20;
/** Most a partly-built tower can earn. */
export const TOWER_PARTIAL_POINTS = 110;

/** Generator figures, shown only in the dev readout. */
export interface TowerStats {
  discs: number;
  pegs: number;
  minMoves: number;
  attempts: number;
}

export interface TowerPuzzleData {
  /** Depth revision (logicDepth.ts, 25 Oct 2026): 1 = scored to 200. Absent = the old scoring. */
  depthRev?: number;
  type: "tower";
  /** How many discs are in play: eight. */
  discs: number;
  /** The starting spread, one stack per peg, bottom disc first. */
  start: number[][];
  /** Which of the four pegs the tower must end on. */
  targetPeg: number;
  /** The fewest moves this spread can be finished in, found by search. */
  minMoves: number;
  /** This puzzle's own clock. */
  timeLimitMs: number;
  /** Generator figures for the dev readout. */
  stats?: TowerStats;
  /** Server-side only: one shortest sequence of moves. */
  solution?: string;
}

/* -------------------------------------------------------------------------- */
/*  Maze Dash                                                                 */
/* -------------------------------------------------------------------------- */

export const MAZE_COLS = 19;
export const MAZE_CELLS = MAZE_COLS * MAZE_COLS;
export const MAZE_TIME_MS = 60_000;
/** The route from start to exit is never shorter than this. */
export const MAZE_MIN_PATH = 70;
/** And never straighter than this: 1.5× the median turns of the old 15×15 route (48). */
export const MAZE_MIN_TURNS = 72;
/** False trails: dead-end branches leaving the route, and how long each runs. */
export const MAZE_MIN_DEAD_ENDS = 8;
export const MAZE_DEAD_END_LENGTH = 5;
/** And some of those trails have to be long enough to really cost time. */
export const MAZE_MIN_LONG_DEAD_ENDS = 3;
export const MAZE_LONG_DEAD_END_LENGTH = 11;
/** Forks on or beside the route, so the player has to choose. */
export const MAZE_MIN_JUNCTIONS = 14;
/** The exit may not be visible down a straight corridor from this last stretch. */
export const MAZE_BLIND_TAIL = 10;
/** Unfinished Maze Dash: share of the path walked × this. */
export const MAZE_PARTIAL_POINTS = 110;

export interface MazePuzzleData {
  type: "maze";
  /**
   * One open-side mask per cell: north 1, east 2, south 4, west 8. A perfect
   * maze, so exactly one route joins any two cells.
   */
  cells: number[];
  start: number;
  exit: number;
  /** Server-side only: the one route from the start to the exit. */
  solution?: number[];
  /**
   * `mazeRev: 1` (depth to 200, 25 Oct 2026; src/lib/duel/depth/labyrinth.ts): a 19 × 23 board (`cols`, `rows`),
   * detour stars (`stars`, cells off the route) and a trail answer. Absent: the 19 × 19 board and path answer.
   */
  mazeRev?: number;
  cols?: number;
  rows?: number;
  stars?: number[];
}

/* ============================ Sort the Tubes ============================ */

export const TUBES_TIME_MS = 90_000;
export const TUBES_COUNT = 10;
export const TUBE_CAPACITY = 5;
export const TUBES_COLOURS = 8;
/** How many reverse pours scramble the solved board. */
export const TUBES_MIN_SCRAMBLE = 60;
export const TUBES_MAX_SCRAMBLE = 90;
/** The searched minimum has to land in this band for the board to be used. */
export const TUBES_MIN_MIN_MOVES = 16;
export const TUBES_MAX_MIN_MOVES = 26;
/** The breadth-first search gives up past this many states, and we re-roll. */
export const TUBES_BFS_CAP = 1_000_000;
/** Bonus for solving in the fewest possible pours. */
export const TUBES_MIN_MOVE_BONUS = 20;
/** Unfinished Sort the Tubes: points per single-colour tube. */
export const TUBES_TUBE_POINTS = 22;
/** Most an unsolved board can earn, shared out per finished tube. */
export const TUBES_PARTIAL_POINTS = 60;

export interface TubesPuzzleData {
  /** Depth revision (logicDepth.ts, 25 Oct 2026): 1 = scored to 200. Absent = the old scoring. */
  depthRev?: number;
  /** The depth revision's public par: the stored minimum, shown on the board (logicDepthStamp.server.ts). */
  par?: number;
  /** Puzzle score shape stamp (puzzleScoreRev.ts; set by generatePuzzle, kept on the banked intro example). */
  puzzleScoreRev?: number;
  type: "tubes";
  /** One tube per entry, bottom ball first, holding colour indices 0–7. */
  tubes: number[][];
  /** Server-side only: the searched minimum number of pours. */
  minMoves?: number;
  /** Server-side only: one shortest pour list, as `0>3,1>2`. */
  solution?: string;
  /** Pour limit revision (moveLimits.ts, 13 Oct 2026): 1 = Undo and Reset are sent as `u` / `r` and every pour counts toward `pourLimit`; 2 (19 Oct 2026) = the same, an unfinished board scored on the solver distance closed (solverProgress.server.ts). Absent = no limit. */
  tubesRev?: number;
  /** Pours allowed (tubesRev 1); public, rounded so it never shows the minimum. */
  pourLimit?: number;
}

/* ============================= Safe Cracker ============================= */

export const SAFE_TIME_MS = 75_000;
export const SAFE_DIALS = 4;
export const SAFE_CLUE_COUNT = 5;
export const SAFE_TRIES = 3;
/** Base points by the try that opened the safe: first, second, third. */
export const SAFE_TRY_POINTS = [130, 115, 100];
/** Points per correct dial when the safe stays shut. */
export const SAFE_DIAL_POINTS = 15;

export interface SafePuzzleData {
  /** Depth revision (logicDepth.ts, 25 Oct 2026): 1 = scored to 200. Absent = the old scoring. */
  depthRev?: number;
  type: "safe";
  /** The four clues printed on the card — public from the start. */
  clues: import("./safe").SafeClue[];
  /** Server-side only: the digits that open the safe. */
  combination?: number[];
}

/* ============================ Bomb Defusal ============================= */

export const BOMB_TIME_MS = 75_000;
export const BOMB_WIRES = 7;
/** Six rules, and between them exactly one four-action plan. */
export const BOMB_RULE_COUNT = 6;
/** At least this many of the six must be individually necessary. */
export const BOMB_NECESSARY_RULES = 4;
/** Every panel requires exactly four actions. */
export const BOMB_MIN_SEQUENCE = 4;
export const BOMB_MAX_SEQUENCE = 4;
/** Points per correct leading action when the bomb is not defused. */
export const BOMB_PREFIX_POINTS = 25;
export const BOMB_PARTIAL_POINTS = 75;

/** Generator/scoring version 2: six steps; stored rounds without `bombVersion` are version 1. */
export const BOMB_V2 = 2 as const;
export const BOMB_V2_STEPS = 6;
/** Card size: six to nine rules, every one individually necessary. */
export const BOMB_V2_RULES = 9;
/** At most three rules from any one of the four template families. */
export const BOMB_V2_FAMILY_CAP = 3;
/** Minimum card size; the pruned card makes every rule necessary. */
export const BOMB_V2_NECESSARY = 6;
export const BOMB_V2_TIME_MS = 90_000;

/**
 * Version 3 (14 Oct 2026): the same six-step panel and 90 s clock, with a card
 * of plain-language clues only (bomb.server.ts V3 templates): which step an
 * action is, what comes before what, what comes straight after what, and what
 * not to do. No conditions on the light or serial, no sums, no "if". Each card
 * has exactly one valid sequence, proved over all 60,480 (scripts/bomb-v3-check.ts).
 */
export const BOMB_V3 = 3 as const;
/** Card size for version 3: six to nine clues, every one individually necessary. */
export const BOMB_V3_MIN_RULES = 6;
export const BOMB_V3_MAX_RULES = 9;

export interface BombSpec {
  steps: number;
  rules: number;
  familyCap: number;
  necessary: number;
}

export function bombSpecOf(version: 1 | 2): BombSpec {
  return version === BOMB_V2
    ? { steps: BOMB_V2_STEPS, rules: BOMB_V2_RULES, familyCap: BOMB_V2_FAMILY_CAP, necessary: BOMB_V2_NECESSARY }
    : { steps: BOMB_MAX_SEQUENCE, rules: BOMB_RULE_COUNT, familyCap: 2, necessary: BOMB_NECESSARY_RULES };
}

export interface BombPuzzleData {
  /** Depth revision (logicDepth.ts, 25 Oct 2026): 1 = scored to 200. Absent = the old scoring. */
  depthRev?: number;
  type: "bomb";
  wires: import("./bomb").WireColour[];
  buttons: import("./bomb").BombButton[];
  light: boolean;
  switchPosition: import("./bomb").BombSwitch;
  /** Three digits on the plate. */
  serial: string;
  /** The rule card, in the order it must be read. */
  rules: { id: string; text: string }[];
  /** How many actions the plan needs — the "actions 2 / 6" counter. */
  stepCount: number;
  /** 2 for six-step rounds, 3 for six-step rounds with the plain-language card (14 Oct 2026); absent on stored four-step rounds. */
  bombVersion?: 2 | 3;
  /** Version 2 carries its own clock; version 1 uses BOMB_TIME_MS. */
  timeLimitMs?: number;
  /** Server-side only: the required actions, as `bA,w2`. */
  required?: string;
  /** Server-side only: the ordering the rules impose, as `bA<w2;last:w6`. */
  constraints?: string;
  /** Server-side only: one order that satisfies every constraint. */
  sequence?: string;
}

/* ============================= Gravity Maze ============================= */

export const GRAV_TIME_MS = 90_000;
export const GRAV_COLS = 9;
export const GRAV_CELLS = GRAV_COLS * GRAV_COLS;
export const GRAV_BALLS = 4;
export const GRAV_MIN_WALLS = 14;
export const GRAV_MAX_WALLS = 22;
/** The searched joint-state minimum has to land in this band. */
export const GRAV_MIN_TILTS = 8;
export const GRAV_MAX_TILTS = 14;
/** The joint search gives up (and the board is re-rolled) past this many states. */
export const GRAV_NODE_CAP = 400_000;
/** Points per locked ball when the board is not finished. */
export const GRAV_LOCK_POINTS = 30;

export type GravityDir = "U" | "D" | "L" | "R" | "X" | "Y";

export interface GravityPuzzleData {
  /** Puzzle score shape stamp (puzzleScoreRev.ts; set by generatePuzzle, kept on the banked intro example). */
  puzzleScoreRev?: number;
  type: "gravity";
  /** Dark blocks the balls cannot enter. */
  walls: number[];
  /** Start square per ball: gold, teal, purple, pink. */
  starts: number[];
  /** Target square per ball, same order. */
  targets: number[];
  /** Server-side only: the searched minimum number of tilts. */
  minMoves?: number;
  /** Server-side only: one shortest tilt list, as `URDL`. */
  solution?: string;
  /** Tilt limit revision (moveLimits.ts, 13 Oct 2026): 1 = at most `tiltLimit` tilts count; 2 (19 Oct 2026) = the same, an unfinished board scored on the solver distance closed (solverProgress.server.ts). Absent = no limit. */
  gravityRev?: number;
  /** Tilts allowed (gravityRev 1); public, rounded so it never shows the minimum. */
  tiltLimit?: number;
  /**
   * gravityRev 3 (25 Oct 2026, the remodel, topsy.ts): the round's boards (10×10, six balls with their own
   * holes, stars), played in order. `walls` / `starts` / `targets` then repeat board 1's blocks, starts and holes.
   */
  boards?: import("./topsy").TopsyBoard[];
  /** gravityRev 3: the round's own clock (120 s). */
  timeLimitMs?: number;
  /** gravityRev 3: each board's tilt limit (public; topsyTiltLimit of its minimum). */
  tiltLimits?: number[];
  /** Server-side only (gravityRev 3): each board's fewest tilts to get every ball home. */
  boardMins?: number[];
  /** Server-side only (gravityRev 3): each board's fewest tilts home with every star. */
  boardStarMins?: number[];
  /** Server-side only (gravityRev 3): one shortest all-stars tilt list per board. */
  boardSolutions?: string[];
}

/* ======================= Don't Break the Chain ========================== */

export const CHAIN_TIME_MS = 45_000;
/** The chain is a fixed 40 links; the board shows 20 nodes at a time. */
export const CHAIN_LENGTH = 40;
export const CHAIN_NODES = 20;
/** After every this many correct taps the board reshuffles (seeded). */
export const CHAIN_BLOCK = 5;
export const CHAIN_BOARDS = CHAIN_LENGTH / CHAIN_BLOCK;
/** The rule is a repeating three-step cycle. */
export const CHAIN_CYCLE = 3;
/** Points per completed link (40 links = 140 before the finish bonus). */
export const CHAIN_LINK_POINTS = 3.5;
export const CHAIN_FINISH_BONUS = 10;
export const CHAIN_RULES_VERSION = 2;
/**
 * Finish-bonus time (13 Oct 2026): stamped rounds take time left as no more than
 * the replayed last tap allows (45 s less its time), never the claimed time alone.
 */
export const CHAIN_TIME_REV = 1;
/**
 * Five-symbol cycles (14 Oct 2026, Speed tuning): each board's cycle is five
 * different charms, all shown in the preview (no symbol repeats within a board),
 * and the board starting at link CHAIN_REVERSE_AT is played in reverse order for
 * CHAIN_REVERSE_LINKS links, after a banner warning. Absent = three-symbol cycles.
 */
export const CHAIN_CYCLE_REV = 1;
export const CHAIN_CYCLE_LONG = 5;
/** chainCycleRev 1: links already made when the reversed board starts (0-based link 20 = the 21st tap). */
export const CHAIN_REVERSE_AT = 20;
export const CHAIN_REVERSE_LINKS = 5;
/** chainCycleRev 1: the reverse warning banner shows from this many links made. */
export const CHAIN_REVERSE_WARN_AT = 17;
/** Momentum windows, in ms, to make the given link after the previous one. */
export const CHAIN_MOMENTUM_MS = [
  { upTo: 13, ms: 3_000 },
  { upTo: 26, ms: 2_500 },
  { upTo: CHAIN_LENGTH, ms: 2_000 },
] as const;
/** The soft warning tick plays in this final part of the window. */
export const CHAIN_WARN_MS = 500;
/** Links at which the background shifts and "FASTER" is announced. */
export const CHAIN_FASTER_AT = [10, 20, 30] as const;
/** A node glyph, and the clear space kept between two glyph edges, in pixels. */
export const CHAIN_NODE_PX = 34;
export const CHAIN_NODE_GAP_PX = 12;
/**
 * Conservative size of the chain board on the smallest supported phone, used to
 * turn the pixel spacing rule into the percentage space node positions live in.
 */
export const CHAIN_BOARD_W_PX = 343;
export const CHAIN_BOARD_H_PX = 380;
export const CHAIN_MIN_CENTRAL = 5;

export const CHAIN_SHAPES = ["circle", "square", "triangle"] as const;
export const CHAIN_COLOURS = ["RED", "BLUE", "GREEN", "YELLOW"] as const;

export type ChainShape = (typeof CHAIN_SHAPES)[number];
export type ChainColour = (typeof CHAIN_COLOURS)[number];

export interface ChainNode {
  /** Position in percent of the play area. */
  x: number;
  y: number;
  shape: ChainShape;
  colour: ChainColour;
}

export interface ChainRuleItem {
  shape: ChainShape;
  colour: ChainColour;
}

export type ChainBreak = "wrong" | "momentum" | "timer" | "complete";

export interface ChainPuzzleData {
  type: "chain";
  /** Versioned rules; unversioned stored boards retain their original rules. */
  rulesVersion?: number;
  /** CHAIN_TIME_REV: the finish bonus is capped by the replayed last tap; absent = the claimed time. */
  chainTimeRev?: number;
  /** CHAIN_CYCLE_REV: five-symbol cycles and the reversed board from link 20; absent = three-symbol cycles. */
  chainCycleRev?: number;
  /** Depth to 200 (25 Oct 2026, depth/chain.ts CHAIN_DEPTH_REV): milestones at 10 / 20 / 30 links and the stretched finish, up to 200; absent = 150. */
  chainDepthRev?: number;
  /** The repeating three-item rule: shape and colour must both match. */
  cycle: ChainRuleItem[];
  /** Seeded rule per five-link board; absent on legacy single-cycle puzzles. */
  cycles?: ChainRuleItem[][];
  /** Seed used to generate every rule, face and position in this round. */
  seed?: number;
  /** One board of 20 nodes per block of five links, shown in order. */
  boards: ChainNode[][];
}

/* ============================== Nonogram ================================ */

export const NONO_TIME_MS = 120_000;
export const NONO_SIZE = 7;
/** Filled-cell count band for a generated picture. */
export const NONO_MIN_FILLED = 18;
export const NONO_MAX_FILLED = 30;
/** Partial credit share and the cost of a wrongly filled cell. */
export const NONO_PARTIAL_POINTS = 110;
export const NONO_WRONG_PENALTY = 5;

/** A cell the player has filled (1), pencilled as empty (2), or left blank (0). */
export type NonoMark = 0 | 1 | 2;

export interface NonoPuzzleData {
  /** Depth revision (logicDepth.ts, 25 Oct 2026): 1 = scored to 200. Absent = the old scoring. */
  depthRev?: number;
  type: "nonogram";
  /** Run lengths, in order, for each row then each column. */
  rows: number[][];
  cols: number[][];
  /** Server-side only: the one picture these clues describe. */
  pattern?: boolean[];
}

/* ============================== Pair Match ============================== */

export const PAIR_TIME_MS = 90_000;
export const PAIR_PAIRS = 15;
export const PAIR_CARDS = PAIR_PAIRS * 2;
export const PAIR_FLIP_BACK_MS = 600;
export const PAIR_FLIP_MS = 150;
/** Clearing the board in this many pair-flips or fewer earns the bonus. */
export const PAIR_CLEAN_FLIPS = 18;
export const PAIR_CLEAN_BONUS = 20;
export const PAIR_PARTIAL_POINTS = 60;
/** Unfinished Pair Match: points per pair found. */
export const PAIR_PAIR_POINTS = 8;

/** The four card shapes. */
export const PAIR_SHAPES = ["circle", "square", "triangle", "star"] as const;

export type PairShape = (typeof PAIR_SHAPES)[number];

export interface PairCard {
  shape: PairShape;
  colour: StroopColour;
}

export interface PairPuzzleData {
  type: "pairmatch";
  /** The shuffled board — identical on every phone in the room. */
  cards: PairCard[];
  /** Depth to 200 (25 Oct 2026, depth/matchmaker.ts PAIR_DEPTH_REV): the match streak and the gold pair, up to 200; absent = 150. */
  pairRev?: number;
  /** pairRev 1: the gold pair's face (one of the fifteen), dealt on the server. */
  gold?: PairCard;
}

/* ============================= Colour Flood ============================= */

export const FLOOD_TIME_MS = 60_000;
export const FLOOD_SIZE = 14;
export const FLOOD_CELLS = FLOOD_SIZE * FLOOD_SIZE;
export const FLOOD_COLOURS = 5;
export const FLOOD_MIN_PAR = 10;
export const FLOOD_MAX_PAR = 15;
export const FLOOD_SEARCH_CAP = 2_000_000;
export const FLOOD_PAR_BONUS = 20;
export const FLOOD_PARTIAL_POINTS = 110;

export interface FloodPuzzleData {
  /** Depth revision (logicDepth.ts, 25 Oct 2026): 1 = scored to 200. Absent = the old scoring. */
  depthRev?: number;
  type: "flood";
  /** Row-major colour indices, 0 … FLOOD_COLOURS - 1. */
  grid: number[];
  /** The exact minimum number of taps — shown to the player. */
  par: number;
  /** Server-side only: one route that floods the board in par moves. */
  solution?: number[];
  /** Move limit revision (moveLimits.ts, 13 Oct 2026): 1 = at most `moveLimit` taps count. Absent = no limit. */
  floodRev?: number;
  /** Taps allowed (floodRev 1). */
  moveLimit?: number;
}

/* ============================= Sliding Tiles ============================= */

export const TILES_TIME_MS = 60_000;
export const TILES_SIZE = 3;
export const TILES_COUNT = TILES_SIZE * TILES_SIZE - 1;
export const TILES_MIN_MOVES = 10;
export const TILES_MAX_MOVES = 16;
export const TILES_MIN_BONUS = 20;
export const TILES_PARTIAL_POINTS = 60;
export const TILES_SLIDE_MS = 120;
export const TILES_ATTEMPTS = 600;

/**
 * tilesRev 1 (14 Oct 2026): the 3×3 grid plus one extra cell beside it, on a
 * random side, so one row or column has four cells. Ten cells, tiles 1–9.
 */
export const TILES_EXTRA_MIN_MOVES = 18;
export const TILES_EXTRA_MAX_MOVES = 24;

export interface TilesExtra {
  side: "top" | "bottom" | "left" | "right";
  /** Which column (top / bottom) or row (left / right) of the grid it sits beside, 0–2. */
  index: number;
}

export interface TilesPuzzleData {
  type: "tiles";
  /**
   * One value per cell: 1 … 8 (stored rounds) or 1 … 9 (tilesRev 1) for the
   * tiles and 0 for the gap. Cells 0–8 are the 3×3 grid row-major; cell 9 is
   * the extra cell on tilesRev 1.
   */
  frame: number[];
  /**
   * 1 = the extra-cell board (tiles.ts); absent on stored 3×3 rounds. 3 (25 Oct 2026, the remodel,
   * jumbled.ts) = the 5×5 colour gradient with row and column slides; `frame` is then 25 tiles. 4 (27 Oct 2026,
   * Gradient, Joe's phone notes) = the 5×5 board with swaps, locked tiles and the round's own `palette`.
   */
  tilesRev?: 1 | 2 | 3 | 4;
  /** tilesRev 4: the solved board's colours, cell by cell (the round's colour scheme, gradientPalette.ts). */
  palette?: string[];
  /** tilesRev 3: par moves, shown on the phone (the proved minimum + JUMBLED_PAR_SLACK). */
  par?: number;
  /** tilesRev 2: the round's own clock (90 s); absent = TILES_TIME_MS. */
  timeLimitMs?: number;
  /** tilesRev 1: where the extra cell sits. */
  extra?: TilesExtra;
  /** Server-side only: the exact minimum number of slides. */
  minMoves?: number;
  /** Server-side only: one minimum-length slide order (tile values); tilesRev 4, swaps as a × 100 + b. */
  solution?: number[];
}

/* ============================ Rotating Rings ============================ */

export const RINGS_TIME_MS = 60_000;
export const RINGS_COUNT = 5;
export const RINGS_SEGMENTS = 8;
export const RINGS_COLOURS = 4;
export const RINGS_MIN_SCRAMBLE = 8;
export const RINGS_MAX_SCRAMBLE = 14;
export const RINGS_MIN_TURNS = 7;
export const RINGS_MAX_TURNS = 12;
export const RINGS_MIN_BONUS = 20;
export const RINGS_PARTIAL_POINTS = 60;
/** Unfinished Rotating Rings: points per aligned spoke. */
export const RINGS_SPOKE_POINTS = 12;
export const RINGS_TURN_MS = 150;
export const RINGS_ATTEMPTS = 600;

export interface RingsPuzzleData {
  type: "rings";
  /** Index into the shared link-pattern bank (shown as the legend). */
  pattern: number;
  /** Colour index per segment, per ring, as the round starts. */
  segments: number[][];
  /** Depth batch 4: 1 = par turns and two-rule link patterns only, scored to 200; absent = the old rules. */
  ringsRev?: number;
  /** ringsRev 1: the par (the exact minimum), public so the phone can show "Turns n · Par p". */
  par?: number;
  /** Server-side only: the exact minimum number of taps. */
  minMoves?: number;
  /** Server-side only: one minimum-length turn order. */
  solution?: number[];
}

/* ================================= Hover ================================ */

/** The run is a fixed 60 seconds; the round clock adds three seconds of slack. */
export const HOVER_TIME_MS = 63_000;
/** How long the crash sits on screen before the run is submitted. */
export const HOVER_CRASH_FREEZE_MS = 800;

export interface HoverPuzzleData {
  type: "hover";
  /** Drives every pillar of the run — identical for everyone in the room. */
  seed: number;
  /** Course revision (2 = gold stars, two-gap and moving barriers; 3 = score bands; 4 = about 10% lower, Tuning C; 5 = taller world; 6 = scoring targets; 7 = score bands; 9 = the 200 expansion: tight gates, centre lines, star chains, shields); absent = original course. */
  hoverRev?: number;
}

/* ============================ Swerve / Skyline =========================== */

/** Both arcade runs are a fixed 60 seconds; the round clock adds three seconds. */
export const SWERVE_TIME_MS = 63_000;
export const SKYLINE_TIME_MS = 63_000;
/** How long a crash or a miss sits on screen before the run is submitted. */
export const ARCADE_CRASH_FREEZE_MS = 800;

export interface SwervePuzzleData {
  type: "swerve";
  /** Drives every row of the course — identical for everyone in the room. */
  seed: number;
}

export interface SkylinePuzzleData {
  type: "skyline";
  /** Decides which side the first block slides in from. */
  seed: number;
  /** Rules revision (2 = wind gusts from block 20 and the perfect-streak bonus); absent = original rules. */
  skylineRev?: number;
}

/* =========================== Bin Toss / Bullseye ========================= */

/** Both runs are capped at 60 seconds; the round clock adds three of slack. */
export const BINTOSS_TIME_MS = 63_000;
export const BULLSEYE_TIME_MS = 48_000;

export interface BinTossPuzzleData {
  type: "bintoss";
  /** Drives the wind on all ten throws — identical for everyone in the room. */
  seed: number;
  /** 2 = smaller bucket (85 % opening); 3 = that bucket plus bonus hoops, spinners and wind scaled to it. Absent on rounds stored before rev 2. */
  binRev?: number;
}

export interface BullseyePuzzleData {
  type: "bullseye";
  /** Drives the wind on all ten arrows — identical for everyone in the room. */
  seed: number;
  /** Persisted with the round so every player and the server use the same winds. */
  winds: number[];
  /** 2 = inner bull and drifting balloons; 3 = rev 2 on the score bands; 4 = value balloons across the board (Tuning B). Absent on rounds stored before rev 2. */
  bullRev?: number;
}

/* ================================ Matchup ================================ */

/** A fixed 60-second run (matchupRev 10: 90 s, on its definition's clock); the round clock adds three seconds of slack. */
export const MATCHUP_TIME_MS = 63_000;

export interface MatchupPuzzleData {
  type: "matchup";
  /** Draws the board and each column's refill queue — identical for everyone. */
  seed: number;
  /** Rule revision (2 = Jackpot gem, constant play, own par; 3 = original fall speed; 4 = score bands; 5 = wait for gems to fall, par 2,500, Tuning C; 9 = the taller board with goals, ice and treasure; 10 = 9 over 90 s, swaps into and out of ice that make a line, ice laid once); absent = original rules. */
  matchupRev?: number;
}

/* ================= Snake / Cross / Dual / Ricochet ======================= */

/** Each run is a fixed 60 seconds; the round clock adds three of slack. */
export const SNAKE_TIME_MS = 63_000;
export const CROSS_TIME_MS = 63_000;
export const DUAL_TIME_MS = 63_000;
export const RICO_TIME_MS = 63_000;

export interface SnakePuzzleData {
  type: "snake";
  /** Draws the whole star queue (and rock schedule) — identical for everyone in the room. */
  seed: number;
  /** Rule revision (2 = asteroids; 3 = shower; 4 = score bands; 5 = taller grid, Tuning E; 6 = more rocks, Tuning F); absent = original rules. */
  snakeRev?: number;
}

export interface CrossPuzzleData {
  type: "cross";
  /** Draws every crossing's traffic — identical for everyone in the room. */
  seed: number;
  /** Course revision (2 = fair early gaps, cyclists, roadworks); absent = original traffic. */
  crossRev?: number;
}

export interface DualPuzzleData {
  type: "dual";
  /** Draws both obstacle schedules — identical for everyone in the room. */
  seed: number;
}

export interface RicoPuzzleData {
  type: "ricochet";
  /** Lays out the whole shaft of spikes — identical for everyone. */
  seed: number;
}

/* =================== Breaker / Rally / Steady ============================ */

/** Each run is a fixed 60 seconds; the round clock adds three of slack. */
export const BREAKER_TIME_MS = 93_000;
export const RALLY_TIME_MS = 63_000;
export const STEADY_TIME_MS = 63_000;

export interface BreakerPuzzleData {
  type: "breaker";
  /** Draws the wall and which bricks are solid — identical for everyone. */
  seed: number;
  /** Rules revision (2 = sliding rows, one ×2, weaker laser and ×3, Fireball; 3 = rev 2 on the score bands; 4 = 3.5 s Fireball, Tuning B; 5 = 2.5 s Fireball, Tuning F; 6 = the taller 390 × 730 court); absent = original rules. */
  brkRev?: number;
}

/* ================================ Pinball ================================ */

/** pinRev 1–4's fixed 60-second, three-ball run; the round clock adds three of slack (63 s). pinRev 5 runs 90 s on a 93 s clock (src/puzzles/pinball.tsx). */
export const PINBALL_TIME_MS = 63_000;

export interface PinballPuzzleData {
  type: "pinball";
  /** Stored like every arcade seed; the table itself is fixed, so it plays the same for everyone whatever the seed. */
  seed: number;
  /** Rules revision (1 = the first table, scored on the Oct 2026 band shape; 4 the taller table; 5 it for 90 s). */
  pinRev?: number;
}

/* ====================== Cards & Board (30 Oct 2026) ====================== */

/** Minesweeper: a 90 s run on a 93 s clock (the round clock adds three seconds of slack). */
export const MINESWEEPER_TIME_MS = 93_000;

export interface MinesweeperPuzzleData {
  type: "minesweeper";
  /** Deals the board (mines and the opening) in the sim, identical for everyone; solvable by logic alone. */
  seed: number;
  /** Rules revision (1 = the first board, on the arcade scoring standard). */
  minesRev?: number;
}

/** Mahjong Solitaire: a 120 s run on a 123 s clock. */
export const MAHJONG_TIME_MS = 123_000;

export interface MahjongPuzzleData {
  type: "mahjong";
  /** Deals the faces (built backwards, so the board clears) in the sim, identical for everyone. */
  seed: number;
  /** Rules revision (1 = the first stack, on the arcade scoring standard; 2 = the same with Undo and Reset). */
  mahjongRev?: number;
}

/* =========================== Sports (Oct 2026) =========================== */

/** Home Run Derby's 60-second, ten-pitch run; the round clock adds three of slack (63 s). */
export const HOMERUN_TIME_MS = 63_000;
/** Free Kick's 75-second, ten-kick run, plus three of slack. */
export const FREEKICK_TIME_MS = 78_000;
/**
 * Apex's 90-second, two-lap race, plus three of slack; since 31 Oct 2026 (racingRev 2) also its 5.5-second start
 * lights before the race clock starts (99 s; racingRev 1 runs still end at their own 90 s, as Tempo's and Gemstone's).
 */
export const RACING_TIME_MS = 99_000;

export interface HomerunPuzzleData {
  type: "homerun";
  /** A proved seed (homerunDeal.server.ts): the whole pitch sequence and the signs come from it, identical for everyone. */
  seed: number;
  /** Rules revision (1 = the first run, on the arcade scoring standard). */
  homerunRev?: number;
}

export interface FreekickPuzzleData {
  type: "freekick";
  /** A proved seed (freekickDeal.server.ts): every kick's spot, wall, keeper, wind and the targets. */
  seed: number;
  /** Rules revision (1 = the first run, on the arcade scoring standard). */
  freekickRev?: number;
}

export interface RacingPuzzleData {
  type: "racing";
  /** A proved seed (racingDealV2.server.ts; racingDeal.server.ts on rev 1): the track, identical for everyone. */
  seed: number;
  /** Rules revision (1 = the first race, on the arcade scoring standard; 2 = the F1 lights start and the softer joystick). */
  racingRev?: number;
}

/* ============================ Cards & Board ============================= */

/** FreeCell: a 120-second run; the round clock adds three of slack. */
export const FREECELL_TIME_MS = 123_000;
/** Summit (tripeaks): a 60-second run. */
export const TRIPEAKS_TIME_MS = 63_000;
/** Full House (pokersquares): a 60-second run. */
export const POKERSQUARES_TIME_MS = 63_000;
/** Five Hands: a 60-second run. */
export const FIVEHANDS_TIME_MS = 63_000;

export interface FreecellPuzzleData {
  type: "freecell";
  /** The bank deal's index (src/lib/arcade/cards/freecellDeals.data.ts): the same deal and par for everyone. */
  seed: number;
  /** Rules revision (1 = the first rules, on the arcade scoring standard; 2 = Undo and Reset, 31 Oct 2026). */
  freecellRev?: number;
}

export interface TripeaksPuzzleData {
  type: "tripeaks";
  /** The bank deal's index (src/lib/arcade/cards/tripeaksDeals.data.ts), every one proved clearable. */
  seed: number;
  /** Rules revision (1 = the first rules, on the arcade scoring standard). */
  tripeaksRev?: number;
}

export interface PokerSquaresPuzzleData {
  type: "pokersquares";
  /** Builds the target grid and its dealing order in the sim: the same 25 cards in the same order for everyone. */
  seed: number;
  /** Rules revision (1 = the first rules, on the arcade scoring standard; 2 = the core full at the elite median, 31 Oct 2026). */
  pokerSquaresRev?: number;
}

export interface FiveHandsPuzzleData {
  type: "fivehands";
  /** Shuffles the deck and proves its witness in the sim: the same 45 cards in the same order for everyone. */
  seed: number;
  /** Rules revision (1 = the first rules, on the arcade scoring standard). */
  fiveHandsRev?: number;
}

export interface RallyPuzzleData {
  type: "rally";
  /** Draws the opening angle and every bounce nudge — identical for everyone. */
  seed: number;
  /** 2 = far-wall targets and a bumper from 30 s; 3 = rev 2 on the score bands; 4 = pads keep to their own half (Tuning B); 5 = a second bumper from 45 s (Tuning F); 6 = the taller 390 × 730 court. Absent on rounds stored before rev 2. */
  rallyRev?: number;
}

export interface SteadyPuzzleData {
  type: "steady";
  /** Draws the whole winding track — identical for everyone. */
  seed: number;
}

/* =================== Slice / Bubble Pop / Beat ============================ */

/** Each run is a fixed 60 seconds; the round clock adds three of slack. */
export const SLICE_TIME_MS = 63_000;
export const BUBBLE_TIME_MS = 93_000;
export const BEAT_TIME_MS = 63_000;

/* ======================= Whack-a-Target / Tents ========================= */

/** A fixed 60-second run on the arcade engine; the clock adds three of slack. */
export const WHACK_TIME_MS = 63_000;
export const TENTS_TIME_MS = 90_000;

/** Ten Drop: a fixed 90-second run on the arcade engine, plus clock slack. */
export const TENDROP_TIME_MS = 93_000;
/** Clay Shoot: a fixed 60-second run on the arcade engine, plus clock slack. */
export const CLAYSHOOT_TIME_MS = 63_000;

export interface TenDropPuzzleData {
  type: "tendrop";
  /** Draws every target and tile queue — identical for everyone. */
  seed: number;
  /**
   * Score revision (1 = the Oct 2026 puzzle shape: 120 + speed, 110 for nine; 2 = mapped bands; 3 = raw; 4 = gold
   * tiles and a finish to 200, docs/depth/d2-number-tenfall.md). Absent = 13 per target.
   */
  tenRev?: number;
}

/** Letterfall: a fixed 90-second run on the arcade engine, plus clock slack. */
export const WORDFALL_TIME_MS = 93_000;

export interface WordfallPuzzleData {
  type: "wordfall";
  /** Draws the letter queue and drop columns — identical for everyone. */
  seed: number;
  /** Gameplay revision (1 = the original rules). */
  wordfallRev?: number;
  /** Speed-par stamp (set on every new puzzle by generatePuzzle). */
  speedPar?: number;
}

export interface ClayShootPuzzleData {
  type: "clayshoot";
  /** Draws the whole launch schedule — identical for everyone. */
  seed: number;
  /** 2 = seeded white birds and bird-hit penalties; 3 = 10–12 birds; 4 = empty shots cost beyond 30; 5 = 14–16 birds; 6 = the taller 360 × 680 sky; 7 score bands; 8 quick shots; 9 depth to 200 (doubles and the hit streak). Absent = original clay-only run. */
  clayRev?: number;
}

export interface WhackPuzzleData {
  type: "whack";
  /** Draws the whole pop schedule — identical for everyone. */
  seed: number;
  /** Scoring targets (18 Oct 2026): 1 = the score lifted through WHACK_TARGET_LIFT; 2 score bands; 3 depth to 200 (the gold combo and diamonds); absent = the original score. */
  whackRev?: number;
}

export interface TentsPuzzleData {
  /** Depth revision (logicDepth.ts, 25 Oct 2026): 1 = scored to 200. Absent = the old scoring. */
  depthRev?: number;
  /** Rows when taller than wide (the depth revision's bigger board, 25 Oct 2026); absent = `size` rows. */
  height?: number;
  type: "tents";
  size: number;
  trees: number[];
  rowCounts: number[];
  colCounts: number[];
  /** The unique tent layout — private until the reveal. */
  solution?: number[];
}

export interface SlicePuzzleData {
  type: "slice";
  /** Draws the whole launch schedule, bombs included — identical for everyone. */
  seed: number;
  /** Rules revision (2 = mayonnaise bottle, chilli ends the combo; 3 = score bands; 4 = wider, longer blade, Tuning C; 5 = the 620 px slice, Tuning F; 6 = the taller 390 × 730 board); absent = original. */
  sliceRev?: number;
}

export interface BubblePuzzleData {
  type: "bubble";
  /** Draws the starting field and the whole bubble queue — identical for everyone. */
  seed: number;
  /** Rule revision (2 = Joker, Bomb and Torpedo bubbles in the queue; 3 = score bands; 4 = the directional Torpedo, Tuning F; 5 = the deeper 390 × 730 tank); absent = original rules. */
  bubbleRev?: number;
}

export interface BeatPuzzleData {
  type: "beat";
  /** Draws the whole chart — identical for everyone. */
  seed: number;
  /** 2 = swipe notes in the second half; 3 = score bands; 4 = about 10% higher (Tuning C); 5 = a tenth fewer notes (Tuning F); 6 = the taller 390 × 730 lanes. Absent on rounds stored before rev 2. */
  beatRev?: number;
}

/* ============================== Tile Grid =============================== */

export interface TileGridPuzzleData {
  type: "tilegrid";
  /** The twelve shuffled letter tiles — identical for everyone. */
  tray: string[];
  /** Server-side only until reveal: one reference grid, 49 cells, "" for empty. */
  solution?: string[];
  /** Word depth (25 Oct 2026): 1 = scored to 200 by the stretch curve (depth/tilegrid.server.ts). Absent on older rounds. */
  tileGridRev?: number;
}

/* ============================== Word Slide ============================== */

export interface WordSlidePuzzleData {
  type: "wordslide";
  /** The scrambled 5×5 grid, row-major. */
  grid: string[];
  /** The number of scramble shifts — shown to the player as par. */
  par: number;
  /** Server-side only until reveal: the five intended words. */
  words?: string[];
  /** Par moves (25 Oct 2026, word depth d1): 1 = a finish within par adds the par bonus, up to 200. Absent on older rounds. */
  wordSlideRev?: number;
}

/* ================================ Balance =============================== */

export interface BalanceScale {
  /** Fixed grey weights: peg 0–3 are left 4…1, peg 4–7 are right 1…4 (10 notches: 0–4 left 5…1, 5–9 right 1…5). */
  fixed: { peg: number; w: number }[];
  /** Loose gold weights the player must place. */
  tray: number[];
  /** Notches, when not 8: balanceRev 2's fourth scale has 10 (5 a side). */
  pegs?: number;
}

export interface BalancePuzzleData {
  type: "balance";
  /** Number depth to 200 (numberDepth.ts, 25 Oct 2026): 1 = scored to 200; absent on rounds dealt before. */
  depthRev?: number;
  scales: BalanceScale[];
  /** Server-side only until reveal: one balanced peg per tray weight, per scale. */
  solutions?: number[][];
  /** Placement limit revision (moveLimits.ts, 13 Oct 2026): 1 = harder small scales, `placeLimits` hangs per scale, the hang counts recorded in the answer. 2 (14 Oct 2026) = as 1, plus a fourth 10-notch scale, 120 s and the rev-2 scale points (balance.ts). Absent = no limit. */
  balanceRev?: number;
  /** Hangs allowed per scale (balanceRev 1: 6 / 8 / 10; 2: 6 / 8 / 10 / 12; 3: 9 / 12 / 15 / 18). */
  placeLimits?: number[];
  /** balanceRev 2: the round clock (120,000 ms). Absent on stored rounds, which keep the registry's 90 s. */
  timeLimitMs?: number;
}

/* ========================== Wavefront / Bastion ========================== */

/** Wavefront (wavRev 2) runs 90 seconds and Bastion 60; the round clock adds three of slack. */
export const WAVEFRONT_TIME_MS = 93_000;
export const BASTION_TIME_MS = 63_000;

export interface WavefrontPuzzleData {
  type: "wavefront";
  /** Draws every wave and enemy shot — identical for everyone. */
  seed: number;
  /** Rules revision (2 = 90 s, continuous waves, divers, boss; 3 = score bands; 4 = shaped formations; 5 = slower waves 3–4 and a timed boss kill, Tuning C; 6 = the taller 390 × 730 world); absent = original 60 s rules. */
  wavRev?: number;
}

export interface BastionPuzzleData {
  type: "bastion";
  /** Draws the whole spawn schedule — identical for everyone. */
  seed: number;
}

/** Rooftop Run: a fixed 60-second run; the round clock adds three of slack. */
export const ROOFTOP_TIME_MS = 63_000;

export interface RooftopPuzzleData {
  type: "rooftop";
  /** Draws the whole course — identical for everyone. */
  seed: number;
}

/** Flip (Roofbound): a fixed 60-second run; the round clock adds three of slack. */
export const FLIP_TIME_MS = 63_000;

export interface FlipPuzzleData {
  type: "flip";
  /** Draws the whole corridor — identical for everyone. */
  seed: number;
  /** Rules revision (2 = bend at 15 s, crumbling tiles, stars, larger runner; 3 = score bands; 4 = bend at 10 s, about 10% higher, Tuning C); absent = original. */
  flipRev?: number;
}

/** Junction: a fixed 60-second run; Ink Bridge: 120 seconds. The round clock adds three of slack. */
export const JUNCTION_TIME_MS = 63_000;
export const INKBRIDGE_TIME_MS = 123_000;

export interface JunctionPuzzleData {
  type: "junction";
  /** Draws every car arrival — identical for everyone. */
  seed: number;
  /** Rules revision (2 = diagonal roads every 12 s, lights at their lanes, buses); absent = original rules. */
  junctionRev?: number;
}

export interface InkBridgePuzzleData {
  type: "inkbridge";
  /** 2 = white birds, fewer on levels 6–10; 3 = Rainbow Bridge (moving pot, live levels); 4 = that plus optional gold stars; 5 = score bands; 6 = about 6.5% lower (Tuning C). Absent = original blocks. */
  inkRev?: number;
  /** Draws the drops and bucket moves — identical for everyone. */
  seed: number;
}

/** Burst: a fixed 90-second run; the round clock adds three of slack. */
export const BURST_TIME_MS = 93_000;

export interface BurstPuzzleData {
  type: "burst";
  /** Draws every wave — identical for everyone. */
  seed: number;
  /** Rules revision (2 = halved BURST/SHIELD drops and the FREEZE drop; 3 = rev 2 on the score bands; 4 = the taller 390 × 650 arena); absent = original rules. */
  burstRev?: number;
}

/** Orbit and Swing: fixed 60-second runs; the round clock adds three of slack. */
export const ORBIT_TIME_MS = 93_000;
export const SWING_TIME_MS = 63_000;

/** Snip: a fixed 60-second run on the arcade engine. */
export const SNIP_TIME_MS = 63_000;

export interface SnipPuzzleData {
  type: "snip";
  /** Draws the level order and pin wobble — identical for everyone. */
  seed: number;
  /** 2 = ten levels drawn by band from the 30 templates; 3 = from the 60 (orchard elements); 4 = 3 on the score bands; 5 = the tall bank (Tuning E); 6 = the bigger tall bank. Absent = fixed legacy order. */
  snipRev?: number;
}

export interface OrbitPuzzleData {
  type: "orbit";
  /** Draws the planet course — identical for everyone. */
  seed: number;
  /** 3 = wider zig-zag world with a scrolling camera; 4 = black holes; 5 = score bands; 6 = fly-in (Tuning A); 7 = swept black holes (Tuning F); 8 = rev 7 in a taller 390 × 650 view; 12 = the expansion to 200 (450 × 782 view, extras); 13 = rev 12 scored on the arcade standard; absent = legacy fixed-camera course. */
  orbitRev?: number;
  /** Rev3 only: the proved 0..ORBIT_TOTAL planet layout, shipped so client play, reveal and grading never re-prove the course. */
  planets?: OrbitRev3CompactPlanet[];
  /** Rev 4 and 5: proved black holes (rev 5 may carry none), [from, to, x, y] each (orbitHoleBank.server.ts). */
  holes?: OrbitHoleRow[];
  /** orbitRev 12 and 13 (the expansion to 200): the course's proved stardust, slingshot moons and asteroid fields (orbitXpBank.server.ts). */
  extras?: OrbitExtrasRow;
}

export interface SwingPuzzleData {
  type: "swing";
  /** 4 = dragon chase; 5 = score bands; 6 = touch stars (Tuning A); 7 = about 10% lower (Tuning C); 8 = stars spread evenly (Tuning F); 9 = the taller 390 × 730 cavern; 13 = the 200 expansion; 14 = the assault course (sections of ledges, hooks and squeezes); 15 = the swinging course (mostly hook-to-hook swinging, short ledge runs). */
  swingRev?: number;
  /** Draws the cavern — identical for everyone. */
  seed: number;
}

/** Tilt and Hot Floor: fixed 90-second runs. The round clock adds three seconds of slack. */
export const TILT_TIME_MS = 93_000;
export const HOTFLOOR_TIME_MS = 123_000;

export interface TiltPuzzleData {
  type: "tilt";
  /** Draws every maze — identical for everyone. */
  seed: number;
  /** Rules revision (2 = bonus stars, two marbles from maze 3, rimmed cups; 3 = score bands; 4 = amber start away from its cup, stars at the holes, Tuning C); absent = original rules. */
  tiltRev?: number;
}

export interface HotFloorPuzzleData {
  type: "hotfloor";
  /** Draws every staged floor route and countdown — identical for everyone. */
  seed: number;
}

/* ============================ Shikaku / Light Up ======================== */

export const SHIKAKU_TIME_MS = 90_000;
export const LIGHTUP_TIME_MS = 90_000;
/** Ball Track: a 60 s arcade run plus the shared 3 s arcade slack. */
export const BALLTRACK_TIME_MS = 63_000;
export const WORDSEARCH_TIME_MS = 120_000;

/** Number Pyramid: four rising-difficulty pyramids in one 120-second round. */
export const NUMPYRAMID_TIME_MS = 120_000;

export interface NumberPyramidBoardData {
  rows: 4 | 5;
  givens: (number | null)[];
  tray: number[];
}

export interface NumberPyramidPuzzleData {
  type: "numpyramid";
  /** Number depth to 200 (numberDepth.ts, 25 Oct 2026): 1 = scored to 200; absent on rounds dealt before. */
  depthRev?: number;
  pyramids: NumberPyramidBoardData[];
  /** Every board's values — private until the reveal. */
  solutions?: number[][];
}

/** Trail: a 6×6 king-move path from 1 to 36. */
export const TRAIL_TIME_MS = 120_000;

export interface TrailPuzzleData {
  type: "trail";
  /** Number depth to 200 (numberDepth.ts, 25 Oct 2026): 1 = scored to 200; absent on rounds dealt before. */
  depthRev?: number;
  /** 36 cells row by row; the step number for given cells, else null. */
  givens: (number | null)[];
  /** Cell index for each step 1–36 — private until the reveal. */
  solution?: number[];
}

/** Brimful: four pouring puzzles in one round (120 s is a first guess, to tune after testing). */
export const MEASURE_TIME_MS = 120_000;

export interface MeasureBoardData {
  /** Jug capacities in litres, left to right. */
  caps: number[];
  /** Litres in each jug at the start (and after Reset). */
  start: number[];
  /** True when Fill (from the tap) and Empty (down the drain) are available. */
  tap: boolean;
  /** "amount": `target` litres in any one jug. "split": every jug holds its `split` amount. */
  goal: "amount" | "split";
  target?: number;
  split?: number[];
}

export interface MeasurePuzzleData {
  type: "measure";
  /** Number depth to 200 (numberDepth.ts, 25 Oct 2026): 1 = scored to 200; absent on rounds dealt before. */
  depthRev?: number;
  /** Rules revision; 1 = the first rules; 2 = a per-board move limit (`moveLimits`, moveLimits.ts, 13 Oct 2026). */
  measureRev: number;
  /** Moves allowed per board (measureRev 2); public, rounded so it never shows the minimum. */
  moveLimits?: number[];
  boards: MeasureBoardData[];
  /** Breadth-first minimum moves per board — private until the reveal. */
  minMoves?: number[];
  /** depthRev 1: each board's par pours (its fewest actions, public: the par-pours bonus aims at it). */
  par?: number[];
  /** One shortest action list per board — private until the reveal. */
  solutions?: string[];
}

/** Checkout: five darts boards in 90 s. */
export const CHECKOUT_TIME_MS = 90_000;

export interface CheckoutStageData {
  /** The 20 wedge values clockwise from the top. */
  wedges: number[];
  /** Score to bring to exactly zero. */
  target: number;
  /** Most darts allowed. */
  maxDarts: number;
  /** When true the stage needs exactly `maxDarts` darts. */
  exactDarts?: boolean;
  /** Ring the last dart must land in: 2 = double, 3 = treble. */
  finish: 2 | 3;
  /** True when the board has a thin x4 ring. */
  quad?: boolean;
  /**
   * checkoutRev 2 (depthRev 1): the stage may also check out on a big finish, the Bull or (on a double-finish
   * board) a treble, for the big-finish bonus (numberDepth.ts isBigFinishDart).
   */
  bigFinish?: boolean;
}

export interface CheckoutPuzzleData {
  type: "checkout";
  /** Number depth to 200 (numberDepth.ts, 25 Oct 2026): 1 = scored to 200; absent on rounds dealt before. */
  depthRev?: number;
  /** Rules revision; 1 = the first rules. */
  checkoutRev: number;
  stages: CheckoutStageData[];
  /** Fewest darts per stage (exhaustive search) — private until the reveal. */
  minDarts?: number[];
  /** One shortest route per stage ("wedge:ring,…", wedge 20 = bull) — private until the reveal. */
  routes?: string[];
}

/** Ballpark: three lines of five numbers in 75 s (the registry limit: stored rounds; numlineRev 2 puzzles carry 90 s as `timeLimitMs`). */
export const NUMLINE_TIME_MS = 75_000;

/** An exact value: (num ÷ den) + rootCoef × √root (rootCoef 0 when rational). */
export interface NumlineValue {
  num: number;
  den: number;
  rootCoef: number;
  root: number;
}

export interface NumlineStageData {
  /** Line end values; ticks are labelled only at the ends (and 0 when it lies inside). */
  lo: number;
  hi: number;
  /** What each item shows, in play order. */
  items: string[];
}

export interface NumlinePuzzleData {
  type: "numline";
  /** Number depth to 200 (numberDepth.ts, 25 Oct 2026): 1 = scored to 200; absent on rounds dealt before. */
  depthRev?: number;
  /** Rules revision; 1 = the first rules, 2 = 90 s and the rev-2 item curve (numline.ts). */
  numlineRev: number;
  /** numlineRev 2: the round clock (90,000 ms). Absent on stored rounds, which keep the registry's 75 s. */
  timeLimitMs?: number;
  stages: NumlineStageData[];
  /** Exact value of every item, stage by stage — private until the reveal. */
  values?: NumlineValue[][];
}

/** Dig: 60 s of water flowing at 10 steps per second. */
export const DIG_TIME_MS = 60_000;

export interface DigPuzzleData {
  type: "dig";
  cols: number;
  rows: number;
  /** One character per cell: # rock, s sand, . empty, D drain, G side gap, L lava, a buried acid. */
  tiles: string;
  /** Starting water units per cell (0–4), one digit per cell. */
  water: string;
  /** Most sand cells the player may dig (minimum + 3). */
  budget: number;
  minDigs: number;
  /** Clean units each drain needs, in drain-cell order. */
  targets: number[];
  pool: number;
  /** Acid and lava cells. */
  hazards: number[];
  /** "standard" (one drain) or "hard" (two drains). */
  tier: "standard" | "hard";
  /** The intended dig route — private until the reveal. */
  route?: number[];
  /** The intended dig log ("step:cell,…") — private. */
  intended?: string;
}

export interface BallTrackPuzzleData {
  type: "balltrack";
  /** Bank index + 1; checked against the submitted run. */
  seed: number;
  course: BtCourse;
  tier?: number;
  /** Playbook piece actions and the proving event log — private until the reveal. */
  par?: number;
  playbook?: string;
  /** Rules revision (2 = turn occupied tubes, bottom-row switch points; 3 = rev 2 on the score bands; 4 = the taller 12-row board, its course from the tall bank); absent = original. */
  btRev?: number;
}

/** Letter Wheel: 120 s to fill a small crossword from a wheel of letters. */
export const LETTERWHEEL_TIME_MS = 100_000;

export interface LetterWheelSlot {
  row: number;
  col: number;
  across: boolean;
  len: number;
}

export interface LetterWheelPuzzleData {
  type: "letterwheel";
  cols: number;
  rows: number;
  /** Wheel letters, in starting order. */
  letters: string;
  slots: LetterWheelSlot[];
  /** Word for each slot — private until the reveal. */
  words?: string[];
  /**
   * 1 (14 Oct 2026): 11–14 word bank and the attempt-log answer (letterWheel.ts); absent = original rules.
   * 2 (25 Oct 2026, word depth): rev 1 plus the bonus jar (real non-crossword words fill it; up to 50 more).
   */
  wheelRev?: number;
  /** wheelRev 2: the jar's size in drops (public; LW_JAR_DROPS unless the board's bonus words hold fewer). */
  jarSize?: number;
}

/** Strikeout: reveal five hidden five-letter words a letter at a time; five strikes end it. */
export const STRIKEOUT_TIME_MS = 100_000;

export interface StrikeoutPuzzleData {
  type: "strikeout";
  /**
   * Rules revision (1 = five five-letter words at once; 2 = five 7–8 letter words one at a time, 14 Oct 2026;
   * 3 = rev 2 with ten strikes, three vowel guesses per word, one more starting letter on words 1–3 and
   * 1.5 per strike left, 15 Oct 2026; 4 = rev 3 with twelve strikes and 1.25 per strike left, 19 Oct 2026;
   * 5 = rev 4's rules scored to 200 with the early-solve bonus, 25 Oct 2026).
   */
  strikeoutRev: number;
  rows: number;
  /** Rev 1: every word's length; rev 2: the longest word's length (each word's own length is its givens pattern's). */
  length: number;
  /** Rev 2–4: each word's starting letters as a public pattern ("__N_____"; every copy of a starting letter shows). */
  givens?: string[];
  /** The five hidden words, upper case — private until the reveal. */
  words?: string[];
}

/** Cryptogrid: a filled 7 × 7 crossword with a number in every white cell. */
export const CODEWORD_TIME_MS = 120_000;

export interface CodewordPuzzleData {
  type: "codeword";
  /** Rules revision (1 = first release, four givens; 2 = five givens, 14 Oct 2026; 3 = six givens, the sixth leaving the most words one number from done, 19 Oct 2026; 4 = rev 3's board scored to 200, 25 Oct 2026). */
  codewordRev: number;
  size: number;
  /** size × size cells, row by row: 0 = black square, otherwise the cell's number (1…numbers). */
  cells: number[];
  /** How many different numbers (= different letters) the grid uses. */
  numbers: number;
  /** Numbers shown at the start, each with its letter. */
  givens: { n: number; letter: string }[];
  /** Letter of each number (index n − 1), upper case — private until the reveal. */
  solution?: string;
}

/** Swapword: swap tiles until six crossing words read correctly. */
export const SWAPWORD_TIME_MS = 120_000;

export interface SwapwordPuzzleData {
  type: "swapword";
  /** Rules revision (1 = first release, also fixes the board shape; 2 = budget at least 16, 14 Oct 2026; 3 = budget minimum + 8, 19 Oct 2026). */
  swapwordRev: number;
  /** Starting letters, one per tile in the layout's tile order, upper case. */
  start: string;
  /** Proven fewest swaps that solve the board. */
  minSwaps: number;
  /** Swap budget: rev 1 minSwaps + 5; rev 2 max(16, minSwaps + 5); rev 3 minSwaps + 8. Running out ends the round. */
  maxSwaps: number;
  /** Solved letters in tile order — private until the reveal. */
  solution?: string;
}

export interface WordSearchPlacement {
  word: string;
  cells: number[];
}

export interface WordSearchPuzzleData {
  type: "wordsearch";
  size: number;
  /** size × size letters, row by row. */
  grid: string;
  category: string;
  wordCount: number;
  /** Lookout rev (14 Oct 2026): 1 = wider bank (76 themes) and public word lengths; 2 = no theme-name words; 3 = a hidden bonus word (25 Oct 2026). Absent on stored rounds. */
  wordSearchRev?: number;
  /** Rev 1: each hidden word's letter count, in placement order (public: the chips show it before a word is found). */
  wordLengths?: number[];
  /** Where each hidden word lies — private until the reveal. */
  placements?: WordSearchPlacement[];
  /** Rev 3 (25 Oct 2026, word depth): the unlisted on-theme bonus word and where it lies — private until the reveal. */
  bonus?: WordSearchPlacement;
}

export interface ShikakuPuzzleData {
  /** Depth revision (logicDepth.ts, 25 Oct 2026): 1 = scored to 200. Absent = the old scoring. */
  depthRev?: number;
  /** Rows when taller than wide (the depth revision's bigger board, 25 Oct 2026); absent = `size` rows. */
  height?: number;
  type: "shikaku";
  size: number;
  clues: { cell: number; n: number }[];
  /** The unique partition — private until the reveal. */
  solution?: { r0: number; c0: number; r1: number; c1: number }[];
}

export interface LightUpPuzzleData {
  /** Depth revision (logicDepth.ts, 25 Oct 2026): 1 = scored to 200. Absent = the old scoring. */
  depthRev?: number;
  /** Rows when taller than wide (the depth revision's bigger board, 25 Oct 2026); absent = `size` rows. */
  height?: number;
  /** Puzzle score shape stamp (puzzleScoreRev.ts; set by generatePuzzle, kept on the banked intro example). */
  puzzleScoreRev?: number;
  type: "lightup";
  size: number;
  walls: number[];
  /** Parallel to walls: the number, or -1 for a plain wall. */
  wallNumbers: number[];
  /** The unique bulb layout — private until the reveal. */
  solution?: number[];
}

/* ============================ Sports (30 Oct 2026) ============================ */

/** The three Sports games run 120 s; the round clock adds three seconds of slack. */
export const MINIGOLF_TIME_MS = 123_000;
export const POOL_TIME_MS = 123_000;
export const CURLING_TIME_MS = 123_000;

export interface MinigolfPuzzleData {
  type: "minigolf";
  /** Lays out the five holes (a course from the proven bank, minigolfBank.server.ts): identical for everyone in the room. */
  seed: number;
  /** golfRev 1: the arcade scoring standard (docs/arcade-standard/minigolf.md). */
  golfRev?: number;
  /** Each hole's par (its best proven route + 1), stored with the round. */
  pars: number[];
}

export interface PoolPuzzleData {
  type: "pool";
  /** Deals the layout (a table from the proven bank: poolBankV2.server.ts on poolRev 2, poolBank.server.ts on 1): identical for everyone in the room. */
  seed: number;
  /** poolRev 1: the arcade scoring standard; poolRev 2 (31 Oct 2026): the cue round the ball, the meter, the spin dot anywhere on the face (docs/arcade-standard/pool.md). */
  poolRev?: number;
}

export interface CurlingPuzzleData {
  type: "curling";
  /** Places the opponent's stones (a sheet from the proven bank, curlingBank.server.ts): identical for everyone in the room. */
  seed: number;
  /**
   * curlRev 1: the arcade scoring standard (docs/arcade-standard/curling.md). curlRev 2 (31 Oct 2026, dealt from
   * curlingBankV2.server.ts): the start along the hog line and side brushing, the same parts. curlRev 3 (1 Nov 2026,
   * dealt from curlingBankV3.server.ts): the weight meter's draw zone, the aim line, a gentler weight line and the
   * re-fitted closeness core, the same parts.
   */
  curlRev?: number;
}
