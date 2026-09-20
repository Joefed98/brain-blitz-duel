import type { PuzzleType } from "./types";

export interface PuzzleInstructionLine {
  action: string;
  detail: string;
}

export interface PuzzleInstructions {
  goal: string;
  how: [PuzzleInstructionLine, PuzzleInstructionLine, ...PuzzleInstructionLine[]];
  score: string;
}

export const PUZZLE_INSTRUCTIONS: Record<PuzzleType, PuzzleInstructions> = {
  wordsmith: {
    goal: "Make as many valid words as you can.",
    how: [
      { action: "Tap letters", detail: "to build a word." },
      { action: "Tap a used letter", detail: "to return that tile, or use Undo." },
      { action: "Submit words", detail: "with three or more letters." },
    ],
    score: "Longer words = more points.",
  },
  groups: {
    goal: "Sort all sixteen words into four groups of four.",
    how: [
      { action: "Tap four words", detail: "that share a hidden link." },
      { action: "Submit the group", detail: "to lock it in." },
      { action: "Choose carefully", detail: "because some words are red herrings." },
    ],
    score: "More groups = more points. All four = speed bonus.",
  },
  ladder: {
    goal: "Reach the final word by changing one letter at a time.",
    how: [
      { action: "Type a word", detail: "for each rung." },
      { action: "Change one letter", detail: "from the word above." },
      { action: "Press Enter", detail: "to add each valid word." },
    ],
    score: "Finish the ladder faster = more points.",
  },
  target: {
    goal: "Use the six numbers to reach the target.",
    how: [
      { action: "Tap two numbers", detail: "then choose an operation." },
      { action: "Use each number", detail: "at most once." },
      { action: "Keep every step", detail: "to a whole number." },
    ],
    score: "Exact = full points. Closer answers score more.",
  },
  numseq: {
    goal: "Find the missing next number in the sequence.",
    how: [
      { action: "Study the four terms", detail: "to spot the pattern." },
      { action: "Type the next number", detail: "in the answer box." },
      { action: "Press Submit", detail: "to lock your answer." },
    ],
    score: "Correct and faster = more points.",
  },
  equation: {
    goal: "Make the equation equal the target.",
    how: [
      { action: "Tap each gap", detail: "to choose an operator." },
      { action: "Work left to right", detail: "in the shown order." },
      { action: "Press Submit", detail: "when the equation is true." },
    ],
    score: "Correct and faster = more points.",
  },
  chaincalc: {
    goal: "Calculate the final number in the chain.",
    how: [
      { action: "Start at the top", detail: "with the first number." },
      { action: "Work downward", detail: "one operation at a time." },
      { action: "Type the result", detail: "and press Submit." },
    ],
    score: "Correct and faster = more points.",
  },
  sequence: {
    goal: "Repeat the full tile sequence in the same order.",
    how: [
      { action: "Watch the tiles", detail: "light up one by one." },
      { action: "Tap them back", detail: "in the same order." },
      { action: "Tap again", detail: "to undo your latest matching tap." },
    ],
    score: "Complete the sequence faster = more points.",
  },
  reverse: {
    goal: "Repeat the full tile sequence backwards.",
    how: [
      { action: "Watch the tiles", detail: "light up one by one." },
      { action: "Tap them back", detail: "last one first." },
      { action: "Tap again", detail: "to undo your latest matching tap." },
    ],
    score: "Complete the sequence faster = more points.",
  },
  spatial: {
    goal: "Find all eight tiles that lit up.",
    how: [
      { action: "Watch four pairs", detail: "appear on the grid." },
      { action: "Tap all eight tiles", detail: "after they vanish." },
      { action: "Choose any order", detail: "and tap again to undo." },
    ],
    score: "Find every tile faster = more points.",
  },
  reaction: {
    goal: "React as quickly as possible on all three tries.",
    how: [
      { action: "Wait for gold", detail: "before touching the screen." },
      { action: "Tap immediately", detail: "when the signal appears." },
      { action: "Avoid early taps", detail: "because they count against you." },
    ],
    score: "Lower average reaction time = more points.",
  },
  gonogo: {
    goal: "Tap every gold circle and ignore every other shape.",
    how: [
      { action: "Watch each shape", detail: "as it appears." },
      { action: "Tap gold circles", detail: "as quickly as you can." },
      { action: "Ignore everything else", detail: "without tapping." },
    ],
    score: "More correct choices = more points. Perfect = speed bonus.",
  },
  numhunt: {
    goal: "Tap all fourteen numbers from smallest to largest.",
    how: [
      { action: "Find the smallest", detail: "remaining number." },
      { action: "Tap in order", detail: "until every number is cleared." },
    ],
    score: "Faster = more points. Wrong taps cost points.",
  },
  stroop: {
    goal: "Choose the colour requested in every prompt.",
    how: [
      { action: "Read the instruction", detail: "above the colour word." },
      { action: "Tap the matching swatch", detail: "not automatically the written word." },
      { action: "Answer all twelve", detail: "before time runs out." },
    ],
    score: "More correct = more points. Perfect = speed bonus.",
  },
  symscan: {
    goal: "Find every arrow that exactly matches the target.",
    how: [
      { action: "Study the target", detail: "shape and direction." },
      { action: "Tap every match", detail: "in the grid." },
      { action: "Press Submit", detail: "only when you have them all." },
    ],
    score: "Every match must be right. Faster = more points.",
  },
  spotdiff: {
    goal: "Find all five differences between the two pictures.",
    how: [
      { action: "Compare both panels", detail: "carefully." },
      { action: "Tap each difference", detail: "in either panel." },
    ],
    score: "More differences = more points. All five = speed bonus.",
  },
  patcomp: {
    goal: "Complete all three visual patterns.",
    how: [
      { action: "Study each pattern", detail: "to find its two changing features." },
      { action: "Build the missing piece", detail: "with the pickers." },
      { action: "Submit or skip", detail: "to move to the next pattern." },
    ],
    score: "Each correct pattern scores. All three = speed bonus.",
  },
  spin: {
    goal: "Identify how each shape was turned or flipped.",
    how: [
      { action: "Compare the shapes", detail: "before and after." },
      { action: "Tap the rotation", detail: "shown by the arrows." },
      { action: "Choose FLIPPED", detail: "when the shape is mirrored." },
    ],
    score: "More correct = more points. Perfect = speed bonus.",
  },
  wordmatch: {
    goal: "Decide whether each word pair matches the rule.",
    how: [
      { action: "Read the rule", detail: "SYNONYM or ANTONYM." },
      { action: "Compare the pair", detail: "for same or opposite meaning." },
      { action: "Tap your answer", detail: "for every pair." },
    ],
    score: "More correct = more points. Perfect = speed bonus.",
  },
  pctsprint: {
    goal: "Solve all three percentage questions.",
    how: [
      { action: "Work out the percentage", detail: "shown in the question." },
      { action: "Tap the answer", detail: "from the choices." },
      { action: "Solve all three", detail: "before time runs out." },
    ],
    score: "More correct = more points. All three = speed bonus.",
  },
  numclimb: {
    goal: "Recall all twelve digits in the exact order.",
    how: [
      { action: "Memorise the digits", detail: "while they are visible." },
      { action: "Type them back", detail: "from the beginning." },
      { action: "Press Submit", detail: "when you are done." },
    ],
    score: "Each correct digit in a row increases your span.",
  },
  stopwatch: {
    goal: "Stop the marker inside the gold zone three times.",
    how: [
      { action: "Watch the marker", detail: "sweep around the track." },
      { action: "Tap once", detail: "when it reaches the gold zone." },
      { action: "Repeat three times", detail: "as accurately as possible." },
    ],
    score: "Closer average stops = more points.",
  },
  countup: {
    goal: "Count every shape that matches the question.",
    how: [
      { action: "Read the question", detail: "for the required shape and colour." },
      { action: "Count matching items", detail: "in the field." },
      { action: "Type the total", detail: "and press Submit." },
    ],
    score: "Correct and faster = more points.",
  },
  mirmatch: {
    goal: "Choose the exact mirror image of each shape.",
    how: [
      { action: "Flip the shape", detail: "across the dashed line in your head." },
      { action: "Match every colour", detail: "as well as the outline." },
      { action: "Tap the result", detail: "for all three shapes." },
    ],
    score: "More correct = more points. All three = speed bonus.",
  },
  wordhunt: {
    goal: "Find as many valid words as you can.",
    how: [
      { action: "Drag through letters", detail: "that touch, including diagonally." },
      { action: "Use four or more letters", detail: "without reusing a tile." },
      { action: "Release to submit", detail: "each word." },
    ],
    score: "Longer words = more points.",
  },
  unblock: {
    goal: "Slide the gold car through the exit.",
    how: [
      { action: "Drag each car", detail: "only along its own direction." },
      { action: "Clear a path", detail: "for the gold car." },
      { action: "Slide the gold car", detail: "out through the opening." },
    ],
    score: "Fewer moves and a faster finish = more points.",
  },
  blockparty: {
    goal: "Fill every free board square with all nine pieces.",
    how: [
      { action: "Tap a piece", detail: "to rotate it." },
      { action: "Drag its anchor", detail: "onto a free board square." },
      { action: "Fit every piece", detail: "around the fixed pegs." },
    ],
    score: "Complete the board faster = more points.",
  },
  lightsout: {
    goal: "Turn every light off.",
    how: [
      { action: "Tap a light", detail: "to flip it and its four neighbours." },
      { action: "Plan each press", detail: "because nearby lights also change." },
    ],
    score: "Fewer presses and a faster finish = more points.",
  },
  pipes: {
    goal: "Connect every pipe to the source with no leaks.",
    how: [
      { action: "Tap a tile", detail: "to rotate its pipe." },
      { action: "Join every opening", detail: "to another pipe or the source." },
      { action: "Leave no leaks", detail: "at the grid edges." },
    ],
    score: "Complete the network faster = more points.",
  },
  sudoku: {
    goal: "Fill the grid with every row, column, and box valid.",
    how: [
      { action: "Tap an empty cell", detail: "then choose a number." },
      { action: "Use 1 to 6 once", detail: "in each row, column, and box." },
      { action: "Use pencil marks", detail: "for optional notes." },
    ],
    score: "Complete the grid faster = more points.",
  },
  flow: {
    goal: "Connect all eight colour pairs and fill every square.",
    how: [
      { action: "Drag from a dot", detail: "to its matching partner." },
      { action: "Fill every square", detail: "with a coloured path." },
      { action: "Keep paths separate", detail: "because they cannot cross." },
    ],
    score: "Complete the grid faster = more points.",
  },
  iceslide: {
    goal: "Slide the ball safely to the exit.",
    how: [
      { action: "Swipe a direction", detail: "to slide until something stops you." },
      { action: "Follow one-way arrows", detail: "that turn the ball." },
      { action: "Avoid holes", detail: "or restart from the beginning." },
    ],
    score: "Fewer moves and a faster finish = more points.",
  },
  push: {
    goal: "Push every crate onto a target.",
    how: [
      { action: "Move the player", detail: "one square at a time." },
      { action: "Push one crate", detail: "by walking into it." },
      { action: "Plan ahead", detail: "because crates cannot be pulled." },
    ],
    score: "Fewer pushes and a faster finish = more points.",
  },
  laser: {
    goal: "Light all four gems with one shot.",
    how: [
      { action: "Drag mirrors", detail: "onto the grid." },
      { action: "Tap a mirror", detail: "to flip it." },
      { action: "Tap FIRE", detail: "to shoot — you get three shots and must avoid bombs." },
    ],
    score: "Faster = more points. Fewer shots = bonus.",
  },
  tower: {
    goal: "Move the full tower onto the marked peg.",
    how: [
      { action: "Tap a peg", detail: "to pick up its top disc." },
      { action: "Tap another peg", detail: "to place that disc." },
      { action: "Keep smaller discs above", detail: "larger discs at all times." },
    ],
    score: "Fewer moves and a faster finish = more points.",
  },
  maze: {
    goal: "Draw a path from the start to the exit.",
    how: [
      { action: "Drag through passages", detail: "one neighbouring cell at a time." },
      { action: "Follow the corridors", detail: "without crossing walls." },
      { action: "Reach the exit", detail: "to finish." },
    ],
    score: "Faster = more points. Wrong turns cost time.",
  },
  tubes: {
    goal: "Sort the balls so every tube is one colour.",
    how: [
      { action: "Tap a tube", detail: "to lift its top balls." },
      {
        action: "Tap where to pour",
        detail: "— onto the same colour or an empty tube; as many balls move as fit.",
      },
      { action: "Undo or Reset", detail: "if a pour traps you." },
    ],
    score: "Fewer moves earns a bonus.",
  },
  safe: {
    goal: "Find the four-digit combination that fits every clue.",
    how: [
      { action: "Use the arrows", detail: "to set each dial." },
      { action: "Tap TRY", detail: "to test — you get three tries." },
      { action: "Read every clue", detail: "because only one combination fits them all." },
    ],
    score: "Fewer tries scores more.",
  },
  bomb: {
    goal: "Follow the rules to defuse the bomb.",
    how: [
      { action: "Read the rules in order", detail: "before you touch anything." },
      { action: "Check every panel item", detail: "including the three-position switch." },
      { action: "Tap a wire or button", detail: "in the required order." },
      { action: "Two mistakes", detail: "and it explodes." },
    ],
    score: "No mistakes and fast = full points.",
  },
  gravity: {
    goal: "Tilt the board so each ball lands on its own colour's target — at the same time.",
    how: [
      { action: "Tap an arrow", detail: "and both balls slide until they hit something." },
      { action: "Use one ball", detail: "to block the other — they stop against each other." },
      { action: "Undo or Reset", detail: "if a tilt traps you." },
    ],
    score: "Fewer tilts earns a bonus.",
  },
  chain: {
    goal: "Tap the shapes in the order shown, without crossing your own line.",
    how: [
      { action: "Follow the cycle", detail: "— it repeats." },
      { action: "Keep your chain", detail: "from crossing itself." },
      { action: "Tap Undo or Reset", detail: "to take links back — mistakes still count." },
    ],
    score: "Twelve links, fast, no mistakes.",
  },
  intruder: {
    goal: "One thing changes. Find it.",
    how: [
      { action: "Memorise the grid", detail: "before it vanishes." },
      { action: "Tap the changed cell", detail: "when the grid comes back." },
      { action: "Three grids", detail: "with more shapes and colours each time." },
    ],
    score: "All three right for the speed bonus.",
  },
};
