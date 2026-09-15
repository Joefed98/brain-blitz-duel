export type PuzzleType =
  | "wordsmith"
  | "oddword"
  | "target"
  | "numseq"
  | "sequence"
  | "reverse"
  | "reaction"
  | "missing"
  | "equation"
  | "stroop"
  | "spatial"
  | "gonogo"
  | "patcomp"
  | "symscan"
  | "rotmatch"
  | "numhunt"
  | "oddshape"
  | "chaincalc"
  | "wordmatch"
  | "pctsprint"
  | "numspan"
  | "stopwatch"
  | "countup"
  | "mirmatch"
  | "wordhunt"
  | "unblock"
  | "blockparty";

export type PuzzleCategory = "word" | "number" | "memory" | "speed" | "attention" | "pattern";

/** Wordsmith: build as many words as you can from the tiles. */
export const WORDSMITH_TIME_MS = 60_000;
export const WORDSMITH_MIN_LENGTH = 4;
export const WORDSMITH_MIN_WORDS = 20;
/** Par is this share of every point available on the board. */
export const WORDSMITH_PAR_SHARE = 0.35;
/** Boards are only used when par lands in a fair band. */
export const WORDSMITH_MIN_PAR = 12;
export const WORDSMITH_MAX_PAR = 40;
const WORDSMITH_POINTS: Record<number, number> = { 4: 1, 5: 2, 6: 4, 7: 7, 8: 11 };

export function wordsmithPoints(word: string): number {
  return WORDSMITH_POINTS[word.trim().length] ?? 0;
}

export interface WordsmithWord {
  word: string;
  points: number;
}

export interface WordsmithPuzzleData {
  type: "wordsmith";
  /** The seven or eight tiles, in the order every player sees them. */
  letters: string[];
  /** Server-side only until the reveal: every word the board allows. */
  words?: WordsmithWord[];
  totalPoints?: number;
  par?: number;
  source?: string;
}

export interface OddWordPuzzleData {
  type: "oddword";
  theme: string;
  /** Four words in the shuffled order both players see. */
  words: string[];
  odd: string;
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
  /** The six starting tiles, in the order both players see them. */
  tiles: number[];
  /** The three-digit number to reach exactly. */
  target: number;
  /** One valid solution, kept server-side until the reveal. */
  solution: TargetStep[];
}

export interface NumberSequencePuzzleData {
  type: "numseq";
  numbers: number[];
  answer: number;
  /** Plain-English name of the rule, shown on the answer reveal. */
  rule: string;
}

export interface SequencePuzzleData {
  type: "sequence" | "reverse";
  tiles: number[];
  /** Reverse Recall only: the server-side answer order. */
  answerOrder?: number[];
}

export type OddShapeBase = "circle" | "square" | "triangle" | "star" | "hexagon" | "arrow";
export type OddShapeDifference = "rotated" | "smaller" | "shade" | "notched" | "flipped";

export interface OddShapePuzzleData {
  type: "oddshape";
  base: OddShapeBase;
  colour: StroopColour;
  difference: OddShapeDifference;
  /** Visible per-cell variants; only one entry contains the generated difference. */
  variants: (OddShapeDifference | null)[];
  oddIndex: number;
  differenceLabel: string;
}

export interface ChainOperation {
  operator: Operator;
  operand: number;
}

export interface ChainCalculationPuzzleData {
  type: "chaincalc";
  start: number;
  operations: ChainOperation[];
  intermediates: number[];
  answer: number;
}

export interface ReactionPuzzleData {
  type: "reaction";
  /** Milliseconds before the gold flash of each attempt (generated once). */
  delays: number[];
}

export interface MissingLettersPuzzleData {
  type: "missing";
  /** The complete eight- or nine-letter word, upper case. */
  word: string;
  /** Zero-based positions shown as blank tiles. */
  blanks: number[];
}

export type Operator = "+" | "-" | "×" | "÷";

export interface EquationPuzzleData {
  type: "equation";
  numbers: number[];
  target: number;
  /** The one operator pair that makes the equation true, left to right. */
  operators: Operator[];
}

export type StroopColour = "RED" | "BLUE" | "GREEN" | "PURPLE" | "PINK";

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
  items: StroopItem[];
}

export interface SpatialPuzzleData {
  type: "spatial";
  /** Six tile indices (0-24) of a 5x5 grid, lit together at the start. */
  tiles: number[];
}

export type GlyphShape = "circle" | "square" | "triangle" | "star";
/** Go / No-Go and Pattern Completion reuse the Colour Clash palette, plus gold. */
export type GlyphColour = StroopColour | "GOLD";

export interface GoNoGoItem {
  shape: GlyphShape;
  colour: GlyphColour;
  /** True only for the gold circle. */
  target: boolean;
}

export interface GoNoGoPuzzleData {
  type: "gonogo";
  items: GoNoGoItem[];
}

export interface PatternCell {
  shape: GlyphShape;
  colour: StroopColour;
  count: 1 | 2 | 3;
}

export interface PatternPuzzleData {
  type: "patcomp";
  /** Nine cells, row-major; index 8 is the answer cell (shown as ? in play). */
  cells: PatternCell[];
  /** Four candidates in their stored, shuffled order. */
  candidates: PatternCell[];
  correctIndex: number;
  /** Plain-English rule, shown on the answer reveal. */
  rule: string;
}

/** The eight compass directions used by Symbol Scan. */
export type ArrowDir = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface SymbolScanPuzzleData {
  type: "symscan";
  target: ArrowDir;
  /** 49 cells, row-major, of a 7x7 grid. */
  cells: ArrowDir[];
  /** Indices of the cells matching the target. */
  targets: number[];
}

export interface RotationPuzzleData {
  type: "rotmatch";
  /** Filled cell indices (0-24) of a 5x5 grid. */
  target: number[];
  /** Four candidates in their stored, shuffled order. */
  candidates: number[][];
  correctIndex: number;
  /** Degrees the target was rotated by to produce the correct candidate. */
  rotationDeg: number;
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
  /** Twelve positions in ascending value order; index 0 is the smallest number. */
  spots: HuntSpot[];
}

export type PuzzleData =
  | WordsmithPuzzleData
  | OddWordPuzzleData
  | TargetNumberPuzzleData
  | NumberSequencePuzzleData
  | SequencePuzzleData
  | OddShapePuzzleData
  | ChainCalculationPuzzleData
  | ReactionPuzzleData
  | MissingLettersPuzzleData
  | EquationPuzzleData
  | StroopPuzzleData
  | SpatialPuzzleData
  | GoNoGoPuzzleData
  | PatternPuzzleData
  | SymbolScanPuzzleData
  | RotationPuzzleData
  | NumberHuntPuzzleData
  | WordMatchPuzzleData
  | PercentPuzzleData
  | NumberSpanPuzzleData
  | StopWatchPuzzleData
  | CountUpPuzzleData
  | MirrorPuzzleData
  | WordHuntPuzzleData
  | UnblockPuzzleData
  | BlockPartyPuzzleData;

/** Every timed screen of a round, driven by a shared timestamp. */
export type DuelPhase = "intro" | "puzzle" | "reveal" | "result";

export interface DuelRow {
  id: string;
  room_code: string;
  status: "waiting" | "countdown" | "in_progress" | "finished";
  /** The player who created the room; only they can start it or remove players. */
  host_user_id: string | null;
  max_players: number;
  round_count: number;
  round_order: PuzzleType[];
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
  last_seen_at: string;
  /** inactive = missed two rounds in a row; left = tapped Leave. */
  status: PlayerStatus;
  joined_at: string;
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
}

export const ROUND_MS = 30_000;
/** Target Number gets a full minute. */
export const TARGET_TIME_MS = 60_000;
/** Target Number: how close a miss still earns something. */
export const TARGET_NEAR_POINTS = 50;
export const TARGET_FAR_POINTS = 25;
/** Six rounds, one from each puzzle category. */
export const TOTAL_ROUNDS = 6;
/** A room holds two to ten players; two plays as the classic duel. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const COUNTDOWN_MS = 3_000;
/** Round intro: 7s of progress bar, then a 3-2-1 countdown. */
export const INTRO_MS = 10_000;
export const INTRO_COUNTDOWN_MS = 3_000;
/** Answer reveal after each round. */
export const REVEAL_MS = 5_000;
export const NEXT_ROUND_AUTO_MS = 8_000;
/** How long the standings screen stays up in a room of three or more. */
export const STANDINGS_MS = 12_000;
/** Missing this many rounds in a row marks a player inactive. */
export const INACTIVE_AFTER_MISSED = 2;
export const DISCONNECT_MS = 15_000;

/** Sequence Recall plays back before its 30s clock starts, on a 4x4 grid. */
export const SEQUENCE_LEAD_IN_MS = 700;
export const SEQUENCE_FLASH_MS = 450;
export const SEQUENCE_GAP_MS = 150;
export const SEQUENCE_COLS = 4;
export const SEQUENCE_LENGTH = 7;
/** Reverse Recall shows one fewer tile than Sequence Recall. */
export const REVERSE_LENGTH = 6;

export function sequencePlaybackMs(count: number): number {
  return SEQUENCE_LEAD_IN_MS + count * SEQUENCE_FLASH_MS + (count - 1) * SEQUENCE_GAP_MS;
}

export const SEQUENCE_PLAYBACK_MS = sequencePlaybackMs(SEQUENCE_LENGTH);

/** Reaction Time: three attempts, each in a fixed-length shared slot. */
export const REACTION_ATTEMPTS = 3;
export const REACTION_MIN_DELAY_MS = 1_500;
export const REACTION_MAX_DELAY_MS = 4_000;
/** How long a player has to tap after the gold flash. */
export const REACTION_RESPONSE_MS = 2_000;
/** How long the attempt's time (or "Too early!") stays on screen. */
export const REACTION_FEEDBACK_MS = 1_000;
/** Penalty recorded for a false start or a missed attempt. */
export const REACTION_PENALTY_MS = 1_000;

/** Colour Clash: a run of twelve items across five colours. */
export const STROOP_ITEMS = 12;
/** Every run holds at least this many of each instruction. */
export const STROOP_MIN_PER_INSTRUCTION = 4;
/** Never more than this many of the same instruction in a row. */
export const STROOP_MAX_STREAK = 3;

/** Spatial Memory: six tiles of a 5x5 grid, shown together before the clock starts. */
export const SPATIAL_GRID_COLS = 5;
export const SPATIAL_TILES = 6;
export const SPATIAL_LEAD_IN_MS = 700;
export const SPATIAL_SHOW_MS = 2_500;
export const SPATIAL_PREP_MS = SPATIAL_LEAD_IN_MS + SPATIAL_SHOW_MS;

/** Go / No-Go: twelve shapes, six of them gold circles, on a shared timeline. */
export const GONOGO_ITEMS = 12;
export const GONOGO_TARGETS = 6;
export const GONOGO_ITEM_MS = 800;
export const GONOGO_GAP_MS = 400;
export const GONOGO_SLOT_MS = GONOGO_ITEM_MS + GONOGO_GAP_MS;
export const GONOGO_RUN_MS = GONOGO_ITEMS * GONOGO_SLOT_MS;
export const GONOGO_POINTS_PER_ITEM = 10;
export const GONOGO_MAX_BONUS = 130;

/** Symbol Scan: a 7x7 grid of arrows with 6-10 matching the target. */
export const SYMSCAN_COLS = 7;
export const SYMSCAN_CELLS = SYMSCAN_COLS * SYMSCAN_COLS;
export const SYMSCAN_MIN_TARGETS = 6;
export const SYMSCAN_MAX_TARGETS = 10;

/** Odd Shape Out: a 6x6 grid of near-identical shapes. */
export const ODDSHAPE_COLS = 6;
export const ODDSHAPE_CELLS = ODDSHAPE_COLS * ODDSHAPE_COLS;

/** Rotation Match: shapes drawn as filled cells of a 5x5 grid. */
export const ROTATION_COLS = 5;

/** Number Hunt: twelve circles tapped in ascending order. */
export const NUMHUNT_COUNT = 12;
export const NUMHUNT_CIRCLE_PX = 56;
export const NUMHUNT_ERROR_PENALTY = 10;
export const NUMHUNT_FLASH_MS = 200;

/* -------------------------------------------------------------------------- */
/*  Word Match                                                                 */
/* -------------------------------------------------------------------------- */

export type WordMatchMode = "synonym" | "antonym";

export interface WordMatchItem {
  prompt: string;
  mode: WordMatchMode;
  /** Four options in their stored, shuffled order. */
  options: string[];
}

export interface WordMatchPuzzleData {
  type: "wordmatch";
  items: WordMatchItem[];
  /** Server-side only: the correct option index of each item. */
  answers?: number[];
}

/** Word Match: a run of eight prompts. */
export const WORDMATCH_ITEMS = 8;

/* -------------------------------------------------------------------------- */
/*  Percent Sprint                                                             */
/* -------------------------------------------------------------------------- */

export interface PercentPuzzleData {
  type: "pctsprint";
  question: string;
  /** Server-side only, until the reveal. */
  answer?: number;
  /** One line of working, shown on the answer reveal. */
  working?: string;
}

/* -------------------------------------------------------------------------- */
/*  Number Span                                                                */
/* -------------------------------------------------------------------------- */

export interface NumberSpanPuzzleData {
  type: "numspan";
  /** The digit string, shown before the clock starts. */
  digits: string;
}

export const NUMSPAN_LENGTH = 8;
export const NUMSPAN_LEAD_IN_MS = 700;
export const NUMSPAN_SHOW_MS = 2_500;
export const NUMSPAN_PREP_MS = NUMSPAN_LEAD_IN_MS + NUMSPAN_SHOW_MS;

/* -------------------------------------------------------------------------- */
/*  Stop Watch                                                                 */
/* -------------------------------------------------------------------------- */

export interface StopWatchPuzzleData {
  type: "stopwatch";
  /** Target centres of each attempt, as a fraction of the bar (0–1). */
  targets: number[];
}

export const STOPWATCH_ATTEMPTS = 3;
/** One full sweep of the bar; the marker then bounces back. */
export const STOPWATCH_SWEEP_MS = 1_600;
export const STOPWATCH_TIMEOUT_MS = 6_000;
export const STOPWATCH_FEEDBACK_MS = 1_000;
export const STOPWATCH_SLOT_MS = STOPWATCH_TIMEOUT_MS + STOPWATCH_FEEDBACK_MS;
/** Recorded when an attempt is never tapped. */
export const STOPWATCH_MISS_MS = 800;
/** Distance at which the accuracy bonus reaches zero. */
export const STOPWATCH_MAX_DIST_MS = 400;
/** Half-width of the gold zone, as a fraction of the bar. */
export const STOPWATCH_ZONE = 0.06;

/* -------------------------------------------------------------------------- */
/*  Count Up                                                                   */
/* -------------------------------------------------------------------------- */

export interface CountUpShape {
  shape: GlyphShape;
  colour: GlyphColour;
  /** Percentages of the field's width and height. */
  x: number;
  y: number;
}

export interface CountUpPuzzleData {
  type: "countup";
  shapes: CountUpShape[];
  targetShape: GlyphShape;
  targetColour: GlyphColour;
  /** Server-side only: how many shapes match the question. */
  count?: number;
}

export const COUNTUP_COLS = 6;
export const COUNTUP_ROWS = 10;
export const COUNTUP_MIN_SHAPES = 40;
export const COUNTUP_MAX_SHAPES = 56;
export const COUNTUP_MIN_COUNT = 5;
export const COUNTUP_MAX_COUNT = 12;

/* -------------------------------------------------------------------------- */
/*  Mirror Match                                                               */
/* -------------------------------------------------------------------------- */

/** Which dashed line the target is flipped across. */
export type MirrorAxis = "vertical" | "horizontal" | "diagonal";

/** How a wrong candidate differs from the true reflection. */
export type MirrorCandidateKind = "correct" | "otherAxis" | "rotation" | "swap";

/** A coloured shape: filled cells of a 5x5 grid, with one colour per cell. */
export interface MirrorShape {
  cells: number[];
  colours: StroopColour[];
}

export interface MirrorPuzzleData {
  type: "mirmatch";
  axis: MirrorAxis;
  target: MirrorShape;
  /** Four candidates in their stored, shuffled order. */
  candidates: MirrorShape[];
  /** Server-side only: absent until the reveal. */
  correctIndex?: number;
  /** Server-side only: what each candidate is, in stored order. */
  kinds?: MirrorCandidateKind[];
}
