export type PuzzleType =
  | "wordsmith"
  | "groups"
  | "target"
  | "numseq"
  | "sequence"
  | "reverse"
  | "reaction"
  | "ladder"
  | "equation"
  | "stroop"
  | "spatial"
  | "gonogo"
  | "patcomp"
  | "symscan"
  | "spin"
  | "numhunt"
  | "spotdiff"
  | "chaincalc"
  | "wordmatch"
  | "pctsprint"
  | "numclimb"
  | "stopwatch"
  | "countup"
  | "mirmatch"
  | "wordhunt"
  | "sumhunt"
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
  | "intruder"
  | "nonogram"
  | "pairmatch"
  | "flood"
  | "stroke"
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
  | "sortrush"
  | "flip"
  | "parry"
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
  | "clayshoot"
  | "numpyramid";

export type PuzzleCategory =
  "word" | "number" | "memory" | "speed" | "attention" | "pattern" | "logic" | "arcade";

/** Wordsmith: nine letters in a 3×3 square; every word uses the centre letter. */
export const WORDSMITH_TIME_MS = 120_000;
export const WORDSMITH_MIN_LENGTH = 4;
export const WORDSMITH_LETTERS = 9;
/** Index of the centre letter in the 3×3 square. */
export const WORDSMITH_CENTRE_INDEX = 4;
/** A centre letter is only used when it allows this many valid words. */
export const WORDSMITH_MIN_WORDS = 25;
export const WORDSMITH_MAX_WORDS = 60;
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
}

export const GROUPS_TIME_MS = 90_000;

export interface GroupsSecretGroup {
  theme: string;
  words: [string, string, string, string] | string[];
}

export interface GroupsPuzzleData {
  type: "groups";
  /** Sixteen words in the stored order every player sees. */
  words: string[];
  /** Server-side only until reveal: the exact four groups and their themes. */
  groups?: GroupsSecretGroup[];
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

/** One sequence in the quick-fire run: five terms, four options, one rule. */
export interface SequenceItem {
  /** The five terms shown before the blank. */
  numbers: number[];
  /** Four options in their stored order — one correct, three near misses. */
  options: number[];
  /** Short rule text ("+5", "×2 then +1"), shown on the answer reveal. */
  rule: string;
}

export interface NumberSequencePuzzleData {
  type: "numseq";
  items: SequenceItem[];
  /** Server-side only, until the reveal: the correct option index per item. */
  answers?: number[];
}

/** Number Sequence: five sequences over 30 seconds. */
/** Number Sequence: five sequences over 45 seconds. */
export const NUMSEQ_ITEMS = 5;
export const NUMSEQ_TIME_MS = 45_000;

export interface SequencePuzzleData {
  type: "sequence" | "reverse";
  tiles: number[];
  /** Reverse Recall only: the server-side answer order. */
  answerOrder?: number[];
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
}

export type SpotDifferenceKind = "colour" | "turn" | "kind";

export interface SpotDifference {
  kind: SpotDifferenceKind;
  /** The cells that count as this difference — two when a shape moved. */
  cells: number[];
  label: string;
}

export interface SpotPuzzleData {
  type: "spotdiff";
  top: SpotShape[];
  bottom: SpotShape[];
  /** Server-side only until the reveal: the five differences. */
  differences?: SpotDifference[];
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
  /** When each gold flash starts, in ms from the round start (generated once). */
  flashes: number[];
  /** Seeded decoy pulses before the gold flashes: start time and colour. */
  decoys: { at: number; color: "teal" | "red" | "blue" }[];
}

export interface WordLadderPuzzleData {
  type: "ladder";
  startWord: string;
  targetWord: string;
  /** Server-side only until reveal. Number of one-letter changes. */
  shortestLength?: number;
  /** Server-side only until reveal. One minimum path, including both endpoints. */
  shortestPath?: string[];
}

export type Operator = "+" | "-" | "×" | "÷";

export interface EquationStage {
  numbers: number[];
  target: number;
}

export interface EquationPuzzleData {
  type: "equation";
  /** Three equations of three, four and five numbers. */
  stages: EquationStage[];
  /** Server-side only until reveal: the one operator set per stage. */
  operators?: Operator[][];
}

export const EQUATION_TIME_MS = 90_000;
export const EQUATION_STAGE_POINTS = [30, 40, 50] as const;

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
}

export interface SpatialPuzzleData {
  type: "spatial";
  /** Eight tile indices (0-24) of a 5x5 grid, lit in four groups of two. */
  tiles: number[];
  /** Always two; stored for backward compatibility with existing rooms. */
  groupSize?: number;
}

export type GlyphShape = "circle" | "square" | "triangle" | "star" | "hexagon";
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

/** Pattern Completion draws its own shapes, including two the glyph set lacks. */
export type PatternShape = "circle" | "square" | "triangle" | "star" | "hexagon" | "arrow";

/** Only triangles and arrows show their rotation; everything else stays at 0. */
export type PatternRotation = 0 | 90 | 180 | 270;

export interface PatternCell {
  shape: PatternShape;
  colour: StroopColour;
  count: 1 | 2 | 3;
  rot: PatternRotation;
}

export type PatternAttribute = "shape" | "colour" | "count" | "rot";

/** How one attribute behaves across the grid. */
export type PatternRuleKind = "row" | "prog" | "latin";

export interface PatternRule {
  attr: PatternAttribute;
  kind: PatternRuleKind;
  /** Plain English, shown on the answer reveal. */
  text: string;
}

export interface PatternRoundItem {
  /** Nine cells, row-major; index 8 is the answer cell (shown as ? in play). */
  cells: PatternCell[];
  /** The attributes the player composes; the fourth is constant and pre-filled. */
  active: PatternAttribute[];
  /** True when the grid uses a rotatable shape, so the rotation picker shows. */
  rotatable: boolean;
  /** Server-side only until the reveal. */
  rules?: PatternRule[];
  answer?: PatternCell;
}

export interface PatternPuzzleData {
  type: "patcomp";
  /** Three independent boards played inside one continuous round. */
  puzzles: PatternRoundItem[];
}

/** Pattern Completion: build the missing piece. */
export const PATCOMP_ITEMS = 3;
export const PATCOMP_TIME_MS = 30_000;

/** The eight compass directions used by Symbol Scan. */
export type ArrowDir = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";

export interface SymbolScanStage {
  target: ArrowDir;
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
}

/* -------------------------------------------------------------------------- */
/*  Spin                                                                       */
/* -------------------------------------------------------------------------- */

export const SPIN_ITEMS = 8;
export const SPIN_TIME_MS = 45_000;
export const SPIN_MAX_STREAK = 2;

/** How the copy on the right was made from the shape on the left. */
export type SpinTransform = "cw" | "half" | "ccw" | "flip";

/** Fixed button order for the whole run. */
export const SPIN_TRANSFORMS: SpinTransform[] = ["cw", "half", "ccw", "flip"];

export interface SpinItem {
  /** The shape on the left. */
  target: MirrorShape;
  /** The transformed copy on the right. */
  shown: MirrorShape;
}

export interface SpinPuzzleData {
  type: "spin";
  items: SpinItem[];
  /** Server-side only: the transform used for each item, in order. */
  answers?: SpinTransform[];
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
  /** Fourteen positions in ascending value order; index 0 is the smallest number. */
  spots: HuntSpot[];
}

export type PuzzleData =
  | WordsmithPuzzleData
  | GroupsPuzzleData
  | TargetNumberPuzzleData
  | NumberSequencePuzzleData
  | SequencePuzzleData
  | SpotPuzzleData
  | ChainCalculationPuzzleData
  | ReactionPuzzleData
  | WordLadderPuzzleData
  | EquationPuzzleData
  | StroopPuzzleData
  | SpatialPuzzleData
  | GoNoGoPuzzleData
  | PatternPuzzleData
  | SymbolScanPuzzleData
  | SpinPuzzleData
  | NumberHuntPuzzleData
  | WordMatchPuzzleData
  | PercentPuzzleData
  | NumberClimbPuzzleData
  | StopWatchPuzzleData
  | CountUpPuzzleData
  | MirrorPuzzleData
  | WordHuntPuzzleData
  | SumHuntPuzzleData
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
  | IntruderPuzzleData
  | NonoPuzzleData
  | PairPuzzleData
  | FloodPuzzleData
  | StrokePuzzleData
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
  | TentsPuzzleData
  | ShikakuPuzzleData
  | LightUpPuzzleData
  | BallTrackPuzzleData
  | NumberPyramidPuzzleData
  | WordSearchPuzzleData
  | WavefrontPuzzleData
  | BastionPuzzleData
  | RooftopPuzzleData
  | SortRushPuzzleData
  | FlipPuzzleData
  | ParryPuzzleData
  | JunctionPuzzleData
  | InkBridgePuzzleData
  | BurstPuzzleData
  | OrbitPuzzleData
  | SwingPuzzleData
  | TiltPuzzleData
  | HotFloorPuzzleData;

/** Every timed screen of a round, driven by a shared timestamp. */
export type DuelPhase = "intro" | "puzzle" | "reveal" | "result" | "standings";

export interface DuelRow {
  id: string;
  room_code: string;
  status: "waiting" | "countdown" | "in_progress" | "finished";
  selected_categories: PuzzleCategory[];
  tournament_history: { winner: string; date: string; score: number; round_order: PuzzleType[]; word_match_words?: string[] }[];
  disbanded_at: string | null;
  /** The player who created the room; only they can start it or remove players. */
  host_user_id: string | null;
  max_players: number;
  round_count: number;
  round_order: PuzzleType[];
  /** Host setting: kept for older rooms; no longer used in the draw. */
  no_maths: boolean;
  /** Host opt-in: include the number category in the round draw. */
  add_maths: boolean;
  /** Host opt-in: include the memory category in the round draw. */
  add_memory: boolean;
  /** Host toggle, on by default: one round is an arcade game. */
  add_arcade: boolean;

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
export const TARGET_TIME_MS = 75_000;
/** Target Number: how close a miss still earns something. */
export const TARGET_NEAR_POINTS = 50;
export const TARGET_FAR_POINTS = 25;
/** Six rounds, one from each puzzle category. */
export const TOTAL_ROUNDS = 6;
/** A room holds two to ten players; two plays as the classic duel. */
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
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

/** Sequence Recall plays back before its 30s clock starts, on a 4x4 grid. */
export const SEQUENCE_LEAD_IN_MS = 700;
export const SEQUENCE_FLASH_MS = 700;
export const SEQUENCE_GAP_MS = 350;
export const SEQUENCE_COLS = 4;
export const SEQUENCE_LENGTH = 7;
/** Reverse Recall shows one fewer tile than Sequence Recall. */
export const REVERSE_LENGTH = 6;

export function sequencePlaybackMs(count: number): number {
  return SEQUENCE_LEAD_IN_MS + count * SEQUENCE_FLASH_MS + (count - 1) * SEQUENCE_GAP_MS;
}

export const SEQUENCE_PLAYBACK_MS = sequencePlaybackMs(SEQUENCE_LENGTH);

/** Reaction Time: five gold flashes on one shared 50-second timeline. */
export const REACTION_ROUND_MS = 50_000;
export const REACTION_FLASHES = 5;
/** A gold flash lasts until tapped or this long; a miss records this value. */
export const REACTION_FLASH_MS = 1_500;
export const REACTION_MISS_MS = 1_500;
/** Added to the average for every false start. */
export const REACTION_FALSE_START_MS = 200;
/** How long a decoy pulse stays on screen. */
export const REACTION_DECOY_MS = 600;

/** Colour Clash: a run of twelve items across eight colours. */
export const STROOP_ITEMS = 12;
/** Every run holds at least this many of each instruction. */
export const STROOP_MIN_PER_INSTRUCTION = 4;
/** Never more than this many of the same instruction in a row. */
export const STROOP_MAX_STREAK = 3;

/** Spatial Memory: eight tiles of a 5x5 grid, lit in four groups of two. */
export const SPATIAL_GRID_COLS = 5;
export const SPATIAL_TILES = 8;
export const SPATIAL_LEAD_IN_MS = 700;
/** How long each group of tiles stays gold, and the dark gap between groups. */
export const SPATIAL_GROUP_MS = 1_000;
export const SPATIAL_GROUP_GAP_MS = 300;

/** Total preparation time for a puzzle shown in `groups` groups. */
export function spatialPrepMs(groups: number): number {
  const count = Math.max(1, groups);
  return SPATIAL_LEAD_IN_MS + count * SPATIAL_GROUP_MS + (count - 1) * SPATIAL_GROUP_GAP_MS;
}

/** Go / No-Go: twelve shapes, six of them gold circles, on a shared timeline. */
export const GONOGO_ITEMS = 12;
export const GONOGO_TARGETS = 6;
export const GONOGO_ITEM_MS = 730;
export const GONOGO_GAP_MS = 360;
export const GONOGO_SLOT_MS = GONOGO_ITEM_MS + GONOGO_GAP_MS;
export const GONOGO_RUN_MS = GONOGO_ITEMS * GONOGO_SLOT_MS;
export const GONOGO_POINTS_PER_ITEM = 10;
export const GONOGO_MAX_BONUS = 130;

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
export const SPOT_DIFFERENCES = 5;
export const SPOT_TIME_MS = 30_000;
/** Flat scores for partial finds. */
export const SPOT_FOUR_POINTS = 70;
export const SPOT_THREE_POINTS = 50;
export const SPOT_TWO_POINTS = 30;
export const SPOT_ONE_POINTS = 15;

/** Rotation Match: shapes drawn as filled cells of a 5x5 grid. */
export const ROTATION_COLS = 5;

/** Number Hunt: sixteen circles tapped in ascending order. */
export const NUMHUNT_COUNT = 16;
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

/** Word Match: a run of eight prompts, over 45 seconds. */
export const WORDMATCH_ITEMS = 8;
export const WORDMATCH_TIME_MS = 45_000;

/* -------------------------------------------------------------------------- */
/*  Percent Sprint                                                             */
/* -------------------------------------------------------------------------- */

export interface PercentItem {
  question: string;
  /** Four options in their stored order — one correct, three near misses. */
  options: number[];
  /** One line of working, shown on the answer reveal. */
  working: string;
}

export interface PercentPuzzleData {
  type: "pctsprint";
  items: PercentItem[];
  /** Server-side only, until the reveal: the correct option index per question. */
  answers?: number[];
}

/** Percent Sprint: five questions over 45 seconds. */
export const PCTSPRINT_ITEMS = 5;
export const PCTSPRINT_TIME_MS = 45_000;

/* -------------------------------------------------------------------------- */
/*  Number Climb                                                               */
/* -------------------------------------------------------------------------- */

export interface NumberClimbPuzzleData {
  type: "numclimb";
  /** The 12-digit prompt, shown for six seconds before the clock starts. */
  digits: string;
  /** Server-side grading copy, kept in private puzzle data. */
  answerDigits?: string;
}

export const WORD_LADDER_TIME_MS = 60_000;
export const NUMBER_CLIMB_LENGTH = 12;
export const NUMBER_CLIMB_TIME_MS = 20_000;
export const NUMBER_CLIMB_PREP_MS = 6_000;

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
  /** Starts at the right; the zone only arms on the second pass. */
  reverse: boolean;
  /** Optional seeded target oscillation around `centre`. */
  moving?: { amplitude: number; cycleMs: number; phase: number };
  /** Draw and move this watch vertically instead of horizontally. */
  vertical?: boolean;
  /** Optional traversal times, one per pass. */
  passSweepMs?: number[];
}

export interface StopWatchPuzzleData {
  type: "stopwatch";
  watches: StopWatchSpec[];
}

export const STOPWATCH_ATTEMPTS = 5;
export const STOPWATCH_ROUND_MS = 60_000;
/** A watch not stopped within this many traversals records the miss value. */
export const STOPWATCH_PASSES = 3;
/** Pause between one watch's result and the next watch starting. */
export const STOPWATCH_GAP_MS = 600;
/** Recorded when a watch is never stopped. */
export const STOPWATCH_MISS_MS = 400;
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
}

export interface CountUpPuzzleData {
  type: "countup";
  /** Three fields: 5×4, 7×6, then the full packed grid. */
  stages: CountUpStage[];
  /** Server-side only: how many shapes match each stage's question. */
  counts?: number[];
}

export const COUNTUP_STAGE_SIZES = [50, 80, 110] as const;
export const STAGE_WEIGHTS_3 = [30, 35, 35] as const;

/** The field fills a short phone's measured play area without cropping its edges. */
export const COUNTUP_COLS = 8;
export const COUNTUP_ROWS = 6;
export const COUNTUP_TIME_MS = 45_000;
export const COUNTUP_MIN_SHAPES = 50;
export const COUNTUP_MAX_SHAPES = 110;
export const COUNTUP_MIN_COUNT = 6;
export const COUNTUP_MAX_COUNT = 12;

/* -------------------------------------------------------------------------- */
/*  Mirror Match                                                               */
/* -------------------------------------------------------------------------- */

/** A run of three flips in one round. */
export const MIRMATCH_ITEMS = 5;
export const MIRMATCH_TIME_MS = 60_000;

/** Which dashed line the target is flipped across. */
export type MirrorAxis = "vertical" | "horizontal";

/** How a wrong candidate differs from the true reflection. */
export type MirrorCandidateKind = "correct" | "otherAxis" | "rotation" | "swap";

/** A coloured shape: filled cells of a 5x5 grid, with one colour per cell. */
export interface MirrorShape {
  cells: number[];
  colours: StroopColour[];
}

export interface MirrorItem {
  axis: MirrorAxis;
  target: MirrorShape;
  /** Four candidates in their stored, shuffled order. */
  candidates: MirrorShape[];
}

export interface MirrorPuzzleData {
  type: "mirmatch";
  /** Three puzzles, played one after the other. */
  items: MirrorItem[];
  /** Server-side only: the correct candidate of each item, in order. */
  answers?: number[];
  /** Server-side only: what each candidate is, per item, in stored order. */
  kinds?: MirrorCandidateKind[][];
}

/* -------------------------------------------------------------------------- */
/*  Word Hunt                                                                  */
/* -------------------------------------------------------------------------- */

export const WORDHUNT_COLS = 5;
export const WORDHUNT_CELLS = WORDHUNT_COLS * WORDHUNT_COLS;
export const WORDHUNT_TIME_MS = 120_000;
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
  /** Sixteen tiles, row-major; a Q tile always reads "QU". */
  grid: string[];
  /** Server-side only until the reveal: every word the board allows. */
  words?: WordHuntWord[];
  totalPoints?: number;
  par?: number;
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

/** One piece sitting on the board, by the absolute cells it covers. */
export interface BlockPlacement {
  /** Index into the tray piece list. */
  piece: number;
  cells: number[];
}

export interface BlockPartyPuzzleData {
  type: "blockparty";
  /** Seven peg cells the pieces must fit around. */
  blockers: number[];
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
export const SUDOKU_PARTIAL_POINTS = 60;

export interface SudokuPuzzleData {
  type: "sudoku";
  /** Thirty-six cells: the fixed digits, 0 where the player must fill in. */
  givens: number[];
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
  type: "flow";
  /** Ten to twelve pairs in the order every player sees them. */
  pairs: FlowPair[];
  /** Dark wall cells: no path may enter, and they need no filling. */
  walls?: number[];
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
export const PUSH_PARTIAL_POINTS = 60;

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
export const LASER_TIME_MS = 40_000;
/** Always exactly nine mirrors, and the route always bends once per mirror. */
export const LASER_MIN_MIRRORS = 9;
export const LASER_MAX_MIRRORS = 9;
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
export const LASER_MIN_BENDS = 9;
/** And never more: the route bends exactly once per mirror. */
export const LASER_MAX_BENDS = 9;
/** Three shots per round. */
export const LASER_MAX_FIRES = 3;
/** Base points by the shot that lit every gem: first, second, third. */
export const LASER_FIRE_BASE = [100, 85, 70];
/** A shot that missed scores in proportion to the gems it did light. */
export const LASER_PARTIAL_POINTS = 70;
/** How many near-miss placements the necessity search may carry forward. */
export const LASER_PROMISING_CAP = 20_000;
/** How long the beam takes to draw itself, and how long it lingers after a miss. */
export const LASER_BEAM_MS = 600;
export const LASER_FADE_MS = 1_500;

/** A diagonal mirror: "/" or "\". */
export type MirrorKind = "/" | "\\";

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
  /** True when no placement of one to four mirrors lights all three gems. */
  necessityPass: boolean;
  /** How many mirror placements the exhaustive search traced. */
  subsetsTested: number;
  attempts: number;
  splitters?: number;
  directionalGems?: number;
  splitRequired?: boolean;
}

export interface LaserPuzzleData {
  type: "laser";
  /** The edge cell the laser fires from. */
  source: number;
  /** The direction it fires, inward from that edge. */
  dir: BeamDir;
  /** The three gems one beam must pass through, in any order. */
  gems: number[];
  /** Two gems only light when entered with this heading. */
  directionalGems?: { cell: number; from: BeamDir }[];
  /** Fixed blocks that branch an incoming beam into both perpendicular headings. */
  splitters?: number[];
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
export const TOWER_PARTIAL_POINTS = 60;

/** Generator figures, shown only in the dev readout. */
export interface TowerStats {
  discs: number;
  pegs: number;
  minMoves: number;
  attempts: number;
}

export interface TowerPuzzleData {
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

export const MAZE_COLS = 15;
export const MAZE_CELLS = MAZE_COLS * MAZE_COLS;
export const MAZE_TIME_MS = 60_000;
/** The route from start to exit is never shorter than this. */
export const MAZE_MIN_PATH = 70;
/** And never straighter than this. */
export const MAZE_MIN_TURNS = 14;
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
/** Most a partly-run maze can earn. */
export const MAZE_PARTIAL_POINTS = 60;

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
/** Most an unsolved board can earn, shared out per finished tube. */
export const TUBES_PARTIAL_POINTS = 60;

export interface TubesPuzzleData {
  type: "tubes";
  /** One tube per entry, bottom ball first, holding colour indices 0–7. */
  tubes: number[][];
  /** Server-side only: the searched minimum number of pours. */
  minMoves?: number;
  /** Server-side only: one shortest pour list, as `0>3,1>2`. */
  solution?: string;
}

/* ============================= Safe Cracker ============================= */

export const SAFE_TIME_MS = 75_000;
export const SAFE_DIALS = 4;
export const SAFE_CLUE_COUNT = 5;
export const SAFE_TRIES = 3;
/** Base points by the try that opened the safe: first, second, third. */
export const SAFE_TRY_POINTS = [100, 85, 70];
/** Points per correct dial when the safe stays shut. */
export const SAFE_DIAL_POINTS = 15;

export interface SafePuzzleData {
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
export const BOMB_PREFIX_POINTS = 15;
export const BOMB_PARTIAL_POINTS = 60;

export interface BombPuzzleData {
  type: "bomb";
  wires: import("./bomb").WireColour[];
  buttons: import("./bomb").BombButton[];
  light: boolean;
  switchPosition: import("./bomb").BombSwitch;
  /** Three digits on the plate. */
  serial: string;
  /** The rule card, in the order it must be read. */
  rules: { id: string; text: string }[];
  /** How many actions the plan needs — the "actions 2 / 4" counter. */
  stepCount: number;
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
export const GRAV_LOCK_POINTS = 25;

export type GravityDir = "U" | "D" | "L" | "R" | "X" | "Y";

export interface GravityPuzzleData {
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
}

/* ======================= Don't Break the Chain ========================== */

export const CHAIN_TIME_MS = 30_000;
export const CHAIN_NODES = 20;
/** Correct taps needed to finish the chain. */
export const CHAIN_LENGTH = 15;
/** The rule is a repeating three-step cycle. */
export const CHAIN_CYCLE = 3;
/** Points lost per wrong tap. */
export const CHAIN_ERROR_PENALTY = 10;
/** Most an unfinished chain can earn. */
export const CHAIN_PARTIAL_POINTS = 60;
/** Every stored-solution step must retain this many shape-invalid choices. */
export const CHAIN_MIN_INVALID = 4;
/** Minimum distance between two nodes, in percent of the play area. */
export const CHAIN_NODE_GAP = 15;
/** Poisson-disc spacing, in node widths, and the spread checks on a layout. */
export const CHAIN_MIN_SPACING = 1.6;
/** A node glyph's width, as a share of the taller board axis in percent. */
export const CHAIN_NODE_WIDTH_PCT = 7;
/** A node glyph, and the clear space kept between two glyph edges, in pixels. */
export const CHAIN_NODE_PX = 46;
export const CHAIN_NODE_GAP_PX = 14;
/**
 * Conservative size of the chain board on the smallest supported phone, used to
 * turn the pixel spacing rule into the percentage space node positions live in.
 */
export const CHAIN_BOARD_W_PX = 343;
export const CHAIN_BOARD_H_PX = 400;
export const CHAIN_MIN_CENTRAL = 6;
export const CHAIN_MAX_HULL_RATIO = 0.6;

export const CHAIN_SHAPES = ["circle", "square", "triangle"] as const;

export type ChainShape = (typeof CHAIN_SHAPES)[number];

export interface ChainNode {
  /** Position in percent of the play area. */
  x: number;
  y: number;
  shape: ChainShape;
}

export interface ChainPuzzleData {
  type: "chain";
  nodes: ChainNode[];
  /** The three shapes, in the order they must be tapped. */
  cycle: ChainShape[];
  /** Server-side only: one searched non-crossing chain of twelve node ids. */
  solution?: number[];
  /** Server-side only: exact count, capped during generation at 200. */
  solutionCount?: number;
}

/* ========================= Intruder Detection =========================== */

export const INTRUDER_TIME_MS = 65_000;
export const INTRUDER_BOARDS = 5;
export const INTRUDER_BOARD_SIZES = [3, 3, 3, 3, 3] as const;
export const INTRUDER_CHANGE_COUNTS = [1, 1, 2, 2, 2] as const;
export const INTRUDER_SHOW_MS = [5_000, 5_000, 7_000, 7_000, 7_000] as const;
export const INTRUDER_HIDE_MS = 1_000;
export const INTRUDER_PLAY_MS = [3_000, 3_000, 5_000, 5_000, 5_000] as const;

export const INTRUDER_SHAPES = ["circle", "square", "triangle", "star"] as const;
export const INTRUDER_COLOURS: StroopColour[] = ["RED", "BLUE", "GREEN", "YELLOW", "ORANGE"];
export const INTRUDER_BOARD_COLOUR_COUNTS = [3, 4, 4, 5, 5] as const;
export const INTRUDER_BOARD_SHAPE_COUNTS = [2, 3, 4, 4, 4] as const;

export type IntruderShape = (typeof INTRUDER_SHAPES)[number];
export type IntruderChangeKind = "colour" | "shape";

export interface IntruderCell {
  shape: IntruderShape;
  colour: StroopColour;
  /** Kept at zero; Intruder now changes only colour or shape. */
  rot: 0 | 180;
}

export interface IntruderBoard {
  size: number;
  /** The grid as first shown. */
  cells: IntruderCell[];
  /** The grid as shown again, with exactly one cell different. */
  after: IntruderCell[];
  /** Half-cell visual shift applied to the second view. */
  offset?: "left" | "right" | "up" | "down";
}

export interface IntruderAnswer {
  cells: number[];
  kinds: IntruderChangeKind[];
}

export interface IntruderPuzzleData {
  type: "intruder";
  boards: IntruderBoard[];
  /** Server-side only: which cell changed on each board, and how. */
  answers?: IntruderAnswer[];
}

/* ============================== Nonogram ================================ */

export const NONO_TIME_MS = 120_000;
export const NONO_SIZE = 7;
/** Filled-cell count band for a generated picture. */
export const NONO_MIN_FILLED = 18;
export const NONO_MAX_FILLED = 30;
/** Partial credit share and the cost of a wrongly filled cell. */
export const NONO_PARTIAL_POINTS = 60;
export const NONO_WRONG_PENALTY = 5;

/** A cell the player has filled (1), pencilled as empty (2), or left blank (0). */
export type NonoMark = 0 | 1 | 2;

export interface NonoPuzzleData {
  type: "nonogram";
  /** Run lengths, in order, for each row then each column. */
  rows: number[][];
  cols: number[][];
  /** Server-side only: the one picture these clues describe. */
  pattern?: boolean[];
}

/* ============================== Pair Match ============================== */

export const PAIR_TIME_MS = 45_000;
export const PAIR_PAIRS = 10;
export const PAIR_CARDS = PAIR_PAIRS * 2;
export const PAIR_FLIP_BACK_MS = 600;
export const PAIR_FLIP_MS = 150;
/** Clearing the board in this many pair-flips or fewer earns the bonus. */
export const PAIR_CLEAN_FLIPS = 12;
export const PAIR_CLEAN_BONUS = 20;
export const PAIR_PARTIAL_POINTS = 60;

export interface PairCard {
  shape: IntruderShape;
  colour: StroopColour;
}

export interface PairPuzzleData {
  type: "pairmatch";
  /** The shuffled board — identical on every phone in the room. */
  cards: PairCard[];
}

/* ============================= Colour Flood ============================= */

export const FLOOD_TIME_MS = 45_000;
export const FLOOD_SIZE = 12;
export const FLOOD_CELLS = FLOOD_SIZE * FLOOD_SIZE;
export const FLOOD_COLOURS = 5;
export const FLOOD_MIN_PAR = 10;
export const FLOOD_MAX_PAR = 15;
/** After this many failed boards the par band widens, and the miss is logged. */
export const FLOOD_ATTEMPTS = 400;
export const FLOOD_FALLBACK_PAR = 20;
export const FLOOD_SEARCH_CAP = 2_000_000;
export const FLOOD_PAR_BONUS = 20;
export const FLOOD_PARTIAL_POINTS = 60;

export interface FloodPuzzleData {
  type: "flood";
  /** Row-major colour indices, 0 … FLOOD_COLOURS - 1. */
  grid: number[];
  /** The exact minimum number of taps — shown to the player. */
  par: number;
  /** Server-side only: one route that floods the board in par moves. */
  solution?: number[];
}

/* ============================== One-Stroke ============================== */

export const STROKE_TIME_MS = 30_000;
export const STROKE_MIN_DOTS = 6;
export const STROKE_MAX_DOTS = 9;
export const STROKE_MIN_EDGES = 8;
export const STROKE_MAX_EDGES = 14;
export const STROKE_FIRST_TRY_BONUS = 20;
export const STROKE_PARTIAL_POINTS = 60;
/** Generation gives up on a figure after this many random attempts. */
export const STROKE_ATTEMPTS = 600;

export interface StrokeDot {
  /** Percentage coordinates inside the play area. */
  x: number;
  y: number;
}

export interface StrokePuzzleData {
  type: "stroke";
  dots: StrokeDot[];
  /** Each edge joins two dot indices; no two edges cross. */
  edges: [number, number][];
  /** Server-side only: one dot order that traces every edge exactly once. */
  solution?: number[];
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

export interface TilesPuzzleData {
  type: "tiles";
  /** Row-major frame: 1 … 8 for the tiles and 0 for the gap. */
  frame: number[];
  /** Server-side only: the exact minimum number of slides. */
  minMoves?: number;
  /** Server-side only: one minimum-length slide order (tile values). */
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
export const RINGS_TURN_MS = 150;
export const RINGS_ATTEMPTS = 600;

export interface RingsPuzzleData {
  type: "rings";
  /** Index into the shared link-pattern bank (shown as the legend). */
  pattern: number;
  /** Colour index per segment, per ring, as the round starts. */
  segments: number[][];
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
}

/* =========================== Bin Toss / Bullseye ========================= */

/** Both runs are capped at 60 seconds; the round clock adds three of slack. */
export const BINTOSS_TIME_MS = 63_000;
export const BULLSEYE_TIME_MS = 48_000;

export interface BinTossPuzzleData {
  type: "bintoss";
  /** Drives the wind on all ten throws — identical for everyone in the room. */
  seed: number;
}

export interface BullseyePuzzleData {
  type: "bullseye";
  /** Drives the wind on all ten arrows — identical for everyone in the room. */
  seed: number;
  /** Persisted with the round so every player and the server use the same winds. */
  winds: number[];
}

/* ================================ Matchup ================================ */

/** A fixed 60-second run; the round clock adds three seconds of slack. */
export const MATCHUP_TIME_MS = 63_000;

export interface MatchupPuzzleData {
  type: "matchup";
  /** Draws the board and each column's refill queue — identical for everyone. */
  seed: number;
}

/* ================= Snake / Cross / Dual / Ricochet ======================= */

/** Each run is a fixed 60 seconds; the round clock adds three of slack. */
export const SNAKE_TIME_MS = 63_000;
export const CROSS_TIME_MS = 63_000;
export const DUAL_TIME_MS = 63_000;
export const RICO_TIME_MS = 63_000;

export interface SnakePuzzleData {
  type: "snake";
  /** Draws the whole pellet queue — identical for everyone in the room. */
  seed: number;
}

export interface CrossPuzzleData {
  type: "cross";
  /** Draws every crossing's traffic — identical for everyone in the room. */
  seed: number;
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
export const BREAKER_TIME_MS = 63_000;
export const RALLY_TIME_MS = 63_000;
export const STEADY_TIME_MS = 63_000;

export interface BreakerPuzzleData {
  type: "breaker";
  /** Draws the wall and which bricks are solid — identical for everyone. */
  seed: number;
}

export interface RallyPuzzleData {
  type: "rally";
  /** Draws the opening angle and every bounce nudge — identical for everyone. */
  seed: number;
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

/** A fixed 30-second run on the arcade engine; the clock adds three of slack. */
export const WHACK_TIME_MS = 33_000;
export const TENTS_TIME_MS = 90_000;

/** Ten Drop: a fixed 60-second run on the arcade engine (number category). */
export const TENDROP_TIME_MS = 63_000;
/** Clay Shoot: a fixed 45-second run on the arcade engine. */
export const CLAYSHOOT_TIME_MS = 48_000;

export interface TenDropPuzzleData {
  type: "tendrop";
  /** Draws every target and tile queue — identical for everyone. */
  seed: number;
}

export interface ClayShootPuzzleData {
  type: "clayshoot";
  /** Draws the whole launch schedule — identical for everyone. */
  seed: number;
}

export interface WhackPuzzleData {
  type: "whack";
  /** Draws the whole pop schedule — identical for everyone. */
  seed: number;
}

export interface TentsPuzzleData {
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
}

export interface BubblePuzzleData {
  type: "bubble";
  /** Draws the starting field and the whole bubble queue — identical for everyone. */
  seed: number;
}

export interface BeatPuzzleData {
  type: "beat";
  /** Draws the whole chart — identical for everyone. */
  seed: number;
}

/* ============================== Tile Grid =============================== */

export interface TileGridPuzzleData {
  type: "tilegrid";
  /** The twelve shuffled letter tiles — identical for everyone. */
  tray: string[];
  /** Server-side only until reveal: one reference grid, 49 cells, "" for empty. */
  solution?: string[];
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
}

/* =============================== Sum Hunt =============================== */

export interface SumHuntPuzzleData {
  type: "sumhunt";
  /** Draws the same stage-indexed boards for both players. */
  seed: number;
  /** Initial sum every path must hit, starting from 20–25. */
  target: number;
}

/* ================================ Balance =============================== */

export interface BalanceScale {
  /** Fixed grey weights: peg 0–3 are left 4…1, peg 4–7 are right 1…4. */
  fixed: { peg: number; w: number }[];
  /** Loose gold weights the player must place. */
  tray: number[];
}

export interface BalancePuzzleData {
  type: "balance";
  scales: BalanceScale[];
  /** Server-side only until reveal: one balanced peg per tray weight, per scale. */
  solutions?: number[][];
}

/* ========================== Wavefront / Bastion ========================== */

/** Each run is a fixed 60 seconds; the round clock adds three of slack. */
export const WAVEFRONT_TIME_MS = 63_000;
export const BASTION_TIME_MS = 63_000;

export interface WavefrontPuzzleData {
  type: "wavefront";
  /** Draws every wave and enemy shot — identical for everyone. */
  seed: number;
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

/** Sort Rush, Flip and Parry: fixed 60-second runs; the round clock adds three of slack. */
export const SORTRUSH_TIME_MS = 63_000;
export const FLIP_TIME_MS = 63_000;
export const PARRY_TIME_MS = 63_000;

export interface SortRushPuzzleData {
  type: "sortrush";
  /** Draws the shape stream and gate swaps — identical for everyone. */
  seed: number;
}

export interface FlipPuzzleData {
  type: "flip";
  /** Draws the whole corridor — identical for everyone. */
  seed: number;
}

export interface ParryPuzzleData {
  type: "parry";
  /** Draws every arrow — identical for everyone. */
  seed: number;
}

/** Junction: a fixed 60-second run; Ink Bridge: 120 seconds. The round clock adds three of slack. */
export const JUNCTION_TIME_MS = 63_000;
export const INKBRIDGE_TIME_MS = 123_000;

export interface JunctionPuzzleData {
  type: "junction";
  /** Draws every car arrival — identical for everyone. */
  seed: number;
}

export interface InkBridgePuzzleData {
  type: "inkbridge";
  /** Draws the drops and bucket moves — identical for everyone. */
  seed: number;
}

/** Burst: a fixed 90-second run; the round clock adds three of slack. */
export const BURST_TIME_MS = 93_000;

export interface BurstPuzzleData {
  type: "burst";
  /** Draws every wave — identical for everyone. */
  seed: number;
}

/** Orbit and Swing: fixed 60-second runs; the round clock adds three of slack. */
export const ORBIT_TIME_MS = 63_000;
export const SWING_TIME_MS = 63_000;

export interface OrbitPuzzleData {
  type: "orbit";
  /** Draws the planet course — identical for everyone. */
  seed: number;
}

export interface SwingPuzzleData {
  type: "swing";
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
}

export interface HotFloorPuzzleData {
  type: "hotfloor";
  /** Draws every staged floor route and countdown — identical for everyone. */
  seed: number;
}

/* ============================ Shikaku / Light Up ======================== */

export const SHIKAKU_TIME_MS = 90_000;
export const LIGHTUP_TIME_MS = 90_000;
export const BALLTRACK_TIME_MS = 60_000;
export const WORDSEARCH_TIME_MS = 90_000;

/** Number Pyramid: five rows, every cell the sum of the two below. */
export const NUMPYRAMID_TIME_MS = 75_000;

export interface NumberPyramidPuzzleData {
  type: "numpyramid";
  /** 15 cells top to bottom; null = empty. */
  givens: (number | null)[];
  /** Tiles for the empty cells plus two decoys, shuffled. */
  tray: number[];
  /** Every cell's value — private until the reveal. */
  solution?: number[];
}

export interface BallTrackPuzzleData {
  type: "balltrack";
  cols: number;
  rows: number;
  /** One character per cell: . empty, # wall, < > fixed ramps, b blocker, l r ramp blockers. */
  tiles: string;
  /** Start column (top row) and exit column (bottom row). */
  start: number;
  exit: number;
  /** Fewest removals that reach the exit — private until the reveal. */
  minRemovals?: number;
  /** The unique minimal set of blockers to remove — private until the reveal. */
  solution?: number[];
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
  /** Where each hidden word lies — private until the reveal. */
  placements?: WordSearchPlacement[];
}

export interface ShikakuPuzzleData {
  type: "shikaku";
  size: number;
  clues: { cell: number; n: number }[];
  /** The unique partition — private until the reveal. */
  solution?: { r0: number; c0: number; r1: number; c1: number }[];
}

export interface LightUpPuzzleData {
  type: "lightup";
  size: number;
  walls: number[];
  /** Parallel to walls: the number, or -1 for a plain wall. */
  wallNumbers: number[];
  /** The unique bulb layout — private until the reveal. */
  solution?: number[];
}
