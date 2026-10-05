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
    goal: "Make words from the nine letters — every word must use the centre letter.",
    how: [
      { action: "Four letters or more, each letter once.", detail: "There's always a nine-letter word." },
      { action: "No plurals", detail: "or -s verb forms (FINDS, BOXES); words like GLASS are fine." },
      { action: "Tap or drag through letters", detail: "then Submit, tap the word box or press Enter." },
      { action: "Words are checked", detail: "against a standard British English dictionary." },
    ],
    score: "Longer words score more; find the nine-letter word for 15. Round score = floor(2.5 × word points), up to 150.",
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
  tilegrid: {
    goal: "Build a mini crossword from your tiles.",
    how: [
      { action: "Tap a tile, then a cell.", detail: "Every touching run must be a real word, and everything must connect." },
      { action: "Double-tap a placed tile", detail: "to take it back. Clear empties the grid." },
      { action: "Tap Done", detail: "to check — red runs need fixing." },
      { action: "Words are checked", detail: "against a standard British English dictionary." },
    ],
    score: "All fifteen tiles in a valid grid = 130 + up to 20 for speed. Otherwise 8 per tile inside a real word.",
  },
  sumhunt: {
    goal: "Clear paths of digits that add up to the target — it rises every time.",
    how: [
      { action: "Swipe or tap touching cells", detail: "Move up, down, left or right; matching the target submits automatically." },
      { action: "A new board slides in", detail: "after each of the first eight clears; finish by chaining the whole grid." },
    ],
    score: "10 per stage; clear the whole grid to finish for the time bonus.",
  },
  balance: {
    goal: "Balance the scale.",
    how: [
      { action: "Tap a weight, then a gold peg line.", detail: "Further from the middle counts more — a 2 on peg 3 equals a 3 on peg 2." },
      { action: "Double-tap a placed weight", detail: "to return it to the tray." },
    ],
    score: "20, 40 and 60 for scales 1, 2 and 3. All three = 120 + up to 30 for speed.",
  },
  wordslide: {
    goal: "Slide rows and columns until every row is a word.",
    how: [
      { action: "Swipe a row sideways or a column up and down", detail: "— letters wrap around the edge." },
      { action: "Tap Undo or Reset", detail: "to take shifts back; they still count as moves." },
      { action: "Lock a finished word with the padlock", detail: "so it stays put — column swipes go around it." },
      { action: "Words are checked", detail: "against a standard British English dictionary." },
    ],
    score: "All five rows words = 100 + up to 30 for speed + up to 20 for moves (full at par, 0 at twice par). Otherwise 22 per word row.",
  },
  ladder: {
    goal: "Reach the final word by changing one letter at a time.",
    how: [
      { action: "Type a word", detail: "for each rung." },
      { action: "Change one letter", detail: "from the word above." },
      { action: "Press Enter", detail: "to add each valid word." },
      { action: "Words are checked", detail: "against a standard British English dictionary." },
    ],
    score: "Finish the ladder faster = more points. Getting close still scores.",
  },
  target: {
    goal: "Use the six numbers to reach the target.",
    how: [
      { action: "Tap two numbers", detail: "then choose an operation." },
      { action: "Use each number", detail: "at most once." },
      { action: "Keep every step", detail: "to a whole number." },
    ],
    score: "Exact = 130 + up to 20 for speed. Off by 1 = 120, falling faster the further off; 120+ away scores 0.",
  },
  numseq: {
    goal: "Work out the next number in each sequence.",
    how: [
      { action: "Five sequences", detail: "one after the other, getting harder." },
      { action: "Tap the answer", detail: "you can't go back." },
      { action: "Finish all five", detail: "inside forty-five seconds." },
    ],
    score: "Twenty a sequence. All five right for the speed bonus.",
  },
  equation: {
    goal: "Make three growing equations equal their targets.",
    how: [
      { action: "Tap each gap", detail: "to choose an operator, worked left to right." },
      { action: "A true equation", detail: "moves on by itself." },
      { action: "Press Next", detail: "to skip ahead — 90 seconds for all three." },
    ],
    score: "30, 40 and 50 for the three equations; all three for the time bonus.",
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
    goal: "Tap the instant the screen turns gold — five to eight times.",
    how: [
      { action: "Wait.", detail: "" },
      { action: "Don't tap the other colours,", detail: "or you'll get a false start." },
    ],
    score: "150 at 200 ms average or faster, −16 per 100 ms slower; misses count 1,200 ms; −8 per false start.",
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
    goal: "Tap all 24 numbers from smallest to largest.",
    how: [
      { action: "Find the smallest", detail: "remaining number." },
      { action: "Tap in order", detail: "until every number is cleared." },
      { action: "Keep looking", detail: "— untapped numbers move every 15 seconds." },
    ],
    score: "5 per number in order; all 24 = 130 + speed bonus up to 20; −5 per wrong tap. Maximum 150.",
  },
  stroop: {
    goal: "Steer each falling word into the matching coloured gate.",
    how: [
      { action: "Use ◀ ▶, the joystick, or tap a lane", detail: "to steer the word." },
      { action: "Swipe down or press ▼", detail: "to drop it quickly." },
      { action: "Watch the banner", detail: "— the rule swaps every 15 seconds." },
    ],
    score: "Points for the share you sort right; wrong gates cost 2.",
  },
  symscan: {
    goal: "Find every matching arrow in three growing grids.",
    how: [
      { action: "Tap every match", detail: "of each grid's target arrow." },
      { action: "Press Submit", detail: "to lock each grid and move on — 30 seconds for all three." },
    ],
    score: "Stages worth 30 / 45 / 55: share of arrows found, −3 per wrong tap. All three perfect adds up to 20 for speed.",
  },
  spotdiff: {
    goal: "Find all six differences between the two pictures.",
    how: [
      { action: "Compare both panels", detail: "carefully." },
      { action: "Tap each difference", detail: "in either panel." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 20 per difference found.",
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
    score: "All eight = 100 plus speed. Otherwise 13 per correct pair, up to 90.",
  },
  pctsprint: {
    goal: "Solve all five percentage questions.",
    how: [
      { action: "Work out the percentage", detail: "shown in the question." },
      { action: "Tap the answer", detail: "from the choices." },
      { action: "Solve all five", detail: "in the 45 seconds." },
    ],
    score: "More correct = more points. All five = speed bonus.",
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
    goal: "Stop the marker in the gold zone — ten times, each one trickier.",
    how: [
      { action: "Tap to stop it.", detail: "" },
      { action: "Some targets move", detail: "— stop when the marker and the target line up." },
      { action: "The counter drops at the right edge", detail: "from 2 on Watch 1 to 11 on Watch 10." },
      { action: "Watches 8–10 wrap", detail: "from the right edge back to the left." },
    ],
    score: "150 at 20 ms average error or closer, −27 per 100 ms more; misses count 500 ms.",
  },
  countup: {
    goal: "Count the matching shapes in three crowded scenes.",
    how: [
      { action: "Read the question", detail: "— each field asks for a new shape and colour." },
      { action: "Type the total", detail: "on the keypad; ENTER moves to the next field." },
      { action: "Three scenes", detail: "share 45 seconds." },
    ],
    score: "Stages worth 30 / 45 / 55: exact = full, off by 1 = 60%, off by 2 = 30%. All three exact adds up to 20 for speed.",
  },
  mirmatch: {
    goal: "Choose the exact mirror image of each shape.",
    how: [
      { action: "Flip the shape", detail: "across the dashed line in your head." },
      { action: "Match every colour", detail: "as well as the outline." },
      { action: "Tap the result", detail: "for all five shapes." },
    ],
    score: "More correct = more points. All five = speed bonus.",
  },
  wordhunt: {
    goal: "Find as many valid words as you can.",
    how: [
      { action: "Drag or tap through letters", detail: "that touch, including diagonally." },
      { action: "Use four or more letters", detail: "without reusing a tile. Plurals count." },
      { action: "Release, tap the last letter again, or tap Submit", detail: "to submit each word." },
      { action: "Words are checked", detail: "against a standard British English dictionary." },
    ],
    score: "Round score = 2 × word points, up to 150. The counter shows word points.",
  },
  unblock: {
    goal: "Slide the gold car through the exit.",
    how: [
      { action: "Drag each car", detail: "only along its own direction." },
      { action: "Clear a path", detail: "for the gold car." },
      { action: "Slide the gold car", detail: "out through the opening." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed. Unfinished: up to 70 for clearing the gold car's lane.",
  },
  blockparty: {
    goal: "Fill every free board square with all nine pieces.",
    how: [
      { action: "Tap a piece", detail: "to rotate it." },
      { action: "Drag its anchor", detail: "onto a free board square." },
      { action: "Fit every piece", detail: "around the fixed pegs." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 12 per piece placed.",
  },
  lightsout: {
    goal: "Turn every light off.",
    how: [
      { action: "Tap a light", detail: "to flip it and its four neighbours." },
      { action: "Plan each press", detail: "because nearby lights also change." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed. Unfinished: 1–4 lights left = 85 / 75 / 60 / 50.",
  },
  pipes: {
    goal: "Connect every pipe to the source with no leaks.",
    how: [
      { action: "Tap a tile", detail: "to rotate its pipe." },
      { action: "Join every opening", detail: "to another pipe or the source." },
      { action: "Leave no leaks", detail: "at the grid edges." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 48 = 90, 47–45 = 85, then 5 less per two tiles down to 40 at 27; fewer score 1.5 each.",
  },
  sudoku: {
    goal: "Fill the grid with every row, column, and box valid.",
    how: [
      { action: "Tap an empty cell", detail: "then choose a number." },
      { action: "Use 1 to 6 once", detail: "in each row, column, and box." },
      { action: "Use pencil marks", detail: "for optional notes." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 110 × correct cells ÷ empty cells.",
  },
  flow: {
    goal: "Connect every colour pair and fill every square.",
    how: [
      { action: "Drag from a dot", detail: "to its matching partner." },
      { action: "Avoid dark walls", detail: "— no path can enter them." },
      { action: "Fill every square", detail: "with a coloured path." },
      { action: "Keep paths separate", detail: "because they cannot cross." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 10 per pair joined.",
  },
  iceslide: {
    goal: "Slide the ball safely to the exit.",
    how: [
      { action: "Swipe a direction", detail: "to slide until something stops you." },
      { action: "Follow one-way arrows", detail: "that turn the ball; avoid holes or restart." },
      { action: "Portals carry you across the board.", detail: "Cracked ice breaks after you cross it once." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed. Unfinished: up to 90 for the distance closed.",
  },
  push: {
    goal: "Push every crate onto a target.",
    how: [
      { action: "Move the player", detail: "one square at a time." },
      { action: "Push one crate", detail: "by walking into it." },
      { action: "Plan ahead", detail: "because crates cannot be pulled." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed. Unfinished: 110 × crates home ÷ crates.",
  },
  laser: {
    goal: "Light all six gems with one shot.",
    how: [
      { action: "Drag mirrors", detail: "onto the grid — all nine are needed." },
      { action: "Tap a mirror", detail: "to flip it." },
      { action: "Tap FIRE", detail: "to shoot — you get three shots and must avoid bombs." },
      { action: "Follow special tiles", detail: "— splitters divide the beam. Gems with an arrow only light from that side." },
    ],
    score: "Every gem on fire 1 / 2 / 3 = 130 / 115 / 100, + up to 20 for speed. Otherwise 15 per gem lit; never fired = 0.",
  },
  tower: {
    goal: "Move the full tower onto the marked peg.",
    how: [
      { action: "Tap a peg", detail: "to pick up its top disc." },
      { action: "Tap another peg", detail: "to place that disc." },
      { action: "Keep smaller discs above", detail: "larger discs at all times." },
      { action: "Count the pegs", detail: "— each puzzle has 3 or 4." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed. Unfinished: 110 × discs home from the bottom ÷ discs.",
  },
  maze: {
    goal: "Draw a path from the start to the exit.",
    how: [
      { action: "Drag through passages", detail: "one neighbouring cell at a time." },
      { action: "Follow the corridors", detail: "without crossing walls." },
      { action: "Reach the exit", detail: "to finish." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 110 × share of the route reached.",
  },
  tubes: {
    goal: "Sort the balls so every tube is one colour.",
    how: [
      { action: "Tap a tube", detail: "to lift its top balls." },
      {
        action: "Tap where to pour",
        detail: "— onto the same colour or an empty tube; as many balls move as fit (5 per tube).",
      },
      { action: "Undo or Reset", detail: "if a pour traps you." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed. Unfinished: 22 per single-colour tube.",
  },
  safe: {
    goal: "Find the four-digit combination that fits every clue.",
    how: [
      { action: "Use the arrows", detail: "to set each dial." },
      { action: "Tap TRY", detail: "to test — you get three tries." },
      { action: "Read every clue", detail: "because only one combination fits them all." },
    ],
    score: "Opened on try 1 / 2 / 3 = 130 / 115 / 100, + up to 20 for speed. Otherwise 15 per dial right on the last try.",
  },
  bomb: {
    goal: "Read all six rules, work out the four actions and their order, then do them.",
    how: [
      {
        action: "Only one plan fits",
        detail: "the six rules together allow exactly one four-action sequence. Wires are numbered 1–7 from the left.",
      },
      { action: "Four steps exactly", detail: "tap wires and buttons, then tap DEFUSE." },
      { action: "One wrong step", detail: "and it explodes." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 25 per correct step before the strike, up to 75.",
  },
  gravity: {
    goal: "Tilt the board to park all four balls on their own targets.",
    how: [
      { action: "Every ball slides until it hits something.", detail: "" },
      { action: "A ball on its target locks and becomes a wall", detail: "— which can help or hurt the others." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed. Unfinished: 30 per locked ball.",
  },
  chain: {
    goal: "Tap 25 nodes in order, following the repeating cycle — shape and colour must both match.",
    how: [
      { action: "Follow the cycle", detail: "at the top; the lit item is the one you need next." },
      { action: "Keep momentum", detail: "— tap again before the gold ring empties (3 s, then 2.5 s from link 11, 2 s from link 19)." },
      { action: "One wrong tap or an empty ring", detail: "breaks the chain and ends the round." },
      { action: "Every 5 links", detail: "the board reshuffles. Watch for look-alikes: right shape, wrong colour." },
    ],
    score: "6 points per link; 25 links = 150. No time bonus.",
  },
  intruder: {
    goal: "Find everything that changed.",
    how: [
      { action: "Memorise each grid", detail: "before it disappears." },
      { action: "Tap every change", detail: "— later boards contain two." },
      { action: "Five rounds", detail: "— 7 s to memorise, 5 s to pick; on the last two the symbols slide inside the grid." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 24 per board right; one of two changes earns 12.",
  },
  nonogram: {
    goal: "Fill the grid so every row and column matches its numbers.",
    how: [
      { action: "Tap to fill", detail: "a cell, tap again to mark it empty." },
      { action: "Read the numbers", detail: "as the lengths of the filled runs, in order." },
      { action: "A line dims", detail: "once it matches its numbers." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 110 × correct cells ÷ cells, −5 per wrong cell, up to 110.",
  },
  pairmatch: {
    goal: "Find all fifteen matching pairs.",
    how: [
      { action: "Tap two cards", detail: "to turn them over." },
      { action: "A match stays up", detail: "— a miss flips back." },
      { action: "Remember", detail: "where everything was." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 8 per pair found.",
  },
  flood: {
    goal: "Flood the whole board with one colour.",
    how: [
      { action: "Tap a colour", detail: "to change your region." },
      { action: "Your region grows", detail: "into every touching cell of that colour." },
      { action: "Start from the top-left", detail: "— that cell is always yours." },
    ],
    score: "Solved = 100 + up to 40 for moves (full at par, 0 at twice par) + up to 10 for speed. Otherwise 110 × region ÷ 196.",
  },
  stroke: {
    goal: "Trace every line in one stroke without lifting your finger.",
    how: [
      { action: "Start on any dot", detail: "and drag along the lines." },
      { action: "No line twice", detail: "— you can't go back over one." },
      { action: "Lift your finger", detail: "to start the figure again." },
    ],
    score: "First try earns a bonus.",
  },
  tiles: {
    goal: "Slide the tiles into order, 1 to 8.",
    how: [
      { action: "Tap a tile", detail: "next to the gap to slide it in." },
      { action: "Finish left to right", detail: "with the gap bottom-right." },
      { action: "Tap Undo or Reset", detail: "to take slides back." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed. Unfinished: 14 per tile in place, up to 90.",
  },
  rings: {
    goal: "Turn the rings so every spoke is one colour.",
    how: [
      { action: "Select a ring", detail: "then use the arrow buttons to turn it." },
      { action: "Check the legend", detail: "— some rings turn others with them, same way or opposite." },
      { action: "Watch the rim", detail: "for a gold tick on each finished spoke." },
    ],
    score: "Fewest moves + speed: solved = 100 + up to 25 for moves (full at the minimum, 0 at twice it) + up to 25 for speed. Unfinished: 12 per aligned spoke.",
  },
  hover: {
    goal: "Fly through as many gaps as you can.",
    how: [
      { action: "Tap anywhere", detail: "to hover up; let go to drop." },
      { action: "Hit anything", detail: "and the run ends." },
      { action: "Everyone flies", detail: "the same course for sixty seconds." },
    ],
    score: "150 × gates passed ÷ total gates.",
  },
  swerve: {
    goal: "Collect coins while dodging the blocks.",
    how: [
      { action: "Tap left or right", detail: "to swerve one lane across five lanes." },
      { action: "Hit a block", detail: "and the run ends." },
      { action: "Every coin", detail: "speeds the course up a little." },
    ],
    score: "75 coins in the run; 2 per coin, so all 75 = 150.",
  },
  skyline: {
    goal: "Stack the blocks as high as you can.",
    how: [
      { action: "Tap to drop", detail: "the sliding block onto the tower." },
      { action: "Overhang is cut", detail: "so the next block is narrower." },
      { action: "Line it up exactly", detail: "and the block grows back a little." },
    ],
    score: "3 per block stacked + 2 per perfect drop, up to 150.",
  },
  bintoss: {
    goal: "Throw the ball into the bin — ten throws.",
    how: [
      { action: "Touch and drag to aim", detail: "the dotted path shows where it will go." },
      {
        action: "Each wind point moves the ball a quarter of a bin width.",
        detail: "Wind 2 to the left? Aim half a bin width to the right.",
      },
      { action: "The bin moves", detail: "further away every throw, and gets narrower from throw 4." },
      { action: "From throw 7 the bin slides", detail: "side to side — time your release." },
    ],
    score: "10 per basket; all ten = 130 + up to 20 for time left.",
  },
  bullseye: {
    goal: "Hit the centre — ten arrows.",
    how: [
      { action: "Touch and drag to aim", detail: "the dotted path shows where it will go." },
      {
        action: "Your aim sways — watch the ring and release at the right moment.",
        detail: "The ring circles once every two seconds.",
      },
      {
        action: "The wind moves your arrow by that many rings.",
        detail: "Wind 2 to the right? Aim two rings to the left.",
      },
      { action: "The target", detail: "gets further away each shot." },
      { action: "From the fourth arrow the target moves — lead it.", detail: "It is scored where it is when the arrow lands." },
      { action: "From the seventh arrow the ring values swap places.", detail: "Read the numbers — each value keeps its colour." },
    ],
    score: "1.5 × your ring points, up to 150. Unfired arrows score 0.",
  },
  matchup: {
    goal: "Make lines of three or more matching symbols.",
    how: [
      { action: "Swap two neighbours", detail: "by dragging one onto the other." },
      { action: "Make four, five, or a T / L", detail: "to create a bomb (nearby blast), white four-point star (row and column) or six-point star (both diagonals), including on cascades." },
      { action: "Trigger specials", detail: "to clear nearby symbols and start chain reactions." },
      { action: "Sixty seconds", detail: "on the same board for everyone." },
    ],
    score: "3 = 10, 4 = 25, 5 = 50; 2,000 points = 150, fewer in proportion.",
  },
  snake: {
    goal: "Eat the pellets and don't hit anything.",
    how: [
      { action: "Swipe to turn", detail: "up, down, left or right." },
      { action: "You grow with every pellet", detail: "and you speed up." },
      { action: "Everyone gets", detail: "the same food in the same order." },
    ],
    score: "5 points per pellet eaten, up to 150.",
  },
  cross: {
    goal: "Get across the traffic as many times as you can.",
    how: [
      { action: "Swipe up to hop", detail: "one lane forward; swipe down to step back." },
      { action: "Swipe left or right", detail: "to move sideways." },
      {
        action: "After each crossing",
        detail: "you get a second on the kerb before the next one.",
      },
      { action: "Three lives", detail: "a hit costs one and restarts you on the start lane of this crossing after a second." },
    ],
    score: "4 per lane advanced, +4 per crossing, +8 more for a clean crossing with no hits, up to 150.",
  },
  dual: {
    goal: "Keep both runners alive.",
    how: [
      { action: "Left thumb jumps", detail: "the left runner." },
      {
        action: "Right thumb jumps",
        detail: "the right runner. Tap again in the air to double jump.",
      },
      { action: "Same course", detail: "for everyone." },
    ],
    score: "The longer both survive, the more you score: all 60 seconds = 150, 45 s ≈ 84, 30 s ≈ 37.",
  },
  breaker: {
    goal: "Clear the wall.",
    how: [
      { action: "Drag to move the paddle", detail: "anywhere on the board." },
      { action: "Keep the ball up", detail: "— it gets faster with bricks and with time." },
      { action: "Darker blue bricks take 2 or 3 hits", detail: "— each hit cracks them down a tier." },
      { action: "Four starred power-up bricks drop a capsule", detail: "gold = laser, silver = ×5 balls, bronze = ×2 balls (works at once)." },
      { action: "Tap anywhere to fire", detail: "a laser or ×5 you've caught; any other touch moves the paddle." },
    ],
    score: "130 × bricks destroyed ÷ 80; all 80 = 130 + up to 20 for time left.",
  },
  rally: {
    goal: "Keep the rally going.",
    how: [
      { action: "Drag to move the paddle", detail: "along the bottom." },
      { action: "Every hit", detail: "makes the paddle smaller and the ball faster." },
      { action: "A gold ball drops in", detail: "every ten seconds — only gold hits score." },
      { action: "Miss the blue ball", detail: "and the run is over." },
    ],
    score: "3 per gold-ball hit, up to 150. The blue ball scores nothing.",
  },
  steady: {
    goal: "Stay inside the track.",
    how: [
      {
        action: "Slide the ball left and right",
        detail: "to stay inside the track. It gets narrower and faster.",
      },
      { action: "Touching an edge", detail: "costs a touch every half second until you're back inside." },
      { action: "Keep your finger down", detail: "— lifting it for more than half a second costs touches too." },
    ],
    score: "150 − 5 per touch.",
  },
  slice: {
    goal: "Slice the flying discs. Don't hit the bombs.",
    how: [
      { action: "Swipe through the discs", detail: "to slice them in half." },
      { action: "Never touch the dark bombs", detail: "— each one costs ten points." },
      {
        action: "Two star specials",
        detail: "— the rainbow star opens three bomb-free seconds; the silver star slows everything for four.",
      },
      { action: "Cut 3+ discs in one swipe", detail: "one finger-down-to-up path counts together, even a curve or loop. First combo gives ×2, second gives ×3. Each combo resets 10 seconds; only expiry returns you to ×1." },
      { action: "Each swipe has a length limit", detail: "— curve it, but it stops after about three-quarters of the screen." },
    ],
    score: "floor(235 × combo-weighted slices ÷ (3 × discs available)) −10 per bomb; capped at 150.",
  },
  bubble: {
    goal: "Pop the bubbles by matching three of a colour.",
    how: [
      { action: "Drag to aim, release to shoot", detail: "— bounce off the walls." },
      { action: "Three of a colour pop", detail: "when they touch." },
      { action: "Bubbles left hanging", detail: "fall off the field." },
      { action: "Ninety seconds", detail: "on the same field for everyone." },
    ],
    score: "130 × share of starting bubbles cleared; clear the field = 130 + up to 20 for time left.",
  },
  beat: {
    goal: "Tap the notes in time.",
    how: [
      { action: "Tap a lane", detail: "as its note reaches the line." },
      { action: "Closer is better", detail: "— perfect, good, or just OK." },
      { action: "A tap with no note", detail: "costs nothing." },
      { action: "Notes with a tail are holds", detail: "— press as the head reaches the line, release as the tail reaches it. Both ends must be Perfect for Perfect, or within Good for Good; otherwise Miss." },
      { action: "Keep a combo going", detail: "to light up the lanes at 10, 25 and 50 — a miss resets it." },
    ],
    score: "Perfect 1, good 0.75, OK 0.25, miss −2, up to 150. Holds score only after both ends are judged; mistimed releases miss the whole note.",
  },
  ricochet: {
    goal: "Climb the shaft by leaping wall to wall.",
    how: [
      { action: "Tap to jump across", detail: "to the opposite wall." },
      { action: "Don't land on the spikes", detail: "or the run ends." },
      { action: "Don't slide", detail: "all the way back to the bottom." },
    ],
    score: "2 points per metre climbed, up to 150.",
  },
  tendrop: {
    goal: "Make the running total hit the target exactly.",
    how: [
      { action: "Tap falling tiles", detail: "— each one applies to the total in tap order." },
      { action: "×2, ÷2, ÷3 and −N", detail: "work on the total; a ÷ that doesn't divide exactly is refused." },
      { action: "Go past the target", detail: "and the total drops back to 0." },
    ],
    score: "13 per target cleared. All ten adds up to 20 for clearing them early.",
  },
  clayshoot: {
    goal: "Shoot all 25 clays out of the sky.",
    how: [
      { action: "Tap a clay", detail: "to fire — the shot lands exactly where you tap." },
      { action: "Unlimited shots,", detail: "no reload." },
      { action: "Gold clays are faster and harder", detail: "and worth twice as much." },
      { action: "Later on, two fly at once", detail: "— keep watching both edges." },
    ],
    score: "5 per orange, 10 per gold, plus 10 for all 25. Maximum 150.",
  },
  whack: {
    goal: "Tap the targets the banner tells you to.",
    how: [
      { action: "Balls pop up briefly", detail: "— the window shrinks as the run goes on." },
      { action: "The rule flips 3–5 times", detail: "at unpredictable moments — watch the banner." },
      { action: "Never tap a bomb", detail: "— bombs cost 5; a wrong-colour ball or an empty hole costs 3." },
    ],
    score: "Up to 135 for the share of targets hit, −3 per wrong ball, −5 per bomb, −3 per empty tap, +15 for hitting every target. Maximum 150.",
  },
  wavefront: {
    goal: "Shoot down the formation before it reaches you.",
    how: [
      { action: "Drag to move", detail: "— you fire automatically." },
      { action: "Dodge the red bolts.", detail: "Three hits and you're out." },
      { action: "From wave 2, a grey armoured block", detail: "takes 6–12 hits — every hit counts." },
      { action: "Shoot the saucer", detail: "and catch its drop: 5 laser shots that pierce up to 3 enemies." },
    ],
    score: "Points for shapes, armour hits, saucers and waves. Clearing wave 5 perfectly scores 150.",
  },
  bastion: {
    goal: "Defend the base.",
    how: [
      { action: "Touch where you want to aim", detail: "— the turret follows and fires all the time." },
      { action: "Prefer buttons?", detail: "Turn on Arrows and hold ◀ ▶ to turn the barrel." },
      { action: "Squares take two hits;", detail: "triangles split." },
    ],
    score: "1 per shape; keep the base alive for the bonus.",
  },
  rooftop: {
    goal: "Survive the rooftops as long as you can.",
    how: [
      { action: "Swipe left or right", detail: "to change lane, up to jump, down to slide." },
      { action: "It keeps getting faster.", detail: "" },
    ],
    score: "The longer you last, the more you score — the full minute is 150.",
  },
  sortrush: {
    goal: "Sort every shape into the gate of its colour.",
    how: [
      { action: "Swipe left or right", detail: "— from 20 seconds there's a middle gate too (swipe down)." },
      { action: "The gate colours swap;", detail: "watch for the flash." },
    ],
    score: "Points for the share you sort; wrong gates cost 2.",
  },
  flip: {
    goal: "Run the corridor — flip to the other side to dodge.",
    how: [
      { action: "Tap to flip gravity.", detail: "" },
      { action: "Spikes and gaps on one side", detail: "mean run on the other." },
      { action: "From 20 s the corridor bends.", detail: "Hazards ride the bends with you." },
    ],
    score: "The longer you last, the more you score — the full minute is 150.",
  },
  parry: {
    goal: "Block every arrow with the gong shield.",
    how: [
      { action: "Swipe in any of eight directions", detail: "or use ⟲ ⟳ to move one position." },
      { action: "A diagonal blocks both neighbours", detail: "— at 1:30 it covers the top and the right." },
      { action: "Later they come in pairs", detail: "and some swerve at the last moment. Three hits and you're out." },
    ],
    score: "2 per arrow deflected, −10 per life lost.",
  },
  junction: {
    goal: "Keep the traffic moving without a crash.",
    how: [
      { action: "Tap the black corner beside a road", detail: "to switch its light between red (stop) and green (go)." },
      { action: "Cars on red queue up", detail: "— and they don't wait forever." },
      { action: "Later,", detail: "some cars turn — they flash an indicator a second before the line." },
      { action: "Ambulances (flashing blue)", detail: "come fast from 20 s — give them green before they reach the line." },
    ],
    score: "3 per car through, −1 per car that gives up, +5 per ambulance waved through, −5 if one has to stop, +40 for surviving the minute.",
  },
  inkbridge: {
    goal: "Draw a path so the ball rolls into the bucket.",
    how: [
      { action: "Draw lines around the grey blocks,", detail: "then tap RELEASE." },
      { action: "Ink is limited", detail: "— more each level." },
      { action: "Three failed drops", detail: "and you're out." },
    ],
    score: "11 per level; all ten = 130 + up to 20 for time left.",
  },
  burst: {
    goal: "Pop every ball — big ones split into smaller ones.",
    how: [
      { action: "Hold ◀ or ▶ to move,", detail: "tap the arena or FIRE to shoot straight up." },
      { action: "Pop a purple ball and catch the gold icon", detail: "for triple BURST shots until you lose a life." },
      { action: "Blue balls sometimes drop a teal SHIELD", detail: "— it takes the next hit for you." },
      { action: "Don't let a ball touch you", detail: "— three touches and you're out." },
    ],
    score: "2 per ball popped or split, −9 per life lost. Clear four waves without losing a life for 150.",
  },
  orbit: {
    goal: "Hop from planet to planet.",
    how: [
      { action: "You orbit automatically.", detail: "Tap to let go — you fly straight until the next orbit catches you." },
      { action: "Miss and you drift away.", detail: "Avoid the red arcs." },
      { action: "Orbits change shape.", detail: "Ovals speed up near the planet. On a figure-eight, let go only on the outer loops — never at the crossing." },
    ],
    score: "3 per planet; reach the sun (planet 40) = 130 + up to 20 for time left. The planet you hold at 30 s is a checkpoint: one respawn there after a later crash.",
  },
  snip: {
    goal: "Feed the sweet to the mouth.",
    how: [
      { action: "Swipe across a rope", detail: "to cut it — time it with the swing." },
      { action: "Cut the last rope", detail: "and the sweet drops; the camera follows across the wider arena. Its walls bounce it without losing speed." },
      { action: "Don't let it settle on a ledge", detail: "or fly out the top or bottom — 10 levels, 12 s each." },
    ],
    score: "10 per sweet fed, +3 for each level's single star; feed all ten for round(20 × time left ÷ 60 s). Cap 150.",
  },
  swing: {
    goal: "Swing to the 500 m finish.",
    how: [
      { action: "Hold to grab an anchor and swing,", detail: "let go to fly." },
      { action: "Stuck? Keep swinging", detail: "— every pass gets you higher. Swipe up to shorten the rope for speed." },
      { action: "Don't touch the spikes", detail: "or fall to the floor." },
    ],
    score: "130 × metres ÷ 500; reaching 500 m = 130 + up to 20 for time left.",
  },
  tilt: {
    goal: "Roll the ball out of the maze.",
    how: [
      { action: "Drag left or right to spin the maze", detail: "— the ball always rolls down." },
      { action: "Each escape brings a harder maze.", detail: "Red spikes end the run." },
      { action: "From maze 2 a red ball waits behind a silver gate.", detail: "Pass the padlock and it's free — it tilts with you. Touch it and the run ends." },
    ],
    score: "Four mazes, 30 each. All four = 130 + up to 20 for time left.",
  },
  hotfloor: {
    goal: "Plan a route to the exit before the floor falls.",
    how: [
      { action: "Each number is how many hops that tile lasts after you press GO.", detail: "" },
      { action: "Tap tiles to draw your route, then GO.", detail: "Stay within the hop budget. UNDO removes the last tile." },
      { action: "You have 120 seconds.", detail: "" },
    ],
    score: "15 per stage.",
  },
  shikaku: {
    goal: "Cut the grid into rectangles, one number each.",
    how: [
      { action: "Drag from corner to corner", detail: "to draw a rectangle." },
      { action: "Each rectangle must hold exactly one number,", detail: "and that number is its size in squares." },
      { action: "Cover every square.", detail: "" },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 110 × cells covered ÷ 100.",
  },
  dig: {
    goal: "Dig a path for the water to the drain.",
    how: [
      { action: "Limited digs.", detail: "Drag across gold sand to dig it." },
      { action: "Sand falls when you dig under it.", detail: "Fallen sand packs and can't be dug." },
      { action: "Avoid acid and lava.", detail: "Still water evaporates." },
    ],
    score: "Fill the drain with clean water: 100 + time bonus, +20 within the planned digs. Otherwise points for clean water drained.",
  },
  trail: {
    goal: "Draw one path from 1 to 36 through every square.",
    how: [
      { action: "Drag from the end of the path", detail: "to any touching square — sideways, up, down or diagonal." },
      { action: "Ten dark numbers are fixed", detail: "— the path must reach each one at exactly that step. You fill the other 26." },
      { action: "Undo removes your last square; Reset clears your path.", detail: "Dragging back along the path also undoes. Fixed numbers stay." },
    ],
    score: "Complete path = 130 + up to 20 for speed. Otherwise 5 per tile right from 1.",
  },
  numpyramid: {
    goal: "Complete four pyramids: every cell is the sum of the two below it.",
    how: [
      { action: "Drag a tile", detail: "from the tray into an empty cell." },
      { action: "Double-tap a placed tile", detail: "to return it to the tray; drag it onto another cell to swap." },
      { action: "Two tiles are decoys", detail: "— nothing fills itself in." },
      { action: "Skip", detail: "moves to the next pyramid without completing this one." },
    ],
    score: "30 per completed pyramid, plus up to 30 for finishing all four early. The current pyramid earns proportional partial points.",
  },
  balltrack: {
    goal: "Steer every ball into the tray of its colour.",
    how: [
      { action: "Balls drop every 2 seconds", detail: "and snake down the track." },
      { action: "Tap a gold tube to turn it into a drop", detail: "— the bottom row is fixed, so send each ball down early…" },
      { action: "…the track's bottom row re-lays and the trays swap colours mid-round", detail: "— watch for both." },
    ],
    score: "120 × balls home ÷ 25; all 25 home = 130 + up to 20 for time left. Wrong trays score nothing.",
  },
  wordsearch: {
    goal: "Find the six hidden words from the category.",
    how: [
      { action: "Drag in a straight line", detail: "through the letters — any of eight directions, backwards too." },
      { action: "A hidden word turns gold.", detail: "Only the count shows until you find them." },
    ],
    score: "20 per word. Find all six for 130 plus up to 20 speed points.",
  },
  letterwheel: {
    goal: "Fill the crossword using the letters on the wheel.",
    how: [
      { action: "Drag through the letters and let go,", detail: "or tap letters then Submit or the word." },
      { action: "Crossword words fill gold.", detail: "Other real words are not in this puzzle." },
    ],
    score: "15 per word on eight-word puzzles, 13 on nine-word puzzles. Find them all for 130 plus up to 20 for speed.",
  },
  lightup: {
    goal: "Place bulbs so every white square is lit.",
    how: [
      { action: "A bulb lights everything in its row and column", detail: "until it hits a black wall." },
      { action: "Bulbs must never shine on each other.", detail: "" },
      { action: "A number on a wall", detail: "says exactly how many bulbs touch that wall's sides." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 110 × lit cells ÷ white cells, −5 per clashing bulb.",
  },
  tents: {
    goal: "Pitch one tent beside every tree.",
    how: [
      { action: "Tap a cell", detail: "for a tent, again for grass, again to clear." },
      { action: "Tents can't touch,", detail: "even diagonally." },
      { action: "The numbers", detail: "say how many tents are in each row and column." },
    ],
    score: "Complete = 130 + up to 20 for speed. Otherwise 10 per correct tent; wrong tents cost nothing.",
  },
};
