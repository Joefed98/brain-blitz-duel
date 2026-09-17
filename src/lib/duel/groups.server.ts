import { pick, shuffled } from "./random";
import type { GroupsPuzzleData, GroupsSecretGroup } from "./types";

interface GroupsBankEntry {
  groups: GroupsSecretGroup[];
  /** Cross-theme associations checked during curation. */
  redHerrings: string[];
}

const entry = (
  aTheme: string,
  a: [string, string, string, string],
  bTheme: string,
  b: [string, string, string, string],
  redHerrings: [string, string],
): GroupsBankEntry => ({
  groups: [
    { theme: aTheme, words: a },
    { theme: bTheme, words: b },
  ],
  redHerrings,
});

/** Curated exact wordplay and named-set partitions. Cross-associations are hints, never alternate exact answers. */
const GROUPS_SEEDS: GroupsBankEntry[] = [
  entry(
    "Things with keys",
    ["Piano", "Map", "Door", "Laptop"],
    "Things with strings",
    ["Guitar", "Puppet", "Kite", "Bow"],
    ["Piano has strings", "Laptop can use string data"],
  ),
  entry(
    "Words before STONE",
    ["Lime", "Sand", "Mile", "Grave"],
    "Words before FALL",
    ["Rain", "Night", "Water", "Down"],
    ["Water wears stone", "Grave suggests a fall"],
  ),
  entry(
    "Chess pieces",
    ["Rook", "Bishop", "Knight", "King"],
    "Playing-card terms",
    ["Jack", "Ace", "Suit", "Trick"],
    ["King is also a card", "Trick is a chess tactic"],
  ),
  entry(
    "Words before BOARD",
    ["Key", "Black", "Skate", "Card"],
    "Words before WALK",
    ["Moon", "Cat", "Cake", "Side"],
    ["Cat can walk a board", "Card can be a board game"],
  ),
  entry(
    "Words after FIRE",
    ["Fly", "Place", "Wood", "Power"],
    "Words after WATER",
    ["Fall", "Melon", "Proof", "Mark"],
    ["Water can power", "Fire and waterfall are natural features"],
  ),
  entry(
    "Words before LIGHT",
    ["Day", "Moon", "Flash", "Spot"],
    "Words before HOUSE",
    ["Green", "Light", "Club", "Ware"],
    ["Light belongs to both phrases", "Moon can describe a house shape"],
  ),
  entry(
    "Words after BOOK",
    ["Case", "Mark", "Shelf", "Worm"],
    "Words after NOTE",
    ["Book", "Pad", "Worth", "Paper"],
    ["Book is a note collection", "Paper makes books"],
  ),
  entry(
    "Words before PRINT",
    ["Foot", "Blue", "Finger", "News"],
    "Words before MARK",
    ["Question", "Trade", "Water", "Bench"],
    ["Watermark can be printed", "Footmark resembles footprint"],
  ),
  entry(
    "Words after SUN",
    ["Flower", "Shine", "Burn", "Screen"],
    "Words after MOON",
    ["Light", "Beam", "Walk", "Stone"],
    ["Sunlight is common", "Moonshine is a word"],
  ),
  entry(
    "Words before BALL",
    ["Foot", "Snow", "Eye", "Meat"],
    "Words before LINE",
    ["Side", "Punch", "Finish", "Clothes"],
    ["Eyeline is valid", "Punch ball is plausible"],
  ),
  entry(
    "Words after BLACK",
    ["Bird", "Smith", "Board", "Jack"],
    "Words after BLUE",
    ["Berry", "Bell", "Print", "Moon"],
    ["Blackberry is valid", "Blueprint can be black"],
  ),
  entry(
    "Words before WORK",
    ["Home", "Net", "Frame", "Clock"],
    "Words before ROOM",
    ["Bath", "Mush", "Class", "Bed"],
    ["Classwork is valid", "Bedroom can be a workspace"],
  ),
  entry(
    "Words after BACK",
    ["Bone", "Pack", "Ground", "Drop"],
    "Words after HAND",
    ["Bag", "Book", "Rail", "Shake"],
    ["Handbag and backpack overlap", "Background can be hand-drawn"],
  ),
  entry(
    "Words before WATCH",
    ["Wrist", "Night", "Stop", "Pocket"],
    "Words before CLOCK",
    ["Alarm", "Cuckoo", "Wall", "Body"],
    ["Wrist clock is plausible", "Stopclock resembles stopwatch"],
  ),
  entry(
    "Words after HORSE",
    ["Shoe", "Power", "Radish", "Play"],
    "Words after SEA",
    ["Horse", "Shell", "Food", "Saw"],
    ["Seahorse is exact", "Horseplay can happen at sea"],
  ),
  entry(
    "Words before BAND",
    ["Head", "Rubber", "Waist", "Watch"],
    "Words before BELT",
    ["Seat", "Black", "Fan", "Bible"],
    ["Black band is common", "Waist belt is plausible"],
  ),
  entry(
    "Words after EYE",
    ["Ball", "Brow", "Lash", "Sight"],
    "Words after NOSE",
    ["Dive", "Bleed", "Ring", "Cone"],
    ["Eye ring is anatomical", "Nose sight is plausible"],
  ),
  entry(
    "Words before BERRY",
    ["Blue", "Straw", "Goose", "Rasp"],
    "Words before APPLE",
    ["Pine", "Crab", "Road", "Adam's"],
    ["Pineberry exists", "Apple-blueberry are both fruit"],
  ),
  entry(
    "Words after DAY",
    ["Break", "Dream", "Light", "Time"],
    "Words after NIGHT",
    ["Fall", "Mare", "Club", "Gown"],
    ["Nighttime is valid", "Dayfall sounds plausible"],
  ),
  entry(
    "Words before PIPE",
    ["Bag", "Wind", "Drain", "Lead"],
    "Words before DREAM",
    ["Day", "Pipe", "Fever", "Bad"],
    ["Pipe dream is exact", "Wind dream is evocative"],
  ),
  entry(
    "Words after NEWS",
    ["Paper", "Cast", "Letter", "Room"],
    "Words after MAIL",
    ["Box", "Man", "Bag", "Order"],
    ["Mailroom is exact", "Newsletter arrives by mail"],
  ),
  entry(
    "Words after TOOTH",
    ["Ache", "Brush", "Paste", "Pick"],
    "Words after HAIR",
    ["Comb", "Cut", "Line", "Pin"],
    ["Brush is deliberately shared-looking", "Hairpick is plausible"],
  ),
  entry(
    "Words before MAN",
    ["Fire", "Post", "Snow", "Iron"],
    "Words before WOMAN",
    ["Wonder", "Cat", "Super", "Police"],
    ["Policeman is valid", "Iron Woman sounds like a title"],
  ),
  entry(
    "Words after FOOT",
    ["Print", "Ball", "Note", "Hold"],
    "Words after HAND",
    ["Cuff", "Bag", "Shake", "Rail"],
    ["Print and ball pair with both stems colloquially", "Footstand is plausible"],
  ),
  entry(
    "Words before STORM",
    ["Brain", "Snow", "Thunder", "Fire"],
    "Words before CLOUD",
    ["Rain", "Dust", "Word", "Mushroom"],
    ["Thundercloud is exact", "Rainstorm is exact"],
  ),
  entry(
    "Words after GREEN",
    ["House", "Horn", "Land", "Back"],
    "Words after RED",
    ["Head", "Coat", "Wood", "Eye"],
    ["Greenwood is valid", "Redback and greenback mirror"],
  ),
  entry(
    "Words before HOLE",
    ["Man", "Key", "Pot", "Button"],
    "Words before DOOR",
    ["Trap", "Back", "Stage", "Cellar"],
    ["Key opens a door", "Trap hole is plausible"],
  ),
  entry(
    "Words after OVER",
    ["Look", "Coat", "Night", "Flow"],
    "Words after UNDER",
    ["Study", "Wear", "Pass", "Tow"],
    ["Overwear is plausible", "Underflow is technical"],
  ),
  entry(
    "Words before WAY",
    ["High", "Sub", "Drive", "Rail"],
    "Words before PATH",
    ["Foot", "War", "Cycle", "Garden"],
    ["Rail path is plausible", "Cycleway is exact"],
  ),
  entry(
    "Words before ROOM",
    ["Bath", "Mush", "Class", "News"],
    "Words before BOARD",
    ["Dash", "Cup", "Surf", "Score"],
    ["Class board is plausible", "Newsroom and scoreboard overlap context"],
  ),
  entry(
    "Words after HEAD",
    ["Ache", "Line", "Light", "Strong"],
    "Words after HEART",
    ["Pulse", "Beat", "Break", "Burn"],
    ["Ache pairs with both stems", "Headline can concern heartbreak"],
  ),
  entry(
    "Words before CASE",
    ["Book", "Suit", "Show", "Stair"],
    "Words before FILE",
    ["Nail", "Profile", "Data", "Text"],
    ["Case file is exact in reverse", "Book file is plausible"],
  ),
  entry(
    "Words after STAR",
    ["Fish", "Light", "Dust", "Board"],
    "Words after GOLD",
    ["Bar", "Mine", "Leaf", "Rush"],
    ["Starfish and goldfish overlap animal form", "Gold dust is exact"],
  ),
  entry(
    "Words before HOUSE",
    ["Light", "Green", "Club", "Ware"],
    "Words before BOAT",
    ["Life", "Speed", "Sail", "House"],
    ["Houseboat is exact", "Lighthouse relates to boats"],
  ),
  entry(
    "Words after CROSS",
    ["Word", "Walk", "Fire", "Bow"],
    "Words after RAIN",
    ["Storm", "Drop", "Coat", "Forest"],
    ["Bow pairs with both stems", "Crossfire can happen in rain"],
  ),
  entry(
    "Words before RING",
    ["Ear", "Key", "Box", "Spring"],
    "Words before TONE",
    ["Ring", "Skin", "Dial", "Under"],
    ["Ringtone is exact", "Key tone is musical"],
  ),
  entry(
    "Words after SIDE",
    ["Walk", "Kick", "Burn", "Show"],
    "Words after ROAD",
    ["Side", "Block", "House", "Kill"],
    ["Roadside is exact", "Side road is exact in reverse"],
  ),
  entry(
    "Words before BREAK",
    ["Day", "Heart", "Jail", "Coffee"],
    "Words before DOWN",
    ["Break", "Touch", "Show", "Lock"],
    ["Breakdown is exact", "Touch break is sporting language"],
  ),
  entry(
    "Words after PAPER",
    ["Back", "Clip", "Work", "Weight"],
    "Words after CARD",
    ["Board", "Game", "Stock", "Sharp"],
    ["Cardboard is paper-based", "Paper game is plausible"],
  ),
  entry(
    "Words before BOX",
    ["Mail", "Tool", "Lunch", "Music"],
    "Words before BAG",
    ["Hand", "Punch", "Tea", "Sand"],
    ["Punch box is plausible", "Lunch bag is exact"],
  ),
  entry(
    "Words after CLOCK",
    ["Work", "Wise", "Face", "Tower"],
    "Words after TIME",
    ["Line", "Table", "Zone", "Piece"],
    ["Timepiece is clock-like", "Clockwise describes time"],
  ),
  entry(
    "Words before LINE",
    ["Punch", "Finish", "Side", "Story"],
    "Words before POINT",
    ["View", "Match", "Pin", "Power"],
    ["Punch point is plausible", "Story point and storyline overlap"],
  ),
  entry(
    "Words after AIR",
    ["Port", "Line", "Wave", "Bag"],
    "Words after SKY",
    ["Lark", "Light", "Dive", "Scraper"],
    ["Airline and skyline cross conceptually", "Skydive uses air"],
  ),
  entry(
    "Words before SIDE",
    ["Bed", "Road", "Sea", "Blind"],
    "Words before TOP",
    ["Table", "Hill", "Desk", "Tank"],
    ["Bedtop is plausible", "Table side is exact phrase"],
  ),
  entry(
    "Words after PLAY",
    ["Ground", "List", "Back", "Mate"],
    "Words after GAME",
    ["Play", "Plan", "Show", "Bird"],
    ["Gameplay is exact", "Playmate can be a game partner"],
  ),
  entry(
    "Words before LAND",
    ["Green", "Ice", "Main", "Dream"],
    "Words before MARK",
    ["Land", "Hall", "Trade", "Bench"],
    ["Landmark is exact", "Dreamland and hallmark evoke places"],
  ),
  entry(
    "Words after HOME",
    ["Work", "Land", "Made", "Sick"],
    "Words after HAND",
    ["Cuff", "Shake", "Bag", "Rail"],
    ["Homework and handwork both exact", "Handmade and homemade both exact"],
  ),
  entry(
    "Words before NOTE",
    ["Foot", "Bank", "Key", "Love"],
    "Words before BOOK",
    ["Note", "Text", "Guide", "Scrap"],
    ["Notebook is exact", "Footbook sounds plausible"],
  ),
  entry(
    "Words after RAIN",
    ["Bow", "Drop", "Fall", "Coat"],
    "Words after SNOW",
    ["Ball", "Man", "Plough", "Shoe"],
    ["Snowfall is exact", "Raindrop and snowball are weather forms"],
  ),
  entry(
    "Words before SCREEN",
    ["Sun", "Wind", "Touch", "Blue"],
    "Words before SAVER",
    ["Screen", "Life", "Time", "Labour"],
    ["Screensaver is exact", "Sunsaver is a product-like phrase"],
  ),
  entry(
    "Words after LIGHT",
    ["House", "Bulb", "Year", "Weight"],
    "Words after HEAVY",
    ["Rain", "Metal", "Duty", "Heart"],
    ["Lightweight and heavyweight are exact opposites", "Light metal is valid"],
  ),
  entry(
    "Words before SHOP",
    ["Work", "Coffee", "Pet", "Book"],
    "Words before STORE",
    ["Drug", "Dept", "Chain", "App"],
    ["Book belongs naturally with both retail terms", "Workshop may be a store workspace"],
  ),
  entry(
    "Words after WALL",
    ["Paper", "Flower", "Street", "aby"],
    "Words after FLOOR",
    ["Board", "Plan", "Show", "Mat"],
    ["Wallboard is exact", "Floor paper is plausible covering"],
  ),
  entry(
    "Words before FIELD",
    ["Air", "Corn", "Mine", "Playing"],
    "Words before COURT",
    ["Food", "Tennis", "Law", "Royal"],
    ["Playing court is plausible", "Tennis field is colloquial"],
  ),
  entry(
    "Words after SOUND",
    ["Track", "Wave", "Board", "Proof"],
    "Words after WATER",
    ["Line", "Fall", "Mark", "Shed"],
    ["Soundproof and waterproof are exact", "Water sound is natural"],
  ),
  entry(
    "Words before TRACK",
    ["Sound", "Race", "Fast", "Eight"],
    "Words before ROAD",
    ["Rail", "Silk", "Ring", "Back"],
    ["Rail track and railroad overlap", "Race road is plausible"],
  ),
  entry(
    "Words after CLASS",
    ["Room", "Mate", "Work", "Act"],
    "Words after TEAM",
    ["Goal", "Player", "Sheet", "Spirit"],
    ["Classmate and teammate are exact", "Classwork and teamwork are exact"],
  ),
  entry(
    "Words before COAT",
    ["Rain", "Over", "Trench", "Top"],
    "Words before CAP",
    ["Night", "Knee", "Bottle", "Ice"],
    ["Night coat is plausible", "Ice coat is a layer"],
  ),
  entry(
    "Words after BED",
    ["Room", "Time", "Rock", "Bug"],
    "Words after NIGHT",
    ["Club", "Shift", "Owl", "Gown"],
    ["Bedtime and nighttime are exact", "Night bug is plausible"],
  ),
  entry(
    "Words before FLY",
    ["Butter", "Dragon", "Fire", "Horse"],
    "Words before BIRD",
    ["Black", "Blue", "Humming", "Jail"],
    ["Black fly is exact", "Firebird is exact"],
  ),
  entry(
    "Words after TREE",
    ["House", "Top", "Line", "Ring"],
    "Words after FAMILY",
    ["Tree", "Name", "Room", "Man"],
    ["Family tree is exact", "Treehouse can hold a family"],
  ),
  entry(
    "Words before BANK",
    ["River", "Food", "Blood", "Data"],
    "Words before ACCOUNT",
    ["Bank", "User", "Expense", "Email"],
    ["Bank account is exact", "Data account sounds technical"],
  ),
  entry(
    "Words after ROCK",
    ["Star", "Fall", "Bottom", "Pool"],
    "Words after RIVER",
    ["Bed", "Bank", "Boat", "Stone"],
    ["River rock is exact", "Rock pool and river pool overlap"],
  ),
  entry(
    "Words before STAR",
    ["Rock", "Pop", "Sea", "North"],
    "Words before FISH",
    ["Star", "Jelly", "Sword", "Shell"],
    ["Starfish is exact", "Rockfish is exact"],
  ),
  entry(
    "Words after FACE",
    ["Book", "Lift", "Time", "Value"],
    "Words after PLACE",
    ["Mat", "Holder", "Name", "Setting"],
    ["Face value and place value are exact", "Facebook and placename both labels"],
  ),
  entry(
    "Words before TABLE",
    ["Time", "Turn", "Pool", "Coffee"],
    "Words before CHAIR",
    ["Arm", "Deck", "High", "Wheel"],
    ["Wheel table is plausible machinery", "Coffee chair is café furniture"],
  ),
  entry(
    "Words after COLD",
    ["Snap", "Case", "Feet", "Front"],
    "Words after HOT",
    ["Dog", "Spot", "Head", "Line"],
    ["Hot case and cold case both phrases", "Cold front and hot line suggest weather"],
  ),
  entry(
    "Words before FRONT",
    ["Water", "Shop", "Battle", "Home"],
    "Words before PAGE",
    ["Front", "Turn", "Web", "Title"],
    ["Front page and home page are exact", "Water page sounds cartographic"],
  ),
  entry(
    "Words after HIGH",
    ["Light", "Way", "Land", "Five"],
    "Words after LOW",
    ["Blow", "Life", "Down", "Key"],
    ["Highlight and lowlight are exact", "High-key and low-key both valid"],
  ),
  entry(
    "Words before CARD",
    ["Post", "Score", "Credit", "Wild"],
    "Words before GAME",
    ["Card", "Video", "Board", "End"],
    ["Card game is exact", "Score game is plausible"],
  ),
  entry(
    "Words after MIND",
    ["Set", "Ful", "Game", "Reader"],
    "Words after HEAD",
    ["Ache", "Line", "Room", "Master"],
    ["Mindset and headset are exact", "Head game and mind game overlap"],
  ),
  entry(
    "Words before POWER",
    ["Horse", "Star", "Fire", "Will"],
    "Words before HOUSE",
    ["Power", "Green", "Club", "Light"],
    ["Powerhouse is exact", "Firehouse is exact"],
  ),
  entry(
    "Words after BLUE",
    ["Jay", "Print", "Bell", "Moon"],
    "Words after BLACK",
    ["Bird", "Board", "Berry", "Smith"],
    ["Bird and berry pair exactly with both colours", "Blueprint and blackboard are visual media"],
  ),
  entry(
    "Words before DROP",
    ["Rain", "Back", "Eye", "Micro"],
    "Words before FALL",
    ["Water", "Night", "Down", "Pit"],
    ["Raindrop and rainfall overlap", "Backdrop can depict a waterfall"],
  ),
  entry(
    "Words after BREAK",
    ["Fast", "Point", "Through", "Water"],
    "Words after CUT",
    ["Back", "Down", "Out", "Throat"],
    ["Breakdown and cutdown are exact", "Breakout and cutout mirror"],
  ),
  entry(
    "Words before POINT",
    ["Check", "View", "Match", "Power"],
    "Words before LINE",
    ["Base", "Punch", "Finish", "Guide"],
    ["Checkpoint can sit on a finish line", "Power line is exact"],
  ),
  entry(
    "Words after DEAD",
    ["Beat", "Lock", "Wood", "End"],
    "Words after LIFE",
    ["Line", "Time", "Boat", "Style"],
    ["Lifeline and deadline are exact", "Deadwood and lifeboat both survival imagery"],
  ),
  entry(
    "Words before SHIP",
    ["Friend", "Battle", "Space", "Flag"],
    "Words before BOAT",
    ["Steam", "Sail", "Life", "House"],
    ["Battleship and battle boat overlap", "Spaceship and houseboat are dwellings"],
  ),
  entry(
    "Words after WIND",
    ["Mill", "Pipe", "Sock", "Screen"],
    "Words after RAIN",
    ["Fall", "Bow", "Drop", "Coat"],
    ["Windfall and rainfall are exact", "Windscreen and raincoat protect travellers"],
  ),
  entry(
    "Words before HEAD",
    ["Arrow", "Pin", "Figure", "Letter"],
    "Words before FOOT",
    ["Big", "Club", "Flat", "Square"],
    ["Pinhead and clubfoot are body terms", "Figure foot is typographic"],
  ),
  entry(
    "Words after KEY",
    ["Board", "Stone", "Note", "Hole"],
    "Words after LOCK",
    ["Smith", "Jaw", "Down", "Step"],
    ["Keystone and locksmith relate to access", "Keyhole and lockdown share doors"],
  ),
  entry(
    "Words before LIGHT",
    ["Spot", "Flash", "Street", "Candle"],
    "Words before SHADE",
    ["Lamp", "Eye", "Sun", "Night"],
    ["Lamplight is exact", "Nightlight and nightshade are exact"],
  ),
];

/**
 * Pair each curated two-theme seed with the next compatible seed. Every bank
 * puzzle therefore has four disjoint themes, sixteen distinct words and at
 * least four deliberately documented cross-theme red herrings. The offset is
 * coprime to the seed count, so this yields at least sixty different walls.
 */
export const GROUPS_BANK: GroupsBankEntry[] = GROUPS_SEEDS.flatMap((first, index) => {
  for (let offset = 1; offset < GROUPS_SEEDS.length; offset++) {
    const second = GROUPS_SEEDS[(index + offset * 17) % GROUPS_SEEDS.length];
    if (!second) continue;
    const groups = [...first.groups, ...second.groups];
    const words = groups.flatMap((group) => group.words).map((word) => word.toUpperCase());
    const themes = groups.map((group) => group.theme.toUpperCase());
    if (groups.length !== 4 || new Set(words).size !== 16 || new Set(themes).size !== 4) continue;
    return [{ groups, redHerrings: [...first.redHerrings, ...second.redHerrings] }];
  }
  return [];
}).slice(0, 80);

if (GROUPS_BANK.length < 60) throw new Error("Groups bank must contain at least 60 unique walls");

export function generateGroups(): GroupsPuzzleData {
  const chosen = pick(GROUPS_BANK);
  return {
    type: "groups",
    words: shuffled(chosen.groups.flatMap((group) => group.words)),
    groups: chosen.groups.map((group) => ({ theme: group.theme, words: [...group.words] })),
  };
}

export function matchGroupsSelection(puzzle: GroupsPuzzleData, indices: number[]): number | null {
  if (indices.length !== 4 || new Set(indices).size !== 4) return null;
  const selected = indices
    .map((index) => puzzle.words[index])
    .filter((word): word is string => Boolean(word));
  if (selected.length !== 4) return null;
  const key = [...selected].sort().join("|");
  const matched = (puzzle.groups ?? []).findIndex(
    (group) => [...group.words].sort().join("|") === key,
  );
  return matched >= 0 ? matched : null;
}

export function decodeGroupsAnswer(answer: string): number[][] {
  return answer
    .split(";")
    .map((part) => part.split(",").map(Number).filter(Number.isInteger))
    .filter((set) => set.length === 4);
}
