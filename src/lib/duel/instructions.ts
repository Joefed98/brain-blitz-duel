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
      { action: "Tap or drag through letters", detail: "to build a word." },
      { action: "Tap a used letter", detail: "to remove it and every letter after it, or use Undo." },
      { action: "Submit words", detail: "with four or more letters." },
    ],
    score: "Round score = 3 × word points, up to 150. The counter shows word points.",
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
    ],
    score: "More tiles placed scores more; all twelve for the time bonus.",
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
    score: "One point-third per scale; all three for the time bonus.",
  },
  wordslide: {
    goal: "Slide rows and columns until every row is a word.",
    how: [
      { action: "Swipe a row sideways or a column up and down", detail: "— letters wrap around the edge." },
      { action: "Tap Undo or Reset", detail: "to take shifts back; they still count as moves." },
      { action: "Lock a finished word with the padlock", detail: "so it stays put — column swipes go around it." },
    ],
    score: "Fewer moves is what counts; speed is a small extra.",
  },
  ladder: {
    goal: "Reach the final word by changing one letter at a time.",
    how: [
      { action: "Type a word", detail: "for each rung." },
      { action: "Change one letter", detail: "from the word above." },
      { action: "Press Enter", detail: "to add each valid word." },
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
    score: "Exact = full points. Closer answers score more.",
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
    goal: "React as quickly as possible on all three tries.",
    how: [
      { action: "Wait for gold", detail: "before touching the screen." },
      { action: "Tap immediately", detail: "when the signal appears." },
      { action: "Avoid early taps", detail: "because they count against you." },
    ],
    score: "50 + up to 100 for speed: 650 ms average = 50, 50 ms = 150. Misses count as 1,000 ms.",
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
    goal: "Tap all sixteen numbers from smallest to largest.",
    how: [
      { action: "Find the smallest", detail: "remaining number." },
      { action: "Tap in order", detail: "until every number is cleared." },
    ],
    score: "Faster = more points. Wrong taps cost points. How far you got still scores.",
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
    goal: "Find every matching arrow in three growing grids.",
    how: [
      { action: "Tap every match", detail: "of each grid's target arrow." },
      { action: "Finding them all", detail: "moves on by itself." },
      { action: "Press Next", detail: "to move on early — 30 seconds for all three." },
    ],
    score: "Points for every arrow found; wrong taps cost a little; all three grids perfect for the time bonus.",
  },
  spotdiff: {
    goal: "Find all five differences between the two pictures.",
    how: [
      { action: "Compare both panels", detail: "carefully." },
      { action: "Tap each difference", detail: "in either panel." },
    ],
    score: "Twenty a difference. All five = full points and the speed bonus.",
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
    goal: "Stop the marker inside the gold zone three times.",
    how: [
      { action: "Watch the marker", detail: "sweep across the bar." },
      { action: "Tap once", detail: "when it reaches the gold zone." },
      { action: "Each try is faster", detail: "than the one before it." },
    ],
    score: "50 + up to 100 for accuracy: 400 ms average error = 50, perfect = 150. Misses count as 800 ms.",
  },
  countup: {
    goal: "Count the matching shapes in three growing fields.",
    how: [
      { action: "Read the question", detail: "— each field asks for a new shape and colour." },
      { action: "Type the total", detail: "on the keypad; ENTER moves to the next field." },
      { action: "Three fields", detail: "share 20 seconds." },
    ],
    score: "Exact counts score most, near misses score some; all three exact for the time bonus.",
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
      { action: "Use four or more letters", detail: "without reusing a tile." },
      { action: "Release, tap the last letter again, or tap Submit", detail: "to submit each word." },
    ],
    score: "Round score = 3 × word points, up to 150. The counter shows word points.",
  },
  unblock: {
    goal: "Slide the gold car through the exit.",
    how: [
      { action: "Drag each car", detail: "only along its own direction." },
      { action: "Clear a path", detail: "for the gold car." },
      { action: "Slide the gold car", detail: "out through the opening." },
    ],
    score: "Fewer moves is what counts — par earns the full bonus; speed is a small extra.",
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
    score: "Fewer moves is what counts — par earns the full bonus; speed is a small extra.",
  },
  pipes: {
    goal: "Connect every pipe to the source with no leaks.",
    how: [
      { action: "Tap a tile", detail: "to rotate its pipe." },
      { action: "Join every opening", detail: "to another pipe or the source." },
      { action: "Leave no leaks", detail: "at the grid edges." },
    ],
    score: "All 36 = 100 plus speed. 35 = 90, 34 = 85, 32–33 = 80; fewer still score.",
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
    score: "Fewer moves is what counts — par earns the full bonus; speed is a small extra.",
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
    goal: "Light all six gems with one shot.",
    how: [
      { action: "Drag mirrors", detail: "onto the grid — all nine are needed." },
      { action: "Tap a mirror", detail: "to flip it." },
      { action: "Tap FIRE", detail: "to shoot — you get three shots and must avoid bombs." },
    ],
    score: "Faster = more points. Fewer shots = bonus. Each gem lit still scores.",
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
    score: "Faster = more points. How far along the route you got still scores.",
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
    score: "Fewer moves and a faster finish = more points. Each sorted tube scores.",
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
    goal: "Read all six rules, work out the four steps, then do them in order.",
    how: [
      {
        action: "Only one order fits",
        detail: "the six rules together allow exactly one sequence.",
      },
      { action: "Four steps exactly", detail: "tap wires and buttons, then tap DEFUSE." },
      { action: "One wrong step", detail: "and it explodes." },
    ],
    score: "Defuse fast; a correct opening earns partial credit.",
  },
  gravity: {
    goal: "Tilt the board so each ball lands on its own colour's target — at the same time.",
    how: [
      { action: "Tap an arrow", detail: "and both balls slide until they hit something." },
      { action: "Use one ball", detail: "to block the other — they stop against each other." },
      { action: "Undo or Reset", detail: "if a tilt traps you." },
    ],
    score: "Fewer moves is what counts — par earns the full bonus; speed is a small extra.",
  },
  chain: {
    goal: "Tap the shapes in the order shown, without crossing your own line.",
    how: [
      { action: "Follow the cycle", detail: "— it repeats." },
      { action: "Keep your chain", detail: "from crossing itself." },
      { action: "Tap Undo or Reset", detail: "to take links back — mistakes still count." },
    ],
    score: "Fifteen links, fast, no mistakes. Part-built chains still score.",
  },
  intruder: {
    goal: "One thing changes. Find it.",
    how: [
      { action: "Memorise the grid", detail: "in the five seconds it is shown." },
      { action: "One tap only", detail: "on the changed cell, within three seconds." },
      { action: "Three grids", detail: "with more shapes and colours each time." },
    ],
    score: "All three right for the speed bonus.",
  },
  nonogram: {
    goal: "Fill the grid so every row and column matches its numbers.",
    how: [
      { action: "Tap to fill", detail: "a cell, tap again to mark it empty." },
      { action: "Read the numbers", detail: "as the lengths of the filled runs, in order." },
      { action: "A line dims", detail: "once it matches its numbers." },
    ],
    score: "Finish inside 120 seconds; faster finishes score more.",
  },
  pairmatch: {
    goal: "Find all ten matching pairs.",
    how: [
      { action: "Tap two cards", detail: "to turn them over." },
      { action: "A match stays up", detail: "— a miss flips back." },
      { action: "Remember", detail: "where everything was." },
    ],
    score: "Solve for 100 plus speed. Twelve flip-pairs or fewer adds 20; found pairs still score.",
  },
  flood: {
    goal: "Flood the whole board with one colour.",
    how: [
      { action: "Tap a colour", detail: "to change your region." },
      { action: "Your region grows", detail: "into every touching cell of that colour." },
      { action: "Start from the top-left", detail: "— that cell is always yours." },
    ],
    score: "Fewer moves is what counts — par earns the full bonus; speed is a small extra.",
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
    score: "Fewer moves is what counts — par earns the full bonus; speed is a small extra.",
  },
  rings: {
    goal: "Turn the rings so every spoke is one colour.",
    how: [
      { action: "Select a ring", detail: "then use the arrow buttons to turn it." },
      { action: "Rings two and three", detail: "also turn the next ring out." },
      { action: "Watch the rim", detail: "for a gold tick on each finished spoke." },
    ],
    score: "Fewer moves is what counts — par earns the full bonus; speed is a small extra.",
  },
  hover: {
    goal: "Fly through as many gaps as you can.",
    how: [
      { action: "Tap anywhere", detail: "to hover up; let go to drop." },
      { action: "Hit anything", detail: "and the run ends." },
      { action: "Everyone flies", detail: "the same course for sixty seconds." },
    ],
    score: "45 gates in the run; 2 per gate, and all 45 = 100.",
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
      { action: "The bin moves", detail: "further away every throw." },
    ],
    score: "10 per basket; all ten add the whole seconds left on the clock.",
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
    ],
    score: "100 = 150; otherwise 146 − 3 per point short of 100. Unfired arrows score 0.",
  },
  matchup: {
    goal: "Make lines of three or more matching symbols.",
    how: [
      { action: "Swap two neighbours", detail: "by dragging one onto the other." },
      { action: "Make four, five, or a T / L", detail: "to create bombs, crosses and stars (stars clear both diagonals)." },
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
    ],
    score: "4 per lane advanced, +4 per crossing completed (a full crossing = 40), up to 150.",
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
      { action: "Four gold ★ bricks", detail: "drop a capsule: catch it for a power-up. MULTI doubles your balls." },
      { action: "Drag in the bottom quarter", detail: "to move the paddle — ×5 and laser use the gold button." },
    ],
    score: "2 per brick destroyed; all 72 bricks = 150.",
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
        action: "Two rainbow discs",
        detail: "— the star opens five bomb-free seconds, the bar hangs a row of six.",
      },
    ],
    score: "150 × discs sliced ÷ discs available (a missed rainbow costs its whole batch), −10 per bomb.",
  },
  bubble: {
    goal: "Pop the bubbles by matching three of a colour.",
    how: [
      { action: "Drag to aim, release to shoot", detail: "— bounce off the walls." },
      { action: "Three of a colour pop", detail: "when they touch." },
      { action: "Bubbles left hanging", detail: "fall off the field." },
      { action: "Ninety seconds", detail: "on the same field for everyone." },
    ],
    score: "Clear the field = 150; otherwise 150 − 3 per bubble left.",
  },
  beat: {
    goal: "Tap the notes in time.",
    how: [
      { action: "Tap a lane", detail: "as its note reaches the line." },
      { action: "Closer is better", detail: "— perfect, good, or just OK." },
      { action: "A tap with no note", detail: "costs nothing." },
    ],
    score: "Perfect 1, good 0.75, OK 0.25, miss −2, up to 150.",
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
  whack: {
    goal: "Tap the targets the banner tells you to.",
    how: [
      { action: "Targets pop up", detail: "and vanish fast." },
      { action: "The rule flips partway through", detail: "— watch the banner." },
      { action: "Bombs and wrong colours", detail: "cost you." },
    ],
    score: "Points for the share of targets you hit; every wrong tap costs 10.",
  },
  wavefront: {
    goal: "Shoot down the formation before it reaches you.",
    how: [
      { action: "Drag to move", detail: "— you fire automatically." },
      { action: "Dodge the red bolts.", detail: "Three hits and you're out." },
      { action: "The formation speeds up", detail: "as it thins." },
    ],
    score: "Points for shapes, saucers and waves; the total is scaled.",
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
    score: "5 per arrow deflected, −10 per life lost.",
  },
  junction: {
    goal: "Keep the traffic moving without a crash.",
    how: [
      { action: "Tap the black corner beside a road", detail: "to switch its light between red (stop) and green (go)." },
      { action: "Cars on red queue up", detail: "— and they don't wait forever." },
      { action: "Later,", detail: "some cars turn." },
    ],
    score: "3 per car through, −1 per car that gives up, +40 for surviving the minute.",
  },
  inkbridge: {
    goal: "Draw a path so the ball rolls into the bucket.",
    how: [
      { action: "Draw lines around the grey blocks,", detail: "then tap RELEASE." },
      { action: "Ink is limited", detail: "— more each level." },
      { action: "Three failed drops", detail: "and you're out." },
    ],
    score: "2 points × the level number for each level; finish all ten fast for the bonus.",
  },
  burst: {
    goal: "Pop every ball — big ones split into smaller ones.",
    how: [
      { action: "Drag along the bottom bar (or use the arrows) to move,", detail: "tap the arena or FIRE to shoot straight up." },
      { action: "Pop a purple ball and catch the gold icon", detail: "for triple BURST shots until you lose a life." },
      { action: "Don't let a ball touch you", detail: "— three touches and you're out." },
    ],
    score: "3 per ball popped or split, −9 per life lost. Clear four waves without losing a life for 150.",
  },
  orbit: {
    goal: "Hop from planet to planet.",
    how: [
      { action: "You orbit automatically.", detail: "Tap to let go — you fly straight until the next orbit catches you." },
      { action: "Miss and you drift away.", detail: "Avoid the red arcs." },
    ],
    score: "3 per planet; finish all forty early for the time bonus. Skipping a planet is allowed if you can make the next one.",
  },
  swing: {
    goal: "Swing as far as you can.",
    how: [
      { action: "Hold to grab an anchor and swing,", detail: "let go to fly." },
      { action: "Stuck? Keep swinging", detail: "— every pass gets you higher. Swipe up to shorten the rope for speed." },
      { action: "Don't touch the spikes", detail: "or fall to the floor." },
    ],
    score: "1 point per metre.",
  },
  tilt: {
    goal: "Roll the ball out of the maze.",
    how: [
      { action: "Drag left or right to spin the maze", detail: "— the ball always rolls down." },
      { action: "Each escape brings a harder maze.", detail: "Red pits end the run." },
      { action: "You have 90 seconds.", detail: "" },
    ],
    score: "30 per maze completed (ball out through the exit) — five completed = 150.",
  },
  hotfloor: {
    goal: "Plan a route to the exit before the floor falls.",
    how: [
      { action: "Each number is how many hops that tile lasts after you press GO.", detail: "" },
      { action: "Tap tiles to draw your route, then GO.", detail: "Stay within the hop budget." },
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
    score: "Solve it fast for the bonus.",
  },
  lightup: {
    goal: "Place bulbs so every white square is lit.",
    how: [
      { action: "A bulb lights everything in its row and column", detail: "until it hits a black wall." },
      { action: "Bulbs must never shine on each other.", detail: "" },
      { action: "A number on a wall", detail: "says exactly how many bulbs touch that wall's sides." },
    ],
    score: "Solve it fast for the bonus.",
  },
  tents: {
    goal: "Pitch one tent beside every tree.",
    how: [
      { action: "Tap a cell", detail: "for a tent, again for grass, again to clear." },
      { action: "Tents can't touch,", detail: "even diagonally." },
      { action: "The numbers", detail: "say how many tents are in each row and column." },
    ],
    score: "Solve it fast for the bonus.",
  },
};
